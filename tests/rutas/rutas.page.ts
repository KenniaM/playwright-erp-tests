import { expect, Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';

// ─── URL ──────────────────────────────────────────────────────────────────────

export const RUTAS_URL =
  BASE_URL + '/route/adminRoute';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:       60_000,
  NAVIGATE:   60_000,
  // Tras cargar la página, la tabla de rutas se popula vía AJAX y puede
  // tardar en aparecer — se hace polling hasta este límite antes de leer
  // el estado del módulo.
  TABLE_LOAD: 15_000,
} as const;

// ─── Locators ─────────────────────────────────────────────────────────────────

const L = {
  BUSCADOR:      '#search_route',
  BTN_BUSCAR:    '#btn_search_route',
  BTN_AGREGAR:   '#btn_add_route',
  TABLA:         '.pce-table',
  DIALOG_AGREGAR:    '#dialog_add_route',
  INPUT_NOMBRE:      '#route_name_input',
  SELECT_ZONA:       '#route_zone_select',
  BTN_GUARDAR_RUTA:  '#btn_save_new_route',
  SWEET_ALERT:       '.sweet-alert.visible',
  // El nombre de cada ruta vive en un <p id="route_name_{id}"> dedicado —
  // más preciso que leer el texto completo de la fila, que también incluye
  // el menú de acciones ("Asignar clientes/repartidores") oculto en el DOM.
  NOMBRE_RUTA:       'p[id^="route_name_"]',
  BTN_MENU_ACCIONES_RUTA: 'button.mdl-button--icon',
  // Mismo ícono de "agregar" en ambos modales (Asignar Clientes/Repartidores).
  ICONO_AGREGAR: 'i.fa-angle-double-right',
  DIALOG_ASIGNAR_CLIENTES: '#dialog_add_client_route',
  FILA_CLIENTE_SELECCIONABLE: 'tr.tr_search_internal_client',
  TBODY_CLIENTES_VINCULADOS: '#tbody_dialog_add_client_route_linked',
  DIALOG_ASIGNAR_REPARTIDORES: '#dialog_add_dealer_route',
  FILA_REPARTIDOR_SELECCIONABLE: 'tr.tr_search_internal_dealer',
  TBODY_REPARTIDORES_VINCULADOS: '#tbody_dialog_add_dealer_route_linked',
} as const;

// ─── Page Object ──────────────────────────────────────────────────────────────

export class RutasPage {
  constructor(private readonly page: Page) {}

  get buscador() {
    return this.page.locator(L.BUSCADOR);
  }

  get botonBuscar() {
    return this.page.locator(L.BTN_BUSCAR);
  }

  get botonAgregar() {
    return this.page.locator(L.BTN_AGREGAR);
  }

  get tabla() {
    return this.page.locator(L.TABLA);
  }

  get modalAgregar() {
    return this.page.locator(L.DIALOG_AGREGAR);
  }

  get inputNombre() {
    return this.page.locator(L.INPUT_NOMBRE);
  }

  get selectZona() {
    return this.page.locator(L.SELECT_ZONA);
  }

  get botonGuardarRuta() {
    return this.page.locator(L.BTN_GUARDAR_RUTA);
  }

  /** Botón "Cancelar" del modal "Agregar Nueva Ruta". */
  get botonCancelarAgregar() {
    return this.modalAgregar.locator('button', { hasText: /cancelar/i });
  }

  get modalAsignarClientes() {
    return this.page.locator(L.DIALOG_ASIGNAR_CLIENTES);
  }

  /** Botón "Cerrar" del modal "Asignar Clientes". */
  get botonCerrarAsignarClientes() {
    return this.modalAsignarClientes.locator('button', { hasText: /cerrar/i });
  }

  /**
   * Tabla de clientes ya vinculados a la ruta (lado derecho del modal). Muestra
   * "No hay clientes vinculados" cuando está vacía.
   */
  get tbodyClientesVinculados() {
    return this.modalAsignarClientes.locator(L.TBODY_CLIENTES_VINCULADOS);
  }

  get modalAsignarRepartidores() {
    return this.page.locator(L.DIALOG_ASIGNAR_REPARTIDORES);
  }

  /** Botón "Cerrar" del modal "Asignar Repartidores". */
  get botonCerrarAsignarRepartidores() {
    return this.modalAsignarRepartidores.locator('button', { hasText: /cerrar/i });
  }

  /**
   * Tabla de repartidores ya vinculados a la ruta (lado derecho del modal).
   * Muestra "No hay repartidores vinculados" cuando está vacía.
   */
  get tbodyRepartidoresVinculados() {
    return this.modalAsignarRepartidores.locator(L.TBODY_REPARTIDORES_VINCULADOS);
  }

  /**
   * Filas de datos reales de la tabla. No necesariamente usan `<td>` — se
   * identifican por contener el badge "Clientes" que acompaña a cada ruta.
   */
  get filasRutas(): Locator {
    return this.tabla.locator('tr').filter({ hasText: /clientes/i });
  }

  /** Único punto de entrada al módulo Admin. Rutas. */
  async irARutas() {
    await this.page.goto(RUTAS_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }

  /**
   * Espera hasta que la tabla de rutas tenga al menos una fila real cargada
   * vía AJAX, en vez de asumir que ya están presentes apenas navega la página.
   */
  async esperarFilasCargadas() {
    await expect
      .poll(() => this.filasRutas.count(), { timeout: TIMEOUTS.TABLE_LOAD })
      .toBeGreaterThan(0);
  }

  /** Nombres visibles (truncados) de cada ruta listada, para depuración/logs. */
  async nombresRutas(): Promise<string[]> {
    const textos = await this.filasRutas.allTextContents();
    return textos.map((t) => t.replace(/\s+/g, ' ').trim().substring(0, 60));
  }

  /**
   * Igual que `nombresRutas()`, pero lee el nombre real de cada ruta desde su
   * `<p id="route_name_{id}">` dedicado en vez del texto completo de la fila,
   * que también incluye el menú de acciones ("Asignar clientes/repartidores")
   * oculto en el DOM y contaminaría la validación de búsquedas.
   */
  async nombresRutasLimpios(): Promise<string[]> {
    const textos = await this.tabla.locator(L.NOMBRE_RUTA).allTextContents();
    return textos.map((t) => t.trim());
  }

  /** Abre el modal "Agregar Nueva Ruta". */
  async abrirFormularioAgregar() {
    await this.botonAgregar.click();
    await expect(this.modalAgregar).toBeVisible({ timeout: TIMEOUTS.TABLE_LOAD });
  }

  /**
   * Completa el formulario de la ruta (nombre + primera zona real disponible,
   * descartando la opción vacía de placeholder) y guarda. Devuelve el texto
   * de la zona seleccionada para que el test pueda validarlo.
   */
  async crearRuta(nombre: string): Promise<string> {
    await this.inputNombre.fill(nombre);
    const zonaSeleccionada = await this.seleccionarPrimeraZonaReal();

    await this.botonGuardarRuta.click();
    await this.cerrarAlertaConfirmacion();

    return zonaSeleccionada;
  }

  /**
   * Selecciona la primera opción real (con `value` no vacío) del select de
   * zona, descartando el placeholder. Devuelve el texto de la zona elegida.
   */
  async seleccionarPrimeraZonaReal(): Promise<string> {
    const opciones = await this.selectZona.locator('option').all();
    for (const opcion of opciones) {
      const valor = await opcion.getAttribute('value');
      if (valor) {
        const zona = (await opcion.textContent())?.trim() ?? '';
        await this.selectZona.selectOption(valor);
        return zona;
      }
    }
    throw new Error('No hay ninguna zona disponible para seleccionar en el formulario de ruta');
  }

  /**
   * Deja el nombre vacío, selecciona una zona real y trata de guardar —
   * usado para validar que el formulario rechaza rutas sin nombre.
   */
  async intentarGuardarConNombreVacio() {
    await this.inputNombre.fill('');
    await this.seleccionarPrimeraZonaReal();
    await this.botonGuardarRuta.click();
  }

  /** Cancela el formulario "Agregar Nueva Ruta" sin guardar. */
  async cancelarFormularioAgregar() {
    await this.botonCancelarAgregar.click();
  }

  /** Cierra el sweet-alert de confirmación que aparece tras guardar, si aparece. */
  async cerrarAlertaConfirmacion() {
    const alerta = this.page.locator(L.SWEET_ALERT);
    if (await alerta.isVisible({ timeout: TIMEOUTS.TABLE_LOAD }).catch(() => false)) {
      await alerta.locator('button.confirm').click();
    }
  }

  /** Busca una ruta por nombre usando el buscador del listado. */
  async buscarRuta(nombre: string) {
    await this.buscador.fill(nombre);
    await this.botonBuscar.click();
  }

  /** Fila del listado correspondiente a una ruta por nombre. */
  filaRuta(nombre: string): Locator {
    return this.filasRutas.filter({ hasText: nombre });
  }

  /** Cantidad de clientes vinculados que muestra el badge de una ruta, o `null` si no se pudo leer. */
  async clientesDeRuta(nombre: string): Promise<number | null> {
    const texto = await this.filaRuta(nombre).textContent();
    const match = texto?.match(/(\d+)\s*Clientes/i);
    return match ? parseInt(match[1], 10) : null;
  }

  /** Cantidad de repartidores vinculados que muestra el badge de una ruta, o `null` si no se pudo leer. */
  async repartidoresDeRuta(nombre: string): Promise<number | null> {
    const texto = await this.filaRuta(nombre).textContent();
    const match = texto?.match(/(\d+)\s*Repartidores/i);
    return match ? parseInt(match[1], 10) : null;
  }

  /** Abre el menú de acciones de una ruta y hace clic en "Asignar clientes". */
  async abrirModalAsignarClientes(nombre: string) {
    const fila = this.filaRuta(nombre);
    await fila.locator(L.BTN_MENU_ACCIONES_RUTA).click();
    await fila.getByRole('link', { name: /asignar clientes/i }).click();
    await expect(this.modalAsignarClientes).toBeVisible({ timeout: TIMEOUTS.TABLE_LOAD });
  }

  /**
   * Agrega a la ruta el primer cliente seleccionable de la lista izquierda del
   * modal. Devuelve el nombre del cliente agregado para que el test lo valide.
   */
  async agregarPrimerClienteDisponible(): Promise<string> {
    const fila = this.modalAsignarClientes.locator(L.FILA_CLIENTE_SELECCIONABLE).first();
    await expect(fila).toBeVisible({ timeout: TIMEOUTS.TABLE_LOAD });
    const nombreCliente = ((await fila.locator('.card-title').textContent()) ?? '').replace(/\s+/g, ' ').trim();

    await fila.locator(L.ICONO_AGREGAR).click();

    return nombreCliente;
  }

  /** Cierra el modal "Asignar Clientes" sin acciones adicionales. */
  async cerrarModalAsignarClientes() {
    await this.botonCerrarAsignarClientes.click();
  }

  /** Abre el menú de acciones de una ruta y hace clic en "Asignar repartidores". */
  async abrirModalAsignarRepartidores(nombre: string) {
    const fila = this.filaRuta(nombre);
    await fila.locator(L.BTN_MENU_ACCIONES_RUTA).click();
    await fila.getByRole('link', { name: /asignar repartidores/i }).click();
    await expect(this.modalAsignarRepartidores).toBeVisible({ timeout: TIMEOUTS.TABLE_LOAD });
  }

  /**
   * Agrega a la ruta el primer repartidor seleccionable de la lista izquierda
   * del modal. Devuelve el nombre del repartidor agregado para que el test lo valide.
   */
  async agregarPrimerRepartidorDisponible(): Promise<string> {
    const fila = this.modalAsignarRepartidores.locator(L.FILA_REPARTIDOR_SELECCIONABLE).first();
    await expect(fila).toBeVisible({ timeout: TIMEOUTS.TABLE_LOAD });
    const nombreRepartidor = ((await fila.locator('.card-title').textContent()) ?? '').replace(/\s+/g, ' ').trim();

    await fila.locator(L.ICONO_AGREGAR).click();

    return nombreRepartidor;
  }

  /** Cierra el modal "Asignar Repartidores" sin acciones adicionales. */
  async cerrarModalAsignarRepartidores() {
    await this.botonCerrarAsignarRepartidores.click();
  }

  /** ID numérico de una ruta, extraído del `id="tr_route_{id}"` de su fila. */
  async idDeFila(fila: Locator): Promise<string> {
    const id = await fila.getAttribute('id');
    if (!id) throw new Error('La fila de la ruta no tiene atributo id');
    return id.replace('tr_route_', '');
  }

  /**
   * Renombra una ruta existente usando la edición inline de la fila (menú de
   * acciones → "Editar ruta"): no es un modal, reemplaza el nombre y la zona
   * de la propia fila por inputs editables con botones guardar/cancelar.
   */
  async editarNombreRuta(nombreActual: string, nuevoNombre: string) {
    const fila = this.filaRuta(nombreActual);
    await fila.locator(L.BTN_MENU_ACCIONES_RUTA).click();
    await fila.getByRole('link', { name: /editar ruta/i }).click();

    const id = await this.idDeFila(fila);
    const inputNombreInline = this.page.locator(`#input_route_name_${id}`);
    await expect(inputNombreInline).toBeVisible({ timeout: TIMEOUTS.TABLE_LOAD });
    await inputNombreInline.fill(nuevoNombre);

    await this.page.locator(`#tr_route_${id} button.btn-success`).click();
    await this.cerrarAlertaConfirmacion();
  }

  /**
   * Elimina una ruta existente (menú de acciones → "Eliminar la ruta") y
   * confirma el diálogo "¿Está seguro?" que pide el sweet-alert.
   */
  async eliminarRuta(nombre: string) {
    const fila = this.filaRuta(nombre);
    await fila.locator(L.BTN_MENU_ACCIONES_RUTA).click();
    await fila.getByRole('link', { name: /eliminar/i }).click();

    const alerta = this.page.locator(L.SWEET_ALERT);
    await expect(alerta).toBeVisible({ timeout: TIMEOUTS.TABLE_LOAD });
    await expect(alerta).toContainText(/segur/i);

    await alerta.locator('button.confirm').click();
  }
}
