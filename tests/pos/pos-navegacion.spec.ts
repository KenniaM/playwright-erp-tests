import { test, expect, Locator, Page } from '@playwright/test';
import { PosPage, CAJA_TEXTO, TIMEOUTS, METODO, PESTANA_POS_FACTURACION, PESTANAS_POS_A_RECORRER, espiarErroresJS } from './pos.page';

// Productos reales y estables del catálogo, ya usados por el resto de la
// suite (pos.spec.ts, pos-orden-caja.spec.ts) — evita depender de la
// posición en el grid o de productos de precio variable.
const PRODUCTO_NORMAL = 'FRENOS';
const PRODUCTO_SECUNDARIO = 'Producto de prueba 1';

/**
 * Carga el POS y decide qué hacer con el modal "Abrir Caja" si aparece: lo valida y
 * lo cierra sin completar la apertura, ya que agregar productos no requiere la caja
 * abierta (eso se decide más adelante, al facturar). Comportamiento esperado, no un error.
 */
async function cargarPosYCerrarModalSiAparece(pos: PosPage) {
  await pos.irAlPos();
  await pos.esperarEstadoInicial();
  if (await pos.modalAbrirCajaVisible()) {
    await expect(pos.modalAbrirCaja).toBeVisible();
    await expect(pos.modalAbrirCaja.getByText(CAJA_TEXTO)).toBeVisible();
    await pos.cerrarModalAbrirCaja();
  }
}

/**
 * Espera (con reintentos reales, no una pausa fija) a que la condición de
 * "activo" dada se cumpla — usado para confirmar que una categoría o un tab
 * quedó seleccionado tras hacer click.
 */
async function esperarQuedaActivo(chequeoActivo: () => Promise<boolean>) {
  await expect.poll(chequeoActivo).toBe(true);
}

/**
 * Presiona el primer "Facturar" (abre el modal de pago). Este botón nunca requiere
 * abrir la caja —eso solo puede ocurrir al confirmar el pago, más adelante— así que
 * aquí no se valida ni se intenta abrir la caja en ningún caso. Mismo patrón ya usado
 * en pos.spec.ts/pos-facturar.spec.ts (duplicado localmente aquí, no importado: cada
 * spec de esta suite compone su propio flujo a partir de los métodos de PosPage).
 */
async function abrirModalDePago(pos: PosPage) {
  await pos.presionarFacturar();
  await pos.esperarModalPago();
}

/**
 * Presiona el "Facturar" del modal de pago (confirma el pago) y monitorea lo que
 * ocurre después, sin asumir que el modal "Abrir Caja" —si aparece— lo hace
 * inmediatamente. Mismo patrón ya usado en pos.spec.ts/pos-facturar.spec.ts.
 */
async function confirmarPagoAbriendoCajaSiEsNecesario(pos: PosPage, page: Page) {
  const MAX_INTENTOS = 3;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const popupPromise = page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP })
      .then((printPage) => ({ tipo: 'popup' as const, printPage }));
    const modalPromise = pos.modalAbrirCaja.waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP })
      .then(() => ({ tipo: 'modalAbrirCaja' as const }));

    await pos.presionarConfirmarPago();
    await pos.cerrarAvisoConsecutivoSiAparece();

    const resultado = await Promise.race([popupPromise, modalPromise]);

    if (resultado.tipo === 'popup') {
      await pos.mostrarYCerrarVentanaImpresion(resultado.printPage);
      return;
    }

    await expect(pos.modalAbrirCaja).toBeVisible();
    await pos.completarAperturaCaja();
    await expect(pos.modalAbrirCaja).toBeHidden();
  }

  throw new Error(
    `La facturación no se completó tras ${MAX_INTENTOS} intentos de abrir la caja: ` +
    'el sistema siguió pidiendo abrir la caja o nunca mostró la ventana de impresión.'
  );
}

/**
 * Cambia la moneda de `desde` a `hacia` y valida, con el mismo producto real,
 * que el precio visible en el grid realmente cambió (no solo el símbolo del
 * menú) y que el nuevo precio inicia con el símbolo esperado. Partir siempre
 * de una moneda base conocida (`desde`) evita un falso negativo si el
 * ambiente ya estuviera, por estado persistido del servidor, en la moneda
 * destino antes de empezar (confirmado en vivo, Fase 1: la moneda persiste
 * por usuario en el servidor, no por sesión).
 */
async function validarCambioDeMonedaYPrecio(pos: PosPage, desde: string, hacia: string, errores: string[]) {
  await pos.cambiarMoneda(desde);
  const precioAntes = await pos.obtenerPrecioVisibleProducto(PRODUCTO_NORMAL);

  await pos.cambiarMoneda(hacia);

  const info = await pos.obtenerInfoMoneda();
  expect(info.simboloActivo, `La moneda activa no cambió a "${hacia}"`).toBe(hacia);

  const precioDespues = await pos.obtenerPrecioVisibleProducto(PRODUCTO_NORMAL);
  expect(precioDespues, 'El precio visible del producto no se actualizó tras cambiar de moneda').not.toBe(precioAntes);
  expect(
    precioDespues.trim().startsWith(hacia),
    `El precio visible ("${precioDespues}") no corresponde al símbolo esperado ("${hacia}")`
  ).toBe(true);

  expect(errores, `Errores de JavaScript detectados: ${errores.join(' | ')}`).toEqual([]);
}

test('Abrir Historial de Facturas', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  let historial: Page;

  await test.step('Abrir POS y cerrar modales opcionales si aparecen', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
  });

  await test.step('Abrir el menú de tres puntos y seleccionar "Historial de Facturas"', async () => {
    await pos.abrirMenuTresPuntos();
    historial = await pos.abrirHistorialFacturas();
  });

  await test.step('Validar que la ventana de Historial de Facturas se abrió correctamente', async () => {
    await historial.waitForLoadState('domcontentloaded');
    expect(historial.url()).toContain('printPosReceip');
  });

  await test.step('Cerrar la ventana', async () => {
    await historial.close();
  });
});

test('Abrir Historial de Proformas', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  let proformas: Page;

  await test.step('Abrir POS', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
  });

  await test.step('Cerrar mensaje de consecutivo y modal de permisos si aparecen, antes de usar el menú de tres puntos', async () => {
    // Ambos son avisos opcionales del sistema: pueden aparecer o no, y en
    // ningún caso deben bloquear el resto del flujo.
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarModalNotificacionesSiAparece();
  });

  await test.step('Abrir el menú de tres puntos y seleccionar "Historial de Proformas"', async () => {
    await pos.abrirMenuTresPuntos();
    proformas = await pos.abrirHistorialProformas();
  });

  await test.step('Validar que la ventana de Historial de Proformas se abrió correctamente', async () => {
    await proformas.waitForLoadState('domcontentloaded');
    expect(proformas.url()).toContain('printPosProform');
  });

  await test.step('Cerrar la ventana', async () => {
    await proformas.close();
  });
});

test('Seleccionar una categoría', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
  });

  await test.step('Seleccionar la categoría "Combos"', async () => {
    await pos.categoriaCombos.click();
  });

  await test.step('Validar que la categoría quedó seleccionada', async () => {
    await esperarQuedaActivo(() => pos.categoriaEstaActiva(pos.categoriaCombos));
  });
});

test('Seleccionar los combos de la sección Categorías', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
  });

  // Los cinco tipos de categoría disponibles en la barra lateral. "Lista de
  // precios" queda fuera: el propio sistema la mantiene oculta (display: none)
  // para esta compañía, así que no es una opción real a probar.
  const combos: Array<{ nombre: string; obtenerLocator: () => Locator }> = [
    { nombre: 'TODOS', obtenerLocator: () => pos.categoriaTodos },
    { nombre: 'Combos', obtenerLocator: () => pos.categoriaCombos },
    { nombre: 'Categoría', obtenerLocator: () => pos.categoriaTipo },
    { nombre: 'Productos fraccionados', obtenerLocator: () => pos.categoriaProductosFraccionados },
    { nombre: 'Productos variantes', obtenerLocator: () => pos.categoriaProductosVariantes },
  ];

  for (const combo of combos) {
    await test.step(`Seleccionar "${combo.nombre}" y validar que cambió la información`, async () => {
      const item = combo.obtenerLocator();
      await item.click();
      await esperarQuedaActivo(() => pos.categoriaEstaActiva(item));
    });
  }
});

test('Cambiar entre modo Lista y modo Cuadrícula', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  let listaActivaAlInicio = false;

  await test.step('Abrir el POS', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
  });

  await test.step('Detectar cuál vista está activa actualmente, sin asumirla', async () => {
    const listaActiva = await pos.vistaEstaActiva(pos.botonVistaLista);
    const cuadriculaActiva = await pos.vistaEstaActiva(pos.botonVistaCuadricula);

    if (listaActiva) {
      listaActivaAlInicio = true;
    } else if (cuadriculaActiva) {
      listaActivaAlInicio = false;
    } else {
      // Ninguno de los dos botones fue interactuado todavía en esta sesión:
      // el sistema reporta el estilo inicial en un elemento oculto del DOM.
      listaActivaAlInicio = (await pos.estiloVistaTexto()) === 'list';
    }
  });

  await test.step('Cambiar a la vista contraria y validar el cambio', async () => {
    if (listaActivaAlInicio) {
      await pos.botonVistaCuadricula.click();
      await expect.poll(() => pos.vistaEstaActiva(pos.botonVistaCuadricula)).toBe(true);
      await expect.poll(() => pos.vistaEstaActiva(pos.botonVistaLista)).toBe(false);
    } else {
      await pos.botonVistaLista.click();
      await expect.poll(() => pos.vistaEstaActiva(pos.botonVistaLista)).toBe(true);
      await expect.poll(() => pos.vistaEstaActiva(pos.botonVistaCuadricula)).toBe(false);
    }
  });
});

test('Seleccionar el tab Servicios', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
  });

  await test.step('Seleccionar el tab "Servicios"', async () => {
    await pos.tabServicios.click();
  });

  await test.step('Validar que el tab "Servicios" quedó activo', async () => {
    await esperarQuedaActivo(() => pos.tabEstaActivo(pos.tabServicios));
  });
});

test('Seleccionar el tab End. Pintura', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
  });

  await test.step('Seleccionar el tab "End. Pintura"', async () => {
    await pos.tabPintura.click();
  });

  await test.step('Validar que el tab "End. Pintura" quedó activo', async () => {
    await esperarQuedaActivo(() => pos.tabEstaActivo(pos.tabPintura));
  });
});

test('Recorrer todas las pestañas del POS y validar que cada una carga correctamente', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard y cerrar overlays conocidos si aparecen', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
  });

  await test.step('Confirmar que el POS inicia en la pestaña "POS Facturación"', async () => {
    await expect(page.locator(PESTANA_POS_FACTURACION.selector)).toHaveClass(/btn_tab_active/);
  });

  for (const pestana of PESTANAS_POS_A_RECORRER) {
    await test.step(`Visitar pestaña "${pestana.etiqueta}"`, async () => {
      if (await pos.existePestanaPos(pestana.selector)) {
        await pos.visitarPestanaPos(pestana);
      } else {
        console.log(`[Recorrer pestañas POS] "${pestana.etiqueta}" (${pestana.selector}) no existe en este ambiente (permisos/configuración) — se omite`);
      }
    });
  }

  await test.step('Visitar pestaña "Apartados" (localizada dinámicamente, sin id fijo conocido)', async () => {
    const apartados = await pos.localizarPestanaApartados();
    if (apartados) {
      await pos.visitarPestanaPos(apartados);
    } else {
      console.log('[Recorrer pestañas POS] "Apartados" no existe en este ambiente (permisos/configuración) — se omite');
    }
  });

  await test.step('Volver a la pestaña "POS Facturación" y confirmar que quedó activa', async () => {
    await pos.visitarPestanaPos(PESTANA_POS_FACTURACION);
  });
});

// ─── Cambio de moneda ───────────────────────────────────────────────────────

test('Cambiar moneda a Colones', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  let monedaOriginal = '';

  await test.step('Abrir el POS y ubicar un producto real para comparar precios', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
    await pos.buscarProductoEnGrid(PRODUCTO_NORMAL);
    monedaOriginal = (await pos.obtenerInfoMoneda()).simboloActivo;
  });

  const errores = espiarErroresJS(page);

  await test.step('Partir de Dólares y cambiar a Colones, validando símbolo, precio y errores JS', async () => {
    await validarCambioDeMonedaYPrecio(pos, '$', '₡', errores);
  });

  await test.step('Restaurar la moneda original', async () => {
    await pos.cambiarMoneda(monedaOriginal);
  });
});

test('Cambiar moneda a Dólares (USD)', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  let monedaOriginal = '';

  await test.step('Abrir el POS y ubicar un producto real para comparar precios', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
    await pos.buscarProductoEnGrid(PRODUCTO_NORMAL);
    monedaOriginal = (await pos.obtenerInfoMoneda()).simboloActivo;
  });

  const errores = espiarErroresJS(page);

  await test.step('Partir de Colones y cambiar a Dólares, validando símbolo, precio y errores JS', async () => {
    await validarCambioDeMonedaYPrecio(pos, '₡', '$', errores);
  });

  await test.step('Restaurar la moneda original', async () => {
    await pos.cambiarMoneda(monedaOriginal);
  });
});

// ─── Vista Expandida / Vista Normal ─────────────────────────────────────────

test('Vista Expandida: buscar, agregar y facturar un producto desde el buscador interno, y volver a Vista Normal', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const errores = espiarErroresJS(page);
  let expandidaAlInicio = false;
  let codigoProducto = '';

  await test.step('Abrir el POS y limpiar cualquier estado residual del carrito', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
    if ((await pos.obtenerClavesProductos()).length > 0) {
      await pos.vaciarCarrito();
    }
  });

  await test.step('Detectar la vista actual sin asumirla', async () => {
    expandidaAlInicio = await pos.vistaExpandidaActiva();
  });

  await test.step('Asegurar Vista Normal para leer el código del producto desde la grilla (el buscador interno filtra por código, no por nombre)', async () => {
    if (await pos.vistaExpandidaActiva()) {
      await pos.alternarVistaExpandida();
    }
    await pos.buscarProductoEnGrid(PRODUCTO_NORMAL);
    codigoProducto = await pos.obtenerCodigoProducto(PRODUCTO_NORMAL);
  });

  await test.step('Cambiar a Vista Expandida y validar que el cambio ocurrió realmente', async () => {
    if (!(await pos.vistaExpandidaActiva())) {
      await pos.alternarVistaExpandida();
    }
    expect(await pos.vistaExpandidaActiva(), 'La vista no quedó en modo Expandida').toBe(true);
  });

  await test.step('Usar el buscador interno de Vista Expandida para localizar y agregar el producto', async () => {
    const clavesAntes = await pos.obtenerClavesProductos();
    await pos.agregarProductoPorCodigoEnVistaExpandida(codigoProducto);
    const clavesDespues = await pos.obtenerClavesProductos();
    expect(
      clavesDespues.length,
      'El producto no quedó agregado al carrito tras usar el buscador interno de Vista Expandida'
    ).toBeGreaterThan(clavesAntes.length);
  });

  await test.step('Facturar el producto', async () => {
    await abrirModalDePago(pos);
    await pos.seleccionarPagoExacto(METODO.TRANSACCION);
  });

  await test.step('Confirmar la factura y esperar la confirmación real', async () => {
    await confirmarPagoAbriendoCajaSiEsNecesario(pos, page);
  });

  await test.step('Validar que la factura se completó correctamente', async () => {
    await pos.validarCarritoVacio();
  });

  await test.step('Volver a la vista anterior y validar que revirtió correctamente', async () => {
    if ((await pos.vistaExpandidaActiva()) !== expandidaAlInicio) {
      await pos.alternarVistaExpandida();
    }
    expect(await pos.vistaExpandidaActiva(), 'La vista no volvió a su estado original').toBe(expandidaAlInicio);
  });

  expect(errores, `Errores de JavaScript detectados: ${errores.join(' | ')}`).toEqual([]);
});

// ─── Vaciar Carrito ──────────────────────────────────────────────────────────

test('Vaciar Carrito', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS y limpiar cualquier estado residual del carrito', async () => {
    await cargarPosYCerrarModalSiAparece(pos);
    if ((await pos.obtenerClavesProductos()).length > 0) {
      await pos.vaciarCarrito();
    }
  });

  const errores = espiarErroresJS(page);

  await test.step('Agregar varios productos al carrito', async () => {
    await pos.buscarProductoEnGrid(PRODUCTO_NORMAL);
    await pos.agregarProductoPorNombre(PRODUCTO_NORMAL);
    await pos.buscarProductoEnGrid(PRODUCTO_SECUNDARIO);
    await pos.agregarProductoPorNombre(PRODUCTO_SECUNDARIO);
  });

  await test.step('Validar que existen productos en el carrito', async () => {
    const claves = await pos.obtenerClavesProductos();
    expect(claves.length, 'No hay productos en el carrito antes de vaciarlo').toBeGreaterThan(0);
  });

  await test.step('Presionar "Vaciar Carrito" y confirmar la acción (SweetAlert)', async () => {
    await pos.vaciarCarrito();
  });

  await test.step('Validar que el carrito quedó completamente vacío: sin líneas y totales en cero', async () => {
    await pos.validarCarritoVacio();
    expect(
      await pos.obtenerTotalVisiblePosNumerico(),
      'El total visible del POS no volvió a cero tras vaciar el carrito'
    ).toBe(0);
  });

  await test.step('Validar el estado real del botón Facturar tras vaciar (confirmado en vivo: en este ambiente NO queda deshabilitado)', async () => {
    expect(await pos.facturarEstaDeshabilitado()).toBe(false);
  });

  expect(errores, `Errores de JavaScript detectados: ${errores.join(' | ')}`).toEqual([]);
});
