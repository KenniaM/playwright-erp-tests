import { test, expect } from '@playwright/test';
import {
  espiarErroresJS,
  RecepcionPage,
  TAB_ORDENES,
  TIMEOUTS,
  validarSinErrores,
} from './recepcion.page';

// ─────────────────────────────────────────────────────────────────────────────
// recepcion-ordenes.spec.ts — funcionalidades específicas del tab ÓRDENES:
// vista Caja/Lista, y las acciones del menú "⋮" de una orden (Compartir,
// Opciones avanzadas, Documentos, Abonos, Editar orden, Asignar mecánico) —
// probadas desde este tab. "Ver orden" (la vista comprensiva de detalle,
// alcanzable desde el mismo menú) tiene su propio archivo dedicado por su
// tamaño: ver recepcion-ver-orden.spec.ts.
// ─────────────────────────────────────────────────────────────────────────────

test('Cambiar entre vista Caja y vista Lista en el tab Órdenes, con sus opciones funcionando en ambas', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  let orden = '';

  await test.step('Abrir el módulo y entrar al tab Órdenes', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
  });

  await test.step('Tomar una orden real visible como referencia', async () => {
    orden = await recepcion.obtenerPrimeraOrdenVisible();
    expect(orden, 'No se pudo leer ninguna orden real desde el ambiente').not.toBe('');
  });

  await test.step('Cambiar a vista Caja y validar que la información sigue visible', async () => {
    await recepcion.cambiarVistaOrdenes('caja');

    expect(await recepcion.vistaOrdenesActiva()).toBe('caja');
    await expect(
      recepcion.badgeOrden(orden),
      `La orden #${orden} dejó de estar visible al cambiar a vista Caja`
    ).toBeVisible();
  });

  await test.step('En vista Caja, las opciones de la orden siguen funcionando', async () => {
    const menu = await recepcion.abrirOpcionesPrimeraOrden();
    expect(await menu.locator('a').count(), 'El menú de opciones de la orden no expone ninguna acción en vista Caja').toBeGreaterThan(0);
    await page.keyboard.press('Escape');
  });

  await test.step('Cambiar a vista Lista y validar que la información sigue visible', async () => {
    await recepcion.cambiarVistaOrdenes('lista');

    expect(await recepcion.vistaOrdenesActiva()).toBe('lista');
    await expect(
      recepcion.badgeOrden(orden),
      `La orden #${orden} dejó de estar visible al cambiar a vista Lista`
    ).toBeVisible();
  });

  await test.step('En vista Lista, las opciones de la orden siguen funcionando', async () => {
    const menu = await recepcion.abrirOpcionesPrimeraOrden();
    expect(await menu.locator('a').count(), 'El menú de opciones de la orden no expone ninguna acción en vista Lista').toBeGreaterThan(0);
    await page.keyboard.press('Escape');
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});


test('Compartir orden: por correo y por WhatsApp', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);

  await test.step('Compartir por correo: abrir, validar destinatarios precargados y enviar', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();
    await recepcion.abrirCompartirPorCorreo(menu);

    const correos = await recepcion.obtenerCorreosCompartir();
    expect(correos.length, 'El modal no muestra ningún destinatario precargado').toBeGreaterThan(0);

    await recepcion.enviarCompartirPorCorreo();
  });

  await test.step('Compartir por correo: cancelar sin enviar cierra el modal', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();
    await recepcion.abrirCompartirPorCorreo(menu);
    await recepcion.cancelarCompartirPorCorreo();
  });

  await test.step('Compartir por WhatsApp: si está disponible, validar que la información generada sea correcta', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();
    const linkWa = recepcion.linkCompartirWhatsapp(menu);

    // Su presencia depende de que el cliente autoseleccionado de la primera
    // orden tenga un teléfono válido registrado — un dato real y mutable del
    // ambiente compartido (confirmado en vivo, difiere entre órdenes), no
    // algo que la propia función de "Compartir orden" garantice siempre. Por
    // eso no se fuerza su presencia; se valida su contenido SOLO si aparece.
    if (await linkWa.count()) {
      const onclick = await linkWa.first().getAttribute('onclick');
      expect(onclick, 'El link de "Compartir por WhatsApp" no tiene ningún dato real en su onclick').toMatch(
        /confirm(SendRepairOrderWhatsapp|_send_repair_order_by_whatsapp_message)\(\s*['"]?\d+/
      );
    }
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});


test('Opciones avanzadas: descargar QR y ver orden online', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_ORDEN_SENCILLA);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);

  async function crearOrdenDesechable(placa: string) {
    await recepcion.ir();
    await recepcion.abrirNuevaRecepcion();
    await recepcion.agregarVehiculoNuevo(placa);
    await recepcion.seleccionarPrimerClienteWizard();
    await recepcion.avanzarWizard();
    await recepcion.completarDetallesVehiculoMinimo();
    await recepcion.guardarDetallesVehiculo();
    await expect(page.getByText('Lista de productos y servicios')).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await recepcion.agregarProductoDelCatalogo();
    await recepcion.avanzarWizardVeces(4);
    await recepcion.marcarPrimeraParteComoBuena();
    await recepcion.avanzarWizard();
    await recepcion.subirFotoRecepcion(FOTO_PRUEBA);
    await recepcion.avanzarWizard();
    await recepcion.marcarDanioYGuardar();
    await recepcion.avanzarWizard();
    await recepcion.llenarObservaciones('Observación de servicio QA', 'Observación de cliente QA');
    await recepcion.avanzarWizard();
    await recepcion.firmarCliente();
    await recepcion.generarOrden();
  }

  const placaQr = `QAADVQR${Date.now().toString().slice(-6)}`;

  await test.step('Crear la orden desechable', async () => {
    await crearOrdenDesechable(placaQr);
  });

  await test.step('Descargar el QR del vehículo y validar que el archivo se descarga correctamente', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placaQr);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();

    const descarga = await recepcion.descargarQrVehiculo(menu);
    expect(descarga.suggestedFilename(), 'El QR descargado no incluye la placa del vehículo en su nombre').toContain(placaQr);
    const rutaDescargada = await descarga.path();
    expect(rutaDescargada, 'El archivo del QR no se guardó en disco').not.toBeNull();
  });

  await test.step('Ver orden online: abre y carga correctamente, con la información principal visible', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placaQr);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();

    const paginaOnline = await recepcion.abrirVerOrdenOnline(menu);
    // .first(): confirmado en vivo que la placa aparece dos veces (variantes
    // de layout responsive desktop/mobile), ambas reales y visibles a la vez.
    await expect(paginaOnline.getByText(placaQr).first(), 'La vista online no muestra la placa del vehículo').toBeVisible({
      timeout: TIMEOUTS.CARGA,
    });
    await paginaOnline.close();
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

// BUG CONFIRMADO EN VIVO (investigación exhaustiva: 6+ corridas distintas,
// incluyendo la orden desechable dedicada y aislada — sin QR ni "Ver orden
// online" antes, descartando interferencia de esos pasos): el botón
// "Desactivar" del SweetAlert de confirmación cierra el diálogo (reacciona
// visualmente, el botón desaparece tras el clic) pero NO dispara ninguna
// petición de red real — confirmado con captura de red completa durante
// toda la interacción, 0 peticiones POST relacionadas con la orden. La
// orden sigue existiendo y siendo encontrable en el listado indefinidamente
// después. Mismo patrón de bug que "Eliminar orden" (ver el test siguiente):
// un SweetAlert cuyo botón de confirmación no invoca la acción real de la
// aplicación. Se documenta con `test.fail()` en vez de debilitar la
// aserción real, siguiendo el mismo criterio ya aplicado a "Eliminar orden".


test.fail(
  'BUG CONOCIDO: Desactivar orden no dispara ninguna petición de red real (el SweetAlert se cierra pero no ejecuta la acción)',
  async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST_ORDEN_SENCILLA);
    const recepcion = new RecepcionPage(page);
    const placa = `QAADVDES${Date.now().toString().slice(-6)}`;

    await test.step('Crear una orden desechable', async () => {
      await recepcion.ir();
      await recepcion.abrirNuevaRecepcion();
      await recepcion.agregarVehiculoNuevo(placa);
      await recepcion.seleccionarPrimerClienteWizard();
      await recepcion.avanzarWizard();
      await recepcion.completarDetallesVehiculoMinimo();
      await recepcion.guardarDetallesVehiculo();
      await expect(page.getByText('Lista de productos y servicios')).toBeVisible({ timeout: TIMEOUTS.CARGA });
      await recepcion.agregarProductoDelCatalogo();
      await recepcion.avanzarWizardVeces(4);
      await recepcion.marcarPrimeraParteComoBuena();
      await recepcion.avanzarWizard();
      await recepcion.subirFotoRecepcion(FOTO_PRUEBA);
      await recepcion.avanzarWizard();
      await recepcion.marcarDanioYGuardar();
      await recepcion.avanzarWizard();
      await recepcion.llenarObservaciones('Observación de servicio QA', 'Observación de cliente QA');
      await recepcion.avanzarWizard();
      await recepcion.firmarCliente();
      await recepcion.generarOrden();
    });

    await test.step('Desactivar orden: confirmar y validar que deja de aparecer en el listado', async () => {
      await recepcion.ir();
      await recepcion.visitarTab(TAB_ORDENES);
      await recepcion.buscarOrden(placa);
      const menu = await recepcion.abrirOpcionesPrimeraOrden();
      await recepcion.desactivarOrden(menu);

      await expect
        .poll(
          async () => {
            await recepcion.ir();
            await recepcion.visitarTab(TAB_ORDENES);
            await recepcion.buscarOrden(placa);
            return recepcion.obtenerNumerosOrdenVisibles().then((n) => n.length);
          },
          { timeout: TIMEOUTS.POLL_CON_RECARGA_COMPLETA }
        )
        .toBe(0);
    });
  }
);

// BUG CONFIRMADO EN VIVO (5 corridas de investigación distintas, ver el
// comentario completo en `RecepcionPage.eliminarOrden()`): el enlace
// "Eliminar orden" no produce ningún efecto observable — ni SweetAlert, ni
// `confirm()` nativo, ni petición de red, ni cambio en el listado. Se
// descartó que fuera un problema del clic de Playwright (llamar la función
// JS real `deleteRepairOrderdefinitive(id, companyId)` directamente con los
// IDs reales tampoco hace nada) y que dependiera de desactivar la orden
// primero (una orden desactivada deja de ser encontrable por completo, sin
// ningún filtro de "Inactivas" disponible para volver a ella). Se marca este
// test con `test.fail()` en vez de debilitar su aserción real (que la orden
// deje de existir tras "Eliminar") — documenta el hallazgo con evidencia y
// mantiene la validación honesta, en vez de forzar un verde falso.


test.fail(
  'BUG CONOCIDO: Eliminar orden no produce ningún efecto (ni SweetAlert, ni petición de red, ni cambio en el listado)',
  async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST_ORDEN_SENCILLA);
    const recepcion = new RecepcionPage(page);
    const placa = `QAADVEL${Date.now().toString().slice(-6)}`;

    await test.step('Crear una orden desechable', async () => {
      await recepcion.ir();
      await recepcion.abrirNuevaRecepcion();
      await recepcion.agregarVehiculoNuevo(placa);
      await recepcion.seleccionarPrimerClienteWizard();
      await recepcion.avanzarWizard();
      await recepcion.completarDetallesVehiculoMinimo();
      await recepcion.guardarDetallesVehiculo();
      await expect(page.getByText('Lista de productos y servicios')).toBeVisible({ timeout: TIMEOUTS.CARGA });
      await recepcion.agregarProductoDelCatalogo();
      await recepcion.avanzarWizardVeces(4);
      await recepcion.marcarPrimeraParteComoBuena();
      await recepcion.avanzarWizard();
      await recepcion.subirFotoRecepcion(FOTO_PRUEBA);
      await recepcion.avanzarWizard();
      await recepcion.marcarDanioYGuardar();
      await recepcion.avanzarWizard();
      await recepcion.llenarObservaciones('Observación de servicio QA', 'Observación de cliente QA');
      await recepcion.avanzarWizard();
      await recepcion.firmarCliente();
      await recepcion.generarOrden();
    });

    await test.step('Eliminar orden: confirmar y validar que ya no existe en el listado', async () => {
      await recepcion.ir();
      await recepcion.visitarTab(TAB_ORDENES);
      await recepcion.buscarOrden(placa);
      const menu = await recepcion.abrirOpcionesPrimeraOrden();
      await recepcion.eliminarOrden(menu);

      await recepcion.ir();
      await recepcion.visitarTab(TAB_ORDENES);
      await recepcion.buscarOrden(placa);
      await expect
        .poll(() => recepcion.obtenerNumerosOrdenVisibles().then((n) => n.length), { timeout: TIMEOUTS.CARGA })
        .toBe(0);
    });
  }
);


test('Documentos: PDF General, Descriptivo, Proforma, Imprimir y Reportes de Inspección', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_ORDEN_COMPLETA);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  const placa = `QADOC${Date.now().toString().slice(-6)}`;

  await test.step('Crear una orden desechable con inspección (para que los reportes de inspección tengan datos reales)', async () => {
    await recepcion.ir();
    await recepcion.abrirNuevaRecepcion();
    await recepcion.agregarVehiculoNuevo(placa);
    await recepcion.seleccionarPrimerClienteWizard();
    await recepcion.avanzarWizard();
    await recepcion.completarDetallesVehiculoMinimo();
    await recepcion.guardarDetallesVehiculo();
    await expect(page.getByText('Lista de productos y servicios')).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await recepcion.agregarProductoDelCatalogo();
    await recepcion.agregarServicioDelCatalogo(SERVICIO_CON_PAQUETE_INSPECCION);

    await recepcion.avanzarWizard();
    await recepcion.completarPrimerComponenteInspeccion();
    await recepcion.activarReemplazoYAgregarProductos();

    // Enderezado y Pintura, Abonos: sin acción (no son necesarios para
    // validar los documentos de esta prueba) — 3 avances (no 2): uno por
    // Enderezado y Pintura, uno por Abonos, y uno más para llegar de verdad
    // a "Partes del vehículo" (confirmado en vivo, mismo conteo que usa
    // "Orden completa" con sus 3 `avanzarWizard()` individuales).
    await recepcion.avanzarWizardVeces(3);
    await recepcion.marcarPrimeraParteComoBuena();
    await recepcion.avanzarWizard();
    await recepcion.subirFotoRecepcion(FOTO_PRUEBA);
    await recepcion.avanzarWizard();
    await recepcion.marcarDanioYGuardar();
    await recepcion.avanzarWizard();
    await recepcion.llenarObservaciones('Observación de servicio QA', 'Observación de cliente QA');
    await recepcion.avanzarWizard();
    await recepcion.firmarCliente();
    await recepcion.generarOrden();
  });

  await test.step('Crear PDF General: generar y validar que se descarga correctamente', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();

    const descarga = await recepcion.descargarPdfGeneral(menu);
    expect(descarga.suggestedFilename(), 'El nombre del PDF General no parece un archivo de orden').toMatch(/\.pdf$/i);
    expect(await descarga.path(), 'El PDF General no se guardó en disco').not.toBeNull();
  });

  await test.step('PDF Descriptivo: generar y validar la descarga', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();

    const descarga = await recepcion.descargarPdfDescriptivo(menu);
    expect(descarga.suggestedFilename(), 'El nombre del PDF Descriptivo no parece un archivo de orden').toMatch(/\.pdf$/i);
    expect(await descarga.path(), 'El PDF Descriptivo no se guardó en disco').not.toBeNull();
  });

  await test.step('PDF Proforma: generar y validar la descarga', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();

    const descarga = await recepcion.descargarPdfProforma(menu);
    expect(descarga.suggestedFilename(), 'El nombre del PDF Proforma no parece un archivo de orden').toMatch(/\.pdf$/i);
    expect(await descarga.path(), 'El PDF Proforma no se guardó en disco').not.toBeNull();
  });

  await test.step('Imprimir Orden: abrir y validar que la impresión carga correctamente', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();

    const paginaImpresion = await recepcion.abrirImprimirOrden(menu);
    await paginaImpresion.close().catch(() => {});
  });

  await test.step('PDF Reporte de Inspección: generar y validar la descarga', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();

    const descarga = await recepcion.descargarReporteInspeccion(menu);
    expect(descarga.suggestedFilename(), 'El nombre del Reporte de Inspección no parece un archivo de orden').toMatch(/\.pdf$/i);
    expect(await descarga.path(), 'El Reporte de Inspección no se guardó en disco').not.toBeNull();
  });

  await test.step('PDF Reporte de Inspección Avanzado: generar y validar la descarga', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();

    const descarga = await recepcion.descargarReporteInspeccionAvanzado(menu);
    expect(descarga.suggestedFilename(), 'El nombre del Reporte de Inspección Avanzado no parece un archivo de orden').toMatch(/\.pdf$/i);
    expect(await descarga.path(), 'El Reporte de Inspección Avanzado no se guardó en disco').not.toBeNull();
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});


test('Abonos: agregar un abono desde el menú "⋮" e imprimirlo', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_ORDEN_SENCILLA);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  const placa = `QAABO${Date.now().toString().slice(-6)}`;
  const MONTO_ABONO = '25';
  const OBSERVACIONES_ABONO = 'Abono de prueba QA';

  await test.step('Crear una orden desechable', async () => {
    await recepcion.ir();
    await recepcion.abrirNuevaRecepcion();
    await recepcion.agregarVehiculoNuevo(placa);
    await recepcion.seleccionarPrimerClienteWizard();
    await recepcion.avanzarWizard();
    await recepcion.completarDetallesVehiculoMinimo();
    await recepcion.guardarDetallesVehiculo();
    await expect(page.getByText('Lista de productos y servicios')).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await recepcion.agregarProductoDelCatalogo();
    await recepcion.avanzarWizardVeces(4);
    await recepcion.marcarPrimeraParteComoBuena();
    await recepcion.avanzarWizard();
    await recepcion.subirFotoRecepcion(FOTO_PRUEBA);
    await recepcion.avanzarWizard();
    await recepcion.marcarDanioYGuardar();
    await recepcion.avanzarWizard();
    await recepcion.llenarObservaciones('Observación de servicio QA', 'Observación de cliente QA');
    await recepcion.avanzarWizard();
    await recepcion.firmarCliente();
    await recepcion.generarOrden();
  });

  let saldoAntes = 0;

  await test.step('Agregar abono: validar el modal (saldo, campos) y guardarlo', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();
    await recepcion.abrirAgregarAbonoDesdeMenu(menu);

    saldoAntes = await recepcion.obtenerSaldoActualAbonoMenu();
    expect(saldoAntes, 'El saldo actual del modal de abono no se pudo leer').toBeGreaterThan(0);

    await recepcion.llenarFormularioAbonoMenu({ monto: MONTO_ABONO, observaciones: OBSERVACIONES_ABONO });

    // El saldo restante se recalcula en vivo dentro del propio modal, sin
    // necesitar guardar todavía.
    await expect
      .poll(() => recepcion.obtenerSaldoRestanteAbonoMenu(), { timeout: TIMEOUTS.CARGA })
      .toBeCloseTo(saldoAntes - Number(MONTO_ABONO), 1);

    await recepcion.guardarAbonoMenu();
  });

  // No se valida el CONTENIDO de la impresión: confirmado en vivo
  // (investigación dedicada, con un listener de `page` activo durante todo
  // el clic) que "Imprimir Abono" dispara un `window.print()` nativo del
  // navegador — no abre ninguna pestaña, modal ni iframe inspeccionable
  // (a diferencia de "Imprimir Orden", que sí abre una pestaña real). Un
  // navegador headless no expone ningún DOM para ese diálogo nativo, así
  // que no hay nada real que esta automatización pueda leer para validar el
  // contenido — una limitación de probar `window.print()` en headless, no
  // un bug de la app. Lo que sí se valida es que el enlace existe (una vez
  // hay un abono real registrado) y que activarlo no produce ningún error
  // de JavaScript (ver el paso final de la prueba).
  await test.step('Imprimir abono: el enlace está disponible y se activa sin errores', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();
    await recepcion.imprimirAbono(menu);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});


test('Editar orden: modificar un dato real desde el wizard y verificar que persiste al reabrir', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_ORDEN_SENCILLA);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  const placa = `QAEDIT${Date.now().toString().slice(-6)}`;

  await test.step('Crear una orden desechable, generada por completo', async () => {
    await recepcion.ir();
    await recepcion.abrirNuevaRecepcion();
    await recepcion.agregarVehiculoNuevo(placa);
    await recepcion.seleccionarPrimerClienteWizard();
    await recepcion.avanzarWizard();
    await recepcion.completarDetallesVehiculoMinimo();
    await recepcion.guardarDetallesVehiculo();
    await expect(page.getByText('Lista de productos y servicios')).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await recepcion.agregarProductoDelCatalogo();
    await recepcion.avanzarWizardVeces(4);
    await recepcion.marcarPrimeraParteComoBuena();
    await recepcion.avanzarWizard();
    await recepcion.subirFotoRecepcion(FOTO_PRUEBA);
    await recepcion.avanzarWizard();
    await recepcion.marcarDanioYGuardar();
    await recepcion.avanzarWizard();
    await recepcion.llenarObservaciones('Observación inicial QA', 'Observación inicial cliente QA');
    await recepcion.avanzarWizard();
    await recepcion.firmarCliente();
    await recepcion.generarOrden();
  });

  let totalTrasEditar = 0;

  // Confirmado en vivo: "Editar orden" reabre el wizard paso a paso (no la
  // vista comprensiva de detalle que abre el clic en el badge/número) y,
  // para una orden ya generada con este mismo flujo, resume de forma
  // repetible en "Marcación de daños" — el dato editable real y persistente
  // disponible justo en ese paso es agregar otra marcación de daño.
  await test.step('Abrir "Editar orden" desde el menú "⋮" y agregar otra marcación de daño', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();
    await recepcion.abrirEditarOrdenDesdeMenu(menu);

    const totalAntes = await recepcion.obtenerTotalMarcacionesDanio();
    await recepcion.marcarDanioYGuardar();
    totalTrasEditar = await recepcion.obtenerTotalMarcacionesDanio();
    expect(totalTrasEditar, 'El total de marcaciones de daño no aumentó tras guardar la nueva marcación').toBeGreaterThan(totalAntes);
  });

  await test.step('Reabrir la orden desde cero (nueva navegación) y verificar que el cambio persistió', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();
    await recepcion.abrirEditarOrdenDesdeMenu(menu);

    const totalTrasReabrir = await recepcion.obtenerTotalMarcacionesDanio();
    expect(totalTrasReabrir, 'El total de marcaciones de daño editado no persistió al reabrir la orden').toBe(totalTrasEditar);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});


test.fail(
  'BUG CONOCIDO: Asignar mecánico desde Órdenes — seleccionar un mecánico del popover no dispara ninguna petición real ni actualiza el ícono',
  async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST_ORDEN_SENCILLA);
    const recepcion = new RecepcionPage(page);

    await test.step('Abrir el popover de "Asignar mecánico" en Órdenes y seleccionar un mecánico (sin éxito)', async () => {
      await recepcion.ir();
      await recepcion.visitarTab(TAB_ORDENES);

      const tarjeta = recepcion.primeraTarjetaConAsignarMecanico();
      await expect(tarjeta, 'No hay ninguna orden con la opción de "Asignar mecánico" visible en "Órdenes"').toBeVisible({
        timeout: TIMEOUTS.CARGA,
      });

      const antes = await recepcion.obtenerMecanicoAsignado(tarjeta);
      const popover = await recepcion.abrirAsignarMecanico(tarjeta);
      await recepcion.asignarPrimerMecanicoDisponible(popover, antes);
    });
  }
);

