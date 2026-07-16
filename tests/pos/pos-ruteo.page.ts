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

// Parte del plan de migración a composición: dominio "RUTEO" extraído
// de pos.page.ts. Depende de core, payment por inyección de
// constructor (composición, no herencia) — nunca al revés. Miembros que eran
// 'private' en el monolito pasan a públicos aquí por el mismo motivo que en
// PosCore: los llama la fachada por composición, no por herencia.
export class PosRuteo {
  private readonly core: PosCore;
  private readonly payment: PosPayment;

  constructor(core: PosCore, payment: PosPayment) {
    this.core = core;
    this.payment = payment;
  }

  private get page() { return this.core.page; }


  // ─── "Orden de Ruteo" ───────────────────────────────────────────────────────

  /** Locator del modal "Crear Orden de Ruteo". */
  get modalRuteo() {
    return this.page.locator(L.DIALOG_RUTEO);
  }


  /**
   * Abre "Crear Orden de Ruteo" desde el menú desplegable junto a "Facturar"
   * (mismo menú que Proforma/Apartado/Enviar a caja, #demo-menu-top-right).
   * Mismo patrón de reintento (hasta 4 intentos, cerrando overlays conocidos
   * en cada vuelta) que abrirMenuOrdenCaja()/abrirCrearProforma()/
   * abrirCrearApartado() ya usan cada uno por su cuenta para este mismo
   * menú — necesario porque el modal requiere al menos un producto en el
   * carrito (create_routing_order() lo valida y aborta con un aviso si no lo
   * hay, dejando el modal sin abrir), así que quien llama debe agregar
   * producto(s) antes.
   */
  async abrirCrearOrdenRuteo() {
    await this.core.cerrarModalNotificacionesSiAparece();
    await this.core.cerrarAvisoConsecutivoSiAparece();

    await this.page.locator('ul.mdl-menu[data-mdl-for="demo-menu-top-right"][data-upgraded*="MaterialMenu"]')
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const item = this.page.locator(L.RUTEO_MENU_ITEM);
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
    expect(abierto, `La opción "Orden de Ruteo" no apareció en el menú de acciones tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      L.RUTEO_MENU_ITEM
    );

    await expect(this.modalRuteo, 'El modal "Crear Orden de Ruteo" no apareció tras seleccionar la opción del menú').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Busca y selecciona un cliente DENTRO del modal "Crear Orden de Ruteo"
   * (Forma 2) — confirmado en vivo (no asumido de Apartado/Enviar a caja) que
   * usa su propio input (RUTEO_CLIENTE_INPUT_BUSQUEDA, distinto de ambos) pero
   * dispara el mismo AJAX compartido (CLIENTE_AJAX_BUSQUEDA) y llena un
   * <select> Chosen propio (RUTEO_CLIENTE_CHOSEN) — mismo mecanismo general
   * que seleccionarClienteEnOrdenCaja()/seleccionarClienteEnModalApartado(),
   * aplicado a los selectores reales de este modal. Una búsqueda vacía trae
   * todos los clientes disponibles — confirmado en vivo. Reutiliza
   * _seleccionarPrimeraOpcionChosen() para elegir la primera opción real (no
   * el placeholder "Seleccionar cliente"). Devuelve el nombre del cliente
   * realmente seleccionado.
   */
  async seleccionarClienteEnRuteo(terminoBusqueda = ''): Promise<string> {
    await this.page.locator(L.RUTEO_CLIENTE_INPUT_BUSQUEDA).fill(terminoBusqueda);

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.CLIENTE_AJAX_BUSQUEDA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.RUTEO_CLIENTE_BTN_BUSCAR).click();
    await respuestaPromise;

    await this.core._seleccionarPrimeraOpcionChosen(L.RUTEO_CLIENTE_CHOSEN);

    const nombreCliente = await this.core._obtenerTextoChosenSeleccionado(L.RUTEO_CLIENTE_CHOSEN);
    expect(nombreCliente, 'El nombre del cliente seleccionado en "Crear Orden de Ruteo" no quedó visible').not.toBe('');
    console.log(`[seleccionarClienteEnRuteo] Cliente seleccionado: "${nombreCliente}"`);
    return nombreCliente;
  }


  /**
   * Lee el nombre del cliente actualmente reflejado en el modal "Crear Orden
   * de Ruteo" — sirve tanto para confirmar lo elegido por
   * seleccionarClienteEnRuteo() (Forma 2) como para confirmar que un cliente
   * elegido arriba del carrito (seleccionarClienteExistente(), Forma 1) sí se
   * propagó aquí: confirmado en vivo (show_create_routing_order_modal() en
   * pos_routing.js) que ambas formas comparten el mismo cliente ya
   * seleccionado en el carrito (#customer_select/#customer_json_selected).
   */
  async obtenerClienteEnRuteo(): Promise<string> {
    return this.core._obtenerTextoChosenSeleccionado(L.RUTEO_CLIENTE_CHOSEN);
  }


  /**
   * Selecciona la primera ruta real disponible — catálogo configurable por la
   * empresa sin nombre estable, mismo criterio que el resto de la suite
   * (CABYS, tipo/tasa de IVA, vendedor de Enviar a caja). Obligatorio:
   * confirmado en vivo (confirm_send_routing_order() en pos_routing.js) que
   * el envío se rechaza con un aviso si queda en su placeholder. Devuelve el
   * nombre de la ruta realmente seleccionada.
   */
  async seleccionarRutaRuteo(): Promise<string> {
    await this.core._seleccionarPrimeraOpcionChosen(L.RUTEO_RUTA_CHOSEN);
    const nombreRuta = await this.core._obtenerTextoChosenSeleccionado(L.RUTEO_RUTA_CHOSEN);
    expect(nombreRuta, 'La ruta seleccionada en "Crear Orden de Ruteo" no quedó visible').not.toBe('');
    console.log(`[seleccionarRutaRuteo] Ruta seleccionada: "${nombreRuta}"`);
    return nombreRuta;
  }


  /**
   * Selecciona el primer repartidor real disponible — mismo criterio que
   * seleccionarRutaRuteo(). Obligatorio, igual que la ruta. No depende del
   * autocompletado que set_agent_in_modal_routing_order() intenta tras elegir
   * una ruta (ver el comentario de L.RUTEO_RUTA_CHOSEN): se selecciona
   * siempre de forma explícita, sin asumir que la ruta ya lo dejó listo.
   * Devuelve el nombre del repartidor realmente seleccionado.
   */
  async seleccionarRepartidorRuteo(): Promise<string> {
    await this.core._seleccionarPrimeraOpcionChosen(L.RUTEO_REPARTIDOR_CHOSEN);
    const nombreRepartidor = await this.core._obtenerTextoChosenSeleccionado(L.RUTEO_REPARTIDOR_CHOSEN);
    expect(nombreRepartidor, 'El repartidor seleccionado en "Crear Orden de Ruteo" no quedó visible').not.toBe('');
    console.log(`[seleccionarRepartidorRuteo] Repartidor seleccionado: "${nombreRepartidor}"`);
    return nombreRepartidor;
  }


  /**
   * Selecciona la primera dirección real del cliente si tiene alguna
   * registrada, sin fallar si no tiene ninguna — a diferencia de Ruta/
   * Repartidor, este campo es OPCIONAL (ver el comentario de
   * L.RUTEO_DIRECCION_CHOSEN).
   *
   * NO reutiliza _seleccionarPrimeraOpcionChosenSiHayOpciones() (la variante
   * "tolerante" que sí usan Subcategoría/Sub sección de "Crear Producto"):
   * confirmado en vivo que su fallback de "abrir el Chosen y presionar
   * Escape cuando no hay opciones" deja un backdrop huérfano cubriendo todo
   * el modal de Ruteo (ver el comentario de L.RUTEO_DIRECCION_CHOSEN) — un
   * problema propio de estar dentro de un modal ya abierto que Subcategoría/
   * Sub sección no tienen. En su lugar, se comprueba de antemano sobre el
   * <select> real (sin abrir nunca el Chosen) si existe alguna opción
   * distinta del placeholder, y solo se abre el Chosen cuando sí la hay —
   * evita por completo la necesidad de cancelarlo.
   *
   * Devuelve el texto actualmente reflejado (una dirección real, o el
   * placeholder "Seleccionar dirección" si el cliente no tiene ninguna).
   */
  async seleccionarDireccionRuteoSiExiste(): Promise<string> {
    const hayDirecciones = (await this.page.locator(`${L.RUTEO_DIRECCION_SELECT} option:not([value="0"])`).count()) > 0;
    if (hayDirecciones) {
      await this.core._seleccionarPrimeraOpcionChosen(L.RUTEO_DIRECCION_CHOSEN);
    }
    return this.core._obtenerTextoChosenSeleccionado(L.RUTEO_DIRECCION_CHOSEN);
  }


  /**
   * Llena las observaciones de "Crear Orden de Ruteo" — mismo patrón de
   * llenarObservacionesOrdenCaja() (un simple fill()), pero sobre el textarea
   * propio de este modal (RUTEO_OBSERVACION, id distinto). A diferencia de
   * ese método, devuelve el valor que realmente quedó en el campo: necesario
   * porque esta suite sí debe validar explícitamente que la observación se
   * registró, y no existía ningún método existente que expusiera ese valor
   * sin tocar el locator crudo desde el test.
   */
  async llenarObservacionesRuteo(texto: string): Promise<string> {
    const campo = this.page.locator(L.RUTEO_OBSERVACION);
    await campo.fill(texto);
    return campo.inputValue();
  }


  /**
   * Presiona "Enviar Orden" y confirma el SweetAlert de advertencia
   * ("¿Enviar órden a ruteo?") — mismo patrón que enviarOrdenCaja()/
   * guardarProformaYObtenerRespuesta()/guardarApartadoYObtenerRespuesta():
   * arma la espera de la respuesta AJAX ANTES del click, confirma el
   * SweetAlert reutilizando _confirmarSweetAlertV1(), y devuelve la
   * respuesta cruda para que el test decida cómo validarla.
   */
  async guardarOrdenRuteoYObtenerRespuesta(): Promise<Response> {
    await this.page.locator(L.RUTEO_BTN_ENVIAR).click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_RUTEO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.core._confirmarSweetAlertV1('No apareció la confirmación "¿Enviar órden a ruteo?"');
    return respuestaPromise;
  }


  /**
   * Valida que "Crear Orden de Ruteo" terminó exitosamente: la respuesta real
   * de AJAX_GUARDAR_RUTEO respondió OK con un id numérico (>=1, mismo
   * contrato que AJAX_GUARDAR_APARTADO), el modal se cerró y el carrito quedó
   * vacío (clear_product_table() en pos_routing.js, confirmado en vivo). Sin
   * ventana de impresión que esperar ni cerrar (ver el comentario de
   * L.AJAX_GUARDAR_RUTEO): a diferencia de Facturar/Cerrar Caja, este
   * ambiente no tiene la impresión automática de comanda activada.
   */
  /**
   * Cierra el modal de Ruteo (creación/edición) a la fuerza si quedó
   * abierto — necesario tras un intento de guardar en moneda no base que el
   * ambiente bloquea en silencio (confirmado en vivo: el modal permanece
   * abierto, sin ningún AJAX_GUARDAR_RUTEO ni SweetAlert que lo cierre).
   */
  async cerrarModalRuteoForzado() {
    const modal = this.modalRuteo;
    if (!(await modal.isVisible().catch(() => false))) return;
    await modal.locator('[data-dismiss="modal"]').first().click({ force: true }).catch(() => {});
    await expect(modal, 'El modal de Ruteo no se cerró al forzar su cierre').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  async validarOrdenRuteoCreada(respuesta: Response) {
    expect(respuesta.ok(), `${L.AJAX_GUARDAR_RUTEO} no respondió OK (status ${respuesta.status()})`).toBe(true);

    const cuerpo = (await respuesta.text()).trim();
    expect(parseInt(cuerpo, 10), `${L.AJAX_GUARDAR_RUTEO} no devolvió un id válido (respondió "${cuerpo}")`).toBeGreaterThanOrEqual(1);

    await expect(
      this.modalRuteo,
      'El modal "Crear Orden de Ruteo" no se cerró tras confirmar el envío'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.payment.validarCarritoVacio();
  }


  // ─── Listado de Órdenes de Ruteo YA CREADAS: "Ver Orden"/"Editar Orden"/estado ──
  // Ver el comentario de L.RUTEO_LISTA_TARJETA_PREFIJO para la evidencia
  // completa (estructura real de la tarjeta, opciones del menú, códigos de
  // estado). Cada Orden se localiza SIEMPRE por su id real (el mismo que
  // devuelve guardarOrdenRuteoYObtenerRespuesta()), nunca por posición en el
  // listado: bajo `fullyParallel`, otro worker puede estar creando/editando
  // sus propias órdenes en la misma pestaña "Ruteo" al mismo tiempo, así que
  // depender de "la primera tarjeta" sería una condición de carrera real.

  /** Locator de una tarjeta de Orden de Ruteo ya creada, por su id real. */
  tarjetaRuteo(ordenId: string): Locator {
    return this.page.locator(`#${L.RUTEO_LISTA_TARJETA_PREFIJO}${ordenId}`);
  }


  /**
   * Abre la pestaña superior "Ruteo" (listado de órdenes YA creadas —
   * distinta del menú "Crear Orden de Ruteo"/RUTEO_MENU_ITEM), reutilizando
   * visitarPestanaPos() con la entrada ya registrada en
   * PESTANAS_POS_A_RECORRER, sin duplicar esa lógica.
   */
  async abrirListadoOrdenesRuteo() {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Ruteo')!;
    await this.core.visitarPestanaPos(pestana);
  }


  /**
   * Indica si el tab superior "Ruteo" sigue activo — mismo criterio que
   * pestanaPosActiva(), con la pestaña ya resuelta. Confirmado en vivo que
   * seleccionarOrdenRuteoParaFacturar() y alternarVistaExpandida() NO sacan
   * al usuario de este tab (a diferencia de abrirAgregarItem(), que activa
   * el tab "Productos" — ver su comentario): útil para escenarios que deben
   * facturar una Orden de Ruteo sin abandonar esta pestaña.
   */
  async pestanaRuteoActiva(): Promise<boolean> {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Ruteo')!;
    return this.core.pestanaPosActiva(pestana);
  }


  /**
   * Presiona "Volver" desde el catálogo (abierto con abrirAgregarItem())
   * hacia el tab "Ruteo", reutilizando volverDesdeAgregarItem() con la
   * pestaña ya resuelta — mismo patrón que abrirListadoOrdenesRuteo()/
   * pestanaRuteoActiva(), sin necesitar que el archivo de test importe
   * PESTANAS_POS_A_RECORRER solo para esto.
   */
  async volverDesdeAgregarItemHaciaRuteo() {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Ruteo')!;
    await this.core.volverDesdeAgregarItem(pestana);
  }


  /**
   * Indica si la tarjeta de una Orden de Ruteo (por id) aparece visible
   * dentro del filtro real "Entregado" (FILTRO_RUTEO_ENTREGADO) — cambia a
   * ese filtro primero. Útil para confirmar explícitamente que una orden
   * SALIÓ de "Entregado" tras un cambio de estado o facturación (a
   * diferencia de asegurarOrdenRuteoVisibleEnListado(), que solo garantiza
   * que la tarjeta aparezca EN ALGÚN LADO, sin importar cuál).
   */
  async ordenVisibleEnFiltroEntregado(ordenId: string): Promise<boolean> {
    await this.page.locator(L.FILTRO_RUTEO_ENTREGADO).click();
    return this.tarjetaRuteo(ordenId).isVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD }).catch(() => false);
  }


  /**
   * Indica si la tarjeta de una Orden de Ruteo (por id) aparece visible
   * dentro del filtro real "H. de Órdenes" (FILTRO_RUTEO_HISTORIAL) —
   * cambia a ese filtro primero. Ver el comentario de
   * ordenVisibleEnFiltroEntregado() para el criterio general.
   */
  async ordenVisibleEnHistorial(ordenId: string): Promise<boolean> {
    await this.page.locator(L.FILTRO_RUTEO_HISTORIAL).click();
    return this.tarjetaRuteo(ordenId).isVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD }).catch(() => false);
  }


  /**
   * Asegura que la tarjeta de una Orden de Ruteo (por su id real) quede
   * visible en el listado, sin importar qué filtro esté activo en este
   * momento — confirmado en vivo (investigado a fondo, no asumido) que una
   * orden que llega al estado Entregado + Facturado se MUEVE de "Todos" a
   * "H. de Órdenes" (FILTRO_RUTEO_HISTORIAL): comparando el mismo id de
   * orden en ambas vistas, la tarjeta deja de existir/verse en "Todos" y
   * aparece en "H. de Órdenes". Los métodos que localizan una tarjeta por
   * id (tarjetaRuteo()) asumían implícitamente que "Todos" siempre era el
   * lugar correcto — bajo `fullyParallel`/corridas largas donde varios
   * escenarios comparten el mismo pool de órdenes (p. ej. un escenario que
   * marca una orden como Entregada y otro que ya la había facturado antes),
   * eso deja de ser cierto y la tarjeta puede esperar su timeout completo
   * sin nunca aparecer.
   *
   * Estrategia (sin excepciones para distinguir casos, solo waitFor con
   * timeouts cortos vía `.catch(() => false)`, mismo criterio que el resto
   * de esta clase): probar primero la vista ya activa (corto, la mayoría de
   * los casos no necesitan cambiar nada), luego "H. de Órdenes", y si
   * tampoco aparece ahí, volver a "Todos" — el mismo estado por defecto que
   * el resto de la suite espera — y dejar que el propio caller reporte el
   * error real con su propio mensaje (esta orden simplemente no existe o el
   * ambiente tiene un problema genuino, no un filtro mal ubicado).
   */
  async asegurarOrdenRuteoVisibleEnListado(ordenId: string): Promise<void> {
    const tarjeta = this.tarjetaRuteo(ordenId);
    const yaVisible = await tarjeta.isVisible({ timeout: 5_000 }).catch(() => false);
    if (yaVisible) return;

    const visibleEnHistorial = await this.page.locator(L.FILTRO_RUTEO_HISTORIAL).click()
      .then(() => tarjeta.isVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD }))
      .catch(() => false);
    if (visibleEnHistorial) return;

    await this.page.locator(L.FILTRO_RUTEO_TODOS).click().catch(() => {});
  }


  /**
   * Abre el menú de acciones (ícono "more_vert") de una Orden de Ruteo ya
   * creada, localizada por su id real — falla con un mensaje claro si la
   * tarjeta no aparece en el listado ya cargado. Antes de buscarla,
   * asegura que esté visible en la vista correcta (ver el comentario de
   * asegurarOrdenRuteoVisibleEnListado(): puede haberse movido a "H. de
   * Órdenes" si ya está Entregada + Facturada).
   */
  async abrirMenuAccionesOrdenRuteo(ordenId: string) {
    await this.asegurarOrdenRuteoVisibleEnListado(ordenId);
    const tarjeta = this.tarjetaRuteo(ordenId);
    await expect(tarjeta, `La orden de Ruteo #${ordenId} no aparece en el listado "Ruteo" (ni en "Todos" ni en "H. de Órdenes")`).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
    await tarjeta.locator(L.RUTEO_LISTA_BTN_MENU).click();
    await expect(
      tarjeta.locator('ul.dropdown-menu'),
      `El menú de acciones de la orden #${ordenId} no se abrió`
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Con el menú de acciones ya abierto (abrirMenuAccionesOrdenRuteo()),
   * selecciona "Ver órden" y lee los datos reales mostrados en el modal de
   * detalle (#dialog_view_routing_order_detail), cerrándolo al terminar.
   * Confirmado en vivo que este detalle no incluye "Vendedor" (solo
   * "Repartidor") ni etiqueta explícita de moneda/estado/fecha — esos solo
   * se reflejan en la propia tarjeta del listado (fecha) o se infieren del
   * símbolo en los montos (moneda); el estado se lee aparte con
   * obtenerEstadoTarjetaRuteo().
   */
  async verOrdenRuteo(ordenId: string) {
    await this.page.locator(`li[onclick="show_routing_order_detail(${ordenId});"]`).click();

    const modal = this.page.locator(L.DIALOG_VER_ORDEN_RUTEO);
    await expect(modal, 'El modal "Ver Orden" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const leerMonto = async (selector: string) =>
      parseFloat(((await this.page.locator(selector).textContent()) ?? '0').replace(/[^0-9.]/g, '')) || 0;

    const datos = {
      numero: ((await this.page.locator(L.VER_RUTEO_NUMERO).textContent()) ?? '').trim(),
      repartidor: ((await this.page.locator(L.VER_RUTEO_REPARTIDOR).textContent()) ?? '').trim(),
      clienteNombre: ((await this.page.locator(L.VER_RUTEO_CLIENTE_NOMBRE).textContent()) ?? '').trim(),
      direccion: ((await this.page.locator(L.VER_RUTEO_CLIENTE_DIRECCION).textContent()) ?? '').trim(),
      observacion: ((await this.page.locator(L.VER_RUTEO_OBSERVACION).textContent()) ?? '').trim(),
      cantidadProductos: await this.page.locator(L.VER_RUTEO_FILAS_PRODUCTO).count(),
      subtotal: await leerMonto(L.VER_RUTEO_SUBTOTAL),
      descuento: await leerMonto(L.VER_RUTEO_DESCUENTO),
      impuesto: await leerMonto(L.VER_RUTEO_IMPUESTO),
      total: await leerMonto(L.VER_RUTEO_TOTAL),
    };

    await modal.locator('.btn_dvrod_close, [data-dismiss="modal"]').first().click();
    await expect(modal, 'El modal "Ver Orden" no se cerró').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    return datos;
  }


  /**
   * Con el menú de acciones ya abierto, selecciona "Editar órden" (reutiliza
   * el mismo modal #dialog_add_routing_order y los mismos ids/botón que
   * crear una Orden de Ruteo — ver el comentario de
   * L.RUTEO_LISTA_TARJETA_PREFIJO) y modifica Ruta, Repartidor y
   * Observaciones: los ÚNICOS campos realmente editables en este ambiente,
   * confirmado en vivo — el bloque de cliente permanece oculto
   * (display:none) y no existe ningún campo de productos/cantidades/
   * vendedor en este modal. Guarda reutilizando
   * guardarOrdenRuteoYObtenerRespuesta() tal cual (mismo botón, misma
   * petición AJAX_GUARDAR_RUTEO que la creación, confirmado en vivo).
   */
  async editarOrdenRuteo(ordenId: string, nuevaObservacion: string) {
    await this.page.locator(`li[onclick="show_create_routing_order_modal(${ordenId});"]`).click();

    const modal = this.modalRuteo;
    await expect(modal, 'El modal "Editar Orden de Ruteo" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const ruta = await this.seleccionarRutaRuteo();
    const repartidor = await this.seleccionarRepartidorRuteo();
    const observacionRegistrada = await this.llenarObservacionesRuteo(nuevaObservacion);

    const respuesta = await this.guardarOrdenRuteoYObtenerRespuesta();
    expect(respuesta.ok(), `El guardado de la edición no respondió OK (status ${respuesta.status()})`).toBe(true);
    await expect(modal, 'El modal "Editar Orden de Ruteo" no se cerró tras guardar').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    return { ruta, repartidor, observacionRegistrada };
  }


  /**
   * Con el menú de acciones ya abierto, selecciona "Marcar como <estado>"
   * (change_routing_order_status(id, código)) y espera la respuesta real de
   * AJAX_CAMBIO_ESTADO_RUTEO. Códigos confirmados en vivo: 1=Pendiente,
   * 2=En camino, 3=Entregado. Sin SweetAlert de por medio (confirmado en
   * vivo, a diferencia del resto de acciones de Ruteo).
   */
  async cambiarEstadoOrdenRuteo(ordenId: string, estado: 1 | 2 | 3) {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_CAMBIO_ESTADO_RUTEO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(`li[onclick="change_routing_order_status(${ordenId},${estado});"]`).click();
    const respuesta = await respuestaPromise;
    expect(respuesta.ok(), `El cambio de estado de la orden #${ordenId} a ${estado} no respondió OK`).toBe(true);
  }


  /**
   * Lee el estado real de una tarjeta de Ruteo ya visible en el listado
   * desde su propia clase (delivery-status-1/2/3) — nunca asumido a partir
   * de la última acción ejecutada, mismo criterio de "leer el DOM real" que
   * el resto de la suite. Antes de leerla, asegura que esté visible en la
   * vista correcta (ver el comentario de asegurarOrdenRuteoVisibleEnListado()).
   */
  async obtenerEstadoTarjetaRuteo(ordenId: string): Promise<1 | 2 | 3> {
    await this.asegurarOrdenRuteoVisibleEnListado(ordenId);
    const clase = (await this.tarjetaRuteo(ordenId).getAttribute('class')) ?? '';
    const match = clase.match(/delivery-status-(\d)/);
    expect(match, `No se pudo leer el estado de la orden #${ordenId} desde su clase: "${clase}"`).not.toBeNull();
    return Number(match![1]) as 1 | 2 | 3;
  }


  // ─── Facturar una Orden de Ruteo ya creada ─────────────────────────────────
  // Ver el comentario de L.RUTEO_LISTA_BTN_SELECCIONAR para la evidencia
  // completa: el botón "Seleccionar órden" (fuera del menú de acciones) es el
  // único mecanismo real para llevar una Orden de Ruteo a facturación.

  /**
   * Localiza el id real de la primera Orden de Ruteo del listado que
   * TODAVÍA puede seleccionarse para facturar (botón "Seleccionar órden"
   * visible en su tarjeta — ver L.RUTEO_LISTA_BTN_SELECCIONAR) — para
   * escenarios que no necesitan crear su propia orden porque cualquier
   * orden Pendiente de facturar ya sirve (este ambiente ya trae un listado
   * grande de órdenes previas). Requiere que el listado "Ruteo" ya esté
   * abierto (abrirListadoOrdenesRuteo()). Localiza SIEMPRE leyendo el id
   * real del propio DOM (RUTEO_LISTA_TARJETA_PREFIJO + id numérico), nunca
   * por posición fija — mismo criterio "por id real" que el resto de los
   * métodos de listado de Ruteo (ver el comentario de
   * abrirMenuAccionesOrdenRuteo()).
   *
   * Nota: bajo `fullyParallel`, todos los workers comparten la misma cuenta/
   * sesión (ver el comentario de la fixture "pos" en pos-ruteo.spec.ts), así
   * que dos workers podrían intentar seleccionar la MISMA orden "primera
   * disponible" al mismo tiempo — un escenario que prefiere crear su propia
   * orden evita ese riesgo por completo; este método es para cuando esa
   * garantía no es necesaria.
   */
  async obtenerPrimeraOrdenRuteoSeleccionable(idAExcluir?: string): Promise<string> {
    const selectorBase = idAExcluir
      ? `[id^="${L.RUTEO_LISTA_TARJETA_PREFIJO}"]:not(#${L.RUTEO_LISTA_TARJETA_PREFIJO}${idAExcluir})`
      : `[id^="${L.RUTEO_LISTA_TARJETA_PREFIJO}"]`;
    const tarjetaConBoton = this.page
      .locator(selectorBase)
      .filter({ has: this.page.locator(L.RUTEO_LISTA_BTN_SELECCIONAR) })
      .first();

    await expect(
      tarjetaConBoton,
      `No se encontró ninguna Orden de Ruteo seleccionable (Pendiente de facturar)${idAExcluir ? ` distinta de #${idAExcluir}` : ''} en el listado`
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const idCompleto = await tarjetaConBoton.getAttribute('id');
    const ordenId = (idCompleto ?? '').replace(L.RUTEO_LISTA_TARJETA_PREFIJO, '');
    expect(ordenId.length, `No se pudo extraer un id numérico del atributo id="${idCompleto}"`).toBeGreaterThan(0);
    return ordenId;
  }


  /**
   * Localiza el id real de la primera Orden de Ruteo del listado que
   * actualmente tiene el estado de envío pedido (1=Pendiente, 2=En camino,
   * 3=Entregado — mismo código que obtenerEstadoTarjetaRuteo() ya usa) —
   * para escenarios que necesitan una orden YA EXISTENTE en un estado
   * específico (p. ej. "En camino" para poder marcarla como "Entregado", o
   * "Pendiente" para marcarla como "En camino") en vez de crear su propia
   * orden y llevarla paso a paso hasta ese estado. No filtra por
   * facturación: puede devolver una orden ya Facturada (ver
   * obtenerPrimeraOrdenRuteoConEstadoYSeleccionable() para cuando también
   * debe poder facturarse).
   *
   * Nota: filtra directamente sobre las tarjetas ya cargadas por su propia
   * clase (mismo criterio que obtenerEstadoTarjetaRuteo()), sin pasar por
   * los filtros reales FILTRO_RUTEO_* — evita el side-effect de dejar el
   * listado en un filtro distinto de "Todos" para escenarios (12/13/14) que
   * después necesitan localizar la MISMA orden por id sin importar el
   * filtro activo (ya cubierto por asegurarOrdenRuteoVisibleEnListado()).
   */
  async obtenerPrimeraOrdenRuteoConEstado(estado: 1 | 2 | 3): Promise<string> {
    const tarjetaConEstado = this.page
      .locator(`[id^="${L.RUTEO_LISTA_TARJETA_PREFIJO}"].delivery-status-${estado}`)
      .first();

    await expect(
      tarjetaConEstado,
      `No se encontró ninguna Orden de Ruteo con estado de envío ${estado} en el listado`
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const idCompleto = await tarjetaConEstado.getAttribute('id');
    const ordenId = (idCompleto ?? '').replace(L.RUTEO_LISTA_TARJETA_PREFIJO, '');
    expect(ordenId.length, `No se pudo extraer un id numérico del atributo id="${idCompleto}"`).toBeGreaterThan(0);
    return ordenId;
  }


  /**
   * Localiza el id real de la primera Orden de Ruteo que, dentro del filtro
   * REAL "Pendientes"/"En Camino"/"Entregado" (FILTRO_RUTEO_*, botones con
   * id técnico estable — corrige una conclusión anterior de este mismo
   * archivo que los daba por una simple leyenda decorativa, confirmado en
   * vivo que sí filtran), todavía puede seleccionarse para facturar (botón
   * "Seleccionar órden" visible) — a diferencia de
   * obtenerPrimeraOrdenRuteoConEstado() (no filtra por facturación) y de
   * obtenerPrimeraOrdenRuteoSeleccionable() (no filtra por estado de
   * envío), este combina ambos criterios: necesario para escenarios que
   * piden explícitamente una orden de un estado de envío dado que además se
   * pueda facturar de verdad (p. ej. una orden Entregada aún sin facturar).
   * Restaura el filtro "Todos" antes de devolver el id, dejando el listado
   * en el estado que el resto de la suite espera.
   */
  async obtenerPrimeraOrdenRuteoConEstadoYSeleccionable(estado: 1 | 2 | 3): Promise<string> {
    const filtro = estado === 1 ? L.FILTRO_RUTEO_PENDIENTE : estado === 2 ? L.FILTRO_RUTEO_EN_CAMINO : L.FILTRO_RUTEO_ENTREGADO;
    await this.page.locator(filtro).click();

    const tarjetaConBoton = this.page
      .locator(`[id^="${L.RUTEO_LISTA_TARJETA_PREFIJO}"]`)
      .filter({ has: this.page.locator(L.RUTEO_LISTA_BTN_SELECCIONAR) })
      .first();

    await expect(
      tarjetaConBoton,
      `No se encontró ninguna Orden de Ruteo con estado de envío ${estado} que todavía pueda seleccionarse para facturar`
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const idCompleto = await tarjetaConBoton.getAttribute('id');
    const ordenId = (idCompleto ?? '').replace(L.RUTEO_LISTA_TARJETA_PREFIJO, '');
    expect(ordenId.length, `No se pudo extraer un id numérico del atributo id="${idCompleto}"`).toBeGreaterThan(0);

    await this.page.locator(L.FILTRO_RUTEO_TODOS).click();
    return ordenId;
  }


  /**
   * Selecciona ("Seleccionar órden") una Orden de Ruteo YA CREADA, localizada
   * por su id real (mismo criterio "siempre por id real, nunca por posición"
   * que el resto de los métodos de listado de Ruteo — ver el comentario de
   * abrirMenuAccionesOrdenRuteo()), y la carga al carrito del POS. Deja el
   * carrito, el cliente ya asociado a la orden y el resto de controles del
   * POS (Facturar, "AGREGAR ITEMS") exactamente en el mismo estado que
   * cargarPrimeraOrdenCajaDisponible()/importarPrimeraFacturaDisponible()
   * (confirmado en vivo) — mismo flujo genérico de "venta pendiente cargada
   * al carrito", solo con un origen distinto: desde aquí aplica el resto de
   * la infraestructura ya existente (abrirAgregarItem(), presionarFacturar(),
   * cambiarTipoPagoEnModalPago(), quitarClienteSeleccionado(), etc.) sin
   * necesitar nada propio de Ruteo.
   */
  async seleccionarOrdenRuteoParaFacturar(ordenId: string) {
    const tarjeta = this.tarjetaRuteo(ordenId);
    await expect(tarjeta, `La orden de Ruteo #${ordenId} no aparece en el listado "Ruteo"`).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_CARGAR_RUTEO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await tarjeta.locator(L.RUTEO_LISTA_BTN_SELECCIONAR).click();
    await respuestaPromise;

    await expect(
      this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
      'No se cargó ninguna línea de producto tras seleccionar la Orden de Ruteo'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // El cliente ya asociado a la orden se propaga con una llamada AJAX
    // propia (getCustomerByPosOption) que corre DESPUÉS de la respuesta de
    // AJAX_CARGAR_RUTEO ya esperada arriba — confirmado en vivo (2 corridas)
    // que leer el cliente inmediatamente tras esa primera respuesta puede
    // atrapar el estado transitorio "Cliente de contado" (el placeholder por
    // defecto) en vez del cliente real de la orden, ya en vuelo pero sin
    // resolver todavía. Toda Orden de Ruteo exige un cliente real para
    // crearse (create_routing_order()/confirm_send_routing_order() en
    // pos_routing.js lo validan), así que se espera aquí, de forma explícita,
    // a que ese cliente real quede reflejado antes de devolver el control.
    await expect.poll(
      () => this.core.hayClienteRealSeleccionado(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El cliente real de la orden no se propagó al carrito tras seleccionarla' }
    ).toBe(true);
  }


  /**
   * Lee el estado de facturación mostrado en la propia tarjeta ("Pendiente"/
   * "Facturado", L.RUTEO_LISTA_LBL_FACTURA) — independiente del estado de
   * envío (obtenerEstadoTarjetaRuteo()): una orden puede estar Entregada y
   * seguir con la factura Pendiente, o viceversa (ver el comentario de
   * L.RUTEO_LISTA_LBL_FACTURA). Antes de leerla, asegura que esté visible
   * en la vista correcta (ver el comentario de
   * asegurarOrdenRuteoVisibleEnListado()): una orden ya Entregada +
   * Facturada vive en "H. de Órdenes", no en "Todos".
   */
  async obtenerEstadoFacturacionOrdenRuteo(ordenId: string): Promise<string> {
    await this.asegurarOrdenRuteoVisibleEnListado(ordenId);
    const texto = await this.tarjetaRuteo(ordenId).locator(L.RUTEO_LISTA_LBL_FACTURA).textContent();
    return (texto ?? '').trim();
  }


  /**
   * Indica si una Orden de Ruteo todavía puede seleccionarse para facturar
   * (el botón "Seleccionar órden" sigue visible en su tarjeta) — confirmado
   * en vivo que este botón desaparece de la tarjeta apenas la orden ya fue
   * facturada, en el mismo momento en que obtenerEstadoFacturacionOrdenRuteo()
   * pasa a "Facturado".
   */
  async ordenRuteoSeleccionable(ordenId: string): Promise<boolean> {
    return this.tarjetaRuteo(ordenId).locator(L.RUTEO_LISTA_BTN_SELECCIONAR).isVisible().catch(() => false);
  }


  /** Cambia al filtro real indicado del listado "Ruteo" (ver el comentario de FILTRO_RUTEO_TODOS). */
  async irAFiltroRuteo(filtro: 'Todos' | 'Pendiente' | 'En Camino' | 'Entregado' | 'H. de Órdenes') {
    const selector = {
      'Todos': L.FILTRO_RUTEO_TODOS,
      'Pendiente': L.FILTRO_RUTEO_PENDIENTE,
      'En Camino': L.FILTRO_RUTEO_EN_CAMINO,
      'Entregado': L.FILTRO_RUTEO_ENTREGADO,
      'H. de Órdenes': L.FILTRO_RUTEO_HISTORIAL,
    }[filtro];
    await this.page.locator(selector).click();
  }


  // ─── Acciones masivas del listado "Ruteo" (menú "Acciones": selección
  // múltiple + Enviar a Ruteo/Cambiar Repartidor/Eliminar + reporte PDF) ─────
  // Ver el comentario de RUTEO_MASIVO_LI_SELECCIONAR para la evidencia
  // completa de cómo se abre/cierra este dropdown.

  /** Ancla estable al botón `[data-toggle="dropdown"]` real del menú "Acciones" del listado Ruteo. */
  get _btnAccionesMasivasRuteo(): Locator {
    return this.page
      .locator(L.RUTEO_MASIVO_LI_SELECCIONAR)
      .locator('xpath=ancestor::div[contains(@class,"dropdown")][1]//button[@data-toggle="dropdown"]')
      .first();
  }


  /**
   * Abre (o reabre) el dropdown "Acciones" del listado Ruteo — necesario
   * antes de CADA click dentro de él, no solo el primero: Bootstrap lo cierra
   * ante cualquier click fuera, incluido el que marca un checkbox de tarjeta
   * más abajo en la página (confirmado en vivo).
   */
  async _abrirMenuAccionesMasivasRuteo() {
    await this._btnAccionesMasivasRuteo.click();
    await expect(
      this.page.locator(L.RUTEO_MASIVO_LI_SELECCIONAR),
      'El menú "Acciones" del listado Ruteo no se abrió'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Activa el modo de selección múltiple del listado Ruteo ("Seleccionar"):
   * revela el checkbox de cada tarjeta y los 3 `<li>` de acción masiva.
   * Llamar una sola vez por escenario, después de abrirListadoOrdenesRuteo()/
   * el filtro real que corresponda, antes de marcar ninguna orden.
   */
  async entrarModoSeleccionMasivaRuteo() {
    await this._abrirMenuAccionesMasivasRuteo();
    await this.page.locator(L.RUTEO_MASIVO_LI_SELECCIONAR).click();
  }


  /**
   * Indica si el modo de selección múltiple del listado Ruteo (activado con
   * entrarModoSeleccionMasivaRuteo()) sigue habilitado AHORA MISMO: los 3
   * `<li>` de acción masiva visibles (sin clase `hide`) y al menos un
   * checkbox de tarjeta realmente visible en el DOM. Útil tras cambiar de
   * filtro real (irAFiltroRuteo()) sin volver a clickear "Seleccionar" —
   * confirmado en vivo que `select_orders()` es un TOGGLE cuyo estado
   * persiste entre filtros (no hay que reactivarlo en cada uno).
   */
  async seleccionMasivaRuteoHabilitada(): Promise<boolean> {
    return this.page.evaluate(
      ({ eliminar, cambiarRepartidor, enviar, checkboxPrefijo }) => {
        const acciones = [eliminar, cambiarRepartidor, enviar].map((sel) => document.querySelector(sel));
        if (acciones.some((a) => !a || a.classList.contains('hide'))) return false;
        const checkboxes = Array.from(document.querySelectorAll(`[id^="${checkboxPrefijo}"]`));
        return checkboxes.some((cb) => (cb as HTMLElement).offsetParent !== null);
      },
      {
        eliminar: L.RUTEO_MASIVO_LI_ELIMINAR,
        cambiarRepartidor: L.RUTEO_MASIVO_LI_CAMBIAR_REPARTIDOR,
        enviar: L.RUTEO_MASIVO_LI_ENVIAR,
        checkboxPrefijo: L.RUTEO_MASIVO_CHECKBOX_PREFIJO,
      }
    );
  }


  /**
   * Marca (checkbox) una Orden de Ruteo, localizada por su id real, para una
   * acción masiva ya con entrarModoSeleccionMasivaRuteo() activo. Usa
   * evaluate() como el resto de checkboxes "outside of viewport" de esta
   * clase (ver el comentario de RUTEO_MASIVO_CHECKBOX_PREFIJO) — nunca
   * `.check()`/`.click()` directos, que fallan contra este listado con
   * cientos de tarjetas.
   */
  async marcarOrdenParaAccionMasivaRuteo(ordenId: string) {
    await this.asegurarOrdenRuteoVisibleEnListado(ordenId);
    const checkboxId = `${L.RUTEO_MASIVO_CHECKBOX_PREFIJO}${ordenId}`;
    await this.page.evaluate(
      (id) => (document.getElementById(id) as HTMLInputElement | null)?.click(),
      checkboxId
    );
    await expect(
      this.page.locator(`#${checkboxId}`),
      `El checkbox de selección de la Orden de Ruteo #${ordenId} no quedó marcado`
    ).toBeChecked();
  }


  /**
   * Completa el modal `#modal_change_sellers` compartido por "Enviar a
   * Ruteo"/"Cambiar Repartidor" masivos (ver el comentario de
   * RUTEO_MASIVO_MODAL): elige el primer repartidor real disponible (mismo
   * criterio que seleccionarRepartidorRuteo()) y guarda, esperando la
   * respuesta real del endpoint AJAX correspondiente — nunca solo el toast.
   * Devuelve la respuesta cruda (el caller decide cómo validarla: los dos
   * endpoints NO tienen el mismo contrato de éxito/fallo, ver el comentario
   * de RUTEO_MASIVO_MODAL) y el nombre del repartidor elegido.
   */
  async _confirmarModalAccionMasivaRuteo(fragmentoUrlAjax: string): Promise<{ respuesta: Response; repartidorSeleccionado: string }> {
    const modal = this.page.locator(L.RUTEO_MASIVO_MODAL);
    await expect(
      modal,
      'El modal de acción masiva del listado Ruteo ("Enviar a Ruteo"/"Cambiar Repartidor") no se abrió'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // _seleccionarPrimeraOpcionChosen() (NO un `.chosen-results li` "a mano"):
    // confirmado en vivo (root-cause real, no asumido — mismo hallazgo ya
    // documentado en el comentario de ese método) que el primer <li> de este
    // Chosen recién abierto puede ser el propio placeholder "Seleccione un
    // repartidor" en vez de una opción real, dejando la orden sin repartidor
    // nuevo asignado y el assert posterior comparando contra ese texto en
    // vez del repartidor realmente elegido.
    await this.core._seleccionarPrimeraOpcionChosen(L.RUTEO_MASIVO_MODAL_REPARTIDOR_CHOSEN);
    const repartidorSeleccionado = await this.core._obtenerTextoChosenSeleccionado(L.RUTEO_MASIVO_MODAL_REPARTIDOR_CHOSEN);
    expect(repartidorSeleccionado, 'El repartidor seleccionado en el modal de acción masiva de Ruteo no quedó visible').not.toBe('');

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(fragmentoUrlAjax),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.RUTEO_MASIVO_MODAL_BTN_GUARDAR).click();
    const respuesta = await respuestaPromise;

    return { respuesta, repartidorSeleccionado };
  }


  /**
   * "Enviar a Ruteo" masivo — ADVERTENCIA (confirmado en vivo, ver el
   * comentario de RUTEO_MASIVO_MODAL): NO reasigna in-place las órdenes ya
   * marcadas con marcarOrdenParaAccionMasivaRuteo(). Crea una orden NUEVA por
   * cada una (con el repartidor elegido aquí), DUPLICANDO en vez de
   * reemplazar — la orden original permanece intacta en el listado. La
   * respuesta responde un array JSON
   * `[{old_order_id, new_order_id, order_number, items_created}]` — el test
   * debe leer `new_order_id` para localizar la orden resultante real.
   */
  async enviarOrdenesRuteoMasivamente() {
    await this._abrirMenuAccionesMasivasRuteo();
    await this.page.locator(L.RUTEO_MASIVO_LI_ENVIAR).click();
    return this._confirmarModalAccionMasivaRuteo(L.AJAX_ENVIAR_RUTEO_MASIVO);
  }


  /**
   * "Cambiar Repartidor" masivo — a diferencia de "Enviar a Ruteo", esta
   * reasigna in-place (mismo id de orden). Ver el comentario de
   * RUTEO_MASIVO_MODAL: usar una orden PROPIA (no la "primera seleccionable"
   * de un listado compartido con ~200+ órdenes) es necesario para obtener
   * una señal confiable — confirmado en vivo que reutilizar una orden ajena
   * puede fallar en silencio ("0") sin que el endpoint tenga la culpa.
   */
  async cambiarRepartidorOrdenesRuteoMasivamente() {
    await this._abrirMenuAccionesMasivasRuteo();
    await this.page.locator(L.RUTEO_MASIVO_LI_CAMBIAR_REPARTIDOR).click();
    return this._confirmarModalAccionMasivaRuteo(L.AJAX_CAMBIAR_REPARTIDOR_MASIVO);
  }


  /**
   * "Eliminar" masivo — confirma el SweetAlert real ("Eliminar Órdenes"/
   * "¿Estás seguro de eliminar la(s) orden(es)?", botón "Enviar") reutilizando
   * _confirmarSweetAlertV1() (mismo widget que el resto de la suite), y
   * espera la respuesta real de AJAX_ELIMINAR_RUTEO_MASIVO — confirmado en
   * vivo que responde "1" (éxito) y elimina la(s) orden(es) por completo del
   * listado (ni siquiera quedan en "H. de Órdenes"). Por ser irreversible,
   * los tests que la usan deben crear sus propias órdenes desechables — nunca
   * reutilizar una orden real ya existente del ambiente QA compartido.
   */
  async eliminarOrdenesRuteoMasivamente(): Promise<Response> {
    await this._abrirMenuAccionesMasivasRuteo();
    await this.page.locator(L.RUTEO_MASIVO_LI_ELIMINAR).click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_ELIMINAR_RUTEO_MASIVO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.core._confirmarSweetAlertV1('No apareció la confirmación "Eliminar Órdenes"');
    return respuestaPromise;
  }


  /**
   * Descarga el reporte PDF fijo "Ruteo Sin Repartidor" desde el menú
   * "Acciones" del listado Ruteo — ver el comentario de
   * RUTEO_REPORTE_LI_DESCARGAR_PDF: el mismo reporte sin importar el filtro
   * real activo, así que no valida "pertenece al tab actual" (no aplica en
   * este ambiente).
   */
  async descargarReporteRuteoPDF(): Promise<Download> {
    await this._abrirMenuAccionesMasivasRuteo();
    const downloadPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.RUTEO_REPORTE_LI_DESCARGAR_PDF).click();
    return downloadPromise;
  }


  /**
   * Presiona "Imprimir" (data-mode=0) del menú "Acciones" del listado Ruteo —
   * genera el MISMO reporte fijo "Ruteo Sin Repartidor" que
   * descargarReporteRuteoPDF() (ver la corrección en el comentario de
   * RUTEO_REPORTE_LI_IMPRIMIR: confirmado en vivo comparando ambos PDF byte
   * a byte). Chromium headless entrega el resultado como evento `download`
   * (nombre de archivo aleatorio, no el nombre descriptivo de "Descargar
   * PDF") en vez de `popup`, al interceptar la respuesta PDF que el botón
   * intenta abrir en una ventana nueva.
   */
  async imprimirReporteRuteoPDF(): Promise<Download> {
    await this._abrirMenuAccionesMasivasRuteo();
    const downloadPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.RUTEO_REPORTE_LI_IMPRIMIR).click();
    return downloadPromise;
  }
}
