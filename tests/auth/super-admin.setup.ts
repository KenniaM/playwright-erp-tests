import { test as setup, expect } from '@playwright/test';
import { BASE_URL } from '../env.config';

// Segunda sesión de autenticación de la suite (junto a admin.json / auth.setup.ts):
// cuenta "Super Administrador" de la compañía TALLER ALPHA PREMIUM. Mismo
// flujo real de login que auth.setup.ts (no se toca ese archivo, ver
// CLAUDE.md/README.md: "no modificar la lógica del login salvo estrictamente
// necesario") y, a diferencia de él, esta cuenta SÍ pertenece a más de una
// compañía (17 compañías confirmadas en vivo en el modal "Seleccionar una
// compañía para continuar"), así que este setup además reutiliza
// PosCore.irAlPos() — el mismo mecanismo real que usa todo el módulo POS
// (_irAlPosResolviendoCompania(): overlays conocidos, carrera Flujo A/B,
// selección por nombre exacto) — en vez de reimplementar esa lógica aquí.
const EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'qadesignsoftcr@gmail.com';
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? 'qa0000';

// _irAlPosResolviendoCompania() (pos-core.page.ts) compara por nombre EXACTO
// contra COMPANIA_POS (pos.types.ts, configurable vía POS_COMPANIA) con un
// regex SIN flag 'i' y sin colapsar espacios internos. Confirmado en vivo
// (modal real de esta cuenta): el nombre visible de la compañía es
// "TALLER ALPHA  PREMIUM" — mayúsculas y DOBLE espacio entre "ALPHA" y
// "PREMIUM" — no "Taller Alpha Premium". Se fija aquí, vía require() (no
// hoisteable como un import ES: se ejecuta en el orden exacto en que
// aparece) y ANTES de cargar pos-core.page.ts/pos.types.ts, para que la
// constante de módulo COMPANIA_POS quede resuelta con el valor correcto sin
// tocar pos.types.ts ni su default ('HONDURAS', usado por el resto de la
// suite).
process.env.POS_COMPANIA = process.env.POS_COMPANIA ?? 'TALLER ALPHA  PREMIUM';
const { PosCore } = require('../pos/pos-core.page') as typeof import('../pos/pos-core.page');

setup('authenticate as super admin (TALLER ALPHA  PREMIUM)', async ({ page }) => {
  // El timeout por defecto de Playwright (30s) alcanza para auth.setup.ts
  // (solo login), pero no para este archivo: irAlPos() puede esperar hasta
  // TIMEOUTS.NAVIGATE (90s, pos.types.ts) solo en la navegación final tras
  // seleccionar compañía — confirmado en vivo (timeout real observado en
  // pos-core.page.ts:468 con el límite de 30s por defecto). 120s deja margen
  // sobre login + resolución de compañía completos.
  setup.setTimeout(120_000);

  await page.goto(`${BASE_URL}/log/login`);

  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);

  await page.locator('#loginButton').click();

  await expect(page.locator('#dashboardTitle')).toBeVisible({ timeout: 60000 });

  // Rol mostrado por el propio sistema en el header del Dashboard — confirmado
  // en vivo (span.header-user-role-inline → "(Super admin)"). Validación
  // best-effort: el rol es informativo del sistema, no bloquea el flujo si el
  // ambiente no lo expone (ver instrucción "si el sistema lo muestra").
  await expect(page.locator('.header-user-role-inline'))
    .toContainText(/super\s*admin/i, { timeout: 10_000 })
    .catch((e) => console.log('[super-admin.setup] No se pudo confirmar el rol en el header:', e.message));

  // Reutiliza el flujo real y ya probado de entrada al POS (login → Dashboard
  // → "Crear factura" → resolución de compañía) — cierra los overlays
  // conocidos (moneda, Setup Inicial, notificaciones) y selecciona
  // "TALLER ALPHA  PREMIUM" únicamente si el modal de selección de compañía
  // realmente aparece; si la cuenta solo tuviera una compañía, este mismo
  // método navega directo sin ningún modal (Flujo B) sin necesitar una rama
  // aparte. Nunca se espera con waitForTimeout(): todas las esperas de este
  // método son sobre condiciones reales de la interfaz.
  await new PosCore(page).irAlPos();

  await page.context().storageState({
    path: 'playwright/.auth/super-admin.json'
  });
});
