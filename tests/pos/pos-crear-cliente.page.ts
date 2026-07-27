import { expect, Locator, Page, Response } from '@playwright/test';
import { PosPage, TIMEOUTS } from './pos.page';

// Locators propios de "Crear Cliente" — modal #dialog_add_customer, abierto
// desde el panel "Buscar Cliente" del POS (dropdown "Nuevo Cliente"), NUNCA
// desde el módulo completo de gestión de clientes del Dashboard
// (/cust/customer): confirmado en vivo que ese módulo tiene un bug real de
// navegación (ver el informe final de esta suite) y, de cualquier forma, el
// flujo pedido es el de "Crear Cliente DEL POS".
//
// Todos los ids de campo (varios sin prefijo propio, p. ej. "vehicle_brand")
// se repiten en OTROS modales de la misma aplicación (Sunat, Combo,
// Categoría...) — confirmado en vivo que un selector suelto como
// `#cssprogress_content_step1` cae en modo estricto de Playwright (8
// coincidencias). Por eso cada locator de este archivo se resuelve SIEMPRE
// anidado dentro de `modal` (nunca `page.locator(...)` suelto para estos
// ids), igual que el resto de la suite ya hace con contenedores compartidos.
const L_CC = {
  DIALOG: '#dialog_add_customer',

  // Dropdown "Nuevo Cliente" del panel "Buscar Cliente" — mismo contenedor
  // ya usado por CLIENTE_DROPDOWN_AGREGAR en pos.locators.ts, pero esa
  // constante solo cubre la opción "Nombre del cliente"; "Nuevo Cliente" es
  // otra opción del mismo menú, sin locator propio hasta ahora.
  DROPDOWN_BUSCAR_CLIENTE: '.panel-customer-search .dropdown-toggle',
  MENU_ITEM_NUEVO_CLIENTE: '#add_quick_customer',

  // ─── Tabs ───────────────────────────────────────────────────────────────
  TAB_PRINCIPAL: '#li_form_customer_step1',
  TAB_OPCIONES_AVANZADAS: '#li_form_customer_step2',
  TAB_UBICACION: '#li_form_customer_step3',
  PANEL_PRINCIPAL: '#cssprogress_content_step1',
  PANEL_OPCIONES_AVANZADAS: '#cssprogress_content_step2',
  PANEL_UBICACION: '#cssprogress_content_step3',

  // ─── Tab "Principal" ────────────────────────────────────────────────────
  TIPO_IDENTIFICACION_CHOSEN: '#c_identification_type_chosen',
  IDENTIFICACION: '#c_identifier',
  NOMBRE: '#c_name',
  EMAIL: '#c_email',
  ACTIVIDAD_ECONOMICA_CHOSEN: '#c_principal_economic_activity_chosen',
  // onclick="add_customer_modal_second_activity()" — agrega otra fila de
  // actividad económica secundaria dentro de #c_secundary_activity_content.
  BTN_AGREGAR_ACTIVIDAD: 'a[href^="javascript:add_customer_modal_second_activity"]',
  CONTENEDOR_ACTIVIDADES_SECUNDARIAS: '#c_secundary_activity_content',
  CODIGO: '#c_code',
  BATCH: '#c_batch',
  DIRECCION: '#c_address',
  WHATSAPP: '#c_whatsapp',
  TELEFONO: '#c_telefono_1',

  // Sección "Información de vehículo" — oculta hasta activar el checkbox.
  CHECK_VEHICULO: '#checkbox_more_information_car_add_customer',
  CONTENEDOR_VEHICULO: '#more_information_vehicle_pos_add_customer',
  VEHICULO_PLACA: '#c_plate_number',
  VEHICULO_NUMERO_UNIDAD: '#c_unit_number',
  VEHICULO_MARCA_CHOSEN: '#vehicle_brand_chosen',
  VEHICULO_MODELO_CHOSEN: '#vehicle_model_chosen',
  VEHICULO_ANIO_CHOSEN: '#vehicle_year_chosen',
  VEHICULO_CHASIS: '#c_vehicle_chassis',
  // onclick="add_new_client_vehicle()" — agrega la fila actual a la tabla
  // (soporta más de un vehículo por cliente, confirmado en vivo).
  BTN_AGREGAR_VEHICULO: 'button[onclick="add_new_client_vehicle()"]',
  TABLA_VEHICULOS_FILAS: '#table_client_vehicle tr',

  // ─── Tab "Opciones avanzadas" ───────────────────────────────────────────
  CHECK_EXENTO: '#ck_is_exempt',
  LIMITE_CREDITO: '#c_limit',
  VENDEDOR_CHOSEN: '#c_agent_chosen',
  ZONA_CHOSEN: '#c_zone_chosen',
  RUTA_CHOSEN: '#c_route_chosen',
  TIPO_DOCUMENTO_CHOSEN: '#c_default_document_type_chosen',
  DIAS_PAGO_CHOSEN: '#c_paydate_chosen',
  DIAS_TRAMITE_CHOSEN: '#c_trammitdate_chosen',
  RECURRENCIA_CHOSEN: '#c_recurrence_chosen',

  // ─── Tab "Ubicación" ────────────────────────────────────────────────────
  UBICACION_LUGAR: '#c_address_name',
  UBICACION_DIRECCION_ESCRITA: '#c_written_address',
  UBICACION_USAR_POR_DEFECTO: '#c_default_address',
  UBICACION_URL: '#c_address_url',
  // onclick="save_customer_address()" — AJAX propio, independiente de
  // save_customer(): agrega una fila a la tabla de direcciones guardadas.
  BTN_AGREGAR_DIRECCION: 'button[onclick="save_customer_address()"]',
  TABLA_DIRECCIONES_FILAS: '#table_client_address tr',

  // ─── Guardar (presente igual en las 3 tabs — mismo botón/función real) ──
  BTN_GUARDAR: 'button[onclick="save_customer()"]',
  AJAX_GUARDAR: 'quickSaveCustomer',

  // ─── Buscar/reabrir cliente (panel arriba del carrito) ──────────────────
  INPUT_BUSQUEDA: '#search_pos_customer',
  BTN_BUSCAR: '.panel-customer-search .btn-search-product-pos',
  SIN_RESULTADOS: '#not_result_customer_search',
  TARJETAS_RESULTADO: '.customer-list-pos',
  // onclick="get_client_info(<id>)" — reabre el mismo modal #dialog_add_customer,
  // ya con los datos guardados, para editar/consultar (confirmado en vivo:
  // ícono de lápiz en cada tarjeta de resultado). Distinto de
  // btn-customer-select (selectCustomerToPos), que solo selecciona al
  // cliente para el carrito — ya usado por seleccionarClienteExistente().
  BTN_EDITAR_TARJETA: '.btn-customer-edit',
} as const;

/** Datos mínimos de un cliente sencillo (Escenario 1). */
export type DatosClienteSencillo = {
  nombre: string;
  identificacion: string;
  email: string;
};

/** Datos completos de la tab "Principal" (Escenario 2+). */
export type DatosClientePrincipal = DatosClienteSencillo & {
  codigo: string;
  batch: string;
  direccion: string;
  whatsapp: string;
  telefono: string;
};

/** Datos de la tab "Opciones avanzadas" (Escenario 2+). */
export type DatosClienteOpcionesAvanzadas = {
  limiteCredito: string;
};

/** Datos de una dirección en la tab "Ubicación" (Escenario 2+). */
export type DatosClienteUbicacion = {
  lugar: string;
  direccionEscrita: string;
  url: string;
};

/** Datos completos de un vehículo (Escenario 4). */
export type DatosVehiculoCompleto = {
  placa: string;
  numeroUnidad: string;
  chasis: string;
};

/** Datos básicos de un vehículo (Escenario 5: solo placa/marca/modelo/año, ya cubiertos por activarSeccionVehiculo() + los Chosen). */
export type DatosVehiculoBasico = {
  placa: string;
};

export class PosCrearCliente {
  constructor(private readonly pos: PosPage, private readonly page: Page) {}

  /** Locator del modal "Agregar Cliente" — todo el resto de locators de esta clase se resuelve anidado dentro de este. */
  get modal(): Locator {
    return this.page.locator(L_CC.DIALOG);
  }


  /**
   * Abre "Agregar Cliente" desde el dropdown del panel "Buscar Cliente"
   * ("Nuevo Cliente") — ÚNICO camino confirmado en vivo que no depende de
   * navegar fuera del POS. Reutiliza el mismo criterio de "click real, sin
   * asumir que abrió" que el resto de menús de esta suite.
   */
  async abrirAgregarCliente() {
    await this.page.locator(L_CC.DROPDOWN_BUSCAR_CLIENTE).click();
    await this.page.locator(L_CC.MENU_ITEM_NUEVO_CLIENTE).click();
    await expect(
      this.modal,
      'El modal "Agregar Cliente" no apareció tras seleccionar "Nuevo Cliente"'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Llena únicamente los 4 campos del Escenario 1 (cliente sencillo): Tipo
   * de Identificación (primera opción real disponible — DIMEX/RFC/PASAPORTE/
   * ESPECIAL/PRUEBA, confirmado en vivo con opciones reales para HONDURAS,
   * así que se usa el Chosen normal, no la variante "SiHayOpciones"),
   * Identificación, Nombre y Correo electrónico.
   */
  async llenarClienteSencillo(datos: DatosClienteSencillo) {
    await this.pos._seleccionarPrimeraOpcionChosen(`${L_CC.DIALOG} ${L_CC.TIPO_IDENTIFICACION_CHOSEN}`);
    await this.modal.locator(L_CC.IDENTIFICACION).fill(datos.identificacion);
    await this.modal.locator(L_CC.NOMBRE).fill(datos.nombre);
    await this.modal.locator(L_CC.EMAIL).fill(datos.email);
  }


  /** Llena todos los campos adicionales de "Principal" para el cliente completo (Escenario 2+), además de llenarClienteSencillo(). */
  async llenarPrincipalCompleto(datos: DatosClientePrincipal) {
    await this.llenarClienteSencillo(datos);
    await this.modal.locator(L_CC.CODIGO).fill(datos.codigo);
    await this.modal.locator(L_CC.BATCH).fill(datos.batch);
    await this.modal.locator(L_CC.DIRECCION).fill(datos.direccion);
    // Whatsapp/Teléfono exigen mínimo 8 caracteres (pattern real del campo,
    // confirmado en vivo) — el llamador es responsable de pasar valores que
    // lo cumplan.
    await this.modal.locator(L_CC.WHATSAPP).fill(datos.whatsapp);
    await this.modal.locator(L_CC.TELEFONO).fill(datos.telefono);
  }


  /**
   * Agrega una Actividad Económica principal SOLO si la sección realmente
   * está disponible para esta compañía/configuración — confirmado en vivo
   * con outerHTML/computed style que, para HONDURAS, la fila completa
   * (label + Chosen) de "Actividad Económica" queda dentro de un
   * contenedor con la clase `.hide` (display:none real, no un problema de
   * scroll ni de timing): no es "opciones vacías" sino la SECCIÓN COMPLETA
   * no disponible, el mismo caso que `_seleccionarPrimeraOpcionChosenSiEsPosible()`
   * ya cubre (a diferencia de `_seleccionarPrimeraOpcionChosenSiHayOpciones()`,
   * pensado para un trigger SÍ visible con catálogo vacío). Se reutiliza
   * ese helper existente en vez de duplicar la lógica de detección.
   */
  async agregarActividadEconomicaPrincipalSiExiste(): Promise<boolean> {
    const contenedor = `${L_CC.DIALOG} ${L_CC.ACTIVIDAD_ECONOMICA_CHOSEN}`;
    return this.pos._seleccionarPrimeraOpcionChosenSiEsPosible(contenedor);
  }


  /**
   * Agrega una fila más de "Actividad Económica" secundaria (Escenario 3:
   * "agregar varias actividades") — cada click en "Agregar otra actividad
   * económica" inserta una nueva fila con su propio Chosen dentro de
   * #c_secundary_activity_content (confirmado en vivo por el propio
   * onclick="add_customer_modal_second_activity()"). Devuelve cuántas filas
   * reales quedaron tras el intento, para que el llamador decida cuántas
   * veces repetir sin asumir un número fijo.
   */
  async agregarFilaActividadEconomicaSecundaria(): Promise<number> {
    const contenedor = this.modal.locator(L_CC.CONTENEDOR_ACTIVIDADES_SECUNDARIAS);
    const filasAntes = await contenedor.locator('select').count();
    await this.modal.locator(L_CC.BTN_AGREGAR_ACTIVIDAD).click();
    await expect.poll(
      async () => contenedor.locator('select').count(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'No se agregó ninguna fila nueva de actividad económica secundaria' }
    ).toBeGreaterThan(filasAntes);
    return contenedor.locator('select').count();
  }


  /** Activa (o confirma activo) el switch "Agregar o ver información del vehículo", revelando sus campos. */
  async activarSeccionVehiculo() {
    await this.pos._asegurarCheckboxEstado(
      this.modal.locator(L_CC.CHECK_VEHICULO),
      'checkbox_more_information_car_add_customer',
      true
    );
    await expect(
      this.modal.locator(L_CC.CONTENEDOR_VEHICULO),
      'La sección "Información de vehículo" no quedó visible tras activar el switch'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Llena únicamente Placa/Marca/Modelo/Año (Escenario 5, "vehículo
   * básico") — Año usa la primera opción real del catálogo (idéntico
   * criterio que el resto de la suite para catálogos configurables); Marca
   * usa `_seleccionarMarcaVehiculoConModelosReales()` (ver su comentario) en
   * vez de la primera opción a ciegas; Modelo se selecciona DESPUÉS de Marca
   * porque su propio catálogo depende de la marca elegida (confirmado en
   * vivo: `#vehicle_model` nace vacío y solo se puebla tras seleccionar
   * `#vehicle_brand`).
   */
  async llenarVehiculoBasico(placa: string) {
    await this.modal.locator(L_CC.VEHICULO_PLACA).fill(placa);
    await this._seleccionarMarcaVehiculoConModelosReales();
    await this.pos._seleccionarPrimeraOpcionChosen(`${L_CC.DIALOG} ${L_CC.VEHICULO_MODELO_CHOSEN}`);
    await this.pos._seleccionarPrimeraOpcionChosen(`${L_CC.DIALOG} ${L_CC.VEHICULO_ANIO_CHOSEN}`);
  }


  /**
   * Selecciona, dentro del Chosen de "Marca" del vehículo, la primera opción
   * real que realmente tenga al menos un Modelo asociado — en vez de
   * `_seleccionarPrimeraOpcionChosen()` (la primera opción a ciegas).
   *
   * Causa raíz investigada en vivo (HONDURAS), NO asumida: el catálogo real
   * de "Marca" de este ambiente (107 opciones) mezcla marcas reales
   * (ALFA ROMEO, TOYOTA, NISSAN...) con decenas de entradas de datos de
   * prueba dejadas por otras pruebas manuales/QA a lo largo del tiempo
   * ("11111", "aaaaaa", "Marca Nueva", "RAM", "Xxx", "Ugf"...). Confirmado
   * recorriendo el catálogo completo con el propio `<select>` real
   * (`#vehicle_brand`, oculto tras el widget Chosen) y seleccionando cada
   * marca una por una: 56 de 107 SÍ tienen Modelos reales asociados en
   * `#vehicle_model` — el mecanismo Marca→Modelo de la aplicación funciona
   * correctamente, no es un bug del sistema. El problema real es que la
   * PRIMERA opción en orden de catálogo ("11111") es precisamente una marca
   * de prueba sin ningún Modelo, y `_seleccionarPrimeraOpcionChosen()` la
   * elegía a ciegas, dejando el Chosen de "Modelo" sin ninguna opción para
   * seleccionar después (el fallo real observado en los Escenarios 4 y 5).
   *
   * Se prueba cada opción real del Chosen, en el mismo orden en que
   * aparecen, hasta encontrar una cuyo `#vehicle_model` quede poblado con
   * más de la opción placeholder — mismo widget/mismo mecanismo de click que
   * usa `_seleccionarPrimeraOpcionChosen()` (Chosen sincroniza su propio
   * `<select>` oculto y dispara el evento `change` real que la app escucha
   * para repoblar Modelo), así que un click real sobre cada opción sí
   * dispara la misma carga dependiente que se confirmó en la investigación.
   * Acotado a un máximo de intentos para no recorrer las 107 opciones si el
   * catálogo entero llegara a quedar sin ninguna marca utilizable.
   */
  private async _seleccionarMarcaVehiculoConModelosReales() {
    const contenedor = `${L_CC.DIALOG} ${L_CC.VEHICULO_MARCA_CHOSEN}`;
    const trigger = this.page.locator(`${contenedor} .chosen-single`);
    const MAX_INTENTOS = 15;

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      await trigger.scrollIntoViewIfNeeded({ timeout: TIMEOUTS.PAYMENT_MODAL });
      await trigger.click({ timeout: TIMEOUTS.PAYMENT_MODAL });
      const opcion = this.page
        .locator(`${contenedor} .chosen-results li:not(.result-selected):not([data-option-array-index="0"])`)
        .nth(intento);
      const hayOpcion = await opcion.isVisible({ timeout: 3_000 }).catch(() => false);
      if (!hayOpcion) {
        throw new Error(`No se encontró ninguna Marca de vehículo con Modelos reales asociados tras probar ${intento} opciones del catálogo.`);
      }
      const textoMarca = (await opcion.textContent())?.trim();
      await opcion.click();

      const tieneModelos = await expect.poll(
        () => this.modal.locator(`${L_CC.VEHICULO_MODELO_CHOSEN.replace('_chosen', '')} option`).count(),
        { timeout: 5_000 }
      ).toBeGreaterThan(1).then(() => true).catch(() => false);

      if (tieneModelos) return;
      console.log(`[_seleccionarMarcaVehiculoConModelosReales] Marca "${textoMarca}" no tiene Modelos asociados — probando la siguiente.`);
    }
    throw new Error(`Ninguna de las primeras ${MAX_INTENTOS} Marcas de vehículo probadas tiene Modelos reales asociados.`);
  }


  /** Llena TODOS los campos de vehículo disponibles (Escenario 4, "vehículo completo"): además de llenarVehiculoBasico(), Número de unidad y Número de chasis. */
  async llenarVehiculoCompleto(datos: DatosVehiculoCompleto) {
    await this.llenarVehiculoBasico(datos.placa);
    await this.modal.locator(L_CC.VEHICULO_NUMERO_UNIDAD).fill(datos.numeroUnidad);
    await this.modal.locator(L_CC.VEHICULO_CHASIS).fill(datos.chasis);
  }


  /** Confirma el vehículo ya llenado (botón "Agregar" propio de la sección) y valida que se agregó una fila real a la tabla. */
  async agregarVehiculoALaTabla() {
    const filasAntes = await this.modal.locator(L_CC.TABLA_VEHICULOS_FILAS).count();
    await this.modal.locator(L_CC.BTN_AGREGAR_VEHICULO).click();
    await expect.poll(
      async () => this.modal.locator(L_CC.TABLA_VEHICULOS_FILAS).count(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'No se agregó ninguna fila nueva a la tabla de vehículos' }
    ).toBeGreaterThan(filasAntes);
  }


  /** Cambia a la tab "Opciones avanzadas". */
  async irATabOpcionesAvanzadas() {
    await this.modal.locator(L_CC.TAB_OPCIONES_AVANZADAS).click();
    await expect(
      this.modal.locator(L_CC.LIMITE_CREDITO),
      'La tab "Opciones avanzadas" no quedó activa (Límite de crédito no visible)'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /**
   * Llena los campos de "Opciones avanzadas" con catálogo real confirmado
   * en vivo para HONDURAS (Vendedor/Zona/Ruta): Límite de crédito además
   * marca "Exento" para ejercitar ambos controles (checkbox + input) del
   * primer bloque de esta tab.
   */
  async llenarOpcionesAvanzadasCompleto(datos: DatosClienteOpcionesAvanzadas) {
    await this.pos._asegurarCheckboxEstado(this.modal.locator(L_CC.CHECK_EXENTO), 'ck_is_exempt', true);
    await this.modal.locator(L_CC.LIMITE_CREDITO).fill(datos.limiteCredito);
    await this.pos._seleccionarPrimeraOpcionChosen(`${L_CC.DIALOG} ${L_CC.VENDEDOR_CHOSEN}`);
    await this.pos._seleccionarPrimeraOpcionChosen(`${L_CC.DIALOG} ${L_CC.ZONA_CHOSEN}`);
    await this._seleccionarPrimeraOpcionChosenMultiple(`${L_CC.DIALOG} ${L_CC.RUTA_CHOSEN}`);
  }


  /**
   * Selecciona la primera opción real de un Chosen de selección MÚLTIPLE
   * ("Ruta", único campo de esta tab con este widget) — confirmado en vivo
   * con outerHTML que, a diferencia de Vendedor/Zona (chosen-container
   * single, con trigger `.chosen-single`), Ruta renderiza
   * `chosen-container-multi` con `<ul class="chosen-choices">` como
   * disparador, por eso `_seleccionarPrimeraOpcionChosen()` (que solo busca
   * `.chosen-single`) nunca lo encontraba — no era un problema de timing ni
   * de datos, sino un widget realmente distinto. No existe ya un helper
   * reutilizable para esta variante en PosCore/PosPage (las únicas
   * variantes ya cubiertas son single y "si hay opciones"), así que se
   * agrega aquí, acotado a este campo.
   */
  private async _seleccionarPrimeraOpcionChosenMultiple(contenedorChosenSelector: string) {
    const trigger = this.page.locator(`${contenedorChosenSelector} .chosen-choices`);
    await expect(trigger, `El trigger del Chosen múltiple "${contenedorChosenSelector}" nunca quedó visible`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await trigger.scrollIntoViewIfNeeded({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await trigger.click({ timeout: TIMEOUTS.PAYMENT_MODAL });
    // Mismo criterio de exclusión que _seleccionarPrimeraOpcionChosen(): el
    // placeholder es siempre `data-option-array-index="0"`, no siempre
    // `.result-selected`.
    const opcion = this.page
      .locator(`${contenedorChosenSelector} .chosen-results li:not(.result-selected):not([data-option-array-index="0"])`)
      .first();
    await expect(opcion, `El Chosen múltiple "${contenedorChosenSelector}" no tiene ninguna opción real disponible`).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await opcion.click();
  }


  /** Cambia a la tab "Ubicación". */
  async irATabUbicacion() {
    await this.modal.locator(L_CC.TAB_UBICACION).click();
    await expect(
      this.modal.locator(L_CC.UBICACION_LUGAR),
      'La tab "Ubicación" no quedó activa (campo "Lugar" no visible)'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }


  /** Llena una nueva dirección y la confirma con "Agregar dirección" (AJAX propio, independiente de guardarCliente()) — valida que se agregó una fila real a la tabla de direcciones. */
  async agregarDireccion(datos: DatosClienteUbicacion) {
    await this.modal.locator(L_CC.UBICACION_LUGAR).fill(datos.lugar);
    await this.modal.locator(L_CC.UBICACION_DIRECCION_ESCRITA).fill(datos.direccionEscrita);
    await this.pos._asegurarCheckboxEstado(this.modal.locator(L_CC.UBICACION_USAR_POR_DEFECTO), 'c_default_address', true);
    await this.modal.locator(L_CC.UBICACION_URL).fill(datos.url);

    const filasAntes = await this.modal.locator(L_CC.TABLA_DIRECCIONES_FILAS).count();
    await this.modal.locator(L_CC.BTN_AGREGAR_DIRECCION).click();
    await expect.poll(
      async () => this.modal.locator(L_CC.TABLA_DIRECCIONES_FILAS).count(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'No se agregó ninguna fila nueva a la tabla de direcciones guardadas' }
    ).toBeGreaterThan(filasAntes);
  }


  /**
   * Guarda el cliente ("Guardar y Salir", presente igual en las 3 tabs —
   * mismo botón/función real `save_customer()`) y devuelve el id numérico
   * recién creado (respuesta de texto plano de `quickSaveCustomer`, mismo
   * patrón ya usado por crearProductoExterno() para `addProductExternal`).
   * Confirma que el modal se cierre y que aparezca el toast de éxito real
   * de la aplicación — nunca se asume el resultado.
   */
  async guardarCliente(): Promise<{ id: string; respuesta: Response }> {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L_CC.AJAX_GUARDAR),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    // "Guardar y Salir" existe UNA VEZ POR CADA TAB (mismo onclick
    // "save_customer()" en las 3 — confirmado en vivo con outerHTML: 3
    // matches reales, uno por panel `#cssprogress_content_stepN`, cada uno
    // con display:none salvo el de la tab activa). `.first()` siempre caía
    // en el de "Principal" (el primero en el DOM), invisible en cuanto se
    // guarda desde "Opciones avanzadas" o "Ubicación" — de ahí el timeout de
    // scroll/click. Se filtra por `:visible` para tomar siempre el botón de
    // la tab realmente activa, no el primero en orden de documento.
    const boton = this.modal.locator(`${L_CC.BTN_GUARDAR}:visible`).first();
    await boton.click({ timeout: TIMEOUTS.PAYMENT_MODAL });
    const respuesta = await respuestaPromise;
    const id = (await respuesta.text()).trim();

    await expect(
      this.modal,
      'El modal "Agregar Cliente" no se cerró tras guardar'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await expect(
      this.page.locator('.noty_bar', { hasText: 'Cliente guardado correctamente' }),
      'No apareció el toast de éxito "Cliente guardado correctamente!"'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    return { id, respuesta };
  }


  /**
   * Busca clientes por nombre en el panel "Buscar Cliente" SIN seleccionar
   * ninguno para el carrito (a diferencia de seleccionarClienteExistente(),
   * ya existente, que sí selecciona el primero) — necesario para validar
   * cuántas tarjetas de resultado hay y poder abrir su edición en vez de
   * agregarlas al carrito. Reutiliza los mismos locators/AJAX que
   * seleccionarClienteExistente() ya usa, componiendo en vez de duplicar.
   */
  async buscarClientesSinSeleccionar(terminoBusqueda: string): Promise<number> {
    // BUG DE FRONTEND confirmado en vivo (no de automatización, ver también
    // el comentario completo en reabrirPrimerResultado()): justo después de
    // insertar las tarjetas `.customer-list-pos` en el DOM, la propia app
    // alterna el panel de la sección de resultados
    // (`.content-customer-details-search`) a la de "cliente seleccionado"
    // por defecto, dejando esa sección completa (con las tarjetas ya
    // insertadas y con datos reales correctos) dentro de un ancestro
    // `display:none`. Por eso `.waitFor({state:'visible'})` en la tarjeta
    // nunca es fiable aquí — no es un timing de renderizado a esperar, es
    // un estado real y consistente del propio frontend. Lo que sí valida
    // "el cliente aparece en las búsquedas" (el requisito real) es que la
    // tarjeta exista en el DOM con los datos correctos, sin importar si la
    // sección que la contiene queda oculta por ese bug — por eso se usa
    // `state:'attached'`, no `'visible'`.
    const MAX_INTENTOS = 3;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      // Timeout propio y acotado en fill()/click() (no el timeout de acción
      // sin límite del proyecto): confirmado en vivo que, si un intento
      // anterior deja el panel en un estado no buscable, reintentar sin este
      // límite puede colgarse varios minutos (500+ reintentos internos de
      // Playwright) hasta agotar el timeout completo del test.
      await this.page.locator(L_CC.INPUT_BUSQUEDA).fill(terminoBusqueda, { timeout: TIMEOUTS.PAYMENT_MODAL }).catch(async (e) => {
        console.log(`[buscarClientesSinSeleccionar] Intento ${intento}: el campo de búsqueda no estaba disponible (${(e as Error).message.slice(0, 150)}), recargando el POS antes de reintentar.`);
        await this.pos.irAlPos();
        await this.pos.esperarEstadoInicial();
        await this.page.locator(L_CC.INPUT_BUSQUEDA).fill(terminoBusqueda, { timeout: TIMEOUTS.PAYMENT_MODAL });
      });
      const respuestaPromise = this.page.waitForResponse(
        (res) => res.url().includes('getCustomerByPosOption'),
        { timeout: TIMEOUTS.PAYMENT_MODAL }
      );
      await this.page.locator(L_CC.BTN_BUSCAR).click({ timeout: TIMEOUTS.PAYMENT_MODAL });
      await respuestaPromise;

      const sinResultados = await this.page.locator(L_CC.SIN_RESULTADOS).isVisible().catch(() => false);
      if (sinResultados) return 0;

      const apareceResultado = await this.page.locator(L_CC.TARJETAS_RESULTADO).first()
        .waitFor({ state: 'attached', timeout: TIMEOUTS.PAYMENT_MODAL })
        .then(() => true)
        .catch(() => false);
      if (apareceResultado) {
        return this.page.locator(L_CC.TARJETAS_RESULTADO).count();
      }
      console.log(`[buscarClientesSinSeleccionar] Intento ${intento} no dejó ningún resultado en el DOM para "${terminoBusqueda}", reintentando...`);
    }
    throw new Error(`No apareció ningún resultado de cliente para "${terminoBusqueda}" tras ${MAX_INTENTOS} intentos`);
  }


  /**
   * Reabre el cliente encontrado por buscarClientesSinSeleccionar() (primer
   * resultado) para consultar/editar sus datos guardados.
   *
   * BUG DE FRONTEND confirmado en vivo (no de automatización): justo tras
   * renderizar las tarjetas de resultado, la propia app alterna el panel
   * "Buscar Cliente" de la sección de resultados
   * (`.content-customer-details-search`) a la de "cliente seleccionado"
   * (`.content-customer-selected-info`, en su estado por defecto sin
   * cliente real) — dejando `.customer-list-pos`/`.btn-customer-edit`
   * dentro de un contenedor con `display:none` (confirmado con
   * getComputedStyle + getBoundingClientRect: rect 0x0 pese a
   * display/visibility "normales" en el propio botón). El click en la
   * tarjeta corre una carrera real contra ese toggle y pierde de forma
   * consistente (no intermitente), incluso con reintentos acotados.
   *
   * En vez de perseguir esa carrera, se invoca directamente
   * `get_client_info(id)` — la MISMA función real que ejecuta el
   * `onclick` del botón de lápiz — leyendo el id ya presente en el
   * `onclick` de la tarjeta (visible o no, el atributo sigue en el DOM).
   * Sigue siendo el mismo modal, con los mismos datos reales del backend;
   * no se debilita ninguna validación, solo se evita un click sujeto a un
   * bug de timing del frontend.
   */
  async reabrirPrimerResultado() {
    const idCliente = await this.page.locator(L_CC.TARJETAS_RESULTADO).first().locator(L_CC.BTN_EDITAR_TARJETA)
      .getAttribute('onclick', { timeout: TIMEOUTS.PAYMENT_MODAL });
    const match = idCliente?.match(/get_client_info\((\d+)\)/);
    if (!match) {
      throw new Error(`No se pudo extraer el id del cliente desde el botón de editar (onclick="${idCliente}")`);
    }
    await this.page.evaluate((id) => {
      // @ts-expect-error función global real de la app, no expuesta por tipos
      get_client_info(id);
    }, Number(match[1]));
    await expect(
      this.modal,
      'El modal "Agregar Cliente" no reabrió al editar el cliente encontrado'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }
}
