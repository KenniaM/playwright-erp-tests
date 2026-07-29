import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

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
  projects: [
  {
    name: 'setup',
    testMatch: /auth\.setup\.ts/,
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
  },

  // Tercer setup de la suite (ver tests/auth/restaurant.setup.ts): ambiente
  // COMPLETO distinto (qa_restaurant, no solo otra compañía) — proyecto de
  // setup separado por el mismo motivo que 'setup-super-admin': genera un
  // storageState DISTINTO (restaurant.json).
  {
    name: 'setup-restaurant',
    testMatch: /restaurant\.setup\.ts/,
  },

  {
    name: 'firefox',
    use: {
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

  // Variante de 'chromium' autenticada como Super Administrador
  // (TALLER ALPHA PREMIUM) en vez de la cuenta admin por defecto — los specs
  // que necesiten esta sesión corren con --project=chromium-super-admin.
  {
    name: 'chromium-super-admin',
    use: {
      ...devices['Desktop Chrome'],
      storageState: 'playwright/.auth/super-admin.json',
      launchOptions: {},
    },
    dependencies: ['setup-super-admin'],
  },

  // Variante de 'chromium' autenticada contra el ambiente qa_restaurant
  // (compañía "Restaurante Rancho Robertos") en vez del ambiente original —
  // los specs del módulo Mesas (tests/pos/pos-restaurante.spec.ts) corren con
  // --project=chromium-restaurant. Ver el comentario de restaurant.setup.ts:
  // debe invocarse en un comando dedicado (solo archivos de este ambiente),
  // nunca mezclado con el resto de la suite en la misma corrida.
  {
    name: 'chromium-restaurant',
    use: {
      ...devices['Desktop Chrome'],
      storageState: 'playwright/.auth/restaurant.json',
      launchOptions: {},
    },
    dependencies: ['setup-restaurant'],
  },

  {
    name: 'webkit',
    use: {
      ...devices['Desktop Safari'],
      storageState: 'playwright/.auth/admin.json',
    },
    dependencies: ['setup'],
  },
]
  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
