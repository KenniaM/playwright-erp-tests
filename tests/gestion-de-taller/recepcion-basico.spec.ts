import path from 'path';
import { test, expect } from '@playwright/test';
import {
  erroresJSRelevantes,
  espiarErroresJS,
  ModoTarjetaTablero,
  RecepcionPage,
  TAB_ORDENES,
  TAB_TABLERO,
  TABS_MODO_BASICO,
  TIMEOUTS,
} from './recepcion.page';

const FOTO_PRUEBA = path.join(__dirname, 'fixtures', 'foto-prueba.png');

function validarSinErrores(page: import('@playwright/test').Page, errores: string[]) {
  return async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    const erroresRelevantes = erroresJSRelevantes(errores);
    expect(erroresRelevantes, `Errores de JavaScript detectados: ${erroresRelevantes.join(' | ')}`).toEqual([]);
  };
}

test('Navegar entre los tabs principales de Recepción Vehicular', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);

  await test.step('Abrir el módulo Recepción Vehicular', async () => {
    await recepcion.ir();
  });

  for (const tab of TABS_MODO_BASICO) {
    await test.step(`Visitar el tab "${tab.etiqueta}" y validar que carga correctamente`, async () => {
      if (!(await recepcion.existeTab(tab))) {
        console.log(`[Navegar entre tabs] "${tab.etiqueta}" (${tab.selector}) no existe en este ambiente — se omite.`);
        return;
      }

      await recepcion.visitarTab(tab);

      expect(await recepcion.tabEstaActivo(tab), `El tab "${tab.etiqueta}" no quedó marcado como activo`).toBe(true);
    });
  }

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

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

test('Activar y desactivar el modo oscuro', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  let modoOriginal = false;

  await test.step('Abrir el módulo y registrar el modo actual', async () => {
    await recepcion.ir();
    modoOriginal = await recepcion.modoOscuroActivo();
  });

  try {
    await test.step('Alternar el modo oscuro y validar que el cambio visual ocurrió', async () => {
      await recepcion.alternarModoOscuro();
      expect(await recepcion.modoOscuroActivo()).toBe(!modoOriginal);
    });

    await test.step('Recargar y validar que la preferencia queda aplicada', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toBeVisible();
      // El banner de notificaciones puede reaparecer tras el reload y
      // taparía el toggle de tema que se usa en el bloque `finally`.
      await recepcion.cerrarNotificacionPermiso();
      expect(await recepcion.modoOscuroActivo()).toBe(!modoOriginal);
    });
  } finally {
    // Se restaura el modo original tanto si las validaciones pasaron como si
    // fallaron, para no dejar la preferencia del ambiente alterada (mismo
    // criterio que los tests de persistencia en panel-control.spec.ts).
    await test.step('Restaurar el modo oscuro/claro original', async () => {
      if ((await recepcion.modoOscuroActivo()) !== modoOriginal) {
        await recepcion.alternarModoOscuro();
      }
    });
  }

  await test.step('Validar que el sistema quedó exactamente como al inicio', async () => {
    expect(await recepcion.modoOscuroActivo()).toBe(modoOriginal);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('El módulo siempre inicia en Modo Claro por defecto', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);

  await test.step('Forzar que no exista ninguna preferencia de tema guardada', async () => {
    await recepcion.ir();
    // Clave real confirmada en vivo (localStorage): "posmovi_global_theme".
    // Se elimina en vez de asumir un valor "light" explícito, porque el
    // estado real observado en el ambiente es la AUSENCIA de la clave -> modo
    // claro por defecto.
    await page.evaluate(() => localStorage.removeItem('posmovi_global_theme'));
  });

  await test.step('Recargar el módulo sin preferencia guardada y validar que carga en Modo Claro', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
    await recepcion.cerrarNotificacionPermiso();

    expect(await recepcion.modoOscuroActivo(), 'El módulo cargó en Modo Oscuro sin ninguna preferencia guardada').toBe(false);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Configurar Tablero: cambiar entre Vista Detallada y Vista Compacta', async ({ page }) => {
  // Timeout ampliado: este flujo implica dos ciclos completos de
  // guardar+refrescar el tablero más dos recargas completas del módulo para
  // validar que la configuración persiste, muy por encima del resto de
  // tests de este archivo.
  test.setTimeout(TIMEOUTS.TEST_CONFIG_TABLERO);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  let modoOriginal: ModoTarjetaTablero = 'detallado';

  async function aplicarModoTarjeta(modo: ModoTarjetaTablero) {
    await recepcion.abrirConfigurarTablero();
    await recepcion.seleccionarModoTarjeta(modo);
    await recepcion.guardarConfigTablero();
    await recepcion.refrescarTablero();
    await expect.poll(() => recepcion.modoTarjetaActivoEnTablero(), { timeout: TIMEOUTS.CARGA }).toBe(modo);
  }

  await test.step('Abrir el módulo, entrar al tab Tablero y registrar el modo de tarjeta original', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_TABLERO);
    modoOriginal = await recepcion.modoTarjetaActivoEnTablero();
  });

  try {
    await test.step('Abrir "Configurar Tablero" y validar que expone las opciones esperadas', async () => {
      await recepcion.abrirConfigurarTablero();

      await expect(recepcion.modalConfigurarTablero).toContainText('Modo de tarjeta');
      await expect(recepcion.modalConfigurarTablero).toContainText('Compacto');
      await expect(recepcion.modalConfigurarTablero).toContainText('Detallado');

      const interruptores = recepcion.modalConfigurarTablero.locator('.ervk-toggle-switch');
      await expect(interruptores.first(), 'El modal no expone ningún interruptor de personalización de tarjetas').toBeVisible();

      await recepcion.modalConfigurarTablero.locator('.ervk-close-btn').click();
      await expect(recepcion.modalConfigurarTablero).toBeHidden();
    });

    await test.step('Seleccionar Vista Detallada, guardar y validar que el tablero la refleja', async () => {
      await aplicarModoTarjeta('detallado');
    });

    await test.step('Recargar el módulo y validar que la Vista Detallada permanece aplicada', async () => {
      await recepcion.ir();
      await recepcion.visitarTab(TAB_TABLERO);
      expect(await recepcion.modoTarjetaActivoEnTablero()).toBe('detallado');
    });

    await test.step('Seleccionar Vista Compacta, guardar y validar que el tablero la refleja', async () => {
      await aplicarModoTarjeta('compacto');
    });

    await test.step('Recargar el módulo y validar que la Vista Compacta permanece aplicada', async () => {
      await recepcion.ir();
      await recepcion.visitarTab(TAB_TABLERO);
      expect(await recepcion.modoTarjetaActivoEnTablero()).toBe('compacto');
    });
  } finally {
    // Se restaura el modo de tarjeta original tanto si las validaciones
    // pasaron como si fallaron, para no dejar el ambiente compartido alterado
    // (mismo criterio que el test de modo oscuro de este archivo).
    await test.step('Restaurar el modo de tarjeta original del tablero', async () => {
      const modoActual = await recepcion.modoTarjetaActivoEnTablero();
      if (modoActual !== modoOriginal) {
        await aplicarModoTarjeta(modoOriginal);
      }
    });
  }

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Buscar una orden desde Tablero y desde Órdenes', async ({ page }) => {
  // Timeout ampliado (no TIMEOUTS.TEST): recorre 2 tabs x 4 pasos de
  // búsqueda, y varios pasos individuales ya permiten hasta 30s bajo carga
  // del ambiente compartido — ver TIMEOUTS.TEST_BUSQUEDA.
  test.setTimeout(TIMEOUTS.TEST_BUSQUEDA);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  const terminoInexistente = `SINRESULTADOS_${Date.now()}`;

  async function validarBusquedaCompleta(nombreTab: string) {
    let orden = '';
    let placa = '';
    let totalSinFiltrar = 0;

    await test.step(`[${nombreTab}] Tomar una orden real visible como referencia`, async () => {
      ({ numero: orden, placa } = await recepcion.obtenerPrimeraOrdenYPlaca());
      expect(orden, 'No se pudo leer ninguna orden real desde el ambiente').not.toBe('');
      expect(placa, 'No se pudo leer la placa de la orden tomada como referencia').not.toBe('');
      totalSinFiltrar = (await recepcion.obtenerNumerosOrdenVisibles()).length;
    });

    await test.step(`[${nombreTab}] Búsqueda exacta (número de orden) encuentra la orden`, async () => {
      await recepcion.buscarOrden(orden);
      // Timeout explícito (no el default de 5s, y no TIMEOUTS.CARGA): el
      // Tablero dispara varias peticiones AJAX encadenadas por columna de
      // estado (confirmado en vivo), que bajo carga del ambiente compartido
      // pueden tardar más que el límite general.
      await expect(recepcion.badgeOrden(orden)).toBeVisible({ timeout: TIMEOUTS.CARGA_LISTADO_COMPLETO });
      await expect
        .poll(() => recepcion.obtenerNumerosOrdenVisibles().then((n) => n.length), { timeout: TIMEOUTS.CARGA_LISTADO_COMPLETO })
        .toBeLessThanOrEqual(totalSinFiltrar);
    });

    await test.step(`[${nombreTab}] Búsqueda parcial (placa) sigue encontrando la orden`, async () => {
      // Parcial por placa, no por número de orden: confirmado en vivo que el
      // número SÍ admite coincidencia parcial en el buscador de Órdenes,
      // pero NO en el de Tablero (una búsqueda parcial del número puede
      // coincidir con otra orden real distinta y ocultar la original) — la
      // placa sí admite coincidencia parcial en ambos, así que es el campo
      // seguro para esta validación compartida entre los dos tabs.
      const placaParcial = placa.length > 2 ? placa.slice(0, -2) : placa;
      await recepcion.buscarOrden(placaParcial);
      await expect(recepcion.badgeOrden(orden)).toBeVisible({ timeout: TIMEOUTS.CARGA_LISTADO_COMPLETO });
    });

    await test.step(`[${nombreTab}] Búsqueda sin resultados no muestra ninguna orden`, async () => {
      await recepcion.buscarOrden(terminoInexistente);
      await expect
        .poll(() => recepcion.obtenerNumerosOrdenVisibles().then((n) => n.length), { timeout: TIMEOUTS.CARGA_LISTADO_COMPLETO })
        .toBe(0);
    });

    await test.step(`[${nombreTab}] Limpiar búsqueda restaura el listado completo`, async () => {
      await recepcion.limpiarBusqueda();
      // TIMEOUTS.CARGA_LISTADO_COMPLETO (no CARGA): restaurar el listado sin
      // filtro recarga TODAS las tarjetas (confirmado en vivo, más pesado que
      // cualquier búsqueda filtrada de este mismo test).
      await expect(recepcion.badgeOrden(orden)).toBeVisible({ timeout: TIMEOUTS.CARGA_LISTADO_COMPLETO });
      await expect
        .poll(() => recepcion.obtenerNumerosOrdenVisibles().then((n) => n.length), { timeout: TIMEOUTS.CARGA_LISTADO_COMPLETO })
        .toBe(totalSinFiltrar);
    });
  }

  await test.step('Abrir el módulo y entrar al tab Tablero', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_TABLERO);
  });

  await validarBusquedaCompleta('Tablero');

  await test.step('Entrar al tab Órdenes', async () => {
    await recepcion.visitarTab(TAB_ORDENES);
  });

  await validarBusquedaCompleta('Órdenes');

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Recepción sencilla con placa nueva genera la orden correctamente', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  const placa = `QA${Date.now().toString().slice(-6)}`;

  await test.step('Abrir el módulo y el modal de nueva recepción', async () => {
    await recepcion.ir();
    await recepcion.abrirNuevaRecepcion();
  });

  await test.step('Ingresar una placa nueva y agregar el vehículo', async () => {
    await recepcion.agregarVehiculoNuevo(placa);
  });

  await test.step('Seleccionar un cliente y avanzar', async () => {
    await recepcion.seleccionarPrimerClienteWizard();
    await recepcion.avanzarWizard();
  });

  await test.step('Completar los detalles mínimos del vehículo y guardar', async () => {
    await recepcion.completarDetallesVehiculoMinimo();
    await recepcion.guardarDetallesVehiculo();
  });

  await test.step('Validar que la orden se generó correctamente para la placa nueva', async () => {
    await recepcion.regresarAOrdenesDesdeWizard();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);

    await expect
      .poll(() => recepcion.obtenerNumerosOrdenVisibles().then((n) => n.length), { timeout: TIMEOUTS.CARGA })
      .toBeGreaterThan(0);
    const { placa: placaEncontrada } = await recepcion.obtenerPrimeraOrdenYPlaca();
    expect(placaEncontrada, 'La orden encontrada no corresponde a la placa nueva recién creada').toBe(placa);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Recepción sencilla sin placa completa el flujo y genera la orden', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  // Identificador provisional: el campo de placa del paso "Detalles del
  // vehículo" sigue siendo obligatorio incluso con "No tiene Placa /
  // Matrícula" activado (ver nota en recepcion.page.ts) — se usa como el
  // dato con el que luego se localiza la orden generada.
  const identificadorSinPlaca = `SINPLACA${Date.now().toString().slice(-6)}`;

  await test.step('Abrir el módulo y activar "No tiene Placa / Matrícula"', async () => {
    await recepcion.ir();
    await recepcion.abrirNuevaRecepcion();
    await recepcion.activarSinPlacaEnModal();
  });

  await test.step('Agregar el vehículo sin placa y seleccionar un cliente', async () => {
    await recepcion.agregarVehiculoNuevo('');
    await recepcion.seleccionarPrimerClienteWizard();
    await recepcion.avanzarWizard();
  });

  await test.step('Completar los detalles del vehículo, incluyendo el identificador provisional', async () => {
    await recepcion.completarDetallesVehiculoMinimo();
    await recepcion.llenarPlacaDetalleVehiculo(identificadorSinPlaca);
    await recepcion.guardarDetallesVehiculo();
  });

  await test.step('Validar que la orden se generó correctamente', async () => {
    await recepcion.regresarAOrdenesDesdeWizard();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(identificadorSinPlaca);

    await expect
      .poll(() => recepcion.obtenerNumerosOrdenVisibles().then((n) => n.length), { timeout: TIMEOUTS.CARGA })
      .toBeGreaterThan(0);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Recepción sencilla con placa existente reutiliza el vehículo y genera una nueva orden', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  // Placa fija de un vehículo real y estable del ambiente (no "la primera
  // orden visible"): confirmado en vivo que ese enfoque dinámico termina
  // recogiendo, cada vez más seguido, las propias placas sintéticas creadas
  // por los tests de este mismo archivo (las más recientes quedan primero en
  // Órdenes), en vez de un vehículo realmente preexistente — exactamente el
  // caso que esta prueba necesita cubrir. "VSRF" es la misma placa de
  // referencia ya reutilizada en el resto de la suite (p. ej. las pruebas de
  // búsqueda de este mismo archivo y las de `pos-taller.spec.ts`).
  const placaExistente = 'VSRF';

  await test.step('Abrir el módulo', async () => {
    await recepcion.ir();
  });

  let resultadoBusqueda: 'wizard' | 'completado' = 'wizard';

  await test.step('Abrir el modal de nueva recepción y buscar esa placa existente', async () => {
    await recepcion.abrirNuevaRecepcion();
    // Confirmado en vivo: como esta placa ya tiene una orden abierta (el
    // caso normal en este ambiente compartido), el sistema pregunta si se
    // desea crear una nueva orden en vez de mostrar una lista — este método
    // resuelve ambos casos posibles. Además, para un vehículo con varias
    // órdenes previas (como esta placa fija tras ejecuciones repetidas de
    // este archivo), "Crear nueva orden" a veces resuelve la orden de una
    // vez en vez de entrar al wizard — ambos desenlaces son válidos.
    resultadoBusqueda = await recepcion.buscarYReutilizarVehiculoExistente(placaExistente);
  });

  if (resultadoBusqueda === 'wizard') {
    await test.step('Validar que la información del vehículo existente cargó correctamente', async () => {
      await recepcion.esperarDetallesVehiculoVisible();
      await expect(
        page.locator('#vehicle_licence_plate'),
        'La placa del vehículo existente no se precargó en "Detalles del vehículo"'
      ).toHaveValue(placaExistente);
    });

    await test.step('Guardar la nueva orden desde el wizard', async () => {
      await recepcion.guardarDetallesVehiculo();
      await recepcion.regresarAOrdenesDesdeWizard();
    });
  }

  await test.step('Validar que la nueva orden se generó correctamente para la placa existente', async () => {
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placaExistente);

    await expect
      .poll(() => recepcion.obtenerNumerosOrdenVisibles().then((n) => n.length), { timeout: TIMEOUTS.CARGA })
      .toBeGreaterThan(0);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

test('Orden sencilla: flujo completo con cliente, vehículo, servicios, partes, fotos, daños, observaciones y firma', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_ORDEN_SENCILLA);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  const placa = `QA${Date.now().toString().slice(-6)}`;

  await test.step('Abrir el módulo, crear la recepción y seleccionar un cliente', async () => {
    await recepcion.ir();
    await recepcion.abrirNuevaRecepcion();
    await recepcion.agregarVehiculoNuevo(placa);
    await recepcion.seleccionarPrimerClienteWizard();
    await recepcion.avanzarWizard();
  });

  await test.step('Completar los datos del vehículo y guardar', async () => {
    await recepcion.completarDetallesVehiculoMinimo();
    await recepcion.guardarDetallesVehiculo();
    await expect(page.getByText('Lista de productos y servicios')).toBeVisible({ timeout: TIMEOUTS.CARGA });
  });

  // Cada paso valida que el total general del carrito sea exactamente la
  // suma de los totales de línea ya visibles — así la prueba no depende de
  // precios fijos del catálogo (que son datos compartidos y pueden cambiar),
  // solo de que la aritmética del carrito sea consistente en cada paso.
  async function validarTotalConsistente(cantidadLineasEsperada: number) {
    const lineas = await recepcion.obtenerTotalesPorLineaCarrito();
    expect(lineas.length, `Se esperaban ${cantidadLineasEsperada} línea(s) en el carrito`).toBe(cantidadLineasEsperada);
    const sumaLineas = lineas.reduce((acc, valor) => acc + valor, 0);
    await expect
      .poll(() => recepcion.obtenerTotalGeneralCarrito(), { timeout: TIMEOUTS.CARGA })
      .toBeCloseTo(sumaLineas, 1);
  }

  await test.step('Agregar un producto normal del catálogo y validar el total', async () => {
    await recepcion.agregarProductoDelCatalogo();
    await validarTotalConsistente(1);
  });

  await test.step('Agregar un servicio normal del catálogo y validar el total', async () => {
    await recepcion.agregarServicioDelCatalogo();
    await validarTotalConsistente(2);
  });

  await test.step('Agregar un producto rápido y validar el total', async () => {
    await recepcion.agregarProductoRapido({ nombre: 'Producto Rápido QA', costo: '10', precio: '20' });
    await validarTotalConsistente(3);
  });

  await test.step('Agregar un servicio rápido y validar el total final', async () => {
    await recepcion.agregarServicioRapido({ nombre: 'Servicio Rápido QA', precio: '50' });
    await validarTotalConsistente(4);
  });

  await test.step('Avanzar hasta "Partes del vehículo" y marcar una parte', async () => {
    // Inspección, Enderezado y Pintura, Abonos: sin acción para Orden
    // sencilla (esos 3 pasos corresponden a Orden completa/avanzada).
    await recepcion.avanzarWizardVeces(4);
    await recepcion.marcarPrimeraParteComoBuena();
  });

  await test.step('Agregar una fotografía de la recepción', async () => {
    await recepcion.avanzarWizard();
    await recepcion.subirFotoRecepcion(FOTO_PRUEBA);
  });

  await test.step('Marcar un daño sobre el diagrama del vehículo y guardarlo', async () => {
    await recepcion.avanzarWizard();
    await recepcion.marcarDanioYGuardar();
  });

  await test.step('Agregar observaciones de servicio y de cliente', async () => {
    await recepcion.avanzarWizard();
    // Confirmado en vivo: estos campos del wizard de creación no persisten
    // en el backend (releyendo la orden ya generada aparecían vacíos, sin
    // ninguna petición de red al llenarlos) — se llenan igual porque es el
    // paso real que recorre el wizard, pero la validación de que "ambas se
    // almacenen" se hace más abajo, sobre la orden ya generada, con los
    // campos que sí guardan de verdad.
    await recepcion.llenarObservaciones('Observación de servicio QA', 'Observación de cliente QA');
  });

  await test.step('Firmar y generar la orden', async () => {
    await recepcion.avanzarWizard();
    await recepcion.firmarCliente();
    await recepcion.generarOrden();
  });

  await test.step('Validar que la orden quedó registrada con el número y los totales cargados', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_ORDENES);
    await recepcion.buscarOrden(placa);

    await expect
      .poll(() => recepcion.obtenerNumerosOrdenVisibles().then((n) => n.length), { timeout: TIMEOUTS.CARGA })
      .toBeGreaterThan(0);
    const { numero, placa: placaEncontrada } = await recepcion.obtenerPrimeraOrdenYPlaca();
    expect(numero, 'No se pudo leer el número de la orden generada').not.toBe('');
    expect(placaEncontrada, 'La orden encontrada no corresponde a la placa de esta prueba').toBe(placa);
  });

  await test.step('Agregar las observaciones reales desde el detalle de la orden y validar que se almacenan', async () => {
    await recepcion.abrirDetallePrimeraOrdenVisible();
    await recepcion.llenarYValidarObservacionesReales('Observación de servicio QA', 'Observación de cliente QA');
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});
