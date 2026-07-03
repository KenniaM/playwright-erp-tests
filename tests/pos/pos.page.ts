import { expect, Locator, Page } from '@playwright/test';

// ─── URL ──────────────────────────────────────────────────────────────────────

export const POS_URL =
  'https://dev.designsoftcr.com/qa_talleralpha/public/pos/pointOfSale?company_pos=37&pos_type_option=1';

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

  // ─── Métodos privados ────────────────────────────────────────────────────────

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
