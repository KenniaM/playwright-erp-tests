import { test, expect, Locator, Page } from '@playwright/test';
import { PosPage, CAJA_TEXTO, TIMEOUTS, PESTANA_POS_FACTURACION, PESTANAS_POS_A_RECORRER } from './pos.page';

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
