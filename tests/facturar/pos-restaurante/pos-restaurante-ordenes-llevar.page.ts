import { expect, Locator, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, type MetadatoProducto } from '../pos/pos.page';
import { L } from '../pos/pos.locators';
import { esperarVentanaImpresion } from '../pos/pos.utils';

// Locators propios del módulo "Restaurante" (Órdenes para Llevar) del POS —
// confirmado en vivo ÚNICAMENTE contra el ambiente qa_restaurant
// (https://dev.designsoftcr.com/qa_restaurant/public, compañía "Restaurante
// Rancho Robertos"), mismo criterio que pos-restaurante-mesas.page.ts (ver su
// cabecera): estos ids no se agregan a pos.locators.ts.
//
// A diferencia de lo que PosCore.asegurarTipoOrdenRestauranteSiEsNecesario()
// sugiere (un simple selector "Mesa"/"Para Llevar" antes de Facturar),
// "PARA LLEVAR" es en realidad una PESTAÑA completa del pie de página —
// tercera posición fija junto a "MESAS", con id técnico estable
// `footer_tab_rest_table_fast` (`footer_tab_rest_table_express`, la cuarta
// posición documentada en pos-restaurante-mesas.page.ts, sigue oculta/count
// 0 en esta compañía) — con su PROPIA lista de órdenes "para llevar" ya
// creadas (tarjetas `.pos_order_list_item_content_id_<ordenId>`, abiertas con
// `add_pos_rest_order_to_table(<ordenId>)`, mismo patrón real que
// `click_rest_table_on_plane` en Mesas), confirmado en vivo volcando el DOM
// real de cada tarjeta:
//   - Ícono basurero: `confirm_delete_order_res_prev(<id>)` — eliminar la orden.
//   - Ícono "retweet": `move_rest_order_to_table_in_list(<id>,0)` — mover la
//     orden a una mesa real (fuera del alcance de esta suite, dominio de Mesas).
//   - Ícono impresora (1): `print_preinvoice_view_order_rest(<id>)` — pre-factura.
//   - Ícono impresora (2, "dividida"): `open_modal_print_preinvoice(<id>)`.
//   - Ícono check ("aprovate_order_delivery"): `confirm_approve_order(<id>)` —
//     el "Aprobar orden"/flujo de entrega ya documentado como "fuera de
//     alcance" en pos-restaurante-mesas.page.ts en realidad vive AQUÍ, no en
//     el menú hamburguesa de una mesa.
// No estar sobre ninguna tarjeta existente (pestaña "PARA LLEVAR" recién
// abierta, sin seleccionar ninguna) deja el carrito derecho en blanco, listo
// para una orden NUEVA — mismo mecanismo real que "Productos" sin mesa
// seleccionada, confirmado en vivo (agregar un producto ahí arma la orden
// nueva directamente, sin ningún botón "Nueva Orden" aparte).
//
// El botón "+ Agregar" (`title="Opciones de cliente"`) es un dropdown con
// exactamente 2 opciones reales, confirmado en vivo volcando su
// `.dropdown-menu`: "Nuevo Cliente" (`#add_quick_customer`, registra un
// cliente nuevo) y "Nombre del cliente" (`onclick="editQuickCustomerName()"`,
// mismo mecanismo que `PosCore.ingresarNombreCliente()` ya usa en el resto
// de la suite — un nombre suelto, sin registrar cliente). El buscador
// "Buscar Cliente" visible en esta pantalla es el MISMO mecanismo genérico
// que `PosCore.seleccionarClienteExistente()` ya usa en todo el resto del
// POS (mismo `#customer_search_input`/AJAX real) — no se reimplementa aquí.
//
// El tab "Servicios" (`#ck_view_services`, normalmente visible dentro de
// "Productos") NO aparece dentro de esta pestaña "PARA LLEVAR" — confirmado
// en vivo (`isVisible()` → false apenas se entra a esta pestaña). Los
// servicios de este ambiente solo se agregan volviendo primero al tab
// "PRODUCTOS" (donde si está disponible) antes de construir la orden.
const L_LLEVAR = {
  TAB_PARA_LLEVAR: '#footer_tab_rest_table_fast',
  TAB_PRODUCTOS: 'div[onclick="show_rest_product_list_from_tabs()"]',

  TARJETA_ORDEN: (ordenId: string) => `.pos_order_list_item_content_id_${ordenId}`,
  TODAS_LAS_TARJETAS: '[class*="pos_order_list_item_content_id_"]',

  ICONO_ELIMINAR: (ordenId: string) => `[onclick*="confirm_delete_order_res_prev(${ordenId})"]`,
  ICONO_APROBAR: (ordenId: string) => `[onclick*="confirm_approve_order(${ordenId})"]`,
  // Ícono impresora (1) de cada tarjeta, ver el comentario de cabecera de
  // este archivo — `print_preinvoice_view_order_rest(<id>)`, MISMA función
  // real que `PosRestauranteMesas` ya usa para "¡Imprimir Pre-Factura!"
  // desde el menú hamburguesa de una mesa (confirmado en vivo, mismo
  // onclick literal).
  ICONO_PRE_FACTURA: (ordenId: string) => `[onclick*="print_preinvoice_view_order_rest(${ordenId})"]`,

  // ─── Creación FORMAL de una Orden para Llevar ──────────────────────────
  // Ítem real del menú junto a "Facturar" (`L.ORDEN_CAJA_MENU_BTN`,
  // `#demo-menu-top-right` — el mismo que ya abre "Enviar a caja"/"Crear
  // Proforma"/"Generar Apartado" en el resto del POS, confirmado en vivo
  // volcando TODOS sus `<li>` con el carrito flotante activo): "Para Llevar"
  // (`id="btn_assign_rest_table_delivery"`, onclick real
  // `rest_add_order_to_table(0, 1, 1)` — MISMA función que usa "Cambiar de
  // mesa" en Mesas, pero con mesaId=0 y 2 flags que señalan "para llevar").
  // Es hermano directo de "Asignar Mesa" (`btn_assign_rest_table`) en ese
  // mismo menú — confirma en vivo por qué una orden ya asignada a una Mesa
  // NO puede convertirse en "Para Llevar" (indicado directamente por el
  // usuario del proyecto): ambas opciones solo existen para el carrito
  // FLOTANTE, antes de asignarlo a cualquier destino.
  ITEM_MENU_PARA_LLEVAR: '#btn_assign_rest_table_delivery',
} as const;

export class PosRestauranteOrdenesLlevar {
  constructor(private readonly pos: PosPage, private readonly page: Page) {}


  // ─── Navegación al módulo Órdenes para Llevar ───────────────────────────

  /**
   * Abre la pestaña "PARA LLEVAR" del POS — reintento acotado cerrando
   * overlays conocidos antes de cada intento, mismo mecanismo y misma causa
   * raíz ya confirmados en vivo para `PosRestauranteMesas.abrirMesas()` (el
   * modal de tipo de cambio del Dashboard puede reaparecer de forma
   * asíncrona sobre este mismo click).
   */
  async abrirOrdenesParaLlevar() {
    const tab = this.page.locator(L_LLEVAR.TAB_PARA_LLEVAR);
    const MAX_INTENTOS = 4;
    let abierta = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierta; intento++) {
      await this.pos.cerrarOverlaysConocidos();
      await this.pos._cerrarModalMonedaSiAparece();
      abierta = await tab.click({ timeout: 5_000 }).then(() => true).catch(() => false);
    }
    expect(abierta, `El tab "PARA LLEVAR" no se pudo abrir tras ${MAX_INTENTOS} intentos`).toBe(true);
    await this.page.waitForTimeout(1_000);
  }


  /** Vuelve al sub-tab "PRODUCTOS" (catálogo) para agregar ítems a la orden para llevar actualmente activa. */
  async volverAProductos() {
    const tab = this.page.locator(L_LLEVAR.TAB_PRODUCTOS);
    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      await this.pos.cerrarOverlaysConocidos();
      await this.pos._cerrarModalMonedaSiAparece();
      abierto = await tab.click({ timeout: 5_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, `El tab "PRODUCTOS" no se pudo abrir tras ${MAX_INTENTOS} intentos`).toBe(true);

    await expect(
      this.pos.primerProducto,
      'El catálogo de productos no quedó visible tras volver desde "Para Llevar"'
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
  }


  /**
   * Inicia una orden para llevar NUEVA: abre la pestaña y confirma que no
   * hay ningún producto ya cargado en el carrito (mismo criterio "orden en
   * blanco" que usa el resto de la suite al validar un carrito vacío) —
   * quien llame agrega productos/servicios después, exactamente igual que
   * el flujo estándar de "Productos" sin mesa seleccionada.
   */
  async iniciarOrdenNueva() {
    await this.abrirOrdenesParaLlevar();
    await this.volverAProductos();
  }


  // ─── Lista de órdenes para llevar ya creadas ────────────────────────────

  /** Ids reales de todas las órdenes "para llevar" actualmente listadas (tarjetas `.pos_order_list_item_content_id_<id>`). */
  async obtenerIdsOrdenesListadas(): Promise<string[]> {
    await this.abrirOrdenesParaLlevar();
    return this.page.locator(L_LLEVAR.TODAS_LAS_TARJETAS).evaluateAll((tarjetas) =>
      tarjetas.map((t) => {
        const clase = Array.from(t.classList).find((c) => c.startsWith('pos_order_list_item_content_id_'));
        return clase?.replace('pos_order_list_item_content_id_', '') ?? '';
      }).filter((id) => id.length > 0)
    );
  }


  /** Abre (carga al carrito) la orden para llevar dada por su id real — mismo mecanismo real que clickMesa() en Mesas. */
  async abrirOrden(ordenId: string) {
    await this.page.locator(L_LLEVAR.TARJETA_ORDEN(ordenId)).click();
    await expect
      .poll(async () => (await this.pos.obtenerClavesFilasCarrito()).length, { timeout: TIMEOUTS.PAYMENT_MODAL })
      .toBeGreaterThan(0);
  }


  /**
   * Elimina la orden para llevar dada, confirmando el modal real "¿Eliminar
   * Orden?" — mismo componente/mismo texto ya usado por
   * `PosRestauranteMesas.eliminarOrden()` para Mesas (confirmado en vivo que
   * ambos flujos reutilizan el mismo modal de la app).
   *
   * CORRECCIÓN DE AUTOMATIZACIÓN CONFIRMADA EN VIVO (no bug de sistema — el
   * borrado real SIEMPRE funciona del lado del servidor, confirmado
   * interceptando la red: `deletePosResOrderPrev` responde 200 con cuerpo
   * "1"). La versión anterior de este método solo esperaba a que el MODAL
   * se cerrara antes de devolver el control — confirmado en vivo que eso no
   * garantiza que `obtenerIdsOrdenesListadas()`, llamado inmediatamente
   * después por quien orquesta el test, ya refleje el listado actualizado
   * (condición de carrera real: el cierre del modal puede ganarle al
   * refresco del listado). Se espera ahora la respuesta real de
   * `deletePosResOrderPrev` como señal de éxito, antes que el estado visual
   * del modal — mismo criterio que el resto del repo usa para AJAX reales
   * (`enviarOrdenCaja()`, `crearOrdenParaLlevar()`).
   */
  async eliminarOrden(ordenId: string) {
    await this.page.locator(L_LLEVAR.ICONO_ELIMINAR(ordenId)).evaluate((el: HTMLElement) => el.click());

    const tituloModal = this.page.locator('text=¿Eliminar Orden? >> visible=true');
    await expect(tituloModal, 'El modal "¿Eliminar Orden?" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // TIMEOUTS.PRODUCTS_LOAD (120s), no PAYMENT_MODAL (15s): confirmado en
    // vivo que este AJAX específico puede tardar más de 15s bajo carga
    // sostenida del ambiente compartido (mismo criterio ya documentado en
    // el repo para otros AJAX lentos, ver TIMEOUTS.CIERRE_CAJA) — con 15s,
    // una corrida real bajo carga expiraba aquí aunque el borrado real
    // terminara completándose igual del lado del servidor poco después.
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('deletePosResOrderPrev'),
      { timeout: TIMEOUTS.PRODUCTS_LOAD }
    );
    await this.page.getByRole('button', { name: 'Continuar' }).click();
    const respuesta = await respuestaPromise;
    expect(respuesta.ok(), `"deletePosResOrderPrev" respondió con estado ${respuesta.status()}`).toBe(true);

    await expect(tituloModal, 'El modal de eliminar no se cerró tras confirmar').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Aprueba la entrega de la orden para llevar dada (ícono "check" real,
   * `confirm_approve_order(<id>)`) — flujo real de entrega documentado
   * previamente como "fuera de alcance" en el módulo Mesas, confirmado en
   * vivo que en realidad pertenece a esta pantalla.
   *
   * CORRECCIÓN DE AUTOMATIZACIÓN CONFIRMADA CON EL JS FUENTE REAL (pos.js,
   * `confirm_approve_order`/`approve_order`): el ícono NUNCA dispara el AJAX
   * directo — primero abre un SweetAlert de confirmación ("¿Está seguro de
   * aprobar esta orden?", `showCancelButton:true`, `closeOnConfirm:false`) y
   * solo al confirmar ESE modal la app invoca `approve_order(order_id)`, que
   * hace el POST real (`$('#notify_approved_order_email').val()`, síncrono).
   * La versión anterior de este método solo clickeaba el ícono y nunca
   * confirmaba ese SweetAlert — la petición real nunca llegaba a dispararse,
   * lo que explica que el Escenario 22 del spec nunca detectara ninguna
   * respuesta de red con "approve" en la URL (caía siempre al `console.log`
   * de investigación en vez de validar algo real). Se confirma ahora el
   * SweetAlert con el mismo patrón genérico (`.sweet-alert.visible` +
   * `button.confirm`) ya usado por `cambiarDeMesa()`/`unificarMesaConDisponible()`
   * en el módulo Mesas para el resto de confirmaciones SweetAlert v1 de esta
   * app.
   */
  async aprobarOrden(ordenId: string) {
    const icono = this.page.locator(L_LLEVAR.ICONO_APROBAR(ordenId));
    await icono.evaluate((el: HTMLElement) => el.click());

    const confirmacion = this.page.locator('.sweet-alert.visible');
    await expect(
      confirmacion,
      'El SweetAlert de confirmación de "Aprobar orden" no apareció'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await confirmacion.locator('button.confirm').click();

    // `approve_order()` hace el POST real con `async:false` (SÍNCRONO): para
    // cuando el navegador retoma el hilo de JS después del click, la
    // petición ya se completó y la app ya reemplazó el CONTENIDO del mismo
    // overlay SweetAlert con el resultado real (éxito / ya aprobada por otro
    // usuario / error de configuración SMTP — 3 desenlaces reales distintos
    // documentados en pos.js, todos con su propio botón `.confirm`) — nunca
    // cierra y abre un overlay nuevo. Se confirma también esta segunda
    // pantalla (mismo botón genérico) como señal real de que el ciclo
    // completo, incluido el POST, ya terminó — más confiable que adivinar el
    // texto de la URL del endpoint real (resuelto en runtime desde un input
    // oculto, `#notify_approved_order_email`, nunca hardcodeado en el JS).
    await expect(
      confirmacion,
      'El SweetAlert de resultado de "Aprobar orden" no apareció tras confirmar'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await confirmacion.locator('button.confirm').click();
    await expect(
      confirmacion,
      'El SweetAlert de "Aprobar orden" no se cerró tras el resultado'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Crea una Orden para Llevar FORMAL y persistida — mecanismo real
   * confirmado en vivo (indicado directamente por el usuario del proyecto y
   * verificado interceptando la red): NO es "agregar productos estando ya
   * en la pestaña PARA LLEVAR" (eso arma un carrito flotante que factura
   * directo sin persistir ninguna orden — un flujo real y válido de "venta
   * rápida para llevar", pero DISTINTO de crear una Orden formal, y el único
   * usado por los Escenarios 1-18 de este archivo). El flujo real:
   *
   *   1. Con productos ya en el carrito FLOTANTE (agregados estando en
   *      "Productos", SIN ninguna mesa/orden seleccionada — mismo estado
   *      que `PosRestauranteMesas.agregarProductoSinMesaSeleccionada()`),
   *      abrir el menú junto a "Facturar" (`L.ORDEN_CAJA_MENU_BTN`,
   *      `#demo-menu-top-right` — el mismo que ya abre "Enviar a
   *      caja"/"Crear Proforma"/"Generar Apartado" en el resto del POS).
   *   2. Click en la opción real "Para Llevar" (`L_LLEVAR.ITEM_MENU_PARA_LLEVAR`).
   *   3. Un SweetAlert real pide confirmación con un campo OBLIGATORIO
   *      "Nombre del cliente" (confirmado en vivo que un envío vacío deja el
   *      campo marcado "Not valid!" sin completar el envío — mismo string
   *      sin traducir ya documentado en otros flujos de este repo).
   *   4. "Enviar" dispara `sendPosRestProductSale` (200 OK, confirmado
   *      interceptando la red) y la orden queda persistida: aparece de
   *      inmediato con un id nuevo al principio de
   *      `obtenerIdsOrdenesListadas()` — confirmado en vivo, reproducido
   *      limpio más de una vez.
   *
   * Devuelve el id real de la orden recién creada (diferencia entre el
   * listado antes/después, nunca asumido por posición).
   */
  async crearOrdenParaLlevar(nombreCliente: string): Promise<string> {
    const idsAntes = new Set(await this.obtenerIdsOrdenesListadas());
    await this.volverAProductos();

    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      L.ORDEN_CAJA_MENU_BTN
    );
    const item = this.page.locator(L_LLEVAR.ITEM_MENU_PARA_LLEVAR);
    await expect(item, 'La opción "Para Llevar" del menú junto a Facturar no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await item.evaluate((el: HTMLElement) => el.click());

    const sweetAlert = this.page.locator('.sweet-alert.visible');
    await expect(sweetAlert, 'El SweetAlert de confirmación de "Para Llevar" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await sweetAlert.locator('input').fill(nombreCliente);

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes('sendPosRestProductSale'),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await sweetAlert.locator('button.confirm').click();
    const respuesta = await respuestaPromise;
    expect(respuesta.ok(), `"sendPosRestProductSale" respondió con estado ${respuesta.status()}`).toBe(true);
    await expect(sweetAlert, 'El SweetAlert de "Para Llevar" no se cerró tras Enviar').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const idsDespues = await this.obtenerIdsOrdenesListadas();
    const idNuevo = idsDespues.find((id) => !idsAntes.has(id));
    expect(idNuevo, `No se detectó ningún id nuevo en el listado tras crear la orden (antes: ${[...idsAntes]}, después: ${idsDespues})`).toBeDefined();
    return idNuevo!;
  }


  // ─── Impresión: Pre-Factura ───────────────────────────────────────────
  //
  // Brecha de cobertura real detectada auditando este módulo: a diferencia
  // de `PosRestauranteMesas` (que sí prueba Pre-Factura/Comanda desde el
  // menú hamburguesa de una mesa), este archivo nunca había ejercitado el
  // ícono impresora de una tarjeta de "Para Llevar" — mismo mecanismo real
  // (`print_preinvoice_view_order_rest(<id>)`, confirmado en vivo idéntico
  // al de Mesas) y misma limitación técnica ya documentada ahí (la ventana
  // de impresión nunca navega a una URL real, ver `esperarVentanaImpresion()`
  // en `pos.utils.ts`): solo se puede confirmar que el popup se abrió, no
  // leer su contenido.

  /** Genera la Pre-Factura de la orden para llevar dada y confirma que la ventana de impresión se abrió (ver la limitación documentada arriba). */
  async imprimirPreFactura(ordenId: string): Promise<void> {
    return esperarVentanaImpresion(
      this.page,
      () => this.page.locator(L_LLEVAR.ICONO_PRE_FACTURA(ordenId)).evaluate((el: HTMLElement) => el.click()),
      TIMEOUTS.PRINT_POPUP
    );
  }


  // ─── Cliente ──────────────────────────────────────────────────────────
  //
  // No se reimplementa nada aquí: confirmado en vivo que tanto el buscador
  // "Buscar Cliente" (`PosCore.seleccionarClienteExistente()`) como el
  // dropdown "+ Agregar" → "Nombre del cliente" (`PosCore.ingresarNombreCliente()`)
  // son EXACTAMENTE el mismo componente genérico (`.panel-customer-search`)
  // que el resto del POS ya usa — el botón real de esta pantalla
  // (`title="Opciones de cliente"`) es el mismo `.dropdown-toggle` que
  // `L.CLIENTE_DROPDOWN_AGREGAR` ya localiza. `pos.seleccionarClienteExistente()`/
  // `pos.ingresarNombreCliente()` funcionan tal cual, sin ningún wrapper.

  // ─── Aditivos / Modificadores ────────────────────────────────────────────

  /**
   * Cierra el modal de Aditivos/Modificadores (`#dialog_rest_mod_view`) si
   * está visible en este momento — mismo bug de automatización ya
   * confirmado y corregido en `PosRestauranteMesas._cerrarModalAditivosSiApareceAutomaticamente()`
   * (ver su comentario completo): el popup automático de Aditivos no está
   * restringido al módulo Mesas — se dispara igual al agregar cualquier
   * producto con aditivos configurados desde "Para Llevar" (mismo catálogo
   * de productos de la compañía), confirmado en vivo.
   */
  async _cerrarModalAditivosSiApareceAutomaticamente() {
    const modal = this.page.locator('#dialog_rest_mod_view');
    const abierto = await modal.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false);
    if (!abierto) return;

    await this.page.locator('#closeBtnModifierView').click().catch(() => {});
    await modal.waitFor({ state: 'hidden', timeout: TIMEOUTS.PAYMENT_MODAL }).catch(() => {});
  }


  /**
   * Único producto del catálogo de este ambiente confirmado en vivo con
   * Aditivos/Modificadores reales configurados — mismo producto y mismo
   * catálogo real de la compañía ya documentados en
   * `PosRestauranteMesas.PRODUCTO_CON_ADITIVOS` (grupo "COMBINACIÓN DE
   * PIZZA", opción real "JAMON Y QUESO", confirmado en vivo también desde
   * Para Llevar, no solo desde Mesas).
   */
  static readonly PRODUCTO_CON_ADITIVOS = '165/60r14 75h supraforce keter';

  get modalAditivos(): Locator {
    return this.page.locator('#dialog_rest_mod_view');
  }


  /**
   * Agrega PRODUCTO_CON_ADITIVOS al carrito de la orden Para Llevar activa
   * y selecciona la primera opción disponible del modal de Aditivos que se
   * abre automáticamente — confirmado en vivo (interceptando el DOM, no
   * asumido) que el mismo modal `#dialog_rest_mod_view` y el mismo popup
   * automático ya documentados para Mesas funcionan igual desde Para
   * Llevar. Devuelve el nombre real de la opción seleccionada.
   */
  async agregarProductoConAditivo(): Promise<string> {
    const nombre = PosRestauranteOrdenesLlevar.PRODUCTO_CON_ADITIVOS;
    const producto = this.pos.productoPorNombre(nombre);
    await expect(
      producto,
      `El producto de prueba "${nombre}" (con Aditivos configurados) no está en el catálogo de este ambiente`
    ).toHaveCount(1, { timeout: TIMEOUTS.PRODUCTS_LOAD });

    const filasAntes = await this.pos.obtenerClavesFilasCarrito();
    await producto.click();
    await expect.poll(
      async () => (await this.pos.obtenerClavesFilasCarrito()).length,
      { timeout: TIMEOUTS.PRODUCTS_LOAD, message: `"${nombre}" no quedó agregado al carrito de Para Llevar` }
    ).toBeGreaterThan(filasAntes.length);

    // El popup automático de Aditivos puede tardar unos segundos en
    // dispararse (AJAX propio de la app, mismo comportamiento ya
    // confirmado en Mesas) — si no llega a tiempo, se abre manualmente con
    // el botón "+" real de la fila, nunca a ciegas los dos a la vez (ver el
    // comentario completo de `PosRestauranteMesas.agregarProductoConAditivo()`
    // sobre el conflicto real de doble-entrada del código fuente de la app).
    const abrioSolo = await this.modalAditivos
      .waitFor({ state: 'visible', timeout: 6_000 })
      .then(() => true)
      .catch(() => false);

    if (!abrioSolo) {
      const fila = this.page.locator('#table_buy_list tr[id^="table_product_name_"]', { hasText: nombre }).first();
      await fila.locator('button[onclick*="open_modal_mod"]').click();
      await expect(this.modalAditivos, 'El editor de Aditivos no abrió').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    }

    const opcion = this.page.locator('.content-mod[onclick^="select_modifier"]').first();
    await expect(opcion, 'El producto con Aditivos configurados no mostró ninguna opción seleccionable').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    const nombreOpcion = (await opcion.getAttribute('title')) ?? '';
    await opcion.click();

    await this.page.locator('#closeBtnModifierView').click();
    await expect(this.modalAditivos, 'El modal de Aditivos no se cerró').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    return nombreOpcion;
  }


  // ─── Agregar productos ────────────────────────────────────────────────

  /**
   * Agrega un producto del catálogo al carrito de la orden para llevar
   * activa — mismo mecanismo genérico que `PosCore.agregarProductoDelGridAlCarrito()`,
   * envuelto con el cierre defensivo del modal de Aditivos (antes y después,
   * mismo criterio que `PosRestauranteMesas.agregarProductoAlCarritoDeMesa()`).
   */
  async agregarProductoAlCarrito(metadato: MetadatoProducto): Promise<void> {
    await this._cerrarModalAditivosSiApareceAutomaticamente();
    await this.pos.agregarProductoDelGridAlCarrito(metadato);
    await this._cerrarModalAditivosSiApareceAutomaticamente();
  }


  // ─── Observación de producto: variante propia de este modal ─────────────
  //
  // CONFIRMADO EN VIVO QUE NO ES BUG DE SISTEMA (investigado a fondo con
  // captura + volcado del HTML real): `PosCore.agregarObservacionAProducto()`
  // (el helper genérico) SÍ abre correctamente el diálogo real
  // (`#dialog_product_item_comment`, confirmado `display:block`), pero
  // después busca un botón "Nuevo" con onclick literal
  // `show_product_item_comment(0,1)` que NO EXISTE en la versión de este
  // modal (confirmado volcando su `innerHTML` completo) — ese mismo patrón
  // de onclick (`show_product_item_comment(<id>,0)`) sí existe, pero como
  // `ondblclick` de las FILAS de la lista "Observaciones guardadas" (para
  // cargar una observación reutilizable ya existente, `<id>` real de esa
  // fila, nunca 0), no como botón de acción. La razón real por la que no
  // hace falta ningún botón "Nuevo" aquí: el editor de esta versión del
  // modal está SIEMPRE visible de entrada (`#ta_product_item_comment`, un
  // textarea listo para escribir de inmediato) con dos acciones reales
  // distintas — "Guardar en lista" (`btn_save_catalog_product_item_comment`,
  // crea/actualiza una observación reutilizable en el catálogo) y "Aplicar"
  // (`onclick="save_product_item_comment(0,0)"`, la que de verdad aplica el
  // texto a ESTA línea del carrito, la usada aquí).
  async agregarObservacionAProducto(clave: string, texto: string) {
    await this.page.locator(`#product_item_comment_${clave}`).click();
    const dialog = this.page.locator('#dialog_product_item_comment');
    await expect(dialog, 'El modal "Observaciones" no se abrió').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const textarea = this.page.locator('#ta_product_item_comment');
    await expect(textarea, 'El textarea de observación no quedó visible').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await textarea.fill(texto);

    await this.page.locator('#dialog_product_item_comment button[onclick^="save_product_item_comment"]').click();
    await expect(dialog, 'El modal "Observaciones" no se cerró tras Aplicar').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /** Agrega el primer producto del catálogo que todavía no esté en el carrito (tipoItem=1: producto, 2: servicio). */
  async agregarPrimerProductoNoPresente(tipoItem: 1 | 2 = 1): Promise<string> {
    const metadato = await this.pos.obtenerPrimerProductoNoPresenteEnCarrito(tipoItem);
    await this.agregarProductoAlCarrito(metadato);
    return metadato.nombre;
  }


  // ─── Moneda: variante por NOMBRE COMPLETO ────────────────────────────────
  //
  // CORRECCIÓN DE AUTOMATIZACIÓN CONFIRMADA EN VIVO (no un bug de sistema):
  // `PosCore.cambiarMoneda(simbolo)` filtra por el texto del ÍCONO
  // `.icon_type_currency_print_by_user` (`hasText: simbolo`), que en TODO el
  // catálogo real solo contiene el símbolo corto ("$", "₡", "€", "L"), nunca
  // el nombre completo — confirmado en vivo volcando el DOM real de cada
  // `<li>` del menú de moneda (`ul[for="menu_type_currency"] li`), cuyo
  // `textContent` completo sí incluye el nombre ("$ Dólar Americano", "$ Peso
  // Mexicano"). El catálogo de este ambiente (qa_restaurant) tiene DOS
  // monedas reales con el mismo símbolo "$" (Dólar Americano id=29, Peso
  // Mexicano id=118) — pasar el nombre completo a `cambiarMoneda()` (como
  // hacía la primera versión de este archivo) no soluciona la ambigüedad:
  // el filtro nunca matchea nada (el ícono no contiene el nombre) y
  // `_seleccionarOpcionMoneda()` agota sus 8 reintentos con el MISMO error
  // determinístico en cada uno (nunca intermitente) — confirmado en vivo (2/2
  // corridas idénticas, tanto en paralelo como aislada). No se modifica
  // `cambiarMoneda()` (usado en TODA la suite del ambiente original con
  // símbolos, sin ambigüedad ahí) — se agrega esta variante acotada,
  // reutilizando `PosCore._seleccionarOpcionMoneda()` (que sí acepta
  // cualquier Locator) con un Locator propio que filtra por el `<li>`
  // COMPLETO en vez de solo el ícono.
  async cambiarMonedaPorNombre(nombreCompleto: string): Promise<string> {
    const opcion = this.page.locator(L.MENU_MONEDA_ITEM, { hasText: nombreCompleto });
    await expect(
      opcion,
      `No se encontró ninguna opción de moneda cuyo texto completo contenga "${nombreCompleto}"`
    ).toHaveCount(1);
    const cuerpo = await this.pos._seleccionarOpcionMoneda(opcion);
    return cuerpo.currency_symbol;
  }
}
