import { test } from '@playwright/test';
import { PosPage, TIMEOUTS } from './pos.page';

/** Scratch de investigación para el flujo de Apartados — reescribir según necesidad puntual. */
test('DEBUG: cargar POS vía Dashboard y confirmar estado inicial', async ({ page }) => {
  test.setTimeout(TIMEOUTS.NAVIGATE);
  const pos = new PosPage(page);
  await pos.cargarPosDesdeDashboard();
  await pos.cerrarOverlaysConocidos();
  console.log('[DEBUG] POS cargado vía Dashboard, listo para investigación puntual.');
});
