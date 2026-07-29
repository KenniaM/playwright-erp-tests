import { expect, Locator, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, type MetadatoProducto } from './pos.page';
import { L } from './pos.locators';

// Locators propios del módulo "Restaurante" (Mesas) del POS — confirmado en
// vivo ÚNICAMENTE contra el ambiente qa_restaurant
// (https://dev.designsoftcr.com/qa_restaurant/public, compañía "Restaurante
// Rancho Robertos"): este flujo completo no existe en el ambiente original
// (qa_talleralpha), así que ninguno de estos ids se agrega a pos.locators.ts
// (compartido con el resto de la suite) — mismo criterio ya usado por
// PosCrearCliente/PosProductosExternos para locators acotados a un dominio
// nuevo. Todos confirmados inspeccionando el DOM real (no asumidos):
//
// - El sub-tab "MESAS" del POS vive en un pie de página con 3 posiciones
//   fijas por id técnico estable (footer_tab_rest_table/_fast/_express, este
//   último con conteo "0" y clase "hide" en esta compañía) — mismo patrón que
//   el resto de la suite prefiere (id estable) sobre buscar por texto visible
//   ("MESAS"), que además aquí resultó frágil: existe más de un <p>MESAS</p>
//   en el DOM (variantes de layout) y un locator por texto sin ancla al id
//   real podía resolver al oculto, colgando el click hasta agotar el timeout.
// - Cada mesa del plano es un `<div class="fig" id="rest_table_on_plane_item_fig_<mesaId>">`
//   con onclick="click_rest_table_on_plane(event, mesaId, ordenId, flag)" —
//   ordenId="0" (y flag="0") es el contrato real de "mesa disponible"; con
//   una orden real, ordenId es el id numérico de esa orden y flag="1".
// - El botón "hamburguesa" (`#material_button_anim_<mesaId>`, onclick
//   show_rest_table_on_plane_menu(mesaId)) abre `#rest_table_on_plane_menu_<mesaId>`,
//   con TODAS las opciones reales de la mesa como enlaces `javascript:`
//   (confirmado volcando su innerHTML completo, no asumido): "Seleccionar
//   Orden", "Renombrar mesa", "¡Imprimir Pre-Factura!", "Imprimir Prefactura
//   Dividida" (división de cuentas, fuera del alcance de esta suite),
//   "Imp. Comanda NUEVOS Items", "Imp. Comanda TODOS Items", "Cambiar de
//   mesa", "Unificar", "Mod. Cant. personas", "Aprobar orden" (flujo de
//   entrega/PARA LLEVAR, fuera de alcance) y "Eliminar Orden".
// - "Renombrar mesa", "Mod. Cant. personas" y "Eliminar Orden" abren un modal
//   propio de esta pantalla (NO es SweetAlert v1 —`.sweet-alert`— ni SweetAlert2
//   —`.swal2-container`—, confirmado en vivo que ninguna de las dos clases
//   aparece en el DOM tras abrirlos: es un componente propio de este módulo),
//   así que se localizan por su texto real visible (getByText/getByRole), no
//   por una clase adivinada.
// - "Cambiar de mesa" NO abre ningún modal: confirmado en vivo que solo
//   dispara un toast ("¡Seleccione mesa a mover orden!") y dejar el plano en
//   modo "seleccionar mesa destino" — el siguiente click sobre CUALQUIER
//   mesa disponible del plano completa el movimiento (reutiliza el mismo
//   onclick real de "seleccionar mesa", click_rest_table_on_plane).
// - "Unificar" sí abre un modal propio ("Unificar mesas") con un grid de
//   TODAS las mesas realmente disponibles (nunca las ocupadas — filtrado por
//   el propio backend, confirmado en vivo) agrupadas por salón, cada una con
//   su propio botón "Unificar".
const L_MESA = {
  TAB_MESAS: '#footer_tab_rest_table',
  TAB_PRODUCTOS: 'div[onclick="show_rest_product_list_from_tabs()"]',

  BTN_VISTA_CUADRICULA: '#rest_table_style_box',
  VISTA_CUADRICULA_ACTIVA_CLASE: 'rest_table_style_view_active',

  FIG_MESA: (mesaId: string) => `#rest_table_on_plane_item_fig_${mesaId}`,
  TODAS_LAS_FIGS: '.fig[onclick*="click_rest_table_on_plane"]',

  BTN_MENU_MESA: (mesaId: string) => `#material_button_anim_${mesaId}`,
  MENU_MESA: (mesaId: string) => `#rest_table_on_plane_menu_${mesaId}`,

  // Ítems del menú de una mesa — todos scoped dentro de MENU_MESA(mesaId).
  // El substring de "Pre-Factura" NO debe matchear "Prefactura Dividida"
  // (open_modal_print_preinvoice): ambos contienen "print_preinvoice", así
  // que se ancla al paréntesis real de la función distinta.
  ITEM_SELECCIONAR_ORDEN: 'a[href*="click_rest_table_on_plane"]',
  ITEM_RENOMBRAR: 'a[href*="change_rest_table_name"]',
  ITEM_PRE_FACTURA: 'a[href*="print_preinvoice_view_order_rest("]',
  ITEM_COMANDA_NUEVOS: 'a[href*="\'new_items\'"]',
  ITEM_COMANDA_TODOS: 'a[href*="\'all_items\'"]',
  ITEM_CAMBIAR_MESA: 'a[href*="move_rest_order_to_table_in_list"]',
  ITEM_UNIFICAR: 'a[href*="alert_unify_tables"]',
  ITEM_PERSONAS: 'a[href*="show_update_num_people_at_table"]',
  ITEM_ELIMINAR: 'a[href*="confirm_delete_order_res_prev"]',

  // ─── División de cuentas ────────────────────────────────────────────────
  // Panel real que aparece junto a "Buscar Cliente" apenas se selecciona
  // CUALQUIER mesa (disponible u ocupada) — confirmado en vivo, no es la
  // misma función que "Imprimir Prefactura Dividida" del menú hamburguesa
  // (esa solo imprime; esta SÍ divide la orden en cuentas/clientes
  // independientes). Mecánica confirmada en vivo, interceptando red y DOM:
  //   - Cada mesa arranca con una única cuenta "Principal".
  //   - El botón real "Agregar cliente" (ícono fa-user-plus) abre un modal
  //     REAL "Nombre del cliente" — a diferencia de "Renombrar
  //     mesa"/"Personas"/"Eliminar" (documentados arriba, NO SweetAlert),
  //     este SÍ es SweetAlert2 (`.swal2-popup`), confirmado en vivo leyendo
  //     su propio heading (`id="swal2-title"`).
  //   - El cliente recién agregado queda AUTOMÁTICAMENTE como el "activo"
  //     (`#selectedClientText`) — no hace falta seleccionarlo aparte.
  //   - El carrito visible en el panel derecho FILTRA por el cliente
  //     activo: cambiar de cliente (clickeando su fila dentro del dropdown)
  //     cambia por completo qué líneas se ven/editan, no solo un total.
  //   - El total de cada cuenta se lee de su propia fila del dropdown
  //     (`spTableClientTotal_<id>`), la misma fuente que usa la propia app.
  DROPDOWN_DIVISION_TRIGGER: '#customSelectButton',
  DROPDOWN_DIVISION_LISTA: '#customSelectDropdown',
  DROPDOWN_DIVISION_TEXTO_ACTUAL: '#selectedClientText',
  DIVISION_FILAS_CLIENTE: '#clientOptions .client-row',
  BTN_AGREGAR_CLIENTE_DIVISION: 'button[onclick="addNewClientTable()"]',

  // ─── Impuesto de Restaurante ────────────────────────────────────────────
  // Checkbox real "APLICAR IMPUESTO DE RESTAURANTE (8.00%)", visible en el
  // mismo panel de División de cuentas apenas se selecciona una mesa (no
  // hace falta expandir el detalle avanzado de totales) — confirmado en
  // vivo: `id="ck_apply_service_cost"`, `onchange="apply_service_cost(1,
  // 1)"`, mismo patrón de checkbox-slider que `apply_general_discount` del
  // resto de la suite (PosCore.estaDescuentoGeneralActivo()).
  CK_IMPUESTO_RESTAURANTE: 'ck_apply_service_cost',
  MONTO_IMPUESTO_RESTAURANTE_HIDE: '#total_service_tax_hide',

  // ─── Aditivos / Modificadores ───────────────────────────────────────────
  // Botón real "+" verde presente en TODA línea del carrito (no solo las
  // que tienen aditivos configurados) — `onclick="open_modal_mod(orderId,
  // itemId, companyId, isFragment)"`, confirmado en vivo. Si el producto no
  // tiene ningún aditivo configurado, el propio backend responde `models=1`
  // y la app solo muestra un toast informativo sin abrir el modal — este
  // repositorio usa por eso un único producto de catálogo YA CONFIRMADO en
  // vivo con aditivos reales (ver PosRestaurante.PRODUCTO_CON_ADITIVOS).
  BTN_ADITIVOS_FILA: 'button[onclick*="open_modal_mod"]',
  MODAL_ADITIVOS: '#dialog_rest_mod_view',
  MODAL_ADITIVOS_CONTENIDO: '#all_modifier_content',
  MODAL_ADITIVOS_BTN_CERRAR: '#closeBtnModifierView',
  MODAL_ADITIVOS_OPCION: '.content-mod[onclick^="select_modifier"]',

  // ─── Agregar productos antes de seleccionar mesa ───────────────────────
  // Confirmado en vivo: agregar un producto desde "Productos" SIN ninguna
  // mesa seleccionada arma un carrito "flotante" y cambia el botón inferior
  // de "FACTURAR" a un enlace real "Asignar Mesa" ("(CTRL+X)") que lleva al
  // plano de Mesas para elegir el destino real de ese carrito.
  BTN_ASIGNAR_MESA: 'Asignar Mesa',

  // Ícono "X" roja real junto al encabezado "🍴 Mesa:" — cierra la VISTA de
  // la orden actual sin facturar (confirmado en vivo: la orden permanece
  // intacta, "reabrir" es simplemente volver a clickear la misma mesa).
  BTN_CERRAR_ORDEN_SIN_FACTURAR: '#close_selected_rest_order',
} as const;

/** Datos reales de una mesa del plano, leídos de su propio `.fig` (nunca por posición). */
export type DatosMesaPlano = {
  mesaId: string;
  ordenId: string;
  nombre: string;
  ocupada: boolean;
};

export class PosRestaurante {
  constructor(private readonly pos: PosPage, private readonly page: Page) {}


  // ─── Navegación al módulo Mesas ─────────────────────────────────────────

  /**
   * Abre el sub-tab "MESAS" del POS y asegura la vista de cuadrícula/plano
   * (la única de las 2 vistas —cuadrícula/lista— donde una mesa DISPONIBLE
   * es clickeable directamente; la vista de lista solo enumera órdenes ya
   * creadas, confirmado en vivo).
   */
  async abrirMesas() {
    await this.page.locator(L_MESA.TAB_MESAS).click();
    await this.page.waitForTimeout(1_000);

    const cuadriculaActiva = await this.page.locator(L_MESA.BTN_VISTA_CUADRICULA)
      .evaluate((el, clase) => el.className.includes(clase), L_MESA.VISTA_CUADRICULA_ACTIVA_CLASE)
      .catch(() => false);
    if (!cuadriculaActiva) {
      await this.page.locator(L_MESA.BTN_VISTA_CUADRICULA).click();
      await this.page.waitForTimeout(1_000);
    }

    await expect(
      this.page.locator(L_MESA.TODAS_LAS_FIGS).first(),
      'El plano de mesas no cargó ninguna mesa'
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
  }


  /** Vuelve al sub-tab "PRODUCTOS" (catálogo) para agregar ítems a la mesa/orden ya seleccionada. */
  async volverAProductos() {
    await this.page.locator(L_MESA.TAB_PRODUCTOS).click();
    await expect(
      this.pos.primerProducto,
      'El catálogo de productos no quedó visible tras volver desde Mesas'
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
  }


  /**
   * Lee TODAS las mesas actualmente renderizadas en el plano — cada una
   * expone su propio contrato real en el onclick de su `.fig`
   * (`click_rest_table_on_plane(event, mesaId, ordenId, flag)`), nunca se
   * infiere por posición ni por color. `ordenId==='0'` es la mesa
   * DISPONIBLE (sin orden real asociada).
   */
  async obtenerMesasDelPlano(): Promise<DatosMesaPlano[]> {
    return this.page.locator(L_MESA.TODAS_LAS_FIGS).evaluateAll((figs) =>
      figs.map((fig) => {
        const onclick = fig.getAttribute('onclick') || '';
        const match = onclick.match(/click_rest_table_on_plane\(event,\s*(\d+),\s*(\d+),\s*(\d+)\)/);
        const nombreEl = fig.querySelector('[id^="table_figure_popup_name_"]');
        return {
          mesaId: match?.[1] ?? '',
          ordenId: match?.[2] ?? '',
          nombre: (nombreEl?.textContent || '').replace(/\s+/g, ' ').trim(),
          ocupada: match?.[2] !== '0',
        };
      })
    );
  }


  /**
   * Localiza la primera mesa DISPONIBLE del plano ya cargado — mismo
   * criterio de "primera disponible, sin elegir por nombre" que el resto de
   * la suite ya usa para catálogos sin dato estable por el cual filtrar
   * (cliente, vendedor, ruta). Falla con un mensaje explícito si el
   * ambiente compartido de QA no tiene, en este momento, ninguna mesa libre.
   */
  async localizarMesaDisponible(): Promise<DatosMesaPlano> {
    const mesas = await this.obtenerMesasDelPlano();
    const disponible = mesas.find((m) => !m.ocupada);
    expect(disponible, `No hay ninguna mesa disponible entre las ${mesas.length} mesas cargadas en el plano`).toBeDefined();
    return disponible!;
  }


  /**
   * Localiza la primera mesa DISPONIBLE distinta de `mesaIdExcluida` — usado
   * por Cambiar de mesa/Unificar, que necesitan una mesa destino real
   * DISTINTA de la mesa de origen.
   */
  async localizarMesaDisponibleDistintaDe(mesaIdExcluida: string): Promise<DatosMesaPlano> {
    const mesas = await this.obtenerMesasDelPlano();
    const disponible = mesas.find((m) => !m.ocupada && m.mesaId !== mesaIdExcluida);
    expect(disponible, `No hay ninguna mesa disponible distinta de la mesa ${mesaIdExcluida}`).toBeDefined();
    return disponible!;
  }


  /**
   * Cierra el modal "Ver mesa" (`#dialog_rest_table_view`) si quedó abierto
   * — confirmado en vivo (Escenario 9, Cambiar de mesa) que puede quedar
   * visible sobre el plano (mismo backdrop que el resto de los modales de
   * este módulo) e interceptar el click sobre otra mesa ("... subtree
   * intercepts pointer events"), igual que los overlays conocidos del resto
   * de la suite (PosCore.cerrarOverlaysConocidos()). Se descarta con su
   * propio botón de cierre real, nunca se completa ningún flujo dentro de él.
   */
  async _cerrarModalVerMesaSiAparece() {
    const modal = this.page.locator('#dialog_rest_table_view');
    if (await modal.isVisible().catch(() => false)) {
      await modal.locator('[data-dismiss="modal"]').first().click({ force: true }).catch(() => {});
      await modal.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
    }
  }


  /**
   * Click real sobre la mesa dada (mismo onclick real, sin importar si está
   * disponible u ocupada: `click_rest_table_on_plane` decide internamente
   * si arranca una orden nueva o carga la existente — confirmado en vivo
   * que es el MISMO click que el ítem "Seleccionar Orden" del menú de
   * hamburguesa dispara sobre una mesa ya ocupada).
   */
  async clickMesa(mesaId: string) {
    await this._cerrarModalVerMesaSiAparece();
    await this.page.locator(L_MESA.FIG_MESA(mesaId)).click();
  }


  /**
   * Selecciona una mesa DISPONIBLE (crea una orden nueva sobre ella) y
   * confirma la señal real de éxito: el panel de "Buscar Cliente" arriba
   * del carrito cambia a un encabezado propio de mesa ("🍴 Mesa:") —
   * confirmado en vivo, no asumido. Devuelve los datos de la mesa elegida.
   */
  async seleccionarMesaDisponible(): Promise<DatosMesaPlano> {
    const mesa = await this.localizarMesaDisponible();
    await this.clickMesa(mesa.mesaId);
    await expect(
      this.page.locator('text=División de cuentas >> visible=true'),
      'El panel de "Mesa" (con "División de cuentas") no apareció tras seleccionar una mesa disponible'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    return mesa;
  }


  // ─── Agregar productos a la orden de una mesa ───────────────────────────

  /**
   * Agrega un producto del catálogo al carrito de la orden de Mesa
   * actualmente activa — variante ACOTADA de
   * `PosCore.agregarProductoDelGridAlCarrito()`: ese método confirma el
   * agregado esperando que crezca `obtenerClavesProductos()` (cuenta solo
   * filas con `id^="drag_and_drop_"`), pero confirmado en vivo que las
   * líneas de una orden de Mesa NUNCA llevan ese atributo (mismo caso ya
   * documentado por el comentario de `obtenerClavesFilasCarrito()` para
   * líneas IMPORTADAS de una Orden de Caja/Ruteo/Apartado — aquí aplica
   * igual, aunque el producto se agregue desde cero y no se importe de
   * ningún lado) — con ese conteo, la espera de
   * `agregarProductoDelGridAlCarrito()` nunca se cumple y agota su timeout
   * completo (120s) aunque el producto sí quedó agregado correctamente al
   * carrito visible. Se replica el mismo click + manejo del modal "Monto a
   * comprar" (para productos de precio variable), pero la condición de
   * éxito real es el crecimiento de `obtenerClavesFilasCarrito()` (cubre
   * ambos tipos de fila).
   */
  async agregarProductoAlCarritoDeMesa(metadato: MetadatoProducto): Promise<void> {
    const filasAntes = await this.pos.obtenerClavesFilasCarrito();
    const modalMontoACompra = this.page.locator(L.DIALOG_MONTO_A_COMPRAR);

    await metadato.locator.click();

    const abrioModalMonto = await modalMontoACompra
      .waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL })
      .then(() => true)
      .catch(() => false);

    if (abrioModalMonto) {
      await this.page.locator(L.MONTO_A_COMPRAR_INPUT_MONTO).fill('1000');
      await this.page.locator(L.MONTO_A_COMPRAR_BTN_CONFIRMAR).click();
      await expect(modalMontoACompra, 'El modal "Monto a comprar" no se cerró tras presionar "Continuar"').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
    }

    await expect.poll(
      async () => (await this.pos.obtenerClavesFilasCarrito()).length,
      { timeout: TIMEOUTS.PRODUCTS_LOAD, message: `El producto "${metadato.nombre}" no quedó agregado al carrito de la mesa` }
    ).toBeGreaterThan(filasAntes.length);
  }


  /** Agrega el primer producto del catálogo que todavía no esté en el carrito — mismo criterio "primero disponible" del resto de la suite. */
  async agregarPrimerProductoNoPresenteAlCarritoDeMesa(): Promise<string> {
    const metadato = await this.pos.obtenerPrimerProductoNoPresenteEnCarrito();
    await this.agregarProductoAlCarritoDeMesa(metadato);
    return metadato.nombre;
  }


  // ─── División de cuentas ─────────────────────────────────────────────────

  /** Nombre del cliente de la división ACTUALMENTE activo — el carrito visible en el panel derecho es el de este cliente. */
  async obtenerClienteDivisionActivo(): Promise<string> {
    return ((await this.page.locator(L_MESA.DROPDOWN_DIVISION_TEXTO_ACTUAL).textContent()) ?? '').trim();
  }


  /**
   * Nombres de TODAS las cuentas/clientes actualmente en la división —
   * fuente real para comparar "antes/después" en vez de asumir que un
   * nombre capturado sigue siendo válido: confirmado en vivo que la cuenta
   * "Principal" puede cambiar de nombre visible en el dropdown en algún
   * punto posterior del flujo (p. ej. tras asignarle un cliente REGISTRADO
   * y luego agregar una segunda cuenta a la división), así que el nombre
   * real y actual de cada fila solo se conoce releyendo el dropdown, nunca
   * reutilizando un valor guardado de antes.
   */
  async obtenerNombresClientesDivision(): Promise<string[]> {
    await this.abrirDropdownDivisionCuentas();
    const textos = await this.page.locator(L_MESA.DIVISION_FILAS_CLIENTE).locator('[id^="tableClientName_"]').allTextContents();
    return textos.map((t) => t.trim());
  }


  /** Abre el dropdown de "División de cuentas" (lista de clientes/cuentas de la mesa) si no está ya abierto. */
  async abrirDropdownDivisionCuentas() {
    const lista = this.page.locator(L_MESA.DROPDOWN_DIVISION_LISTA);
    if (await lista.isVisible().catch(() => false)) return;
    await this.page.locator(L_MESA.DROPDOWN_DIVISION_TRIGGER).click();
    await expect(lista, 'El dropdown de "División de cuentas" no se abrió').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Agrega un cliente NO REGISTRADO a la división de cuentas de la mesa
   * activa (modal real "Nombre del cliente" — SweetAlert2, ver el
   * comentario de L_MESA). Confirmado en vivo: el cliente recién agregado
   * queda AUTOMÁTICAMENTE como el activo, así que los productos que se
   * agreguen después desde "Productos" se le atribuyen a él sin necesidad
   * de activarlo aparte.
   */
  async agregarClienteDivision(nombre: string) {
    await this.page.locator(L_MESA.BTN_AGREGAR_CLIENTE_DIVISION).click();

    const modal = this.page.locator('.swal2-popup', { hasText: 'Nombre del cliente' });
    await expect(modal, 'El modal "Nombre del cliente" (Agregar Cliente a la división) no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const campoNombre = modal.locator('.swal2-input');
    await campoNombre.fill(nombre);
    await campoNombre.blur();
    await modal.locator('.swal2-confirm').click();
    await expect(modal, 'El modal "Nombre del cliente" no se cerró tras agregar el cliente').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await expect.poll(
      () => this.obtenerClienteDivisionActivo(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: `El cliente recién agregado ("${nombre}") no quedó activo en la división de cuentas` }
    ).toBe(nombre);
  }


  /**
   * Activa (hace "actual") el cliente de división cuyo nombre coincide
   * exactamente — necesario para atribuirle los siguientes productos que se
   * agreguen desde "Productos", o para revisar el carrito que le pertenece.
   */
  async activarClienteDivision(nombre: string) {
    // Reintento acotado (mismo criterio que abrirMenuMesa()): el click debe
    // caer exactamente sobre el div con el onclick real
    // (toggleTableClientCheckbox), nunca sobre el checkbox vecino — se
    // clickea el propio nombre (`[id^="tableClientName_"]`), nunca un
    // offset de posición a ciegas, para no depender del layout exacto de
    // la fila. Confirmado en vivo que un único intento puede no registrar
    // el cambio si el dropdown estaba recién re-renderizado (AJAX previo).
    const MAX_INTENTOS = 3;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      await this.abrirDropdownDivisionCuentas();
      const fila = this.page.locator(L_MESA.DIVISION_FILAS_CLIENTE, { hasText: nombre });
      await expect(fila, `No se encontró el cliente "${nombre}" en la división de cuentas`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
      await fila.locator('[id^="tableClientName_"]').click();

      const activado = await this.page.locator(L_MESA.DROPDOWN_DIVISION_TEXTO_ACTUAL)
        .filter({ hasText: nombre })
        .waitFor({ state: 'visible', timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
      if (activado) return;
    }

    expect(
      await this.obtenerClienteDivisionActivo(),
      `El cliente "${nombre}" no quedó activo tras ${MAX_INTENTOS} intentos`
    ).toBe(nombre);
  }


  /**
   * Total actualmente acumulado por el cliente de división dado — leído de
   * su propia fila del dropdown (`spTableClientTotal_<id>`), la MISMA
   * fuente que usa la propia aplicación, nunca inferido sumando el carrito
   * visible (que solo muestra el cliente activo en cada momento).
   */
  async obtenerTotalClienteDivision(nombre: string): Promise<number> {
    await this.abrirDropdownDivisionCuentas();
    const fila = this.page.locator(L_MESA.DIVISION_FILAS_CLIENTE, { hasText: nombre });
    await expect(fila, `No se encontró el cliente "${nombre}" en la división de cuentas`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    const texto = (await fila.locator('[id^="spTableClientTotal_"]').textContent()) ?? '0';
    return await this.pos._leerMontoDeTexto(texto);
  }


  // ─── Impuesto de Restaurante ─────────────────────────────────────────────

  /** Indica si el checkbox "APLICAR IMPUESTO DE RESTAURANTE" está activo — mismo criterio que PosCore.estaDescuentoGeneralActivo(). */
  async impuestoRestauranteEstaActivo(): Promise<boolean> {
    return this.page.evaluate(
      (id) => (document.getElementById(id) as HTMLInputElement)?.checked ?? false,
      L_MESA.CK_IMPUESTO_RESTAURANTE
    );
  }


  /**
   * Activa/desactiva el "Impuesto de Restaurante" (checkbox-slider real,
   * `onchange="apply_service_cost(1, 1)"`) — solo hace click si el estado
   * actual es distinto del pedido, mismo criterio que
   * PosCore.desactivarDescuentoGeneral().
   */
  async establecerImpuestoRestaurante(activo: boolean) {
    if ((await this.impuestoRestauranteEstaActivo()) !== activo) {
      await this.page.evaluate(
        (id) => (document.getElementById(id) as HTMLInputElement).click(),
        L_MESA.CK_IMPUESTO_RESTAURANTE
      );
      await expect.poll(
        () => this.impuestoRestauranteEstaActivo(),
        { timeout: TIMEOUTS.PAYMENT_MODAL, message: `El checkbox de Impuesto de Restaurante no quedó en estado ${activo}` }
      ).toBe(activo);
    }
  }


  /** Monto ya calculado del Impuesto de Restaurante — fuente real: input oculto `#total_service_tax_hide` (mismo criterio que el resto de la suite: leer el hidden, no inferirlo del footer). */
  async obtenerMontoImpuestoRestauranteNumerico(): Promise<number> {
    const texto = await this.page.locator(L_MESA.MONTO_IMPUESTO_RESTAURANTE_HIDE).inputValue().catch(() => '0');
    return parseFloat(texto) || 0;
  }


  // ─── Aditivos / Modificadores ────────────────────────────────────────────

  /**
   * Único producto del catálogo de este ambiente confirmado en vivo con
   * Aditivos/Modificadores reales configurados (grupo "COMBINACIÓN DE
   * PIZZA", opción "HAWAIANA") — confirmado inspeccionando en vivo la
   * respuesta real del AJAX `getProductWithModifiers` (interceptando red).
   * El resto del catálogo probado en vivo (varios productos de
   * "TODOS"/"Categoria QA") no tiene ningún aditivo configurado — el propio
   * backend responde `models=1` (que la UI resuelve con un toast "este
   * producto no tiene aditivos", sin abrir ningún modal) — es un dato del
   * catálogo de este ambiente QA, no una limitación de la funcionalidad.
   */
  static readonly PRODUCTO_CON_ADITIVOS = '165/60r14 75h supraforce keter';

  get modalAditivos(): Locator {
    return this.page.locator(L_MESA.MODAL_ADITIVOS);
  }


  /**
   * Abre el editor de Aditivos/Modificadores de la línea de carrito dada
   * por su nombre exacto — botón real "+" verde de la fila
   * (`open_modal_mod(...)`, confirmado en vivo presente en TODA línea, no
   * solo las que tienen aditivos). Se usa este botón (acción determinística
   * del usuario) en vez de depender del popup automático que la aplicación
   * puede disparar sola tras agregar el producto — confirmado en vivo que
   * ese popup automático es asíncrono (AJAX propio) y su tiempo de
   * respuesta no fue consistente entre corridas aisladas.
   */
  async abrirAditivosDeLinea(nombreProducto: string) {
    const fila = this.page.locator('#table_buy_list tr[id^="table_product_name_"]', { hasText: nombreProducto }).first();
    await expect(fila, `No se encontró en el carrito ninguna línea del producto "${nombreProducto}"`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await fila.locator(L_MESA.BTN_ADITIVOS_FILA).click();
  }


  /**
   * Agrega PRODUCTO_CON_ADITIVOS al carrito de la mesa activa, abre su
   * editor de Aditivos (botón "+" real de la fila) y selecciona la primera
   * opción disponible del primer grupo — confirmado en vivo que el click
   * sobre la tarjeta de la opción (`select_modifier(...)`) guarda de
   * inmediato (AJAX propio de la app), sin necesitar un botón "Confirmar"
   * aparte; solo se cierra el modal después con su ícono real
   * (`#closeBtnModifierView`). Devuelve el nombre de la opción realmente
   * seleccionada.
   */
  async agregarProductoConAditivo(): Promise<string> {
    const nombre = PosRestaurante.PRODUCTO_CON_ADITIVOS;
    const producto = this.pos.productoPorNombre(nombre);
    await expect(
      producto,
      `El producto de prueba "${nombre}" (con Aditivos configurados) no está en el catálogo de este ambiente`
    ).toHaveCount(1, { timeout: TIMEOUTS.PRODUCTS_LOAD });

    const filasAntes = await this.pos.obtenerClavesFilasCarrito();
    await producto.click();
    await expect.poll(
      async () => (await this.pos.obtenerClavesFilasCarrito()).length,
      { timeout: TIMEOUTS.PRODUCTS_LOAD, message: `"${nombre}" no quedó agregado al carrito de la mesa` }
    ).toBeGreaterThan(filasAntes.length);

    // El popup automático de Aditivos puede dispararse solo (AJAX asíncrono
    // tras el agregado, confirmado en vivo que puede tardar unos segundos)
    // — se espera primero a que termine de resolverse por sí mismo antes de
    // decidir si hace falta abrirlo manualmente con el botón "+" de la
    // fila. Confirmado en vivo (pos_rest.js) que invocar open_modal_mod()
    // una segunda vez MIENTRAS la llamada automática todavía está en
    // curso genera un conflicto real dentro de la propia app (comentario
    // explícito del código fuente sobre esta doble-entrada) — por eso NO
    // se cierra y reabre a ciegas, solo se abre manualmente si el popup
    // automático de verdad no apareció en ese margen.
    const abrioSolo = await this.modalAditivos
      .waitFor({ state: 'visible', timeout: 6_000 })
      .then(() => true)
      .catch(() => false);

    if (!abrioSolo) {
      await this.abrirAditivosDeLinea(nombre);
      await expect(
        this.modalAditivos,
        'El editor de Aditivos no abrió — este producto de prueba dejó de tener aditivos configurados en el ambiente'
      ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    }

    const opcion = this.page.locator(L_MESA.MODAL_ADITIVOS_OPCION).first();
    await expect(opcion, 'El producto con Aditivos configurados no mostró ninguna opción seleccionable').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    const nombreOpcion = (await opcion.getAttribute('title')) ?? '';
    await opcion.click();

    await this.page.locator(L_MESA.MODAL_ADITIVOS_BTN_CERRAR).click();
    await expect(this.modalAditivos, 'El modal de Aditivos no se cerró').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    return nombreOpcion;
  }


  // ─── Agregar productos antes de seleccionar mesa ("Asignar Mesa") ───────

  get botonAsignarMesa(): Locator {
    return this.page.getByRole('link', { name: L_MESA.BTN_ASIGNAR_MESA });
  }


  /**
   * Agrega un producto al carrito ESTANDO en la pestaña "Productos" sin
   * ninguna mesa seleccionada todavía — confirmado en vivo que el POS lo
   * permite: arma un carrito "flotante" (aún no asociado a ninguna mesa) y
   * cambia el botón inferior de "FACTURAR" al enlace real "Asignar Mesa".
   */
  async agregarProductoSinMesaSeleccionada(): Promise<string> {
    const metadato = await this.pos.obtenerPrimerProductoNoPresenteEnCarrito();
    const filasAntes = await this.pos.obtenerClavesFilasCarrito();
    await metadato.locator.click();
    await expect.poll(
      async () => (await this.pos.obtenerClavesFilasCarrito()).length,
      { timeout: TIMEOUTS.PRODUCTS_LOAD, message: `"${metadato.nombre}" no quedó agregado al carrito flotante (sin mesa)` }
    ).toBeGreaterThan(filasAntes.length);
    return metadato.nombre;
  }


  /**
   * Asigna el carrito flotante (armado con agregarProductoSinMesaSeleccionada())
   * a una mesa DISPONIBLE: clickea "Asignar Mesa" (abre el plano de Mesas) y
   * elige la primera mesa libre. Devuelve los datos de la mesa realmente
   * elegida.
   *
   * BUG DE SISTEMA CONFIRMADO EN VIVO (interceptando red, no asumido): el
   * click sobre la mesa destino SÍ dispara `sendPosRestProductSale` con
   * `rest_table_id=<mesa>` y el `product_list` completo, y el backend SÍ
   * crea la orden real con los productos (confirmado leyendo la respuesta y
   * recargando la mesa después). Pero inmediatamente después, la propia app
   * dispara DOS peticiones `getPosRestOrderItemList` casi en paralelo — una
   * con el `order_id` real recién creado (con los productos) y otra con
   * `order_id=0` (vacía, residuo del estado "carrito flotante" previo a la
   * asignación) — y si la de `order_id=0` resuelve después, sobrescribe el
   * panel dejándolo mostrando un carrito vacío aunque la asignación ya se
   * completó correctamente del lado del servidor. Por eso este método NO
   * confía en el estado inmediato tras el click: fuerza una recarga real de
   * la mesa (abrirMesas() + clickMesa(), mismo mecanismo de "reabrir" que
   * usa el resto del módulo), que sí refleja el estado real y consistente.
   */
  async asignarCarritoFlotanteAMesaDisponible(): Promise<DatosMesaPlano> {
    await expect(
      this.botonAsignarMesa,
      'El botón "Asignar Mesa" no apareció — el carrito no quedó en modo flotante (sin mesa)'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.botonAsignarMesa.click();

    await expect(
      this.page.locator(L_MESA.TODAS_LAS_FIGS).first(),
      'El plano de mesas no cargó tras "Asignar Mesa"'
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const mesa = await this.localizarMesaDisponible();
    const [respuestaAsignacion] = await Promise.all([
      this.page.waitForResponse((res) => res.url().includes('sendPosRestProductSale'), { timeout: TIMEOUTS.PAYMENT_MODAL }),
      this.clickMesa(mesa.mesaId),
    ]);
    expect(respuestaAsignacion.ok(), `La petición "sendPosRestProductSale" respondió con estado ${respuestaAsignacion.status()}`).toBe(true);

    await this.abrirMesas();
    await this.clickMesa(mesa.mesaId);

    await expect.poll(
      async () => (await this.pos.obtenerClavesFilasCarrito()).length,
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El carrito flotante no se reflejó en la mesa destino tras asignarla y recargar' }
    ).toBeGreaterThan(0);

    return mesa;
  }


  // ─── Cerrar la vista de una orden sin facturar ───────────────────────────

  /**
   * Cierra la vista de la orden actualmente abierta SIN facturar — ícono
   * "X" roja real junto al encabezado "🍴 Mesa:" (`clickOnCloseOrder(1)`).
   * Confirmado en vivo que este click por sí solo NO garantiza aterrizar en
   * el sub-tab "MESAS" (puede dejar el POS en "Productos", sin ninguna
   * mesa/orden activa) — así que se fuerza además volver a "MESAS" con
   * abrirMesas() (mismo método ya usado por el resto del módulo para
   * "reabrir": volver a clickear la misma mesa recupera exactamente el
   * mismo carrito, la orden queda intacta del lado del servidor).
   */
  async cerrarOrdenSinFacturar() {
    await this.page.locator(L_MESA.BTN_CERRAR_ORDEN_SIN_FACTURAR).click();
    await this.abrirMesas();
  }


  // ─── Menú de opciones de una mesa (ícono "hamburguesa") ─────────────────

  /**
   * Abre el menú de opciones de la mesa dada. Mismo patrón de reintento ya
   * usado en abrirMenuTresPuntos()/abrirMenuOrdenCaja() para botones MDL con
   * animación continua ("material-button-anim", misma familia de widget):
   * click nativo vía evaluate() + validación real de que el ítem "Renombrar
   * mesa" (presente en el menú de CUALQUIER mesa, disponible u ocupada)
   * quedó visible, reintentando de forma acotada en vez de un único intento
   * con timeout largo.
   */
  async abrirMenuMesa(mesaId: string) {
    const menu = this.page.locator(L_MESA.MENU_MESA(mesaId));
    const itemAncla = menu.locator(L_MESA.ITEM_RENOMBRAR);

    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      await this.pos.cerrarModalNotificacionesSiAparece();
      await this.page.locator(L_MESA.BTN_MENU_MESA(mesaId)).evaluate((el: HTMLElement) => el.click());
      abierto = await itemAncla.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, `El menú de opciones de la mesa ${mesaId} no se abrió tras ${MAX_INTENTOS} intentos`).toBe(true);
    return menu;
  }


  // ─── "Renombrar mesa" ────────────────────────────────────────────────────

  /**
   * Renombra temporalmente la mesa dada (modal "¿Cambiar nombre de la
   * mesa?", confirmado en vivo su propio texto explicativo: "una vez
   * facturada la orden, la mesa volverá al nombre original" — el
   * comportamiento real que valida el Escenario 5, no una suposición).
   *
   * Investigación corregida en vivo (feedback directo confirmó un error de
   * automatización inicial): existen DOS controles reales distintos que
   * abren el mismo modal, ambos invocando `change_rest_table_name(...)`:
   *   1. El ítem "Renombrar mesa" del menú hamburguesa de la mesa en el
   *      plano (`ITEM_RENOMBRAR`, usado en la primera versión de este
   *      método) — confirmado en vivo que su submit NUNCA dispara ninguna
   *      petición de red, con ningún método de click probado.
   *   2. El ícono de lápiz real (`#rename_selected_rest_order`,
   *      `onclick="change_rest_table_name(0)"`) ubicado arriba a la derecha
   *      del panel del carrito — SOLO visible cuando la mesa tiene una
   *      orden real activa (con al menos un producto agregado). Es este
   *      botón, no el del menú, el que la aplicación realmente expone para
   *      renombrar la orden actualmente abierta.
   * Usando el botón (2) con una mesa que ya tiene un producto agregado, el
   * submit SÍ dispara una petición real (`updatePosRestOrderTableName`,
   * confirmada en vivo con `page.waitForResponse`) que responde `200 OK`
   * con cuerpo `"1"` (indicador de éxito típico de este backend), y el
   * propio encabezado del carrito (`#tb_table_buy_list_name_new`) refleja
   * el nombre nuevo de inmediato.
   *
   * BUG DE SISTEMA CONFIRMADO EN VIVO, con evidencia más sólida que la
   * versión anterior de este comentario: pese a la respuesta de éxito, el
   * nombre nuevo NUNCA se refleja en el plano de mesas (`obtenerNombreMesa()`)
   * — ni cambiando de tab, ni con una recarga COMPLETA de la página
   * (`page.reload()`, que descarta cualquier caché del lado del cliente).
   * El plano sigue mostrando el nombre original indefinidamente. Es decir:
   * el backend responde éxito pero no persiste el cambio en la fuente real
   * que alimenta el plano (o el endpoint de lectura del plano,
   * `getRestTableListByLounge`, no incluye el nombre temporal) — un bug real
   * del sistema, no de esta suite. Confirmado una vez más en una corrida
   * `--headed` con una espera visual de 20s tras el click en "Renombrar
   * mesa" (agregada solo para esa demo puntual, no forma parte del código
   * final): el nombre nunca cambia en el plano ni observándolo en vivo
   * durante ese tiempo. No se debilita la aserción para "hacerla pasar": el
   * Escenario 5 queda fallando intencionalmente contra este bug real,
   * documentado también en el informe final.
   *
   * Localizado por `getByRole('heading', ...)`, NUNCA `getByText()` a secas:
   * confirmado en vivo que el mismo texto exacto también vive, oculto
   * (`<p class="hide" id="lblJSChangeTableName">`), como plantilla de
   * traducción de la propia aplicación — un `getByText()` sin más viola el
   * modo estricto de Playwright (2 coincidencias) aunque solo el `<h2>` real
   * esté visible.
   */
  async renombrarMesa(mesaId: string, nombreTemporal: string) {
    const btnLapiz = this.page.locator('#rename_selected_rest_order');
    await expect(
      btnLapiz,
      `El ícono de renombrar (lápiz) no está visible — la mesa ${mesaId} necesita tener una orden activa (con al menos un producto) para que aparezca`
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await btnLapiz.click();

    const titulo = this.page.getByRole('heading', { name: '¿Cambiar nombre de la mesa?' });
    await expect(
      titulo,
      'El modal "¿Cambiar nombre de la mesa?" no apareció'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // .blur() tras fill(): mismo patrón ya confirmado en
    // ingresarNombreCliente() (pos-core.page.ts) — varios campos de esta
    // aplicación leen el valor recién al evento 'change'/'blur', no al
    // 'input' que fill() dispara por sí solo.
    const campoNombre = this.page.getByPlaceholder('Nombre de mesa temporal');
    await campoNombre.fill(nombreTemporal);
    await campoNombre.blur();

    await this.page.getByRole('button', { name: 'Renombrar mesa' }).click();

    await expect(
      titulo,
      'El modal de renombrar no se cerró'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Nombre actualmente mostrado en el plano para la mesa dada (leído de su
   * propio `.fig`, nunca asumido). Solo existe con el plano de Mesas
   * realmente cargado (abrirMesas() debe llamarse antes) — timeout corto y
   * explícito (no el default de Playwright) para que un uso indebido falle
   * rápido con un mensaje claro en vez de agotar el timeout completo del test.
   */
  async obtenerNombreMesa(mesaId: string): Promise<string> {
    return (await this.page.locator(`#fig_name_${mesaId}`).textContent({ timeout: 10_000 }))?.trim() ?? '';
  }


  // ─── "Mod. Cant. personas" ───────────────────────────────────────────────

  /**
   * Cambia la cantidad de personas de la mesa dada usando el selector rápido
   * (botones 1-16 ya confirmados en vivo) y confirma con "Enviar".
   */
  async modificarCantidadPersonas(mesaId: string, cantidad: number) {
    expect(cantidad, 'El selector rápido de personas solo cubre 1-16').toBeGreaterThanOrEqual(1);
    expect(cantidad).toBeLessThanOrEqual(16);

    const menu = await this.abrirMenuMesa(mesaId);
    await menu.locator(L_MESA.ITEM_PERSONAS).evaluate((el: HTMLElement) => el.click());

    // Locator con el modificador `visible=true` (no getByText() a secas ni
    // `.first()`): incluso si este texto también existe oculto en algún
    // lugar de la página (mismo patrón ya confirmado para "¿Cambiar nombre
    // de la mesa?"/"Unificar mesas", plantillas de traducción
    // `<p class="hide" id="lblJS...">`), `.first()` no es seguro aquí — si
    // ese duplicado oculto aparece ANTES en el DOM que el real (como ocurre
    // en los otros dos casos), `.first()` resolvería siempre al oculto y
    // `toBeVisible()` nunca se cumpliría. `visible=true` filtra
    // estructuralmente por visibilidad real, sin importar el orden en el DOM.
    const marcaModal = this.page.locator('text=Seleccione la cantidad de personas >> visible=true');
    await expect(
      marcaModal,
      'El modal "Mod. Cant. personas" no apareció'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.page.getByRole('button', { name: String(cantidad), exact: true }).click();
    await this.page.getByRole('button', { name: 'Enviar' }).click();

    await expect(
      marcaModal,
      'El modal de personas no se cerró'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /** Cantidad de personas actualmente registrada para la mesa (hidden `<p id="p_num_people_<mesaId>">`, la fuente real). */
  async obtenerCantidadPersonas(mesaId: string): Promise<number> {
    const texto = await this.page.locator(`#p_num_people_${mesaId}`).textContent();
    return parseInt(texto ?? '0', 10) || 0;
  }


  // ─── "Cambiar de mesa" ───────────────────────────────────────────────────

  /**
   * Cambia la orden de `mesaOrigenId` hacia una mesa DISPONIBLE distinta.
   *
   * Investigado a fondo en vivo, corrigiendo un supuesto inicial equivocado:
   * esta acción SÍ abre un modal propio, "ASIGNAR ORDEN A MESA"
   * (`#dialog_rest_table_view`) — el toast "¡Seleccione mesa a mover orden!"
   * observado en una investigación anterior resultó ser una notificación
   * lateral, no la mecánica real. El modal muestra el mismo grid de mesas
   * del plano (con pestañas por salón, `.lounge-tabs-wrapper`) DENTRO de sí
   * mismo — clickear una mesa del plano de fondo (cubierto por este modal)
   * nunca completaba nada, solo generaba "... subtree intercepts pointer
   * events" (mismo modal bloqueando el click) y, si se forzaba el click en
   * un lugar equivocado, no movía la orden. La mesa destino real se elige
   * DENTRO del modal: cada mesa disponible es una `.table-card-available`
   * con su propio botón "ASIGNAR" (`.btn_assign_rest_order_to_table_enable`,
   * `onclick="rest_add_order_to_table(<mesaId>)"`) — se lee ese mesaId
   * directo del propio onclick (nunca se asume cuál mesa mostrará primero
   * el modal) en vez de adivinarlo. Devuelve los datos de la mesa destino
   * realmente asignada.
   */
  async cambiarDeMesa(mesaOrigenId: string): Promise<DatosMesaPlano> {
    const menu = await this.abrirMenuMesa(mesaOrigenId);
    await menu.locator(L_MESA.ITEM_CAMBIAR_MESA).evaluate((el: HTMLElement) => el.click());

    const modal = this.page.locator('#dialog_rest_table_view');
    await expect(
      modal,
      'El modal "ASIGNAR ORDEN A MESA" no apareció'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const tarjetaDisponible = modal.locator('.table-card-available:visible').first();
    await expect(
      tarjetaDisponible,
      'No hay ninguna mesa disponible en el modal "ASIGNAR ORDEN A MESA"'
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const btnAsignar = tarjetaDisponible.locator('.btn_assign_rest_order_to_table_enable');
    const onclickAsignar = await btnAsignar.getAttribute('onclick') ?? '';
    const destinoMesaId = onclickAsignar.match(/rest_add_order_to_table\((\d+)\)/)?.[1];
    expect(destinoMesaId, `No se pudo leer el id de la mesa destino desde "${onclickAsignar}"`).toBeTruthy();

    await btnAsignar.evaluate((el: HTMLElement) => el.click());

    // Confirmación opcional (SweetAlert v1, mismo mecanismo que el resto de
    // acciones "Enviar"/"Guardar" de la suite) — no siempre aparece para
    // esta acción específica, así que no es obligatoria: solo se confirma
    // si efectivamente se muestra.
    const confirmacion = this.page.locator('.sweet-alert.visible');
    if (await confirmacion.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
      await confirmacion.locator('button.confirm').click();
    }

    await expect(
      modal,
      'El modal "ASIGNAR ORDEN A MESA" no se cerró tras asignar la mesa destino'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.abrirMesas();

    await expect.poll(
      async () => (await this.obtenerMesasDelPlano()).find((m) => m.mesaId === mesaOrigenId)?.ocupada,
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: `La mesa de origen ${mesaOrigenId} no quedó libre tras el cambio` }
    ).toBe(false);

    const mesasActuales = await this.obtenerMesasDelPlano();
    const destino = mesasActuales.find((m) => m.mesaId === destinoMesaId);
    expect(destino, `La mesa destino ${destinoMesaId} no aparece en el plano tras el cambio`).toBeDefined();
    return destino!;
  }


  // ─── "Unificar" ──────────────────────────────────────────────────────────

  /** Locator del modal "Unificar mesas". */
  get modalUnificar(): Locator {
    return this.page.locator('div', { hasText: 'Unificar mesas' }).first();
  }


  /**
   * Unifica la mesa ocupada `mesaOrigenId` con una mesa DISPONIBLE distinta
   * (el propio modal "Unificar mesas" solo lista mesas disponibles —
   * confirmado en vivo, filtrado por el backend, nunca las ocupadas — así
   * que cualquier tarjeta ahí mostrada ya cumple esa condición). Devuelve el
   * nombre de la mesa elegida para unificar.
   */
  async unificarMesaConDisponible(mesaOrigenId: string): Promise<string> {
    const mesasDelPlano = await this.obtenerMesasDelPlano();
    const idsDelPlano = new Set(mesasDelPlano.map((m) => m.mesaId));

    const menu = await this.abrirMenuMesa(mesaOrigenId);
    await menu.locator(L_MESA.ITEM_UNIFICAR).evaluate((el: HTMLElement) => el.click());

    // `visible=true`, no getByText() a secas: confirmado en vivo que existe
    // un `<p class="hide" id="unifyTables">Unificar mesas</p>` — plantilla de
    // traducción de la propia aplicación, idéntico al texto real del modal.
    const tituloModal = this.page.locator('text=Unificar mesas >> visible=true');
    await expect(
      tituloModal,
      'El modal "Unificar mesas" no apareció'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // El modal "Unificar mesas" lista mesas disponibles de TODOS los salones
    // (su propio endpoint real es `getRestTableListByLounge`, confirmado en
    // vivo por el listener de peticiones), no solo del salón actualmente
    // visible en el plano de Mesas — confirmado en vivo que la primera
    // tarjeta disponible del modal puede pertenecer a un salón distinto,
    // haciendo que luego no aparezca en `obtenerMesasDelPlano()` (que solo
    // lee los `.fig` del salón activo). Por eso NO se toma la primera
    // tarjeta a ciegas: se recorren todas y se elige la primera cuyo
    // `destinoMesaId` (leído del onclick real `confirm_unify_tables(<id>, ...)`)
    // ya está presente entre los ids del plano actual.
    await expect(
      this.page.locator('.table-card-available').first(),
      'No hay ninguna mesa disponible para unificar'
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const candidatos = await this.page.locator('.table-card-available').evaluateAll((tarjetas) =>
      tarjetas.map((tarjeta) => {
        const boton = tarjeta.querySelector('button');
        const onclick = boton?.getAttribute('onclick') ?? '';
        return onclick.match(/confirm_unify_tables\((\d+),/)?.[1] ?? null;
      })
    );
    const indiceElegido = candidatos.findIndex((id) => id !== null && idsDelPlano.has(id));
    expect(
      indiceElegido,
      `Ninguna mesa disponible del modal "Unificar mesas" pertenece al salón actualmente visible en el plano (candidatos: ${JSON.stringify(candidatos)}, plano: ${JSON.stringify([...idsDelPlano])})`
    ).toBeGreaterThanOrEqual(0);

    const destinoMesaId = candidatos[indiceElegido]!;
    const contenedorTarjeta = this.page.locator('.table-card-available').nth(indiceElegido);
    // El nombre real de la mesa vive en `.table-name` (dentro de
    // `.table-card-header`) — confirmado en vivo que NO es un h4/strong/p
    // genérico como se asumió inicialmente (esa variante siempre devolvía
    // vacío). Si la mesa no tiene nombre propio asignado, usa su id como
    // fallback (mismo criterio que el resto del módulo cuando el nombre está
    // vacío).
    const nombreMesa = (
      (await contenedorTarjeta.locator('.table-name').first().textContent({ timeout: 5_000 }).catch(() => null))?.trim()
      || destinoMesaId
    );

    // El botón real es `<button id="confirm_unify_tables_<destino>_<ordenOrigen>"
    // onclick="confirm_unify_tables(<destinoMesaId>, <ordenOrigenId>)">` —
    // confirmado en vivo que un click SINTÉTICO de Playwright (`.click()`)
    // sobre este botón específico no dispara ninguna petición de red (mismo
    // patrón ya documentado para "Renombrar mesa"), aunque sí llega a mostrar
    // el SweetAlert de confirmación ("¿Está seguro?"). Se usa click NATIVO
    // (vía evaluate) en ese botón, y otro click NATIVO en el botón "confirm"
    // del SweetAlert resultante — confirmado en vivo que esa combinación SÍ
    // dispara las 2 peticiones reales (`updateRestOrderUnifyTables`,
    // `getRestTableListByLounge`).
    const btnId = await contenedorTarjeta.getByRole('button', { name: 'Unificar' }).evaluate((el) => el.id);

    // Señal real de éxito: la propia respuesta HTTP de
    // `updateRestOrderUnifyTables` (200 OK) — confirmado en vivo (con
    // diagnóstico de red) que esta petición SÍ se dispara y responde
    // correctamente con el click nativo descrito arriba. Se prefiere esto
    // sobre volver a inspeccionar el plano de mesas: confirmado en vivo que
    // el propio backend, tras unificar, dispara además un refresco interno
    // (`getRestTableListByLounge`) cuyo momento exacto de reflejarse en el
    // DOM del plano no es consistente entre corridas (a veces la mesa
    // destino tarda más de lo esperado en reaparecer con su nuevo estado, o
    // el refresco reemplaza temporalmente los `.fig` del plano) — la petición
    // HTTP en sí es la señal estable y ya confirmada de que la unificación
    // ocurrió, sin depender de esa sincronización visual del plano.
    const [respuestaUnify] = await Promise.all([
      this.page.waitForResponse((res) => res.url().includes('updateRestOrderUnifyTables'), { timeout: TIMEOUTS.PAYMENT_MODAL }),
      this.page.evaluate((id) => (document.getElementById(id) as HTMLElement | null)?.click(), btnId),
      (async () => {
        const confirmacion = this.page.locator('.sweet-alert.visible');
        if (await confirmacion.waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL }).then(() => true).catch(() => false)) {
          await confirmacion.locator('button.confirm').evaluate((el: HTMLElement) => el.click());
        }
      })(),
    ]);
    expect(respuestaUnify.ok(), `La petición "updateRestOrderUnifyTables" respondió con estado ${respuestaUnify.status()}`).toBe(true);

    await tituloModal.locator('xpath=ancestor::div[contains(@class,"modal-content")][1]//button[@data-dismiss="modal"]').first().click();
    await expect(
      tituloModal,
      'El modal "Unificar mesas" no se cerró tras cerrarlo manualmente'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    return nombreMesa;
  }


  // ─── "Eliminar Orden" ────────────────────────────────────────────────────

  /**
   * Elimina la orden de la mesa dada, confirmando el modal real "¿Eliminar
   * Orden?" ("¡Una vez eliminada no hay vuelta atrás!", confirmado en vivo)
   * con su botón "Continuar".
   */
  async eliminarOrden(mesaId: string) {
    const menu = await this.abrirMenuMesa(mesaId);
    await menu.locator(L_MESA.ITEM_ELIMINAR).evaluate((el: HTMLElement) => el.click());

    // `visible=true`, mismo criterio que renombrar/unificar/personas: evita
    // el mismo tipo de colisión con una plantilla de traducción oculta si
    // existiera para este texto (no confirmada, pero el patrón ya se repitió
    // en 3 de 4 modales de este módulo).
    const tituloModal = this.page.locator('text=¿Eliminar Orden? >> visible=true');
    await expect(
      tituloModal,
      'El modal "¿Eliminar Orden?" no apareció'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.page.getByRole('button', { name: 'Continuar' }).click();

    await expect(
      tituloModal,
      'El modal de eliminar no se cerró tras confirmar'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  // ─── Impresión: Pre-Factura / Comanda ────────────────────────────────────

  /**
   * Espera la ventana emergente de impresión (`window.open(...)`) y confirma
   * que efectivamente se abrió — la misma señal real de éxito que
   * `PosCore.mostrarYCerrarVentanaImpresion()` ya usa para las facturas
   * normales del resto de la suite ("la señal real y ya validada de éxito es
   * que el popup se abrió en absoluto ... no el contenido final de su URL").
   *
   * LIMITACIÓN DE AUTOMATIZACIÓN CONFIRMADA EN VIVO, investigada a fondo (no
   * asumida): a diferencia de esas facturas normales (que sí navegan a una
   * URL real y permiten leer su documento con margen de sobra), esta ventana
   * de Pre-Factura/Comanda NUNCA navega a ninguna URL — permanece en
   * about:blank todo su ciclo de vida — y se cierra sola casi
   * instantáneamente (confirmado con `page.on('popup')`+`page.on('close')`:
   * el evento `close` llega antes de que exista siquiera una oportunidad
   * real de leer su DOM). Se probaron, cada una por separado, las 3 vías
   * disponibles para leer su contenido:
   *   1. `popup.textContent('body')` tras `waitForLoadState('domcontentloaded')`
   *      → "Target page, context or browser has been closed" (la ventana ya
   *      cerró para cuando `domcontentloaded` intenta resolver).
   *   2. Interceptar `response` (mismo mecanismo que si navegara a una URL
   *      real) → nunca se dispara ningún evento `response`: no hay ninguna
   *      petición de red real que interceptar (el contenido se genera
   *      100% client-side, vía `document.write()`/manipulación directa del
   *      DOM, no vía una carga de documento real).
   *   3. Leer `popup.content()` en un bucle acotado de reintentos cortos
   *      (compitiendo contra el cierre) → la ventana ya está cerrada en el
   *      primer intento; el cierre ocurre dentro del mismo bloque síncrono
   *      de JS del navegador que abre la ventana, ANTES de que el evento
   *      "popup" de Playwright llegue siquiera a procesarse en Node.
   * Con las 3 vías agotadas y descartadas, leer el contenido real de esta
   * ventana específica no es técnicamente viable con Playwright en este
   * ambiente — se documenta como limitación real (no un bug de la
   * automatización ni del sistema), y los Escenarios 6/7/8 validan
   * únicamente la señal de éxito real y observable: que la ventana de
   * impresión se abrió. Ver el informe final para la evidencia completa.
   */
  private async _confirmarVentanaImpresionAbierta(disparar: () => Promise<void>): Promise<void> {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP });
    await disparar();
    await popupPromise;
  }


  /** Genera la Pre-Factura de la orden de la mesa dada y confirma que la ventana de impresión se abrió (ver la limitación documentada arriba). */
  async imprimirPreFactura(mesaId: string): Promise<void> {
    const menu = await this.abrirMenuMesa(mesaId);
    return this._confirmarVentanaImpresionAbierta(() =>
      menu.locator(L_MESA.ITEM_PRE_FACTURA).evaluate((el: HTMLElement) => el.click())
    );
  }


  /**
   * Imprime la comanda de la mesa dada, en el modo indicado: `nuevos` (solo
   * los ítems agregados desde la última comanda impresa) o `todos` (la orden
   * completa) — confirmado en vivo que son dos ítems de menú reales
   * distintos (print_invoice_view_order_rest_qz_direct(ordenId, 'new_items'|'all_items')),
   * no una casilla ni un parámetro de un único flujo. Devuelve el contenido
   * real del documento de la comanda.
   */
  async imprimirComanda(mesaId: string, modo: 'nuevos' | 'todos'): Promise<void> {
    const menu = await this.abrirMenuMesa(mesaId);
    const item = modo === 'nuevos' ? L_MESA.ITEM_COMANDA_NUEVOS : L_MESA.ITEM_COMANDA_TODOS;
    return this._confirmarVentanaImpresionAbierta(() =>
      menu.locator(item).evaluate((el: HTMLElement) => el.click())
    );
  }
}
