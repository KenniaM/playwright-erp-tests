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

  await test.step('Ingresar vía el link directo "Despacho de bodega"', async () => {
    await facturar.abrirDespachoDeBodega();
  });

  // Hallazgo de ambiente confirmado en vivo (ver el comentario completo en
  // facturar.page.ts → abrirDespachoDeBodega()): el módulo "Control de
  // Despacho" no está comprado/habilitado para esta compañía, así que el
  // resultado REAL y esperado del click es el modal de venta "Módulos
  // Adicionales", no una pantalla funcional de despacho. Se valida ese
  // resultado real en vez de una funcionalidad que no existe en este
  // ambiente — documentar, no ocultar (CLAUDE_CONTEXT.md).
  await test.step('Validar que se muestra el modal real "Módulos Adicionales" (módulo no comprado en este ambiente QA)', async () => {
    await expect(facturar.modalModulosAdicionales).toContainText(/Módulos Adicionales/i);
  });
});
