import { expect, Locator, Page } from '@playwright/test';

// ─── URL ──────────────────────────────────────────────────────────────────────

export const POS_URL =
  'https://dev.designsoftcr.com/qa_talleralpha/public/pos/pointOfSale?company_pos=37&pos_type_option=1';

// Usada únicamente por cargarPosDesdeDashboard() — ver el comentario de ese
// método para el motivo.
export const DASHBOARD_URL =
  'https://dev.designsoftcr.com/qa_talleralpha/public/dash/dashboard';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:          300_000,
  NAVIGATE:       90_000,
  PRODUCTS_LOAD: 120_000,
  PAYMENT_MODAL:  15_000,
  PRINT_POPUP:    15_000,
} as const;

// ─── Pausas visuales ──────────────────────────────────────────────────────────
// Permiten ver cada paso en la pantalla durante la ejecución en modo headed.

const PAUSES = {
  VER_PRODUCTOS:        2_000,
  VER_CARRITO:          2_500,
  VER_MODAL:            1_500,
  CHECKBOX_ACTIVACION:    800,
  CAMPO_HABILITADO:     1_000,
  VER_MONTO:            1_500,
  VER_FACTURA:          4_000,
  POST_CIERRE:          2_000,
  ESTADO_FINAL:         3_000,
} as const;

// ─── Locators ─────────────────────────────────────────────────────────────────

const L = {
  // POS principal
  PRODUCTO:          '.product_box_name',
  BTN_FACTURAR:      '#btn_pay_sale',
  CARRITO_CLAVES:    '#table_buy_list p[id^="drag_and_drop_"]',
  DESCUENTO_GENERAL: '#apply_general_discount',

  // Cualquier modal Bootstrap actualmente abierto (".in" es la clase estándar
  // de Bootstrap 3 para "visible"). Se usa de forma genérica para detectar que
  // un producto requiere un paso adicional antes de agregarse al carrito —
  // "Monto a comprar" (precio variable) y "Cantidad de fracciones" (productos
  // fraccionados) son dos casos confirmados, pero el catálogo puede tener
  // otros tipos de producto con su propio modal que todavía no se han visto.
  MODAL_ABIERTO: '.modal.in',

  // Modal de pago
  TOTAL_MODAL:       'total_sale_txt',         // ID sin # — se lee vía evaluate()
  BTN_CONFIRMAR:     '#make_payment',
  EFECTIVO_MONTO:    '#payment_cash_total',    // señal confiable de apertura del modal
  EFECTIVO_RECIBIDO: '#received_mount',

  // Apertura de caja — un único contenedor cubre tanto "Caja: Cerrada" (sin
  // discrepancia) como el aviso de diferencia de efectivo al intentar abrirla.
  DIALOG_ABRIR_CAJA: '#dialog_cash_opening',
  CAJA_BTN_ABRIR:    '#btn_open_cash',
  CAJA_MONTO:        'input[placeholder="0.00"]',
  CAJA_OBSERVACION:  'Ingrese sus observaciones aquí',

  // Menú "Caja" → "(F12) Abrir/Cerrar Caja". El mismo ítem de menú despliega el
  // modal "Abrir Caja" si la caja está cerrada, o "Detalle de Cierre" si está
  // abierta — descubierto inspeccionando el DOM real, no asumido.
  MENU_CAJA_BTN:        '#menu_cash',
  MENU_CAJA_ITEM_F12:   'Abrir/Cerrar Caja',
  // El <ul> del menú "Caja" (componente MDL, mismo patrón que el menú de tres
  // puntos): al upgradearse queda envuelto en un div.mdl-menu__container, que es
  // el que gana la clase "is-visible" mientras el menú está desplegado —
  // confirmado inspeccionando el DOM real en vivo (el <ul> y el <li> nunca usan
  // aria-expanded). #menu_cash es el botón que dispara el toggle, no el que
  // refleja el estado.
  MENU_CAJA_UL:          'ul.mdl-menu[for="menu_cash"]',

  // Modal "Detalle de Cierre" (cerrar caja)
  DIALOG_CERRAR_CAJA:      '#dialog_cash_closing',
  CIERRE_EFECTIVO_CAJA:    '#closure_posted_balance',
  CIERRE_EFECTIVO_SIGUIENTE: '#next_cash_closing',
  CIERRE_OBSERVACION:      '#closuse_cash_observation', // sic: typo real de la app ("closuse")
  CIERRE_BTN_CERRAR:       '#btn_close_cash',
  CIERRE_BTN_CANCELAR:     'button[data-dismiss="modal"]',

  // Menú de tres puntos del encabezado y sus opciones de historial. El botón
  // (#demo-menu-lower-left) solo recibe el upgrade "MaterialButton" (estilo);
  // quien realmente registra el listener que ABRE el menú es el <ul> con
  // for="demo-menu-lower-left", al upgradearse a "MaterialMenu" — confirmado
  // inspeccionando el DOM en vivo. Ese es el indicador real de que un click
  // puede funcionar, no la sola presencia del botón.
  MENU_TRES_PUNTOS:              '#demo-menu-lower-left',
  MENU_TRES_PUNTOS_INICIALIZADO: 'ul.mdl-menu[for="demo-menu-lower-left"][data-upgraded*="MaterialMenu"]',
  HISTORIAL_FACTURAS:   '#print_invoice a',
  HISTORIAL_PROFORMAS:  '#view_proform',

  // Categorías (barra lateral izquierda). "Lista de precios" no se incluye:
  // el propio sistema la mantiene oculta (display: none) para esta compañía.
  CAT_TODOS:         '.left_category_all',
  CAT_COMBOS:        '.li_left_category_combo',
  CAT_TIPO:          '#btn_cate_id_171',
  CAT_FRACCIONADOS:  '#btn_cate_id_175',
  CAT_VARIANTES:     '#btn_cate_id_174',
  CAT_ACTIVE_CLASS:  'left_category_active',

  // Toggle de vista de productos: lista vs. cuadrícula
  VISTA_LISTA:            '#style_list',
  VISTA_CUADRICULA:       '#style_box',
  VISTA_ACTIVE_CLASS:     'product_style_active',
  VISTA_ESTILO_ACTUAL:    '#current_product_style', // oculto en el DOM; refleja el estado inicial ("box")

  // Tabs Servicios / End. Pintura
  TAB_SERVICIOS:       '#ck_view_services',
  TAB_PINTURA:         '#ck_view_straightening_and_paint',
  TAB_ACTIVE_CLASS:    'btn_sale_selected',

  // Wizard "End. Pintura": Vehículo → Parte → Pieza → Servicio → modal de precio.
  // El <select> real de vehículo está oculto (display:none); el widget "Chosen"
  // (jQuery) que lo reemplaza visualmente es lo único clickeable — confirmado
  // inspeccionando el DOM en vivo. El primer <li> de sus resultados es siempre
  // el placeholder "Selecc. vehículo" ya marcado result-selected, así que hay
  // que filtrar por texto, nunca tomar el primero.
  PINTURA_VEHICULO_TRIGGER:   '#select_type_vehicle_chosen .chosen-single',
  PINTURA_VEHICULO_RESULTADO: '#select_type_vehicle_chosen .chosen-results li',
  // Parte, pieza y servicio son catálogo configurable por la empresa (tienen su
  // propio botón "add" hacia el administrador), no una taxonomía fija de la
  // interfaz — a diferencia del tipo de vehículo, no hay nombre estable en el
  // que apoyarse, así que se selecciona la primera opción disponible.
  PINTURA_PARTE:    '.part_vehicle',
  PINTURA_PIEZA:    '.piece-or-service.piece',
  PINTURA_SERVICIO: '.piece-or-service.service',

  // Modal "Selecciona un precio" (Bootstrap estándar, mismo patrón que
  // L.MODAL_ABIERTO). "div_price_new" es una tarjeta fija de la interfaz
  // ("Agregar precio a este servicio", crea un precio nuevo) que nunca debe
  // tratarse como una opción de precio existente — se excluye por selector,
  // no por texto (su rótulo es configurable por la empresa).
  DIALOG_SELECCIONAR_PRECIO: '#dialog_select_prices',
  PINTURA_PRECIO_OPCION:     '#modal_prices_body [id^="div_price_"]:not(#div_price_new)',

  // "Producto Rápido": botón flotante (FAB, librería mfb) en la esquina
  // inferior derecha. El toggle principal y el ítem hijo quedan con
  // bounding box 0 (fuera del viewport para Playwright) hasta que el
  // toggle se clickea y la animación "mfb-zoomin" los expande — confirmado
  // inspeccionando el DOM en vivo, de ahí la necesidad de click({force:true})
  // y de reintentar hasta que el ítem hijo se vuelva visible.
  FAB_TOGGLE:        '#add_sn_product > li.mfb-component__wrap-new > a.mfb-component__button--main',
  FAB_ITEM_PRODUCTO_RAPIDO: 'a[data-mfb-label*="Producto Rápido"]',
  // Mismo FAB del POS, ítem hermano de "Producto Rápido" — confirmado en vivo
  // (label real: "(⇧+G) Agregar combo", onclick="add_restaurant_combo(0)").
  FAB_ITEM_CREAR_COMBO: 'a[data-mfb-label*="Agregar combo"]',

  DIALOG_PRODUCTO_RAPIDO: '#dialog_quick_product_pos',
  QUICK_PRODUCT_NOMBRE:   '#quick_product_name',
  QUICK_PRODUCT_PRECIO:   '#quick_product_price',
  QUICK_PRODUCT_CANTIDAD: '#quick_product_quantity',
  QUICK_PRODUCT_APLICAR_IVA: '#check_quick_product_apply_tax',
  QUICK_PRODUCT_TIPO_IVA:    '#quick_product_tax',
  QUICK_PRODUCT_TASA_IVA:    '#quick_product_tax_rate',
  QUICK_PRODUCT_PRECIO_CON_IVA: '#quick_product_price_with_iva',
  QUICK_PRODUCT_GUARDAR:  '.save_quick_product_pos',

  // Sub-modal de búsqueda de CABYS, abierto desde el botón "CABYS" del
  // formulario de Producto Rápido.
  QUICK_PRODUCT_BTN_CABYS: '#quick_product_cabys_content a._btn_15',
  QUICK_PRODUCT_CABYS_TAX_SUGERIDO: '#quick_product_cabys_tax',
  DIALOG_BUSCAR_CABYS:     '#dialog_add_cabys_code',
  CABYS_BUSCADOR_INPUT:    '#cabys_code_search',
  CABYS_BUSCADOR_BOTON:    '#btn_cabys_code_search',
  CABYS_FILAS_RESULTADO:   '#table_cabys_code_content tbody tr',

  // Petición AJAX real que guarda el producto rápido (ver quick_product_save()
  // → add_sn_product() en pos.js). Se usa para armar waitForResponse() antes
  // del click y validar la red explícitamente, no solo el efecto visual.
  AJAX_GUARDAR_PRODUCTO: 'getPosProductSaleItem',

  // ─── "Crear Combo" (mismo FAB que "Producto Rápido") ───────────────────────
  DIALOG_CREAR_COMBO:        '#dialog_add_restaurant_combo',
  COMBO_NOMBRE:              '#combo_rest_name',
  COMBO_PRECIO_FINAL:        '#combo_rest_total',
  COMBO_CANTIDAD:            '#combo_rest_quantity',
  COMBO_BUSCADOR_PRODUCTO:   '#search_parameter',
  // Los resultados de búsqueda son <div onclick="get_product_combo(...)">,
  // no <a> — confirmado inspeccionando el DOM en vivo (a diferencia de los
  // resultados de CABYS o de cliente, que sí son enlaces/filas normales).
  COMBO_RESULTADO_ITEM:      '#product_option_view [onclick]',
  COMBO_LISTA_PRODUCTOS:     '#content_combo_product_list',
  COMBO_PRODUCTO_EN_LISTA:   '#content_combo_product_list [id^="product_combo_"]',
  COMBO_PRECIO_REAL:         '#real_price_combo',
  COMBO_BTN_GUARDAR:         '#btn_save_combo',
  // Botón "CABYS" propio de este formulario. A diferencia de lo asumido
  // inicialmente, NO reutiliza el sub-modal de "Producto Rápido"
  // (#dialog_add_cabys_code): abre uno propio y completamente separado
  // (#dialog_add_cabys_code_combo, con su propio input/botón/tabla, todos
  // con sufijo "_combo") — confirmado en vivo interceptando qué modal
  // realmente queda visible tras el click.
  COMBO_BTN_CABYS:              'a[href="javascript:show_add_cabys_code_combo();"]',
  COMBO_DIALOG_BUSCAR_CABYS:    '#dialog_add_cabys_code_combo',
  COMBO_CABYS_BUSCADOR_INPUT:   '#cabys_code_search_combo',
  COMBO_CABYS_BUSCADOR_BOTON:   '#btn_cabys_code_search_combo',
  COMBO_CABYS_FILAS_RESULTADO:  '#table_cabys_code_combo tr',
  // Checkbox "¿Aplicar impuesto?" propio de "Crear Combo" — a diferencia del
  // de "Producto Rápido" (#check_quick_product_apply_tax), no tiene el bug
  // de reseteo de pos.js:680-699 y sus "Chosen" de tipo/tasa ya quedan en una
  // opción real (no un placeholder) apenas se marca — confirmado en vivo.
  COMBO_APLICAR_IVA:         '#apply_tax_combo',
  // Select "Seleccione la tarifa" propio de "Crear Combo" — homólogo de
  // QUICK_PRODUCT_TASA_IVA, pero solo se sincroniza con el CABYS aplicado si
  // el checkbox COMBO_APLICAR_IVA ya estaba marcado ANTES de aplicar el
  // CABYS: confirmado en vivo que con el checkbox desmarcado el CABYS no
  // toca este select (queda en la opción "0% Exento" por defecto), pero con
  // el checkbox ya marcado, aplicar un CABYS de tasa 13% deja este select
  // realmente seleccionado en "13%" — a diferencia de lo documentado
  // anteriormente ("el de Combo no tiene ese autocompletado"), sí lo tiene,
  // pero condicionado al orden checkbox→CABYS.
  COMBO_TASA_IVA:            '#tax_rate_list',
  // Texto con la tasa que el CABYS aplicado sugiere, propio de "Crear Combo"
  // — homólogo de QUICK_PRODUCT_CABYS_TAX_SUGERIDO. Mismo formato observado
  // en vivo (fracción, ej. "0.13", no porcentaje).
  COMBO_CABYS_TAX_SUGERIDO:  '#lbl_search_product_cabys_tax',

  // Petición AJAX real que persiste el combo (save_restaurant_combo() en
  // pos.js) — confirmado en vivo inspeccionando la red tras un guardado
  // exitoso.
  AJAX_GUARDAR_COMBO: 'save_company_combo',

  // ─── "Crear Producto" (primera tarjeta del grid de productos del POS) ──────
  // Confirmado en vivo: NO es el mismo flujo que "Inventario → Crear
  // Producto" del menú lateral (esa es una página completamente distinta,
  // /prod/product, con su propio wizard) — este es un modal embebido en el
  // propio POS (wizard jQuery Steps de 3 pasos), abierto desde la primera
  // tarjeta especial del grid de productos (clase product_box_new_item,
  // texto "Crear Producto", onclick="add_product_modal(...)").
  PRODUCTO_TARJETA_CREAR:     '.product_box_new_item',
  DIALOG_CREAR_PRODUCTO:      '#dialog_add_quick_product',
  PRODUCTO_NOMBRE:            '#product_name_app',
  PRODUCTO_MARCA:             '#product_brand_app',
  PRODUCTO_PROVEEDOR_CODIGO:  '#product_provider_code_app',
  PRODUCTO_CODIGO_BARRAS:     '#product_bar_code_app',
  // Categoría/Subcategoría/Proveedor/Tipo de Unidad/Sección/Sub sección son
  // todos widgets "Chosen" (mismo patrón que el resto de la suite) —
  // confirmado en vivo que sus contenedores "_chosen" existen y responden al
  // mismo clic-y-elegir-primera-opción ya usado para IVA/tasa en Producto
  // Rápido y Combo.
  PRODUCTO_CATEGORIA_CHOSEN:    '#category_select_spk_app_chosen',
  PRODUCTO_SUBCATEGORIA_CHOSEN: '#subcategory_select_spk_app_chosen',
  PRODUCTO_PROVEEDOR_CHOSEN:    '#provider_select_spk_app_chosen',
  PRODUCTO_TIPO_UNIDAD_CHOSEN:  '#product_unit_type_app_chosen',
  PRODUCTO_SECCION_CHOSEN:      '#product_section_app_chosen',
  PRODUCTO_SUBSECCION_CHOSEN:   '#product_sub_section_app_chosen',

  // Botones de navegación del wizard (jQuery Steps): cada uno es un <a> con
  // href="#accion" — "Guardar" y "Siguiente" ya persisten el paso actual vía
  // AJAX (saveProductStepOne / updateProductSteptwo), y "Finalizar" —visible
  // únicamente en el último paso— dispara updateProductStepthree y cierra el
  // modal. Confirmado en vivo interceptando la red en cada click.
  PRODUCTO_WIZARD_SIGUIENTE: '#dialog_add_quick_product .actions a[href="#next"]',
  PRODUCTO_WIZARD_FINALIZAR: '#dialog_add_quick_product .actions a[href="#finish"]',

  // Paso "Costos": campos "simples" (visibles por defecto, sin fraccionar).
  PRODUCTO_COSTO:            '#product_cost_app',
  PRODUCTO_PRECIO_VENTA:     '#product_price_app',
  PRODUCTO_CANTIDAD:         '#product_quantity_app',
  PRODUCTO_STOCK_MINIMO:     '#product_stock_min_app',
  PRODUCTO_DESCUENTO_PROVEEDOR: '#product_discount_app',
  PRODUCTO_DESCUENTO_MAXIMO: '#product_max_discount_app',

  // Checkbox "¿Aplica Impuesto?" — al marcarlo revela un select de tipo y
  // uno de tasa (ambos <select> nativos, SIN Chosen — confirmado en vivo con
  // page.selectOption() funcionando directo, a diferencia de categoría/
  // proveedor/etc. de este mismo formulario). La opción de tasa trae un
  // atributo `percent` real (ej. percent="10.00000"), mismo patrón que ya
  // usan Producto Rápido y Combo.
  PRODUCTO_APLICAR_IVA:      '#apply_tax_check_app',
  PRODUCTO_TIPO_IVA:         '#add_quick_product_product_tax_list_1',
  PRODUCTO_TASA_IVA:         '#add_quick_product_product_tax_rate_list_1',

  // Checkbox "¿Fraccionar?" — al marcarlo, el sistema REEMPLAZA los campos
  // simples de precio (product_utility_app/product_discount_app/
  // product_price_app/product_quantity_app) por dos grupos nuevos: "_box_app"
  // (precio por caja) y "_fragment_app" (precio por fracción) — confirmado
  // en vivo comparando el DOM antes/después de marcar el checkbox, no
  // asumido. product_price_box_app y product_price_fragment_app son los
  // únicos obligatorios de ambos grupos.
  PRODUCTO_FRACCIONAR:              '#is_fragment_app',
  PRODUCTO_PRECIO_CAJA:             '#product_price_box_app',
  PRODUCTO_CANTIDAD_CAJA:           '#product_quantity_box',
  PRODUCTO_FRACCIONES_POR_UNIDAD:   '#fragments_per_unit_app',
  PRODUCTO_PRECIO_FRACCION:         '#product_price_fragment_app',

  // Botón "CABYS" propio de este formulario — pertenece al panel del paso
  // "Inf. General" (debajo de "Proveedor"), NO al paso "Costos" — confirmado
  // en vivo inspeccionando el DOM real, contradice lo documentado
  // anteriormente aquí ("no aparece en este ambiente"): sí aparece y está
  // visible en "Inf. General" en cuanto se abre el modal (sin depender de
  // llenar Proveedor), porque esta compañía SÍ exige CABYS
  // (#validate_cabys_code = "1", confirmado en vivo). El panel de "Inf.
  // General" se oculta —no se destruye— al avanzar a "Costos" con
  // avanzarPasoInfoGeneralProducto(), así que comprobar/usar este botón
  // DESPUÉS de avanzar siempre lo encuentra oculto y concluye erróneamente
  // que CABYS no existe. Reutiliza el sub-modal COMPARTIDO de CABYS
  // (#dialog_add_cabys_code, el mismo que usa Producto Rápido) — confirmado
  // en vivo que NO abre uno propio como sí hace Combo.
  PRODUCTO_BTN_CABYS:        '#quick_pos_product_cabys_content a[href*="validate_pos_cabys_code"]',
  PRODUCTO_CABYS_TAX_SUGERIDO: '#product_cabys_tax',

  // Paso "Desc. Producto".
  PRODUCTO_TAMANO:       '#product_size_app',
  PRODUCTO_DESCRIPCION:  '#product_description_app',

  // Peticiones AJAX reales de cada paso del wizard (confirmadas en vivo
  // interceptando la red) — saveProductStepOne es la que efectivamente crea
  // el producto (responde con product_id); las otras dos solo actualizan
  // pasos posteriores del mismo producto ya creado.
  AJAX_GUARDAR_PRODUCTO_PASO1: 'saveProductStepOne',
  AJAX_GUARDAR_PRODUCTO_PASO2: 'updateProductSteptwo',
  AJAX_GUARDAR_PRODUCTO_PASO3: 'updateProductStepthree',

  // Área de totales del POS (footer principal, NO el modal de pago): fila
  // etiquetada "IVA" que acumula el impuesto de todo el carrito. Confirmado
  // en el HTML real que es un elemento distinto de TOTAL_MODAL (el total de
  // la factura en el modal de pago) y de "#total_by_product_<clave>" (el
  // total de una sola línea).
  TOTAL_IVA_GENERAL: '#total_tax',

  // Checkbox "IVA" ubicado en el encabezado (<thead>) de la tabla del
  // carrito, arriba de las filas — confirmado en el HTML real:
  // <th id="lbl_price_with_iva">...<input id="show_price_with_iva">...</th>,
  // NO el checkbox del formulario "Producto Rápido"
  // (#check_quick_product_apply_tax) ni el del resumen de totales
  // (#apply_general_tax). Distinto en propósito de ambos: confirmado en vivo
  // que show_price_with_iva() solo alterna qué elemento paralelo de cada
  // línea se muestra (con/sin IVA, ya calculados de antemano) — no
  // recalcula nada ni afecta el resumen de totales.
  MOSTRAR_PRECIO_CON_IVA: '#show_price_with_iva',

  // Pestañas superiores del POS (POS Facturación / Órdenes de caja / Taller /
  // etc.) — NO confundir con TAB_SERVICIOS/TAB_PINTURA, que son sub-tabs
  // dentro del panel de catálogo. Contenedor y clase de "activa" confirmados
  // en vivo: <div id="menu_pos_option_item"> con un <a> por pestaña, cada
  // uno con un id técnico estable (btn_pos_option, btn_cashier_option, etc. —
  // no localizado, a diferencia del texto visible) y la clase "btn_tab_active"
  // agregada al que está seleccionado. set_pos_type_option es el único POST
  // que las 8 pestañas probadas dispararon todas, sin excepción, al
  // cambiar — de ahí que sea la condición de espera de red elegida en vez de
  // un endpoint distinto por pestaña.
  PESTANAS_POS_CONTENEDOR: '#menu_pos_option_item',
  PESTANA_POS_CLASE_ACTIVA: 'btn_tab_active',
  AJAX_CAMBIO_PESTANA_POS: 'set_pos_type_option',

  // Panel "Buscar Cliente", arriba del carrito. No es Select2/Chosen: es un
  // panel propio (.customer_selection) que reemplaza al catálogo de
  // productos con tarjetas de resultado (.customer-list-pos), confirmado en
  // vivo. selectCustomerToPos(id) —el onclick de cada tarjeta— es puro DOM,
  // sin AJAX propio; el AJAX real ocurre al buscar (getCustomerByPosOption).
  PANEL_BUSCAR_CLIENTE: '.panel-customer-search',
  CLIENTE_INPUT_BUSQUEDA: '#search_pos_customer',
  CLIENTE_BTN_BUSCAR: '.panel-customer-search .btn-search-product-pos',
  CLIENTE_AJAX_BUSQUEDA: 'getCustomerByPosOption',
  CLIENTE_PANEL_RESULTADOS: '.customer_selection',
  CLIENTE_SIN_RESULTADOS: '#not_result_customer_search',
  CLIENTE_FILAS_RESULTADO: '.customer-list-pos',
  CLIENTE_BTN_SELECCIONAR_FILA: '.btn-customer-select',
  CLIENTE_NOMBRE_SELECCIONADO: '#customer_selected_name',
  CLIENTE_SELECT_OCULTO: '#customer_select',
  PANEL_PRODUCTOS: '.product_panel',

  // Buscador real de productos del grid del POS (icono de cubo, placeholder
  // "Buscar...."). Confirmado en vivo que la vista por defecto ("TODOS" u
  // otra categoría) está limitada a un cupo fijo de tarjetas ordenadas
  // alfabéticamente — un producto recién creado con un nombre que ordena
  // después de ese cupo (p. ej. "Producto Sencillo...", "Producto
  // Fraccionado...") puede no aparecer NUNCA en esa vista por defecto por
  // más que se espere, aunque exista realmente (confirmado interceptando
  // getPosProductSearch: el backend nunca lo incluye en esa respuesta).
  // Escribir aquí y presionar Enter sí dispara una consulta real al
  // backend que lo encuentra sin importar el orden alfabético.
  PRODUCTO_BUSCADOR_GRID: '#product_search',

  // Modal "Seleccionar Cantidad" que aparece al hacer click en un producto
  // Fraccionado desde el grid del POS (no aparece para productos simples) —
  // pide cuántas cajas completas y cuántas fracciones sueltas agregar.
  DIALOG_CANTIDAD_FRACCIONADA: '#dialog_product_fragmented_quantity_view',
  PRODUCTO_FRACCIONADO_CANTIDAD_CAJAS: '#prod_unit_q',
  PRODUCTO_FRACCIONADO_CANTIDAD_FRACCIONES: '#prod_frag_q',
  PRODUCTO_FRACCIONADO_BTN_AGREGAR: '#btn_set_product_fragment_quantity',

  // "Agregar" → "Nombre del cliente": factura solo con un nombre, sin
  // seleccionar un cliente registrado. editQuickCustomerName() y
  // setTemporalCustomerName() son puro DOM (sin AJAX). Confirmado en vivo
  // que el campo realmente leído al facturar es #temporal_customer_name
  // (pos.js: `client_name = $('#temporal_customer_name').val()`), NO
  // #customer_selected_name — ese label se actualiza pero su contenedor
  // nunca se muestra en la pantalla principal con este flujo (solo lo usa
  // el modal de pago), así que no sirve como confirmación visible aquí.
  CLIENTE_DROPDOWN_AGREGAR: '.panel-customer-search .dropdown-toggle',
  CLIENTE_CONTENEDOR_NOMBRE_RAPIDO: '.content-edit-quick-customer-name',
  CLIENTE_INPUT_NOMBRE_RAPIDO: '#temporal_customer_name',
} as const;

// Texto que identifica la caja cerrada en el modal "Abrir Caja". Exportado para
// que los tests lo reutilicen en vez de repetir el literal.
export const CAJA_TEXTO = 'Caja: Cerrada';

// IDs de checkboxes de métodos de pago.
// Usan slider CSS y están fuera del viewport del modal — se acceden via evaluate().
const CHECKBOX_ID = {
  EFECTIVO:    'is_payment_cash',
  TARJETA:     'is_payment_credit_card',
  SINPE:       'is_payment_check',
  TRANSACCION: 'is_payment_transaction',
} as const;

// ─── Pestañas superiores del POS ───────────────────────────────────────────────

export type PestanaPos = {
  selector: string;             // id/selector del <a> de la pestaña — nunca el texto visible
  etiqueta: string;              // solo para logs y mensajes de error
  contenedorContenido: string;    // contenedor que debe quedar visible cuando la pestaña termina de cargar
};

// "POS Facturación" es el estado inicial del POS y también el punto de
// retorno final del recorrido de pestañas.
export const PESTANA_POS_FACTURACION: PestanaPos = {
  selector: '#btn_pos_option',
  etiqueta: 'POS Facturación',
  contenedorContenido: '#content_product_by_style',
};

// Resto de pestañas a recorrer, en el orden solicitado. Todas confirmadas en
// vivo con id técnico estable (ver el comentario de PESTANAS_POS_CONTENEDOR)
// — "Apartados" queda fuera de este arreglo a propósito: a diferencia de
// estas 7, no hay ningún manejador `$('#btn_..._option').click(...)` para
// ella en pos.js en este ambiente, así que no existe un id conocido que
// hardcodear; se localiza dinámicamente por texto (ver
// localizarPestanaApartados() en PosPage) y puede no existir en absoluto
// (oculta por permisos/configuración), igual que cualquiera de estas 7.
export const PESTANAS_POS_A_RECORRER: PestanaPos[] = [
  { selector: '#btn_cashier_option', etiqueta: 'Órdenes de caja', contenedorContenido: '#content_invoice_order_list' },
  { selector: '#btn_taller_option', etiqueta: 'Taller', contenedorContenido: '#content_order_list' },
  { selector: '#btn_get_virtual_order_list', etiqueta: 'Tienda en línea', contenedorContenido: '#content_invoice_order_list' },
  { selector: '#btn_proform_option', etiqueta: 'Proforma / Cotizaciones', contenedorContenido: '#content_invoice_order_list' },
  { selector: '#btn_import_invoice_option', etiqueta: 'Importar factura', contenedorContenido: '#content_invoice_order_list' },
  { selector: '#btn_routing_option', etiqueta: 'Ruteo', contenedorContenido: '#content_invoice_order_list' },
  { selector: '#btn_product_external_option', etiqueta: 'Productos externos', contenedorContenido: '#content_invoice_order_list' },
];

// ─── Tipos y configuración de métodos de pago ─────────────────────────────────

export type MetodoPago = {
  checkboxId: string;
  montoLocator: string;
};

// Tarjeta, SINPE y transacción bancaria requieren el monto exacto de la factura.
export const METODO: Record<string, MetodoPago> = {
  TARJETA:     { checkboxId: CHECKBOX_ID.TARJETA,     montoLocator: '#payment_credit_card_total' },
  SINPE:       { checkboxId: CHECKBOX_ID.SINPE,        montoLocator: '#payment_check_total'       },
  TRANSACCION: { checkboxId: CHECKBOX_ID.TRANSACCION, montoLocator: '#payment_transaction_total'  },
};

// Efectivo permite superar el total (el sistema calcula el vuelto).
export const MONTO_EFECTIVO = '100';
export const DESCUENTO_INDIVIDUAL_PCT = '5';

// Nombre de un servicio real y único en el catálogo del tab "Servicios" —
// confirmado contando coincidencias exactas en el DOM en vivo (30 servicios
// visibles, "0-ST-01" aparece una sola vez). Varios servicios del catálogo
// comparten nombre (p. ej. "4x4 no funciona" aparece 3 veces), así que no
// cualquier nombre sirve para una búsqueda por texto exacto.
export const NOMBRE_SERVICIO = '0-ST-01';

// Tipo de vehículo para el wizard "End. Pintura": a diferencia de parte/pieza/
// servicio (catálogo configurable por la empresa), el tipo de vehículo es una
// lista fija del <select> de la interfaz (Hatchback, Crossover, Minivan, SUV,
// Automóvil, Pick-up) — confirmado inspeccionando sus <option> en vivo.
export const VEHICULO_PINTURA_TIPO = 'Hatchback';

// Término de búsqueda para el catálogo CABYS del formulario "Producto
// Rápido": devuelve resultados de forma consistente en pruebas repetidas
// contra el ambiente real. El catálogo CABYS es fijo (clasificación fiscal
// costarricense, no configurable por la empresa), así que no depende del
// estado de ninguna compañía en particular.
export const CABYS_BUSQUEDA = 'aceite';

// Término de búsqueda CABYS cuyo primer resultado resuelve a tasa "0%
// (Exento)" — confirmado en vivo (Fase 1 de descubrimiento). Se usa para el
// caso "sin IVA": en este ambiente el CABYS es obligatorio
// (validate_cabys_code=1), así que "sin IVA" se logra con un CABYS cuya
// propia clasificación fiscal es exenta, no dejando el campo vacío.
//
// Válido únicamente para el sub-modal de búsqueda de CABYS de "Producto
// Rápido" (#table_cabys_code_content) — NO para el de "Crear Combo"
// (#table_cabys_code_combo): son dos índices/búsquedas separados que
// devuelven resultados distintos para el mismo término — confirmado en
// vivo: "leche" resuelve a tasa 0% en el de Producto Rápido, pero a tasa 1%
// ("Leche cruda de vaca") en el de Combo. "Crear Combo" no tiene un
// término "sin IVA" propio: ese escenario se define por el checkbox
// "¿Aplicar impuesto?" desactivado, no por elegir un CABYS exento (ver
// crearComboSinIva() en pos.spec.ts), así que reutiliza CABYS_BUSQUEDA.
export const CABYS_BUSQUEDA_SIN_IVA = 'leche';

// Precio base para el producto rápido de prueba; sin IVA aplicado hasta que
// se selecciona un CABYS (ver esperarIvaAutocompletado()).
export const PRECIO_PRODUCTO_RAPIDO = '1000';

// Término de búsqueda de producto para el formulario "Crear Combo" — mismo
// producto real que ya usa el resto de la suite (facturar dos productos con
// descuento individual), en vez de un término genérico que trae productos de
// prueba con datos inconsistentes (nombres/cantidades basura confirmados en
// vivo con búsquedas genéricas como "producto").
export const COMBO_BUSQUEDA_PRODUCTO = 'FRENOS';

// ─── Tipos de resultado del descuento individual ───────────────────────────────

export type EscenarioDescuento =
  | 'aplicado'        // descuento aplicado exactamente como se solicitó
  | 'maximo_superado' // porcentaje mayor al máximo; se aplicó el máximo permitido
  | 'sin_descuento';  // producto no permite descuento (máximo = 0)

export type ResultadoDescuento = {
  clave: string;
  porcentajeSolicitado: string;
  porcentajeAplicado: string;
  escenario: EscenarioDescuento;
  mensajeAlerta?: string;  // texto del diálogo que apareció, si hubo uno
};

// ─── Estado real del check "Incluir IVA" ───────────────────────────────────────
//
// Investigado en vivo (no asumido): el checkbox #check_quick_product_apply_tax
// no tiene aria-checked, ni atributos data-*, ni clases CSS que reflejen su
// estado — su classList está vacío y el atributo HTML crudo (getAttribute
// ('checked')) siempre es null, incluso ya marcado, porque nunca se actualiza
// dinámicamente (solo refleja el valor inicial del markup). La ÚNICA fuente
// real dentro del propio checkbox es la propiedad IDL `.checked`
// (Playwright: isChecked()), confirmada respondiendo correctamente a clicks
// reales (false→true→false). quick_product_save() en pos.js lee esa misma
// propiedad directamente al guardar, así que el checkbox SÍ es la fuente de
// verdad real del sistema — pero únicamente en el instante exacto del click
// en "Agregar": el bug ya documentado en pos.js:695 puede resetearlo de forma
// asíncrona en la ventana entre que se configura y ese click. Por eso la
// única verdad 100% confiable sobre lo que quedó realmente aplicado es
// posterior al guardado: `#product_hide_apply_iva_<clave>` en la línea del
// carrito (ver LineaCarrito más abajo) — nunca el checkbox del formulario ya
// cerrado.

export type EstadoCheckIva = {
  activo: boolean;
  metodo: string;
  evidencia: string;
};

// ─── Configuración del sub-modal de búsqueda de CABYS ──────────────────────────
//
// "Producto Rápido" y "Crear Combo" cada uno abre su PROPIO sub-modal de
// búsqueda de CABYS (#dialog_add_cabys_code vs #dialog_add_cabys_code_combo),
// cada uno con su propio input/botón/tabla de resultados — no un componente
// compartido, como se asumió inicialmente — confirmado en vivo interceptando
// qué modal queda realmente visible tras el click en cada botón "CABYS". Este
// tipo agrupa los cinco locators que buscarYAplicarCabys()/manejarCabysSiAplica()
// necesitan para operar cualquiera de los dos, sin duplicar esa lógica.
export type ConfigBusquedaCabys = {
  boton: Locator;
  modal: Locator;
  input: Locator;
  botonBuscar: Locator;
  filas: Locator;
};

// ─── Datos de una línea del carrito (validación de IVA) ────────────────────────
//
// Todos los campos se leen directamente del DOM de la fila, nunca por índice
// fijo — ver los selectores en obtenerDatosLineaCarrito(). Mapeo confirmado
// leyendo add_sn_product() en pos.js (línea ~17673, el flujo real de
// "Producto Rápido") y cruzando el payload de red + el DOM resultante contra
// datos de entrada conocidos (precio base=1000, tasa=10%, cantidad 1 y 2):
//
//   - `#total_by_product_<clave>` = total de la línea SIN IVA = precio base
//     × cantidad (siempre, sin importar apply_iva). Confirmado: 1000→2000
//     al pasar de cantidad 1 a 2.
//   - `#total_by_product_with_iva_<clave>` = total de la línea CON IVA =
//     total sin IVA × (1 + tasa), solo si apply_iva=1; si apply_iva=0 queda
//     igual al total sin IVA (no hay IVA que sumar). Confirmado: 1100→2200.
//   - `#product_total_tax_<clave>`: PESE AL NOMBRE, no es el subtotal sin
//     IVA — es un campo redundante que siempre contiene el mismo valor que
//     `total_by_product_with_iva_<clave>` (proviene del mismo `total_price`
//     del request AJAX de add_sn_product(), calculado con el IVA ya sumado
//     cuando corresponde). Usarlo como "neto" es lo que producía IVA=0
//     calculado en el escenario "IVA activado": restaba ese campo contra sí
//     mismo bajo otro nombre. NO SE USA para nada en LineaCarrito.
//   - `#product_hide_apply_iva_<clave>` = la bandera real y confiable de si
//     el sistema aplicó IVA a la línea.
//
// Ambos totales (`neto` y `totalConIva`) se leen siempre por su id fijo,
// sin depender del estado de #show_price_with_iva — ese checkbox solo
// alterna cuál de los dos queda VISIBLE (clase "hide"), nunca cuál contiene
// qué valor, así que la resta `totalConIva − neto` es válida sin importar
// el estado del checkbox. `total` sí depende del checkbox: representa lo
// que el carrito está mostrando en pantalla en este momento, útil para
// validar que la UI realmente refleja el total esperado.

export type LineaCarrito = {
  clave: string;
  nombre: string;
  cantidad: number;
  precioUnitarioNeto: number; // sin IVA, derivado de neto ÷ cantidad
  neto: number;                // total de la línea SIN IVA (total_by_product_<clave>)
  totalConIva: number;          // total de la línea CON IVA (total_by_product_with_iva_<clave>)
  iva: number;                    // monto de IVA de la línea = totalConIva − neto
  total: number;                   // total mostrado actualmente en el carrito (según show_price_with_iva)
  ivaAplicado: boolean;            // product_hide_apply_iva_<clave> — la bandera real que el
                                    // sistema usa para facturar/reportar, independiente de lo
                                    // que el total "parezca" mostrar (ver el bug confirmado en
                                    // pos.js:695, comentado en seleccionarIvaManualmente()).
};

// ─── Page Object ──────────────────────────────────────────────────────────────

export class PosPage {
  constructor(private readonly page: Page) {}

  /** Locator del modal "Abrir Caja", expuesto para que los tests validen su contenido. */
  get modalAbrirCaja() {
    return this.page.locator(L.DIALOG_ABRIR_CAJA);
  }

  /** Locator del primer producto disponible en el grid del POS. */
  get primerProducto() {
    return this.page.locator(L.PRODUCTO).first();
  }

  /** Navega al POS. No decide nada sobre el modal "Abrir Caja"; eso es responsabilidad del test. */
  async irAlPos() {
    await this.page.goto(POS_URL, { waitUntil: 'commit', timeout: TIMEOUTS.NAVIGATE });
  }

  /**
   * Espera a que el POS resuelva su estado inicial: el modal "Abrir Caja" (si la caja
   * está cerrada) o el grid de productos (si no hay nada que resolver). Es necesario
   * porque `irAlPos()` resuelve apenas el navegador recibe la respuesta
   * (`waitUntil: 'commit'`), antes de que la comprobación asíncrona del estado de la
   * caja termine de decidir cuál de los dos se renderiza.
   */
  async esperarEstadoInicial() {
    // Ambos locators son independientes (no un `.or()` combinado): con dos elementos
    // en el DOM a la vez, `.or()` viola el modo estricto de Playwright aunque solo
    // uno esté visible. Se corre una carrera entre las dos esperas explícitas y se
    // continúa apenas la primera de las dos efectivamente se vuelve visible.
    await Promise.race([
      this.modalAbrirCaja.waitFor({ state: 'visible', timeout: TIMEOUTS.PRODUCTS_LOAD }),
      this.primerProducto.waitFor({ state: 'visible', timeout: TIMEOUTS.PRODUCTS_LOAD }),
    ]);
  }

  /** Indica si el modal "Abrir Caja" está visible en este momento (chequeo puntual, sin esperar). */
  async modalAbrirCajaVisible(): Promise<boolean> {
    return this.modalAbrirCaja.isVisible();
  }

  /**
   * Navega al POS pasando primero por el Dashboard, en la misma pestaña, y
   * resuelve el modal "Abrir Caja" si aparece. Pensado únicamente para el
   * flujo de "Producto Rápido" — el resto de la suite sigue entrando
   * directo vía irAlPos() (usado por cargarPosYCerrarModalSiAparece en
   * pos.spec.ts), que no necesita este paso extra.
   *
   * Motivo (condición de carrera real de la aplicación, no un problema de
   * automatización): dentro del mismo bloque `$(document).ready()` de
   * pos.js que liga el evento "click" de varios controles del modal
   * "Producto Rápido" —incluido el botón "Agregar"—, una línea anterior
   * de ese mismo bloque invoca una función (`clear_dialog_select_sunat_
   * detractions`) que, en una carga en frío del navegador, todavía no está
   * definida: se declara en otro script que en ese instante no terminó de
   * cargar. Eso dispara un `ReferenceError` no capturado que aborta el
   * resto del bloque `ready()`, dejando esos controles sin su listener de
   * "click" durante toda la vida de esa carga de página — confirmado
   * inspeccionando el error real en consola y verificando con
   * `getEventListeners()` (vía CDP) que el botón "Agregar" efectivamente
   * queda sin ningún listener registrado, ni directo ni delegado. Un click
   * real (humano o de Playwright) sobre ese botón, en esas condiciones, no
   * tiene ningún efecto.
   *
   * El storageState de Playwright solo persiste cookies y localStorage,
   * nunca la caché HTTP de recursos, así que cada test arranca con esa
   * caché fría igual que un navegador nuevo. Visitar el Dashboard primero,
   * en la misma pestaña, calienta la caché de los scripts compartidos: para
   * cuando se navega al POS, la función ya está disponible y el bloque
   * `ready()` completo corre sin abortar — confirmado experimentalmente de
   * forma consistente (3/3 intentos con este orden, 0/2 sin él, en pruebas
   * repetidas contra el ambiente real).
   */
  async cargarPosDesdeDashboard() {
    await this.page.goto(DASHBOARD_URL, { waitUntil: 'load' });
    await this.irAlPos();
    await this.esperarEstadoInicial();
    if (await this.modalAbrirCajaVisible()) {
      await expect(this.modalAbrirCaja.getByText(CAJA_TEXTO)).toBeVisible();
      await this.cerrarModalAbrirCaja();
    }
  }

  /**
   * Cierra el modal "Abrir Caja" con su botón "Cancelar", sin completar la apertura.
   * Útil cuando el flujo no depende de tener la caja abierta.
   */
  async cerrarModalAbrirCaja() {
    await expect(this.modalAbrirCaja).toBeVisible();
    await this.modalAbrirCaja.getByRole('button', { name: 'Cancelar' }).click();
    await expect(this.modalAbrirCaja).toBeHidden();
  }

  /**
   * Completa la apertura de caja desde el modal "Abrir Caja": monto en efectivo,
   * observaciones y confirmación. No hay evidencia confirmada de que el sistema
   * requiera más de una confirmación para cerrar el modal, así que se hace un único
   * click; si el modal no se cierra, la aserción de visibilidad del test debe fallar
   * para exponer la causa real (p. ej. un monto o una diferencia de efectivo no
   * contemplados) en vez de enmascararla con reintentos.
   */
  async completarAperturaCaja() {
    await expect(this.modalAbrirCaja).toBeVisible();

    await this.modalAbrirCaja.locator(L.CAJA_MONTO).first().fill('0');
    await this.modalAbrirCaja.getByPlaceholder(L.CAJA_OBSERVACION).fill('Apertura automatizada');
    await this.modalAbrirCaja.locator(L.CAJA_BTN_ABRIR).click();
  }

  /** Locator del modal "Detalle de Cierre" (cerrar caja). */
  get modalCerrarCaja() {
    return this.page.locator(L.DIALOG_CERRAR_CAJA);
  }

  /** Modal para activar las notificaciones del navegador: elemento opcional, ajeno al flujo de caja. */
  get modalNotificaciones() {
    return this.page.locator('#workshop-web-notification-permission');
  }

  /**
   * Cierra el modal de activar notificaciones si aparece. Es un elemento opcional
   * del sistema (puede o no aparecer) que puede quedar sobre el encabezado e
   * interceptar clicks; no tiene relación con ningún flujo de negocio, así que su
   * aparición o ausencia nunca debe hacer fallar el test.
   *
   * force:true + timeout explícito porque esta zona de la interfaz tiene
   * elementos con animaciones activas que pueden dejar un click normal sin
   * timeout esperando indefinidamente — este proyecto no configura
   * actionTimeout, así que sin este límite propio el único freno sería el
   * timeout completo del test. Si el click falla, no se oculta en silencio:
   * queda una traza de diagnóstico, y el control vuelve al flujo para que
   * quien llama (p. ej. el bucle de reintento de abrirMenuTresPuntos) decida
   * si vuelve a comprobar el modal en su siguiente vuelta.
   */
  async cerrarModalNotificacionesSiAparece() {
    if (await this.modalNotificaciones.isVisible().catch(() => false)) {
      await this.modalNotificaciones
        .getByRole('button', { name: 'Cerrar' })
        .first()
        .click({ force: true, timeout: 5_000 })
        .catch((e) => {
          console.log(`[cerrarModalNotificacionesSiAparece] click en "Cerrar" no tuvo éxito: ${e.message}`);
        });
      await expect(this.modalNotificaciones).toBeHidden().catch(() => {});
    }
  }

  /**
   * Indica si el menú "Caja" está actualmente desplegado, leyendo el estado real
   * del DOM (clase "is-visible" en el div.mdl-menu__container que envuelve el
   * <ul>) en vez de asumirlo — confirmado en vivo que este es el indicador real;
   * ni el <ul> ni el <li> usan aria-expanded.
   */
  async menuCajaEstaAbierto(): Promise<boolean> {
    return this.page.evaluate((selector) => {
      const ul = document.querySelector(selector);
      const container = ul?.closest('.mdl-menu__container');
      return container?.classList.contains('is-visible') ?? false;
    }, L.MENU_CAJA_UL);
  }

  /**
   * Abre el menú "Caja" del encabezado del POS. #menu_cash es un botón de
   * alternancia (toggle), no una acción idempotente de "asegurar abierto": si el
   * menú ya está desplegado (p. ej. un click anterior sí llegó a ejecutarse pese
   * a haber sido reportado como fallido), volver a pulsarlo lo cerraría en vez de
   * dejarlo abierto — confirmado en vivo. Por eso se comprueba el estado real
   * antes de decidir si hace falta el click.
   */
  async abrirMenuCaja() {
    // Los overlays conocidos (aviso de notificaciones, cualquier toast "noty")
    // pueden quedar sobre el encabezado e interceptar el click, sin importar el
    // estado de la caja.
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarTodosLosToastsSiAparecen();

    if (!(await this.menuCajaEstaAbierto())) {
      await this.page.locator(L.MENU_CAJA_BTN).click();
    }
  }

  /**
   * Selecciona "(F12) Abrir/Cerrar Caja" del menú "Caja" ya desplegado. Este único
   * ítem muestra el modal "Abrir Caja" si la caja está cerrada, o "Detalle de
   * Cierre" si está abierta — el sistema decide cuál, no el test.
   *
   * El click se acota a 5 s (en vez de heredar el timeout completo del test):
   * si un overlay transitorio del encabezado (banner de notificaciones, un
   * toast) está tapando el <li> en ese instante, un click sin límite propio
   * puede quedar bloqueado hasta agotar los 300 s del test entero — confirmado
   * en vivo. Con un límite corto, el bucle de reintento que llama a este método
   * puede volver a intentar en vez de quedar colgado en un único click.
   */
  async seleccionarAbrirCerrarCaja() {
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarTodosLosToastsSiAparecen();
    await this.page.locator('li', { hasText: L.MENU_CAJA_ITEM_F12 }).click({ timeout: 5_000 });
  }

  /**
   * Espera a que "Abrir/Cerrar Caja (F12)" resuelva cuál de los dos modales
   * corresponde. El click solo dispara la decisión; el propio modal puede tardar
   * en aparecer, así que se corre una carrera entre ambos en vez de asumir que ya
   * está resuelta justo después del click.
   */
  async esperarResultadoMenuCaja() {
    await Promise.race([
      this.modalAbrirCaja.waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL }),
      this.modalCerrarCaja.waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL }),
    ]);
  }

  /**
   * Completa el formulario de cierre: efectivo en caja, efectivo para la
   * siguiente caja y observaciones. No confirma el cierre.
   */
  async completarFormularioCerrarCaja(efectivoEnCaja: string, efectivoSiguienteCaja: string, observacion: string) {
    await expect(this.modalCerrarCaja).toBeVisible();

    await this.modalCerrarCaja.locator(L.CIERRE_EFECTIVO_CAJA).fill(efectivoEnCaja);
    await this.modalCerrarCaja.locator(L.CIERRE_EFECTIVO_SIGUIENTE).fill(efectivoSiguienteCaja);
    await this.modalCerrarCaja.locator(L.CIERRE_OBSERVACION).fill(observacion);
  }

  /**
   * Confirma el cierre de caja: presiona "Cerrar Caja" y acepta el diálogo de
   * confirmación ("¿Está seguro(a) de que desea cerrar esta caja?") que el sistema
   * siempre muestra a continuación.
   *
   * El diálogo (SweetAlert v1) agrega la clase "visible" recién cuando termina su
   * animación de entrada; antes de eso su propio manejador de click no procesa la
   * confirmación (queda visible para Playwright por tamaño, pero el click no
   * dispara nada). Por eso se espera explícitamente esa clase antes de hacer click,
   * en vez de confiar en la visibilidad genérica.
   *
   * La señal de éxito real es la respuesta del propio cierre (`closePosCash`), no
   * la ventana de reporte: en un reintento (si el ciclo ya intentó cerrar antes en
   * esta misma página) el navegador puede reutilizar una ventana ya abierta en vez
   * de emitir un nuevo evento "popup", lo que dejaría la espera del popup colgada
   * para siempre aunque el cierre haya sido exitoso. Si sí aparece una ventana
   * nueva, se muestra y se cierra para volver al POS; si no aparece, el cierre
   * igualmente se considera exitoso en base a la respuesta del servidor.
   */
  async confirmarCerrarCaja() {
    const cierreConfirmadoPromise = this.page.waitForResponse(
      (res) => res.url().includes('closePosCash'),
      { timeout: TIMEOUTS.PRINT_POPUP }
    );
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP }).catch(() => null);

    // Ambos avisos opcionales se descartan ANTES de confirmar, nunca después: el
    // cierre exitoso recarga la página (confirmado inspeccionando el DOM real tras
    // el click de confirmación — "Execution context was destroyed... navigation"),
    // lo que vuelve a generar el mismo aviso de consecutivo desde cero. Intentar
    // cerrarlo después del click compite con esa recarga en vez de resolverlo.
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarAvisoConsecutivoSiAparece();
    await this.modalCerrarCaja.locator(L.CIERRE_BTN_CERRAR).click();
    await this.page.locator('.sweet-alert.visible').waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.page.locator('.sweet-alert.visible button.confirm').click();

    await cierreConfirmadoPromise;

    const printPage = await popupPromise;
    if (printPage) {
      await this.mostrarYCerrarVentanaImpresion(printPage);
    }
  }

  /**
   * Presiona "Facturar" para abrir el modal de pago. La apertura de caja, si es
   * necesaria, solo puede ocurrir más adelante al confirmar el pago —no aquí—.
   */
  async presionarFacturar() {
    await this.page.locator(L.BTN_FACTURAR).click();
  }

  /** Espera a que el modal de pago esté listo para recibir el método de pago. */
  async esperarModalPago() {
    await this.page.locator(L.EFECTIVO_MONTO).waitFor({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.page.waitForTimeout(PAUSES.VER_MODAL);
  }

  /**
   * Agrega al carrito el primer producto que se pueda facturar directamente,
   * recorriendo el catálogo completo (sin depender de qué producto sea ni de
   * en qué posición esté). Si un producto requiere un paso adicional antes de
   * agregarse —confirmado hasta ahora en dos casos: "Monto a comprar" para
   * precio variable, y "Cantidad de fracciones" para productos fraccionados—
   * lo descarta y prueba con el siguiente. La detección es genérica (cualquier
   * modal de Bootstrap que se abra tras el click, validando que el carrito no
   * creció) en vez de reconocer un modal específico por su título, porque el
   * catálogo puede tener —o sumar en el futuro— más de un tipo de producto que
   * no se agrega con un solo click. Si ninguno funciona, falla con un mensaje
   * explícito en vez de dejar el carrito vacío en silencio.
   */
  async agregarPrimerProductoDePrecioFijo() {
    await this.cerrarModalNotificacionesSiAparece();
    const productos = this.page.locator(L.PRODUCTO);
    await productos.first().waitFor({ timeout: TIMEOUTS.PRODUCTS_LOAD });
    const total = await productos.count();
    if (total === 0) {
      throw new Error('No hay ningún producto visible en el catálogo del POS para intentar facturar.');
    }

    const modalAbierto = this.page.locator(L.MODAL_ABIERTO);

    for (let i = 0; i < total; i++) {
      // Se cuenta por las claves del carrito (L.CARRITO_CLAVES → #table_buy_list),
      // no por L.CARRITO_FILAS (#table_sale_pos): ese id no existe en el DOM real
      // — confirmado inspeccionando el DOM en vivo — así que su conteo siempre
      // da 0 y nunca detectaría una fila agregada.
      const clavesAntes = await this.page.locator(L.CARRITO_CLAVES).count();
      await productos.nth(i).click();

      const requiereInteraccionAdicional = await modalAbierto
        .waitFor({ state: 'visible', timeout: 2_000 })
        .then(() => true)
        .catch(() => false);

      if (requiereInteraccionAdicional) {
        // Validar que el carrito efectivamente no creció —confirma que el
        // producto no se agregó y que este modal es del tipo "requiere un
        // paso adicional", no un efecto secundario inofensivo— antes de
        // descartarlo y probar con el siguiente.
        const clavesConModalAbierto = await this.page.locator(L.CARRITO_CLAVES).count();
        expect(clavesConModalAbierto, 'El carrito creció pero además se abrió un modal: revisar manualmente.').toBe(clavesAntes);

        // force:true porque el panel de ayuda del aviso de notificaciones puede
        // reaparecer de forma asíncrona y quedar interceptando el click, igual
        // que ya se observó con el menú de tres puntos.
        await modalAbierto.getByRole('button', { name: 'Cerrar', exact: true }).click({ force: true });
        await expect(modalAbierto).toBeHidden();
        continue; // este producto no se agrega directamente: probar el siguiente
      }

      // No apareció ningún modal: confirmar que realmente se agregó al
      // carrito antes de darlo por bueno — un click sin efecto no debe pasar
      // desapercibido.
      const agregado = await expect.poll(
        () => this.page.locator(L.CARRITO_CLAVES).count(),
        { timeout: 3_000 }
      ).toBeGreaterThan(clavesAntes).then(() => true).catch(() => false);

      if (agregado) {
        await this.page.waitForTimeout(PAUSES.VER_CARRITO);
        return;
      }
      // Ni modal ni fila nueva: seguir probando con el siguiente producto.
    }

    throw new Error(
      `No se encontró ningún producto de precio fijo disponible para facturar entre los ${total} productos visibles del catálogo.`
    );
  }

  /** Llena el monto en efectivo y el dinero recibido. Efectivo permite superar el total. */
  async seleccionarPagoEfectivo(monto: string) {
    await this.page.locator(L.EFECTIVO_MONTO).fill(monto);
    await this.page.locator(L.EFECTIVO_RECIBIDO).fill(monto);
    await this.page.waitForTimeout(PAUSES.VER_MONTO);
  }

  /**
   * Selecciona un método de pago que requiere monto exacto (tarjeta, SINPE, transacción).
   * Lee el total de la factura desde el DOM y lo aplica al input del método indicado.
   */
  async seleccionarPagoExacto(metodo: MetodoPago) {
    // textContent vía evaluate para leer el valor aunque el elemento esté hidden
    const textoTotal = await this.page.evaluate(
      (id) => document.getElementById(id)?.textContent ?? '',
      L.TOTAL_MODAL
    );
    const monto = textoTotal.replace(/[^0-9.]/g, '');

    await this._cambiarMetodoPago(metodo.checkboxId);
    await this.page.locator(metodo.montoLocator).fill(monto);
    await this.page.waitForTimeout(PAUSES.VER_MONTO);
  }

  /** Aviso de "consecutivo de facturación fuera de rango": advertencia informativa del sistema, no bloqueante. */
  get avisoConsecutivoFueraDeRango() {
    return this.page.locator('.noty_bar').filter({ hasText: /consecutivo/i });
  }

  /**
   * Cierra el aviso de consecutivo fuera de rango si aparece (los "noty" se cierran
   * al hacer click). Es un aviso puramente informativo del sistema (no bloquea
   * ninguna acción) que puede volver a generarse por su cuenta —p. ej. tras una
   * recarga de página no relacionada—, así que ni el click ni la validación de que
   * desapareció usan aserciones duras: su reaparición no debe hacer fallar el test.
   */
  async cerrarAvisoConsecutivoSiAparece() {
    const aviso = this.avisoConsecutivoFueraDeRango;
    const aparecio = await aviso.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false);
    if (aparecio) {
      await aviso.click().catch(() => {});
      await aviso.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    }
  }

  /**
   * Cierra cualquier toast "noty" visible en el encabezado (aviso de consecutivo
   * fuera de rango u otros que el sistema pueda mostrar), sin filtrar por texto
   * como sí hace `cerrarAvisoConsecutivoSiAparece`. Son overlays transitorios que
   * pueden reaparecer por su cuenta y tapar el menú "Caja" —confirmado en
   * vivo—, así que ni el click ni la comprobación de que desapareció usan
   * aserciones duras. Acotado a un puñado de vueltas para no quedar en un bucle
   * infinito si algo reaparece de forma continua.
   */
  async cerrarTodosLosToastsSiAparecen() {
    const toast = this.page.locator('.noty_bar').first();
    for (let i = 0; i < 5; i++) {
      const visible = await toast.isVisible().catch(() => false);
      if (!visible) return;
      await toast.click().catch(() => {});
      await toast.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});
    }
  }

  /**
   * Presiona el botón "Facturar" del modal de pago (confirma el pago), sin esperar
   * su resultado. Es este botón —no el que abre el modal de pago— el que puede
   * mostrar el modal "Abrir Caja" si la caja está cerrada.
   */
  async presionarConfirmarPago() {
    await this.page.locator(L.BTN_CONFIRMAR).click();
  }

  /**
   * Muestra la ventana de impresión de la factura (señal de que se generó
   * correctamente) 4 segundos y la cierra para volver al POS.
   */
  async mostrarYCerrarVentanaImpresion(printPage: Page) {
    await printPage.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(PAUSES.VER_FACTURA);
    await printPage.close();
    await this.page.waitForTimeout(PAUSES.POST_CIERRE);
  }

  /** Verifica que no quedan filas en el carrito tras la venta. */
  async validarCarritoVacio() {
    const claves = await this.page.locator(L.CARRITO_CLAVES).count();
    expect(claves).toBe(0);
    await this.page.waitForTimeout(PAUSES.ESTADO_FINAL);
  }

  /**
   * Escribe en el buscador real del grid del POS (`#product_search`) y
   * presiona Enter, disparando una consulta real al backend
   * (getPosProductSearch) — necesario para encontrar productos recién
   * creados cuya posición alfabética los deja fuera del cupo fijo que
   * muestra la vista por defecto de una categoría (confirmado en vivo: ver
   * el comentario de L.PRODUCTO_BUSCADOR_GRID). Sin esto, productoPorNombre()
   * podría no encontrar NUNCA un producto que sí existe.
   */
  async buscarProductoEnGrid(termino: string) {
    const buscador = this.page.locator(L.PRODUCTO_BUSCADOR_GRID);
    await buscador.fill(termino);
    await buscador.press('Enter');
  }

  /**
   * Localiza la card de un producto en el grid por su nombre exacto, no por
   * posición: el catálogo puede reordenarse en cualquier momento con solo
   * agregar productos nuevos (confirmado: un producto nuevo desplazó a todos
   * los demás un puesto), así que depender de un índice es frágil por diseño.
   */
  productoPorNombre(nombre: string): Locator {
    const nombreEscapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.page.locator(L.PRODUCTO).filter({ hasText: new RegExp(`^\\s*${nombreEscapado}\\s*$`) });
  }

  /**
   * Agrega al carrito el producto identificado por su nombre exacto (no por
   * posición en el grid). Falla explícitamente si no encuentra exactamente un
   * producto con ese nombre, en vez de clickear a ciegas sobre lo que sea que
   * esté en una posición determinada — que es precisamente lo que rompía
   * `agregarProductoPorIndice` cuando el catálogo cambiaba de orden.
   */
  async agregarProductoPorNombre(nombre: string) {
    const producto = this.productoPorNombre(nombre);
    await expect(producto, `No se encontró exactamente un producto llamado "${nombre}" en el catálogo`).toHaveCount(1, { timeout: TIMEOUTS.PRODUCTS_LOAD });
    await this.page.waitForTimeout(PAUSES.VER_PRODUCTOS);
    await producto.click();
    await this.page.waitForTimeout(PAUSES.VER_CARRITO);
  }

  /**
   * Agrega al carrito un producto Fraccionado identificado por su nombre
   * exacto. A diferencia de un producto simple, clickearlo abre el modal
   * "Seleccionar Cantidad" (`#dialog_product_fragmented_quantity_view`, NO
   * aparece para productos sin fraccionar — confirmado en vivo) pidiendo
   * cuántas cajas completas y cuántas fracciones sueltas agregar; hay que
   * completarlo y confirmar con "Agregar" para que el producto realmente
   * entre al carrito.
   *
   * El click se hace vía evaluate() (DOM nativo), no `locator.click()`:
   * confirmado en vivo que ese modal aparece como efecto INMEDIATO del
   * click, y el propio chequeo de estabilidad de Playwright después de
   * clickear detecta el modal recién abierto tapando el mismo elemento,
   * reintentando el click indefinidamente sin nunca darlo por exitoso —
   * mismo motivo por el que "Crear Combo" ya clickea sus resultados de
   * búsqueda vía evaluate() en vez de un click normal.
   */
  async agregarProductoFraccionadoPorNombre(nombre: string, cantidadFracciones: string) {
    const producto = this.productoPorNombre(nombre);
    await expect(producto, `No se encontró exactamente un producto llamado "${nombre}" en el catálogo`).toHaveCount(1, { timeout: TIMEOUTS.PRODUCTS_LOAD });
    await this.page.waitForTimeout(PAUSES.VER_PRODUCTOS);
    await producto.evaluate((el: HTMLElement) => el.click());

    await expect(
      this.page.locator(L.DIALOG_CANTIDAD_FRACCIONADA),
      'El modal "Seleccionar Cantidad" no apareció tras clickear el producto Fraccionado'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.page.locator(L.PRODUCTO_FRACCIONADO_CANTIDAD_FRACCIONES).fill(cantidadFracciones);
    await this.page.locator(L.PRODUCTO_FRACCIONADO_BTN_AGREGAR).click();
    await expect(this.page.locator(L.DIALOG_CANTIDAD_FRACCIONADA)).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.page.waitForTimeout(PAUSES.VER_CARRITO);
  }

  /** Devuelve las claves únicas de los productos actualmente en el carrito. */
  async obtenerClavesProductos(): Promise<string[]> {
    return this.page.evaluate(() =>
      [...document.querySelectorAll('#table_buy_list p[id^="drag_and_drop_"]')]
        .map(el => el.id.replace('drag_and_drop_', ''))
    );
  }

  /** Indica si el checkbox de descuento general está activo. */
  async estaDescuentoGeneralActivo(): Promise<boolean> {
    return this.page.evaluate(
      () => (document.getElementById('apply_general_discount') as HTMLInputElement)?.checked ?? false
    );
  }

  /** Desactiva el descuento general para habilitar los descuentos individuales. */
  async desactivarDescuentoGeneral() {
    if (await this.estaDescuentoGeneralActivo()) {
      await this.page.evaluate(
        () => (document.getElementById('apply_general_discount') as HTMLInputElement).click()
      );
      await this.page.waitForTimeout(1_000);
    }
  }

  /**
   * Intenta aplicar un porcentaje de descuento individual al producto indicado.
   * Maneja tres escenarios sin fallar:
   *   - El sistema no permite descuento en el producto (retorna escenario 'sin_descuento').
   *   - El porcentaje supera el máximo permitido; el sistema lo corrige (retorna 'maximo_superado').
   *   - El descuento se aplica exactamente como se pidió (retorna 'aplicado').
   * Si aparece un diálogo, lo valida, lo cierra y reintenta con el máximo extraído o 1 %.
   */
  async aplicarDescuentoIndividual(clave: string, porcentaje: string): Promise<ResultadoDescuento> {
    await this._llamarSetProductTotal(clave, porcentaje);
    await this.page.waitForTimeout(PAUSES.CAMPO_HABILITADO);

    const mensajeAlerta = await this._leerYCerrarAlerta();
    let porcentajeAplicado = await this._leerValorDescuentoInput(clave);

    if (mensajeAlerta) {
      const pctActual = parseFloat(porcentajeAplicado);
      const pctSolicitado = parseFloat(porcentaje);

      if (pctActual === 0) {
        // El sistema rechazó el descuento completamente.
        return { clave, porcentajeSolicitado: porcentaje, porcentajeAplicado: '0', escenario: 'sin_descuento', mensajeAlerta };
      }

      if (pctActual >= pctSolicitado) {
        // El sistema mostró un diálogo pero no corrigió el input: intentar con el máximo del mensaje.
        const match = mensajeAlerta.match(/(\d+(?:[.,]\d+)?)\s*%/);
        const retryPct = match ? match[1].replace(',', '.') : '1';
        await this._llamarSetProductTotal(clave, retryPct);
        await this.page.waitForTimeout(PAUSES.CAMPO_HABILITADO);
        await this._leerYCerrarAlerta();
        porcentajeAplicado = await this._leerValorDescuentoInput(clave);

        if (parseFloat(porcentajeAplicado) === 0) {
          return { clave, porcentajeSolicitado: porcentaje, porcentajeAplicado: '0', escenario: 'sin_descuento', mensajeAlerta };
        }
      }
    }

    const pctAplicado = parseFloat(porcentajeAplicado);
    const pctSolicitado = parseFloat(porcentaje);
    const escenario: EscenarioDescuento =
      pctAplicado <= 0               ? 'sin_descuento'  :
      pctAplicado < pctSolicitado - 0.01 ? 'maximo_superado' :
                                        'aplicado';

    await this.page.waitForTimeout(PAUSES.VER_MONTO);
    return { clave, porcentajeSolicitado: porcentaje, porcentajeAplicado, escenario, mensajeAlerta: mensajeAlerta ?? undefined };
  }

  /** Lee el total de una línea del carrito como número. */
  async obtenerTotalProducto(clave: string): Promise<number> {
    const texto = await this.page.locator(`#total_by_product_${clave}`).textContent() ?? '0';
    return parseFloat(texto.replace(/[^0-9.]/g, '')) || 0;
  }

  /** Lee el total final de venta como número (sí refleja descuentos individuales). */
  async obtenerTotalVentaNumerico(): Promise<number> {
    const texto = await this.page.evaluate(
      (id) => document.getElementById(id)?.textContent ?? '$0.00',
      L.TOTAL_MODAL
    );
    return parseFloat(texto.replace(/[^0-9.]/g, '')) || 0;
  }

  /** Pago mixto: activa tarjeta manteniendo efectivo, luego llena ambos montos. */
  async seleccionarPagoMixto(montoTarjeta: string, montoEfectivo: string) {
    await this.page.evaluate(
      (id) => (document.getElementById(id) as HTMLInputElement).click(),
      CHECKBOX_ID.TARJETA
    );
    await this.page.waitForTimeout(PAUSES.CAMPO_HABILITADO);
    await this.page.locator('#payment_credit_card_total').fill(montoTarjeta);
    await this.page.getByPlaceholder('Referencia pago en tarjeta').fill('AUTOMATIZADO');
    await this.page.locator(L.EFECTIVO_MONTO).fill(montoEfectivo);
    await this.page.waitForTimeout(PAUSES.VER_MONTO);
  }

  // ─── Menú de tres puntos: Historial de Facturas / Proformas ──────────────────

  /**
   * Abre el menú de tres puntos del encabezado del POS (Historial de Facturas,
   * Historial de Proformas, Producto externo, etc.).
   *
   * La inestabilidad de este menú tiene dos causas distintas, confirmadas por
   * inspección en vivo del DOM real (cronometraje del upgrade de MDL,
   * document.elementFromPoint en el punto de click, y sondeo de reaparición
   * de overlays):
   *
   *   1. MDL registra el listener que realmente ABRE el menú sobre el <ul
   *      for="demo-menu-lower-left"> (componente "MaterialMenu"), no sobre el
   *      botón (que solo recibe "MaterialButton", puramente visual). Ese
   *      registro es asíncrono y puede tardar segundos tras la navegación.
   *      Por eso se espera explícitamente esa condición real —el atributo
   *      data-upgraded del <ul> conteniendo "MaterialMenu"— antes del primer
   *      intento, en vez de depender únicamente de reintentos.
   *
   *   2. Incluso con MDL ya listo, el modal de permisos de notificación del
   *      navegador puede aparecer de forma asíncrona en cualquier momento
   *      —incluso justo después de haber sido revisado y no encontrado— y
   *      queda físicamente ENCIMA del botón, interceptando el click sin
   *      importar force:true (confirmado con elementFromPoint: el navegador
   *      entrega el evento al elemento que está arriba en esa coordenada, no
   *      al que Playwright pretendía clickear). Por eso los overlays
   *      conocidos se vuelven a comprobar y cerrar en CADA iteración del
   *      bucle, no solo una vez antes de entrar a él.
   *
   * La apertura nunca se asume: se valida contra el DOM real después de cada
   * click, y si ningún intento funciona, el error final incluye un
   * diagnóstico concreto (no un simple "no se abrió") para no tener que
   * repetir esta investigación la próxima vez que ocurra.
   */
  async abrirMenuTresPuntos() {
    // Condición real de que MDL ya registró el listener de apertura —no una
    // pausa arbitraria. Si por algún motivo nunca aparece, no se aborta aquí:
    // el bucle de abajo, con su propio diagnóstico, sigue siendo la fuente de
    // verdad final (no se depende únicamente de esta espera).
    await this.page.locator(L.MENU_TRES_PUNTOS_INICIALIZADO)
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const MAX_INTENTOS = 4;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      // Overlays conocidos: pueden aparecer en cualquier momento, incluso a
      // mitad de este bucle, así que se revisan de nuevo en cada vuelta.
      await this.cerrarModalNotificacionesSiAparece();
      await this.cerrarAvisoConsecutivoSiAparece();

      // force:true porque el botón tiene una animación CSS continua
      // ("badge-pulse", para destacar ítems "Nuevo" del menú) que lo mantiene
      // permanentemente "inestable" para las validaciones de Playwright —
      // confirmado que es una animación real de la app, no un bug transitorio.
      await this.page.locator(L.MENU_TRES_PUNTOS).click({ force: true });

      // Nunca se asume que abrió: se valida contra el DOM real.
      const abierto = await this.page.locator(L.HISTORIAL_FACTURAS)
        .waitFor({ state: 'visible', timeout: 2_000 })
        .then(() => true)
        .catch(() => false);

      if (abierto) return;
    }

    // Diagnóstico del fallo final: por qué se considera fallido, no solo que lo fue.
    const materialMenuInicializado = await this.page.locator(L.MENU_TRES_PUNTOS_INICIALIZADO).count() > 0;
    const modalNotificacionesVisible = await this.modalNotificaciones.isVisible().catch(() => false);
    const avisoConsecutivoVisible = await this.avisoConsecutivoFueraDeRango.isVisible().catch(() => false);
    const elementoEnElPuntoDeClick = await this.page.evaluate((selector) => {
      const boton = document.querySelector(selector);
      if (!boton) return '(el botón no está en el DOM)';
      const rect = boton.getBoundingClientRect();
      const el = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      if (!el) return '(ningún elemento en ese punto)';
      const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : '';
      const clase = el.className ? `.${el.className.toString().trim().replace(/\s+/g, '.')}` : '';
      return `${el.tagName.toLowerCase()}${id}${clase}`;
    }, L.MENU_TRES_PUNTOS);

    throw new Error(
      `El menú de tres puntos no se abrió tras ${MAX_INTENTOS} intentos.\n` +
      `  - MaterialMenu inicializado (data-upgraded en el <ul>): ${materialMenuInicializado}\n` +
      `  - Modal de notificaciones visible: ${modalNotificacionesVisible}\n` +
      `  - Aviso de consecutivo visible: ${avisoConsecutivoVisible}\n` +
      `  - Elemento que realmente recibiría el click (elementFromPoint): ${elementoEnElPuntoDeClick}`
    );
  }

  /**
   * Presiona "Historial de Facturas" en el menú de tres puntos (ya abierto) y
   * devuelve la ventana emergente que el sistema abre en una pestaña nueva.
   * Click normal (sin force): a diferencia del botón del menú, el ítem ya
   * confirmado visible y asentado sí pasa las validaciones de accionabilidad,
   * y un click real (no forzado) es la señal más confiable de que el evento
   * llega al enlace para disparar la apertura de la pestaña nueva.
   */
  async abrirHistorialFacturas(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.HISTORIAL_FACTURAS).click({ timeout: 5_000 });
    return popupPromise;
  }

  /**
   * Presiona "Historial de Proformas" en el menú de tres puntos (ya abierto) y
   * devuelve la ventana emergente que el sistema abre en una pestaña nueva.
   */
  async abrirHistorialProformas(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.HISTORIAL_PROFORMAS).click({ timeout: 5_000 });
    return popupPromise;
  }

  // ─── Categorías (barra lateral) ────────────────────────────────────────────

  get categoriaTodos() { return this.page.locator(L.CAT_TODOS); }
  get categoriaCombos() { return this.page.locator(L.CAT_COMBOS); }
  get categoriaTipo() { return this.page.locator(L.CAT_TIPO); }
  get categoriaProductosFraccionados() { return this.page.locator(L.CAT_FRACCIONADOS); }
  get categoriaProductosVariantes() { return this.page.locator(L.CAT_VARIANTES); }

  /**
   * Indica si la categoría dada quedó marcada como activa (clase
   * "left_category_active"). Válido tanto para categorías planas como para la
   * que dispara la navegación a subcategorías: ambas reciben la misma clase.
   */
  async categoriaEstaActiva(categoria: Locator): Promise<boolean> {
    const clase = await categoria.getAttribute('class');
    return clase?.includes(L.CAT_ACTIVE_CLASS) ?? false;
  }

  // ─── Vista de productos: lista vs. cuadrícula ─────────────────────────────

  get botonVistaLista() { return this.page.locator(L.VISTA_LISTA); }
  get botonVistaCuadricula() { return this.page.locator(L.VISTA_CUADRICULA); }

  /**
   * Indica si el botón de vista dado (lista o cuadrícula) está marcado como
   * activo (clase "product_style_active"). Antes de la primera interacción del
   * usuario ninguno de los dos botones tiene esta clase todavía: en ese caso
   * hay que recurrir a `estiloVistaTexto()`.
   */
  async vistaEstaActiva(boton: Locator): Promise<boolean> {
    const clase = await boton.getAttribute('class');
    return clase?.includes(L.VISTA_ACTIVE_CLASS) ?? false;
  }

  /** Lee el estilo de vista inicial reportado por el propio sistema: "list" o "box". */
  async estiloVistaTexto(): Promise<string> {
    return (await this.page.locator(L.VISTA_ESTILO_ACTUAL).textContent())?.trim() ?? '';
  }

  // ─── Tabs Servicios / End. Pintura ────────────────────────────────────────

  get tabServicios() { return this.page.locator(L.TAB_SERVICIOS); }
  get tabPintura() { return this.page.locator(L.TAB_PINTURA); }

  /** Indica si el tab dado (Productos/Servicios/End. Pintura) está activo (clase "btn_sale_selected"). */
  async tabEstaActivo(tab: Locator): Promise<boolean> {
    const clase = await tab.getAttribute('class');
    return clase?.includes(L.TAB_ACTIVE_CLASS) ?? false;
  }

  // ─── Wizard "End. Pintura": Vehículo → Parte → Pieza → Servicio → Precio ──────

  /** Locator del modal "Selecciona un precio" que abre un servicio de End. Pintura. */
  get modalSeleccionarPrecio() {
    return this.page.locator(L.DIALOG_SELECCIONAR_PRECIO);
  }

  /**
   * Selecciona el tipo de vehículo en el wizard "End. Pintura". El <select> real
   * está oculto (display:none); el widget "Chosen" que lo reemplaza visualmente
   * es lo único clickeable, confirmado inspeccionando el DOM en vivo — de ahí
   * que se opere sobre `.chosen-single`/`.chosen-results` en vez de `selectOption()`.
   */
  async seleccionarVehiculoPintura(tipo: string) {
    await this.page.locator(L.PINTURA_VEHICULO_TRIGGER).click();
    await this.page.locator(L.PINTURA_VEHICULO_RESULTADO, { hasText: tipo }).click();
  }

  /**
   * Selecciona la primera parte disponible para el vehículo ya elegido (p. ej.
   * "Puerta"). Falla con un mensaje explícito si no aparece ninguna, en vez de
   * dejar que un click a ciegas produzca un timeout genérico más adelante.
   */
  async seleccionarPrimeraParte() {
    await this._clickPrimeraOpcionDisponible(L.PINTURA_PARTE, 'parte');
  }

  /** Selecciona la primera pieza disponible para la parte ya elegida. */
  async seleccionarPrimeraPieza() {
    await this._clickPrimeraOpcionDisponible(L.PINTURA_PIEZA, 'pieza');
  }

  /**
   * Selecciona el primer servicio disponible para la pieza ya elegida. Este
   * paso abre el modal "Selecciona un precio" — no se espera aquí porque cuál
   * de los dos (precio único auto-aplicado o modal con opciones) depende de
   * datos del servicio, y es responsabilidad de quien llama decidir qué esperar.
   */
  async seleccionarPrimerServicioPintura() {
    await this._clickPrimeraOpcionDisponible(L.PINTURA_SERVICIO, 'servicio');
  }

  /**
   * Selecciona el primer precio real disponible en el modal "Selecciona un
   * precio" y espera a que el modal se cierre. Excluye por selector la tarjeta
   * "Agregar precio a este servicio" (crea un precio nuevo, no selecciona uno
   * existente) — esa tarjeta es fija en la interfaz, su rótulo no lo es.
   */
  async seleccionarPrimerPrecioDisponible() {
    await expect(this.modalSeleccionarPrecio).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const precio = this.page.locator(L.PINTURA_PRECIO_OPCION).first();
    await expect(precio, 'No hay ningún precio disponible para este servicio').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await precio.click();

    await expect(this.modalSeleccionarPrecio).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  // ─── "Producto Rápido" ──────────────────────────────────────────────────────

  /** Locator del modal "Producto Rápido". */
  get modalProductoRapido() {
    return this.page.locator(L.DIALOG_PRODUCTO_RAPIDO);
  }

  /** Locator del sub-modal "Búsqueda de código CABYS". */
  get modalBusquedaCabys() {
    return this.page.locator(L.DIALOG_BUSCAR_CABYS);
  }

  /**
   * Expande el botón flotante (FAB) del POS y abre el modal "Producto
   * Rápido". El toggle es un componente "mfb" cuya animación de expansión
   * a veces no llega a tiempo con un único click —confirmado en vivo—, así
   * que se reintenta hasta que el ítem hijo ("Producto Rápido") se vuelva
   * realmente visible antes de clickearlo.
   */
  async abrirProductoRapido() {
    const toggle = this.page.locator(L.FAB_TOGGLE);
    const item = this.page.locator(L.FAB_ITEM_PRODUCTO_RAPIDO);

    // El toggle expande el FAB con data-mfb-toggle="hover" — confirmado en vivo
    // que puede volver a colapsarse entre que se confirma expandido y el click
    // sobre el ítem, si de por medio se ejecuta otra acción (p. ej. revisar el
    // modal de notificaciones) que mueve el mouse y pierde el estado "hover".
    // Por eso el click sobre el ítem se hace en la MISMA vuelta, inmediatamente
    // después de confirmarlo expandido, y todo el ciclo (expandir + click +
    // confirmar que el modal abrió) se reintenta como una unidad si algo falla.
    const MAX_INTENTOS = 10;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      await toggle.click({ force: true });

      const expandido = await item.waitFor({ state: 'visible', timeout: 1_200 }).then(() => true).catch(() => false);
      if (expandido) {
        const clickeado = await item.click({ force: true, timeout: 2_000 }).then(() => true).catch(() => false);
        if (clickeado) {
          const abrio = await this.modalProductoRapido.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false);
          if (abrio) return;
        }
      }

      await this.page.waitForTimeout(300);
    }

    throw new Error(`El botón flotante "Producto Rápido" no se pudo abrir tras ${MAX_INTENTOS} intentos.`);
  }

  /** Llena nombre y precio en el formulario de "Producto Rápido" ya abierto. */
  async llenarDatosBasicosProductoRapido(nombre: string, precio: string) {
    await this.page.locator(L.QUICK_PRODUCT_NOMBRE).fill(nombre);
    await this.page.locator(L.QUICK_PRODUCT_PRECIO).fill(precio);
  }

  /**
   * Indica si el botón CABYS está presente en este momento del formulario
   * indicado (por defecto, el de "Producto Rápido"; "Crear Combo" pasa
   * `configCabysCombo.boton`). No es un dato fijo: depende del país
   * configurado para la compañía en este ambiente compartido de QA
   * (confirmado en vivo pasando de visible/obligatorio con la compañía
   * configurada como Costa Rica, a oculto con la misma compañía luego
   * reconfigurada como Honduras, sin ningún cambio de este lado) — de ahí que
   * este chequeo se haga en cada corrida en vez de asumir un estado fijo.
   */
  async existeCampoCabys(boton: Locator = this.page.locator(L.QUICK_PRODUCT_BTN_CABYS)): Promise<boolean> {
    return boton.isVisible().catch(() => false);
  }

  /**
   * Completa el CABYS únicamente si el botón aparece en el formulario dado;
   * si no aparece, no lo toca. Devuelve si lo aplicó o no, para que quien
   * llama decida el resto del flujo de IVA en consecuencia (ver
   * validarIvaCoincideConCabys() para el caso "aplicado" y
   * seleccionarIvaManualmente() para el caso "no aplicado"). Reutilizado tal
   * cual por "Crear Combo" pasando `configCabysCombo`.
   */
  async manejarCabysSiAplica(termino: string, config: ConfigBusquedaCabys = this.configCabysProductoRapido): Promise<boolean> {
    if (!(await this.existeCampoCabys(config.boton))) return false;
    await this.buscarYAplicarCabys(termino, config);
    return true;
  }

  /**
   * Busca un código CABYS por texto en el sub-modal dedicado y aplica el
   * primer resultado de la tabla (mismo criterio que el resto de la suite
   * usa para catálogos sin nombre estable por el cual filtrar: tomar el
   * primero disponible).
   *
   * Recibe la configuración completa (botón, modal, input, botón de
   * búsqueda y filas de resultado) en vez de solo el botón: "Producto
   * Rápido" y "Crear Combo" NO comparten el mismo sub-modal —a diferencia de
   * lo asumido inicialmente—, sino dos instancias completamente separadas
   * (#dialog_add_cabys_code vs #dialog_add_cabys_code_combo, cada una con su
   * propio input/botón/tabla) — confirmado en vivo interceptando qué modal
   * queda realmente visible tras el click. Aplicar un CABYS autocompleta el
   * tipo y la tasa de IVA en ambos formularios —ver esperarIvaAutocompletado()
   * para Producto Rápido y esperarIvaAutocompletadoCombo() para Crear Combo—,
   * aunque con un desfase distinto en cada uno.
   */
  async buscarYAplicarCabys(termino: string, config: ConfigBusquedaCabys = this.configCabysProductoRapido) {
    await this.cerrarModalNotificacionesSiAparece();
    await config.boton.click();
    await expect(config.modal).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await config.input.fill(termino);
    await this.cerrarModalNotificacionesSiAparece();
    await config.botonBuscar.click();

    const primeraFila = config.filas.first();
    await expect(primeraFila, `No hubo resultados de CABYS para "${termino}"`).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
    await primeraFila.getByRole('link', { name: 'Aplicar' }).click();

    await expect(config.modal).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /** Configuración del sub-modal de búsqueda de CABYS de "Producto Rápido" (la usada por defecto). */
  get configCabysProductoRapido(): ConfigBusquedaCabys {
    return {
      boton: this.page.locator(L.QUICK_PRODUCT_BTN_CABYS),
      modal: this.modalBusquedaCabys,
      input: this.page.locator(L.CABYS_BUSCADOR_INPUT),
      botonBuscar: this.page.locator(L.CABYS_BUSCADOR_BOTON),
      filas: this.page.locator(L.CABYS_FILAS_RESULTADO),
    };
  }

  /** Configuración del sub-modal de búsqueda de CABYS propio de "Crear Combo" (separado del de Producto Rápido). */
  get configCabysCombo(): ConfigBusquedaCabys {
    return {
      boton: this.page.locator(L.COMBO_BTN_CABYS),
      modal: this.page.locator(L.COMBO_DIALOG_BUSCAR_CABYS),
      input: this.page.locator(L.COMBO_CABYS_BUSCADOR_INPUT),
      botonBuscar: this.page.locator(L.COMBO_CABYS_BUSCADOR_BOTON),
      filas: this.page.locator(L.COMBO_CABYS_FILAS_RESULTADO),
    };
  }

  /**
   * Configuración del sub-modal de búsqueda de CABYS de "Crear Producto" —
   * a diferencia de "Crear Combo" (que abre uno propio y separado), este
   * formulario SÍ reutiliza el mismo sub-modal compartido de "Producto
   * Rápido" (#dialog_add_cabys_code) — confirmado en vivo interceptando qué
   * modal queda visible tras el click; solo el botón que lo dispara es
   * propio de este formulario.
   */
  get configCabysProducto(): ConfigBusquedaCabys {
    return {
      boton: this.page.locator(L.PRODUCTO_BTN_CABYS),
      modal: this.modalBusquedaCabys,
      input: this.page.locator(L.CABYS_BUSCADOR_INPUT),
      botonBuscar: this.page.locator(L.CABYS_BUSCADOR_BOTON),
      filas: this.page.locator(L.CABYS_FILAS_RESULTADO),
    };
  }

  /**
   * Espera a que el checkbox de IVA quede marcado tras aplicar un CABYS.
   * No es instantáneo (confirmado en vivo: ~200ms de desfase, un tick de
   * JS, no una espera de red) así que se usa expect.poll() en vez de leer
   * el estado inmediatamente después de aplicar el CABYS. Se cumple tanto
   * para un CABYS con tasa positiva como con tasa "0% (Exento)": ambos son
   * una clasificación de IVA válida, a diferencia de no tener CABYS.
   */
  async esperarIvaAutocompletado() {
    await expect.poll(
      () => this.page.locator(L.QUICK_PRODUCT_APLICAR_IVA).isChecked(),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    ).toBe(true);
  }

  /**
   * Espera a que el checkbox "¿Aplicar impuesto?" de "Crear Combo" quede
   * marcado tras aplicar un CABYS — homólogo de esperarIvaAutocompletado()
   * para Producto Rápido, pero para el checkbox propio del combo.
   *
   * Contradice lo que se había asumido inicialmente ("el de Combo no tiene
   * ese autocompletado"): confirmado en vivo monitoreando el checkbox cada
   * 500ms tras aplicar un CABYS con el checkbox inicialmente desmarcado, SÍ
   * se autoactiva —con ~500ms de desfase, no instantáneo—, y el select de
   * tasa (`#tax_rate_list`) se sincroniza a la vez con la tasa real del
   * CABYS. Por eso es indispensable esperar este autocompletado ANTES de
   * intentar desactivar el checkbox otra vez (ver crearComboSinIva() en
   * pos.spec.ts): desactivarlo de inmediato, sin esperar, corre el riesgo
   * de ganarle la carrera a esta activación automática y terminar con el
   * checkbox marcado de todos modos.
   */
  async esperarIvaAutocompletadoCombo() {
    await expect.poll(
      () => this.checkboxIvaCombo.isChecked(),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    ).toBe(true);
  }

  /**
   * Normaliza el texto de tasa sugerida por un CABYS a porcentaje. El texto
   * viene en dos formatos distintos según el CABYS (confirmado en vivo):
   * como fracción ("0.13") o ya en porcentaje ("0%") — compartido entre
   * "Producto Rápido" y "Crear Combo", que usan el mismo formato.
   */
  private _normalizarPorcentajeCabys(texto: string): number {
    return texto.includes('%') ? parseFloat(texto) : parseFloat(texto) * 100;
  }

  /**
   * Valida que la tasa de IVA realmente seleccionada en el formulario de
   * "Producto Rápido" coincide con el IVA que el propio CABYS aplicado
   * sugiere — no solo que "algo" quedó marcado. Para "Crear Combo" ver
   * validarIvaCoincideConCabysCombo(), que compara contra los selectores
   * propios de ese formulario (distintos, no compartidos).
   */
  async validarIvaCoincideConCabys() {
    const cabysTaxTexto = (await this.page.locator(L.QUICK_PRODUCT_CABYS_TAX_SUGERIDO).textContent())?.trim() ?? '';
    const cabysTaxPct = this._normalizarPorcentajeCabys(cabysTaxTexto);

    const tasaSeleccionadaPct = await this.obtenerTasaIvaSeleccionadaPct();

    expect(
      tasaSeleccionadaPct,
      `La tasa de IVA seleccionada (${tasaSeleccionadaPct}%) no coincide con el IVA definido por el CABYS aplicado (${cabysTaxPct}%)`
    ).toBeCloseTo(cabysTaxPct, 1);
  }

  /** Lee el `percent` de la opción de tasa de IVA realmente seleccionada en el formulario. */
  async obtenerTasaIvaSeleccionadaPct(): Promise<number> {
    return this.page.locator(L.QUICK_PRODUCT_TASA_IVA).evaluate(
      (el) => parseFloat((el as HTMLSelectElement).selectedOptions[0]?.getAttribute('percent') ?? 'NaN')
    );
  }

  /**
   * Lee el `percent` de la opción de tasa de IVA realmente seleccionada en
   * "Crear Combo" (`#tax_rate_list`) — homólogo de obtenerTasaIvaSeleccionadaPct()
   * pero para el select propio del combo, que solo queda sincronizado con el
   * CABYS aplicado si el checkbox ya estaba activado ANTES de aplicar ese
   * CABYS (ver el comentario de L.COMBO_TASA_IVA).
   */
  async obtenerTasaIvaSeleccionadaComboPct(): Promise<number> {
    return this.page.locator(L.COMBO_TASA_IVA).evaluate(
      (el) => parseFloat((el as HTMLSelectElement).selectedOptions[0]?.getAttribute('percent') ?? 'NaN')
    );
  }

  /**
   * Valida que la tasa de IVA realmente seleccionada en "Crear Combo"
   * coincide con el IVA que el propio CABYS aplicado sugiere. Solo tiene
   * sentido llamarla cuando el checkbox "¿Aplicar impuesto?" se activó
   * ANTES de aplicar el CABYS (ver activarIvaCombo() + el comentario de
   * L.COMBO_TASA_IVA) — con el checkbox desmarcado en ese momento, el
   * select nunca se sincroniza y esta comparación fallaría sin que sea un
   * error real del sistema.
   *
   * La sincronización no es instantánea (confirmado en vivo: leerla justo
   * después de que el sub-modal de CABYS se cierra todavía puede devolver el
   * valor por defecto "0%", el mismo desfase de un tick de JS que ya obliga
   * a esperarIvaAutocompletado() en Producto Rápido), así que se usa
   * expect.poll() en vez de una lectura + comparación inmediata.
   */
  async validarIvaCoincideConCabysCombo() {
    const cabysTaxTexto = (await this.page.locator(L.COMBO_CABYS_TAX_SUGERIDO).textContent())?.trim() ?? '';
    const cabysTaxPct = this._normalizarPorcentajeCabys(cabysTaxTexto);

    await expect.poll(
      () => this.obtenerTasaIvaSeleccionadaComboPct(),
      {
        timeout: TIMEOUTS.PAYMENT_MODAL,
        message: `La tasa de IVA seleccionada en el combo no coincidió con el IVA definido por el CABYS aplicado (${cabysTaxPct}%)`,
      }
    ).toBeCloseTo(cabysTaxPct, 1);
  }

  /** Lee el valor actual del campo "Precio con IVA" del formulario, como número. */
  async obtenerPrecioConIvaFormulario(): Promise<number> {
    const valor = await this.page.locator(L.QUICK_PRODUCT_PRECIO_CON_IVA).inputValue();
    return parseFloat(valor) || 0;
  }

  /**
   * Valida, ANTES de guardar, que el "Precio con IVA" del formulario
   * refleja realmente el precio base más la tasa de IVA seleccionada
   * (`precio_con_iva = precio + precio × tasa/100`, confirmado en Fase 1
   * leyendo `quick_product_apply_tax()` en pos.js) — no solo que el
   * checkbox quedó marcado. Devuelve el monto leído para que el test lo use
   * después como referencia al validar el total en el carrito, ya que el
   * formulario se limpia al guardar.
   */
  async validarMontoConIvaEnFormulario(precioBase: string): Promise<number> {
    // El campo "Precio con IVA" retiene el último valor calculado aunque el
    // checkbox se haya destildado después (confirmado en vivo: el sistema
    // puede quedar con "Precio con IVA" mostrando un monto con impuesto
    // mientras el checkbox real está apagado, y en ese estado el producto se
    // guarda SIN IVA aunque el formulario "se vea" correcto) — por eso esta
    // validación exige el checkbox marcado, no solo el número del campo.
    await expect(
      this.page.locator(L.QUICK_PRODUCT_APLICAR_IVA),
      'El checkbox "Aplicar impuesto" no está marcado — el producto se guardaría sin IVA aunque "Precio con IVA" muestre un monto calculado'
    ).toBeChecked();

    const tasaPct = await this.obtenerTasaIvaSeleccionadaPct();
    const precioConIva = await this.obtenerPrecioConIvaFormulario();
    const esperado = parseFloat(precioBase) * (1 + tasaPct / 100);

    expect(
      precioConIva,
      `"Precio con IVA" (${precioConIva}) no coincide con precio base (${precioBase}) + tasa (${tasaPct}%) = ${esperado}`
    ).toBeCloseTo(esperado, 1);

    return precioConIva;
  }

  /**
   * Valida, DESPUÉS de guardar, que el total de la línea agregada en el
   * carrito es el monto CON IVA (no el precio base sin impuesto) —
   * confirma que lo que efectivamente se guardó y se va a facturar incluye
   * el IVA, no solo que el formulario lo calculó bien antes de enviarlo.
   */
  async validarMontoCarritoIncluyeIva(clave: string, montoConIvaEsperado: number) {
    const totalEnCarrito = await this.obtenerTotalProducto(clave);
    expect(
      totalEnCarrito,
      `El total en el carrito (${totalEnCarrito}) no coincide con el monto con IVA esperado (${montoConIvaEsperado})`
    ).toBeCloseTo(montoConIvaEsperado, 1);
  }

  /**
   * Lee el IVA acumulado en el área de totales del POS (footer principal,
   * fila "IVA") — un valor calculado y devuelto por el propio sistema para
   * todo el carrito, distinto del total de una sola línea o del total de la
   * factura en el modal de pago. Es la señal más confiable de que el
   * producto quedó realmente registrado con impuesto: el campo "Precio con
   * IVA" del formulario puede mostrar un monto calculado aunque el
   * checkbox se haya destildado por su cuenta antes de guardar (ver
   * seleccionarIvaManualmente()), pero este total lo calcula el sistema a
   * partir de lo que efectivamente quedó guardado.
   */
  async obtenerTotalIvaGeneral(): Promise<number> {
    const texto = await this.page.locator(L.TOTAL_IVA_GENERAL).textContent() ?? '$0.00';
    return parseFloat(texto.replace(/[^0-9.]/g, '')) || 0;
  }

  /**
   * Valida que el área de totales del POS refleje IVA mayor a cero tras
   * agregar un producto con impuesto. Usa expect.poll() porque el total se
   * recalcula de forma asíncrona apenas se agrega la fila al carrito, no de
   * forma instantánea junto con el propio DOM de la fila.
   */
  async validarTotalIvaGeneralEsMayorACero() {
    await expect.poll(
      () => this.obtenerTotalIvaGeneral(),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    ).toBeGreaterThan(0);
  }

  /**
   * Establece la cantidad en el formulario de "Producto Rápido" (por
   * defecto es 1). Rellenar el input directamente en vez de usar los
   * botones +/- es equivalente aquí: ambos terminan escribiendo el mismo
   * valor en `#quick_product_quantity`, que es lo único que lee
   * `quick_product_save()` al guardar.
   */
  async establecerCantidadProductoRapido(cantidad: number) {
    await this.page.locator(L.QUICK_PRODUCT_CANTIDAD).fill(String(cantidad));
  }

  /**
   * Determina de forma confiable si el carrito está mostrando actualmente
   * el total "con IVA" de cada línea — checkbox #show_price_with_iva,
   * arriba del carrito (encabezado de la tabla), NO el checkbox del
   * formulario "Producto Rápido". Mismo patrón de evidencia que
   * `obtenerEstadoCheckIva()`: lee la propiedad IDL `.checked` (única
   * fuente real; este checkbox tampoco usa aria-checked, data-* ni clases
   * de estado) e imprime el método y la evidencia usados.
   */
  async estaMostrandoPrecioConIva(): Promise<EstadoCheckIva> {
    const activo = await this.page.locator(L.MOSTRAR_PRECIO_CON_IVA).isChecked();
    const resultado: EstadoCheckIva = {
      activo,
      metodo: 'propiedad IDL .checked (Playwright: isChecked()) sobre #show_price_with_iva',
      evidencia: `#show_price_with_iva.checked=${activo} — alterna display entre *_without_iva y *_with_iva de cada línea (confirmado: no recalcula ni afecta el resumen de totales)`,
    };
    console.log(`[estaMostrandoPrecioConIva] activo=${resultado.activo} | ${resultado.evidencia}`);
    return resultado;
  }

  /**
   * Cambia el estado de #show_price_with_iva con un click real de usuario
   * — nunca vía evaluate()/JS. Confirmado en vivo (sin asumir) que el
   * `<input>` real está oculto (boundingBox 0×0, isVisible()=false, mismo
   * patrón de slider CSS que el checkbox del formulario) y que Playwright
   * no puede clickearlo directamente: un `locator.click()` sobre el propio
   * input agota el timeout de accionabilidad. El elemento que un usuario
   * real efectivamente toca es el `<span class="span-tax">` hermano
   * —confirmado con `elementFromPoint` en el punto exacto del click—, que
   * responde a un click normal, sin `force` y sin tocar `.checked` por
   * código: `isChecked()` cambia correctamente en ambas direcciones
   * (false→true y true→false, confirmado que es un switch real).
   *
   * Solo clickea si hace falta (nunca a ciegas): un click sobre un switch
   * ya en el estado deseado lo invertiría.
   *
   * `claves` son los productos ya presentes en el carrito cuyo total debe
   * reflejar el nuevo estado antes de devolver el control. show_price_with_iva()
   * solo alterna la clase "hide" entre las dos columnas paralelas ya
   * calculadas de cada línea (`#total_by_product_<clave>` sin IVA y
   * `#total_by_product_with_iva_<clave>` con IVA — confirmado en vivo, ver
   * el comentario de `estaMostrandoPrecioConIva()`), así que la condición
   * explícita real de "el carrito terminó de actualizarse" es que la
   * columna correspondiente al estado pedido quede realmente visible para
   * cada producto ya agregado — nunca una pausa arbitraria. Si el checkbox
   * no cambia de estado o alguna columna no llega a mostrarse, las propias
   * aserciones (`toBeChecked`/`toBeVisible`) hacen fallar el test de
   * inmediato, con el elemento y el producto exactos en el mensaje.
   */
  async establecerMostrarPrecioConIva(activar: boolean, claves: string[] = []) {
    const checkbox = this.page.locator(L.MOSTRAR_PRECIO_CON_IVA);
    const estadoActual = await checkbox.isChecked();
    if (estadoActual !== activar) {
      const span = checkbox.locator('xpath=following-sibling::span[1]');
      await span.click();
    }

    await expect(
      checkbox,
      `#show_price_with_iva no cambió a checked=${activar} tras el click sobre su span — el test no puede continuar con las validaciones de IVA en un estado desconocido`
    ).toBeChecked({ checked: activar });

    for (const clave of claves) {
      const selectorColumnaEsperada = activar
        ? `#total_by_product_with_iva_${clave}`
        : `#total_by_product_${clave}`;
      await expect(
        this.page.locator(selectorColumnaEsperada),
        `Tras fijar #show_price_with_iva=${activar}, la columna de totales esperada (${selectorColumnaEsperada}) del producto "${clave}" no quedó visible — el carrito no terminó de actualizarse`
      ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    }
  }

  /**
   * Lee todos los datos de una línea del carrito directamente del DOM real
   * (nunca por índice fijo, siempre por la clave del producto) — ver el
   * mapeo completo y la evidencia en vivo en el comentario del tipo
   * `LineaCarrito`. El total se lee del elemento que el propio carrito está
   * mostrando en este momento (según #show_price_with_iva), no de un id
   * fijo — ver `estaMostrandoPrecioConIva()`.
   */
  async obtenerDatosLineaCarrito(clave: string): Promise<LineaCarrito> {
    const mostrandoConIva = await this.estaMostrandoPrecioConIva();
    const totalSelector = mostrandoConIva.activo
      ? `#total_by_product_with_iva_${clave}`
      : `#total_by_product_${clave}`;

    // "neto" y "totalConIva" se leen SIEMPRE por su id fijo (no por
    // totalSelector): ambos existen y están correctamente calculados en el
    // DOM sin importar si #show_price_with_iva los muestra u oculta — ver
    // el comentario del tipo LineaCarrito para la evidencia completa contra
    // add_sn_product() en pos.js. #product_total_tax_<clave> ya NO se lee:
    // pese al nombre, es un duplicado del total CON IVA, no el subtotal sin
    // IVA.
    const [nombre, cantidadTexto, netoTexto, totalConIvaTexto, totalTexto, applyIvaTexto] = await Promise.all([
      this.page.locator(`#product_table_name_${clave}`).textContent(),
      this.page.locator(`#input_product_quantity_${clave}`).inputValue(),
      this.page.locator(`#total_by_product_${clave}`).textContent(),
      this.page.locator(`#total_by_product_with_iva_${clave}`).textContent(),
      this.page.locator(totalSelector).textContent(),
      this.page.locator(`#product_hide_apply_iva_${clave}`).inputValue(),
    ]);

    console.log(
      `[obtenerDatosLineaCarrito] clave=${clave} | neto(total_by_product)="${netoTexto?.trim()}" ` +
      `| totalConIva(total_by_product_with_iva)="${totalConIvaTexto?.trim()}" ` +
      `| total mostrado (${totalSelector})="${totalTexto?.trim()}" ` +
      `| product_hide_apply_iva_${clave}="${applyIvaTexto}"`
    );

    const cantidad = parseFloat(cantidadTexto) || 0;
    const neto = parseFloat((netoTexto ?? '0').replace(/[^0-9.-]/g, '')) || 0;
    const totalConIva = parseFloat((totalConIvaTexto ?? '0').replace(/[^0-9.-]/g, '')) || 0;
    const total = parseFloat((totalTexto ?? '0').replace(/[^0-9.-]/g, '')) || 0;
    const iva = totalConIva - neto;
    const precioUnitarioNeto = cantidad !== 0 ? neto / cantidad : 0;

    return {
      clave,
      nombre: nombre?.trim() || clave,
      cantidad,
      precioUnitarioNeto,
      neto,
      totalConIva,
      iva,
      total,
      ivaAplicado: applyIvaTexto === '1',
    };
  }

  /**
   * Valida una única línea del carrito: que el total mostrado sea
   * (precio unitario × cantidad) + IVA, y que la bandera real de IVA
   * aplicado (`product_hide_apply_iva_<clave>`) coincida con lo esperado —
   * esto último es lo que detecta el caso real ya confirmado en este
   * ambiente donde el total "se ve" con IVA calculado pero el sistema
   * registra la línea como sin IVA aplicado (ver pos.js:695). El mensaje de
   * error incluye producto, precio unitario, cantidad, IVA, total esperado
   * y total obtenido.
   */
  async validarLineaCarrito(clave: string, ivaEsperadoActivo: boolean): Promise<LineaCarrito> {
    const linea = await this.obtenerDatosLineaCarrito(clave);
    const totalEsperado = (linea.precioUnitarioNeto * linea.cantidad) + linea.iva;

    expect(
      linea.total,
      `Producto "${linea.nombre}" (clave ${linea.clave}): ` +
      `precio unitario=${linea.precioUnitarioNeto.toFixed(2)}, cantidad=${linea.cantidad}, ` +
      `IVA=${linea.iva.toFixed(2)}, total esperado=${totalEsperado.toFixed(2)}, total obtenido=${linea.total.toFixed(2)}`
    ).toBeCloseTo(totalEsperado, 1);

    expect(
      linea.ivaAplicado,
      `Producto "${linea.nombre}" (clave ${linea.clave}): se esperaba IVA ${ivaEsperadoActivo ? 'activado' : 'desactivado'} ` +
      `pero el sistema registró product_hide_apply_iva_${linea.clave}="${linea.ivaAplicado ? '1' : '0'}"`
    ).toBe(ivaEsperadoActivo);

    return linea;
  }

  /**
   * Recorre TODAS las claves indicadas (nunca un índice fijo ni "la
   * primera") y valida cada línea con validarLineaCarrito(). Devuelve las
   * líneas ya leídas para reutilizarlas al validar el resumen de impuestos,
   * sin volver a golpear el DOM.
   */
  async validarLineasCarrito(claves: string[], ivaEsperadoActivo: boolean): Promise<LineaCarrito[]> {
    const lineas: LineaCarrito[] = [];
    for (const clave of claves) {
      lineas.push(await this.validarLineaCarrito(clave, ivaEsperadoActivo));
    }
    return lineas;
  }

  /** Suma el IVA de las líneas dadas — reutilizado tanto para el cálculo como para el mensaje de error. */
  calcularTotalImpuestosEsperado(lineas: LineaCarrito[]): number {
    return lineas.reduce((acc, l) => acc + l.iva, 0);
  }

  /**
   * Valida que la suma del IVA de todas las líneas dadas coincida
   * exactamente con el campo "IVA" del resumen de totales del POS
   * (`obtenerTotalIvaGeneral()`, el mismo footer, no el modal de pago).
   */
  async validarResumenImpuestos(lineas: LineaCarrito[]) {
    const totalEsperado = this.calcularTotalImpuestosEsperado(lineas);
    const totalMostrado = await this.obtenerTotalIvaGeneral();

    expect(
      totalMostrado,
      `Suma de IVA por producto (${lineas.map(l => `"${l.nombre}"=${l.iva.toFixed(2)}`).join(' + ')} = ${totalEsperado.toFixed(2)}) ` +
      `no coincide con el IVA del resumen de totales (${totalMostrado.toFixed(2)})`
    ).toBeCloseTo(totalEsperado, 1);
  }

  /**
   * Selecciona manualmente el primer tipo y la primera tasa de IVA reales
   * disponibles (excluyendo el placeholder "Seleccionar...") vía los
   * widgets "Chosen" — mismo criterio que ya usa el wizard de End. Pintura
   * para parte/pieza/servicio: el catálogo de impuestos es configurable
   * por compañía, sin nombre estable en el que apoyarse (confirmado en
   * vivo: una misma instalación mostró "Impuesto al valor agregado" en un
   * momento y "Condicion impuesto 1" / "Condicion impuesto 2" en otro, según
   * el país configurado para la compañía), así que nunca se debe hardcodear
   * un texto de opción.
   *
   * Solo tiene sentido llamarlo cuando el CABYS NO aparece en el formulario
   * —si aparece, el IVA debe venir del CABYS, no de una selección manual—.
   *
   * Causa raíz confirmada (interceptando la propiedad `checked` del
   * checkbox, con stack real, no una hipótesis): `pos.js:680-699` liga un
   * `setTimeout(..., 300)` al evento `shown.bs.modal` del formulario que,
   * si la compañía no tiene un impuesto por defecto configurado, ejecuta
   * `$('#check_quick_product_apply_tax').prop('checked', false)`
   * incondicionalmente, UNA sola vez por apertura del modal — sin importar
   * lo que se haya seleccionado mientras tanto, y sin disparar ningún
   * evento "change" (no hay señal que esperar). El "300ms" es nominal:
   * confirmado en vivo disparando más de un segundo después de abierto el
   * modal cuando el hilo principal está ocupado, pudiendo caer en medio de
   * la propia selección manual o incluso en la breve ventana entre la
   * última verificación y el click real en "Agregar" (las comprobaciones
   * de accionabilidad de Playwright ya alcanzan a dar ese margen).
   *
   * Por tratarse de un timer de una sola vez con referencia temporal fija
   * (la apertura del modal, no nuestras acciones), la defensa fiable no es
   * perseguirlo después sino dejarlo pasar ANTES de tocar el checkbox por
   * primera vez.
   */
  async seleccionarIvaManualmente() {
    await this.page.waitForTimeout(5_000); // dejar pasar el timer de una sola vez de pos.js:680-699 antes de tocar el checkbox

    await this.asegurarCheckboxIvaMarcado();
    await this._seleccionarPrimeraOpcionChosen('#quick_product_tax_chosen');
    await this._seleccionarPrimeraOpcionChosen('#quick_product_tax_rate_chosen');
    await this.asegurarCheckboxIvaMarcado();
  }

  /**
   * Presiona "Agregar" para guardar el producto rápido en el carrito.
   *
   * Requiere haber entrado al POS vía cargarPosDesdeDashboard(), no
   * irAlPos() directo: este botón depende de un binding de jQuery que, en
   * una carga en frío del navegador, puede quedar sin ligar por una
   * condición de carrera real de la aplicación — ver el comentario de
   * cargarPosDesdeDashboard() para la evidencia completa. Con esa
   * precondición cumplida, un click real y sin force es suficiente.
   */
  async guardarProductoRapido() {
    await this.page.locator(L.QUICK_PRODUCT_GUARDAR).click();
  }

  /**
   * Igual que guardarProductoRapido(), pero arma la espera de la petición
   * real (getPosProductSaleItem) ANTES del click —nunca después, para no
   * perderse el evento si la respuesta llega muy rápido— y la devuelve para
   * que el test la valide explícitamente a nivel de red, no solo por su
   * efecto visual en el carrito.
   */
  async guardarProductoRapidoYObtenerRespuesta() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_PRODUCTO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.guardarProductoRapido();
    return respuestaPromise;
  }

  // ─── "Crear Combo" ──────────────────────────────────────────────────────────

  /** Locator del modal "Crear Combo". */
  get modalCrearCombo() {
    return this.page.locator(L.DIALOG_CREAR_COMBO);
  }

  /**
   * Locator del botón "CABYS" propio del formulario "Crear Combo" — distinto
   * del de "Producto Rápido" (otro onclick, otra posición en el DOM, y abre
   * un sub-modal de búsqueda completamente separado, no compartido — ver
   * `configCabysCombo`). Expuesto aparte para poder comprobar su existencia
   * (existeCampoCabys()) sin armar la configuración completa.
   */
  get botonCabysCombo() {
    return this.page.locator(L.COMBO_BTN_CABYS);
  }

  /**
   * Expande el FAB y abre el modal "Crear Combo". El ítem "Agregar combo"
   * queda con bounding box 0×0 de forma efímera (confirmado en vivo con
   * getBoundingClientRect: el estado "visible" que reporta Playwright puede
   * durar apenas milisegundos antes de volver a colapsar), así que —a
   * diferencia de abrirProductoRapido()— la comprobación de expansión usa
   * isVisible() puntual (sin esperar/poll) dentro de un ciclo corto y
   * frecuente, en vez de waitFor(): un poll que tarda en resolver puede
   * capturar el ítem apenas antes de que vuelva a colapsar, dejando el click
   * posterior actuando sobre un box ya vacío de nuevo.
   *
   * A diferencia de "Producto Rápido" (que usa `data-toggle="modal"` sobre
   * contenido ya presente en el DOM), el ítem "Agregar combo" dispara
   * `add_restaurant_combo(0)`, que carga el contenido del modal por AJAX
   * antes de mostrarlo —confirmado en vivo, incluye su propia llamada a
   * `get_combo_pharmaceutical()`—, así que el modal puede tardar bastante
   * más en aparecer que el de Producto Rápido: se espera con un timeout
   * generoso (TIMEOUTS.PRODUCTS_LOAD) después del único click sobre el ítem.
   */
  async abrirCrearCombo() {
    const toggle = this.page.locator(L.FAB_TOGGLE);
    const item = this.page.locator(L.FAB_ITEM_CREAR_COMBO);

    const MAX_INTENTOS = 15;
    let expandido = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !expandido; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      await toggle.click({ force: true });
      expandido = await item.isVisible().catch(() => false);
      if (!expandido) await this.page.waitForTimeout(300);
    }

    if (!expandido) {
      throw new Error(`El botón flotante del POS no se pudo expandir tras ${MAX_INTENTOS} intentos.`);
    }

    await item.click({ force: true });
    await expect(
      this.modalCrearCombo,
      'El modal "Crear Combo" no apareció tras clickear "Agregar combo" en el FAB'
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
  }

  /**
   * Llena nombre y cantidad en el formulario "Crear Combo" ya abierto. El
   * precio final NO se llena aquí: debe fijarse después de agregar los
   * productos (ver establecerPrecioValidoCombo()), porque el sistema lo
   * valida contra la suma de sus precios.
   */
  async llenarDatosBasicosCombo(nombre: string, cantidad = '1') {
    await this.page.locator(L.COMBO_NOMBRE).fill(nombre);
    await this.page.locator(L.COMBO_CANTIDAD).fill(cantidad);
  }

  /**
   * Busca un producto por texto en el buscador propio de "Crear Combo"
   * (Enter dispara la búsqueda — confirmado en vivo, no hay botón submit) y
   * agrega el primer resultado disponible: mismo criterio de "primera opción
   * disponible" que ya usa el resto de la suite para catálogos configurables
   * por compañía sin nombre estable (CABYS, IVA, parte/pieza/servicio de End.
   * Pintura). Los resultados son `<div onclick="get_product_combo(...)">`,
   * no `<a>` ni filas con un botón propio — confirmado inspeccionando el DOM
   * en vivo — así que se clickean vía evaluate() en vez de un locator.click()
   * normal, que no encuentra un target accionable estándar ahí.
   */
  async buscarYAgregarPrimerProductoAlCombo(termino: string) {
    const buscador = this.page.locator(L.COMBO_BUSCADOR_PRODUCTO);
    await buscador.fill(termino);
    await buscador.press('Enter');

    const resultado = this.page.locator(L.COMBO_RESULTADO_ITEM).first();
    await expect(resultado, `No hubo resultados de producto para "${termino}" al crear el combo`).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const productosAntes = await this.page.locator(L.COMBO_PRODUCTO_EN_LISTA).count();
    await this.page.evaluate((selector) => {
      (document.querySelector(selector) as HTMLElement | null)?.click();
    }, L.COMBO_RESULTADO_ITEM);

    await expect(
      this.page.locator(L.COMBO_PRODUCTO_EN_LISTA),
      `El producto buscado ("${termino}") no se agregó a la lista del combo`
    ).toHaveCount(productosAntes + 1, { timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /** Lee el "Precio real" del combo: la suma de precios de los productos ya agregados. */
  async obtenerPrecioRealCombo(): Promise<number> {
    const texto = await this.page.locator(L.COMBO_PRECIO_REAL).textContent();
    return parseFloat((texto ?? '0').replace(/[^0-9.]/g, '')) || 0;
  }

  /**
   * Fija un precio final válido para el combo, a partir del "Precio real"
   * (suma de precios de los productos ya agregados) — nunca un monto fijo
   * arbitrario. Regla de negocio descubierta inspeccionando la app en vivo
   * (no documentada): si el precio final supera esa suma, el sistema
   * rechaza el guardado en el propio cliente, sin disparar ningún request
   * de red, mostrando solo el toast "El precio del combo es mayor al precio
   * del producto" — confirmado interceptando la red y la consola tras el
   * click en "Guardar combo". Devuelve el precio fijado, por si el test
   * necesita usarlo para validar el carrito después.
   */
  async establecerPrecioValidoCombo(porcentajeDelPrecioReal = 0.8): Promise<number> {
    const precioReal = await this.obtenerPrecioRealCombo();
    expect(precioReal, 'El "Precio real" del combo es 0 — no se agregó ningún producto todavía').toBeGreaterThan(0);

    const precioValido = parseFloat((precioReal * porcentajeDelPrecioReal).toFixed(2));
    await this.page.locator(L.COMBO_PRECIO_FINAL).fill(String(precioValido));
    return precioValido;
  }

  /**
   * Presiona "Guardar combo" y devuelve la respuesta real de la petición que
   * lo persiste (save_company_combo) — misma señal de éxito a nivel de red
   * que ya usa guardarProductoRapidoYObtenerRespuesta() para Producto
   * Rápido, no solo el efecto visual de que el modal se cerró.
   */
  async guardarComboYObtenerRespuesta() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_COMBO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.COMBO_BTN_GUARDAR).click({ force: true });
    return respuestaPromise;
  }

  // ─── "Crear Producto" (primera tarjeta del grid de productos del POS) ──────
  //
  // Confirmado en vivo que este flujo NO es el mismo que "Inventario → Crear
  // Producto" del menú lateral (esa es una página completamente distinta,
  // /prod/product, con su propio wizard de 6 pasos) — este es un modal
  // embebido en el propio POS, con la misma arquitectura de wizard jQuery
  // Steps de 3 pasos que ya usa "Crear Combo" (Anterior/Guardar/Siguiente/
  // Finalizar/Cancelar), abierto desde la primera tarjeta especial del grid
  // de productos (`.product_box_new_item`, onclick="add_product_modal(...)").

  /** Locator del modal "Crear Producto". */
  get modalCrearProducto() {
    return this.page.locator(L.DIALOG_CREAR_PRODUCTO);
  }

  /**
   * Locator del botón "CABYS" propio de "Crear Producto". Existe siempre en
   * el DOM (confirmado en vivo, count()==1) pero solo queda visible si el
   * país configurado para la compañía lo exige — mismo comportamiento
   * condicional ya documentado para Producto Rápido/Combo.
   */
  get botonCabysProducto() {
    return this.page.locator(L.PRODUCTO_BTN_CABYS);
  }

  /** Locator del checkbox "¿Aplica Impuesto?" propio de "Crear Producto". */
  get checkboxIvaProducto() {
    return this.page.locator(L.PRODUCTO_APLICAR_IVA);
  }

  /**
   * Abre el modal "Crear Producto" desde la primera tarjeta del grid de
   * productos del POS. A diferencia del FAB (Producto Rápido/Combo), esta
   * tarjeta es parte del grid normal — un click simple basta, sin el ciclo
   * de expansión/reintento que sí necesita el FAB.
   */
  async abrirCrearProducto() {
    await this.cerrarModalNotificacionesSiAparece();
    await this.page.locator(L.PRODUCTO_TARJETA_CREAR).click();
    await expect(
      this.modalCrearProducto,
      'El modal "Crear Producto" no apareció tras clickear la tarjeta "Crear Producto" del grid'
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
  }

  /** Llena únicamente el nombre del producto (paso "Inf. General") — lo único obligatorio de ese paso. */
  async llenarNombreProducto(nombre: string) {
    await this.page.locator(L.PRODUCTO_NOMBRE).fill(nombre);
  }

  /**
   * Llena los campos adicionales de "Inf. General" para un producto Completo
   * o Fraccionado: marca, categoría/subcategoría/proveedor (Chosen, primera
   * opción real disponible — mismo criterio que el resto de la suite para
   * catálogos sin nombre estable), código de proveedor y código de barras.
   * Categoría y Proveedor NO son realmente obligatorios para guardar
   * (confirmado en vivo: el paso avanza igual sin seleccionarlos), pero el
   * escenario "Completo"/"Fraccionado" los llena de todos modos porque el
   * usuario los pidió explícitamente en la lista de campos.
   */
  async llenarDatosCompletosProducto(marca: string, codigoProveedor: string, codigoBarras: string) {
    await this.page.locator(L.PRODUCTO_MARCA).fill(marca);
    await this._seleccionarPrimeraOpcionChosen(L.PRODUCTO_CATEGORIA_CHOSEN);
    await this._seleccionarPrimeraOpcionChosenSiHayOpciones(L.PRODUCTO_SUBCATEGORIA_CHOSEN);
    await this._seleccionarPrimeraOpcionChosen(L.PRODUCTO_PROVEEDOR_CHOSEN);
    await this.page.locator(L.PRODUCTO_PROVEEDOR_CODIGO).fill(codigoProveedor);
    await this.page.locator(L.PRODUCTO_CODIGO_BARRAS).fill(codigoBarras);
  }

  /**
   * Avanza del paso "Inf. General" al paso "Costos" y espera la respuesta
   * real de red que efectivamente crea el producto (saveProductStepOne,
   * responde con `product_id`) — confirmado en vivo interceptando la red,
   * no solo el efecto visual del wizard.
   */
  async avanzarPasoInfoGeneralProducto() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_PRODUCTO_PASO1),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.PRODUCTO_WIZARD_SIGUIENTE).click();
    const respuesta = await respuestaPromise;
    const cuerpo = await respuesta.json();
    expect(cuerpo.status, `saveProductStepOne no respondió status=1: ${JSON.stringify(cuerpo)}`).toBe(1);
    await expect(this.page.locator(L.PRODUCTO_COSTO)).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /** Llena únicamente el Costo (paso "Costos") — el único campo común entre el modo simple y el fraccionado, ver L.PRODUCTO_FRACCIONAR. */
  async llenarCostoProducto(costo: string) {
    await this.page.locator(L.PRODUCTO_COSTO).fill(costo);
  }

  /** Llena costo, precio de venta y cantidad (paso "Costos", producto Sencillo/Completo — sin fraccionar). */
  async llenarCostosBasicosProducto(costo: string, precioVenta: string, cantidad: string) {
    await this.llenarCostoProducto(costo);
    await this.page.locator(L.PRODUCTO_PRECIO_VENTA).fill(precioVenta);
    await this.page.locator(L.PRODUCTO_CANTIDAD).fill(cantidad);
  }

  /**
   * Llena los campos adicionales de "Costos" para un producto Completo o
   * Fraccionado: stock mínimo, descuento de proveedor, descuento máximo,
   * tipo de unidad y sección/sub sección (Chosen, primera opción real).
   *
   * "Descuento de proveedor" (#product_discount_app) se omite si no está
   * interactuable — confirmado en vivo (reproducido de forma determinística,
   * esperando hasta 120s sin recuperación): cuando el producto tiene un
   * CABYS aplicado Y "¿Fraccionar?" activado A LA VEZ, este campo colapsa a
   * ancho 0 de forma PERMANENTE, no transitoria (sin CABYS aplicado se
   * mantiene interactuable sin importar el estado de IVA — probado
   * explícitamente activando IVA manualmente sin CABYS, y también sin IVA).
   * No es un problema de timing de este lado: es un efecto real y
   * reproducible de la propia app al combinar esos dos estados. El campo no
   * es obligatorio para guardar (solo precio por caja y precio por fracción
   * lo son en un producto Fraccionado), así que se omite en vez de fallar.
   */
  async llenarCostosCompletosProducto(stockMinimo: string, descuentoProveedor: string, descuentoMaximo: string) {
    await this.page.locator(L.PRODUCTO_STOCK_MINIMO).fill(stockMinimo);
    await this._llenarDescuentoProveedorSiEsPosible(descuentoProveedor);
    await this.page.locator(L.PRODUCTO_DESCUENTO_MAXIMO).fill(descuentoMaximo);
    await this._seleccionarPrimeraOpcionChosen(L.PRODUCTO_TIPO_UNIDAD_CHOSEN);
    await this._seleccionarPrimeraOpcionChosen(L.PRODUCTO_SECCION_CHOSEN);
    await this._seleccionarPrimeraOpcionChosenSiHayOpciones(L.PRODUCTO_SUBSECCION_CHOSEN);
  }

  /**
   * Ver el comentario de llenarCostosCompletosProducto(): omite el campo si
   * quedó permanentemente no interactuable (CABYS + Fraccionado a la vez).
   *
   * Intenta el fill() directamente, con un timeout propio acotado, en vez
   * de comprobar isVisible() primero y llenar después: separar "verificar"
   * de "actuar" deja una ventana real donde el campo puede leerse visible
   * en el chequeo y volverse no interactuable un instante después (el mismo
   * colapso de layout, a mitad de camino) — confirmado en vivo: ese orden
   * dejó pasar la condición y el fill() posterior, sin timeout propio,
   * esperó los 300s completos del test. Intentar el fill() de una sola vez
   * con su propio límite corto evita esa ventana.
   */
  private async _llenarDescuentoProveedorSiEsPosible(descuentoProveedor: string) {
    const campo = this.page.locator(L.PRODUCTO_DESCUENTO_PROVEEDOR);
    const relleno = await campo.fill(descuentoProveedor, { timeout: 5_000 }).then(() => true).catch(() => false);
    if (!relleno) {
      console.log('[llenarCostosCompletosProducto] "Descuento de proveedor" no quedó interactuable a tiempo (CABYS + Fraccionado a la vez) — se omite, no es obligatorio.');
    }
  }

  /**
   * Activa el checkbox "¿Aplica Impuesto?" de "Crear Producto". Reutiliza el
   * mismo helper genérico que ya usan Producto Rápido y Combo.
   */
  async activarIvaProducto() {
    await this._asegurarCheckboxEstado(this.checkboxIvaProducto, 'apply_tax_check_app', true);
  }

  /** Desactiva el checkbox "¿Aplica Impuesto?" de "Crear Producto" — contraparte de activarIvaProducto(). */
  async desactivarIvaProducto() {
    await this._asegurarCheckboxEstado(this.checkboxIvaProducto, 'apply_tax_check_app', false);
  }

  /**
   * Selecciona manualmente el primer tipo y la primera tasa de IVA reales
   * disponibles en "Crear Producto" (excluyendo el placeholder "Seleccione
   * una opción"). A diferencia de Producto Rápido/Combo, estos son
   * `<select>` NATIVOS sin Chosen (ver L.PRODUCTO_TIPO_IVA/PRODUCTO_TASA_IVA),
   * así que se usa `selectOption({index: 1})` directo en vez del clic-y-
   * elegir de un widget Chosen.
   *
   * Confirmado en vivo que hace falta: activar el checkbox NO deja ninguna
   * opción real preseleccionada (a diferencia de "Crear Combo", donde sí
   * queda una opción real apenas se marca el checkbox) — dejarlo así
   * bloqueaba silenciosamente el avance del wizard al presionar "Siguiente"
   * (sin error visible, solo nunca llegaba la petición de red esperada).
   * Solo tiene sentido llamarlo cuando el CABYS NO se aplicó — si se aplicó,
   * el IVA debe venir de él, no de una selección manual.
   */
  async seleccionarIvaManualmenteProducto() {
    await this.page.locator(L.PRODUCTO_TIPO_IVA).selectOption({ index: 1 });
    await this.page.locator(L.PRODUCTO_TASA_IVA).selectOption({ index: 1 });
  }

  /**
   * Activa el checkbox "¿Fraccionar?" de "Crear Producto". Al marcarlo, el
   * sistema reemplaza los campos simples de precio por los grupos "por
   * caja" y "por fracción" — confirmado en vivo comparando el DOM antes/
   * después (ver el comentario de L.PRODUCTO_FRACCIONAR).
   */
  async activarFraccionarProducto() {
    await this._asegurarCheckboxEstado(this.page.locator(L.PRODUCTO_FRACCIONAR), 'is_fragment_app', true);
    await expect(this.page.locator(L.PRODUCTO_PRECIO_CAJA)).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Llena los campos obligatorios que aparecen al activar "¿Fraccionar?":
   * precio por caja y precio por fracción (los únicos con `required` real,
   * confirmado en vivo comparando el DOM antes/después del checkbox — no
   * asumido), más cantidad por caja y fracciones por unidad para que los
   * precios tengan sentido de negocio.
   */
  async llenarCostosFraccionadoProducto(precioCaja: string, precioFraccion: string, cantidadCaja: string, fraccionesPorUnidad: string) {
    await this.page.locator(L.PRODUCTO_PRECIO_CAJA).fill(precioCaja);
    await this.page.locator(L.PRODUCTO_CANTIDAD_CAJA).fill(cantidadCaja);
    await this.page.locator(L.PRODUCTO_FRACCIONES_POR_UNIDAD).fill(fraccionesPorUnidad);
    await this.page.locator(L.PRODUCTO_PRECIO_FRACCION).fill(precioFraccion);
  }

  /** Lee el `percent` de la opción de tasa de IVA realmente seleccionada en "Crear Producto" (select nativo, sin Chosen). */
  async obtenerTasaIvaSeleccionadaProductoPct(): Promise<number> {
    return this.page.locator(L.PRODUCTO_TASA_IVA).evaluate(
      (el) => parseFloat((el as HTMLSelectElement).selectedOptions[0]?.getAttribute('percent') ?? 'NaN')
    );
  }

  /**
   * Valida que la tasa de IVA realmente seleccionada en "Crear Producto"
   * coincide con el IVA que el propio CABYS aplicado sugiere — mismo
   * criterio que validarIvaCoincideConCabysCombo(). Usa expect.poll() por
   * la misma razón (la sincronización tras aplicar el CABYS no es
   * necesariamente instantánea en los otros formularios de esta suite).
   */
  async validarIvaCoincideConCabysProducto() {
    const cabysTaxTexto = (await this.page.locator(L.PRODUCTO_CABYS_TAX_SUGERIDO).textContent())?.trim() ?? '';
    const cabysTaxPct = this._normalizarPorcentajeCabys(cabysTaxTexto);

    await expect.poll(
      () => this.obtenerTasaIvaSeleccionadaProductoPct(),
      {
        timeout: TIMEOUTS.PAYMENT_MODAL,
        message: `La tasa de IVA seleccionada en "Crear Producto" no coincidió con el IVA definido por el CABYS aplicado (${cabysTaxPct}%)`,
      }
    ).toBeCloseTo(cabysTaxPct, 1);
  }

  /**
   * Avanza del paso "Costos" al paso "Desc. Producto" y espera la respuesta
   * real de red (updateProductSteptwo) — confirmado en vivo interceptando
   * la red.
   */
  async avanzarPasoCostosProducto() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_PRODUCTO_PASO2),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.PRODUCTO_WIZARD_SIGUIENTE).click();
    await respuestaPromise;
    await expect(this.page.locator(L.PRODUCTO_DESCRIPCION)).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /** Llena tamaño y descripción (paso "Desc. Producto", producto Completo/Fraccionado). */
  async llenarDescripcionProducto(tamano: string, descripcion: string) {
    await this.page.locator(L.PRODUCTO_TAMANO).fill(tamano);
    await this.page.locator(L.PRODUCTO_DESCRIPCION).fill(descripcion);
  }

  /**
   * Presiona "Finalizar" (solo visible en el último paso) y espera la
   * respuesta real de red que cierra el wizard (updateProductStepthree) —
   * confirmado en vivo que tras esta petición el modal se cierra solo.
   */
  async finalizarCrearProducto() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_PRODUCTO_PASO3),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.PRODUCTO_WIZARD_FINALIZAR).click();
    const respuesta = await respuestaPromise;
    expect(respuesta.ok(), `La petición a updateProductStepthree no respondió OK (status ${respuesta.status()})`).toBe(true);
    await expect(this.modalCrearProducto).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  // ─── Pestañas superiores del POS ────────────────────────────────────────────

  /** Indica si la pestaña existe en el DOM en este momento — detecta pestañas ocultas por permisos/configuración sin fallar. */
  async existePestanaPos(selector: string): Promise<boolean> {
    return (await this.page.locator(selector).count()) > 0;
  }

  /**
   * Visita una pestaña del POS ya confirmada existente: click real (sin
   * force), espera la petición AJAX genérica que toda pestaña dispara al
   * cambiar (`set_pos_type_option` — confirmado en vivo en las 8 pestañas
   * probadas; es el único endpoint común a todas, a diferencia del
   * endpoint propio de contenido que cada una dispara además y que sí
   * varía), confirma que quedó activa (clase "btn_tab_active") y que su
   * contenedor de contenido correspondiente quedó visible.
   */
  async visitarPestanaPos(pestana: PestanaPos) {
    const tab = this.page.locator(pestana.selector);
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_CAMBIO_PESTANA_POS),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await tab.click();
    await respuestaPromise;

    await expect(
      tab,
      `La pestaña "${pestana.etiqueta}" (${pestana.selector}) no quedó activa tras el click`
    ).toHaveClass(new RegExp(L.PESTANA_POS_CLASE_ACTIVA));

    await expect(
      this.page.locator(pestana.contenedorContenido),
      `Tras activar "${pestana.etiqueta}", su contenedor de contenido (${pestana.contenedorContenido}) no quedó visible`
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    console.log(`[visitarPestanaPos] Pestaña visitada: "${pestana.etiqueta}" (${pestana.selector})`);
  }

  /**
   * Localiza dinámicamente la pestaña "Apartados": a diferencia de las
   * demás (todas con id técnico estable confirmado en pos.js), no hay
   * ningún manejador de click propio para ella en este ambiente, así que
   * no existe un id conocido que hardcodear — se busca por texto dentro
   * del propio contenedor de pestañas. Devuelve null si no existe (oculta
   * por permisos/configuración), sin asumir que siempre está presente.
   */
  async localizarPestanaApartados(): Promise<PestanaPos | null> {
    const candidato = this.page.locator(L.PESTANAS_POS_CONTENEDOR).locator('a', { hasText: /apartado/i });
    if ((await candidato.count()) === 0) return null;

    const id = await candidato.first().getAttribute('id');
    if (!id) return null;

    return { selector: `#${id}`, etiqueta: 'Apartados', contenedorContenido: '#content_invoice_order_list' };
  }

  // ─── Selección de cliente ────────────────────────────────────────────────────

  /**
   * Busca clientes existentes con el término dado y selecciona el primer
   * resultado. Búsqueda vacía (por defecto) devuelve el catálogo completo
   * de la compañía — confirmado en vivo (24 resultados) — así que no
   * depende de que exista un cliente con un nombre específico en este
   * ambiente compartido de QA, mismo patrón de "primera opción disponible"
   * que ya usa el resto de la suite para catálogos configurables por
   * compañía (CABYS, tipo/tasa de IVA, parte/pieza/servicio de End.
   * Pintura). Devuelve el nombre del cliente realmente seleccionado.
   */
  async seleccionarClienteExistente(terminoBusqueda = ''): Promise<string> {
    await this.page.locator(L.CLIENTE_INPUT_BUSQUEDA).fill(terminoBusqueda);

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.CLIENTE_AJAX_BUSQUEDA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.CLIENTE_BTN_BUSCAR).click();
    await respuestaPromise;

    const sinResultados = await this.page.locator(L.CLIENTE_SIN_RESULTADOS).isVisible().catch(() => false);
    if (sinResultados) {
      throw new Error(`No se encontraron clientes con el término de búsqueda "${terminoBusqueda}"`);
    }

    const primerCliente = this.page.locator(L.CLIENTE_FILAS_RESULTADO).first();
    await expect(
      primerCliente,
      `No apareció ningún resultado de cliente para "${terminoBusqueda}"`
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // La búsqueda dispara, en el mismo instante en que renderiza las filas
    // de resultado, una animación jQuery de 100ms que oculta .product_panel
    // (get_customer_by_pos_option → $('.product_panel').hide(100)) — la
    // inserción de las filas es síncrona/instantánea, así que el bloque
    // anterior (primerCliente visible) puede resolver bien ANTES de que esa
    // animación en cola termine. selectCustomerToPos() hace, en cambio, un
    // $('.product_panel').show() síncrono e inmediato al elegir un cliente:
    // si ese click cae dentro de esa ventana de ~100ms, el callback de
    // finalización de la animación aún pendiente puede ejecutarse DESPUÉS
    // del show() y revertirlo a oculto — condición de carrera real de la
    // app, confirmada en vivo interceptando jQuery.fn.show/hide con stack
    // traces reales (mismo patrón de causa raíz que el bug ya documentado
    // de pos.js:695). Por eso se espera aquí, de forma explícita, a que la
    // animación en cola termine de verdad (.product_panel oculto) antes de
    // hacer click en "seleccionar" — así el show() posterior corre después
    // de que la cola de animación quedó vacía, sin nada que lo revierta.
    await expect(
      this.page.locator(L.PANEL_PRODUCTOS),
      'La animación de ocultar el catálogo de productos (disparada por la búsqueda) no terminó — no se puede seleccionar el cliente todavía sin arriesgar la condición de carrera ya documentada'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await primerCliente.locator(L.CLIENTE_BTN_SELECCIONAR_FILA).click();

    await expect(
      this.page.locator(L.CLIENTE_PANEL_RESULTADOS),
      'El panel de selección de clientes no se cerró tras elegir uno'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await expect(
      this.page.locator(L.CLIENTE_SELECT_OCULTO),
      'El cliente seleccionado no quedó registrado en #customer_select'
    ).not.toHaveValue('');

    const nombreCliente = (await this.page.locator(L.CLIENTE_NOMBRE_SELECCIONADO).textContent())?.trim() ?? '';
    expect(nombreCliente, 'El nombre del cliente seleccionado no quedó visible en el POS').not.toBe('');

    await expect(
      this.page.locator(L.PANEL_PRODUCTOS),
      'El POS no volvió al catálogo de productos tras seleccionar el cliente'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const idCliente = await this.page.locator(L.CLIENTE_SELECT_OCULTO).inputValue();
    console.log(`[seleccionarClienteExistente] Cliente seleccionado: "${nombreCliente}" (id=${idCliente})`);

    return nombreCliente;
  }

  /**
   * Factura solo con el nombre del cliente, sin seleccionar uno registrado:
   * abre "Agregar" → "Nombre del cliente" (dropdown Bootstrap dentro del
   * panel de búsqueda), escribe el nombre y confirma con blur — el campo
   * usa `onchange`, confirmado en vivo que un fill() sin blur no aplica el
   * nombre. Valida contra #temporal_customer_name (el campo que
   * efectivamente se lee al facturar), no contra #customer_selected_name
   * (ver el comentario de CLIENTE_INPUT_NOMBRE_RAPIDO).
   */
  async ingresarNombreCliente(nombre: string) {
    await this.page.locator(L.CLIENTE_DROPDOWN_AGREGAR).click();
    await this.page.getByRole('link', { name: 'Nombre del cliente' }).click();
    await expect(
      this.page.locator(L.CLIENTE_CONTENEDOR_NOMBRE_RAPIDO),
      'El campo "Nombre del cliente" no apareció tras seleccionar la opción del menú "Agregar"'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const campoNombre = this.page.locator(L.CLIENTE_INPUT_NOMBRE_RAPIDO);
    await campoNombre.fill(nombre);
    await campoNombre.blur();

    await expect(
      campoNombre,
      `El nombre del cliente no quedó aplicado: se esperaba "${nombre}"`
    ).toHaveValue(nombre);

    await expect(
      this.page.locator(L.PANEL_PRODUCTOS),
      'El POS no está listo para continuar con la facturación tras ingresar el nombre del cliente'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    console.log(`[ingresarNombreCliente] Nombre aplicado: "${nombre}"`);
  }

  // ─── Métodos privados ────────────────────────────────────────────────────────

  /**
   * Hace click en la primera opción visible que resuelva el selector dado,
   * validando primero que exista al menos una — usado por los pasos de
   * parte/pieza/servicio del wizard "End. Pintura", que comparten la misma
   * necesidad (catálogo sin nombre estable, tomar la primera disponible) y el
   * mismo tipo de fallo a diagnosticar si el catálogo viniera vacío.
   */
  private async _clickPrimeraOpcionDisponible(selector: string, descripcion: string) {
    const opcion = this.page.locator(selector).first();
    await expect(opcion, `No hay ninguna ${descripcion} disponible en este paso del wizard "End. Pintura"`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await opcion.click();
  }

  /**
   * Abre un widget "Chosen" y selecciona su primera opción real, excluyendo
   * el placeholder ya marcado "result-selected" (mismo criterio que
   * PINTURA_VEHICULO_RESULTADO usa filtrando por texto: el primer <li> de
   * un Chosen recién abierto es siempre el placeholder, nunca una opción
   * real utilizable).
   */
  private async _seleccionarPrimeraOpcionChosen(contenedorChosenSelector: string) {
    const trigger = this.page.locator(`${contenedorChosenSelector} .chosen-single`);
    // El menú desplegado de Chosen se posiciona relativo al trigger: si el
    // trigger queda fuera del viewport (confirmado en vivo en formularios
    // largos, p. ej. "Crear Producto" con "¿Fraccionar?" activado, que hace
    // el modal mucho más alto), el resultado también nace fuera del
    // viewport y el auto-scroll de Playwright nunca llega a alcanzarlo.
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const opcion = this.page.locator(`${contenedorChosenSelector} .chosen-results li:not(.result-selected)`).first();
    await expect(opcion, `El Chosen "${contenedorChosenSelector}" no tiene ninguna opción real disponible`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await opcion.click();
  }

  /**
   * Variante de _seleccionarPrimeraOpcionChosen() para catálogos dependientes
   * (p. ej. Subcategoría depende de la Categoría elegida, Sub sección de la
   * Sección) que pueden legítimamente no tener ninguna opción real todavía —
   * en vez de fallar, simplemente no selecciona nada y lo deja en su
   * placeholder por defecto.
   */
  private async _seleccionarPrimeraOpcionChosenSiHayOpciones(contenedorChosenSelector: string) {
    const trigger = this.page.locator(`${contenedorChosenSelector} .chosen-single`);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    const opcion = this.page.locator(`${contenedorChosenSelector} .chosen-results li:not(.result-selected)`).first();
    const hayOpcion = await opcion.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hayOpcion) {
      await opcion.click();
    } else {
      // Cerrar el Chosen desplegado sin elegir nada, presionando Escape.
      await this.page.keyboard.press('Escape');
    }
  }

  /**
   * Determina de forma confiable si el check "Incluir IVA" está activo en
   * ESTE momento — nunca asumido por el escenario del test. Lee la
   * propiedad IDL `.checked` (única fuente real dentro del propio checkbox,
   * ver el comentario de `EstadoCheckIva`) e imprime en consola el estado
   * detectado, el método usado y la evidencia cruda inspeccionada (atributo
   * HTML, aria-checked, data-*, clases), para que quede constancia de que
   * no se asumió nada.
   *
   * Importante: esta lectura es válida para ESTE instante. No garantiza qué
   * quedará aplicado tras el guardado —ver el comentario de
   * `EstadoCheckIva`—, así que las validaciones posteriores al guardado
   * deben usar `#product_hide_apply_iva_<clave>` (LineaCarrito.ivaAplicado),
   * no este resultado.
   */
  async obtenerEstadoCheckIva(): Promise<EstadoCheckIva> {
    const detalle = await this.page.locator(L.QUICK_PRODUCT_APLICAR_IVA).evaluate((el: HTMLInputElement) => ({
      checkedProperty: el.checked,
      checkedAttribute: el.getAttribute('checked'),
      ariaChecked: el.getAttribute('aria-checked'),
      dataAttrs: [...el.attributes].filter(a => a.name.startsWith('data-')).map(a => `${a.name}="${a.value}"`),
      classList: [...el.classList],
    }));

    const resultado: EstadoCheckIva = {
      activo: detalle.checkedProperty,
      metodo: 'propiedad IDL .checked (Playwright: isChecked())',
      evidencia:
        `checkedProperty(.checked)=${detalle.checkedProperty}, ` +
        `checkedAttribute(getAttribute)=${detalle.checkedAttribute ?? 'null'}, ` +
        `aria-checked=${detalle.ariaChecked ?? 'null'}, ` +
        `data-*=[${detalle.dataAttrs.join(', ') || 'ninguno'}], ` +
        `classList=[${detalle.classList.join(', ') || 'ninguna'}]`,
    };

    console.log(
      `[obtenerEstadoCheckIva] activo=${resultado.activo} | método=${resultado.metodo} | evidencia: ${resultado.evidencia}`
    );

    return resultado;
  }

  /**
   * Asegura que un checkbox de IVA quede en el estado pedido (marcado o
   * desmarcado), clickeándolo solo si hace falta (nunca a ciegas: un click
   * sobre un checkbox ya en el estado deseado lo invertiría). Reintenta con
   * `expect.poll` porque el propio click puede no sostenerse al primer
   * intento. Recibe el locator y el id del checkbox porque tanto "Producto
   * Rápido" (asegurarCheckboxIvaMarcado()) como "Crear Combo"
   * (activarIvaCombo()/desactivarIvaCombo()) tienen el suyo propio.
   */
  private async _asegurarCheckboxEstado(checkbox: Locator, idParaClick: string, marcado: boolean) {
    await expect.poll(async () => {
      const actual = await checkbox.isChecked();
      if (actual !== marcado) {
        await this.page.evaluate((id) => (document.getElementById(id) as HTMLInputElement).click(), idParaClick);
      }
      return checkbox.isChecked();
    }, { timeout: TIMEOUTS.PAYMENT_MODAL }).toBe(marcado);
  }

  /**
   * Asegura que el checkbox "Aplicar impuesto" de "Producto Rápido" quede marcado.
   */
  async asegurarCheckboxIvaMarcado() {
    await this._asegurarCheckboxEstado(this.page.locator(L.QUICK_PRODUCT_APLICAR_IVA), 'check_quick_product_apply_tax', true);
  }

  /** Locator del checkbox "¿Aplicar impuesto?" propio de "Crear Combo", expuesto para que los tests verifiquen su estado directamente. */
  get checkboxIvaCombo() {
    return this.page.locator(L.COMBO_APLICAR_IVA);
  }

  /**
   * Activa el checkbox "¿Aplicar impuesto?" de "Crear Combo". A diferencia
   * del checkbox de "Producto Rápido", este NO tiene el bug de reseteo de
   * pos.js:680-699 (confirmado en vivo: permanece marcado incluso varios
   * segundos después de activarlo), así que no hace falta la espera de 5s ni
   * el doble reafirmado que sí necesita seleccionarIvaManualmente(). Tampoco
   * hace falta interactuar con los "Chosen" de tipo/tasa de impuesto: ambos
   * ya quedan en una opción real (no en un placeholder "Seleccionar...")
   * apenas se marca el checkbox — confirmado en vivo leyendo su `value`
   * inmediatamente después del click.
   *
   * IMPORTANTE (confirmado en vivo, contradice lo asumido originalmente):
   * si este checkbox se activa ANTES de aplicar un CABYS, el select de tasa
   * (`#tax_rate_list`) SÍ se autosincroniza con la tasa real del CABYS —
   * ver L.COMBO_TASA_IVA y validarIvaCoincideConCabysCombo(). El orden
   * activar→CABYS es entonces obligatorio para el escenario "con IVA".
   */
  async activarIvaCombo() {
    await this._asegurarCheckboxEstado(this.page.locator(L.COMBO_APLICAR_IVA), 'apply_tax_combo', true);
  }

  /**
   * Desactiva el checkbox "¿Aplicar impuesto?" de "Crear Combo" — contraparte
   * de activarIvaCombo(), reutilizando el mismo helper genérico
   * (_asegurarCheckboxEstado) en vez de duplicar la lógica de click/poll.
   * Usada tanto para dejar el combo explícitamente "sin IVA" como para
   * re-forzar ese estado después de aplicar un CABYS (defensivo: aunque no
   * se confirmó en vivo que aplicar un CABYS reactive este checkbox por su
   * cuenta, tampoco hay garantía de que no lo haga en otro ambiente/versión).
   */
  async desactivarIvaCombo() {
    await this._asegurarCheckboxEstado(this.page.locator(L.COMBO_APLICAR_IVA), 'apply_tax_combo', false);
  }

  /**
   * Re-verifica y, si hace falta, vuelve a dejar el checkbox de IVA marcado
   * y el tipo/tasa realmente seleccionados (no en el placeholder "0").
   *
   * Causa raíz confirmada interceptando la propiedad `checked` del checkbox
   * (captura de stack real, no una hipótesis): pos.js:680-699 liga un
   * `setTimeout(..., 300)` al evento `shown.bs.modal` del formulario que,
   * si la compañía no tiene un impuesto por defecto configurado, ejecuta
   * `$('#check_quick_product_apply_tax').prop('checked', false)`
   * incondicionalmente — una sola vez por apertura del modal, sin importar
   * lo que el usuario haya seleccionado mientras tanto. `.prop()` no
   * dispara ningún evento "change", así que no hay señal que esperar. El
   * "300ms" es nominal: confirmado en vivo disparando más de un segundo
   * después de abierto el modal cuando el hilo principal está ocupado
   * (carga de scripts), pudiendo caer en medio de la propia selección
   * manual de IVA del test.
   *
   * Como es un timer de una sola vez (no recurrente), la defensa no es
   * perseguirlo indefinidamente sino corregir, esperar un margen real
   * mayor a los 300ms nominales, y corregir de nuevo — para esa segunda
   * pasada, el timer ya disparó y no hay una tercera corrección pendiente.
   */
  async asegurarIvaManualConfigurado() {
    const corregirSiHizoFalta = async () => {
      await this.asegurarCheckboxIvaMarcado();
      const tipoValor = await this.page.locator(L.QUICK_PRODUCT_TIPO_IVA).inputValue();
      if (parseInt(tipoValor, 10) === 0) {
        await this._seleccionarPrimeraOpcionChosen('#quick_product_tax_chosen');
      }
      const tasaValor = await this.page.locator(L.QUICK_PRODUCT_TASA_IVA).inputValue();
      if (parseInt(tasaValor, 10) === 0) {
        await this._seleccionarPrimeraOpcionChosen('#quick_product_tax_rate_chosen');
      }
    };

    await corregirSiHizoFalta();
    await this.page.waitForTimeout(800); // margen real sobre los 300ms nominales del timer de pos.js
    await corregirSiHizoFalta();

    // Verificación final: si algo se reseteó, esto también reseteó "Precio
    // con IVA" (lo recalcula quick_product_apply_tax() al reafirmar el
    // checkbox) — validar que quedó realmente mayor al precio base, no
    // igual a él (que sería 0% de tasa efectiva).
    const precio = parseFloat(await this.page.locator(L.QUICK_PRODUCT_PRECIO).inputValue());
    const precioConIva = await this.obtenerPrecioConIvaFormulario();
    expect(
      precioConIva,
      `"Precio con IVA" (${precioConIva}) quedó igual al precio base (${precio}) tras reafirmar el IVA — la tasa se reseteó a 0%`
    ).toBeGreaterThan(precio);
  }

  private async _llamarSetProductTotal(clave: string, porcentaje: string) {
    await this.page.evaluate(
      ({ key, value }) => {
        const el = document.getElementById(`input_product_discount_${key}`) as HTMLInputElement;
        if (el) el.value = value;
        (window as any).set_product_total(key);
      },
      { key: clave, value: porcentaje }
    );
  }

  private async _leerValorDescuentoInput(clave: string): Promise<string> {
    return this.page.evaluate(
      (key) => (document.getElementById(`input_product_discount_${key}`) as HTMLInputElement)?.value ?? '0',
      clave
    );
  }

  /**
   * Detecta y cierra un diálogo de alerta (SweetAlert2 o Bootstrap modal visible).
   * Devuelve el texto completo del diálogo, o null si no había ninguno.
   */
  private async _leerYCerrarAlerta(): Promise<string | null> {
    // SweetAlert2
    const swal2 = this.page.locator('.swal2-popup');
    if (await swal2.isVisible().catch(() => false)) {
      const titulo  = await this.page.locator('.swal2-title').textContent().catch(() => '') ?? '';
      const cuerpo  = await this.page.locator('.swal2-html-container, .swal2-content').first().textContent().catch(() => '') ?? '';
      const texto   = `${titulo} ${cuerpo}`.trim();
      const btnOk   = this.page.locator('.swal2-confirm');
      if (await btnOk.isVisible().catch(() => false)) {
        await btnOk.click();
      } else {
        await this.page.keyboard.press('Escape');
      }
      await this.page.waitForTimeout(PAUSES.VER_MODAL);
      return texto || null;
    }

    // Bootstrap modal (si el framework usa uno en lugar de SweetAlert2)
    const modalBody = await this.page.evaluate(() => {
      const modal = [...document.querySelectorAll('.modal')].find(
        m => window.getComputedStyle(m).display !== 'none'
      );
      if (!modal) return null;
      const titulo = modal.querySelector('.modal-title')?.textContent?.trim() ?? '';
      const cuerpo = modal.querySelector('.modal-body')?.textContent?.trim() ?? '';
      return `${titulo} ${cuerpo}`.trim() || null;
    });
    if (modalBody) {
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(PAUSES.VER_MODAL);
      return modalBody;
    }

    return null;
  }

  /**
   * Cambia el método activo de efectivo (predeterminado) al indicado.
   * Usa evaluate() porque los checkboxes tienen slider CSS y están fuera del viewport.
   */
  private async _cambiarMetodoPago(checkboxId: string) {
    await this.page.evaluate(
      (id) => (document.getElementById(id) as HTMLInputElement).click(),
      CHECKBOX_ID.EFECTIVO
    );
    await this.page.waitForTimeout(PAUSES.CHECKBOX_ACTIVACION);

    await this.page.evaluate(
      (id) => (document.getElementById(id) as HTMLInputElement).click(),
      checkboxId
    );
    await this.page.waitForTimeout(PAUSES.CAMPO_HABILITADO);
  }
}
