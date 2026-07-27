# CLAUDE.md

Esta es la guía oficial del repositorio para Claude Code (claude.ai/code). Documenta únicamente lo confirmado revisando el proyecto (código, configuración, `README.md`) — no contiene suposiciones.

Para contexto operativo (cómo investigar en vivo, cómo reportar bugs, qué hacer/no hacer trabajando con Claude en este repo) ver **`CLAUDE_CONTEXT.md`**, que complementa este archivo sin repetirlo.

## Qué es este proyecto

Automatización E2E con Playwright + TypeScript de un sistema ERP real (`https://dev.designsoftcr.com/qa_talleralpha/public/`), ambiente compartido de QA/desarrollo — no hay servidor local, no hay `webServer` en `playwright.config.ts`, y las pruebas crean datos reales contra el backend real (clientes, productos, facturas...). No existe ningún mecanismo de limpieza (`afterEach`/`afterAll`/eliminar registros) en toda la suite: es una decisión implícita del proyecto, no un olvido — los datos de prueba se acumulan en el ambiente por diseño.

## Comandos

```bash
# Instalar dependencias
npm ci

# Instalar navegadores de Playwright (una sola vez)
npx playwright install --with-deps

# Correr toda la suite
npx playwright test

# Correr un archivo específico
npx playwright test tests/pos/pos-crear.spec.ts

# Correr una prueba por nombre
npx playwright test -g "Apertura de caja"

# Correr solo en un browser
npx playwright test --project=chromium

# Modo headed (navegador visible) — útil para desarrollar/depurar un escenario nuevo
npx playwright test --headed

# UI interactiva
npx playwright test --ui

# Ver el reporte HTML tras una corrida
npx playwright show-report

# Regenerar únicamente la sesión de autenticación
npx playwright test --project=setup

# Grabar un test nuevo
npx playwright codegen

# Abrir el inspector paso a paso
PWDEBUG=1 npx playwright test
```

No hay scripts propios en `package.json` (`"scripts": {}`) — todo se ejecuta invocando `npx playwright ...` directamente, tal como documenta `README.md`.

### Variables de entorno

| Variable | Usada en | Default si no se define |
|---|---|---|
| `POS_USER_EMAIL` | `tests/auth/auth.setup.ts` | `kadmin@gmail.com` |
| `POS_USER_PASSWORD` | `tests/auth/auth.setup.ts` | `qa0000` |
| `POS_COMPANIA` | `tests/pos/pos.types.ts` (`COMPANIA_POS`) | `HONDURAS` |

Permiten correr la misma suite contra otra cuenta/compañía del ambiente sin tocar código. **Nunca hardcodear un id numérico de compañía** — varía por ambiente; la selección real siempre se hace por el nombre visible en el modal de selección de compañía (ver `CLAUDE_CONTEXT.md`).

## Arquitectura general

### Flujo de autenticación (Auth Flow)

`tests/auth/auth.setup.ts` es un proyecto Playwright de tipo `setup` (`testMatch: /auth\.setup\.ts/` en `playwright.config.ts`) que inicia sesión una sola vez en el ERP y guarda el estado del navegador (cookies + localStorage) en `playwright/.auth/admin.json`. Los tres proyectos de browser (`chromium`, `firefox`, `webkit`) declaran `dependencies: ['setup']` y cargan ese mismo `storageState`, así que **ningún test hace login real por sí mismo** — todos arrancan ya autenticados.

Si `admin.json` quedó obsoleto o la sesión expiró, regenerarlo con `npx playwright test --project=setup`.

### Aplicación objetivo y módulos cubiertos

La suite cubre, además del login y el dashboard, los siguientes módulos del ERP (una carpeta por módulo dentro de `tests/`):

`pos` (con mucho el más grande y complejo), `gestion-de-taller`, `bancos`, `compras`, `configuraciones`, `contabilidad`, `contactos`, `cotizaciones`, `crm`, `facturacion-electronica`, `inventario`, `reportes` (13 categorías de reporte, cada una en su propio `rp-*.page.ts`/`rp-*.spec.ts`), `rutas`, `tienda-en-linea`, `ventas`, `citas`.

El Dashboard (`/dash/dashboard`) es el punto de partida real de casi todo flujo (maneja un modal de tipo de cambio al cargar — ver `CLAUDE_CONTEXT.md`) y "FACTURAR → Crear factura" es la puerta de entrada al POS (incluye la resolución de compañía cuando la cuenta tiene más de una).

## Los dos patrones de test del repositorio

El repositorio usa **dos patrones distintos**, según qué tan compleja sea la interacción real del módulo. Al crear una suite nueva, elegir el que corresponda — no forzar el patrón de negocio complejo en un módulo que solo necesita confirmar que una pantalla carga.

### 1. Patrón "navegación" (tabla de submódulos) — el más común

Usado por la mayoría de los módulos: `bancos`, `compras`, `configuraciones`, `contabilidad`, `contactos`, `crm`, `facturacion-electronica`, `inventario`, `reportes`, `tienda-en-linea`, `ventas`, y la mitad de `gestion-de-taller` (`taller.page.ts`).

- `<modulo>.page.ts` exporta: un `TIMEOUTS` propio del módulo, un tipo `Submodulo<Modulo>` (`nombre`, `url`, `rutaEsperada`, `tituloEsperado` como RegExp, `obtenerLocatorDeCarga(page)`), un arreglo de submódulos con esos datos confirmados en vivo, y una clase `<Modulo>Page` mínima con un único método `irA(url)`.
- `<modulo>-navegacion.spec.ts` recorre el arreglo con un `for` generando **una prueba por submódulo**, cada una validando en `test.step`s: la URL final contiene `rutaEsperada`, el `<title>` coincide (si aplica — puede omitirse si dos pantallas comparten título, ver `gestion-de-taller/taller.page.ts`), el locator propio de contenido queda visible, y no queda ningún `.noty_bar` con texto de error.

Ejemplo mínimo (`bancos.page.ts` + `bancos-navegacion.spec.ts`):

```ts
// bancos.page.ts
export const SUBMODULOS_BANCOS: SubmoduloBancos[] = [
  { nombre: 'Admin. Cuentas Bancarias', url: '...', rutaEsperada: 'bank_account', tituloEsperado: /cuentas bancarias/i,
    obtenerLocatorDeCarga: (page) => page.locator('input[placeholder="Buscar por banco o número de cuenta..."]') },
  // ...
];
export class BancosPage {
  constructor(private readonly page: Page) {}
  async irA(url: string) { await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE }); }
}
```

**Excepción confirmada**: módulos de una sola pantalla sin tabla de submódulos (`cotizaciones.spec.ts`, `citas.spec.ts`) inlinean la URL y el `TIMEOUTS` directamente en el spec, sin `.page.ts` propio. Es una excepción real y aceptada al patrón general, no un error — no crear un `.page.ts` vacío solo por seguir la regla si el módulo de verdad no tiene nada reutilizable.

**Nota**: `rutas` (`rutas.page.ts`/`comision.page.ts`) no sigue ninguno de los dos patrones de forma pura — es un Page Object con locators y formularios propios (agregar ruta, agregar comisión) probado con specs específicos (`admin-rutas.spec.ts`, `admin-comision.spec.ts`), sin tabla de submódulos ni composición de dominios. Es un módulo pequeño de un solo flujo real, no una tercera categoría a replicar deliberadamente — al crear un módulo nuevo, seguir el patrón 1 o 2 según corresponda.

### 2. Patrón de flujo de negocio (Page Object completo)

Usado por `pos` y por la mitad de `gestion-de-taller` (`recepcion.page.ts` / `recepcion-basico.spec.ts`) — módulos con wizards de varios pasos, modales, tabs, AJAX real y validaciones de negocio, no solo "la pantalla cargó". Aquí sí aplican todas las convenciones de Page Object descritas abajo (composición, fixtures worker, manejo de Chosen/modales, etc.).

`recepcion.page.ts` reutiliza `espiarErroresJS`/`esperarQuedaActivo` importándolas tal cual desde `../pos/pos.page` en vez de duplicarlas — la única reutilización cruzada entre módulos distintos confirmada en el repo hoy. Si un nuevo módulo de flujo de negocio necesita un helper genérico ya existente en `pos.utils.ts`, importarlo igual en vez de reescribirlo.

## Organización de carpetas y convenciones de nombres

- Una carpeta por módulo del ERP, en `kebab-case`, siguiendo el nombre real del módulo en el sidebar (`gestion-de-taller`, `facturacion-electronica`, `tienda-en-linea`).
- Page Object: `<modulo>.page.ts`, o `<prefijo>-<submodulo>.page.ts` cuando el módulo se divide en varios archivos por tamaño (`pos-crear-cliente.page.ts`, `rp-caja.page.ts`).
- Spec: `<modulo>-navegacion.spec.ts` para el patrón tabla, o `<modulo>-<flujo>.spec.ts` para un flujo de negocio específico (`pos-crear.spec.ts`, `recepcion-basico.spec.ts`).
- **El nombre de la clase sigue el nombre del ARCHIVO, no el de la carpeta**: `taller.page.ts` (dentro de `gestion-de-taller/`) exporta `TallerPage`, no `GestionDeTallerPage`.
- Métodos/propiedades con prefijo `_` (p. ej. `_seleccionarPrimeraOpcionChosen`, `_cerrarModalMonedaSiAparece`) son **convención de "interno del módulo, no pensado para llamarse desde un spec"**, no una restricción real del lenguaje — siguen siendo `public` porque otras clases de dominio compuestas dentro del mismo módulo sí necesitan invocarlos.
- Todo el repositorio está en español: nombres de archivo, clases, métodos, variables, comentarios, títulos de test, mensajes de log y de error. Mantenerlo así en código nuevo.
- Dentro de POS, la escala del módulo separa responsabilidades en archivos propios: `pos.types.ts` (tipos y constantes compartidas: `TIMEOUTS`, `PAUSES`, `COMPANIA_POS`, tipos de dominio como `LineaCarrito`/`MetadatoProducto`), `pos.locators.ts` (todos los selectores CSS del módulo, exportados como un único objeto `L`), `pos.utils.ts` (funciones sueltas sin `this`, reutilizables fuera de cualquier clase: `espiarErroresJS`, `esperarQuedaActivo`), y un archivo `pos-<dominio>.page.ts` por cada área de negocio. Un módulo nuevo de esa escala debería replicar esta separación; un módulo pequeño no la necesita (todo cabe en un único `<modulo>.page.ts`).

## Convenciones de Page Objects

- Los selectores viven **únicamente** en archivos `*.page.ts` (o en `pos.locators.ts` para POS) — nunca sueltos dentro de un `*.spec.ts`.
- Los archivos `*.spec.ts` solo arman el flujo del caso de prueba llamando métodos del Page Object, dentro de `test.step()`s nombrados que describen la acción real ("Abrir 'Agregar Cliente' y llenar los 4 campos básicos", no "Step 1").
- Cada archivo grande de Page Object antepone constantes propias de `TIMEOUTS` (y a veces `PAUSES`) — no existe un `TIMEOUTS` único compartido entre módulos distintos; cada módulo define el suyo, ajustado a lo que confirmó en vivo (ver ejemplos: `bancos.page.ts` usa `TEST:60_000`, `pos.types.ts` usa `TEST:300_000`, `recepcion.page.ts` tiene timeouts específicos por flujo como `TEST_ORDEN_COMPLETA:300_000`).
- Cada `test()` fija su propio `test.setTimeout(TIMEOUTS.X)` al inicio del cuerpo — nunca se depende del timeout global por defecto de Playwright.

## Composición sobre herencia (POS)

`pos.page.ts` migró explícitamente de un archivo monolítico a composición (ver el comentario en la cabecera del archivo, que referencia el plan de migración aprobado). El resultado:

- `PosPage` es una **fachada pura**: en el constructor instancia ~10 clases de dominio (`PosCore`, `PosCierreCaja`, `PosPayment`, `PosNavigation`, `PosProforma`, `PosCrearProducto`, `PosImportarFactura`, `PosOrdenCaja`, `PosApartados`, `PosRuteo`) y delega cada miembro público con un one-liner: `async metodo(...args) { return this.dominio.metodo(...args); }`.
- Ninguna clase de dominio **extiende** a otra. Reciben sus dependencias por **inyección en el constructor** (`new PosCierreCaja(this.core)`, `new PosProforma(this.core, this.payment, this.navigation)`), nunca por herencia.
- `PosCore` concentra lo realmente transversal (navegación al POS, modales conocidos, Chosen genérico, checkboxes, catálogo de productos); las demás clases de dominio la reciben como dependencia cuando necesitan esos helpers.
- Un Page Object de dominio **nuevo** no está obligado a integrarse a la fachada `PosPage`: puede componerse directamente contra `PosPage` (para reutilizar todo lo ya expuesto) + `Page`, instanciándose aparte en el spec — así se construyó `PosCrearCliente` (`constructor(private readonly pos: PosPage, private readonly page: Page)`), sin tocar `pos.page.ts`. Preferir este camino para una funcionalidad acotada; integrar a la fachada solo si de verdad necesita exponerse a TODOS los specs de POS.

**Excepción real confirmada** (no universal): `tests/reportes/rp-tienda-en-linea.page.ts` sí usa herencia — `ReporteDespachoOrdenesPage` y `ReporteOrdenesPage` extienden `ReporteTiendaEnLineaBase` para compartir lógica entre dos variantes muy similares de un mismo reporte. Es la única herencia real detectada en todo el repo; la regla por defecto para módulos de negocio complejos (POS y similares) sigue siendo composición, no herencia.

## Fixtures y paralelismo

`playwright.config.ts` tiene `fullyParallel: true` — los tests corren en paralelo entre sí, y cada worker de Playwright es un **proceso Node separado**.

8 archivos de POS con flujos de negocio (`pos-crear.spec.ts`, `pos-productos-externos.spec.ts`, `pos-taller.spec.ts`, `pos-proforma.spec.ts`, `pos-apartado.spec.ts`, `pos-ruteo.spec.ts`, `pos-orden-caja.spec.ts`, `pos-importar-factura.spec.ts`) usan una **fixture propia de scope `'worker'`** para cargar Dashboard→POS una sola vez por worker en vez de una vez por test — necesario porque ese recorrido (expandir submenú, resolver compañía, esperar AJAX del Dashboard) es costoso y, bajo carga paralela, repetirlo por test es además más frágil.

Forma estándar (ver `pos-crear.spec.ts`):

```ts
const base = test; // alias: evita pisar el `test` simple si el mismo archivo también tiene tests sueltos
const testX = base.extend<{}, { sharedPage: Page; pos: PosPage }>({
  sharedPage: [async ({ browser }, use) => {
    const page = await browser.newPage();
    await use(page);
    await page.close();
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  pos: [async ({ sharedPage }, use) => {
    const pos = new PosPage(sharedPage);
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    await use(pos);
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],
});

testX.describe('Mi flujo', () => {
  testX.beforeEach(async ({ pos }) => {
    // devolver el POS a un estado conocido antes de cada test individual
  });
  testX('escenario', async ({ pos }) => { /* ... */ });
});
```

Deliberadamente **no** se usa `test.describe.configure({ mode: 'serial' })` para esto (confirmado por comentario explícito en `pos-crear.spec.ts`): entraría en conflicto con `fullyParallel`. El aislamiento real lo da que cada worker es su propio proceso — tests de un mismo worker comparten la `sharedPage`/`pos` cacheadas, tests de workers distintos corren en paralelo con su propia página independiente.

El resto de los specs (todo el patrón "navegación", y los flujos simples de POS) usa la fixture `page` estándar de Playwright (nueva por test) sin ninguna fixture propia — apropiado cuando la carga es barata (`goto` directo a una URL).

## Estándares de TypeScript y herramientas

- No hay `tsconfig.json` propio en el repo — Playwright Test usa su transformador TS incorporado tal cual, sin opciones de compilador custom.
- No hay ESLint ni Prettier configurados — la consistencia de estilo se mantiene por convención y revisión, no por tooling automático. Seguir el estilo del archivo que se está editando.
- Tipos explícitos para los datos de dominio que cruzan entre Page Object y spec (`export type DatosClienteSencillo = {...}`, `export type SubmoduloBancos = {...}`) — nunca `any` salvo interoperar con funciones globales de la app no tipadas (`// @ts-expect-error función global real de la app, no expuesta por tipos`).
- Uso de `as const` para objetos de constantes (`TIMEOUTS`, `PAUSES`, `CHECKBOX_ID`) para obtener tipos literales.

## Reglas para reutilizar código

- Antes de escribir un helper nuevo, buscar si ya existe uno genérico reutilizable en el módulo (`PosCore` para POS) o cruzando módulos (`pos.utils.ts` para funciones sueltas sin estado).
- Si un helper genérico casi sirve pero el widget real tiene una forma de DOM distinta (p. ej. Chosen de selección múltiple vs. simple), **no forzar el helper existente** — crear una variante acotada al caso nuevo, documentando por qué el existente no aplica (ver `_seleccionarPrimeraOpcionChosenMultiple` en `pos-crear-cliente.page.ts`).
- Si un helper "elige la primera opción disponible" y esa opción alimenta un campo dependiente (p. ej. Marca → Modelo de vehículo), no asumir que la primera opción del catálogo tiene datos dependientes reales — validar el efecto observable (el campo dependiente quedó poblado) y probar la siguiente opción si no. Ver `_seleccionarMarcaVehiculoConModelosReales` en `pos-crear-cliente.page.ts` como plantilla.
- No dupliques una función ya existente con otro nombre — impórtala. El repo ya tuvo (y corrigió) casos de `espiarErroresJS`/`esperarQuedaActivo` duplicadas de forma idéntica en varios specs antes de centralizarlas en `pos.utils.ts`.

## Buenas prácticas / qué evitar

- **Nunca `page.waitForTimeout()` como mecanismo de sincronización.** Usar esperas reales: `expect(locator).toBeVisible({timeout})`, `expect.poll(...)`, `page.waitForResponse(...)`, `page.waitForURL(...)`. La única excepción tolerada son las constantes `PAUSES.*` de `pos.types.ts`, documentadas explícitamente como pausas cosméticas para poder observar una corrida `--headed`, nunca como la sincronización real de la que depende la aserción.
- No aumentar timeouts globales para enmascarar una condición de carrera real — investigar la causa (ver `CLAUDE_CONTEXT.md`, flujo de investigación) y usar un mecanismo de espera/reintento correcto y acotado.
- No usar un único intento con timeout largo para clicks sobre elementos que pueden quedar tapados por un overlay asíncrono (modal de notificaciones, aviso de consecutivo, banners) — usar reintentos cortos y acotados cerrando los overlays conocidos antes de cada intento (ver `_cerrarOverlayDashboardSiAparece`, `agregarPrimerProductoDePrecioFijo`).
- No hardcodear ids numéricos de compañía, producto o cualquier entidad específica de un ambiente — todo debe resolverse por nombre visible o devuelto por la propia UI/API real (ver `_irAlPosResolviendoCompania`).
- No modificar una aserción del test para "hacerla pasar" cuando la causa real es un bug del sistema/backend/ambiente — documentar el hallazgo con evidencia en vez de debilitar la validación (ver `CLAUDE_CONTEXT.md`).
- No dejar archivos de investigación temporal (specs usados solo para explorar un flujo en vivo) commiteados — son desechables, se eliminan al terminar la investigación.
- No tocar la lógica de `auth.setup.ts` salvo que sea estrictamente necesario (mismo criterio que documenta `README.md`).

## Flujo recomendado para desarrollar un nuevo escenario

1. Confirmar si el módulo ya existe; si no, decidir el patrón (navegación vs. flujo de negocio) según la complejidad real de la interacción, no por defecto.
2. Investigar el flujo real en vivo antes de escribir el Page Object — no asumir el comportamiento de la UI ni de las validaciones. Ver `CLAUDE_CONTEXT.md` para el flujo de investigación concreto usado en este repo.
3. Escribir/extender el `*.page.ts` correspondiente: locators + métodos de acción, reutilizando todo lo que ya exista en `PosCore`/el módulo antes de crear algo nuevo.
4. Escribir el `*.spec.ts` componiendo esos métodos dentro de `test.step()`s, con las validaciones mínimas ya estándar en el repo: mensaje de éxito real, persistencia tras recargar/reabrir, ausencia de `.noty_bar` de error, ausencia de modales/SweetAlert inesperados, y (en flujos de negocio) cero errores de JS con `espiarErroresJS`.
5. Correr el escenario nuevo de forma aislada (`-g "<nombre>"`) contra el ambiente real antes de darlo por terminado — no se puede confiar en que compile para asumir que funciona.
6. Si algo falla, investigar la causa raíz en vivo antes de tocar el test (ver `CLAUDE_CONTEXT.md`) y clasificarla: automatización (corregir), o sistema/ambiente/datos (documentar, no ocultar).

## CI

GitHub Actions (`.github/workflows/playwright.yml`) corre la suite completa en push/PR a `main`/`master`, con `workers: 1` y `retries: 2` en CI (definido en `playwright.config.ts` vía `process.env.CI`), y sube el reporte HTML como artefacto (30 días de retención).
