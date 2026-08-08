import { expect, Locator, Page } from '@playwright/test';
import { RecepcionPage } from './recepcion.page';

// ─── Timeouts propios de este dominio ──────────────────────────────────────────
// Igual que el resto del módulo, no se reutiliza un único TIMEOUTS compartido:
// cada archivo de esta escala define el suyo, ajustado a lo confirmado en vivo.
export const TIMEOUTS = {
  TEST: 120_000,
  CARGA: 15_000,
  // Facturar/Editar cliente abren una pestaña nueva (`window.open`/
  // `redirect_to_pos_blank`) — confirmado en vivo que cargar el POS completo
  // en esa pestaña puede tardar más que CARGA.
  CARGA_PESTANA_NUEVA: 30_000,
} as const;

// ─── Locators ─────────────────────────────────────────────────────────────────
// Todos confirmados en vivo sobre la vista comprensiva "Ver orden"
// (`getOrderDetailById`) — un reemplazo de contenido en el mismo lugar, sin
// cambio de URL (ver `RecepcionPage._esperarVistaVerOrdenCargada`).
const L = {
  // ─── Encabezado: Pasos completados / Histórico / Editar recepción ──────────
  STEPPER_PASOS: '.stepper-button',
  BTN_HISTORICO_VEHICULO: 'button:has-text("Histórico Vehículo")',
  MODAL_HISTORICO_VEHICULO: '#dialog_vehicule_history',
  // Confirmado en vivo: `onclick="getOrderById(<id>)"` — reabre el wizard
  // paso a paso (mismo componente que "Editar orden" desde el menú "⋮" de la
  // tarjeta, ya documentado en `RecepcionPage.abrirEditarOrdenDesdeMenu`).
  BTN_EDITAR_RECEPCION: '[onclick^="getOrderById"]',

  // ─── Información del cliente ────────────────────────────────────────────────
  // Confirmado en vivo: `onclick="window.open('.../cust/addCustomerForm?customer_id=...', '_blank')"`
  // — abre una pestaña nueva con el formulario completo de edición del
  // cliente (mismo formulario que Contactos → Editar), no un modal.
  BTN_EDITAR_CLIENTE: 'button[onclick*="addCustomerForm"]',

  // ─── Fotos del vehículo ──────────────────────────────────────────────────────
  // El botón visible dispara un input de archivo oculto
  // (`onclick="document.getElementById('product_photo_<id>').click()"`) — se
  // usa `setInputFiles` directo sobre ese input, sin necesidad de clickear el
  // botón (Playwright puede fijar archivos en un input oculto).
  INPUT_FOTO_VEHICULO: 'input[type="file"][id^="product_photo_"]',
  GALERIA_FOTOS_VACIA: 'text=No hay fotos disponibles',
  IMAGEN_FOTO_VEHICULO: '.gallery-photo img, [class*="photo"] img:not([class*="empty"])',

  // ─── Gestión de Servicios ────────────────────────────────────────────────────
  BTN_AGREGAR_SERVICIO: '.add-service-btn',
  MODAL_BUSQUEDA_SERVICIO: '#dialog_search_service',
  BTN_BUSCAR_SERVICIO: '#dialog_search_service button:has-text("Buscar")',
  INPUT_BUSQUEDA_SERVICIO: '#dialog_search_service input[type="text"]',
  // Los 2 íconos de alternar modo lista/cuadrícula, confirmados en vivo en la
  // esquina superior derecha del buscador (mismo patrón en el modal de
  // producto).
  BTNS_MODO_VISTA_CATALOGO: '.modal.show :visible i.fa-th, .modal.show :visible i.fa-list, .modal.in :visible i.fa-th, .modal.in :visible i.fa-list',
  INPUT_BUSCAR_SERVICIOS_ORDEN: 'input[placeholder="Buscar servicios..."]',
  BTN_BUSCAR_SERVICIOS_ORDEN: 'button:has-text("Buscar")',
  LISTA_SERVICIOS: 'text=Lista de servicios',
  BTN_MENU_SERVICIO: '.service-menu-btn',

  // ─── Gestión de productos ────────────────────────────────────────────────────
  BTN_AGREGAR_PRODUCTO: '.add-product-button',
  MODAL_BUSQUEDA_PRODUCTO: '#dialog_search_product',
  INPUT_BUSCAR_PRODUCTOS_ORDEN: 'input[placeholder="Buscar productos..."]',

  // ─── Partes del vehículo ─────────────────────────────────────────────────────
  BTN_AGREGAR_PARTE: '.add-part-btn',
  MODAL_PARTES: '#dialog_car_asset',

  // ─── Observaciones ───────────────────────────────────────────────────────────
  TEXTAREA_ASESOR: 'textarea[placeholder="Agregue observaciones"]',
  TEXTAREA_NOTAS_CLIENTE: 'textarea[placeholder="Escriba las notas del cliente"]',

  // ─── Histórico (panel lateral) ───────────────────────────────────────────────
  BTN_CONTRAER_TODO: '.expand-all-btn',

  // ─── Facturar / Regresar ─────────────────────────────────────────────────────
  BTN_FACTURAR: '#btn_total_order_in_see_order',
  // Confirmado en vivo: `onclick="returnOrderList()"` se repite en 3 botones
  // distintos de la vista ("Atrás", el footer "Regresar" real, y "Regresar a
  // órdenes") — se usa el id propio del botón real del footer para no
  // violar "strict mode".
  BTN_REGRESAR: '#btn_returnOrderList',
} as const;

/**
 * Convierte un monto mostrado a número, aceptando AMBOS formatos confirmados
 * en vivo dentro de esta misma vista: "es-CR" (punto de millar, coma decimal
 * — p. ej. el catálogo de servicios/productos, "₡600.000,00") y el formato
 * "US" que usa puntualmente el botón "Facturar" ("2,130.00", coma de millar,
 * punto decimal) — inconsistencia real de la UI, no un error de esta
 * función. Se decide el formato mirando cuál separador aparece último en el
 * texto (ese es el decimal real).
 */
function parseMoneda(texto: string): number {
  const limpio = texto.replace(/[^\d.,-]/g, '');
  const esFormatoEsCR = limpio.lastIndexOf(',') > limpio.lastIndexOf('.');
  const normalizado = esFormatoEsCR ? limpio.replace(/\./g, '').replace(',', '.') : limpio.replace(/,/g, '');
  return parseFloat(normalizado) || 0;
}

/**
 * Dominio "Ver orden" (vista comprensiva de detalle de una orden,
 * `getOrderDetailById`) — compuesto directamente contra `RecepcionPage` + `Page`
 * (mismo patrón ya usado por `PosCrearCliente` en el módulo POS para un
 * dominio acotado que no necesita integrarse a la fachada principal): esta
 * vista es lo bastante grande (Histórico, Editar recepción/cliente, Fotos,
 * Servicios, Productos, Partes, Observaciones, Facturar...) como para merecer
 * su propio archivo, sin tocar `recepcion.page.ts`.
 */
export class RecepcionVerOrden {
  constructor(private readonly recepcion: RecepcionPage, private readonly page: Page) {}

  // ─── Pasos de la recepción completados (stepper) ────────────────────────────

  /** Nombres de los pasos visibles en el stepper "Pasos de la recepción completados". */
  async obtenerPasosStepper(): Promise<string[]> {
    return this.page.locator(L.STEPPER_PASOS).locator('xpath=following-sibling::*[1]').allTextContents();
  }

  // ─── Histórico Vehículo (modal "Historial de órdenes") ──────────────────────

  get modalHistoricoVehiculo(): Locator {
    return this.page.locator(L.MODAL_HISTORICO_VEHICULO);
  }

  async abrirHistoricoVehiculo() {
    await this.page.locator(L.BTN_HISTORICO_VEHICULO).click();
    await expect(this.modalHistoricoVehiculo, 'El modal "Histórico Vehículo" no se abrió').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async cerrarHistoricoVehiculo() {
    await this.modalHistoricoVehiculo.locator('.close, [data-dismiss="modal"]').first().click();
    await expect(this.modalHistoricoVehiculo, 'El modal "Histórico Vehículo" no se cerró').toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  // ─── Editar recepción (reabre el wizard) ────────────────────────────────────

  /**
   * Reabre el wizard de creación desde "Editar recepción". Mismo componente
   * y misma advertencia que `RecepcionPage.abrirEditarOrdenDesdeMenu`
   * (confirmado en vivo): NO reabre en la vista comprensiva ni en
   * Observaciones — retoma en el paso que el backend considera pendiente.
   */
  async abrirEditarRecepcion() {
    await this.page.locator(L.BTN_EDITAR_RECEPCION).click();
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  // ─── Editar cliente (formulario en pestaña nueva) ───────────────────────────

  /**
   * Abre "Editar" (Información del cliente) — confirmado en vivo que es un
   * `window.open` real a `cust/addCustomerForm?customer_id=...`, no un modal.
   * Devuelve la pestaña nueva ya cargada para que el caller la inspeccione y
   * la cierre.
   */
  async abrirEditarClienteEnNuevaPestana(context: import('@playwright/test').BrowserContext): Promise<Page> {
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      this.page.locator(L.BTN_EDITAR_CLIENTE).click(),
    ]);
    await popup.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.CARGA_PESTANA_NUEVA });
    return popup;
  }

  // ─── Fotos del vehículo ──────────────────────────────────────────────────────

  /** Agrega una foto fijando el archivo directamente en el input oculto que dispara el botón "+ Agregar". */
  async agregarFotoVehiculo(rutaArchivo: string) {
    await this.page.locator(L.INPUT_FOTO_VEHICULO).setInputFiles(rutaArchivo);
  }

  async fotosVehiculoVisibles(): Promise<number> {
    return this.page.locator(L.IMAGEN_FOTO_VEHICULO).count();
  }

  // ─── Histórico (panel lateral): contraer/expandir ───────────────────────────

  async alternarContraerHistorico() {
    await this.page.locator(L.BTN_CONTRAER_TODO).click();
  }

  // ─── Gestión de Servicios ────────────────────────────────────────────────────

  async abrirAgregarServicio() {
    await this.page.locator(L.BTN_AGREGAR_SERVICIO).click();
    await expect(this.page.locator(L.MODAL_BUSQUEDA_SERVICIO), 'El modal "Búsqueda de servicios" no se abrió').toBeVisible({
      timeout: TIMEOUTS.CARGA,
    });
  }

  /**
   * Agrega el primer servicio real del catálogo (modal ya abierto) haciendo
   * clic en su tarjeta. Confirmado en vivo: la tarjeta real es
   * `.product_box.card-service` (`onclick="add_item_to_repair_order(...)"`)
   * — la tarjeta fija "Agregar servicio" (crea uno nuevo) no comparte esa
   * clase, así que no hace falta excluirla explícitamente.
   */
  async agregarPrimerServicioDelCatalogo() {
    const modal = this.page.locator(L.MODAL_BUSQUEDA_SERVICIO);
    await modal.locator('.product_box.card-service').first().click();
    await expect(modal, 'El modal de búsqueda de servicios no se cerró tras seleccionar uno').toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  async buscarEnCatalogoServicio(texto: string) {
    // El modal tiene decenas de `input[type="text"]` ocultos por cada
    // tarjeta del catálogo (`product_stock_id[]`) — se acota por el
    // placeholder real del campo de búsqueda para evitar ese choque.
    await this.page.locator(`${L.MODAL_BUSQUEDA_SERVICIO} input[placeholder="Búsqueda de servicios"]`).fill(texto);
    await this.page.locator(`${L.MODAL_BUSQUEDA_SERVICIO} button:has-text("Buscar")`).click();
  }

  /** Cambia el modo de vista del catálogo (lista/cuadrícula) del modal de búsqueda ya abierto, usando el ícono indicado. */
  async cambiarModoVistaCatalogo(modal: Locator, modo: 'lista' | 'cuadricula') {
    // Confirmado en vivo: `setProductListStyleByUser('list'|'box', ...)` — el
    // ícono de cuadrícula usa `fa-th-large`, no el genérico `fa-th`.
    const icono = modo === 'lista' ? modal.locator('i.fa-list') : modal.locator('i.fa-th-large');
    await icono.first().click();
  }

  get modalBusquedaServicio(): Locator {
    return this.page.locator(L.MODAL_BUSQUEDA_SERVICIO);
  }

  get modalBusquedaProducto(): Locator {
    return this.page.locator(L.MODAL_BUSQUEDA_PRODUCTO);
  }

  async cerrarModalBusqueda(modal: Locator) {
    await this.page.keyboard.press('Escape');
    await expect(modal, 'El modal de búsqueda no se cerró').toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Tarjeta de un servicio/producto de la orden ya agregado, identificada
   * por su id real. Confirmado en vivo: el contenedor real tiene su propio
   * id — `service_in_see_order_<id>` para servicios, `product_card_<id>`
   * para productos (NO comparten un mismo patrón, a diferencia del menú
   * "⋮", que sí usa `toggleServiceMenu` para ambos).
   */
  private tarjetaItem(idItem: string, tipo: 'servicio' | 'producto'): Locator {
    const id = tipo === 'servicio' ? `#service_in_see_order_${idItem}` : `#product_card_${idItem}`;
    return this.page.locator(id);
  }

  /** Nombre real del radio "Aprobar/Rechazar" — distinto entre servicio y producto (confirmado en vivo). */
  private nombreRadioAprobacion(idItem: string, tipo: 'servicio' | 'producto'): string {
    return tipo === 'servicio' ? `approval_status_${idItem}` : `product_approval_status_${idItem}`;
  }

  /** Ids reales (usados en `toggleServiceMenu`) de todos los servicios agregados a la orden. */
  async obtenerIdsServicios(): Promise<string[]> {
    return this.page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.service-menu-btn'));
      return btns
        .map((b) => b.getAttribute('onclick') ?? '')
        .filter((onclick) => !onclick.includes("'product'"))
        .map((onclick) => onclick.match(/toggleServiceMenu\((\d+)\)/)?.[1] ?? '')
        .filter(Boolean);
    });
  }

  /** Ids reales de todos los productos agregados a la orden. */
  async obtenerIdsProductos(): Promise<string[]> {
    return this.page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.service-menu-btn'));
      return btns
        .map((b) => b.getAttribute('onclick') ?? '')
        .filter((onclick) => onclick.includes("'product'"))
        .map((onclick) => onclick.match(/toggleServiceMenu\((\d+),/)?.[1] ?? '')
        .filter(Boolean);
    });
  }

  private async abrirMenuItem(idItem: string, tipo: 'servicio' | 'producto') {
    // Confirmado en vivo: cerrar el diálogo de "Ver notas"/"Eliminar" con su
    // botón real puede dejar un `.modal-backdrop` huérfano bloqueando
    // cualquier clic futuro — mismo patrón ya documentado para los modales
    // de columna del Tablero (`RecepcionPage.limpiarBackdropsHuerfanos`).
    await this.page.evaluate(() => {
      document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
      document.body.classList.remove('modal-open');
    });
    const selector = tipo === 'servicio' ? `[onclick="toggleServiceMenu(${idItem})"]` : `[onclick="toggleServiceMenu(${idItem}, 'product')"]`;
    await this.page.locator(selector).click();
    const idMenu = tipo === 'servicio' ? `service-menu-${idItem}` : `service-menu-product-${idItem}`;
    await expect(this.page.locator(`#${idMenu}`), `El menú del ${tipo} ${idItem} no se desplegó`).toBeVisible({ timeout: TIMEOUTS.CARGA });
    return this.page.locator(`#${idMenu}`);
  }

  /** Abre el menú "⋮" de un servicio/producto ya agregado y hace clic en la opción dada (Editar/Asignar mecánico/Eliminar/Ver notas). */
  async ejecutarOpcionMenuItem(idItem: string, tipo: 'servicio' | 'producto', opcion: 'Editar' | 'Asignar mecánico' | 'Eliminar' | 'Ver notas') {
    const menu = await this.abrirMenuItem(idItem, tipo);
    await menu.locator('a', { hasText: opcion }).click();
  }

  /**
   * Elimina un servicio/producto ya agregado, con reintento acotado del
   * ciclo completo (abrir menú → Eliminar → confirmar). Confirmado en vivo
   * (interceptando la red): el POST real (`removeItemFromRepairOrder`)
   * funciona de forma confiable cuando se dispara — la inconsistencia real
   * es que el propio clic en "Eliminar" del menú o en el botón de
   * confirmación a veces no llega a registrarse (mismo tipo de clic
   * intermitente ya documentado en otras partes de este módulo), no un
   * problema del backend.
   */
  async eliminarItem(idItem: string, tipo: 'servicio' | 'producto') {
    const obtenerIds = () => (tipo === 'servicio' ? this.obtenerIdsServicios() : this.obtenerIdsProductos());
    const cantidadAntes = (await obtenerIds()).length;

    for (let intento = 1; intento <= 3; intento++) {
      await this.ejecutarOpcionMenuItem(idItem, tipo, 'Eliminar');
      const dialogo = this.page.getByRole('heading', { name: /Está seguro de eliminar/ });
      const dialogoAbrio = await dialogo
        .waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA })
        .then(() => true)
        .catch(() => false);
      if (dialogoAbrio) {
        await this.page.getByRole('button', { name: 'Eliminar', exact: true }).click();
      }

      const selectorExacto =
        tipo === 'servicio' ? `[onclick="toggleServiceMenu(${idItem})"]` : `[onclick="toggleServiceMenu(${idItem}, 'product')"]`;
      const eliminado = await this.page
        .waitForFunction(
          (sel) => document.querySelectorAll(sel).length === 0,
          selectorExacto,
          { timeout: TIMEOUTS.CARGA }
        )
        .then(() => true)
        .catch(() => false);
      if (eliminado) return;
    }

    const cantidadFinal = (await obtenerIds()).length;
    expect(cantidadFinal, `El ${tipo} ${idItem} sigue existiendo tras varios intentos de eliminación`).toBeLessThan(cantidadAntes);
  }

  /**
   * Cambia el "Estado" (Pendiente/Trabajando/Finalizado) de un servicio ya
   * agregado. Confirmado en vivo: `toggleServiceStatusDropdown` es un TOGGLE
   * real — si el dropdown ya quedó abierto de una interacción previa (o a
   * medio cerrar), volver a hacer clic en el botón lo CIERRA en vez de
   * abrirlo, dejando la opción destino invisible. Se comprueba el estado
   * real del dropdown antes de decidir si hace falta el clic.
   */
  async cambiarEstadoServicio(idServicio: string, estado: 'Pendiente' | 'Trabajando' | 'Finalizado') {
    const dropdown = this.page.locator(`#myDropdown${idServicio}`);
    if (!(await dropdown.isVisible().catch(() => false))) {
      await this.page.locator(`[onclick="toggleServiceStatusDropdown(${idServicio})"]`).click();
    }
    await expect(dropdown, `El dropdown de estado del servicio ${idServicio} no se desplegó`).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await dropdown.locator('a', { hasText: estado }).click();
    // Confirmado en vivo: `selectServiceStatus` vuelve a renderizar este
    // widget por AJAX (para reflejar el nuevo estado) — cualquier intento de
    // ocultar el nodo actual del dropdown queda sin efecto porque la
    // respuesta lo reemplaza por uno nuevo, otra vez visible. Se documenta
    // aquí en vez de perseguirlo: los métodos que interactúan CERCA de esta
    // zona después de un cambio de estado deben usar `{ force: true }` (ver
    // `establecerAprobacion`).
  }

  async estadoActualServicio(idServicio: string): Promise<string> {
    return (await this.page.locator(`#selectedOption${idServicio}`).textContent())?.trim() ?? '';
  }

  /** Marca "Aprobar" o "Rechazar" en un servicio/producto ya agregado. */
  async establecerAprobacion(idItem: string, tipo: 'servicio' | 'producto', decision: 'Aprobar' | 'Rechazar') {
    const nombreRadio = this.nombreRadioAprobacion(idItem, tipo);
    // Confirmado en vivo (servicio, `onchange="handleApproval(id, 1)"` junto
    // al `<span>Aprobar</span>`): value="1" es Aprobar; por ser un radio de
    // solo 2 opciones, value="2" es Rechazar.
    const valor = decision === 'Aprobar' ? '1' : '2';
    const objetivo = this.tarjetaItem(idItem, tipo).locator(`input[name="${nombreRadio}"][value="${valor}"]`);
    // Confirmado en vivo: ni un clic forzado en el `<label>` ni `.check({force:true})`
    // sobre el propio `<input>` logran marcarlo — el widget de "Estado"
    // vecino queda realmente encima en esa zona de la tarjeta (no una
    // intercepción superficial que `force` pueda saltarse) y el navegador
    // nunca despacha el clic real al radio. Se dispara el mismo cambio que
    // el handler real espera (`onchange="handleApproval(...)"` /
    // `handleProductApprovalSeeOrder(...)`) directamente por JS — mismo
    // criterio de red de seguridad ya usado en otros bugs de superposición
    // de este proyecto (p. ej. `establecerPermisoViaApiDirecta` en
    // `pos-permisos.page.ts`).
    await objetivo.first().evaluate((el: HTMLInputElement) => {
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  async aprobacionActual(idItem: string, tipo: 'servicio' | 'producto'): Promise<string | null> {
    const nombreRadio = this.nombreRadioAprobacion(idItem, tipo);
    const radioMarcado = this.tarjetaItem(idItem, tipo).locator(`input[name="${nombreRadio}"]:checked`);
    if ((await radioMarcado.count()) === 0) return null;
    const valor = await radioMarcado.getAttribute('value');
    return valor === '1' ? 'Aprobar' : valor === '2' ? 'Rechazar' : valor;
  }

  // ─── Gestión de productos ────────────────────────────────────────────────────

  async abrirAgregarProducto() {
    await this.page.locator(L.BTN_AGREGAR_PRODUCTO).click();
    await expect(this.page.locator(L.MODAL_BUSQUEDA_PRODUCTO), 'El modal "Búsqueda de productos" no se abrió').toBeVisible({
      timeout: TIMEOUTS.CARGA,
    });
  }

  async agregarPrimerProductoDelCatalogo() {
    const modal = this.page.locator(L.MODAL_BUSQUEDA_PRODUCTO);
    // Mismo patrón que el catálogo de servicios (`.product_box.card-service`)
    // — aquí la variante real confirmada en vivo es `.product_box.card-product`.
    await modal.locator('.product_box.card-product').first().click();
    await expect(modal, 'El modal de búsqueda de productos no se cerró tras seleccionar uno').toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  // ─── Partes del vehículo ─────────────────────────────────────────────────────

  get modalPartes(): Locator {
    return this.page.locator(L.MODAL_PARTES);
  }

  async abrirAgregarParte() {
    await this.page.locator(L.BTN_AGREGAR_PARTE).click();
    await expect(this.modalPartes, 'El modal "Partes del vehículo" no se abrió').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Dentro del modal de partes ya abierto: marca el estado "Bueno" de la
   * primera parte del catálogo. Confirmado en vivo: mismo patrón real ya
   * usado por el wizard de creación (`onclick="addAssetOrder(<id>,1)"`,
   * `title="Bueno"` — ver `ICONO_PARTE_BUENA` en `recepcion.page.ts`), así
   * que se reutiliza el mismo selector en vez de inventar uno nuevo.
   */
  async marcarPrimeraParteComoBuena() {
    await this.modalPartes.locator('[onclick^="addAssetOrder"][title="Bueno"]').first().click();
  }

  async cerrarModalPartes() {
    await this.modalPartes.locator('.close, [data-dismiss="modal"]').first().click();
    await expect(this.modalPartes, 'El modal "Partes del vehículo" no se cerró').toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  // ─── Observaciones (reutiliza los campos ya validados por RecepcionPage) ───
  // No se duplica aquí: `RecepcionPage.llenarYValidarObservacionesReales()` ya
  // cubre "Asesor de servicio"/"Notas del cliente" (mismos campos
  // `damage_repair_detail`/`damage_repair_message_detail` de esta vista) —
  // se llama directamente desde el spec.

  // ─── Totales ──────────────────────────────────────────────────────────────────

  /** Total general mostrado en el botón "Facturar" (`$<monto>`), la fuente más confiable — mismo total que el panel lateral "TOTAL GENERAL". */
  async totalGeneralEnBotonFacturar(): Promise<number> {
    const texto = (await this.page.locator(L.BTN_FACTURAR).innerText()) ?? '';
    return parseMoneda(texto);
  }

  // ─── Facturar / Regresar ─────────────────────────────────────────────────────

  /** Abre "Facturar" — confirmado en vivo que redirige al POS en una pestaña nueva (`redirect_to_pos_blank`), precargado con esta orden. */
  async abrirFacturarEnNuevaPestana(context: import('@playwright/test').BrowserContext): Promise<Page> {
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      this.page.locator(L.BTN_FACTURAR).click(),
    ]);
    await popup.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.CARGA_PESTANA_NUEVA });
    return popup;
  }

  async regresarAOrdenes() {
    await this.page.locator(L.BTN_REGRESAR).click();
  }
}
