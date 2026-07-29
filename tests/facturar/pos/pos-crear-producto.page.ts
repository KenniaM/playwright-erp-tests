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
import { PosCore } from './pos-core.page';

// Parte del plan de migración a composición: dominio "CREAR_PRODUCTO" extraído
// de pos.page.ts. Depende de core por inyección de
// constructor (composición, no herencia) — nunca al revés. Miembros que eran
// 'private' en el monolito pasan a públicos aquí por el mismo motivo que en
// PosCore: los llama la fachada por composición, no por herencia.
export class PosCrearProducto {
  private readonly core: PosCore;

  constructor(core: PosCore) {
    this.core = core;
  }

  private get page() { return this.core.page; }


  /**
   * Espera a que el checkbox "¿Aplicar impuesto?" de "Crear Combo" quede
   * marcado tras aplicar un CABYS — homólogo de esperarIvaAutocompletado()
   * para Producto Rápido, pero para el checkbox propio del combo.
   *
   * Contradice lo que se había asumido inicialmente ("el de Combo no tiene
   * ese autocompletado"): confirmado en vivo monitoreando el checkbox cada
   * 500ms tras aplicar un CABYS con el checkbox inicialmente desmarcado, SÍ
   * se autoactiva —con ~500ms de desfase, no instantáneo—, y el select de
   * tasa (`#tax_rate_list`) se sincroniza a la vez con la tasa real del
   * CABYS. Por eso es indispensable esperar este autocompletado ANTES de
   * intentar desactivar el checkbox otra vez (ver crearComboSinIva() en
   * pos.spec.ts): desactivarlo de inmediato, sin esperar, corre el riesgo
   * de ganarle la carrera a esta activación automática y terminar con el
   * checkbox marcado de todos modos.
   */
  async esperarIvaAutocompletadoCombo() {
    await expect.poll(
      () => this.checkboxIvaCombo.isChecked(),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    ).toBe(true);
  }


  /**
   * Lee el `percent` de la opción de tasa de IVA realmente seleccionada en
   * "Crear Combo" (`#tax_rate_list`) — homólogo de obtenerTasaIvaSeleccionadaPct()
   * pero para el select propio del combo, que solo queda sincronizado con el
   * CABYS aplicado si el checkbox ya estaba activado ANTES de aplicar ese
   * CABYS (ver el comentario de L.COMBO_TASA_IVA).
   */
  async obtenerTasaIvaSeleccionadaComboPct(): Promise<number> {
    return this.page.locator(L.COMBO_TASA_IVA).evaluate(
      (el) => parseFloat((el as HTMLSelectElement).selectedOptions[0]?.getAttribute('percent') ?? 'NaN')
    );
  }


  /**
   * Valida que la tasa de IVA realmente seleccionada en "Crear Combo"
   * coincide con el IVA que el propio CABYS aplicado sugiere. Solo tiene
   * sentido llamarla cuando el checkbox "¿Aplicar impuesto?" se activó
   * ANTES de aplicar el CABYS (ver activarIvaCombo() + el comentario de
   * L.COMBO_TASA_IVA) — con el checkbox desmarcado en ese momento, el
   * select nunca se sincroniza y esta comparación fallaría sin que sea un
   * error real del sistema.
   *
   * La sincronización no es instantánea (confirmado en vivo: leerla justo
   * después de que el sub-modal de CABYS se cierra todavía puede devolver el
   * valor por defecto "0%", el mismo desfase de un tick de JS que ya obliga
   * a esperarIvaAutocompletado() en Producto Rápido), así que se usa
   * expect.poll() en vez de una lectura + comparación inmediata.
   */
  async validarIvaCoincideConCabysCombo() {
    const cabysTaxTexto = (await this.page.locator(L.COMBO_CABYS_TAX_SUGERIDO).textContent())?.trim() ?? '';
    const cabysTaxPct = this.core._normalizarPorcentajeCabys(cabysTaxTexto);

    await expect.poll(
      () => this.obtenerTasaIvaSeleccionadaComboPct(),
      {
        timeout: TIMEOUTS.PAYMENT_MODAL,
        message: `La tasa de IVA seleccionada en el combo no coincidió con el IVA definido por el CABYS aplicado (${cabysTaxPct}%)`,
      }
    ).toBeCloseTo(cabysTaxPct, 1);
  }


  // ─── "Crear Combo" ──────────────────────────────────────────────────────────

  /** Locator del modal "Crear Combo". */
  get modalCrearCombo() {
    return this.page.locator(L.DIALOG_CREAR_COMBO);
  }


  /**
   * Expande el FAB y abre el modal "Crear Combo". El ítem "Agregar combo"
   * queda con bounding box 0×0 de forma efímera (confirmado en vivo con
   * getBoundingClientRect: el estado "visible" que reporta Playwright puede
   * durar apenas milisegundos antes de volver a colapsar), así que —a
   * diferencia de abrirProductoRapido()— la comprobación de expansión usa
   * isVisible() puntual (sin esperar/poll) dentro de un ciclo corto y
   * frecuente, en vez de waitFor(): un poll que tarda en resolver puede
   * capturar el ítem apenas antes de que vuelva a colapsar, dejando el click
   * posterior actuando sobre un box ya vacío de nuevo.
   *
   * A diferencia de "Producto Rápido" (que usa `data-toggle="modal"` sobre
   * contenido ya presente en el DOM), el ítem "Agregar combo" dispara
   * `add_restaurant_combo(0)`, que carga el contenido del modal por AJAX
   * antes de mostrarlo —confirmado en vivo, incluye su propia llamada a
   * `get_combo_pharmaceutical()`—, así que el modal puede tardar bastante
   * más en aparecer que el de Producto Rápido: se espera con un timeout
   * generoso (TIMEOUTS.PRODUCTS_LOAD) después del único click sobre el ítem.
   */
  async abrirCrearCombo() {
    const toggle = this.page.locator(L.FAB_TOGGLE);
    const item = this.page.locator(L.FAB_ITEM_CREAR_COMBO);

    const MAX_INTENTOS = 15;
    let expandido = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !expandido; intento++) {
      await this.core.cerrarModalNotificacionesSiAparece();
      await toggle.click({ force: true });
      expandido = await item.isVisible().catch(() => false);
      if (!expandido) await this.page.waitForTimeout(300);
    }

    if (!expandido) {
      throw new Error(`El botón flotante del POS no se pudo expandir tras ${MAX_INTENTOS} intentos.`);
    }

    await item.click({ force: true });
    await expect(
      this.modalCrearCombo,
      'El modal "Crear Combo" no apareció tras clickear "Agregar combo" en el FAB'
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
  }


  /**
   * Llena nombre y cantidad en el formulario "Crear Combo" ya abierto. El
   * precio final NO se llena aquí: debe fijarse después de agregar los
   * productos (ver establecerPrecioValidoCombo()), porque el sistema lo
   * valida contra la suma de sus precios.
   */
  async llenarDatosBasicosCombo(nombre: string, cantidad = '1') {
    await this.page.locator(L.COMBO_NOMBRE).fill(nombre);
    await this.page.locator(L.COMBO_CANTIDAD).fill(cantidad);
  }


  /**
   * Busca un producto por texto en el buscador propio de "Crear Combo"
   * (Enter dispara la búsqueda — confirmado en vivo, no hay botón submit) y
   * agrega el primer resultado disponible: mismo criterio de "primera opción
   * disponible" que ya usa el resto de la suite para catálogos configurables
   * por compañía sin nombre estable (CABYS, IVA, parte/pieza/servicio de End.
   * Pintura). Los resultados son `<div onclick="get_product_combo(...)">`,
   * no `<a>` ni filas con un botón propio — confirmado inspeccionando el DOM
   * en vivo — así que se clickean vía evaluate() en vez de un locator.click()
   * normal, que no encuentra un target accionable estándar ahí.
   */
  async buscarYAgregarPrimerProductoAlCombo(termino: string) {
    const buscador = this.page.locator(L.COMBO_BUSCADOR_PRODUCTO);
    await buscador.fill(termino);
    await buscador.press('Enter');

    const resultado = this.page.locator(L.COMBO_RESULTADO_ITEM).first();
    await expect(resultado, `No hubo resultados de producto para "${termino}" al crear el combo`).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const productosAntes = await this.page.locator(L.COMBO_PRODUCTO_EN_LISTA).count();
    await this.page.evaluate((selector) => {
      (document.querySelector(selector) as HTMLElement | null)?.click();
    }, L.COMBO_RESULTADO_ITEM);

    await expect(
      this.page.locator(L.COMBO_PRODUCTO_EN_LISTA),
      `El producto buscado ("${termino}") no se agregó a la lista del combo`
    ).toHaveCount(productosAntes + 1, { timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /** Lee el "Precio real" del combo: la suma de precios de los productos ya agregados. */
  async obtenerPrecioRealCombo(): Promise<number> {
    const texto = await this.page.locator(L.COMBO_PRECIO_REAL).textContent();
    return parseFloat((texto ?? '0').replace(/[^0-9.]/g, '')) || 0;
  }


  /**
   * Fija un precio final válido para el combo, a partir del "Precio real"
   * (suma de precios de los productos ya agregados) — nunca un monto fijo
   * arbitrario. Regla de negocio descubierta inspeccionando la app en vivo
   * (no documentada): si el precio final supera esa suma, el sistema
   * rechaza el guardado en el propio cliente, sin disparar ningún request
   * de red, mostrando solo el toast "El precio del combo es mayor al precio
   * del producto" — confirmado interceptando la red y la consola tras el
   * click en "Guardar combo". Devuelve el precio fijado, por si el test
   * necesita usarlo para validar el carrito después.
   */
  async establecerPrecioValidoCombo(porcentajeDelPrecioReal = 0.8): Promise<number> {
    const precioReal = await this.obtenerPrecioRealCombo();
    expect(precioReal, 'El "Precio real" del combo es 0 — no se agregó ningún producto todavía').toBeGreaterThan(0);

    const precioValido = parseFloat((precioReal * porcentajeDelPrecioReal).toFixed(2));
    await this.page.locator(L.COMBO_PRECIO_FINAL).fill(String(precioValido));
    return precioValido;
  }


  /**
   * Presiona "Guardar combo" y devuelve la respuesta real de la petición que
   * lo persiste (save_company_combo) — misma señal de éxito a nivel de red
   * que ya usa guardarProductoRapidoYObtenerRespuesta() para Producto
   * Rápido, no solo el efecto visual de que el modal se cerró.
   */
  async guardarComboYObtenerRespuesta() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_COMBO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.COMBO_BTN_GUARDAR).click({ force: true });
    return respuestaPromise;
  }


  /**
   * Fija un precio válido y guarda el combo ya configurado, validando la
   * respuesta real de red (save_company_combo) — mismo cierre reutilizado
   * por crearComboConIva()/crearComboSinIva(). Centralizado aquí: existía
   * duplicado de forma idéntica como función local en pos-crear.spec.ts y
   * pos.spec.ts.
   */
  async guardarComboConfigurado() {
    await this.establecerPrecioValidoCombo();

    const respuesta = await this.guardarComboYObtenerRespuesta();
    expect(respuesta.ok(), `La petición a save_company_combo no respondió OK (status ${respuesta.status()})`).toBe(true);
    await expect(this.modalCrearCombo).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Pasos comunes a ambos escenarios de "Crear Combo": abrir el modal, llenar
   * nombre/cantidad y agregar un producto real. El manejo del checkbox de IVA
   * y de CABYS es responsabilidad de cada escenario (crearComboConIva /
   * crearComboSinIva), porque el orden entre ambos —no solo su presencia—
   * determina el resultado (ver el comentario de activarIvaCombo()):
   * factorizarlo aquí evitaría poder expresar ese orden.
   *
   * El producto que se agrega al combo se localiza por característica
   * funcional (obtenerPrimerProductoNormal()) ANTES de abrir el modal —el
   * propio grid del POS, no el buscador del combo—, y su nombre real se usa
   * como término de búsqueda dentro de "Crear Combo"
   * (buscarYAgregarPrimerProductoAlCombo ya toma "el primer resultado
   * disponible", nunca un nombre exacto): garantiza una coincidencia real sin
   * depender de ningún nombre fijo del catálogo.
   *
   * Centralizado aquí: existía duplicado de forma idéntica como función
   * local en pos-crear.spec.ts y pos.spec.ts.
   */
  async abrirCrearComboConProducto(nombre: string) {
    const productoReal = await this.core.obtenerPrimerProductoNormal();
    await this.abrirCrearCombo();
    await this.llenarDatosBasicosCombo(nombre);
    await this.buscarYAgregarPrimerProductoAlCombo(productoReal.nombre);
  }


  /**
   * Escenario "Crear Combo con IVA": activa el checkbox "¿Aplicar impuesto?"
   * PRIMERO y verifica que quedó marcado, y solo después maneja CABYS (si el
   * formulario lo ofrece en este ambiente — depende del país configurado para
   * la compañía, no es fijo). Ese orden es obligatorio, no cosmético:
   * confirmado en vivo que el select de tasa (`#tax_rate_list`) SOLO se
   * autosincroniza con la tasa real del CABYS aplicado si el checkbox ya
   * estaba activado en ese momento — con el checkbox desmarcado, aplicar el
   * mismo CABYS deja el select en su valor por defecto ("0% Exento") sin
   * tocarlo. Por eso, a diferencia de una versión anterior de este helper,
   * activarIvaCombo() ya no se limita a ser un respaldo para cuando CABYS no
   * aparece: es el primer paso siempre.
   *
   * Si CABYS aparece, se aplica (CABYS_BUSQUEDA = "aceite", tasa 13%) y se
   * valida que la tasa seleccionada en el combo coincide exactamente con la
   * tasa que el propio CABYS sugiere (validarIvaCoincideConCabysCombo()) — no
   * solo que "algo" quedó aplicado. Si CABYS no aparece, no se lo toca: el
   * checkbox ya activado en el paso anterior es la única señal de "con IVA"
   * disponible en ese ambiente.
   *
   * Devuelve si CABYS terminó aplicado, para que el test lo registre.
   * Centralizado aquí: existía duplicado de forma idéntica como función
   * local en pos-crear.spec.ts y pos.spec.ts.
   */
  async crearComboConIva(nombre: string): Promise<boolean> {
    await this.abrirCrearComboConProducto(nombre);

    await this.activarIvaCombo();
    await expect(
      this.checkboxIvaCombo,
      'El checkbox "¿Aplicar impuesto?" de "Crear Combo" no quedó activado'
    ).toBeChecked();

    const cabysAplicado = await this.core.manejarCabysSiAplica(CABYS_BUSQUEDA, this.core.configCabysCombo);
    if (cabysAplicado) {
      await this.validarIvaCoincideConCabysCombo();
    }

    await this.guardarComboConfigurado();
    return cabysAplicado;
  }


  /**
   * Escenario "Crear Combo sin IVA": "sin IVA" es simplemente no agregarlo —
   * el checkbox "¿Aplicar impuesto?" ya está desactivado por defecto al abrir
   * el modal, así que no hace falta tocarlo de entrada. "Sin IVA" tampoco se
   * simula buscando deliberadamente un CABYS de clasificación "Exento":
   * CABYS es un campo fiscal obligatorio independiente del checkbox, así que
   * se usa el mismo término que el escenario "con IVA" (CABYS_BUSQUEDA,
   * "aceite") si el formulario lo ofrece en este ambiente.
   *
   * Aplicar ese CABYS SÍ activa el checkbox de IVA como efecto secundario —
   * confirmado en vivo, con un desfase de ~500ms (ver
   * esperarIvaAutocompletadoCombo(), homóloga de esperarIvaAutocompletado()
   * de Producto Rápido) — así que hay que ESPERAR esa activación automática
   * antes de revertirla: desactivar el checkbox de inmediato, sin esperar,
   * corre el riesgo de ganarle la carrera al propio sistema y terminar con
   * el checkbox marcado de todos modos.
   *
   * Nota de comportamiento real del sistema (confirmado en vivo): esperando
   * correctamente esa auto-activación antes de revertirla, el checkbox
   * termina realmente desactivado, y el combo queda guardado con
   * `product_hide_apply_iva_<clave>="0"` e IVA real = 0 en el carrito, sin
   * importar si se aplicó un CABYS o no.
   *
   * Devuelve si CABYS terminó aplicado, para que el test lo registre.
   * Centralizado aquí: existía duplicado de forma idéntica como función
   * local en pos-crear.spec.ts y pos.spec.ts.
   */
  async crearComboSinIva(nombre: string): Promise<boolean> {
    await this.abrirCrearComboConProducto(nombre);

    const cabysAplicado = await this.core.manejarCabysSiAplica(CABYS_BUSQUEDA, this.core.configCabysCombo);
    if (cabysAplicado) {
      await this.esperarIvaAutocompletadoCombo();
      await this.desactivarIvaCombo();
    }

    await expect(
      this.checkboxIvaCombo,
      'El checkbox "¿Aplicar impuesto?" de "Crear Combo" no quedó desactivado'
    ).not.toBeChecked();

    await this.guardarComboConfigurado();
    return cabysAplicado;
  }


  /**
   * Busca por nombre exacto el combo recién creado en la categoría "Combos"
   * (reutilizando productoPorNombre/agregarProductoPorNombre, igual que el
   * resto de la suite para cualquier producto del catálogo) y devuelve la
   * clave de la línea que se agregó al carrito. Centralizado aquí: existía
   * duplicado de forma idéntica como función local en pos-crear.spec.ts y
   * pos.spec.ts.
   */
  async buscarComboYAgregarAlCarrito(nombre: string): Promise<string> {
    await this.core.categoriaCombos.click();
    await esperarQuedaActivo(() => this.core.categoriaEstaActiva(this.core.categoriaCombos));
    await expect(
      this.core.productoPorNombre(nombre),
      `El combo "${nombre}" no aparece en la categoría "Combos"`
    ).toHaveCount(1, { timeout: TIMEOUTS.PRODUCTS_LOAD });

    const clavesAntes = await this.core.obtenerClavesProductos();
    await this.core.agregarProductoPorNombre(nombre);
    await expect.poll(async () => (await this.core.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntes.length);
    const clavesDespues = await this.core.obtenerClavesProductos();
    return clavesDespues.find((c) => !clavesAntes.includes(c))!;
  }


  // ─── "Crear Producto" (primera tarjeta del grid de productos del POS) ──────
  //
  // Confirmado en vivo que este flujo NO es el mismo que "Inventario → Crear
  // Producto" del menú lateral (esa es una página completamente distinta,
  // /prod/product, con su propio wizard de 6 pasos) — este es un modal
  // embebido en el propio POS, con la misma arquitectura de wizard jQuery
  // Steps de 3 pasos que ya usa "Crear Combo" (Anterior/Guardar/Siguiente/
  // Finalizar/Cancelar), abierto desde la primera tarjeta especial del grid
  // de productos (`.product_box_new_item`, onclick="add_product_modal(...)").

  /** Locator del modal "Crear Producto". */
  get modalCrearProducto() {
    return this.page.locator(L.DIALOG_CREAR_PRODUCTO);
  }


  /** Locator del checkbox "¿Aplica Impuesto?" propio de "Crear Producto". */
  get checkboxIvaProducto() {
    return this.page.locator(L.PRODUCTO_APLICAR_IVA);
  }


  /**
   * Abre el modal "Crear Producto" desde la primera tarjeta del grid de
   * productos del POS. A diferencia del FAB (Producto Rápido/Combo), esta
   * tarjeta es parte del grid normal — un click simple basta, sin el ciclo
   * de expansión/reintento que sí necesita el FAB.
   */
  async abrirCrearProducto() {
    await this.core.cerrarModalNotificacionesSiAparece();
    await this.page.locator(L.PRODUCTO_TARJETA_CREAR).click();
    await expect(
      this.modalCrearProducto,
      'El modal "Crear Producto" no apareció tras clickear la tarjeta "Crear Producto" del grid'
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
  }


  /** Llena únicamente el nombre del producto (paso "Inf. General") — lo único obligatorio de ese paso. */
  async llenarNombreProducto(nombre: string) {
    await this.page.locator(L.PRODUCTO_NOMBRE).fill(nombre);
  }


  /**
   * Llena los campos adicionales de "Inf. General" para un producto Completo
   * o Fraccionado: marca, categoría/subcategoría/proveedor (Chosen, primera
   * opción real disponible — mismo criterio que el resto de la suite para
   * catálogos sin nombre estable), código de proveedor y código de barras.
   * Categoría y Proveedor NO son realmente obligatorios para guardar
   * (confirmado en vivo: el paso avanza igual sin seleccionarlos), pero el
   * escenario "Completo"/"Fraccionado" los llena de todos modos porque el
   * usuario los pidió explícitamente en la lista de campos.
   */
  async llenarDatosCompletosProducto(marca: string, codigoProveedor: string, codigoBarras: string) {
    await this.page.locator(L.PRODUCTO_MARCA).fill(marca);
    await this.core._seleccionarPrimeraOpcionChosen(L.PRODUCTO_CATEGORIA_CHOSEN);
    await this.core._seleccionarPrimeraOpcionChosenSiHayOpciones(L.PRODUCTO_SUBCATEGORIA_CHOSEN);
    await this.core._seleccionarPrimeraOpcionChosen(L.PRODUCTO_PROVEEDOR_CHOSEN);
    await this.page.locator(L.PRODUCTO_PROVEEDOR_CODIGO).fill(codigoProveedor);
    await this.page.locator(L.PRODUCTO_CODIGO_BARRAS).fill(codigoBarras);
  }


  /**
   * Avanza del paso "Inf. General" al paso "Costos" y espera la respuesta
   * real de red que efectivamente crea el producto (saveProductStepOne,
   * responde con `product_id`) — confirmado en vivo interceptando la red,
   * no solo el efecto visual del wizard.
   */
  async avanzarPasoInfoGeneralProducto() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_PRODUCTO_PASO1),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.PRODUCTO_WIZARD_SIGUIENTE).click();
    const respuesta = await respuestaPromise;
    const cuerpo = await respuesta.json();
    expect(cuerpo.status, `saveProductStepOne no respondió status=1: ${JSON.stringify(cuerpo)}`).toBe(1);
    await expect(this.page.locator(L.PRODUCTO_COSTO)).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /** Llena únicamente el Costo (paso "Costos") — el único campo común entre el modo simple y el fraccionado, ver L.PRODUCTO_FRACCIONAR. */
  async llenarCostoProducto(costo: string) {
    await this.page.locator(L.PRODUCTO_COSTO).fill(costo);
  }


  /** Llena costo, precio de venta y cantidad (paso "Costos", producto Sencillo/Completo — sin fraccionar). */
  async llenarCostosBasicosProducto(costo: string, precioVenta: string, cantidad: string) {
    await this.llenarCostoProducto(costo);
    await this.page.locator(L.PRODUCTO_PRECIO_VENTA).fill(precioVenta);
    await this.page.locator(L.PRODUCTO_CANTIDAD).fill(cantidad);
  }


  /**
   * Llena los campos adicionales de "Costos" para un producto Completo o
   * Fraccionado: stock mínimo, descuento de proveedor, descuento máximo,
   * tipo de unidad y sección/sub sección (Chosen, primera opción real).
   *
   * "Sección" (a diferencia de "Tipo de Unidad", confirmado en vivo que
   * siempre está visible en este paso) puede no estar visible en absoluto
   * según la configuración de la compañía — investigado en vivo (HONDURAS)
   * volcando la estructura real del modal: el label y el Chosen completo de
   * "Sección" quedan con `offsetParent === null`, no es un problema de
   * timing/carga. Por eso usa _seleccionarPrimeraOpcionChosenSiEsPosible()
   * (omite el campo si no aparece) en vez de la variante obligatoria — mismo
   * criterio ya usado para CABYS y "Descuento de proveedor" en este wizard.
   * "Sub sección" sigue con _seleccionarPrimeraOpcionChosenSiHayOpciones()
   * (su Chosen SÍ está visible, pero depende de la Sección elegida para
   * tener opciones reales).
   *
   * "Descuento de proveedor" (#product_discount_app) se omite si no está
   * interactuable — confirmado en vivo (reproducido de forma determinística,
   * esperando hasta 120s sin recuperación): cuando el producto tiene un
   * CABYS aplicado Y "¿Fraccionar?" activado A LA VEZ, este campo colapsa a
   * ancho 0 de forma PERMANENTE, no transitoria (sin CABYS aplicado se
   * mantiene interactuable sin importar el estado de IVA — probado
   * explícitamente activando IVA manualmente sin CABYS, y también sin IVA).
   * No es un problema de timing de este lado: es un efecto real y
   * reproducible de la propia app al combinar esos dos estados. El campo no
   * es obligatorio para guardar (solo precio por caja y precio por fracción
   * lo son en un producto Fraccionado), así que se omite en vez de fallar.
   */
  async llenarCostosCompletosProducto(stockMinimo: string, descuentoProveedor: string, descuentoMaximo: string) {
    await this.page.locator(L.PRODUCTO_STOCK_MINIMO).fill(stockMinimo);
    await this._llenarDescuentoProveedorSiEsPosible(descuentoProveedor);
    await this.page.locator(L.PRODUCTO_DESCUENTO_MAXIMO).fill(descuentoMaximo);
    await this.core._seleccionarPrimeraOpcionChosen(L.PRODUCTO_TIPO_UNIDAD_CHOSEN);
    // "Sub sección" depende de "Sección" (ver el comentario de
    // _seleccionarPrimeraOpcionChosenSiHayOpciones()): si "Sección" no
    // estaba visible y se omitió, "Sub sección" tampoco tiene razón para
    // volverse visible — confirmado en vivo, por eso también usa la
    // variante que primero confirma visibilidad del trigger, no solo la que
    // asume el trigger visible y solo revisa si tiene opciones.
    const seccionSeleccionada = await this.core._seleccionarPrimeraOpcionChosenSiEsPosible(L.PRODUCTO_SECCION_CHOSEN);
    if (seccionSeleccionada) {
      await this.core._seleccionarPrimeraOpcionChosenSiHayOpciones(L.PRODUCTO_SUBSECCION_CHOSEN);
    }
  }


  /**
   * Ver el comentario de llenarCostosCompletosProducto(): omite el campo si
   * quedó permanentemente no interactuable (CABYS + Fraccionado a la vez).
   *
   * Intenta el fill() directamente, con un timeout propio acotado, en vez
   * de comprobar isVisible() primero y llenar después: separar "verificar"
   * de "actuar" deja una ventana real donde el campo puede leerse visible
   * en el chequeo y volverse no interactuable un instante después (el mismo
   * colapso de layout, a mitad de camino) — confirmado en vivo: ese orden
   * dejó pasar la condición y el fill() posterior, sin timeout propio,
   * esperó los 300s completos del test. Intentar el fill() de una sola vez
   * con su propio límite corto evita esa ventana.
   */
  async _llenarDescuentoProveedorSiEsPosible(descuentoProveedor: string) {
    const campo = this.page.locator(L.PRODUCTO_DESCUENTO_PROVEEDOR);
    const relleno = await campo.fill(descuentoProveedor, { timeout: 5_000 }).then(() => true).catch(() => false);
    if (!relleno) {
      console.log('[llenarCostosCompletosProducto] "Descuento de proveedor" no quedó interactuable a tiempo (CABYS + Fraccionado a la vez) — se omite, no es obligatorio.');
    }
  }


  /**
   * Activa el checkbox "¿Aplica Impuesto?" de "Crear Producto". Reutiliza el
   * mismo helper genérico que ya usan Producto Rápido y Combo.
   */
  async activarIvaProducto() {
    await this.core._asegurarCheckboxEstado(this.checkboxIvaProducto, 'apply_tax_check_app', true);
  }


  /** Desactiva el checkbox "¿Aplica Impuesto?" de "Crear Producto" — contraparte de activarIvaProducto(). */
  async desactivarIvaProducto() {
    await this.core._asegurarCheckboxEstado(this.checkboxIvaProducto, 'apply_tax_check_app', false);
  }


  /**
   * Selecciona manualmente el primer tipo y la primera tasa de IVA reales
   * disponibles en "Crear Producto" (excluyendo el placeholder "Seleccione
   * una opción"). A diferencia de Producto Rápido/Combo, estos son
   * `<select>` NATIVOS sin Chosen (ver L.PRODUCTO_TIPO_IVA/PRODUCTO_TASA_IVA),
   * así que se usa `selectOption({index: 1})` directo en vez del clic-y-
   * elegir de un widget Chosen.
   *
   * Confirmado en vivo que hace falta: activar el checkbox NO deja ninguna
   * opción real preseleccionada (a diferencia de "Crear Combo", donde sí
   * queda una opción real apenas se marca el checkbox) — dejarlo así
   * bloqueaba silenciosamente el avance del wizard al presionar "Siguiente"
   * (sin error visible, solo nunca llegaba la petición de red esperada).
   * Solo tiene sentido llamarlo cuando el CABYS NO se aplicó — si se aplicó,
   * el IVA debe venir de él, no de una selección manual.
   */
  async seleccionarIvaManualmenteProducto() {
    await this.page.locator(L.PRODUCTO_TIPO_IVA).selectOption({ index: 1 });
    await this.page.locator(L.PRODUCTO_TASA_IVA).selectOption({ index: 1 });
  }


  /**
   * Activa el checkbox "¿Fraccionar?" de "Crear Producto". Al marcarlo, el
   * sistema reemplaza los campos simples de precio por los grupos "por
   * caja" y "por fracción" — confirmado en vivo comparando el DOM antes/
   * después (ver el comentario de L.PRODUCTO_FRACCIONAR).
   */
  async activarFraccionarProducto() {
    await this.core._asegurarCheckboxEstado(this.page.locator(L.PRODUCTO_FRACCIONAR), 'is_fragment_app', true);
    await expect(this.page.locator(L.PRODUCTO_PRECIO_CAJA)).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Llena los campos obligatorios que aparecen al activar "¿Fraccionar?":
   * precio por caja y precio por fracción (los únicos con `required` real,
   * confirmado en vivo comparando el DOM antes/después del checkbox — no
   * asumido), más cantidad por caja y fracciones por unidad para que los
   * precios tengan sentido de negocio.
   */
  async llenarCostosFraccionadoProducto(precioCaja: string, precioFraccion: string, cantidadCaja: string, fraccionesPorUnidad: string) {
    await this.page.locator(L.PRODUCTO_PRECIO_CAJA).fill(precioCaja);
    await this.page.locator(L.PRODUCTO_CANTIDAD_CAJA).fill(cantidadCaja);
    await this.page.locator(L.PRODUCTO_FRACCIONES_POR_UNIDAD).fill(fraccionesPorUnidad);
    await this.page.locator(L.PRODUCTO_PRECIO_FRACCION).fill(precioFraccion);
  }


  /** Lee el `percent` de la opción de tasa de IVA realmente seleccionada en "Crear Producto" (select nativo, sin Chosen). */
  async obtenerTasaIvaSeleccionadaProductoPct(): Promise<number> {
    return this.page.locator(L.PRODUCTO_TASA_IVA).evaluate(
      (el) => parseFloat((el as HTMLSelectElement).selectedOptions[0]?.getAttribute('percent') ?? 'NaN')
    );
  }


  /**
   * Valida que la tasa de IVA realmente seleccionada en "Crear Producto"
   * coincide con el IVA que el propio CABYS aplicado sugiere — mismo
   * criterio que validarIvaCoincideConCabysCombo(). Usa expect.poll() por
   * la misma razón (la sincronización tras aplicar el CABYS no es
   * necesariamente instantánea en los otros formularios de esta suite).
   */
  async validarIvaCoincideConCabysProducto() {
    const cabysTaxTexto = (await this.page.locator(L.PRODUCTO_CABYS_TAX_SUGERIDO).textContent())?.trim() ?? '';
    const cabysTaxPct = this.core._normalizarPorcentajeCabys(cabysTaxTexto);

    await expect.poll(
      () => this.obtenerTasaIvaSeleccionadaProductoPct(),
      {
        timeout: TIMEOUTS.PAYMENT_MODAL,
        message: `La tasa de IVA seleccionada en "Crear Producto" no coincidió con el IVA definido por el CABYS aplicado (${cabysTaxPct}%)`,
      }
    ).toBeCloseTo(cabysTaxPct, 1);
  }


  /**
   * Avanza del paso "Costos" al paso "Desc. Producto" y espera la respuesta
   * real de red (updateProductSteptwo).
   *
   * Estructura actual del wizard confirmada en vivo (HONDURAS, volcando el
   * `<div class="actions">` real): el `<li>` de "Siguiente" puede quedar
   * `aria-disabled="true"`/`display:none` mientras "Finalizar" ya está
   * disponible directamente desde "Costos" — confirmado tanto con los
   * campos mínimos (Producto Sencillo) como con todos los campos de
   * "Costos" llenos (Producto Completo, incluidos los Chosen): no depende
   * de qué tan completo esté el paso, es la estructura real de este wizard
   * en este ambiente. Cuando eso ocurre, ya no hay paso "Desc. Producto"
   * al que avanzar — este método lo detecta ANTES de clickear (nunca
   * clickea un `<a>` deshabilitado a ciegas) y no hace nada, dejando que
   * quien llama continúe directo con finalizarCrearProducto().
   */
  async avanzarPasoCostosProducto() {
    const siguienteDisponible = await this.page
      .locator(L.PRODUCTO_WIZARD_SIGUIENTE)
      .locator('xpath=ancestor::li[1]')
      .getAttribute('aria-disabled')
      .then((v) => v !== 'true')
      .catch(() => false);
    if (!siguienteDisponible) {
      console.log('[avanzarPasoCostosProducto] "Siguiente" no está disponible en este wizard (Finalizar ya accesible directo desde "Costos") — no hay paso "Desc. Producto" al que avanzar, se omite.');
      return;
    }
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_PRODUCTO_PASO2),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.PRODUCTO_WIZARD_SIGUIENTE).click();
    await respuestaPromise;
    await expect(this.page.locator(L.PRODUCTO_DESCRIPCION)).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Llena tamaño y descripción (paso "Desc. Producto", producto Completo/
   * Fraccionado) — se omite si ese paso no está alcanzable en este wizard
   * (ver el comentario de avanzarPasoCostosProducto()): sin paso al que
   * haber avanzado, estos campos tampoco están visibles para llenarlos.
   */
  async llenarDescripcionProducto(tamano: string, descripcion: string) {
    const campoTamano = this.page.locator(L.PRODUCTO_TAMANO);
    const visible = await campoTamano.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!visible) {
      console.log('[llenarDescripcionProducto] El paso "Desc. Producto" no está visible en este wizard — se omite tamaño/descripción.');
      return;
    }
    await campoTamano.fill(tamano);
    await this.page.locator(L.PRODUCTO_DESCRIPCION).fill(descripcion);
  }


  /**
   * Presiona "Finalizar" (solo visible en el último paso) y espera la
   * respuesta real de red que cierra el wizard (updateProductStepthree) —
   * confirmado en vivo que tras esta petición el modal se cierra solo.
   */
  async finalizarCrearProducto() {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_PRODUCTO_PASO3),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.PRODUCTO_WIZARD_FINALIZAR).click();
    const respuesta = await respuestaPromise;
    expect(respuesta.ok(), `La petición a updateProductStepthree no respondió OK (status ${respuesta.status()})`).toBe(true);
    await expect(this.modalCrearProducto).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /** Locator del checkbox "¿Aplicar impuesto?" propio de "Crear Combo", expuesto para que los tests verifiquen su estado directamente. */
  get checkboxIvaCombo() {
    return this.page.locator(L.COMBO_APLICAR_IVA);
  }


  /**
   * Activa el checkbox "¿Aplicar impuesto?" de "Crear Combo". A diferencia
   * del checkbox de "Producto Rápido", este NO tiene el bug de reseteo de
   * pos.js:680-699 (confirmado en vivo: permanece marcado incluso varios
   * segundos después de activarlo), así que no hace falta la espera de 5s ni
   * el doble reafirmado que sí necesita seleccionarIvaManualmente(). Tampoco
   * hace falta interactuar con los "Chosen" de tipo/tasa de impuesto: ambos
   * ya quedan en una opción real (no en un placeholder "Seleccionar...")
   * apenas se marca el checkbox — confirmado en vivo leyendo su `value`
   * inmediatamente después del click.
   *
   * IMPORTANTE (confirmado en vivo, contradice lo asumido originalmente):
   * si este checkbox se activa ANTES de aplicar un CABYS, el select de tasa
   * (`#tax_rate_list`) SÍ se autosincroniza con la tasa real del CABYS —
   * ver L.COMBO_TASA_IVA y validarIvaCoincideConCabysCombo(). El orden
   * activar→CABYS es entonces obligatorio para el escenario "con IVA".
   */
  async activarIvaCombo() {
    await this.core._asegurarCheckboxEstado(this.page.locator(L.COMBO_APLICAR_IVA), 'apply_tax_combo', true);
  }


  /**
   * Desactiva el checkbox "¿Aplicar impuesto?" de "Crear Combo" — contraparte
   * de activarIvaCombo(), reutilizando el mismo helper genérico
   * (_asegurarCheckboxEstado) en vez de duplicar la lógica de click/poll.
   * Usada tanto para dejar el combo explícitamente "sin IVA" como para
   * re-forzar ese estado después de aplicar un CABYS (defensivo: aunque no
   * se confirmó en vivo que aplicar un CABYS reactive este checkbox por su
   * cuenta, tampoco hay garantía de que no lo haga en otro ambiente/versión).
   */
  async desactivarIvaCombo() {
    await this.core._asegurarCheckboxEstado(this.page.locator(L.COMBO_APLICAR_IVA), 'apply_tax_combo', false);
  }
}
