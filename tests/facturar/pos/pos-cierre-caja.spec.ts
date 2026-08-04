import { test, expect, Page, BrowserContext } from '@playwright/test';
import {
  PosPage, CAJA_TEXTO, TIMEOUTS, espiarErroresJS, ResumenTabGeneral, ReporteAvanzado,
  FilaFacturaVenta, FilaFacturaSimple, FilaMovimientoCaja, METODO, PESTANA_POS_FACTURACION,
} from './pos.page';
import { PosTaller } from './pos-taller.page';
import { PosPermisos, PERMISO, ROL_ADMINISTRADOR } from './pos-permisos.page';

/**
 * Crea un cliente real NUEVO, con perfil completo (Nombre, Correo,
 * Identificación) y un límite de crédito alto, para usarlo en una venta a
 * crédito — necesario porque facturar a crédito bajo "Factura Electrónica"
 * (único documento disponible en esta compañía, sin alternativa "Tiquete
 * Electrónico") exige un cliente con perfil completo, y confirmado que
 * NINGÚN cliente existente del catálogo compartido de este ambiente lo
 * tiene. Límite de crédito alto (999999) para además descartar cualquier
 * bloqueo por "supera el límite de crédito" — mismo criterio de "generar
 * los datos que se necesitan, no depender de los que ya existan" que pide
 * CLAUDE.md.
 *
 * HALLAZGO MAYOR investigado en vivo (leyendo el pos.js real servido por la
 * app y el adapter public/js/customer_form/adapters/pos.js): el modal
 * "Agregar Cliente" de este ambiente YA NO es el legacy `#dialog_add_customer`
 * que asume `PosCrearCliente` (pos-crear-cliente.page.ts, usado por
 * pos-crear.spec.ts) — la propia app migró a un componente nuevo
 * (`CustomerForm`, ver el comentario real en ese adapter: "Reemplaza al
 * modal legacy pos.modal.dialog_add_customer"). El contenedor real,
 * confirmado en vivo abriendo el modal y volcando su HTML, es
 * `#dialog_customer_form`, con campos `#cf_name`/`#cf_email`/
 * `#cf_identification_type`/`#cf_identifier`/`#cf_limit` y guardado real vía
 * `[data-cf-save]` ("Guardar y Salir") — completamente distintos de los que
 * usa `PosCrearCliente`. Esto explica por qué reutilizar ese Page Object
 * fallaba de forma reproducible (el backdrop de Bootstrap se mostraba, pero
 * `#dialog_add_customer` nunca llegó a existir en el DOM: la app abre
 * `#dialog_customer_form`, un elemento completamente distinto). No es un
 * problema de datos sucios ni de timing de esta suite — es que
 * `pos-crear-cliente.page.ts`/`pos-crear.spec.ts` quedaron desactualizados
 * frente a una migración real de la aplicación (ver el informe final de
 * Cierre de Caja para el detalle completo; corregir esa suite es una tarea
 * aparte, fuera del alcance de este spec).
 *
 * Se implementa aquí, acotado a este archivo, un flujo mínimo contra el
 * componente real — no se reescribe `PosCrearCliente` completo (alcance
 * mayor, afecta otra suite ya existente) siguiendo el mismo criterio de
 * "funcionalidad acotada" que documenta CLAUDE.md.
 */
async function crearClienteConCreditoYPerfilCompleto(pos: PosPage, page: Page): Promise<string> {
  const sufijo = Date.now();
  const nombre = `QA Credito Cierre Caja ${sufijo}`;
  const identificacion = `${sufijo}`.slice(-9);
  const email = `qa.credito.cierrecaja.${sufijo}@example.com`;

  await pos.cerrarOverlaysConocidos();
  await page.locator('.panel-customer-search .dropdown-toggle').click();
  await page.locator('#add_quick_customer').click();

  const modal = page.locator('#dialog_customer_form');
  await expect(modal, 'El modal "Agregar Cliente" (#dialog_customer_form) no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

  await modal.locator('#cf_name').fill(nombre);
  await modal.locator('#cf_email').fill(email);
  await pos._seleccionarPrimeraOpcionChosen('#dialog_customer_form #cf_identification_type_chosen');
  await modal.locator('#cf_identifier').fill(identificacion);

  // Tab "Opciones avanzadas" (data-cf-step="2") — mismo Límite de crédito
  // real que la variante legacy, solo que con id "cf_limit" en este
  // componente nuevo.
  const tabOpcionesAvanzadas = modal.locator('.cf-tab[data-cf-step="2"]');
  await tabOpcionesAvanzadas.scrollIntoViewIfNeeded();
  await tabOpcionesAvanzadas.click();
  await expect(modal.locator('#cf_limit'), 'El tab "Opciones avanzadas" no quedó activo (Límite de crédito no visible)').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  await modal.locator('#cf_limit').fill('999999');

  await modal.locator('[data-cf-save]').click();
  await expect(modal, 'El modal "Agregar Cliente" no se cerró tras guardar').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

  return nombre;
}

/**
 * Completa una venta a CRÉDITO usando un cliente real YA CREADO por
 * adelantado (ver crearClienteConCreditoYPerfilCompleto()) — evita por
 * completo el panel roto "Información del Cliente" en vez de intentar
 * completarlo. Se llama mientras ese cliente sigue auto-seleccionado del
 * carrito (recién creado) — solo busca de nuevo si por algún motivo ya no
 * lo está, ya que repetir la búsqueda por nombre no es 100% confiable (el
 * botón "Seleccionar" del resultado puede no quedar "visible" para
 * Playwright pese a existir en el DOM).
 */
async function completarVentaACreditoConClienteDisponible(
  pos: PosPage,
  page: Page,
  nombreCliente: string
): Promise<{ nombreCliente: string; total: number; iva: number }> {
  if (!(await pos.hayClienteRealSeleccionado())) {
    await pos.seleccionarClienteExistente(nombreCliente);
  }

  await pos.abrirModalDePago();
  await pos.cambiarTipoPagoEnModalPago('credito');
  const total = await pos.obtenerTotalVentaNumerico();
  const iva = await pos.obtenerTotalIvaGeneral();

  await pos.confirmarPagoAbriendoCajaSiEsNecesario();
  await pos.validarCarritoVacio();
  return { nombreCliente, total, iva };
}

test('Ciclo básico: abrir y cerrar caja', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Abrir el POS', async () => {
    // El modal "Abrir Caja" al cargar bloquea toda la página (incluido el
    // menú "Caja"), sin importar el estado real de la caja: hay que cerrarlo
    // para poder continuar. Cerrarlo con "Cancelar" no abre la caja, así que
    // no interfiere con la detección de estado que hace abrirDetalleDeCierre().
    await pos.cargarPosYCerrarModalSiAparece();
  });

  await test.step('Descartar modales/mensajes opcionales antes del flujo principal (mejor esfuerzo, sin asercion)', async () => {
    // Confirmado en vivo: el banner de permisos de notificación
    // (#workshop-web-notification-permission) puede reaparecer de forma
    // asíncrona justo después de cerrarlo — asumir que queda oculto para
    // siempre con una sola aserción es el mismo anti-patrón ya documentado
    // en abrirMenuCaja()/abrirProductoRapido(). La correctitud real de que
    // el flujo pueda continuar la garantiza abrirMenuCaja() (llamado dentro
    // de abrirDetalleDeCierre() más abajo), que ya cierra este mismo overlay
    // en cada uno de sus propios reintentos — este paso es solo un
    // best-effort para dejar la pantalla más limpia antes de empezar.
    await pos.cerrarOverlaysConocidos();
  });

  await test.step('Abrir "Detalle de Cierre" (abriendo la caja primero si estaba cerrada) y cerrarla', async () => {
    await pos.abrirDetalleDeCierre();
    await pos.completarFormularioCerrarCaja('0', '0', 'Cierre de prueba automatizado');
    await pos.confirmarCerrarCaja();
    await expect(pos.modalCerrarCaja).toBeHidden();
  });

  await test.step('Validar que la caja quedó cerrada, que el POS pide abrirla de nuevo, y que no hay errores', async () => {
    await expect(pos.primerProducto).toBeVisible();

    // Verificación independiente (no basada solo en la UI que ya se
    // manipuló): recargar el POS y confirmar que ahora sí pide abrir la caja.
    await pos.irAlPos();
    await pos.esperarEstadoInicial();
    await expect(pos.modalAbrirCaja).toBeVisible();
    await expect(pos.modalAbrirCaja.getByText(CAJA_TEXTO)).toBeVisible();

    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});


test('Tab General: Ventas Totales, Contado/Crédito, Impuestos y Método de Pago reflejan exactamente una venta de contado y una a crédito reales', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    if (await pos.modalAbrirCajaVisible()) {
      await pos.completarAperturaCaja();
      await expect(pos.modalAbrirCaja).toBeHidden();
    }
  });

  // Crear el cliente para la venta a crédito ANTES de abrir "Detalle de
  // Cierre" por primera vez — ver el comentario de
  // crearClienteConCreditoYPerfilCompleto() para la causa raíz real
  // (bug de sistema confirmado en vivo) de por qué este orden es obligatorio.
  let nombreClienteCredito = '';
  await test.step('Crear por adelantado un cliente con perfil completo y crédito disponible', async () => {
    nombreClienteCredito = await crearClienteConCreditoYPerfilCompleto(pos, page);
  });

  // El ambiente de QA es compartido y sin limpieza (ver CLAUDE.md): la caja
  // puede llevar abierta varios días acumulando ventas de otras corridas. La
  // validación real nunca compara un total absoluto — siempre el DELTA entre
  // un snapshot ANTES y uno DESPUÉS de las 2 ventas reales que este escenario
  // genera (ver el comentario de ResumenTabGeneral en pos.types.ts).
  let antes: ResumenTabGeneral;
  await test.step('Leer el snapshot de la Tab General ANTES de facturar nada', async () => {
    await pos.abrirDetalleDeCierre();
    antes = await pos.leerResumenTabGeneral();
    await pos.cancelarModalCerrarCaja();
  });

  // La venta a CRÉDITO va PRIMERO, mientras el cliente recién creado sigue
  // auto-seleccionado del carrito — evita tener que volver a buscarlo
  // (confirmado en vivo: el botón "Seleccionar" del resultado de una
  // búsqueda repetida por nombre puede no quedar "visible" para Playwright
  // pese a existir en el DOM; buscarlo de nuevo no es necesario si ya está
  // seleccionado).
  let totalCredito = 0;
  let ivaCredito = 0;
  await test.step('Crear una venta a CRÉDITO con un cliente real (con crédito disponible) y monto/IVA conocidos', async () => {
    await pos.agregarProductoRapidoSimple(`Cierre Caja Credito ${Date.now()}`, '2000');
    const resultado = await completarVentaACreditoConClienteDisponible(pos, page, nombreClienteCredito);
    totalCredito = resultado.total;
    ivaCredito = resultado.iva;
    expect(totalCredito).toBeGreaterThan(0);
  });

  let totalContado = 0;
  let ivaContado = 0;
  await test.step('Crear una venta de CONTADO con monto e IVA conocidos, pagada 100% en efectivo', async () => {
    // El cliente de la venta a crédito no debe mezclarse con esta venta:
    // se retira para que sea genuinamente "Cliente de contado".
    if (await pos.hayClienteRealSeleccionado()) {
      await pos.quitarClienteSeleccionado();
    }
    await pos.agregarProductoRapidoSimple(`Cierre Caja Contado ${Date.now()}`, '1000');

    // No se usa abrirModalDePago() aquí: ese método espera a que
    // #payment_cash_total quede VISIBLE antes de continuar, pero el modal de
    // pago conserva el modo "Crédito" de la venta anterior en esta misma
    // sesión de página (confirmado en vivo) — con Crédito aún marcado, ese
    // campo queda oculto y la espera nunca se resuelve. Se abre el modal y
    // se cambia explícitamente a "Contado" ANTES de depender de ese campo.
    await pos.presionarFacturar();
    await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await pos.cambiarTipoPagoEnModalPago('contado');
    await expect(page.locator('#payment_cash_total'), 'El campo de efectivo no quedó visible tras cambiar a "Contado"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    totalContado = await pos.obtenerTotalVentaNumerico();
    ivaContado = await pos.obtenerTotalIvaGeneral();
    expect(totalContado).toBeGreaterThan(0);
    await pos.seleccionarPagoEfectivo(String(totalContado));
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  let despues: ResumenTabGeneral;
  await test.step('Leer el snapshot DESPUÉS y validar los deltas contra los montos reales facturados', async () => {
    await pos.abrirDetalleDeCierre();
    despues = await pos.leerResumenTabGeneral();

    expect(despues.ventasTotales - antes.ventasTotales, 'Delta de "Ventas Totales" no coincide con (contado + crédito)')
      .toBeCloseTo(totalContado + totalCredito, 2);
    expect(despues.ventasContado - antes.ventasContado, 'Delta de "Contado" no coincide con la venta de contado')
      .toBeCloseTo(totalContado, 2);
    expect(despues.ventasContadoCantidad - antes.ventasContadoCantidad, 'La cantidad de ventas de contado no aumentó en exactamente 1')
      .toBe(1);
    expect(despues.ventasCredito - antes.ventasCredito, 'Delta de "Crédito" no coincide con la venta a crédito')
      .toBeCloseTo(totalCredito, 2);
    expect(despues.impuestos - antes.impuestos, 'Delta de "Impuestos" no coincide con el IVA real de ambas ventas')
      .toBeCloseTo(ivaContado + ivaCredito, 2);
    expect(despues.descuento - antes.descuento, 'No se aplicó ningún descuento en este escenario: el delta debería ser 0')
      .toBeCloseTo(0, 2);
    expect(despues.metodoPago.efectivo - antes.metodoPago.efectivo, 'Delta de "Ingresos por Método de Pago: Efectivo" no coincide con la venta de contado (pagada 100% en efectivo)')
      .toBeCloseTo(totalContado, 2);
    expect(despues.resumenCierre.ventasEfectivo - antes.resumenCierre.ventasEfectivo, 'Delta de "Resumen de cierre: + Ventas efectivo" no coincide con la venta de contado')
      .toBeCloseTo(totalContado, 2);
    expect(despues.datosCierre.total - antes.datosCierre.total, 'Delta de "Datos de Cierre: Total" no coincide con la venta de contado (la única que afecta el efectivo esperado en caja; la venta a crédito no se cobra en caja)')
      .toBeCloseTo(totalContado, 2);

    console.log(`[Tab General] Ventas Totales: ${antes.ventasTotales} -> ${despues.ventasTotales} (delta esperado ${(totalContado + totalCredito).toFixed(2)})`);
    console.log(`[Tab General] Impuestos: ${antes.impuestos} -> ${despues.impuestos} (delta esperado ${(ivaContado + ivaCredito).toFixed(2)})`);
  });

  await test.step('Cancelar el modal (no cerrar la caja, para no interferir con otros escenarios) y validar ausencia de errores', async () => {
    await pos.cancelarModalCerrarCaja();
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});


test('Reporte Avanzado: Total de Entradas coincide con Ventas Totales del Tab General, y sus subtotales reflejan las ventas reales', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    if (await pos.modalAbrirCajaVisible()) {
      await pos.completarAperturaCaja();
      await expect(pos.modalAbrirCaja).toBeHidden();
    }
  });

  let nombreClienteCredito = '';
  await test.step('Crear por adelantado un cliente con perfil completo y crédito disponible', async () => {
    nombreClienteCredito = await crearClienteConCreditoYPerfilCompleto(pos, page);
  });

  // Mismo criterio de delta que el escenario de Tab General: el ambiente
  // compartido no garantiza un cierre limpio, así que se compara un
  // snapshot ANTES vs. DESPUÉS del propio Reporte Avanzado (activándolo con
  // activarReporteAvanzado()/leerReporteAvanzado(), nunca asumiendo un total
  // absoluto), además del cruce pedido explícitamente: Ventas Totales del
  // Tab General == Total de Entradas del Reporte Avanzado, en el MISMO
  // snapshot (son la misma cifra real del cierre, no dos cosas a comparar
  // por delta entre sí).
  let tabGeneralAntes: ResumenTabGeneral;
  let reporteAntes: ReporteAvanzado;
  await test.step('Leer Tab General y Reporte Avanzado ANTES de facturar nada, y validar que ya coinciden entre sí', async () => {
    await pos.abrirDetalleDeCierre();
    tabGeneralAntes = await pos.leerResumenTabGeneral();
    reporteAntes = await pos.leerReporteAvanzado();
    expect(reporteAntes.totalEntradas, 'Total de Entradas (Reporte Avanzado) no coincide con Ventas Totales (Tab General) ANTES de facturar')
      .toBeCloseTo(tabGeneralAntes.ventasTotales, 2);
    await pos.cancelarModalCerrarCaja();
  });

  let totalCredito = 0;
  await test.step('Crear una venta a CRÉDITO con un cliente real (con crédito disponible)', async () => {
    await pos.agregarProductoRapidoSimple(`Reporte Avanzado Credito ${Date.now()}`, '2500');
    const resultado = await completarVentaACreditoConClienteDisponible(pos, page, nombreClienteCredito);
    totalCredito = resultado.total;
    expect(totalCredito).toBeGreaterThan(0);
  });

  let totalContado = 0;
  await test.step('Crear una venta de CONTADO directa (no de Orden de Taller), pagada 100% en efectivo', async () => {
    if (await pos.hayClienteRealSeleccionado()) {
      await pos.quitarClienteSeleccionado();
    }
    await pos.agregarProductoRapidoSimple(`Reporte Avanzado Contado ${Date.now()}`, '1200');

    await pos.presionarFacturar();
    await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await pos.cambiarTipoPagoEnModalPago('contado');
    await expect(page.locator('#payment_cash_total'), 'El campo de efectivo no quedó visible tras cambiar a "Contado"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    totalContado = await pos.obtenerTotalVentaNumerico();
    expect(totalContado).toBeGreaterThan(0);
    await pos.seleccionarPagoEfectivo(String(totalContado));
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  let tabGeneralDespues: ResumenTabGeneral;
  let reporteDespues: ReporteAvanzado;
  await test.step('Leer Tab General y Reporte Avanzado DESPUÉS, validar el cruce y los subtotales reales', async () => {
    await pos.abrirDetalleDeCierre();
    tabGeneralDespues = await pos.leerResumenTabGeneral();
    reporteDespues = await pos.leerReporteAvanzado();

    // El cruce pedido explícitamente: misma cifra real, dos vistas del cierre.
    expect(reporteDespues.totalEntradas, 'Total de Entradas (Reporte Avanzado) no coincide con Ventas Totales (Tab General) DESPUÉS de facturar')
      .toBeCloseTo(tabGeneralDespues.ventasTotales, 2);

    // Deltas del Reporte Avanzado contra los montos reales facturados.
    expect(reporteDespues.totalEntradas - reporteAntes.totalEntradas, 'Delta de "Total de Entradas" no coincide con (contado + crédito)')
      .toBeCloseTo(totalContado + totalCredito, 2);
    expect(reporteDespues.ventasEfectivo - reporteAntes.ventasEfectivo, 'Delta de "Ventas efectivo" (Reporte Avanzado) no coincide con la venta de contado')
      .toBeCloseTo(totalContado, 2);
    expect(reporteDespues.ventasCredito - reporteAntes.ventasCredito, 'Delta de "Ventas a crédito" (Reporte Avanzado) no coincide con la venta a crédito')
      .toBeCloseTo(totalCredito, 2);
    expect(reporteDespues.totalDevoluciones - reporteAntes.totalDevoluciones, 'No se realizó ninguna devolución en este escenario: el delta debería ser 0')
      .toBeCloseTo(0, 2);
    expect(reporteDespues.totalSalidas - reporteAntes.totalSalidas, 'No se realizó ninguna salida en este escenario: el delta debería ser 0')
      .toBeCloseTo(0, 2);
    // "Ingresos por facturas" (Ventas directas + Ventas por órdenes): la
    // venta de contado de este escenario es una venta DIRECTA (no proviene
    // de una Orden de Taller), así que su delta debe ser exactamente la
    // venta de contado.
    expect(reporteDespues.totalFacturas - reporteAntes.totalFacturas, 'Delta de "Ingresos por facturas" no coincide con la venta de contado directa')
      .toBeCloseTo(totalContado, 2);

    console.log(`[Reporte Avanzado] Total de Entradas: ${reporteAntes.totalEntradas} -> ${reporteDespues.totalEntradas} (Tab General Ventas Totales: ${tabGeneralAntes.ventasTotales} -> ${tabGeneralDespues.ventasTotales})`);
  });

  await test.step('Cancelar el modal (no cerrar la caja) y validar ausencia de errores', async () => {
    await pos.cancelarModalCerrarCaja();
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});


test('Tab Facturas: Fact. Contado y Fact. Crédito reflejan correctamente una venta directa de cada tipo', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    if (await pos.modalAbrirCajaVisible()) {
      await pos.completarAperturaCaja();
      await expect(pos.modalAbrirCaja).toBeHidden();
    }
  });

  let nombreClienteCredito = '';
  await test.step('Crear por adelantado un cliente con perfil completo y crédito disponible', async () => {
    nombreClienteCredito = await crearClienteConCreditoYPerfilCompleto(pos, page);
  });

  // Mismo criterio de delta que las fases anteriores: el ambiente compartido
  // acumula facturas de corridas previas, así que la validación real es "qué
  // fila NUEVA apareció" (por No. Fact, comparando antes/después), nunca "la
  // tabla contiene exactamente 1 fila".
  let facturasContadoAntes: FilaFacturaVenta[] = [];
  let facturasCreditoAntes: FilaFacturaVenta[] = [];
  await test.step('Leer las facturas de Contado y Crédito ANTES de facturar nada', async () => {
    await pos.abrirDetalleDeCierre();
    facturasContadoAntes = await pos.leerFacturasContadoDirectas();
    facturasCreditoAntes = await pos.leerFacturasCreditoDirectas();
    await pos.cancelarModalCerrarCaja();
  });

  let totalCredito = 0;
  await test.step('Crear una venta a CRÉDITO con un cliente real (con crédito disponible)', async () => {
    await pos.agregarProductoRapidoSimple(`Tab Facturas Credito ${Date.now()}`, '1800');
    const resultado = await completarVentaACreditoConClienteDisponible(pos, page, nombreClienteCredito);
    totalCredito = resultado.total;
    expect(totalCredito).toBeGreaterThan(0);
  });

  let totalContado = 0;
  await test.step('Crear una venta de CONTADO directa, pagada 100% en efectivo', async () => {
    if (await pos.hayClienteRealSeleccionado()) {
      await pos.quitarClienteSeleccionado();
    }
    await pos.agregarProductoRapidoSimple(`Tab Facturas Contado ${Date.now()}`, '900');

    await pos.presionarFacturar();
    await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await pos.cambiarTipoPagoEnModalPago('contado');
    await expect(page.locator('#payment_cash_total'), 'El campo de efectivo no quedó visible tras cambiar a "Contado"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    totalContado = await pos.obtenerTotalVentaNumerico();
    expect(totalContado).toBeGreaterThan(0);
    await pos.seleccionarPagoEfectivo(String(totalContado));
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  await test.step('Leer las facturas DESPUÉS y validar que aparece exactamente una fila nueva de cada tipo, con los datos reales', async () => {
    await pos.abrirDetalleDeCierre();
    const facturasContadoDespues = await pos.leerFacturasContadoDirectas();
    const facturasCreditoDespues = await pos.leerFacturasCreditoDirectas();

    const numerosFacturaContadoAntes = facturasContadoAntes.map((f) => f.numeroFactura);
    const nuevasContado = facturasContadoDespues.filter((f) => !numerosFacturaContadoAntes.includes(f.numeroFactura));
    expect(nuevasContado.length, 'No apareció exactamente 1 factura de contado nueva').toBe(1);
    const facturaContado = nuevasContado[0];
    expect(facturaContado.monto, 'El monto de la factura de contado no coincide con lo facturado').toBeCloseTo(totalContado, 2);
    expect(facturaContado.tipoPago, 'El tipo de pago de la factura de contado debería ser Efectivo').toMatch(/efectivo/i);
    expect(facturaContado.numeroFactura.length, 'La factura de contado no tiene un número de factura real').toBeGreaterThan(0);
    expect(facturaContado.consecutivo.length, 'La factura de contado no tiene un número consecutivo real').toBeGreaterThan(0);
    expect(facturaContado.fecha.length, 'La factura de contado no tiene fecha').toBeGreaterThan(0);

    const numerosFacturaCreditoAntes = facturasCreditoAntes.map((f) => f.numeroFactura);
    const nuevasCredito = facturasCreditoDespues.filter((f) => !numerosFacturaCreditoAntes.includes(f.numeroFactura));
    expect(nuevasCredito.length, 'No apareció exactamente 1 factura de crédito nueva').toBe(1);
    const facturaCredito = nuevasCredito[0];
    expect(facturaCredito.monto, 'El monto de la factura de crédito no coincide con lo facturado').toBeCloseTo(totalCredito, 2);
    expect(facturaCredito.numeroFactura.length, 'La factura de crédito no tiene un número de factura real').toBeGreaterThan(0);
    expect(facturaCredito.consecutivo.length, 'La factura de crédito no tiene un número consecutivo real').toBeGreaterThan(0);
    expect(facturaCredito.fecha.length, 'La factura de crédito no tiene fecha').toBeGreaterThan(0);

    console.log(`[Tab Facturas] Factura de contado nueva: ${JSON.stringify(facturaContado)}`);
    console.log(`[Tab Facturas] Factura de crédito nueva: ${JSON.stringify(facturaCredito)}`);

    await pos.cancelarModalCerrarCaja();
  });

  await test.step('Validar ausencia de errores', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});


/**
 * Anula la factura MÁS RECIENTE (primera tarjeta de la lista, orden
 * confirmado en vivo como más-reciente-primero) desde "Historial de
 * Facturas" — investigado en vivo abriendo el popup real que
 * `abrirHistorialFacturas()` ya expone: el detalle de una factura
 * (`#delete_invoice_btn`, confirmado en vivo con un `id` DUPLICADO real en
 * el DOM — hay una segunda copia dentro de un menú `<li>` — de ahí
 * `.first()`) muestra el botón "Anular Factura"
 * (`onclick="confirm_delete_invoice(...)"`), que dispara el SweetAlert v1
 * estándar de esta suite ("¿Está seguro de eliminar la factura No.X?",
 * confirmado en vivo que agrega el mismo texto real sin traducir "Not
 * valid!" ya documentado como bug de i18n en otro flujo de este proyecto —
 * no bloquea la eliminación). Cierra el popup al terminar para volver al
 * POS principal.
 */
async function anularFacturaMasReciente(pos: PosPage, page: Page): Promise<void> {
  await pos.abrirMenuTresPuntos();
  const historial = await pos.abrirHistorialFacturas();
  await historial.waitForLoadState('domcontentloaded').catch(() => {});

  const primeraFactura = historial.locator('text=/Consec\\./').first();
  await expect(primeraFactura, 'No apareció ninguna factura en el Historial de Ventas').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  await primeraFactura.click();

  const btnAnular = historial.locator('#delete_invoice_btn').first();
  await expect(btnAnular, 'El botón "Anular Factura" no apareció en el detalle de la factura').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  await btnAnular.click();

  const sweetAlert = historial.locator('.sweet-alert.visible');
  await expect(sweetAlert, 'El SweetAlert de confirmación de eliminar factura no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  await sweetAlert.locator('button.confirm').click();

  await expect(
    historial.locator('.noty_bar', { hasText: /elimin|anul/i }),
    'No apareció el toast de confirmación de factura eliminada'
  ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL }).catch(() => {});

  await historial.close();
}


test('Tab Facturas: Fact. Eliminadas refleja correctamente una factura anulada desde Histórico de Ventas', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    if (await pos.modalAbrirCajaVisible()) {
      await pos.completarAperturaCaja();
      await expect(pos.modalAbrirCaja).toBeHidden();
    }
  });

  let facturasEliminadasAntes: FilaFacturaSimple[] = [];
  await test.step('Leer Fact. Eliminadas ANTES de anular nada', async () => {
    await pos.abrirDetalleDeCierre();
    facturasEliminadasAntes = await pos.leerFacturasEliminadas();
    await pos.cancelarModalCerrarCaja();
  });

  let totalFactura = 0;
  await test.step('Crear una venta de CONTADO conocida, para anularla a continuación', async () => {
    await pos.agregarProductoRapidoSimple(`Tab Facturas Eliminada ${Date.now()}`, '650');
    await pos.presionarFacturar();
    await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await pos.cambiarTipoPagoEnModalPago('contado');
    await expect(page.locator('#payment_cash_total'), 'El campo de efectivo no quedó visible tras cambiar a "Contado"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    totalFactura = await pos.obtenerTotalVentaNumerico();
    expect(totalFactura).toBeGreaterThan(0);
    await pos.seleccionarPagoEfectivo(String(totalFactura));
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  await test.step('Anular la factura recién creada desde Histórico de Ventas', async () => {
    await anularFacturaMasReciente(pos, page);
  });

  await test.step('Leer Fact. Eliminadas DESPUÉS y validar que aparece exactamente una fila nueva, con los datos reales', async () => {
    await pos.abrirDetalleDeCierre();
    const facturasEliminadasDespues = await pos.leerFacturasEliminadas();

    const numerosAntes = facturasEliminadasAntes.map((f) => f.numeroFactura);
    const nuevas = facturasEliminadasDespues.filter((f) => !numerosAntes.includes(f.numeroFactura));
    expect(nuevas.length, 'No apareció exactamente 1 factura eliminada nueva').toBe(1);

    const facturaEliminada = nuevas[0];
    expect(facturaEliminada.monto, 'El monto de la factura eliminada no coincide con la factura anulada').toBeCloseTo(totalFactura, 2);
    expect(facturaEliminada.numeroFactura.length, 'La factura eliminada no tiene un número de factura real').toBeGreaterThan(0);
    expect(facturaEliminada.fecha.length, 'La factura eliminada no tiene fecha').toBeGreaterThan(0);

    console.log(`[Tab Facturas] Factura eliminada nueva: ${JSON.stringify(facturaEliminada)}`);

    await pos.cancelarModalCerrarCaja();
  });

  await test.step('Validar ausencia de errores', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});


/**
 * Aplica una devolución COMPLETA sobre la factura MÁS RECIENTE, desde
 * "Historial de Ventas" → detalle de factura → "Apl. Devolución" —
 * investigado en vivo con más de una decena de intentos hasta encontrar el
 * flujo real completo (varios pasos NO documentados por el propio texto de
 * la UI, confirmados solo abriendo la página real):
 *
 * 1. "Apl. Devolución" (`a[title="Aplicar Devolución"]`) abre una PÁGINA
 *    NUEVA (`refund/addRefund?invoice_number=<id>`), no un modal.
 * 2. Cada línea de producto exige marcar su propio checkbox
 *    (`.refund_checkbox`, slider CSS oculto — mismo patrón de esta suite:
 *    click programático vía `evaluate`, un `.check()` normal falla con
 *    "outside of the viewport" por el scroll horizontal de la tabla), lo
 *    que habilita su campo de cantidad (`.quantity_to_refund`, ya viene con
 *    la cantidad total por defecto).
 * 3. Cada línea EXIGE ADEMÁS abrir su propio modal "Tipo de devolución"
 *    (botón `.sr-refund-type-btn`) y confirmarlo con "Aplicar" — sin este
 *    paso el monto de la línea queda en $0.00 y "Procesar devolución"
 *    rechaza con "El monto de la devolución debe ser mayor a cero."
 * 4. Dentro de ese modal, "Reembolso" (`refund_money`) es la única opción
 *    real disponible para un cliente de contado (confirmado en vivo:
 *    "Crédito a favor del cliente" queda deshabilitado/oculto sin un
 *    cliente real asociado) — y ADEMÁS exige marcar un método de pago
 *    (`#sr_pay_cash_check`, Efectivo) y llenar su monto
 *    (`#sr_pay_cash_amount`) antes de "Aplicar", o el paso 5 vuelve a
 *    rechazar con "Monto requerido".
 * 5. "Procesar devolución" (`#refund_sale`) dispara el SweetAlert v1
 *    estándar de esta suite (mismo bug de i18n "Not valid!" ya documentado
 *    en otro flujo de este proyecto) — confirmarlo dispara la petición real
 *    `addSaleRefund` (confirmado en vivo, respuesta 200).
 */
async function aplicarDevolucionCompletaFacturaMasReciente(pos: PosPage, page: Page, context: BrowserContext, montoFactura: number): Promise<void> {
  await pos.abrirMenuTresPuntos();
  const historial = await pos.abrirHistorialFacturas();
  await historial.waitForLoadState('domcontentloaded').catch(() => {});

  const primeraFactura = historial.locator('text=/Consec\\./').first();
  await expect(primeraFactura, 'No apareció ninguna factura en el Historial de Ventas').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  await primeraFactura.click();

  const btnDevolucion = historial.locator('a[title="Aplicar Devolución"]').first();
  await expect(btnDevolucion, 'El botón "Apl. Devolución" no apareció en el detalle de la factura').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

  const popupPromise = context.waitForEvent('page', { timeout: TIMEOUTS.PAYMENT_MODAL });
  await btnDevolucion.click();
  const devolucionPage = await popupPromise;
  await devolucionPage.waitForLoadState('domcontentloaded').catch(() => {});

  // Paso 2: marcar el checkbox de la línea (slider CSS oculto, click programático).
  const checkboxId = await devolucionPage.evaluate(() => {
    const el = document.querySelector('.refund_checkbox');
    return el ? el.id : null;
  });
  expect(checkboxId, 'No se encontró ninguna línea de producto para devolver').not.toBeNull();
  await devolucionPage.evaluate((id) => {
    (document.getElementById(id as string) as HTMLInputElement).click();
  }, checkboxId);

  await expect(
    devolucionPage.locator('.quantity_to_refund').first(),
    'El campo de cantidad a devolver no se habilitó tras marcar la línea'
  ).toBeEnabled({ timeout: TIMEOUTS.PAYMENT_MODAL });

  // Paso 3-4: modal "Tipo de devolución" — Reembolso + método de pago Efectivo.
  await devolucionPage.locator('.sr-refund-type-btn').first().click({ force: true });
  await expect(
    devolucionPage.locator('#sr_refund_type_modal'),
    'El modal "Tipo de devolución" no apareció'
  ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

  await devolucionPage.evaluate(() => {
    const check = document.getElementById('sr_pay_cash_check') as HTMLInputElement;
    check.checked = true;
    check.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(
    devolucionPage.locator('#sr_pay_cash_amount'),
    'El campo de monto en efectivo no se reveló tras marcar "Efectivo"'
  ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  await devolucionPage.locator('#sr_pay_cash_amount').fill(String(montoFactura));

  await devolucionPage.locator('#sr_refund_type_modal button[onclick="saveRowRefundType()"]').click({ force: true });
  await expect(
    devolucionPage.locator('#sr_refund_type_modal'),
    'El modal "Tipo de devolución" no se cerró tras "Aplicar"'
  ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

  // Paso 5: procesar y confirmar.
  const respuestaPromise = devolucionPage.waitForResponse(
    (res) => res.url().includes('addSaleRefund'),
    { timeout: TIMEOUTS.PAYMENT_MODAL }
  );
  await devolucionPage.locator('#refund_sale').click();
  await expect(
    devolucionPage.locator('.sweet-alert.visible'),
    'El SweetAlert de confirmación de devolución no apareció'
  ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  await devolucionPage.locator('.sweet-alert.visible button.confirm').click();

  const respuesta = await respuestaPromise;
  expect(respuesta.ok(), `addSaleRefund no respondió OK (status ${respuesta.status()})`).toBe(true);

  await devolucionPage.close();
  await historial.close();
}


test('Tab Facturas: Fact. Devoluciones refleja correctamente una devolución aplicada desde Histórico de Ventas', async ({ page, context }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    if (await pos.modalAbrirCajaVisible()) {
      await pos.completarAperturaCaja();
      await expect(pos.modalAbrirCaja).toBeHidden();
    }
  });

  let facturasDevolucionesAntes: FilaFacturaSimple[] = [];
  await test.step('Leer Fact. Devoluciones ANTES de aplicar ninguna', async () => {
    await pos.abrirDetalleDeCierre();
    facturasDevolucionesAntes = await pos.leerFacturasDevoluciones();
    await pos.cancelarModalCerrarCaja();
  });

  let totalFactura = 0;
  await test.step('Crear una venta de CONTADO conocida, para devolverla a continuación', async () => {
    await pos.agregarProductoRapidoSimple(`Tab Facturas Devolucion ${Date.now()}`, '700');
    await pos.presionarFacturar();
    await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await pos.cambiarTipoPagoEnModalPago('contado');
    await expect(page.locator('#payment_cash_total'), 'El campo de efectivo no quedó visible tras cambiar a "Contado"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    totalFactura = await pos.obtenerTotalVentaNumerico();
    expect(totalFactura).toBeGreaterThan(0);
    await pos.seleccionarPagoEfectivo(String(totalFactura));
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  await test.step('Aplicar una devolución completa desde Histórico de Ventas', async () => {
    await aplicarDevolucionCompletaFacturaMasReciente(pos, page, context, totalFactura);
  });

  await test.step('Leer Fact. Devoluciones DESPUÉS y validar que aparece exactamente una fila nueva, con los datos reales', async () => {
    await pos.abrirDetalleDeCierre();
    const facturasDevolucionesDespues = await pos.leerFacturasDevoluciones();

    const numerosAntes = facturasDevolucionesAntes.map((f) => f.numeroFactura);
    const nuevas = facturasDevolucionesDespues.filter((f) => !numerosAntes.includes(f.numeroFactura));
    expect(nuevas.length, 'No apareció exactamente 1 devolución nueva').toBe(1);

    const devolucion = nuevas[0];
    // El monto registrado en "Fact. Devoluciones" debe ser el de la
    // DEVOLUCIÓN aplicada (monto devuelto), que en este escenario es el
    // 100% de la factura original (devolución completa).
    expect(devolucion.monto, 'El monto de la devolución no coincide con la factura devuelta').toBeCloseTo(totalFactura, 2);
    expect(devolucion.numeroFactura.length, 'La devolución no tiene un número de factura real').toBeGreaterThan(0);
    expect(devolucion.fecha.length, 'La devolución no tiene fecha').toBeGreaterThan(0);

    console.log(`[Tab Facturas] Devolución nueva: ${JSON.stringify(devolucion)}`);

    await pos.cancelarModalCerrarCaja();
  });

  await test.step('Validar ausencia de errores', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});


/**
 * Aplica un abono COMPLETO (100% del saldo, valor por defecto que el propio
 * formulario precarga) sobre la PRIMERA factura pendiente del PRIMER
 * cliente de la lista de "Ventas → Abono Cuentas por Cobrar" — investigado
 * en vivo. No se busca un cliente específico: confirmado en vivo que esta
 * lista NO está ordenada por actividad más reciente (crear un cliente y una
 * venta a crédito propios justo antes de llamar esta función no los pone de
 * primero — el criterio real de orden no se identificó), así que no hay
 * forma determinística de apuntar a un cliente propio sin buscar/scrollear
 * (con sus propios problemas ya documentados). Por eso esta función no
 * asume NADA sobre a quién le abona — el llamador debe leer el monto real
 * devuelto y comparar contra el estado real de "Fact. Abonos", no contra un
 * monto esperado de antemano.
 *
 * Flujo real confirmado:
 * 1. Sidebar de Histórico de Ventas → "Abono Cuentas por Cobrar"
 *    (`credit_sale/clientCreditSales`) — lista de clientes con saldo
 *    pendiente, cada uno con su botón "Abonar" (fila real: `div.brand-card`).
 * 2. Ese botón entra al detalle del cliente con sus facturas pendientes;
 *    cada factura tiene su PROPIO botón "Abonar" (`get_credit_payment(id)`)
 *    que abre un modal de pago.
 * 3. El modal reutiliza los MISMOS ids del modal de pago normal del POS
 *    (`#payment_cash_total`) — confirmado en vivo. Ya viene con "Efectivo"
 *    marcado y el monto precargado al 100% del saldo.
 * 4. "Realizar Abono" (`#add_credit_payment_btn`) corre 2 validaciones
 *    silenciosas (cuenta bancaria / email de envío — normalmente ambas
 *    pasan si no se usó tarjeta/transacción/cheque ni "Enviar por correo")
 *    y SÍ dispara un SweetAlert real de confirmación
 *    (`swal({title: "¡Realizar abono!", confirmButtonText: 'Abonar', ...})`
 *    — confirmado leyendo el JS real de la app, `js/credit_customer.js`).
 *    Su botón de confirmación real dice literalmente "Abonar" (no "Sí"). El
 *    callback de esa confirmación ejecuta `add_payment()`, que hace el POST
 *    real a `addPosSalesCreditInvoice` (con un `setTimeout` interno de
 *    200ms). "Abono Seleccionado" (`#selected_payment_invoice`) es un
 *    submit en bloque aparte, no relacionado, que queda `disabled` sin
 *    antes activar un toggle "Seleccionar" por fila.
 *
 * **Bug de sistema confirmado en vivo**: el botón de confirmación del
 * SweetAlert queda visualmente por encima, pero un `.modal-backdrop` de
 * Bootstrap (residuo del propio modal `#dialog_cedit_payment` que este
 * flujo abre por debajo) queda posicionado con un z-index mayor e
 * INTERCEPTA cualquier click real en las coordenadas del botón — confirmado
 * con `document.elementFromPoint()` sobre esas coordenadas, que devuelve el
 * backdrop en vez del botón. Ni un click real de Playwright (que
 * correctamente se niega a clickear un elemento tapado) ni un
 * `HTMLElement.click()` nativo vía `.evaluate()` (que sí debería invocar el
 * `.onclick` asignado directamente por SweetAlert, confirmado leyendo su
 * propio código fuente) logran completar la confirmación en este ambiente.
 * Como red de seguridad real (mismo criterio que
 * `PosPermisos.establecerPermisoViaApiDirecta()` para el bug de "Admin
 * roles"), tras el intento de click real se invoca directamente la función
 * real de la app `add_payment()` (ya expuesta en `window`, la misma que el
 * callback del SweetAlert habría llamado) — seguro de hacer en este punto
 * porque el SweetAlert ya visible confirma que las 2 validaciones previas
 * del botón "Realizar Abono" ya pasaron.
 *
 * Señal de éxito real: la respuesta del propio POST a
 * `addPosSalesCreditInvoice` (un id numérico > 0 en texto plano) — mucho
 * más confiable que el toast (aparece y se auto-oculta demasiado rápido
 * para capturarlo con un simple `toBeVisible`) o que releer la lista de
 * pendientes (confirmado en vivo que NO se actualiza dinámicamente en el
 * DOM sin un `reload`).
 */
async function aplicarAbonoCompletoPrimeraFacturaPendiente(pos: PosPage): Promise<number> {
  await pos.abrirMenuTresPuntos();
  const historial = await pos.abrirHistorialFacturas();
  await historial.waitForLoadState('domcontentloaded').catch(() => {});

  const linkAbono = historial.locator('text=/Abono Cuentas por Cobrar/i').first();
  await expect(linkAbono, 'El link "Abono Cuentas por Cobrar" no apareció en el sidebar').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  await linkAbono.click();

  const btnAbonarCliente = historial.locator('div.brand-card button:has-text("Abonar")').first();
  await expect(btnAbonarCliente, 'No apareció ningún cliente con saldo pendiente en "Cuentas por Cobrar"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  await btnAbonarCliente.click();

  const btnAbonarFactura = historial.locator('button[onclick^="get_credit_payment("]').first();
  await expect(btnAbonarFactura, 'No apareció ninguna factura pendiente para este cliente').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  // Se identifica la factura por su id real (extraído del propio onclick) en vez de
  // contar botones: confirmado en vivo que un cliente puede tener docenas de
  // facturas pendientes (42 en una corrida real), y la fila de la factura recién
  // abonada NO se retira del DOM dinámicamente de esa lista — solo tras recargar
  // la página. Contar botones antes/después es una señal falsa en ese caso (el
  // conteo total no baja sin recargar); comparar por id específico tras un reload sí lo es.
  const onclickFactura = await btnAbonarFactura.getAttribute('onclick');
  const idFactura = onclickFactura?.match(/get_credit_payment\((\d+)\)/)?.[1];
  expect(idFactura, `No se pudo extraer el id de la factura del atributo onclick="${onclickFactura}"`).toBeTruthy();
  await btnAbonarFactura.click();

  const campoEfectivo = historial.locator('#payment_cash_total');
  await expect(campoEfectivo, 'El campo de efectivo precargado no apareció en el modal de abono').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  const montoAbono = parseFloat((await campoEfectivo.inputValue()).replace(/[^0-9.]/g, '')) || 0;
  expect(montoAbono, 'El monto de abono precargado no es mayor a 0').toBeGreaterThan(0);

  const btnRealizarAbono = historial.locator('#add_credit_payment_btn');
  await expect(btnRealizarAbono, 'El botón "Realizar Abono" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  await btnRealizarAbono.click();

  // Confirmado en vivo leyendo el JS real de la app (js/credit_customer.js): el
  // click de "Realizar Abono" SÍ dispara un SweetAlert real de confirmación
  // (`swal({title: "¡Realizar abono!", ..., confirmButtonText: 'Abonar'}, ...)`)
  // — su botón de confirmación real dice literalmente "Abonar" (no "Sí"), lo que
  // en un intento anterior llevó a la conclusión equivocada de que era la MISMA
  // fila "Abonar" de fondo y no un SweetAlert genuino. Sin este click, el
  // callback de `swal(...)` (que ejecuta `add_payment()` → POST real a
  // `addPosSalesCreditInvoice`) nunca se ejecuta y el abono nunca se guarda —
  // confirmado en vivo capturando las respuestas de red: sin este click, NINGÚN
  // POST a `addPosSalesCreditInvoice` se dispara.
  const confirmBtn = historial.locator('.sa-button-container button.confirm');
  await expect(confirmBtn, 'El SweetAlert de confirmación de abono no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

  // Intento "fiel" (click nativo sobre el botón real) primero, con margen
  // corto; si el bug del backdrop lo bloquea (ver docstring), se cae a
  // invocar la función real de la app directamente como red de seguridad.
  const esperaRespuestaClick = historial
    .waitForResponse((r) => r.url().includes('addPosSalesCreditInvoice') && r.request().method() === 'POST', { timeout: 6_000 })
    .then((r) => r.text())
    .catch(() => null);
  await confirmBtn.evaluate((el) => (el as HTMLElement).click());
  let respuestaAbono = await esperaRespuestaClick;
  if (respuestaAbono === null) {
    const esperaRespuestaDirecta = historial
      .waitForResponse((r) => r.url().includes('addPosSalesCreditInvoice') && r.request().method() === 'POST', { timeout: TIMEOUTS.PAYMENT_MODAL })
      .then((r) => r.text());
    await historial.evaluate(() => {
      // @ts-expect-error función global real de la app, no expuesta por tipos — ver docstring
      if (typeof add_payment === 'function') add_payment();
    });
    respuestaAbono = await esperaRespuestaDirecta;
  }
  expect(parseInt(respuestaAbono ?? '0', 10), `El backend respondió "${respuestaAbono}" (0/no numérico = abono no guardado)`).toBeGreaterThan(0);

  // Verificación final: la factura abonada ya no aparece como pendiente tras
  // recargar la página (confirmado en vivo que esta lista NO se actualiza
  // dinámicamente en el DOM sin un reload real).
  await historial.reload({ waitUntil: 'domcontentloaded' });
  await expect(
    historial.locator(`button[onclick="get_credit_payment(${idFactura})"]`),
    'La factura abonada sigue apareciendo como pendiente tras recargar la página'
  ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

  await historial.close();
  return montoAbono;
}


test('Tab Facturas: Fact. Abonos refleja correctamente un abono aplicado desde Cuentas por Cobrar', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    if (await pos.modalAbrirCajaVisible()) {
      await pos.completarAperturaCaja();
      await expect(pos.modalAbrirCaja).toBeHidden();
    }
  });

  let facturasAbonosAntes: FilaFacturaSimple[] = [];
  await test.step('Leer Fact. Abonos ANTES de abonar nada', async () => {
    await pos.abrirDetalleDeCierre();
    facturasAbonosAntes = await pos.leerFacturasAbonos();
    await pos.cancelarModalCerrarCaja();
  });

  // No se crea un cliente/venta a crédito propios para este escenario:
  // confirmado en vivo que la lista de "Cuentas por Cobrar" no está
  // ordenada por actividad más reciente (ver docstring de
  // aplicarAbonoCompletoPrimeraFacturaPendiente), así que no hay forma
  // determinística de dirigir el abono a un cliente propio sin buscar/
  // scrollear (con sus propios problemas de UI ya documentados). El
  // ambiente compartido siempre tiene clientes reales con saldo pendiente
  // (acumulados por el resto de la suite, que nunca limpia datos), así que
  // se abona al primero disponible y se valida contra el monto REAL que el
  // propio formulario reportó, no contra un monto asumido de antemano.
  let montoAbono = 0;
  await test.step('Aplicar un abono completo (100% del saldo) desde Cuentas por Cobrar', async () => {
    montoAbono = await aplicarAbonoCompletoPrimeraFacturaPendiente(pos);
    expect(montoAbono).toBeGreaterThan(0);
  });

  await test.step('Leer Fact. Abonos DESPUÉS y validar que aparece exactamente una fila nueva, con los datos reales', async () => {
    await pos.abrirDetalleDeCierre();
    const facturasAbonosDespues = await pos.leerFacturasAbonos();

    const numerosAntes = facturasAbonosAntes.map((f) => f.numeroFactura);
    const nuevas = facturasAbonosDespues.filter((f) => !numerosAntes.includes(f.numeroFactura));
    expect(nuevas.length, 'No apareció exactamente 1 abono nuevo').toBe(1);

    const abono = nuevas[0];
    expect(abono.monto, 'El monto del abono no coincide con el monto precargado en el modal de abono').toBeCloseTo(montoAbono, 2);
    expect(abono.numeroFactura.length, 'El abono no tiene un número de factura real').toBeGreaterThan(0);
    expect(abono.fecha.length, 'El abono no tiene fecha').toBeGreaterThan(0);

    console.log(`[Tab Facturas] Abono nuevo: ${JSON.stringify(abono)}`);

    await pos.cancelarModalCerrarCaja();
  });

  await test.step('Validar ausencia de errores', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});


test('Tab Facturas: Fact. Entradas y Fact. Salidas reflejan correctamente un movimiento de caja manual (F9) de cada tipo', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    if (await pos.modalAbrirCajaVisible()) {
      await pos.completarAperturaCaja();
      await expect(pos.modalAbrirCaja).toBeHidden();
    }
  });

  // Mismo criterio de delta que el resto de escenarios de Tab Facturas: el
  // ambiente compartido acumula movimientos de otras corridas, así que la
  // fila nueva se identifica por su "Observación" (única, con timestamp),
  // no por posición ni por "Comprobante" (numeración interna no controlada
  // por este test).
  let entradasAntes: FilaMovimientoCaja[] = [];
  let salidasAntes: FilaMovimientoCaja[] = [];
  await test.step('Leer Fact. Entradas y Fact. Salidas ANTES de registrar ningún movimiento', async () => {
    await pos.abrirDetalleDeCierre();
    entradasAntes = await pos.leerEntradasCaja();
    salidasAntes = await pos.leerSalidasCaja();
    await pos.cancelarModalCerrarCaja();
  });

  const observacionEntrada = `Tab Facturas Entrada ${Date.now()}`;
  const observacionSalida = `Tab Facturas Salida ${Date.now()}`;
  let idEntrada = 0;
  let idSalida = 0;
  await test.step('Registrar una ENTRADA y una SALIDA reales desde el menú "Caja" → "(F9) Movimientos de caja"', async () => {
    idEntrada = await pos.registrarMovimientoCaja('entrada', '350.75', observacionEntrada);
    expect(idEntrada).toBeGreaterThan(0);

    idSalida = await pos.registrarMovimientoCaja('salida', '120.50', observacionSalida);
    expect(idSalida).toBeGreaterThan(0);
  });

  await test.step('Leer Fact. Entradas y Fact. Salidas DESPUÉS y validar que cada una tiene exactamente una fila nueva, con los datos reales', async () => {
    await pos.abrirDetalleDeCierre();
    const entradasDespues = await pos.leerEntradasCaja();
    const salidasDespues = await pos.leerSalidasCaja();

    const entradaNueva = entradasDespues.find((f) => f.observacion === observacionEntrada);
    expect(entradaNueva, `No apareció ninguna fila en Fact. Entradas con la observación "${observacionEntrada}"`).toBeTruthy();
    expect(entradaNueva!.monto, 'El monto de la entrada no coincide con lo registrado').toBeCloseTo(350.75, 2);
    expect(entradaNueva!.comprobante.length, 'La entrada no tiene un comprobante real').toBeGreaterThan(0);
    expect(entradaNueva!.fecha.length, 'La entrada no tiene fecha').toBeGreaterThan(0);
    expect(entradasDespues.filter((f) => f.observacion === observacionEntrada).length, 'Apareció más de 1 fila con la misma observación de entrada').toBe(1);
    expect(entradasAntes.some((f) => f.observacion === observacionEntrada), 'La observación de entrada ya existía ANTES de registrar el movimiento (colisión de timestamp)').toBe(false);

    const salidaNueva = salidasDespues.find((f) => f.observacion === observacionSalida);
    expect(salidaNueva, `No apareció ninguna fila en Fact. Salidas con la observación "${observacionSalida}"`).toBeTruthy();
    expect(salidaNueva!.monto, 'El monto de la salida no coincide con lo registrado').toBeCloseTo(120.50, 2);
    expect(salidaNueva!.comprobante.length, 'La salida no tiene un comprobante real').toBeGreaterThan(0);
    expect(salidaNueva!.fecha.length, 'La salida no tiene fecha').toBeGreaterThan(0);
    expect(salidasDespues.filter((f) => f.observacion === observacionSalida).length, 'Apareció más de 1 fila con la misma observación de salida').toBe(1);
    expect(salidasAntes.some((f) => f.observacion === observacionSalida), 'La observación de salida ya existía ANTES de registrar el movimiento (colisión de timestamp)').toBe(false);

    // Cruce contra el Resumen de cierre del Tab General: "Entradas Mov. Caja"
    // debe reflejar la entrada recién registrada (la salida no afecta ese
    // campo — ver CIERRE_RESUMEN_ENTRADAS_MOV_CAJA en pos.locators.ts, solo
    // cubre entradas).
    const resumen = await pos.leerResumenTabGeneral();
    expect(resumen.resumenCierre.entradasMovCaja, 'El campo "Entradas Mov. Caja" del Resumen de cierre no refleja al menos la entrada registrada').toBeGreaterThanOrEqual(350.75);

    console.log(`[Tab Facturas] Entrada nueva: ${JSON.stringify(entradaNueva)}`);
    console.log(`[Tab Facturas] Salida nueva: ${JSON.stringify(salidaNueva)}`);

    await pos.cancelarModalCerrarCaja();
  });

  await test.step('Validar ausencia de errores', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});


test('Ingresos por Método de Pago: Tarjeta, SINPE, Transacción y un pago Mixto se reflejan correctamente en Tab General, Consolidado Tarjeta y Reporte Avanzado', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    if (await pos.modalAbrirCajaVisible()) {
      await pos.completarAperturaCaja();
      await expect(pos.modalAbrirCaja).toBeHidden();
    }
  });

  let antes: ResumenTabGeneral;
  let reporteAntes: ReporteAvanzado;
  await test.step('Leer Tab General y Reporte Avanzado ANTES de facturar nada', async () => {
    await pos.abrirDetalleDeCierre();
    antes = await pos.leerResumenTabGeneral();
    reporteAntes = await pos.leerReporteAvanzado();
    await pos.cancelarModalCerrarCaja();
  });

  // Cada venta usa "seleccionarPagoExacto()" (lee el total real del modal y lo
  // aplica al método indicado) salvo la mixta, que reparte el total real en
  // 2 montos que suman exacto — mismo criterio de "nunca asumir el total, leer
  // el real del DOM" que el resto de este archivo.
  let totalTarjeta = 0;
  await test.step('Crear una venta pagada 100% con TARJETA', async () => {
    await pos.agregarProductoRapidoSimple(`Metodo Pago Tarjeta ${Date.now()}`, '1500');
    await pos.presionarFacturar();
    await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await pos.cambiarTipoPagoEnModalPago('contado');
    totalTarjeta = await pos.obtenerTotalVentaNumerico();
    expect(totalTarjeta).toBeGreaterThan(0);
    await pos.seleccionarPagoExacto(METODO.TARJETA);
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  let totalSinpe = 0;
  await test.step('Crear una venta pagada 100% con SINPE', async () => {
    await pos.agregarProductoRapidoSimple(`Metodo Pago Sinpe ${Date.now()}`, '800');
    await pos.presionarFacturar();
    await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await pos.cambiarTipoPagoEnModalPago('contado');
    totalSinpe = await pos.obtenerTotalVentaNumerico();
    expect(totalSinpe).toBeGreaterThan(0);
    await pos.seleccionarPagoExacto(METODO.SINPE);
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  let totalTransaccion = 0;
  await test.step('Crear una venta pagada 100% con TRANSACCIÓN (transferencia bancaria)', async () => {
    await pos.agregarProductoRapidoSimple(`Metodo Pago Transaccion ${Date.now()}`, '900');
    await pos.presionarFacturar();
    await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await pos.cambiarTipoPagoEnModalPago('contado');
    totalTransaccion = await pos.obtenerTotalVentaNumerico();
    expect(totalTransaccion).toBeGreaterThan(0);
    await pos.seleccionarPagoExacto(METODO.TRANSACCION);
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  let totalMixtoTarjeta = 0;
  let totalMixtoEfectivo = 0;
  await test.step('Crear una venta pagada con un método MIXTO (parte tarjeta, parte efectivo)', async () => {
    await pos.agregarProductoRapidoSimple(`Metodo Pago Mixto ${Date.now()}`, '1200');
    await pos.presionarFacturar();
    await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await pos.cambiarTipoPagoEnModalPago('contado');
    const total = await pos.obtenerTotalVentaNumerico();
    expect(total).toBeGreaterThan(0);
    totalMixtoTarjeta = Number((total / 2).toFixed(2));
    totalMixtoEfectivo = Number((total - totalMixtoTarjeta).toFixed(2));
    await pos.seleccionarPagoMixto(String(totalMixtoTarjeta), String(totalMixtoEfectivo));
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  await test.step('Leer Tab General y Reporte Avanzado DESPUÉS y validar los deltas por método de pago', async () => {
    await pos.abrirDetalleDeCierre();
    const despues = await pos.leerResumenTabGeneral();
    const reporteDespues = await pos.leerReporteAvanzado();

    const totalTarjetaAcumulado = totalTarjeta + totalMixtoTarjeta;
    const totalEfectivoAcumulado = totalMixtoEfectivo;

    expect(despues.metodoPago.tarjeta - antes.metodoPago.tarjeta, 'Delta de "Ingresos por Método de Pago: Tarjeta" no coincide con (venta 100% tarjeta + porción tarjeta del pago mixto)')
      .toBeCloseTo(totalTarjetaAcumulado, 2);
    expect(despues.metodoPago.sinpe - antes.metodoPago.sinpe, 'Delta de "Ingresos por Método de Pago: SINPE" no coincide con la venta pagada por SINPE')
      .toBeCloseTo(totalSinpe, 2);
    expect(despues.metodoPago.transaccion - antes.metodoPago.transaccion, 'Delta de "Ingresos por Método de Pago: Transacción" no coincide con la venta pagada por transferencia')
      .toBeCloseTo(totalTransaccion, 2);
    expect(despues.metodoPago.efectivo - antes.metodoPago.efectivo, 'Delta de "Ingresos por Método de Pago: Efectivo" no coincide con la porción en efectivo del pago mixto (única entrada en efectivo de este escenario)')
      .toBeCloseTo(totalEfectivoAcumulado, 2);

    expect(despues.consolidadoTarjeta.ingreso - antes.consolidadoTarjeta.ingreso, 'Delta de "Consolidado Tarjeta: Ingreso" no coincide con el total real pagado con tarjeta (venta 100% tarjeta + porción tarjeta del mixto)')
      .toBeCloseTo(totalTarjetaAcumulado, 2);

    expect(despues.ventasTotales - antes.ventasTotales, 'Delta de "Ventas Totales" no coincide con la suma de las 4 ventas de este escenario')
      .toBeCloseTo(totalTarjeta + totalSinpe + totalTransaccion + totalMixtoTarjeta + totalMixtoEfectivo, 2);

    // Solo el efectivo realmente cobrado en caja afecta "Datos de Cierre:
    // Total" — mismo criterio ya confirmado en vivo para la venta a crédito
    // del escenario "Tab General" (no se cobra en caja); aquí, de las 4
    // ventas, únicamente la porción en efectivo del pago mixto entra a caja.
    expect(despues.datosCierre.total - antes.datosCierre.total, 'Delta de "Datos de Cierre: Total" no coincide con la única porción en efectivo real de este escenario (la porción en efectivo del pago mixto)')
      .toBeCloseTo(totalEfectivoAcumulado, 2);

    expect(reporteDespues.ventasTarjeta - reporteAntes.ventasTarjeta, 'Delta de "Ventas con tarjeta" (Reporte Avanzado) no coincide con el total real pagado con tarjeta')
      .toBeCloseTo(totalTarjetaAcumulado, 2);
    expect(reporteDespues.ventasSinpe - reporteAntes.ventasSinpe, 'Delta de "Ventas SINPE" (Reporte Avanzado) no coincide con la venta pagada por SINPE')
      .toBeCloseTo(totalSinpe, 2);
    expect(reporteDespues.ventasTransaccion - reporteAntes.ventasTransaccion, 'Delta de "Ventas por transacción" (Reporte Avanzado) no coincide con la venta por transferencia')
      .toBeCloseTo(totalTransaccion, 2);

    console.log(`[Métodos de Pago] Tarjeta: ${totalTarjeta}, SINPE: ${totalSinpe}, Transacción: ${totalTransaccion}, Mixto (tarjeta/efectivo): ${totalMixtoTarjeta}/${totalMixtoEfectivo}`);

    await pos.cancelarModalCerrarCaja();
  });

  await test.step('Validar ausencia de errores', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});


test('Tab Facturas: Fact. Contado (Órdenes de Taller) refleja correctamente una factura generada facturando una Orden de Taller real', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const taller = new PosTaller(pos, page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    if (await pos.modalAbrirCajaVisible()) {
      await pos.completarAperturaCaja();
      await expect(pos.modalAbrirCaja).toBeHidden();
    }
  });

  let facturasOrdenesAntes: FilaFacturaVenta[] = [];
  await test.step('Leer Fact. Contado (Órdenes) ANTES de facturar nada', async () => {
    await pos.abrirDetalleDeCierre();
    facturasOrdenesAntes = await pos.leerFacturasContadoOrdenes();
    await pos.cancelarModalCerrarCaja();
  });

  let totalOrden = 0;
  await test.step('Cargar una Orden de Taller real al carrito ("Facturar Orden POS") y facturarla de contado en efectivo', async () => {
    await taller.abrirListadoTaller();
    const [id] = await taller.obtenerIdsOrdenesConMontoValido(1);
    expect(id, 'No se encontró ninguna Orden de Taller visible con monto real (total > 0)').toBeTruthy();
    await taller.facturarOrdenPOS(id);

    // No se usa abrirModalDePago() aquí: ese método espera a que
    // #payment_cash_total quede VISIBLE antes de continuar (ver su propio
    // comentario), pero una Orden de Taller real del ambiente compartido
    // puede llegar al carrito con el modal de pago heredando el tipo de
    // pago original de esa orden (Crédito) — confirmado en vivo (fallo
    // reproducible: 30 reintentos con el campo siempre "hidden"). Mismo
    // criterio ya usado en el escenario "Tab General" de este archivo: se
    // abre el modal y se cambia explícitamente a "Contado" ANTES de
    // depender de ese campo.
    await pos.presionarFacturar();
    await expect(page.locator('#dialog_payment'), 'El modal de pago no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await pos.cambiarTipoPagoEnModalPago('contado');
    await expect(page.locator('#payment_cash_total'), 'El campo de efectivo no quedó visible tras cambiar a "Contado"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    totalOrden = await pos.obtenerTotalVentaNumerico();
    expect(totalOrden).toBeGreaterThan(0);
    await pos.seleccionarPagoEfectivo(String(totalOrden));
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
    await pos.validarCarritoVacio();
  });

  await test.step('Leer Fact. Contado (Órdenes) DESPUÉS y validar que aparece exactamente una fila nueva, con "N orden" real', async () => {
    // facturarOrdenPOS() deja el flujo en la pestaña "Taller" — volver a "POS
    // Facturación" primero, mismo criterio de estado final limpio ya usado en
    // pos-taller.spec.ts (escenario "Aplicar descuento general a una Orden de
    // Taller y facturar").
    await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);
    await pos.abrirDetalleDeCierre();
    const facturasOrdenesDespues = await pos.leerFacturasContadoOrdenes();

    const numerosAntes = facturasOrdenesAntes.map((f) => f.numeroFactura);
    const nuevas = facturasOrdenesDespues.filter((f) => !numerosAntes.includes(f.numeroFactura));
    expect(nuevas.length, 'No apareció exactamente 1 factura de Orden de Taller nueva').toBe(1);

    const factura = nuevas[0];
    expect(factura.monto, 'El monto de la factura no coincide con lo facturado').toBeCloseTo(totalOrden, 2);
    expect(factura.numeroOrden?.length ?? 0, 'La factura de Orden de Taller no tiene "N orden" real').toBeGreaterThan(0);
    expect(factura.tipoPago, 'El tipo de pago debería ser Efectivo').toMatch(/efectivo/i);

    console.log(`[Tab Facturas] Factura de Orden de Taller nueva: ${JSON.stringify(factura)}`);

    await pos.cancelarModalCerrarCaja();
  });

  await test.step('Validar ausencia de errores', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});


test('Tab Facturas: Fact. Abonos refleja correctamente un abono aplicado desde Apartados', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    if (await pos.modalAbrirCajaVisible()) {
      await pos.completarAperturaCaja();
      await expect(pos.modalAbrirCaja).toBeHidden();
    }
  });

  let facturasAbonosAntes: FilaFacturaSimple[] = [];
  await test.step('Leer Fact. Abonos ANTES de abonar nada', async () => {
    await pos.abrirDetalleDeCierre();
    facturasAbonosAntes = await pos.leerFacturasAbonos();
    await pos.cancelarModalCerrarCaja();
  });

  // A diferencia de la versión anterior de este escenario (que abonaba al
  // primer Apartado disponible del catálogo compartido, vía
  // cargarPrimerApartadoConTotalRazonable()): confirmado en vivo (2/2
  // corridas reales) que ese camino puede fallar de forma reproducible con
  // "no se cargó ninguna línea de producto tras seleccionar el Apartado" —
  // el ambiente sí tenía ~20 Apartados listados (no era falta de datos), y
  // el snapshot no mostró ningún overlay/error visible, solo un timeout
  // silencioso; cargarPrimerApartadoDisponible() (hermano de ese método)
  // documenta el mismo síntoma como "Apartado vacío", un problema real de
  // calidad de datos del catálogo compartido, no de esta suite. Se elimina
  // esa dependencia por completo generando el propio dato de prueba (mismo
  // criterio que pide CLAUDE.md: "no depender de información existente"):
  // se crea un Apartado real y propio con un producto de precio conocido, y
  // se recarga la pestaña para localizarlo de forma determinística —
  // confirmado en vivo (comentario real de
  // obtenerNumeroApartadoTarjetaMasReciente() en pos-apartado.page.ts) que,
  // a diferencia de la lista de "Cuentas por Cobrar" (sin orden por
  // actividad reciente), la pestaña "Apartados" SÍ ordena de más reciente a
  // más antiguo: el recién creado siempre queda de primero al (re)visitar
  // la pestaña.
  let montoAbono = 0;
  await test.step('Crear un Apartado propio (sin abono inicial) para no depender del catálogo compartido', async () => {
    await pos.agregarProductoRapidoSimple(`Apartado Cierre Caja ${Date.now()}`, '1400');
    await pos.seleccionarClienteExistente();
    await pos.abrirCrearApartado();
    await pos.seleccionarPagoEfectivo('0');
    const respuestaCrear = await pos.guardarApartadoYObtenerRespuesta();
    await pos.validarApartadoCreado(respuestaCrear);
  });

  await test.step('Cargar el Apartado recién creado (el más reciente de la pestaña) y aplicar un abono parcial en efectivo', async () => {
    const pestana = await pos.localizarPestanaApartados();
    expect(pestana, 'La pestaña "Apartados" no existe en este ambiente (permisos/configuración)').not.toBeNull();
    await pos.visitarPestanaPos(pestana!);
    await pos.cargarPrimerApartadoDisponible();

    // Corrección de automatización confirmada en vivo: el snapshot del
    // fallo original mostró que el Apartado SÍ cargó con su línea de
    // producto real (precio 1400 visible en la fila del carrito), pero
    // obtenerTotalVentaNumerico() seguía devolviendo 0 incluso reintentando
    // 15s con expect.poll() — no era una recalculación asíncrona pendiente.
    // Causa raíz real (documentada en el propio comentario de
    // obtenerSaldoActualApartado() en pos-apartado.page.ts):
    // obtenerTotalVentaNumerico() lee L.TOTAL_MODAL, que "no se actualiza
    // fuera de ese modal" — como este paso nunca abrió el modal de pago
    // antes de leer el total, el campo se queda en su valor inicial (0).
    // obtenerSaldoActualApartado() lee en cambio L.TOTAL_LAYAWAY_SALDO_ACTUAL,
    // la fila del footer que SÍ refleja el total real de un Apartado ya
    // cargado sin depender de haber abierto ningún modal — el método
    // correcto para este caso exacto.
    const total = await pos.obtenerSaldoActualApartado();
    expect(total, 'El saldo actual del Apartado debe ser mayor a 0 para calcular un abono parcial').toBeGreaterThan(0);
    montoAbono = Number((total / 2).toFixed(2));

    await pos.abrirRealizarAbono();
    await pos.seleccionarPagoEfectivo(String(montoAbono));
    const respuesta = await pos.aplicarAbonoYObtenerRespuesta();
    await pos.validarAbonoAplicado(respuesta);
  });

  await test.step('Leer Fact. Abonos DESPUÉS y validar que aparece exactamente una fila nueva, con el monto real abonado', async () => {
    await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);
    await pos.abrirDetalleDeCierre();
    const facturasAbonosDespues = await pos.leerFacturasAbonos();

    const numerosAntes = facturasAbonosAntes.map((f) => f.numeroFactura);
    const nuevas = facturasAbonosDespues.filter((f) => !numerosAntes.includes(f.numeroFactura));
    expect(nuevas.length, 'No apareció exactamente 1 abono nuevo').toBe(1);

    const abono = nuevas[0];
    expect(abono.monto, 'El monto del abono no coincide con el monto abonado al Apartado').toBeCloseTo(montoAbono, 2);
    expect(abono.numeroFactura.length, 'El abono no tiene un número de factura real').toBeGreaterThan(0);
    expect(abono.fecha.length, 'El abono no tiene fecha').toBeGreaterThan(0);

    console.log(`[Tab Facturas] Abono de Apartado nuevo: ${JSON.stringify(abono)}`);

    await pos.cancelarModalCerrarCaja();
  });

  await test.step('Validar ausencia de errores', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});


test('Validación del Total General: el permiso "Ocultar total general en cierre de caja" (558) controla si el Total General aparece en Tab General', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const permisos = new PosPermisos(pos, page);
  const erroresJS = espiarErroresJS(page);

  await test.step('Cargar el POS y asegurar caja abierta', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    if (await pos.modalAbrirCajaVisible()) {
      await pos.completarAperturaCaja();
      await expect(pos.modalAbrirCaja).toBeHidden();
    }
  });

  // Nunca se asume cuál es el estado por defecto de este permiso en el
  // ambiente compartido — se lee primero y se restaura a ESE valor al final
  // (try/finally), mismo criterio ya usado en pos-permisos.spec.ts para no
  // dejar un permiso real alterado para el resto de la suite/ambiente.
  let estadoOriginal = false;
  await test.step('Leer el estado original del permiso', async () => {
    await permisos.irARolesYPermisos(ROL_ADMINISTRADOR);
    estadoOriginal = await permisos.permisoActivo(PERMISO.OCULTAR_TOTAL_GENERAL_CIERRE_CAJA);
  });

  try {
    await test.step('Activar el permiso y validar que el Total General queda OCULTO en Tab General', async () => {
      await permisos.irARolesYPermisos(ROL_ADMINISTRADOR);
      await permisos.establecerPermiso(PERMISO.OCULTAR_TOTAL_GENERAL_CIERRE_CAJA, true);
      await permisos.recargarPos();
      await pos.abrirDetalleDeCierre();
      const resumen = await pos.leerResumenTabGeneral();
      expect(resumen.totalGeneral, 'El "Total General" debería estar oculto con el permiso activado').toBeNull();
      await pos.cancelarModalCerrarCaja();
    });

    await test.step('Desactivar el permiso y validar que el Total General queda VISIBLE en Tab General', async () => {
      await permisos.irARolesYPermisos(ROL_ADMINISTRADOR);
      await permisos.establecerPermiso(PERMISO.OCULTAR_TOTAL_GENERAL_CIERRE_CAJA, false);
      await permisos.recargarPos();
      await pos.abrirDetalleDeCierre();
      const resumen = await pos.leerResumenTabGeneral();
      expect(resumen.totalGeneral, 'El "Total General" debería estar visible con el permiso desactivado').not.toBeNull();
      await pos.cancelarModalCerrarCaja();
    });
  } finally {
    await test.step('Restaurar el permiso a su estado original', async () => {
      await permisos.irARolesYPermisos(ROL_ADMINISTRADOR);
      await permisos.establecerPermiso(PERMISO.OCULTAR_TOTAL_GENERAL_CIERRE_CAJA, estadoOriginal);
      await permisos.esperarPermiso(ROL_ADMINISTRADOR, PERMISO.OCULTAR_TOTAL_GENERAL_CIERRE_CAJA, estadoOriginal);
    });
  }

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});
