import { test, expect } from '@playwright/test';
import { BASE_URL } from '../env.config';
import { PosPage, TipoProforma } from '../facturar/pos/pos.page';

// URL confirmada por el usuario: el link "Cotizaciones" del menú lateral
// (distinto del atajo "Cotizaciones" que abre el POS en la pestaña PROFORMA).
const COTIZACIONES_URL = BASE_URL + '/proform/printPosProform';

const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  CARGA:    15_000,
} as const;

test('Cargar el módulo Cotizaciones', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);

  await test.step('Navegar al módulo Cotizaciones', async () => {
    await page.goto(COTIZACIONES_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  });

  await test.step('Validar que la URL final corresponde al módulo esperado', async () => {
    expect(page.url()).toContain('proform/printPosProform');
  });

  await test.step('Validar el título de la página', async () => {
    // Confirmado en vivo contra POSMOVI (misma URL, misma pantalla real: los
    // controles reales #btn_proform/#receip_search sí cargan): esta pantalla
    // se llama "PROFORMA" (singular, sin "s" — el regex original /proformas/i
    // ya fallaba también contra Taller Alpha por eso, confirmado reproduciendo
    // el fallo con git stash antes de este cambio) en Taller Alpha, y
    // "COTIZACION" (singular, mayúsculas) en POSMOVI — diferencia de wording
    // entre ambientes, no un módulo ni pantalla distinta. Regex ampliado para
    // cubrir ambos (y de paso corregir el falso negativo ya existente en
    // Taller Alpha).
    await expect(page).toHaveTitle(/proformas?|cotizaci[oó]n(es)?/i);
  });

  await test.step('Validar que el encabezado y los filtros de "Ver cotizaciones" cargaron correctamente', async () => {
    // Mismo hallazgo que el título (ver comentario arriba): el encabezado real
    // dice "Ver PROFORMA" en Taller Alpha y "Ver COTIZACION" en POSMOVI — el
    // regex original ('ver cotizaciones') no coincidía con ninguno de los dos
    // ambientes reales (confirmado en vivo en ambos), no solo con POSMOVI.
    await expect(page.locator('.content-header', { hasText: /ver (proformas?|cotizaci[oó]n(es)?)/i })).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await expect(page.locator('#btn_proform')).toBeVisible();
    // Antes: locator('input[placeholder="Buscar"]') — ambiguo (modo estricto
    // de Playwright falla con "resolved to 2 elements") en cualquier
    // ambiente/compañía donde el buscador global del menú lateral
    // (#sidebar_menu_search) también esté presente y comparta el mismo
    // placeholder "Buscar" que el buscador real de esta pantalla
    // (#receip_search) — confirmado en vivo contra qa_restaurant. El ID real
    // del buscador de "Ver cotizaciones" es #receip_search en ambos
    // ambientes, así que apuntar directo a él es además más preciso que el
    // placeholder en el ambiente original.
    await expect(page.locator('#receip_search')).toBeVisible();
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});

// ─── Consignación/Taller en el módulo Cotizaciones — pestañas de tipo ──────
//
// CORRECCIÓN sobre un hallazgo previo de esta misma investigación: se había
// documentado "las Proformas Consignación/Taller nunca aparecen en el
// listado externo" como bug de sistema con `test.fail()`. Era un FALSO
// POSITIVO de automatización, no un bug real — confirmado en vivo con
// capturas de pantalla: este módulo tiene 3 botones de pestaña reales junto
// al buscador (`#btn_proform` "PROFORMA", `#btn_consignation_proform`
// "PROFORMA de Consignación", `#btn_workshop_proform` "PROFORMA de
// Taller") que nunca se habían detectado ni usado — la investigación previa
// solo buscaba con `#receip_search`/`#btn_search_receip` sobre la pestaña
// "PROFORMA" (Normal) activa por defecto, así que Consignación/Taller
// "no aparecían" simplemente porque estaban en OTRA pestaña, no porque
// estuvieran ausentes del sistema. Con la pestaña correcta activa, ambos
// tipos aparecen de inmediato y con el símbolo de moneda correcto (`$`,
// confirmado visualmente: "Total $9,000.00", "Subtotal: $9,000.00" en el
// panel de detalle real de una Proforma de Taller).
//
// Se reemplaza el `test.fail()` incorrecto por cobertura real (nunca antes
// probada): crear cada tipo, cambiar a su pestaña real en este módulo, y
// confirmar que aparece con el monto/moneda correctos.
for (const tipo of ['consignacion', 'taller'] as const) {
  const etiqueta = tipo === 'consignacion' ? 'Consignación' : 'Taller';
  const botonPestana = tipo === 'consignacion' ? '#btn_consignation_proform' : '#btn_workshop_proform';

  test(`Crear una Proforma ${etiqueta} y confirmar que aparece en su propia pestaña del módulo Cotizaciones, con el monto correcto`, async ({ page, context }) => {
    test.setTimeout(180_000);
    const pos = new PosPage(page);

    await test.step(`Crear una Proforma ${etiqueta} desechable en moneda base ($)`, async () => {
      await pos.cargarPosDesdeDashboard();
      await pos.cerrarOverlaysConocidos();
      await pos.esperarEstadoInicial();
      if (await pos.modalAbrirCajaVisible()) {
        await pos.cerrarModalAbrirCaja();
      }
    });

    const nombreCliente = `Cliente Cotizaciones ${etiqueta} ${Date.now()}`;
    let totalCreacion = 0;
    await test.step(`Crear la Proforma ${etiqueta}`, async () => {
      const producto = await pos.obtenerPrimerProductoNormal();
      await pos.agregarProductoAlCarrito(producto);
      totalCreacion = await pos.obtenerTotalVentaNumerico();
      await pos.abrirCrearProforma();
      await pos.seleccionarTipoProforma(tipo as TipoProforma);
      await pos.llenarNombreClienteProforma(nombreCliente);
      const respuesta = await pos.guardarProformaYObtenerRespuesta();
      await pos.validarProformaCreada(respuesta);
      await pos.cerrarModalGestionProforma();
    });

    await test.step(`Buscarla en su propia pestaña "${etiqueta}" del módulo Cotizaciones y validar el monto`, async () => {
      const listado = await context.newPage();
      await listado.goto(COTIZACIONES_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
      await listado.locator('#workshop-web-notification-permission-dismiss').click({ timeout: 3000 }).catch(() => {});
      await listado.locator(botonPestana).click();
      await listado.locator('#receip_search').fill(nombreCliente);
      await listado.locator('#btn_search_receip').click();
      await listado.waitForLoadState('networkidle').catch(() => {});

      const filas = listado.locator('.receip_item');
      expect(await filas.count(), `La Proforma ${etiqueta} no aparece en su propia pestaña del módulo Cotizaciones`).toBe(1);

      const textoFila = await filas.first().innerText();
      const totalEsperado = totalCreacion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      expect(textoFila, `La fila de la Proforma ${etiqueta} no muestra el monto correcto con su símbolo de moneda`).toContain(`$${totalEsperado}`);

      await listado.close();
    });
  });
}
