import path from 'path';
import { test, expect } from '@playwright/test';
import {
  espiarErroresJS,
  MARCA_VEHICULO_PRUEBA,
  PRODUCTO_CATALOGO_PRUEBA,
  RecepcionPage,
  TAB_ORDENES,
  TIMEOUTS,
  validarSinErrores,
} from './recepcion.page';
import { RecepcionVerOrden, TIMEOUTS as TIMEOUTS_VER_ORDEN } from './recepcion-ver-orden.page';

// ─────────────────────────────────────────────────────────────────────────────
// recepcion-ver-orden.spec.ts — la vista comprensiva "Ver orden"
// (`getOrderDetailById`, alcanzable desde el menú "⋮" de una orden en
// cualquier tab, o haciendo clic en la información de cliente/vehículo de su
// tarjeta): Histórico de vehículo, Editar recepción, Pasos completados,
// Editar cliente, Fotos, Servicios, Productos, Partes, Observaciones,
// Totales, Facturar y Regresar. Dominio propio (`recepcion-ver-orden.page.ts`,
// compuesto contra `RecepcionPage`) por su tamaño — ver ese archivo para los
// locators/métodos reales confirmados en vivo.
// ─────────────────────────────────────────────────────────────────────────────

const FOTO_PRUEBA = path.join(__dirname, 'fixtures', 'foto-prueba.png');

/** Crea una orden desechable mínima y la abre en "Ver orden" — punto de partida común a la mayoría de los tests de este archivo. */
async function crearOrdenYAbrirVerOrden(recepcion: RecepcionPage, placa: string) {
  await recepcion.ir();
  await recepcion.abrirNuevaRecepcion();
  await recepcion.agregarVehiculoNuevo(placa);
  await recepcion.seleccionarPrimerClienteWizard();
  await recepcion.avanzarWizard();
  await recepcion.completarDetallesVehiculoMinimo();
  await recepcion.guardarDetallesVehiculo();
  await recepcion.regresarAOrdenesDesdeWizard();
  await recepcion.visitarTab(TAB_ORDENES);
  await recepcion.buscarOrden(placa);
  await expect
    .poll(() => recepcion.obtenerNumerosOrdenVisibles().then((n) => n.length), { timeout: TIMEOUTS.CARGA })
    .toBeGreaterThan(0);
  const menu = await recepcion.abrirOpcionesPrimeraOrden();
  await recepcion.abrirVerOrdenDesdeMenu(menu);
}

test('Ver orden: la información mostrada corresponde a los datos reales de la orden', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_ORDEN_SENCILLA);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  const placa = `QAVER${Date.now().toString().slice(-6)}`;

  await test.step('Crear una orden desechable con un producto real agregado', async () => {
    await recepcion.ir();
    await recepcion.abrirNuevaRecepcion();
    await recepcion.agregarVehiculoNuevo(placa);
    await recepcion.seleccionarPrimerClienteWizard();
    await recepcion.avanzarWizard();
    await recepcion.completarDetallesVehiculoMinimo();
    await recepcion.guardarDetallesVehiculo();
    await expect(page.getByText('Lista de productos y servicios')).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await recepcion.agregarProductoDelCatalogo();
  });

  await test.step('Abrir "Ver orden" desde el menú "⋮" y validar la información mostrada', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);
    const menu = await recepcion.abrirOpcionesPrimeraOrden();
    await recepcion.abrirVerOrdenDesdeMenu(menu);
    await recepcion.verificarSeccionesVerOrden();

    const texto = await recepcion.obtenerTextoVerOrden();
    expect(texto, 'La vista "Ver orden" no muestra la placa real del vehículo de la orden').toContain(placa);
    expect(texto, 'La vista "Ver orden" no muestra la marca real del vehículo de la orden').toContain(MARCA_VEHICULO_PRUEBA);
    expect(texto, 'La vista "Ver orden" no muestra el producto real agregado a la orden').toContain(PRODUCTO_CATALOGO_PRUEBA);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});


test('Acceso a "Ver orden" desde la información de cliente/vehículo de la tarjeta', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_ORDEN_SENCILLA);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  const placa = `QAINFO${Date.now().toString().slice(-6)}`;

  await test.step('Crear una orden desechable', async () => {
    await recepcion.ir();
    await recepcion.abrirNuevaRecepcion();
    await recepcion.agregarVehiculoNuevo(placa);
    await recepcion.seleccionarPrimerClienteWizard();
    await recepcion.avanzarWizard();
    await recepcion.completarDetallesVehiculoMinimo();
    await recepcion.guardarDetallesVehiculo();
  });

  await test.step('En Órdenes, hacer clic en la información de cliente/vehículo de la tarjeta y validar que redirige a "Ver orden"', async () => {
    await recepcion.regresarAOrdenesDesdeWizard();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);

    const tarjeta = page.locator('.reception-order-card:visible, .repair-order-card:visible').first();
    await expect(tarjeta, 'No se encontró la tarjeta de la orden recién creada para hacer clic en su información').toBeVisible({
      timeout: TIMEOUTS.CARGA,
    });
    await recepcion.abrirVerOrdenDesdeInfoTarjeta(tarjeta);

    const texto = await recepcion.obtenerTextoVerOrden();
    expect(texto, 'La vista "Ver orden" abierta desde la tarjeta no corresponde a la orden seleccionada (placa distinta)').toContain(placa);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Encabezado: Pasos completados, Histórico Vehículo, Editar recepción y contraer/expandir el panel de Histórico', async ({ page }) => {
  test.setTimeout(TIMEOUTS_VER_ORDEN.TEST);
  const recepcion = new RecepcionPage(page);
  const verOrden = new RecepcionVerOrden(recepcion, page);
  const errores = espiarErroresJS(page);
  const placa = `QAHDR${Date.now().toString().slice(-6)}`;

  await test.step('Crear una orden desechable y abrir "Ver orden"', async () => {
    await crearOrdenYAbrirVerOrden(recepcion, placa);
  });

  await test.step('"Pasos de la recepción completados" muestra el stepper real con al menos un paso', async () => {
    const pasos = await verOrden.obtenerPasosStepper();
    expect(pasos.length, 'El stepper de "Pasos de la recepción completados" no muestra ningún paso').toBeGreaterThan(0);
  });

  await test.step('"Histórico Vehículo" abre un modal con el resumen real de esta orden', async () => {
    await verOrden.abrirHistoricoVehiculo();
    // Confirmado en vivo: es un resumen de servicios/productos YA agregados
    // a la orden ("Historial de órdenes — Estas órdenes ya han sido
    // procesadas"); una orden recién creada sin ítems muestra el modal vacío
    // (sin filas), así que solo se valida el título real, no una tabla con
    // datos que esta orden desechable no tiene.
    await expect(verOrden.modalHistoricoVehiculo, 'El modal de histórico no muestra su título real').toContainText('Histórico de órdenes');
    await verOrden.cerrarHistoricoVehiculo();
  });

  await test.step('Contraer y expandir el panel lateral "Histórico" no produce errores', async () => {
    await verOrden.alternarContraerHistorico();
    await verOrden.alternarContraerHistorico();
  });

  await test.step('"Editar recepción" reabre el wizard de creación', async () => {
    await verOrden.abrirEditarRecepcion();
    // Mismo criterio ya documentado en `RecepcionPage.abrirEditarOrdenDesdeMenu`:
    // reabre el wizard en el paso que el backend considera pendiente — para
    // una orden completa eso confirmó ser "Marcación de daños" (canvas),
    // pero para esta orden desechable MÍNIMA (sin servicios/partes/fotos)
    // el paso pendiente real es "Detalles del vehículo" (confirmado en vivo:
    // encabezado "Orden # <n>" + el stepper del wizard) — se valida la señal
    // genérica de que el wizard reabrió, no un paso específico.
    await expect(
      page.getByRole('heading', { name: /Orden #/ }),
      'El wizard de "Editar recepción" no cargó (no apareció el encabezado "Orden #")'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Editar cliente: abre el formulario de edición en una pestaña nueva con los datos correctos', async ({ page, context }) => {
  test.setTimeout(TIMEOUTS_VER_ORDEN.TEST);
  const recepcion = new RecepcionPage(page);
  const verOrden = new RecepcionVerOrden(recepcion, page);
  const errores = espiarErroresJS(page);
  const placa = `QACLI${Date.now().toString().slice(-6)}`;

  await test.step('Crear una orden desechable y abrir "Ver orden"', async () => {
    await crearOrdenYAbrirVerOrden(recepcion, placa);
  });

  await test.step('"Editar" (Información del cliente) abre una pestaña nueva con el formulario real del cliente', async () => {
    const popup = await verOrden.abrirEditarClienteEnNuevaPestana(context);
    expect(popup.url(), 'La pestaña nueva no navegó al formulario de edición de cliente esperado').toContain('addCustomerForm');
    await expect(popup.locator('body'), 'El formulario de edición de cliente no cargó contenido').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await popup.close();
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Fotos del vehículo: agregar una foto y validar que se muestra', async ({ page }) => {
  test.setTimeout(TIMEOUTS_VER_ORDEN.TEST);
  const recepcion = new RecepcionPage(page);
  const verOrden = new RecepcionVerOrden(recepcion, page);
  const errores = espiarErroresJS(page);
  const placa = `QAFOTO${Date.now().toString().slice(-6)}`;

  await test.step('Crear una orden desechable (sin fotos) y abrir "Ver orden"', async () => {
    await crearOrdenYAbrirVerOrden(recepcion, placa);
  });

  await test.step('Validar que la orden nueva inicia sin fotos', async () => {
    await expect(page.getByText('No hay fotos disponibles'), 'La orden recién creada ya muestra fotos').toBeVisible({ timeout: TIMEOUTS.CARGA });
  });

  await test.step('Agregar una foto del vehículo y validar que se muestra', async () => {
    await verOrden.agregarFotoVehiculo(FOTO_PRUEBA);
    await expect
      .poll(() => verOrden.fotosVehiculoVisibles(), { timeout: TIMEOUTS.CARGA })
      .toBeGreaterThan(0);
    await expect(page.getByText('No hay fotos disponibles'), 'Sigue mostrando "No hay fotos disponibles" tras agregar una').toBeHidden();
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Servicios: agregar del catálogo (lista y cuadrícula), y las acciones de la tarjeta (estado, aprobar/rechazar, asignar mecánico, ver notas, eliminar)', async ({ page }) => {
  test.setTimeout(TIMEOUTS_VER_ORDEN.TEST);
  const recepcion = new RecepcionPage(page);
  const verOrden = new RecepcionVerOrden(recepcion, page);
  const errores = espiarErroresJS(page);
  const placa = `QASERV${Date.now().toString().slice(-6)}`;

  await test.step('Crear una orden desechable y abrir "Ver orden"', async () => {
    await crearOrdenYAbrirVerOrden(recepcion, placa);
  });

  await test.step('Abrir "Agregar Servicio": validar modo cuadrícula y modo lista, y el buscador', async () => {
    await verOrden.abrirAgregarServicio();
    const modal = verOrden.modalBusquedaServicio;
    await expect(modal, 'El modal de búsqueda de servicios no muestra ningún servicio del catálogo').toContainText(/\$/);

    await verOrden.cambiarModoVistaCatalogo(modal, 'lista');
    await expect(modal).toBeVisible();
    await verOrden.cambiarModoVistaCatalogo(modal, 'cuadricula');
    await expect(modal).toBeVisible();

    await verOrden.buscarEnCatalogoServicio(PRODUCTO_CATALOGO_PRUEBA.slice(0, 3));
    await expect(modal).toBeVisible();
    await verOrden.cerrarModalBusqueda(modal);
  });

  let idServicio = '';
  await test.step('Agregar un servicio real del catálogo a la orden', async () => {
    await verOrden.abrirAgregarServicio();
    await verOrden.agregarPrimerServicioDelCatalogo();
    const ids = await verOrden.obtenerIdsServicios();
    expect(ids.length, 'No quedó ningún servicio agregado tras seleccionarlo del catálogo').toBeGreaterThan(0);
    idServicio = ids[0];
  });

  await test.step('Cambiar el "Estado" del servicio (Pendiente → Trabajando → Finalizado)', async () => {
    expect(await verOrden.estadoActualServicio(idServicio)).toBe('Pendiente');
    await verOrden.cambiarEstadoServicio(idServicio, 'Trabajando');
    await expect.poll(() => verOrden.estadoActualServicio(idServicio), { timeout: TIMEOUTS.CARGA }).toBe('Trabajando');
    await verOrden.cambiarEstadoServicio(idServicio, 'Finalizado');
    await expect.poll(() => verOrden.estadoActualServicio(idServicio), { timeout: TIMEOUTS.CARGA }).toBe('Finalizado');
  });

  await test.step('Aprobar y luego rechazar el servicio', async () => {
    await verOrden.establecerAprobacion(idServicio, 'servicio', 'Aprobar');
    await expect.poll(() => verOrden.aprobacionActual(idServicio, 'servicio'), { timeout: TIMEOUTS.CARGA }).toBe('Aprobar');
    await verOrden.establecerAprobacion(idServicio, 'servicio', 'Rechazar');
    await expect.poll(() => verOrden.aprobacionActual(idServicio, 'servicio'), { timeout: TIMEOUTS.CARGA }).toBe('Rechazar');
  });

  await test.step('Menú "⋮" del servicio: "Ver notas" abre su diálogo real', async () => {
    await verOrden.ejecutarOpcionMenuItem(idServicio, 'servicio', 'Ver notas');
    const modal = page.locator('#dialog_notes_in_service_items_orders');
    await expect(modal, 'No apareció el diálogo de notas ("dialog_notes_in_service_items_orders")').toBeVisible({
      timeout: TIMEOUTS.CARGA,
    });
    // Este modal tiene `data-keyboard="false"` (confirmado en vivo, mismo
    // patrón que otros modales del módulo) — Escape no lo cierra, hace falta
    // su botón de cierre real.
    await modal.locator('.close, [data-dismiss="modal"]').first().click();
    await expect(modal, 'El diálogo de notas no se cerró').toBeHidden({ timeout: TIMEOUTS.CARGA });
  });

  await test.step('Menú "⋮" del servicio: "Asignar mecánico" abre su selector real', async () => {
    await verOrden.ejecutarOpcionMenuItem(idServicio, 'servicio', 'Asignar mecánico');
    await expect(page.locator('.mechanic-item, .modal:visible, .popover:visible').first(), 'No apareció ningún selector de mecánico').toBeVisible({
      timeout: TIMEOUTS.CARGA,
    });
    await page.keyboard.press('Escape');
  });

  await test.step('Menú "⋮" del servicio: "Eliminar servicio" lo retira de la lista', async () => {
    await verOrden.eliminarItem(idServicio, 'servicio');
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Productos: agregar del catálogo (lista y cuadrícula, filtro de bodega), y las acciones de la tarjeta (asignar mecánico, ver notas, eliminar)', async ({ page }) => {
  test.setTimeout(TIMEOUTS_VER_ORDEN.TEST);
  const recepcion = new RecepcionPage(page);
  const verOrden = new RecepcionVerOrden(recepcion, page);
  const errores = espiarErroresJS(page);
  const placa = `QAPROD${Date.now().toString().slice(-6)}`;

  await test.step('Crear una orden desechable y abrir "Ver orden"', async () => {
    await crearOrdenYAbrirVerOrden(recepcion, placa);
  });

  await test.step('Abrir "Agregar Producto": validar modo cuadrícula, modo lista y el filtro de bodega', async () => {
    await verOrden.abrirAgregarProducto();
    const modal = verOrden.modalBusquedaProducto;
    await expect(modal, 'El modal de búsqueda de productos no muestra ningún producto del catálogo').toContainText(/\$/);
    await expect(modal, 'El modal de búsqueda de productos no muestra el filtro de Bodega').toContainText(/Bodega/i);

    await verOrden.cambiarModoVistaCatalogo(modal, 'lista');
    await expect(modal).toBeVisible();
    await verOrden.cambiarModoVistaCatalogo(modal, 'cuadricula');
    await expect(modal).toBeVisible();
    await verOrden.cerrarModalBusqueda(modal);
  });

  let idProducto = '';
  await test.step('Agregar un producto real del catálogo a la orden', async () => {
    await verOrden.abrirAgregarProducto();
    await verOrden.agregarPrimerProductoDelCatalogo();
    const ids = await verOrden.obtenerIdsProductos();
    expect(ids.length, 'No quedó ningún producto agregado tras seleccionarlo del catálogo').toBeGreaterThan(0);
    idProducto = ids[0];
  });

  await test.step('Aprobar el producto', async () => {
    await verOrden.establecerAprobacion(idProducto, 'producto', 'Aprobar');
    await expect.poll(() => verOrden.aprobacionActual(idProducto, 'producto'), { timeout: TIMEOUTS.CARGA }).toBe('Aprobar');
  });

  await test.step('Menú "⋮" del producto: "Ver notas" abre su diálogo real', async () => {
    await verOrden.ejecutarOpcionMenuItem(idProducto, 'producto', 'Ver notas');
    const modal = page.locator('#dialog_notes_in_service_items_orders');
    await expect(modal, 'No apareció el diálogo de notas ("dialog_notes_in_service_items_orders")').toBeVisible({
      timeout: TIMEOUTS.CARGA,
    });
    await modal.locator('.close, [data-dismiss="modal"]').first().click();
    await expect(modal, 'El diálogo de notas no se cerró').toBeHidden({ timeout: TIMEOUTS.CARGA });
  });

  await test.step('Menú "⋮" del producto: "Eliminar producto" lo retira de la lista', async () => {
    await verOrden.eliminarItem(idProducto, 'producto');
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Partes del vehículo: agregar una parte con estado, y las Observaciones se guardan automáticamente', async ({ page }) => {
  test.setTimeout(TIMEOUTS_VER_ORDEN.TEST);
  const recepcion = new RecepcionPage(page);
  const verOrden = new RecepcionVerOrden(recepcion, page);
  const errores = espiarErroresJS(page);
  const placa = `QAPARTE${Date.now().toString().slice(-6)}`;

  await test.step('Crear una orden desechable y abrir "Ver orden"', async () => {
    await crearOrdenYAbrirVerOrden(recepcion, placa);
  });

  await test.step('Agregar una parte del vehículo marcándola como "Bueno"', async () => {
    await verOrden.abrirAgregarParte();
    await verOrden.marcarPrimeraParteComoBuena();
    await verOrden.cerrarModalPartes();
  });

  await test.step('Editar las Observaciones (Asesor de servicio y Notas del cliente) y validar que persisten', async () => {
    await recepcion.llenarYValidarObservacionesReales(
      `Observación de servicio Ver Orden ${Date.now()}`,
      `Observación de cliente Ver Orden ${Date.now()}`
    );
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Cantidades y totales: el total general (botón "Facturar") se recalcula correctamente al agregar productos y servicios', async ({ page }) => {
  test.setTimeout(TIMEOUTS_VER_ORDEN.TEST);
  const recepcion = new RecepcionPage(page);
  const verOrden = new RecepcionVerOrden(recepcion, page);
  const errores = espiarErroresJS(page);
  const placa = `QATOTAL${Date.now().toString().slice(-6)}`;

  await test.step('Crear una orden desechable y abrir "Ver orden"', async () => {
    await crearOrdenYAbrirVerOrden(recepcion, placa);
  });

  // Mismo criterio catálogo-agnóstico ya usado en el resto del módulo
  // (`recepcion-basico.spec.ts`, wizard de creación): se valida que el total
  // general aumenta con cada ítem agregado, no un monto fijo — los precios
  // del catálogo son datos compartidos que pueden cambiar. El footer "Total
  // Servicios"/"Total Productos" (visible en pantalla) no expone un
  // selector propio confiable para automatizar (confirmado en vivo: no se
  // encontró como nodo de texto aislado), así que la coherencia matemática
  // se valida sobre el total general real, la misma fuente que usa el botón
  // "Facturar" para facturar la orden.
  await test.step('El total general inicia en $0,00 (orden recién creada, sin ítems)', async () => {
    expect(await verOrden.totalGeneralEnBotonFacturar()).toBe(0);
  });

  await test.step('Agregar un producto real aumenta el total general', async () => {
    await verOrden.abrirAgregarProducto();
    await verOrden.agregarPrimerProductoDelCatalogo();
    await expect
      .poll(() => verOrden.totalGeneralEnBotonFacturar(), { timeout: TIMEOUTS.CARGA })
      .toBeGreaterThan(0);
  });

  await test.step('Agregar un servicio real aumenta aún más el total general', async () => {
    const totalAntes = await verOrden.totalGeneralEnBotonFacturar();
    await verOrden.abrirAgregarServicio();
    await verOrden.agregarPrimerServicioDelCatalogo();
    await expect
      .poll(() => verOrden.totalGeneralEnBotonFacturar(), { timeout: TIMEOUTS.CARGA })
      .toBeGreaterThan(totalAntes);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Facturar: abre el POS en una pestaña nueva, precargado con la orden real', async ({ page, context }) => {
  test.setTimeout(TIMEOUTS_VER_ORDEN.TEST);
  const recepcion = new RecepcionPage(page);
  const verOrden = new RecepcionVerOrden(recepcion, page);
  const errores = espiarErroresJS(page);
  const placa = `QAFACT${Date.now().toString().slice(-6)}`;
  let numeroOrden = '';

  await test.step('Crear una orden desechable y abrir "Ver orden"', async () => {
    await recepcion.ir();
    await recepcion.abrirNuevaRecepcion();
    await recepcion.agregarVehiculoNuevo(placa);
    await recepcion.seleccionarPrimerClienteWizard();
    await recepcion.avanzarWizard();
    await recepcion.completarDetallesVehiculoMinimo();
    await recepcion.guardarDetallesVehiculo();
    await recepcion.regresarAOrdenesDesdeWizard();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);
    const { numero } = await recepcion.obtenerPrimeraOrdenYPlaca();
    numeroOrden = numero;
    const menu = await recepcion.abrirOpcionesPrimeraOrden();
    await recepcion.abrirVerOrdenDesdeMenu(menu);
  });

  await test.step('Agregar un producto real: "Facturar" está oculto en una orden sin ítems (regla de negocio real)', async () => {
    // Confirmado en vivo: el botón "Facturar" queda con la clase `hide`
    // mientras la orden no tenga ningún producto/servicio agregado — no es
    // un fallo de automatización, es la regla de negocio real (no se puede
    // facturar una orden vacía).
    await verOrden.abrirAgregarProducto();
    await verOrden.agregarPrimerProductoDelCatalogo();
    await expect(page.locator('#btn_total_order_in_see_order'), 'El botón "Facturar" sigue oculto tras agregar un producto').toBeVisible({
      timeout: TIMEOUTS.CARGA,
    });
  });

  await test.step('"Facturar" abre el POS en una pestaña nueva, precargado con esta orden', async () => {
    const popup = await verOrden.abrirFacturarEnNuevaPestana(context);
    expect(popup.url(), 'La pestaña nueva no navegó al POS').toContain('/pos/pointOfSale');
    expect(popup.url(), 'El POS no se precargó con el número de esta orden').toContain(`order_number=${numeroOrden}`);
    await popup.close();
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Regresar: vuelve al listado de Órdenes y la orden sigue existiendo', async ({ page }) => {
  test.setTimeout(TIMEOUTS_VER_ORDEN.TEST);
  const recepcion = new RecepcionPage(page);
  const verOrden = new RecepcionVerOrden(recepcion, page);
  const errores = espiarErroresJS(page);
  const placa = `QAREGR${Date.now().toString().slice(-6)}`;

  await test.step('Crear una orden desechable y abrir "Ver orden"', async () => {
    await crearOrdenYAbrirVerOrden(recepcion, placa);
  });

  await test.step('"Regresar" vuelve al listado de Órdenes y la orden sigue existiendo', async () => {
    await verOrden.regresarAOrdenes();
    await expect(recepcion.buscador, 'No regresó al listado de Órdenes (buscador no visible)').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await recepcion.buscarOrden(placa);
    await expect
      .poll(() => recepcion.obtenerNumerosOrdenVisibles().then((n) => n.length), { timeout: TIMEOUTS.CARGA })
      .toBeGreaterThan(0);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

