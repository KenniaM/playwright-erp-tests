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
import { PosPayment } from './pos-payment.page';

// Parte del plan de migración a composición: dominio "ORDEN_CAJA" extraído
// de pos.page.ts. Depende de core, payment por inyección de
// constructor (composición, no herencia) — nunca al revés. Miembros que eran
// 'private' en el monolito pasan a públicos aquí por el mismo motivo que en
// PosCore: los llama la fachada por composición, no por herencia.
export class PosOrdenCaja {
  private readonly core: PosCore;
  private readonly payment: PosPayment;

  constructor(core: PosCore, payment: PosPayment) {
    this.core = core;
    this.payment = payment;
  }

  private get page() { return this.core.page; }


  // ─── "Orden de Caja" (Enviar a caja) ───────────────────────────────────────
  //
  // Alternativa a facturar de inmediato: registra la venta actual del
  // carrito como pendiente de cobro (queda listada luego en la pestaña
  // "Órdenes de caja", PESTANAS_POS_A_RECORRER). Confirmado en vivo que el
  // botón real NO está junto a "Facturar" como botón independiente — vive
  // dentro del menú desplegable propio que abre ORDEN_CAJA_MENU_BTN
  // (distinto del menú de tres puntos del encabezado — ver
  // abrirMenuTresPuntos()).

  /** Locator del modal "Enviar a caja" (Orden de Caja). */
  get modalOrdenCaja() {
    return this.page.locator(L.DIALOG_ORDEN_CAJA);
  }


  /** Locator del campo "Factura a nombre de terceros" del modal "Enviar a caja". */
  get campoTercerosOrdenCaja() {
    return this.page.locator(L.ORDEN_CAJA_INPUT_TERCERO);
  }


  /**
   * Abre el menú de acciones junto a "Facturar" y selecciona "Enviar a
   * caja". El botón (ORDEN_CAJA_MENU_BTN) es el mismo tipo de FAB de
   * Material Design que MENU_TRES_PUNTOS —con ripple continuo, que lo
   * mantiene "inestable" para Playwright— así que reutiliza el mismo patrón
   * ya probado en abrirMenuTresPuntos(): esperar (sin abortar si nunca
   * llega) a que MDL termine de "upgradear" su <ul> asociado, y reintentar
   * el click unas cuantas veces en vez de asumir que el primero alcanza.
   *
   * Confirmado en vivo (no asumido, corrigiendo una versión anterior más
   * simple de este método que fallaba de forma intermitente): sin esta
   * espera y reintento, el click vía evaluate() puede no disparar nada — el
   * listener de MDL todavía no estaba ligado en ese instante. El atributo
   * de este menú es "data-mdl-for" (no simplemente "for", a diferencia de
   * MENU_TRES_PUNTOS_INICIALIZADO) — confirmado inspeccionando el DOM real.
   * Nunca se usa force:true: el click nativo vía evaluate() es la misma
   * técnica que el resto de la suite ya usa para checkboxes de slider CSS.
   */
  async abrirMenuOrdenCaja() {
    await this.core.cerrarModalNotificacionesSiAparece();
    await this.core.cerrarAvisoConsecutivoSiAparece();

    await this.page.locator('ul.mdl-menu[data-mdl-for="demo-menu-top-right"][data-upgraded*="MaterialMenu"]')
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const item = this.page.locator(L.ORDEN_CAJA_MENU_ITEM);
    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      await this.core.cerrarModalNotificacionesSiAparece();
      await this.core.cerrarAvisoConsecutivoSiAparece();

      await this.page.evaluate(
        (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
        L.ORDEN_CAJA_MENU_BTN
      );
      abierto = await item.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, `La opción "Enviar a caja" no apareció en el menú de acciones tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      L.ORDEN_CAJA_MENU_ITEM
    );

    await expect(this.modalOrdenCaja, 'El modal "Enviar a caja" no apareció tras seleccionar la opción del menú').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Busca y selecciona un cliente DENTRO del modal "Enviar a caja" (Forma 2)
   * — confirmado en vivo que usa un control distinto al panel de arriba del
   * carrito (seleccionarClienteExistente(), Forma 1): un <select> Chosen
   * (ORDEN_CAJA_CLIENTE_CHOSEN) poblado por el mismo AJAX
   * (CLIENTE_AJAX_BUSQUEDA), no el panel de tarjetas .customer-list-pos.
   * Una búsqueda vacía trae todos los clientes disponibles — confirmado en
   * vivo. Reutiliza _seleccionarPrimeraOpcionChosen() para elegir la primera
   * opción real (no el placeholder "Seleccionar cliente"), mismo criterio
   * que el resto de la suite para catálogos sin nombre estable por el cual
   * filtrar. Devuelve el nombre del cliente realmente seleccionado.
   */
  async seleccionarClienteEnOrdenCaja(terminoBusqueda = ''): Promise<string> {
    await this.page.locator(L.ORDEN_CAJA_CLIENTE_INPUT_BUSQUEDA).fill(terminoBusqueda);

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.CLIENTE_AJAX_BUSQUEDA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.ORDEN_CAJA_CLIENTE_BTN_BUSCAR).click();
    await respuestaPromise;

    await this.core._seleccionarPrimeraOpcionChosen(L.ORDEN_CAJA_CLIENTE_CHOSEN);

    const nombreCliente = await this._obtenerTextoChosenSeleccionado(L.ORDEN_CAJA_CLIENTE_CHOSEN);
    expect(nombreCliente, 'El nombre del cliente seleccionado en "Enviar a caja" no quedó visible').not.toBe('');
    console.log(`[seleccionarClienteEnOrdenCaja] Cliente seleccionado: "${nombreCliente}"`);
    return nombreCliente;
  }


  /**
   * Lee el nombre del cliente actualmente reflejado en el modal "Enviar a
   * caja" — sirve tanto para confirmar lo elegido por seleccionarClienteEnOrdenCaja()
   * (Forma 2) como para confirmar que un cliente elegido arriba del carrito
   * (seleccionarClienteExistente(), Forma 1) sí se propagó aquí, ya que
   * ambas formas comparten el mismo <select> subyacente — confirmado en
   * vivo.
   */
  async obtenerClienteEnOrdenCaja(): Promise<string> {
    return this._obtenerTextoChosenSeleccionado(L.ORDEN_CAJA_CLIENTE_CHOSEN);
  }


  /**
   * Selecciona el primer vendedor real disponible en "Enviar a caja" —
   * catálogo configurable por la empresa sin nombre estable, mismo criterio
   * que el resto de la suite (CABYS, tipo/tasa de IVA, parte/pieza/servicio
   * de End. Pintura). Opcional: confirmado en vivo que el modal se puede
   * enviar sin tocarlo (queda en su placeholder "Seleccionar Vendedor").
   * Devuelve el nombre realmente seleccionado.
   */
  async seleccionarVendedorOrdenCaja(): Promise<string> {
    await this.core._seleccionarPrimeraOpcionChosen(L.ORDEN_CAJA_VENDEDOR_CHOSEN);
    const nombreVendedor = await this._obtenerTextoChosenSeleccionado(L.ORDEN_CAJA_VENDEDOR_CHOSEN);
    expect(nombreVendedor, 'El vendedor seleccionado en "Enviar a caja" no quedó visible').not.toBe('');
    console.log(`[seleccionarVendedorOrdenCaja] Vendedor seleccionado: "${nombreVendedor}"`);
    return nombreVendedor;
  }


  /**
   * Selecciona "Contado" o "Crédito" en "Enviar a caja". Ambos checkboxes
   * usan slider CSS (mismo patrón que el resto de checkboxes de esta
   * suite) — se accionan reutilizando _asegurarCheckboxEstado() tal cual,
   * nunca con un click directo de Playwright ni force:true.
   *
   * Confirmado en vivo: elegir "Crédito" revela "Fecha de Vencimiento" (ya
   * con un valor por defecto) y cambia el campo oculto
   * ORDEN_CAJA_TIPO_PAGO_HIDE a "2" ("1" = Contado). También confirmado:
   * "Crédito" EXIGE un cliente real seleccionado — con nombre de terceros
   * únicamente, o sin cliente, "Enviar a caja" no dispara ninguna petición
   * ni alerta (bloqueo silencioso). Seleccionar el cliente antes de enviar
   * es responsabilidad de quien orquesta el test: esta función no lo exige
   * porque "Contado" sí es válido sin cliente.
   */
  async seleccionarTipoPagoOrdenCaja(tipo: TipoPagoOrdenCaja) {
    if (tipo === 'credito') {
      await this.core._asegurarCheckboxEstado(this.page.locator(L.ORDEN_CAJA_CHECK_CREDITO), 'ck_is_send_sale_payment_credit', true);
      await expect(
        this.page.locator(L.ORDEN_CAJA_FECHA_VENCIMIENTO_CONTENEDOR),
        '"Fecha de Vencimiento" no apareció tras seleccionar Crédito'
      ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    } else {
      await this.core._asegurarCheckboxEstado(this.page.locator(L.ORDEN_CAJA_CHECK_CONTADO), 'ck_is_send_sale_payment_cash', true);
    }

    await expect(
      this.page.locator(L.ORDEN_CAJA_TIPO_PAGO_HIDE),
      `El tipo de pago no quedó registrado como "${tipo}"`
    ).toHaveValue(tipo === 'credito' ? '2' : '1');
  }


  /**
   * Activa "A nombre de terceros" en "Enviar a caja" y llena el nombre.
   * Checkbox de slider CSS (mismo patrón, reutiliza _asegurarCheckboxEstado()):
   * confirmado en vivo que el campo de texto nace deshabilitado y solo se
   * habilita tras activar el checkbox (enable_send_sale_third_customer()).
   */
  async activarNombreTercerosOrdenCaja(nombre: string) {
    await this.core._asegurarCheckboxEstado(this.page.locator(L.ORDEN_CAJA_CHECK_TERCERO), 'ck_send_sale_third_person_name', true);

    const campo = this.campoTercerosOrdenCaja;
    await expect(campo, 'El campo "Factura a nombre de terceros" no se habilitó tras activar el checkbox').toBeEnabled({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await campo.fill(nombre);
  }


  /** Llena las observaciones de "Enviar a caja" — marcado como obligatorio en el propio formulario. */
  async llenarObservacionesOrdenCaja(texto: string) {
    await this.page.locator(L.ORDEN_CAJA_OBSERVACIONES).fill(texto);
  }


  /**
   * Presiona "Enviar a caja", confirma el SweetAlert de advertencia
   * ("¿Está seguro de enviar esta venta a caja?") y espera la respuesta
   * real de red que efectivamente crea la orden (AJAX_ENVIAR_ORDEN_CAJA) —
   * confirmado en vivo interceptando la red tras confirmar. La espera del
   * AJAX se arma ANTES de confirmar el SweetAlert, no después — mismo
   * motivo que el resto de la suite: un listener registrado después del
   * click puede perderse la respuesta si esta llega demasiado rápido.
   */
  async enviarOrdenCaja(): Promise<Response> {
    await this.page.locator(L.ORDEN_CAJA_BTN_ENVIAR).click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_ENVIAR_ORDEN_CAJA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.core._confirmarSweetAlertV1('No apareció la confirmación "¿Está seguro de enviar esta venta a caja?"');
    return respuestaPromise;
  }


  /**
   * Valida que "Enviar a caja" terminó exitosamente, sin depender
   * únicamente del toast: la respuesta real de AJAX_ENVIAR_ORDEN_CAJA
   * respondió OK, el modal se cerró, apareció el toast de confirmación y el
   * carrito quedó vacío (mismo criterio de cierre que la facturación
   * normal — ver validarCarritoVacio()).
   */
  async validarOrdenCajaCreada(respuesta: Response) {
    expect(respuesta.ok(), `${L.AJAX_ENVIAR_ORDEN_CAJA} no respondió OK (status ${respuesta.status()})`).toBe(true);

    await expect(
      this.modalOrdenCaja,
      'El modal "Enviar a caja" no se cerró tras confirmar el envío'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await expect(
      this.page.locator('.noty_bar', { hasText: /enviado a caja/i }),
      'No apareció el toast de confirmación de "Enviar a caja"'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.payment.validarCarritoVacio();
  }

  async _obtenerTextoChosenSeleccionado(...args: Parameters<PosCore['_obtenerTextoChosenSeleccionado']>) {
    return this.core._obtenerTextoChosenSeleccionado(...args);
  }


  // ─── "Órdenes de Caja" (seleccionar una ya existente) ──────────────────────

  /**
   * Visita la pestaña "Órdenes de caja" — mismo patrón que abrirImportarFactura(),
   * envuelve visitarPestanaPos() con la entrada ya registrada en
   * PESTANAS_POS_A_RECORRER, sin duplicar esa lógica.
   */
  async abrirOrdenesCaja() {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Órdenes de caja')!;
    await this.core.visitarPestanaPos(pestana);
  }


  /**
   * Selecciona la primera Orden de Caja disponible en la pestaña ya abierta y
   * la carga al carrito — mismo criterio "primera disponible, sin buscar"
   * adoptado para Importar Factura (ver el comentario de
   * importarPrimeraFacturaDisponible(): elegir por otro criterio, p. ej.
   * menor monto, puede aterrizar en una orden con líneas problemáticas sin
   * ninguna forma de evitarlo de antemano).
   *
   * A diferencia de importarPrimeraFacturaDisponible(), el click real está en
   * un ícono anidado dentro de la tarjeta (L.ORDEN_CAJA_LISTA_BTN_CARGAR,
   * confirmado en vivo que la tarjeta en sí no tiene onclick propio) y carga
   * directo al carrito sin modal de detalle ni botón de confirmación aparte
   * — confirmado en vivo interceptando la red (getPosCashItemList, sin
   * ningún SweetAlert de por medio).
   */
  async cargarPrimeraOrdenCajaDisponible() {
    const filas = this.page.locator(L.IMPORTAR_FACTURA_FILA);
    const primeraFila = filas.first();
    await expect(primeraFila, 'No hay ninguna Orden de Caja disponible').toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_CARGAR_ORDEN_CAJA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await primeraFila.locator(L.ORDEN_CAJA_LISTA_BTN_CARGAR).click();
    await respuestaPromise;

    await expect(
      this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
      'No se cargó ninguna línea de producto tras seleccionar la Orden de Caja'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Carga la primera Orden de Caja, entre las ya renderizadas en la pestaña,
   * que cumpla `predicado` — mismo click real que cargarPrimeraOrdenCajaDisponible()
   * (ORDEN_CAJA_LISTA_BTN_CARGAR dentro de la tarjeta, AJAX_CARGAR_ORDEN_CAJA),
   * pero sobre una tarjeta elegida por criterio en vez de siempre `.first()`.
   *
   * Sirve para localizar una Orden de Caja por una característica propia de
   * la tarjeta (tipo de pago, vendedor asignado) que el buscador real de esta
   * pestaña (`#product_search` / L.PRODUCTO_BUSCADOR_GRID, ver
   * buscarOrdenesCajaPorTexto()) no indexa — cada tarjeta expone esos datos
   * en su propio HTML (confirmado en vivo), así que se filtra sobre las ya
   * renderizadas en vez de depender de ese buscador para estos casos.
   */
  async _cargarOrdenCajaQueCumpla(
    predicado: (tarjeta: Locator) => Promise<boolean>,
    descripcion: string
  ) {
    const tarjetas = this.page.locator(L.IMPORTAR_FACTURA_FILA);
    // Mismo criterio que cargarPrimeraOrdenCajaDisponible(): esperar
    // explícitamente (hasta PRODUCTS_LOAD) a que la primera tarjeta esté
    // realmente renderizada antes de contar — un .count() inmediato tras
    // abrirOrdenesCaja() puede correr antes de que el AJAX que llena la
    // lista termine, devolviendo 0 en falso (confirmado en vivo: causaba
    // "No hay ninguna Orden de Caja disponible" incluso habiendo decenas
    // disponibles).
    await expect(tarjetas.first(), 'No hay ninguna Orden de Caja disponible').toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
    const total = await tarjetas.count();

    for (let i = 0; i < total; i++) {
      const tarjeta = tarjetas.nth(i);
      if (await predicado(tarjeta)) {
        const respuestaPromise = this.page.waitForResponse(
          (res) => res.url().includes(L.AJAX_CARGAR_ORDEN_CAJA),
          { timeout: TIMEOUTS.PAYMENT_MODAL }
        );
        await tarjeta.locator(L.ORDEN_CAJA_LISTA_BTN_CARGAR).click();
        await respuestaPromise;

        await expect(
          this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
          'No se cargó ninguna línea de producto tras seleccionar la Orden de Caja'
        ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
        return;
      }
    }
    throw new Error(`No se encontró ninguna Orden de Caja que ${descripcion} entre las ${total} tarjetas ya cargadas.`);
  }


  /** Carga la primera Orden de Caja ya renderizada que se haya creado a Crédito (ver el comentario de _cargarOrdenCajaQueCumpla()). */
  async cargarPrimeraOrdenCajaACreditoDisponible() {
    await this._cargarOrdenCajaQueCumpla(
      async (tarjeta) => (await tarjeta.locator(L.ORDEN_CAJA_TARJETA_TIPO_PAGO_HIDE).textContent().catch(() => null))?.trim() === '2',
      'se haya creado a Crédito'
    );
  }


  /**
   * Carga la primera Orden de Caja ya renderizada que tenga un vendedor real
   * asignado — la propia tarjeta solo imprime la línea "Vendedor: <nombre>"
   * cuando la orden tiene uno (confirmado en vivo), así que basta con
   * filtrar por ese texto visible.
   */
  async cargarPrimeraOrdenCajaConVendedorDisponible() {
    await this._cargarOrdenCajaQueCumpla(
      async (tarjeta) => /Vendedor:\s*\S/.test(await tarjeta.innerText().catch(() => '')),
      'tenga un vendedor asignado'
    );
  }


  /**
   * Busca Órdenes de Caja usando el campo de búsqueda REAL de esta pestaña:
   * `#product_search` (L.PRODUCTO_BUSCADOR_GRID), el mismo input que
   * buscarProductoEnGrid() usa para el catálogo de productos — persiste en
   * el header del POS sin importar el tab activo, y mientras "Órdenes de
   * caja" está activa dispara su propio AJAX real (`getPosCashSearch`,
   * L.AJAX_BUSCAR_ORDEN_CAJA) que reemplaza el listado de tarjetas por el
   * resultado filtrado en el servidor.
   *
   * CORRECCIÓN: un comentario previo en este archivo (y el test que lo usaba)
   * afirmaban que esta pestaña no tenía ningún campo de búsqueda propio —
   * confirmado en vivo que sí lo tiene, solo que no estaba en
   * `#content_invoice_order_list` (donde se buscó originalmente) sino en el
   * header persistente del POS. También confirmado en vivo que este buscador
   * indexa el nombre del cliente (real o de texto libre vía
   * ingresarNombreCliente()) pero NO la observación oculta de la tarjeta
   * (buscar por una observación única devolvió "No se encontraron órdenes
   * que mostrar").
   */
  async buscarOrdenesCajaPorTexto(texto: string) {
    const totalAntes = await this.contarOrdenesCajaVisibles();

    // abrirOrdenesCaja() ya dispara su propia llamada a este mismo endpoint
    // (con `search=` vacío, para la carga inicial de la pestaña) — confirmado
    // en vivo que su RESPUESTA puede seguir en vuelo y resolver DESPUÉS de
    // que este método ya empezó a esperar "la próxima respuesta de
    // getPosCashSearch", haciendo que `waitForResponse` atrape por error esa
    // respuesta vieja (sin filtrar) en vez de la de esta búsqueda. Se
    // distingue por el contenido real de la petición (su `search=<texto>`),
    // no solo por la URL.
    const respuestaPromise = this.page.waitForResponse((res) => {
      if (!res.url().includes(L.AJAX_BUSCAR_ORDEN_CAJA)) return false;
      const post = decodeURIComponent((res.request().postData() ?? '').replace(/\+/g, ' '));
      return post.includes(texto);
    }, { timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.core.buscarProductoEnGrid(texto);
    await respuestaPromise;

    // La respuesta ya resuelta no garantiza que el DOM ya haya reemplazado
    // las tarjetas con el resultado filtrado — ese re-render corre en un
    // callback aparte, después de recibir la respuesta. Se espera la
    // condición real: que el total de tarjetas cambie del valor previo a
    // buscar.
    await expect.poll(
      () => this.contarOrdenesCajaVisibles(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El resultado de la búsqueda no terminó de renderizarse' }
    ).not.toBe(totalAntes);
  }


  /** Cuenta las tarjetas de Orden de Caja actualmente renderizadas en la pestaña — útil antes/después de buscarOrdenesCajaPorTexto() para validar que la búsqueda realmente redujo el conjunto. */
  async contarOrdenesCajaVisibles(): Promise<number> {
    return this.page.locator(L.IMPORTAR_FACTURA_FILA).count();
  }
}
