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
npx playwright test tests/facturar/pos/pos-crear.spec.ts

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
| `POS_COMPANIA` | `tests/facturar/pos/pos.types.ts` (`COMPANIA_POS`) | `HONDURAS` |

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

## Permisos de roles (Roles y permisos → POS)

El módulo "Roles y permisos" (`/roleAdmin/roleAdmin`, dentro de Configuración) permite editar, por rol, un catálogo de ~500+ permisos individuales (cada uno un checkbox-slider con guardado AJAX propio e independiente, sin botón "Guardar" global). `tests/facturar/pos/pos-permisos.page.ts` (`PosPermisos`) y `pos-permisos.spec.ts` cubren los permisos que controlan el acceso a submódulos del POS, probados únicamente contra el rol **"Administrador nivel 1"** (el rol Administrador real de la cuenta de pruebas).

**El catálogo visual (nombre en negrita + "Nota") no es una fuente confiable de qué permiso es cuál** — confirmado en vivo que varias filas muestran una "Nota" que en realidad describe un permiso distinto (p. ej. la fila "Poder cambiar el rol a los usuarios" mostraba la nota "Permitir facturar apartados a crédito en el POS"). La fuente confiable es el `id` numérico real devuelto por el propio backend (`getRolePermissionById`), confirmado además con su `slug` interno en inglés y con el efecto real observado en vivo (togglear y comprobar en el POS), nunca solo por el texto visible.

Permisos confirmados en vivo (id real → comportamiento real en el POS, con el rol Administrador nivel 1):

| Permiso (nombre visible) | id | slug | Comportamiento real confirmado |
|---|---|---|---|
| Admin roles | 45 | — | Controla la opción **"Permisos del POS"** del menú de tres puntos del encabezado del POS. Al desactivarlo, además, la propia página `/roleAdmin/roleAdmin` empieza a responder "NO AUTORIZADO" para la cuenta que perdió el permiso — ver el bug de sistema documentado abajo. |
| Ver vender (POS) | 3 | `seepossale` | Controla el acceso a la sección "Vender"/POS Facturación: sin él, el tab `#btn_pos_option` no existe y el grid de productos no carga, incluso navegando directo a la URL del POS. |
| Realizar cobro | 1 | `possalepayment` | Controla el botón "Facturar" (`#btn_pay_sale`) y el tab "Órdenes de Caja" (`#btn_cashier_option`). Con el permiso desactivado, **"Enviar a Caja" también desaparece** del menú de acciones junto a Facturar (contraintuitivo: no solo queda esa opción sola — desaparece igual que Facturar), mientras que "Crear Proforma" y "Generar Apartado" sí permanecen. El atajo ESC ("FACTURAR (ESC)") deja de abrir el modal de pago. |
| Agregar proformas | 66 | `addproform` | Controla el tab "Proformas" (`#btn_proform_option`) y el atajo Shift+P (abre "Agregar Proforma", `#dialog_proform`). |
| Facturar productos externos | 134 | `saleexternalproduct` | Controla el tab "Productos Externos" (`#btn_product_external_option`) completo. **No controla la opción "Agregar Producto Externo" del menú de tres puntos** (`#add_sc_product`) — esa la controla un permiso aparte, "Agregar producto externo" (id 133, slug `addexternalproduct`), confirmado en vivo como un efecto independiente. |
| Ver apartados en el pos | 552 | `see_layaways_in_pos` | Controla la existencia completa del tab "Apartados" (`PosCore.localizarPestanaApartados()` devuelve `null` sin el permiso). |
| Importar facturas en POS | 131 | `importinvoicefromhistoric` | Controla el tab "Importar Facturas" (`#btn_import_invoice_option`). |

Mecánica de guardado confirmada en vivo: cada checkbox dispara su propio POST inmediato — `SetPermissionToRole` al activar, `deletePermissionRole` al desactivar (endpoints distintos, no una única llamada con flag) — con payload `role_id`/`permission_id`/`_token`. **Un simple recargo del POS en la misma sesión ya refleja el cambio** (`PosCore.irAlPos()`/`PosPermisos.recargarPos()`) — no hace falta cerrar sesión ni volver a autenticar.

**Bug de sistema confirmado en vivo (self-lockout de "Admin roles")**: desactivar el permiso "Admin roles" (id 45) para el propio rol de la cuenta logueada bloquea el acceso a la página `/roleAdmin/roleAdmin` entera para esa cuenta ("NO AUTORIZADO — Póngase en contacto con un administrador para validar acceso"), no solo la opción "Permisos del POS" del POS como sugiere su nombre. Sin embargo, el endpoint AJAX que guarda el cambio (`SetPermissionToRole`) NO aplica esa misma validación — sigue respondiendo 200 incluso con la página ya bloqueada para esa cuenta: una inconsistencia real de autorización entre la ruta de página y su propio endpoint. `PosPermisos.establecerPermisoViaApiDirecta()` documenta y usa esto como red de seguridad exclusiva de la suite para poder restaurar "Admin roles" sin depender de una UI que ese mismo permiso puede bloquear — nunca como mecanismo normal.

**Otro bug de sistema confirmado en vivo (intermitente)**: bajo ciertas condiciones el propio backend puede responder 500 a un toggle de permiso con un `FatalErrorException` real (`Call to a member function attachPermission() on null`, `RoleAdminController.php:58`), sin patrón de reproducción 100% aislado — pero el valor final igual queda guardado correctamente pese al error (confirmado releyendo el estado con una navegación completamente nueva). `PosPermisos.establecerPermiso()` no falla duro ante esto; `esperarPermiso()` es la fuente de verdad real tras cualquier toggle.

**Corrección de automatización confirmada en vivo** (no un bug del sistema): el atajo real "FACTURAR (ESC)" solo reacciona a un evento cuyo `keyCode`/`which` legacy valga 27 — `page.keyboard.press('Escape')` no lo satisface en este listener legacy de la app. `PosPermisos.presionarEscReal()` despacha un `KeyboardEvent` manual con esas propiedades definidas explícitamente.

### Productos y Líneas

| Permiso (nombre visible) | id | slug | Comportamiento real confirmado |
|---|---|---|---|
| Agregar productos | 7 | `addproduct` | Controla la tarjeta "Crear Producto" del grid (tab Productos) y el atajo Shift+A — ambos dejan de abrir el modal con el permiso desactivado. |
| Agregar servicios de taller | 62 | `addservice` | Controla la tarjeta "Crear Servicio" del grid (tab Servicios). |
| Agregar producto externo | 133 | `addexternalproduct` | Controla la opción "Agregar Producto Externo" del menú de tres puntos (`#add_sc_product`) — **no** el tab "Productos Externos" completo, que lo controla "Facturar productos externos" (id 134, ver arriba); confirmado en vivo que son dos efectos independientes. |
| Agregar productos rápidos | 284 | `addquickproductpos` | Controla el ítem "Producto Rápido" del FAB. Ver el bug de sistema documentado abajo (el atajo Shift+F no respeta este permiso). |
| Agregar producto al carrito después de la búsqueda | 666 | `addproducttocaraftersearch` | Con el permiso activo, buscar por código con un único resultado agrega la línea automáticamente al carrito; desactivado, requiere selección manual (el producto igual se puede agregar con un click). |
| Eliminar productos y servicios de la orden al facturar | 221 | `deleteproductinvoice` | Controla el ícono de basurero por línea del carrito, para productos y para servicios. |
| Cambiar precio de venta de un producto - POS | 94 | `changeproductsaleprice` | Controla si el campo de precio de una línea del carrito es editable. Confirmado en vivo: sin el permiso el campo no queda `disabled`, gana la clase `hide` — la fuente de verdad real es visibilidad, no el estado habilitado/deshabilitado. |
| Editar la cantidad de productos en el POS | 331 | `editinputproductquantitypos` | Controla la edición de cantidad fuera del tab POS Facturación — confirmado en Órdenes de Caja y Apartados (Cotizaciones/Productos Externos/Ruteo/Taller comparten el mismo campo de fila pero quedaron fuera de esta suite por alcance/tiempo, no por limitación real). No aplica al tab POS Facturación. |
| Editar nombre de producto en POS | 138 | `editnamefromproducttosale` | Controla el ícono de lápiz (editar nombre) de una línea del carrito. |
| Modificar más de una vez la cantidad del ítem | 329 | `update_quantity_product_pos` | Con el permiso desactivado, tras el primer cambio de cantidad de una línea, un segundo intento de incrementar no la modifica más. |
| Permitir reasignación de responsable de producto en ventas POS | 641 | `allow_reassign_product_responsible_pos` | Controla el botón de responsable (comisión) por línea del carrito; con el permiso activo permite reasignar y guarda correctamente el responsable elegido. |

**Bug de sistema confirmado en vivo (Productos y Líneas)**: con "Agregar productos rápidos" (id 284) desactivado, el atajo de teclado Shift+F sigue abriendo "Producto Rápido" de todas formas, aunque el ítem correspondiente ya haya desaparecido del FAB — el atajo de teclado no pasa por la misma validación de permiso que el botón/ítem del FAB (que sí lo respeta).

**Corrección de automatización confirmada en vivo (Productos y Líneas)**: `PosCrearProducto.abrirCrearProducto()`/`abrirCrearServicio()` tenían un único `click()` sin timeout propio sobre la tarjeta `.product_box_new_item` — mismo mecanismo ya documentado en `PosCore.abrirProductoRapido()`: el banner de permisos de notificación puede reaparecer de forma asíncrona (específico de Firefox) justo entre el cierre del modal de notificaciones y el click, dejando el click esperando indefinidamente su propia accionabilidad (este proyecto no configura `actionTimeout`) y agotando el presupuesto completo del test. Corregido con el mismo patrón de reintentos acotados (5 intentos, cerrando el banner antes de cada uno) ya usado en `abrirProductoRapido()`.

### Facturación, Impresión y Pagos

| Permiso (nombre visible) | id | slug | Comportamiento real confirmado |
|---|---|---|---|
| Ver proformas | 65 | `view_proform` | **No** controla el tab "Proforma/Cotizaciones" (ya exclusivamente gobernado por "Agregar proformas", id 66) — controla la opción "Historial de Proformas" del menú de tres puntos del encabezado (`#view_proform`). |
| Ocultar alerta de ¿Está seguro de realizar pago? | 365 | — | Controla el SweetAlert de confirmación previo a completar una factura: con el permiso activo, el modal de pago factura directo sin confirmación; desactivado, aparece el SweetAlert "¿Está seguro de realizar pago?" y factura solo tras confirmarlo. Sujeto al bug de sistema de toggles intermitentes con 500 ya documentado arriba — confirmado en vivo que el valor igual queda guardado pese al 500. |
| Mostrar total de saldo de crédito pendiente en impresión de factura | 136 | — | Al facturar a crédito con un cliente existente, controla si la impresión muestra la línea real "Crédito pendiente ($): $&lt;monto&gt;" — no usa la palabra "saldo" en el template real, pese al nombre del permiso. |
| Permite realizar ventas a crédito | 271 | — | Controla si el checkbox "(F2) Crédito" del modal de pago (Facturar) existe/puede marcarse. Requiere un cliente real ya seleccionado antes de intentarlo (confirmado en vivo: sin cliente, el checkbox no se marca de todas formas — comportamiento normal de la app, no relacionado con este permiso). |
| Mostrar opción para asignar vendedor al facturar | 537 | — | Controla si el selector de vendedor (`#payment_agent_assigned_chosen`) existe en el modal de pago (Facturar) — distinto del selector homólogo de "Enviar a caja". |

**Permiso no encontrado en el catálogo Web**: "Habilitar opción de impresión de copia de facturas de venta" — buscado exhaustivamente en el catálogo completo de permisos del rol (524 entradas revisadas, incluyendo variantes "impres"/"imprim"/"copia"/"duplicad"/"reimpr"/"segunda"/"recibo"): no existe ninguna fila con ese nombre ni una nota equivalente. El SweetAlert real "¿Desea imprimir copia?" (ya manejado en `PosPayment._confirmarPagoConReintentosDeCaja()`, siempre descartado con "Cancelar") no parece estar gobernado por ningún permiso de rol en este ambiente — puede ser una función exclusiva de la App, una configuración de compañía (no un permiso de rol), o estar removida/renombrada. No se automatizó ningún escenario para este ítem.

**Permiso fuera del alcance de esta suite (módulo distinto)**: "Cambiar vendedor" (id 274) — confirmado en vivo que NO controla la edición del vendedor en "Enviar a caja" del POS (el `<select>` de vendedor quedó igual de habilitado con el permiso activado y desactivado). Su propia nota real ("Permite cambiar de vendedor en la LISTA DE COBRO") apunta al submódulo "Lista de Cobros" del módulo Ventas (`tests/ventas/ventas.page.ts:50`), fuera del alcance de `pos-permisos.spec.ts` (acotado a permisos del POS). Es un permiso real y activo, solo que gobierna una pantalla distinta a la descrita originalmente para este escenario.

**Corrección de automatización confirmada en vivo (Facturación, Impresión y Pagos)**: `PosProforma.abrirCrearProforma()` disparaba el click sobre el botón del menú de acciones (`L.ORDEN_CAJA_MENU_BTN`) con `this.page.evaluate(...)` a nivel de PÁGINA — Playwright no acepta `timeout` para `Page.evaluate()`, así que ese click podía quedar esperando indefinidamente a que el motor JS de una página recién cargada quedara libre para ejecutarlo, agotando el presupuesto completo del test antes de que el bucle de reintento ya existente en el método llegara a actuar. Corregido reemplazando ambos `page.evaluate(...)` de este método por `locator(...).evaluate(fn, undefined, {timeout})`, que sí acepta timeout.

**Escenario sin confirmación estable en esta sesión (ambiente, no automatización)**: "Eliminar proformas" (id 73) mostró señales de comportamiento correcto en corridas parciales, pero no se logró una corrida completa (Activar + Desactivar + Restaurar) limpia dentro de esta sesión — cada intento fue interrumpido por el mismo patrón de latencia genérica del ambiente compartido ya documentado, específicamente en `abrirCrearProforma()` (el modal "Agregar Proforma" no llegó a quedar visible pese a la corrección de automatización de arriba). Ver el informe de la suite para el detalle completo de cada intento.

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
