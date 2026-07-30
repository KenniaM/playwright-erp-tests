import { test as setup, expect } from '@playwright/test';

// Cuarta sesión de autenticación de la suite (junto a admin.json/auth.setup.ts,
// super-admin.json/super-admin.setup.ts y restaurant.json/restaurant.setup.ts):
// ambiente COMPLETO distinto — `qa_posmovi`
// (https://dev.designsoftcr.com/qa_posmovi/public), cuenta
// qadesignsoftcr@gmail.com, compañía "POSMOVI TIENDA", rol Super Admin. Mismo
// motivo que restaurant.setup.ts para ser un proyecto de setup SEPARADO (no
// ampliar 'setup' ni 'setup-super-admin'): genera un storageState DISTINTO
// (posmovi.json) — nunca se reemplaza el storageState real de la suite original.
//
// Igual que restaurant.setup.ts (misma diferencia: otra URL base, no solo otra
// compañía dentro del mismo ambiente), BASE_URL (env.config.ts) y
// COMPANIA_POS (pos.types.ts) son ambas constantes de MÓDULO resueltas una
// única vez, en el momento del import — se fijan aquí vía require() (no
// hoisteable como un import ES: se ejecuta en el orden EXACTO en que aparece
// en el archivo) y ANTES de cargar env.config.ts/pos-core.page.ts/pos.types.ts,
// para que ambas constantes queden resueltas con el valor correcto sin tocar
// sus defaults (usados por el resto de la suite, afinada contra el ambiente
// original qa_talleralpha).
//
// Consecuencia real de que ambas sean constantes de módulo (documentada aquí
// para quien corra esto en el futuro, no un supuesto, ver el mismo comentario
// en restaurant.setup.ts): este mecanismo solo funciona si el proceso de
// worker que ejecuta este archivo es el MISMO que luego importa pos.types.ts
// por primera vez — cierto para cualquier comando que corra ÚNICAMENTE
// archivos de este ambiente POSMOVI (este setup + las suites de navegación
// invocadas con BASE_URL ya apuntando a qa_posmovi), pero NO si el mismo
// comando además corre specs del ambiente original en el mismo proceso de
// worker. Por diseño, este archivo debe correrse en un comando dedicado,
// nunca mezclado con el resto de la suite en la misma invocación de
// `npx playwright test`:
//
//   BASE_URL=https://dev.designsoftcr.com/qa_posmovi/public npx playwright test <specs-posmovi> --project=setup-posmovi --project=firefox-posmovi
//
process.env.BASE_URL = process.env.BASE_URL ?? 'https://dev.designsoftcr.com/qa_posmovi/public';
process.env.POS_COMPANIA = process.env.POS_COMPANIA ?? 'POSMOVI TIENDA';
const { BASE_URL } = require('../env.config') as typeof import('../env.config');
const { PosCore } = require('../facturar/pos/pos-core.page') as typeof import('../facturar/pos/pos-core.page');

const EMAIL = process.env.POSMOVI_USER_EMAIL ?? 'qadesignsoftcr@gmail.com';
const PASSWORD = process.env.POSMOVI_USER_PASSWORD ?? 'qa0000';

setup('authenticate as super admin (POSMOVI TIENDA)', async ({ page }) => {
  // Mismo margen que restaurant.setup.ts/super-admin.setup.ts: login +
  // resolución de compañía (modal "Seleccionar una compañía para continuar",
  // si esta cuenta tuviera más de una) pueden juntos superar el timeout por
  // defecto de 30s.
  setup.setTimeout(120_000);

  await page.goto(`${BASE_URL}/log/login`);

  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);

  await page.locator('#loginButton').click();

  await expect(page.locator('#dashboardTitle')).toBeVisible({ timeout: 60_000 });

  // Rol mostrado por el propio sistema en el header del Dashboard — mismo
  // chequeo best-effort que super-admin.setup.ts (informativo, no bloquea el
  // flujo si el ambiente no lo expone igual).
  await expect(page.locator('.header-user-role-inline'))
    .toContainText(/super\s*admin/i, { timeout: 10_000 })
    .catch((e) => console.log('[posmovi.setup] No se pudo confirmar el rol en el header:', e.message));

  // Reutiliza el flujo real ya probado de entrada al POS (login → Dashboard →
  // "Crear factura" → resolución de compañía, cerrando los overlays
  // conocidos) — mismo mecanismo que restaurant.setup.ts/super-admin.setup.ts,
  // nunca reimplementado aquí. Selecciona "POSMOVI TIENDA" únicamente si el
  // modal de selección de compañía realmente aparece (cuenta con una sola
  // compañía → Flujo B, sin modal, mismo método sin ramas aparte).
  await new PosCore(page).irAlPos();

  await page.context().storageState({
    path: 'playwright/.auth/posmovi.json'
  });
});
