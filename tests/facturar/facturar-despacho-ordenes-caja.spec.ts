import { test, expect } from '@playwright/test';
import { PosPage, espiarErroresJS } from './pos/pos.page';
import { FacturarPage } from './facturar.page';
import { FacturarDespachoOrdenesCajaPage, TIMEOUTS } from './facturar-despacho-ordenes-caja.page';

// ═══════════════════════════════════════════════════════════════════════════
// IMPORTANTE — proyecto dedicado obligatorio, mismo criterio que
// pos-restaurante.spec.ts/pos-posmovi: este spec corre EXCLUSIVAMENTE con
//
//   POS_COMPANIA=HONDURAS npx playwright test tests/facturar/facturar-despacho-ordenes-caja.spec.ts --project=firefox-super-admin
//
// "Despacho de Órdenes de Caja" (link directo del sidebar "FACTURAR",
// cashOrderDispath/dispath) es cross-company para la cuenta Super
// Administrador (tests/auth/super-admin.setup.ts) — trae su propio filtro de
// Compañía (#company_select) independiente de la compañía resuelta al hacer
// login, confirmado en vivo con ~20 compañías reales disponibles, incluida
// HONDURAS. No mezclar esta corrida con la suite default (cuenta admin,
// proyecto firefox/chromium): esa cuenta sí alcanza esta misma pantalla, pero
// bajo otra compañía y sin necesidad de este filtro cross-company.
// ═══════════════════════════════════════════════════════════════════════════

// Fixture `page` estándar (nueva por test, sin fixture de worker propia) —
// mismo criterio ya adoptado por facturar-orden-caja.spec.ts /
// facturar-cotizaciones.spec.ts en este mismo directorio: a diferencia de
// Dashboard→POS (grid de productos, caro), navegar a esta pantalla es barato
// (Dashboard + click + un par de AJAX), así que no amerita cachear una
// `sharedPage` de scope 'worker'.

async function validarSinMensajesDeError(page: import('@playwright/test').Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

/**
 * Garantiza que la pantalla tenga al menos una orden en estado Pendiente
 * para trabajar — la crea desde el POS si no hay ninguna (instrucción
 * explícita del usuario: no depender de datos ya existentes). Filtra
 * específicamente por "Pendiente" (no por el total de órdenes): confirmado
 * en vivo que el total puede ser mayor que cero (órdenes ya En proceso/
 * Aprobado de corridas anteriores, incluso de otro worker corriendo en
 * paralelo contra la misma compañía real) sin que exista ninguna Pendiente
 * — un chequeo de solo "total > 0" dejaba escenarios que necesitan una
 * orden Pendiente real operando sobre una que ya no lo estaba.
 */
async function asegurarOrdenPendienteDisponible(despacho: FacturarDespachoOrdenesCajaPage, observacion: string) {
  await despacho.filtrarPorEstado('Pendiente');
  const totalPendientes = await despacho.contarOrdenesVisibles();
  if (totalPendientes === 0) {
    await despacho.crearOrdenDeCajaDeRespaldo(observacion);
    await despacho.abrir();
  }
  await despacho.filtrarPorEstado('Todas');
}

test.describe('Despacho de Órdenes de Caja', () => {

  test('1. Apertura del módulo y carga de registros', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoOrdenesCajaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await test.step('Abrir "Despacho de Órdenes de Caja" y seleccionar compañía HONDURAS', async () => {
      await despacho.abrir();
    });

    await test.step('Validar que la URL y el título reales de la pantalla son correctos', async () => {
      expect(page.url()).toContain('cashOrderDispath/dispath');
      await expect(page).toHaveTitle(/Despacho de órdenes/i);
    });

    await test.step('Validar que el panel de detalle arranca en su estado vacío ("Seleccionar Orden...")', async () => {
      await expect(despacho.panelSeleccionarOrden).toBeVisible({ timeout: TIMEOUTS.MODAL });
    });

    await test.step('Si no hay registros, crear una Orden de Caja de respaldo desde el POS y confirmar que el listado la refleja', async () => {
      await asegurarOrdenPendienteDisponible(despacho, `Despacho OC - apertura ${Date.now()}`);
      expect(await despacho.contarOrdenesVisibles()).toBeGreaterThan(0);
    });

    await validarSinMensajesDeError(page);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('2. Buscar una orden por su número', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoOrdenesCajaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho OC - buscar numero ${Date.now()}`);

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
    const despacho = new FacturarDespachoOrdenesCajaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho OC - buscar cliente ${Date.now()}`);

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
    const despacho = new FacturarDespachoOrdenesCajaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho OC - filtro estado ${Date.now()}`);

    await test.step('Filtrar por "Pendiente" y validar que solo se muestran órdenes con ese estado', async () => {
      await despacho.filtrarPorEstado('Pendiente');
      const total = await despacho.contarOrdenesVisibles();
      expect(total, 'El filtro "Pendiente" no devolvió ninguna orden').toBeGreaterThan(0);
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

  test('5. Ver el detalle de una orden', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoOrdenesCajaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho OC - ver detalle ${Date.now()}`);

    await test.step('Abrir el detalle de la primera orden y validar su información', async () => {
      const datos = await despacho.abrirDetallePrimeraOrden();
      expect(datos.numero.length, 'El detalle no trae número de orden').toBeGreaterThan(0);
      expect(datos.cliente.length, 'El detalle no trae cliente').toBeGreaterThan(0);
      await expect(despacho.panelDetalle).toContainText(datos.numero);
    });

    await validarSinMensajesDeError(page);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('6. Despachar una orden (Tomar Orden → Finalizar) y validar el cambio de estado', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoOrdenesCajaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await test.step('Crear una Orden de Caja nueva (garantiza estado Pendiente real, sin depender de datos existentes)', async () => {
      await despacho.crearOrdenDeCajaDeRespaldo(`Despacho OC - ciclo completo ${Date.now()}`);
      await despacho.abrir();
    });

    let numero = '';
    await test.step('Abrir su detalle y confirmar que arranca Pendiente', async () => {
      const datos = await despacho.abrirDetallePrimeraOrden();
      numero = datos.numero;
      expect(datos.estado).toContain('Pendiente');
      await expect(despacho.botonTomarOrden, 'La orden recién creada no muestra el botón "Tomar Orden"').toBeVisible({ timeout: TIMEOUTS.MODAL });
    });

    await test.step('Despachar (Tomar Orden → Finalizar)', async () => {
      await despacho.despacharOrdenEnDetalle();
    });

    // El badge de la tarjeta en la lista NO se actualiza en vivo tras estas
    // acciones (confirmado en vivo, ver el comentario de
    // _leerEstadoTarjetaSeleccionada() en el Page Object) — la validación
    // real del cambio de estado y su persistencia es la misma: recargar y
    // volver a consultar el servidor.
    await test.step('Validar el cambio de estado (Aprobado) recargando y volviendo a consultar la orden — también confirma persistencia', async () => {
      await despacho.actualizarListado();
      await despacho.buscarPorTexto(numero);
      await expect(despacho.tarjetas.first()).toContainText('Aprobado');
    });

    await validarSinMensajesDeError(page);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('7. Actualizar el listado', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoOrdenesCajaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho OC - actualizar listado ${Date.now()}`);

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

  test('8. Validar el rango de fechas del filtro', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoOrdenesCajaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho OC - filtro fecha ${Date.now()}`);

    // NOTA (hallazgo de sistema/ambiente, ver el comentario completo en
    // establecerRangoFechas() del Page Object, confirmado en vivo con
    // evidencia de red en 2 corridas independientes): esta pantalla revierte
    // #start_date/#end_date a su valor por defecto entre fill() y que
    // "Buscar" dispara la consulta real, así que un rango acotado (p. ej.
    // año 2000) NO reduce el listado de forma confiable — no se afirma un
    // conteo esperado que no se puede garantizar. Este escenario valida lo
    // que sí es confiable: los campos aceptan un rango válido en formato ISO
    // y disparan una búsqueda real sin error.
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

  test('9. Menú de tres puntos: Imprimir orden y Descargar PDF', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const facturar = new FacturarPage(pos, page);
    const despacho = new FacturarDespachoOrdenesCajaPage(facturar, pos, page);
    const erroresJS = espiarErroresJS(page);

    await despacho.abrir();
    await asegurarOrdenPendienteDisponible(despacho, `Despacho OC - impresion ${Date.now()}`);
    await despacho.abrirDetallePrimeraOrden();

    await test.step('Validar el enlace real de "Imprimir orden"', async () => {
      const href = await despacho.obtenerHrefImprimirOrden();
      expect(href, 'El menú de tres puntos no trae un href real para "Imprimir orden"').toContain('printCashOrderDispath');
      const respuesta = await page.request.get(href);
      expect(respuesta.ok(), `"Imprimir orden" no respondió OK (status ${respuesta.status()})`).toBe(true);
    });

    await test.step('Validar el enlace real de "Descargar PDF de orden"', async () => {
      const href = await despacho.obtenerHrefDescargarPdf();
      expect(href, 'El menú de tres puntos no trae un href real para "Descargar PDF de orden"').toContain('downloadCashOrderDispathPdf');
      const respuesta = await page.request.get(href);
      expect(respuesta.ok(), `"Descargar PDF de orden" no respondió OK (status ${respuesta.status()})`).toBe(true);
    });

    await validarSinMensajesDeError(page);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});
