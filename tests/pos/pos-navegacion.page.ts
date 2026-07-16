import { expect, Download, Locator, Page, Response } from '@playwright/test';
import { L } from './pos.locators';
import {
  TIMEOUTS, PAUSES, CAJA_TEXTO, CHECKBOX_ID, PestanaPos, PESTANA_POS_FACTURACION,
  PESTANAS_POS_A_RECORRER, MetodoPago, METODO, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT,
  TipoPagoOrdenCaja, TipoProforma, VEHICULO_PINTURA_TIPO, COMPANIA_POS, CABYS_BUSQUEDA,
  CABYS_BUSQUEDA_SIN_IVA, PRECIO_PRODUCTO_RAPIDO, EscenarioDescuento, ResultadoDescuento,
  EstadoCheckIva, ConfigBusquedaCabys, LineaCarrito, MetadatoProducto, DASHBOARD_URL,
} from './pos.types';
import { PosCore } from './pos-core.page';

// Parte del plan de migración a composición: dominio "NAVEGACION" extraído
// de pos.page.ts. Depende de core por inyección de
// constructor (composición, no herencia) — nunca al revés. Miembros que eran
// 'private' en el monolito pasan a públicos aquí por el mismo motivo que en
// PosCore: los llama la fachada por composición, no por herencia.
export class PosNavigation {
  private readonly core: PosCore;

  constructor(core: PosCore) {
    this.core = core;
  }

  private get page() { return this.core.page; }


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
      await this.core.cerrarModalNotificacionesSiAparece();
      await this.core.cerrarAvisoConsecutivoSiAparece();

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
    const modalNotificacionesVisible = await this.core.modalNotificaciones.isVisible().catch(() => false);
    const avisoConsecutivoVisible = await this.core.avisoConsecutivoFueraDeRango.isVisible().catch(() => false);
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
    await this.core._clickPrimeraOpcionDisponible(L.PINTURA_PARTE, 'parte');
  }


  /** Selecciona la primera pieza disponible para la parte ya elegida. */
  async seleccionarPrimeraPieza() {
    await this.core._clickPrimeraOpcionDisponible(L.PINTURA_PIEZA, 'pieza');
  }


  /**
   * Selecciona el primer servicio disponible para la pieza ya elegida. Este
   * paso abre el modal "Selecciona un precio" — no se espera aquí porque cuál
   * de los dos (precio único auto-aplicado o modal con opciones) depende de
   * datos del servicio, y es responsabilidad de quien llama decidir qué esperar.
   */
  async seleccionarPrimerServicioPintura() {
    await this.core._clickPrimeraOpcionDisponible(L.PINTURA_SERVICIO, 'servicio');
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


  /**
   * Tras seleccionarPrimerServicioPintura(), determina cuál de los dos
   * caminos válidos tomó el sistema — investigado en vivo (request/response
   * reales de getServiceByPiece + DOM de la tarjeta del servicio):
   *
   * - "agregado_directo": la tarjeta del servicio ya trae el primer precio
   *   pre-cableado como su propio onclick (fillContainerPrices() en
   *   pos_straightening_and_painting.js asigna
   *   prepare_service_before_add_item_to_table(prices[0].sip_id, ...) a la
   *   tarjeta completa apenas se renderiza) — el click en
   *   seleccionarPrimerServicioPintura() ya agregó la línea al carrito, sin
   *   ningún modal de por medio.
   * - "requiere_modal": el servicio no dejó ese onclick directo (o el
   *   sistema decide mostrar el modal "Selecciona un precio" por alguna otra
   *   condición de negocio) y #dialog_select_prices sí aparece — el
   *   elemento sigue existiendo en el DOM (confirmado en vivo) aunque en el
   *   camino de agregado directo nunca se abra.
   *
   * Se arman ambas esperas ANTES de decidir cuál ganó (mismo patrón que
   * confirmarPagoAbriendoCajaSiEsNecesario() usa para popup/modalAbrirCaja),
   * nunca con waitForTimeout(): cada rama se resuelve con su propio
   * expect.poll()/locator.waitFor(), y la que no ocurre expira sola en
   * background sin bloquear el resultado.
   */
  async esperarServicioPinturaAgregadoOModalPrecio(clavesAntes: string[]): Promise<'agregado_directo' | 'requiere_modal'> {
    const agregadoDirecto = expect.poll(
      async () => (await this.core.obtenerClavesProductos()).length,
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    ).toBeGreaterThan(clavesAntes.length)
      .then(() => 'agregado_directo' as const)
      .catch(() => null);

    const requiereModal = this.modalSeleccionarPrecio
      .waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL })
      .then(() => 'requiere_modal' as const)
      .catch(() => null);

    const resultado = await Promise.race([agregadoDirecto, requiereModal]);
    if (!resultado) {
      throw new Error(
        'Tras seleccionar el servicio de End. Pintura, ni el carrito creció ni apareció el modal "Selecciona un precio" — revisar manualmente.'
      );
    }
    return resultado;
  }


  // ─── Vista Expandida / Vista Normal ─────────────────────────────────────────

  /**
   * Indica si Vista Expandida está activa consultando el efecto real en el
   * DOM (visibilidad de L.PRODUCT_CONTENT), no solo una clase CSS aislada:
   * confirmado en vivo que al activarse, PRODUCT_CONTENT dejar de ser
   * visible (oculta también el buscador de la grilla, que vive dentro).
   */
  async vistaExpandidaActiva(): Promise<boolean> {
    return !(await this.page.locator(L.PRODUCT_CONTENT).isVisible());
  }


  /**
   * Abre el menú de tres puntos (reutiliza abrirMenuTresPuntos()) y clickea
   * "Expandir/Encoger", reintentando de forma acotada — mismo patrón de
   * overlays ya usado en el resto de menús MDL de esta clase, confirmado en
   * vivo que #switch_compress sufre la misma inestabilidad intermitente.
   * Valida el cambio real combinando la respuesta de AJAX_VISTA_COMPRIMIDA
   * (persistida por el servidor) con el estado real de vistaExpandidaActiva()
   * — no solo una clase CSS — y devuelve el nuevo estado.
   */
  async alternarVistaExpandida(): Promise<boolean> {
    const estadoAntes = await this.vistaExpandidaActiva();
    const MAX_INTENTOS = 8;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      await this.core.cerrarModalNotificacionesSiAparece();
      await this.core.cerrarTodosLosToastsSiAparecen();
      await this.abrirMenuTresPuntos();

      const visible = await this.page.locator(L.SWITCH_COMPRESS)
        .waitFor({ state: 'visible', timeout: 2_000 })
        .then(() => true)
        .catch(() => false);
      if (!visible) continue;

      const respuestaPromise = this.page.waitForResponse(
        (res) => res.url().includes(L.AJAX_VISTA_COMPRIMIDA),
        { timeout: 4_000 }
      ).catch(() => null);
      const clickeado = await this.page.locator(L.SWITCH_COMPRESS)
        .click({ timeout: 4_000 })
        .then(() => true)
        .catch(() => false);

      if (clickeado) {
        const respuesta = await respuestaPromise;
        if (respuesta) {
          await expect.poll(() => this.vistaExpandidaActiva(), { timeout: 3_000 }).toBe(!estadoAntes);
          return !estadoAntes;
        }
      }
    }
    throw new Error(`No se pudo alternar Vista Expandida tras ${MAX_INTENTOS} intentos`);
  }


  /**
   * Busca un producto por su código exacto (interno o de barras) usando el
   * buscador interno que solo aparece con Vista Expandida activa
   * (L.BUSCADOR_INTERNO_VISTA_EXPANDIDA) y espera a que quede agregado al
   * carrito. Confirmado en vivo (código fuente + red) que este buscador NO
   * usa el mismo autocomplete que el de la grilla: dispara un AJAX distinto
   * (AJAX_BUSCADOR_INTERNO) y filtra por código, no por nombre. Con un único
   * resultado coincidente —el caso normal al buscar por código exacto—, la
   * propia aplicación autoselecciona el resultado y lo agrega llamando a la
   * misma función add_to_table() que usa el click normal de la grilla; por
   * eso la confirmación de que se agregó reutiliza el mismo criterio ya
   * usado en el resto de la suite (crecimiento de L.CARRITO_CLAVES), sin
   * duplicar esa lógica de validación.
   */
  async agregarProductoPorCodigoEnVistaExpandida(codigo: string, montoSiEsPorMonto = PRECIO_PRODUCTO_RAPIDO): Promise<void> {
    // obtenerClavesFilasCarrito() (no obtenerClavesProductos()): confirmado
    // en vivo (Escenario 16 de pos-ruteo.spec.ts, root-cause investigado a
    // fondo, no asumido) que este método causaba un timeout de 120s
    // permanente al buscar un producto sobre el carrito de una Orden de
    // Ruteo ya cargada — el producto SÍ se agregaba correctamente (visible
    // en el DOM, con su precio/código reales), pero obtenerClavesProductos()
    // solo cuenta filas con id "drag_and_drop_" (ver su propio comentario:
    // ausente en líneas IMPORTADAS, como las de una Orden de Ruteo/Caja/
    // factura ya cargada) — con clavesAntes ya en 0 por ese motivo,
    // clavesDespues también podía quedar en 0 si la fila recién agregada
    // tampoco quedaba marcada así en este contexto, dejando la condición
    // ">0" imposible de cumplir para siempre. obtenerClavesFilasCarrito()
    // cubre ambos tipos de fila (documentado en su propio comentario) y es
    // la fuente ya usada por el resto de la suite para este mismo problema.
    const clavesAntes = await this.core.obtenerClavesFilasCarrito();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_BUSCADOR_INTERNO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.BUSCADOR_INTERNO_VISTA_EXPANDIDA).fill(codigo);
    await this.page.locator(L.BUSCADOR_INTERNO_VISTA_EXPANDIDA).press('Enter');
    await respuestaPromise;

    // Modal "Monto a comprar" (ver L.DIALOG_MONTO_A_COMPRAR y el comentario
    // de agregarProductoDelGridAlCarrito(), que ya maneja este mismo caso
    // para el click directo del grid): confirmado en vivo (root-cause real,
    // reportado en vivo por el usuario mientras corría este mismo
    // escenario) que el buscador interno de Vista Expandida puede
    // encontrar un producto que se vende "por monto"/peso y abrir este
    // modal en vez de agregar la línea directo — sin manejarlo, el poll de
    // abajo esperaría para siempre una línea que nunca llega porque el
    // modal queda abierto sin confirmar. No es anticipable de antemano
    // (mismo motivo ya documentado en L.DIALOG_MONTO_A_COMPRAR: no viene
    // como argumento de add_to_table()), así que se espera con el timeout
    // completo de PAYMENT_MODAL y se completa si aparece, igual criterio
    // que la versión de grid.
    const modalMontoACompra = this.page.locator(L.DIALOG_MONTO_A_COMPRAR);
    const abrioModalMonto = await modalMontoACompra
      .waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL })
      .then(() => true)
      .catch(() => false);
    if (abrioModalMonto) {
      await this.page.locator(L.MONTO_A_COMPRAR_INPUT_MONTO).fill(montoSiEsPorMonto);
      await this.page.locator(L.MONTO_A_COMPRAR_BTN_CONFIRMAR).click();
      await expect(modalMontoACompra, 'El modal "Monto a comprar" no se cerró tras presionar "Continuar"').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
    }

    await expect.poll(
      async () => (await this.core.obtenerClavesFilasCarrito()).length,
      { timeout: TIMEOUTS.PRODUCTS_LOAD }
    ).toBeGreaterThan(clavesAntes.length);
  }
}
