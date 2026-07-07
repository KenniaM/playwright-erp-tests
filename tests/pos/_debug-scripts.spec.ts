import { test } from '@playwright/test';
import { PosPage, TIMEOUTS } from './pos.page';

test('DEBUG: listar todos los scripts cargados en el POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  await pos.cargarPosYCerrarModalSiAparece();

  const scripts: string[] = await page.evaluate(() =>
    [...document.querySelectorAll('script[src]')].map((s) => (s as HTMLScriptElement).src)
  );
  console.log('\n\n========== TODOS LOS SCRIPTS ==========');
  console.log(scripts.join('\n'));
});
