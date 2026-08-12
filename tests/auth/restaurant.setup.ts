import { test as setup, expect } from '@playwright/test';

// Tercera sesión de autenticación de la suite (junto a admin.json/auth.setup.ts
// y super-admin.json/super-admin.setup.ts): ambiente COMPLETO distinto, no solo
// otra compañía dentro del mismo ambiente — `qa_restaurant`
// (https://dev.designsoftcr.com/qa_restaurant/public), cuenta administradora
// kenniam329@gmail.com, compañía "Restaurante Rancho Robertos". Mismo
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
// los specs de tests/facturar/pos-restaurante/, que replican el mismo
// require() antes de importar pos.page.ts), pero NO si el mismo comando
// además corre specs del ambiente original en el mismo proceso de worker (el
// módulo ya habría quedado cacheado con el BASE_URL/COMPANIA_POS del primero
// en importarlo). Por diseño, este archivo (y los specs de
// pos-restaurante/) deben correrse en un comando dedicado, nunca mezclados
// con el resto de la suite en la misma invocación de `npx playwright test`:
//
//   npx playwright test tests/facturar/pos-restaurante/ --project=setup-restaurant --project=firefox-restaurant
//
process.env.BASE_URL = process.env.BASE_URL ?? 'https://dev.designsoftcr.com/qa_restaurant/public';
process.env.POS_COMPANIA = process.env.POS_COMPANIA ?? 'Restaurante Rancho Robertos';
const { BASE_URL } = require('../env.config') as typeof import('../env.config');
const { PosPage } = require('../facturar/pos/pos.page') as typeof import('../facturar/pos/pos.page');
const { PosRestauranteMesas } = require('../facturar/pos-restaurante/pos-restaurante-mesas.page') as typeof import('../facturar/pos-restaurante/pos-restaurante-mesas.page');

const EMAIL = process.env.RESTAURANT_USER_EMAIL ?? 'kenniam329@gmail.com';
const PASSWORD = process.env.RESTAURANT_USER_PASSWORD ?? 'qa0000';

setup('authenticate as restaurante (Restaurante Rancho Robertos)', async ({ page }) => {
  // Margen ampliado (era 120_000): además de login + resolución de compañía
  // (mismo motivo que super-admin.setup.ts), este setup ahora también libera
  // el salón de pruebas — ver el bloque de limpieza más abajo, que puede
  // tomar varios minutos si el salón quedó muy ocupado.
  setup.setTimeout(300_000);

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
  const pos = new PosPage(page);
  await pos.irAlPos();

  // ─── Liberar el salón de pruebas dedicado ──────────────────────────────
  // CORRECCIÓN DE CONFIABILIDAD (hallazgo real de la auditoría de Mesas/Para
  // Llevar): ninguna orden de mesa se limpia automáticamente entre corridas
  // — cualquier test que falle antes de facturar/eliminar su orden deja esa
  // mesa "ocupada" para siempre. Confirmado en vivo que esto puede agotar
  // las 16 mesas del salón "QA Automatizacion Playwright" por completo entre
  // sesiones, bloqueando CUALQUIER escenario que necesite una mesa
  // disponible ("No hay ninguna mesa disponible entre las 16 mesas cargadas
  // en el plano") desde el primer test. Este setup corre UNA sola vez, antes
  // de que cualquier worker en paralelo empiece (a diferencia de un
  // `beforeEach` por test), así que es el único punto seguro para liberar
  // mesas sin arriesgar la orden de otro worker todavía en curso.
  //
  // Varias rondas (no una sola pasada): confirmado en vivo que una mesa con
  // "división de cuentas" (más de una cuenta/cliente) puede necesitar más de
  // un `eliminarOrden()` para quedar realmente libre — la primera eliminación
  // limpia una cuenta y dejó la mesa "ocupada" de nuevo con la cuenta
  // restante, visible recién en la siguiente ronda.
  const mesas = new PosRestauranteMesas(pos, page);
  await mesas.abrirMesas();
  const MAX_RONDAS = 5;
  for (let ronda = 1; ronda <= MAX_RONDAS; ronda++) {
    const ocupadas = (await mesas.obtenerMesasDelPlano()).filter((m) => m.ocupada);
    if (ocupadas.length === 0) break;
    for (const m of ocupadas) {
      // No debe bloquear el login por una mesa puntual que no se pueda
      // liberar (ej. un estado intermedio inesperado) — se documenta con un
      // log y se sigue con las demás; el resto de la suite igual puede
      // avanzar con las mesas que sí quedaron libres.
      await mesas.eliminarOrden(m.mesaId).catch((e) => {
        console.log(`[restaurant.setup] No se pudo liberar la mesa ${m.mesaId}: ${e.message?.slice(0, 150)}`);
      });
    }
    await mesas.abrirMesas();
  }

  await page.context().storageState({
    path: 'playwright/.auth/restaurant.json'
  });
});
