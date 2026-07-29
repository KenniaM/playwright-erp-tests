import { test as setup, expect } from '@playwright/test';

// Tercera sesión de autenticación de la suite (junto a admin.json/auth.setup.ts
// y super-admin.json/super-admin.setup.ts): ambiente COMPLETO distinto, no solo
// otra compañía dentro del mismo ambiente — `qa_restaurant`
// (https://dev.designsoftcr.com/qa_restaurant/public), cuenta
// qadesignsoftcr@gmail.com, compañía "Restaurante Rancho Robertos". Mismo
// motivo que super-admin.setup.ts para ser un proyecto de setup SEPARADO (no
// ampliar 'setup'): genera un storageState DISTINTO (restaurant.json, no
// admin.json) — nunca se reemplaza el storageState real de la suite original.
//
// A diferencia de super-admin.setup.ts (misma BASE_URL, otra compañía), este
// ambiente cambia también la URL base — BASE_URL (env.config.ts) y
// COMPANIA_POS (pos.types.ts) son ambas constantes de MÓDULO resueltas una
// única vez, en el momento del import, a partir de sus variables de entorno.
// Se fijan aquí ambas vía require() (no hoisteable como un import ES: se
// ejecuta en el orden EXACTO en que aparece en el archivo) y ANTES de cargar
// env.config.ts/pos-core.page.ts/pos.types.ts, para que ambas constantes
// quede resueltas con el valor correcto sin tocar sus defaults (usados por el
// resto de la suite, afinada contra el ambiente original qa_talleralpha).
//
// Consecuencia real de que ambas sean constantes de módulo (documentada aquí
// para quien corra esto en el futuro, no un supuesto): este mecanismo solo
// funciona si el proceso de worker que ejecuta este archivo es el MISMO que
// luego importa pos.types.ts por primera vez — cierto para cualquier comando
// que corra ÚNICAMENTE archivos de este ambiente restaurante (este setup +
// pos-restaurante.spec.ts, que replica el mismo require() antes de importar
// pos.page.ts), pero NO si el mismo comando además corre specs del ambiente
// original en el mismo proceso de worker (el módulo ya habría quedado
// cacheado con el BASE_URL/COMPANIA_POS del primero en importarlo). Por
// diseño, este archivo (y pos-restaurante.spec.ts) deben correrse en un
// comando dedicado, nunca mezclados con el resto de la suite en la misma
// invocación de `npx playwright test`:
//
//   npx playwright test tests/pos/pos-restaurante.spec.ts --project=setup-restaurant --project=chromium-restaurant
//
process.env.BASE_URL = process.env.BASE_URL ?? 'https://dev.designsoftcr.com/qa_restaurant/public';
process.env.POS_COMPANIA = process.env.POS_COMPANIA ?? 'Restaurante Rancho Robertos';
const { BASE_URL } = require('../env.config') as typeof import('../env.config');
const { PosCore } = require('../pos/pos-core.page') as typeof import('../pos/pos-core.page');

const EMAIL = process.env.RESTAURANT_USER_EMAIL ?? 'qadesignsoftcr@gmail.com';
const PASSWORD = process.env.RESTAURANT_USER_PASSWORD ?? 'qa0000';

setup('authenticate as restaurante (Restaurante Rancho Robertos)', async ({ page }) => {
  // Mismo margen que super-admin.setup.ts: login + resolución de compañía
  // (modal "Seleccionar una compañía para continuar", si esta cuenta tuviera
  // más de una) pueden juntos superar el timeout por defecto de 30s.
  setup.setTimeout(120_000);

  await page.goto(`${BASE_URL}/log/login`);

  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);

  await page.locator('#loginButton').click();

  await expect(page.locator('#dashboardTitle')).toBeVisible({ timeout: 60_000 });

  // Reutiliza el flujo real ya probado de entrada al POS (login → Dashboard →
  // "Crear factura" → resolución de compañía, cerrando los overlays conocidos)
  // — mismo mecanismo que super-admin.setup.ts, nunca reimplementado aquí.
  // Selecciona "Restaurante Rancho Robertos" únicamente si el modal de
  // selección de compañía realmente aparece (cuenta con una sola compañía →
  // Flujo B, sin modal, mismo método sin ramas aparte).
  await new PosCore(page).irAlPos();

  await page.context().storageState({
    path: 'playwright/.auth/restaurant.json'
  });
});
