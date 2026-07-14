import { test, expect } from '@playwright/test';
import {
  espiarErroresJS,
  RecepcionPage,
  TAB_ORDENES,
  TAB_TABLERO,
  TABS_MODO_BASICO,
  TIMEOUTS,
} from './recepcion.page';

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

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(errores, `Errores de JavaScript detectados: ${errores.join(' | ')}`).toEqual([]);
  });
});

test('Cambiar entre vista Caja y vista Lista en el tab Órdenes', async ({ page }) => {
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

  await test.step('Cambiar a vista Lista y validar que la información sigue visible', async () => {
    await recepcion.cambiarVistaOrdenes('lista');

    expect(await recepcion.vistaOrdenesActiva()).toBe('lista');
    await expect(
      recepcion.badgeOrden(orden),
      `La orden #${orden} dejó de estar visible al cambiar a vista Lista`
    ).toBeVisible();
  });

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(errores, `Errores de JavaScript detectados: ${errores.join(' | ')}`).toEqual([]);
  });
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

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(errores, `Errores de JavaScript detectados: ${errores.join(' | ')}`).toEqual([]);
  });
});

test('Buscar una orden desde Tablero y desde Órdenes', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
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
      await expect(recepcion.badgeOrden(orden)).toBeVisible();
      // Timeout explícito (no el default de 5s de expect.poll): el Tablero
      // dispara varias peticiones AJAX encadenadas por columna de estado
      // (confirmado en vivo), que bajo carga del ambiente compartido pueden
      // tardar más que el default.
      await expect
        .poll(() => recepcion.obtenerNumerosOrdenVisibles().then((n) => n.length), { timeout: TIMEOUTS.CARGA })
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
      await expect(recepcion.badgeOrden(orden)).toBeVisible();
    });

    await test.step(`[${nombreTab}] Búsqueda sin resultados no muestra ninguna orden`, async () => {
      await recepcion.buscarOrden(terminoInexistente);
      await expect
        .poll(() => recepcion.obtenerNumerosOrdenVisibles().then((n) => n.length), { timeout: TIMEOUTS.CARGA })
        .toBe(0);
    });

    await test.step(`[${nombreTab}] Limpiar búsqueda restaura el listado completo`, async () => {
      await recepcion.limpiarBusqueda();
      await expect(recepcion.badgeOrden(orden)).toBeVisible({ timeout: TIMEOUTS.CARGA });
      await expect
        .poll(() => recepcion.obtenerNumerosOrdenVisibles().then((n) => n.length), { timeout: TIMEOUTS.CARGA })
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

  await test.step('Validar que no aparecen errores visibles ni de JavaScript', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    expect(errores, `Errores de JavaScript detectados: ${errores.join(' | ')}`).toEqual([]);
  });
});
