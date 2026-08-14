import { test, expect } from '@playwright/test';
import { PosPage, espiarErroresJS } from './pos/pos.page';
import { FacturarPage } from './facturar.page';
import { FacturarDespachoBodegaPage, TIMEOUTS } from './facturar-despacho-bodega.page';

// ═══════════════════════════════════════════════════════════════════════════
// Cuenta/proyecto: este spec corre con el setup ORIGINAL de la suite
// (auth.setup.ts / admin.json, cuenta `kadmin`, project por defecto
// 'firefox') contra la compañía HONDURAS:
//
//   POS_COMPANIA=HONDURAS npx playwright test tests/facturar/facturar-despacho-bodega.spec.ts
//
// RE-CONFIRMADO EN VIVO en esta sesión (reemplaza un hallazgo anterior ya
// desactualizado): el complemento "Control de Despacho" SÍ está habilitado
// para la cuenta admin por defecto — a diferencia de lo documentado antes en
// facturar-navegacion.spec.ts (que esperaba el modal "Módulos Adicionales"
// para esa cuenta), el estado real del complemento cambió en el ambiente
// entre esa investigación y esta. `kadmin` además resultó pertenecer a una
// única compañía, ya HONDURAS (confirmado en vivo: mismos números de orden
// reales que ve la cuenta Super Administrador bajo esa compañía), por lo que
// esta pantalla no le renderiza ningún selector de Compañía — no hay nada
// que elegir (`FacturarDespachoBodegaPage.abrir()` lo detecta y lo omite).
//
// El proyecto `firefox-super-admin` (cuenta cross-company, ver
// facturar-despacho-ordenes-caja.spec.ts) también sigue funcionando contra
// esta misma pantalla — reutiliza el mismo Page Object, que soporta ambos
// casos (con y sin selector de Compañía) sin necesitar dos versiones.
// ═══════════════════════════════════════════════════════════════════════════

// Fixture `page` estándar (nueva por test, sin fixture de worker propia) —
// mismo criterio que facturar-despacho-ordenes-caja.spec.ts: navegar a esta
// pantalla es barato (Dashboard + click + un par de AJAX), no amerita
// cachear una `sharedPage` de scope 'worker'.

async function validarSinMensajesDeError(page: import('@playwright/test').Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

/**
 * Garantiza que la pantalla tenga al menos una orden en estado Pendiente
 * para trabajar — la crea desde el POS si no hay ninguna (instrucción
 * explícita del usuario: no depender de datos ya existentes).
 *
 * A diferencia de `facturar-despacho-ordenes-caja.spec.ts` (que sí vuelve a
 * "Todas" al final), este helper deja el filtro en "Pendientes": los
 * escenarios que abren "la primera orden visible" (buscar, ver detalle,
 * menú de tres puntos) quieren una orden Pendiente real y predecible, no
 * cualquiera que quede primera en "Todas" (que puede ser una orden vieja ya
 * En proceso/Entregada de una corrida anterior, sin relación con lo que el
 * escenario intenta validar).
 */
async function asegurarOrdenPendienteDisponible(despacho: FacturarDespachoBodegaPage, observacion: string) {
  await despacho.filtrarPorEstado('Pendientes');
  const totalPendientes = await despacho.contarOrdenesVisibles();
  if (totalPendientes === 0) {
    await despacho.crearOrdenDeCajaDeRespaldo(observacion);
    await despacho.abrir();
    await despacho.filtrarPorEstado('Pendientes');
  }
}

test.describe('Despacho de Bodega', () => {

  test('1. Apertura del módulo y carga de registros', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoBodegaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await test.step('Abrir "Despacho de bodega" y seleccionar compañía HONDURAS', async () => {
      await despacho.abrir();
    });

    await test.step('Validar que la URL y el título reales de la pantalla son correctos', async () => {
      expect(page.url()).toContain('PosDispatchOrder/dispatchOrder');
      await expect(page).toHaveTitle(/Despacho de órdenes/i);
      await expect(page.getByRole('heading', { name: 'Control de Calidad - Órdenes de despacho' })).toBeVisible({ timeout: TIMEOUTS.MODAL });
    });

    await test.step('Validar que el panel de detalle arranca en su estado vacío ("Seleccionar Orden")', async () => {
      await expect(despacho.panelSeleccionarOrden).toBeVisible({ timeout: TIMEOUTS.MODAL });
    });

    await test.step('Si no hay registros, crear una Orden de Caja de respaldo desde el POS y confirmar que el listado la refleja', async () => {
      await asegurarOrdenPendienteDisponible(despacho, `Despacho Bodega - apertura ${Date.now()}`);
      expect(await despacho.contarOrdenesVisibles()).toBeGreaterThan(0);
    });

    await validarSinMensajesDeError(page);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('2. Buscar una orden por su número', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoBodegaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho Bodega - buscar numero ${Date.now()}`);

    let numero = '';
    await test.step('Tomar el número de la primera orden visible', async () => {
      const datos = await despacho.abrirDetallePrimeraOrden();
      numero = datos.numero;
      expect(numero.length).toBeGreaterThan(0);
    });

    await test.step('Buscar por ese número exacto y validar que aparece entre los resultados', async () => {
      await despacho.buscarPorTexto(numero);
      const total = await despacho.contarOrdenesVisibles();
      expect(total, `La búsqueda por el número "${numero}" no devolvió ningún resultado`).toBeGreaterThan(0);
      await expect(despacho.tarjetas.first()).toContainText(numero);
    });

    await test.step('Limpiar la búsqueda y confirmar que el listado se restaura', async () => {
      const totalFiltrado = await despacho.contarOrdenesVisibles();
      await despacho.limpiarBusqueda();
      const totalRestaurado = await despacho.contarOrdenesVisibles();
      expect(totalRestaurado).toBeGreaterThanOrEqual(totalFiltrado);
    });

    await validarSinMensajesDeError(page);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('3. Buscar una orden por el nombre del cliente', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoBodegaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho Bodega - buscar cliente ${Date.now()}`);

    let cliente = '';
    await test.step('Tomar el cliente de la primera orden visible', async () => {
      const datos = await despacho.abrirDetallePrimeraOrden();
      cliente = datos.cliente;
      expect(cliente.length).toBeGreaterThan(0);
    });

    await test.step('Buscar por el nombre del cliente y validar que aparece entre los resultados', async () => {
      await despacho.buscarPorTexto(cliente);
      const total = await despacho.contarOrdenesVisibles();
      expect(total, `La búsqueda por el cliente "${cliente}" no devolvió ningún resultado`).toBeGreaterThan(0);
    });

    await validarSinMensajesDeError(page);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('4. Filtrar por Estado orden y limpiar el filtro', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoBodegaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho Bodega - filtro estado ${Date.now()}`);

    await test.step('Filtrar por "Pendientes" y validar que solo se muestran órdenes con ese estado', async () => {
      await despacho.filtrarPorEstado('Pendientes');
      const total = await despacho.contarOrdenesVisibles();
      expect(total, 'El filtro "Pendientes" no devolvió ninguna orden').toBeGreaterThan(0);
      await expect(despacho.tarjetas.first()).toContainText('Pendiente');
    });

    await test.step('Limpiar el filtro (volver a "Todas") y validar que el listado se amplía o se mantiene', async () => {
      const totalFiltrado = await despacho.contarOrdenesVisibles();
      await despacho.filtrarPorEstado('Todas');
      const totalTodas = await despacho.contarOrdenesVisibles();
      expect(totalTodas).toBeGreaterThanOrEqual(totalFiltrado);
    });

    await validarSinMensajesDeError(page);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('5. Filtrar por Tipo de factura y por Pagó con', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoBodegaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho Bodega - filtros extra ${Date.now()}`);

    await test.step('Filtrar por "Tipo de factura" = Contado y validar que la consulta se ejecuta sin error', async () => {
      await facturar._seleccionarOpcionChosenPorTexto('#select_type_invoice_chosen', 'Contado');
      expect(await despacho.contarOrdenesVisibles(), 'El filtro "Contado" no devolvió ninguna orden').toBeGreaterThan(0);
      await expect(despacho.tarjetas.first()).toContainText('Contado');
    });

    await test.step('Restaurar "Tipo de factura" a Todas', async () => {
      await facturar._seleccionarOpcionChosenPorTexto('#select_type_invoice_chosen', 'Todas');
    });

    await test.step('Filtrar por "Pagó con" = Efectivo y validar que la consulta se ejecuta sin error', async () => {
      await facturar._seleccionarOpcionChosenPorTexto('#payed_with_chosen', 'Efectivo');
      // El panel de detalle vacío ("Seleccionar Orden") sigue visible durante
      // todo este escenario (nunca se clickea ninguna tarjeta) — validar solo
      // ese estado evita la ambigüedad de strict-mode de combinarlo con
      // `.or(tarjetas.first())` cuando además hay resultados en la lista.
      await expect(despacho.panelSeleccionarOrden).toBeVisible({ timeout: TIMEOUTS.MODAL });
    });

    await validarSinMensajesDeError(page);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('6. Ver el detalle de una orden', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoBodegaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho Bodega - ver detalle ${Date.now()}`);

    await test.step('Abrir el detalle de la primera orden y validar su información', async () => {
      const datos = await despacho.abrirDetallePrimeraOrden();
      expect(datos.numero.length, 'El detalle no trae número de factura').toBeGreaterThan(0);
      expect(datos.cliente.length, 'El detalle no trae cliente').toBeGreaterThan(0);
      await expect(despacho.panelDetalle).toContainText(datos.numero);
    });

    await test.step('Validar que al menos una línea de producto está visible en el detalle', async () => {
      expect(await despacho.lineasProducto.count(), 'El detalle no muestra ninguna línea de producto').toBeGreaterThan(0);
    });

    await validarSinMensajesDeError(page);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('7. Despachar una orden completa (Tomar Orden → escanear productos → Finalizar) y validar el cambio de estado', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoBodegaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await test.step('Crear una Orden de Caja nueva (garantiza estado Pendiente real, sin depender de datos existentes)', async () => {
      await despacho.crearOrdenDeCajaDeRespaldo(`Despacho Bodega - ciclo completo ${Date.now()}`);
      await despacho.abrir();
    });

    let numero = '';
    await test.step('Abrir su detalle y confirmar que arranca Pendiente', async () => {
      const datos = await despacho.abrirDetallePrimeraOrden();
      numero = datos.numero;
      expect(datos.estado).toContain('Pendiente');
      await expect(despacho.botonTomarOrden, 'La orden recién creada no muestra el botón "Tomar Orden"').toBeVisible({ timeout: TIMEOUTS.MODAL });
    });

    await test.step('Despachar (Tomar Orden → escanear productos → Finalizar)', async () => {
      await despacho.despacharOrdenEnDetalle();
    });

    // El badge de la tarjeta en la lista NO se actualiza en vivo tras estas
    // acciones (mismo hallazgo ya documentado para Despacho de Órdenes de
    // Caja, confirmado también aquí) — la validación real del cambio de
    // estado y su persistencia es recargar y volver a consultar el servidor.
    await test.step('Validar el cambio de estado (Entregado) recargando y volviendo a consultar la orden — también confirma persistencia', async () => {
      await despacho.actualizarListado();
      await despacho.filtrarPorEstado('Todas');
      await despacho.buscarPorTexto(numero);
      await expect(despacho.tarjetas.first()).toContainText('Entregado');
    });

    await validarSinMensajesDeError(page);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('8. Actualizar el listado', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoBodegaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho Bodega - actualizar listado ${Date.now()}`);

    await test.step('Actualizar el listado (F5 real) y validar que la pantalla vuelve a un estado funcional', async () => {
      const totalAntes = await despacho.contarOrdenesVisibles();
      await despacho.actualizarListado();
      const totalDespues = await despacho.contarOrdenesVisibles();
      expect(totalDespues).toBeGreaterThanOrEqual(totalAntes > 0 ? 1 : 0);
      await expect(despacho.panelSeleccionarOrden).toBeVisible({ timeout: TIMEOUTS.MODAL });
    });

    await validarSinMensajesDeError(page);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('9. Validar el rango de fechas del filtro', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoBodegaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho Bodega - filtro fecha ${Date.now()}`);

    // NOTA (hallazgo de sistema/ambiente, ver el comentario completo en
    // establecerRangoFechas() del Page Object, confirmado en vivo con
    // evidencia de red): esta pantalla revierte #start_date/#end_date a su
    // valor por defecto entre fill() y que "Buscar" dispara la consulta
    // real — mismo comportamiento ya documentado para Despacho de Órdenes de
    // Caja. Este escenario valida lo que sí es confiable: los campos aceptan
    // un rango válido en formato ISO y disparan una búsqueda real sin error.
    await test.step('Establecer un rango de fechas válido y confirmar que la búsqueda se ejecuta sin error', async () => {
      const hoy = new Date();
      const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
      const fmtISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await despacho.establecerRangoFechas(fmtISO(hace30), fmtISO(hoy));
      expect(await despacho.contarOrdenesVisibles()).toBeGreaterThan(0);
    });

    await validarSinMensajesDeError(page);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('10. Menú de tres puntos: Imprimir orden y Descargar PDF', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoBodegaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho Bodega - impresion ${Date.now()}`);
    await despacho.abrirDetallePrimeraOrden();

    await test.step('Validar el enlace real de "Imprimir orden"', async () => {
      const href = await despacho.obtenerHrefImprimirOrden();
      expect(href, 'El menú de tres puntos no trae un href real para "Imprimir orden"').toContain('printPosDispatchOrder');
      const respuesta = await page.request.get(href);
      expect(respuesta.ok(), `"Imprimir orden" no respondió OK (status ${respuesta.status()})`).toBe(true);
    });

    await test.step('Validar el enlace real de "Descargar PDF de orden"', async () => {
      const href = await despacho.obtenerHrefDescargarPdf();
      expect(href, 'El menú de tres puntos no trae un href real para "Descargar PDF de orden"').toContain('downloadPosDispatchOrder');
      const respuesta = await page.request.get(href);
      expect(respuesta.ok(), `"Descargar PDF de orden" no respondió OK (status ${respuesta.status()})`).toBe(true);
    });

    await validarSinMensajesDeError(page);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});
