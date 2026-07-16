// Objeto de locators de todo el módulo POS — movido tal cual desde pos.page.ts
// (Paso 0 de la migración a composición, ver el plan aprobado). Extraído
// mecánicamente, sin cambios de contenido: cada clase de dominio importa
// `{ L }` de aquí en vez de tener su propia copia.
export const L = {
  // POS principal
  // Vista Cuadrícula (`.product_box_name`, el `<p>` con el onclick real) y
  // Vista Lista (`td[id^="product_table_click_event_"]`, la celda de imagen
  // con ese mismo onclick real dentro de la fila `<tr>`) usan plantillas de
  // producto completamente distintas — confirmado en vivo: en Vista Lista,
  // `.product_box_name` no existe en absoluto (0 tarjetas), lo que hacía
  // fallar cualquier búsqueda de producto ahí, aunque el catálogo sí tuviera
  // productos cargados. El resto de la suite corre casi siempre en Vista
  // Cuadrícula, donde solo existe el `.product_box_name` (el selector `td`
  // no matchea nada ahí — su equivalente en Vista Cuadrícula es un `<div>`,
  // no un `<td>`), así que este selector combinado no cambia ningún
  // comportamiento ya existente.
  PRODUCTO:          '.product_box_name, td[id^="product_table_click_event_"]',
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

  // Dashboard — spinner del panel de notificaciones ("campana"). Se elimina
  // del DOM justo cuando getUserNotifications responde — ver el comentario
  // de cargarPosDesdeDashboard() para la evidencia completa.
  DASHBOARD_BELL_LOADING: '.workshop-web-bell-loading',

  // Dashboard — modal de tipo de cambio (Banco Central de Costa Rica), puede
  // quedar abierto sobre el menú lateral e interceptar clicks — investigado
  // en vivo (dashbmBccrCurrencyModal), ver _resolverUrlPosDesdeDashboard().
  DASHBOARD_MODAL_MONEDA: '#dashbmBccrCurrencyModal',

  // Dashboard — modal "Setup Inicial del Sistema": aparece cuando la
  // compañía activa por defecto de la cuenta (la que carga el Dashboard sin
  // haber elegido ninguna todavía) tiene pendiente su configuración inicial
  // — confirmado en vivo con una cuenta real distinta a la de storageState
  // por defecto, donde bloqueaba cualquier click en el sidebar
  // (data-backdrop="static", data-keyboard="false", pero con botón de
  // cierre real .setup-modal-close). No tiene relación con la compañía que
  // el resto del flujo termina seleccionando (p. ej. HONDURAS) — es la
  // compañía por defecto de la cuenta la que dispara este modal, no la
  // elegida después.
  DASHBOARD_MODAL_SETUP_INICIAL: '#setupInitialModal',

  // Dashboard — link real que abre el flujo de selección de compañía/POS
  // (onclick="get_company_pos_select(1)", texto visible "Crear factura" —
  // el "1" coincide con pos_type_option=1, confirmado en vivo en
  // sidebar-active.js). Vive colapsado dentro de un submenú "FACTURAR" hasta
  // que se expande.
  DASHBOARD_LINK_IR_A_POS: 'a[onclick*="get_company_pos_select(1)"]',

  // Dashboard — modal "Seleccionar una compañía para continuar": solo
  // aparece cuando el usuario pertenece a más de una compañía y ninguna
  // quedó ya resuelta por la llamada AJAX síncrona de get_company_pos_select()
  // — confirmado en vivo (dialog_select_company_pos / select_company_pos_content,
  // vacío en el HTML inicial, se llena dinámicamente).
  DASHBOARD_MODAL_SELECCIONAR_COMPANIA: '#dialog_select_company_pos',
  DASHBOARD_LISTA_COMPANIAS: '#company_list li',
  // Nombre real de la compañía DENTRO de cada <li> de DASHBOARD_LISTA_COMPANIAS
  // — el <li> completo puede incluir más contenido (dirección, ícono), así que
  // el match por nombre EXACTO (ver _irAlPosResolviendoCompania()) se hace
  // contra este elemento, nunca contra el texto agregado del <li>.
  DASHBOARD_COMPANIA_NOMBRE: '.company-name',

  // Modal de pago
  DIALOG_PAGO:       '#dialog_payment',
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
  // "TODOS" y "Combos" son funciones reales del propio POS con clase CSS
  // estable, presentes en cualquier compañía. "Categoría", "Productos
  // variantes" y "Productos fraccionados", en cambio, son categorías de
  // producto normales y corrientes (con id numérico propio de cada
  // compañía, confirmado en vivo comparando HONDURAS con TALLER ALPHA
  // PREMIUM: los mismos ids no existen ahí) que esta cuenta de HONDURAS
  // tiene creadas con esos nombres — se localizan por
  // `data-category-name` (el mismo nombre real que ya usa el resto de la
  // suite para etiquetarlas), nunca por el id numérico, pero pueden no
  // existir en absoluto en otra compañía: ver `categoriaOpcionalPorNombre()`.
  CAT_TODOS:         '.left_category_all',
  CAT_COMBOS:        '.li_left_category_combo',
  CAT_ACTIVE_CLASS:  'left_category_active',

  // Contenedor con scroll infinito del grid de productos (Vista Cuadrícula,
  // el estilo activo por defecto — ver VISTA_ESTILO_ACTUAL). Confirmado en
  // vivo en pos.js (bindProductBoxScroll()): un listener de scroll real
  // ligado a esta misma clase dispara search_product(1)/search_service(1)
  // al acercarse al final, cargando la siguiente página del catálogo
  // (is_append=1, misma respuesta HTML de getPosProductSearch) — es el
  // mecanismo genuino de paginación de la propia UI, no un endpoint
  // reverse-engineered con parámetros propios. Se usa para ampliar cuántas
  // tarjetas hay disponibles al buscar un producto por característica
  // (ver localizarPrimerProducto()) sin depender de ningún término de
  // búsqueda ni categoría.
  GRID_SCROLL_CONTENEDOR: '.content_product_style_box',

  // Toggle de vista de productos: lista vs. cuadrícula
  VISTA_LISTA:            '#style_list',
  VISTA_CUADRICULA:       '#style_box',
  VISTA_ACTIVE_CLASS:     'product_style_active',
  VISTA_ESTILO_ACTUAL:    '#current_product_style', // oculto en el DOM; refleja el estado inicial ("box")

  // Tabs Productos / Servicios / End. Pintura
  TAB_PRODUCTOS:       '#ck_view_products',
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

  // Ícono "X" para quitar el cliente actualmente seleccionado del carrito —
  // confirmado en vivo (volcando el DOM de la zona "content-customer-
  // selected-info"): SOLO está visible cuando hay un cliente REAL
  // seleccionado (id != "0"); con el placeholder "Cliente de contado" (ningún
  // cliente real, p. ej. una factura recién importada sin cliente asociado)
  // permanece oculto. Esta visibilidad es, confirmado en vivo, la señal más
  // directa de "¿hay un cliente real seleccionado ahora mismo?" — más
  // confiable que leer el texto de CLIENTE_NOMBRE_SELECCIONADO (que también
  // podría, en teoría, coincidir con "Cliente de contado" como nombre real de
  // un cliente registrado). onclick="validateRemoveProformClient(0, true)":
  // confirmado en vivo que NO dispara ningún SweetAlert de confirmación (a
  // diferencia de la mayoría de acciones destructivas de esta suite) — quita
  // el cliente de inmediato.
  CLIENTE_BTN_QUITAR: '#clear_customer_selected',

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

  // Modal "Monto a comprar" (#dialog_sale_by_amount) — el OTRO caso confirmado
  // (junto con el Fraccionado) en el que un click normal sobre una tarjeta del
  // grid NO agrega la línea directamente. Un camino CONFIRMADO hacia este
  // modal, leyendo add_to_table() en pos.js: el propio click ejecuta
  // setVehicleProductItemModal(...) y hace return false ANTES de tocar el
  // carrito, cuando el producto trae #input_product_sale_is_vehicle_poroduct_<id>=1,
  // #input_product_sale_is_vehicle_poroduct_data_in_pos_<id>=1 y
  // #input_product_sale_vehicle_info_<id> distinto de "[]" — pero NO es el
  // único: confirmado en vivo con un producto real de este catálogo
  // (cantidadDisponible fraccionaria, ej. 5.8571 — consistente con un
  // producto que se vende "por monto"/peso) que el mismo modal se abre SIN
  // que esos tres inputs siquiera existan en el DOM para ese id, así que debe
  // haber otro disparador en pos.js que aún no se localizó con certeza — de
  // cualquier forma, ninguno es un argumento de add_to_table() (a diferencia
  // de apply_iva/item_type/is_fragmented, que sí vienen en el onclick y ya
  // alimentan MetadatoProducto), de ahí que no se pueda anticipar este caso
  // antes del click, sea cual sea la condición real. El campo "Monto"
  // (#dsba_amount) autocalcula "Cantidad" (#dsba_quantity) en vivo; basta con
  // llenar uno de los dos. El botón "Continuar" (#apply_sale_by_amount) NO
  // dispara ningún AJAX propio: llama directo, en el cliente, al mismo
  // add_to_table() que agrega cualquier producto normal (con la cantidad ya
  // calculada a partir del monto) — mismo mecanismo de guardado diferido
  // hasta Facturar que ya documenta el resto de la suite. Confirmado en vivo
  // (DOM real del modal): título "Monto a comprar", valida que Monto y
  // Cantidad sean > 0 antes de agregar la línea.
  DIALOG_MONTO_A_COMPRAR:        '#dialog_sale_by_amount',
  MONTO_A_COMPRAR_INPUT_MONTO:   '#dsba_amount',
  MONTO_A_COMPRAR_BTN_CONFIRMAR: '#apply_sale_by_amount',

  // Modal "Observaciones" por línea de producto (#product_item_comment_<clave>
  // abre #dialog_product_item_comment) — biblioteca reutilizable de
  // comentarios ya guardados (buscador, "Aplicar" a uno existente), con un
  // botón "+" que abre su propio formulario de alta (textarea + Guardar).
  // Confirmado en vivo: "Guardar" cierra el modal solo y deja el texto exacto
  // en product_hide_item_observation_<clave> (hidden input, fuente real —
  // no hay ningún texto visible de la observación en la fila). El botón
  // "papelera" de una línea (remove_from_list/remove_from_order_list según
  // el origen de la línea — ver eliminarProductoDelCarrito()) no tiene un id
  // propio estable en ambos casos, así que su selector se arma inline con la
  // clave, igual que el resto de selectores por-producto de este archivo.
  DIALOG_COMENTARIO_PRODUCTO: '#dialog_product_item_comment',
  COMENTARIO_PRODUCTO_BTN_NUEVO: '#dialog_product_item_comment button[onclick*="show_product_item_comment(0,1)"]',
  COMENTARIO_PRODUCTO_TEXTAREA: '#ta_product_item_comment',
  COMENTARIO_PRODUCTO_BTN_GUARDAR: '#dialog_product_item_comment button[onclick="updateDialogProductItemComment(0,1)"]',

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

  // ─── "Orden de Caja" (Enviar a caja) ───────────────────────────────────────
  // El botón NO está junto a "Facturar" como botón independiente — vive
  // dentro del menú desplegable que abre #demo-menu-top-right (botón
  // circular MDL junto a "Facturar", DISTINTO del menú de tres puntos del
  // encabezado — L.MENU_TRES_PUNTOS) — confirmado en vivo inspeccionando el
  // DOM real. Dentro de ese menú, junto a Proforma/Orden de ruteo/Apartado,
  // está "(⇧+C) Enviar a caja" (onclick="confirm_send_sale()").
  ORDEN_CAJA_MENU_BTN:  '#demo-menu-top-right',
  ORDEN_CAJA_MENU_ITEM: '#li_send_to_cashier',
  DIALOG_ORDEN_CAJA:    '#dialog_send_sale',

  // Buscador de cliente PROPIO del modal — confirmado en vivo que NO es el
  // mismo control que el panel "Buscar Cliente" de arriba del carrito
  // (CLIENTE_INPUT_BUSQUEDA/CLIENTE_BTN_BUSCAR, tarjetas .customer-list-pos):
  // este usa un <select> Chosen (payment_send_sale_credit_client) poblado
  // por el mismo AJAX (CLIENTE_AJAX_BUSQUEDA). El ícono de búsqueda se
  // escopa dentro del modal porque su id ("basic-addon3") se repite en más
  // de un lugar del DOM — confirmado en vivo. También confirmado en vivo:
  // seleccionar un cliente arriba del carrito (seleccionarClienteExistente(),
  // Forma 1) SÍ se refleja automáticamente en este mismo <select> — ambas
  // formas comparten el estado de cliente del carrito, aunque la Forma 2
  // tenga su propio buscador independiente.
  ORDEN_CAJA_CLIENTE_INPUT_BUSQUEDA: '#search_pos_customer_send_sale',
  ORDEN_CAJA_CLIENTE_BTN_BUSCAR:     '#dialog_send_sale .search_parameter_addon',
  ORDEN_CAJA_CLIENTE_CHOSEN:         '#payment_send_sale_credit_client_chosen',

  ORDEN_CAJA_VENDEDOR_CHOSEN: '#send_sale_payment_agent_assigned_chosen',

  // Checkboxes de slider CSS (mismo patrón que el resto de la suite: fuera
  // del flujo normal de click, se accionan con _asegurarCheckboxEstado()).
  // Confirmado en vivo: elegir "Crédito" revela ORDEN_CAJA_FECHA_VENCIMIENTO_CONTENEDOR
  // y cambia ORDEN_CAJA_TIPO_PAGO_HIDE a "2" ("1" = Contado). También
  // confirmado: "Crédito" exige un cliente real seleccionado — con nombre de
  // terceros únicamente, o sin cliente, "Enviar a caja" no dispara ninguna
  // petición ni alerta (bloqueo silencioso del lado del cliente).
  ORDEN_CAJA_CHECK_CONTADO: '#ck_is_send_sale_payment_cash',
  ORDEN_CAJA_CHECK_CREDITO: '#ck_is_send_sale_payment_credit',
  ORDEN_CAJA_TIPO_PAGO_HIDE: '#payment_type_send_sale',
  ORDEN_CAJA_FECHA_VENCIMIENTO_CONTENEDOR: '#send_sale_end_date_content',

  // "A nombre de terceros": el campo de texto nace deshabilitado y solo se
  // habilita al activar el checkbox (mismo patrón de slider CSS).
  ORDEN_CAJA_CHECK_TERCERO: '#ck_send_sale_third_person_name',
  ORDEN_CAJA_INPUT_TERCERO: '#send_sale_third_person_name',

  ORDEN_CAJA_OBSERVACIONES: '#send_sale_observation',
  ORDEN_CAJA_BTN_ENVIAR:    '#send_sale_payment',

  // Petición AJAX real que crea la Orden de Caja — confirmado en vivo
  // interceptando la red tras confirmar el SweetAlert de advertencia
  // ("¿Está seguro de enviar esta venta a caja?").
  AJAX_ENVIAR_ORDEN_CAJA: 'sendPosProductSale',

  // Tarjeta de una Orden de Caja ya listada (mismo elemento que
  // L.IMPORTAR_FACTURA_FILA/.pos_order_list_item_content, reutilizado): expone
  // como hijo un <p> oculto con el tipo de pago real con el que se creó
  // ("1"=Contado, "2"=Crédito, mismos valores que ORDEN_CAJA_TIPO_PAGO_HIDE) —
  // confirmado en vivo volcando el DOM completo de #content_invoice_order_list.
  // No existe ningún campo de búsqueda propio de esta pestaña (confirmado en
  // vivo: sin inputs de texto/tipo search en todo el contenedor) — ver el
  // comentario de _cargarOrdenCajaQueCumpla() en PosPage para el resto de la
  // evidencia y cómo se localiza una Orden de Caja concreta sin él.
  ORDEN_CAJA_TARJETA_TIPO_PAGO_HIDE: '[id^="pos_order_invoice_payment_type_id_hide_"]',

  // Modal de pago (Facturar): "Tipo de pago" (Contado/Crédito) y "Asignar
  // vendedor" — confirmado en vivo (volcando el DOM completo de
  // #dialog_payment) que son controles PROPIOS del modal de pago, DISTINTOS
  // de ORDEN_CAJA_CHECK_CONTADO/CREDITO y ORDEN_CAJA_VENDEDOR_CHOSEN (esos
  // viven en el modal "Enviar a caja", #dialog_send_sale). Confirmado en vivo
  // que cargar una Orden de Caja YA CREADA A CRÉDITO y abrir Facturar deja
  // este checkbox de Crédito SIN marcar (el modal de pago siempre abre en
  // Contado, #ck_is_payment_cash checked por defecto): el tipo de pago de
  // "Enviar a caja" no se traslada al modal de Facturar — comportamiento real
  // del sistema, no un defecto de la suite (ver el comentario de
  // cargarPrimeraOrdenCajaACreditoDisponible() en PosPage). El vendedor
  // (#payment_agent_assigned) sí llega con una opción real preseleccionada
  // (nunca el placeholder "Seleccionar Vendedor") — confirmado en vivo en
  // varias Órdenes de Caja distintas, cada una con un vendedor real distinto.
  DIALOG_PAGO_CHECK_CONTADO:        '#ck_is_payment_cash',
  DIALOG_PAGO_CHECK_CREDITO:        '#ck_is_payment_credit',
  DIALOG_PAGO_FECHA_VENCIMIENTO:    '#sale_end_date_content',
  DIALOG_PAGO_VENDEDOR_CHOSEN:      '#payment_agent_assigned_chosen',

  // ─── "Enviar a caja" / carrito: Exoneración ────────────────────────────────
  // Vive en la MISMA sección de detalle avanzado de totales que
  // DESCUENTO_GENERAL (clase compartida "advanced_invoice_detail", revelada
  // por mostrarDetalleAvanzadoFactura()) — confirmado en vivo volcando el DOM:
  // "Exoneración (%)" es una fila más del carrito, junto a Subtotal/Descuento/
  // Impuestos/Subsidio/Membresía, no un atributo automático de ningún cliente
  // en particular. Se aplica con el botón "Agregar" (abre el modal
  // #dialog_add_exoneration) y "Aplicar" — de los campos del modal, solo
  // "Número de documento", "Orden de Exoneración" (el único con
  // required="required" en el DOM real) y "Porcentaje de exoneración" están
  // visibles por defecto (el resto — tipo de documento, institución exonerada,
  // fecha de emisión — nace con display:none en este ambiente); confirmado en
  // vivo que completar esos 3 y presionar "Aplicar" sí actualiza
  // EXONERACION_PORCENTAJE_TOTAL/EXONERACION_MONTO_TOTAL y baja el total de la
  // venta, sin necesidad de tocar los campos ocultos.
  EXONERACION_BTN_AGREGAR:      '#set_apply_exoneration_modal',
  EXONERACION_BTN_CANCELAR:     '#set_cancel_exoneration',
  DIALOG_EXONERACION:           '#dialog_add_exoneration',
  EXONERACION_NUMERO_DOCUMENTO: '#payment_exoneration_number',
  EXONERACION_TEXTO_ORDEN:      '#apply_exoneration_text',
  EXONERACION_PORCENTAJE_INPUT: '#payment_exoneration_percent',
  EXONERACION_BTN_APLICAR:      '#apply_sale_exoneration',
  EXONERACION_PORCENTAJE_TOTAL: '#total_exoneration_percent',
  EXONERACION_MONTO_TOTAL:      '#total_exoneration_amount',

  // ─── "Orden de Ruteo" (mismo menú desplegable que Proforma/Apartado/Enviar a
  // caja, L.ORDEN_CAJA_MENU_BTN — confirmado en vivo, NO la pestaña superior
  // "Ruteo" de PESTANAS_POS_A_RECORRER: esa lista órdenes ya creadas, esta
  // sección crea una nueva) ───────────────────────────────────────────────────
  // El ítem del menú es <li id="btn_routingorder_footer" class="... btn_routingorder
  // ..." onclick="create_routing_order()">, confirmado en vivo inspeccionando
  // el menú #demo-menu-top-right ya desplegado. create_routing_order() (en
  // pos_routing.js, un archivo propio distinto de pos.js) valida que haya al
  // menos un producto en el carrito y abre el modal #dialog_add_routing_order.
  RUTEO_MENU_ITEM: '#btn_routingorder_footer',
  DIALOG_RUTEO:    '#dialog_add_routing_order',

  // Cliente, Forma 2 (buscador propio del modal) — confirmado en vivo que
  // usa su PROPIO input (#search_routing_customer_send_sale, no
  // #search_pos_customer_modal de Apartado ni #search_pos_customer_send_sale
  // de Enviar a caja) pero dispara el mismo AJAX compartido
  // (CLIENTE_AJAX_BUSQUEDA/getCustomerByPosOption): get_customer_by_pos_option()
  // en pos.js decide cuál input leer según cuál modal esté visible
  // ($('#dialog_add_routing_order').is(":visible")). Los resultados llenan un
  // <select> Chosen propio (#payment_send_routing_order_client), mismo patrón
  // que ORDEN_CAJA_CLIENTE_CHOSEN/APARTADO_CLIENTE_CHOSEN — confirmado en vivo
  // que SÍ reutiliza ese mismo patrón general (a diferencia de lo que
  // sugeriría asumir sin verificar), solo que con sus propios ids.
  RUTEO_CLIENTE_INPUT_BUSQUEDA: '#search_routing_customer_send_sale',
  RUTEO_CLIENTE_BTN_BUSCAR:     '#dialog_add_routing_order .search_parameter_addon',
  RUTEO_CLIENTE_CHOSEN:         '#payment_send_routing_order_client_chosen',

  // Ruta y Repartidor — ambos <select> Chosen obligatorios (confirm_send_routing_order()
  // en pos_routing.js rechaza el envío con un toast de advertencia si
  // cualquiera de los dos queda en su placeholder), poblados con catálogo
  // real y configurable por la empresa (rutas y usuarios reales de la
  // compañía, confirmado en vivo: nunca hardcodeados). Confirmado en vivo que
  // elegir una Ruta puede autocompletar el Repartidor con el primer
  // "dealer_list" asociado a esa ruta (set_agent_in_modal_routing_order()) —
  // pero solo si la ruta tiene repartidores propios asignados; en este
  // ambiente ambas rutas de prueba traen dealer_list vacío ("[]"), así que no
  // hay que depender de ese autocompletado y el Repartidor se selecciona
  // siempre de forma explícita.
  RUTEO_RUTA_CHOSEN:       '#send_routing_order_route_chosen',
  RUTEO_REPARTIDOR_CHOSEN: '#send_routing_order_agent_assigned_chosen',

  // Dirección — <select> Chosen OPCIONAL, poblado dinámicamente con las
  // direcciones registradas del cliente ya seleccionado (customer.client_address,
  // JSON propio del cliente) — confirmado en vivo que un cliente sin
  // direcciones registradas deja este <select> con únicamente su placeholder
  // "Seleccionar dirección" (ninguna opción real). A diferencia de
  // Subcategoría/Sub sección de "Crear Producto" (mismo caso "catálogo
  // dependiente que puede venir vacío"), aquí NO se puede reutilizar
  // _seleccionarPrimeraOpcionChosenSiHayOpciones() tal cual: confirmado en
  // vivo que su fallback (abrir el Chosen y presionar Escape cuando no hay
  // opciones) deja un <div class="modal-backdrop"> huérfano cubriendo TODO
  // el modal —incluido el campo de Observaciones, que queda permanentemente
  // no interactuable— en vez de cerrar el desplegable, algo que no ocurre en
  // los otros dos usos porque no viven dentro de un modal ya abierto. Por eso
  // seleccionarDireccionRuteoSiExiste() comprueba primero, sobre el <select>
  // real (RUTEO_DIRECCION_SELECT), si existe alguna opción real ANTES de
  // abrir el Chosen — así nunca necesita cancelarlo.
  RUTEO_DIRECCION_SELECT: '#send_routing_order_client_address',
  RUTEO_DIRECCION_CHOSEN: '#send_routing_order_client_address_chosen',

  RUTEO_OBSERVACION: '#send_routing_order_observation',
  RUTEO_BTN_ENVIAR:  '#send_routing_order',

  // Petición AJAX real que crea la Orden de Ruteo — confirmado en vivo
  // interceptando la red tras confirmar el SweetAlert de advertencia
  // ("¿Enviar órden a ruteo?"). Responde texto plano: el id numérico creado
  // (éxito) o "0" (fallo) — mismo contrato que AJAX_GUARDAR_APARTADO. No hay
  // impresión automática en este ambiente (setting_print_command en 0/ausente
  // — confirmado en vivo que no se abrió ningún popup tras crear la orden),
  // así que, a diferencia de Facturar/Cerrar Caja, no hay ninguna ventana de
  // impresión que esperar ni cerrar aquí.
  AJAX_GUARDAR_RUTEO: 'sendPosRoutingOrder',

  // ─── Listado de Órdenes de Ruteo YA CREADAS (pestaña superior "Ruteo",
  // #btn_routing_option de PESTANAS_POS_A_RECORRER — NO confundir con
  // RUTEO_MENU_ITEM/DIALOG_RUTEO de arriba, que crean una nueva) ─────────────
  // Confirmado en vivo volcando el DOM real de esta pestaña con órdenes reales
  // ya creadas: cada orden es una tarjeta '.routing_order_card' con id
  // `brand_<id>` (el MISMO <id> numérico que devuelve
  // guardarOrdenRuteoYObtenerRespuesta()/validarOrdenRuteoCreada()), con un
  // menú de acciones (ícono "more_vert", dropdown Bootstrap) cuyas opciones
  // reales son "Ver órden" (show_routing_order_detail(id)), "Editar órden"
  // (show_create_routing_order_modal(id) — reutiliza EL MISMO modal/ids que
  // crear una orden nueva: RUTEO_RUTA_CHOSEN/RUTEO_REPARTIDOR_CHOSEN/
  // RUTEO_DIRECCION_CHOSEN/RUTEO_OBSERVACION/RUTEO_BTN_ENVIAR, confirmado en
  // vivo con la MISMA petición AJAX_GUARDAR_RUTEO al guardar — pero SIN
  // bloque de cliente/vendedor/productos: esos no son editables desde esta
  // pantalla en este ambiente) y "Marcar como <ESTADO>"
  // (change_routing_order_status(id, código)). Códigos de estado confirmados
  // en vivo alternando el estado real de una orden: 1=Pendiente, 2=En camino,
  // 3=Entregado — el menú SOLO ofrece los códigos DISTINTOS al estado actual
  // (una orden recién creada, ya Pendiente, nunca se ofrece "Marcar como
  // PENDIENTE" a sí misma; ese ítem solo aparece una vez que ya está en otro
  // estado). Sin SweetAlert de confirmación para este cambio de estado
  // (confirmado en vivo: la petición se dispara directo al click).
  RUTEO_LISTA_TARJETA_PREFIJO: 'brand_',
  RUTEO_LISTA_BTN_MENU:        'button[data-toggle="dropdown"]',
  AJAX_CAMBIO_ESTADO_RUTEO:    'changeRoutingOrderDeliveredStatus',

  // Filtros REALES del listado "Ruteo" — confirmado en vivo (investigado a
  // fondo, corrigiendo una conclusión previa incorrecta de esta misma
  // suite que los daba por una simple leyenda decorativa): los 5 son
  // botones reales con id técnico estable y onclick propio. Relevante en
  // particular: una Orden de Ruteo que llega al estado Entregado +
  // Facturado se MUEVE de "Todos" a "H. de Órdenes" (confirmado en vivo
  // comparando el mismo id de orden en ambas vistas) — cualquier método que
  // localice una tarjeta por id debe considerar esto, ver
  // asegurarOrdenRuteoVisibleEnListado().
  FILTRO_RUTEO_TODOS:     '#filter_routing_order_btn_all',
  FILTRO_RUTEO_PENDIENTE: '#filter_routing_order_btn_pending',
  FILTRO_RUTEO_EN_CAMINO: '#filter_routing_order_btn_in_route',
  FILTRO_RUTEO_ENTREGADO: '#filter_routing_order_btn_delivered',
  FILTRO_RUTEO_HISTORIAL: '#filter_routing_order_btn_history_orders',

  // Botón "Seleccionar órden" (href="javascript:add_pos_routing_order_to_table(<id>);"),
  // confirmado en vivo (HONDURAS): es el ÚNICO mecanismo real para facturar
  // una Orden de Ruteo — el menú de acciones (RUTEO_LISTA_BTN_MENU) NUNCA
  // ofrece "Facturar" ni "Agregar Ítem" propios, solo Ver/Editar/Marcar
  // estado/Eliminar. Este botón vive en la propia tarjeta, fuera del
  // dropdown, dispara AJAX_CARGAR_RUTEO y carga la orden (productos +
  // cliente ya asociado) al carrito normal del POS — desde ahí aplica el
  // mismo flujo genérico ya usado por Órdenes de Caja/Importar Factura
  // (AGREGAR ITEMS, Facturar, etc.), sin necesitar nada propio de Ruteo.
  // Confirmado en vivo también que este botón DESAPARECE de la tarjeta una
  // vez la orden ya fue facturada (no permite seleccionarla de nuevo).
  RUTEO_LISTA_BTN_SELECCIONAR: '.routing_order_card_btn_select_order',
  AJAX_CARGAR_RUTEO:           'getPosRoutingOrderItemList',

  // Etiqueta "Factura: Pendiente/Facturado" de la propia tarjeta —
  // independiente del estado de envío (delivery-status-N/RUTEO_LISTA_TARJETA_PREFIJO):
  // una orden puede estar Entregada y seguir con la factura Pendiente, o
  // viceversa. Confirmado en vivo que cambia a "Facturado" apenas la venta
  // se completa, en el mismo momento en que RUTEO_LISTA_BTN_SELECCIONAR
  // desaparece de la tarjeta.
  RUTEO_LISTA_LBL_FACTURA: '.routing_order_card_lbl_delivery_billing span.pull-right',

  // ─── Menú "Acciones" del listado "Ruteo" (dropdown propio, distinto del
  // menú de tres puntos de cada tarjeta): agrupa selección múltiple + 3
  // acciones masivas + el reporte PDF de "Ruteo Sin Repartidor" — confirmado
  // en vivo volcando su HTML real. "Seleccionar" (RUTEO_MASIVO_LI_SELECCIONAR)
  // siempre está visible y, al hacer click, revela tanto el checkbox oculto
  // de cada tarjeta (dentro de `.select_checkbox_remove_order`, normalmente
  // `hide`) como los 3 <li> de acción masiva (Eliminar/Cambiar Repartidor/
  // Enviar a Ruteo), todos con clase `hide` hasta ese momento. Bootstrap
  // cierra este dropdown ante cualquier click fuera de él —incluido el click
  // sobre el propio checkbox de una tarjeta más abajo en la página—, así que
  // hay que reabrirlo (RUTEO_MASIVO_LI_SELECCIONAR es el ancla estable para
  // ubicar su botón `[data-toggle="dropdown"]`) antes de cada acción
  // siguiente, nunca asumir que sigue abierto.
  RUTEO_MASIVO_LI_SELECCIONAR:            'li[onclick="select_orders()"]',
  RUTEO_MASIVO_LI_ENVIAR:                 'li.send_orders_massive',
  RUTEO_MASIVO_LI_CAMBIAR_REPARTIDOR:     'li.change_seller_orders_option',
  RUTEO_MASIVO_LI_ELIMINAR:               'li.delete_orders_option',
  // Prefijo del id real de cada checkbox de tarjeta (`select_order_remove_<id>`,
  // MISMO id numérico que RUTEO_LISTA_TARJETA_PREFIJO) — confirmado en vivo
  // que, con cientos de órdenes en el listado, este checkbox suele quedar
  // "outside of viewport" para Playwright incluso tras `scrollIntoViewIfNeeded()`
  // (mismo síntoma ya documentado para los checkboxes de método de pago, ver
  // el comentario de `_cambiarMetodoPago()`): se marca vía `evaluate()`.
  RUTEO_MASIVO_CHECKBOX_PREFIJO:           'select_order_remove_',

  // "Seleccionar todos"/"Limpiar selección" — mismo dropdown "Acciones" que
  // RUTEO_MASIVO_LI_SELECCIONAR, confirmados en vivo volcando su HTML real
  // (ambos `<li class="hide ...">` hasta que "Seleccionar" los revela, igual
  // que Eliminar/Cambiar Repartidor/Enviar a Ruteo). "Seleccionar todos"
  // marca TODAS las tarjetas actualmente visibles bajo el filtro real
  // activo (no hay forma de acotarlo a un subconjunto propio) — confirmado
  // en vivo: 50/50 checkboxes quedaron marcados. "Limpiar selección" solo
  // desmarca (confirmado 0/50 tras usarlo); el modo selección en sí
  // permanece activo, no hay que reabrir "Seleccionar".
  RUTEO_MASIVO_LI_SELECCIONAR_TODOS:      'li[onclick="toggle_all_order_switches()"]',
  RUTEO_MASIVO_LI_LIMPIAR_SELECCION:      'li[onclick="clear_selected_orders_quick()"]',

  // Contadores reales del listado "Ruteo" (parte de #pos_routing_order_filter_content,
  // visible siempre, no solo en modo selección) — confirmados en vivo:
  // "Seleccionadas" refleja en tiempo real cuántas tarjetas están marcadas
  // (0 fuera de modo selección o tras Limpiar selección); "Faltantes"/"Total"
  // reflejan el total real de órdenes bajo el filtro/búsqueda activos —
  // ambos cambiaron de 246→222 al aplicar un filtro por Repartidor en la
  // investigación en vivo, confirmando que sí responden a filtros reales
  // (no solo a las tarjetas ya renderizadas/paginadas en el DOM).
  RUTEO_CONTADOR_SELECCIONADAS: '#orders_selected_count',
  RUTEO_CONTADOR_TOTAL:         '#orders_total_count',
  RUTEO_CONTADOR_FALTANTES:     '#orders_pending_count',

  // Filtros avanzados reales del listado "Ruteo" (Chosen, misma fila que
  // Ruta/Repartidor/Recurrencia, debajo de los 5 filtros de estado) —
  // confirmados en vivo volcando el HTML completo de
  // #pos_routing_order_filter_content. "Ruta" y "Repartidor" sí disparan un
  // filtrado real del listado (confirmado: el contador total bajó al
  // elegir un repartidor real). Provincia/Cantón/Distrito/Recurrencia/rango
  // de fechas viven detrás de "Opciones Avanzadas" (BTN_RUTEO_FILTROS_AVANZADOS,
  // oculto por defecto) — no se valida cada uno individualmente en esta
  // suite, solo se documenta su existencia.
  RUTEO_FILTRO_RUTA_CHOSEN:       '#filter_routing_order_route_select_chosen',
  RUTEO_FILTRO_REPARTIDOR_CHOSEN: '#filter_routing_order_agent_assigned_chosen',
  // <select> nativo detrás de cada Chosen — oculto (`display:none`, Chosen
  // pinta la UI real), pero Playwright.selectOption() no requiere
  // visibilidad y sí dispara el evento `change` real que restaura el
  // filtro a su placeholder ("Seleccionar ruta"/"Seleccionar Repartidor").
  RUTEO_FILTRO_RUTA_SELECT:       '#filter_routing_order_route_select',
  RUTEO_FILTRO_REPARTIDOR_SELECT: '#filter_routing_order_agent_assigned',
  BTN_RUTEO_FILTROS_AVANZADOS:    '#btn_toggle_advanced_filters',

  // Buscador real del listado "Ruteo" — confirmado en vivo (NO es una
  // suposición): es el MISMO input `#product_search` que en "POS
  // Facturación" busca productos (placeholder " Buscar...."), reutilizado
  // dinámicamente por la propia app según la pestaña activa — con "Ruteo"
  // activo dispara `getSearchRoutingOrders` (confirmado interceptando la
  // red) en vez de la búsqueda de productos. Mismo criterio ya documentado
  // para `recepcion.page.ts`: dispara la búsqueda con la tecla Enter
  // (`fill()` por sí solo, evento `input`, NO la activa — confirmado en
  // vivo, timeout esperando la respuesta sin el `press('Enter')`).
  // Confirmado en vivo qué criterios realmente filtran: por CLIENTE
  // (ej. "CITA DE PRUEBA") sí devuelve resultados; por número de orden
  // VISIBLE ("Orden #262") y por nombre de Ruta, no — el buscador parece
  // limitarse a datos del cliente (nombre/correo/teléfono/dirección), no al
  // consecutivo de la orden ni a metadatos de ruta.
  RUTEO_BUSCADOR: '#product_search',
  AJAX_BUSCAR_RUTEO: 'getSearchRoutingOrders',

  // "Enviar a Ruteo" y "Cambiar Repartidor" masivos reutilizan EL MISMO modal
  // (`#modal_change_sellers`, solo cambia su `data-mode`/título/endpoint según
  // cuál de los dos `<li>` lo abrió) — confirmado en vivo volcando su HTML
  // completo en ambos modos: mismo `<select>` de repartidor
  // (RUTEO_MASIVO_MODAL_REPARTIDOR_CHOSEN) y mismo botón "Guardar"
  // (RUTEO_MASIVO_MODAL_BTN_GUARDAR). Investigado en vivo (root-cause real,
  // no asumido) que ambas acciones NO hacen lo mismo bajo el capó pese a
  // compartir modal:
  //   - "Enviar a Ruteo" (AJAX_ENVIAR_RUTEO_MASIVO) NO reasigna la orden
  //     seleccionada in-place: crea una orden NUEVA con el repartidor
  //     elegido (responde un array JSON `[{old_order_id, new_order_id,
  //     order_number, items_created}]`). Confirmado en vivo (2 corridas
  //     independientes con resultados distintos: la primera —un script de
  //     investigación descartado— pareció mostrar que la orden ORIGINAL
  //     desaparecía del listado, pero la segunda, ya con las esperas reales
  //     de esta clase, la mostró intacta, seleccionable y con su repartidor
  //     sin cambios) que el comportamiento real y reproducible es una
  //     DUPLICACIÓN: la orden original permanece igual y se crea una nueva
  //     (`new_order_id`) con el repartidor elegido — no un reemplazo.
  //   - "Cambiar Repartidor" (AJAX_CAMBIAR_REPARTIDOR_MASIVO) reasigna
  //     in-place (la orden conserva su id) — confirmado en vivo el payload
  //     real (`order_list=["<id>"]&new_agent_id=<id>`) contra una orden
  //     propia recién creada: responde "1" (éxito) y el repartidor persiste
  //     al reabrir "Ver Orden". Investigado a fondo (root-cause real, no
  //     asumido) un fallo intermitente ("0") que apareció 2 veces usando
  //     obtenerPrimeraOrdenRuteoSeleccionable(): desapareció por completo
  //     repitiendo el MISMO payload contra una orden propia — la causa no es
  //     el endpoint, sino que "la primera orden seleccionable" de este
  //     listado compartido (fullyParallel, ~200+ órdenes reutilizadas por
  //     el resto de esta suite) puede arrastrar estado atípico de otra
  //     prueba en curso. Por eso el escenario que lo valida en
  //     pos-ruteo.spec.ts crea su propia orden desechable en vez de
  //     reutilizar una existente (mismo criterio que el Escenario 30).
  RUTEO_MASIVO_MODAL:                     '#modal_change_sellers',
  RUTEO_MASIVO_MODAL_REPARTIDOR_CHOSEN:   '#modal_new_agent_select_chosen',
  RUTEO_MASIVO_MODAL_BTN_GUARDAR:         '#btn_confirm_change_sellers',
  AJAX_ENVIAR_RUTEO_MASIVO:               'createRoutingOrdersMassive',
  AJAX_CAMBIAR_REPARTIDOR_MASIVO:         'changeSellerOrderRouting',
  AJAX_ELIMINAR_RUTEO_MASIVO:             'deleteRoutingOrders',

  // Switch "Facturar Automáticamente" (checkbox-slider, mismo patrón que el
  // resto de checkboxes de esta suite — ver _asegurarCheckboxEstado()) dentro
  // del mismo modal `#modal_change_sellers` de "Enviar a Ruteo". Investigado
  // en vivo volcando el HTML real del modal: la sección "Ruta"
  // (`.modal-route-section`) existe en el DOM pero queda `display:none` en
  // este ambiente/compañía — no hay ningún campo de Ruta realmente visible
  // que completar en este flujo, así que ningún método interactúa con ella.
  //
  // Confirmado en vivo (root-cause real, no asumido) que activar este switch
  // abre un modal de progreso SEPARADO (RUTEO_PROGRESO_FACTURACION_DIALOG,
  // `#dialog_progress_invoicing`, ya existente en el DOM antes de abrir
  // "Enviar a Ruteo" pero oculto) tras guardar — nunca aparece si el switch
  // queda desactivado (confirmado: los Escenarios 28/29 de "Enviar a
  // Ruteo"/"Cambiar Repartidor" sin este switch nunca lo disparan). La barra
  // de progreso real (RUTEO_PROGRESO_FACTURACION_LABEL, `#progress-label`)
  // llega a "100%" en unos pocos segundos (2 órdenes: ~6-10s en vivo) pero el
  // modal NO se autocierra: expone un botón real "Aceptar y cerrar"
  // (RUTEO_PROGRESO_FACTURACION_BTN_CERRAR, `#close-progress-modal`,
  // `onclick="clearModalOfProgress()"`) que hay que clickear explícitamente
  // — comportamiento intencional del propio modal (confirmación de
  // resultados), no un cuelgue de la aplicación.
  RUTEO_MASIVO_MODAL_CHECK_FACTURAR_AUTO: '#ck_auto_invoice_orders',
  RUTEO_PROGRESO_FACTURACION_DIALOG:      '#dialog_progress_invoicing',
  RUTEO_PROGRESO_FACTURACION_LABEL:       '#progress-label',
  RUTEO_PROGRESO_FACTURACION_BTN_CERRAR:  '#close-progress-modal',

  // Panel informativo del propio modal "Enviar a Ruteo" masivo (contadores +
  // repartidores actuales de las órdenes marcadas) — confirmado en vivo,
  // mismo volcado de HTML que el resto de constantes RUTEO_MASIVO_MODAL_*.
  RUTEO_MASIVO_MODAL_LBL_SELECCIONADAS: '#modal_selected_orders',
  RUTEO_MASIVO_MODAL_LBL_FALTANTES:     '#modal_pending_orders',
  RUTEO_MASIVO_MODAL_LBL_TOTAL:         '#modal_total_orders',
  RUTEO_MASIVO_MODAL_LISTA_REPARTIDORES: '#modal_current_sellers_list > div',

  // "Imprimir"/"Descargar PDF" del mismo menú "Acciones" — confirmado en vivo
  // que AMBOS invocan la misma función `printReportRoutingPDF()` (solo cambia
  // `data-mode`, 0=Imprimir/1=Descargar PDF) y que el documento generado es
  // SIEMPRE el mismo reporte fijo "Reporte de Ruteo Sin Repartidor"
  // (nombre sugerido de descarga: `Reporte_Ruteo_SinRepartidor_<fecha>.pdf`),
  // sin importar cuál de los 5 filtros reales (FILTRO_RUTEO_*) esté activo en
  // ese momento — confirmado descargándolo en dos filtros distintos
  // (Pendiente/Entregado) y comparando el mismo nombre de archivo resultante.
  // No es, entonces, un documento "por tab" como en Imprimir/Descargar PDF de
  // Gestión de Proforma (GESTION_PROFORMA_BTN_IMPRIMIR/_PDF): es un reporte
  // de alcance global (órdenes sin repartidor asignado), independiente del
  // filtro. CORRECCIÓN (confirmado en vivo, invalida una hipótesis previa de
  // este mismo comentario): "Imprimir" (data-mode=0) SÍ genera el reporte —
  // comparado byte a byte contra el PDF de "Descargar PDF": mismo tamaño
  // exacto (1,454,657 bytes en la corrida de investigación), solo difieren
  // ~60 bytes al final del archivo (metadata/timestamp interno del PDF, no
  // contenido visible). La hipótesis de "no abre ninguna ventana" surgía de
  // escuchar únicamente el evento `popup`: Chromium headless intercepta la
  // respuesta PDF que el botón intenta abrir en una ventana nueva y la
  // entrega como evento `download` (nombre de archivo aleatorio tipo UUID,
  // p. ej. `a64fd416-958f-4873-99d9-e6cc7703f356.pdf`, sin el nombre
  // descriptivo `Reporte_Ruteo_SinRepartidor_<fecha>.pdf` de "Descargar
  // PDF") en vez de un `popup` — ver imprimirReporteRuteoPDF().
  RUTEO_REPORTE_LI_IMPRIMIR:      'a[onclick="printReportRoutingPDF()"][data-mode="0"]',
  RUTEO_REPORTE_LI_DESCARGAR_PDF: 'a[onclick="printReportRoutingPDF()"][data-mode="1"]',

  // Modal "Ver Orden" (#dialog_view_routing_order_detail) — confirmado en
  // vivo, de solo lectura y distinto del de creación/edición. No incluye un
  // campo de "Vendedor" separado (solo "Repartidor") ni etiqueta explícita de
  // moneda/estado/fecha: esos solo se reflejan en la propia tarjeta del
  // listado (fecha) o se infieren del símbolo en los montos (moneda).
  DIALOG_VER_ORDEN_RUTEO:      '#dialog_view_routing_order_detail',
  VER_RUTEO_NUMERO:            '#dvrod_lbl_order_number',
  VER_RUTEO_REPARTIDOR:        '#dvrod_lbl_delivery_person_name',
  VER_RUTEO_CLIENTE_NOMBRE:    '#dvrod_lbl_client_name',
  VER_RUTEO_CLIENTE_DIRECCION: '#dvrod_lbl_client_address',
  VER_RUTEO_OBSERVACION:       '#dvrod_lbl_order_observation',
  VER_RUTEO_FILAS_PRODUCTO:    '#dvrod_product_table tr',
  VER_RUTEO_SUBTOTAL:          '#dvrod_lbl_subtotal',
  VER_RUTEO_DESCUENTO:         '#dvrod_lbl_total_discount',
  VER_RUTEO_IMPUESTO:          '#dvrod_lbl_total_tax',
  VER_RUTEO_TOTAL:             '#dvrod_lbl_total',

  // Panel de detalle avanzado de totales (subtotal / descuento general /
  // impuestos) — oculto por defecto (showBillDetail()); se expande con un
  // click en el propio bloque "Total:". El campo de porcentaje de descuento
  // general (DESCUENTO_GENERAL_PORCENTAJE) vive ahí adentro — confirmado en
  // vivo que sin expandir este panel el campo no es interactuable.
  TOTAL_FACTURA_TOGGLE:         '.content-total-bill',
  DESCUENTO_GENERAL_PORCENTAJE: '#total_discount_input',
  DESCUENTO_GENERAL_MONTO:      '#total_discount',

  // ─── "Crear Proforma" (mismo menú que "Enviar a caja", L.ORDEN_CAJA_MENU_BTN) ──
  // Confirmado en vivo (Fase 1): el ítem no tiene id propio (a diferencia de
  // "Enviar a caja"), solo la clase .btn_proform, onclick="create_proform()".
  PROFORMA_MENU_ITEM: '.btn_proform',
  DIALOG_PROFORMA:    '#dialog_proform',

  // Las 3 tarjetas de "Tipo de Documento" son mutuamente excluyentes por
  // comportamiento propio de la app (confirmado en vivo: clickear una
  // desmarca las otras dos). Cada tarjeta envuelve un checkbox oculto —
  // ese checkbox, no la clase CSS de la tarjeta, es la fuente real del
  // estado (ver seleccionarTipoProforma()).
  PROFORMA_CARD_NORMAL:         '#card_proforma',
  PROFORMA_CHECK_NORMAL:        '#ck_is_proform__invoice',
  PROFORMA_CARD_CONSIGNACION:   '#card_consignment',
  PROFORMA_CHECK_CONSIGNACION:  '#ck_is_consignment_invoice',
  PROFORMA_CARD_TALLER:         '#card_workshop',
  PROFORMA_CHECK_TALLER:        '#ck_is_workshop_proform',

  // Único campo de cliente del modal: texto libre (NO es un select pese al
  // id) — confirmado en vivo que seleccionar un cliente arriba del carrito
  // (seleccionarClienteExistente()) sincroniza este mismo campo.
  PROFORMA_CLIENTE_INPUT:   '#customer_proform_select',
  PROFORMA_VENDEDOR_CHOSEN: '#select_payment_agent_assigned_chosen',
  PROFORMA_BTN_GUARDAR:     '#make_proform',

  // Petición AJAX real que guarda la Proforma (confirmado en vivo
  // interceptando la red tras confirmar el SweetAlert de advertencia).
  AJAX_GUARDAR_PROFORMA: 'addPosProductProform',

  // ─── Modal "Gestión de Proforma" (aparece automáticamente tras guardar) ────
  DIALOG_GESTION_PROFORMA:         '#modal_pos_proform_result',
  GESTION_PROFORMA_BTN_IMPRIMIR:   '#print_btn_pos',
  GESTION_PROFORMA_BTN_PDF:        '#pos_proform_result_pdf_btn',
  GESTION_PROFORMA_BTN_VER_TODAS:  '#pos_proform_result_view_all_btn',
  GESTION_PROFORMA_BTN_CORREO:     '#pos_proform_result_email_btn',

  // Confirmado en vivo (Fase 1): responde texto plano "1" (éxito) / "0"
  // (fallo) — no JSON. Solo responde éxito si la Proforma se creó con un
  // cliente existente (con nombre libre responde "0" y el sistema muestra
  // el toast "Error al enviar proforma!").
  AJAX_ENVIAR_PROFORMA_CORREO: 'sendProformByEmail',

  // ─── "Generar Apartado" (mismo menú que "Enviar a caja"/Proforma, L.ORDEN_CAJA_MENU_BTN) ──
  // Confirmado en vivo (Fase 1 + investigación de Riesgo #1): a diferencia de
  // Proforma/Enviar a caja, "Generar Apartado" NO abre un modal propio — reutiliza
  // el mismo modal de pago normal (#dialog_payment), alternando cuál botón de
  // confirmación queda visible (#make_layaway en vez de #make_payment). Por eso
  // no existe un DIALOG_APARTADO propio: el botón #make_layaway es la única señal
  // confiable de que el modal quedó en modo Apartado.
  APARTADO_MENU_ITEM:  'li.btn_layaway_sale',
  APARTADO_BTN_GENERAR: '#make_layaway',

  // Búsqueda de cliente DENTRO del modal de pago (Forma 2) — confirmado en vivo
  // que es un input propio (#search_pos_customer_modal), distinto al de arriba
  // del carrito (CLIENTE_INPUT_BUSQUEDA), que dispara el mismo AJAX
  // (CLIENTE_AJAX_BUSQUEDA). A diferencia de lo que sugería una primera lectura
  // del código (que apuntaba a las tarjetas .customer-list-pos compartidas con
  // Forma 1): esas tarjetas SÍ se renderizan pero quedan anidadas dentro de un
  // contenedor que permanece display:none mientras el modal está abierto
  // (confirmado en vivo inspeccionando todo el árbol del DOM) — no son lo que
  // el usuario ve ni puede clickear. El control real y VISIBLE es un Chosen
  // (#payment_credit_client_chosen) — mismo patrón que
  // ORDEN_CAJA_CLIENTE_CHOSEN. Confirmado en vivo que elegir una opción ahí sí
  // sincroniza #customer_select (el campo que add_layaway() realmente lee),
  // pese a no tener un handler .change() explícito localizado en pos.js.
  APARTADO_CLIENTE_INPUT_BUSQUEDA: '#search_pos_customer_modal',
  APARTADO_CLIENTE_BTN_BUSCAR:     '.modal_search_customer_a .search_parameter_addon',
  APARTADO_CLIENTE_CHOSEN:         '#payment_credit_client_chosen',

  // Petición AJAX real que crea el Apartado (confirmado en vivo interceptando
  // la red tras confirmar el SweetAlert de advertencia "¿Está seguro de
  // realizar este Apartado?"). Responde texto plano: el id numérico creado
  // (éxito) o "0"/vacío (fallo) — mismo contrato que el resto de la suite.
  AJAX_GUARDAR_APARTADO: 'addPosLayaway',

  // ─── Apartado YA EXISTENTE: listado, carga y "Abonar" ───────────────────────
  // Confirmado en vivo volcando el DOM completo de la pestaña "Apartados": cada
  // tarjeta reutiliza EXACTAMENTE las mismas clases que Órdenes de Caja/
  // Importar Factura (.pos_order_list_item_content / .rest_chev_right — ver
  // L.IMPORTAR_FACTURA_FILA/L.ORDEN_CAJA_LISTA_BTN_CARGAR, reutilizados tal
  // cual, sin duplicar el selector), solo que el click dispara un AJAX propio
  // (AJAX_CARGAR_APARTADO, no AJAX_CARGAR_ORDEN_CAJA). Igual que Órdenes de
  // Caja, esta pestaña NO tiene ningún campo de búsqueda propio (confirmado en
  // vivo: cero inputs de texto/tipo search en todo el contenedor y en el resto
  // de la página estando esta pestaña activa).
  AJAX_CARGAR_APARTADO: 'getPosLayawayOrderItemList',
  APARTADO_TARJETA_NUMERO: '[id^="pos_layaway_invoice_client_number_hide_"]',

  // Búsqueda real de Apartados vía el input de header #product_search (mismo
  // patrón que AJAX_BUSCAR_ORDEN_CAJA/getPosCashSearch) — confirmado en vivo
  // interceptando la red, ver el comentario de buscarApartadosPorTexto().
  AJAX_BUSCAR_APARTADO: 'getPosLayawaySearch',

  // "Abonar" (Realizar Abono sobre un Apartado YA CARGADO al carrito) — mismo
  // menú desplegable junto a "Facturar" que "Generar Apartado"/"Enviar a
  // caja" (L.ORDEN_CAJA_MENU_BTN), confirmado en vivo: su <li> no tiene id
  // propio (a diferencia de "Enviar a caja"), se localiza por su clase
  // "btn_layaway_payment" — mismo criterio que APARTADO_MENU_ITEM
  // (localizado por clase, "btn_layaway_sale"). Reutiliza también el modal de
  // pago normal (#dialog_payment), esta vez mostrando #make_layaway_payment.
  // Confirmado en vivo que el carrito NO se vacía tras aplicar un abono (a
  // diferencia de crear un Apartado o Facturar): el Apartado sigue pendiente,
  // solo se registra el pago parcial — por eso no hay un validarAbonoAplicado()
  // que revise el carrito vacío, a diferencia de validarApartadoCreado().
  ABONO_MENU_ITEM:    'li.btn_layaway_payment',
  ABONO_BTN_REALIZAR: '#make_layaway_payment',
  AJAX_APLICAR_ABONO: 'addPosLayawayPayment',

  // "Saldo Actual": fila propia del footer principal del POS (misma fila
  // .total_div que Subtotal/IVA/Total) que SOLO aparece cuando hay un
  // Apartado con abono ya cargado en el carrito — confirmado en vivo volcando
  // el DOM real tras reabrir un Apartado. Es un elemento DISTINTO de
  // L.TOTAL_MODAL (`total_sale_txt`, el total del modal de pago, que no
  // refleja el saldo restante fuera de ese modal) y de L.TOTAL_VISIBLE_POS
  // (`#total`, el total bruto del carrito, no el saldo tras abonos). Se
  // confirmó en vivo que muestra el valor correcto de inmediato al reabrir el
  // Apartado (p. ej. "₡480,103.94"), sin la intermitencia que sí afecta a
  // L.TOTAL_MODAL en este mismo escenario.
  TOTAL_LAYAWAY_SALDO_ACTUAL: '#total_layaway_current_balance',

  // ─── "Importar Factura" ─────────────────────────────────────────────────────
  // A diferencia de Proforma/Apartado/Enviar a caja (ítems del menú desplegable
  // junto a "Facturar"), "Importar Factura" es la pestaña superior con id
  // técnico estable #btn_import_invoice_option, ya registrada en
  // PESTANAS_POS_A_RECORRER — confirmado en vivo que visitarPestanaPos() la
  // abre sin cambios. Selectores confirmados en vivo, no por lectura de código:
  // cada factura es una tarjeta .pos_order_list_item_content (mismo patrón que
  // .brand-card de otras listas) cuyo click dispara getPosSaleReceipView y abre
  // el modal de detalle; ese modal expone un único botón .import-button
  // (onclick="add_pos_invoice_import_to_table(...)") que dispara
  // getPosImportInvoiceItemList y reemplaza #table_buy_list con las líneas de
  // la factura. Confirmado en vivo que esas líneas NO usan el id
  // "drag_and_drop_" que sí usa el resto de la suite (CARRITO_CLAVES/
  // obtenerClavesProductos): hay que contarlas por tr.main_row.
  IMPORTAR_FACTURA_FILA:            '.pos_order_list_item_content',
  AJAX_DETALLE_IMPORTAR_FACTURA:    'getPosSaleReceipView',
  IMPORTAR_FACTURA_BTN_IMPORTAR:    '.import-button',
  AJAX_IMPORTAR_FACTURA:            'getPosImportInvoiceItemList',

  // Botón "AGREGAR ITEMS" (#add_btn_items), visible junto al carrito únicamente
  // después de importar una factura — confirmado en vivo que no existe antes de
  // importar. Es infraestructura GENÉRICA del POS (pos.js la reutiliza también
  // para Taller/Proforma/Enviar a caja/Ruteo, decidido por
  // #product_hide_item_from_id), no exclusiva de "Importar Factura", pero esta
  // suite solo la ejerce desde este flujo. El click abre el catálogo normal
  // (Productos/Servicios) dejando el tab "Productos" activo por defecto y
  // sustituye este botón por "Volver" (#hide_btn_items) en el mismo lugar de la
  // interfaz — confirmado en vivo que "Volver" regresa a la pestaña de origen
  // (aquí, "Importar factura") conservando TODAS las líneas del carrito, tanto
  // las importadas (sin id "drag_and_drop_") como las agregadas manualmente
  // desde el catálogo (con ese id).
  IMPORTAR_FACTURA_BTN_AGREGAR_ITEM: '#add_btn_items',
  IMPORTAR_FACTURA_BTN_VOLVER:       '#hide_btn_items',
  IMPORTAR_FACTURA_CARRITO_FILAS:   '#table_buy_list tr.main_row',

  // Búsqueda real de "Importar Factura" vía el input de header #product_search
  // (mismo patrón ya confirmado para Apartados/Órdenes de Caja) — confirmado
  // en vivo interceptando la red: mientras esta pestaña está activa dispara
  // `getPosSaleReceipList` con `search=<texto>` y `import_invoice_state`
  // (mismo parámetro que usan los botones de filtro de estado, ver
  // IMPORTAR_FACTURA_ESTADO_BOTON).
  AJAX_BUSCAR_IMPORTAR_FACTURA: 'getPosSaleReceipList',

  // Botones de filtro de estado del documento electrónico, confirmados en
  // vivo (volcando el DOM real de la pestaña): 5 en total, cada uno dispara
  // AJAX_BUSCAR_IMPORTAR_FACTURA con un `import_invoice_state` distinto.
  IMPORTAR_FACTURA_ESTADO_BOTON: {
    todos:      '#btn_import_invoice_state_all',
    aceptado:   '#btn_import_invoice_state_accepted',
    rechazado:  '#btn_import_invoice_state_rejected',
    reenviar:   '#btn_import_invoice_state_resend',
    noAplica:   '#btn_import_invoice_state_not_apply',
  } as const,

  // ─── Pestaña "Órdenes de caja" (seleccionar una Orden de Caja ya existente,
  // creada previamente con "Enviar a caja") ──────────────────────────────────
  // A diferencia de "Importar Factura" (click en toda la tarjeta abre un modal
  // de detalle con un botón "IMPORTAR" aparte), aquí el click real está
  // acotado a un ícono anidado DENTRO de la tarjeta — confirmado en vivo
  // inspeccionando el DOM: la tarjeta en sí (.pos_order_list_item_content,
  // MISMA clase que IMPORTAR_FACTURA_FILA — reutilizada tal cual, es genérica
  // entre pestañas de listado) no tiene onclick propio; el que sí lo tiene es
  // un <div class="... rest_chev_right" onclick="add_pos_order_to_table(...)">
  // anidado. Carga DIRECTO al carrito sin ningún modal de detalle ni botón de
  // confirmación aparte (a diferencia de Importar Factura).
  ORDEN_CAJA_LISTA_BTN_CARGAR: '.rest_chev_right',
  AJAX_CARGAR_ORDEN_CAJA:      'getPosCashItemList',
  // AJAX real disparado por #product_search (L.PRODUCTO_BUSCADOR_GRID) al
  // presionar Enter mientras la pestaña "Órdenes de caja" está activa — ver
  // buscarOrdenesCajaPorTexto().
  AJAX_BUSCAR_ORDEN_CAJA:      'getPosCashSearch',

  // ─── Moneda (header principal del POS, fuera de cualquier modal) ───────────
  // Mismo tipo de botón MDL que el resto de menús del POS (#menu_cash,
  // #demo-menu-top-right) — confirmado en vivo que overlays conocidos
  // (notificaciones, toasts) y un tooltip propio del botón ("powerTip")
  // interceptan el click de forma intermitente, igual que en esos otros
  // menús — ver _seleccionarOpcionMoneda().
  MENU_MONEDA_BTN:  '#menu_type_currency',
  MENU_MONEDA_ITEM: 'ul[for="menu_type_currency"] li',

  // Confirmado en vivo que se dispara automáticamente al cargar el POS y de
  // nuevo cada vez que se cambia de moneda; su respuesta incluye
  // currency_base_symbol, que se mantiene fijo sin importar cuál moneda
  // esté activa — la única fuente confiable para no asumir la moneda base
  // (nunca CRC ni Lempira por defecto).
  AJAX_CAMBIO_MONEDA: 'setTypeCurrencyReceipByUser',

  // Precio VISIBLE de un producto en el grid (cambia con la moneda activa) —
  // confirmado en vivo que es distinto del valor crudo oculto
  // (#original_price_product_stock_<id>.hide), que se mantiene constante sin
  // importar la moneda. Es hermano de L.PRODUCTO (.product_box_name) dentro
  // de la misma card .product_box, no un descendiente directo.
  PRODUCTO_PRECIO_VISIBLE: '.product_box_price',

  // ─── Vista Expandida / Vista Normal (menú de tres puntos del carrito) ──────
  // "Expandir/Encoger" vive en el mismo menú MDL ya reutilizado por
  // abrirMenuTresPuntos() (#demo-menu-lower-left). Confirmado en vivo que su
  // efecto real es: L.PRODUCT_CONTENT gana/pierde la clase "hide" (oculta
  // también el buscador de la grilla, que vive dentro), la tabla del carrito
  // cambia de ancho (col-lg-4 → col-lg-12), y dispara AJAX_VISTA_COMPRIMIDA
  // real, persistido por usuario en el servidor (mismo patrón que la moneda).
  SWITCH_COMPRESS:        '#switch_compress',
  PRODUCT_CONTENT:        '#product_content',
  AJAX_VISTA_COMPRIMIDA:  'setContentCompressState',

  // Buscador interno que solo es visible/interactuable con Vista Expandida
  // activa (vive arriba del carrito, dentro de #content_search_parameter).
  // Confirmado en vivo (código fuente pos_barcode.js) que NO es el mismo
  // autocomplete del buscador de la grilla: dispara un endpoint distinto
  // (AJAX_BUSCADOR_INTERNO) y filtra por código de producto, no por nombre.
  // Con un único resultado coincidente, la propia app lo autoselecciona y
  // agrega al carrito llamando a la misma función add_to_table() que usa el
  // click normal de la grilla — confirmado end-to-end en vivo.
  BUSCADOR_INTERNO_VISTA_EXPANDIDA: '#search_product_parameter',
  AJAX_BUSCADOR_INTERNO:            'get_pos_product_search_item',

  // Código interno del producto, oculto (class="hide") dentro de la misma
  // card del grid — necesario porque el buscador interno de Vista Expandida
  // filtra por código, no por nombre (confirmado en vivo).
  PRODUCTO_CODIGO_OCULTO: 'input[id^="input_hide_product_code_"]',

  // ─── Vaciar Carrito ─────────────────────────────────────────────────────────
  // Botón junto a "Facturar" (mismo contenedor .btn-container), título real
  // "Borrar los productos asignados", atajo (ctrl+x). Confirmado en vivo que
  // abre el mismo patrón de SweetAlert v1 ya centralizado en
  // _confirmarSweetAlertV1() y que la limpieza es puramente client-side: no
  // dispara ningún AJAX (confirmado interceptando la red completa).
  BTN_VACIAR_CARRITO: '#cancel_sale',

  // Total visible en el footer principal del POS (NO el modal de pago, ver
  // L.TOTAL_MODAL, ni el total de una sola línea). Confirmado en vivo que
  // vuelve a "$0.00" tras vaciar el carrito.
  TOTAL_VISIBLE_POS: '#total',
} as const;
