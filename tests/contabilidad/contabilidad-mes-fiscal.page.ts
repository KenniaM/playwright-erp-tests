import { expect, Locator, Page } from '@playwright/test';
import { ContabilidadPage, TIMEOUTS as TIMEOUTS_CONTABILIDAD, SUBMODULOS_CONTABILIDAD } from './contabilidad.page';

// ─── Timeouts propios de Mes Fiscal ────────────────────────────────────────────
// Reutiliza TIMEOUTS de contabilidad.page.ts (mismo módulo) y agrega los que
// hacen falta para este submódulo específico — mismo criterio que
// pos-crear-cliente.page.ts reutilizando el TIMEOUTS de pos.page.ts en vez de
// declarar uno nuevo desde cero.
export const TIMEOUTS = {
  ...TIMEOUTS_CONTABILIDAD,
  TEST: 90_000,
  // save_month_by_year genera 13 registros en una sola llamada — confirmado
  // en vivo que responde en 1-3s, pero se deja margen bajo carga paralela.
  GUARDAR: 20_000,
} as const;

// URL confirmada en vivo — mismo valor exacto que SUBMODULOS_CONTABILIDAD
// ('Mes fiscal') en contabilidad.page.ts, tomado de ahí en vez de
// hardcodearlo de nuevo.
export const URL_MES_FISCAL = SUBMODULOS_CONTABILIDAD.find((s) => s.nombre === 'Mes fiscal')!.url;

export type EstadoFiltroMesFiscal = 'todos' | 'abierto' | 'cerrado';

export type ValoresPorDefectoModal = {
  anioFiscal: string;
  mes: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  esCierre: boolean;
  nota: string;
};

export type FilaMesFiscal = {
  numero: string;
  periodo: string;
  mes: string;
  inicio: string;
  fin: string;
  estado: string;
};

export type RespuestaGuardarMesFiscal = {
  result: number;
  status: string;
  created_months: number;
  total_months: number;
  message: string;
};

// `status` ausente en la respuesta real de `deleteMovement` (confirmado en
// vivo: solo trae `result`/`message`, a diferencia de `update_month_by_year`
// y `close_fm_movement`, que sí traen `status`) — opcional a propósito.
export type RespuestaAccionMesFiscal = {
  result: number;
  status?: string;
  message: string;
};

// Meses que el sistema genera automáticamente al procesar un año fiscal
// completo (confirmado en vivo: 12 meses calendario + 1 mes de "Cierre
// fiscal", nunca solo 12) — usado para validar Escenario 6.
export const MESES_GENERADOS_ESPERADOS = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
] as const;

/**
 * Page Object del submódulo "Mes Fiscal" (Contabilidad → Configuraciones
 * adicionales), encabezado real "Período Contable" (URL
 * acfiscalmonth/ac_fiscal_month). Se compone con ContabilidadPage (reutiliza
 * `irA()`) en vez de heredar de ella — mismo criterio de composición ya
 * documentado en CLAUDE.md para módulos de negocio nuevos que no necesitan
 * integrarse a una fachada compartida.
 */
export class ContabilidadMesFiscalPage {
  constructor(
    private readonly contabilidad: ContabilidadPage,
    private readonly page: Page,
  ) {}

  // ─── Locators ─────────────────────────────────────────────────────────────

  get encabezado(): Locator {
    return this.page.locator('h2', { hasText: /per[ií]odo contable/i });
  }

  get selectCompania(): Locator {
    return this.page.locator('#company_select');
  }

  get botonAnioFiscal(): Locator {
    return this.page.locator('#fmYearInputBox');
  }

  get valorAnioFiscal(): Locator {
    return this.page.locator('#fmYearInputVal');
  }

  get dropdownAnioFiscal(): Locator {
    return this.page.locator('#fmYearDropdown');
  }

  get rangoDecadaAnioFiscal(): Locator {
    return this.page.locator('#fmDecadeRange');
  }

  pillEstado(estado: EstadoFiltroMesFiscal): Locator {
    return this.page.locator(`.fm-pill-btn[data-status="${estado}"]`);
  }

  get botonAgregarMesFiscal(): Locator {
    return this.page.locator('button:has-text("Agregar mes fiscal")');
  }

  get botonActualizar(): Locator {
    return this.page.locator('button:has-text("Actualizar")');
  }

  get tabla(): Locator {
    return this.page.locator('#tFiscalMonth');
  }

  get encabezadosTabla(): Locator {
    return this.tabla.locator('thead th');
  }

  // `:visible`, no solo `tr[data-fm-id]` — confirmado en vivo que el filtro
  // de estado (Todos/Abiertos/Cerrados) oculta las filas que no matchean con
  // CSS (`display:none`) en vez de quitarlas del DOM: sin `:visible`, el
  // conteo de filas seguía devolviendo el total sin filtrar (13) incluso con
  // el filtro "Cerrados" activo y el estado vacío ya visible en pantalla.
  get filasTabla(): Locator {
    return this.page.locator('#tFiscalMonth tbody tr[data-fm-id]:visible');
  }

  get estadoVacio(): Locator {
    return this.page.locator('#fmEmptyState');
  }

  get tituloListado(): Locator {
    return this.page.locator('#fmFiscalMonthTitle');
  }

  get modalAgregar(): Locator {
    return this.page.locator('#fmAddFiscalMonthModal');
  }

  get campoAnioModal(): Locator {
    return this.page.locator('#fm_modal_year_text');
  }

  get campoMesModal(): Locator {
    return this.page.locator('#fm_modal_month_number');
  }

  get campoNombreModal(): Locator {
    return this.page.locator('#fm_modal_name');
  }

  get campoFechaInicioModal(): Locator {
    return this.page.locator('#fm_modal_start_date');
  }

  get campoFechaFinModal(): Locator {
    return this.page.locator('#fm_modal_end_date');
  }

  get checkCierreModal(): Locator {
    return this.page.locator('#fm_modal_is_close_month');
  }

  get notaInformativaModal(): Locator {
    return this.modalAgregar.locator('.fm-help-note');
  }

  get tituloModal(): Locator {
    return this.page.locator('#fmFiscalMonthModalTitle');
  }

  // Por id del span interno (#fmFiscalMonthModalSaveText), no por texto: el
  // mismo modal/botón se reutiliza para crear ("Guardar mes") y editar
  // ("Actualizar mes") — confirmado en vivo que ambos casos llaman al mismo
  // `onclick="saveFiscalMonthByYear()"`, que decide internamente si crea o
  // actualiza según `#fm_month_id` (0 = nuevo, id real = edición).
  get botonGuardarModal(): Locator {
    return this.modalAgregar.locator('button:has(#fmFiscalMonthModalSaveText)');
  }

  get botonCancelarModal(): Locator {
    return this.modalAgregar.locator('button:has-text("Cancelar")');
  }

  // ─── Menú de acciones de fila (Editar / Eliminar / Cerrar) ─────────────────

  get campoIdModal(): Locator {
    return this.page.locator('#fm_month_id');
  }

  // SweetAlert2 de confirmación (Cerrar/Eliminar) — clase real confirmada en
  // vivo (`sweetalert2` cargado en esta pantalla), distinta del `.toast-message`
  // usado para los mensajes de éxito.
  get swalConfirmacion(): Locator {
    return this.page.locator('.swal2-popup');
  }

  get swalBotonConfirmar(): Locator {
    return this.page.locator('.swal2-confirm');
  }

  get swalBotonCancelar(): Locator {
    return this.page.locator('.swal2-cancel');
  }

  // Toastr de éxito — misma clase real (`.toast-message`, no `.noty_bar`) ya
  // documentada en pos.locators.ts (TOAST_MESSAGE_GENERICO) para el otro
  // sistema de notificaciones que usa esta app; no se importa desde ahí
  // porque es una constante de un módulo distinto sin ninguna otra relación,
  // pero es el mismo selector real confirmado en vivo también aquí.
  get toastExito(): Locator {
    return this.page.locator('.toast-message');
  }

  // ─── Navegación ───────────────────────────────────────────────────────────

  /** Único punto de entrada: navega y espera la carga AJAX inicial real (no un timeout fijo). */
  async irA() {
    const esperaMovimiento = this._esperarRespuestaMovimiento();
    await this.contabilidad.irA(URL_MES_FISCAL);
    await esperaMovimiento;
    await this._cerrarAvisoNotificacionesSiAparece();
  }

  private _esperarRespuestaMovimiento() {
    return this.page.waitForResponse((r) => r.url().includes('acfiscalmonth/get_movement'), { timeout: TIMEOUTS.CARGA });
  }

  /**
   * Cierra el aviso "Activa las notificaciones del navegador"
   * (`#workshop-web-notification-permission`) si aparece — confirmado en
   * vivo que es un overlay global de la aplicación (no específico de POS)
   * que se superpone exactamente sobre los pills de estado y los botones
   * "Agregar mes fiscal"/"Actualizar" de esta pantalla, interceptando sus
   * clicks. Mismo elemento real que `PosCore.modalNotificaciones`
   * (`cerrarModalNotificacionesSiAparece`), pero no se reutiliza esa clase
   * aquí: `PosCore` es un Page Object completo del módulo POS (locators,
   * tipos y dependencias propias de ese dominio) sin ninguna relación con
   * Contabilidad — instanciarla solo por este método sería traer una
   * dependencia pesada y ajena para un overlay realmente genérico de toda la
   * app. Mismo criterio que documenta CLAUDE.md para
   * `_seleccionarPrimeraOpcionChosenMultiple`: variante acotada propia
   * cuando el helper existente no aplica limpiamente, no una duplicación
   * evitable.
   */
  private async _cerrarAvisoNotificacionesSiAparece() {
    const aviso = this.page.locator('#workshop-web-notification-permission');
    if (await aviso.isVisible().catch(() => false)) {
      await aviso.getByRole('button', { name: 'Cerrar' }).first().click({ force: true, timeout: 5_000 }).catch(() => {});
      await expect(aviso).toBeHidden({ timeout: 5_000 }).catch(() => {});
    }
  }

  /**
   * Click con reintentos acotados cerrando el aviso de notificaciones antes
   * de cada intento — mismo patrón documentado en CLAUDE_CONTEXT.md
   * ("Manejo de modales y overlays"): el aviso puede reaparecer entre el
   * cierre y el click real, así que una sola comprobación previa no basta
   * (confirmado en vivo: el aviso interceptó repetidamente los pills de
   * estado hasta agotar el test cuando solo se cerraba una vez al inicio).
   */
  private async _clickConCierreDeAviso(locator: Locator, descripcion: string) {
    const MAX_INTENTOS = 5;
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      await this._cerrarAvisoNotificacionesSiAparece();
      const logrado = await locator.click({ timeout: 5_000 }).then(() => true).catch(() => false);
      if (logrado) return;
    }
    throw new Error(`No se pudo hacer click en "${descripcion}" tras ${MAX_INTENTOS} intentos (posible overlay persistente)`);
  }

  // ─── Filtros ──────────────────────────────────────────────────────────────

  /** Selecciona una compañía por su nombre visible y espera la recarga real de la tabla. */
  async seleccionarCompania(nombreVisible: string) {
    const espera = this._esperarRespuestaMovimiento();
    await this.selectCompania.selectOption({ label: nombreVisible });
    await espera;
    await this._cerrarAvisoNotificacionesSiAparece();
  }

  /**
   * Selecciona un año fiscal en el selector de año (widget propio, no un
   * `<select>` ni un Chosen: `#fmYearInputBox` abre `#fmYearDropdown` con una
   * grilla `.fm-year-cell` por año dentro de la década visible). Si el año
   * pedido no está en la década mostrada, navega con `«`/`»`
   * (`shiftFiscalDecade`) un número acotado de veces antes de fallar.
   */
  async seleccionarAnioFiscal(anio: number) {
    await this._clickConCierreDeAviso(this.botonAnioFiscal, 'selector de año fiscal');
    await expect(this.dropdownAnioFiscal).toBeVisible({ timeout: TIMEOUTS.CARGA });

    const MAX_SALTOS_DECADA = 10;
    for (let intento = 0; intento <= MAX_SALTOS_DECADA; intento++) {
      const celda = this.dropdownAnioFiscal.locator('.fm-year-cell', { hasText: new RegExp(`^${anio}$`) });
      if (await celda.isVisible().catch(() => false)) {
        const espera = this._esperarRespuestaMovimiento();
        await celda.click();
        await espera;
        await this._cerrarAvisoNotificacionesSiAparece();
        return;
      }
      const [rangoInicio] = (await this.rangoDecadaAnioFiscal.innerText()).split('~').map((s) => parseInt(s.trim(), 10));
      const boton = this.page.locator('.fm-year-nav-btn', { hasText: anio < rangoInicio ? '«' : '»' });
      await boton.click();
    }
    throw new Error(`No se encontró el año fiscal ${anio} tras recorrer ${MAX_SALTOS_DECADA} décadas`);
  }

  /** Aplica un filtro de estado (Todos/Abiertos/Cerrados) y espera a que el pill quede activo. */
  async filtrarPorEstado(estado: EstadoFiltroMesFiscal) {
    await this._clickConCierreDeAviso(this.pillEstado(estado), `filtro de estado "${estado}"`);
    await expect(this.pillEstado(estado)).toHaveClass(/active/, { timeout: TIMEOUTS.CARGA });
  }

  // ─── Lectura de estado / tabla ──────────────────────────────────────────────

  /** true si la tabla muestra registros, false si el sistema muestra el estado vacío. Falla si ninguno de los dos es cierto (estado inconsistente). */
  async hayMesesRegistrados(): Promise<boolean> {
    await expect
      .poll(async () => (await this.filasTabla.count()) > 0 || (await this.estadoVacio.isVisible()), { timeout: TIMEOUTS.CARGA })
      .toBe(true);
    return (await this.filasTabla.count()) > 0;
  }

  /**
   * Busca, a partir de `anioInicial`, el primer año fiscal SIN registros para
   * la compañía ya seleccionada — acotado (no una búsqueda sin límite) para
   * no dejar el test esperando indefinidamente si el ambiente ya tiene todos
   * los años poblados. Necesario porque este proyecto no limpia datos entre
   * corridas (ver CLAUDE.md): sin esto, una segunda corrida contra el mismo
   * año encontraría registros de la corrida anterior en vez de un período
   * realmente vacío.
   */
  async buscarAnioSinRegistros(anioInicial: number): Promise<number> {
    const MAX_ANIOS_A_PROBAR = 15;
    for (let offset = 0; offset < MAX_ANIOS_A_PROBAR; offset++) {
      const anio = anioInicial + offset;
      await this.seleccionarAnioFiscal(anio);
      if (!(await this.hayMesesRegistrados())) return anio;
    }
    throw new Error(`No se encontró ningún año sin registros entre ${anioInicial} y ${anioInicial + MAX_ANIOS_A_PROBAR - 1}`);
  }

  async obtenerFilaComoObjeto(fila: Locator): Promise<FilaMesFiscal> {
    const celdas = fila.locator('td');
    return {
      numero: (await celdas.nth(0).innerText()).trim(),
      periodo: (await celdas.nth(1).innerText()).trim(),
      mes: (await celdas.nth(2).innerText()).trim(),
      inicio: (await celdas.nth(3).innerText()).trim(),
      fin: (await celdas.nth(4).innerText()).trim(),
      estado: (await celdas.nth(5).innerText()).trim(),
    };
  }

  // ─── Modal "Agregar mes fiscal" ─────────────────────────────────────────────

  async abrirModalAgregar() {
    await this._clickConCierreDeAviso(this.botonAgregarMesFiscal, 'Agregar mes fiscal');
    await expect(this.modalAgregar).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  async obtenerValoresPorDefectoModal(): Promise<ValoresPorDefectoModal> {
    return {
      anioFiscal: await this.campoAnioModal.inputValue(),
      mes: await this.campoMesModal.inputValue(),
      nombre: await this.campoNombreModal.inputValue(),
      fechaInicio: await this.campoFechaInicioModal.inputValue(),
      fechaFin: await this.campoFechaFinModal.inputValue(),
      esCierre: await this.checkCierreModal.isChecked(),
      nota: (await this.notaInformativaModal.innerText()).trim(),
    };
  }

  async cancelarModalAgregar() {
    await this.botonCancelarModal.click();
    await expect(this.modalAgregar).toBeHidden({ timeout: TIMEOUTS.CARGA });
  }

  /** Click en el botón de guardar/actualizar del modal, esperando la respuesta real del endpoint indicado (nunca una pausa fija). */
  private async _guardarModal<T>(fragmentoEndpoint: string): Promise<T> {
    const espera = this.page.waitForResponse(
      (r) => r.url().includes(fragmentoEndpoint),
      { timeout: TIMEOUTS.GUARDAR },
    );
    await this.botonGuardarModal.click();
    const respuesta = await espera;
    const cuerpo = (await respuesta.json()) as T;
    await expect(this.modalAgregar).toBeHidden({ timeout: TIMEOUTS.CARGA });
    return cuerpo;
  }

  /**
   * Guarda el formulario de creación y espera la respuesta real del backend
   * (`acfiscalmonth/save_month_by_year`, JSON con `created_months`/`message`)
   * — el modal cierra y la tabla se repuebla de forma asíncrona tras esta
   * respuesta.
   */
  async guardarMes(): Promise<RespuestaGuardarMesFiscal> {
    const cuerpo = await this._guardarModal<RespuestaGuardarMesFiscal>('acfiscalmonth/save_month_by_year');
    await expect.poll(() => this.filasTabla.count(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThan(0);
    return cuerpo;
  }

  // ─── Editar / Cerrar / Eliminar un mes fiscal (menú de acciones de la fila) ─

  /** Abre el menú de 3 puntos de una fila (Editar/Eliminar/Cerrar), con reintentos por si el aviso de notificaciones lo tapa. */
  async abrirMenuAcciones(fila: Locator) {
    await this._clickConCierreDeAviso(fila.locator('.fm-action-btn'), 'menú de acciones de la fila');
    await expect(fila.locator('.fm-action-dropdown')).toBeVisible({ timeout: TIMEOUTS.CARGA });
  }

  /**
   * Abre el modal de edición de una fila — mismo modal que "Agregar mes
   * fiscal" (confirmado en vivo: título cambia a "Editar mes fiscal",
   * `#fm_month_id` queda con el id real de la fila, y los campos se
   * prellenan con los datos reales del mes, no con los valores por defecto).
   */
  async abrirModalEditar(fila: Locator) {
    await this.abrirMenuAcciones(fila);
    await this._clickConCierreDeAviso(fila.locator('.fm-action-dropdown button:has-text("Editar")'), 'Editar mes fiscal');
    await expect(this.modalAgregar).toBeVisible({ timeout: TIMEOUTS.CARGA });
    await expect(this.tituloModal).toHaveText('Editar mes fiscal');
  }

  /**
   * Confirma la edición y espera la respuesta real de
   * `acfiscalmonth/update_month_by_year` (endpoint DISTINTO al de creación,
   * aunque el botón del modal sea el mismo — confirmado en vivo).
   */
  async actualizarMes(): Promise<RespuestaAccionMesFiscal> {
    return this._guardarModal<RespuestaAccionMesFiscal>('acfiscalmonth/update_month_by_year');
  }

  /**
   * Cierra un mes fiscal desde el menú de acciones de su fila. El sistema
   * pide confirmación con un SweetAlert2 ("Cerrar mes fiscal" / "Al cerrar
   * este mes se consolida la información y se genera el saldo inicial del
   * mes siguiente...") antes de llamar a `acfiscalmonth/close_fm_movement`.
   */
  async cerrarMes(fila: Locator): Promise<RespuestaAccionMesFiscal> {
    await this.abrirMenuAcciones(fila);
    await this._clickConCierreDeAviso(fila.locator('.fm-action-dropdown button:has-text("Cerrar")'), 'Cerrar mes fiscal');
    await expect(this.swalConfirmacion).toBeVisible({ timeout: TIMEOUTS.CARGA });

    const espera = this.page.waitForResponse((r) => r.url().includes('acfiscalmonth/close_fm_movement'), { timeout: TIMEOUTS.GUARDAR });
    await this.swalBotonConfirmar.click();
    const respuesta = await espera;
    return (await respuesta.json()) as RespuestaAccionMesFiscal;
  }

  /**
   * Elimina un mes fiscal desde el menú de acciones de su fila. Mismo patrón
   * de confirmación SweetAlert2 que `cerrarMes` ("Eliminar mes fiscal" / "No
   * se puede eliminar un mes si ya tiene asientos contables registrados.
   * ¿Desea continuar?" — texto de advertencia genérico del sistema, no
   * indica que el mes en cuestión SÍ tenga asientos) antes de llamar a
   * `acfiscalmonth/deleteMovement`.
   */
  async eliminarMes(fila: Locator): Promise<RespuestaAccionMesFiscal> {
    await this.abrirMenuAcciones(fila);
    await this._clickConCierreDeAviso(fila.locator('.fm-action-dropdown button:has-text("Eliminar")'), 'Eliminar mes fiscal');
    await expect(this.swalConfirmacion).toBeVisible({ timeout: TIMEOUTS.CARGA });

    const espera = this.page.waitForResponse((r) => r.url().includes('acfiscalmonth/deleteMovement'), { timeout: TIMEOUTS.GUARDAR });
    await this.swalBotonConfirmar.click();
    const respuesta = await espera;
    return (await respuesta.json()) as RespuestaAccionMesFiscal;
  }
}
