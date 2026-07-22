import { expect, Download, Locator, Page, Response } from '@playwright/test';
import { L } from './pos.locators';
import {
  TIMEOUTS, PAUSES, CAJA_TEXTO, CHECKBOX_ID, PestanaPos, PESTANA_POS_FACTURACION,
  PESTANAS_POS_A_RECORRER, MetodoPago, METODO, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT,
  TipoPagoOrdenCaja, TipoProforma, VEHICULO_PINTURA_TIPO, COMPANIA_POS, CABYS_BUSQUEDA,
  CABYS_BUSQUEDA_SIN_IVA, PRECIO_PRODUCTO_RAPIDO, EscenarioDescuento, ResultadoDescuento,
  EstadoCheckIva, ConfigBusquedaCabys, LineaCarrito, MetadatoProducto, DASHBOARD_URL,
} from './pos.types';
import { esperarQuedaActivo } from './pos.utils';

// Paso 1/9 de la migración a composición (ver el plan aprobado): helpers
// realmente transversales del módulo POS, extraídos de pos.page.ts. Todo
// miembro que en el monolito era 'private' pasa a público aquí a propósito:
// ahora lo llaman tanto la fachada (PosPage, por delegación) como, en pasos
// futuros, las demás clases de dominio compuestas con esta (PosPayment,
// PosCierreCaja, PosRuteo, etc.) — ninguna de ellas hereda de PosCore, así
// que 'private' les bloquearía el acceso. Ningún test externo llamaba estos
// métodos directamente (eran privados), así que este cambio no toca la API
// pública real de la suite.
// URL real del POS ya resuelta al menos una vez en este proceso worker
// (capturada de `page.url()` tras `_irAlPosResolviendoCompania()`, nunca
// construida a mano) — permite que `irAlPos()` reutilice la MISMA URL real
// que la aplicación ya generó, sin volver a pasar por el Dashboard en cada
// llamada y sin depender de ningún `company_pos` fijo.
//
// A propósito a nivel de MÓDULO, no de instancia: cada worker de Playwright
// es un proceso Node separado, así que esto reproduce "como máximo una vez
// por worker" tanto para las fixtures worker-scoped como para los archivos
// que crean una PosPage nueva por test.
let posUrlResueltaPorWorker: string | null = null;

export class PosCore {
  constructor(public readonly page: Page) {}


  /** Locator del modal "Abrir Caja", expuesto para que los tests validen su contenido. */
  get modalAbrirCaja() {
    return this.page.locator(L.DIALOG_ABRIR_CAJA);
  }


  /** Locator del primer producto disponible en el grid del POS. */
  get primerProducto() {
    return this.page.locator(L.PRODUCTO).first();
  }


  /**
   * Único punto real de entrada al POS de esta clase. No decide nada sobre
   * el modal "Abrir Caja"; eso es responsabilidad del test.
   *
   * Nunca construye ninguna URL: si esta instancia ya resolvió el POS antes
   * (`_posUrlResuelta`, capturada de `page.url()` real tras
   * `_irAlPosResolviendoCompania()`), navega directo a esa misma URL real —
   * mismo mecanismo que ya usaban los archivos con fixture `pos` de scope
   * "worker" (un solo paso por Dashboard por worker, reutilizado en cada
   * test). Si todavía no la resolvió (primera vez en esta instancia — el
   * caso de los archivos que llaman `cargarPosYCerrarModalSiAparece()`/
   * `irAlPos()` con una `page` nueva por test, sin pasar antes por
   * `cargarPosDesdeDashboard()`), la resuelve ahora mismo pasando por el
   * Dashboard, EXACTAMENTE el mismo flujo real (mismo link, mismo modal de
   * compañía si aparece) que usa `cargarPosDesdeDashboard()` — no hay dos
   * mecanismos distintos, ambos terminan en `_irAlPosResolviendoCompania()`.
   */
  async irAlPos() {
    if (posUrlResueltaPorWorker) {
      await this.page.goto(posUrlResueltaPorWorker, { waitUntil: 'commit', timeout: TIMEOUTS.NAVIGATE });
      return;
    }

    await this.page.goto(DASHBOARD_URL, { waitUntil: 'load' });
    await this.page.locator(L.DASHBOARD_BELL_LOADING)
      .waitFor({ state: 'hidden', timeout: TIMEOUTS.PAYMENT_MODAL })
      .catch(() => {});
    await this._irAlPosResolviendoCompania();
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
   * Carga el POS y decide qué hacer con el modal "Abrir Caja" si aparece: lo valida y
   * lo cierra sin completar la apertura, ya que agregar productos no requiere la caja
   * abierta (eso se decide más adelante, al facturar). Comportamiento esperado, no un
   * error. Centralizado aquí: existía duplicado de forma idéntica como función local
   * en pos-cierre-caja.spec.ts, pos-navegacion.spec.ts y pos.spec.ts.
   */
  async cargarPosYCerrarModalSiAparece() {
    await this.irAlPos();
    await this.esperarEstadoInicial();
    if (await this.modalAbrirCajaVisible()) {
      await expect(this.modalAbrirCaja).toBeVisible();
      await expect(this.modalAbrirCaja.getByText(CAJA_TEXTO)).toBeVisible();
      await this.cerrarModalAbrirCaja();
    }
  }


  /**
   * Navega al POS pasando primero por el Dashboard, en la misma pestaña, y
   * resuelve el modal "Abrir Caja" si aparece. Pensado únicamente para el
   * flujo de "Producto Rápido" — el resto de la suite sigue entrando
   * directo vía irAlPos() (usado por cargarPosYCerrarModalSiAparece(), más
   * arriba en esta misma clase), que no necesita este paso extra.
   *
   * Motivo (condición de carrera real de la aplicación, no un problema de
   * automatización): dentro del mismo bloque `$(document).ready()` de
   * pos.js que liga el evento "click" de varios controles del modal
   * "Producto Rápido" —incluido el botón "Agregar"—, una línea anterior
   * de ese mismo bloque invoca una función (`clear_dialog_select_sunat_
   * detractions`) que, en una carga en frío del navegador, todavía no está
   * definida: se declara en otro script que en ese instante no terminó de
   * cargar. Eso dispara un `ReferenceError` no capturado que aborta el
   * resto del bloque `ready()`, dejando esos controles sin su listener de
   * "click" durante toda la vida de esa carga de página — confirmado
   * inspeccionando el error real en consola y verificando con
   * `getEventListeners()` (vía CDP) que el botón "Agregar" efectivamente
   * queda sin ningún listener registrado, ni directo ni delegado. Un click
   * real (humano o de Playwright) sobre ese botón, en esas condiciones, no
   * tiene ningún efecto.
   *
   * El storageState de Playwright solo persiste cookies y localStorage,
   * nunca la caché HTTP de recursos, así que cada test arranca con esa
   * caché fría igual que un navegador nuevo. Visitar el Dashboard primero,
   * en la misma pestaña, calienta la caché de los scripts compartidos: para
   * cuando se navega al POS, la función ya está disponible y el bloque
   * `ready()` completo corre sin abortar — confirmado experimentalmente de
   * forma consistente (3/3 intentos con este orden, 0/2 sin él, en pruebas
   * repetidas contra el ambiente real).
   *
   * `waitUntil: 'load'` NO es suficiente para considerar el Dashboard listo:
   * investigado en vivo (4/4 corridas instrumentando request/response reales)
   * que, en el instante exacto en que el evento `load` del navegador se
   * dispara, siguen en vuelo 2-3 llamadas AJAX propias del Dashboard
   * (`getUserNotifications`, `getMonth`, y a veces `addLogRegister`) — `load`
   * solo garantiza que los recursos de la carga inicial (scripts/CSS/
   * imágenes referenciados en el HTML) terminaron, no que la inicialización
   * async que esos scripts disparan haya terminado. Navegar al POS de
   * inmediato (como hacía este método antes) corta esas llamadas a mitad de
   * camino.
   *
   * Se espera explícitamente a que desaparezca `.workshop-web-bell-loading`
   * —el spinner real del panel de notificaciones ("campana")— en vez de usar
   * `waitForTimeout()` o `networkidle`: confirmado en vivo que ese elemento
   * se elimina del DOM exactamente cuando `getUserNotifications` responde
   * (badge pasa de "0" placeholder a la cuenta real, `#workshop-web-bell-list`
   * pasa de 1 hijo —el propio loader— a los ítems reales), y que
   * `getUserNotifications` es, de las llamadas pendientes al momento de
   * `load`, la última en resolver en las 4 corridas observadas (`getMonth`
   * siempre terminó igual o antes). `addLogRegister` es una llamada de
   * registro/auditoría sin ningún efecto visible para el usuario ni para el
   * POS, así que no se espera por separado — y por eso tampoco se usa
   * `networkidle`, que sí dependería de ella (y de cualquier otra petición no
   * crítica, como un tracking pixel, que podría tardar mucho más o no
   * resolver nunca). Con `.catch(() => {})`: si el elemento no llega a
   * aparecer para esta cuenta/permiso, o si por algún motivo no desaparece,
   * no debe bloquear el flujo — es una estabilización adicional, no una
   * aserción de negocio.
   */
  async cargarPosDesdeDashboard() {
    await this.page.goto(DASHBOARD_URL, { waitUntil: 'load' });
    await this.page.locator(L.DASHBOARD_BELL_LOADING)
      .waitFor({ state: 'hidden', timeout: TIMEOUTS.PAYMENT_MODAL })
      .catch(() => {});
    await this._irAlPosResolviendoCompania();
    await this.esperarEstadoInicial();
    if (await this.modalAbrirCajaVisible()) {
      await expect(this.modalAbrirCaja.getByText(CAJA_TEXTO)).toBeVisible();
      await this.cerrarModalAbrirCaja();
    }
  }


  /**
   * Cierra el modal de tipo de cambio (Banco Central de Costa Rica) si está
   * abierto — puede quedar sobre el menú lateral del Dashboard e interceptar
   * el click al link real hacia POS (confirmado en vivo: Playwright reporta
   * "<div ... id=\"dashbmBccrCurrencyModal\"> ... intercepts pointer
   * events"). Ajeno al flujo de compañía/POS, igual criterio que el resto de
   * los overlays "conocidos" de esta clase: su ausencia es igual de válida
   * que su aparición.
   */
  async _cerrarModalMonedaSiAparece() {
    await this._cerrarOverlayDashboardSiAparece(this.page.locator(L.DASHBOARD_MODAL_MONEDA));
  }


  /**
   * Cierra el modal "Setup Inicial del Sistema" si está abierto — ver el
   * comentario de L.DASHBOARD_MODAL_SETUP_INICIAL para la evidencia
   * completa. Se descarta (botón de cierre real), nunca se completa el
   * wizard: este método no forma parte de ningún flujo de configuración,
   * solo despeja el overlay para poder continuar hacia POS.
   */
  async _cerrarModalSetupInicialSiAparece() {
    await this._cerrarOverlayDashboardSiAparece(this.page.locator(L.DASHBOARD_MODAL_SETUP_INICIAL));
  }


  /**
   * Cierra un modal del Dashboard (moneda o Setup Inicial) si está visible,
   * reintentando el click de cierre en vez de esperar una sola vez.
   *
   * Causa raíz investigada en vivo (no asumida): el toast de notificaciones
   * del navegador y el modal de moneda pueden REAPARECER de forma asíncrona
   * y recurrente en cualquier momento — confirmado instrumentando el DOM en
   * vivo: justo antes de un click ambos reportaban `isVisible()===false`, y
   * milisegundos después, en el instante real del click, el propio log de
   * Playwright mostraba a uno de los dos "intercepts pointer events" de
   * nuevo. `force:true` no protege contra esto por sí solo: dispara el click
   * en las coordenadas reales del botón sin esperar, pero si en ESE instante
   * exacto otro overlay genuinamente ocupa ese punto, el evento aterriza en
   * él, no en el botón de cierre deseado — confirmado en vivo que esta era
   * la causa real de que "Setup Inicial" pudiera tardar hasta 120s en
   * reportar `hidden` (el timeout completo de un único intento), no una
   * lentitud propia del modal ni de la aplicación: con reintentos cortos
   * (cerrando notificaciones + moneda antes de cada uno) el mismo modal cerró
   * en 2-3 intentos, bien por debajo de 10 segundos en las corridas medidas.
   *
   * Cada intento usa un timeout corto y real (`waitFor('hidden')`, nunca
   * `waitForTimeout`) — no se aumenta ningún timeout global, se reemplaza un
   * único intento con espera larga por varios intentos con espera corta.
   */
  async _cerrarOverlayDashboardSiAparece(modal: Locator) {
    const MAX_INTENTOS = 8;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      if (!(await modal.isVisible().catch(() => false))) return;

      await this.cerrarModalNotificacionesSiAparece();
      await modal.locator('[data-dismiss="modal"]').first().click({ force: true }).catch(() => {});

      const cerrado = await modal
        .waitFor({ state: 'hidden', timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
      if (cerrado) return;
    }
  }


  /**
   * Navega del Dashboard al POS pasando por el flujo real de selección de
   * compañía — investigado en vivo (DOM real, AJAX real, código fuente de
   * general_functions.js/sidebar-active.js), no asumido:
   *
   * 1. El link real hacia POS es `a[onclick="get_company_pos_select(1)"]`
   *    (texto visible "Crear factura", el "1" es pos_type_option=1) —
   *    vive colapsado dentro de un submenú del sidebar ("FACTURAR") hasta
   *    que se expande.
   * 2. Al hacer click, `get_company_pos_select(1)` dispara un POST
   *    SÍNCRONO (`async:false`) contra la URL de `#url_to_company_pos_select`.
   *    Si la respuesta trae `result==1` (la cuenta ya tiene una compañía
   *    resuelta — un solo acceso, o ya seleccionada antes), el propio
   *    sistema navega de inmediato via `window.location`, dentro del mismo
   *    manejador síncrono del click — nunca aparece ningún modal (Flujo B:
   *    usuario con una sola compañía). Si no, inyecta el listado de
   *    compañías en `#select_company_pos_content` y abre
   *    `#dialog_select_company_pos` (Flujo A: usuario con varias
   *    compañías). CUÁL de los dos ocurre depende únicamente de la cuenta/
   *    ambiente, nunca de este código — ambos son comportamientos válidos
   *    del sistema, no un error.
   * 3. La URL real del POS **no se construye en este archivo**: viene del
   *    elemento oculto `#url_to_pos` del Dashboard (la misma base en ambos
   *    caminos), y — solo en el camino con modal — la función
   *    `redirect_to_pos(company, redirect)` de la propia aplicación arma
   *    `url_to_pos + "?company_pos=" + company + "&pos_type_option=" + redirect`
   *    y navega. No se duplica esa construcción aquí: se deja que la propia
   *    UI (el link, y si aparece, la tarjeta de la compañía) dispare su
   *    propia navegación real, y este método únicamente espera esa
   *    navegación.
   * 4. Cada compañía es una `<li id="product_box_<id>">` dentro de
   *    `#company_list` (lista, no `<select>` ni tarjetas independientes),
   *    con el nombre real en su `.company-name` (DASHBOARD_COMPANIA_NOMBRE)
   *    — el resto del `<li>` puede traer más contenido (dirección, ícono),
   *    así que la compañía se localiza por el nombre EXACTO de ese
   *    elemento (nunca substring del `<li>` completo, y nunca por id
   *    numérico, específico del ambiente): evita seleccionar por error una
   *    compañía distinta cuyo nombre solo CONTENGA el buscado (p. ej.
   *    "HONDURAS SUCURSAL 2" al buscar "HONDURAS").
   *
   * Flujo A vs. Flujo B se distingue con una CARRERA funcional real entre
   * "el modal se hizo visible" y "la app ya navegó al POS" — nunca de forma
   * secuencial (esperar el timeout completo del modal y solo después
   * asumir navegación directa, lo que desperdiciaría ese tiempo completo en
   * cada corrida del Flujo B) y nunca con una excepción usada para decidir
   * cuál de los dos ocurrió: se usa `Promise.any()` (no `Promise.race()`)
   * sobre las dos promesas SIN capturar sus rechazos de antemano — gana la
   * PRIMERA en CUMPLIRSE, y solo si AMBAS rechazan (ninguna ocurrió) es que
   * `Promise.any()` rechaza. Esto importa: con `Promise.race()` y cada
   * promesa "aplanada" a `.catch(() => null)` antes de la carrera (diseño
   * descartado tras confirmarlo en vivo: falló exactamente así — ver
   * historial), un timeout temprano del lado del modal "gana" la carrera
   * con `null` aunque la navegación directa (Flujo B) siga en curso y
   * fuera a resolver poco después — un falso "ni modal ni navegación"
   * mientras el POS SÍ estaba cargando. `Promise.any()` no tiene ese
   * problema: ignora los rechazos individuales y sigue esperando a la otra
   * promesa hasta que una de las dos cumple, o hasta que ambas rechazan.
   * Se arman ANTES del click (no después): al ser el POST síncrono, la
   * navegación del Flujo B puede ocurrir dentro del propio manejador del
   * click, antes de que `linkIrAPos.click()` termine de resolver — armar
   * la carrera después arriesgaría perderse esa navegación (mismo criterio
   * que guardarOrdenRuteoYObtenerRespuesta()/_armarCarreraFacturacion(): la
   * espera del evento se arma antes del click, incluidos los reintentos).
   * La espera de navegación usa TIMEOUTS.NAVIGATE (no PAYMENT_MODAL): una
   * carga real de POS bajo este ambiente puede tardar bastante más que un
   * simple modal (confirmado en vivo, ver TIMEOUTS.NAVIGATE en el resto del
   * archivo) — un timeout corto aquí haría fallar el Flujo B en cargas
   * lentas aunque la navegación SÍ fuera a completarse.
   *
   * Si NINGUNO de los dos ocurre dentro de esos tiempos, `Promise.any()`
   * rechaza (AggregateError) — se traduce a un error explícito con
   * contexto vía un único `.catch()` final (no un try/catch usado para
   * *distinguir* entre los flujos válidos, que es justamente lo que este
   * diseño evita: aquí solo se usa para dar forma al mensaje de la falla
   * real, ya decidida por `Promise.any()`).
   */
  async _irAlPosResolviendoCompania() {
    // Orden confirmado en vivo (cuentas cuya compañía por defecto tiene
    // pendiente el setup inicial): el modal de tipo de cambio puede abrirse
    // POR ENCIMA del modal "Setup Inicial del Sistema" (mismo backdrop
    // estático de ambos). Cerrar Setup Inicial primero deja su botón "×"
    // (.setup-modal-close) físicamente cubierto por el modal de moneda
    // encima — el click (sin force) queda reintentando contra "elemento
    // intercepta pointer events" hasta agotar su propio timeout, sin cerrar
    // nunca el modal, lo que deja el link real hacia POS inalcanzable. Cerrar
    // primero el modal de moneda (su propio botón de cierre nunca queda
    // cubierto, al ser siempre el más reciente/superior) libera el botón de
    // Setup Inicial para el click siguiente.
    await this._cerrarModalMonedaSiAparece();
    await this._cerrarModalSetupInicialSiAparece();

    // Paso 1: Dashboard funcional. cargarPosDesdeDashboard() ya espera esto
    // antes de llamar a este método (idéntica condición), pero se repite
    // aquí porque este método también puede invocarse en otros contextos: el
    // badge de notificaciones sigue "cargando" (workshop-web-bell-loading)
    // hasta que el Dashboard terminó de resolver su estado inicial.
    await this.page.locator(L.DASHBOARD_BELL_LOADING)
      .waitFor({ state: 'hidden', timeout: TIMEOUTS.PAYMENT_MODAL })
      .catch(() => {});

    // Paso 2: localizar "Crear factura".
    const linkIrAPos = this.page.locator(L.DASHBOARD_LINK_IR_A_POS).first();
    if (!(await linkIrAPos.isVisible().catch(() => false))) {
      // El link vive colapsado dentro de su submenú padre (treeview) — se
      // expande haciendo click en el <a> inmediatamente superior, sin asumir
      // su texto ("FACTURAR" en el ambiente investigado, pero configurable
      // por empresa/ambiente).
      await linkIrAPos.evaluate((el) => {
        const li = el.closest('li');
        const ul = li?.closest('ul');
        const parentA = ul?.closest('li')?.querySelector<HTMLElement>(':scope > a');
        parentA?.click();
      });
      await expect(linkIrAPos, 'El link real hacia POS no quedó visible tras expandir su submenú').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    }

    // Carrera armada ANTES del click — ver el comentario del método para el
    // porqué. Ninguna se captura aquí para Promise.any() (más abajo), que es
    // quien decide ignorando rechazos individuales hasta que ambas rechacen.
    //
    // Pero SÍ se le adjunta un .catch() silencioso a cada una por separado
    // (sin afectar lo que Promise.any() recibe: un handler adicional en la
    // MISMA promesa no cambia su valor para otros handlers ya adjuntos) —
    // confirmado en vivo que sin esto, la promesa que PIERDE la carrera
    // (p. ej. esperaModal, cuando esperaNavegacionDirecta ya resolvió
    // 'directo') sigue corriendo de fondo y, al rechazar más tarde sin que
    // nada la esté escuchando ya, Node la reporta como unhandled promise
    // rejection — que Playwright superficia como una falla del test aunque
    // el flujo real ya hubiera tenido éxito (el error crudo de
    // `modalCompania.waitFor(...)` apareciendo como causa de un test que en
    // realidad SÍ había navegado al POS).
    const modalCompania = this.page.locator(L.DASHBOARD_MODAL_SELECCIONAR_COMPANIA);
    const esperaModal = modalCompania
      .waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL })
      .then(() => 'modal' as const);
    const esperaNavegacionDirecta = this.page
      .waitForURL(/pointOfSale/, { timeout: TIMEOUTS.NAVIGATE })
      .then(() => 'directo' as const);
    esperaModal.catch(() => {});
    esperaNavegacionDirecta.catch(() => {});

    // Paso 3: click sobre "Crear factura". El modal de tipo de cambio (y,
    // en cuentas cuya compañía por defecto tenga pendiente su
    // configuración inicial, "Setup Inicial del Sistema") pueden reaparecer
    // de forma asíncrona justo antes de este click. Se cierran antes de
    // cada intento, acotado, sin try/catch: cada intento resuelve a
    // true/false vía .then()/.catch(), mismo criterio que
    // _cerrarOverlayDashboardSiAparece().
    //
    // Click NATIVO (el.click() vía evaluate, no linkIrAPos.click() de
    // Playwright) — causa raíz real confirmada en vivo con un diagnóstico
    // elementFromPoint() en el punto exacto del fallo: el link "Crear
    // factura" pasaba TODOS los chequeos de actionability de Playwright
    // (visible/enabled/stable/sin overlay ni backdrop detectado), pero
    // document.elementFromPoint() en su propio centro devolvía un link
    // "Ventas" COMPLETAMENTE DISTINTO (esElMismo=false) — dos submenús del
    // sidebar (FACTURAR y Ventas) pueden quedar renderizados superpuestos
    // en las mismas coordenadas de pantalla. El click simulado por mouse de
    // Playwright aterriza en las coordenadas (y por tanto en "Ventas", que
    // no navega a ningún lado), no en el elemento — un click nativo
    // dispara el evento directo sobre el elemento del DOM ya localizado,
    // sin depender de qué haya visualmente en esas coordenadas. Mismo
    // mecanismo que ya usa el bloque de arriba para expandir el submenú
    // (evaluate(el => parentA?.click())).
    const MAX_INTENTOS_CLICK = 3;
    let clickRealizado = false;
    for (let intento = 1; intento <= MAX_INTENTOS_CLICK && !clickRealizado; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      await this._cerrarModalMonedaSiAparece();
      await this._cerrarModalSetupInicialSiAparece();
      clickRealizado = await linkIrAPos.evaluate((el: HTMLElement) => el.click()).then(() => true).catch(() => false);
    }
    expect(clickRealizado, `El link real hacia POS no se pudo clickear tras ${MAX_INTENTOS_CLICK} intentos`).toBe(true);

    // Flujo A (aparece el modal) vs. Flujo B (la app ya navegó directo,
    // sin modal) — ambos válidos, mismo estado final. Ver el comentario del
    // método para el diseño de esta carrera (Promise.any(), no
    // Promise.race(): gana la primera en CUMPLIRSE, nunca la primera en
    // fallar).
    const resultado = await Promise.any([esperaModal, esperaNavegacionDirecta]).catch(() => null);

    if (resultado === 'modal') {
      const nombreEscapado = COMPANIA_POS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const opcionCompania = modalCompania
        .locator(L.DASHBOARD_LISTA_COMPANIAS)
        .filter({ has: this.page.locator(L.DASHBOARD_COMPANIA_NOMBRE, { hasText: new RegExp(`^\\s*${nombreEscapado}\\s*$`) }) })
        .first();
      const existe = await opcionCompania.isVisible({ timeout: TIMEOUTS.PAYMENT_MODAL }).catch(() => false);

      if (!existe) {
        // Detener con un error claro (compañía solicitada + compañías
        // realmente disponibles en este ambiente) en vez de seleccionar
        // cualquier otra por error.
        const disponibles = (await modalCompania.locator(L.DASHBOARD_COMPANIA_NOMBRE).allTextContents())
          .map((t) => t.trim())
          .filter(Boolean);
        throw new Error(
          `La compañía "${COMPANIA_POS}" (configurada vía POS_COMPANIA) no existe, con ese nombre EXACTO, en el modal de selección de este ambiente.\n` +
          `Compañías disponibles: ${disponibles.length > 0 ? disponibles.join(', ') : '(ninguna encontrada en el modal)'}`
        );
      }

      await opcionCompania.click();
      await this.page.waitForURL(/pointOfSale/, { timeout: TIMEOUTS.NAVIGATE });
    } else if (resultado === null) {
      // Ni el modal apareció ni la navegación ocurrió: falla real del
      // ambiente/automatización, no una rama válida de ningún flujo.
      throw new Error(
        `Tras hacer click en "Crear factura", ni apareció el modal de selección de compañía (${L.DASHBOARD_MODAL_SELECCIONAR_COMPANIA}) ` +
        `ni la aplicación navegó al POS dentro de ${TIMEOUTS.PAYMENT_MODAL}ms (ni Flujo A ni Flujo B ocurrieron). URL actual: ${this.page.url()}`
      );
    }
    // resultado === 'directo': Flujo B, la app ya navegó al POS — nada más
    // que hacer, mismo estado final que el Flujo A.

    // Recordar la URL REAL que la aplicación generó (nunca construida a
    // mano) para que irAlPos() pueda reutilizarla en visitas posteriores de
    // este mismo worker sin repetir el paso por Dashboard.
    posUrlResueltaPorWorker = this.page.url();
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
   *
   * Pagina con _cargarMasProductosScrolleando() —el mismo mecanismo de scroll
   * real que ya usa localizarPrimerProducto()— cuando se agotan las tarjetas
   * ya cargadas sin encontrar ninguna: investigado en vivo (catálogo
   * compartido de QA) que la tanda inicial que el grid renderiza sin pedir
   * más página ("cupo fijo", ver el comentario de L.PRODUCTO_BUSCADOR_GRID)
   * puede llenarse por completo de productos Fraccionados o "por monto"
   * generados por la propia suite, dejando productos de precio fijo reales
   * más adelante en el catálogo, fuera del alcance de un recorrido que no
   * pagina. No se delega en localizarPrimerProducto(): su `predicado` es puro
   * (solo lee metadata ya conocida) y por eso puede reevaluar sin costo todas
   * las tarjetas en cada vuelta de paginación, pero "¿este producto se agrega
   * directo o abre un modal?" no es metadata disponible de antemano (mismo
   * motivo documentado en agregarProductoDelGridAlCarrito() para el caso
   * "Monto a comprar") — solo se sabe haciendo clic, y cada clic tiene efectos
   * reales (abre/cierra un modal), así que cada tarjeta debe probarse una
   * única vez con un cursor propio, no un predicado sin efectos secundarios.
   */
  async agregarPrimerProductoDePrecioFijo() {
    await this.cerrarModalNotificacionesSiAparece();
    const productos = this.page.locator(L.PRODUCTO);
    await productos.first().waitFor({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const modalAbierto = this.page.locator(L.MODAL_ABIERTO);
    const MAX_PAGINACIONES = 20;
    let indiceInicio = 0;

    for (let paginacion = 0; paginacion <= MAX_PAGINACIONES; paginacion++) {
      const total = await productos.count();
      if (total === 0) {
        throw new Error('No hay ningún producto visible en el catálogo del POS para intentar facturar.');
      }

      for (let i = indiceInicio; i < total; i++) {
        // Se cuenta por las claves del carrito (L.CARRITO_CLAVES → #table_buy_list),
        // no por L.CARRITO_FILAS (#table_sale_pos): ese id no existe en el DOM real
        // — confirmado inspeccionando el DOM en vivo — así que su conteo siempre
        // da 0 y nunca detectaría una fila agregada.
        const clavesAntes = await this.page.locator(L.CARRITO_CLAVES).count();
        await productos.nth(i).click();

        // Un producto sin código CABYS asignado en el catálogo puede mostrar
        // primero un SweetAlert de aviso ("Artículo sin código CABYS") antes
        // de cualquier modal real — confirmado en vivo (TALLER ALPHA
        // PREMIUM) que su botón "Continuar sin CABYS" NO agrega el producto,
        // solo avanza al siguiente paso real (p. ej. el modal de variantes
        // que el chequeo de abajo ya reconoce), así que se descarta aquí
        // antes de decidir si el producto requiere interacción adicional.
        const avisoCabys = this.page.locator('.sweet-alert.visible', { hasText: 'Artículo sin código CABYS' });
        if (await avisoCabys.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false)) {
          await avisoCabys.locator('button.cancel').click();
        }

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

          // El modal de permisos de notificación puede aparecer de forma asíncrona
          // en cualquier momento y quedar físicamente encima de este botón —
          // confirmado en vivo (mismo comportamiento ya documentado en
          // abrirMenuTresPuntos()) que force:true por sí solo NO protege contra
          // esto: el navegador entrega el click al elemento que está arriba en esa
          // coordenada, no al que Playwright pretendía clickear. Por eso se cierra
          // explícitamente aquí, justo antes del click, en vez de asumir que el
          // chequeo del inicio del método (una sola vez, antes del bucle) sigue
          // siendo válido varias iteraciones después.
          await this.cerrarModalNotificacionesSiAparece();
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

      // Se agotaron las tarjetas ya cargadas sin encontrar ninguna de precio
      // fijo: pedir la siguiente página del grid (mismo gesto de scroll real
      // que _cargarMasProductosScrolleando() ya usa para localizarPrimerProducto())
      // antes de rendirse, en vez de asumir que el catálogo completo es solo
      // lo que el grid rindió sin que se le pidiera.
      indiceInicio = total;
      const hayMas = await this._cargarMasProductosScrolleando(total);
      if (!hayMas) {
        throw new Error(
          `No se encontró ningún producto de precio fijo disponible para facturar entre los ${total} productos revisados de todo el catálogo (no hay más páginas que cargar).`
        );
      }
    }

    throw new Error(
      `No se encontró ningún producto de precio fijo disponible tras ${MAX_PAGINACIONES} cargas adicionales del catálogo (posible bucle: revisar manualmente).`
    );
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
   * Cierra, en este orden, los tres overlays opcionales que el POS puede
   * mostrar tras cargar (modal de permisos de notificación, aviso de
   * consecutivo fuera de rango, y cualquier toast "noty" restante). Ninguno
   * de los tres es parte del flujo de negocio bajo prueba; su ausencia es
   * igual de válida que su aparición. Centralizado aquí: esta misma
   * secuencia de 3 llamadas, en este mismo orden, estaba duplicada de forma
   * idéntica en la mayoría de los tests de la suite tras cargar el POS.
   */
  async cerrarOverlaysConocidos() {
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarAvisoConsecutivoSiAparece();
    await this.cerrarTodosLosToastsSiAparecen();
  }


  /**
   * Muestra la ventana de impresión de la factura (señal de que se generó
   * correctamente) 4 segundos y la cierra para volver al POS.
   *
   * Intenta confirmar que la ventana realmente tenga contenido: espera (sin
   * timeout fijo bloqueante, acotado y no obligatorio) a que su URL deje de
   * ser about:blank. Confirmado en vivo (HONDURAS) que el popup puede abrir
   * en about:blank y navegar al contenido real un instante después de
   * `domcontentloaded` — por eso esta comprobación es best-effort (con
   * `.catch(() => {})`, solo deja evidencia en el log) y nunca hace fallar
   * el test: la señal real y ya validada de éxito es que el popup se abrió
   * en absoluto (evento "popup" capturado por la carrera en
   * `_armarCarreraFacturacion`), no el contenido final de su URL.
   */
  async mostrarYCerrarVentanaImpresion(printPage: Page) {
    await printPage.waitForLoadState('domcontentloaded');
    await expect
      .poll(() => printPage.url(), { timeout: 5_000 })
      .not.toBe('about:blank')
      .catch(() => console.log('[mostrarYCerrarVentanaImpresion] La ventana de impresión permaneció en about:blank — se continúa igual (no bloqueante).'));
    await this.page.waitForTimeout(PAUSES.VER_FACTURA);
    await printPage.close();
    await this.page.waitForTimeout(PAUSES.POST_CIERRE);
  }


  /**
   * Escribe en el buscador real del grid del POS (`#product_search`) y
   * presiona Enter, disparando una consulta real al backend
   * (getPosProductSearch) — necesario para encontrar productos recién
   * creados cuya posición alfabética los deja fuera del cupo fijo que
   * muestra la vista por defecto de una categoría (confirmado en vivo: ver
   * el comentario de L.PRODUCTO_BUSCADOR_GRID). Sin esto, productoPorNombre()
   * podría no encontrar NUNCA un producto que sí existe.
   *
   * Mismo input reutilizado por buscarOrdenesCajaPorTexto(): persiste en el
   * header del POS sin importar el tab activo, y dispara un backend distinto
   * (getPosCashSearch) cuando "Órdenes de caja" está activa en vez del grid.
   */
  async buscarProductoEnGrid(termino: string) {
    const buscador = this.page.locator(L.PRODUCTO_BUSCADOR_GRID);
    await buscador.fill(termino);
    await buscador.press('Enter');
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


  /**
   * Agrega al carrito un producto Fraccionado identificado por su nombre
   * exacto. A diferencia de un producto simple, clickearlo abre el modal
   * "Seleccionar Cantidad" (`#dialog_product_fragmented_quantity_view`, NO
   * aparece para productos sin fraccionar — confirmado en vivo) pidiendo
   * cuántas cajas completas y cuántas fracciones sueltas agregar; hay que
   * completarlo y confirmar con "Agregar" para que el producto realmente
   * entre al carrito.
   *
   * El click se hace vía evaluate() (DOM nativo), no `locator.click()`:
   * confirmado en vivo que ese modal aparece como efecto INMEDIATO del
   * click, y el propio chequeo de estabilidad de Playwright después de
   * clickear detecta el modal recién abierto tapando el mismo elemento,
   * reintentando el click indefinidamente sin nunca darlo por exitoso —
   * mismo motivo por el que "Crear Combo" ya clickea sus resultados de
   * búsqueda vía evaluate() en vez de un click normal.
   */
  async agregarProductoFraccionadoPorNombre(nombre: string, cantidadFracciones: string) {
    const producto = this.productoPorNombre(nombre);
    await expect(producto, `No se encontró exactamente un producto llamado "${nombre}" en el catálogo`).toHaveCount(1, { timeout: TIMEOUTS.PRODUCTS_LOAD });
    await this.page.waitForTimeout(PAUSES.VER_PRODUCTOS);
    await producto.evaluate((el: HTMLElement) => el.click());

    await expect(
      this.page.locator(L.DIALOG_CANTIDAD_FRACCIONADA),
      'El modal "Seleccionar Cantidad" no apareció tras clickear el producto Fraccionado'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.page.locator(L.PRODUCTO_FRACCIONADO_CANTIDAD_FRACCIONES).fill(cantidadFracciones);
    await this.page.locator(L.PRODUCTO_FRACCIONADO_BTN_AGREGAR).click();
    await expect(this.page.locator(L.DIALOG_CANTIDAD_FRACCIONADA)).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.page.waitForTimeout(PAUSES.VER_CARRITO);
  }


  /** Devuelve las claves únicas de los productos actualmente en el carrito. */
  async obtenerClavesProductos(): Promise<string[]> {
    return this.page.evaluate(() =>
      [...document.querySelectorAll('#table_buy_list p[id^="drag_and_drop_"]')]
        .map(el => el.id.replace('drag_and_drop_', ''))
    );
  }


  /**
   * Devuelve las claves de TODAS las filas actualmente en el carrito
   * (`#table_buy_list tr.main_row[id^="table_product_name_"]`) — a
   * diferencia de obtenerClavesProductos() (que solo cuenta filas con id
   * "drag_and_drop_", presente únicamente en líneas agregadas directo del
   * catálogo), esta también cubre las líneas IMPORTADAS de una Orden de
   * Caja/factura: confirmado en vivo que esas filas NO tienen ningún id
   * "drag_and_drop_" (dejando obtenerClavesProductos() en 0 pese a tener
   * líneas reales), pero SÍ comparten con las agregadas del catálogo el
   * mismo patrón `id="table_product_name_<clave>"` en su `<tr>`. Fuente
   * confiable para operar sobre cualquier carrito sin importar su origen —
   * útil junto con eliminarProductoDelCarrito()/obtenerDatosLineaCarrito(),
   * que sí funcionan igual para ambos tipos de fila.
   */
  async obtenerClavesFilasCarrito(): Promise<string[]> {
    return this.page.evaluate(() =>
      [...document.querySelectorAll('#table_buy_list tr.main_row[id^="table_product_name_"]')]
        .map(el => el.id.replace('table_product_name_', ''))
    );
  }


  // ─── Localización de productos por característica funcional (sin nombres) ──
  //
  // Ninguno de los métodos de esta sección busca un producto por nombre,
  // código ni categoría: todos leen argumentos reales de add_to_table() (ver
  // el comentario de MetadatoProducto) para decidir qué tarjeta cumple la
  // característica pedida, así que funcionan sin importar cómo se llamen los
  // productos del catálogo del ambiente donde corra la suite.

  /**
   * Parsea el onclick="add_to_table(...)" de cada tarjeta actualmente
   * cargada usando el propio motor JS del navegador (`new Function`), no un
   * regex: los nombres de producto pueden traer comillas, backslashes y
   * otros caracteres que un regex tendría que escapar caso por caso
   * (confirmado en vivo con un producto de prueba cuyo nombre es únicamente
   * símbolos) — el intérprete real de JS los maneja sin ambigüedad. Se
   * sobreescribe temporalmente `window.add_to_table` para CAPTURAR los
   * argumentos sin ejecutar sus efectos secundarios reales (no agrega nada
   * al carrito, no dispara ningún AJAX).
   *
   * También se captura el texto VISIBLE de cada tarjeta (`textContent`),
   * por separado del argumento `name` ya capturado: confirmado en vivo que
   * para nombres con backslashes ambos DIFIEREN (el name capturado ya pasó
   * por el des-escapado de cadenas de JS al ejecutar el onclick, mientras
   * que el texto visible es HTML plano, sin ese des-escapado — un producto
   * de prueba real con backslashes en el nombre expuso esto: 4 backslashes
   * en el texto visible contra 2 en el argumento). `productoPorNombre()` y
   * el resto de la suite que busca "por nombre" comparan contra el texto
   * VISIBLE, así que `MetadatoProducto.nombre` debe ser ese mismo texto —
   * de lo contrario, un producto localizado aquí podría no encontrarse
   * nunca al buscarlo luego por su propio nombre.
   *
   * Excepción confirmada en vivo (Vista Lista): el elemento que trae el
   * onclick="add_to_table(...)" real ahí es la celda de la imagen del
   * producto (td[id^="product_table_click_event_"]), que no tiene texto
   * propio — el nombre visible vive en una celda hermana, fuera de este
   * elemento. Cuando el textContent viene vacío se usa el argumento `name`
   * ya capturado como único valor disponible; en Vista Cuadrícula el texto
   * visible jamás llega vacío, así que esta rama no se activa ahí y no
   * reintroduce el problema de backslashes ya documentado arriba.
   */
  async _extraerArgumentosAddToTable(): Promise<{ args: (string | number)[] | null; textoVisible: string }[]> {
    return this.page.evaluate((selector) => {
      const cards = [...document.querySelectorAll(selector)];
      const original = (window as any).add_to_table;
      const out: any[] = [];
      cards.forEach((el) => {
        let textoVisible = (el.textContent || '').trim();
        const onclick = el.getAttribute('onclick') || '';
        if (!onclick.trim().startsWith('add_to_table')) { out.push({ args: null, textoVisible }); return; }
        let capturados: any[] | null = null;
        (window as any).add_to_table = (...args: any[]) => { capturados = args; };
        try { new Function(onclick)(); } catch { /* tarjeta con un onclick inesperado: se descarta */ }
        if (!textoVisible && capturados) textoVisible = String(capturados[1] ?? '').trim();
        out.push({ args: capturados, textoVisible });
      });
      (window as any).add_to_table = original;
      return out;
    }, L.PRODUCTO);
  }


  /**
   * Devuelve los metadatos funcionales de todas las tarjetas de producto
   * actualmente cargadas en el grid (la categoría/tab que esté activa en
   * este momento), en el mismo orden que `this.page.locator(L.PRODUCTO)`.
   */
  async obtenerMetadatosProductosVisibles(): Promise<MetadatoProducto[]> {
    const crudos = await this._extraerArgumentosAddToTable();
    const productos = this.page.locator(L.PRODUCTO);
    const metadatos: MetadatoProducto[] = [];
    crudos.forEach(({ args, textoVisible }, indice) => {
      if (!args) return;
      const [id, , precio, , cantidad, aplicaIva, tipoItem, , , esFraccionado] = args;
      metadatos.push({
        indice,
        locator: productos.nth(indice),
        id: String(id),
        nombre: textoVisible,
        precio: parseFloat(String(precio)),
        cantidadDisponible: parseFloat(String(cantidad)),
        aplicaIva: String(aplicaIva) === '1',
        tipoItem: parseInt(String(tipoItem), 10),
        esFraccionado: String(esFraccionado) === '1',
      });
    });
    return metadatos;
  }


  /**
   * Dispara la paginación real del grid (Vista Cuadrícula, estilo activo por
   * defecto): lleva el scroll de GRID_SCROLL_CONTENEDOR al final y despacha
   * un evento "scroll" real, el mismo gesto que bindProductBoxScroll() en
   * pos.js escucha para pedir la siguiente página (search_product(1) /
   * search_service(1), según el tab activo). Devuelve false cuando la
   * cantidad de tarjetas no creció tras el intento — señal de que el
   * catálogo ya está completo — para que quien llama deje de insistir.
   */
  async _cargarMasProductosScrolleando(cantidadAntes: number): Promise<boolean> {
    const contenedor = this.page.locator(L.GRID_SCROLL_CONTENEDOR);
    await contenedor.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });
    return expect.poll(
      async () => this.page.locator(L.PRODUCTO).count(),
      { timeout: 5_000 }
    ).toBeGreaterThan(cantidadAntes).then(() => true).catch(() => false);
  }


  /**
   * Localiza el primer producto (en el grid/tab actualmente activo) que
   * cumpla `predicado`, paginando con scroll real cuantas veces haga falta
   * — nunca buscando por nombre ni cambiando de categoría. Falla con un
   * mensaje explícito, indicando cuántas tarjetas se llegaron a revisar, si
   * el catálogo entero (ya sin más páginas que cargar) no tiene ninguna que
   * cumpla la condición.
   */
  async localizarPrimerProducto(
    predicado: (metadato: MetadatoProducto) => boolean,
    descripcion: string
  ): Promise<MetadatoProducto> {
    const MAX_PAGINACIONES = 20;
    for (let intento = 0; intento <= MAX_PAGINACIONES; intento++) {
      const metadatos = await this.obtenerMetadatosProductosVisibles();
      const encontrado = metadatos.find(predicado);
      if (encontrado) return encontrado;

      const hayMas = await this._cargarMasProductosScrolleando(metadatos.length);
      if (!hayMas) {
        throw new Error(
          `No se encontró ningún producto que cumpla "${descripcion}" tras revisar ` +
          `las ${metadatos.length} tarjetas de todo el catálogo visible (no hay más ` +
          'páginas que cargar). Se requiere al menos un producto con esa característica ' +
          'en el ambiente de prueba — este helper no crea uno automáticamente.'
        );
      }
    }
    throw new Error(
      `No se encontró ningún producto que cumpla "${descripcion}" tras ${MAX_PAGINACIONES} ` +
      'cargas adicionales del catálogo (posible bucle: revisar manualmente).'
    );
  }


  /** Primer producto normal: item_type=1 (no servicio) y no Fraccionado. */
  async obtenerPrimerProductoNormal(): Promise<MetadatoProducto> {
    return this.localizarPrimerProducto(
      (m) => m.tipoItem === 1 && !m.esFraccionado,
      'producto normal (no fraccionado, no servicio)'
    );
  }


  /**
   * Primer producto normal que además tenga un código interno asignado
   * (`input_hide_product_code_<id>` no vacío) — requisito real del buscador
   * interno de Vista Expandida, que filtra por código y no por nombre.
   * Confirmado en vivo (TALLER ALPHA PREMIUM) que no todos los productos
   * normales del catálogo tienen código asignado: `obtenerPrimerProductoNormal()`
   * puede devolver válidamente uno sin código (dato del catálogo, no un
   * bug), lo que deja el buscador interno con un valor vacío y el resto del
   * flujo nunca progresa. No se puede resolver con el `predicado` síncrono
   * de `localizarPrimerProducto()` porque el código vive en un input fuera
   * de los argumentos de `add_to_table(...)` que alimentan los metadatos, así
   * que aquí se pagina y se comprueba cada candidato con el propio
   * `obtenerCodigoProducto()`.
   */
  async obtenerPrimerProductoNormalConCodigo(): Promise<{ producto: MetadatoProducto; codigo: string }> {
    const MAX_PAGINACIONES = 20;
    let indiceInicio = 0;

    for (let paginacion = 0; paginacion <= MAX_PAGINACIONES; paginacion++) {
      const metadatos = await this.obtenerMetadatosProductosVisibles();

      for (let i = indiceInicio; i < metadatos.length; i++) {
        const producto = metadatos[i];
        if (producto.tipoItem !== 1 || producto.esFraccionado) continue;

        const codigo = await this.obtenerCodigoProducto(producto.nombre).catch(() => '');
        if (codigo) return { producto, codigo };
      }

      indiceInicio = metadatos.length;
      const hayMas = await this._cargarMasProductosScrolleando(metadatos.length);
      if (!hayMas) {
        throw new Error(
          `No se encontró ningún producto normal con código interno asignado tras revisar las ` +
          `${metadatos.length} tarjetas de todo el catálogo visible (no hay más páginas que cargar). ` +
          'Se requiere al menos un producto normal con código no vacío en el ambiente de prueba.'
        );
      }
    }

    throw new Error(
      `No se encontró ningún producto normal con código tras ${MAX_PAGINACIONES} cargas adicionales ` +
      'del catálogo (posible bucle: revisar manualmente).'
    );
  }


  /**
   * Variante de obtenerPrimerProductoNormalConCodigo() que además exige que
   * el producto NO esté ya presente en el carrito (mismo motivo que
   * obtenerPrimerProductoNoPresenteEnCarrito(): add_to_table() solo suma
   * cantidad a la línea existente en vez de crear una nueva si el producto
   * ya está en el carrito). Necesaria para agregar un "producto normal" con
   * Vista Expandida activa (el buscador interno de esa vista filtra por
   * código, no por nombre — ver agregarProductoPorCodigoEnVistaExpandida()),
   * evitando repetir ambos filtros por separado.
   */
  async obtenerPrimerProductoNormalConCodigoNoPresenteEnCarrito(): Promise<{ producto: MetadatoProducto; codigo: string }> {
    const MAX_PAGINACIONES = 20;
    let indiceInicio = 0;
    const textoCarrito = await this.obtenerTextoCarrito();

    for (let paginacion = 0; paginacion <= MAX_PAGINACIONES; paginacion++) {
      const metadatos = await this.obtenerMetadatosProductosVisibles();

      for (let i = indiceInicio; i < metadatos.length; i++) {
        const producto = metadatos[i];
        if (producto.tipoItem !== 1 || producto.esFraccionado) continue;
        if (this.nombreApareceEnCarrito(producto.nombre, textoCarrito)) continue;

        const codigo = await this.obtenerCodigoProducto(producto.nombre).catch(() => '');
        if (codigo) return { producto, codigo };
      }

      indiceInicio = metadatos.length;
      const hayMas = await this._cargarMasProductosScrolleando(metadatos.length);
      if (!hayMas) {
        throw new Error(
          `No se encontró ningún producto normal con código interno, ausente del carrito, tras revisar las ` +
          `${metadatos.length} tarjetas de todo el catálogo visible (no hay más páginas que cargar). ` +
          'Se requiere al menos un producto normal con código no vacío y no repetido en el ambiente de prueba.'
        );
      }
    }

    throw new Error(
      `No se encontró ningún producto normal con código, ausente del carrito, tras ${MAX_PAGINACIONES} ` +
      'cargas adicionales del catálogo (posible bucle: revisar manualmente).'
    );
  }


  /**
   * Segundo producto normal, distinto del ya localizado por
   * `obtenerPrimerProductoNormal()` — para escenarios que necesitan dos
   * líneas de producto real y diferente en el carrito (p. ej. descuento
   * individual por línea), sin depender de dos nombres fijos del catálogo.
   */
  async obtenerSegundoProductoNormalDistinto(nombrePrimero: string): Promise<MetadatoProducto> {
    return this.localizarPrimerProducto(
      (m) => m.tipoItem === 1 && !m.esFraccionado && m.nombre !== nombrePrimero,
      `un segundo producto normal distinto de "${nombrePrimero}"`
    );
  }


  /** Primer Producto Fraccionado (is_fragmented=1), sin importar su nombre ni su categoría. */
  async obtenerPrimerProductoFraccionado(): Promise<MetadatoProducto> {
    return this.localizarPrimerProducto((m) => m.esFraccionado, 'producto Fraccionado');
  }


  /** Primer producto (no servicio) con IVA aplicado (apply_iva=1). */
  async obtenerPrimerProductoConIva(): Promise<MetadatoProducto> {
    return this.localizarPrimerProducto((m) => m.tipoItem === 1 && m.aplicaIva, 'producto con IVA');
  }


  /** Primer producto (no servicio) sin IVA aplicado (apply_iva=0). */
  async obtenerPrimerProductoSinIva(): Promise<MetadatoProducto> {
    return this.localizarPrimerProducto((m) => m.tipoItem === 1 && !m.aplicaIva, 'producto sin IVA');
  }


  /** Primer producto (no servicio) con inventario disponible real (cantidad > 0). */
  async obtenerPrimerProductoConInventario(): Promise<MetadatoProducto> {
    return this.localizarPrimerProducto(
      (m) => m.tipoItem === 1 && m.cantidadDisponible > 0,
      'producto con inventario disponible'
    );
  }


  /**
   * Primer servicio del tab "Servicios" (item_type=2). Cambia a ese tab si
   * no está ya activo — idempotente, seguro de llamar aunque el test ya
   * haya hecho el cambio explícitamente antes.
   */
  async obtenerPrimerServicio(): Promise<MetadatoProducto> {
    if (!(await this.tabEstaActivo(this.tabServicios))) {
      await this.tabServicios.click();
      await expect.poll(() => this.tabEstaActivo(this.tabServicios), { timeout: TIMEOUTS.PRODUCTS_LOAD }).toBe(true);
    }
    return this.localizarPrimerProducto((m) => m.tipoItem === 2, 'servicio');
  }


  /**
   * Localiza el primer combo YA EXISTENTE en el catálogo compartido
   * (categoría "Combos"), sin crear ninguno nuevo — a diferencia de
   * crearComboConIva()/crearComboSinIva() + buscarComboYAgregarAlCarrito(nombre),
   * que sí crean un combo (wizard "Crear Combo"): ese flujo queda fuera del
   * alcance de escenarios que solo necesitan usar un combo ya disponible.
   * Confirmado en vivo que una tarjeta de combo en ese grid es funcionalmente
   * idéntica a un producto normal — mismo onclick="add_to_table(...)", mismo
   * item_type=1, mismo mecanismo de carrito (id "drag_and_drop_") — sin
   * ningún modal ni confirmación adicional propia de "ser combo"; el único
   * caso especial que podría disparar sigue siendo el genérico "Monto a
   * comprar" que cualquier producto normal ya puede disparar (de ahí que se
   * agregue con agregarProductoDelGridAlCarrito(), no
   * agregarProductoAlCarrito()). Reutiliza localizarPrimerProducto() —mismo
   * criterio "primera opción disponible", con paginación real por scroll—
   * en vez de buscarComboYAgregarAlCarrito(), que exige conocer el nombre de
   * antemano (solo tiene sentido para un combo recién creado por el propio
   * test).
   */
  async obtenerPrimerCombo(): Promise<MetadatoProducto> {
    if (!(await this.categoriaEstaActiva(this.categoriaCombos))) {
      await this.categoriaCombos.click();
      await esperarQuedaActivo(() => this.categoriaEstaActiva(this.categoriaCombos));
    }
    return this.localizarPrimerProducto(() => true, 'combo existente en la categoría "Combos"');
  }


  /**
   * Agrega al carrito un producto ya localizado por cualquiera de los
   * métodos `obtenerPrimer...` de esta sección (excepto el Fraccionado, que
   * necesita completar el modal "Seleccionar Cantidad" — ver
   * `agregarProductoFraccionadoAlCarrito`). Devuelve la clave de la línea
   * agregada.
   */
  async agregarProductoAlCarrito(metadato: MetadatoProducto): Promise<string> {
    const clavesAntes = await this.obtenerClavesProductos();
    await metadato.locator.click();
    await expect.poll(
      async () => (await this.obtenerClavesProductos()).length,
      { timeout: TIMEOUTS.PRODUCTS_LOAD }
    ).toBeGreaterThan(clavesAntes.length);
    const clavesDespues = await this.obtenerClavesProductos();
    return clavesDespues.find((c) => !clavesAntes.includes(c))!;
  }


  /**
   * Agrega al carrito un producto Fraccionado ya localizado con
   * `obtenerPrimerProductoFraccionado()`, completando el modal "Seleccionar
   * Cantidad" que ese tipo de producto siempre abre — mismo comportamiento
   * ya documentado en `agregarProductoFraccionadoPorNombre` (click vía
   * evaluate(), no locator.click(), por la misma condición de carrera con
   * el modal recién abierto).
   */
  async agregarProductoFraccionadoAlCarrito(metadato: MetadatoProducto, cantidadFracciones = '1'): Promise<string> {
    const clavesAntes = await this.obtenerClavesProductos();
    await metadato.locator.evaluate((el: HTMLElement) => el.click());

    await expect(
      this.page.locator(L.DIALOG_CANTIDAD_FRACCIONADA),
      'El modal "Seleccionar Cantidad" no apareció tras clickear el producto Fraccionado'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.page.locator(L.PRODUCTO_FRACCIONADO_CANTIDAD_FRACCIONES).fill(cantidadFracciones);
    await this.page.locator(L.PRODUCTO_FRACCIONADO_BTN_AGREGAR).click();
    await expect(this.page.locator(L.DIALOG_CANTIDAD_FRACCIONADA)).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await expect.poll(
      async () => (await this.obtenerClavesProductos()).length,
      { timeout: TIMEOUTS.PRODUCTS_LOAD }
    ).toBeGreaterThan(clavesAntes.length);
    const clavesDespues = await this.obtenerClavesProductos();
    return clavesDespues.find((c) => !clavesAntes.includes(c))!;
  }


  /**
   * Agrega al carrito un producto del grid ya localizado con cualquiera de los
   * métodos `obtenerPrimer.../obtenerSegundo...` (obtenerPrimerProductoNormal(),
   * obtenerSegundoProductoNormalDistinto(), obtenerPrimerServicio(), etc.),
   * manejando el modal "Monto a comprar" (ver L.DIALOG_MONTO_A_COMPRAR) si el
   * click lo dispara en vez de agregar la línea directamente.
   *
   * Investigado en vivo (código fuente de pos.js + DOM real del modal, no
   * asumido — ver el comentario de L.DIALOG_MONTO_A_COMPRAR): a diferencia del
   * caso Fraccionado (esFraccionado, ya filtrado por localizarPrimerProducto()
   * antes de llegar aquí), este caso NO es detectable de antemano desde
   * MetadatoProducto, así que no se puede evitar eligiendo otro producto —
   * solo se sabe si aparece después del click. Confirmado en vivo con un
   * producto real de este catálogo (cantidadDisponible fraccionaria, ej.
   * 5.8571 — consistente con un producto que se vende "por monto"/peso, no por
   * unidad entera) que el modal SÍ puede abrir incluso sin los inputs ocultos
   * de "vehicle product" (is_vehicle_product/vehicle_info) que documenta
   * setVehicleProductItemModal() en pos.js: esa función es UN camino
   * confirmado hacia este mismo modal, pero no el único — de ahí que la
   * espera de abajo no pueda acotarse a "solo si es vehicle product". Por eso
   * este método existe aparte de agregarProductoAlCarrito(): en vez de asumir
   * que el click siempre agrega la línea directo (lo que
   * agregarProductoAlCarrito() sí asume, y seguirá asumiendo para no alterar
   * su contrato en el resto de la suite), aquí se espera a que el modal
   * aparezca y, si lo hace, se completa con el monto indicado antes de
   * continuar — nunca se descarta el producto ni se falla de inmediato.
   *
   * La espera del modal usa TIMEOUTS.PAYMENT_MODAL (no un timeout corto
   * arbitrario): confirmado en vivo que un timeout de solo 3 s puede fallar
   * en detectarlo bajo carga (headed/con trace) — el modal SÍ termina
   * abriendo, pero después de que el chequeo ya dio por hecho que no
   * aparecería, dejando el resto del método esperando indefinidamente una
   * clave que nunca llega porque el modal quedó abierto sin confirmar.
   */
  async agregarProductoDelGridAlCarrito(metadato: MetadatoProducto, montoSiEsPorMonto = PRECIO_PRODUCTO_RAPIDO): Promise<string> {
    const clavesAntes = await this.obtenerClavesProductos();
    const modalMontoACompra = this.page.locator(L.DIALOG_MONTO_A_COMPRAR);

    await metadato.locator.click();

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
      async () => (await this.obtenerClavesProductos()).length,
      { timeout: TIMEOUTS.PRODUCTS_LOAD }
    ).toBeGreaterThan(clavesAntes.length);
    const clavesDespues = await this.obtenerClavesProductos();
    return clavesDespues.find((c) => !clavesAntes.includes(c))!;
  }


  /**
   * Elimina del carrito la línea identificada por `clave` (botón "papelera"
   * de su fila) — sin SweetAlert de confirmación ni AJAX que esperar: el
   * recálculo de totales es 100% client-side, confirmado en vivo
   * interceptando la red (ninguna petición a "remove"/"delete" se disparó).
   * Funciona igual para líneas agregadas directo del catálogo
   * (`remove_from_list`) y para líneas importadas de una Orden de
   * Caja/factura (`remove_from_order_list`) — ambas comparten la misma
   * columna `.btns_product_<clave>` y el mismo texto de onclick
   * "remove_from", así que un solo selector cubre ambos casos sin
   * duplicar lógica. La condición real de éxito es que la fila
   * (`#table_product_name_<clave>`) quede desprendida del DOM.
   */
  async eliminarProductoDelCarrito(clave: string) {
    await this.page.locator(`.btns_product_${clave} button[onclick*="remove_from"]`).click();
    await this.page.locator(`#table_product_name_${clave}`).waitFor({ state: 'detached', timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Agrega una observación a una línea específica del carrito: abre el
   * modal "Observaciones" de esa línea (botón `#product_item_comment_<clave>`
   * de su fila), usa su propio formulario de alta ("+" → textarea → Guardar)
   * en vez de aplicar una ya existente de la biblioteca — confirmado en vivo
   * que "Guardar" cierra el modal solo y deja el texto EXACTO (sin
   * transformar) en `product_hide_item_observation_<clave>`.
   */
  async agregarObservacionAProducto(clave: string, texto: string) {
    await this.page.locator(`#product_item_comment_${clave}`).click();
    const dialog = this.page.locator(L.DIALOG_COMENTARIO_PRODUCTO);
    await expect(dialog, 'El modal "Observaciones" no se abrió').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // Reintento acotado en el click de "+": confirmado en vivo que puede no
    // revelar el formulario al primer intento (mismo criterio de
    // resiliencia ya usado en alternarVistaExpandida() para UI
    // intermitente) — sin esto, el textarea podía quedar esperando su
    // timeout completo sin aparecer nunca.
    const textarea = this.page.locator(L.COMENTARIO_PRODUCTO_TEXTAREA);
    const MAX_INTENTOS = 3;
    let formularioVisible = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !formularioVisible; intento++) {
      await this.page.locator(L.COMENTARIO_PRODUCTO_BTN_NUEVO).click();
      formularioVisible = await textarea.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false);
    }
    expect(formularioVisible, 'El formulario para agregar una nueva observación no apareció').toBe(true);
    await textarea.fill(texto);

    await this.page.locator(L.COMENTARIO_PRODUCTO_BTN_GUARDAR).click();
    await expect(dialog, 'El modal "Observaciones" no se cerró tras Guardar').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Lee la observación actualmente guardada en una línea del carrito —
   * directo del hidden input `product_hide_item_observation_<clave>`, la
   * única fuente real (no hay ningún texto visible de la observación en la
   * fila del carrito).
   */
  async obtenerObservacionDeProducto(clave: string): Promise<string> {
    return this.page.locator(`#product_hide_item_observation_${clave}`).inputValue();
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
    return this._leerMontoDeTexto(texto);
  }


  /** Lee el total final de venta como número (sí refleja descuentos individuales). */
  async obtenerTotalVentaNumerico(): Promise<number> {
    const texto = await this.page.evaluate(
      (id) => document.getElementById(id)?.textContent ?? '$0.00',
      L.TOTAL_MODAL
    );
    return this._leerMontoDeTexto(texto);
  }


  // ─── Categorías (barra lateral) ────────────────────────────────────────────

  get categoriaTodos() { return this.page.locator(L.CAT_TODOS); }

  get categoriaCombos() { return this.page.locator(L.CAT_COMBOS); }


  /**
   * Categoría de producto normal localizada por su nombre real
   * (`data-category-name`, confirmado en vivo que coincide exactamente con
   * el nombre visible) — nunca por id numérico, que es un dato propio de
   * cada compañía. Puede no existir en absoluto en una compañía que no
   * tenga creada una categoría con ese nombre (confirmado en vivo: TALLER
   * ALPHA PREMIUM no tiene "Categoría", "Productos variantes" ni "Productos
   * fraccionados" entre sus categorías reales) — el locator resuelve a
   * count=0 en ese caso, quien llama decide si es válido saltarla.
   */
  categoriaOpcionalPorNombre(nombre: string): Locator {
    return this.page.locator(`[data-category-name="${nombre}"]`);
  }


  get categoriaTipo() { return this.categoriaOpcionalPorNombre('Categoría'); }

  get categoriaProductosFraccionados() { return this.categoriaOpcionalPorNombre('Productos fraccionados'); }

  get categoriaProductosVariantes() { return this.categoriaOpcionalPorNombre('Productos variantes'); }


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
    // Timeout explícito (antes ausente): mismo patrón/causa raíz ya
    // confirmado en vivo repetidas veces en esta suite — getAttribute() sin
    // `timeout` usa el default de acción de Playwright (0 = sin límite en
    // este proyecto), así que si el botón de vista tarda en adjuntarse este
    // await queda colgado hasta el timeout del test COMPLETO.
    const clase = await boton.getAttribute('class', { timeout: TIMEOUTS.PAYMENT_MODAL }).catch(() => null);
    return clase?.includes(L.VISTA_ACTIVE_CLASS) ?? false;
  }


  /** Lee el estilo de vista inicial reportado por el propio sistema: "list" o "box". */
  async estiloVistaTexto(): Promise<string> {
    return (await this.page.locator(L.VISTA_ESTILO_ACTUAL).textContent())?.trim() ?? '';
  }


  // ─── Tabs Servicios / End. Pintura ────────────────────────────────────────

  get tabProductos() { return this.page.locator(L.TAB_PRODUCTOS); }

  get tabServicios() { return this.page.locator(L.TAB_SERVICIOS); }

  get tabPintura() { return this.page.locator(L.TAB_PINTURA); }


  /** Indica si el tab dado (Productos/Servicios/End. Pintura) está activo (clase "btn_sale_selected"). */
  async tabEstaActivo(tab: Locator): Promise<boolean> {
    // Timeout explícito (antes ausente): mismo patrón/causa raíz ya
    // confirmado en vivo repetidas veces en esta suite. Usado dentro de
    // expect.poll() en varios escenarios (agregarCincoTiposDeItem(),
    // agregarServicioDeEndPintura()) — si esta única invocación del
    // predicado queda colgada esperando el elemento, expect.poll() nunca
    // llega a evaluar un segundo intento ni a que su propio timeout la
    // rescate, porque la promesa de la primera invocación nunca se resuelve.
    const clase = await tab.getAttribute('class', { timeout: TIMEOUTS.PAYMENT_MODAL }).catch(() => null);
    return clase?.includes(L.TAB_ACTIVE_CLASS) ?? false;
  }


  // ─── "Producto Rápido" ──────────────────────────────────────────────────────

  /** Locator del modal "Producto Rápido". */
  get modalProductoRapido() {
    return this.page.locator(L.DIALOG_PRODUCTO_RAPIDO);
  }


  /** Locator del sub-modal "Búsqueda de código CABYS". */
  get modalBusquedaCabys() {
    return this.page.locator(L.DIALOG_BUSCAR_CABYS);
  }


  /**
   * Expande el botón flotante (FAB) del POS y abre el modal "Producto
   * Rápido". El toggle es un componente "mfb" cuya animación de expansión
   * a veces no llega a tiempo con un único click —confirmado en vivo—, así
   * que se reintenta hasta que el ítem hijo ("Producto Rápido") se vuelva
   * realmente visible antes de clickearlo.
   */
  async abrirProductoRapido() {
    const toggle = this.page.locator(L.FAB_TOGGLE);
    const item = this.page.locator(L.FAB_ITEM_PRODUCTO_RAPIDO);

    // El toggle expande el FAB con data-mfb-toggle="hover" — confirmado en vivo
    // que puede volver a colapsarse entre que se confirma expandido y el click
    // sobre el ítem, si de por medio se ejecuta otra acción (p. ej. revisar el
    // modal de notificaciones) que mueve el mouse y pierde el estado "hover".
    // Por eso el click sobre el ítem se hace en la MISMA vuelta, inmediatamente
    // después de confirmarlo expandido, y todo el ciclo (expandir + click +
    // confirmar que el modal abrió) se reintenta como una unidad si algo falla.
    const MAX_INTENTOS = 10;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      // Timeout explícito (antes ausente): mismo patrón/causa raíz ya
      // confirmado en vivo en otros puntos de la suite — click({force:true})
      // sigue esperando (sin límite en este proyecto) a que el locator
      // resuelva al menos un elemento antes de intentar el click, incluso
      // con force. Si el FAB no está disponible en este estado concreto de
      // la UI, un solo intento sin timeout consume el presupuesto COMPLETO
      // del test (confirmado en vivo: el bucle nunca llegó a un segundo
      // intento, agotando los 5 minutos en esta única línea) — anulando por
      // completo el diseño de reintentos acotados de este bucle.
      await toggle.click({ force: true, timeout: 3_000 }).catch(() => {});

      const expandido = await item.waitFor({ state: 'visible', timeout: 1_200 }).then(() => true).catch(() => false);
      if (expandido) {
        const clickeado = await item.click({ force: true, timeout: 2_000 }).then(() => true).catch(() => false);
        if (clickeado) {
          const abrio = await this.modalProductoRapido.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false);
          if (abrio) return;
        }
      }

      await this.page.waitForTimeout(300);
    }

    throw new Error(`El botón flotante "Producto Rápido" no se pudo abrir tras ${MAX_INTENTOS} intentos.`);
  }


  /** Llena nombre y precio en el formulario de "Producto Rápido" ya abierto. */
  async llenarDatosBasicosProductoRapido(nombre: string, precio: string) {
    await this.page.locator(L.QUICK_PRODUCT_NOMBRE).fill(nombre);
    await this.page.locator(L.QUICK_PRODUCT_PRECIO).fill(precio);
  }


  /**
   * Indica si el botón CABYS está presente en este momento del formulario
   * indicado (por defecto, el de "Producto Rápido"; "Crear Combo" pasa
   * `configCabysCombo.boton`). No es un dato fijo: depende del país
   * configurado para la compañía en este ambiente compartido de QA
   * (confirmado en vivo pasando de visible/obligatorio con la compañía
   * configurada como Costa Rica, a oculto con la misma compañía luego
   * reconfigurada como Honduras, sin ningún cambio de este lado) — de ahí que
   * este chequeo se haga en cada corrida en vez de asumir un estado fijo.
   */
  async existeCampoCabys(boton: Locator = this.page.locator(L.QUICK_PRODUCT_BTN_CABYS)): Promise<boolean> {
    return boton.isVisible().catch(() => false);
  }


  /**
   * Completa el CABYS únicamente si el botón aparece en el formulario dado;
   * si no aparece, no lo toca. Devuelve si lo aplicó o no, para que quien
   * llama decida el resto del flujo de IVA en consecuencia (ver
   * validarIvaCoincideConCabys() para el caso "aplicado" y
   * seleccionarIvaManualmente() para el caso "no aplicado"). Reutilizado tal
   * cual por "Crear Combo" pasando `configCabysCombo`.
   */
  async manejarCabysSiAplica(termino: string, config: ConfigBusquedaCabys = this.configCabysProductoRapido): Promise<boolean> {
    if (!(await this.existeCampoCabys(config.boton))) return false;
    await this.buscarYAplicarCabys(termino, config);
    return true;
  }


  /**
   * Busca un código CABYS por texto en el sub-modal dedicado y aplica el
   * primer resultado de la tabla (mismo criterio que el resto de la suite
   * usa para catálogos sin nombre estable por el cual filtrar: tomar el
   * primero disponible).
   *
   * Recibe la configuración completa (botón, modal, input, botón de
   * búsqueda y filas de resultado) en vez de solo el botón: "Producto
   * Rápido" y "Crear Combo" NO comparten el mismo sub-modal —a diferencia de
   * lo asumido inicialmente—, sino dos instancias completamente separadas
   * (#dialog_add_cabys_code vs #dialog_add_cabys_code_combo, cada una con su
   * propio input/botón/tabla) — confirmado en vivo interceptando qué modal
   * queda realmente visible tras el click. Aplicar un CABYS autocompleta el
   * tipo y la tasa de IVA en ambos formularios —ver esperarIvaAutocompletado()
   * para Producto Rápido y esperarIvaAutocompletadoCombo() para Crear Combo—,
   * aunque con un desfase distinto en cada uno.
   */
  async buscarYAplicarCabys(termino: string, config: ConfigBusquedaCabys = this.configCabysProductoRapido) {
    await this.cerrarModalNotificacionesSiAparece();
    await config.boton.click();
    await expect(config.modal).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await config.input.fill(termino);
    await this.cerrarModalNotificacionesSiAparece();
    await config.botonBuscar.click();

    const primeraFila = config.filas.first();
    await expect(primeraFila, `No hubo resultados de CABYS para "${termino}"`).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
    await primeraFila.getByRole('link', { name: 'Aplicar' }).click();

    await expect(config.modal).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /** Configuración del sub-modal de búsqueda de CABYS de "Producto Rápido" (la usada por defecto). */
  get configCabysProductoRapido(): ConfigBusquedaCabys {
    return {
      boton: this.page.locator(L.QUICK_PRODUCT_BTN_CABYS),
      modal: this.modalBusquedaCabys,
      input: this.page.locator(L.CABYS_BUSCADOR_INPUT),
      botonBuscar: this.page.locator(L.CABYS_BUSCADOR_BOTON),
      filas: this.page.locator(L.CABYS_FILAS_RESULTADO),
    };
  }


  /** Configuración del sub-modal de búsqueda de CABYS propio de "Crear Combo" (separado del de Producto Rápido). */
  get configCabysCombo(): ConfigBusquedaCabys {
    return {
      boton: this.page.locator(L.COMBO_BTN_CABYS),
      modal: this.page.locator(L.COMBO_DIALOG_BUSCAR_CABYS),
      input: this.page.locator(L.COMBO_CABYS_BUSCADOR_INPUT),
      botonBuscar: this.page.locator(L.COMBO_CABYS_BUSCADOR_BOTON),
      filas: this.page.locator(L.COMBO_CABYS_FILAS_RESULTADO),
    };
  }


  /**
   * Configuración del sub-modal de búsqueda de CABYS de "Crear Producto" —
   * a diferencia de "Crear Combo" (que abre uno propio y separado), este
   * formulario SÍ reutiliza el mismo sub-modal compartido de "Producto
   * Rápido" (#dialog_add_cabys_code) — confirmado en vivo interceptando qué
   * modal queda visible tras el click; solo el botón que lo dispara es
   * propio de este formulario.
   */
  get configCabysProducto(): ConfigBusquedaCabys {
    return {
      boton: this.page.locator(L.PRODUCTO_BTN_CABYS),
      modal: this.modalBusquedaCabys,
      input: this.page.locator(L.CABYS_BUSCADOR_INPUT),
      botonBuscar: this.page.locator(L.CABYS_BUSCADOR_BOTON),
      filas: this.page.locator(L.CABYS_FILAS_RESULTADO),
    };
  }


  /**
   * Espera a que el checkbox de IVA quede marcado tras aplicar un CABYS.
   * No es instantáneo (confirmado en vivo: ~200ms de desfase, un tick de
   * JS, no una espera de red) así que se usa expect.poll() en vez de leer
   * el estado inmediatamente después de aplicar el CABYS. Se cumple tanto
   * para un CABYS con tasa positiva como con tasa "0% (Exento)": ambos son
   * una clasificación de IVA válida, a diferencia de no tener CABYS.
   */
  async esperarIvaAutocompletado() {
    await expect.poll(
      () => this.page.locator(L.QUICK_PRODUCT_APLICAR_IVA).isChecked(),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    ).toBe(true);
  }


  /**
   * Normaliza el texto de tasa sugerida por un CABYS a porcentaje. El texto
   * viene en dos formatos distintos según el CABYS (confirmado en vivo):
   * como fracción ("0.13") o ya en porcentaje ("0%") — compartido entre
   * "Producto Rápido" y "Crear Combo", que usan el mismo formato.
   */
  _normalizarPorcentajeCabys(texto: string): number {
    return texto.includes('%') ? parseFloat(texto) : parseFloat(texto) * 100;
  }


  /**
   * Valida que la tasa de IVA realmente seleccionada en el formulario de
   * "Producto Rápido" coincide con el IVA que el propio CABYS aplicado
   * sugiere — no solo que "algo" quedó marcado. Para "Crear Combo" ver
   * validarIvaCoincideConCabysCombo(), que compara contra los selectores
   * propios de ese formulario (distintos, no compartidos).
   */
  async validarIvaCoincideConCabys() {
    const cabysTaxTexto = (await this.page.locator(L.QUICK_PRODUCT_CABYS_TAX_SUGERIDO).textContent())?.trim() ?? '';
    const cabysTaxPct = this._normalizarPorcentajeCabys(cabysTaxTexto);

    const tasaSeleccionadaPct = await this.obtenerTasaIvaSeleccionadaPct();

    expect(
      tasaSeleccionadaPct,
      `La tasa de IVA seleccionada (${tasaSeleccionadaPct}%) no coincide con el IVA definido por el CABYS aplicado (${cabysTaxPct}%)`
    ).toBeCloseTo(cabysTaxPct, 1);
  }


  /** Lee el `percent` de la opción de tasa de IVA realmente seleccionada en el formulario. */
  async obtenerTasaIvaSeleccionadaPct(): Promise<number> {
    return this.page.locator(L.QUICK_PRODUCT_TASA_IVA).evaluate(
      (el) => parseFloat((el as HTMLSelectElement).selectedOptions[0]?.getAttribute('percent') ?? 'NaN')
    );
  }


  /**
   * Lee el IVA acumulado en el área de totales del POS (footer principal,
   * fila "IVA") — un valor calculado y devuelto por el propio sistema para
   * todo el carrito, distinto del total de una sola línea o del total de la
   * factura en el modal de pago. Es la señal más confiable de que el
   * producto quedó realmente registrado con impuesto: el campo "Precio con
   * IVA" del formulario puede mostrar un monto calculado aunque el
   * checkbox se haya destildado por su cuenta antes de guardar (ver
   * seleccionarIvaManualmente()), pero este total lo calcula el sistema a
   * partir de lo que efectivamente quedó guardado.
   */
  async obtenerTotalIvaGeneral(): Promise<number> {
    const texto = await this.page.locator(L.TOTAL_IVA_GENERAL).textContent() ?? '$0.00';
    return this._leerMontoDeTexto(texto);
  }


  /**
   * Establece la cantidad en el formulario de "Producto Rápido" (por
   * defecto es 1). Rellenar el input directamente en vez de usar los
   * botones +/- es equivalente aquí: ambos terminan escribiendo el mismo
   * valor en `#quick_product_quantity`, que es lo único que lee
   * `quick_product_save()` al guardar.
   */
  async establecerCantidadProductoRapido(cantidad: number) {
    await this.page.locator(L.QUICK_PRODUCT_CANTIDAD).fill(String(cantidad));
  }


  /**
   * Determina de forma confiable si el carrito está mostrando actualmente
   * el total "con IVA" de cada línea — checkbox #show_price_with_iva,
   * arriba del carrito (encabezado de la tabla), NO el checkbox del
   * formulario "Producto Rápido". Lee la propiedad IDL `.checked` (única
   * fuente real; este checkbox tampoco usa aria-checked, data-* ni clases
   * de estado) e imprime el método y la evidencia usados.
   */
  async estaMostrandoPrecioConIva(): Promise<EstadoCheckIva> {
    const activo = await this.page.locator(L.MOSTRAR_PRECIO_CON_IVA).isChecked();
    const resultado: EstadoCheckIva = {
      activo,
      metodo: 'propiedad IDL .checked (Playwright: isChecked()) sobre #show_price_with_iva',
      evidencia: `#show_price_with_iva.checked=${activo} — alterna display entre *_without_iva y *_with_iva de cada línea (confirmado: no recalcula ni afecta el resumen de totales)`,
    };
    console.log(`[estaMostrandoPrecioConIva] activo=${resultado.activo} | ${resultado.evidencia}`);
    return resultado;
  }


  /**
   * Cambia el estado de #show_price_with_iva con un click real de usuario
   * — nunca vía evaluate()/JS. Confirmado en vivo (sin asumir) que el
   * `<input>` real está oculto (boundingBox 0×0, isVisible()=false, mismo
   * patrón de slider CSS que el checkbox del formulario) y que Playwright
   * no puede clickearlo directamente: un `locator.click()` sobre el propio
   * input agota el timeout de accionabilidad. El elemento que un usuario
   * real efectivamente toca es el `<span class="span-tax">` hermano
   * —confirmado con `elementFromPoint` en el punto exacto del click—, que
   * responde a un click normal, sin `force` y sin tocar `.checked` por
   * código: `isChecked()` cambia correctamente en ambas direcciones
   * (false→true y true→false, confirmado que es un switch real).
   *
   * Solo clickea si hace falta (nunca a ciegas): un click sobre un switch
   * ya en el estado deseado lo invertiría.
   *
   * `claves` son los productos ya presentes en el carrito cuyo total debe
   * reflejar el nuevo estado antes de devolver el control. show_price_with_iva()
   * solo alterna la clase "hide" entre las dos columnas paralelas ya
   * calculadas de cada línea (`#total_by_product_<clave>` sin IVA y
   * `#total_by_product_with_iva_<clave>` con IVA — confirmado en vivo, ver
   * el comentario de `estaMostrandoPrecioConIva()`), así que la condición
   * explícita real de "el carrito terminó de actualizarse" es que la
   * columna correspondiente al estado pedido quede realmente visible para
   * cada producto ya agregado — nunca una pausa arbitraria. Si el checkbox
   * no cambia de estado o alguna columna no llega a mostrarse, las propias
   * aserciones (`toBeChecked`/`toBeVisible`) hacen fallar el test de
   * inmediato, con el elemento y el producto exactos en el mensaje.
   */
  async establecerMostrarPrecioConIva(activar: boolean, claves: string[] = []) {
    const checkbox = this.page.locator(L.MOSTRAR_PRECIO_CON_IVA);
    const estadoActual = await checkbox.isChecked();
    if (estadoActual !== activar) {
      const span = checkbox.locator('xpath=following-sibling::span[1]');
      await span.click();
    }

    await expect(
      checkbox,
      `#show_price_with_iva no cambió a checked=${activar} tras el click sobre su span — el test no puede continuar con las validaciones de IVA en un estado desconocido`
    ).toBeChecked({ checked: activar });

    for (const clave of claves) {
      const selectorColumnaEsperada = activar
        ? `#total_by_product_with_iva_${clave}`
        : `#total_by_product_${clave}`;
      await expect(
        this.page.locator(selectorColumnaEsperada),
        `Tras fijar #show_price_with_iva=${activar}, la columna de totales esperada (${selectorColumnaEsperada}) del producto "${clave}" no quedó visible — el carrito no terminó de actualizarse`
      ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    }
  }


  /**
   * Lee todos los datos de una línea del carrito directamente del DOM real
   * (nunca por índice fijo, siempre por la clave del producto) — ver el
   * mapeo completo y la evidencia en vivo en el comentario del tipo
   * `LineaCarrito`. El total se lee del elemento que el propio carrito está
   * mostrando en este momento (según #show_price_with_iva), no de un id
   * fijo — ver `estaMostrandoPrecioConIva()`.
   */
  async obtenerDatosLineaCarrito(clave: string): Promise<LineaCarrito> {
    const mostrandoConIva = await this.estaMostrandoPrecioConIva();
    const totalSelector = mostrandoConIva.activo
      ? `#total_by_product_with_iva_${clave}`
      : `#total_by_product_${clave}`;

    // "neto" y "totalConIva" se leen SIEMPRE por su id fijo (no por
    // totalSelector): ambos existen y están correctamente calculados en el
    // DOM sin importar si #show_price_with_iva los muestra u oculta — ver
    // el comentario del tipo LineaCarrito para la evidencia completa contra
    // add_sn_product() en pos.js. #product_total_tax_<clave> ya NO se lee:
    // pese al nombre, es un duplicado del total CON IVA, no el subtotal sin
    // IVA.
    const [nombre, cantidadTexto, netoTexto, totalConIvaTexto, totalTexto, applyIvaTexto] = await Promise.all([
      this.page.locator(`#product_table_name_${clave}`).textContent(),
      this.page.locator(`#input_product_quantity_${clave}`).inputValue(),
      this.page.locator(`#total_by_product_${clave}`).textContent(),
      this.page.locator(`#total_by_product_with_iva_${clave}`).textContent(),
      this.page.locator(totalSelector).textContent(),
      this.page.locator(`#product_hide_apply_iva_${clave}`).inputValue(),
    ]);

    console.log(
      `[obtenerDatosLineaCarrito] clave=${clave} | neto(total_by_product)="${netoTexto?.trim()}" ` +
      `| totalConIva(total_by_product_with_iva)="${totalConIvaTexto?.trim()}" ` +
      `| total mostrado (${totalSelector})="${totalTexto?.trim()}" ` +
      `| product_hide_apply_iva_${clave}="${applyIvaTexto}"`
    );

    const cantidad = parseFloat(cantidadTexto) || 0;
    const neto = parseFloat((netoTexto ?? '0').replace(/[^0-9.-]/g, '')) || 0;
    const totalConIva = parseFloat((totalConIvaTexto ?? '0').replace(/[^0-9.-]/g, '')) || 0;
    const total = parseFloat((totalTexto ?? '0').replace(/[^0-9.-]/g, '')) || 0;
    const iva = totalConIva - neto;
    const precioUnitarioNeto = cantidad !== 0 ? neto / cantidad : 0;

    return {
      clave,
      nombre: nombre?.trim() || clave,
      cantidad,
      precioUnitarioNeto,
      neto,
      totalConIva,
      iva,
      total,
      ivaAplicado: applyIvaTexto === '1',
    };
  }


  /**
   * Localiza la clave ACTUAL de una línea del carrito por su nombre exacto
   * — necesario cuando una clave capturada varios pasos atrás puede haber
   * quedado obsoleta: confirmado en vivo que el carrito de una Orden de
   * Ruteo ya cargada se resincroniza contra el servidor en cada línea
   * agregada, lo que puede reasignar claves ya existentes (ver el
   * comentario de obtenerTextoCarrito() y el del Escenario 15 de
   * pos-ruteo.spec.ts). Falla con un mensaje claro si ninguna línea
   * coincide.
   */
  async obtenerClaveDeLineaPorNombre(nombre: string): Promise<string> {
    const claves = await this.obtenerClavesFilasCarrito();
    for (const clave of claves) {
      const linea = await this.obtenerDatosLineaCarrito(clave);
      if (linea.nombre === nombre) return clave;
    }
    expect(false, `No se encontró ninguna línea del carrito con el nombre "${nombre}"`).toBe(true);
    return '';
  }


  /**
   * Valida una única línea del carrito: que el total mostrado sea
   * (precio unitario × cantidad) + IVA, y que la bandera real de IVA
   * aplicado (`product_hide_apply_iva_<clave>`) coincida con lo esperado —
   * esto último es lo que detecta el caso real ya confirmado en este
   * ambiente donde el total "se ve" con IVA calculado pero el sistema
   * registra la línea como sin IVA aplicado (ver pos.js:695). El mensaje de
   * error incluye producto, precio unitario, cantidad, IVA, total esperado
   * y total obtenido.
   */
  async validarLineaCarrito(clave: string, ivaEsperadoActivo: boolean): Promise<LineaCarrito> {
    const linea = await this.obtenerDatosLineaCarrito(clave);
    const totalEsperado = (linea.precioUnitarioNeto * linea.cantidad) + linea.iva;

    expect(
      linea.total,
      `Producto "${linea.nombre}" (clave ${linea.clave}): ` +
      `precio unitario=${linea.precioUnitarioNeto.toFixed(2)}, cantidad=${linea.cantidad}, ` +
      `IVA=${linea.iva.toFixed(2)}, total esperado=${totalEsperado.toFixed(2)}, total obtenido=${linea.total.toFixed(2)}`
    ).toBeCloseTo(totalEsperado, 1);

    expect(
      linea.ivaAplicado,
      `Producto "${linea.nombre}" (clave ${linea.clave}): se esperaba IVA ${ivaEsperadoActivo ? 'activado' : 'desactivado'} ` +
      `pero el sistema registró product_hide_apply_iva_${linea.clave}="${linea.ivaAplicado ? '1' : '0'}"`
    ).toBe(ivaEsperadoActivo);

    return linea;
  }


  /**
   * Recorre TODAS las claves indicadas (nunca un índice fijo ni "la
   * primera") y valida cada línea con validarLineaCarrito(). Devuelve las
   * líneas ya leídas para reutilizarlas al validar el resumen de impuestos,
   * sin volver a golpear el DOM.
   */
  async validarLineasCarrito(claves: string[], ivaEsperadoActivo: boolean): Promise<LineaCarrito[]> {
    const lineas: LineaCarrito[] = [];
    for (const clave of claves) {
      lineas.push(await this.validarLineaCarrito(clave, ivaEsperadoActivo));
    }
    return lineas;
  }


  /** Suma el IVA de las líneas dadas — reutilizado tanto para el cálculo como para el mensaje de error. */
  calcularTotalImpuestosEsperado(lineas: LineaCarrito[]): number {
    return lineas.reduce((acc, l) => acc + l.iva, 0);
  }


  /**
   * Suma el neto (subtotal sin IVA) de las líneas dadas — no existe ningún
   * campo "Subtotal" visible en el resumen de totales del POS (solo IVA y
   * Total, confirmado en vivo revisando el panel de detalle avanzado), así
   * que el subtotal del carrito se valida por consistencia interna: subtotal
   * (esta suma) + impuestos (calcularTotalImpuestosEsperado) debe coincidir
   * con obtenerTotalVentaNumerico().
   */
  calcularSubtotalEsperado(lineas: LineaCarrito[]): number {
    return lineas.reduce((acc, l) => acc + l.neto, 0);
  }


  /**
   * Valida que la suma del IVA de todas las líneas dadas coincida con el
   * campo "IVA" del resumen de totales del POS (`obtenerTotalIvaGeneral()`,
   * el mismo footer, no el modal de pago).
   *
   * Ajustada por el Descuento General, cuando está REALMENTE activo —
   * confirmado en vivo (carritos aislados, sin contaminación entre casos)
   * que `#total_by_product_<clave>` / `#total_by_product_with_iva_<clave>`
   * (la fuente de `lineas[].iva`, ver obtenerDatosLineaCarrito()) NUNCA
   * reflejan el Descuento General: quedan idénticos con o sin él activo. El
   * footer de IVA sí lo aplica, proporcionalmente sobre el subtotal bruto —
   * confirmado que `ΣIVA_bruto × (1 − montoDescuento / Σneto_bruto)`
   * reproduce el valor del footer con exactitud de centavos cuando el
   * Descuento General (checkbox `apply_general_discount`,
   * `estaDescuentoGeneralActivo()`) está activo.
   *
   * El ajuste se aplica SOLO si ese checkbox está activo — no basta con que
   * `obtenerMontoDescuentoGeneralNumerico()` (`#total_discount`) sea mayor a
   * 0: confirmado en vivo que ese mismo campo también acumula el monto de
   * cualquier Descuento Individual ya aplicado a alguna línea, aunque el
   * Descuento General nunca se haya activado. A diferencia del General, el
   * Descuento Individual SÍ modifica directamente `#total_by_product_<clave>`
   * de la línea afectada, así que `lineas[].iva` ya lo refleja de origen —
   * aplicar el ajuste también en ese caso resta el descuento dos veces
   * (confirmado en vivo: rompía exactamente esta combinación, con
   * `#total_discount` > 0 pero el checkbox General apagado).
   *
   * La Exoneración no participa de este ajuste: confirmado en vivo que el
   * footer de IVA queda igual con o sin ella activa (se resta en otro campo
   * del resumen, no en `#total_tax`).
   *
   * Limitación conocida, sin evidencia en vivo que la resuelva aún: si el
   * Descuento General Y un Descuento Individual están activos A LA VEZ,
   * `#total_discount` mezcla ambos montos sin distinguirlos, así que el
   * ratio calculado aquí sobreestimaría el ajuste (restaría también la
   * porción ya reflejada en la línea vía el individual). Ningún escenario
   * de la suite ejercita hoy esa combinación exacta contra este método.
   */
  async validarResumenImpuestos(lineas: LineaCarrito[]) {
    const totalBruto = this.calcularTotalImpuestosEsperado(lineas);
    const descuentoGeneralActivo = await this.estaDescuentoGeneralActivo();

    let totalEsperado = totalBruto;
    let detalleAjuste = '';
    if (descuentoGeneralActivo) {
      const subtotalBruto = this.calcularSubtotalEsperado(lineas);
      const descuentoGeneral = await this.obtenerMontoDescuentoGeneralNumerico();
      const ratioDescuentoGeneral = subtotalBruto > 0 ? 1 - (descuentoGeneral / subtotalBruto) : 1;
      totalEsperado = totalBruto * ratioDescuentoGeneral;
      detalleAjuste = `, ajustado por Descuento General activo (${descuentoGeneral.toFixed(2)} sobre subtotal ${subtotalBruto.toFixed(2)}, ratio ${ratioDescuentoGeneral.toFixed(4)}) = ${totalEsperado.toFixed(2)}`;
    }

    const totalMostrado = await this.obtenerTotalIvaGeneral();

    expect(
      totalMostrado,
      `Suma de IVA por producto (${lineas.map(l => `"${l.nombre}"=${l.iva.toFixed(2)}`).join(' + ')} = ${totalBruto.toFixed(2)}${detalleAjuste}) ` +
      `no coincide con el IVA del resumen de totales (${totalMostrado.toFixed(2)})`
    ).toBeCloseTo(totalEsperado, 1);
  }


  /**
   * Selecciona manualmente el primer tipo y la primera tasa de IVA reales
   * disponibles (excluyendo el placeholder "Seleccionar...") vía los
   * widgets "Chosen" — mismo criterio que ya usa el wizard de End. Pintura
   * para parte/pieza/servicio: el catálogo de impuestos es configurable
   * por compañía, sin nombre estable en el que apoyarse (confirmado en
   * vivo: una misma instalación mostró "Impuesto al valor agregado" en un
   * momento y "Condicion impuesto 1" / "Condicion impuesto 2" en otro, según
   * el país configurado para la compañía), así que nunca se debe hardcodear
   * un texto de opción.
   *
   * Solo tiene sentido llamarlo cuando el CABYS NO aparece en el formulario
   * —si aparece, el IVA debe venir del CABYS, no de una selección manual—.
   *
   * Causa raíz confirmada (interceptando la propiedad `checked` del
   * checkbox, con stack real, no una hipótesis): `pos.js:680-699` liga un
   * `setTimeout(..., 300)` al evento `shown.bs.modal` del formulario que,
   * si la compañía no tiene un impuesto por defecto configurado, ejecuta
   * `$('#check_quick_product_apply_tax').prop('checked', false)`
   * incondicionalmente, UNA sola vez por apertura del modal — sin importar
   * lo que se haya seleccionado mientras tanto, y sin disparar ningún
   * evento "change" (no hay señal que esperar). El "300ms" es nominal:
   * confirmado en vivo disparando más de un segundo después de abierto el
   * modal cuando el hilo principal está ocupado, pudiendo caer en medio de
   * la propia selección manual o incluso en la breve ventana entre la
   * última verificación y el click real en "Agregar" (las comprobaciones
   * de accionabilidad de Playwright ya alcanzan a dar ese margen).
   *
   * Por tratarse de un timer de una sola vez con referencia temporal fija
   * (la apertura del modal, no nuestras acciones), la defensa fiable no es
   * perseguirlo después sino dejarlo pasar ANTES de tocar el checkbox por
   * primera vez.
   */
  async seleccionarIvaManualmente() {
    await this.page.waitForTimeout(5_000); // dejar pasar el timer de una sola vez de pos.js:680-699 antes de tocar el checkbox

    await this.asegurarCheckboxIvaMarcado();
    await this._seleccionarPrimeraOpcionChosen('#quick_product_tax_chosen');
    await this._seleccionarPrimeraOpcionChosen('#quick_product_tax_rate_chosen');
    await this.asegurarCheckboxIvaMarcado();
  }


  /**
   * Presiona "Agregar" para guardar el producto rápido en el carrito.
   *
   * Requiere haber entrado al POS vía cargarPosDesdeDashboard(), no
   * irAlPos() directo: este botón depende de un binding de jQuery que, en
   * una carga en frío del navegador, puede quedar sin ligar por una
   * condición de carrera real de la aplicación — ver el comentario de
   * cargarPosDesdeDashboard() para la evidencia completa. Con esa
   * precondición cumplida, un click real y sin force es suficiente.
   */
  async guardarProductoRapido() {
    await this.page.locator(L.QUICK_PRODUCT_GUARDAR).click();
  }


  /**
   * Igual que guardarProductoRapido(), pero arma la espera de la petición
   * real (getPosProductSaleItem) ANTES del click —nunca después, para no
   * perderse el evento si la respuesta llega muy rápido— y la devuelve para
   * que el test la valide explícitamente a nivel de red, no solo por su
   * efecto visual en el carrito.
   */
  async guardarProductoRapidoYObtenerRespuesta() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_PRODUCTO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.guardarProductoRapido();
    return respuestaPromise;
  }


  /**
   * Agrega un producto rápido al carrito para las pruebas de validación de
   * IVA, con la cantidad indicada. Compone métodos ya existentes de esta
   * misma clase —abrirProductoRapido, llenarDatosBasicosProductoRapido,
   * manejarCabysSiAplica, seleccionarIvaManualmente— en vez de duplicar su
   * lógica.
   *
   * Ya NO lee ni depende del checkbox del formulario "Producto Rápido"
   * (#check_quick_product_apply_tax) para determinar qué validar después: ese
   * checkbox solo sirve aquí para CONFIGURAR el producto al crearlo —sigue
   * siendo la forma real de decirle al sistema si debe llevar impuesto—, pero
   * la verificación de qué quedó realmente aplicado se hace por separado,
   * después de guardar, contra `product_hide_apply_iva_<clave>` (la única
   * fuente de verdad confirmada por el trace de red) y contra el checkbox
   * `#show_price_with_iva` (arriba del carrito) para saber qué total leer —
   * ver `validarLineaCarrito()`.
   *
   * Cuando `activarIva` es true: si el CABYS aparece, lo completa con
   * CABYS_BUSQUEDA (el IVA se autocompleta a partir de él); si no aparece,
   * lo selecciona manualmente. Cuando es false: si CABYS no aparece, no lo
   * toca —queda en su estado por defecto, sin marcar, la forma real de
   * guardar un producto sin IVA en ambientes que no lo exigen (p. ej.
   * HONDURAS)—; si SÍ aparece, se completa con CABYS_BUSQUEDA_SIN_IVA (tasa
   * "0% Exento") ÚNICAMENTE para que el guardado no quede bloqueado
   * (confirmado en vivo, TALLER ALPHA PREMIUM: sin ningún CABYS el botón
   * "Agregar" no dispara ningún AJAX en absoluto). Esto NO logra un
   * producto con `product_hide_apply_iva=0`: confirmado en vivo que un
   * CABYS al 0% igual guarda ese flag en `1` (el producto queda clasificado
   * fiscalmente, solo que a tasa cero) — en un ambiente donde CABYS es
   * obligatorio, "sin IVA" en el sentido estricto de `activarIva=false`
   * simplemente no es un estado alcanzable, así que un caller que valide
   * `product_hide_apply_iva=0` seguirá fallando ahí, correctamente: es una
   * diferencia real de reglas fiscales entre compañías, no un bug de este
   * método ni algo que la automatización deba (o pueda) enmascarar.
   *
   * Centralizado aquí: existía duplicado de forma idéntica como función
   * local en pos-crear.spec.ts, pos-facturar.spec.ts y pos.spec.ts.
   */
  async agregarProductoRapidoParaValidacionIva(
    nombre: string,
    precio: string,
    activarIva: boolean,
    cantidad = 1
  ) {
    await this.abrirProductoRapido();
    await this.llenarDatosBasicosProductoRapido(nombre, precio);
    if (cantidad !== 1) {
      await this.establecerCantidadProductoRapido(cantidad);
    }

    if (activarIva) {
      const cabysAplicado = await this.manejarCabysSiAplica(CABYS_BUSQUEDA);
      if (cabysAplicado) {
        await this.esperarIvaAutocompletado();
      } else {
        await this.seleccionarIvaManualmente();
      }
    } else {
      const cabysAplicado = await this.manejarCabysSiAplica(CABYS_BUSQUEDA_SIN_IVA);
      if (cabysAplicado) {
        await this.esperarIvaAutocompletado();
      }
    }

    await this.guardarProductoRapidoYObtenerRespuesta();
    await expect(this.modalProductoRapido).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  // ─── Pestañas superiores del POS ────────────────────────────────────────────

  /** Indica si la pestaña existe en el DOM en este momento — detecta pestañas ocultas por permisos/configuración sin fallar. */
  async existePestanaPos(selector: string): Promise<boolean> {
    return (await this.page.locator(selector).count()) > 0;
  }


  /**
   * Visita una pestaña del POS ya confirmada existente: click real (sin
   * force), espera la petición AJAX genérica que toda pestaña dispara al
   * cambiar (`set_pos_type_option` — confirmado en vivo en las 8 pestañas
   * probadas; es el único endpoint común a todas, a diferencia del
   * endpoint propio de contenido que cada una dispara además y que sí
   * varía), confirma que quedó activa (clase "btn_tab_active") y que su
   * contenedor de contenido correspondiente quedó visible.
   */
  async visitarPestanaPos(pestana: PestanaPos) {
    const tab = this.page.locator(pestana.selector);
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_CAMBIO_PESTANA_POS),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await tab.click();
    await respuestaPromise;

    await expect(
      tab,
      `La pestaña "${pestana.etiqueta}" (${pestana.selector}) no quedó activa tras el click`
    ).toHaveClass(new RegExp(L.PESTANA_POS_CLASE_ACTIVA));

    await expect(
      this.page.locator(pestana.contenedorContenido),
      `Tras activar "${pestana.etiqueta}", su contenedor de contenido (${pestana.contenedorContenido}) no quedó visible`
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    console.log(`[visitarPestanaPos] Pestaña visitada: "${pestana.etiqueta}" (${pestana.selector})`);
  }


  /**
   * Indica si la pestaña superior dada (POS Facturación/Ruteo/etc., ver
   * PESTANAS_POS_A_RECORRER/PESTANA_POS_FACTURACION) está actualmente
   * activa — mismo criterio (clase L.PESTANA_POS_CLASE_ACTIVA) que
   * visitarPestanaPos() ya valida tras cada cambio de pestaña. Útil para
   * escenarios que deben confirmar que NUNCA salieron de una pestaña
   * (p. ej. facturar una Orden de Ruteo sin abandonar el tab "Ruteo").
   */
  async pestanaPosActiva(pestana: PestanaPos): Promise<boolean> {
    const clase = await this.page.locator(pestana.selector).getAttribute('class');
    return clase?.includes(L.PESTANA_POS_CLASE_ACTIVA) ?? false;
  }


  /**
   * Localiza dinámicamente la pestaña "Apartados": a diferencia de las
   * demás (todas con id técnico estable confirmado en pos.js), no hay
   * ningún manejador de click propio para ella en este ambiente, así que
   * no existe un id conocido que hardcodear — se busca por texto dentro
   * del propio contenedor de pestañas. Devuelve null si no existe (oculta
   * por permisos/configuración), sin asumir que siempre está presente.
   */
  async localizarPestanaApartados(): Promise<PestanaPos | null> {
    const candidato = this.page.locator(L.PESTANAS_POS_CONTENEDOR).locator('a', { hasText: /apartado/i });
    if ((await candidato.count()) === 0) return null;

    const id = await candidato.first().getAttribute('id');
    if (!id) return null;

    return { selector: `#${id}`, etiqueta: 'Apartados', contenedorContenido: '#content_invoice_order_list' };
  }


  // ─── Selección de cliente ────────────────────────────────────────────────────

  /**
   * Busca clientes existentes con el término dado y selecciona el primer
   * resultado. Búsqueda vacía (por defecto) devuelve el catálogo completo
   * de la compañía — confirmado en vivo (24 resultados) — así que no
   * depende de que exista un cliente con un nombre específico en este
   * ambiente compartido de QA, mismo patrón de "primera opción disponible"
   * que ya usa el resto de la suite para catálogos configurables por
   * compañía (CABYS, tipo/tasa de IVA, parte/pieza/servicio de End.
   * Pintura). Devuelve el nombre del cliente realmente seleccionado.
   */
  async seleccionarClienteExistente(terminoBusqueda = ''): Promise<string> {
    await this.page.locator(L.CLIENTE_INPUT_BUSQUEDA).fill(terminoBusqueda);

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.CLIENTE_AJAX_BUSQUEDA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.CLIENTE_BTN_BUSCAR).click();
    await respuestaPromise;

    const sinResultados = await this.page.locator(L.CLIENTE_SIN_RESULTADOS).isVisible().catch(() => false);
    if (sinResultados) {
      throw new Error(`No se encontraron clientes con el término de búsqueda "${terminoBusqueda}"`);
    }

    const primerCliente = this.page.locator(L.CLIENTE_FILAS_RESULTADO).first();
    await expect(
      primerCliente,
      `No apareció ningún resultado de cliente para "${terminoBusqueda}"`
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // La búsqueda dispara, en el mismo instante en que renderiza las filas
    // de resultado, una animación jQuery de 100ms que oculta .product_panel
    // (get_customer_by_pos_option → $('.product_panel').hide(100)) — la
    // inserción de las filas es síncrona/instantánea, así que el bloque
    // anterior (primerCliente visible) puede resolver bien ANTES de que esa
    // animación en cola termine. selectCustomerToPos() hace, en cambio, un
    // $('.product_panel').show() síncrono e inmediato al elegir un cliente:
    // si ese click cae dentro de esa ventana de ~100ms, el callback de
    // finalización de la animación aún pendiente puede ejecutarse DESPUÉS
    // del show() y revertirlo a oculto — condición de carrera real de la
    // app, confirmada en vivo interceptando jQuery.fn.show/hide con stack
    // traces reales (mismo patrón de causa raíz que el bug ya documentado
    // de pos.js:695). Por eso se espera aquí, de forma explícita, a que la
    // animación en cola termine de verdad (.product_panel oculto) antes de
    // hacer click en "seleccionar" — así el show() posterior corre después
    // de que la cola de animación quedó vacía, sin nada que lo revierta.
    await expect(
      this.page.locator(L.PANEL_PRODUCTOS),
      'La animación de ocultar el catálogo de productos (disparada por la búsqueda) no terminó — no se puede seleccionar el cliente todavía sin arriesgar la condición de carrera ya documentada'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await primerCliente.locator(L.CLIENTE_BTN_SELECCIONAR_FILA).click();

    await expect(
      this.page.locator(L.CLIENTE_PANEL_RESULTADOS),
      'El panel de selección de clientes no se cerró tras elegir uno'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await expect(
      this.page.locator(L.CLIENTE_SELECT_OCULTO),
      'El cliente seleccionado no quedó registrado en #customer_select'
    ).not.toHaveValue('');

    const nombreCliente = (await this.page.locator(L.CLIENTE_NOMBRE_SELECCIONADO).textContent())?.trim() ?? '';
    expect(nombreCliente, 'El nombre del cliente seleccionado no quedó visible en el POS').not.toBe('');

    await expect(
      this.page.locator(L.PANEL_PRODUCTOS),
      'El POS no volvió al catálogo de productos tras seleccionar el cliente'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const idCliente = await this.page.locator(L.CLIENTE_SELECT_OCULTO).inputValue();
    console.log(`[seleccionarClienteExistente] Cliente seleccionado: "${nombreCliente}" (id=${idCliente})`);

    return nombreCliente;
  }


  /**
   * Mismo mecanismo que seleccionarClienteExistente() (buscar y elegir un
   * cliente real ya registrado), pero descarta las filas cuyo nombre visible
   * coincida con `nombreActual` — necesario para escenarios que ya tienen un
   * cliente seleccionado (p. ej. el propio de una Orden de Ruteo ya cargada
   * al carrito) y necesitan cambiarlo por uno genuinamente DISTINTO: una
   * búsqueda vacía siempre devuelve el mismo primer cliente del catálogo
   * completo (confirmado en vivo, mismo criterio ya aplicado a productos por
   * obtenerSegundoProductoNormalDistinto()), así que reintentar
   * seleccionarClienteExistente() sin más aterrizaría en el mismo cliente.
   * Quien llama debe quitar el cliente actual primero (quitarClienteSeleccionado())
   * si ya hay uno seleccionado — confirmado en vivo que el buscador de
   * cliente solo vuelve a estar disponible después de eso.
   */
  async seleccionarClienteExistenteDistintoDe(nombreActual: string, terminoBusqueda = ''): Promise<string> {
    await this.page.locator(L.CLIENTE_INPUT_BUSQUEDA).fill(terminoBusqueda);

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.CLIENTE_AJAX_BUSQUEDA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.CLIENTE_BTN_BUSCAR).click();
    await respuestaPromise;

    const sinResultados = await this.page.locator(L.CLIENTE_SIN_RESULTADOS).isVisible().catch(() => false);
    if (sinResultados) {
      throw new Error(`No se encontraron clientes con el término de búsqueda "${terminoBusqueda}"`);
    }

    const filas = this.page.locator(L.CLIENTE_FILAS_RESULTADO);
    await expect(filas.first(), `No apareció ningún resultado de cliente para "${terminoBusqueda}"`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    const total = await filas.count();

    let filaElegida: Locator | null = null;
    for (let i = 0; i < total; i++) {
      const texto = (await filas.nth(i).innerText()).trim();
      if (!texto.includes(nombreActual)) {
        filaElegida = filas.nth(i);
        break;
      }
    }
    expect(filaElegida, `No se encontró ningún cliente distinto de "${nombreActual}" entre los ${total} resultados de "${terminoBusqueda}"`).not.toBeNull();

    // Misma condición de carrera ya documentada en seleccionarClienteExistente().
    await expect(
      this.page.locator(L.PANEL_PRODUCTOS),
      'La animación de ocultar el catálogo de productos (disparada por la búsqueda) no terminó — no se puede seleccionar el cliente todavía sin arriesgar la condición de carrera ya documentada'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await filaElegida!.locator(L.CLIENTE_BTN_SELECCIONAR_FILA).click();

    await expect(
      this.page.locator(L.CLIENTE_PANEL_RESULTADOS),
      'El panel de selección de clientes no se cerró tras elegir uno'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const nombreCliente = (await this.page.locator(L.CLIENTE_NOMBRE_SELECCIONADO).textContent())?.trim() ?? '';
    expect(nombreCliente, 'El nombre del cliente seleccionado no quedó visible en el POS').not.toBe('');
    expect(nombreCliente, 'El cliente seleccionado sigue siendo el mismo que antes').not.toBe(nombreActual);

    await expect(
      this.page.locator(L.PANEL_PRODUCTOS),
      'El POS no volvió al catálogo de productos tras seleccionar el cliente'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    console.log(`[seleccionarClienteExistenteDistintoDe] Cliente seleccionado: "${nombreCliente}" (distinto de "${nombreActual}")`);
    return nombreCliente;
  }


  /**
   * Factura solo con el nombre del cliente, sin seleccionar uno registrado:
   * abre "Agregar" → "Nombre del cliente" (dropdown Bootstrap dentro del
   * panel de búsqueda), escribe el nombre y confirma con blur — el campo
   * usa `onchange`, confirmado en vivo que un fill() sin blur no aplica el
   * nombre. Valida contra #temporal_customer_name (el campo que
   * efectivamente se lee al facturar), no contra #customer_selected_name
   * (ver el comentario de CLIENTE_INPUT_NOMBRE_RAPIDO).
   */
  async ingresarNombreCliente(nombre: string) {
    await this.page.locator(L.CLIENTE_DROPDOWN_AGREGAR).click();
    await this.page.getByRole('link', { name: 'Nombre del cliente' }).click();
    await expect(
      this.page.locator(L.CLIENTE_CONTENEDOR_NOMBRE_RAPIDO),
      'El campo "Nombre del cliente" no apareció tras seleccionar la opción del menú "Agregar"'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const campoNombre = this.page.locator(L.CLIENTE_INPUT_NOMBRE_RAPIDO);
    await campoNombre.fill(nombre);
    await campoNombre.blur();

    await expect(
      campoNombre,
      `El nombre del cliente no quedó aplicado: se esperaba "${nombre}"`
    ).toHaveValue(nombre);

    await expect(
      this.page.locator(L.PANEL_PRODUCTOS),
      'El POS no está listo para continuar con la facturación tras ingresar el nombre del cliente'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    console.log(`[ingresarNombreCliente] Nombre aplicado: "${nombre}"`);
  }

  /**
   * Cancela el modo "Nombre del cliente" (CLIENTE_CONTENEDOR_NOMBRE_RAPIDO,
   * #temporal_customer_name) y regresa el panel "Buscar Cliente" a su modo
   * de búsqueda real (cancelQuickCustomerName(), ícono "×" — no confundir
   * con CLIENTE_BTN_QUITAR/validateRemoveProformClient, que quita un
   * cliente REAL ya asociado). Confirmado en vivo (Convertir a Orden de
   * Reparación): una Proforma de Taller guardada solo con nombre libre
   * (llenarNombreClienteProforma()) deja, al cargarse en el carrito
   * (cargarProformaEnCarritoDesdeTab()), el panel en este modo — NO en el
   * modo de búsqueda por defecto que seleccionarClienteExistente() asume.
   * Llamar a seleccionarClienteExistente() directamente ahí deja
   * CLIENTE_INPUT_BUSQUEDA oculto indefinidamente (nunca se vuelve
   * visible), agotando su timeout sin ningún error explícito. No-op si el
   * panel ya está en modo de búsqueda.
   */
  async cancelarNombreClienteRapidoSiActivo() {
    const enModoNombreRapido = await this.page.locator(L.CLIENTE_CONTENEDOR_NOMBRE_RAPIDO).isVisible().catch(() => false);
    if (!enModoNombreRapido) return;

    await this.page.locator(L.CLIENTE_QUICK_NAME_BTN_CANCELAR).click();
    await expect(
      this.page.locator(L.CLIENTE_INPUT_BUSQUEDA),
      'El panel "Buscar Cliente" no volvió al modo de búsqueda tras cancelar el nombre rápido'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  // ─── Métodos privados ────────────────────────────────────────────────────────

  /**
   * Hace click en la primera opción visible que resuelva el selector dado,
   * validando primero que exista al menos una — usado por los pasos de
   * parte/pieza/servicio del wizard "End. Pintura", que comparten la misma
   * necesidad (catálogo sin nombre estable, tomar la primera disponible) y el
   * mismo tipo de fallo a diagnosticar si el catálogo viniera vacío.
   */
  async _clickPrimeraOpcionDisponible(selector: string, descripcion: string) {
    const opcion = this.page.locator(selector).first();
    await expect(opcion, `No hay ninguna ${descripcion} disponible en este paso del wizard "End. Pintura"`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await opcion.click();
  }


  /**
   * Abre un widget "Chosen" y selecciona su primera opción real, excluyendo
   * el placeholder ya marcado "result-selected" (mismo criterio que
   * PINTURA_VEHICULO_RESULTADO usa filtrando por texto: el primer <li> de
   * un Chosen recién abierto es siempre el placeholder, nunca una opción
   * real utilizable).
   */
  async _seleccionarPrimeraOpcionChosen(contenedorChosenSelector: string) {
    const trigger = this.page.locator(`${contenedorChosenSelector} .chosen-single`);
    // Espera explícita con timeout acotado (no el default del test, varios
    // minutos) ANTES de intentar el scroll: sin este límite propio,
    // scrollIntoViewIfNeeded() (sin actionTimeout configurado en el
    // proyecto) reintentaba en silencio hasta agotar el timeout COMPLETO
    // del test antes de reportar nada. Con este límite, si el trigger
    // nunca aparece (p. ej. porque el campo no es aplicable en esta
    // configuración — ver _seleccionarPrimeraOpcionChosenSiEsPosible() para
    // el caso donde eso es esperado, no un error) el fallo se reporta
    // rápido y con un mensaje claro en vez de colgar el test entero.
    await expect(trigger, `El trigger del Chosen "${contenedorChosenSelector}" nunca quedó visible`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    // El menú desplegado de Chosen se posiciona relativo al trigger: si el
    // trigger queda fuera del viewport (confirmado en vivo en formularios
    // largos, p. ej. "Crear Producto" con "¿Fraccionar?" activado, que hace
    // el modal mucho más alto), el resultado también nace fuera del
    // viewport y el auto-scroll de Playwright nunca llega a alcanzarlo.
    await trigger.scrollIntoViewIfNeeded({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await trigger.click({ timeout: TIMEOUTS.PAYMENT_MODAL });
    // Excluir SIEMPRE `data-option-array-index="0"` (el placeholder real,
    // primera <option> de cada uno de estos <select> por convención de esta
    // app — mismo criterio que `option:not([value="0"])` ya usado en otros
    // catálogos de esta clase), no solo `:not(.result-selected)`. Causa raíz
    // investigada en vivo (Ruta de "Crear Orden de Ruteo", catálogo ya con
    // 20+ rutas reales acumuladas de corridas previas de esta misma suite):
    // `.result-selected` lo asigna Chosen a la opción que quedó
    // "resaltada"/última usada en su propio estado interno, NO siempre al
    // placeholder — con un catálogo pequeño/recién creado ambas cosas
    // coinciden (por eso este bug no se manifestaba antes), pero con un
    // catálogo grande Chosen puede resaltar cualquier otra opción real,
    // dejando el placeholder (primer <li>, sin la clase `.result-selected`)
    // como el único que pasaba el filtro anterior — seleccionándolo por
    // error en vez de una opción real.
    const opcion = this.page
      .locator(`${contenedorChosenSelector} .chosen-results li:not(.result-selected):not([data-option-array-index="0"])`)
      .first();
    await expect(opcion, `El Chosen "${contenedorChosenSelector}" no tiene ninguna opción real disponible`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await opcion.click();
  }


  /**
   * Variante de _seleccionarPrimeraOpcionChosen() para catálogos dependientes
   * (p. ej. Subcategoría depende de la Categoría elegida, Sub sección de la
   * Sección) que pueden legítimamente no tener ninguna opción real todavía —
   * en vez de fallar, simplemente no selecciona nada y lo deja en su
   * placeholder por defecto.
   */
  async _seleccionarPrimeraOpcionChosenSiHayOpciones(contenedorChosenSelector: string) {
    const trigger = this.page.locator(`${contenedorChosenSelector} .chosen-single`);
    await trigger.scrollIntoViewIfNeeded({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await trigger.click({ timeout: TIMEOUTS.PAYMENT_MODAL });
    const opcion = this.page.locator(`${contenedorChosenSelector} .chosen-results li:not(.result-selected)`).first();
    const hayOpcion = await opcion.isVisible({ timeout: 3_000 }).catch(() => false);
    if (hayOpcion) {
      await opcion.click();
    } else {
      // Cerrar el Chosen desplegado sin elegir nada, presionando Escape.
      await this.page.keyboard.press('Escape');
    }
  }

  /**
   * Otra variante de _seleccionarPrimeraOpcionChosen(), para campos cuya
   * SECCIÓN COMPLETA (label + Chosen) puede no estar visible en absoluto
   * según la configuración de la compañía/país — a diferencia de
   * _seleccionarPrimeraOpcionChosenSiHayOpciones() (el trigger SÍ está
   * visible, pero su catálogo de opciones puede venir vacío), aquí el
   * propio trigger puede no llegar a renderizarse. Confirmado en vivo
   * (HONDURAS): "Sección" (a diferencia de "Tipo de Unidad", siempre
   * visible en el mismo paso "Costos" de "Crear Producto") queda oculta —
   * mismo criterio ya usado para CABYS y "Descuento de proveedor" en este
   * wizard: se intenta con un timeout corto propio y, si no aparece, se
   * omite en vez de fallar (no es un error, es un campo no aplicable en
   * esta configuración).
   */
  async _seleccionarPrimeraOpcionChosenSiEsPosible(contenedorChosenSelector: string): Promise<boolean> {
    const trigger = this.page.locator(`${contenedorChosenSelector} .chosen-single`);
    const visible = await trigger.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) return false;
    await this._seleccionarPrimeraOpcionChosen(contenedorChosenSelector);
    return true;
  }


  /**
   * Asegura que un checkbox de IVA quede en el estado pedido (marcado o
   * desmarcado), clickeándolo solo si hace falta (nunca a ciegas: un click
   * sobre un checkbox ya en el estado deseado lo invertiría). Reintenta con
   * `expect.poll` porque el propio click puede no sostenerse al primer
   * intento. Recibe el locator y el id del checkbox porque tanto "Producto
   * Rápido" (asegurarCheckboxIvaMarcado()) como "Crear Combo"
   * (activarIvaCombo()/desactivarIvaCombo()) tienen el suyo propio.
   */
  async _asegurarCheckboxEstado(checkbox: Locator, idParaClick: string, marcado: boolean) {
    await expect.poll(async () => {
      const actual = await checkbox.isChecked();
      if (actual !== marcado) {
        await this.page.evaluate((id) => (document.getElementById(id) as HTMLInputElement).click(), idParaClick);
      }
      return checkbox.isChecked();
    }, { timeout: TIMEOUTS.PAYMENT_MODAL }).toBe(marcado);
  }


  /**
   * Asegura que el checkbox "Aplicar impuesto" de "Producto Rápido" quede marcado.
   */
  async asegurarCheckboxIvaMarcado() {
    await this._asegurarCheckboxEstado(this.page.locator(L.QUICK_PRODUCT_APLICAR_IVA), 'check_quick_product_apply_tax', true);
  }


  async _llamarSetProductTotal(clave: string, porcentaje: string) {
    await this.page.evaluate(
      ({ key, value }) => {
        const el = document.getElementById(`input_product_discount_${key}`) as HTMLInputElement;
        if (el) el.value = value;
        (window as any).set_product_total(key);
      },
      { key: clave, value: porcentaje }
    );
  }


  async _leerValorDescuentoInput(clave: string): Promise<string> {
    return this.page.evaluate(
      (key) => (document.getElementById(`input_product_discount_${key}`) as HTMLInputElement)?.value ?? '0',
      clave
    );
  }


  /**
   * Detecta y cierra un diálogo de alerta (SweetAlert2 o Bootstrap modal visible).
   * Devuelve el texto completo del diálogo, o null si no había ninguno.
   */
  async _leerYCerrarAlerta(): Promise<string | null> {
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
   * Lee el texto de la opción actualmente seleccionada en un Chosen dado —
   * usado tanto por el cliente como por el vendedor de "Enviar a caja" para
   * confirmar (o simplemente leer) lo realmente elegido, sin asumirlo.
   */
  async _obtenerTextoChosenSeleccionado(contenedorChosenSelector: string): Promise<string> {
    return (await this.page.locator(`${contenedorChosenSelector} .chosen-single span`).textContent())?.trim() ?? '';
  }


  // ─── "Enviar a caja": descuento general ─────────────────────────────────────

  /**
   * Activa el descuento general — contraparte de desactivarDescuentoGeneral().
   * Reutiliza _asegurarCheckboxEstado() (el mismo helper genérico de
   * checkbox con slider CSS que ya usan IVA/Combo/Producto) en vez de
   * duplicar la lógica de click+poll.
   */
  async activarDescuentoGeneral() {
    await this._asegurarCheckboxEstado(this.page.locator(L.DESCUENTO_GENERAL), 'apply_general_discount', true);
  }


  /**
   * Expande el panel de detalle avanzado de totales (subtotal, descuento
   * general, impuestos) haciendo click en el bloque "Total:" — confirmado
   * en vivo que está oculto por defecto (showBillDetail()) y que, sin
   * expandirlo, el campo de porcentaje de descuento general
   * (DESCUENTO_GENERAL_PORCENTAJE) no es interactuable.
   */
  async mostrarDetalleAvanzadoFactura() {
    const campoPorcentaje = this.page.locator(L.DESCUENTO_GENERAL_PORCENTAJE);
    if (await campoPorcentaje.isVisible().catch(() => false)) return;

    await this.page.locator(L.TOTAL_FACTURA_TOGGLE).click();
    await expect(campoPorcentaje, 'El panel de detalle avanzado de totales no se expandió').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Ingresa el porcentaje de descuento general (mostrarDetalleAvanzadoFactura()
   * ya debe haberse llamado antes) y espera a que el monto de descuento
   * (DESCUENTO_GENERAL_MONTO) refleje un valor real antes de continuar —
   * espera basada en el propio estado de la aplicación, no en un tiempo fijo.
   */
  async establecerPorcentajeDescuentoGeneral(porcentaje: string) {
    const campo = this.page.locator(L.DESCUENTO_GENERAL_PORCENTAJE);
    await campo.fill(porcentaje);
    await campo.blur();

    await expect.poll(
      () => this.obtenerMontoDescuentoGeneralNumerico(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El monto de descuento general no reflejó el porcentaje ingresado' }
    ).toBeGreaterThan(0);
  }


  /** Lee el monto de descuento general actual como número. */
  async obtenerMontoDescuentoGeneralNumerico(): Promise<number> {
    const texto = await this.page.locator(L.DESCUENTO_GENERAL_MONTO).textContent() ?? '$0.00';
    return this._leerMontoDeTexto(texto);
  }


  /**
   * Convierte a número el texto de un monto monetario del DOM (p. ej.
   * "$1,234.56"), descartando cualquier carácter que no sea dígito o punto.
   * Único punto de esta conversión — reutilizado por todos los métodos que
   * leen un total/monto del POS (producto, venta, IVA general, descuento
   * general) para no repetir la misma expresión de parseo en cada uno.
   */
  _leerMontoDeTexto(texto: string): number {
    return parseFloat(texto.replace(/[^0-9.]/g, '')) || 0;
  }


  /**
   * Espera el SweetAlert v1 de confirmación ("¿Está seguro...?") y hace click
   * en "Aceptar" — patrón compartido por confirmarCerrarCaja() y
   * enviarOrdenCaja(), que antes repetían cada uno el mismo selector y click
   * por su cuenta. Si se indica `mensajeSiNoAparece`, la espera de
   * visibilidad usa `expect().toBeVisible()` con ese mensaje (igual que ya
   * hacía enviarOrdenCaja()); si no, usa `waitFor()` sin mensaje propio
   * (igual que ya hacía confirmarCerrarCaja()) — se preserva el
   * comportamiento exacto de cada llamador original.
   */
  async _confirmarSweetAlertV1(mensajeSiNoAparece?: string) {
    const dialogo = this.page.locator('.sweet-alert.visible');
    if (mensajeSiNoAparece) {
      await expect(dialogo, mensajeSiNoAparece).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    } else {
      await dialogo.waitFor({ state: 'visible', timeout: TIMEOUTS.PAYMENT_MODAL });
    }
    await this.page.locator('.sweet-alert.visible button.confirm').click();
  }


  // ─── Composiciones reutilizables de "agregar un producto más" ─────────────
  // Ambas centralizan una composición que ya existía duplicada como helper
  // local en pos-orden-caja.spec.ts (agregarProductoRapidoSimple) — al
  // necesitarse también en pos-proforma.spec.ts, se centralizan aquí en vez
  // de sumar una tercera copia. Ninguna de las dos agrega lógica nueva: solo
  // componen métodos ya existentes de este mismo Page Object.

  /**
   * Agrega un Producto Rápido mínimo al carrito (sin IVA, irrelevante para
   * los escenarios que solo necesitan "un producto rápido más" en el
   * carrito). No fuerza CABYS ni IVA: pero completa CABYS con
   * `manejarCabysSiAplica()` —el mismo mecanismo que ya usa
   * `agregarProductoRapidoParaValidacionIva()`, que no hace nada si el campo
   * no existe— porque confirmado en vivo (TALLER ALPHA PREMIUM, Costa Rica
   * con facturación electrónica real) que ahí CABYS es obligatorio incluso
   * para un producto sin IVA: sin completarlo, el botón "Agregar" no dispara
   * ningún AJAX (bloqueo silencioso del lado del cliente, sin toast) y
   * `guardarProductoRapidoYObtenerRespuesta()` expira esperando una respuesta
   * que nunca llega. En ambientes donde CABYS no existe (p. ej. HONDURAS,
   * confirmado en vivo que no lo exige) este paso es un no-op y el
   * comportamiento queda idéntico al de antes.
   */
  async agregarProductoRapidoSimple(nombre: string, precio: string) {
    await this.abrirProductoRapido();
    await this.llenarDatosBasicosProductoRapido(nombre, precio);
    if (await this.manejarCabysSiAplica(CABYS_BUSQUEDA)) {
      await this.esperarIvaAutocompletado();
    }
    await this.guardarProductoRapidoYObtenerRespuesta();
    await expect(this.modalProductoRapido).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Localiza un Producto Fraccionado YA EXISTENTE en el catálogo —por
   * evidencia funcional real (is_fragmented=1 en add_to_table(), ver
   * `obtenerPrimerProductoFraccionado`), nunca por nombre ni por categoría—
   * y lo agrega al carrito, en vez de crear uno nuevo solo para tener "algo
   * fraccionado" que facturar/enviar a caja/cotizar, que es todo lo que
   * estos escenarios necesitan realmente. Devuelve la clave de la línea
   * agregada.
   */
  async agregarProductoFraccionadoExistente(cantidadFracciones = '1'): Promise<string> {
    const metadato = await this.obtenerPrimerProductoFraccionado();
    return this.agregarProductoFraccionadoAlCarrito(metadato, cantidadFracciones);
  }


  /**
   * Agrega al carrito los tres tipos de producto que necesitan Orden de Caja
   * y Proforma: un Fraccionado y un normal ya existentes en el catálogo
   * (localizados por característica funcional, nunca por nombre ni
   * categoría) y un Producto Rápido nuevo. `contexto` (p. ej. "Orden Caja" /
   * "Proforma") y `sufijo` solo etiquetan el nombre del Producto Rápido
   * creado, para distinguirlo en el carrito entre ejecuciones. Centralizado
   * aquí: existía duplicado (idéntico salvo esa etiqueta) como función local
   * en pos-orden-caja.spec.ts (agregarProductosMultiples) y
   * pos-proforma.spec.ts (agregarProductosMixtos).
   */
  async agregarProductoNormalFraccionadoYRapido(contexto: string, sufijo: string) {
    await this.agregarProductoFraccionadoExistente();
    const productoNormal = await this.obtenerPrimerProductoNormal();
    await this.agregarProductoAlCarrito(productoNormal);
    await this.agregarProductoRapidoSimple(`Rápido ${contexto} ${sufijo}`, PRECIO_PRODUCTO_RAPIDO);
  }


  // ─── Carrito: Exoneración ───────────────────────────────────────────────────
  // Misma sección de detalle avanzado que Descuento General — ver el
  // comentario de L.EXONERACION_BTN_AGREGAR para la evidencia completa.
  // mostrarDetalleAvanzadoFactura() (ya existente) debe llamarse antes: es la
  // que revela ".advanced_invoice_detail", clase que también cubre esta fila.

  /** Abre el modal "APLICAR EXONERACIÓN" (botón "Agregar" de la fila Exoneración). */
  async abrirModalExoneracion() {
    await this.page.locator(L.EXONERACION_BTN_AGREGAR).click();
    await expect(
      this.page.locator(L.DIALOG_EXONERACION),
      'El modal "APLICAR EXONERACIÓN" no apareció'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Llena los 3 campos realmente visibles del modal de exoneración en este
   * ambiente (ver el comentario de L.EXONERACION_BTN_AGREGAR: el resto nace
   * oculto) y confirma con "Aplicar". Espera a que el modal se cierre y a que
   * el monto de exoneración (EXONERACION_MONTO_TOTAL) refleje un valor real
   * antes de continuar — mismo criterio que establecerPorcentajeDescuentoGeneral().
   */
  async aplicarExoneracion(porcentaje: string, numeroDocumento = 'EXO-QA', textoOrden = 'Orden de Exoneración QA') {
    await this.page.locator(L.EXONERACION_NUMERO_DOCUMENTO).fill(numeroDocumento);
    await this.page.locator(L.EXONERACION_TEXTO_ORDEN).fill(textoOrden);
    await this.page.locator(L.EXONERACION_PORCENTAJE_INPUT).fill(porcentaje);
    await this.page.locator(L.EXONERACION_BTN_APLICAR).click();

    await expect(
      this.page.locator(L.DIALOG_EXONERACION),
      'El modal "APLICAR EXONERACIÓN" no se cerró tras presionar "Aplicar"'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await expect.poll(
      () => this.obtenerMontoExoneracionNumerico(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El monto de exoneración no reflejó el porcentaje ingresado' }
    ).toBeGreaterThan(0);
  }


  /** Lee el monto de exoneración actual como número (mismo parseo que obtenerMontoDescuentoGeneralNumerico()). */
  async obtenerMontoExoneracionNumerico(): Promise<number> {
    const texto = await this.page.locator(L.EXONERACION_MONTO_TOTAL).textContent() ?? '$0.00';
    return this._leerMontoDeTexto(texto);
  }


  /**
   * Cancela la Exoneración si está aplicada, dejando el carrito/sesión sin
   * ella para el siguiente test. Necesario porque, igual que Descuento
   * General (ver el comentario del test 21 de pos-orden-caja.spec.ts) y la
   * Moneda (ver asegurarMonedaBaseActiva()), la Exoneración aplicada
   * persiste más allá de una sola venta — confirmado en vivo: una Orden de
   * Caja creada SIN llamar nunca a aplicarExoneracion() apareció con
   * "Exoneración (10%)" ya reflejada en sus totales, heredada de la última
   * vez que sí se aplicó en esa misma sesión/página. El botón "Eliminar"
   * dispara su propio SweetAlert de confirmación ("¿Está seguro de eliminar
   * la exoneración?") — confirmado en vivo, mismo patrón que el resto de la
   * suite, reutilizando _confirmarSweetAlertV1().
   */
  async cancelarExoneracionSiEstaAplicada() {
    const boton = this.page.locator(L.EXONERACION_BTN_CANCELAR);
    if (!(await boton.isVisible().catch(() => false))) return;

    await boton.click();
    await this._confirmarSweetAlertV1('No apareció la confirmación "¿Está seguro de eliminar la exoneración?"');

    await expect.poll(
      () => this.obtenerMontoExoneracionNumerico(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'La exoneración no quedó en $0.00 tras cancelarla' }
    ).toBe(0);
  }


  // ─── Moneda del POS ─────────────────────────────────────────────────────────
  //
  // Ningún método existente de esta clase toca moneda — sección enteramente
  // nueva, necesaria porque una Proforma de Taller solo puede crearse en la
  // moneda base de la compañía (confirmado en vivo, Fase 1), y esta nunca
  // debe asumirse (no siempre es CRC, ni Lempira pese a que la compañía de
  // este ambiente se llame "Honduras": en este ambiente la base real es
  // USD, confirmado por el propio backend vía currency_base_symbol).

  /**
   * Abre el menú de moneda (#menu_type_currency, mismo tipo de botón MDL que
   * el resto de menús del POS) y clickea la opción indicada, reintentando y
   * cerrando los overlays conocidos (notificaciones, toasts) en cada vuelta.
   * Confirmado en vivo que overlays conocidos —y un tooltip propio del
   * botón ("powerTip")— interceptan el click de forma intermitente, igual
   * que ya se documentó para #menu_cash/#demo-menu-top-right; el mismo
   * patrón de reintento ya probado en abrirMenuOrdenCaja() resuelve esto
   * aquí también. Devuelve el cuerpo de la respuesta real de
   * setTypeCurrencyReceipByUser.
   *
   * MAX_INTENTOS en 8 (no 4-5 como el resto de menús): confirmado en vivo
   * que el modal de permisos de notificación puede reaparecer de forma
   * asíncrona en cualquier momento —incluso entre el cierre de una vuelta y
   * el click de la siguiente—, y con 5 intentos esto agotó el bucle
   * completo al menos una vez en pruebas repetidas; cada intento sigue
   * acotado individualmente, así que más intentos no arriesgan colgar el
   * test, solo dan más oportunidades de ganarle la carrera al overlay.
   */
  async _seleccionarOpcionMoneda(opcion: Locator): Promise<{ currency_symbol: string; currency_base_symbol: string }> {
    const MAX_INTENTOS = 8;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      await this.cerrarTodosLosToastsSiAparecen();

      // Este proyecto no configura un actionTimeout por defecto — sin un
      // límite propio en ESTE click, un overlay que lo bloquee dejaría la
      // espera colgada hasta el timeout completo del test (confirmado en
      // vivo: ocurrió exactamente así antes de acotar este click), sin que
      // el bucle de reintento llegara siquiera a su segunda vuelta.
      const menuAbierto = await this.page.locator(L.MENU_MONEDA_BTN)
        .click({ timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (!menuAbierto) continue;

      const respuestaPromise = this.page.waitForResponse(
        (res) => res.url().includes(L.AJAX_CAMBIO_MONEDA),
        { timeout: 4_000 }
      ).catch(() => null);
      const clickeado = await opcion.click({ timeout: 4_000 }).then(() => true).catch(() => false);

      if (clickeado) {
        const respuesta = await respuestaPromise;
        if (respuesta) return respuesta.json();
      }
    }
    throw new Error(`No se pudo seleccionar la opción de moneda tras ${MAX_INTENTOS} intentos`);
  }


  /**
   * Lee la moneda actualmente activa y la moneda base real de la compañía,
   * reconfirmando la selección activa (mismo clic, sin cambiar nada) para
   * obtener una respuesta fresca de setTypeCurrencyReceipByUser — confirmado
   * en vivo que currency_base_symbol se mantiene fijo sin importar cuál
   * moneda esté activa (a diferencia de la propia selección, que si
   * cambia), así que es la única fuente confiable para no asumir cuál es la
   * moneda base.
   */
  async obtenerInfoMoneda(): Promise<{ simboloActivo: string; simboloBase: string }> {
    const opcionActiva = this.page.locator(L.MENU_MONEDA_ITEM).filter({
      has: this.page.locator('.icon_type_currency_print_active_by_user:visible'),
    });
    const cuerpo = await this._seleccionarOpcionMoneda(opcionActiva);
    return { simboloActivo: cuerpo.currency_symbol, simboloBase: cuerpo.currency_base_symbol };
  }


  /**
   * Cambia la moneda activa del POS a la indicada por su símbolo (p. ej.
   * "$", "₡", "L") — usado tanto para llevar la moneda a la base antes de
   * una Proforma de Taller como para restaurar la moneda original al
   * terminar el test.
   */
  async cambiarMoneda(simbolo: string): Promise<string> {
    const opcion = this.page.locator(L.MENU_MONEDA_ITEM).filter({
      has: this.page.locator('.icon_type_currency_print_by_user', { hasText: simbolo }),
    });
    const cuerpo = await this._seleccionarOpcionMoneda(opcion);
    expect(cuerpo.currency_symbol, `No se pudo cambiar la moneda a "${simbolo}"`).toBe(simbolo);
    return cuerpo.currency_symbol;
  }


  /**
   * Lee todos los símbolos de moneda disponibles en el menú (p. ej. ["L",
   * "$", "₡"], catálogo configurable por la empresa, nunca hardcodeado) —
   * necesario para elegir una moneda "distinta de la base" sin asumir
   * cuáles monedas concretas ofrece cada compañía/ambiente. Los `<li>` del
   * menú MDL existen en el DOM desde la carga (confirmado en vivo), así que
   * su texto puede leerse sin necesidad de abrir el menú primero.
   */
  async obtenerSimbolosMonedaDisponibles(): Promise<string[]> {
    const textos = await this.page.locator(`${L.MENU_MONEDA_ITEM} .icon_type_currency_print_by_user`).allTextContents();
    return textos.map((t) => t.trim()).filter((t) => t.length > 0);
  }


  /**
   * Verifica cuál es la moneda base real de la compañía (nunca asumida) y,
   * si la moneda activa no coincide, cambia automáticamente a ella —
   * necesario porque una Proforma de Taller solo puede crearse en la
   * moneda base (confirmado en vivo: en moneda no-base, "Crear Proforma"
   * queda bloqueado en silencio, sin SweetAlert ni AJAX). Devuelve el
   * símbolo de la moneda ORIGINAL (antes de este método), para que el test
   * la restaure con cambiarMoneda() al terminar — confirmado en vivo que
   * esta configuración persiste por usuario en el servidor, no por sesión
   * de navegador, así que no restaurarla puede afectar a otros tests.
   */
  async asegurarMonedaBaseActiva(): Promise<string> {
    const { simboloActivo, simboloBase } = await this.obtenerInfoMoneda();
    if (simboloActivo !== simboloBase) {
      await this.cambiarMoneda(simboloBase);
    }
    return simboloActivo;
  }


  /**
   * Lee el símbolo de moneda (p. ej. "$", "₡") con el que el total de venta
   * (L.TOTAL_MODAL) se muestra actualmente — alternativa de solo lectura a
   * obtenerInfoMoneda() para los momentos en los que #menu_type_currency no
   * es una opción: confirmado en vivo que ese botón queda oculto
   * (isVisible() === false, aunque isEnabled() siga en true) mientras hay una
   * Orden de Caja cargada en el carrito, lo que hace fallar
   * _seleccionarOpcionMoneda() (necesita abrir ese menú) incluso solo para
   * leer, sin cambiar nada.
   */
  async obtenerSimboloMonedaEnTotal(): Promise<string> {
    const texto = await this.page.evaluate(
      (id) => document.getElementById(id)?.textContent ?? '',
      L.TOTAL_MODAL
    );
    return texto.match(/[^\d.,\s]+/)?.[0] ?? '';
  }


  /** Cuenta las filas actualmente cargadas en el carrito (`#table_buy_list tr.main_row`):
   * a diferencia de `obtenerClavesProductos()` (que solo cuenta líneas con id
   * "drag_and_drop_"), esta cuenta TODAS las filas sin importar su origen —
   * incluye tanto las importadas de una factura (sin ese id) como las agregadas
   * normalmente desde el catálogo (con ese id) — confirmado en vivo. Útil para
   * validar que una factura importada realmente cargó líneas al carrito, algo
   * que `obtenerClavesProductos()` no puede detectar por sí solo.
   *
   * OJO: no es "1 fila por producto" — confirmado en vivo que cada producto
   * genera 4 `tr.main_row` (`table_product_name_<clave>`, `_id_<clave>`,
   * `_h_w_id_<clave>`, `_modifier_<clave>`; solo la primera es la fila
   * "visible" real). Para saber cuántos PRODUCTOS/líneas distintas hay,
   * usar `obtenerClavesFilasCarrito().length` (o `obtenerClavesProductos()`
   * si se sabe que ninguna línea es importada) — no este método.
   */
  async obtenerCantidadFilasCarrito(): Promise<number> {
    return this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).count();
  }


  /**
   * Devuelve el texto combinado de todas las líneas actualmente en el
   * carrito (`#table_buy_list`), tanto las importadas de una factura como las
   * agregadas normalmente desde el catálogo. Necesario para poder elegir un
   * producto del catálogo que TODAVÍA NO esté en el carrito antes de
   * agregarlo: confirmado en vivo que add_to_table() no crea una línea nueva
   * para un producto que ya está presente (por ejemplo, uno que ya viene
   * incluido en la factura recién importada) — en vez de eso, le suma la
   * cantidad a la línea existente, así que ni obtenerClavesProductos() (no
   * aparece ninguna clave nueva) ni obtenerCantidadFilasCarrito() (no aparece
   * ninguna fila nueva) detectan ese "agregado" — comportamiento real del
   * sistema, no un fallo de la suite ni del producto en particular.
   */
  async obtenerTextoCarrito(): Promise<string> {
    return this.page.locator('#table_buy_list').innerText();
  }


  /**
   * Localiza el primer producto normal (tipoItem=1, no fraccionado) o
   * servicio (tipoItem=2) del catálogo que TODAVÍA NO esté en el carrito —
   * necesario para escenarios que agregan productos DESPUÉS de cargar al
   * carrito una venta ya existente (factura importada, Orden de Caja): ver
   * el comentario de obtenerTextoCarrito() sobre por qué un producto ya
   * presente no puede agregarse como línea nueva. Centraliza la lógica que
   * antes vivía duplicada como función local en pos-importar-factura.spec.ts
   * (agregarProductoYServicioDesdeCatalogo) — necesaria de nuevo aquí, así
   * que se promueve a PosPage en vez de duplicarla una segunda vez.
   */
  async obtenerPrimerProductoNoPresenteEnCarrito(tipoItem: 1 | 2 = 1): Promise<MetadatoProducto> {
    const textoCarrito = await this.obtenerTextoCarrito();
    return this.localizarPrimerProducto(
      (m) => m.tipoItem === tipoItem && !m.esFraccionado && !this.nombreApareceEnCarrito(m.nombre, textoCarrito),
      tipoItem === 1 ? 'producto normal que todavía no esté en el carrito' : 'servicio que todavía no esté en el carrito'
    );
  }


  /**
   * Indica si un producto (por su `nombre` del catálogo, ver
   * obtenerMetadatosProductosVisibles()) ya aparece en el texto real del
   * carrito. Corrección de automatización (causa raíz confirmada en vivo,
   * instrumentación dedicada): `nombre` es el `textContent` completo de la
   * tarjeta del grid, que puede incluir un código/SKU como prefijo (p. ej.
   * "RT543-000002 A11 - PROT. BLING GLITTER ROSA"), pero el carrito
   * (#table_buy_list) NO muestra ese código, solo el nombre visible ("A11 -
   * PROT. BLING GLITTER ROSA"). Una comparación por substring exacto contra
   * el nombre completo del catálogo nunca coincidía aunque el producto SÍ
   * estuviera ya en el carrito, haciendo que
   * obtenerPrimerProductoNoPresenteEnCarrito() (y sus variantes) "eligieran"
   * un producto que en realidad ya estaba presente: add_to_table() solo le
   * suma cantidad a la línea existente en vez de crear una nueva, y el
   * expect.poll() que espera una clave nueva nunca se cumplía (reproducido
   * en vivo con Proformas de Taller que ya traen líneas propias al
   * cargarse). Se prueba también contra el nombre sin un posible código
   * inicial (primer token separado por espacio) para cubrir ese formato.
   * Público (antes privado): reutilizado también por escenarios que
   * necesitan su propia búsqueda "no presente en el carrito" con exclusión
   * adicional (p. ej. reintentar con el siguiente candidato si el primero
   * no tiene código real) — evita duplicar esta misma comparación.
   */
  nombreApareceEnCarrito(nombre: string, textoCarrito: string): boolean {
    if (textoCarrito.includes(nombre)) return true;
    const sinCodigo = nombre.replace(/^\S+\s+/, '');
    return sinCodigo !== nombre && textoCarrito.includes(sinCodigo);
  }


  /**
   * Variante fraccionada de obtenerPrimerProductoNoPresenteEnCarrito(): mismo
   * motivo exacto (add_to_table() no crea línea nueva para un producto ya
   * presente en el carrito, solo le suma cantidad a la existente — ver el
   * comentario de obtenerTextoCarrito()), pero para escenarios que agregan un
   * Fraccionado DESPUÉS de cargar al carrito una Orden de Caja ya existente.
   * Investigado en vivo (3/3 corridas): el primer Fraccionado del catálogo
   * (obtenerPrimerProductoFraccionado(), determinístico) resultó estar YA
   * presente en la Orden de Caja "primera disponible" que cargarPrimeraOrdenCajaDisponible()
   * también elige de forma determinística — ambos "primeros" chocan
   * consistentemente en este ambiente compartido, dejando
   * agregarProductoFraccionadoAlCarrito() esperando para siempre una clave
   * nueva que nunca aparece (el modal "Seleccionar Cantidad" sí se completa y
   * cierra con éxito; el carrito simplemente no gana una línea nueva).
   */
  async obtenerPrimerProductoFraccionadoNoPresenteEnCarrito(): Promise<MetadatoProducto> {
    const textoCarrito = await this.obtenerTextoCarrito();
    return this.localizarPrimerProducto(
      (m) => m.esFraccionado && !this.nombreApareceEnCarrito(m.nombre, textoCarrito),
      'producto Fraccionado que todavía no esté en el carrito'
    );
  }


  /**
   * Variante "con IVA" de obtenerPrimerProductoNoPresenteEnCarrito(): mismo
   * motivo exacto (ver el comentario de obtenerTextoCarrito()) — necesaria
   * para escenarios que agregan un producto con IVA DESPUÉS de cargar al
   * carrito una venta ya existente (p. ej. una Orden de Ruteo ya
   * seleccionada, que siempre trae al menos un producto propio). Confirmado
   * en vivo que el primer producto normal del catálogo (obtenerPrimerProductoNormal(),
   * determinístico) es, en la práctica, el mismo que la propia suite ya usa
   * para crear la Orden de Ruteo base (agregarUnProducto() en
   * pos-ruteo.spec.ts) — buscarlo y "agregarlo" de nuevo sin este filtro
   * termina sumando cantidad a la línea ya existente (updateItemFromRoutingOrder)
   * en vez de crear una línea nueva, dejando obtenerClavesProductos() sin
   * ninguna clave nueva que detectar.
   */
  async obtenerPrimerProductoConIvaNoPresenteEnCarrito(): Promise<MetadatoProducto> {
    const textoCarrito = await this.obtenerTextoCarrito();
    return this.localizarPrimerProducto(
      (m) => m.tipoItem === 1 && m.aplicaIva && !this.nombreApareceEnCarrito(m.nombre, textoCarrito),
      'producto con IVA que todavía no esté en el carrito'
    );
  }


  /**
   * Presiona "AGREGAR ITEMS" (#add_btn_items) para abrir el catálogo normal de
   * Productos/Servicios y poder agregar más líneas a una venta ya armada
   * (importada de una factura, cargada desde una Orden de Caja, etc.). El
   * propio sistema deja el tab "Productos" activo por defecto al abrir esta
   * vista (confirmado en vivo, sin necesidad de clickear tabProductos aparte)
   * y sustituye este botón por "Volver" (ver volverDesdeAgregarItem()) en el
   * mismo lugar de la interfaz. Generalizado desde
   * abrirAgregarItemImportarFactura() (que ahora es un wrapper de este
   * método): el botón y su comportamiento son 100% genéricos — nunca
   * dependieron de "Importar Factura" en particular, confirmado en vivo que
   * el mismo botón aparece igual tras cargar una Orden de Caja.
   */
  async abrirAgregarItem() {
    const boton = this.page.locator(L.IMPORTAR_FACTURA_BTN_AGREGAR_ITEM);
    await expect(boton, 'El botón "AGREGAR ITEMS" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await boton.click();

    await expect(
      this.page.locator(PESTANA_POS_FACTURACION.contenedorContenido),
      'El catálogo de Productos no quedó visible tras presionar "AGREGAR ITEMS"'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await expect.poll(
      () => this.tabEstaActivo(this.tabProductos),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El tab "Productos" no quedó activo tras presionar "AGREGAR ITEMS"' }
    ).toBe(true);
  }


  /**
   * Indica si la vista actual es la del catálogo abierto por
   * abrirAgregarItem(): el botón "Volver" (IMPORTAR_FACTURA_BTN_VOLVER,
   * #hide_btn_items) reemplaza a "AGREGAR ITEMS" en ese mismo lugar de la
   * interfaz mientras esa vista está activa (ver el comentario de
   * abrirAgregarItem()) y solo entonces. Útil para escenarios que deben
   * confirmar que NUNCA entraron a ese flujo — confirmado en vivo que el
   * catálogo de productos (L.PRODUCTO) sigue presente en el DOM y sus
   * métodos de lectura (obtenerCodigoProducto()/obtenerPrimerProducto*())
   * funcionan igual sin pasar por "Agregar Ítem", así que la sola presencia
   * de esas tarjetas no basta para confirmar que se entró a ese flujo.
   */
  async seEncuentraEnVistaAgregarItem(): Promise<boolean> {
    return this.page.locator(L.IMPORTAR_FACTURA_BTN_VOLVER).isVisible().catch(() => false);
  }


  /**
   * Presiona "Volver" (#hide_btn_items) para regresar de la vista de catálogo
   * (abierta con abrirAgregarItem()) a la pestaña de origen indicada, sin
   * perder ninguna línea ya cargada en el carrito — confirmado en vivo que
   * #table_buy_list conserva tanto las líneas ya cargadas (importadas de una
   * factura, o de una Orden de Caja) como las agregadas manualmente desde el
   * catálogo en ambos sentidos de esta navegación, y que los descuentos ya
   * aplicados (general) también se conservan. Generalizado desde
   * volverDesdeAgregarItemImportarFactura() (que ahora es un wrapper de este
   * método) para aceptar cualquier pestana de PESTANAS_POS_A_RECORRER, no
   * solo "Importar factura" — el botón #hide_btn_items es el mismo en ambos
   * casos, confirmado en vivo.
   */
  async volverDesdeAgregarItem(pestana: PestanaPos) {
    const boton = this.page.locator(L.IMPORTAR_FACTURA_BTN_VOLVER);
    await expect(boton, 'El botón "Volver" no apareció en la vista de catálogo').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await boton.click();

    await expect(
      this.page.locator(pestana.contenedorContenido),
      `La pestaña "${pestana.etiqueta}" no quedó visible tras presionar "Volver"`
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await expect(
      this.page.locator(pestana.selector),
      `La pestaña "${pestana.etiqueta}" no quedó activa tras presionar "Volver"`
    ).toHaveClass(new RegExp(L.PESTANA_POS_CLASE_ACTIVA));
  }


  // ─── Precio visible de producto (grid) ─────────────────────────────────────

  /**
   * Localiza el precio VISIBLE de un producto en el grid por su nombre exacto
   * (mismo criterio de escape/coincidencia que productoPorNombre()) — el que
   * realmente cambia con la moneda activa, a diferencia del valor crudo
   * oculto (#original_price_product_stock_<id>), que se mantiene constante
   * sin importar la moneda (confirmado en vivo, Fase 1 de "Cambio de
   * moneda"). Es hermano de la card del nombre dentro del mismo .product_box,
   * no un descendiente directo, de ahí el ancestor::.
   */
  precioVisibleProducto(nombre: string): Locator {
    return this.productoPorNombre(nombre)
      .locator('xpath=ancestor::*[contains(@class,"product_box")][1]')
      .locator(L.PRODUCTO_PRECIO_VISIBLE);
  }


  /** Lee el precio visible actual de un producto en el grid como texto (con símbolo de moneda). */
  async obtenerPrecioVisibleProducto(nombre: string): Promise<string> {
    return (await this.precioVisibleProducto(nombre).textContent()) ?? '';
  }


  /**
   * Lee el código interno de un producto del grid por su nombre exacto —
   * necesario para el buscador interno de Vista Expandida, que filtra por
   * código y no por nombre (confirmado en vivo). Debe leerse mientras la
   * grilla sigue visible (Vista Normal), antes de activar Vista Expandida.
   */
  async obtenerCodigoProducto(nombre: string): Promise<string> {
    const producto = this.productoPorNombre(nombre);
    await expect(producto, `No se encontró exactamente un producto llamado "${nombre}" en el catálogo`).toHaveCount(1, { timeout: TIMEOUTS.PRODUCTS_LOAD });

    return producto
      .locator('xpath=ancestor::*[contains(@class,"product_box")][1]')
      .locator(L.PRODUCTO_CODIGO_OCULTO)
      .inputValue();
  }


  // ─── Vaciar Carrito ─────────────────────────────────────────────────────────

  /**
   * Presiona "Vaciar Carrito" (L.BTN_VACIAR_CARRITO, junto a "Facturar") y
   * confirma el SweetAlert que abre, reutilizando el mismo patrón privado ya
   * centralizado en _confirmarSweetAlertV1(). Confirmado en vivo que la
   * limpieza es puramente client-side (no dispara ningún AJAX), así que no
   * hay una respuesta de red que esperar aquí: quien llama debe validar el
   * resultado contra el estado real del DOM (ver validarCarritoVacio()).
   */
  async vaciarCarrito(): Promise<void> {
    await this.page.locator(L.BTN_VACIAR_CARRITO).click();
    await this._confirmarSweetAlertV1('No apareció la confirmación de "Vaciar Carrito"');
    await this.page.locator('.sweet-alert.visible').waitFor({ state: 'hidden', timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /** Lee el total visible del footer principal del POS (NO el modal de pago) como número. */
  async obtenerTotalVisiblePosNumerico(): Promise<number> {
    const texto = await this.page.locator(L.TOTAL_VISIBLE_POS).textContent();
    return this._leerMontoDeTexto(texto ?? '$0.00');
  }


  /**
   * Indica si el botón "Facturar" quedó deshabilitado (atributo disabled o
   * pointer-events:none) — confirmado en vivo que, en este ambiente, vaciar
   * el carrito NO lo deshabilita (sigue clickeable), a diferencia de lo que
   * podría asumirse; se expone este chequeo real en vez de asumirlo.
   */
  async facturarEstaDeshabilitado(): Promise<boolean> {
    return this.page.evaluate((selector) => {
      const btn = document.querySelector(selector);
      if (!btn) return false;
      return btn.hasAttribute('disabled') || getComputedStyle(btn).pointerEvents === 'none';
    }, L.BTN_FACTURAR);
  }

  // Estas 3 quedaron originalmente agrupadas junto a "Importar Factura" (de
  // donde se movieron aquí, corrección posterior a la extracción de
  // PosRuteo): son genéricas del cliente seleccionado en el carrito, no
  // específicas de ese flujo — tanto Importar Factura como Ruteo (al
  // facturar una Orden de Ruteo ya cargada) las necesitan.

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
}

// URL real del POS ya resuelta al menos una vez en este proceso worker — ver
// el comentario completo (idéntico al original) en irAlPos()/
// _irAlPosResolviendoCompania() más arriba. Movida aquí junto con los únicos
// métodos que la usan.
