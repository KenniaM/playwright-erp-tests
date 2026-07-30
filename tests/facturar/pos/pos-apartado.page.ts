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

// Parte del plan de migración a composición: dominio "APARTADO" extraído
// de pos.page.ts. Depende de core, payment por inyección de
// constructor (composición, no herencia) — nunca al revés. Miembros que eran
// 'private' en el monolito pasan a públicos aquí por el mismo motivo que en
// PosCore: los llama la fachada por composición, no por herencia.
export class PosApartados {
  private readonly core: PosCore;
  private readonly payment: PosPayment;

  constructor(core: PosCore, payment: PosPayment) {
    this.core = core;
    this.payment = payment;
  }

  private get page() { return this.core.page; }


  /**
   * Lee el "Saldo Actual" real de un Apartado ya reabierto (L.TOTAL_LAYAWAY_SALDO_ACTUAL),
   * la fila del footer principal que sí refleja el total original menos los
   * abonos ya aplicados — a diferencia de obtenerTotalVentaNumerico(), que lee
   * el total del modal de pago (L.TOTAL_MODAL) y no se actualiza fuera de ese
   * modal.
   */
  async obtenerSaldoActualApartado(): Promise<number> {
    const texto = await this.page.locator(L.TOTAL_LAYAWAY_SALDO_ACTUAL).textContent();
    return this.core._leerMontoDeTexto(texto ?? '$0.00');
  }


  // ─── "Generar Apartado" ─────────────────────────────────────────────────────
  //
  // A diferencia de Proforma y Enviar a caja, "Generar Apartado" NO abre un
  // modal propio: reutiliza el modal de pago normal (#dialog_payment),
  // mostrando #make_layaway en vez de #make_payment (confirmado en vivo,
  // Fase 1). Todo lo demás del modal (cliente Forma 1/2, vendedor, métodos de
  // pago, descuentos) son los MISMOS campos que ya usa el resto de la suite —
  // ver seleccionarClienteExistente(), seleccionarPagoEfectivo(),
  // seleccionarPagoExacto()/seleccionarPagoParcial(), seleccionarPagoMixto(),
  // aplicarDescuentoIndividual(), activarDescuentoGeneral().

  /** Locator del botón "GENERAR APARTADO" — única señal confiable de que el modal de pago quedó en modo Apartado. */
  get botonGenerarApartado() {
    return this.page.locator(L.APARTADO_BTN_GENERAR);
  }


  /**
   * Abre el menú de acciones junto a "Facturar" (mismo menú MDL que "Enviar a
   * caja"/"Proforma", L.ORDEN_CAJA_MENU_BTN) y selecciona "Generar Apartado".
   * Reutiliza el mismo patrón de reintento + cierre de overlays ya probado en
   * abrirMenuOrdenCaja()/abrirCrearProforma(), cambiando únicamente el ítem y
   * la señal de éxito esperada (el botón #make_layaway, no un modal propio).
   *
   * IMPORTANTE (confirmado en vivo tras investigar a fondo un falso positivo):
   * el POS debe haberse cargado con cargarPosDesdeDashboard() —no con
   * cargarPosYCerrarModalSiAparece()—, igual que ya hacen pos-proforma.spec.ts
   * y pos-orden-caja.spec.ts. Cargar directo a la URL del POS dispara una
   * condición de carga en frío ya documentada (ver el comentario de
   * cargarPosDesdeDashboard()) que puede abortar la inicialización de un
   * widget no relacionado (Selectize de #invoice_customer_email) y, por
   * efecto colateral, impedir que este botón llegue a mostrarse.
   */
  async abrirCrearApartado() {
    await this.core.cerrarModalNotificacionesSiAparece();
    await this.core.cerrarAvisoConsecutivoSiAparece();

    await this.page.locator('ul.mdl-menu[data-mdl-for="demo-menu-top-right"][data-upgraded*="MaterialMenu"]')
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const item = this.page.locator(L.APARTADO_MENU_ITEM);
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
    expect(abierto, `La opción "Generar Apartado" no apareció en el menú de acciones tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      L.APARTADO_MENU_ITEM
    );

    await expect(this.botonGenerarApartado, 'El botón "GENERAR APARTADO" no apareció tras seleccionar la opción del menú').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Busca y selecciona un cliente DENTRO del modal de pago (Forma 2): escribe
   * en el input propio del modal (APARTADO_CLIENTE_INPUT_BUSQUEDA, distinto al
   * de arriba del carrito), dispara el mismo AJAX (CLIENTE_AJAX_BUSQUEDA) y
   * elige la primera opción real de un Chosen (APARTADO_CLIENTE_CHOSEN).
   *
   * Confirmado en vivo, corrigiendo un supuesto inicial equivocado: NO
   * reutiliza las tarjetas .customer-list-pos de Forma 1 —esas sí se
   * renderizan con los datos correctos, pero quedan anidadas dentro de un
   * contenedor que permanece display:none mientras el modal está abierto, así
   * que no son clickeables ni visibles para un usuario real—. El control
   * realmente visible es el Chosen #payment_credit_client_chosen (mismo
   * patrón que seleccionarClienteEnOrdenCaja()); confirmado en vivo que elegir
   * una opción ahí sí sincroniza #customer_select, el campo que add_layaway()
   * efectivamente lee al guardar.
   */
  async seleccionarClienteEnModalApartado(terminoBusqueda = ''): Promise<string> {
    await this.page.locator(L.APARTADO_CLIENTE_INPUT_BUSQUEDA).fill(terminoBusqueda);

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.CLIENTE_AJAX_BUSQUEDA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.APARTADO_CLIENTE_BTN_BUSCAR).click();
    await respuestaPromise;

    await this.core._seleccionarPrimeraOpcionChosen(L.APARTADO_CLIENTE_CHOSEN);

    const nombreCliente = await this.core._obtenerTextoChosenSeleccionado(L.APARTADO_CLIENTE_CHOSEN);
    expect(nombreCliente, 'El nombre del cliente seleccionado en "Generar Apartado" no quedó visible').not.toBe('');

    await expect(
      this.page.locator(L.CLIENTE_SELECT_OCULTO),
      'El cliente elegido en el modal no quedó registrado en #customer_select'
    ).not.toHaveValue('');

    console.log(`[seleccionarClienteEnModalApartado] Cliente seleccionado: "${nombreCliente}"`);
    return nombreCliente;
  }


  /**
   * Presiona "GENERAR APARTADO", confirma el SweetAlert de advertencia
   * ("¿Está seguro de realizar este Apartado?") y espera la respuesta real de
   * red que efectivamente lo crea (AJAX_GUARDAR_APARTADO) — mismo patrón ya
   * usado en enviarOrdenCaja()/guardarProformaYObtenerRespuesta(): la espera
   * del AJAX se arma ANTES de confirmar el SweetAlert, no después.
   *
   * El sistema abre además una ventana de impresión del Apartado tras crearlo
   * (confirmado en vivo) que este método no cerraba — quedaba abierta de
   * fondo mientras el resto del escenario seguía interactuando con la página
   * original. Mismo patrón ya usado en confirmarCerrarCaja(): el listener de
   * "popup" se arma ANTES del click (con `.catch(() => null)`, nunca
   * bloqueante, porque no todos los ambientes la muestran) y se cierra con
   * mostrarYCerrarVentanaImpresion() recién después de confirmar el éxito
   * real vía AJAX_GUARDAR_APARTADO, para no competir con la propia creación
   * del Apartado.
   */
  async guardarApartadoYObtenerRespuesta(): Promise<Response> {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP }).catch(() => null);

    await this.botonGenerarApartado.click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_APARTADO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.core._confirmarSweetAlertV1('No apareció la confirmación "¿Está seguro de realizar este Apartado?"');
    const respuesta = await respuestaPromise;

    const printPage = await popupPromise;
    if (printPage) {
      await this.core.mostrarYCerrarVentanaImpresion(printPage);
    }

    return respuesta;
  }


  /**
   * Valida que "Generar Apartado" terminó exitosamente: la respuesta real de
   * AJAX_GUARDAR_APARTADO respondió OK con un id numérico (>=1, mismo
   * contrato que el resto de la suite), el modal de pago se cerró y el
   * carrito quedó vacío. A diferencia de Proforma, Apartado NO tiene un modal
   * de "Gestión" posterior (confirmado en vivo, Fase 1) — solo cierra
   * #dialog_payment y limpia el carrito.
   */
  async validarApartadoCreado(respuesta: Response) {
    expect(respuesta.ok(), `${L.AJAX_GUARDAR_APARTADO} no respondió OK (status ${respuesta.status()})`).toBe(true);

    const cuerpo = (await respuesta.text()).trim();
    expect(parseInt(cuerpo, 10), `${L.AJAX_GUARDAR_APARTADO} no devolvió un id válido (respondió "${cuerpo}")`).toBeGreaterThanOrEqual(1);

    await expect(
      this.botonGenerarApartado,
      'El modal de pago no se cerró tras confirmar el Apartado'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.payment.validarCarritoVacio();
  }


  // ─── Apartado YA EXISTENTE: localizar, cargar y "Abonar" ───────────────────
  // Mismo criterio "primera disponible, sin buscar" que cargarPrimeraOrdenCajaDisponible()
  // — ver el comentario de L.AJAX_CARGAR_APARTADO para la evidencia de por qué
  // se reutilizan L.IMPORTAR_FACTURA_FILA/L.ORDEN_CAJA_LISTA_BTN_CARGAR tal
  // cual en vez de declarar un selector nuevo idéntico.

  /**
   * Carga el primer Apartado disponible en la pestaña ya abierta — mismo
   * patrón exacto que cargarPrimeraOrdenCajaDisponible(), solo que espera
   * AJAX_CARGAR_APARTADO en vez de AJAX_CARGAR_ORDEN_CAJA.
   *
   * Confirmado en vivo: este ambiente compartido puede tener Apartados
   * "vacíos" (tarjeta con "Total: ₡0.00", sin ninguna línea de producto
   * real detrás) mezclados con los que sí tienen ítems — no se detecta
   * leyendo la tarjeta antes de cargarla (ver cargarPrimerApartadoConTotalRazonable()
   * para el caso hermano de Total corrupto). Mismo remedio: reintentar por
   * posición (nth) en vez de asumir que tarjetas.first() siempre trae datos
   * reales, sin heredar el mismo candidato vacío en cada intento.
   */
  async cargarPrimerApartadoDisponible() {
    const MAX_INTENTOS = 5;

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      const tarjetas = this.page.locator(L.IMPORTAR_FACTURA_FILA);
      await expect(
        tarjetas.nth(intento),
        `No hay un Apartado en la posición ${intento} para reintentar`
      ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

      const respuestaPromise = this.page.waitForResponse(
        (res) => res.url().includes(L.AJAX_CARGAR_APARTADO),
        { timeout: TIMEOUTS.PAYMENT_MODAL }
      );
      await tarjetas.nth(intento).locator(L.ORDEN_CAJA_LISTA_BTN_CARGAR).click();
      await respuestaPromise;

      const cargoLinea = await expect(
        this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
        'No se cargó ninguna línea de producto tras seleccionar el Apartado'
      ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL }).then(() => true).catch(() => false);
      if (cargoLinea) return;

      console.log(`[cargarPrimerApartadoDisponible] Apartado en posición ${intento} cargó sin ninguna línea de producto (Apartado vacío) — se descarta y se reintenta con el siguiente.`);
      const pestanaApartados = await this.core.localizarPestanaApartados();
      if (pestanaApartados) await this.core.visitarPestanaPos(pestanaApartados);
    }
    throw new Error(`No se encontró ningún Apartado con al menos una línea de producto entre los primeros ${MAX_INTENTOS} disponibles.`);
  }


  /**
   * Busca Apartados usando el campo de búsqueda REAL de esta pestaña:
   * `#product_search` (L.PRODUCTO_BUSCADOR_GRID), el mismo input reutilizado
   * por buscarProductoEnGrid()/buscarOrdenesCajaPorTexto() — persiste en el
   * header del POS sin importar el tab activo. CORRECCIÓN: un comentario
   * previo en este archivo (igual que el que existía para Órdenes de Caja
   * antes de buscarOrdenesCajaPorTexto()) afirmaba que esta pestaña no tenía
   * campo de búsqueda propio; confirmado en vivo interceptando la red que sí
   * lo tiene — mientras "Apartados" está activa dispara su propio AJAX real
   * (`getPosLayawaySearch`, L.AJAX_BUSCAR_APARTADO, con `search=<texto>` y
   * `state=pending`) que reemplaza el listado de tarjetas por el resultado
   * filtrado en el servidor. Confirmado en vivo que este buscador indexa el
   * "Apartado No" (el número real, sin el prefijo "Apartado No:" que sí
   * muestra la tarjeta — buscar con ese prefijo devuelve 0 resultados) y el
   * nombre del cliente.
   */
  async buscarApartadosPorTexto(texto: string) {
    const totalAntes = await this.contarApartadosVisibles();

    // Mismo cuidado que buscarOrdenesCajaPorTexto(): la carga inicial de la
    // pestaña ya dispara su propia llamada a este mismo endpoint (con
    // `search=` vacío), cuya respuesta puede seguir en vuelo y resolver
    // después de que este método ya empezó a esperar la próxima — se
    // distingue por el contenido real de la petición, no solo por la URL.
    const respuestaPromise = this.page.waitForResponse((res) => {
      if (!res.url().includes(L.AJAX_BUSCAR_APARTADO)) return false;
      const post = decodeURIComponent((res.request().postData() ?? '').replace(/\+/g, ' '));
      return post.includes(texto);
    }, { timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.core.buscarProductoEnGrid(texto);
    await respuestaPromise;

    // La respuesta ya resuelta no garantiza que el DOM ya haya reemplazado
    // las tarjetas con el resultado filtrado — se espera la condición real:
    // que el total de tarjetas cambie del valor previo a buscar.
    await expect.poll(
      () => this.contarApartadosVisibles(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El resultado de la búsqueda no terminó de renderizarse' }
    ).not.toBe(totalAntes);
  }


  /** Cuenta las tarjetas de Apartado actualmente renderizadas en la pestaña — útil antes/después de buscarApartadosPorTexto() para validar que la búsqueda realmente redujo el conjunto. */
  async contarApartadosVisibles(): Promise<number> {
    return this.page.locator(L.IMPORTAR_FACTURA_FILA).count();
  }


  /**
   * Cuenta, sobre las tarjetas de Apartado YA renderizadas (p. ej. tras un
   * buscarApartadosPorTexto() con un resultado más amplio que 1), cuántas
   * contienen `texto` en su contenido visible — util para confirmar que un
   * Apartado puntual sigue presente dentro de un resultado de búsqueda
   * parcial más amplio, sin volver a golpear el servidor.
   */
  async contarApartadosConTexto(texto: string): Promise<number> {
    return this.page.locator(L.IMPORTAR_FACTURA_FILA).filter({ hasText: texto }).count();
  }


  /**
   * Lee el "Apartado No: X" (número real y visible) de la primera tarjeta de
   * la pestaña "Apartados" ya abierta. Necesario porque el id que devuelve
   * AJAX_GUARDAR_APARTADO es un id interno de base de datos (confirmado en
   * vivo: p. ej. "670") que NO coincide con el "Apartado No" que la propia
   * tarjeta muestra (p. ej. "120", un consecutivo aparte) ni aparece en
   * ningún texto — visible u oculto — de la tarjeta por el que
   * filtrarApartadosPorTexto() pueda localizarlo. Confirmado en vivo que la
   * pestaña ordena de más reciente a más antiguo: tras crear un Apartado y
   * (re)visitar esta pestaña, el recién creado siempre queda de primero.
   */
  async obtenerNumeroApartadoTarjetaMasReciente(): Promise<string> {
    const texto = await this.page.locator(L.IMPORTAR_FACTURA_FILA).first().innerText();
    const coincidencia = texto.match(/Apartado No:\s*(\d+)/);
    expect(coincidencia, `No se pudo leer "Apartado No" de la primera tarjeta: "${texto}"`).not.toBeNull();
    return coincidencia![1];
  }


  /**
   * Carga el primer Apartado disponible cuyo "Total" visible en la tarjeta
   * sea razonable (< 100,000) — confirmado en vivo (2 hallazgos
   * independientes, en dos monedas distintas: "₡6,656,677,711.25" y
   * "$14,557,786.76") que este ambiente compartido de QA tiene Apartados ya
   * existentes con un Total corrupto, inflado varios órdenes de magnitud
   * por un bug real del sistema al leer un Apartado guardado en una moneda
   * distinta a la que esté activa en ese momento (ver el comentario del
   * describe "Apartados — Moneda contraria a la base" en
   * pos-apartado.spec.ts). cargarPrimerApartadoDisponible() sigue siendo
   * correcto para escenarios que no comparan totales numéricos (agregar
   * ítems, abonar, facturar sin comparar antes/después); este método es
   * para los que sí lo hacen, y evita heredar ese dato corrupto sin
   * necesidad de "arreglar" el Apartado en sí (fuera del alcance de esta
   * suite).
   */
  async cargarPrimerApartadoConTotalRazonable() {
    const UMBRAL_TOTAL_SOSPECHOSO = 100_000;
    const MAX_INTENTOS = 5;

    // El Total corrupto NO es detectable leyendo la tarjeta antes de cargarla
    // (su "Total:" visible ahí ya es incorrecto/inflado también, confirmado
    // en vivo) — solo se confirma tras cargar el Apartado al carrito. Por
    // eso se carga primero y se valida después, reintentando con el
    // siguiente candidato (por posición: el Apartado corrupto sigue
    // "pendiente" en el sistema tras vaciarCarrito(), así que seguiría
    // apareciendo de primero si se repitiera tarjetas.first() — se avanza
    // por índice para no reintentar siempre el mismo).
    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      const tarjetas = this.page.locator(L.IMPORTAR_FACTURA_FILA);
      await expect(
        tarjetas.nth(intento),
        `No hay un Apartado en la posición ${intento} para reintentar`
      ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

      const respuestaPromise = this.page.waitForResponse(
        (res) => res.url().includes(L.AJAX_CARGAR_APARTADO),
        { timeout: TIMEOUTS.PAYMENT_MODAL }
      );
      await tarjetas.nth(intento).locator(L.ORDEN_CAJA_LISTA_BTN_CARGAR).click();
      await respuestaPromise;

      await expect(
        this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
        'No se cargó ninguna línea de producto tras seleccionar el Apartado'
      ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

      // Confirmado en vivo: el Total corrupto no siempre está reflejado en
      // el instante justo en que la primera línea aparece — una recalculación
      // asíncrona posterior (disparada por el propio conflicto de moneda) lo
      // termina de inflar unos instantes después. Se espera a que el carrito
      // "asiente" (mismo criterio que el resto de la suite tras un cambio de
      // carrito) antes de leer el total, para no dejar pasar un Apartado que
      // en realidad sí está corrupto.
      await this.page.waitForTimeout(PAUSES.VER_CARRITO);

      const totalCargado = await this.core.obtenerTotalVentaNumerico();
      if (totalCargado < UMBRAL_TOTAL_SOSPECHOSO) return;

      console.log(`[cargarPrimerApartadoConTotalRazonable] Apartado en posición ${intento} cargó con un Total corrupto (${totalCargado}) — se descarta y se reintenta con el siguiente.`);
      await this.core.vaciarCarrito();
      const pestanaApartados = await this.core.localizarPestanaApartados();
      if (pestanaApartados) await this.core.visitarPestanaPos(pestanaApartados);
    }
    throw new Error(`No se encontró ningún Apartado con un Total razonable (< ${UMBRAL_TOTAL_SOSPECHOSO}) entre los primeros ${MAX_INTENTOS} disponibles.`);
  }


  /**
   * Abre el menú de acciones junto a "Facturar" y selecciona "Abonar" — mismo
   * patrón de reintento que abrirCrearApartado()/abrirMenuOrdenCaja(),
   * cambiando únicamente el ítem (L.ABONO_MENU_ITEM) y la señal de éxito
   * esperada (L.ABONO_BTN_REALIZAR, "REALIZAR ABONO" — el modal de pago
   * normal reutilizado una vez más, ver el comentario de L.ABONO_MENU_ITEM).
   * Requiere un Apartado ya cargado al carrito (cargarPrimerApartadoDisponible());
   * "Abonar" no aparece visible en el menú si el carrito está vacío o si el
   * carrito no proviene de un Apartado ya existente (confirmado en vivo).
   */
  async abrirRealizarAbono() {
    await this.core.cerrarModalNotificacionesSiAparece();
    await this.core.cerrarAvisoConsecutivoSiAparece();

    await this.page.locator('ul.mdl-menu[data-mdl-for="demo-menu-top-right"][data-upgraded*="MaterialMenu"]')
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const item = this.page.locator(L.ABONO_MENU_ITEM);
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
    expect(abierto, `La opción "Abonar" no apareció en el menú de acciones tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      L.ABONO_MENU_ITEM
    );

    await expect(
      this.page.locator(L.ABONO_BTN_REALIZAR),
      'El botón "REALIZAR ABONO" no apareció tras seleccionar la opción del menú'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Presiona "REALIZAR ABONO", confirma el SweetAlert de advertencia
   * ("¿Está seguro(a) de realizar este abono?" — mismo widget SweetAlert v1,
   * reutiliza _confirmarSweetAlertV1() tal cual pese a que el botón real dice
   * "Continuar" en vez de "Aceptar": confirmado en vivo que el selector
   * `.sweet-alert.visible button.confirm` no depende del texto visible) y
   * espera la respuesta real de red que efectivamente registra el abono
   * (AJAX_APLICAR_ABONO).
   */
  async aplicarAbonoYObtenerRespuesta(): Promise<Response> {
    // El sistema abre una ventana de impresión del comprobante de abono tras
    // aplicarlo (confirmado en vivo: es la causa real de que el modal
    // "REALIZAR ABONO" pareciera no cerrarse — quedaba abierta de fondo,
    // mismo hallazgo ya corregido en guardarApartadoYObtenerRespuesta()). El
    // listener de "popup" se arma ANTES del click (con `.catch(() => null)`,
    // nunca bloqueante, porque no todos los ambientes la muestran) y se
    // cierra con mostrarYCerrarVentanaImpresion() recién después de
    // confirmar el éxito real vía AJAX_APLICAR_ABONO.
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP }).catch(() => null);

    await this.page.locator(L.ABONO_BTN_REALIZAR).click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_APLICAR_ABONO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.core._confirmarSweetAlertV1('No apareció la confirmación "¿Está seguro(a) de realizar este abono?"');
    const respuesta = await respuestaPromise;

    // El toast de confirmación es transitorio (se autodesvanece a los pocos
    // segundos) — confirmado en vivo que revisarlo DESPUÉS de cerrar la
    // ventana de impresión (mostrarYCerrarVentanaImpresion() por sí sola ya
    // toma ~6s de esperas propias) puede perderlo por completo, aunque el
    // abono se haya aplicado correctamente. Se verifica aquí, apenas llega
    // la respuesta real, antes de gastar tiempo cerrando el popup — la
    // misma validación que antes vivía en validarAbonoAplicado(), reubicada
    // por la carrera de tiempo real que introdujo el manejo del popup.
    await expect(
      this.page.locator('.noty_bar', { hasText: /abono/i }),
      'No apareció el toast de confirmación del abono'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const printPage = await popupPromise;
    if (printPage) {
      await this.core.mostrarYCerrarVentanaImpresion(printPage);
    }

    return respuesta;
  }


  /**
   * Valida que "Abonar" terminó exitosamente: la respuesta real de
   * AJAX_APLICAR_ABONO respondió OK y el modal de pago se cerró (el toast de
   * confirmación ya se verificó en aplicarAbonoYObtenerRespuesta(), antes de
   * cerrar la ventana de impresión — ver su comentario). A diferencia de
   * validarApartadoCreado()/validarOrdenCajaCreada(), NO valida carrito
   * vacío: confirmado en vivo que las líneas del Apartado permanecen en el
   * carrito tras aplicar un abono (el Apartado sigue pendiente, solo se
   * registró un pago parcial).
   */
  async validarAbonoAplicado(respuesta: Response) {
    expect(respuesta.ok(), `${L.AJAX_APLICAR_ABONO} no respondió OK (status ${respuesta.status()})`).toBe(true);

    await expect(
      this.page.locator(L.ABONO_BTN_REALIZAR),
      'El modal de pago no se cerró tras confirmar el abono'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }
}
