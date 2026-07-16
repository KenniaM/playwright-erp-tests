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

// Parte del plan de migración a composición: dominio "IMPORTAR_FACTURA" extraído
// de pos.page.ts. Depende de core, payment por inyección de
// constructor (composición, no herencia) — nunca al revés. Miembros que eran
// 'private' en el monolito pasan a públicos aquí por el mismo motivo que en
// PosCore: los llama la fachada por composición, no por herencia.
export class PosImportarFactura {
  private readonly core: PosCore;
  private readonly payment: PosPayment;

  constructor(core: PosCore, payment: PosPayment) {
    this.core = core;
    this.payment = payment;
  }

  private get page() { return this.core.page; }


  // ─── "Importar Factura" ─────────────────────────────────────────────────────

  /**
   * Visita la pestaña "Importar factura". A diferencia de Proforma/Apartado/
   * Enviar a caja (que abren un ítem del menú desplegable junto a "Facturar"),
   * esta es una pestaña superior con id técnico estable, ya registrada en
   * PESTANAS_POS_A_RECORRER (confirmado en vivo). Envuelve visitarPestanaPos()
   * únicamente para mantener la misma simetría de nombres ("abrirX") que
   * abrirCrearProforma()/abrirMenuOrdenCaja()/abrirCrearApartado() — no
   * duplica ninguna lógica propia.
   */
  async abrirImportarFactura() {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Importar factura')!;
    await this.core.visitarPestanaPos(pestana);
  }


  /**
   * Selecciona la primera factura disponible en la pestaña ya abierta
   * (abrirImportarFactura()) y la importa — mismo criterio "primera
   * disponible" que el resto de la suite ya usa para catálogos sin nombre
   * estable (clientes, productos, vendedores). Funciona igual sin importar si
   * la factura tiene un cliente asociado o es "Cliente de contado": confirmado
   * en vivo que la propia app sincroniza #customer_select en ambos casos
   * (con el id real, o dejándolo en 0), sin necesitar lógica especial aquí.
   *
   * Confirmado en vivo, a diferencia de Apartado/Enviar a caja/Proforma: NO
   * hay SweetAlert de confirmación antes de importar — el click en "IMPORTAR"
   * ejecuta directo. Valida que las líneas de producto realmente se cargaron
   * usando IMPORTAR_FACTURA_CARRITO_FILAS (tr.main_row), no CARRITO_CLAVES:
   * confirmado en vivo que las filas importadas no llevan el id
   * "drag_and_drop_" que sí usa el resto de la suite.
   *
   * Selecciona SIEMPRE la primera fila tal como aparece en la lista (índice
   * 0), sin ordenar ni filtrar por monto ni por ningún otro criterio de
   * búsqueda. Motivo (indicado explícitamente para esta suite, no inferido
   * aquí): el catálogo compartido de este ambiente de QA tiene facturas con
   * descripciones de producto extremadamente largas que rompen selectores y
   * validaciones del carrito ajenos al objetivo de estas pruebas — elegir por
   * otro criterio (p. ej. la vieja lógica de "menor monto visible") puede
   * aterrizar en una de esas sin ninguna forma de evitarlo de antemano,
   * mientras que la primera de la lista no presenta ese problema. Si la lista
   * está vacía, falla explícitamente en vez de buscar una alternativa.
   */
  async importarPrimeraFacturaDisponible() {
    const filas = this.page.locator(L.IMPORTAR_FACTURA_FILA);
    const primeraFila = filas.first();
    await expect(primeraFila, 'No hay ninguna factura disponible para importar').toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const respuestaDetalle = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_DETALLE_IMPORTAR_FACTURA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await primeraFila.click();
    await respuestaDetalle;

    const botonImportar = this.page.locator(L.IMPORTAR_FACTURA_BTN_IMPORTAR);
    await expect(botonImportar, 'El botón "IMPORTAR" no apareció en el modal de detalle de la factura').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const respuestaImportar = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_IMPORTAR_FACTURA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await botonImportar.click();
    await respuestaImportar;

    await expect(
      this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
      'No se cargó ninguna línea de producto tras importar la factura'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Indica si hay un cliente REAL seleccionado en el carrito ahora mismo
   * (ver el comentario de L.CLIENTE_BTN_QUITAR) — "Cliente de contado" (el
   * placeholder por defecto, p. ej. de una factura recién importada sin
   * cliente propio) devuelve false.
   */
  async hayClienteRealSeleccionado(): Promise<boolean> {
    return this.page.locator(L.CLIENTE_BTN_QUITAR).isVisible().catch(() => false);
  }


  /**
   * Lee el nombre del cliente actualmente mostrado arriba del carrito
   * (L.CLIENTE_NOMBRE_SELECCIONADO) — mismo campo que seleccionarClienteExistente()/
   * seleccionarClienteExistenteDistintoDe() ya leen justo después de elegir
   * uno, expuesto aquí como lectura independiente para validar qué cliente
   * quedó asociado a una venta ya cargada al carrito (p. ej. una Orden de
   * Ruteo seleccionada con seleccionarOrdenRuteoParaFacturar()) sin tener que
   * volver a elegir ninguno.
   */
  async obtenerClienteSeleccionado(): Promise<string> {
    return ((await this.page.locator(L.CLIENTE_NOMBRE_SELECCIONADO).textContent()) ?? '').trim();
  }


  /**
   * Quita el cliente real actualmente seleccionado del carrito (ícono "X"
   * junto a su nombre), dejándolo en "Cliente de contado". Sin SweetAlert de
   * confirmación que esperar (confirmado en vivo, ver el comentario de
   * L.CLIENTE_BTN_QUITAR) — solo se espera a que el propio ícono desaparezca,
   * señal real de que el cliente ya no está seleccionado.
   */
  async quitarClienteSeleccionado() {
    await this.page.locator(L.CLIENTE_BTN_QUITAR).click();
    await expect(
      this.page.locator(L.CLIENTE_BTN_QUITAR),
      'El cliente no se quitó: el ícono "X" sigue visible'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Importa la factura en la posición `indice` de la lista ya renderizada —
   * mismo click+espera de AJAX que importarPrimeraFacturaDisponible() (no se
   * reutiliza esa función tal cual porque siempre opera sobre `.first()`;
   * ver el comentario de _cargarOrdenCajaQueCumpla() en esta misma clase para
   * el mismo criterio ya aplicado a Órdenes de Caja: se prefiere una pequeña
   * duplicación puntual a modificar un método público ya en uso por varios
   * tests).
   */
  async _importarFacturaEnPosicion(indice: number) {
    const filas = this.page.locator(L.IMPORTAR_FACTURA_FILA);
    await expect(
      filas.nth(indice),
      `No hay una factura en la posición ${indice} para reintentar`
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const respuestaDetalle = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_DETALLE_IMPORTAR_FACTURA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await filas.nth(indice).click();
    await respuestaDetalle;

    const botonImportar = this.page.locator(L.IMPORTAR_FACTURA_BTN_IMPORTAR);
    await expect(botonImportar, 'El botón "IMPORTAR" no apareció en el modal de detalle de la factura').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const respuestaImportar = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_IMPORTAR_FACTURA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await botonImportar.click();
    await respuestaImportar;

    await expect(
      this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
      'No se cargó ninguna línea de producto tras importar la factura'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Importa la primera factura disponible que cumpla `predicado` (evaluado
   * DESPUÉS de importarla — no hay forma de saber si una factura trae
   * cliente sin importarla primero, a diferencia de Órdenes de Caja/Apartado
   * que sí exponen esos datos en la propia tarjeta). Si `predicado` no se
   * cumple, vacía el carrito y reintenta con la siguiente factura de la
   * lista — mismo patrón de reintento por posición ya usado en
   * cargarPrimerApartadoConTotalRazonable().
   */
  async _importarFacturaQueCumpla(predicado: () => Promise<boolean>, descripcion: string) {
    const MAX_INTENTOS = 10;
    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      await this._importarFacturaEnPosicion(intento);

      // Confirmado en vivo (2 corridas de la MISMA factura, una recién tras
      // importar y otra momentos después): si el import trae un cliente real
      // vinculado, ese vínculo puede tardar un instante más en reflejarse en
      // el DOM que las líneas de producto (una llamada async independiente,
      // posterior a getPosImportInvoiceItemList) — leer
      // hayClienteRealSeleccionado() de inmediato puede dar un falso "no
      // tiene cliente". Se espera a que el carrito "asiente" (mismo criterio
      // ya usado en cargarPrimerApartadoConTotalRazonable()) antes de evaluar
      // el predicado.
      await this.page.waitForTimeout(PAUSES.VER_CARRITO);

      if (await predicado()) return;

      await this.core.vaciarCarrito();
      await this.abrirImportarFactura();
    }
    throw new Error(`No se encontró ninguna factura que ${descripcion} entre las primeras ${MAX_INTENTOS} disponibles.`);
  }


  /** Importa la primera factura disponible que YA tenga un cliente real asociado. */
  async importarPrimeraFacturaConCliente() {
    await this._importarFacturaQueCumpla(() => this.hayClienteRealSeleccionado(), 'tenga un cliente real asociado');
  }


  /** Importa la primera factura disponible que NO tenga cliente asociado (queda en "Cliente de contado"). */
  async importarPrimeraFacturaSinCliente() {
    await this._importarFacturaQueCumpla(async () => !(await this.hayClienteRealSeleccionado()), 'NO tenga cliente asociado (Cliente de contado)');
  }


  /** Cuenta las tarjetas de factura actualmente renderizadas en la pestaña "Importar factura". */
  async contarFacturasVisibles(): Promise<number> {
    return this.page.locator(L.IMPORTAR_FACTURA_FILA).count();
  }


  /**
   * Lee el "No." (número real y visible) de la primera tarjeta de la pestaña
   * "Importar factura" ya abierta — mismo criterio que
   * obtenerNumeroApartadoTarjetaMasReciente(). Confirmado en vivo (volcando
   * el texto real de la tarjeta, formato "No. 811 - Factura Electrónica -
   * Crédito - 14/07/2026") que es el único campo que el buscador real
   * (buscarFacturasPorTexto()) indexa de forma discriminante — a diferencia
   * del nombre de cliente, compartido por la mayoría de las facturas de este
   * ambiente QA y por lo tanto inútil para localizar una factura puntual.
   */
  async obtenerNumeroFacturaTarjetaMasReciente(): Promise<string> {
    const texto = await this.page.locator(L.IMPORTAR_FACTURA_FILA).first().innerText();
    const coincidencia = texto.match(/No\.\s*(\d+)/);
    expect(coincidencia, `No se pudo leer "No." de la primera tarjeta: "${texto}"`).not.toBeNull();
    return coincidencia![1];
  }


  /**
   * Busca facturas usando el campo de búsqueda REAL de esta pestaña:
   * `#product_search` (L.PRODUCTO_BUSCADOR_GRID), el mismo input reutilizado
   * por buscarProductoEnGrid()/buscarOrdenesCajaPorTexto()/buscarApartadosPorTexto()
   * — persiste en el header del POS sin importar el tab activo. Confirmado en
   * vivo interceptando la red que, con "Importar factura" activa, dispara su
   * propio AJAX real (`getPosSaleReceipList`, L.AJAX_BUSCAR_IMPORTAR_FACTURA,
   * con `search=<texto>` e `import_invoice_state` — el mismo parámetro que
   * usan los botones de filtro de estado) que reemplaza el listado de
   * tarjetas por el resultado filtrado en el servidor.
   */
  async buscarFacturasPorTexto(texto: string) {
    const totalAntes = await this.contarFacturasVisibles();

    const respuestaPromise = this.page.waitForResponse((res) => {
      if (!res.url().includes(L.AJAX_BUSCAR_IMPORTAR_FACTURA)) return false;
      const post = decodeURIComponent((res.request().postData() ?? '').replace(/\+/g, ' '));
      return post.includes(texto);
    }, { timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.core.buscarProductoEnGrid(texto);
    await respuestaPromise;

    await expect.poll(
      () => this.contarFacturasVisibles(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El resultado de la búsqueda no terminó de renderizarse' }
    ).not.toBe(totalAntes);
  }


  /**
   * Cuenta, sobre las tarjetas de factura YA renderizadas (p. ej. tras un
   * buscarFacturasPorTexto() con un resultado más amplio que 1), cuántas
   * contienen `texto` en su contenido visible — mismo criterio ya usado en
   * contarApartadosConTexto(), útil para confirmar que una factura puntual
   * sigue presente dentro de un resultado de búsqueda parcial más amplio.
   */
  async contarFacturasConTexto(texto: string): Promise<number> {
    return this.page.locator(L.IMPORTAR_FACTURA_FILA).filter({ hasText: texto }).count();
  }


  /**
   * Presiona uno de los botones de filtro de estado del documento electrónico
   * (L.IMPORTAR_FACTURA_ESTADO_BOTON: "Todos"/"Aceptado"/"Rechazadas"/
   * "Reenviar"/"No aplica") y espera la respuesta real de
   * AJAX_BUSCAR_IMPORTAR_FACTURA que efectivamente re-renderiza el listado —
   * confirmado en vivo que cada botón dispara ese mismo endpoint con un
   * `import_invoice_state` distinto (all/accepted/rejected/resend/not_apply).
   * Devuelve la cantidad de tarjetas que quedaron visibles tras filtrar — en
   * este ambiente compartido, "Aceptado"/"Rechazadas" pueden legítimamente
   * devolver 0 (ningún documento en ese estado real todavía), así que quien
   * llama no debe asumir un conteo fijo.
   */
  async filtrarFacturasPorEstado(estado: keyof typeof L.IMPORTAR_FACTURA_ESTADO_BOTON): Promise<number> {
    const totalAntes = await this.contarFacturasVisibles();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_BUSCAR_IMPORTAR_FACTURA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.IMPORTAR_FACTURA_ESTADO_BOTON[estado]).click();
    await respuestaPromise;

    // La respuesta ya resuelta no garantiza que el DOM ya haya reemplazado
    // las tarjetas con el resultado filtrado — mismo cuidado que
    // buscarFacturasPorTexto()/buscarApartadosPorTexto(): se espera la
    // condición real (el conteo cambia respecto al filtro anterior), nunca
    // una pausa fija. Si el filtro elegido resulta en el mismo conteo que el
    // anterior (p. ej. dos estados con igual cantidad real de documentos),
    // el propio conteo ya estable se devuelve sin bloquear: la respuesta de
    // red ya confirmó que el filtro correcto se aplicó.
    await expect.poll(
      () => this.contarFacturasVisibles(),
      { timeout: 5_000 }
    ).not.toBe(totalAntes).catch(() => {});
    return this.contarFacturasVisibles();
  }


  /** @deprecated Usar abrirAgregarItem() — se mantiene únicamente por compatibilidad con pos-importar-factura.spec.ts, sin duplicar lógica. */
  async abrirAgregarItemImportarFactura() {
    return this.core.abrirAgregarItem();
  }


  /** @deprecated Usar volverDesdeAgregarItem(pestana) — se mantiene únicamente por compatibilidad con pos-importar-factura.spec.ts, sin duplicar lógica. */
  async volverDesdeAgregarItemImportarFactura() {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Importar factura')!;
    return this.core.volverDesdeAgregarItem(pestana);
  }
}
