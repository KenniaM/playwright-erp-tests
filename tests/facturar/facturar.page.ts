import { expect, Locator, Page } from '@playwright/test';
import { PosPage } from './pos/pos.page';
import { L } from './pos/pos.locators';
import { DASHBOARD_URL, PESTANA_POS_PROFORMA, PESTANAS_POS_A_RECORRER } from './pos/pos.types';

// TIMEOUTS propio de este módulo (ver convención documentada en CLAUDE.md:
// cada módulo define el suyo). Este es puramente de navegación — no
// necesita el resto de categorías de tests/facturar/pos/pos.types.ts —, así
// que reutiliza los mismos valores ya confirmados en vivo para
// Dashboard→POS (NAVIGATE/PAYMENT_MODAL de ese archivo) en vez de inventar
// otros nuevos sin evidencia propia.
export const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 90_000,
  MODAL:    15_000,
} as const;

// Reutilizada de PESTANAS_POS_A_RECORRER (tests/facturar/pos/pos.types.ts) —
// mismo dato ya confirmado en vivo, no se duplica su definición aquí.
const PESTANA_ORDENES_CAJA = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Órdenes de caja')!;

/**
 * Page Object de navegación pura para los submódulos del sidebar
 * "FACTURAR" del ERP (patrón de flujo de negocio del repo: este módulo SÍ
 * necesita resolver compañía/overlays reales, así que no encaja en el
 * patrón 1 "tabla de submódulos" descrito en CLAUDE.md — ver el comentario
 * de cada método para la investigación en vivo detrás de cada uno).
 *
 * No integrado a la fachada PosPage (mismo criterio ya usado por
 * PosCrearCliente, ver CLAUDE.md → "Composición sobre herencia"): se
 * compone directo contra PosPage + Page, reutilizando todo lo que la
 * fachada ya expone en vez de duplicar navegación/manejo de overlays.
 */
export class FacturarPage {
  constructor(private readonly pos: PosPage, private readonly page: Page) {}


  // ─── Crear factura ────────────────────────────────────────────────────────

  /**
   * Abre "Crear factura" (link real del submenú "FACTURAR" del Dashboard,
   * `onclick="get_company_pos_select(1)"`, confirmado en vivo) — es
   * EXACTAMENTE el mismo punto de entrada que ya usa el resto de la suite de
   * POS (`PosPage.cargarPosDesdeDashboard()` → `PosCore._irAlPosResolviendoCompania()`),
   * así que se reutiliza tal cual, sin duplicar la resolución de
   * compañía/overlays.
   */
  async abrirCrearFactura() {
    await this.pos.cargarPosDesdeDashboard();
  }


  // ─── Órdenes de caja ──────────────────────────────────────────────────────

  /**
   * Abre "Ordenes de caja" (mismo submenú "FACTURAR",
   * `onclick="get_company_pos_select(2)"`, confirmado en vivo). A diferencia
   * de `PosPage.abrirOrdenesCaja()` (que depende del tab interno del POS,
   * `#btn_cashier_option`), este link navega DIRECTO al listado de Órdenes
   * de Caja: `#content_invoice_order_list` ya queda visible al aterrizar,
   * sin ningún tab que clickear — confirmado en vivo inspeccionando el DOM
   * real tras el click (el tab `#btn_cashier_option` ni siquiera existe en
   * este camino de entrada). Reutiliza `PosCore.irAlPosConOpcion()`
   * (generalización de `_irAlPosResolviendoCompania()`, mismo mecanismo real
   * de carrera modal-vs-navegación-directa) en vez de duplicar esa lógica.
   *
   * Hallazgo real de ambiente confirmado en vivo (ver facturar-orden-caja.spec.ts
   * para la evidencia completa): esta página SÍ permite cargar una Orden de
   * Caja al carrito (`PosPage.cargarPrimeraOrdenCajaDisponible()` funciona
   * igual), pero NO incluye el botón "Facturar" (`#btn_pay_sale`) en ningún
   * punto — a diferencia de entrar por "Crear factura" y usar el tab interno
   * `#btn_cashier_option`, que sí lo tiene. No es un problema de este método
   * ni de ningún selector: es una limitación real de esta ruta de entrada en
   * el ERP.
   */
  async abrirOrdenesDeCaja() {
    await this.pos.irAlPosConOpcion(2);
    await expect(
      this.page.locator(PESTANA_ORDENES_CAJA.contenedorContenido),
      'Tras entrar a "Ordenes de caja" vía el link directo de Facturación, el listado de órdenes no quedó visible'
    ).toBeVisible({ timeout: TIMEOUTS.MODAL });
  }


  // ─── Cotizaciones ─────────────────────────────────────────────────────────

  /**
   * Abre "Cotizaciones" (mismo submenú "FACTURAR",
   * `onclick="get_company_pos_select(5)"`, confirmado en vivo). A diferencia
   * de "Ordenes de caja", este SÍ aterriza sobre el tab "Proforma /
   * Cotizaciones" del POS (`PESTANA_POS_PROFORMA`, `#btn_proform_option`) YA
   * activo — confirmado en vivo (`.btn_tab_active` presente en ese botón
   * apenas carga la página, sin click adicional).
   *
   * Se llama a `visitarPestanaPos()` de todas formas (nunca duplicando su
   * lógica): confirmado en vivo que es seguro incluso con la pestaña ya
   * activa — la aplicación vuelve a disparar el mismo AJAX real de cambio de
   * pestaña sin importar el estado previo (2.2s reales medidos), así que no
   * hay ningún riesgo de que quede esperando un evento que nunca llega. Se
   * mantiene como paso explícito (no solo un `expect` de contenido) porque
   * es el mismo mecanismo ya validado en el resto de la suite de POS para
   * confirmar que la pestaña terminó de cargar su contenido real.
   *
   * Mismo hallazgo real de ambiente que "Ordenes de caja" (ver el comentario
   * de `abrirOrdenesDeCaja()` y facturar-cotizaciones.spec.ts para la
   * evidencia completa): esta página permite cargar una Cotización al
   * carrito, pero NO incluye el botón "Facturar" (`#btn_pay_sale`) — a
   * diferencia del tab interno "Proforma / Cotizaciones" alcanzado desde
   * "Crear factura", que sí lo tiene (pos-proforma.spec.ts).
   */
  async abrirCotizaciones() {
    await this.pos.irAlPosConOpcion(5);
    await this.pos.visitarPestanaPos(PESTANA_POS_PROFORMA);
  }


  // ─── Despacho de órdenes de caja ──────────────────────────────────────────

  /**
   * Abre "Despacho órdenes de caja" — a diferencia de los 3 anteriores, NO
   * usa `get_company_pos_select()`: es un `<a href=".../cashOrderDispath/dispath">`
   * real (confirmado en vivo inspeccionando el DOM), una página completamente
   * distinta al POS, sin selección de compañía ni modal de por medio. Se
   * navega vía Dashboard + click real sobre el link (nunca construyendo la
   * URL a mano, mismo criterio que el resto de la suite), reutilizando
   * `_irADashboardYExpandirFacturar()` para desplegar el submenú "FACTURAR"
   * si está colapsado.
   */
  async abrirDespachoDeOrdenesCaja() {
    await this._irADashboardYExpandirFacturar();
    const link = this.page.locator('a[href*="cashOrderDispath"]').first();
    await link.evaluate((el: HTMLElement) => el.click());
    await this.page.waitForURL(/cashOrderDispath\/dispath/, { timeout: TIMEOUTS.NAVIGATE });
  }


  // ─── Despacho de bodega ───────────────────────────────────────────────────

  /**
   * Abre "Despacho de bodega" (`#dispatch_order_enable`,
   * `class="purchase-module-trigger"`) y devuelve cuál de sus DOS resultados
   * reales ocurrió — carrera real entre dos comportamientos legítimos de la
   * app, mismo criterio que `PosCore._irAlPosResolviendoCompania()` (Flujo A
   * modal / Flujo B navegación directa: `Promise.any()`, nunca
   * `Promise.race()`, con un `.catch()` silencioso por promesa individual
   * para no dejar un rechazo sin manejar de la que pierde la carrera):
   *
   * - `'modulo_no_habilitado'`: el complemento "Control de Despacho" no está
   *   comprado/habilitado para la compañía activa — la app muestra el modal
   *   de venta "Módulos Adicionales" (`#dialog_purchase_modules`) en vez de
   *   navegar.
   * - `'pantalla_real'`: navega a la pantalla real de Despacho de Bodega
   *   (`PosDispatchOrder/dispatchOrder`, título real "Despacho de órdenes" /
   *   encabezado en pantalla "Control de Calidad - Órdenes de despacho").
   *   Confirmado en vivo tanto con la cuenta Super Administrador (compañía
   *   HONDURAS entre otras) como con la cuenta admin por defecto (`kadmin`,
   *   perteneciente a una única compañía, ya HONDURAS) — RE-CONFIRMADO en
   *   una sesión posterior que el complemento también quedó habilitado para
   *   `kadmin` (el estado real del complemento en el ambiente cambió entre
   *   ambas investigaciones; ver facturar-navegacion.spec.ts y
   *   facturar-despacho-bodega.spec.ts, que documentan el estado vigente).
   *
   * Navegación y aserción quedan separadas a propósito: cada spec que use
   * este método decide qué resultado espera y lo valida por su cuenta, sin
   * que este helper compartido asuma cuál cuenta obtiene cuál resultado —
   * ese mapeo ya demostró cambiar con el tiempo en este ambiente.
   */
  async abrirDespachoDeBodega(): Promise<'modulo_no_habilitado' | 'pantalla_real'> {
    await this._irADashboardYExpandirFacturar();
    const link = this.page.locator('#dispatch_order_enable');

    const esperaModal = this.modalModulosAdicionales
      .waitFor({ state: 'visible', timeout: TIMEOUTS.MODAL })
      .then(() => 'modulo_no_habilitado' as const);
    const esperaPantallaReal = this.page
      .waitForURL(/PosDispatchOrder\/dispatchOrder/, { timeout: TIMEOUTS.NAVIGATE })
      .then(() => 'pantalla_real' as const);
    esperaModal.catch(() => {});
    esperaPantallaReal.catch(() => {});

    await link.evaluate((el: HTMLElement) => el.click());

    const resultado = await Promise.any([esperaModal, esperaPantallaReal]).catch(() => null);
    if (!resultado) {
      throw new Error(
        'El click en "Despacho de bodega" no produjo ninguno de los dos resultados reales conocidos ' +
        '(ni el modal "Módulos Adicionales" ni la navegación a PosDispatchOrder/dispatchOrder).'
      );
    }
    return resultado;
  }

  /**
   * Locator del modal de venta "Módulos Adicionales" que abre "Despacho de
   * bodega" cuando el complemento no está habilitado para la compañía activa
   * — id real confirmado en vivo: `#dialog_purchase_modules`.
   */
  get modalModulosAdicionales(): Locator {
    return this.page.locator('#dialog_purchase_modules');
  }


  // ─── Chosen por texto exacto (filtros de las pantallas de Despacho) ────────

  /**
   * Selecciona una opción por su texto EXACTO en cualquier widget Chosen de
   * selección simple — variante nueva y genérica (no una de las 3 ya
   * existentes en `PosCore._seleccionarPrimeraOpcionChosen*()`, que siempre
   * toman la PRIMERA opción real disponible, nunca una específica por
   * texto). Las pantallas de Despacho ("Despacho de Órdenes de Caja",
   * "Despacho de Bodega") reutilizan este mismo mecanismo para varios
   * filtros distintos: Compañía (`#company_select_chosen`), Estado orden
   * (`#select_order_status_chosen`), Tipo de factura y "Pagó con" — todos
   * confirmados en vivo como el mismo widget Chosen de selección simple, así
   * que centralizar aquí evita 4 copias casi idénticas del mismo bucle
   * click-buscar-click (mismo criterio que `_seleccionarMarcaVehiculoConModelosReales`
   * en pos-crear-cliente.page.ts: documentar por qué los 3 helpers de
   * PosCore no aplican, en vez de forzarlos).
   */
  async _seleccionarOpcionChosenPorTexto(contenedorChosenSelector: string, texto: string) {
    const chosen = this.page.locator(contenedorChosenSelector);
    await expect(chosen, `El Chosen "${contenedorChosenSelector}" no quedó visible en esta pantalla de Despacho`).toBeVisible({ timeout: TIMEOUTS.MODAL });

    const textoEscapado = texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const opcion = chosen.locator('.chosen-results li', { hasText: new RegExp(`^\\s*${textoEscapado}\\s*$`) }).first();

    // CORRECCIÓN DE AUTOMATIZACIÓN confirmada en vivo (Despacho de Bodega):
    // un único click sobre `.chosen-single` sin reintentos podía perderse
    // contra el mismo overlay asíncrono ya documentado en el resto de la
    // suite (banner de permisos de notificación de Firefox reapareciendo
    // entre el cierre inicial y este click) — el dropdown nunca llegaba a
    // abrirse y la opción buscada expiraba como "no encontrada" pese a
    // existir. Se reintenta el CICLO completo (cerrar overlays → abrir
    // dropdown → comprobar que la opción quedó visible), mismo patrón ya
    // usado en `PosCore.abrirProductoRapido()`/`FacturarDespachoOrdenesCajaPage
    // .abrirMenuDetalle()`, en vez de un único intento con timeout largo.
    const MAX_INTENTOS = 5;
    let opcionVisible = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !opcionVisible; intento++) {
      await this.pos.cerrarOverlaysConocidos().catch(() => {});
      await chosen.locator('.chosen-single').click({ timeout: 3_000 }).catch(() => {});
      opcionVisible = await opcion.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    }
    expect(opcionVisible, `"${texto}" no está entre las opciones reales del Chosen "${contenedorChosenSelector}" en esta pantalla tras ${MAX_INTENTOS} intentos`).toBe(true);
    await opcion.click();

    // Confirmado en vivo que cambiar cualquiera de estos filtros re-consulta
    // el listado por AJAX sin recargar la página — se espera la condición
    // real (red en reposo) en vez de un endpoint específico, que no está
    // confirmado en vivo con evidencia (a diferencia de otros AJAX ya
    // documentados en este repo con su URL exacta).
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.MODAL }).catch(() => {});
  }

  /**
   * Selecciona una compañía por su nombre EXACTO en el filtro `#company_select`
   * (Chosen) que traen tanto "Despacho de Órdenes de Caja"
   * (`cashOrderDispath/dispath`) como "Despacho de Bodega"
   * (`PosDispatchOrder/dispatchOrder`) — confirmado en vivo que ambas
   * pantallas comparten el mismo widget e id. Es un filtro PROPIO de cada
   * pantalla, independiente de la compañía ya resuelta al hacer login
   * (`_irAlPosResolviendoCompania()`/`COMPANIA_POS`): la cuenta Super
   * Administrador pertenece a 17+ compañías y estas dos pantallas son
   * cross-company para ella, por eso no se puede asumir que el login ya
   * dejó activa la compañía que un escenario necesita.
   */
  async seleccionarCompaniaEnDespacho(nombreCompania: string) {
    await this._seleccionarOpcionChosenPorTexto('#company_select_chosen', nombreCompania);
  }


  // ─── Helper interno ───────────────────────────────────────────────────────

  /**
   * Carga el Dashboard y expande el submenú colapsado "FACTURAR" del sidebar
   * si hace falta. Variante acotada del mismo patrón que ya usa
   * `PosCore._irAlPosResolviendoCompania()` para expandir el submenú antes
   * de clickear "Crear factura" — generalizada aquí sobre CUALQUIER link de
   * ese mismo submenú, porque "Despacho de órdenes"/"Despacho de bodega" no
   * pasan por `get_company_pos_select()` y por lo tanto no pueden reutilizar
   * `irAlPosConOpcion()`. Se usa el link "Crear factura"
   * (`L.DASHBOARD_LINK_IR_A_POS`, ya confirmado y reutilizado en el resto de
   * la suite) solo como ancla para detectar/expandir el submenú padre — los
   * 5 links viven dentro del mismo `<ul>` "FACTURAR" (confirmado en vivo).
   */
  private async _irADashboardYExpandirFacturar() {
    await this.page.goto(DASHBOARD_URL, { waitUntil: 'load' });
    await this.page.locator(L.DASHBOARD_BELL_LOADING)
      .waitFor({ state: 'hidden', timeout: TIMEOUTS.MODAL })
      .catch(() => {});
    await this.pos._cerrarModalMonedaSiAparece();
    await this.pos._cerrarModalSetupInicialSiAparece();

    const anclaSubmenu = this.page.locator(L.DASHBOARD_LINK_IR_A_POS).first();
    if (!(await anclaSubmenu.isVisible().catch(() => false))) {
      await anclaSubmenu.evaluate((el) => {
        const li = el.closest('li');
        const ul = li?.closest('ul');
        const parentA = ul?.closest('li')?.querySelector<HTMLElement>(':scope > a');
        parentA?.click();
      });
      await expect(anclaSubmenu, 'El submenú "FACTURAR" no se expandió').toBeVisible({ timeout: TIMEOUTS.MODAL });
    }
  }
}
