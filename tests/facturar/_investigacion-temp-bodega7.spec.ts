import { test, expect } from '@playwright/test';
import { PosPage } from './pos/pos.page';
import { FacturarPage } from './facturar.page';

const SCRATCH = 'C:/Users/kenia/AppData/Local/Temp/claude/C--Users-kenia-OneDrive-Escritorio-playwright-erp-tests/518fafce-f170-4e68-9420-19cc3cfbfb7a/scratchpad';

test('DIAG bodega: crear FACTURA real (no orden de caja) y verificar que aparece', async ({ page }) => {
  test.setTimeout(300_000);
  const pos = new PosPage(page);
  const facturar = new FacturarPage(pos, page);

  await pos.cargarPosDesdeDashboard();
  await pos.cerrarOverlaysConocidos();
  await pos.agregarPrimerProductoDePrecioFijo();
  await pos.seleccionarClienteExistente();
  await pos.abrirModalDePago();
  const total = await pos.obtenerTotalVentaNumerico();
  await pos.seleccionarPagoEfectivo(String(total));
  await pos.confirmarPagoAbriendoCajaSiEsNecesario();
  console.log('Factura facturada OK, total:', total);

  await facturar.abrirDespachoDeBodega();
  await pos.cerrarOverlaysConocidos().catch(() => {});
  await facturar.seleccionarCompaniaEnDespacho('HONDURAS');

  await page.locator('#order_search').fill('CITA DE PRUEBA');
  await page.locator('#btn_search_order').click({ timeout: 5000 }).catch(async () => {
    await pos.cerrarOverlaysConocidos();
    await page.locator('#btn_search_order').click();
  });
  await page.waitForTimeout(2000);
  const total2 = await page.locator('[onclick*="get_cash_order_detail"]').count();
  console.log('Tarjetas para "CITA DE PRUEBA" en bodega:', total2);
  await page.screenshot({ path: `${SCRATCH}/bodega7-01.png`, fullPage: true });

  if (total2 > 0) {
    const primerTexto = await page.locator('[onclick*="get_cash_order_detail"]').first().innerText();
    console.log('Primera tarjeta:', primerTexto.replace(/\s+/g, ' '));

    await page.locator('[onclick*="get_cash_order_detail"]').first().click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCRATCH}/bodega7-02-detalle.png`, fullPage: true });

    const tomarBtn = page.locator('a.btn, button', { hasText: 'Tomar Orden' });
    console.log('Tiene boton Tomar Orden:', await tomarBtn.count());
  }
});
