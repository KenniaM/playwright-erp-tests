import { expect, Locator, Page } from '@playwright/test';
import { BASE_URL } from '../../env.config';
import { PosPage } from './pos.page';
import { L as POS_L } from './pos.locators';

// Page Object del módulo "Roles y permisos" (`/roleAdmin/roleAdmin`), acotado
// a lo que pos-permisos.spec.ts necesita: seleccionar un rol, togglear un
// permiso puntual dentro de él y confirmar el efecto real en el POS. Se
// compone contra PosPage + Page (mismo patrón que PosCrearCliente en
// pos-crear-cliente.page.ts) en vez de integrarse a la fachada PosPage: es
// funcionalidad acotada a un solo flujo de pruebas, no algo que el resto de
// specs de POS necesite.

// ─── URL y datos de dominio ─────────────────────────────────────────────────

export const ROLE_ADMIN_URL = BASE_URL + '/roleAdmin/roleAdmin';

// Módulo "Admin. Cajas" (crear/asignar/eliminar cajas) — accesible desde el
// sidebar Facturar → "Crear y asignar cajas". Ajeno al POS en sí, pero el
// permiso "Agregar caja" solo se valida ahí, así que esta suite navega a su
// URL directamente (mismo criterio que el resto del archivo: nunca se
// hardcodea nada específico de la compañía, solo la ruta real de la app).
export const ADMIN_CAJAS_URL = BASE_URL + '/adminCash/adminCash';

// Reportes → "Cierres de Caja" ("Sistema de Cierres de Caja",
// `/reports/cashReport`) — único lugar real donde se aprueban/rechazan los
// cierres dejados "pendientes de aprobación" por VALIDAR_CIERRE_CAJA.
// Confirmado en vivo leyendo el código fuente real de la página
// (`validate_cash()`, `confirm()`, `change_state()`): las 3 funciones
// disparan el mismo endpoint único `changeStateCashClosure`.
export const CASH_REPORT_URL = BASE_URL + '/reports/cashReport';

// Único rol usado por esta suite (pedido explícitamente): el rol
// "Administrador nivel 1" es hoy el rol Administrador real de la cuenta de
// pruebas (confirmado en vivo: coincide con "(Administrador nivel 1)" que
// muestra el propio header de la app para la cuenta logueada).
export const ROL_ADMINISTRADOR = 'Administrador nivel 1';

// ─── IDs reales de permiso ───────────────────────────────────────────────────
//
// Confirmados en vivo contra el JSON real de `getRolePermissionById` (campo
// `id`, junto a su `slug` interno en inglés) — el catálogo visual (nombre en
// negrita + "Nota") NO es una fuente confiable por sí sola: varias filas
// muestran una "Nota" que corresponde a un permiso completamente distinto
// (p. ej. la fila "Poder cambiar el rol a los usuarios" mostraba la nota
// "Permitir facturar apartados a crédito en el POS"), así que cada id de
// abajo se validó por su efecto real en el POS (togglear y observar), no por
// el texto visible. Ver el informe de la suite para el detalle de qué se
// descartó antes de llegar a cada uno (p. ej. para "Facturar productos
// externos" se probaron primero, sin éxito, los ids 135 "Ver productos
// externos" y 74 "Facturar para todas las compañías").
export const PERMISO = {
  /** slug: (bold "Admin roles") — controla la opción "Permisos del POS" del menú de tres puntos del POS. */
  ADMIN_ROLES: 45,
  /** slug: seepossale — acceso a la sección "Vender"/POS Facturación. */
  VER_VENDER_POS: 3,
  /** slug: possalepayment — habilita el botón/flujo de Facturar (cobro real). */
  REALIZAR_COBRO: 1,
  /** slug: addproform — crear proformas dentro del POS. */
  AGREGAR_PROFORMAS: 66,
  /**
   * slug: saleexternalproduct — oculta la pestaña "Productos Externos"
   * completa. NO controla la opción "Agregar Producto Externo" del menú de
   * tres puntos: esa la controla un permiso aparte, "Agregar producto
   * externo" (id 133, slug addexternalproduct) — confirmado en vivo que son
   * dos efectos independientes, no una sola palanca (ver el informe).
   */
  FACTURAR_PRODUCTOS_EXTERNOS: 134,
  /** slug: see_layaways_in_pos — pestaña "Apartados" del POS. */
  VER_APARTADOS_POS: 552,
  /** slug: importinvoicefromhistoric — pestaña "Importar Facturas" del POS. */
  IMPORTAR_FACTURAS_POS: 131,

  // ─── Productos y Líneas ───────────────────────────────────────────────────
  // Confirmados en vivo con el mismo criterio que el resto de este objeto:
  // id/slug del JSON real de getRolePermissionById, nunca el texto visible a
  // solas — aquí, a diferencia del bloque anterior, el nombre visible y el
  // slug coincidieron exactamente para los 11 (sin el problema de "Nota"
  // cruzada ya documentado arriba), pero igual se confirmó el efecto real en
  // vivo antes de darlos por buenos.

  /** slug: addproduct — tarjeta "Crear Producto" del grid (tab Productos) y atajo Shift+A. */
  AGREGAR_PRODUCTOS: 7,
  /** slug: addservice — tarjeta "Crear Servicio" del grid (tab Servicios). */
  AGREGAR_SERVICIOS_TALLER: 62,
  /** slug: addexternalproduct — opción "Agregar Producto Externo" del menú de tres puntos (NO el tab, ver FACTURAR_PRODUCTOS_EXTERNOS arriba). */
  AGREGAR_PRODUCTO_EXTERNO: 133,
  /** slug: addquickproductpos — ítem "Producto Rápido" del FAB y atajo Shift+F. */
  AGREGAR_PRODUCTOS_RAPIDOS: 284,
  /** slug: addproducttocaraftersearch — auto-agregar al carrito cuando la búsqueda del grid devuelve un único resultado. */
  AGREGAR_PRODUCTO_TRAS_BUSQUEDA: 666,
  /** slug: deleteproductinvoice — ícono de basurero por línea del carrito (productos y servicios). */
  ELIMINAR_PRODUCTOS_AL_FACTURAR: 221,
  /** slug: changeproductsaleprice — campo de precio editable por línea del carrito. */
  CAMBIAR_PRECIO_VENTA_POS: 94,
  /** slug: editinputproductquantitypos — edición de cantidad en tabs distintos a POS Facturación (Órdenes de Caja, Cotizaciones, Apartados, Productos Externos, Ruteo, Taller). */
  EDITAR_CANTIDAD_POS: 331,
  /** slug: editnamefromproducttosale — ícono de lápiz para editar el nombre de una línea del carrito. */
  EDITAR_NOMBRE_PRODUCTO_POS: 138,
  /** slug: update_quantity_product_pos — permite modificar la cantidad de una línea más de una vez (si no, se bloquea tras el primer cambio). */
  MODIFICAR_CANTIDAD_MULTIPLES_VECES: 329,
  /** slug: allow_reassign_product_responsible_pos — botón para reasignar el responsable (comisión) de una línea del carrito. */
  REASIGNAR_RESPONSABLE_PRODUCTO_POS: 641,

  // ─── Facturación, Impresión y Pagos ────────────────────────────────────────
  // Confirmados en vivo con el mismo criterio que el resto de este objeto:
  // localizados primero en el catálogo real (dump filtrado por palabras clave
  // del propio texto pedido), luego confirmado su efecto real en el POS
  // (togglear y observar), nunca solo por el nombre/nota visible. La única
  // excepción real de este bloque es "Habilitar opción de impresión de copia
  // de facturas de venta": no existe en el catálogo Web de este ambiente (524
  // permisos revisados, incluyendo variantes "impres"/"imprim"/"copia"/
  // "duplicad"/"reimpr") — ver el informe de la suite, no se le asigna id.

  /**
   * slug: view_proform (nombre visible "Ver proformas", nota genérica "App
   * TallerAlpha" — igual que AGREGAR_PROFORMAS, no confiable). Confirmado en
   * vivo que NO controla el tab "Proforma/Cotizaciones" del POS (ya
   * exclusivamente gobernado por AGREGAR_PROFORMAS, id 66) — controla la
   * opción "Historial de Proformas" del menú de tres puntos del encabezado
   * (`#view_proform`, mismo nombre que el slug real).
   */
  VER_PROFORMAS: 65,
  /** slug: (nombre exacto "Eliminar proformas") — controla la opción "Eliminar" del menú de tres puntos de una tarjeta de Proforma dentro del POS. */
  ELIMINAR_PROFORMAS: 73,
  /** slug: (nombre exacto) — controla el SweetAlert "¿Esta seguro de realizar pago?" antes de completar una factura. Nota real: "Al activar este permiso, NO se mostrará el mensaje...". */
  OCULTAR_ALERTA_CONFIRMAR_PAGO: 365,
  /** slug: (nombre exacto) — controla si la ventana de impresión de una factura a crédito muestra el saldo pendiente del cliente. */
  MOSTRAR_SALDO_CREDITO_IMPRESION: 136,
  /** slug: (nombre exacto) — controla si el método de pago "Crédito" está disponible en el modal de pago (Facturar). */
  PERMITE_VENTAS_CREDITO: 271,
  // "Cambiar vendedor" (id 274, nombre visible) NO se incluye aquí: es un
  // permiso real y activo en el catálogo, pero confirmado en vivo que NO
  // controla nada dentro del POS (el `<select>` de vendedor de "Enviar a
  // caja" quedó igual de habilitado con el permiso activado y desactivado).
  // Su propia nota ("Permite cambiar de vendedor en la LISTA DE COBRO")
  // apunta al submódulo real "Lista de Cobros" de Ventas (ver
  // tests/ventas/ventas.page.ts:50), fuera del alcance de este archivo — ver
  // el informe de la suite para la evidencia completa.
  /** slug: (nombre exacto, sin nota) — controla si el selector de vendedor existe en el modal de pago (Facturar), distinto del de "Enviar a caja". */
  MOSTRAR_VENDEDOR_AL_FACTURAR: 537,

  // ─── Caja (módulo "Admin. Cajas" + modal "Detalle de Cierre" del POS) ──────
  // Confirmados en vivo con el mismo criterio que el resto de este objeto:
  // catálogo real (id + Nota del propio DOM — 4 de estos 6 NO aparecen en el
  // JSON de getRolePermissionById, solo en el DOM servido; ver el informe de
  // la suite) y efecto real observado (togglear y comprobar), nunca solo por
  // el nombre visible.

  /** slug: addcash — botón "Crear caja" + su input, en Admin. Cajas (`/adminCash/adminCash`). */
  AGREGAR_CAJA: 41,
  /** slug: seecashmovementreport — ítem "(F8) Historial Mov. de Caja" del menú "Caja" del POS + acceso directo a `/cash_movement/movements`. */
  VER_REPORTE_MOVIMIENTOS_CAJA: 83,
  /** (no en JSON de getRolePermissionById) — controla la píldora "Total general" del modal "Detalle de Cierre". */
  OCULTAR_TOTAL_GENERAL_CIERRE_CAJA: 558,
  /** slug: hidePrintCashClosing — controla el popup de impresión que se abre automáticamente tras confirmar "Cerrar Caja" (no hay ninguna opción visible dentro del propio modal). */
  OCULTAR_OPCION_IMPRESION_CIERRE_CAJA: 571,
  /** (no en JSON de getRolePermissionById) — con el permiso activo, "Cerrar Caja" queda bloqueado mientras existan órdenes de Taller sin facturar (SweetAlert con el texto real sin traducir "Not valid!"). */
  RESTRINGIR_CIERRE_ORDENES_TALLER_SIN_FACTURAR: 575,
  /** slug: seecashprofitsummarycashclosuredetails — controla el tile "Utilidad" del modal "Detalle de Cierre". */
  VER_RESUMEN_UTILIDAD_CIERRE_CAJA: 619,
  /**
   * (no en JSON de getRolePermissionById) — confirmado en vivo (comparación
   * visual directa, screenshots de ambos estados) que, activo, simplifica
   * radicalmente el modal "Detalle de Cierre": quedan solo 2 tabs de moneda
   * ("$ - General"/"$ - Facturas", de 8 normalmente) y desaparecen la fila de
   * KPIs (Ventas Totales/Descuento/Impuestos/Utilidad), "Resumen de cierre",
   * "Mostrar Reporte Avanzado" y los campos "Total"/"Diferencia" de "Datos de
   * Cierre" — el cajero solo puede ingresar un conteo a ciegas, sin ver
   * ningún monto esperado. El cierre generado con este permiso activo queda
   * "pendiente de aprobación" (ver ABRIR_CAJA_PENDIENTE_APROBACION y
   * CAMBIAR_ESTADO_CIERRES_CAJA) — aprobado/rechazado desde Reportes →
   * "Cierres de Caja" (`/reports/cashReport`).
   */
  VALIDAR_CIERRE_CAJA: 673,
  /**
   * slug: seeopenboxstillpendingapproval — solo tiene efecto observable
   * cuando VALIDAR_CIERRE_CAJA está activo (confirmado: es el permiso que
   * deja cierres "pendientes de aprobación" al cerrar caja). Con
   * VALIDAR_CIERRE_CAJA activo: este permiso activo permite abrir una caja
   * nueva aunque el cierre anterior siga sin aprobar; desactivado, la
   * apertura queda bloqueada hasta que alguien con CAMBIAR_ESTADO_CIERRES_CAJA
   * apruebe el cierre pendiente en `/reports/cashReport`.
   */
  ABRIR_CAJA_PENDIENTE_APROBACION: 567,
  /**
   * (no en JSON de getRolePermissionById; permiso no pedido originalmente,
   * hallazgo de esta investigación) — controla los botones "Aceptar"/
   * "Rechazar" de un cierre pendiente en Reportes → "Cierres de Caja"
   * (`/reports/cashReport`, "Sistema de Cierres de Caja"). Único mecanismo
   * real para resolver un cierre dejado pendiente por VALIDAR_CIERRE_CAJA.
   */
  CAMBIAR_ESTADO_CIERRES_CAJA: 674,
} as const;

export type PermisoId = typeof PERMISO[keyof typeof PERMISO];

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  // Cada test hace 3 idas y vueltas completas a "Roles y permisos" (activar,
  // desactivar, restaurar) más 2-3 recargas del POS — presupuesto amplio
  // para no competir con la latencia real del ambiente compartido (confirmado
  // en vivo que cargarPosDesdeDashboard() por sí solo puede tardar varios
  // minutos bajo carga sostenida del ambiente QA compartido — mismo tipo de
  // degradación ya documentado en pos.types.ts, TIMEOUTS.TEST_CON_RECUPERACION).
  //
  // Ampliado de 480_000 a 600_000 tras confirmar en vivo (corrida completa de
  // la suite "Productos y Líneas", 2026-07-30) que, bajo un pico real de
  // carga del ambiente compartido, 3 de 11 tests agotaron los 480s completos
  // — no en el mismo punto cada vez (una en medio de irARolesYPermisos(), otra
  // en el paso "Restaurar", otra en un test simple sin ninguna carga de Orden/
  // Apartado de por medio), lo que descarta un cuello de botella puntual de
  // automatización y confirma que es la variabilidad ya documentada del
  // ambiente. Los mismos 3 tests, corridos de nuevo en aislado minutos
  // después, pasaron en 40-90s — el margen adicional no oculta ninguna
  // condición de carrera real, solo absorbe el pico observado.
  TEST: 600_000,
  NAVIGATE: 60_000,
  // El listado de permisos del rol seleccionado se puebla vía AJAX
  // (getRolePermissionById) tras hacer click en la fila del rol.
  PERMISOS_LOAD: 20_000,
  // Cada checkbox dispara su propio guardado AJAX individual (SetPermissionToRole
  // al activar, deletePermissionRole al desactivar) — no existe un botón
  // "Guardar" para el listado completo.
  GUARDADO: 10_000,
  // Mismo valor que TIMEOUTS.PRINT_POPUP de pos.types.ts — este módulo no lo
  // reutiliza directamente (cada módulo define su propio TIMEOUTS, ver
  // CLAUDE.md) porque necesitaría importar dos objetos distintos ambos
  // llamados TIMEOUTS. Usado por la carrera propia de facturación de los
  // escenarios de "Facturación, Impresión y Pagos" (popup de impresión, modal
  // Abrir Caja, SweetAlert de confirmación de pago).
  PRINT_POPUP: 15_000,
} as const;

// ─── Locators ─────────────────────────────────────────────────────────────────

const L = {
  LISTA_ROLES: '#sections_content',
  FILA_ROL_NOMBRE: '.section_item_name',
  TABLA_PERMISOS: '#table_list_role',
  CHECKBOXES_PERMISOS: '#table_list_role .sub_section_checkbox',
  CHECKBOX: (id: number) => `#sub_section_id_${id}`,

  // "Admin. Cajas" (`/adminCash/adminCash`) — confirmado en vivo volcando el
  // DOM real: el botón real usa onclick="addCash()" (coincide con el slug
  // real del permiso, addcash), más estable que el texto visible "Crear caja".
  ADMIN_CAJAS_BTN_CREAR: 'button[onclick="addCash()"]',
  ADMIN_CAJAS_INPUT_NOMBRE: 'input[placeholder="Nombre de caja a agregar"]',
} as const;

// ─── Page Object ──────────────────────────────────────────────────────────────

export class PosPermisos {
  constructor(private readonly pos: PosPage, private readonly page: Page) {}

  /** Fila (nombre) de un rol dentro del panel "1 Roles". */
  filaRol(nombre: string): Locator {
    return this.page.locator(L.LISTA_ROLES).locator(L.FILA_ROL_NOMBRE, { hasText: nombre });
  }

  /**
   * Lee el id numérico real del rol desde el atributo `onclick="view_role(N)"`
   * de su fila — necesario únicamente para `establecerPermisoViaApiDirecta()`
   * (ver su comentario). Debe llamarse mientras la página "Roles y permisos"
   * todavía es accesible (p. ej. en el paso "activar" de cada escenario,
   * antes de desactivar nada) — nunca se hardcodea el id de "Administrador
   * nivel 1": puede variar por ambiente.
   */
  async obtenerRoleId(nombreRol: string = ROL_ADMINISTRADOR): Promise<number> {
    const onclick = await this.filaRol(nombreRol).locator('xpath=..').getAttribute('onclick');
    const match = onclick?.match(/view_role\((\d+)\)/);
    if (!match) {
      throw new Error(`No se pudo leer el id real del rol "${nombreRol}" desde su atributo onclick.`);
    }
    return Number(match[1]);
  }

  /** Locator de un checkbox de permiso puntual por su id numérico real. */
  checkboxPermiso(id: number): Locator {
    return this.page.locator(L.CHECKBOX(id));
  }

  /**
   * Navega a "Roles y permisos" y selecciona un rol, esperando la respuesta
   * real de `getRolePermissionById` (no un timeout fijo) antes de considerar
   * el listado de permisos listo para leer/togglear. Reintenta la navegación
   * completa unas pocas veces: confirmado en vivo que, bajo la misma
   * inestabilidad de red que documenta el resto de la suite para el POS, la
   * fila del rol puede tardar en aparecer tras el primer `goto()`.
   */
  async irARolesYPermisos(nombreRol: string = ROL_ADMINISTRADOR) {
    const MAX_INTENTOS = 3;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      await this.page.goto(ROLE_ADMIN_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });

      const fila = this.filaRol(nombreRol);
      const filaVisible = await fila
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      if (!filaVisible) continue;

      const respuestaPermisos = this.page
        .waitForResponse((res) => res.url().includes('getRolePermissionById'), { timeout: TIMEOUTS.PERMISOS_LOAD })
        .catch(() => null);
      await fila.click();
      await respuestaPermisos;

      const cargado = await expect
        .poll(async () => this.page.locator(L.CHECKBOXES_PERMISOS).count(), { timeout: TIMEOUTS.PERMISOS_LOAD })
        .toBeGreaterThan(0)
        .then(() => true)
        .catch(() => false);
      if (cargado) {
        // Margen real, no cosmético: confirmado en vivo que el atributo
        // `checked` de cada fila puede seguir asentándose un instante
        // después de que las filas ya existen en el DOM (mismo mecanismo de
        // carrera ya documentado en pos-navegacion.page.ts para el menú de
        // tres puntos) — leer el estado demasiado pronto puede reportar
        // `false` para un permiso que en realidad está activo.
        await expect.poll(
          async () => this.checkboxPermiso(PERMISO.VER_VENDER_POS).isChecked().catch(() => null),
          { timeout: 5_000 }
        ).not.toBeNull();
        return;
      }
    }
    throw new Error(
      `No se pudo cargar el listado de permisos de "${nombreRol}" tras ${MAX_INTENTOS} intentos.`
    );
  }

  /** Estado actual (activo/inactivo) de un permiso ya cargado (irARolesYPermisos() previo). */
  async permisoActivo(id: number): Promise<boolean> {
    return this.checkboxPermiso(id).isChecked();
  }

  /**
   * Activa o desactiva un permiso puntual del rol ya seleccionado y espera la
   * respuesta AJAX real de guardado — `SetPermissionToRole` al activar,
   * `deletePermissionRole` al desactivar (confirmado en vivo que son dos
   * endpoints distintos, no uno solo con un flag). No hace nada si el
   * permiso ya está en el valor pedido (evita un guardado innecesario y el
   * error de sistema documentado abajo).
   *
   * El checkbox real usa un widget "slider" (mismo patrón que
   * `PanelControlPage.marcarCheckbox()` en configuraciones/panel-control.page.ts):
   * el `<input>` queda fuera del flujo visual del layout, así que
   * `setChecked()`/`click()` normales de Playwright fallan con "Element is
   * outside of the viewport" — se ajusta `.checked` y se disparan los
   * eventos `click`/`change` reales igual que ese helper ya existente.
   *
   * Bug de sistema confirmado en vivo (no oculto por esta suite): bajo
   * ciertas condiciones el propio backend puede responder 500 con un
   * `FatalErrorException` real (`Call to a member function attachPermission()
   * on null`, `RoleAdminController.php:58`) al togglear un permiso —
   * observado de forma intermitente y sin un patrón 100% aislado, pero el
   * valor final SÍ queda guardado correctamente pese al error (confirmado
   * releyendo el estado con una navegación completamente nueva). Por eso
   * este método no falla duro ante un status distinto de 200: solo lo
   * registra y dejar que `esperarPermiso()` (usado por quien llama) sea la
   * fuente de verdad real sobre si el cambio quedó aplicado.
   */
  async establecerPermiso(id: number, activo: boolean) {
    const actual = await this.permisoActivo(id);
    if (actual === activo) return;

    const respuesta = this.page.waitForResponse(
      (res) => res.url().includes('SetPermissionToRole') || res.url().includes('deletePermissionRole'),
      { timeout: TIMEOUTS.GUARDADO }
    );
    await this.checkboxPermiso(id).evaluate((el: HTMLInputElement, checked) => {
      el.checked = checked;
      el.dispatchEvent(new Event('click', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, activo);
    const res = await respuesta;
    if (res.status() !== 200) {
      console.log(`[PosPermisos.establecerPermiso] id=${id} -> ${activo}: respuesta ${res.status()} (ver comentario del método — puede persistir igual)`);
    }
  }

  /**
   * Llama directamente el endpoint AJAX real de guardado (`SetPermissionToRole`/
   * `deletePermissionRole`) por `fetch`, sin pasar por la UI de "Roles y
   * permisos". Es la ÚNICA vía confiable para reactivar `PERMISO.ADMIN_ROLES`
   * una vez desactivado para el propio rol de la cuenta de pruebas.
   *
   * Bug de sistema confirmado en vivo (evidencia completa en el informe de la
   * suite): apenas se desactiva "Admin roles" para el rol de la cuenta
   * logueada, la PÁGINA `/roleAdmin/roleAdmin` completa empieza a responder
   * "NO AUTORIZADO — Póngase en contacto con un administrador para validar
   * acceso" para esa misma cuenta — el permiso no solo oculta la opción
   * "Permisos del POS" del POS, también bloquea el acceso a todo el módulo
   * de administración de roles. Sin embargo, el endpoint AJAX que realmente
   * guarda el cambio (`SetPermissionToRole`) NO aplica esa misma validación:
   * confirmado en vivo que sigue respondiendo 200 incluso con la página ya
   * bloqueada — una inconsistencia real de autorización entre la ruta de
   * página y su propio endpoint, no una característica documentada. Se usa
   * exclusivamente como red de seguridad de esta suite (nunca como mecanismo
   * normal de la suite) para no depender de una UI que este mismo permiso
   * puede bloquear.
   */
  async establecerPermisoViaApiDirecta(roleId: number, permisoId: number, activo: boolean) {
    const endpoint = activo ? 'SetPermissionToRole' : 'deletePermissionRole';
    const resultado = await this.page.evaluate(
      async ({ base, endpoint, roleId, permisoId }) => {
        const body = new URLSearchParams({ role_id: String(roleId), permission_id: String(permisoId) });
        const res = await fetch(`${base}/roleAdmin/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
          body: body.toString(),
          credentials: 'include',
        });
        return { status: res.status, text: await res.text() };
      },
      { base: BASE_URL, endpoint, roleId, permisoId }
    );
    console.log(`[PosPermisos.establecerPermisoViaApiDirecta] ${endpoint} role=${roleId} permiso=${permisoId} -> ${resultado.status} ${resultado.text.slice(0, 200)}`);
  }

  /**
   * Confirma con una navegación COMPLETAMENTE NUEVA (nuevo `irARolesYPermisos()`,
   * no solo releer el checkbox ya en pantalla) que un permiso quedó en el
   * valor esperado. Es la única fuente de verdad real tras `establecerPermiso()`
   * — necesaria porque el toggle puede reportar un error de red (ver el bug
   * de sistema documentado ahí) sin que eso signifique que el valor no se
   * guardó.
   */
  async esperarPermiso(nombreRol: string, id: number, activo: boolean) {
    await expect(async () => {
      await this.irARolesYPermisos(nombreRol);
      expect(await this.permisoActivo(id)).toBe(activo);
    }).toPass({ timeout: TIMEOUTS.PERMISOS_LOAD * 2 });
  }

  // ─── Puente hacia el POS (para validar el efecto de cada permiso) ──────────

  /**
   * Recarga el POS ya cargado (mismo mecanismo que `irAlPos()` de PosCore, sin
   * pasar por Dashboard de nuevo) para que refleje un cambio de permiso recién
   * guardado. Confirmado en vivo: un simple recargo de la página, en la MISMA
   * sesión, ya alcanza — no hace falta cerrar sesión ni volver a autenticar
   * para que la app reevalúe los permisos actuales del usuario.
   */
  async recargarPos() {
    await this.pos.irAlPos();
    await this.pos.cerrarOverlaysConocidos().catch(() => {});
  }

  /**
   * Dispara un ESC "real" contra el POS despachando un `KeyboardEvent` manual
   * con `keyCode`/`which` definidos, en vez de `page.keyboard.press('Escape')`.
   *
   * Corrección de automatización confirmada en vivo (no un bug del sistema):
   * el botón real "FACTURAR (ESC)" solo reacciona a un evento cuyo
   * `keyCode`/`which` legacy valga 27 — el `KeyboardEvent` sintético que
   * genera `page.keyboard.press('Escape')` no lo satisface (confirmado
   * comparando ambos: con `keyboard.press('Escape')` el modal de pago nunca
   * aparece; con este despacho manual, sí, de forma consistente). El listener
   * real de la app es legacy (`e.keyCode`/`e.which`, no `e.key`), así que se
   * define esa propiedad explícitamente en el evento antes de despacharlo.
   */
  async presionarEscReal() {
    await this.page.evaluate(() => {
      for (const type of ['keydown', 'keyup']) {
        const evt = new KeyboardEvent(type, { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
        Object.defineProperty(evt, 'keyCode', { get: () => 27 });
        Object.defineProperty(evt, 'which', { get: () => 27 });
        document.dispatchEvent(evt);
      }
    });
  }

  // ─── Caja: "Admin. Cajas" (`/adminCash/adminCash`) ─────────────────────────

  /** Navega a "Admin. Cajas", donde vive "Crear caja" (permiso AGREGAR_CAJA). */
  async irAAdminCajas() {
    await this.page.goto(ADMIN_CAJAS_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }

  /** Locator del botón "Crear caja" en Admin. Cajas (requiere irAAdminCajas() antes). */
  get botonCrearCaja(): Locator {
    return this.page.locator(L.ADMIN_CAJAS_BTN_CREAR);
  }

  /** Locator del input "Nombre de caja a agregar" en Admin. Cajas. */
  get inputNombreCaja(): Locator {
    return this.page.locator(L.ADMIN_CAJAS_INPUT_NOMBRE);
  }

  // ─── Caja: modal "Detalle de Cierre" del POS ───────────────────────────────

  /**
   * Intenta cerrar la caja ya abierta (modal "Detalle de Cierre" visible, con
   * el formulario ya completado vía `pos.completarFormularioCerrarCaja()`)
   * SIN asumir que el cierre tendrá éxito — a diferencia de
   * `PosCierreCaja.confirmarCerrarCaja()` (pensado para el resto de la suite,
   * que siempre espera un cierre exitoso). Necesario para "Restringir cierre
   * de caja con órdenes de taller sin facturar": confirmado en vivo que, con
   * el permiso activo y órdenes de Taller pendientes, el SweetAlert de
   * confirmación de siempre aparece igual pero el cierre NO se completa — el
   * modal "Detalle de Cierre" permanece abierto tras confirmarlo. Devuelve
   * `true` si el cierre quedó bloqueado (modal sigue visible), `false` si se
   * completó con éxito (mismo resultado que `confirmarCerrarCaja()`).
   */
  async intentarCerrarCajaYVerificarSiQuedoBloqueada(): Promise<boolean> {
    await expect(this.pos.modalCerrarCaja).toBeVisible();
    await this.pos.modalCerrarCaja.locator(POS_L.CIERRE_BTN_CERRAR).click({ timeout: 10_000 });

    const alerta = this.page.locator('.sweet-alert.visible');
    await alerta.waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP });
    await alerta.locator('button.confirm').click();

    return this.pos.modalCerrarCaja
      .waitFor({ state: 'hidden', timeout: TIMEOUTS.PRINT_POPUP })
      .then(() => false)
      .catch(() => true);
  }

  // ─── Caja: aprobación de cierres pendientes (Reportes → Cierres de Caja) ───

  /** Navega a Reportes → "Cierres de Caja" (`/reports/cashReport`). */
  async irAReporteCierresDeCaja() {
    await this.page.goto(CASH_REPORT_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }

  /**
   * Fila real de un cierre por su id numérico (`tr.tr-<id>`, confirmado en
   * vivo leyendo el DOM real — la misma clase que usa `change_state()` para
   * actualizar la fila tras aprobar/rechazar).
   */
  filaCierre(cashId: number): Locator {
    return this.page.locator(`.tr-${cashId}`);
  }

  /**
   * Botón "Validar" (ícono de reloj, `title="Validar"`) de un cierre
   * pendiente — solo existe en filas con la clase `pending-tr`. Dispara
   * `validate_cash(cashId, this)`, que abre `#dialog_validate_cash`.
   */
  botonValidarCierre(cashId: number): Locator {
    return this.filaCierre(cashId).locator('button.btn-cash-state');
  }

  /**
   * Aprueba un cierre pendiente propio (nunca debe usarse contra un cierre
   * ajeno — la cola de "Cierres pendientes" es global y compartida con
   * cualquier otro usuario real del ambiente). Reproduce el flujo real
   * completo confirmado leyendo el código fuente de la página: clic en el
   * botón "Validar" → `#dialog_validate_cash` → botón `.validate-btn-accept`
   * → SweetAlert de confirmación → tras `changeStateCashClosure`, un segundo
   * SweetAlert de éxito.
   */
  async aprobarCierrePendiente(cashId: number) {
    try {
      await this.botonValidarCierre(cashId).click({ timeout: 10_000 });

      const dialogo = this.page.locator('#dialog_validate_cash');
      await expect(dialogo).toBeVisible({ timeout: 20_000 });
      await dialogo.locator('.validate-btn-accept').click({ timeout: 10_000 });

      const confirmacion = this.page.locator('.sweet-alert.visible');
      await confirmacion.waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP });

      const respuestaPromise = this.page.waitForResponse(
        (res) => res.url().includes('changeStateCashClosure'),
        { timeout: TIMEOUTS.GUARDADO }
      ).catch(() => null);
      await confirmacion.locator('button.confirm').click();
      await respuestaPromise;

      // Segundo SweetAlert real ("¡Listo! El cambio se guardó correctamente"), descartado si aparece.
      const exito = this.page.locator('.sweet-alert.visible');
      await exito.waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP }).catch(() => {});
      await exito.locator('button.confirm').click({ timeout: 5_000 }).catch(() => {});
    } catch (e) {
      // Bug de sistema confirmado en vivo (intermitente bajo carga del
      // ambiente compartido): `validate_cash()` hace un XHR SÍNCRONO
      // (`async:false`) a `validateCash` antes de mostrar
      // `#dialog_validate_cash` — si esa llamada nunca responde (o falla en
      // silencio), el modal jamás aparece pese a que el click sí llegó al
      // botón real (confirmado 2/2 en vivo). Red de seguridad: llamar
      // directamente el mismo endpoint que usa `change_state()`
      // (`changeStateCashClosure`, confirmado en vivo con `option=1` ->
      // respuesta `"1"` real), igual criterio que
      // `establecerPermisoViaApiDirecta()` para ADMIN_ROLES.
      console.log(`[aprobarCierrePendiente] flujo de UI falló (${e}), usando la API directa como red de seguridad`);
      await this.aprobarCierrePendienteViaApiDirecta(cashId);
    }
  }

  /**
   * Llama directamente `changeStateCashClosure` (mismo endpoint real que usa
   * `change_state()` del propio código fuente de la página) sin pasar por el
   * diálogo `#dialog_validate_cash`. Ver el comentario de
   * `aprobarCierrePendiente()` — únicamente como red de seguridad cuando el
   * flujo de UI falla, nunca como mecanismo normal de la suite.
   */
  async aprobarCierrePendienteViaApiDirecta(cashId: number) {
    const resultado = await this.page.evaluate(
      async ({ base, cashId }) => {
        // @ts-expect-error _token vive en un input real de la página, no expuesto por tipos
        const token = document.querySelector('#_token')?.value ?? document.querySelector('meta[name="csrf-token"]')?.content;
        const body = new URLSearchParams({ _token: token, cash_id: String(cashId), option: '1', rejected_option: '1' });
        const res = await fetch(`${base}/reports/changeStateCashClosure`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
          body: body.toString(),
          credentials: 'include',
        });
        return { status: res.status, text: await res.text() };
      },
      { base: BASE_URL, cashId }
    );
    console.log(`[aprobarCierrePendienteViaApiDirecta] cash_id=${cashId} -> ${resultado.status} ${resultado.text.slice(0, 200)}`);
  }

  // ─── Alternativa rápida: modal "Permisos del POS" (menú de tres puntos) ───
  //
  // Confirmado en vivo (sugerido por el usuario tras observar que
  // `irARolesYPermisos()` — navegación completa a `/roleAdmin/roleAdmin` y
  // vuelta al POS — puede fallar de forma intermitente bajo carga del
  // ambiente compartido): existe un modal equivalente ("Permisos del POS",
  // opción del menú de tres puntos del encabezado del POS, ya usado para
  // confirmar PERMISO.ADMIN_ROLES) que edita los MISMOS ids de permiso para
  // "Administrador nivel 1" SIN salir de la página del POS — evita por
  // completo el ciclo goto()/esperar AJAX/volver que sí requiere el flujo de
  // `/roleAdmin/roleAdmin`. Confirmado en vivo: `data-role-id="1"` es
  // exactamente "Administrador nivel 1" (primera columna del grid,
  // verificado leyendo su atributo `title` real). Se usa únicamente en el
  // escenario de "Validar cierre de caja"/"Abrir caja aún pendiente de
  // aprobación"/"Cambiar estado de cierres de caja" (el más sensible a la
  // latencia de navegación, por requerir generar y aprobar un cierre real
  // real de por medio) — el resto de esta suite sigue usando
  // `irARolesYPermisos()`/`establecerPermiso()`, ya probados de forma
  // extensa y estable.

  /** Abre "Permisos del POS" desde el menú de tres puntos del encabezado (requiere el POS ya cargado). */
  async abrirModalPermisosDelPos() {
    await this.pos.abrirMenuTresPuntos();
    await this.page.locator('ul.mdl-menu[for="demo-menu-lower-left"]').getByText('Permisos del POS').click({ timeout: 10_000 });
    await expect(this.page.locator('.pos-permission-modal')).toBeVisible({ timeout: TIMEOUTS.NAVIGATE });
  }

  /** Expande la sección "Caja" del modal ya abierto (acordeón, carga sus filas vía AJAX la primera vez). */
  async expandirSeccionCajaEnModalPos() {
    const modal = this.page.locator('.pos-permission-modal');
    const yaExpandida = await modal.evaluate((el) => el.textContent?.includes('Agregar caja') ?? false);
    if (yaExpandida) return;
    await modal.locator('text=Caja').first().click({ timeout: 10_000 });
    await expect(modal).toContainText('Agregar caja', { timeout: TIMEOUTS.PERMISOS_LOAD });
  }

  /** Cierra el modal "Permisos del POS". */
  async cerrarModalPermisosDelPos() {
    await this.page.locator('#pos-permission-close').click({ timeout: 5_000 }).catch(() => {});
    await expect(this.page.locator('.pos-permission-modal')).toBeHidden({ timeout: 5_000 }).catch(() => {});
  }

  /** Checkbox real de un permiso puntual para "Administrador nivel 1" (`data-role-id="1"`) dentro de la sección "Caja" ya expandida. */
  checkboxPermisoEnModalPos(id: number): Locator {
    return this.page.locator(`input.pos-permission-switch-input[data-permission-id="${id}"][data-role-id="1"]`);
  }

  /**
   * Activa/desactiva un permiso dentro del modal "Permisos del POS", sin
   * navegar fuera del POS. Mismo mecanismo que `establecerPermiso()` (widget
   * "slider": el `<input>` real queda fuera del flujo visual, así que
   * `click()` normal falla con "element is not visible" — se ajusta
   * `.checked` y se disparan los eventos reales, igual que el resto de la
   * suite ya hace para este mismo patrón de checkbox-slider).
   */
  async establecerPermisoEnModalPos(id: number, activo: boolean) {
    const checkbox = this.checkboxPermisoEnModalPos(id);
    const actual = await checkbox.isChecked();
    if (actual === activo) return;

    const respuesta = this.page.waitForResponse(
      (res) => res.url().includes('SetPermissionToRole') || res.url().includes('deletePermissionRole'),
      { timeout: TIMEOUTS.GUARDADO }
    ).catch(() => null);
    await checkbox.evaluate((el: HTMLInputElement, checked) => {
      el.checked = checked;
      el.dispatchEvent(new Event('click', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, activo);
    await respuesta;
  }
}
