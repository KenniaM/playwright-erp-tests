import { Locator } from '@playwright/test';
import { BASE_URL } from '../env.config';

// Tipos y constantes compartidas de todo el módulo POS — movidos tal cual
// desde pos.page.ts (Paso 0 de la migración a composición, ver el plan
// aprobado). PAUSES y CHECKBOX_ID pasan de `const` a `export const`: hoy
// son internos pero los usan métodos que se repartirán entre varias clases
// de dominio (Core, Payment, CrearProducto), así que necesitan poder
// importarse desde fuera de este archivo — su valor y comportamiento no
// cambian.

// ─── URL ──────────────────────────────────────────────────────────────────────

// Único punto de entrada real al POS: irAlPos() (y, por extensión,
// cargarPosDesdeDashboard()) siempre pasan por aquí y dejan que la propia
// aplicación resuelva la URL final del POS (incluido `company_pos`, que
// varía por compañía/ambiente) — nunca se construye a mano ni se hardcodea
// ningún id de compañía. Ver PosPage._irAlPosResolviendoCompania().
export const DASHBOARD_URL = `${BASE_URL}/dash/dashboard`;

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:          300_000,
  // Presupuesto estándar de todos los escenarios de pos-ruteo.spec.ts (no
  // solo los que facturan): tanto el beforeEach compartido de ese archivo
  // como recargarPosConReintento() (usado como fallback desde el beforeEach
  // y también tras facturar en escenarios con Agregar Ítem + Vista
  // Expandida) pueden necesitar hasta 3 intentos completos de
  // cargarPosDesdeDashboard() para recuperar un estado navegable bajo carga
  // sostenida del ambiente — confirmado en vivo que un solo intento puede
  // agotar PRODUCTS_LOAD (120s) completo antes de fallar, así que TEST
  // (300s) no alcanza ni para 2 intentos completos: el test entero expiraba
  // a mitad de un reintento y Playwright abortaba la navegación en curso
  // (page.goto de un contexto ya cerrado a la fuerza), lo que además podía
  // dejar la `sharedPage` del worker en un estado que contaminaba el
  // siguiente test de la misma fixture. Nota importante sobre por qué se
  // aplica a TODOS los escenarios del archivo, no solo a los "pesados":
  // test.setTimeout() no es acumulativo — la ÚLTIMA llamada dentro del
  // mismo test gana, así que si el beforeEach usara un timeout mayor pero
  // el cuerpo del test siguiera llamando test.setTimeout(TIMEOUTS.TEST), esa
  // segunda llamada recortaría el presupuesto total de vuelta a 300s y
  // anularía la extensión. No baja ningún timeout individual
  // (PRODUCTS_LOAD/NAVIGATE siguen intactos): solo le da al mecanismo de
  // reintento YA DISEÑADO el tiempo total que su propio diseño necesita
  // para completarse.
  TEST_CON_RECUPERACION: 600_000,
  NAVIGATE:       90_000,
  PRODUCTS_LOAD: 120_000,
  PAYMENT_MODAL:  15_000,
  PRINT_POPUP:    15_000,
  // closePosCash (cierre de caja) puede tardar más que el resto de los AJAX
  // de esta clase — confirmado en vivo (TALLER ALPHA PREMIUM) que su propia
  // respuesta puede llegar cerca de los 15s que usa PRINT_POPUP bajo carga
  // normal del ambiente, sin que eso sea un bloqueo real (la petición sí se
  // dispara y sí responde, solo que más lento). Presupuesto propio, no un
  // waitForTimeout() artificial: sigue siendo una espera real sobre la
  // respuesta de red.
  CIERRE_CAJA:    30_000,
} as const;

// ─── Pausas visuales ──────────────────────────────────────────────────────────
// Permiten ver cada paso en la pantalla durante la ejecución en modo headed.

export const PAUSES = {
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


// Texto que identifica la caja cerrada en el modal "Abrir Caja". Exportado para
// que los tests lo reutilicen en vez de repetir el literal.
export const CAJA_TEXTO = 'Caja: Cerrada';

// IDs de checkboxes de métodos de pago.
// Usan slider CSS y están fuera del viewport del modal — se acceden via evaluate().
export const CHECKBOX_ID = {
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

// Misma pestaña que la entrada '#btn_proform_option' de PESTANAS_POS_A_RECORRER
// (ver más abajo), expuesta aquí también por su propio nombre: es el listado
// de Proformas YA CREADAS dentro del propio POS (tarjetas con menú de tres
// puntos: Imprimir/Editar/WhatsApp/Enviar email/Descargar PDF/Eliminar) — NO
// confundir con el listado externo `printPosProform` (otra ventana/pestaña
// del navegador, con su propio conjunto más limitado de acciones). Es aquí,
// y solo aquí, donde existe una edición real in-place (edit_proform(id) →
// AJAX_ACTUALIZAR_PROFORMA) — confirmado en vivo.
export const PESTANA_POS_PROFORMA: PestanaPos = {
  selector: '#btn_proform_option',
  etiqueta: 'Proforma / Cotizaciones',
  contenedorContenido: '#content_invoice_order_list',
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

export const DESCUENTO_INDIVIDUAL_PCT = '5';
export const DESCUENTO_GENERAL_PCT = '10';

// "Contado" ("1") / "Crédito" ("2") en el modal "Enviar a caja" — mismos
// valores que ORDEN_CAJA_TIPO_PAGO_HIDE refleja realmente en el DOM.
export type TipoPagoOrdenCaja = 'contado' | 'credito';

// Los 3 tipos de documento del modal "Agregar Proforma" — mutuamente
// excluyentes, confirmado en vivo (Fase 1).
export type TipoProforma = 'normal' | 'consignacion' | 'taller';

// Tipo de vehículo para el wizard "End. Pintura": a diferencia de parte/pieza/
// servicio (catálogo configurable por la empresa), el tipo de vehículo es una
// lista fija del <select> de la interfaz (Hatchback, Crossover, Minivan, SUV,
// Automóvil, Pick-up) — confirmado inspeccionando sus <option> en vivo.
export const VEHICULO_PINTURA_TIPO = 'Hatchback';

// Compañía a seleccionar en el modal "Seleccionar una compañía para
// continuar" (ver _irAlPosResolviendoCompania()) cuando la cuenta de pruebas
// pertenece a más de una. Configurable vía la variable de entorno
// POS_COMPANIA para que la suite sea independiente de qué compañía tenga
// asignada la cuenta del ambiente donde corra — nunca se busca por id
// (distinto por ambiente/cuenta), solo por el nombre visible en el modal.
// "HONDURAS" queda como valor por defecto únicamente para no romper el resto
// de la suite existente (afinada contra esa compañía) cuando la variable no
// se define.
export const COMPANIA_POS = process.env.POS_COMPANIA ?? 'HONDURAS';

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

// ─── Metadatos funcionales de una tarjeta de producto del grid ─────────────────
//
// Investigado en vivo, no asumido: cada tarjeta del grid (`.product_box_name`)
// lleva un onclick="add_to_table(...)" cuyos argumentos son EXACTAMENTE los
// parámetros reales de la función (confirmada leyendo el pos.js servido en
// vivo, no solo infiriéndolos de los valores observados):
//
//   function add_to_table(id, name, price, max_discount, quantity, apply_iva,
//     item_type, company_id, product_warehouse_id = 0, is_fragmented,
//     quantity_sale, is_variant, complete_name, ...)
//
// Esto es evidencia funcional real del propio sistema —no un nombre, ni una
// categoría— para cada característica que un escenario pueda necesitar:
//   - apply_iva (posición 6): '1'/'0' → si el producto tiene IVA aplicado.
//   - item_type (posición 7): '1' = producto, '2' = servicio — confirmado en
//     vivo contrastando el tab "Servicios" (siempre item_type=2) contra el
//     grid de productos (siempre item_type=1 en este ambiente).
//   - is_fragmented (posición 10): '1'/'0' → si es un Producto Fraccionado —
//     confirmado en vivo contrastando la categoría "Productos Fraccionados"
//     (siempre is_fragmented=1) contra productos simples (siempre '0'). Ya
//     NO se usa esa categoría para localizarlos (ver localizarPrimerProducto),
//     solo sirvió para confirmar el significado de este parámetro.
//   - quantity (posición 5): inventario disponible del producto (puede ser
//     negativo si la compañía permite vender con inventario en contra,
//     confirmado en vivo: `allow_negative_products=1` en la búsqueda real del
//     grid) — para servicios es un tope arbitrario (300 en todos los
//     servicios observados), no inventario real, así que "con inventario"
//     solo aplica a item_type=1.
export type MetadatoProducto = {
  indice: number;      // posición dentro de los `.product_box_name` actualmente cargados
  locator: Locator;
  id: string;
  nombre: string;
  precio: number;
  cantidadDisponible: number;
  aplicaIva: boolean;
  tipoItem: number;     // 1 = producto, 2 = servicio
  esFraccionado: boolean;
};

// URL real del POS ya resuelta al menos una vez en este proceso worker
// (capturada de `page.url()` tras `_irAlPosResolviendoCompania()`, nunca
// construida a mano) — permite que `irAlPos()` reutilice la MISMA URL real
// que la aplicación ya generó, sin volver a pasar por el Dashboard en cada
// llamada y sin depender de ningún `company_pos` fijo.
//
// A propósito a nivel de MÓDULO, no de instancia: cada worker de Playwright
// es un proceso Node separado (mismo aislamiento que ya usa la fixture `pos`
// de scope "worker" en pos-apartado/pos-orden-caja/pos-ruteo/pos-importar-
// factura.spec.ts), así que esto reproduce exactamente "como máximo una vez
// por worker" también para los archivos que crean una `PosPage` nueva por
// test (`page` fixture estándar, sin fixture propia) — confirmado en vivo
// que cachear esto por INSTANCIA en cambio obliga a repetir el paso
// completo por Dashboard (expandir submenú + click) en cada test, y ese paso
// no es sólido bajo varios workers en paralelo: 8/11 pruebas de
// pos.spec.ts fallaron por esto antes de mover el caché aquí. El valor es
// válido para cualquier sesión de la misma cuenta (el `company_pos` es una
// propiedad de la cuenta, no de un contexto de navegador puntual).
