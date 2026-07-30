import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

// Firefox es el navegador por defecto del proyecto: cualquier corrida sin
// `--project` explícito (`npx playwright test`, `npx playwright test
// tests/algo.spec.ts`, CI tal como está configurado hoy) debe correr
// ÚNICAMENTE en Firefox (+ su dependencia 'setup'), no en los 5 proyectos
// que existían antes por defecto (firefox/chromium/chromium-super-admin/
// chromium-restaurant/webkit, cada uno corriendo la suite completa).
//
// Playwright no tiene una opción nativa de "proyecto por defecto": con
// `--project` ausente corre TODOS los proyectos del arreglo `projects` tal
// cual se lo entrega este archivo — el filtro tiene que hacerse aquí mismo,
// antes de que Playwright lo reciba. Por eso se detecta en `process.argv`
// si la corrida YA pidió un proyecto explícito (`--project=chromium`,
// `--project webkit`, `--project=setup` para regenerar solo la sesión,
// etc.): si lo pidió, se le entrega el arreglo COMPLETO (para que Playwright
// pueda encontrar y filtrar por ese nombre); si no lo pidió, se le entrega
// solo `['setup', 'firefox']` — 'setup' tiene que seguir presente porque
// 'firefox' depende de él (`dependencies: ['setup']`) y Playwright resuelve
// esa dependencia buscando el proyecto por nombre DENTRO del arreglo que
// recibe, no fuera de él.
//
// Este archivo se reevalúa de nuevo en cada proceso worker que Playwright
// levanta para correr los tests (no una sola vez en el proceso principal) —
// confirmado en vivo: `--project=chromium` funcionaba en la fase de
// "listar" tests pero fallaba en el worker real con "Project 'chromium' not
// found in the worker process", porque el worker no recibe el mismo
// `process.argv` original (no trae el `--project` con el que se invocó la
// corrida), así que recalculaba `false` y le tocaba el arreglo filtrado sin
// chromium. La detección real (`process.argv`) se hace UNA vez, en el
// primer proceso que evalúa este archivo, y se guarda en una variable de
// entorno propia — que sí se hereda en los procesos worker (a diferencia de
// `process.argv`) — para que cualquier reevaluación posterior (main o
// worker) lea el mismo resultado ya decidido, en vez de volver a inspeccionar
// un `process.argv` que ya no es confiable ahí.
const seEspecificoProyectoExplicito = process.env.__PW_PROYECTO_EXPLICITO
  ? process.env.__PW_PROYECTO_EXPLICITO === '1'
  : process.argv.some((arg) => arg === '--project' || arg.startsWith('--project='));
process.env.__PW_PROYECTO_EXPLICITO = seEspecificoProyectoExplicito ? '1' : '0';

// Arreglo completo de proyectos, sin cambios de contenido respecto al
// original (mismo storageState, dependencies, testMatch de cada uno) —
// Firefox ya es el primer proyecto "navegador" (justo después de los 3
// 'setup', que deben preceder a todo lo que dependa de ellos).
const TODOS_LOS_PROYECTOS = [
  {
    name: 'setup',
    testMatch: /auth\.setup\.ts/,
    // Mismo motivo que el project 'firefox' de más abajo: sin
    // ...devices['Desktop Firefox'], este project (sin `use` propio)
    // también caía al default real de Playwright (chromium) — confirmado
    // en vivo, el login se veía correr en Chromium mientras el test real
    // (project 'firefox', que sí carga el storageState que este login
    // genera) corría en Firefox. El storageState (cookies/localStorage) es
    // portable entre motores para el mismo sitio, así que esto es solo
    // visual/consistencia — no cambia qué storageState se genera ni cómo lo
    // consumen 'chromium'/'webkit' cuando se invocan explícitos.
    use: { ...devices['Desktop Firefox'] },
  },

  // Segunda sesión de la suite (cuenta Super Administrador, compañía TALLER
  // ALPHA PREMIUM) — ver tests/auth/super-admin.setup.ts. Proyecto de setup
  // separado (en vez de ampliar el 'setup' de arriba) porque genera un
  // storageState DISTINTO (super-admin.json, no admin.json): un único
  // proyecto 'setup' no puede producir dos storageState distintos sin que
  // los specs regulares tengan forma de pedir uno u otro.
  {
    name: 'setup-super-admin',
    testMatch: /super-admin\.setup\.ts/,
    // Mismo motivo que 'setup' de arriba: sin esto, este login también
    // caía al default real de Playwright (chromium) en vez de Firefox.
    use: { ...devices['Desktop Firefox'] },
  },

  // Tercer setup de la suite (ver tests/auth/restaurant.setup.ts): ambiente
  // COMPLETO distinto (qa_restaurant, no solo otra compañía) — proyecto de
  // setup separado por el mismo motivo que 'setup-super-admin': genera un
  // storageState DISTINTO (restaurant.json).
  {
    name: 'setup-restaurant',
    testMatch: /restaurant\.setup\.ts/,
    // Mismo motivo que 'setup' de arriba: sin esto, este login también
    // caía al default real de Playwright (chromium) en vez de Firefox.
    use: { ...devices['Desktop Firefox'] },
  },

  // Cuarto setup de la suite (ver tests/auth/posmovi.setup.ts): ambiente
  // COMPLETO distinto (qa_posmovi, no solo otra compañía) — proyecto de
  // setup separado por el mismo motivo que 'setup-restaurant': genera un
  // storageState DISTINTO (posmovi.json).
  {
    name: 'setup-posmovi',
    testMatch: /posmovi\.setup\.ts/,
    // Mismo motivo que 'setup' de arriba: sin esto, este login también
    // caía al default real de Playwright (chromium) en vez de Firefox.
    use: { ...devices['Desktop Firefox'] },
  },

  {
    name: 'firefox',
    use: {
      // ...devices['Desktop Firefox'] faltaba: sin esto (ni un browserName
      // propio), Playwright usa su default real ('chromium') sin importar
      // el `name` del proyecto — confirmado en vivo (--headed): el proyecto
      // 'firefox' abría una ventana de Chromium. Mismo patrón ya usado por
      // 'chromium' (...devices['Desktop Chrome']) y 'webkit'
      // (...devices['Desktop Safari']) más abajo.
      ...devices['Desktop Firefox'],
      storageState: 'playwright/.auth/admin.json',
    },
    dependencies: ['setup'],
  },

  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      storageState: 'playwright/.auth/admin.json',
      launchOptions: {},
    },
    dependencies: ['setup'],
  },

  // Variante de 'firefox' autenticada como Super Administrador
  // (TALLER ALPHA PREMIUM) en vez de la cuenta admin por defecto — los specs
  // que necesiten esta sesión corren con --project=firefox-super-admin.
  // Renombrado de 'chromium-super-admin' (usaba ...devices['Desktop Chrome'])
  // a 'firefox-super-admin' junto con Firefox como navegador por defecto de
  // todo el proyecto: mantener el nombre viejo mientras corre en Firefox
  // habría quedado tan engañoso como el bug real que tenía el project
  // 'firefox' (nombrado así pero corriendo en Chromium por faltarle
  // ...devices['Desktop Firefox']).
  {
    name: 'firefox-super-admin',
    use: {
      ...devices['Desktop Firefox'],
      storageState: 'playwright/.auth/super-admin.json',
    },
    dependencies: ['setup-super-admin'],
  },

  // Variante de 'firefox' autenticada contra el ambiente qa_restaurant
  // (compañía "Restaurante Rancho Robertos") en vez del ambiente original —
  // los specs del módulo Mesas (tests/facturar/pos/pos-restaurante.spec.ts) corren con
  // --project=firefox-restaurant. Ver el comentario de restaurant.setup.ts:
  // debe invocarse en un comando dedicado (solo archivos de este ambiente),
  // nunca mezclado con el resto de la suite en la misma corrida. Renombrado
  // de 'chromium-restaurant' por el mismo motivo que 'firefox-super-admin'
  // arriba.
  {
    name: 'firefox-restaurant',
    use: {
      ...devices['Desktop Firefox'],
      storageState: 'playwright/.auth/restaurant.json',
    },
    dependencies: ['setup-restaurant'],
  },

  // Variante de 'firefox' autenticada contra el ambiente qa_posmovi (compañía
  // "POSMOVI TIENDA", rol Super Admin) en vez del ambiente original — las
  // suites de navegación que corran contra este ambiente usan
  // --project=firefox-posmovi. Mismo motivo que 'firefox-restaurant': debe
  // invocarse en un comando dedicado (solo archivos/BASE_URL de este
  // ambiente), nunca mezclado con el resto de la suite en la misma corrida.
  {
    name: 'firefox-posmovi',
    use: {
      ...devices['Desktop Firefox'],
      storageState: 'playwright/.auth/posmovi.json',
    },
    dependencies: ['setup-posmovi'],
  },

  {
    name: 'webkit',
    use: {
      ...devices['Desktop Safari'],
      storageState: 'playwright/.auth/admin.json',
    },
    dependencies: ['setup'],
  },
];

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: seEspecificoProyectoExplicito
    ? TODOS_LOS_PROYECTOS
    : TODOS_LOS_PROYECTOS.filter((p) => p.name === 'setup' || p.name === 'firefox'),
  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
