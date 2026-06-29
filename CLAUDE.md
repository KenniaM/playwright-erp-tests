# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm ci

# Install Playwright browsers (required once)
npx playwright install --with-deps

# Run all tests
npx playwright test

# Run a single test file
npx playwright test tests/example.spec.ts

# Run a specific test by name
npx playwright test -g "Apertura de caja"

# Run only on one browser
npx playwright test --project=chromium

# Run in headed mode (visible browser)
npx playwright test --headed

# Open interactive UI mode
npx playwright test --ui

# Show HTML report after test run
npx playwright show-report

# Run auth setup only
npx playwright test --project=setup
```

## Architecture

### Auth Flow
Tests depend on a session setup project. `tests/auth/auth.setup.ts` logs in to the ERP as `kadmin@gmail.com` and saves browser storage state (cookies + localStorage) to `playwright/.auth/admin.json`. All browser projects (`chromium`, `firefox`, `webkit`) declare `dependencies: ['setup']` and load that saved state via `storageState`, so tests start already authenticated.

If `admin.json` is stale or the session expires, re-run with `--project=setup` to regenerate it.

### Target Application
The tests exercise the ERP system at `https://dev.designsoftcr.com/qa_talleralpha/public/`. Key flows covered so far:
- Login (`/log/login`)
- Dashboard (`/dash/dashboard`) — handles a currency modal on load
- Invoice creation (`FACTURAR → Crear factura`) — includes a company selector modal
- Point of sale / cash register (`/pos/pointOfSale`) — handles the cash opening modal

### Page Object Pattern
Tests define inline classes as lightweight page objects (e.g., `SeleccionarCompaniaModal`, `AperturaCajaModal`). These classes take a `Page` in the constructor and expose action methods. Keep following this pattern for new modals or flows rather than embedding all locators directly in `test()` bodies.

### CI
GitHub Actions (`.github/workflows/playwright.yml`) runs the full suite on push/PR to `main`/`master`, uploads the HTML report as an artifact, and uses `workers: 1` with `retries: 2` on CI.
