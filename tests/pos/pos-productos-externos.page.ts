import { expect, Locator, Page, Response } from '@playwright/test';
import { PosPage, TIMEOUTS, PESTANAS_POS_A_RECORRER, PestanaPos } from './pos.page';

// Pestaña "(F6) Productos externos" — ya registrada en PESTANAS_POS_A_RECORRER
// (pos.types.ts), reutilizada tal cual en vez de declarar un PestanaPos propio.
export const PESTANA_PRODUCTOS_EXTERNOS: PestanaPos =
  PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Productos externos')!;

// Locators propios de este dominio (menú "Producto externo", modal "Agregar
// producto externo" y las tarjetas de la pestaña) — ninguno existía ya en
// pos.locators.ts. Todos los ids son confirmados en vivo (HONDURAS).
const L_PE = {
  // Menú de tres puntos (L.MENU_TRES_PUNTOS) → ítem "Producto externo"
  // (onclick="add_product_sc()"), que abre el modal de creación.
  MENU_ITEM_AGREGAR: '#add_sc_product',

  DIALOG_AGREGAR: '#dialog_add_sc_product_1',
  NOMBRE_PREVIEW: '#product_sc_name_preview',
  CODIGO_REAL: '#product_sc_real_code',
  GRUPO_CHOSEN: '#product_sc_code_chosen',
  VENDEDOR_CHOSEN: '#product_sc_seller_chosen',
  PROVEEDOR_CHOSEN: '#product_sc_provider_chosen',
  OTRO_PROVEEDOR: '#product_sc_another_provider',
  COSTO: '#product_sc_cost',
  UTILIDAD: '#product_sc_utility',
  CHECK_IMPUESTO: '#product_sc_tax_checkbox',
  // Fila de impuesto agregada dinámicamente por ext_product_add_tax_list_select_input():
  // dos <select> nativos (sin Chosen, confirmado en vivo), con sufijo "_1" la
  // primera vez que se agrega (única fila que esta suite necesita).
  BTN_AGREGAR_IMPUESTO: 'a[href^="javascript:ext_product_add_tax_list_select_input"]',
  IMPUESTO_SELECT: '#ext_product_add_product_tax_list_1',
  TARIFA_SELECT: '#ext_product_add_product_tax_rate_list_1',
  CANTIDAD: '#product_sc_quantity',
  PRECIO: '#product_sc_price',
  TOTAL: '#product_sc_total',
  CHECK_GARANTIA: '#product_sc_warranty_checkbox',
  DIAS_GARANTIA_CONTENIDO: '#product_sc_warranty_days_content',
  DIAS_GARANTIA: '#product_sc_warranty_days',
  COMENTARIO: '#product_sc_comment',
  BTN_GUARDAR: '#save_external_product',

  // Petición AJAX real que crea el producto externo (ext_product/addProductExternal,
  // confirmado en vivo) — responde texto plano con el id numérico creado.
  AJAX_GUARDAR: 'addProductExternal',

  // Tarjetas de la pestaña "Productos externos" (#content_invoice_order_list,
  // mismo contenedor genérico que Órdenes de Caja/Importar Factura/Proforma).
  // El cuerpo de cada tarjeta dispara add_product_external_to_table(id), que
  // agrega una línea real al carrito compartido (misma tabla #table_buy_list
  // que usa el resto del POS) — confirmado en vivo que la línea resultante
  // expone los mismos ids que obtenerDatosLineaCarrito()/validarLineaCarrito()
  // ya leen (#total_by_product_<clave>, #product_hide_apply_iva_<clave>,
  // etc.), así que no hace falta ningún lector propio para validarla.
  TARJETA: '[id^="product_external_card_item_"]',
  TARJETA_CLICK: '[onclick^="add_product_external_to_table"]',
  TARJETA_FACTURADO: 'span',
} as const;

/** Campos completos del modal "Agregar producto externo" (Escenario 1: completar todos los disponibles). */
export type DatosProductoExterno = {
  nombre: string;
  codigoReal: string;
  otroProveedor: string;
  costo: string;
  utilidad: string;
  cantidad: string;
  diasGarantia: string;
  observacion: string;
};

export class PosProductosExternos {
  constructor(private readonly pos: PosPage, private readonly page: Page) {}


  /** Locator del modal "Agregar producto externo". */
  get modalAgregarProductoExterno(): Locator {
    return this.page.locator(L_PE.DIALOG_AGREGAR);
  }


  /**
   * Abre "Agregar producto externo" desde el menú de tres puntos del
   * encabezado (reutiliza abrirMenuTresPuntos(), ya existente y con sus
   * propios reintentos frente a overlays).
   *
   * Corrección de automatización confirmada en vivo (no un problema del
   * sistema): tras la segunda carga del POS en una misma pestaña —exactamente
   * lo que hace esta suite en cada test (irAlPos() del beforeEach, después
   * del cargarPosDesdeDashboard() único de la fixture "pos")—, el ítem
   * `#add_sc_product` sigue pasando todos los chequeos de accionabilidad de
   * Playwright (visible, adjunto, sin overlay detectado), pero
   * `document.elementFromPoint()` en su propio centro resolvía a
   * `div.mdl-menu__container` (el contenedor del propio menú MDL que lo
   * envuelve), no al `<li>` — un click por coordenadas, incluso con
   * `force:true`, aterriza en ese contenedor y nunca dispara el
   * `onclick="add_product_sc()"` real, sin ningún error observable (mismo
   * mecanismo de causa raíz, confirmado con el mismo diagnóstico
   * `elementFromPoint()`, que ya documenta `_irAlPosResolviendoCompania()`
   * para el link "Crear factura"). Confirmado también en vivo, llamando
   * `add_product_sc()` directo por consola, que la función y el modal
   * funcionan perfectamente tras esa segunda carga — el problema es
   * exclusivamente la ENTREGA del click, no la aplicación. Mismo remedio ya
   * usado ahí: click NATIVO vía `evaluate(el => el.click())`, que dispara el
   * evento directo sobre el nodo del DOM ya localizado, sin depender de qué
   * elemento esté visualmente encima en esas coordenadas.
   */
  async abrirAgregarProductoExterno() {
    await this.pos.abrirMenuTresPuntos();
    await this.page.locator(L_PE.MENU_ITEM_AGREGAR).evaluate((el: HTMLElement) => el.click());
    await expect(
      this.modalAgregarProductoExterno,
      'El modal "Agregar producto externo" no apareció tras seleccionar la opción del menú'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Completa TODOS los campos disponibles del modal "Agregar producto
   * externo" y guarda. Reutiliza los helpers de Chosen/checkbox/SweetAlert
   * ya existentes en PosPage (composición, no reimplementación):
   * - Grupo de productos / Proveedor: catálogos que pueden venir vacíos en
   *   un ambiente nuevo → _seleccionarPrimeraOpcionChosenSiHayOpciones().
   * - Vendedor Responsable: confirmado en vivo que SÍ es obligatorio (el
   *   guardado queda bloqueado en silencio, sin alerta, con su label
   *   resaltado en rojo, si se omite) → _seleccionarPrimeraOpcionChosen().
   * - "¿Aplica Impuesto?"/"¿Aplica Garantía?": checkboxes slider CSS, mismo
   *   patrón que el resto de la suite → _asegurarCheckboxEstado().
   * - Confirmación final: SweetAlert v1 real ("¿Está seguro que desea
   *   continuar?") → _confirmarSweetAlertV1().
   *
   * Al marcar "¿Aplica Impuesto?" el propio formulario exige además elegir
   * un impuesto y su tarifa (fila agregada con el botón "+", confirmado en
   * vivo que sin esto el guardado se bloquea con un SweetAlert de alerta
   * "¡Seleccione al menos un impuesto con su tarifa correspondiente!") — se
   * completa aquí seleccionando la primera opción real de cada <select>
   * (nativos, sin Chosen).
   */
  async crearProductoExterno(datos: DatosProductoExterno): Promise<{ id: string; respuesta: Response }> {
    await this.pos._seleccionarPrimeraOpcionChosenSiHayOpciones(L_PE.GRUPO_CHOSEN);

    // Seleccionar el Grupo de productos autocompleta el nombre con el del
    // grupo (set_product_sc_name_panel(), confirmado en vivo) — se sobreescribe
    // después con el nombre propio del escenario, nunca antes.
    await this.page.locator(L_PE.NOMBRE_PREVIEW).fill(datos.nombre);
    await this.page.locator(L_PE.CODIGO_REAL).fill(datos.codigoReal);

    await this.pos._seleccionarPrimeraOpcionChosen(L_PE.VENDEDOR_CHOSEN);
    await this.pos._seleccionarPrimeraOpcionChosenSiHayOpciones(L_PE.PROVEEDOR_CHOSEN);
    await this.page.locator(L_PE.OTRO_PROVEEDOR).fill(datos.otroProveedor);

    await this.page.locator(L_PE.COSTO).fill(datos.costo);
    await this.page.locator(L_PE.UTILIDAD).fill(datos.utilidad);

    await this.pos._asegurarCheckboxEstado(this.page.locator(L_PE.CHECK_IMPUESTO), 'product_sc_tax_checkbox', true);
    await this.page.locator(L_PE.BTN_AGREGAR_IMPUESTO).click();
    await expect(
      this.page.locator(L_PE.IMPUESTO_SELECT),
      'No se agregó la fila de "Seleccionar impuestos" tras presionar el botón "+"'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.page.locator(L_PE.IMPUESTO_SELECT).selectOption({ index: 1 });
    await this.page.locator(L_PE.TARIFA_SELECT).selectOption({ index: 1 });

    await this.page.locator(L_PE.CANTIDAD).fill(datos.cantidad);

    // Precio/Total se autocalculan (Costo × Utilidad, ajustados por la
    // tarifa elegida) pero son required="required": si por algún motivo el
    // autocálculo no corrió (ambiente sin JS de precio, o Costo/Utilidad en
    // 0), se completan con un valor explícito antes de continuar en vez de
    // dejar el guardado bloqueado en silencio por un campo vacío.
    if (!(await this.page.locator(L_PE.PRECIO).inputValue())) {
      await this.page.locator(L_PE.PRECIO).fill(datos.costo);
    }
    if (!(await this.page.locator(L_PE.TOTAL).inputValue())) {
      await this.page.locator(L_PE.TOTAL).fill(datos.costo);
    }

    await this.pos._asegurarCheckboxEstado(this.page.locator(L_PE.CHECK_GARANTIA), 'product_sc_warranty_checkbox', true);
    await expect(
      this.page.locator(L_PE.DIAS_GARANTIA_CONTENIDO),
      'El campo "Dias de garantía" no apareció tras marcar "¿Aplica Garantía?"'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.page.locator(L_PE.DIAS_GARANTIA).fill(datos.diasGarantia);

    await this.page.locator(L_PE.COMENTARIO).fill(datos.observacion);

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L_PE.AJAX_GUARDAR),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L_PE.BTN_GUARDAR).click();
    await this.pos._confirmarSweetAlertV1('No apareció la confirmación "¿Está seguro que desea continuar?" al guardar el producto externo');
    const respuesta = await respuestaPromise;

    await expect(
      this.modalAgregarProductoExterno,
      'El modal "Agregar producto externo" no se cerró tras guardar'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const id = (await respuesta.text()).trim();
    return { id, respuesta };
  }


  /** Visita la pestaña "(F6) Productos externos" (reutiliza visitarPestanaPos(), ya existente). */
  async visitarTab() {
    await this.pos.visitarPestanaPos(PESTANA_PRODUCTOS_EXTERNOS);
  }


  /** Localiza una tarjeta de la pestaña por su id real (ver crearProductoExterno()/addProductExternal). */
  localizarTarjetaPorId(id: string): Locator {
    return this.page.locator(`#product_external_card_item_${id}`);
  }


  /** Localiza una tarjeta de la pestaña por el nombre visible del producto. */
  localizarTarjetaPorNombre(nombre: string): Locator {
    return this.page.locator(L_PE.TARJETA).filter({ hasText: nombre });
  }


  /**
   * Primer producto externo disponible para seleccionar (pestaña ya
   * visitada por quien llama): descarta las tarjetas ya "Facturado" — con
   * Cantidad/Total en $0.00, confirmado en vivo — porque agregarían una
   * línea sin precio ni cantidad real al carrito, rompiendo las validaciones
   * de subtotal/IVA/total del resto del escenario. Nunca depende de un
   * nombre fijo del catálogo (primera disponible, mismo criterio que el
   * resto de la suite para catálogos configurables por compañía).
   */
  async obtenerPrimerProductoExternoDisponible(): Promise<{ tarjeta: Locator; id: string; nombre: string }> {
    const tarjetas = this.page.locator(L_PE.TARJETA);
    await expect(
      tarjetas.first(),
      'No hay ningún producto externo en la pestaña "Productos externos" — se requiere al menos uno ya creado en el ambiente de prueba'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const total = await tarjetas.count();
    for (let i = 0; i < total; i++) {
      const candidata = tarjetas.nth(i);
      const facturado = await candidata.locator(L_PE.TARJETA_FACTURADO, { hasText: 'Facturado' }).count() > 0;
      if (facturado) continue;

      const idAttr = await candidata.getAttribute('id');
      const id = idAttr?.replace('product_external_card_item_', '') ?? '';
      const nombre = (await candidata.locator(`#pos_product_external_name_hide_${id}`).textContent())?.trim() ?? '';
      expect(id, 'No se pudo leer el id real de la tarjeta de producto externo').not.toBe('');
      expect(nombre, 'No se pudo leer el nombre real de la tarjeta de producto externo').not.toBe('');
      return { tarjeta: candidata, id, nombre };
    }

    throw new Error('Todos los productos externos disponibles ya están "Facturado" (cantidad/total en $0.00) — se requiere al menos uno sin facturar.');
  }


  /**
   * Selecciona una tarjeta de producto externo ya localizada
   * (obtenerPrimerProductoExternoDisponible()/localizarTarjetaPorId()):
   * clickea su cuerpo (add_product_external_to_table(id)) y devuelve la
   * clave real de la línea resultante en el carrito — reutiliza
   * obtenerClaveDeLineaPorNombre() (PosCore), ya existente para el mismo
   * problema (localizar la clave de una línea recién agregada por su nombre
   * visible), en vez de duplicar esa búsqueda.
   */
  async seleccionarProductoExterno(tarjeta: Locator, nombre: string): Promise<string> {
    const clavesAntes = await this.pos.obtenerClavesFilasCarrito();
    await tarjeta.locator(L_PE.TARJETA_CLICK).first().click();

    await expect.poll(
      async () => (await this.pos.obtenerClavesFilasCarrito()).length,
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'No se agregó ninguna línea nueva al carrito tras seleccionar el producto externo' }
    ).toBeGreaterThan(clavesAntes.length);

    return this.pos.obtenerClaveDeLineaPorNombre(nombre);
  }
}
