import { test, expect } from '@playwright/test';
import { PosPage } from './pos/pos.page';
import { PESTANA_POS_PROFORMA, PESTANAS_POS_A_RECORRER } from './pos/pos.types';
import { FacturarPage, TIMEOUTS } from './facturar.page';

// Suite únicamente de navegación: valida que los 5 accesos directos del
// submenú "FACTURAR" del sidebar (Dashboard) llevan realmente a donde dicen
// llevar. Mismas validaciones mínimas ya estándar en el repo (URL/estado
// final, contenido propio visible, sin .noty_bar de error) — adaptadas por
// submódulo porque, a diferencia del patrón "tabla de submódulos", cada uno
// de estos 5 termina en un estado real distinto (ver facturar.page.ts para
// la investigación en vivo detrás de cada uno).

const PESTANA_ORDENES_CAJA = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Órdenes de caja')!;

test('Ingresar a "Crear factura"', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const facturar = new FacturarPage(pos, page);

  await test.step('Ingresar vía el link directo "Crear factura"', async () => {
    await facturar.abrirCrearFactura();
  });

  await test.step('Validar que la URL final es la del POS', async () => {
    expect(page.url()).toContain('pointOfSale');
  });

  await test.step('Validar que el grid de productos (contenido propio de "POS Facturación") quedó visible', async () => {
    await expect(pos.primerProducto).toBeVisible({ timeout: TIMEOUTS.MODAL });
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});

test('Ingresar a "Ordenes de caja"', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const facturar = new FacturarPage(pos, page);

  await test.step('Ingresar vía el link directo "Ordenes de caja"', async () => {
    await facturar.abrirOrdenesDeCaja();
  });

  await test.step('Validar que la URL final es la del POS', async () => {
    expect(page.url()).toContain('pointOfSale');
  });

  await test.step('Validar que el listado de Órdenes de Caja quedó visible', async () => {
    await expect(page.locator(PESTANA_ORDENES_CAJA.contenedorContenido)).toBeVisible({ timeout: TIMEOUTS.MODAL });
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});

test('Ingresar a "Cotizaciones"', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const facturar = new FacturarPage(pos, page);

  await test.step('Ingresar vía el link directo "Cotizaciones"', async () => {
    await facturar.abrirCotizaciones();
  });

  await test.step('Validar que la URL final es la del POS', async () => {
    expect(page.url()).toContain('pointOfSale');
  });

  await test.step('Validar que el tab "Proforma / Cotizaciones" quedó activo y su listado visible', async () => {
    expect(await pos.pestanaPosActiva(PESTANA_POS_PROFORMA)).toBe(true);
    await expect(page.locator(PESTANA_POS_PROFORMA.contenedorContenido)).toBeVisible({ timeout: TIMEOUTS.MODAL });
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});

test('Ingresar a "Despacho de órdenes de caja"', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const facturar = new FacturarPage(pos, page);

  await test.step('Ingresar vía el link directo "Despacho órdenes de caja"', async () => {
    await facturar.abrirDespachoDeOrdenesCaja();
  });

  await test.step('Validar que la URL final corresponde a la página real de despacho', async () => {
    expect(page.url()).toContain('cashOrderDispath/dispath');
  });

  await test.step('Validar el título de la página', async () => {
    await expect(page).toHaveTitle(/Despacho de órdenes/i);
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});

test('Ingresar a "Despacho de bodega"', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const facturar = new FacturarPage(pos, page);

  // Hallazgo de ambiente RE-CONFIRMADO en vivo (reemplaza el hallazgo
  // anterior, ya desactualizado): el módulo "Control de Despacho" SÍ está
  // habilitado ahora para la cuenta admin por defecto — a diferencia de lo
  // documentado antes aquí (que esperaba el modal de venta "Módulos
  // Adicionales"), el resultado real del click hoy es la pantalla funcional
  // de despacho. El estado del complemento cambió en el ambiente entre
  // ambas investigaciones — documentar el estado actual, no el histórico
  // (CLAUDE_CONTEXT.md). Ver tests/facturar/facturar-despacho-bodega.spec.ts
  // para la cobertura funcional completa de esta pantalla con esta misma
  // cuenta.
  let resultado: Awaited<ReturnType<typeof facturar.abrirDespachoDeBodega>>;
  await test.step('Ingresar vía el link directo "Despacho de bodega"', async () => {
    resultado = await facturar.abrirDespachoDeBodega();
  });

  await test.step('Validar que se muestra la pantalla real de despacho (módulo habilitado en este ambiente QA)', async () => {
    expect(resultado!, 'Con la cuenta admin por defecto se esperaba la pantalla real de despacho, no el modal "Módulos Adicionales"').toBe('pantalla_real');
    expect(page.url()).toContain('PosDispatchOrder/dispatchOrder');
    await expect(page.getByRole('heading', { name: 'Control de Calidad - Órdenes de despacho' })).toBeVisible({ timeout: TIMEOUTS.MODAL });
  });
});
