import { expect, Locator, Page } from '@playwright/test';
import { TIMEOUTS } from '../pos/pos.page';
import { esperarVentanaImpresion } from '../pos/pos.utils';

// Locators y mecánica propios del módulo "Cocina" del sistema — confirmado en
// vivo ÚNICAMENTE contra el ambiente qa_restaurant (compañía "Restaurante
// Rancho Robertos"), mismo criterio que pos-restaurante-mesas.page.ts/
// pos-restaurante-ordenes-llevar.page.ts (ver sus cabeceras): estos ids no se
// agregan a pos.locators.ts (compartido con el resto de la suite, ajena a
// Restaurante).
//
// ─── Cómo se llega a Cocina (investigado a fondo, no asumido) ─────────────
// Cocina NO es un tab dentro del POS (a diferencia de MESAS/PARA LLEVAR) —
// es un MÓDULO COMPLETAMENTE APARTE con su propia URL
// (`/kitchen/kitchen?company=<id>`), alcanzado desde el sidebar del
// Dashboard: el mismo submenú "FACTURAR" que ya contiene "Crear factura"
// tiene un tercer ítem hermano "Cocina" (`<a onclick="get_company_pos_select(10)">`,
// confirmado leyendo el HTML real del sidebar — "Crear factura"=1,
// "Cocina"=10, "Cotizaciones"=5). La función real `get_company_pos_select()`
// (`general_functions.js`) resuelve la compañía vía AJAX
// (`comp/getCompanyPosSelect`) y, SOLO si `redirect===10` Y la compañía es de
// tipo restaurante (`#is_restautant===1`), llama a `redirect_to_kitchen()`
// (misma función) en vez de navegar a la URL normal del POS
// (`pointOfSale`) — confirmado leyendo `general_functions.js` real, con el
// comentario explícito del propio código fuente: "Validar si es
// 'Restaurante' y si tiene que redireccionar a 'Cocina'". Por eso
// `PosCore._irAlPosResolviendoCompania()` (pensado para destinos que
// terminan en una URL `pointOfSale`) NO sirve para Cocina — se implementa
// aquí una navegación dedicada, con el mismo patrón de expansión de submenú
// y click nativo ya establecido en ese método, pero esperando la URL real
// de Cocina en vez de `pointOfSale`.
//
// ─── El modelo real de "tarjetas" de Cocina (el hallazgo más importante) ──
// Confirmado en vivo con 4 experimentos controlados independientes (2
// páginas simultáneas — mesero + cocina — para evitar depender de
// recargar/renavegar): Cocina NO es un espejo en vivo del estado ACTUAL de
// cada orden. Es un REGISTRO DE EVENTOS: cada acción real sobre una línea
// del carrito (agregar un producto nuevo, cambiar su cantidad, agregar/
// cambiar su observación) genera una tarjeta NUEVA e independiente en
// Cocina, agrupada visualmente por el mismo "Orden #" pero NUNCA actualiza
// ni reemplaza una tarjeta ya existente:
//   - Agregar Producto A → 1 tarjeta. Agregar Producto B después → una
//     SEGUNDA tarjeta separada (ambas bajo el mismo "Orden #"), no una
//     tarjeta con A+B.
//   - Cambiar SOLO la cantidad de una línea ya con tarjeta (sin agregar
//     ningún producto nuevo) → genera OTRA tarjeta más, con el mismo
//     producto — confirmado en vivo (1 tarjeta → 2 tarjetas tras cambiar
//     cantidad de 1 a 5, ambas mostrando el mismo nombre de producto, sin
//     mostrar la cantidad numérica en el texto visible de la tarjeta).
//   - NINGUNA tarjeta desaparece por sí sola: no hay "reemplazo", solo
//     acumulación — el número de tarjetas de una orden crece con cada envío,
//     nunca decrece salvo acción explícita (ver "Orden lista" abajo).
// Esto es un hallazgo real del sistema, no un bug de automatización: se
// reprodujo de forma determinística las 3 veces que se probó. Cualquier
// método de este Page Object que necesite "la tarjeta de una orden" debe
// asumir que puede haber MÁS DE UNA, nunca exactamente una.
//
// ─── Estructura real de una tarjeta (confirmada volcando su HTML real) ────
// Contenedor: `#cards_content` → una `<div class="...card_orders card_div_content
// card_<idTarjeta> ... card_table|card_delivery ...">` por tarjeta, con
// `id="card_<idTarjeta>"` (idTarjeta es un id técnico propio de la tarjeta,
// NUNCA el id de la orden ni el de la línea del carrito). Clase modificadora
// real: `card_table` para una tarjeta que viene de una Mesa, `card_delivery`
// para una que viene de una orden Para Llevar (confirmado en vivo, ambas
// probadas). Dentro de cada tarjeta, campos ocultos reales sufijados con
// `idTarjeta` (NO con el id de mesa/orden) — OJO, de DOS tipos de elemento
// distintos, confirmado volcando el HTML real (un error real de
// automatización en una versión anterior de este archivo asumía que todos
// eran `<input>`, cuando `table_id`/`table_name` son `<p class="hide">`: un
// `.inputValue()` sobre un `<p>` no lanza error, solo devuelve siempre ""
// en silencio):
//   - `#card_item_real_id_<idTarjeta>` (`<input>` real) → el id REAL de la
//     orden ("Orden #" visible, el mismo `ordenId` que ya usan
//     PosRestauranteMesas/PosRestauranteOrdenesLlevar).
//   - `#table_id_<idTarjeta>` (`<p class="hide">`, leer con `.textContent()`)
//     → id real de la mesa (mesas) — para una orden Para Llevar este mismo
//     campo también existe pero no representa una mesa real.
//   - `#table_name_<idTarjeta>` (`<p class="hide">`, `.textContent()`) →
//     nombre de mesa a mostrar, vacío si la mesa no tiene nombre propio
//     asignado (mesas de esta suite QA, sin nombre por defecto) — para Para
//     Llevar vale literalmente el texto "Para llevar" (confirmado en vivo,
//     mismo texto que el pill `.order-type-pill` de esa tarjeta).
//   - `#chronometer_<idTarjeta>` → cronómetro en vivo (HH:MM:SS, cuenta
//     ascendente desde que se creó la tarjeta) y `#date_hide_<idTarjeta>`
//     → su fecha/hora real absoluta ("AAAA/MM/DD HH:MM:SS"), oculta.
//   - `#card_is_painted_<idTarjeta>`/`#card_color_painted_<idTarjeta>` →
//     mecanismo de "pintar"/resaltar una tarjeta manualmente — existe en el
//     DOM pero no se investigó su disparador real dentro del tiempo de esta
//     sesión (fuera de alcance de esta primera cobertura).
// El resto del contenido (cliente, mesero/usuario, producto(s), aditivos,
// observación) NO tiene selectores propios por campo — se lee con el mismo
// criterio ya establecido en el resto del repo para contenido sin clases
// propias (`HistoricoVentasPage.leerFormaDePagoFacturaAbierta()`): parseo de
// texto/regex sobre el `innerText()` completo de la tarjeta.
const L_COCINA = {
  LINK_SIDEBAR_COCINA: 'a[onclick*="get_company_pos_select(10)"]',
  CARDS_CONTAINER: '#cards_content',
  TARJETA: (idTarjeta: string) => `#card_${idTarjeta}`,
  INPUT_ORDEN_REAL: (idTarjeta: string) => `#card_item_real_id_${idTarjeta}`,
  INPUT_MESA_ID: (idTarjeta: string) => `#table_id_${idTarjeta}`,
  INPUT_MESA_NOMBRE: (idTarjeta: string) => `#table_name_${idTarjeta}`,
  CRONOMETRO: (idTarjeta: string) => `#chronometer_${idTarjeta}`,

  // Menú de opciones (ícono "more_vert") — SOLO 2 opciones reales
  // confirmadas en vivo (volcando el `.dropdown-menu` real tras el click):
  // "Orden lista" (`li[onclick^="order_completed"]`) e "Imprimir comanda"
  // (localizada por su texto real, scopeada siempre dentro de la tarjeta
  // para no ambigüar con la de otra tarjeta).
  BTN_MENU_TARJETA: 'i.dropdown-toggle',
  ITEM_ORDEN_LISTA: 'li[onclick^="order_completed"]',
  ITEM_IMPRIMIR_COMANDA: 'li:has-text("Imprimir comanda")',

  // ─── Filtro "Categorias" ────────────────────────────────────────────────
  // Botón real de la barra superior (`text=Categorias`) abre un modal lateral
  // real (Bootstrap `.modal.right`, NO un dropdown simple) — confirmado en
  // vivo, id `#myCategoryModal`, título "Filtrado de Categorías". Contiene un
  // checkbox por categoría real del catálogo de esta compañía + 2 acciones
  // reales: "Actualizar preferencias" (aplica el filtro) y "Borrar
  // Preferencias" (lo quita). El propio modal explica su semántica real en su
  // encabezado: "Al seleccionar 'actualizar preferencias' el panel de cocina
  // mostrará las órdenes con las preferencias seleccionadas" — es decir, es
  // un filtro por CATEGORÍA DE PRODUCTO (no por mesa/orden/estado).
  BTN_ABRIR_CATEGORIAS: 'text=Categorias',
  MODAL_CATEGORIAS: '#myCategoryModal',
  MODAL_CATEGORIAS_ITEM: (nombre: string) => `#myCategoryModal li:has-text("${nombre}")`,
  MODAL_CATEGORIAS_BTN_CERRAR: '#myCategoryModal [data-dismiss="modal"], #myCategoryModal .close',
} as const;

/** Contadores reales del encabezado de Cocina ("Panel de Cocina"). */
export type ContadoresCocina = {
  activas: number;
  paraLlevar: number;
  enMesa: number;
};

/** Contenido real de una tarjeta de Cocina, leído por texto (sin clases propias por campo, ver la cabecera del archivo). */
export type TarjetaCocina = {
  idTarjeta: string;
  ordenId: string;
  mesaId: string;
  esParaLlevar: boolean;
  nombreMesa: string;
  cliente: string;
  textoCompleto: string;
};

// A diferencia de PosRestauranteMesas/PosRestauranteOrdenesLlevar (que sí
// reciben PosPage porque operan DENTRO del propio POS), Cocina es un módulo
// completamente aparte con su propia página/URL — no necesita ni usa ningún
// método de PosPage, así que su constructor solo recibe el Page real.
export class PosRestauranteCocina {
  constructor(private readonly page: Page) {}


  // ─── Navegación ─────────────────────────────────────────────────────────

  /**
   * Navega a Cocina desde el Dashboard — mismo mecanismo real que
   * "Crear factura" (submenú "FACTURAR" del sidebar, expandirlo si no está
   * visible, click nativo para evitar el mismo problema de superposición de
   * submenús ya documentado en `PosCore._irAlPosResolviendoCompania()`), pero
   * esperando la URL real de Cocina (`/kitchen/kitchen`) en vez de
   * `pointOfSale` — ver el comentario completo de la cabecera del archivo
   * sobre por qué no se reutiliza ese método tal cual.
   */
  async irACocina() {
    await this.page.goto('https://dev.designsoftcr.com/qa_restaurant/public/dash/dashboard', {
      waitUntil: 'load',
      timeout: TIMEOUTS.NAVIGATE,
    });

    const link = this.page.locator(L_COCINA.LINK_SIDEBAR_COCINA).first();
    await expect(link, 'El link "Cocina" no existe en el sidebar').toHaveCount(1);

    if (!(await link.isVisible().catch(() => false))) {
      await link.evaluate((el) => {
        const li = el.closest('li');
        const ul = li?.closest('ul');
        const parentA = ul?.closest('li')?.querySelector<HTMLElement>(':scope > a');
        parentA?.click();
      });
    }
    await expect(link, 'El link "Cocina" no quedó visible tras expandir el submenú "FACTURAR"').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const esperaNavegacion = this.page.waitForURL(/kitchen\/kitchen/, { timeout: TIMEOUTS.NAVIGATE });
    await link.evaluate((el: HTMLElement) => el.click());
    await esperaNavegacion;
    await this.page.waitForLoadState('domcontentloaded');

    await expect(
      this.page.locator(L_COCINA.CARDS_CONTAINER),
      'El contenedor de tarjetas de Cocina no cargó'
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
  }


  /** Recarga la vista de Cocina (misma pestaña, sin volver a pasar por el Dashboard) — para observar actualizaciones sin re-navegar. */
  /**
   * CORRECCIÓN DE AUTOMATIZACIÓN CONFIRMADA EN VIVO: `page.reload()` (la
   * versión anterior de este método) deja el contenedor de tarjetas visible,
   * pero el contenido detallado de cada tarjeta (línea "Cliente:", producto)
   * puede NUNCA terminar de poblarse — reproducido 2/2 en corridas reales,
   * incluso esperando hasta 120s. Una navegación FRESCA real (equivalente a
   * `irACocina()`, exactamente el mismo mecanismo confirmado estable en
   * TODA la investigación en vivo de este módulo) sí puebla el contenido
   * completo de forma consistente. Se prioriza corrección sobre el costo
   * extra del viaje por el Dashboard.
   */
  async recargar() {
    await this.irACocina();
  }


  // ─── Contadores ─────────────────────────────────────────────────────────

  /** Lee los 3 contadores reales del encabezado ("Órdenes activas" / "Órdenes Para Llevar" / "Órdenes En Mesa"). */
  async obtenerContadores(): Promise<ContadoresCocina> {
    const texto = await this.page.locator('body').innerText();
    const activas = texto.match(/(\d+)\s*\|\s*Órdenes activas/)?.[1];
    const paraLlevar = texto.match(/(\d+)\s*\|\s*Órdenes Para Llevar/)?.[1];
    const enMesa = texto.match(/(\d+)\s*\|\s*Órdenes En Mesa/)?.[1];
    expect(activas && paraLlevar && enMesa, `No se pudieron leer los 3 contadores del encabezado de Cocina (texto real: "${texto.slice(0, 200)}")`).toBeTruthy();
    return { activas: parseInt(activas!, 10), paraLlevar: parseInt(paraLlevar!, 10), enMesa: parseInt(enMesa!, 10) };
  }


  // ─── Tarjetas ───────────────────────────────────────────────────────────

  /**
   * Ids técnicos (idTarjeta) de TODAS las tarjetas asociadas a un "Orden #"
   * real — nunca asume que existe una sola (ver el hallazgo documentado en
   * la cabecera del archivo: cada envío/cambio genera una tarjeta nueva).
   */
  async obtenerIdsTarjetasDeOrden(ordenId: string): Promise<string[]> {
    return this.page
      .locator(`input[id^="card_item_real_id_"][value="${ordenId}"]`)
      .evaluateAll((els) => els.map((el) => el.id.replace('card_item_real_id_', '')));
  }


  /** Espera (con reintentos reales) a que exista AL MENOS una tarjeta para la orden dada — señal real de que Cocina ya la recibió. */
  async esperarTarjetaDeOrden(ordenId: string): Promise<string[]> {
    await expect.poll(
      () => this.obtenerIdsTarjetasDeOrden(ordenId).then((ids) => ids.length),
      { timeout: TIMEOUTS.PRODUCTS_LOAD, message: `Ninguna tarjeta de la orden ${ordenId} apareció en Cocina` }
    ).toBeGreaterThan(0);
    return this.obtenerIdsTarjetasDeOrden(ordenId);
  }


  /**
   * Espera a que la orden dada tenga EXACTAMENTE `cantidadEsperada` tarjetas
   * — nunca "al menos una".
   *
   * CORRECCIÓN DE AUTOMATIZACIÓN CONFIRMADA EN VIVO: tras recargar Cocina, el
   * listado de tarjetas se puebla de forma progresiva (AJAX propio, no
   * sincrónico con el HTML inicial) — confirmado en vivo que
   * `esperarTarjetaDeOrden()` (que solo exige ">0") puede resolver con un
   * conteo PARCIAL (ej. 1 de 2 tarjetas reales) si se lee demasiado pronto
   * tras el reload. Cuando el escenario conoce el número exacto esperado,
   * debe usar este método en vez de `esperarTarjetaDeOrden()` + comparar el
   * largo inmediatamente.
   */
  async esperarCantidadTarjetasDeOrden(ordenId: string, cantidadEsperada: number): Promise<string[]> {
    await expect.poll(
      () => this.obtenerIdsTarjetasDeOrden(ordenId).then((ids) => ids.length),
      { timeout: TIMEOUTS.PRODUCTS_LOAD, message: `La orden ${ordenId} nunca alcanzó ${cantidadEsperada} tarjeta(s) en Cocina` }
    ).toBe(cantidadEsperada);
    return this.obtenerIdsTarjetasDeOrden(ordenId);
  }


  get todasLasTarjetas(): Locator {
    return this.page.locator(L_COCINA.CARDS_CONTAINER).locator('[class*="card_orders"]');
  }


  /**
   * Espera a que una tarjeta ya presente en el DOM tenga su contenido
   * VISIBLE completo (línea "Cliente:", marcador confirmado en vivo como
   * constante en toda tarjeta ya renderizada) — nunca asume que basta con
   * que exista su input oculto (`card_item_real_id_...`, la señal que ya usa
   * `esperarTarjetaDeOrden()`).
   *
   * CAUSA RAÍZ REAL CONFIRMADA EN VIVO (root-cause definitivo, dos hipótesis
   * previas descartadas con evidencia — ver el historial de esta
   * investigación): NO es que el render sea "lento" (esperar más tiempo, aun
   * 120s, nunca lo resuelve) ni que `page.reload()` deje de poblar el
   * contenido. La causa real: una tarjeta que aparece por ACTUALIZACIÓN EN
   * VIVO dentro de la MISMA carga de página (ej. se agrega un producto y se
   * lee su tarjeta sin recargar Cocina de por medio) queda con su contenido
   * detallado incompleto DE FORMA PERMANENTE — solo las tarjetas presentes
   * en la carga/recarga INICIAL de la página (HTML ya renderizado por el
   * servidor) reciben el contenido completo. Confirmado comparando en vivo:
   * el Escenario 4 (que nunca lee el detalle de una tarjeta recién creada
   * sin recargar antes) pasó limpio: los Escenarios 2/3/5/6 (que sí leían el
   * detalle inmediatamente después de crear la tarjeta, sin recargar)
   * fallaron de forma reproducible y consistente, incluso en una máquina sin
   * ninguna otra carga.
   *
   * Corrección: si "Cliente:" no aparece en una espera corta (probablemente
   * la tarjeta llegó por actualización en vivo), forzar una recarga real
   * (`recargar()`, navegación fresca) y reintentar — la MISMA tarjeta,
   * releída ahora como parte de una carga inicial, sí completa su contenido.
   */
  private async _esperarContenidoCompletoDeTarjeta(idTarjeta: string, tarjeta: Locator) {
    const completaSinRecargar = await expect.poll(
      () => tarjeta.innerText(),
      { timeout: 15_000 }
    ).toMatch(/Cliente:/).then(() => true).catch(() => false);
    if (completaSinRecargar) return;

    await this.recargar();
    const tarjetaTrasRecargar = this.page.locator(L_COCINA.TARJETA(idTarjeta));
    await expect(tarjetaTrasRecargar, `La tarjeta ${idTarjeta} no existe tras recargar Cocina`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await expect.poll(
      () => tarjetaTrasRecargar.innerText(),
      { timeout: TIMEOUTS.PRODUCTS_LOAD, message: `La tarjeta ${idTarjeta} nunca terminó de renderizar su contenido (línea "Cliente:" ausente), ni siquiera tras recargar Cocina` }
    ).toMatch(/Cliente:/);
  }


  /** Lee el contenido real de una tarjeta por su id técnico (nunca por posición). */
  async leerTarjeta(idTarjeta: string): Promise<TarjetaCocina> {
    const tarjeta = this.page.locator(L_COCINA.TARJETA(idTarjeta));
    await expect(tarjeta, `La tarjeta ${idTarjeta} no existe`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await this._esperarContenidoCompletoDeTarjeta(idTarjeta, tarjeta);

    const clase = (await tarjeta.getAttribute('class')) ?? '';
    const ordenId = (await this.page.locator(L_COCINA.INPUT_ORDEN_REAL(idTarjeta)).inputValue()) ?? '';
    // `#table_id_<idTarjeta>`/`#table_name_<idTarjeta>` son <p> ocultos, NO
    // <input> — confirmado en vivo volcando el HTML real de la tarjeta
    // (`.inputValue()` sobre un <p> siempre devuelve vacío sin lanzar
    // error, lo que dejaba `mesaId` silenciosamente en "" para toda tarjeta).
    const mesaId = ((await this.page.locator(L_COCINA.INPUT_MESA_ID(idTarjeta)).textContent().catch(() => '')) ?? '').trim();
    const nombreMesa = (await this.page.locator(L_COCINA.INPUT_MESA_NOMBRE(idTarjeta)).textContent().catch(() => '')) ?? '';
    const textoCompleto = (await tarjeta.innerText()).replace(/\s+\n/g, '\n').trim();

    // Regex \b<cliente> real: el propio texto de la tarjeta siempre incluye
    // "Cliente: <nombre>" en su propia línea — confirmado en vivo, mismo
    // patrón en las 20+ tarjetas ya inspeccionadas.
    const cliente = textoCompleto.match(/Cliente:\s*(.+)/)?.[1]?.trim() ?? '';

    return {
      idTarjeta,
      ordenId,
      mesaId,
      esParaLlevar: clase.includes('card_delivery'),
      nombreMesa: nombreMesa.trim(),
      cliente,
      textoCompleto,
    };
  }


  // ─── Menú de opciones por tarjeta ("more_vert") ─────────────────────────

  /**
   * Abre el menú de opciones de la tarjeta dada — mismo criterio de
   * reintento acotado ya usado en el resto del repo para menús MDL/animados
   * (`PosRestauranteMesas.abrirMenuMesa()`), scopeado SIEMPRE dentro de la
   * tarjeta (el DOM completo puede tener docenas de estos íconos idénticos,
   * uno por tarjeta).
   */
  async abrirMenuTarjeta(idTarjeta: string) {
    const tarjeta = this.page.locator(L_COCINA.TARJETA(idTarjeta));
    const boton = tarjeta.locator(L_COCINA.BTN_MENU_TARJETA);
    const itemAncla = tarjeta.locator(L_COCINA.ITEM_ORDEN_LISTA);

    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      await boton.click({ timeout: 5_000 }).catch(() => {});
      abierto = await itemAncla.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, `El menú de opciones de la tarjeta ${idTarjeta} no se abrió tras ${MAX_INTENTOS} intentos`).toBe(true);
  }


  /**
   * Marca la tarjeta dada como "Orden lista" (`order_completed(idTarjeta)`,
   * confirmado en vivo leyendo el onclick real del ítem del menú).
   *
   * HALLAZGO REAL CONFIRMADO EN VIVO, documentado (no asumido): tras
   * confirmar esta acción, la tarjeta NO desaparece de la vista principal de
   * Cocina y los 3 contadores del encabezado NO cambian — ambos confirmados
   * inmediatamente después del click y también tras recargar la página
   * completa. El efecto visual/real exacto de esta acción (más allá de
   * disparar `order_completed`) no quedó determinado dentro del tiempo de
   * esta sesión — no se automatiza ninguna aserción sobre "la tarjeta
   * desaparece" o "el contador baja" precisamente porque se confirmó en vivo
   * que NINGUNA de las dos ocurre; el método solo confirma que la acción
   * real se disparó (el ítem del menú, con su onclick real, fue clickeado).
   */
  async marcarOrdenLista(idTarjeta: string) {
    await this.abrirMenuTarjeta(idTarjeta);
    const tarjeta = this.page.locator(L_COCINA.TARJETA(idTarjeta));
    await tarjeta.locator(L_COCINA.ITEM_ORDEN_LISTA).click();
  }


  /**
   * Imprime la comanda desde el menú de opciones de la tarjeta dada — mismo
   * mecanismo real de ventana emergente ya documentado y centralizado en
   * `esperarVentanaImpresion()` (pos.utils.ts) para Mesas/Para Llevar: no
   * navega a una URL real, solo se puede confirmar que el popup se abrió.
   */
  async imprimirComandaDesdeTarjeta(idTarjeta: string): Promise<void> {
    await this.abrirMenuTarjeta(idTarjeta);
    const tarjeta = this.page.locator(L_COCINA.TARJETA(idTarjeta));
    return esperarVentanaImpresion(
      this.page,
      () => tarjeta.locator(L_COCINA.ITEM_IMPRIMIR_COMANDA).click(),
      TIMEOUTS.PRINT_POPUP
    );
  }


  // ─── Filtro "Categorias" ─────────────────────────────────────────────────

  get modalCategorias(): Locator {
    return this.page.locator(L_COCINA.MODAL_CATEGORIAS);
  }


  /** Abre el modal "Filtrado de Categorías". */
  async abrirFiltroCategorias() {
    await this.page.locator(L_COCINA.BTN_ABRIR_CATEGORIAS).first().click();
    await expect(this.modalCategorias, 'El modal "Filtrado de Categorías" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /** Nombres reales de todas las categorías disponibles en el filtro. */
  async obtenerCategoriasDisponibles(): Promise<string[]> {
    const items = await this.modalCategorias.locator('li').allTextContents();
    return items.map((t) => t.trim()).filter((t) => t.length > 0 && !/^(Actualizar preferencias|Borrar Preferencias)$/.test(t));
  }


  /** Marca (click) la categoría dada por su nombre exacto dentro del modal ya abierto. */
  async seleccionarCategoriaEnFiltro(nombre: string) {
    const item = this.page.locator(L_COCINA.MODAL_CATEGORIAS_ITEM(nombre));
    await expect(item, `La categoría "${nombre}" no existe en el filtro`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await item.click();
  }


  /**
   * Aplica el filtro de categorías ya seleccionado ("Actualizar
   * preferencias") — cierra el modal y recarga las tarjetas visibles.
   *
   * CORRECCIÓN DE AUTOMATIZACIÓN CONFIRMADA EN VIVO: un `text=` simple sobre
   * "Actualizar preferencias" viola el modo estricto — el propio párrafo
   * explicativo del modal ("Al seleccionar 'actualizar preferencias' el
   * panel de cocina mostrará...") contiene la misma frase en minúscula.
   * `getByRole('button', ...)` apunta directo al botón real, sin ambigüedad.
   */
  async aplicarFiltroCategorias() {
    await this.modalCategorias.getByRole('button', { name: 'Actualizar preferencias' }).click();
    await expect(this.modalCategorias, 'El modal de categorías no se cerró tras "Actualizar preferencias"').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /** Quita cualquier filtro de categoría activo ("Borrar Preferencias") — mismo criterio que aplicarFiltroCategorias() (getByRole, no texto suelto). */
  async borrarFiltroCategorias() {
    await this.abrirFiltroCategorias();
    await this.modalCategorias.getByRole('button', { name: 'Borrar Preferencias' }).click();
    await expect(this.modalCategorias, 'El modal de categorías no se cerró tras "Borrar Preferencias"').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /** Cierra el modal de categorías sin aplicar ni borrar nada (botón de cierre real, `data-dismiss="modal"`). */
  async cerrarModalCategorias() {
    await this.page.locator(L_COCINA.MODAL_CATEGORIAS_BTN_CERRAR).first().click();
    await expect(this.modalCategorias, 'El modal de categorías no se cerró').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }
}
