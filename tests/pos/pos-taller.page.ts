import { expect, Download, Locator, Page } from '@playwright/test';
import { L } from './pos.locators';
import { TIMEOUTS, PAUSES, PESTANAS_POS_A_RECORRER } from './pos.types';
import { PosPage } from './pos.page';

// ─── Locators propios de la pestaña "Taller" del POS (#btn_taller_option → ────
// #content_order_list) — confirmados en vivo (HONDURAS) volcando el DOM real
// de las tarjetas (.pos-order-card, id="content_order_box_<id>") y de su menú
// de acciones (button.options-menu-button → #myDropdownListOrders_<id>, 11
// opciones reales: Facturar Orden POS, Ver orden, Ver orden online, Compartir
// por whatsapp, Email, Crear PDF General, PDF Descriptivo, PDF Proforma,
// Imprimir orden, Crear PDF Reporte Inspección, QR del Vehículo). No se
// agregan a pos.locators.ts a propósito: la tarea pide crear únicamente
// pos-taller.page.ts/pos-taller.spec.ts, sin tocar la arquitectura existente.
const TL = {
  TARJETA: '.pos-order-card',
  TARJETA_POR_ID: (id: string) => `#content_order_box_${id}`,
  BTN_MENU_ACCIONES: 'button.options-menu-button',
  DROPDOWN_ACCIONES_POR_ID: (id: string) => `#myDropdownListOrders_${id}`,

  MENU_VER_ORDEN: 'a[onclick*="get_vehicle_detail("]',
  MENU_VER_ORDEN_ONLINE: 'a[href*="get_repair_order_by_hash_key"]',
  MENU_WHATSAPP: 'a[onclick*="confirm_send_repair_order_by_whatsapp_message("]',
  MENU_EMAIL: 'a[onclick*="openSendOrderEmailModal("]',
  MENU_PDF_GENERAL: 'a[href*="downloadPdfCreatedOrder"][href*="impression_type=0"]',
  MENU_PDF_DESCRIPTIVO: 'a[href*="downloadPdfCreatedOrder"][href*="impression_type=1"]',
  MENU_PDF_PROFORMA: 'a[onclick*="generateProformOrderPDF("]',
  MENU_IMPRIMIR: 'a[onclick*="printVehicularReception("]',
  MENU_PDF_INSPECCION: 'a[href*="generateVehicleInspectionPDF("]',
  MENU_QR: 'a[href*="getOrderQrById"]',

  // Selección masiva (menú "Acciones" propio de este listado, distinto del de
  // Ruteo): 3 botones con id técnico estable, confirmados en vivo.
  BTN_TOGGLE_MASIVO: '#btn_repair_order_toggle_massive_select',
  BTN_SELECCIONAR_TODAS_MASIVO: '#btn_repair_order_select_all_massive',
  BTN_FACTURAR_SELECCIONADAS: '#btn_repair_order_generate_massive_invoice',
  CHECKBOX_MASIVO_POR_ID: (id: string) => `#repair_order_massive_checkbox_${id}`,

  // Asistente "Facturación Masiva" (#dialog_repair_order_massive_invoice, 2
  // pasos: "Resumen y cliente" → "Configurar líneas") que "Facturar
  // Seleccionadas" abre — confirmado en vivo instrumentando el DOM real que
  // NUNCA abre directamente el modal de pago del POS ni ningún SweetAlert:
  // genera la factura combinada de las órdenes seleccionadas por su cuenta,
  // con su propio modal de progreso al final. IDs técnicos estables leídos
  // del propio HTML servido (no textos frágiles).
  DIALOG_FACTURACION_MASIVA: '#dialog_repair_order_massive_invoice',
  BTN_FACTURACION_MASIVA_CONTINUAR: '#btn_massive_repair_to_step2',
  BTN_FACTURACION_MASIVA_GENERAR: '#btn_massive_repair_generate_invoice',
  DIALOG_PROGRESO_FACTURACION_MASIVA: '#dialog_progress_invoicing',
  BTN_PROGRESO_ACEPTAR_CERRAR: '#close-progress-modal',

  // Modal "Ver Orden" (#dialog_vehicle_detail, contenido cargado vía AJAX por
  // get_vehicle_detail(id) dentro de #modal_dialog_vehicle_detail). Usa
  // pestañas por radio+label (label[for="tabN"] → #contentN, confirmado en
  // vivo leyendo el propio script inyectado por la app: `tabId.replace('tab',
  // 'content')`) — nunca por posición fija, cada label se localiza por su
  // texto real.
  DIALOG_VER_ORDEN: '#dialog_vehicle_detail',
  VER_ORDEN_BTN_CERRAR: '.btn-close-modal',

  // Formulario "Agregar Abono" (dentro del panel de la pestaña "Abono") —
  // ids reales confirmados en vivo, un <select> nativo (no Chosen) para
  // Forma de pago/Aplicar a caja.
  ABONO_MONTO: '#modal_payment_amount',
  ABONO_FORMA_PAGO: '#modal_payment_method',
  ABONO_CAJA: '#modal_payment_box',
  ABONO_BTN_GUARDAR: 'button.btn-success[onclick="savePaymentModal()"]',

  // Modal "Enviar Orden por Correo" (#dialog_send_order_email, abierto por
  // openSendOrderEmailModal(id, correoPorDefecto)). El campo de correos es un
  // widget "selectize" (mismo sufijo "-selectized" que usa Proforma para su
  // propio modal), pero NO es el mismo componente: confirmado en vivo
  // (volcando el DOM real) que aquí el botón real es
  // `.send_order_emails_btn` (onclick="sendOrderByEmailMultiple()"), un
  // nombre de clase distinto al `.send_emails_btn` de Proforma — y que
  // presionar Enter en el input ya dispara el envío y cierra el modal por sí
  // solo (handler propio de este modal), sin necesitar ningún click
  // adicional en ese botón — ver enviarEmail() más abajo.
  DIALOG_EMAIL: '#dialog_send_order_email',
  EMAIL_INPUT: '#order_email_tags-selectized',

  // Búsqueda del listado Taller: mismo input compartido del header del POS
  // (#product_search, L.PRODUCTO_BUSCADOR_GRID) que ya usa
  // buscarProductoEnGrid()/buscarOrdenesCajaPorTexto() — confirmado en vivo
  // (capturando la petición real) que, con la pestaña Taller activa, dispara
  // su propio AJAX real `getSearchOrders`, distinto de `getPosCashSearch`
  // (Órdenes de Caja) o del buscador del catálogo de productos.
  AJAX_BUSCAR_ORDEN_TALLER: 'getSearchOrders',
} as const;

export type DatosTarjetaTaller = {
  id: string;
  consecutivo: string;
  placa: string;
  marca: string;
  modelo: string;
  clienteNombre: string;
  clienteEmail: string;
  total: number;
  abonado: number;
};

export type DetalleProductoTaller = { cantidad: number; nombre: string; total: number };

export type DetalleOrdenTaller = {
  consecutivo: string;
  factura: string;
  estado: string;
  cliente: { nombre: string; identificacion: string; email: string; telefono: string; direccion: string };
  vehiculo: { placa: string; marcaModelo: string; anio: string };
  productos: DetalleProductoTaller[];
  resumen: { subtotal: number; descuentoPct: number; descuentoMonto: number; abonos: number; saldoPendiente: number; total: number };
};

export type FilaHistorialAbono = { fecha: string; caja: string; formaPago: string; abono: number; saldoAnterior: number; nuevoSaldo: number };

export type FormaPagoAbono = 'Tarjeta' | 'Efectivo' | 'SINPE MOVIL' | 'Transacción';

// ─── Page Object ────────────────────────────────────────────────────────────
//
// No se agrega como dominio compuesto de PosPage (eso exigiría modificar
// pos.page.ts/pos-core.page.ts, fuera del alcance de esta tarea): recibe la
// fachada PosPage ya instanciada (para reutilizar carrito/pago/descuentos sin
// duplicar esa lógica) más la `page` cruda (igual que el resto de la suite ya
// tiene disponible desde el fixture de test), siguiendo el mismo patrón de
// composición por inyección de constructor que PosCore/PosPayment/PosRuteo.
export class PosTaller {
  constructor(private readonly pos: PosPage, private readonly page: Page) {}


  // ─── Listado ───────────────────────────────────────────────────────────

  /** Abre la pestaña superior "Taller" (listado de órdenes de reparación), reutilizando visitarPestanaPos() ya existente. */
  async abrirListadoTaller() {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Taller')!;
    await this.pos.visitarPestanaPos(pestana);
    await this.page.locator(TL.TARJETA).first().waitFor({ state: 'visible', timeout: TIMEOUTS.PRODUCTS_LOAD });
  }

  /** Locator de una tarjeta de orden de Taller, por su id real. */
  tarjeta(id: string): Locator {
    return this.page.locator(TL.TARJETA_POR_ID(id));
  }

  /** IDs reales de las tarjetas de Taller actualmente visibles, en el orden del DOM. */
  async obtenerIdsOrdenesVisibles(cantidad?: number): Promise<string[]> {
    const ids = await this.page.locator(TL.TARJETA).evaluateAll(
      (els) => els.map((e) => e.id.replace('content_order_box_', ''))
    );
    return cantidad ? ids.slice(0, cantidad) : ids;
  }

  /**
   * Filtra, entre las órdenes visibles, las primeras `cantidad` con monto
   * real (total > 0) — confirmado en vivo que el listado compartido de
   * Taller puede tener órdenes sin ningún producto/servicio cargado (monto
   * $0.00): un abono no puede aplicarse ahí, un descuento no tiene nada que
   * descontar, y "Ver Orden" no muestra ningún producto — cualquier
   * escenario que dependa de un monto real puede fallar o comportarse de
   * forma inesperada si toma una de estas órdenes vacías. Nunca crea una
   * orden nueva: solo recorre las ya existentes, probando hasta
   * `candidatosAProbar` antes de rendirse. Devuelve lo que haya encontrado
   * (puede ser menos de `cantidad` si no hay suficientes) — cada escenario
   * decide qué tan estricto ser sobre cuántas necesita realmente.
   */
  async obtenerIdsOrdenesConMontoValido(cantidad: number, candidatosAProbar = 15): Promise<string[]> {
    const candidatos = await this.obtenerIdsOrdenesVisibles(candidatosAProbar);
    const validos: string[] = [];
    for (const candidato of candidatos) {
      const datos = await this.obtenerDatosTarjeta(candidato);
      if (datos.total > 0) {
        validos.push(candidato);
        if (validos.length === cantidad) break;
      }
    }
    return validos;
  }

  /**
   * Busca órdenes de Taller usando el campo de búsqueda REAL del header del
   * POS (#product_search, mismo input que ya usa
   * buscarProductoEnGrid()/buscarOrdenesCajaPorTexto()) — confirmado en vivo
   * que, con la pestaña Taller activa, dispara su propio AJAX real
   * (`getSearchOrders`) que reemplaza el listado de tarjetas por el
   * resultado filtrado en el servidor. Mismo criterio de espera que
   * buscarOrdenesCajaPorTexto(): se espera la respuesta que realmente
   * contiene el texto buscado (no solo la próxima respuesta del endpoint,
   * que podría ser una búsqueda anterior todavía en vuelo) y luego a que el
   * conteo de tarjetas cambie del valor previo.
   */
  async buscarOrdenesTallerPorTexto(texto: string) {
    const totalAntes = (await this.obtenerIdsOrdenesVisibles()).length;

    const respuestaPromise = this.page.waitForResponse((res) => {
      if (!res.url().includes(TL.AJAX_BUSCAR_ORDEN_TALLER)) return false;
      const post = decodeURIComponent((res.request().postData() ?? '').replace(/\+/g, ' '));
      return post.includes(texto);
    }, { timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.pos.buscarProductoEnGrid(texto);
    await respuestaPromise;

    await expect.poll(
      async () => (await this.obtenerIdsOrdenesVisibles()).length,
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El resultado de la búsqueda no terminó de renderizarse' }
    ).not.toBe(totalAntes);
  }

  /**
   * Lee los datos reales de una tarjeta desde sus propios campos ocultos
   * (`<p class="hide" id="..._hide_<id>">`, confirmado en vivo volcando el
   * DOM completo de una tarjeta) — más confiable que parsear el texto visible.
   */
  async obtenerDatosTarjeta(id: string): Promise<DatosTarjetaTaller> {
    return this.page.evaluate((id) => {
      const leer = (campo: string) => document.getElementById(`pos_repair_order_${campo}_hide_${id}`)?.textContent?.trim() ?? '';
      const totalTexto = document.getElementById(`repair_order_total_${id}`)?.textContent?.trim() ?? '0';
      const pagadoTexto = document.getElementById(`repair_order_payment_total_${id}`)?.textContent?.trim() ?? '0';
      const numLimpio = (t: string) => parseFloat(t.replace(/[^0-9.]/g, '')) || 0;
      return {
        id,
        consecutivo: leer('number'),
        placa: document.getElementById(`repair_order_plaque_${id}`)?.textContent?.trim() ?? '',
        marca: leer('brand'),
        modelo: leer('model'),
        clienteNombre: leer('client_name'),
        clienteEmail: leer('client_email'),
        total: numLimpio(totalTexto),
        abonado: numLimpio(pagadoTexto),
      };
    }, id);
  }


  // ─── Menú de acciones de una tarjeta ────────────────────────────────────

  /** Abre el menú de acciones (⋮) de una tarjeta ya visible en el listado. */
  async abrirMenuAcciones(id: string) {
    const tarjeta = this.tarjeta(id);
    await expect(tarjeta, `La orden de Taller #${id} no aparece en el listado`).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
    await tarjeta.locator(TL.BTN_MENU_ACCIONES).click();
    const dropdown = this.page.locator(TL.DROPDOWN_ACCIONES_POR_ID(id));
    await expect(dropdown, `El menú de acciones de la orden #${id} no se abrió`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    return dropdown;
  }

  /**
   * Carga una orden de Taller al carrito del POS ("Facturar Orden POS") —
   * mismo click que el cuerpo entero de la tarjeta dispara
   * (`add_repair_order_to_table`, confirmado en vivo), así que basta con
   * clickear la tarjeta directamente sin pasar por el menú de tres puntos.
   * Deja el carrito, el cliente y el resto de controles del POS (Facturar,
   * descuentos) en el mismo estado que el resto de la suite ya usa tras
   * cargar una Orden de Caja/Ruteo/Apartado existente.
   */
  async facturarOrdenPOS(id: string) {
    await this.tarjeta(id).click();
    await expect(
      this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
      `No se cargó ninguna línea de producto tras "Facturar Orden POS" de la orden #${id}`
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  // ─── "Ver Orden" ─────────────────────────────────────────────────────────

  get modalVerOrden() {
    return this.page.locator(TL.DIALOG_VER_ORDEN);
  }

  /** Abre "Ver orden" desde el menú de acciones y espera el modal de detalle. */
  async abrirVerOrden(id: string) {
    const dropdown = await this.abrirMenuAcciones(id);
    await dropdown.locator(TL.MENU_VER_ORDEN).click();
    await expect(this.modalVerOrden, 'El modal "Ver Orden" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /** Cierra "Ver Orden" y confirma que el modal desapareció. */
  async cerrarVerOrden() {
    await this.modalVerOrden.locator(TL.VER_ORDEN_BTN_CERRAR).click();
    await expect(this.modalVerOrden, 'El modal "Ver Orden" no se cerró').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Lee toda la información real mostrada en "Ver Orden" (ya abierto). Las
   * pestañas (Vehículo/Servicios y productos/Observaciones y firma/Abono) no
   * se ocultan del DOM al cambiar de tab (solo `display:none`), así que su
   * contenido se localiza siempre por el panel real `label[for="tabN"] →
   * #contentN` — mismo mecanismo que usa el propio script de la app
   * (confirmado en vivo leyendo `initializeTabs()`), nunca por posición ni
   * por parsear el texto plano completo del modal (dos secciones distintas
   * repiten literalmente la palabra "Total").
   */
  async obtenerDetalleOrden(): Promise<DetalleOrdenTaller> {
    return this.page.evaluate((selectorModal) => {
      const modal = document.querySelector(selectorModal)!;
      const panelPorTexto = (textoLabel: string) => {
        const label = Array.from(modal.querySelectorAll('label[for^="tab"]'))
          .find((l) => (l.textContent || '').trim().includes(textoLabel));
        const forAttr = label?.getAttribute('for');
        return forAttr ? modal.querySelector('#' + forAttr.replace('tab', 'content')) : null;
      };
      // Este modal (Detalles de la orden) formatea los montos en estilo
      // LATAM ("$ 1.000,00" = mil, punto de miles/coma decimal) —
      // confirmado en vivo comparando contra el total real de la tarjeta
      // (que sí usa "1,000.00" estilo US, ver obtenerDatosTarjeta()): son
      // dos widgets distintos de la misma app con formato de número
      // diferente, no un error de esta suite. numMonto() es solo para
      // cifras en colones/dólares; "Cantidad" no lleva separador de miles
      // (siempre "1.00" con punto decimal literal) y usa numQty() en su lugar.
      const numQty = (t: string) => parseFloat((t || '').replace(/[^0-9.-]/g, '')) || 0;
      const numMonto = (t: string) => {
        const limpio = (t || '').replace(/[^0-9.,-]/g, '');
        return parseFloat(limpio.replace(/\./g, '').replace(',', '.')) || 0;
      };
      const entre = (texto: string, inicio: RegExp, fin: RegExp) => {
        const desde = texto.search(inicio);
        if (desde === -1) return '';
        const resto = texto.slice(desde).replace(inicio, '');
        const hasta = resto.search(fin);
        return (hasta === -1 ? resto : resto.slice(0, hasta)).trim();
      };

      const headerTexto = (modal.textContent || '').replace(/\s+/g, ' ').trim();
      const consecutivo = (headerTexto.match(/Detalles de la orden:\s*#(\d+)/) || [, ''])[1];
      const factura = entre(headerTexto, /#\s*Factura:\s*/, /\s(Creado por|Estado)/);
      const estadoEl = modal.querySelector('.order-detail-status');
      const estadoBruto = (estadoEl?.textContent || '').trim() || entre(headerTexto, /Estado:\s*/, /\s(Tarjeta|Vehículo|Cliente)/);
      const estado = estadoBruto.replace(/^Estado:\s*/i, '');

      const panelVehiculo = panelPorTexto('Vehículo');
      const textoVehiculo = (panelVehiculo?.textContent || '').replace(/\s+/g, ' ').trim();
      const cliente = {
        nombre: entre(textoVehiculo, /Nombre:\s*/, /\s*Identificaci/),
        identificacion: entre(textoVehiculo, /Identificaci[oó]n:\s*/, /\s*Email/),
        email: entre(textoVehiculo, /Email:\s*/, /\s*Tel[eé]fono/),
        telefono: entre(textoVehiculo, /Tel[eé]fono:\s*/, /\s*WhatsApp/),
        direccion: entre(textoVehiculo, /Direcci[oó]n:\s*/, /\s*(Veh[ií]culo|$)/),
      };
      const vehiculo = {
        placa: entre(textoVehiculo, /Placa No:\s*/, /\s*Marca y Modelo/),
        marcaModelo: entre(textoVehiculo, /Marca y Modelo\s*/, /\s*A[ñn]o/),
        anio: entre(textoVehiculo, /A[ñn]o\s*/, /\s*(N[uú]mero de chasis|$)/),
      };

      // La tabla de productos incluye una fila final ".subtotal-row-modal"
      // ("Subtotal Productos: $ X") con solo 2 <td> (no 3) — confirmado en
      // vivo volcando su DOM real — se excluye explícitamente para no
      // desalinear las columnas cantidad/nombre/total del resto de filas.
      const panelProductos = panelPorTexto('Servicios y productos');
      const filas = panelProductos ? Array.from(panelProductos.querySelectorAll('table tbody tr:not(.subtotal-row-modal)')) : [];
      const productos = filas.map((tr) => {
        const celdas = Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim());
        return { cantidad: numQty(celdas[0] ?? ''), nombre: celdas[1] ?? '', total: numMonto(celdas[2] ?? '') };
      }).filter((p) => p.nombre.length > 0);

      // El texto de "Resumen financiero" se lee del panel SIN la tabla de
      // productos: confirmado en vivo que su encabezado ("Cantidad Nombre
      // Total") repite literalmente la palabra "Total" antes del "Total"
      // real de la sección de resumen, más adelante en el mismo panel —
      // dejar la tabla puesta hacía que el primer "Total" encontrado fuera
      // el del encabezado, arrastrando el resto del panel completo (todas
      // las cifras concatenadas en una sola) al parsear el monto.
      const panelSinTabla = panelProductos?.cloneNode(true) as Element | undefined;
      panelSinTabla?.querySelectorAll('table').forEach((t) => t.remove());
      const textoProductosPanel = (panelSinTabla?.textContent || '').replace(/\s+/g, ' ').trim();
      const resumen = {
        subtotal: numMonto(entre(textoProductosPanel, /Sub total\s*/, /\s*Descuento/)),
        descuentoPct: numMonto(entre(textoProductosPanel, /Descuento\s*/, /%/)),
        descuentoMonto: numMonto(entre(textoProductosPanel, /Descuento[^/]*\/\s*/, /\s*Abonos/)),
        abonos: numMonto(entre(textoProductosPanel, /Abonos\s*/, /\s*Saldo pendiente/)),
        saldoPendiente: numMonto(entre(textoProductosPanel, /Saldo pendiente\s*/, /\s*Total/)),
        total: numMonto(entre(textoProductosPanel, /(?:^|\s)Total\s*/, /\s*(Asesor|$)/)),
      };

      return { consecutivo, factura, estado, cliente, vehiculo, productos, resumen };
    }, TL.DIALOG_VER_ORDEN);
  }


  // ─── "Abono" (pestaña propia dentro de "Ver Orden") ─────────────────────

  /**
   * Cambia a la pestaña "Abono" dentro de "Ver Orden" ya abierto. Confirmado
   * en vivo (observando la ejecución real) que cambiar a esta pestaña
   * dispara una petición real (`getPaymentToRepairOrder`) que carga el
   * saldo pendiente REAL de la orden — el formulario (input de monto)
   * aparece de inmediato en el DOM, pero ese saldo puede tardar varios
   * segundos en llegar. Guardar un abono antes de que esa petición termine
   * arriesga validar contra un saldo desactualizado. Se espera esa
   * respuesta explícitamente (no solo la visibilidad del formulario) antes
   * de dar la pestaña por lista.
   */
  async abrirPestanaAbono() {
    const respuestaSaldoPromise = this.page.waitForResponse(
      (res) => res.url().includes('getPaymentToRepairOrder'),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    ).catch(() => null);

    await this.modalVerOrden.locator('label[for^="tab"]', { hasText: 'Abono' }).first().click();
    await respuestaSaldoPromise;

    await expect(
      this.page.locator(TL.ABONO_MONTO),
      'El formulario "Agregar Abono" no apareció tras cambiar de pestaña'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Llena y guarda un Abono (pestaña "Abono" ya activa). "Aplicar a caja" es
   * un `<select>` nativo (no Chosen): se elige la primera opción real
   * distinta del placeholder "Caja" (catálogo configurable por empresa, sin
   * nombre estable — mismo criterio que el resto de la suite para
   * ruta/repartidor/vendedor).
   *
   * ORDEN IMPORTA: la "Forma de pago" se selecciona ANTES de llenar el
   * monto — confirmado en vivo (volcando el valor real del input) que
   * cambiar "Forma de pago" dispara un handler propio de la app que
   * reinicia "Abono" a 0, así que llenar el monto primero y elegir la forma
   * de pago después dejaba silenciosamente el monto en 0 (bug real
   * reproducido y confirmado: el campo mostraba `value="0"` pese al
   * `fill(monto)` previo). Invertir el orden es la solución completa; no
   * hace falta releer/reafirmar el monto después.
   */
  async aplicarAbono(monto: string, formaPago: FormaPagoAbono): Promise<{ cajaSeleccionada: string }> {
    await this.page.locator(TL.ABONO_FORMA_PAGO).selectOption({ label: formaPago });
    await this.page.locator(TL.ABONO_MONTO).fill(monto);

    const cajaSelect = this.page.locator(TL.ABONO_CAJA);
    const opciones = await cajaSelect.locator('option').allTextContents();
    const indice = opciones.findIndex((o, i) => i > 0 && o.trim().length > 0);
    expect(indice, 'No hay ninguna caja real disponible para aplicar el abono').toBeGreaterThan(0);
    await cajaSelect.selectOption({ index: indice });
    const cajaSeleccionada = opciones[indice].trim();

    // La señal confiable de que el abono se guardó es la respuesta real de
    // `addPaymentToRepairOrder` (POST), NO la tabla "Historial de Abonos"
    // del DOM — confirmado en vivo con captura de red: el guardado
    // responde 200 (body "1") en menos de 100ms, pero la tabla del
    // historial NO se re-renderiza sola tras un guardado exitoso (quedó
    // reintentando el poll sobre ella más de 2 minutos sin nunca detectar
    // la fila nueva, mientras la red ya confirmaba éxito hacía rato). Una
    // versión anterior de este método esperaba a que esa tabla creciera
    // como señal de éxito — con este endpoint eso puede no ocurrir nunca.
    //
    // La app también puede responder con un SweetAlert (`.sweet-alert.visible`)
    // en vez de (o junto con) la respuesta de red — sin manejarlo, ese
    // overlay queda bloqueando cualquier click posterior (confirmado en
    // vivo: un intento posterior de "Guardar" se colgó reintentando contra
    // "intercepts pointer events"). Este mismo contenedor se usa tanto para
    // el aviso de éxito ("Éxito / Abono agregado correctamente", ícono
    // `.sa-icon.sa-success`) como para el de error ("¡Hubo un error al
    // guardar el abono!", ícono `.sa-icon.sa-error`) — solo el ícono
    // interno distingue cuál es cuál, nunca la clase del contenedor.
    const guardadoPromise = this.page.waitForResponse(
      (res) => res.url().includes('addPaymentToRepairOrder'),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    ).then((res) => ({ tipo: 'red' as const, ok: res.ok() }));
    const alertaPromise = this.page.locator('.sweet-alert.visible').waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL })
      .then(() => ({ tipo: 'alerta' as const }));
    guardadoPromise.catch(() => {});
    alertaPromise.catch(() => {});

    await this.page.locator(TL.ABONO_BTN_GUARDAR).click();
    const resultado = await Promise.any([guardadoPromise, alertaPromise]).catch(() => null);

    if (resultado?.tipo === 'alerta') {
      const alerta = this.page.locator('.sweet-alert.visible');
      const esExito = (await alerta.locator('.sa-icon.sa-success').count()) > 0;
      const texto = ((await alerta.textContent()) ?? '').trim();
      // El DOM siempre incluye AMBOS botones ("Cancel" y "OK"/confirm), y
      // "Cancel" aparece primero — confirmado en vivo volcando el HTML real
      // que, para este SweetAlert, "Cancel" siempre está oculto
      // (`display:none`, `data-has-cancel-button="false"`). Un `.first()`
      // sin filtrar por visibilidad seleccionaba ese botón oculto: el click
      // fallaba en silencio (capturado por el `.catch()`) y el modal nunca
      // se cerraba. Se filtra por `:visible` para tomar siempre el botón
      // real que el usuario vería y clickearía.
      await alerta.locator('button.confirm:visible, button.cancel:visible').first().click().catch(() => {});
      await alerta.waitFor({ state: 'hidden', timeout: TIMEOUTS.PAYMENT_MODAL }).catch(() => {});

      if (!esExito) {
        throw new Error(`El sistema rechazó el abono (${formaPago}, monto ${monto}): "${texto}"`);
      }
    } else if (resultado?.tipo === 'red') {
      if (!resultado.ok) {
        throw new Error(`El guardado del abono (${formaPago}, monto ${monto}) respondió con un error HTTP`);
      }
    } else {
      throw new Error('El abono no se guardó: ni la petición de guardado ni ninguna alerta respondieron a tiempo');
    }

    // Independientemente de cuál señal ganó: la app puede mostrar además un
    // SweetAlert de confirmación un instante después de que la red ya
    // respondió — confirmado en vivo reproduciendo dos abonos seguidos en
    // la misma sesión: el segundo intento de "Guardar" quedó reintentando
    // cientos de veces contra "intercepts pointer events" porque el
    // `.sweet-overlay` del SweetAlert del abono ANTERIOR seguía en el DOM
    // sin cerrar. Se comprueba (sin bloquear si nunca aparece) y se cierra
    // antes de devolver el control, para que el próximo abono de este mismo
    // escenario no quede bloqueado por una alerta residual.
    // Confirmado en vivo (observando la ejecución real) que este SweetAlert
    // de confirmación puede tardar varios segundos en aparecer tras la
    // respuesta de red — una espera corta de 3s a veces lo dejaba pasar sin
    // cerrarlo, y su `.sweet-overlay` bloqueaba después el cierre de "Ver
    // Orden". Se usa el mismo timeout real que el resto de la suite ya
    // confía para la aparición de cualquier modal genuino.
    const alertaResidual = this.page.locator('.sweet-alert.visible');
    const apareceResidual = await alertaResidual.waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL }).then(() => true).catch(() => false);
    if (apareceResidual) {
      await alertaResidual.locator('button.confirm:visible, button.cancel:visible').first().click().catch(() => {});
      await alertaResidual.waitFor({ state: 'hidden', timeout: TIMEOUTS.PAYMENT_MODAL }).catch(() => {});
    }

    return { cajaSeleccionada };
  }

  /**
   * Lee el "Historial de Abonos" ya renderizado en la pestaña "Abono"
   * activa. Mapea cada columna por el texto real de su encabezado (no por
   * posición fija): más robusto ante cambios de orden/columnas adicionales
   * que un índice de `<td>` hardcodeado.
   */
  async obtenerHistorialAbonos(): Promise<FilaHistorialAbono[]> {
    return this.page.evaluate(() => {
      const label = Array.from(document.querySelectorAll('#dialog_vehicle_detail label[for^="tab"]'))
        .find((l) => (l.textContent || '').includes('Abono'));
      const forAttr = label?.getAttribute('for');
      const panel = forAttr ? document.querySelector('#' + forAttr.replace('tab', 'content')) : null;
      const tabla = panel?.querySelector('table');
      if (!tabla) return [];

      // Mismo formato LATAM confirmado en obtenerDetalleOrden() — ver su comentario.
      const num = (t: string) => {
        const limpio = (t || '').replace(/[^0-9.,-]/g, '');
        return parseFloat(limpio.replace(/\./g, '').replace(',', '.')) || 0;
      };
      const headers = Array.from(tabla.querySelectorAll('thead th')).map((th) => (th.textContent || '').trim().toLowerCase());
      const indiceDe = (texto: string) => headers.findIndex((h) => h.includes(texto));
      const iFecha = indiceDe('fecha');
      const iCaja = indiceDe('caja');
      const iForma = indiceDe('forma de pago');
      const iAbono = indiceDe('abono');
      const iSaldoAnterior = indiceDe('saldo anterior');
      const iNuevoSaldo = indiceDe('nuevo saldo');

      // Cuando la orden no tiene ningún abono, la tabla renderiza una única
      // fila placeholder de UN solo <td> ("No hay abonos registrados", con
      // colspan) — confirmado en vivo. Esa fila cae en la columna "Fecha"
      // (índice 0) y su texto no vacío pasaba el filtro final como si fuera
      // un abono real (nuevoSaldo=0), corrompiendo saldoPrevio en quien
      // llama. Se descarta aquí por tener menos <td> que columnas reales.
      const filas = Array.from(tabla.querySelectorAll('tbody tr'))
        .filter((tr) => tr.querySelectorAll('td').length > 1);
      return filas.map((tr) => {
        const c = Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim());
        return {
          fecha: c[iFecha] ?? '',
          caja: c[iCaja] ?? '',
          formaPago: c[iForma] ?? '',
          abono: num(c[iAbono] ?? ''),
          saldoAnterior: num(c[iSaldoAnterior] ?? ''),
          nuevoSaldo: num(c[iNuevoSaldo] ?? ''),
        };
      }).filter((f) => f.fecha.length > 0);
    });
  }


  // ─── "Ver orden online" ─────────────────────────────────────────────────

  /** Abre "Ver orden online" (enlace real `target="_blank"`) y devuelve la pestaña nueva. */
  async abrirVerOrdenOnline(id: string): Promise<Page> {
    const dropdown = await this.abrirMenuAcciones(id);
    const [pestanaNueva] = await Promise.all([
      this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP }),
      dropdown.locator(TL.MENU_VER_ORDEN_ONLINE).click(),
    ]);
    await pestanaNueva.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.NAVIGATE }).catch(() => {});
    return pestanaNueva;
  }


  // ─── "Compartir por whatsapp" ───────────────────────────────────────────

  /**
   * Presiona "Compartir por whatsapp". La función real
   * (`confirm_send_repair_order_by_whatsapp_message`) puede resolver de
   * varias formas válidas según el ambiente (SweetAlert de confirmación,
   * modal propio con documentos para compartir, o una pestaña nueva hacia
   * WhatsApp) — se arma una carrera entre las señales conocidas, mismo
   * criterio que el resto de la suite usa para flujos con más de un
   * resultado válido (_armarCarreraFacturacion), y se deja que el propio
   * escenario decida qué validar según cuál ganó.
   */
  async compartirPorWhatsapp(id: string): Promise<
    | { tipo: 'sweetAlert'; texto: string }
    | { tipo: 'modal'; modal: Locator }
    | { tipo: 'popup'; popup: Page }
  > {
    const dropdown = await this.abrirMenuAcciones(id);

    const sweetAlertPromise = this.page.locator('.sweet-alert.visible').waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP })
      .then(() => ({ tipo: 'sweetAlert' as const }));
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP })
      .then((popup) => ({ tipo: 'popup' as const, popup }));
    const modalPromise = this.page.locator('.modal.in:not(#dialog_vehicle_detail)').waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP })
      .then(() => ({ tipo: 'modal' as const }));
    [sweetAlertPromise, popupPromise, modalPromise].forEach((p) => p.catch(() => {}));

    await dropdown.locator(TL.MENU_WHATSAPP).click();
    const resultado = await Promise.any([sweetAlertPromise, popupPromise, modalPromise]);

    if (resultado.tipo === 'sweetAlert') {
      const texto = (await this.page.locator('.sweet-alert.visible').textContent()) ?? '';
      return { tipo: 'sweetAlert', texto: texto.trim() };
    }
    if (resultado.tipo === 'popup') {
      return { tipo: 'popup', popup: resultado.popup };
    }
    return { tipo: 'modal', modal: this.page.locator('.modal.in:not(#dialog_vehicle_detail)').last() };
  }


  // ─── "Email" ─────────────────────────────────────────────────────────────

  get modalEmail() {
    return this.page.locator(TL.DIALOG_EMAIL);
  }

  /** Abre el modal "Enviar Orden por Correo" desde el menú de acciones. */
  async abrirEnviarEmail(id: string) {
    const dropdown = await this.abrirMenuAcciones(id);
    await dropdown.locator(TL.MENU_EMAIL).click();
    await expect(this.modalEmail, 'El modal "Enviar Orden por Correo" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Llena el destinatario y confirma el envío (modal de Email ya abierto).
   * Confirmado en vivo (instrumentando el DOM real antes/después): presionar
   * Enter en el campo de correo agrega el tag Y dispara de inmediato
   * `sendOrderByEmailMultiple()` — el modal se cierra solo, sin necesitar
   * ningún click adicional en `.send_order_emails_btn` (que para ese
   * instante ya dejó de existir, al haberse cerrado el modal). Un click
   * adicional ahí sería redundante en el mejor caso y un doble envío en el
   * peor.
   */
  async enviarEmail(correo: string) {
    const input = this.modalEmail.locator(TL.EMAIL_INPUT);
    await input.fill(correo);
    await input.press('Enter');

    await expect(
      this.modalEmail,
      'El modal de Email no se cerró tras presionar Enter (ninguna confirmación real llegó)'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  // ─── Documentos: PDFs / Imprimir / QR ────────────────────────────────────

  /** Ejecuta una acción del menú de "Documentos" y devuelve la descarga o la pestaña nueva que produzca, lo que ocurra primero. */
  private async _accionDocumento(id: string, selectorMenu: string): Promise<{ tipo: 'download'; download: Download } | { tipo: 'popup'; popup: Page }> {
    const dropdown = await this.abrirMenuAcciones(id);

    const downloadPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.PRINT_POPUP })
      .then((download) => ({ tipo: 'download' as const, download }));
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP })
      .then((popup) => ({ tipo: 'popup' as const, popup }));
    downloadPromise.catch(() => {});
    popupPromise.catch(() => {});

    await dropdown.locator(selectorMenu).click();
    return Promise.any([downloadPromise, popupPromise]);
  }

  async descargarPdfGeneral(id: string) { return this._accionDocumento(id, TL.MENU_PDF_GENERAL); }
  async descargarPdfDescriptivo(id: string) { return this._accionDocumento(id, TL.MENU_PDF_DESCRIPTIVO); }
  async descargarPdfProforma(id: string) { return this._accionDocumento(id, TL.MENU_PDF_PROFORMA); }
  async descargarReporteInspeccion(id: string) { return this._accionDocumento(id, TL.MENU_PDF_INSPECCION); }
  async descargarQrVehiculo(id: string) { return this._accionDocumento(id, TL.MENU_QR); }

  /** "Imprimir orden": reutiliza mostrarYCerrarVentanaImpresion() ya existente en PosCore para la ventana de impresión. */
  async imprimirOrden(id: string) {
    const dropdown = await this.abrirMenuAcciones(id);
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP });
    await dropdown.locator(TL.MENU_IMPRIMIR).click();
    const printPage = await popupPromise;
    await this.pos.mostrarYCerrarVentanaImpresion(printPage);
  }


  // ─── Selección masiva + "Facturar Seleccionadas" ────────────────────────
  //
  // Los 3 botones (BTN_TOGGLE_MASIVO/BTN_SELECCIONAR_TODAS_MASIVO/
  // BTN_FACTURAR_SELECCIONADAS) viven DENTRO de un dropdown propio
  // (#repair_order_massive_dropdown_menu, display:none por defecto) que se
  // abre con su propio botón hermano `#btn_repair_order_massive_dropdown`
  // (ícono "more_vert") — confirmado en vivo volcando el wrapper completo
  // (`.repair-order-massive-dropdown-wrap`). Hay que reabrirlo antes de CADA
  // click dentro del menú, mismo motivo que el menú "Acciones" de Ruteo
  // (_abrirMenuAccionesMasivasRuteo() en pos-ruteo.page.ts): se cierra ante
  // cualquier click fuera, incluido el que marca un checkbox de tarjeta.
  //
  // El propio botón toggle (`#btn_repair_order_massive_dropdown`) también
  // necesita un click NATIVO vía evaluate(), no `.click()` de Playwright:
  // confirmado en vivo con un diagnóstico paso a paso que un click nativo en
  // AMBOS botones (el toggle del dropdown y "Seleccionar" dentro de él) sí
  // quita la clase "hide" de los 15 checkboxes de la página, mientras que el
  // click sintético de Playwright en el primero dejaba el segundo sin
  // ningún efecto observable (checkboxes seguían "hidden" incluso ya con el
  // click nativo aplicado solo al segundo botón).

  private async _abrirMenuAccionesMasivas() {
    await this.page.evaluate(
      () => (document.getElementById('btn_repair_order_massive_dropdown') as HTMLElement)?.click()
    );
    await expect(
      this.page.locator(TL.BTN_TOGGLE_MASIVO),
      'El menú de acciones masivas del listado Taller no se abrió'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    // Confirmado en vivo (diagnóstico paso a paso) que un click inmediato
    // sobre "Seleccionar" justo tras abrir este dropdown no siempre surte
    // efecto, aunque el botón ya reporte visible — mismo tipo de espera de
    // asentamiento que _cambiarMetodoPago() ya usa tras activar un checkbox
    // de slider CSS (PAUSES.CHECKBOX_ACTIVACION), no un timeout arbitrario.
    await this.page.waitForTimeout(PAUSES.CHECKBOX_ACTIVACION);
  }

  /**
   * Activa el modo de selección múltiple ("Seleccionar") del listado
   * Taller. Usa un click nativo vía evaluate() (no `.click()` de
   * Playwright): confirmado en vivo que el botón real queda con
   * `width:0/height:0/offsetParent:null` en el instante justo posterior a
   * abrir el dropdown (su propia animación de apertura), lo que hace fallar
   * la comprobación de actionability de Playwright aunque el botón sí sea
   * clickeable un instante después — mismo criterio ya usado en
   * pos-core.page.ts para "Crear factura" (`el.click()` vía evaluate,
   * evitando el chequeo de visibilidad/estabilidad del click sintético).
   */
  /**
   * Activa el modo de selección múltiple ("Seleccionar") del listado
   * Taller. NO valida con `.toBeVisible()` sobre el propio `<input>` del
   * checkbox: confirmado en vivo (instrumentando el método) que el click
   * SÍ quita la clase "hide" de los 15 contenedores de la página —
   * `#btn_repair_order_toggle_massive_select` cambia su texto a
   * "Desactivar selección" y `.repair_order_massive_checkbox_content`
   * pierde "hide" — pero el `<input>` en sí sigue "hidden" para Playwright
   * porque su CSS lo hace permanentemente invisible A PROPÓSITO
   * (`opacity:0; width:0; height:0`, confirmado en vivo en el `<style>`
   * propio del listado): es un interruptor "switch" custom donde solo el
   * `<span class="repair-order-massive-switch-slider">` hermano es lo que
   * se ve. Se valida en su lugar que el contenedor real haya perdido la
   * clase "hide" — mismo criterio que Ruteo ya documenta para sus propios
   * checkboxes "fuera del viewport" (RUTEO_MASIVO_CHECKBOX_PREFIJO).
   */
  async entrarModoSeleccionMasiva() {
    await this._abrirMenuAccionesMasivas();
    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      TL.BTN_TOGGLE_MASIVO
    );
    await expect(
      this.page.locator('.repair_order_massive_checkbox_content').first(),
      'Los checkboxes de selección masiva no quedaron visibles tras presionar "Seleccionar"'
    ).not.toHaveClass(/hide/, { timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Marca una orden para una acción masiva (modo selección ya activo).
   * Click nativo vía evaluate() (no `.check()` de Playwright, que exige
   * visibilidad real): el `<input>` en sí es permanentemente invisible por
   * diseño — ver el comentario de entrarModoSeleccionMasiva().
   */
  async marcarOrdenParaSeleccionMasiva(id: string) {
    const checkboxId = `repair_order_massive_checkbox_${id}`;
    await this.page.evaluate(
      (elId) => (document.getElementById(elId) as HTMLInputElement | null)?.click(),
      checkboxId
    );
    await expect(
      this.page.locator(TL.CHECKBOX_MASIVO_POR_ID(id)),
      `El checkbox de selección masiva de la orden #${id} no quedó marcado`
    ).toBeChecked();
  }

  /** "Seleccionar todas" del listado Taller (mismo criterio de click nativo que entrarModoSeleccionMasiva()). */
  async seleccionarTodasLasOrdenesVisibles() {
    await this._abrirMenuAccionesMasivas();
    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      TL.BTN_SELECCIONAR_TODAS_MASIVO
    );
  }

  /**
   * Presiona "Facturar seleccionadas" y completa el asistente real
   * "Facturación Masiva" que la app abre: modal (#dialog_repair_order_massive_invoice)
   * con "Paso 1 de 2 - Resumen y cliente" → botón real
   * #btn_massive_repair_to_step2 ("Continuar") → "Paso 2 de 2 - Configurar
   * líneas de factura" → botón real #btn_massive_repair_generate_invoice
   * ("Generar Factura"), que dispara un tercer modal de progreso
   * (#dialog_progress_invoicing) — éste NO se cierra solo al llegar a 100%:
   * exige un click explícito en su propio botón real #close-progress-modal
   * ("Aceptar y cerrar") para desbloquear el resto de la página (confirmado
   * en vivo: sin ese click, el backdrop del modal de progreso queda
   * interceptando cualquier click posterior indefinidamente).
   *
   * IMPORTANTE — lo que este asistente SÍ hace y lo que NO hace (confirmado
   * en vivo comparando el estado real de la orden, vía "Ver Orden", antes y
   * después): "Completado 100% / Procesadas N/N" se refiere ÚNICAMENTE a
   * cargar las líneas de las órdenes seleccionadas en el carrito del POS
   * (`#table_buy_list`, confirmado que queda con filas reales tras cerrar
   * este modal) — la orden NO queda facturada todavía en ese punto (su
   * "factura"/"estado" en "Ver Orden" siguen exactamente iguales a como
   * estaban antes). Facturar de verdad sigue exigiendo el mismo paso final
   * que cualquier venta del POS: presionar "Facturar"
   * (`pos.abrirModalDePago()`), pagar y confirmar — quien llama a este
   * método DEBE completar ese paso final; no basta con que este método
   * resuelva sin error.
   */
  async facturarSeleccionadas(): Promise<{ procesadas: number; total: number; errores: number }> {
    await this._abrirMenuAccionesMasivas();
    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      TL.BTN_FACTURAR_SELECCIONADAS
    );

    const modalMasiva = this.page.locator(TL.DIALOG_FACTURACION_MASIVA);
    await expect(modalMasiva, 'El asistente "Facturación Masiva" (Paso 1) no apareció tras "Facturar Seleccionadas"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const btnGenerar = modalMasiva.locator(TL.BTN_FACTURACION_MASIVA_GENERAR);
    await modalMasiva.locator(TL.BTN_FACTURACION_MASIVA_CONTINUAR).click();
    await expect(btnGenerar, 'El asistente "Facturación Masiva" no avanzó al Paso 2 ("Configurar líneas")').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await btnGenerar.click();

    const progreso = this.page.locator(TL.DIALOG_PROGRESO_FACTURACION_MASIVA);
    await expect(progreso, 'El modal de progreso de "Facturación Masiva" no apareció tras "Generar Factura"').toBeVisible({ timeout: TIMEOUTS.PRINT_POPUP });

    const btnCerrar = progreso.locator(TL.BTN_PROGRESO_ACEPTAR_CERRAR);
    await expect(btnCerrar, 'La "Facturación Masiva" no terminó de procesar las órdenes seleccionadas ("Aceptar y cerrar" nunca quedó disponible)').toBeVisible({ timeout: TIMEOUTS.PRINT_POPUP });

    const procesadas = Number((await progreso.locator('#processed-count').textContent())?.trim()) || 0;
    const total = Number((await progreso.locator('#total-count').textContent())?.trim()) || 0;
    const errores = Number((await progreso.locator('#total-error').textContent())?.trim()) || 0;

    await btnCerrar.click();
    await expect(progreso, 'El modal de progreso de "Facturación Masiva" no se cerró tras "Aceptar y cerrar"').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    return { procesadas, total, errores };
  }
}
