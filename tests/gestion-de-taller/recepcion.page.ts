import { expect, Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';
import { espiarErroresJS, esperarQuedaActivo } from '../pos/pos.page';

// espiarErroresJS/esperarQuedaActivo se reexportan tal cual desde pos.page.ts
// (funciones independientes, no atadas a PosPage — no dependen de `this`,
// solo reciben un Page o un predicado) en vez de duplicarlas: son el único
// lugar del proyecto donde existen hoy.
export { espiarErroresJS, esperarQuedaActivo };

// ─── URL ──────────────────────────────────────────────────────────────────────

export const RECEPCION_VEHICULAR_URL =
  BASE_URL + '/vehicularReception/vehicularQuickReception';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:     60_000,
  // Test más largo: el flujo de "Configurar Tablero" implica varios ciclos
  // guardar+refrescar y dos recargas completas del módulo para validar
  // persistencia — confirmado en vivo que cada ciclo puede tomar bastante
  // más que el resto de tests de este archivo.
  TEST_CONFIG_TABLERO: 180_000,
  // El test de búsqueda recorre 2 tabs (Tablero y Órdenes) x 4 pasos de
  // búsqueda cada uno, y varios de esos pasos individuales ya pueden tomar
  // hasta CARGA_LISTADO_COMPLETO (30s) bajo carga del ambiente compartido —
  // el timeout general por defecto (TEST, 60s) no alcanza a cubrir ese peor
  // caso acumulado y terminaba truncando un paso interno que todavía tenía
  // margen propio.
  TEST_BUSQUEDA: 180_000,
  // El flujo de Orden sencilla recorre los ~13 pasos del wizard completo
  // (cliente, vehículo, 4 tipos de ítems del carrito, partes, fotos, daños,
  // observaciones, firma y generar) — muchos más pasos que cualquier otro
  // test de este archivo.
  TEST_ORDEN_SENCILLA: 180_000,
  // Orden completa: todo lo de Orden sencilla, más completar cada campo de
  // Detalles del vehículo, Inspección con paquetes (incluyendo requiere
  // reemplazo + los 3 tipos de producto + aprobado), Enderezado y Pintura, y
  // Abonos — más pasos e interacciones que Orden sencilla.
  TEST_ORDEN_COMPLETA: 300_000,
  // "Configurar Pasos de la Recepción": activa/desactiva los 13 pasos para
  // Administrador (26 toggles), guarda dos veces, y crea DOS recepciones
  // completas (una por cada guardado) para verificar el efecto real en el
  // wizard — más pasos acumulados que Orden completa.
  TEST_CONFIGURAR_PASOS: 300_000,
  NAVIGATE: 60_000,
  // Cada tab/búsqueda popula su contenido vía AJAX — se hace polling hasta
  // este límite antes de leer su estado, nunca una pausa fija.
  CARGA:    15_000,
  // El modal "Configurar Tablero" muestra un toast de confirmación y se
  // cierra solo tras guardar, pero no de inmediato (confirmado en vivo:
  // puede tardar varios segundos en el ambiente compartido) — mayor que
  // CARGA para no acoplar este caso puntual al límite general.
  GUARDAR_CONFIG_TABLERO: 30_000,
  // "Configurar Pasos de la Recepción"/"Ajustes Generales": confirmado en
  // vivo que el cierre del modal tras "Guardar" puede tardar más de 30s bajo
  // carga del ambiente compartido (con o sin el SweetAlert de confirmación
  // de por medio, que además no aparece de forma consistente) — timeout
  // propio en vez de acoplarlo a GUARDAR_CONFIG_TABLERO.
  GUARDAR_MATRIZ_PERMISOS: 60_000,
  // Cualquier operación del buscador de Tablero (buscar o limpiar) dispara
  // varias peticiones AJAX encadenadas por columna de estado (confirmado en
  // vivo) — bajo carga del ambiente compartido puede superar el límite
  // general de CARGA; restaurar el listado SIN filtro es además la más
  // pesada de todas, al recargar TODAS las tarjetas (varias decenas en este
  // ambiente) en vez de solo el subconjunto filtrado.
  CARGA_LISTADO_COMPLETO: 30_000,
  // Caso puntual más pesado que CARGA_LISTADO_COMPLETO: restaurar el listado
  // de Tablero sin filtro recarga TODAS las columnas de estado a la vez
  // (confirmado en vivo con la suite completa corriendo a ~12 min en el
  // ambiente compartido, muy por encima de lo habitual) — un timeout propio
  // evita acoplar este caso extremo al límite general que usan el resto de
  // pasos de búsqueda, más livianos.
  CARGA_LISTADO_RESTAURAR: 45_000,
  // Sondeo cuyo propio callback hace una recarga COMPLETA de página en cada
  // intento (p. ej. verificar que "Desactivar orden" ya se procesó del lado
  // servidor): confirmado en vivo que el procesamiento no es instantáneo, y
  // cada intento del sondeo ya es costoso por sí mismo (navegación real, no
  // una simple relectura del DOM) — presupuesto propio y mayor para permitir
  // varios intentos reales bajo carga del ambiente compartido.
  POLL_CON_RECARGA_COMPLETA: 90_000,
} as const;

// ─── Tabs principales ───────────────────────────────────────────────────────

export type TabRecepcion = {
  selector: string;           // id del <a> del tab — nunca el texto visible
  etiqueta: string;            // solo para logs y mensajes de error
  contenedorContenido: string; // contenedor que debe quedar visible cuando el tab termina de cargar
};

/**
 * Los 6 tabs principales del modo básico de Recepción Vehicular (confirmados
 * en vivo: ids técnicos estables en vehicular_quick_reception.js, no el
 * texto visible). El módulo también puede exponer un segundo grupo de tabs
 * ("workflow-stage-tab": Recepción, Diagnóstico, Presupuesto, etc.) cuando
 * el flujo avanzado está habilitado — coexisten en el DOM con estos 6 sin
 * afectarlos, así que la navegación aquí no depende de qué modo esté activo
 * ni intenta activarlo/desactivarlo.
 *
 * Cada `contenedorContenido` fue confirmado en vivo como mutuamente
 * excluyente entre sí (visible solo cuando su propio tab está activo, oculto
 * en los otros 5) — mismo criterio de verificación que
 * `PESTANAS_POS_A_RECORRER` en pos.page.ts.
 */
export const TAB_DASHBOARD: TabRecepcion = {
  selector: '#tab_color_action_dashboard',
  etiqueta: 'Dashboard',
  contenedorContenido: '#div_quick_reception_dashboard',
};

export const TAB_TABLERO: TabRecepcion = {
  selector: '#tab_color_action_board',
  etiqueta: 'Tablero',
  contenedorContenido: '#div_quick_reception_content',
};

export const TAB_ORDENES: TabRecepcion = {
  selector: '#tab_color_action_order',
  etiqueta: 'Órdenes',
  contenedorContenido: '#company_repair_order_list',
};

export const TAB_REPUESTOS: TabRecepcion = {
  selector: '#tab_spare_parts',
  etiqueta: 'Repuestos',
  contenedorContenido: '#div_content_spare_parts',
};

export const TAB_GRAFICOS: TabRecepcion = {
  selector: '#tab_color_action_graphics',
  etiqueta: 'Gráficos',
  contenedorContenido: '#div_quick_reception_content_graphics',
};

export const TAB_TABLA_INFORMATIVA: TabRecepcion = {
  selector: '#tab_color_action_services',
  etiqueta: 'Tabla informativa',
  contenedorContenido: '#table_service_id_select_chosen',
};

export const TABS_MODO_BASICO: TabRecepcion[] = [
  TAB_DASHBOARD,
  TAB_TABLERO,
  TAB_ORDENES,
  TAB_REPUESTOS,
  TAB_GRAFICOS,
  TAB_TABLA_INFORMATIVA,
];

// ─── Locators ─────────────────────────────────────────────────────────────────

const L = {
  BUSCADOR:          '#repair_order_search',
  // Tres variantes según la vista/modo, confirmado en vivo:
  // `.reception-order-number-badge` solo en la vista Lista de Órdenes;
  // `.ervk-order-badge` en Tablero y en la vista Caja de Órdenes cuando el
  // modo de tarjeta del tablero es "Detallado" (comparten el mismo
  // componente de tarjeta "ervk"); pero cuando ese modo es "Compacto" (ver
  // Configurar Tablero) la tarjeta no renderiza `.ervk-order-badge` en
  // absoluto — el número de orden vive en `.ervk-compact-order-chip
  // .ervk-compact-chip-text` en su lugar. Sin esta tercera variante, toda
  // búsqueda/lectura de órdenes en Tablero fallaba en cuanto el ambiente
  // quedaba configurado en modo Compacto (el modo compacto es, de hecho, el
  // que suele quedar activo por defecto en este ambiente). `:visible` es
  // necesario porque el contenedor de la vista Lista queda oculto (no
  // desmontado) al cambiar a Caja o a Tablero, y sus badges seguirían
  // coincidiendo por texto si no se filtran por visibilidad real.
  BADGE_ORDEN:
    '.reception-order-number-badge:visible, .ervk-order-badge:visible, .ervk-compact-order-chip .ervk-compact-chip-text:visible',
  // Misma dualidad que BADGE_ORDEN, un nivel más arriba: la tarjeta completa
  // de la orden (incluye la placa del vehículo, no solo el número). El tab
  // Repuestos reutiliza el mismo componente de tarjeta pero con su propia
  // clase (`.repair-order-card`, "repair" no "reception") — confirmado en
  // vivo que también expone el mismo `.options-menu-button` que Tablero y
  // Órdenes, así que se agrega aquí en vez de necesitar un selector aparte.
  TARJETA_ORDEN:       '.reception-order-card:visible, .ervk-kanban-card:visible, .repair-order-card:visible',
  CONTENEDOR_ORDENES: '#company_repair_order_list',
  BTN_VISTA_LISTA:    '.view-repair-order-list',
  BTN_VISTA_CAJA:     '#btn_getRepairOrderViewBox',
  TOGGLE_TEMA:        '#theme-toggle-button',
  // Clase exacta que la app agrega al <a> del tab activo (confirmado en
  // vivo: token propio en la lista de clases, nunca concatenado a otro) y a
  // los botones de vista Lista/Caja cuando quedan seleccionados.
  CLASE_TAB_ACTIVO:    'tab_color_action',
  // Banner global de "Activa las notificaciones del navegador" (mismo
  // elemento documentado en panel-control.page.ts y en rp-tienda-en-linea.page.ts).
  // Confirmado en vivo: queda flotando sobre el header de Recepción Vehicular
  // e intercepta clicks sobre el toggle de tema y los botones de vista
  // Lista/Caja, causando timeouts en cascada. No tiene relación con ningún
  // flujo de negocio del módulo.
  NOTIF_DISMISS:      '#workshop-web-notification-permission-dismiss',
  // Botón de opciones (⋮) de una orden — mismo botón/menú tanto en la vista
  // Lista como en la vista Caja de Órdenes (confirmado en vivo: ambas vistas
  // renderizan el mismo componente de tarjeta y exponen las mismas 15
  // acciones del menú).
  BTN_OPCIONES_ORDEN:   '.options-menu-button',
  MENU_OPCIONES_ORDEN:  '.dropdown-content, .ro-card-dropdown',
  // Botón "⋮" del encabezado (badge "Nuevo") que despliega, entre otras
  // cosas, el enlace a "Configurar tablero". El id del propio botón
  // (`dLabel####`) es generado dinámicamente por el framework — se usa la
  // combinación de clases + `data-toggle="dropdown"`, estable entre cargas.
  BTN_MAS_OPCIONES:     '.more-options-btn-highlight[data-toggle="dropdown"]',
  LINK_CONFIGURAR_TABLERO: 'a[data-toggle="modal"][data-target="#ervkCustomizeModal"]',
  MODAL_CONFIGURAR_TABLERO: '#ervkCustomizeModal',
  BTN_GUARDAR_CONFIG_TABLERO: '#ervkSaveSettings',
  // Botón "Refrescar" del propio tablero (no confundir con recargar la
  // página): confirmado en vivo que el modo de tarjeta guardado en
  // Configurar Tablero solo se refleja en las tarjetas ya renderizadas tras
  // refrescar este caché, no al guardar.
  BTN_REFRESCAR_TABLERO: '#btn_refresh_board_cache',

  // ─── Reporte de Órdenes ─────────────────────────────────────────────────────
  // Navega en la MISMA pestaña (confirmado en vivo, no abre popup) a
  // /reports/order_report — un módulo aparte, no un modal. Acotado a
  // `#custom_page_header` (el contenedor real del menú "⋮", confirmado en
  // vivo inspeccionando los ids ancestro): sin acotar, un `href` sin
  // ancla exacta hace match también con el enlace idéntico del sidebar
  // (siempre presente en el DOM aunque el sidebar esté colapsado) y con
  // "Reporte de Inspección" (`/reports/order_report_inspection`, mismo
  // prefijo de URL) — 4 coincidencias en total, violación de "strict mode".
  LINK_REPORTE_ORDENES: '#custom_page_header a[href$="/reports/order_report"]',
  HEADING_REPORTE_ORDENES: 'h1.gn-title',

  // ─── Admin. WhatsApp ────────────────────────────────────────────────────────
  LINK_ADMIN_WHATSAPP: '#custom_page_header a[onclick*="show_dialog_whatsapp_manager"]',
  MODAL_ADMIN_WHATSAPP: '#dialog_whatsapp_manager',
  INPUT_BUSCAR_WHATSAPP: '#input_dialog_whatsapp_manager',
  BTN_BUSCAR_WHATSAPP: '#btn_search_dialog_whatsapp_manager',
  BTN_AGREGAR_WHATSAPP: '#dialog_whatsapp_manager button[onclick="show_hide();"]',
  FORM_WHATSAPP: '#edit_whatsapp_message',
  INPUT_WHATSAPP_TECLADO: '#txt_shortcut',
  INPUT_WHATSAPP_MENSAJE: '#txt_message',
  BTN_GUARDAR_WHATSAPP: '#dialog_whatsapp_manager button[onclick="update_whatsapp_message();"]',
  // `#next_form_customer_step` NO es un id único en esta app (confirmado en
  // vivo: se repite sin querer en más de una decena de modales no
  // relacionados). Tampoco basta con acotar por modal + `onclick="show_hide(1);"`:
  // el botón "×" del encabezado y el "Cerrar" del listado comparten el mismo
  // `onclick` — se acota además al contenedor real del footer en modo edición
  // (`.whatsapp-manager-footer-edit`), donde "Cancelar" es el único con ese
  // `onclick`.
  BTN_CANCELAR_WHATSAPP: '#dialog_whatsapp_manager .whatsapp-manager-footer-edit button[onclick="show_hide(1);"]',
  TABLA_WHATSAPP: '#table_whatsapp_message',

  // ─── Configurar Pasos de la Recepción (por rol) ─────────────────────────────
  // Confirmado en vivo: la función real (`showDialogStepReceptionVehicle()`)
  // solo hace `closeDropdownMenu(); loadMatrix();` — a diferencia del modal de
  // "crear producto nuevo" (que sí sufre la carrera de jQuery Steps
  // documentada en `crearProductoNuevoCatalogo`), este modal no usa ese
  // plugin y abre de forma consistente sin necesitar reintento.
  LINK_CONFIGURAR_PASOS: '#custom_page_header [onclick*="showDialogStepReceptionVehicle"]',
  MODAL_CONFIGURAR_PASOS: '#srv-modal-backdrop',
  INPUT_BUSCAR_PASO: '#srv-search-input',
  BTN_BUSCAR_PASO: '#srv-search-submit',
  INPUT_BUSCAR_ROL_PASO: '#srv-role-search-input',
  BTN_BUSCAR_ROL_PASO: '#srv-role-search-submit',
  BTN_CANCELAR_PASOS: '#srv-cancel',
  BTN_GUARDAR_PASOS: '#srv-save',
  // Rol "Administrador": confirmado en vivo dos veces en esta sesión
  // (Configurar Pasos y Ajustes Generales) que su `data-role-id` es "1".
  ROLE_ID_ADMINISTRADOR: '1',

  // ─── Configurar Flujo de Trabajo → Ajustes Generales ────────────────────────
  // Confirmado en vivo: "Configurar Flujo de Trabajo" NO abre un modal
  // directamente — entra a un "modo edición" superpuesto sobre el propio
  // tablero (`#awr-edit-banner` + lápices `.awr-stage-pencil` por etapa), y
  // recién al hacer clic en el lápiz de una etapa se abre el modal real
  // (`#awr-modal-backdrop`, el mismo contenedor reutilizado que "Configurar
  // Pasos" NO usa — cada feature tiene su propio backdrop pese al prefijo
  // compartido "awr"). Hay que salir del modo edición (`#awr-disable-edit-mode`)
  // para que los tabs normales del módulo (Tablero/Órdenes/Repuestos) vuelvan
  // a responder — confirmado en vivo que quedan bloqueados mientras el modo
  // edición sigue activo.
  LINK_CONFIGURAR_FLUJO_TRABAJO: '#custom_page_header [onclick*="showDialogAdjustWorkflow"]',
  BANNER_MODO_EDICION_FLUJO: '#awr-edit-banner',
  BTN_SALIR_MODO_EDICION_FLUJO: '#awr-disable-edit-mode',
  BTN_EDITAR_AJUSTES_GENERALES: 'button.awr-stage-pencil[data-stage-slug="workflow_general_settings"]',
  MODAL_AJUSTES_GENERALES: '#awr-modal-backdrop',
  INPUT_BUSCAR_PERMISO: '#awr-search-input',
  BTN_BUSCAR_PERMISO: '#awr-search-submit',
  INPUT_BUSCAR_ROL_PERMISO: '#awr-role-search-input',
  BTN_BUSCAR_ROL_PERMISO: '#awr-role-search-submit',
  BTN_CANCELAR_AJUSTES_GENERALES: '#awr-modal-cancel',
  BTN_GUARDAR_AJUSTES_GENERALES: '#awr-modal-save',
  // "Mostrar compartir orden": confirmado en vivo como un permiso real y
  // observable (controla si la sección "Compartir orden" aparece en el menú
  // "⋮" de una orden) — se usa como paso seguro y verificable para el
  // recorrido activar/desactivar/guardar de esta sección, igual que "Abonos"
  // en "Configurar Pasos de la Recepción".
  SETTING_SLUG_COMPARTIR_ORDEN: 'workflow_show_share_order',

  // ─── Compartir / Opciones avanzadas / Documentos / Abonos de una orden ─────
  // Las 3 secciones colapsables del menú "⋮" de una orden son <details> reales
  // — algunas veces quedan abiertas de una interacción previa y un clic en su
  // <summary> las CIERRA en vez de abrirlas (toggle), así que se fuerza
  // `.open = true` por JS en vez de hacer clic, para que sea determinístico.
  LINK_COMPARTIR_CORREO: 'a[onclick*="openSendOrderEmailModal"]',
  MODAL_COMPARTIR_CORREO: '#dialog_send_order_email',
  INPUT_CORREOS_COMPARTIR: '#order_email_tags',
  BTN_ENVIAR_COMPARTIR_CORREO: '.send_order_emails_btn',
  // Acotado por texto (no solo `data-dismiss="modal"`): la "×" del
  // encabezado comparte el mismo atributo con el botón real "Cancelar".
  BTN_CANCELAR_COMPARTIR_CORREO: '#dialog_send_order_email button[data-dismiss="modal"].btn-secondary',
  // Confirmado en vivo: el link de WhatsApp real usa dos nombres de función
  // distintos según el punto del menú desde el que se genere (mismo destino
  // funcional) — se cubren ambos.
  LINK_COMPARTIR_WHATSAPP:
    'a[onclick*="confirmSendRepairOrderWhatsapp"], a[onclick*="confirm_send_repair_order_by_whatsapp_message"]',
  LINK_DESCARGAR_QR: 'a[href*="getOrderQrById"]',
  LINK_VER_ORDEN_ONLINE: 'a[href*="get_repair_order_by_hash_key"]',
  // Confirmado en vivo: la llamada real vive en el `href="javascript:void(...)"`
  // del enlace, NO en un atributo `onclick` — a diferencia de la mayoría de
  // los demás enlaces de este mismo menú.
  LINK_DESACTIVAR_ORDEN: 'a[href*="confirmDeleteRepairOrder"]',
  LINK_ELIMINAR_ORDEN: 'a[href*="deleteRepairOrderdefinitive"]',
  LINK_PDF_GENERAL: 'a[href*="downloadPdfCreatedOrder"][href*="impression_type=0"]',
  LINK_PDF_DESCRIPTIVO: 'a[href*="downloadPdfCreatedOrder"][href*="impression_type=1"]',
  LINK_IMPRIMIR_ORDEN: 'a[onclick*="printVehicularReception"]',
  // A diferencia de los demás enlaces de "Documentos", este vive en el
  // `href="javascript:void(...)"` (mismo patrón que Desactivar/Eliminar),
  // no en un `onclick` — confirmado en vivo.
  LINK_PDF_PROFORMA: 'a[href*="generateProformOrderPDF"]',
  LINK_REPORTE_INSPECCION: 'a[onclick*="generateVehicleInspectionPDF"]',
  LINK_REPORTE_INSPECCION_AVANZADO: 'a[onclick*="generateVehicleInspectionAdvancedPDF"]',
  // Mismo patrón href="javascript:void(...)" ya confirmado repetidas veces en
  // este menú (Desactivar/Eliminar/Proforma) — no un `onclick`.
  LINK_ABONOS_AGREGAR_DESDE_MENU: 'a[href*="show_add_repair_order_payment"]',
  LINK_ABONOS_IMPRIMIR: 'a[href*="print_repair_order_payments"]',
  // Modal real de "Agregar Abono" abierto desde el menú "⋮" — confirmado en
  // vivo que es un flujo/modal totalmente distinto al paso "Abonos" del
  // wizard de creación (ids propios, prefijo "rop_"/"darop-").
  MODAL_ABONO_MENU: '#dialog_add_repair_order_payment',
  SALDO_ACTUAL_ABONO_MENU: '#rop_current_total',
  SELECT_CAJA_ABONO_MENU: '#rop_apply_to_cash_id',
  SELECT_FORMA_PAGO_ABONO_MENU: '#select_rop_payed_with',
  INPUT_MONTO_ABONO_MENU: '#input_ro_payment_amount',
  INPUT_SALDO_RESTANTE_ABONO_MENU: '#rop_payment_change',
  TEXTAREA_OBSERVACIONES_ABONO_MENU: '#rop_txta_observations',
  BTN_GUARDAR_ABONO_MENU: '#btn_add_repair_order_payment',

  // ─── Editar orden / Ver orden (menú "⋮", fuera de las <details> colapsables) ─
  // Confirmado en vivo: viven en el `href="javascript:void(...)"` (mismo
  // patrón ya visto repetidas veces en este menú), fuera de cualquier
  // sección <details> — siempre visibles sin necesitar forzar su apertura.
  LINK_EDITAR_ORDEN: 'a[href*="getOrderById"]',
  LINK_VER_ORDEN_DETALLE: 'a[href*="getOrderDetailById"]',

  // ─── Asignar mecánico (ícono propio de la tarjeta, fuera del menú "⋮") ──────
  // Confirmado en vivo: la tarjeta "Lista" (vista Lista de Órdenes) y la
  // tarjeta "Kanban" (Tablero, y Órdenes en vista Caja) usan DOS marcados
  // distintos para el mismo ícono — comparten el mismo `onclick` real
  // (`getMechanicDefaultByOrder`) pero en elementos con clases diferentes:
  // Lista → `<div class="user_avatar customer-name ...">` (dentro de un
  // wrapper `.BoardCardLayout-assignee` SIN el onclick); Kanban → el propio
  // `.BoardCardLayout-assignee` YA tiene el onclick directamente, sin ese
  // div interno. Acotar por clase (como se intentó primero) deja fuera la
  // variante Kanban por completo — el `onclick` es el único rasgo
  // verdaderamente compartido entre ambas.
  ICONO_ASIGNAR_MECANICO: '[onclick*="getMechanicDefaultByOrder"]',
  ITEM_MECANICO_POPOVER: '.mechanic-item',
  NOMBRE_MECANICO_POPOVER: '.mechanic-item__name',

  // ─── Ver Orden (vista de detalle comprensiva, distinta del wizard) ─────────
  // Confirmado en vivo: se abre tanto por "Paso 2: Ver orden" del menú "⋮"
  // como al hacer clic directo en la placa/marca/modelo de la tarjeta de una
  // orden (ambos disparan la misma petición real `getOrderDetailById`).
  // Acotados al tag real del encabezado (`h3`/`h1`/`h5`, confirmados en vivo
  // vía snapshot de accesibilidad) con `:text-matches` (sensible a
  // mayúsculas, a diferencia de `text=`/`:has-text`): el campanario global de
  // notificaciones renderiza decenas de `<p class="workshop-web-bell-item-body">`
  // ocultos con texto libre que puede coincidir por subcadena (p. ej.
  // "Vehículo" en minúscula dentro de una notificación) — sin acotar por tag
  // exacto, esos falsos positivos ocultos rompían la espera (30+ intentos
  // resolviendo siempre al `<p>` oculto en vez del encabezado real visible).
  ENCABEZADO_INFO_CLIENTE_VER_ORDEN: 'h3:text-matches("Información del cliente")',
  ENCABEZADO_VEHICULO_VER_ORDEN: 'h3:text-matches("Vehículo")',
  ENCABEZADO_SERVICIOS_VER_ORDEN: 'h1:text-matches("Gestión de Servicios")',
  ENCABEZADO_PRODUCTOS_VER_ORDEN: 'h1:text-matches("Gestión de productos")',
  ENCABEZADO_OBSERVACIONES_VER_ORDEN: 'h5:text-is("Observaciones")',

  // ─── Refrescar por tab (confirmado en vivo: solo Tablero y Repuestos tienen
  // un botón propio dentro de su contenedor de contenido; Dashboard y Órdenes
  // no exponen ninguno) ────────────────────────────────────────────────────
  BTN_REFRESCAR_REPUESTOS: '#btn_refresh_spare_parts_cache',

  // ─── Crear Recepción / Nueva orden de reparación ────────────────────────
  BTN_NUEVA_RECEPCION:  '.quick-reception-add-btn',
  MODAL_NUEVA_RECEPCION: '#dialog_search_vehicle_by_plaque',
  // Campo de placa DEL MODAL INICIAL — distinto de INPUT_PLACA_DETALLE (ver
  // más abajo), que vive en el paso "Detalles del vehículo" del wizard.
  INPUT_PLACA_MODAL:    '#vehicle_plaque',
  // El checkbox real queda oculto tras el slider visual del toggle
  // (confirmado en vivo) — el click debe ir sobre el <label> completo.
  TOGGLE_SIN_PLACA:     'label.modern-toggle-label',
  CHECKBOX_SIN_PLACA:   '#vehicle_has_plaque_check',
  BTN_AGREGAR_VEHICULO_MODAL: '#vr_add_vehicle_btn',
  BTN_BUSCAR_VEHICULO_MODAL:  '#btn_modal_search_vehicle',
  CONTENEDOR_RESULTADOS_BUSQUEDA_VEHICULO: '#vehicle_search_by_plaque_content',
  CONTENEDOR_CLIENTES_WIZARD: '#company_customer_content',
  TARJETA_CLIENTE_WIZARD:     '.modern-customer-card',
  // Contenedor del paso "Detalles del vehículo" — su visibilidad es la señal
  // funcional de que ese paso del wizard terminó de cargar.
  GRUPO_DETALLES_VEHICULO: '#vr_vehicle_battery_percent_group',
  SELECT_MARCA:        '#vehicle_brand',
  SELECT_MODELO:       '#vehicle_model',
  SELECT_COMBUSTIBLE:  '#vehicle_fuel',
  // Campo de placa DEL PASO "Detalles del vehículo" — separado del campo del
  // modal inicial (INPUT_PLACA_MODAL). Confirmado en vivo: es obligatorio
  // para guardar el vehículo SIEMPRE, incluso cuando el modal inicial se
  // marcó "No tiene Placa / Matrícula" (ese interruptor solo afecta la
  // validación del modal inicial, no la de este paso).
  INPUT_PLACA_DETALLE: '#vehicle_licence_plate',
  SELECT_ANIO:          '#vehicle_year',
  SELECT_TIPO_VEHICULO: '#reception_vehicle_type',
  SELECT_TRANSMISION:   '#vehicle_transmission',
  INPUT_NUMERO_UNIDAD:  '#vehicle_unit_number',
  INPUT_KILOMETRAJE:    '#vehicular_kilometer',
  INPUT_PORCENTAJE_BATERIA: '#p_vehicle_battery_percent',
  TOGGLE_SON_MILLAS:    '#vehicle_is_miles_check',
  // Secciones colapsables "Carrocería"/"Aseguradora" del paso "Detalles del
  // vehículo" — Bootstrap collapse. "Carrocería" tiene un único match por
  // texto exacto; "Aseguradora" no (el mismo texto aparece repetido en varios
  // templates ocultos de la página), así que esa usa su `data-target` propio.
  TOGGLE_SECCION_ASEGURADORA: '[data-target="#vehicleInsurance"]',
  INPUT_NUMERO_CHASIS:  '#vehicle_chassis',
  INPUT_NUMERO_MOTOR:   '#vehicle_motor',
  INPUT_TIPO_ACEITE:    '#vehicle_oil_type',
  INPUT_FILTRO_ACEITE:  '#vehicle_oil_filter',
  INPUT_FLOTILLA:       '#vehicle_flee',
  SELECT_ASEGURADORA:   '#insurance_policy_id',
  SELECT_CONTACTO_ASEGURADORA: '#insurance_policy_contact_id',
  INPUT_POLIZA:         '#insurance_policy',
  INPUT_NOMBRE_ASEGURADO: '#insurance_person',
  INPUT_NUMERO_AVISO:   '#notice_number',

  // ─── Enderezado y Pintura ───────────────────────────────────────────────────
  // Mismo widget conceptual que en POS (`pos.locators.ts`: Vehículo → Parte →
  // Pieza → Servicio → Precio), pero con ids propios en este módulo —
  // confirmado en vivo que NO son los mismos ids que en POS.
  SELECT_TIPO_VEHICULO_PINTURA: '#type_car_select',
  MODAL_PRECIOS_PINTURA: '#modal_prices_body',
  // Excluye por selector la tarjeta "Agregar precio a este servicio" (crea un
  // precio nuevo, no selecciona uno existente) — esa tarjeta es fija en la
  // interfaz, su rótulo no lo es.
  OPCION_PRECIO_PINTURA: '[id^="div_price_"]:not(#div_price_new)',

  // ─── Abonos ─────────────────────────────────────────────────────────────────
  INPUT_MONTO_ABONO:   '#initial-payment-repair-order',
  SELECT_FORMA_PAGO_ABONO: '#select_payed_with_ro',
  SELECT_CAJA_ABONO:   '#apply_to_cash_id',
  BTN_GUARDAR_ABONO:   '#btn_save_repair_order_payment',

  // ─── Seleccionar servicios (productos y servicios de la orden) ─────────────
  // Tarjetas "Agregar producto"/"Agregar servicio": aparecen duplicadas entre
  // la vista grilla y la vista lista del catálogo (ambas coexisten en el DOM,
  // solo una visible a la vez) — de ahí el filtro `visible=true` al usarlas.
  TARJETA_AGREGAR_PRODUCTO: 'text=Agregar producto',
  TARJETA_AGREGAR_SERVICIO: 'text=Agregar servicio',
  HEADING_TIPO_PRODUCTO: 'Producto Rápido',
  INPUT_PRODUCTO_RAPIDO_NOMBRE: '#quick_product_name',
  INPUT_PRODUCTO_RAPIDO_COSTO: '#quick_product_cost',
  INPUT_PRODUCTO_RAPIDO_PRECIO: '#quick_product_price',
  HEADING_TIPO_SERVICIO: 'Seleccione el tipo de servicio',
  HEADING_SERVICIO_RAPIDO: 'Servicio Rápido',
  INPUT_SERVICIO_RAPIDO_NOMBRE: '#dialog_quick_service_name',
  INPUT_SERVICIO_RAPIDO_PRECIO: '#dialog_quick_service_price_without_iva',
  // "Producto"/"Servicio Normal" (no rápido) del mismo modal de elección —
  // crea una entrada de catálogo real de dos pasos, no un ítem temporal.
  HEADING_PRODUCTO_NORMAL: 'Producto',
  HEADING_SERVICIO_NORMAL: 'Servicio Normal',
  MODAL_PRODUCTO_NUEVO: '#dialog_add_quick_product',
  INPUT_PRODUCTO_NUEVO_NOMBRE: '#product_name_app',
  INPUT_PRODUCTO_NUEVO_COSTO: '#product_cost_app',
  INPUT_PRODUCTO_NUEVO_PRECIO: '#product_price_app',
  MODAL_SERVICIO_NUEVO: '#dialog_add_quick_service_update_form',
  INPUT_SERVICIO_NUEVO_GRUPO: '#dialog_service_name',
  INPUT_SERVICIO_NUEVO_NOMBRE: '#dialog-service-update-subname',
  INPUT_SERVICIO_NUEVO_PRECIO: '#dial_price_without_iva_0',
  BTN_SERVICIO_NUEVO_AGREGAR_SUBLINEA: '#btn_add_new_price',
  BTN_SERVICIO_NUEVO_GUARDAR: '#btn_save_dialog_service_update',
  // Toggle "Mostrar precios con IVA" del carrito (afecta la vista de todas
  // las líneas a la vez, no una individual).
  TOGGLE_MOSTRAR_PRECIOS_CON_IVA: '#ro_show_price_with_iva',
  // Total general del carrito de la orden — confirmado en vivo: mismo id
  // "sin IVA" que las líneas individuales (`total_by_product_<clave>`)
  // mientras el toggle "Mostrar precios con IVA" esté apagado (su estado por
  // defecto), así que ambos son directamente comparables/sumables.
  TOTAL_GENERAL_CARRITO: '#total',
  TOTALES_POR_LINEA_CARRITO: '[id^="total_by_product_"]:visible',

  // ─── Partes del vehículo ────────────────────────────────────────────────────
  // Ícono de estado "Bueno" de una parte — el id numérico de cada parte es
  // dinámico según el ambiente, por eso se selecciona por el atributo
  // `onclick` (siempre `addAssetOrder(<id>,1)`) en vez de un id fijo.
  ICONO_PARTE_BUENA: '[onclick^="addAssetOrder"][title="Bueno"]',

  // ─── Marcación de daños / Firma del cliente (canvas de dibujo) ─────────────
  CANVAS_DIBUJO_VISIBLE: 'canvas:visible',
  BTN_GUARDAR_DANIO: 'Guardar nueva',
  TEXTO_DANIO_GUARDADO: /Foto seleccionada.*Total:\s*\d+/,

  // ─── Observaciones generales ────────────────────────────────────────────────
  // ¡OJO! Confirmado en vivo (inspeccionando la red y releyendo la orden ya
  // generada): estos dos campos del paso "Observaciones generales" del
  // wizard de creación NO se guardan en el backend — el texto escrito aquí
  // sobrevive mientras se navega entre pasos del mismo wizard (estado en
  // memoria del lado del cliente), pero se pierde por completo apenas se
  // sale de él. Ninguna petición de red se dispara al llenarlos ni al
  // avanzar de paso. Los campos que sí persisten de verdad son
  // `INPUT_OBSERVACION_SERVICIO_DETALLE`/`INPUT_OBSERVACION_CLIENTE_DETALLE`
  // más abajo, en la vista de detalle de la orden YA GENERADA.
  INPUT_OBSERVACION_SERVICIO: '#damage_repair',
  INPUT_OBSERVACION_CLIENTE: '#damage_repair_message',

  // ─── Finalizar (Generar orden) ─────────────────────────────────────────────
  HEADING_CONFIRMAR_GENERAR: '¿Está seguro de generar la orden?',

  // ─── Observaciones REALES (vista de detalle de la orden ya generada) ──────
  // Mismos campos conceptualmente, ids distintos (sufijo "_detail"),
  // confirmados en vivo como los que sí persisten: al perder el foco
  // disparan `saveRepairOrderNotes` (200).
  INPUT_OBSERVACION_SERVICIO_DETALLE: '#damage_repair_detail',
  INPUT_OBSERVACION_CLIENTE_DETALLE: '#damage_repair_message_detail',
} as const;

// Marca de vehículo usada como valor por defecto en los tests de creación de
// recepción/orden: confirmada en vivo con modelos reales asociados (a
// diferencia de otras marcas de datos de prueba en este ambiente, que a
// veces no tienen ningún modelo cargado y dejarían el combo de Modelo vacío).
export const MARCA_VEHICULO_PRUEBA = 'ALFA ROMEO';

// Producto y servicio "normales" (del catálogo real, no creados por quick
// add) usados como valores por defecto en los tests de Orden — confirmados
// en vivo como datos estables de este ambiente compartido, en la misma línea
// que otras referencias fijas ya usadas en el resto de la suite (p. ej. la
// placa "VSRF" o el cliente "CITA DE PRUEBA").
export const PRODUCTO_CATALOGO_PRUEBA = 'A11 - PROT. BLING GLITTER ROSA';
export const SERVICIO_CATALOGO_PRUEBA = 'Admisión LIV GA';

// Servicio del catálogo con un paquete de inspección real asociado —
// confirmado en vivo en /WorkshopServices/inspectionPackagemanagement
// (paquete "INSPECCION", 1 elemento con puntaje). No aparece en el listado
// por defecto del catálogo del wizard, por eso `agregarServicioDelCatalogo`
// siempre busca por texto antes de seleccionar.
export const SERVICIO_CON_PAQUETE_INSPECCION = 'validar serviico';

// Tipo de vehículo real con Parte/Pieza/Servicio/Precio configurados en
// "Enderezado y Pintura" — confirmado en vivo (otros tipos pueden no tener
// ninguna parte asociada y dejarían el panel de Piezas vacío).
export const TIPO_VEHICULO_PINTURA_PRUEBA = 'Hatchback';

export type VistaOrdenes = 'lista' | 'caja';
export type ModoTarjetaTablero = 'compacto' | 'detallado';

/**
 * Error de JavaScript conocido y ajeno a cualquier flujo de negocio del
 * módulo: confirmado en vivo por su stack trace, lo dispara el propio
 * atributo `onerror` inline de la app (`HTMLImageElement.onerror`, línea fija
 * de `vehicularQuickReception`) cuando la foto de un vehículo del set de
 * datos de prueba no carga (404) — el propio handler de fallback de la app
 * intenta un `appendChild` sobre un contenedor que en ese momento es `null`.
 * No depende de qué tab/acción se esté probando, solo de si el set de datos
 * de prueba tiene fotos de vehículo rotas, así que se excluye de las
 * aserciones de "sin errores de JS" de este módulo para no acoplar cada test
 * a la calidad de las fotos de los datos de prueba.
 */
const ERROR_JS_FOTO_VEHICULO_ROTA = "Cannot read properties of null (reading 'appendChild')";

/**
 * Segundo error de JS conocido y ajeno a cualquier flujo de negocio del
 * módulo: el mismo descrito en el docstring de `ir()` más arriba —
 * intermitente al activar el tab "Dashboard" cuando algunos scripts propios
 * de la página (el plugin `steps`) todavía no terminan de cargar en el
 * momento en que el módulo se auto-activa. Confirmado en vivo antes de que
 * este archivo existiera; no es una regresión introducida por ningún test de
 * este archivo.
 */
const ERROR_JS_DASHBOARD_STEPS = '$(...).steps is not a function';

const ERRORES_JS_CONOCIDOS = [ERROR_JS_FOTO_VEHICULO_ROTA, ERROR_JS_DASHBOARD_STEPS];

/** Filtra de una lista de errores de JS los ya identificados como ruido conocido y ajeno al módulo (ver `ERRORES_JS_CONOCIDOS`). */
export function erroresJSRelevantes(errores: string[]): string[] {
  return errores.filter((error) => !ERRORES_JS_CONOCIDOS.includes(error));
}

/** Convierte un monto mostrado en formato "es-CR" (punto de millar, coma decimal — p. ej. "$ 1.000,00") a un número. */
function parseMonedaCR(texto: string): number {
  const limpio = texto.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(limpio) || 0;
}

// ─── Page Object ──────────────────────────────────────────────────────────────

export class RecepcionPage {
  constructor(private readonly page: Page) {}

  get buscador(): Locator {
    return this.page.locator(L.BUSCADOR);
  }

  get contenedorOrdenes(): Locator {
    return this.page.locator(L.CONTENEDOR_ORDENES);
  }

  /**
   * Único punto de entrada al módulo Recepción Vehicular. Espera además a
   * que la red quede en reposo (`networkidle`, con tolerancia si nunca lo
   * hace del todo) antes de devolver el control: confirmado en vivo que
   * interactuar con los tabs demasiado pronto tras `domcontentloaded` —
   * mientras algunos scripts de la propia página todavía están cargando —
   * puede disparar un error real de la aplicación al activar el tab
   * "Dashboard" (`$(...).steps is not a function`, intermitente, ~1 de cada
   * 5 intentos). Es una espera funcional real sobre el estado de red, no una
   * pausa fija.
   */
  async ir() {
    await this.page.goto(RECEPCION_VEHICULAR_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
    await this.cerrarNotificacionPermiso();
  }

  /**
   * Cierra el banner global de "Activa las notificaciones del navegador" si
   * aparece (mismo elemento que en panel-control.page.ts y
   * rp-tienda-en-linea.page.ts). Confirmado en vivo: queda flotando sobre el
   * header del módulo e intercepta los clicks sobre el toggle de tema y los
   * botones de vista Lista/Caja — click vía `page.evaluate` (no
   * `locator.click`) porque es precisamente ese mismo banner el que puede
   * interceptar el click real; es un elemento opcional y ajeno a cualquier
   * flujo de negocio, así que su ausencia nunca debe hacer fallar el test.
   */
  async cerrarNotificacionPermiso() {
    await this.page.evaluate((selector) => {
      document.querySelector<HTMLElement>(selector)?.click();
    }, L.NOTIF_DISMISS);
  }

  // ─── Tabs ───────────────────────────────────────────────────────────────────

  /** Indica si el tab existe en el DOM en este momento — detecta tabs ocultos por permisos/configuración sin fallar. */
  async existeTab(tab: TabRecepcion): Promise<boolean> {
    return (await this.page.locator(tab.selector).count()) > 0;
  }

  /** Indica si el tab dado está activo ahora mismo (clase `tab_color_action` presente). */
  async tabEstaActivo(tab: TabRecepcion): Promise<boolean> {
    const clases = await this.page.locator(tab.selector).getAttribute('class');
    return (clases ?? '').split(/\s+/).includes(L.CLASE_TAB_ACTIVO);
  }

  /**
   * Visita un tab ya confirmado existente: click real (sin force), confirma
   * que quedó activo y que su contenedor de contenido propio quedó visible.
   * A diferencia de `visitarPestanaPos` (POS), estos 6 tabs no comparten un
   * único endpoint AJAX común entre sí (cada uno dispara sus propias
   * llamadas — confirmado en vivo: Dashboard, Repuestos, Gráficos y Tabla
   * informativa sí disparan peticiones propias, pero Órdenes normalmente no
   * dispara ninguna por tener su contenido ya precargado) — por eso la
   * espera funcional aquí es siempre sobre el contenedor de contenido, señal
   * válida para los 6 casos por igual.
   */
  async visitarTab(tab: TabRecepcion) {
    await this.page.locator(tab.selector).click();

    await esperarQuedaActivo(() => this.tabEstaActivo(tab));

    await expect(
      this.page.locator(tab.contenedorContenido),
      `Tras activar "${tab.etiqueta}", su contenedor de contenido (${tab.contenedorContenido}) no quedó visible`
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  // ─── Búsqueda de órdenes (compartida entre Tablero y Órdenes) ────────────────

  /**
   * Busca órdenes con el término dado. El input `#repair_order_search` solo
   * dispara la búsqueda con la tecla Enter (`keypress`, `e.which === 13` en
   * vehicular_quick_reception.js) — confirmado en vivo que `fill()` por sí
   * solo (evento `input`) no la activa.
   */
  async buscarOrden(termino: string) {
    await this.buscador.fill(termino);
    await this.buscador.press('Enter');
  }

  /** Limpia la búsqueda y restaura el listado sin filtrar. */
  async limpiarBusqueda() {
    await this.buscarOrden('');
  }

  /** Locator del badge circular con el número de una orden específica — mismo elemento en Tablero y en Órdenes. */
  badgeOrden(numero: string): Locator {
    return this.page.locator(L.BADGE_ORDEN, { hasText: new RegExp(`^${numero}$`) });
  }

  /**
   * Locator de la tarjeta completa de una orden específica, identificada por
   * su número real (no por posición) — necesario para volver a ubicar la
   * MISMA orden tras una recarga completa, ya que el orden de las tarjetas
   * en el listado puede cambiar entre cargas (p. ej. al reordenarse por
   * última actividad).
   */
  tarjetaPorNumero(numero: string): Locator {
    return this.page.locator(L.TARJETA_ORDEN, { has: this.badgeOrden(numero) });
  }

  /** Números de orden actualmente visibles (en cualquiera de los dos tabs que comparten este badge). */
  async obtenerNumerosOrdenVisibles(): Promise<string[]> {
    return this.page.locator(L.BADGE_ORDEN).allTextContents();
  }

  /**
   * Toma la primera orden real visible en el tab activo (Tablero u Órdenes)
   * — nunca un número fijo: el set de datos varía según el ambiente.
   */
  async obtenerPrimeraOrdenVisible(): Promise<string> {
    const primerBadge = this.page.locator(L.BADGE_ORDEN).first();
    await expect(primerBadge, 'No hay ninguna orden visible para tomar como base de la prueba').toBeVisible({ timeout: TIMEOUTS.CARGA });
    return (await primerBadge.textContent())?.trim() ?? '';
  }

  /**
   * Igual que `obtenerPrimeraOrdenVisible()`, pero además lee la placa del
   * vehículo desde la tarjeta completa — necesaria para probar búsqueda
   * parcial: confirmado en vivo que el buscador de Tablero
   * (`getRepairOrderBoardList`) filtra por coincidencia parcial de placa,
   * pero NO por coincidencia parcial del número de orden (una búsqueda
   * parcial del número, p.ej. "30" de la orden "307", puede coincidir con
   * otra orden real distinta —la "30"— y ocultar la original en vez de
   * incluirla), a diferencia del buscador de Órdenes
   * (`getOrderSearch`), que sí hace ambos.
   */
  async obtenerPrimeraOrdenYPlaca(): Promise<{ numero: string; placa: string }> {
    const primeraTarjeta = this.page.locator(L.TARJETA_ORDEN).first();
    await expect(primeraTarjeta, 'No hay ninguna orden visible para tomar como base de la prueba').toBeVisible({ timeout: TIMEOUTS.CARGA });
    return this.obtenerNumeroYPlacaDeTarjeta(primeraTarjeta);
  }

  /** Igual que `obtenerPrimeraOrdenYPlaca()`, pero sobre una tarjeta específica ya identificada (no necesariamente la primera). */
  async obtenerNumeroYPlacaDeTarjeta(tarjeta: Locator): Promise<{ numero: string; placa: string }> {
    const texto = (await tarjeta.innerText()).replace(/\s+/g, ' ');
    const numero = texto.match(/^(\d+)/)?.[1] ?? '';
    const placa = texto.match(/Placa:\s*([A-Za-z0-9-]+)/)?.[1] ?? '';
    return { numero, placa };
  }

  // ─── Vista del tab Órdenes: Lista / Caja ─────────────────────────────────────

  /** Vista actualmente activa en el tab Órdenes, leída del contenedor real (no asumida). */
  async vistaOrdenesActiva(): Promise<VistaOrdenes> {
    const clases = (await this.contenedorOrdenes.getAttribute('class')) ?? '';
    if (clases.includes('repair-order-grid-active')) return 'caja';
    return 'lista';
  }

  /** Cambia la vista del tab Órdenes (Lista/Caja) y espera a que el contenedor confirme el cambio real. */
  async cambiarVistaOrdenes(vista: VistaOrdenes) {
    const boton = vista === 'caja' ? this.page.locator(L.BTN_VISTA_CAJA) : this.page.locator(L.BTN_VISTA_LISTA);
    await boton.click();

    await esperarQuedaActivo(async () => (await this.vistaOrdenesActiva()) === vista);
  }

  // ─── Modo oscuro ──────────────────────────────────────────────────────────────

  /** Indica si el modo oscuro está activo ahora mismo (clase `dark-mode` en `<body>`). */
  async modoOscuroActivo(): Promise<boolean> {
    const clases = await this.page.locator('body').getAttribute('class');
    return (clases ?? '').split(/\s+/).includes('dark-mode');
  }

  /**
   * Alterna el modo oscuro/claro. El toggle no dispara ninguna petición de
   * red (confirmado en vivo): actualiza `<body>` y `localStorage` de forma
   * síncrona — la espera funcional es directamente sobre la clase real de
   * `<body>`, sin necesidad de `waitForResponse` ni pausa alguna.
   */
  async alternarModoOscuro() {
    const activoAntes = await this.modoOscuroActivo();
    await this.page.locator(L.TOGGLE_TEMA).click();

    await esperarQuedaActivo(async () => (await this.modoOscuroActivo()) === !activoAntes);
  }

  // ─── Opciones de una orden (compartidas entre vista Lista y vista Caja) ─────

  /**
   * Abre el menú de opciones (⋮) de la primera orden visible y devuelve el
   * menú ya desplegado, con TODAS sus secciones colapsables ("Compartir
   * orden", "Opciones avanzadas", "Documentos") forzadas a abrirse.
   *
   * Esas secciones son `<details>` reales — un clic en su `<summary>` hace
   * TOGGLE (abre/cierra) en vez de solo abrir, así que una sección ya
   * abierta por una interacción previa en el mismo menú puede cerrarse por
   * accidente con un segundo clic. Se fuerza `.open = true` por JS en todas
   * a la vez, determinístico e independiente de su estado previo.
   */
  async abrirOpcionesPrimeraOrden(): Promise<Locator> {
    const primeraTarjeta = this.page.locator(L.TARJETA_ORDEN).first();
    await expect(primeraTarjeta, 'No hay ninguna orden visible para abrir su menú de opciones').toBeVisible({ timeout: TIMEOUTS.CARGA });

    await primeraTarjeta.locator(L.BTN_OPCIONES_ORDEN).first().click();

    const menu = this.page.locator(L.MENU_OPCIONES_ORDEN).first();
    await expect(menu, 'El menú de opciones de la orden no se desplegó').toBeVisible({ timeout: TIMEOUTS.CARGA });

    await this.page.evaluate(() => {
      document.querySelectorAll('.ro-card-dropdown details, .dropdown-content details').forEach((d) => {
        (d as HTMLDetailsElement).open = true;
      });
    });

    return menu;
  }

  // ─── Compartir orden (correo y WhatsApp) ────────────────────────────────────

  get modalCompartirCorreo(): Locator {
    return this.page.locator(L.MODAL_COMPARTIR_CORREO);
  }

  /** Abre "Compartir orden > Enviar por correo" desde el menú "⋮" ya desplegado (ver `abrirOpcionesPrimeraOrden()`). */
  async abrirCompartirPorCorreo(menu: Locator) {
    const link = menu.locator(L.LINK_COMPARTIR_CORREO);
    await expect(link, 'El enlace "Enviar por correo" no apareció en "Compartir orden"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await link.click();

    await expect(this.modalCompartirCorreo, 'El modal "Enviar Orden por Correo" no se abrió').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Correos ya cargados como "tags" en el campo "Enviar a:" del modal ya abierto. */
  async obtenerCorreosCompartir(): Promise<string[]> {
    return this.modalCompartirCorreo.locator('.selectize-input .item').allTextContents();
  }

  /**
   * Envía la orden por correo con los destinatarios ya cargados. Confirmado
   * en vivo: dispara `POST vehicularReception/sendOrderByEmail`, cierra el
   * modal solo y muestra el toast real "Correo enviado con éxito".
   */
  async enviarCompartirPorCorreo() {
    const respuestaEnvio = this.page.waitForResponse(
      (r) => r.url().includes('sendOrderByEmail') && r.request().method() === 'POST',
      { timeout: TIMEOUTS.CARGA }
    );
    await this.page.locator(L.BTN_ENVIAR_COMPARTIR_CORREO).click();
    await respuestaEnvio;

    await expect(
      this.page.locator('.noty_bar', { hasText: 'Correo enviado con éxito' }),
      'No apareció el toast de "Correo enviado con éxito"'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await expect(this.modalCompartirCorreo, 'El modal de compartir por correo no se cerró tras enviar').toBeHidden({
      timeout: TIMEOUTS.CARGA,
    });
  }

  /** Cancela el modal de compartir por correo sin enviar. */
  async cancelarCompartirPorCorreo() {
    await this.page.locator(L.BTN_CANCELAR_COMPARTIR_CORREO).click();
    await expect(this.modalCompartirCorreo, 'El modal de compartir por correo no se cerró tras cancelar').toBeHidden({
      timeout: TIMEOUTS.CARGA,
    });
  }

  /**
   * Enlace "Compartir por WhatsApp" del menú "⋮" ya desplegado. Confirmado en
   * vivo: su presencia depende de que el cliente autoseleccionado tenga un
   * teléfono válido registrado — un dato real y mutable del ambiente
   * compartido, no algo que la propia orden garantice siempre.
   */
  linkCompartirWhatsapp(menu: Locator): Locator {
    return menu.locator(L.LINK_COMPARTIR_WHATSAPP);
  }

  // ─── Opciones avanzadas de una orden (QR, ver online, desactivar, eliminar) ─

  /**
   * Descarga el QR del vehículo desde el menú "⋮" ya desplegado. Confirmado
   * en vivo: es un `<a download="...">` real (no un modal ni una petición
   * AJAX), así que se captura con el evento `download` nativo de Playwright.
   */
  async descargarQrVehiculo(menu: Locator) {
    const link = menu.locator(L.LINK_DESCARGAR_QR);
    await expect(link, 'El enlace "Descargar QR de vehículo" no apareció en "Opciones avanzadas"').toBeVisible({ timeout: TIMEOUTS.CARGA });

    const [descarga] = await Promise.all([this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA }), link.click()]);
    return descarga;
  }

  /**
   * Abre "Ver orden online" desde el menú "⋮" ya desplegado. Confirmado en
   * vivo: `target="_blank"` real, abre una pestaña nueva del navegador.
   */
  async abrirVerOrdenOnline(menu: Locator) {
    const link = menu.locator(L.LINK_VER_ORDEN_ONLINE);
    await expect(link, 'El enlace "Ver orden online" no apareció en "Opciones avanzadas"').toBeVisible({ timeout: TIMEOUTS.CARGA });

    const [nuevaPagina] = await Promise.all([this.page.context().waitForEvent('page', { timeout: TIMEOUTS.CARGA }), link.click()]);
    await nuevaPagina.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.NAVIGATE });
    return nuevaPagina;
  }

  /**
   * Desactiva la orden desde el menú "⋮" ya desplegado. Dispara un SweetAlert
   * de confirmación real ("¿Está seguro de desactivar la orden? La orden
   * será desactivada.", botones "Cancelar"/"Desactivar") y, cuando la acción
   * SÍ se ejecuta, la orden deja de aparecer en la búsqueda normal por
   * placa/número (no queda "inactiva pero visible", desaparece del listado).
   *
   * BUG CONFIRMADO EN VIVO (investigación exhaustiva, 6+ corridas distintas,
   * incluso aislando esta acción en su propia orden desechable sin ninguna
   * otra interacción antes): el clic en "Desactivar" del SweetAlert cierra el
   * diálogo con normalidad, pero NO dispara ninguna petición de red real la
   * mayoría de las veces (confirmado con captura completa de red durante
   * toda la interacción) — la orden sigue existiendo indefinidamente. Mismo
   * patrón de bug que `eliminarOrden()`. El spec que usa este método (ver
   * el test `test.fail(...)` dedicado en recepcion-basico.spec.ts) documenta
   * el hallazgo manteniendo la aserción real en vez de debilitarla.
   */
  async desactivarOrden(menu: Locator) {
    const link = menu.locator(L.LINK_DESACTIVAR_ORDEN);
    await expect(link, 'El enlace "Desactivar orden" no apareció en "Opciones avanzadas"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await link.click();

    const confirmar = this.page.locator('.sweet-alert').last().getByRole('button', { name: 'Desactivar', exact: true });
    await expect(confirmar, 'No apareció la confirmación de "Desactivar orden"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await confirmar.click();

    // Se espera a que el propio SweetAlert de confirmación se cierre antes de
    // continuar: confirmado en vivo que, sin esta espera, una búsqueda
    // inmediatamente posterior (incluso tras recargar la página) todavía
    // encuentra la orden — el procesamiento de "Desactivar" no es instantáneo.
    await expect(this.page.locator('.sweet-alert:visible')).toHaveCount(0, { timeout: TIMEOUTS.CARGA });
  }

  /**
   * Elimina definitivamente la orden desde el menú "⋮" ya desplegado.
   *
   * BUG CONFIRMADO EN VIVO (sesión de investigación exhaustiva, 5 corridas
   * distintas): el enlace "Eliminar orden" (`href="javascript:void(
   * deleteRepairOrderdefinitive(id, companyId))"`) no produce NINGÚN efecto
   * observable — no aparece SweetAlert, ni `confirm()` nativo, ni toast, ni
   * ninguna petición de red, y la orden sigue existiendo en el listado tras
   * el clic. Se descartó un problema del propio clic de Playwright: llamar
   * la función global `deleteRepairOrderdefinitive(id, companyId)`
   * directamente por `page.evaluate()`, con los IDs reales extraídos del
   * propio `href`, produce el mismo resultado (nada). También se descartó
   * que dependiera de que la orden estuviera ya "Desactivada" antes de
   * "Eliminar": tras desactivar una orden de prueba, esta deja de ser
   * encontrable por cualquier búsqueda normal (no existe ningún filtro de
   * estado "Inactivas" en la pantalla de Órdenes), así que ni siquiera hay
   * forma de llegar de nuevo a su menú "⋮" para intentar "Eliminar" sobre
   * ella. Conclusión: "Eliminar orden" está roto o inalcanzable en este
   * ambiente — no es un problema de esta automatización. Este método hace el
   * clic real (documentando el flujo esperado) y el spec que lo usa
   * mantiene la aserción real de que la orden debería desaparecer, en vez de
   * debilitarla para forzar un verde falso (ver CLAUDE_CONTEXT.md).
   */
  async eliminarOrden(menu: Locator) {
    const link = menu.locator(L.LINK_ELIMINAR_ORDEN);
    await expect(link, 'El enlace "Eliminar orden" no apareció en "Opciones avanzadas"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await link.click();
  }

  // ─── Documentos de una orden ────────────────────────────────────────────────

  /**
   * Descarga "PDF General" desde el menú "⋮" ya desplegado. Confirmado en
   * vivo: es un `href` normal SIN `download` ni `target="_blank"`, pero el
   * servidor responde con `Content-Disposition` de descarga — Playwright lo
   * captura igual como evento `download` real, sin navegar la pestaña actual.
   */
  async descargarPdfGeneral(menu: Locator) {
    const link = menu.locator(L.LINK_PDF_GENERAL);
    await expect(link, 'El enlace "Crear PDF General" no apareció en "Documentos"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    const [descarga] = await Promise.all([this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA }), link.click()]);
    return descarga;
  }

  /** Descarga "PDF Descriptivo" — mismo patrón que "PDF General". */
  async descargarPdfDescriptivo(menu: Locator) {
    const link = menu.locator(L.LINK_PDF_DESCRIPTIVO);
    await expect(link, 'El enlace "Crear PDF Descriptivo" no apareció en "Documentos"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    const [descarga] = await Promise.all([this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA }), link.click()]);
    return descarga;
  }

  /** Descarga "PDF Proforma" — mismo patrón (confirmado en vivo: también dispara un `download` real). */
  async descargarPdfProforma(menu: Locator) {
    const link = menu.locator(L.LINK_PDF_PROFORMA);
    await expect(link, 'El enlace "Crear PDF Proforma" no apareció en "Documentos"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    const [descarga] = await Promise.all([this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA }), link.click()]);
    return descarga;
  }

  /**
   * Activa "Imprimir Orden" desde el menú "⋮" ya desplegado. Confirmado en
   * vivo: abre una pestaña nueva (vacía/`about:blank` en el instante del
   * clic, se llena e imprime vía `window.print()` del propio navegador) en
   * vez de disparar una descarga — se captura como página nueva, no como
   * `download`.
   */
  async abrirImprimirOrden(menu: Locator) {
    const link = menu.locator(L.LINK_IMPRIMIR_ORDEN);
    await expect(link, 'El enlace "Imprimir" no apareció en "Documentos"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    const [nuevaPagina] = await Promise.all([this.page.context().waitForEvent('page', { timeout: TIMEOUTS.CARGA }), link.click()]);
    return nuevaPagina;
  }

  /**
   * Genera "PDF Reporte de Inspección" desde el menú "⋮" ya desplegado.
   * Confirmado en vivo: su `onclick` está protegido por
   * `if (typeof generateVehicleInspectionPDF === 'function')` — la función
   * solo existe cuando la orden realmente tiene un paquete de inspección
   * asociado (confirmado en vivo: en una orden SIN inspección, el clic no
   * produce ningún efecto — ni descarga, ni pestaña nueva, ni error). Por
   * eso este método requiere que la orden usada para probarlo haya pasado
   * por el paso "Inspección" con un servicio con paquete asociado.
   */
  async descargarReporteInspeccion(menu: Locator) {
    const link = menu.locator(L.LINK_REPORTE_INSPECCION);
    await expect(link, 'El enlace "PDF Reporte de Inspección" no apareció en "Documentos"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    const [descarga] = await Promise.all([this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA }), link.click()]);
    return descarga;
  }

  /** Genera "PDF Reporte de Inspección Avanzado" — mismo patrón y misma dependencia de datos reales de inspección. */
  async descargarReporteInspeccionAvanzado(menu: Locator) {
    const link = menu.locator(L.LINK_REPORTE_INSPECCION_AVANZADO);
    await expect(link, 'El enlace "Reporte de Inspección Avanzado" no apareció en "Documentos"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    const [descarga] = await Promise.all([this.page.waitForEvent('download', { timeout: TIMEOUTS.CARGA }), link.click()]);
    return descarga;
  }

  // ─── Editar orden / Ver orden (menú "⋮", fuera de "Documentos") ─────────────

  /**
   * Abre "Editar orden" desde el menú "⋮" ya desplegado. Es el MISMO
   * componente de wizard que `abrirDetallePrimeraOrdenVisible()` (badge/
   * número de la orden) — pero, a diferencia de ese, confirmado en vivo que
   * NO reabre directamente en la vista comprensiva de detalle: reabre el
   * wizard paso a paso, resumiendo en el paso que el backend considera
   * pendiente de revisión (confirmado en vivo, de forma repetible, en
   * "Marcación de daños" para una orden ya generada por completo con el
   * flujo estándar de estas pruebas) — nunca en "Observaciones generales"
   * directamente, así que el dato editable a validar aquí es el de ESE
   * paso (ver `marcarDanioYGuardar()`/`obtenerTotalMarcacionesDanio()`), no
   * las observaciones (esas solo persisten desde la vista abierta por
   * `abrirDetallePrimeraOrdenVisible()`, el clic en el badge/número).
   */
  async abrirEditarOrdenDesdeMenu(menu: Locator) {
    const link = menu.locator(L.LINK_EDITAR_ORDEN);
    await expect(link, 'El enlace "Editar orden" no apareció en el menú "⋮"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await link.click();
    await expect(
      this.page.locator(L.CANVAS_DIBUJO_VISIBLE).first(),
      'La vista de "Editar orden" no cargó (no apareció el canvas de "Marcación de daños")'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Espera a que la vista comprensiva de "Ver orden" (`getOrderDetailById`)
   * quede cargada. Confirmado en vivo (tras descartar modal/pestaña
   * nueva/iframe con un screenshot de página completa): es un reemplazo de
   * contenido en el mismo lugar, sin cambio de URL — por eso la única señal
   * real de carga es el propio contenido (secciones "Información del
   * cliente" y "Vehículo"), no una navegación ni un modal.
   */
  private async _esperarVistaVerOrdenCargada() {
    await expect(
      this.page.locator(L.ENCABEZADO_INFO_CLIENTE_VER_ORDEN),
      'La vista de "Ver orden" no cargó (no apareció "Información del cliente")'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await expect(
      this.page.locator(L.ENCABEZADO_VEHICULO_VER_ORDEN).first(),
      'La vista de "Ver orden" no cargó (no apareció la sección "Vehículo")'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Abre "Ver orden" desde el menú "⋮" ya desplegado. */
  async abrirVerOrdenDesdeMenu(menu: Locator) {
    const link = menu.locator(L.LINK_VER_ORDEN_DETALLE);
    await expect(link, 'El enlace "Ver orden" no apareció en el menú "⋮"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await link.click();
    await this._esperarVistaVerOrdenCargada();
  }

  /**
   * Abre la misma vista "Ver orden" pero haciendo clic directamente sobre la
   * información de placa/cliente/vehículo de la tarjeta (fuera del menú
   * "⋮"). Confirmado en vivo con un listener de red: dispara la MISMA
   * petición `getOrderDetailById` que el enlace "Ver orden" del menú.
   */
  async abrirVerOrdenDesdeInfoTarjeta(tarjeta: Locator) {
    const infoPlaca = tarjeta.getByText(/Placa:/).first();
    await expect(infoPlaca, 'No se encontró la información de placa en la tarjeta de la orden').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await infoPlaca.click();
    await this._esperarVistaVerOrdenCargada();
  }

  /** Texto completo (normalizado, sin saltos/espacios repetidos) de la vista "Ver orden" ya cargada — para validar campos puntuales por contenido. */
  async obtenerTextoVerOrden(): Promise<string> {
    return (await this.page.locator('body').innerText()).replace(/\s+/g, ' ');
  }

  /** Confirma que las secciones "Gestión de Servicios", "Gestión de productos" y "Observaciones" de la vista "Ver orden" ya cargada están visibles. */
  async verificarSeccionesVerOrden() {
    await expect(this.page.locator(L.ENCABEZADO_SERVICIOS_VER_ORDEN), '"Ver orden" no muestra la sección "Gestión de Servicios"').toBeVisible();
    await expect(this.page.locator(L.ENCABEZADO_PRODUCTOS_VER_ORDEN), '"Ver orden" no muestra la sección "Gestión de productos"').toBeVisible();
    await expect(this.page.locator(L.ENCABEZADO_OBSERVACIONES_VER_ORDEN), '"Ver orden" no muestra la sección "Observaciones"').toBeVisible();
  }

  // ─── Asignar mecánico (ícono propio de la tarjeta) ──────────────────────────

  /** Ícono/avatar de "Asignar mecánico" de una tarjeta de orden específica — mismo componente en Tablero y Órdenes. */
  iconoAsignarMecanico(tarjeta: Locator): Locator {
    return tarjeta.locator(L.ICONO_ASIGNAR_MECANICO);
  }

  /**
   * Primera tarjeta de orden que SÍ expone el ícono de "Asignar mecánico" —
   * no simplemente la primera tarjeta visible. Confirmado en vivo: no todas
   * las órdenes lo muestran (p. ej. columnas/estados terminales del
   * tablero), así que un `.first()` a ciegas sobre `TARJETA_ORDEN` puede
   * caer en una orden sin esa función, dejando cualquier espera posterior
   * sobre el ícono colgada indefinidamente.
   */
  primeraTarjetaConAsignarMecanico(): Locator {
    return this.page.locator(L.TARJETA_ORDEN).filter({ has: this.page.locator(L.ICONO_ASIGNAR_MECANICO) }).first();
  }

  /** Mecánico actualmente asignado en la tarjeta, leído del `aria-label` real del ícono ("MECÁNICO: Sin asignar" o "MECÁNICO: <nombre>"). */
  async obtenerMecanicoAsignado(tarjeta: Locator): Promise<string> {
    const etiqueta = (await this.iconoAsignarMecanico(tarjeta).getAttribute('aria-label')) ?? '';
    return etiqueta.replace('MECÁNICO:', '').trim();
  }

  /** Abre el popover de "Asignar mecánico" de una tarjeta y devuelve el popover ya visible. */
  async abrirAsignarMecanico(tarjeta: Locator): Promise<Locator> {
    const icono = this.iconoAsignarMecanico(tarjeta);
    await expect(icono, 'No se encontró el ícono de "Asignar mecánico" en la tarjeta').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await icono.click();

    const popover = tarjeta.locator('[id^="mechanic_repair_order_content_"]');
    await expect(popover, 'El popover de "Asignar mecánico" no se desplegó').toBeVisible({ timeout: TIMEOUTS.CARGA });
    return popover;
  }

  /**
   * Selecciona un mecánico disponible en el popover ya abierto y confirma la
   * asignación esperando el ícono real de confirmación
   * (`[id^="check_mechanic_"]` visible) — esta acción no muestra ningún
   * toast, así que ese ícono es la única señal real de éxito.
   *
   * Si `evitarNombre` se indica, se elige el primer mecánico del popover
   * CUYO nombre sea distinto de ese (nunca el índice 0 a ciegas): en un
   * ambiente compartido donde las órdenes no se limpian entre corridas, la
   * primera orden visible puede ya tener asignado justo el mecánico que
   * `.first()` elegiría, dejando la prueba de "el cambio se reflejó" sin
   * ningún cambio real que observar. Con 3+ mecánicos reales confirmados en
   * el ambiente, siempre hay al menos una alternativa real distinta.
   */
  async asignarPrimerMecanicoDisponible(popover: Locator, evitarNombre?: string): Promise<string> {
    const items = popover.locator(L.ITEM_MECANICO_POPOVER);
    await expect(items.first(), 'No hay ningún mecánico disponible para asignar').toBeVisible({ timeout: TIMEOUTS.CARGA });

    let item = items.first();
    if (evitarNombre) {
      const nombreLimpio = evitarNombre.trim();
      const candidato = items.filter({ hasNotText: nombreLimpio }).first();
      if (await candidato.count()) item = candidato;
    }

    const nombre = (await item.locator(L.NOMBRE_MECANICO_POPOVER).innerText()).trim();
    const iconoConfirmacion = item.locator('[id^="check_mechanic_"]');
    await item.click();
    await expect(iconoConfirmacion, 'No se confirmó visualmente la asignación del mecánico').toBeVisible({ timeout: TIMEOUTS.CARGA });

    return nombre;
  }

  // ─── Refrescar (Repuestos) ───────────────────────────────────────────────────

  /**
   * Refresca el caché del tab Repuestos — mismo patrón que
   * `refrescarTablero()`. Confirmado en vivo (consulta acotada a cada
   * `contenedorContenido`): Dashboard y Órdenes NO exponen un botón
   * "Refrescar" propio dentro de su contenedor de contenido — solo Tablero y
   * Repuestos lo tienen, por eso no existe un método equivalente para los
   * otros dos tabs.
   */
  async refrescarRepuestos() {
    await this.page.locator(L.BTN_REFRESCAR_REPUESTOS).click();
  }

  // ─── Configurar Tablero (modo de tarjeta: Detallado / Compacto) ─────────────

  get modalConfigurarTablero(): Locator {
    return this.page.locator(L.MODAL_CONFIGURAR_TABLERO);
  }

  /** Abre el modal "Configurar Tablero" desde el menú "⋮" del encabezado del módulo. */
  async abrirConfigurarTablero() {
    await this.page.locator(L.BTN_MAS_OPCIONES).click();

    const link = this.page.locator(L.LINK_CONFIGURAR_TABLERO);
    await expect(link, 'El enlace "Configurar tablero" no apareció en el menú "⋮"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await link.click();

    await expect(this.modalConfigurarTablero, 'El modal "Configurar Tablero" no se abrió').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  private opcionModoTarjeta(modo: ModoTarjetaTablero): Locator {
    const valor = modo === 'compacto' ? 'compact' : 'detailed';
    return this.modalConfigurarTablero.locator(`.ervk-card-mode-option[data-card-view-mode="${valor}"]`);
  }

  /** Modo de tarjeta actualmente marcado DENTRO del modal (no implica que ya esté guardado/aplicado). */
  async modoTarjetaSeleccionadoEnModal(): Promise<ModoTarjetaTablero> {
    const clases = (await this.opcionModoTarjeta('detallado').getAttribute('class')) ?? '';
    return clases.split(/\s+/).includes('active') ? 'detallado' : 'compacto';
  }

  /** Selecciona un modo de tarjeta dentro del modal ya abierto (todavía sin guardar). */
  async seleccionarModoTarjeta(modo: ModoTarjetaTablero) {
    await this.opcionModoTarjeta(modo).click();
    await esperarQuedaActivo(async () => (await this.modoTarjetaSeleccionadoEnModal()) === modo);
  }

  /**
   * Guarda la configuración del tablero. Confirmado en vivo: al guardar
   * aparece un toast ("Configuración guardada exitosamente") y el modal se
   * cierra solo, pero no de inmediato — se hace polling directo sobre
   * `isVisible()` (más estable en este modal que encadenar
   * `expect(...).toBeHidden()`) en vez de una espera fija.
   */
  async guardarConfigTablero() {
    await this.page.locator(L.BTN_GUARDAR_CONFIG_TABLERO).click();

    await expect
      .poll(() => this.modalConfigurarTablero.isVisible(), { timeout: TIMEOUTS.GUARDAR_CONFIG_TABLERO })
      .toBe(false);
  }

  /**
   * El cambio de modo de tarjeta no se refleja en las tarjetas ya
   * renderizadas hasta refrescar el caché del propio tablero (confirmado en
   * vivo: botón "Refrescar" del tablero) — no es un simple re-render en
   * cliente al guardar.
   */
  async refrescarTablero() {
    await this.page.locator(L.BTN_REFRESCAR_TABLERO).click();
  }

  /** Modo de tarjeta realmente aplicado en el tablero, leído de la primera tarjeta real (no del modal). */
  async modoTarjetaActivoEnTablero(): Promise<ModoTarjetaTablero> {
    const primera = this.page.locator(L.TARJETA_ORDEN).first();
    await expect(primera, 'No hay ninguna tarjeta visible en el tablero para verificar el modo aplicado').toBeVisible({ timeout: TIMEOUTS.CARGA });

    const clases = (await primera.getAttribute('class')) ?? '';
    return clases.includes('ervk-kanban-card-compact') ? 'compacto' : 'detallado';
  }

  // ─── Reporte de Órdenes ───────────────────────────────────────────────────

  /**
   * Abre "Reporte de Órdenes" desde el menú "⋮" del encabezado. Confirmado en
   * vivo: es un enlace `href` normal (no `data-toggle="modal"` ni
   * `target="_blank"`) — navega en la MISMA pestaña a `/reports/order_report`,
   * un módulo aparte, no un modal.
   */
  async abrirReporteOrdenes() {
    await this.page.locator(L.BTN_MAS_OPCIONES).click();

    const link = this.page.locator(L.LINK_REPORTE_ORDENES);
    await expect(link, 'El enlace "Reporte de órdenes" no apareció en el menú "⋮"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await link.click();

    await this.page.waitForURL(/\/reports\/order_report/, { timeout: TIMEOUTS.NAVIGATE });
  }

  /** Encabezado principal del Reporte de Órdenes ya cargado (confirmado en vivo: `<h1 class="gn-title">`). */
  get encabezadoReporteOrdenes(): Locator {
    return this.page.locator(L.HEADING_REPORTE_ORDENES, { hasText: 'Reporte de órdenes' });
  }

  // ─── Administración de WhatsApp ─────────────────────────────────────────────

  get modalAdminWhatsapp(): Locator {
    return this.page.locator(L.MODAL_ADMIN_WHATSAPP);
  }

  /** Abre el modal "Admin. Whatsapp" desde el menú "⋮" del encabezado. */
  async abrirAdminWhatsapp() {
    await this.page.locator(L.BTN_MAS_OPCIONES).click();

    const link = this.page.locator(L.LINK_ADMIN_WHATSAPP);
    await expect(link, 'El enlace "Admin. Whatsapp" no apareció en el menú "⋮"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await link.click();

    await expect(this.modalAdminWhatsapp, 'El modal "Admin. Whatsapp" no se abrió').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Busca un mensaje predefinido por su teclado/texto (input + botón "Buscar" del modal ya abierto). */
  async buscarMensajeWhatsapp(termino: string) {
    await this.page.locator(L.INPUT_BUSCAR_WHATSAPP).fill(termino);
    await this.page.locator(L.BTN_BUSCAR_WHATSAPP).click();
  }

  /** Números de teclado/mensajes actualmente listados en la tabla del modal (ya abierto). */
  async obtenerFilasWhatsapp(): Promise<string[]> {
    return this.page.locator(`${L.TABLA_WHATSAPP} tr`).allTextContents();
  }

  /**
   * Abre el formulario "Agregar" del modal de Admin. Whatsapp (botón
   * "Agregar" de la barra de herramientas) — reutiliza el mismo formulario
   * que "Editar", confirmado en vivo (mismo contenedor `#edit_whatsapp_message`,
   * mismos campos `#txt_shortcut`/`#txt_message`).
   */
  async abrirFormularioAgregarWhatsapp() {
    await this.page.locator(L.BTN_AGREGAR_WHATSAPP).click();
    await expect(
      this.page.locator(L.FORM_WHATSAPP),
      'El formulario de agregar/editar mensaje de Whatsapp no apareció'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Llena teclado + mensaje en el formulario de Whatsapp ya abierto. */
  async llenarFormularioWhatsapp(datos: { teclado: string; mensaje: string }) {
    await this.page.locator(L.INPUT_WHATSAPP_TECLADO).fill(datos.teclado);
    await this.page.locator(L.INPUT_WHATSAPP_MENSAJE).fill(datos.mensaje);
  }

  /** Guarda el formulario de Whatsapp ya abierto (botón "Guardar" → `update_whatsapp_message()`). */
  async guardarFormularioWhatsapp() {
    await this.page.locator(L.BTN_GUARDAR_WHATSAPP).click();
  }

  /** Cancela el formulario de Whatsapp ya abierto sin guardar (botón "Cancelar" → vuelve al listado). */
  async cancelarFormularioWhatsapp() {
    await this.page.locator(L.BTN_CANCELAR_WHATSAPP).click();
    await expect(
      this.page.locator(L.FORM_WHATSAPP),
      'El formulario de Whatsapp no se cerró tras cancelar'
    ).toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  // ─── Configurar Pasos de la Recepción (por rol) ─────────────────────────────

  get modalConfigurarPasos(): Locator {
    return this.page.locator(L.MODAL_CONFIGURAR_PASOS);
  }

  /** Abre "Configurar Pasos de la Recepción" desde el menú "⋮" del encabezado. */
  async abrirConfigurarPasosRecepcion() {
    await this.page.locator(L.BTN_MAS_OPCIONES).click();

    const link = this.page.locator(L.LINK_CONFIGURAR_PASOS);
    await expect(link, 'El enlace "Configurar Pasos de la Recepción" no apareció en el menú "⋮"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await link.click();

    await expect(this.modalConfigurarPasos, 'El modal "Configurar Pasos de la Recepción" no se abrió').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Fila de la matriz para un paso específico, por su nombre visible (ej. "Abonos", "Enderezado y Pintura"). */
  private filaPasoRecepcion(nombrePaso: string): Locator {
    return this.modalConfigurarPasos.locator('tr').filter({ hasText: nombrePaso });
  }

  /** Checkbox (interruptor) del paso `nombrePaso` para el rol Administrador (`data-role-id="1"`, confirmado en vivo). */
  checkboxPasoAdministrador(nombrePaso: string): Locator {
    return this.filaPasoRecepcion(nombrePaso).locator(`input.srv-switch-input[data-role-id="${L.ROLE_ID_ADMINISTRADOR}"]`);
  }

  /** Nombres de todos los pasos actualmente listados en la matriz (respeta el filtro de búsqueda activo, si hay uno). */
  async obtenerNombresPasosMatriz(): Promise<string[]> {
    return this.modalConfigurarPasos.locator('.srv-step-name').allTextContents();
  }

  /** Busca un paso por nombre/descripción dentro de la matriz ya abierta. */
  async buscarPasoEnMatriz(termino: string) {
    await this.page.locator(L.INPUT_BUSCAR_PASO).fill(termino);
    await this.page.locator(L.BTN_BUSCAR_PASO).click();
  }

  /** Busca un rol por nombre dentro de la matriz ya abierta (filtra las columnas visibles). */
  async buscarRolEnMatriz(termino: string) {
    await this.page.locator(L.INPUT_BUSCAR_ROL_PASO).fill(termino);
    await this.page.locator(L.BTN_BUSCAR_ROL_PASO).click();
  }

  /**
   * Deja el paso `nombrePaso` en el estado `activo` pedido para Administrador
   * (activa/desactiva solo si hace falta). Confirmado en vivo: el `<input
   * type="checkbox">` real queda visualmente oculto detrás del interruptor
   * (`.srv-slider`, el switch estilizado) — Playwright lo considera "no
   * visible" para hacer click directamente sobre él (aunque sí se puede leer
   * su estado con `isChecked()`), así que el clic se hace sobre su `<label
   * class="srv-switch">` contenedor, que sí es el elemento realmente
   * interactivo en pantalla.
   */
  async establecerPasoAdministrador(nombrePaso: string, activo: boolean) {
    const checkbox = this.checkboxPasoAdministrador(nombrePaso);
    if ((await checkbox.isChecked()) !== activo) {
      await checkbox.locator('xpath=..').click();
    }
    await expect(checkbox).toBeChecked({ checked: activo });
  }

  /**
   * Guarda la configuración de pasos. Confirmado en vivo: "Guardar" dispara
   * la petición real `save_repair_order_step_matrix_by_role_web` y, a veces
   * (no de forma consistente entre corridas), un SweetAlert de confirmación
   * ("Configuración actualizada correctamente") con un `.sweet-overlay` que
   * tapa el modal.
   *
   * También confirmado en vivo, en varias fallas reales distintas: (1)
   * esperar a que el modal "se cierre solo" no es confiable — quedó visible
   * más de 60s pese a que el guardado ya había respondido 200 sin ningún
   * SweetAlert pendiente; y (2) el propio clic en "Guardar" puede no llegar
   * a disparar la petición en absoluto bajo carga real del ambiente
   * compartido. Confirmado también que un `.click()` sin `timeout` propio
   * puede quedarse esperando hasta el timeout global del test entero en vez
   * de fallar rápido y dejar reintentar — por eso cada intento de clic usa un
   * timeout corto y acotado, permitiendo varios intentos reales dentro del
   * mismo presupuesto total, hasta confirmar la petición real por red. El
   * cierre del modal se fuerza con su botón "×" (`#srv-close`) si no se
   * cierra solo.
   */
  async guardarConfigPasos() {
    const esRespuestaGuardado = (r: import('@playwright/test').Response) =>
      r.url().includes('save_repair_order_step_matrix_by_role_web') && r.request().method() === 'POST';

    let guardado = false;
    for (let intento = 1; intento <= 6 && !guardado; intento++) {
      const respuestaGuardado = this.page.waitForResponse(esRespuestaGuardado, { timeout: TIMEOUTS.CARGA }).then(
        () => true,
        () => false
      );
      await this.page
        .locator(L.BTN_GUARDAR_PASOS)
        .click({ timeout: TIMEOUTS.CARGA })
        .catch(() => {});
      guardado = await respuestaGuardado;
    }
    expect(guardado, 'El clic en "Guardar" nunca disparó la petición real de guardado tras varios intentos').toBe(true);

    const alertaOk = this.page.locator('.sweet-alert').last().getByRole('button', { name: 'OK' });
    const aparecioAlerta = await alertaOk
      .waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA })
      .then(() => true)
      .catch(() => false);
    if (aparecioAlerta) await alertaOk.click();

    if (await this.modalConfigurarPasos.isVisible()) {
      await this.page.locator('#srv-close').click();
    }
    await expect(this.modalConfigurarPasos, 'El modal de Configurar Pasos no se cerró tras guardar').toBeHidden({
      timeout: TIMEOUTS.CARGA,
    });
  }

  /** Cancela sin guardar los cambios hechos en la matriz. */
  async cancelarConfigPasos() {
    await this.page.locator(L.BTN_CANCELAR_PASOS).click();
    await expect(this.modalConfigurarPasos, 'El modal de Configurar Pasos no se cerró tras cancelar').toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  // ─── Configurar Flujo de Trabajo → Ajustes Generales ────────────────────────

  get modalAjustesGenerales(): Locator {
    return this.page.locator(L.MODAL_AJUSTES_GENERALES);
  }

  /**
   * Entra al "modo edición" de "Configurar Flujo de Trabajo" desde el menú
   * "⋮" del encabezado — no abre un modal todavía, solo activa el banner y
   * los lápices por etapa sobre el propio tablero.
   */
  async abrirConfigurarFlujoTrabajo() {
    await this.page.locator(L.BTN_MAS_OPCIONES).click();

    const link = this.page.locator(L.LINK_CONFIGURAR_FLUJO_TRABAJO);
    await expect(link, 'El enlace "Configurar Flujo de Trabajo" no apareció en el menú "⋮"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await link.click();

    await expect(
      this.page.locator(L.BANNER_MODO_EDICION_FLUJO),
      'El modo edición de "Configurar Flujo de Trabajo" no se activó'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Abre "Ajustes Generales" (lápiz de esa etapa) ya en modo edición de "Configurar Flujo de Trabajo". */
  async abrirAjustesGenerales() {
    const pencil = this.page.locator(L.BTN_EDITAR_AJUSTES_GENERALES);
    await expect(pencil, 'El lápiz de "Ajustes Generales" no está visible en modo edición').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await pencil.click();

    await expect(this.modalAjustesGenerales, 'El modal "Ajustes Generales" no se abrió').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Sale del modo edición de "Configurar Flujo de Trabajo". Confirmado en
   * vivo: mientras el modo edición sigue activo, los tabs normales del
   * módulo (Tablero/Órdenes/Repuestos) quedan bloqueados — hay que salir
   * explícitamente antes de continuar con cualquier otro flujo del módulo.
   */
  async salirModoEdicionFlujoTrabajo() {
    await this.page.locator(L.BTN_SALIR_MODO_EDICION_FLUJO).click();
    await expect(
      this.page.locator(L.BANNER_MODO_EDICION_FLUJO),
      'El modo edición de "Configurar Flujo de Trabajo" no se desactivó'
    ).toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  /** Checkbox (interruptor) del permiso `settingSlug` para el rol Administrador, dentro de "Ajustes Generales" ya abierto. */
  checkboxPermisoAdministrador(settingSlug: string): Locator {
    return this.modalAjustesGenerales.locator(
      `input.awr-role-switch-input[data-setting-slug="${settingSlug}"][data-role-id="${L.ROLE_ID_ADMINISTRADOR}"]`
    );
  }

  /** Nombres de todos los permisos actualmente listados (respeta el filtro de búsqueda activo, si hay uno). */
  async obtenerNombresPermisosMatriz(): Promise<string[]> {
    return this.modalAjustesGenerales.locator('.awr-grid-cell-sticky strong').allTextContents();
  }

  /** `data-setting-slug` de todos los permisos listados para Administrador, en el mismo orden que `obtenerNombresPermisosMatriz()`. */
  async obtenerSlugsPermisosMatriz(): Promise<string[]> {
    return this.modalAjustesGenerales
      .locator(`input.awr-role-switch-input[data-role-id="${L.ROLE_ID_ADMINISTRADOR}"]`)
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-setting-slug') ?? ''));
  }

  /** Busca un permiso por nombre/descripción dentro de "Ajustes Generales" ya abierto. */
  async buscarPermisoEnMatriz(termino: string) {
    await this.page.locator(L.INPUT_BUSCAR_PERMISO).fill(termino);
    await this.page.locator(L.BTN_BUSCAR_PERMISO).click();
  }

  /** Busca un rol por nombre dentro de "Ajustes Generales" ya abierto. */
  async buscarRolEnMatrizPermisos(termino: string) {
    await this.page.locator(L.INPUT_BUSCAR_ROL_PERMISO).fill(termino);
    await this.page.locator(L.BTN_BUSCAR_ROL_PERMISO).click();
  }

  /** Deja el permiso `settingSlug` en el estado `activo` pedido para Administrador (mismo patrón de switch oculto que "Configurar Pasos"). */
  async establecerPermisoAdministrador(settingSlug: string, activo: boolean) {
    const checkbox = this.checkboxPermisoAdministrador(settingSlug);
    if ((await checkbox.isChecked()) !== activo) {
      await checkbox.locator('xpath=..').click();
    }
    await expect(checkbox).toBeChecked({ checked: activo });
  }

  /**
   * Guarda "Ajustes Generales". Confirmado en vivo: dispara la petición real
   * `new-workflow-reception/adjust-workflow/stage-save` y, al igual que
   * "Configurar Pasos" (mismo patrón, no exclusivo de esa sección como se
   * asumió en un intento anterior), también puede mostrar un SweetAlert de
   * confirmación con `.sweet-overlay` — si no se cierra, bloquea cualquier
   * clic posterior en la página (confirmado en vivo: impidió reabrir el
   * lápiz de "Ajustes Generales" en el intento siguiente). Mismo patrón de
   * reintento acotado del clic que `guardarConfigPasos()`, atado a la
   * respuesta real de red en vez de asumir que el primer clic siempre llega.
   */
  async guardarAjustesGenerales() {
    const esRespuestaGuardado = (r: import('@playwright/test').Response) =>
      r.url().includes('adjust-workflow/stage-save') && r.request().method() === 'POST';

    let guardado = false;
    for (let intento = 1; intento <= 6 && !guardado; intento++) {
      const respuestaGuardado = this.page.waitForResponse(esRespuestaGuardado, { timeout: TIMEOUTS.CARGA }).then(
        () => true,
        () => false
      );
      await this.page
        .locator(L.BTN_GUARDAR_AJUSTES_GENERALES)
        .click({ timeout: TIMEOUTS.CARGA })
        .catch(() => {});
      guardado = await respuestaGuardado;
    }
    expect(guardado, 'El clic en "Guardar" de Ajustes Generales nunca disparó la petición real tras varios intentos').toBe(true);

    const alertaOk = this.page.locator('.sweet-alert').last().getByRole('button', { name: 'OK' });
    const aparecioAlerta = await alertaOk
      .waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA })
      .then(() => true)
      .catch(() => false);
    if (aparecioAlerta) await alertaOk.click();

    if (await this.modalAjustesGenerales.isVisible()) {
      await this.page.locator('#awr-modal-close').click();
    }
    await expect(this.modalAjustesGenerales, 'El modal de Ajustes Generales no se cerró tras guardar').toBeHidden({
      timeout: TIMEOUTS.CARGA,
    });
  }

  /** Cancela sin guardar los cambios hechos en "Ajustes Generales". */
  async cancelarAjustesGenerales() {
    await this.page.locator(L.BTN_CANCELAR_AJUSTES_GENERALES).click();
    await expect(this.modalAjustesGenerales, 'El modal de Ajustes Generales no se cerró tras cancelar').toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  // ─── Crear Recepción / Nueva orden de reparación ────────────────────────────

  get modalNuevaRecepcion(): Locator {
    return this.page.locator(L.MODAL_NUEVA_RECEPCION);
  }

  /** Abre el modal inicial de "Placa del vehículo" desde el botón "+ Recepción" del encabezado. */
  async abrirNuevaRecepcion() {
    await this.page.locator(L.BTN_NUEVA_RECEPCION).click();
    await expect(this.modalNuevaRecepcion, 'El modal de placa del vehículo no se abrió').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Activa el interruptor "No tiene Placa / Matrícula" del modal inicial.
   * Confirmado en vivo: solo afecta la validación de ESTE modal (permite
   * continuar sin llenar `INPUT_PLACA_MODAL`) — el paso "Detalles del
   * vehículo" del wizard sigue exigiendo su propio campo de placa por
   * separado (ver `llenarPlacaDetalleVehiculo`).
   */
  async activarSinPlacaEnModal() {
    await this.page.locator(L.TOGGLE_SIN_PLACA).click();
    await esperarQuedaActivo(() => this.page.locator(L.CHECKBOX_SIN_PLACA).isChecked());
  }

  /**
   * Escribe una placa en el modal inicial y confirma con "Agregar vehículo".
   * Confirmado en vivo: este botón SIEMPRE trata la placa como la de un
   * vehículo nuevo, sin importar si ya existe uno igual — para reutilizar un
   * vehículo ya existente hay que usar `buscarYReutilizarVehiculoExistente`
   * (botón "Buscar"), no este método. `placa` puede ir vacío junto con
   * `activarSinPlacaEnModal()` para el flujo "sin placa".
   */
  async agregarVehiculoNuevo(placa: string) {
    await this.page.locator(L.INPUT_PLACA_MODAL).fill(placa);
    await this.page.locator(L.BTN_AGREGAR_VEHICULO_MODAL).click();
  }

  /**
   * Busca un vehículo YA EXISTENTE por su placa en el modal inicial (botón
   * "Buscar"). Confirmado en vivo: si el vehículo ya tiene una orden de
   * trabajo abierta —el caso normal en este ambiente compartido, donde casi
   * todos los vehículos de prueba ya tienen historial— el sistema muestra un
   * diálogo de confirmación ("Vehículo con orden abierta") en vez de una
   * lista de resultados; este método resuelve ambos casos.
   *
   * Reintenta la búsqueda (no solo la espera) hasta 3 veces si ninguno de
   * los dos resultados aparece: confirmado en vivo que la misma placa, con
   * la misma búsqueda, puede devolver una respuesta vacía de forma
   * intermitente bajo carga del ambiente compartido — sin ser un error real
   * de la aplicación (la búsqueda inmediatamente siguiente, idéntica, sí
   * encuentra el vehículo).
   *
   * Devuelve `'wizard'` si el flujo queda esperando en el paso "Detalles del
   * vehículo" (o antes, en "Seleccionar Cliente") para que quien llama lo
   * complete, o `'completado'` si "Crear nueva orden" ya generó la orden de
   * una vez y devolvió directamente al panel de Recepción. Confirmado en
   * vivo: para un vehículo con VARIAS órdenes previas ya abiertas —el caso
   * de la placa fija de prueba de este archivo tras ejecuciones repetidas—
   * el sistema a veces resuelve la orden nueva de inmediato en vez de
   * entrar al wizard, así que ambos desenlaces son válidos y no un error.
   */
  async buscarYReutilizarVehiculoExistente(placa: string): Promise<'wizard' | 'completado'> {
    const dialogoOrdenAbierta = this.page.getByRole('heading', { name: 'Vehículo con orden abierta' });
    const filaResultado = this.page
      .locator(L.CONTENEDOR_RESULTADOS_BUSQUEDA_VEHICULO)
      .locator('tr[onclick*="setVehiculeToRepairOrder"]')
      .first();

    const estadoBusqueda = async () => {
      if (await dialogoOrdenAbierta.isVisible()) return 'dialogo';
      if (await filaResultado.isVisible()) return 'fila';
      return 'ninguno';
    };

    let resultado: string = 'ninguno';
    for (let intento = 1; intento <= 3 && resultado === 'ninguno'; intento++) {
      await this.page.locator(L.INPUT_PLACA_MODAL).fill(placa);
      await this.page.locator(L.BTN_BUSCAR_VEHICULO_MODAL).click();
      try {
        await expect.poll(estadoBusqueda, { timeout: TIMEOUTS.CARGA / 2 }).not.toBe('ninguno');
      } catch {
        // se agota este intento; el bucle reintenta la búsqueda desde cero
      }
      resultado = await estadoBusqueda();
    }
    expect(resultado, `La búsqueda de la placa "${placa}" no encontró ningún vehículo tras 3 intentos`).not.toBe('ninguno');

    // Usa el `resultado` ya determinado (no vuelve a preguntar
    // `isVisible()`): un diálogo que estaba visible en el poll puede dejar
    // de estarlo un instante después (p. ej. si se está cerrando), y
    // rechequear aquí llevaría por error a la rama "fila" sin ningún
    // elemento real que clickear.
    if (resultado === 'dialogo') {
      await this.page.getByRole('button', { name: 'Crear nueva orden' }).click();
    } else {
      await filaResultado.click();
    }

    // Tras resolver, el flujo puede caer directo en "Detalles del vehículo"
    // (el vehículo ya traía cliente/estilo asociados), quedar en
    // "Seleccionar Cliente" (falta ese paso), o la orden queda creada de una
    // vez sin entrar al wizard — confirmado en vivo que este tercer caso
    // puede dejar distintos residuos visuales según el vehículo (el modal
    // inicial reiniciado, u otro estado), así que en vez de enumerarlos
    // todos, se espera un tiempo razonable únicamente por el wizard y,
    // si no aparece, se asume completado y se cierra cualquier modal que
    // haya quedado abierto — la prueba de verdad ("la orden se generó")
    // queda a cargo de quien llama, revisando el tab Órdenes.
    const detalles = this.page.locator(L.GRUPO_DETALLES_VEHICULO);
    const clienteWizard = this.page.locator(L.CONTENEDOR_CLIENTES_WIZARD).locator(L.TARJETA_CLIENTE_WIZARD).first();

    const entroAlWizard = await expect
      .poll(async () => (await detalles.isVisible()) || (await clienteWizard.isVisible()), { timeout: TIMEOUTS.CARGA })
      .toBe(true)
      .then(() => true)
      .catch(() => false);

    if (!entroAlWizard) {
      if (await this.modalNuevaRecepcion.isVisible().catch(() => false)) {
        await this.modalNuevaRecepcion.getByRole('button', { name: 'Cerrar' }).click().catch(() => {});
        await expect(this.modalNuevaRecepcion).toBeHidden({ timeout: TIMEOUTS.CARGA }).catch(() => {});
      }
      return 'completado';
    }

    if (await clienteWizard.isVisible()) {
      await this.seleccionarPrimerClienteWizard();
      await this.avanzarWizard();
      await this.esperarDetallesVehiculoVisible();
    }
    return 'wizard';
  }

  /**
   * Selecciona el primer cliente disponible en el paso "Seleccionar
   * Cliente" del wizard. Timeout ampliado (no TIMEOUTS.CARGA): confirmado en
   * vivo que la grilla completa de clientes puede tardar más que el límite
   * general en poblarse bajo carga del ambiente compartido.
   */
  async seleccionarPrimerClienteWizard() {
    const tarjeta = this.page.locator(L.CONTENEDOR_CLIENTES_WIZARD).locator(L.TARJETA_CLIENTE_WIZARD).first();
    await expect(tarjeta, 'No hay ningún cliente disponible para seleccionar en el wizard').toBeVisible({ timeout: TIMEOUTS.CARGA_LISTADO_COMPLETO });
    await tarjeta.click();
  }

  /** Avanza al siguiente paso del wizard (botón "Siguiente" del pie del wizard). */
  async avanzarWizard() {
    await this.page.getByRole('button', { name: /Siguiente/ }).click();
  }

  /** Avanza varios pasos seguidos del wizard (para pasos intermedios que no requieren ninguna acción, p. ej. Inspección/Enderezado y Pintura/Abonos en una Orden sencilla). */
  async avanzarWizardVeces(veces: number) {
    for (let i = 0; i < veces; i++) await this.avanzarWizard();
  }

  /** Espera a que el paso "Detalles del vehículo" del wizard esté realmente cargado. */
  async esperarDetallesVehiculoVisible() {
    await expect(
      this.page.locator(L.GRUPO_DETALLES_VEHICULO),
      'El paso "Detalles del vehículo" no cargó'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  private chosenDeSelect(selectorId: string): Locator {
    return this.page.locator(selectorId).locator('xpath=following-sibling::div[contains(@class,"chosen-container")][1]');
  }

  /**
   * Fuerza a Chosen a recalcular el ancho/posición de su contenedor
   * disparando su propio evento `chosen:updated`. Causa raíz confirmada en
   * vivo (inspeccionando `getBoundingClientRect()`): cuando el `<select>`
   * vive en un paso del wizard que estaba oculto (`display:none`) en el
   * momento en que Chosen se inicializó, su contenedor queda con un ancho
   * medido incorrectamente (~25px en vez de ~267px) y su `.chosen-drop` se
   * renderiza desplazado miles de píxeles fuera del viewport — Playwright
   * ve el `<li>` como "visible y estable" pero el click reintenta
   * indefinidamente por "element is outside of the viewport". Disparar
   * `chosen:updated` (la propia API pública del plugin) una vez el paso ya
   * es visible corrige la medición sin necesidad de ningún workaround de
   * scroll.
   */
  private async refrescarChosen(selectorId: string) {
    // No basta con disparar `chosen:updated` una sola vez inmediatamente
    // después de cambiar de paso del wizard: confirmado en vivo que, justo
    // tras el cambio de paso, el contenedor de Chosen puede seguir
    // reportando ancho 0 (el panel aún no terminó de mostrarse) — disparar
    // el evento en ese instante no tiene ningún efecto. Se reintenta el
    // disparo en cada sondeo hasta que el contenedor realmente tenga un
    // ancho razonable (>50px descarta tanto el 0 de "panel aún oculto" como
    // el ~25px corrupto documentado antes de medir con el panel oculto).
    await expect
      .poll(
        () =>
          this.page.evaluate((sel) => {
            const jq = (window as unknown as { jQuery?: (s: string) => { trigger: (e: string) => void } }).jQuery;
            jq?.(sel).trigger('chosen:updated');
            const contenedor = document.querySelector(sel)?.nextElementSibling as HTMLElement | null;
            return contenedor?.getBoundingClientRect().width ?? 0;
          }, selectorId),
        { timeout: TIMEOUTS.CARGA }
      )
      .toBeGreaterThan(50);
  }

  /**
   * Abre el combo y espera a que su panel de resultados (`.chosen-results
   * li.active-result`) esté realmente listo. Para combos cuyas opciones
   * nativas se pueblan tarde vía AJAX (ej. Modelo, que depende de Marca):
   * confirmado en vivo que el `<select>` nativo puede ya tener
   * `options.length > 0` mientras Chosen todavía no reconstruyó su panel a
   * partir de esas opciones nuevas — son dos sincronizaciones
   * independientes del plugin, y el panel solo refleja el estado real una
   * vez abierto. Si al abrir no aparece ningún resultado, se cierra
   * (Escape) y se reintenta un número acotado de veces en vez de fallar de
   * inmediato o esperar a ciegas.
   */
  private async abrirChosenConResultados(selectorId: string): Promise<Locator> {
    const contenedor = this.chosenDeSelect(selectorId);
    const resultados = contenedor.locator('.chosen-results li.active-result');

    for (let intento = 1; intento <= 3; intento++) {
      await this.refrescarChosen(selectorId);
      await contenedor.locator('a.chosen-single').click();

      const aparecieron = await resultados
        .first()
        .waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA })
        .then(() => true)
        .catch(() => false);
      if (aparecieron) return resultados;

      if (intento < 3) await this.page.keyboard.press('Escape');
    }

    await expect(resultados.first(), `El combo "${selectorId}" no mostró ninguna opción`).toBeVisible({ timeout: TIMEOUTS.CARGA });
    return resultados;
  }

  /** Selecciona una opción de un combo "Chosen" del wizard por su texto visible. */
  async seleccionarOpcionChosen(selectorId: string, texto: string) {
    const resultados = await this.abrirChosenConResultados(selectorId);
    await resultados.filter({ hasText: texto }).first().click();
  }

  /**
   * Selecciona la primera opción REAL disponible de un combo "Chosen" del
   * wizard — para campos donde no importa cuál, solo que exista uno.
   * Descarta explícitamente una opción de tipo placeholder si aparece como
   * el primer `.active-result`: confirmado en vivo que varios combos de este
   * módulo ("Tipo de Vehículo" en Enderezado y Pintura, "Forma de pago" y
   * "Aplicar a caja" en Abonos) SÍ incluyen su placeholder como un
   * `.active-result` más (a diferencia de Marca/Modelo/Combustible, donde el
   * primer resultado ya es una opción real) — sin este filtro, `.first()`
   * seleccionaba el placeholder y el campo quedaba vacío en silencio.
   *
   * El placeholder se identifica por el `value=""` de la opción original en
   * el `<select>` nativo (el estándar HTML para opciones placeholder), no
   * por su texto — un intento anterior de detectarlo por texto
   * ("Seleccione...") no cubría placeholders con otra redacción ("Forma de
   * pago", "Caja"), y ambos combos de Abonos quedaban sin seleccionar.
   */
  async seleccionarPrimeraOpcionChosen(selectorId: string) {
    const resultados = await this.abrirChosenConResultados(selectorId);

    // Se hace matchear por TEXTO (no por índice) contra la lista de
    // `.active-result`: Chosen puede omitir opciones deshabilitadas/ocultas
    // del `<select>` nativo al construir su lista, así que un índice del
    // select no garantiza corresponder al mismo índice en `.active-result`.
    const textoOpcionReal = await this.page.evaluate((sel) => {
      const opciones = Array.from((document.querySelector(sel) as HTMLSelectElement | null)?.options ?? []);
      return opciones.find((o) => o.value.trim() !== '')?.text.trim() ?? null;
    }, selectorId);

    const opcion = textoOpcionReal ? resultados.filter({ hasText: textoOpcionReal }).first() : resultados.first();

    // Si la opción identificada como "real" ya está marcada como
    // seleccionada, es en realidad el placeholder (confirmado en vivo para
    // "Contacto de aseguradora": para aseguradoras sin contactos configurados,
    // el placeholder es la ÚNICA opción y no tiene `value=""`, así que el
    // heurístico por valor la toma como "real" por error) — no hay ninguna
    // opción distinta para elegir, así que se cierra el combo sin clic en vez
    // de reintentar indefinidamente un clic sobre un elemento ya activo.
    const yaSeleccionada = await opcion.evaluate((el) => el.classList.contains('result-selected'));
    if (yaSeleccionada) {
      await this.page.keyboard.press('Escape');
      return;
    }

    await opcion.click();
  }

  /**
   * Completa el mínimo de "Detalles del vehículo" necesario para poder
   * guardar (confirmado en vivo): Marca + Modelo + Tipo de combustible.
   * Transmisión, Número de unidad, colores, batería, etc. quedan con sus
   * valores por defecto — no son obligatorios para guardar. Modelo depende
   * de Marca (se puebla vía AJAX), por eso se espera a que tenga opciones
   * antes de intentar seleccionarlo.
   */
  async completarDetallesVehiculoMinimo(marca: string = MARCA_VEHICULO_PRUEBA) {
    await this.esperarDetallesVehiculoVisible();
    await this.seleccionarOpcionChosen(L.SELECT_MARCA, marca);

    await expect
      .poll(
        () => this.page.evaluate((sel) => (document.querySelector(sel) as HTMLSelectElement | null)?.options.length ?? 0, L.SELECT_MODELO),
        { timeout: TIMEOUTS.CARGA }
      )
      .toBeGreaterThan(0);

    await this.seleccionarPrimeraOpcionChosen(L.SELECT_MODELO);
    await this.seleccionarPrimeraOpcionChosen(L.SELECT_COMBUSTIBLE);
  }

  /**
   * Completa TODOS los campos disponibles de "Detalles del vehículo" (para
   * Orden completa/avanzada) — Marca, Modelo, Año, Tipo de vehículo,
   * Combustible, Transmisión, Número de unidad, Kilometraje, ¿Son millas?, y
   * las dos secciones colapsables "Carrocería" y "Aseguradora" completas.
   *
   * Excluye a propósito los widgets "Nivel del combustible"/"Nivel de
   * temperatura": son un gauge circular arrastrable sin ningún `<input>`
   * nativo asociado (confirmado en vivo, sin `canvas`/`svg` tampoco — es un
   * widget de arrastre puro por CSS/JS) y no están entre los campos
   * explícitamente nombrados por la tarea; interactuar con un arrastre
   * circular de forma fiable no se justifica frente a su valor cosmético.
   */
  async completarDetallesVehiculoCompleto(marca: string = MARCA_VEHICULO_PRUEBA) {
    await this.completarDetallesVehiculoMinimo(marca);

    await this.seleccionarPrimeraOpcionChosen(L.SELECT_ANIO);
    await this.seleccionarPrimeraOpcionChosen(L.SELECT_TIPO_VEHICULO);
    await this.seleccionarPrimeraOpcionChosen(L.SELECT_TRANSMISION);

    await this.page.locator(L.INPUT_NUMERO_UNIDAD).fill('UNIDAD-QA');
    await this.page.locator(L.INPUT_KILOMETRAJE).fill('12345');
    await this.page.locator(L.INPUT_PORCENTAJE_BATERIA).fill('80');
    // El checkbox real queda oculto tras su slider visual (mismo patrón que
    // TOGGLE_SIN_PLACA) — el click debe ir sobre su <label>, no el input.
    await this.page.locator(L.TOGGLE_SON_MILLAS).locator('xpath=ancestor::label[1]').click();

    // Carrocería
    await this.page.getByText('Carrocería', { exact: true }).click();
    await this.page.locator(L.INPUT_NUMERO_CHASIS).fill('CHASIS-QA');
    await this.page.locator(L.INPUT_NUMERO_MOTOR).fill('MOTOR-QA');
    await this.page.locator(L.INPUT_TIPO_ACEITE).fill('Sintético');
    await this.page.locator(L.INPUT_FILTRO_ACEITE).fill('Filtro QA');
    await this.page.locator(L.INPUT_FLOTILLA).fill('Flotilla QA');

    // Aseguradora
    await this.page.locator(L.TOGGLE_SECCION_ASEGURADORA).click();
    await this.seleccionarPrimeraOpcionChosen(L.SELECT_ASEGURADORA);
    await this.seleccionarPrimeraOpcionChosen(L.SELECT_CONTACTO_ASEGURADORA);
    await this.page.locator(L.INPUT_POLIZA).fill('POLIZA-QA');
    await this.page.locator(L.INPUT_NOMBRE_ASEGURADO).fill('Asegurado QA');
    await this.page.locator(L.INPUT_NUMERO_AVISO).fill('AVISO-QA');
  }

  /**
   * Llena el campo de placa PROPIO del paso "Detalles del vehículo"
   * (distinto del campo del modal inicial) — ver la nota en
   * `L.INPUT_PLACA_DETALLE`. Sin llenarlo, "Siguiente" no dispara ninguna
   * petición ni muestra ningún error (falla silenciosa confirmada en vivo
   * inspeccionando la red): por eso `guardarDetallesVehiculo()` exige el
   * toast real de éxito en vez de solo esperar el cambio de paso.
   */
  async llenarPlacaDetalleVehiculo(valor: string) {
    await this.page.locator(L.INPUT_PLACA_DETALLE).fill(valor);
  }

  /**
   * Guarda "Detalles del vehículo" (botón "Siguiente") y confirma el mensaje
   * real de éxito de la app en vez de solo esperar el cambio de paso — así
   * una falla silenciosa (campo obligatorio faltante) hace fallar el test
   * con una causa clara en vez de quedarse esperando indefinidamente el
   * siguiente paso.
   */
  async guardarDetallesVehiculo() {
    await this.avanzarWizard();
    await expect(
      this.page.locator('.noty_bar', { hasText: /actualizado con éxito/ }),
      'No apareció el toast de "Vehículo actualizado con éxito" — probablemente falta un campo obligatorio del paso "Detalles del vehículo"'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Sale del wizard de vuelta al panel de Recepción Vehicular. */
  async regresarAOrdenesDesdeWizard() {
    await this.page.getByRole('button', { name: 'Regresar a órdenes' }).click();
    await expect(this.buscador, 'No se regresó correctamente al panel de recepción').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  // ─── Seleccionar servicios (productos y servicios de la orden) ─────────────

  /**
   * Cambia entre las pestañas "Productos"/"Servicios" del paso "Seleccionar
   * servicios". Sin `exact` (confirmado en vivo: el nombre accesible del
   * botón "Servicios" trae un espacio inicial por el ícono que lo precede,
   * lo que rompe una coincidencia exacta).
   */
  async cambiarPestanaCatalogo(pestana: 'Productos' | 'Servicios') {
    await this.page.getByRole('button', { name: pestana }).click();
  }

  /**
   * Agrega un producto real del catálogo (no uno creado por quick-add) por
   * su nombre visible. Confirmado en vivo: el catálogo se renderiza a la vez
   * en vista grilla y vista lista (ambas en el DOM, solo una visible) — por
   * eso se filtra por `visible=true` en vez de asumir un único match.
   */
  async agregarProductoDelCatalogo(nombreExacto: string = PRODUCTO_CATALOGO_PRUEBA) {
    await this.cambiarPestanaCatalogo('Productos');
    const tarjeta = this.page.getByText(nombreExacto, { exact: true }).locator('visible=true').first();
    await expect(tarjeta, `El producto "${nombreExacto}" no está disponible en el catálogo`).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await tarjeta.click();
    await expect(
      this.page.locator('.noty_bar', { hasText: 'Producto añadido' }).last(),
      'No apareció el toast de "Producto añadido a la orden"'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Agrega un servicio real del catálogo (no uno creado por quick-add) por
   * un texto parcial de su nombre visible. Busca primero por ese texto
   * (confirmado en vivo: el catálogo por defecto no lista todos los
   * servicios reales del ambiente, así que un servicio específico —p. ej.
   * uno con un paquete de inspección asociado— puede no estar entre las
   * tarjetas iniciales sin buscarlo explícitamente).
   */
  async agregarServicioDelCatalogo(textoParcial: string = SERVICIO_CATALOGO_PRUEBA) {
    await this.cambiarPestanaCatalogo('Servicios');
    await this.page.locator('#search_vehicle_service_left').fill(textoParcial);
    // Sin `exact`: mismo motivo que los demás botones con ícono de este
    // archivo (nombre accesible con espacio inicial).
    await this.page.getByRole('button', { name: 'Buscar' }).locator('visible=true').first().click();
    const tarjeta = this.page.locator('div,span').filter({ hasText: textoParcial }).locator('visible=true').last();
    await expect(tarjeta, `Ningún servicio del catálogo coincide con "${textoParcial}"`).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await tarjeta.click();
    await expect(
      this.page.locator('.noty_bar', { hasText: 'Servicio añadido' }).last(),
      'No apareció el toast de "Servicio añadido a la orden"'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Crea y agrega un "Producto Rápido" (modal "¿Desea añadir un producto
   * rápido?" → "Producto Rápido"). Distinto de `agregarProductoDelCatalogo`:
   * este NO viene del catálogo, se define aquí mismo (nombre/costo/precio).
   */
  async agregarProductoRapido(datos: { nombre: string; costo: string; precio: string }) {
    await this.cambiarPestanaCatalogo('Productos');
    await this.page.locator(L.TARJETA_AGREGAR_PRODUCTO).locator('visible=true').first().click();
    await this.page.getByRole('heading', { name: L.HEADING_TIPO_PRODUCTO, exact: true }).click();

    await this.page.locator(L.INPUT_PRODUCTO_RAPIDO_NOMBRE).fill(datos.nombre);
    await this.page.locator(L.INPUT_PRODUCTO_RAPIDO_COSTO).fill(datos.costo);
    await this.page.locator(L.INPUT_PRODUCTO_RAPIDO_PRECIO).fill(datos.precio);
    await this.page.getByRole('button', { name: 'Agregar', exact: true }).click();

    await expect(
      this.page.locator('.noty_bar', { hasText: 'Producto añadido' }).last(),
      'No apareció el toast de "Producto añadido a la orden" tras crear el producto rápido'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Crea y agrega un "Servicio Rápido" (modal "Seleccione el tipo de
   * servicio" → "Servicio Rápido"). El botón de confirmación de este modal
   * dice "Guardar", no "Agregar" (confirmado en vivo, distinto del de
   * Producto Rápido).
   */
  async agregarServicioRapido(datos: { nombre: string; precio: string }) {
    await this.cambiarPestanaCatalogo('Servicios');
    await this.page.locator(L.TARJETA_AGREGAR_SERVICIO).locator('visible=true').first().click();
    await expect(this.page.getByRole('heading', { name: L.HEADING_TIPO_SERVICIO })).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await this.page.getByRole('heading', { name: L.HEADING_SERVICIO_RAPIDO, exact: true }).click();

    await this.page.locator(L.INPUT_SERVICIO_RAPIDO_NOMBRE).fill(datos.nombre);
    await this.page.locator(L.INPUT_SERVICIO_RAPIDO_PRECIO).fill(datos.precio);
    // Sin `exact` (mismo motivo que en `cambiarPestanaCatalogo`: el nombre
    // accesible de este botón también trae un espacio inicial por su ícono).
    await this.page.getByRole('button', { name: 'Guardar' }).click();

    await expect(
      this.page.locator('.noty_bar', { hasText: 'Servicio añadido' }).last(),
      'No apareció el toast de "Servicio añadido a la orden" tras crear el servicio rápido'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Total general mostrado del carrito de la orden (paso "Seleccionar servicios"), como número. */
  async obtenerTotalGeneralCarrito(): Promise<number> {
    const texto = await this.page.locator(L.TOTAL_GENERAL_CARRITO).innerText();
    return parseMonedaCR(texto);
  }

  /** Totales individuales de cada línea (producto o servicio) actualmente en el carrito. */
  async obtenerTotalesPorLineaCarrito(): Promise<number[]> {
    const textos = await this.page.locator(L.TOTALES_POR_LINEA_CARRITO).allTextContents();
    return textos.map(parseMonedaCR);
  }

  /**
   * Ids dinámicos (`{productoId}_{numeroLinea}`, ej. "37089_1") de todas las
   * líneas actualmente en el carrito, en el orden en que aparecen — para
   * ubicar un ítem específico sobre el que operar (mecánico/garantía/
   * eliminar), ya que estos ids se generan en el servidor y no se conocen
   * de antemano.
   */
  async obtenerIdsItemsCarrito(): Promise<string[]> {
    const ids = await this.page.locator('[id^="table_product_name_"]').evaluateAll((els) => els.map((el) => el.id.replace('table_product_name_', '')));
    return ids;
  }

  /**
   * Crea un producto NUEVO real de catálogo (no un "Producto Rápido" ni un
   * ítem temporal) desde el wizard de "Producto y servicios": modal de dos
   * pasos ("Inf. General" → "Costos"). Confirmado en vivo: crearlo NO lo
   * agrega a la orden actual — solo lo deja disponible en el catálogo para
   * buscarlo y agregarlo después con `agregarProductoDelCatalogo(nombre)`
   * (el propio modal lo advierte con un tooltip: "este no se agregará de
   * manera inmediata a su lista de servicios seleccionados").
   */
  async crearProductoNuevoCatalogo(datos: { nombre: string; costo: string; precio: string }) {
    const modal = this.page.locator(L.MODAL_PRODUCTO_NUEVO);
    const btnSiguiente = modal.locator('.actions a', { hasText: 'Siguiente' });

    // Reintenta abrir el modal si el wizard interno no llegó a inicializarse:
    // confirmado en vivo (consola del navegador) que este modal dispara
    // ocasionalmente `TypeError: $(...).steps is not a function` — una
    // carrera real de la propia app entre inyectar el HTML del modal vía
    // AJAX y que el plugin jQuery Steps ya esté cargado. Cuando eso pasa,
    // el botón "Siguiente" nunca se arma. Cerrar y reabrir el modal le da
    // al plugin una nueva oportunidad de estar listo. 3 intentos (no 2):
    // confirmado en la corrida base de esta sesión que 2 intentos pueden no
    // bastar bajo carga del ambiente compartido — sigue siendo un límite
    // acotado y determinístico, no una espera ciega.
    let listo = false;
    for (let intento = 1; intento <= 3 && !listo; intento++) {
      await this.cambiarPestanaCatalogo('Productos');
      await this.page.locator(L.TARJETA_AGREGAR_PRODUCTO).locator('visible=true').first().click();
      await this.page.getByRole('heading', { name: L.HEADING_PRODUCTO_NORMAL, exact: true }).click();
      await expect(modal, 'No apareció el modal de crear producto nuevo').toBeVisible({ timeout: TIMEOUTS.CARGA });
      await this.page.locator(L.INPUT_PRODUCTO_NUEVO_NOMBRE).fill(datos.nombre);

      listo = await btnSiguiente
        .waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA })
        .then(() => true)
        .catch(() => false);
      if (!listo) {
        if (intento === 3) throw new Error('El wizard interno de crear producto nunca inicializó el botón "Siguiente"');
        // El botón "Cancelar" también lo arma el plugin jQuery Steps — si
        // falló su inicialización, "Cancelar" tampoco existe. Se usa el
        // botón "×" genérico del modal (siempre presente, ajeno al plugin)
        // para cerrarlo en ese caso.
        await modal.locator('.close').first().click({ timeout: TIMEOUTS.CARGA });
        await expect(modal, 'El modal de crear producto nuevo no se cerró tras cancelar').toBeHidden({ timeout: TIMEOUTS.CARGA });
      }
    }
    // El botón "Siguiente" de este wizard interno vive en un widget de
    // paginación aparte (`<a>` dentro de `.actions`, no un `<button>`) — hay
    // que acotar la búsqueda al modal: el wizard EXTERNO de la recepción
    // también tiene su propio botón "Siguiente", bloqueado por el overlay
    // del modal pero igual alcanzable por un `getByRole` sin acotar.
    await btnSiguiente.click();

    await this.page.locator(L.INPUT_PRODUCTO_NUEVO_COSTO).fill(datos.costo);
    await this.page.locator(L.INPUT_PRODUCTO_NUEVO_PRECIO).fill(datos.precio);
    await modal.locator('.actions a', { hasText: /^(Guardar|Finalizar)$/ }).first().click();

    await expect(
      this.page.locator('.noty_bar', { hasText: 'agregado correctamente' }).last(),
      'No apareció el toast de producto creado correctamente'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await expect(modal, 'El modal de crear producto nuevo no se cerró').toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Crea un servicio NUEVO real de catálogo ("Servicio Normal", no rápido)
   * desde el wizard. A diferencia del producto nuevo, este modal es de un
   * solo paso pero exige un flujo de dos clics: llenar los datos de la
   * sublínea del servicio y presionar "Agregar servicio" (registra esa
   * sublínea en el grupo) ANTES de "Guardar" — si se omite ese clic,
   * "Guardar" falla con el toast "¡No hay ningún servicio que guardar!" sin
   * cerrar el modal. Igual que el producto nuevo, esto NO agrega el
   * servicio a la orden actual, solo lo deja disponible en el catálogo.
   */
  async crearServicioNuevoCatalogo(datos: { nombre: string; precio: string }) {
    await this.cambiarPestanaCatalogo('Servicios');
    await this.page.locator(L.TARJETA_AGREGAR_SERVICIO).locator('visible=true').first().click();
    await expect(this.page.getByRole('heading', { name: L.HEADING_TIPO_SERVICIO })).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await this.page.getByRole('heading', { name: L.HEADING_SERVICIO_NORMAL, exact: true }).click();

    const modal = this.page.locator(L.MODAL_SERVICIO_NUEVO);
    await expect(modal, 'No apareció el modal de crear servicio nuevo').toBeVisible({ timeout: TIMEOUTS.CARGA });

    await this.page.locator(L.INPUT_SERVICIO_NUEVO_GRUPO).fill(datos.nombre);
    await this.page.locator(L.INPUT_SERVICIO_NUEVO_NOMBRE).fill(datos.nombre);
    // pressSequentially (no fill): confirmado en vivo que este campo de
    // precio recalcula su valor final mediante `onkeyup="calculatePrice(0)"`
    // — `fill()` solo dispara `input`/`change`, nunca `keyup`, así que el
    // servicio se guardaba con precio $0 aunque el campo mostrara el valor
    // correcto justo antes de guardar.
    await this.page.locator(L.INPUT_SERVICIO_NUEVO_PRECIO).pressSequentially(datos.precio);
    await this.page.locator(L.BTN_SERVICIO_NUEVO_AGREGAR_SUBLINEA).click();
    await this.page.locator(L.BTN_SERVICIO_NUEVO_GUARDAR).click();

    await expect(modal, 'El modal de crear servicio nuevo no se cerró').toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Asigna el primer mecánico disponible a un ítem del carrito (producto o
   * servicio), identificado por su id dinámico `{productoId}_{numeroLinea}`
   * (ej. "37089_1", visible en `#table_product_name_{id}`). Abre el menú de
   * opciones (⋮) del ítem, entra a "Asignar mecánico" y confirma con el
   * botón "Asignar" del primer mecánico de la lista.
   */
  async asignarMecanicoAlPrimerItem(itemId: string) {
    const [productoId] = itemId.split('_');
    await this.page.locator(`#table_product_name_${itemId}`).locator('.dropdown-toggle').click();
    await this.page.locator(`a[onclick*="callSetNewMechanicService(${productoId},"]`).first().click();

    const modal = this.page.locator('#dialog_add_mechanic_service').first();
    await expect(modal, 'No apareció el modal de "Asignar mecánico"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    const primerMecanico = this.page.locator('.mechanic-list .assign-btn').first();
    await expect(primerMecanico, 'No hay ningún mecánico disponible para asignar').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await primerMecanico.click();

    await expect(
      this.page.locator('.noty_bar', { hasText: 'Mecánico Asignado' }).last(),
      'No apareció el toast de "Mecánico Asignado"'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });

    // El modal no se cierra solo tras asignar (a diferencia de otros modales
    // de este módulo) — sin cerrarlo, su overlay bloquea cualquier clic
    // posterior en el resto de la página.
    await modal.locator('.close').first().click();
    await expect(modal, 'El modal de "Asignar mecánico" no se cerró').toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Aplica la garantía a un ítem del carrito: confirmado en vivo que esto
   * pone su precio en $0 de inmediato (checkbox del menú de opciones ⋮, no
   * requiere confirmación aparte). El total general del carrito baja en la
   * misma proporción.
   */
  async aplicarGarantiaAlItem(itemId: string) {
    await this.page.locator(`#table_product_name_${itemId}`).locator('.dropdown-toggle').click();
    await this.page.locator(`#apply_warranty_item_${itemId}`).check({ force: true });
    await expect
      .poll(async () => (await this.page.locator(`#total_by_product_${itemId}`).first().textContent())?.trim(), {
        message: 'El precio del ítem no bajó a 0 tras aplicar la garantía',
        timeout: TIMEOUTS.CARGA,
      })
      .toMatch(/^0([.,]0+)?$/);
    // Marcar el checkbox (a diferencia de un clic en un link del menú) no
    // cierra el dropdown de Bootstrap solo — este depende de un clic FUERA
    // del propio dropdown para cerrarse (confirmado en vivo: `Escape` no
    // tiene ningún efecto) — sin cerrarlo, se queda flotando sobre otros
    // ítems y bloquea clics posteriores en ellos.
    await this.page.locator('.item-stats-header').click();
  }

  /**
   * Elimina un ítem del carrito. Confirmado en vivo: "Eliminar" del menú ⋮
   * dispara un SweetAlert de confirmación ("¿Está seguro de eliminar el
   * producto?" → botón "Eliminar") — sin confirmarlo, el ítem NO se elimina
   * ni el total se recalcula (queda como si nada hubiera pasado, sin error).
   */
  async eliminarItemDelCarrito(itemId: string) {
    const fila = this.page.locator(`#table_product_name_${itemId}`);
    // Reintenta todo el flujo si el ítem no desaparece: confirmado en vivo
    // (varias corridas idénticas, unas veces falla y otras no) que esto es
    // la misma inestabilidad ambiental crónica de esta máquina compartida,
    // no un fallo determinístico — el mismo código elimina el ítem
    // correctamente la mayoría de las veces.
    for (let intento = 1; intento <= 2; intento++) {
      await fila.locator('.dropdown-toggle').click();
      await this.page.locator(`a[onclick*="remove_from_list('${itemId}')"]`).first().click();
      // Se acota el botón "Eliminar" al popup de SweetAlert realmente
      // visible (`.last()`): confirmado en vivo que un `getByRole` sin
      // acotar puede resolver a un botón "Eliminar" de un diálogo
      // distinto/residual en la misma página, que no hace nada.
      await this.page.locator('.sweet-alert').last().getByRole('button', { name: 'Eliminar', exact: true }).click();

      const eliminado = await fila
        .waitFor({ state: 'detached', timeout: TIMEOUTS.CARGA })
        .then(() => true)
        .catch(() => false);
      if (eliminado) return;
      if (intento === 2) throw new Error(`El ítem ${itemId} seguía en el carrito tras confirmar "Eliminar" (2 intentos)`);
    }
  }

  /**
   * Activa/desactiva "Mostrar precios con IVA" del carrito. Alterna qué
   * conjunto de elementos de precio queda visible (`*_without_iva` vs
   * `*_with_iva`, ambos presentes siempre en el DOM para cada línea) — se
   * usa `expect.poll` en vez de una espera fija porque confirmado en vivo el
   * cambio de visibilidad no es instantáneo.
   */
  async alternarMostrarPreciosConIva() {
    const elementoConIva = this.page.locator('.total_by_product_with_iva').first();
    const estabaVisibleAntes = await elementoConIva.isVisible();
    await this.page.locator(L.TOGGLE_MOSTRAR_PRECIOS_CON_IVA).locator('xpath=ancestor::label[1]').click();
    await expect
      .poll(() => elementoConIva.isVisible(), {
        message: 'El toggle "Mostrar precios con IVA" no cambió la vista del carrito',
        timeout: TIMEOUTS.CARGA,
      })
      .toBe(!estabaVisibleAntes);
  }

  /**
   * Sube una fotografía "Antes" o "Después" para un servicio específico, en
   * el paso "Fotografías" del wizard (sección propia por servicio, distinta
   * de las fotos generales de la recepción). El input real de Dropzone.js
   * NO es descendiente del contenedor visible del servicio (Dropzone lo
   * cuelga aparte, confirmado en vivo con varios candidatos sin `id` cuyo
   * padre directo es `<body>`) — se ubica de forma confiable marcando
   * `elemento.dropzone.hiddenFileInput` con un atributo temporal vía JS, en
   * vez de adivinar su posición en el DOM.
   */
  async subirFotoServicio(idServicio: string, etapa: 'antes' | 'despues', rutaArchivo: string) {
    const dropzoneId = `dropzone_ro_service_item_${etapa === 'antes' ? 'before' : 'after'}_photos_${idServicio}`;
    const marcador = `data-test-target-${idServicio}-${etapa}`;
    await this.page.evaluate(
      ({ elId, attr }) => {
        const el = document.getElementById(elId) as (HTMLElement & { dropzone?: { hiddenFileInput: HTMLInputElement } }) | null;
        if (!el?.dropzone) throw new Error(`No se encontró la instancia de Dropzone en #${elId}`);
        el.dropzone.hiddenFileInput.setAttribute(attr, 'yes');
      },
      { elId: dropzoneId, attr: marcador }
    );
    await this.page.locator(`input[${marcador}="yes"]`).setInputFiles(rutaArchivo);
    await expect(
      this.page.locator(`#content_ro_service_item_photos_list_${idServicio}_1 img`).first(),
      `No se reflejó la foto subida para el servicio ${idServicio} (${etapa})`
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  // ─── Inspección (paquetes) ──────────────────────────────────────────────────

  /**
   * Completa el primer componente de inspección disponible (llena su campo
   * de nota/puntaje) y confirma que los puntos otorgados del paquete se
   * actualizan en tiempo real — así se valida que el paquete no solo
   * "aparece", sino que queda realmente asociado a la orden. Solo aplica
   * cuando el servicio agregado a la orden tiene un paquete de inspección
   * configurado (ver `SERVICIO_CON_PAQUETE_INSPECCION`); si no hay ningún
   * paquete, este método falla con un mensaje explícito en vez de un
   * timeout genérico.
   */
  async completarPrimerComponenteInspeccion() {
    const campoNota = this.page.locator('[id^="inspection-score-"]').first();
    await expect(campoNota, 'No hay ningún paquete de inspección con componentes para completar').toBeVisible({ timeout: TIMEOUTS.CARGA });

    const otorgadosAntes = await this.page.getByText(/Otorgados:/).textContent();

    await campoNota.fill('5');
    await campoNota.blur();

    await expect
      .poll(async () => this.page.getByText(/Otorgados:/).textContent(), { timeout: TIMEOUTS.CARGA })
      .not.toBe(otorgadosAntes);
  }

  /**
   * En el primer componente de inspección disponible: activa "Requiere
   * reemplazo", agrega un producto normal (búsqueda del catálogo), un
   * producto rápido y un producto externo, y finalmente activa "Aprobado".
   * Devuelve el id dinámico del componente usado (para que el caller pueda
   * inspeccionar/limpiar si lo necesita).
   *
   * Varios detalles confirmados en vivo, ninguno documentado en la UI:
   * - "Aprobado" empieza deshabilitado y solo se habilita después de activar
   *   "Requiere reemplazo" (no se puede aprobar un componente que no
   *   necesita reemplazo).
   * - El bloque de productos del componente (búsqueda/rápido/externo) vive
   *   colapsado en una fila aparte; hay que hacer clic en su encabezado
   *   para expandirlo antes de que el input de búsqueda quede interactuable.
   * - El botón "Buscar" de la búsqueda normal de productos queda tapado por
   *   los botones "P. Rápido"/"P. Externo" (se solapan en este layout) — se
   *   dispara la búsqueda con Enter en el input en vez de clic en el botón.
   * - El modal "Agregar producto externo" NO valida ni muestra ningún error
   *   visible si falta algo: simplemente no hace nada al hacer clic en
   *   "Guardar". Confirmado por eliminación qué lo bloqueaba: el combo
   *   "Proveedor" (un Chosen sin id fijo, ligado a un `data-temp-id`
   *   dinámico) debe tener una opción real seleccionada (no su placeholder,
   *   mismo patrón ya conocido de otros combos Chosen de este módulo) Y el
   *   toggle "Aplica IVA" (activado por defecto) debe desactivarse — con
   *   IVA activo, el modal exige los combos de Tipo/Tarifa de impuesto
   *   (ocultos hasta que se necesitan) aunque no se muestre ningún mensaje
   *   de que son obligatorios.
   * - "Requiere reemplazo" y los 3 productos (normal/rápido/externo) SÍ
   *   quedan guardados de verdad: confirmado reabriendo la orden ya generada
   *   por "Paso 1: Editar orden" (única vista donde se ve el estado real
   *   persistido) — los 3 productos y el toggle de reemplazo siguen ahí.
   * - "Aprobado" NO queda guardado: reabriendo la misma orden, el checkbox
   *   vuelve a aparecer sin marcar. Confirmado también por red: el clic en
   *   "Continuar" del modal de confirmación no dispara ninguna petición al
   *   servidor — es un cambio puramente visual que se pierde. Parece ser una
   *   limitación/bug real de la aplicación (no de este test): no se encontró
   *   ninguna acción adicional en la UI que efectivamente lo guarde. El test
   *   igual completa el clic en "Continuar" porque es el paso real que
   *   recorre un usuario, pero no se debe asumir que "Aprobado" persiste.
   */
  async activarReemplazoYAgregarProductos(): Promise<string> {
    const campoNota = this.page.locator('[id^="inspection-score-"]').first();
    await expect(campoNota, 'No hay ningún componente de inspección disponible para reemplazo/productos').toBeVisible({ timeout: TIMEOUTS.CARGA });
    const idComponente = (await campoNota.getAttribute('id'))!.replace('inspection-score-', '');

    // 1. Requiere reemplazo
    const toggleReemplazo = this.page.locator(`#replacement_${idComponente}`);
    await toggleReemplazo.locator('xpath=ancestor::label[1]').click();
    await expect(toggleReemplazo, 'El toggle "Requiere reemplazo" no quedó activado').toBeChecked();

    // Expandir el bloque de productos del componente (colapsado por defecto)
    await this.page.locator(`#product-header-${idComponente}`).click();
    const inputBusqueda = this.page.locator(`#product-search-input-${idComponente}`);
    await expect(inputBusqueda, 'El bloque de productos del componente no se expandió').toBeVisible({ timeout: TIMEOUTS.CARGA });

    const listaProductosComponente = this.page.locator(`#product-list-${idComponente}`);
    const nombreProductoRapido = 'Producto Rápido Inspección QA';

    // 2. Producto normal (búsqueda del catálogo)
    await inputBusqueda.fill(PRODUCTO_CATALOGO_PRUEBA.split(' ')[0]);
    await inputBusqueda.press('Enter');
    const resultadosNormal = this.page.locator(`#product-search-results-${idComponente} .package-inspection-product-result-item`);
    await expect(resultadosNormal.first(), 'La búsqueda de producto normal no devolvió resultados').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await resultadosNormal.first().click();
    // Valida que el producto agregado queda realmente reflejado en la lista
    // de productos del paquete de la orden, no solo que "el click funcionó".
    await expect(
      listaProductosComponente.getByText(PRODUCTO_CATALOGO_PRUEBA.split(' ')[0]),
      'El producto normal no quedó reflejado en la lista de productos del componente'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });

    // 3. Producto rápido (mismo modal global que `agregarProductoRapido`, abierto directo sin el paso previo del catálogo)
    await this.page.locator(`#quick-product-btn-${idComponente}`).click();
    const modalRapido = this.page.locator('#dialog_quick_product');
    await expect(modalRapido, 'No apareció el modal de "Producto Rápido"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await this.page.locator(L.INPUT_PRODUCTO_RAPIDO_NOMBRE).fill(nombreProductoRapido);
    await this.page.locator(L.INPUT_PRODUCTO_RAPIDO_COSTO).fill('10');
    await this.page.locator(L.INPUT_PRODUCTO_RAPIDO_PRECIO).fill('20');
    await modalRapido.getByRole('button', { name: 'Agregar' }).click();
    await expect(modalRapido, 'El modal de "Producto Rápido" no se cerró tras agregar').toBeHidden({ timeout: TIMEOUTS.CARGA });
    await expect(
      listaProductosComponente.getByText(nombreProductoRapido),
      'El producto rápido no quedó reflejado en la lista de productos del componente'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });

    // 4. Producto externo
    await this.page.locator(`#external-product-btn-${idComponente}`).click();
    const modalExterno = this.page.locator('#dialog_add_external_product_to_component');
    await expect(modalExterno, 'No apareció el modal de "Agregar producto externo"').toBeVisible({ timeout: TIMEOUTS.CARGA });

    // Búsqueda con reintento: confirmado en vivo que a veces la primera
    // búsqueda no devuelve resultados (catálogo de productos externos con
    // datos compartidos/mutables) aunque el mismo término sí encuentra algo
    // al reintentar — se reintenta la búsqueda en cada sondeo en vez de
    // asumir un único intento.
    const resultadoExterno = this.page.locator('#external_product_list .external-product-item').first();
    await expect
      .poll(
        async () => {
          await this.page.locator('#external_product_search_input').fill('a');
          await this.page.locator('#external_product_search_input').press('Enter');
          return resultadoExterno.isVisible();
        },
        { message: 'La búsqueda de producto externo no devolvió resultados', timeout: TIMEOUTS.CARGA }
      )
      .toBe(true);
    // Se captura el nombre real del resultado (no se asume uno fijo: el
    // catálogo de productos externos es dato compartido/mutable) para poder
    // validar después que quedó reflejado en la lista del componente.
    const nombreProductoExterno = (await resultadoExterno.locator('.external-product-item-header').textContent())?.trim() ?? '';
    await resultadoExterno.click();

    await this.page.locator('#added_external_products_list .product-cost').first().fill('50');

    // Proveedor: saltar el placeholder "Seleccionar Proveedor..." (mismo patrón que otros combos Chosen)
    const contenedorProveedor = this.page
      .locator('.product-provider')
      .locator('xpath=following-sibling::div[contains(@class,"chosen-container")][1]');
    await contenedorProveedor.locator('a.chosen-single').click();
    const opcionesProveedor = contenedorProveedor.locator('.chosen-results li.active-result');
    await expect(opcionesProveedor.first(), 'El combo "Proveedor" no mostró ninguna opción').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await opcionesProveedor.nth(1).click();

    // "Aplica IVA" viene activado por defecto y bloquea el guardado (ver nota del método)
    await this.page.locator('.product-apply-iva').locator('xpath=ancestor::label[1]').click();

    await this.page.locator('#btn_save_external_products').click();
    await expect(modalExterno, 'El modal de "Agregar producto externo" no se cerró tras Guardar').toBeHidden({ timeout: TIMEOUTS.CARGA });
    // toBeAttached (no toBeVisible): confirmado en vivo que guardar el
    // producto externo dispara un refresco del panel de productos del
    // componente que lo deja colapsado de nuevo (mismo panel que se expandió
    // al inicio con el clic en el encabezado) — el producto queda en el DOM,
    // solo deja de estar visible.
    await expect(
      listaProductosComponente.getByText(nombreProductoExterno),
      'El producto externo no quedó reflejado en la lista de productos del componente'
    ).toBeAttached({ timeout: TIMEOUTS.CARGA });

    // 5. Aprobado (solo queda habilitado tras activar "Requiere reemplazo")
    const toggleAprobado = this.page.locator(`#approved_${idComponente}`);
    await expect(toggleAprobado, 'El toggle "Aprobado" quedó deshabilitado').toBeEnabled({ timeout: TIMEOUTS.CARGA });
    await toggleAprobado.locator('xpath=ancestor::label[1]').click();
    // Activar "Aprobado" dispara un SweetAlert de confirmación ("Confirmar
    // estado de aprobación" → botón "Continuar") — sin confirmarlo, su
    // overlay se queda bloqueando toda interacción posterior con la página
    // (confirmado en vivo: el siguiente clic en "Siguiente" fallaba por
    // "sweet-overlay intercepts pointer events").
    await this.page.getByRole('button', { name: 'Continuar' }).click();
    await expect(this.page.locator('.sweet-overlay'), 'El overlay de confirmación de "Aprobado" no se cerró').toBeHidden({ timeout: TIMEOUTS.CARGA });
    // Esto solo confirma el estado visual inmediato del checkbox, NO que
    // haya quedado guardado en el servidor — ver la nota grande al inicio
    // del método: "Aprobado" no dispara ninguna petición de red al
    // confirmar, y reabriendo la orden ya generada el checkbox vuelve a
    // aparecer sin marcar. Comportamiento confirmado con el usuario del
    // proyecto; no se encontró ninguna acción adicional en la UI que lo
    // persista de verdad.
    await expect(toggleAprobado, 'El toggle "Aprobado" no quedó activado').toBeChecked();

    // Confirma que los 3 productos siguen reflejados en la orden después de
    // aprobar (no solo antes) — activar "Aprobado" no debe hacerlos
    // desaparecer. Se valida que sigan ADJUNTOS al DOM, no "visibles":
    // confirmado en vivo que aprobar colapsa de nuevo el panel de productos
    // del componente (mismo panel que se expandió al inicio), así que sus
    // filas siguen existiendo pero dejan de estar visibles — es el
    // comportamiento normal de la app, no una pérdida de datos.
    await expect(
      listaProductosComponente.getByText(PRODUCTO_CATALOGO_PRUEBA.split(' ')[0]),
      'El producto normal ya no aparece en la orden después de aprobar'
    ).toBeAttached({ timeout: TIMEOUTS.CARGA });
    await expect(
      listaProductosComponente.getByText(nombreProductoRapido),
      'El producto rápido ya no aparece en la orden después de aprobar'
    ).toBeAttached({ timeout: TIMEOUTS.CARGA });
    await expect(
      listaProductosComponente.getByText(nombreProductoExterno),
      'El producto externo ya no aparece en la orden después de aprobar'
    ).toBeAttached({ timeout: TIMEOUTS.CARGA });

    return idComponente;
  }

  // ─── Enderezado y Pintura ───────────────────────────────────────────────────

  /**
   * Recorre el flujo completo de "Enderezado y Pintura": Tipo de Vehículo →
   * primera Parte disponible → primera Pieza disponible → primer Servicio
   * disponible → primer Precio real del modal "Selecciona un precio"
   * (excluye la tarjeta "Agregar precio a este servicio", que crea un precio
   * nuevo en vez de seleccionar uno existente). Mismo widget conceptual que
   * en POS (`pos-navegacion.page.ts`), reimplementado aquí porque este
   * módulo usa ids propios distintos.
   */
  async agregarServicioEnderezadoYPintura(tipoVehiculo: string = TIPO_VEHICULO_PINTURA_PRUEBA) {
    await this.seleccionarOpcionChosen(L.SELECT_TIPO_VEHICULO_PINTURA, tipoVehiculo);

    // La "parte" es la tarjeta que aparece sobre los paneles Piezas/Servicios
    // (p. ej. "Puerta") apenas se elige el tipo de vehículo — hay que hacer
    // clic en ella explícitamente, no se auto-selecciona sola aunque sea la
    // única disponible.
    const primeraParte = this.page.locator('[id^="name_part_"]').first();
    await expect(primeraParte, 'No apareció ninguna parte para el tipo de vehículo elegido').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await primeraParte.click();

    const primeraPieza = this.page.locator('.name_piece').first();
    await expect(primeraPieza, 'No hay ninguna pieza disponible para la parte de este vehículo').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await primeraPieza.click();

    const primerServicio = this.page.getByText('SEVICIO HONDURAS').first();
    await expect(primerServicio, 'No hay ningún servicio disponible para la pieza elegida').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await primerServicio.click();

    const modalPrecios = this.page.locator(L.MODAL_PRECIOS_PINTURA);
    await expect(modalPrecios, 'No apareció el modal "Selecciona un precio"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    const opcionPrecio = this.page.locator(L.OPCION_PRECIO_PINTURA).first();
    await expect(opcionPrecio, 'No hay ningún precio disponible para este servicio').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await opcionPrecio.click();

    await expect(
      this.page.locator('.noty_bar', { hasText: 'Servicio añadido' }).last(),
      'No apareció el toast de "Servicio añadido a la orden" tras seleccionar el precio de Enderezado y Pintura'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  // ─── Abonos ─────────────────────────────────────────────────────────────────

  /**
   * Campo de monto del paso "Abonos" del wizard — se usa como marcador
   * funcional de que el paso está presente/disponible (p. ej. tras
   * desactivarlo tanto para Administrador en "Configurar Pasos de la
   * Recepción", este input nunca debería aparecer durante el wizard).
   */
  get inputMontoAbono(): Locator {
    return this.page.locator(L.INPUT_MONTO_ABONO);
  }

  /** Total y abono acumulado mostrados en el resumen del paso "Abonos". */
  async obtenerResumenAbonos(): Promise<{ subtotal: number; abono: number; total: number }> {
    const texto = (await this.page.locator('body').innerText()).replace(/\s+/g, ' ');
    const extraer = (etiqueta: string) => parseMonedaCR(texto.match(new RegExp(`${etiqueta}:?\\s*\\$?\\s*([\\d.,]+)`))?.[1] ?? '0');
    return {
      subtotal: extraer('Subtotal'),
      abono: extraer('Abono'),
      total: extraer('Total'),
    };
  }

  /**
   * Agrega un abono desde el paso "Abonos": monto, forma de pago y caja
   * (ambos combos "Chosen", se selecciona la primera opción real de cada
   * uno salvo que se indique un texto concreto). Confirma el guardado con el
   * toast real "Abono agregado".
   */
  async agregarAbono(datos: { monto: string; formaPago?: string; caja?: string }) {
    await this.page.locator(L.INPUT_MONTO_ABONO).fill(datos.monto);

    // No se usa seleccionarPrimeraOpcionChosen() para estos dos combos:
    // confirmado en vivo que su placeholder ("Forma de pago" / "Caja") queda
    // como `.active-result` #0 aun cuando el `<option>` nativo que le
    // corresponde en el `<select>` no tiene `value=""` (el heurístico
    // genérico por `value` vacío no lo detecta) — se salta directamente al
    // segundo resultado, que sí es una opción real en ambos combos.
    const seleccionarSegundaOpcion = async (selectorId: string, texto?: string) => {
      await this.refrescarChosen(selectorId);
      const contenedor = this.chosenDeSelect(selectorId);
      await contenedor.locator('a.chosen-single').click();
      const resultados = contenedor.locator('.chosen-results li.active-result');
      await expect(resultados.first(), `El combo "${selectorId}" no mostró ninguna opción`).toBeVisible({ timeout: TIMEOUTS.CARGA });
      const opcion = texto ? resultados.filter({ hasText: texto }).first() : resultados.nth(1);
      await opcion.click();
    };

    await seleccionarSegundaOpcion(L.SELECT_FORMA_PAGO_ABONO, datos.formaPago);
    await seleccionarSegundaOpcion(L.SELECT_CAJA_ABONO, datos.caja);

    await this.page.locator(L.BTN_GUARDAR_ABONO).click();
    await expect(
      this.page.locator('.noty_bar', { hasText: 'Abono agregado' }),
      'No apareció el toast de "Abono agregado"'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  // ─── Abonos desde el menú "⋮" de una orden (flujo distinto al del wizard) ───

  get modalAbonoMenu(): Locator {
    return this.page.locator(L.MODAL_ABONO_MENU);
  }

  /** Abre "Abonos: Agregar Abono" desde el menú "⋮" ya desplegado. */
  async abrirAgregarAbonoDesdeMenu(menu: Locator) {
    const link = menu.locator(L.LINK_ABONOS_AGREGAR_DESDE_MENU);
    await expect(link, 'El enlace "Abonos: Agregar Abono" no apareció en el menú "⋮"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await link.click();
    await expect(this.modalAbonoMenu, 'El modal "Agregar Abono" no se abrió').toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Saldo actual mostrado en el modal "Agregar Abono" ya abierto. */
  async obtenerSaldoActualAbonoMenu(): Promise<number> {
    return parseMonedaCR(await this.page.locator(L.SALDO_ACTUAL_ABONO_MENU).innerText());
  }

  /** Saldo restante mostrado (recalculado en vivo) en el modal "Agregar Abono" ya abierto. */
  async obtenerSaldoRestanteAbonoMenu(): Promise<number> {
    return parseMonedaCR(await this.page.locator(L.INPUT_SALDO_RESTANTE_ABONO_MENU).inputValue());
  }

  /**
   * Llena el modal "Agregar Abono" (monto, forma de pago, caja y
   * observaciones). Mismo hallazgo que en `agregarAbono()` del wizard: los
   * combos "Forma de pago"/"Aplicar a caja" tienen su placeholder con
   * `value="0"` (no vacío), así que el heurístico genérico de
   * `seleccionarPrimeraOpcionChosen()` no lo detecta — se salta directamente
   * a la segunda opción, que sí es real en ambos.
   */
  async llenarFormularioAbonoMenu(datos: { monto: string; observaciones: string; formaPago?: string; caja?: string }) {
    await this.page.locator(L.INPUT_MONTO_ABONO_MENU).fill(datos.monto);
    await this.page.locator(L.TEXTAREA_OBSERVACIONES_ABONO_MENU).fill(datos.observaciones);

    const seleccionarSegundaOpcion = async (selectorId: string, texto?: string) => {
      await this.refrescarChosen(selectorId);
      const contenedor = this.chosenDeSelect(selectorId);
      await contenedor.locator('a.chosen-single').click();
      const resultados = contenedor.locator('.chosen-results li.active-result');
      await expect(resultados.first(), `El combo "${selectorId}" no mostró ninguna opción`).toBeVisible({ timeout: TIMEOUTS.CARGA });
      const opcion = texto ? resultados.filter({ hasText: texto }).first() : resultados.nth(1);
      await opcion.click();
    };

    await seleccionarSegundaOpcion(L.SELECT_FORMA_PAGO_ABONO_MENU, datos.formaPago);
    await seleccionarSegundaOpcion(L.SELECT_CAJA_ABONO_MENU, datos.caja);
  }

  /**
   * Guarda el abono del modal ya lleno. Confirmado en vivo: dispara
   * `save_repair_order_payment()` — se ata al toast real de confirmación en
   * vez de asumir que el modal se cierra solo.
   */
  async guardarAbonoMenu() {
    await this.page.locator(L.BTN_GUARDAR_ABONO_MENU).click();
    await expect(
      this.page.locator('.noty_bar'),
      'No apareció ningún mensaje de confirmación tras guardar el abono'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Activa "Abonos: Imprimir Abono" desde el menú "⋮" ya desplegado.
   * Confirmado en vivo: este enlace solo aparece una vez la orden tiene al
   * menos un abono registrado — no está presente en una orden recién creada
   * sin abonos.
   *
   * Confirmado en vivo (investigación dedicada, con un listener de `page` en
   * el contexto activo durante todo el clic): a diferencia de "Imprimir
   * Orden" (que sí abre una pestaña real detectable), este enlace llama a
   * `print_repair_order_payments(id)`, que no genera ninguna pestaña nueva,
   * ningún modal, ni ningún iframe visible en la página — es un
   * `window.print()` nativo del navegador. Un navegador headless no expone
   * ningún DOM inspeccionable para ese diálogo de impresión nativo, así que
   * no hay contenido real que esta automatización pueda leer para validar
   * (limitación real de probar `window.print()` en modo headless, no un bug
   * de la aplicación ni de esta suite). Este método solo hace el clic real y
   * dispara la captura de errores de JS del propio test — es lo único
   * verificable de forma honesta en este entorno.
   */
  async imprimirAbono(menu: Locator) {
    const link = menu.locator(L.LINK_ABONOS_IMPRIMIR);
    await expect(link, 'El enlace "Abonos: Imprimir Abono" no apareció en el menú "⋮"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await link.click();
  }

  // ─── Partes del vehículo ────────────────────────────────────────────────────

  /**
   * Marca la primera parte disponible como "Bueno". El id numérico de cada
   * parte es dinámico según el ambiente — se selecciona por el atributo
   * `onclick` (`addAssetOrder`), no por un id fijo, y se confirma la marcación
   * real verificando que el propio ícono clickeado gane la clase
   * `status-asset-active` (confirmado en vivo: no hay toast para esta acción).
   */
  async marcarPrimeraParteComoBuena() {
    const icono = this.page.locator(L.ICONO_PARTE_BUENA).first();
    await expect(icono, 'No hay ninguna parte del vehículo disponible para marcar').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await icono.click();
    await esperarQuedaActivo(async () => (await icono.getAttribute('class'))?.includes('status-asset-active') ?? false);
  }

  // ─── Seleccionar fotos ───────────────────────────────────────────────────────

  /**
   * Sube una fotografía en el paso "Seleccionar fotos". Confirmado en vivo:
   * de los varios `<input type="file">` ocultos que coexisten en esta página
   * (para otros flujos: importar imagen de daño, foto de estilo, chat
   * interno, etc.), el de este paso es el único SIN id, y es además el
   * último en el orden del DOM — de ahí `.last()` en vez de un selector por
   * id.
   */
  async subirFotoRecepcion(rutaArchivo: string) {
    await this.page.locator('input[type="file"]').last().setInputFiles(rutaArchivo);
    await expect(
      this.page.getByText(/Se guardaron\s*\d+\s*imágenes/),
      'No se confirmó el guardado de la fotografía subida'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  // ─── Canvas de dibujo (compartido entre Marcación de daños y Firma) ────────

  /**
   * Dibuja un trazo simple sobre un `<canvas>` de dibujo libre. Confirmado en
   * vivo: tanto el canvas de "Marcación de daños" como el de "Firma del
   * cliente" NO responden a los eventos de mouse sintéticos de Playwright
   * (`page.mouse`/`locator.hover` — el trazo simplemente no aparece, 0 píxeles
   * dibujados verificado leyendo el propio canvas). Sí responden a
   * `MouseEvent` nativos despachados directamente sobre el elemento, que es
   * lo que hace este método.
   */
  private async dibujarEnCanvas(canvas: Locator) {
    await canvas.evaluate((c: HTMLCanvasElement) => {
      const rect = c.getBoundingClientRect();
      function disparar(tipo: string, x: number, y: number) {
        const evento = new MouseEvent(tipo, {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + x,
          clientY: rect.top + y,
          button: 0,
          buttons: tipo === 'mouseup' ? 0 : 1,
        });
        c.dispatchEvent(evento);
      }
      disparar('mousedown', 30, 30);
      for (let i = 1; i <= 20; i++) disparar('mousemove', 30 + i * 5, 30 + Math.sin(i) * 20);
      disparar('mouseup', 130, 30);
    });
  }

  // ─── Marcación de daños ──────────────────────────────────────────────────────

  /**
   * Dibuja una marcación de daño sobre el diagrama del vehículo y la guarda.
   * Confirma la persistencia real leyendo el texto "Foto seleccionada: #N.
   * Total: N." que la app muestra tras guardar (no hay un toast para esta
   * acción).
   */
  async marcarDanioYGuardar() {
    const canvas = this.page.locator(L.CANVAS_DIBUJO_VISIBLE).first();
    await expect(canvas, 'El canvas de marcación de daños no está visible').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await this.dibujarEnCanvas(canvas);
    await this.page.getByRole('button', { name: L.BTN_GUARDAR_DANIO }).click();
    await expect(
      this.page.getByText(L.TEXTO_DANIO_GUARDADO),
      'La marcación de daño no quedó guardada (no apareció "Foto seleccionada... Total: N")'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /** Lee el total actual de marcaciones de daño guardadas, del mismo texto real que confirma `marcarDanioYGuardar()` ("Foto seleccionada: #N. Total: N."). */
  async obtenerTotalMarcacionesDanio(): Promise<number> {
    const texto = await this.page.getByText(L.TEXTO_DANIO_GUARDADO).first().innerText();
    return Number(texto.match(/Total:\s*(\d+)/)?.[1] ?? NaN);
  }

  // ─── Observaciones generales ────────────────────────────────────────────────

  /**
   * Llena las dos observaciones del paso "Observaciones generales" del
   * wizard de creación: para el asesor de servicio y para el cliente.
   *
   * ¡OJO! Esto NO guarda nada en el backend (ver la nota larga en
   * `L.INPUT_OBSERVACION_SERVICIO`) — confirmado en vivo releyendo la orden
   * ya generada, ambos campos aparecían vacíos. Se llena de todas formas
   * porque es el paso real que un usuario recorre en el wizard, pero la
   * validación de que "ambas se almacenen" debe hacerse con
   * `llenarYValidarObservacionesReales()`, sobre la orden ya generada.
   */
  async llenarObservaciones(observacionServicio: string, observacionCliente: string) {
    await this.page.locator(L.INPUT_OBSERVACION_SERVICIO).fill(observacionServicio);
    await this.page.locator(L.INPUT_OBSERVACION_CLIENTE).fill(observacionCliente);
  }

  /**
   * Abre la vista de detalle de la primera orden actualmente visible
   * (pensado para usarse justo después de `buscarOrden()`, que ya deja
   * filtrada una única orden). Es una vista distinta del wizard de
   * creación —"ORDEN #N", con secciones de Fotos/Servicios/Productos/Partes/
   * Observaciones— a la que se entra haciendo clic en el badge/número de la
   * orden.
   */
  async abrirDetallePrimeraOrdenVisible() {
    const badge = this.page.locator(L.BADGE_ORDEN).first();
    await expect(badge, 'No hay ninguna orden visible para abrir su detalle').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await badge.click();
    await expect(
      this.page.locator(L.INPUT_OBSERVACION_SERVICIO_DETALLE),
      'La vista de detalle de la orden no cargó (no apareció la sección de Observaciones)'
    ).toBeVisible({ timeout: TIMEOUTS.CARGA });
    // Para una orden con muchas secciones (Orden completa: componentes de
    // inspección con productos, enderezado y pintura, abonos, fotos...) el
    // campo de observaciones puede quedar visible antes de que terminen TODAS
    // las peticiones AJAX que arma la vista de detalle — confirmado en vivo
    // que interactuar con el campo antes de ese punto puede no dejar su
    // listener de guardado realmente enganchado. Se espera a que la red
    // quede inactiva antes de continuar.
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  /**
   * Llena las observaciones REALES de una orden ya generada, desde su vista
   * de detalle, y confirma el guardado esperando la respuesta real del
   * endpoint `saveRepairOrderNotes` que cada campo dispara al perder el foco
   * — no un toast ni una espera fija (esta acción no muestra ningún toast).
   */
  async llenarYValidarObservacionesReales(observacionServicio: string, observacionCliente: string) {
    const esperarGuardado = () =>
      this.page.waitForResponse(
        (r) => r.url().includes('saveRepairOrderNotes') && r.request().method() === 'POST' && r.status() === 200,
        { timeout: TIMEOUTS.CARGA }
      );

    // El listener se arma ANTES de `fill()`, no después: confirmado en vivo
    // que el guardado puede dispararse por el debounce del evento de
    // escritura, no estrictamente por "blur" — si se arma el listener recién
    // antes del blur, la petición puede haber ocurrido (y resuelto) mientras
    // tanto, y `waitForResponse` nunca la ve. Se reintenta (rellenar + blur)
    // si aun así no se observa nada dentro de CARGA, ya que en un ambiente
    // compartido bajo carga la petición puede tardar más en dispararse.
    async function llenarYEsperarGuardado(campo: Locator, valor: string) {
      const intentosMax = 3;
      for (let intento = 1; intento <= intentosMax; intento++) {
        const guardado = esperarGuardado();
        await campo.fill(valor);
        await campo.blur();
        try {
          await guardado;
          return;
        } catch {
          if (intento === intentosMax) throw new Error(`No se disparó "saveRepairOrderNotes" tras ${intento} intentos`);
          await campo.click();
        }
      }
    }

    const campoServicio = this.page.locator(L.INPUT_OBSERVACION_SERVICIO_DETALLE);
    await llenarYEsperarGuardado(campoServicio, observacionServicio);

    const campoCliente = this.page.locator(L.INPUT_OBSERVACION_CLIENTE_DETALLE);
    await llenarYEsperarGuardado(campoCliente, observacionCliente);
  }

  // ─── Firma del cliente ───────────────────────────────────────────────────────

  /** Dibuja la firma del cliente sobre el canvas del paso "Firma del cliente". */
  async firmarCliente() {
    const canvas = this.page.locator(L.CANVAS_DIBUJO_VISIBLE).first();
    await expect(canvas, 'El canvas de firma no está visible').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await this.dibujarEnCanvas(canvas);
  }

  // ─── Finalizar (Generar orden) ──────────────────────────────────────────────

  /**
   * Genera la orden desde el paso final ("Generar" → confirmar "¿Está seguro
   * de generar la orden?" → "Generar orden"). Confirmado en vivo: esta acción
   * no siempre muestra un toast de éxito ni redirige de inmediato — este
   * método solo confirma que el diálogo de confirmación se cerró tras el
   * clic; la verificación de que la orden realmente quedó generada (número,
   * totales) debe hacerse consultando el tab Órdenes por separado.
   */
  async generarOrden() {
    // Sin `exact`: mismo motivo que en los demás botones con ícono de este
    // archivo. No hay riesgo de que coincida por error con "Generar orden"
    // (el botón del diálogo de confirmación), porque ese botón todavía no
    // existe en el DOM en este punto — solo aparece tras este clic.
    await this.page.getByRole('button', { name: 'Generar' }).click();
    const dialogoConfirmar = this.page.getByRole('heading', { name: L.HEADING_CONFIRMAR_GENERAR });
    await expect(dialogoConfirmar, 'No apareció el diálogo de confirmación "¿Está seguro de generar la orden?"').toBeVisible({ timeout: TIMEOUTS.CARGA });
    await this.page.getByRole('button', { name: 'Generar orden' }).click();
    await expect(dialogoConfirmar, 'El diálogo de confirmación no se cerró tras confirmar "Generar orden"').toBeHidden({ timeout: TIMEOUTS.CARGA });
  }
}
