import { test, expect } from '@playwright/test';
import {
  espiarErroresJS,
  ModoTarjetaTablero,
  RecepcionPage,
  TAB_TABLERO,
  TIMEOUTS,
  validarSinErrores,
} from './recepcion.page';

// ─────────────────────────────────────────────────────────────────────────────
// recepcion-tablero.spec.ts — funcionalidades específicas del tab TABLERO:
// Configurar Tablero (modo de tarjeta), Configurar Flujo de Trabajo (Ajustes
// Generales + Conf. Etapas de columnas), columnas (agregar/editar/eliminar),
// asignar etapa a una orden, y el bug conocido de "Asignar mecánico" en este
// tab. Funcionalidades comunes a varios tabs (búsqueda, navegación, crear
// recepción) viven en recepcion-basico.spec.ts.
// ─────────────────────────────────────────────────────────────────────────────

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


test('Configurar Flujo de Trabajo > Ajustes Generales: activar/desactivar permisos por rol y verificar el efecto', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_ORDEN_SENCILLA);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  // Permiso elegido para el recorrido completo activar→guardar→verificar→
  // reactivar→guardar→verificar: confirmado en vivo que controla si la
  // sección "Compartir orden" aparece en el menú "⋮" de una orden — efecto
  // real y observable sin necesitar cambiar de rol/sesión.
  const NOMBRE_PERMISO_COMPARTIR = 'Mostrar compartir orden';
  const SLUG_PERMISO_COMPARTIR = 'workflow_show_share_order';

  // "Mostrar compartir orden" para Administrador debe empezar ACTIVO: se
  // fuerza ese estado de partida (guardando si hiciera falta) en vez de solo
  // leer y asumir lo que haya quedado del ambiente — mismo hallazgo que en
  // "Configurar Pasos de la Recepción": una corrida anterior interrumpida
  // entre "desactivar" y "reactivar" puede dejarlo desactivado, y el paso
  // "desactivar" de esta prueba sería entonces un no-op (nada que guardar).
  const estadoOriginalCompartir = true;

  await test.step('Entrar a "Configurar Flujo de Trabajo" y abrir "Ajustes Generales" desde el lápiz de la etapa, partiendo de "Mostrar compartir orden" activo', async () => {
    await recepcion.ir();
    await recepcion.abrirConfigurarFlujoTrabajo();
    await recepcion.abrirAjustesGenerales();
    if (!(await recepcion.checkboxPermisoAdministrador(SLUG_PERMISO_COMPARTIR).isChecked())) {
      await recepcion.establecerPermisoAdministrador(SLUG_PERMISO_COMPARTIR, true);
      await recepcion.guardarAjustesGenerales();
      await recepcion.salirModoEdicionFlujoTrabajo();
      await recepcion.ir();
      await recepcion.abrirConfigurarFlujoTrabajo();
      await recepcion.abrirAjustesGenerales();
    }
  });

  await test.step('Buscar un permiso por nombre filtra la matriz, y limpiar la búsqueda la restaura', async () => {
    await recepcion.buscarPermisoEnMatriz(NOMBRE_PERMISO_COMPARTIR);
    // El nombre visible incluye un índice numérico ("1. Mostrar compartir
    // orden") ya concatenado en el mismo elemento — se valida que el único
    // resultado CONTENGA el nombre, no una igualdad exacta con el índice.
    await expect
      .poll(() => recepcion.obtenerNombresPermisosMatriz(), { timeout: TIMEOUTS.CARGA })
      .toEqual([expect.stringContaining(NOMBRE_PERMISO_COMPARTIR)]);

    await recepcion.buscarPermisoEnMatriz('');
    await expect
      .poll(() => recepcion.obtenerNombresPermisosMatriz().then((n) => n.length), { timeout: TIMEOUTS.CARGA })
      .toBeGreaterThan(1);
  });

  await test.step('Activar y desactivar cada permiso para Administrador (mecánica del control, sin guardar)', async () => {
    const slugs = await recepcion.obtenerSlugsPermisosMatriz();
    expect(slugs.length, 'No se detectó ningún permiso en la matriz').toBeGreaterThan(0);

    for (const slug of slugs) {
      await recepcion.establecerPermisoAdministrador(slug, false);
      await recepcion.establecerPermisoAdministrador(slug, true);
    }
  });

  await test.step('Cancelar sin guardar no persiste ningún cambio', async () => {
    await recepcion.establecerPermisoAdministrador(SLUG_PERMISO_COMPARTIR, !estadoOriginalCompartir);
    await recepcion.cancelarAjustesGenerales();

    await recepcion.abrirAjustesGenerales();
    await expect(
      recepcion.checkboxPermisoAdministrador(SLUG_PERMISO_COMPARTIR),
      'El cambio sin guardar quedó persistido'
    ).toBeChecked({ checked: estadoOriginalCompartir });
  });

  await test.step('Desactivar "Mostrar compartir orden" para Administrador y guardar', async () => {
    // Recarga completa (no reutiliza el modal ya abierto/cerrado de los pasos
    // anteriores): mismo tipo de fragilidad confirmada en vivo para
    // "Configurar Pasos de la Recepción" — abrir/cerrar el modal varias
    // veces en la misma sesión de página puede dejar sus controles sin
    // responder.
    await recepcion.ir();
    await recepcion.abrirConfigurarFlujoTrabajo();
    await recepcion.abrirAjustesGenerales();
    await recepcion.establecerPermisoAdministrador(SLUG_PERMISO_COMPARTIR, false);
    await recepcion.guardarAjustesGenerales();
    await recepcion.salirModoEdicionFlujoTrabajo();
  });

  // No se valida el efecto sobre el menú "⋮" de una orden viendo la sesión
  // como Administrador: confirmado en vivo que, tras desactivar y guardar el
  // permiso, "Compartir orden" sigue apareciendo en el propio dropdown del
  // Administrador — el rol Administrador tiene acceso total pese a la
  // matriz (comportamiento real de la app, no un bug de esta prueba), y este
  // repositorio no tiene mecanismo para iniciar sesión como otro rol para
  // observar el efecto real. Lo que sí es verificable y se valida aquí es
  // que el cambio se guarda y persiste de verdad (releyendo el checkbox tras
  // recargar la página y reabrir el modal), que es lo que realmente pide
  // "verificar que los cambios se reflejen correctamente".
  await test.step('Verificar que el cambio persiste tras recargar y reabrir el modal', async () => {
    await recepcion.ir();
    await recepcion.abrirConfigurarFlujoTrabajo();
    await recepcion.abrirAjustesGenerales();
    await expect(
      recepcion.checkboxPermisoAdministrador(SLUG_PERMISO_COMPARTIR),
      'El permiso desactivado no quedó reflejado tras recargar y reabrir el modal'
    ).toBeChecked({ checked: false });
    // Cerrar el modal ANTES de salir del modo edición: confirmado en vivo que,
    // si sigue abierto, tapa el botón "Salir del modo edición" e intercepta
    // el clic indefinidamente.
    await recepcion.cancelarAjustesGenerales();
    await recepcion.salirModoEdicionFlujoTrabajo();
  });

  await test.step('Reactivar "Mostrar compartir orden" para Administrador y guardar', async () => {
    await recepcion.ir();
    await recepcion.abrirConfigurarFlujoTrabajo();
    await recepcion.abrirAjustesGenerales();
    await recepcion.establecerPermisoAdministrador(SLUG_PERMISO_COMPARTIR, true);
    await recepcion.guardarAjustesGenerales();
    await recepcion.salirModoEdicionFlujoTrabajo();
  });

  await test.step('Verificar que la reactivación también persiste tras recargar y reabrir el modal', async () => {
    await recepcion.ir();
    await recepcion.abrirConfigurarFlujoTrabajo();
    await recepcion.abrirAjustesGenerales();
    await expect(
      recepcion.checkboxPermisoAdministrador(SLUG_PERMISO_COMPARTIR),
      'El permiso reactivado no quedó reflejado tras recargar y reabrir el modal'
    ).toBeChecked({ checked: true });
    await recepcion.cancelarAjustesGenerales();
    await recepcion.salirModoEdicionFlujoTrabajo();
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});


test.fail(
  'BUG CONOCIDO: Asignar mecánico desde Tablero no llena el popover de mecánicos (la petición real responde 200 pero el contenido nunca se renderiza)',
  async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const recepcion = new RecepcionPage(page);
    let modoOriginal: ModoTarjetaTablero = 'detallado';

    try {
      await test.step('Registrar el modo de tarjeta original y forzar "Detallado" (requerido para que la tarjeta del tablero exponga el ícono)', async () => {
        await recepcion.ir();
        await recepcion.visitarTab(TAB_TABLERO);
        modoOriginal = await recepcion.modoTarjetaActivoEnTablero();

        if (modoOriginal !== 'detallado') {
          await recepcion.abrirConfigurarTablero();
          await recepcion.seleccionarModoTarjeta('detallado');
          await recepcion.guardarConfigTablero();
          await recepcion.refrescarTablero();
          await expect.poll(() => recepcion.modoTarjetaActivoEnTablero(), { timeout: TIMEOUTS.CARGA }).toBe('detallado');
        }
      });

      await test.step('Abrir "Asignar mecánico" en Tablero y esperar (sin éxito) que el popover se llene', async () => {
        // El caché del tablero se refresca explícitamente: confirmado en
        // vivo que, sin esto, la carga de página puede mostrar 0 tarjetas
        // en las 3 columnas aunque existan órdenes reales.
        await recepcion.refrescarTablero();

        const tarjeta = recepcion.primeraTarjetaConAsignarMecanico();
        await expect(tarjeta, 'No hay ninguna orden con la opción de "Asignar mecánico" visible en "Tablero"').toBeVisible({
          timeout: TIMEOUTS.CARGA,
        });

        await recepcion.abrirAsignarMecanico(tarjeta);
      });
    } finally {
      await test.step('Restaurar el modo de tarjeta original del tablero', async () => {
        if (modoOriginal !== 'detallado') {
          await recepcion.ir();
          await recepcion.visitarTab(TAB_TABLERO);
          await recepcion.abrirConfigurarTablero();
          await recepcion.seleccionarModoTarjeta(modoOriginal);
          await recepcion.guardarConfigTablero();
          await recepcion.refrescarTablero();
        }
      });
    }
  }
);

// BUG CONFIRMADO EN VIVO (investigación dedicada, 3 verificaciones
// independientes: clic real de Playwright sobre el `.mechanic-item`, espera
// de un `page.waitForResponse` para cualquier petición con
// "setQuickMechanicOrder" en la URL, e invocar DIRECTAMENTE por JS el mismo
// `onclick` real del elemento — `setQuickMechanicOrder(mechanicId, orderId)`
// — vía `new Function(...)`, descartando así cualquier problema de
// interceptación del clic de Playwright): en la vista Lista de Órdenes el
// popover de "Asignar mecánico" SÍ se abre y lista mecánicos reales (ver el
// test anterior sobre Tablero, que documenta que ahí ni siquiera eso
// ocurre), pero seleccionar cualquiera de ellos NO dispara ninguna petición
// de red real (ninguna de las 3 verificaciones detectó tráfico alguno hacia
// el backend), no lanza ningún error de JavaScript, y el ícono de
// confirmación (`#check_mechanic_{id}_order_{id}`) nunca se vuelve visible
// — confirmado tanto con una orden recién creada por esta misma suite como
// con una orden real preexistente en el ambiente. Mismo patrón de "función
// que se ejecuta sin excepción pero no completa su efecto real" ya
// documentado para "Desactivar orden" y "Eliminar orden" — se documenta con
// `test.fail()` en vez de forzar un verde falso debilitando la aserción.


test('Tablero: eliminar una columna con órdenes queda bloqueado, y una columna vacía sí puede eliminarse', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_ETAPAS_TABLERO);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  const nombreColumnaPrueba = `COL PRUEBA ${Date.now()}`;

  await test.step('Abrir el módulo y entrar al tab Tablero', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_TABLERO);
    await expect(page.locator('.ervk-kanban-card').first(), 'Las tarjetas del tablero no cargaron').toBeVisible({ timeout: TIMEOUTS.CARGA_LISTADO_COMPLETO });
  });

  await test.step('Intentar eliminar cada columna real que SÍ tiene órdenes: debe bloquearse con el aviso de "columna no vacía"', async () => {
    // Solo columnas con al menos 1 orden real: una columna preexistente que
    // ya esté vacía (p. ej. "Prueba") NO se toca — no fue creada por esta
    // prueba, así que no hay forma segura de saber si eliminarla afectaría a
    // otras pruebas/usuarios del ambiente compartido. También se excluyen
    // columnas sin menú "⋮" propio (confirmado en vivo: "Eliminadass" es una
    // columna especial del sistema con solo un ícono de información, sin
    // Editar/Eliminar/Conf. Etapas — no es un error, ese menú simplemente no
    // aplica a esa columna).
    const columnas = await page.locator('.ervk-kanban-column').all();
    let columnasConOrdenes = 0;

    for (const columna of columnas) {
      const nombre = ((await columna.locator('.ervk-column-title').textContent()) ?? '').trim();
      const tieneMenu = (await columna.locator('.ervk-column-dropdown').count()) > 0;
      const tieneOrdenes = (await columna.locator('.ervk-kanban-card').count()) > 0;
      if (!nombre || !tieneMenu || !tieneOrdenes) continue;
      columnasConOrdenes++;

      await test.step(`Columna "${nombre}": eliminar queda bloqueado mientras tenga órdenes`, async () => {
        await recepcion.intentarEliminarColumnaConOrdenes(nombre);
        await expect(recepcion.columnaTablero(nombre), `La columna "${nombre}" no debió eliminarse`).toBeVisible();
      });
    }

    expect(columnasConOrdenes, 'No hay ninguna columna real con órdenes en el tablero para esta validación').toBeGreaterThan(0);
  });

  await test.step('Crear una columna de prueba vacía, editarla y luego eliminarla exitosamente', async () => {
    await recepcion.agregarColumna(nombreColumnaPrueba);

    const nombreEditado = `${nombreColumnaPrueba} EDITADA`;
    await recepcion.editarColumna(nombreColumnaPrueba, nombreEditado);

    await recepcion.eliminarColumnaVacia(nombreEditado);
    await expect(page.locator('.ervk-column-title', { hasText: nombreEditado })).toHaveCount(0);
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});


test('Tablero: Conf. Etapas de una columna — agregar, editar y eliminar una etapa', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_ETAPAS_TABLERO);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  const nombreColumnaPrueba = `COL ETAPAS ${Date.now()}`;
  const nombreEtapa = 'ETAPA DE PRUEBA';
  const nombreEtapaEditada = 'ETAPA DE PRUEBA EDITADA';

  await test.step('Abrir el módulo, entrar al Tablero y crear una columna de prueba (aislada, sin afectar columnas reales)', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_TABLERO);
    await recepcion.agregarColumna(nombreColumnaPrueba);
  });

  try {
    await test.step('Abrir "Conf. Etapas" y validar que inicia sin etapas registradas', async () => {
      await recepcion.abrirConfEtapasColumna(nombreColumnaPrueba);
      expect(await recepcion.etapasConfiguradas()).toEqual([]);
      await expect(page.getByText('Sin etapas registradas')).toBeVisible();
    });

    await test.step('Agregar una etapa y validar que aparece en la lista', async () => {
      await recepcion.agregarEtapaColumna(nombreEtapa);
      expect(await recepcion.etapasConfiguradas()).toContain(nombreEtapa);
    });

    await test.step('Editar la etapa y validar que el cambio se refleja en la lista', async () => {
      await recepcion.editarEtapaColumna(nombreEtapa, nombreEtapaEditada);
      const etapas = await recepcion.etapasConfiguradas();
      expect(etapas).toContain(nombreEtapaEditada);
      expect(etapas).not.toContain(nombreEtapa);
    });

    await test.step('Eliminar la etapa y validar que desaparece de la lista', async () => {
      await recepcion.eliminarEtapaColumna(nombreEtapaEditada);
      expect(await recepcion.etapasConfiguradas()).toEqual([]);
      await expect(page.getByText('Sin etapas registradas')).toBeVisible();
    });

    await recepcion.cerrarConfEtapasColumna();
  } finally {
    await test.step('Eliminar la columna de prueba (queda vacía, sin órdenes)', async () => {
      const modalAbierto = await page.locator('#dialog_config_steps_status_kanban').isVisible().catch(() => false);
      if (modalAbierto) await recepcion.cerrarConfEtapasColumna();
      await recepcion.eliminarColumnaVacia(nombreColumnaPrueba);
    });
  }

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});


test('Tablero: asignar una etapa a una orden real y verificar que persiste tras refrescar', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST_ETAPAS_TABLERO);
  const recepcion = new RecepcionPage(page);
  const errores = espiarErroresJS(page);
  const nombreEtapa = `ETAPA ASIGNABLE ${Date.now()}`;

  let nombreColumna = '';
  let numeroOrden = '';

  await test.step('Abrir el módulo, entrar al Tablero y tomar una columna real con al menos una orden', async () => {
    await recepcion.ir();
    await recepcion.visitarTab(TAB_TABLERO);

    const primeraTarjeta = page.locator('.ervk-kanban-card:visible').first();
    await expect(primeraTarjeta, 'No hay ninguna orden real visible en el tablero para esta prueba').toBeVisible({ timeout: TIMEOUTS.CARGA });

    // No usar `.filter({ has: primeraTarjeta })` sobre `.ervk-kanban-column`:
    // confirmado en vivo que el `.first()` de `primeraTarjeta` se ignora
    // dentro de `has` (se evalúa como "contiene ALGÚN .ervk-kanban-card
    // visible", no específicamente ESA tarjeta) — con varias columnas
    // pobladas, resuelve en más de un elemento (violación de "strict mode").
    // Se sube por el DOM real hasta la columna ancestro en su lugar.
    nombreColumna = (
      (await primeraTarjeta
        .locator('xpath=ancestor::*[contains(@class,"ervk-kanban-column")][1]//*[contains(@class,"ervk-column-title")]')
        .textContent()) ?? ''
    ).trim();
    const { numero } = await recepcion.obtenerNumeroYPlacaDeTarjeta(primeraTarjeta);
    numeroOrden = numero;
    expect(nombreColumna, 'No se pudo determinar el nombre de la columna de la orden tomada como base').not.toBe('');
    expect(numeroOrden, 'No se pudo determinar el número de la orden tomada como base').not.toBe('');
  });

  try {
    await test.step(`Configurar una etapa nueva en la columna "${nombreColumna}"`, async () => {
      await recepcion.abrirConfEtapasColumna(nombreColumna);
      await recepcion.agregarEtapaColumna(nombreEtapa);
      await recepcion.cerrarConfEtapasColumna();
    });

    await test.step(`Asignar la etapa a la orden #${numeroOrden} y validar que se refleja en la tarjeta`, async () => {
      const tarjeta = recepcion.tarjetaPorNumero(numeroOrden);
      await recepcion.asignarEtapaATarjeta(tarjeta, nombreEtapa);
      expect(await recepcion.etapaAsignadaEnTarjeta(tarjeta)).toBe(nombreEtapa);
    });

    await test.step('Refrescar el tablero y validar que la etapa asignada persiste', async () => {
      await recepcion.refrescarTablero();
      const tarjeta = recepcion.tarjetaPorNumero(numeroOrden);
      await expect(tarjeta, `La orden #${numeroOrden} no volvió a aparecer tras refrescar el tablero`).toBeVisible({ timeout: TIMEOUTS.CARGA_LISTADO_COMPLETO });
      await expect
        .poll(() => recepcion.etapaAsignadaEnTarjeta(tarjeta), { timeout: TIMEOUTS.CARGA })
        .toBe(nombreEtapa);
    });
  } finally {
    await test.step('Restaurar la orden a "No aplica" y eliminar la etapa de prueba', async () => {
      const tarjeta = recepcion.tarjetaPorNumero(numeroOrden);
      if (await tarjeta.count()) {
        await recepcion.asignarEtapaATarjeta(tarjeta, 'No aplica').catch(() => {});
      }
      await recepcion.abrirConfEtapasColumna(nombreColumna);
      if ((await recepcion.etapasConfiguradas()).includes(nombreEtapa)) {
        await recepcion.eliminarEtapaColumna(nombreEtapa);
      }
      await recepcion.cerrarConfEtapasColumna();
    });
  }

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', validarSinErrores(page, errores));
});

