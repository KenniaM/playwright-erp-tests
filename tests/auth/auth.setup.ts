import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import { BASE_URL } from '../env.config';

// Configurable vía variables de entorno para que la suite pueda correr
// contra cualquier cuenta/compañía/ambiente (junto con BASE_URL en
// env.config.ts y POS_COMPANIA en pos.page.ts) sin tocar este archivo —
// kadmin queda como valor por defecto únicamente para no romper la suite
// existente cuando no se define.
const EMAIL = process.env.POS_USER_EMAIL ?? 'kadmin@gmail.com';
const PASSWORD = process.env.POS_USER_PASSWORD ?? 'qa0000';

setup('authenticate as admin', async ({ page }) => {
  await page.goto(`${BASE_URL}/log/login`);

  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);

  await page.locator('#loginButton').click();

  await expect(page.locator('#dashboardTitle')).toBeVisible({ timeout: 60000 });

  const STORAGE_STATE_PATH = 'playwright/.auth/admin.json';
  await page.context().storageState({ path: STORAGE_STATE_PATH });

  // Corrección real de compatibilidad cross-browser (confirmada en vivo):
  // el backend emite cookies de sesión reales con `SameSite=None` pero SIN
  // `Secure` — combinación que la propia especificación de cookies exige
  // ir siempre junta. Chromium la aplica de forma estricta y RECHAZA esas
  // cookies en silencio al cargar un storageState (confirmado con un probe
  // dedicado: `context.cookies()` devolvía `[]` inmediatamente después de
  // cargar este mismo archivo, dejando cualquier proyecto Chromium/Webkit
  // sin sesión real y cayendo a la pantalla de login pese a que las mismas
  // cookies, vía curl, sí autentican contra el backend). Firefox es más
  // permisivo con esta combinación inválida y no mostraba el problema — de
  // ahí que solo afectara a `--project=chromium`. El sitio siempre se sirve
  // por HTTPS, así que forzar `secure: true` en estas cookies es seguro y
  // no cambia ningún comportamiento real de la app — solo permite que
  // Chromium/Webkit acepten el mismo storageState que Firefox ya acepta.
  const storageState = JSON.parse(fs.readFileSync(STORAGE_STATE_PATH, 'utf-8'));
  for (const cookie of storageState.cookies ?? []) {
    if (cookie.sameSite === 'None' && cookie.secure === false) {
      cookie.secure = true;
    }
  }
  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(storageState, null, 2));
});