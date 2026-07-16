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

// Parte del plan de migración a composición: dominio "PAYMENT" extraído
// de pos.page.ts. Depende de core por inyección de
// constructor (composición, no herencia) — nunca al revés. Miembros que eran
// 'private' en el monolito pasan a públicos aquí por el mismo motivo que en
// PosCore: los llama la fachada por composición, no por herencia.
export class PosPayment {
  private readonly core: PosCore;

  constructor(core: PosCore) {
    this.core = core;
  }

  private get page() { return this.core.page; }


  /**
   * Locator del SweetAlert opcional "Información de pago" que puede aparecer
   * tras presionar "Facturar", pidiendo confirmar con "Pagar" antes de que la
   * venta continúe. Confirmado en vivo (con la cuenta QA/HONDURAS) que es
   * distinto del aviso "¿Desea imprimir copia?" (otro `.sweet-alert` ya
   * manejado aparte): éste usa la clase custom `confirm-complete-sale` en vez
   * de `visible`, por lo que se filtra por esa clase para no confundirlos.
   */
  get confirmacionPago() {
    return this.page.locator('.sweet-alert.confirm-complete-sale');
  }


  /**
   * Locator del panel "Información del Cliente" (`#myNavClient`) que puede
   * aparecer, DENTRO del propio modal de pago (`#dialog_payment`, nunca un
   * modal ni SweetAlert separado — confirmado en vivo inspeccionando su
   * `outerHTML`: es un `<div class="overlay overlay-hgt overlay-hgt-efect">`
   * anidado en `#dialog_payment`), cuando el documento electrónico
   * seleccionado (confirmado en vivo con "Factura Electrónica" en TALLER
   * ALPHA PREMIUM) exige datos del cliente (nombre, identificación, correo,
   * dirección, etc.) para completar la venta. No siempre aparece — depende
   * del documento electrónico activo y, aun con el mismo documento, no es
   * consistente entre intentos (confirmado en vivo: dos corridas
   * consecutivas con "Factura Electrónica", una lo mostró y la otra no).
   */
  get panelInformacionCliente() {
    return this.page.locator('#myNavClient');
  }


  /**
   * Presiona "Facturar" para abrir el modal de pago. La apertura de caja, si es
   * necesaria, solo puede ocurrir más adelante al confirmar el pago —no aquí—.
   */
  async presionarFacturar() {
    await this.page.locator(L.BTN_FACTURAR).click();
  }


  /** Espera a que el modal de pago esté listo para recibir el método de pago. */
  async esperarModalPago() {
    await this.page.locator(L.EFECTIVO_MONTO).waitFor({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.page.waitForTimeout(PAUSES.VER_MODAL);
  }


  /**
   * Presiona el primer "Facturar" (abre el modal de pago). Este botón nunca requiere
   * abrir la caja —eso solo puede ocurrir al confirmar el pago, más adelante— así que
   * aquí no se valida ni se intenta abrir la caja en ningún caso. Centralizado aquí:
   * existía duplicado de forma idéntica como función local en pos-crear.spec.ts,
   * pos-facturar.spec.ts, pos-navegacion.spec.ts y pos.spec.ts.
   *
   * No toca el tipo de documento electrónico aquí: la opción que el ambiente
   * ya trae seleccionada por defecto se deja tal cual — solo
   * confirmarPagoAbriendoCajaSiEsNecesario() la cambia, y solo si esa opción
   * demuestra en la práctica que no deja completar la venta (ver
   * _localizarSelectorDocumentoElectronico()).
   */
  async abrirModalDePago() {
    await this.presionarFacturar();
    await this.esperarModalPago();
  }


  /**
   * Ubica (si existe) el control de tipo de documento electrónico del modal
   * de pago — `#payment_electronic_document_type` dentro de `#dialog_payment`.
   * Confirmado en vivo (TALLER ALPHA PREMIUM, leyendo el bundle real
   * `pos.js` servido por el ambiente, no asumido) que este id es una
   * constante del propio template de facturación electrónica de Costa Rica,
   * no un valor específico de esta compañía: `pos.js` lo referencia por ese
   * mismo id de forma hardcodeada decenas de veces (p. ej.
   * `$('#payment_electronic_document_type').val(...)`) para inicializarlo y
   * para leerlo en la validación de la venta — cualquier compañía con
   * `is_electronic_billing_cr()` activo lo sirve con este mismo id. Devuelve
   * null si el modal no tiene ningún control de este tipo — comportamiento
   * válido (Escenario 5): la compañía no tiene facturación electrónica,
   * continuar normalmente.
   */
  async _localizarSelectorDocumentoElectronico(): Promise<Locator | null> {
    const select = this.page.locator(`${L.DIALOG_PAGO} #payment_electronic_document_type`);
    return (await select.count()) > 0 ? select : null;
  }


  /**
   * Cambia el documento electrónico a "Tiquete Electrónico" si el select
   * tiene esa opción y no está ya seleccionada. Se busca por su texto visible
   * (nunca por posición): confirmado en vivo que "Tiquete Electrónico" es
   * terminología fija de Hacienda (Costa Rica) — el mismo nombre para
   * cualquier compañía costarricense con facturación electrónica, no un
   * valor propio de esta compañía. Confirmado también en vivo, leyendo
   * `pos.js`, que esta opción es la única con esa propiedad: la validación
   * que exige datos del cliente (`get_and_validate_client_pos`, disparada
   * desde `confirm_add_sale_validate()`) solo se ejecuta cuando
   * `payment_electronic_document_type === 1` ("Factura Electrónica"); ninguna
   * otra opción —incluida "Tiquete Electrónico"— entra a esa validación.
   *
   * Devuelve false (sin lanzar) si no hay select, si no existe la opción
   * "Tiquete Electrónico" en este ambiente, o si ya estaba seleccionada —
   * quien llama decide entonces que no hay forma automática de continuar.
   */
  async _cambiarATiqueteElectronicoSiEsPosible(): Promise<boolean> {
    const select = await this._localizarSelectorDocumentoElectronico();
    if (!select) return false;

    const { opciones, seleccionada } = await this._leerOpcionesDocumentoElectronico(select);
    const indiceTiquete = opciones.findIndex((o) => /tiquete/i.test(o));
    if (indiceTiquete === -1 || indiceTiquete === seleccionada) return false;

    await this._seleccionarOpcionDocumentoElectronicoPorIndice(select, indiceTiquete);
    await expect
      .poll(() => select.evaluate((el: HTMLSelectElement) => el.selectedIndex))
      .toBe(indiceTiquete);
    return true;
  }


  /**
   * Lee todas las opciones del selector de documento electrónico y cuál está
   * seleccionada actualmente (por posición real en el DOM — `selectedIndex`
   * del `<select>` real, que el widget "Chosen" ya mantiene sincronizado con
   * la opción visible — nunca asumida por nombre).
   */
  async _leerOpcionesDocumentoElectronico(select: Locator): Promise<{ opciones: string[]; seleccionada: number }> {
    const opciones = await select.locator('option').allTextContents();
    const seleccionada = await select.evaluate((el: HTMLSelectElement) => el.selectedIndex);
    return { opciones: opciones.map((o) => o.trim()), seleccionada };
  }


  /**
   * Selecciona una opción del documento electrónico por su POSICIÓN real en
   * el `<select>` (nunca por el texto de la opción). Widget real confirmado
   * en vivo: `<select>` oculto sincronizado con un dropdown "Chosen" (mismo
   * patrón que el resto de esta clase: nunca `selectOption()` sobre el
   * `<select>` oculto, se opera sobre `.chosen-single`/`.chosen-results`).
   * Variante defensiva incluida para un `<select>` nativo visible (sin
   * Chosen), por si algún otro ambiente no usa este widget — sin evidencia
   * propia de que exista, solo cobertura acorde a "no asumir un único
   * widget posible".
   */
  async _seleccionarOpcionDocumentoElectronicoPorIndice(select: Locator, indice: number) {
    const id = await select.getAttribute('id');
    const contenedorChosen = id ? this.page.locator(`#${id}_chosen`) : null;

    if (contenedorChosen && (await contenedorChosen.isVisible().catch(() => false))) {
      await contenedorChosen.locator('.chosen-single').click();
      await contenedorChosen.locator('.chosen-results li').nth(indice).click();
      return;
    }

    if (await select.isVisible().catch(() => false)) {
      await select.selectOption({ index: indice });
    }
  }


  /** Llena el monto en efectivo y el dinero recibido. Efectivo permite superar el total. */
  async seleccionarPagoEfectivo(monto: string) {
    await this.page.locator(L.EFECTIVO_MONTO).fill(monto);
    await this.page.locator(L.EFECTIVO_RECIBIDO).fill(monto);
    await this.page.waitForTimeout(PAUSES.VER_MONTO);
  }


  /**
   * Selecciona un método de pago que requiere monto exacto (tarjeta, SINPE, transacción).
   * Lee el total de la factura desde el DOM y lo aplica al input del método indicado.
   */
  async seleccionarPagoExacto(metodo: MetodoPago) {
    // textContent vía evaluate para leer el valor aunque el elemento esté hidden
    const textoTotal = await this.page.evaluate(
      (id) => document.getElementById(id)?.textContent ?? '',
      L.TOTAL_MODAL
    );
    const monto = textoTotal.replace(/[^0-9.]/g, '');

    await this._cambiarMetodoPago(metodo.checkboxId);
    await this.page.locator(metodo.montoLocator).fill(monto);
    await this.page.waitForTimeout(PAUSES.VER_MONTO);
  }


  /**
   * Variante de seleccionarPagoExacto() con un monto explícito en vez del
   * total de la factura — necesaria para el abono inicial de Apartado con
   * tarjeta/SINPE/transacción: a diferencia de Facturar (donde estos 3
   * métodos siempre exigen el monto exacto del total), el abono de un
   * Apartado nunca puede ser igual ni mayor al total (confirmado en vivo,
   * Fase 1 — ver make_layaway()/confirm_add_layaway() en pos_layaway.js),
   * así que reutiliza el mismo cambio de checkbox (_cambiarMetodoPago) pero
   * sin forzar el monto al total completo.
   */
  async seleccionarPagoParcial(metodo: MetodoPago, monto: string) {
    await this._cambiarMetodoPago(metodo.checkboxId);
    await this.page.locator(metodo.montoLocator).fill(monto);
    await this.page.waitForTimeout(PAUSES.VER_MONTO);
  }


  /**
   * Presiona el botón "Facturar" del modal de pago (confirma el pago), sin esperar
   * su resultado. Es este botón —no el que abre el modal de pago— el que puede
   * mostrar el modal "Abrir Caja" si la caja está cerrada.
   */
  async presionarConfirmarPago() {
    await this.page.locator(L.BTN_CONFIRMAR).click();
  }


  /**
   * Presiona el "Facturar" del modal de pago (confirma el pago) y monitorea lo que
   * ocurre después, sin asumir que el modal "Abrir Caja" —si aparece— lo hace
   * inmediatamente: el backend puede tardar en procesar la solicitud antes de
   * mostrarlo. Por la misma razón, la ventana de impresión puede abrirse de forma
   * síncrona junto con la respuesta del click, así que la espera de ambos eventos
   * (popup y modal) se arma ANTES de cada click —incluidos los reintentos—, nunca
   * después: un listener registrado después del click puede perderse el evento.
   *
   * Si el modal "Abrir Caja" aparece en cualquier momento antes de terminar la
   * facturación (comportamiento esperado, no un error), se valida, se completa la
   * apertura, se confirma que desapareció y se vuelve a presionar "Facturar" —con
   * las esperas nuevamente armadas antes de ese click— hasta obtener el resultado
   * final: la ventana de impresión, que sí forma parte del flujo real del sistema.
   *
   * Un tercer resultado posible, igual de válido, es el SweetAlert opcional
   * "Información de pago" (ver `confirmacionPago`): no todos los ambientes lo
   * muestran (confirmado en vivo con la cuenta QA/HONDURAS que aparece en
   * algunas corridas y en otras no), así que no se asume ni su presencia ni su
   * ausencia. Cuando aparece, se confirma con "Pagar" —con la carrera vuelta a
   * armar antes de ESE click, por la misma razón que antes de "Facturar": la
   * ventana de impresión puede abrirse de forma síncrona junto con la
   * respuesta del click— y se sigue esperando el resultado real, sin volver a
   * presionar "Facturar" (el pago ya fue iniciado).
   *
   * Centralizado aquí: existía duplicado (idéntico salvo un puñado de líneas de
   * comentario) como función local en pos-crear.spec.ts, pos-facturar.spec.ts,
   * pos-navegacion.spec.ts y pos.spec.ts.
   *
   * No toca el tipo de documento electrónico de entrada — la opción que el
   * ambiente ya trae seleccionada se deja tal cual (Escenario 1: continuar
   * normalmente; Escenario 4: si ya es "Tiquete Electrónico", no hacer nada;
   * Escenario 5: si la compañía no tiene facturación electrónica, no hay
   * ningún select que tocar). Solo si, ya confirmando el pago, aparece el
   * panel "Información del Cliente" (Escenario 3) se cambia el documento a
   * "Tiquete Electrónico" — ver `_confirmarPagoConReintentosDeCaja()`.
   */
  async confirmarPagoAbriendoCajaSiEsNecesario() {
    await this._confirmarPagoConReintentosDeCaja();
  }


  /**
   * Intenta completar la facturación con el método de pago ya elegido,
   * reintentando ante dos situaciones que pueden alargar el flujo sin ser un
   * error:
   *
   * - El modal "Abrir Caja" (hasta `MAX_INTENTOS_CAJA` veces).
   * - El panel "Información del Cliente" (Escenario 3, como mucho una vez):
   *   confirmado en vivo, leyendo el `pos.js` real de este ambiente, que solo
   *   aparece cuando el documento electrónico activo es "Factura Electrónica"
   *   (`payment_electronic_document_type === 1` es la única condición que
   *   dispara `get_and_validate_client_pos()`) y que NINGUNA otra opción,
   *   incluida "Tiquete Electrónico", entra a esa validación. Nunca se llena
   *   el formulario (no es responsabilidad de esta suite); se cierra con el
   *   botón real "Cancelar" del panel (`onclick="closeNavClient()"`,
   *   confirmado en vivo — nunca "Guardar", que sí lo completaría) y se
   *   cambia el documento a "Tiquete Electrónico" antes de reintentar
   *   "Facturar". Si ese cambio no es posible (el ambiente no ofrece esa
   *   opción, o el panel reaparece incluso con ella activa) se lanza un
   *   error explícito: no hay una tercera alternativa definida por el
   *   negocio para no perder la venta.
   *
   * Lanza un error si ninguna señal real (popup, confirmación opcional o
   * carrito vacío) confirma que la venta se completó.
   */
  async _confirmarPagoConReintentosDeCaja() {
    const MAX_INTENTOS_CAJA = 3;
    let intentosCaja = 0;
    let yaSeIntentoTiqueteElectronico = false;

    while (true) {
      let resultado:
        | { tipo: 'popup'; printPage: Page }
        | { tipo: 'modalAbrirCaja' }
        | { tipo: 'confirmacionPago' }
        | { tipo: 'clienteInfoRequerido' }
        | { tipo: 'ventaCompletadaSinPopup' };
      try {
        resultado = await this._armarCarreraFacturacion(() => this.presionarConfirmarPago(), true);
      } catch (e) {
        // Ninguna de las señales esperadas (popup, modal "Abrir Caja",
        // confirmación opcional o panel de cliente) llegó dentro del
        // timeout: antes de asumir un error, se comprueba la señal funcional
        // real de que la venta sí se completó — el carrito quedó vacío
        // (mismo selector que obtenerCantidadFilasCarrito(), cuenta TODAS
        // las filas sin importar su origen). Cubre ambientes que confirman
        // la venta sin abrir ninguna ventana de impresión ni ningún modal —
        // comportamiento válido, no hay que asumir que el popup siempre
        // aparece.
        const filasRestantes = await this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).count();
        if (filasRestantes === 0) {
          resultado = { tipo: 'ventaCompletadaSinPopup' };
        } else if (!yaSeIntentoTiqueteElectronico && (await this._cambiarATiqueteElectronicoSiEsPosible())) {
          // El carrito sigue con líneas y ninguna señal llegó: confirmado en
          // vivo, leyendo el pos.js real, que esto también ocurre cuando el
          // documento activo ("Factura Electrónica") exige un cliente
          // asociado a la venta (payment_credit_client) que no existe —
          // a diferencia del panel "Información del Cliente"
          // (clienteInfoRequerido), esta rama de la misma validación no
          // muestra ningún panel ni deja ninguna señal observable, solo un
          // toast informativo que no bloquea la venta de forma permanente.
          // Ambos bloqueos —el panel y este— viven dentro del mismo `if`
          // que solo se ejecuta con payment_electronic_document_type === 1,
          // así que cambiar a "Tiquete Electrónico" los evita por igual;
          // se reintenta con el mismo mecanismo y el mismo límite de un
          // solo cambio ya usado para clienteInfoRequerido.
          yaSeIntentoTiqueteElectronico = true;
          continue;
        } else {
          throw e;
        }
      }
      await this.core.cerrarAvisoConsecutivoSiAparece();

      // Si "confirmacionPago" ya estaba visible al armar la carrera anterior,
      // no se vuelve a incluir en la siguiente: su `waitFor({state:'visible'})`
      // resolvería de inmediato contra el MISMO modal todavía abierto (en vez
      // de esperar una aparición nueva), lo que produciría un loop infinito de
      // clicks en "Pagar" sin nunca progresar. Se asume una sola confirmación
      // por intento de facturación — no hay evidencia de que el sistema la
      // muestre dos veces seguidas.
      if (resultado.tipo === 'confirmacionPago') {
        try {
          resultado = await this._armarCarreraFacturacion(
            () => this.confirmacionPago.locator('button.confirm').click(),
            false
          );
        } catch (e) {
          const filasRestantes = await this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).count();
          if (filasRestantes > 0) throw e;
          resultado = { tipo: 'ventaCompletadaSinPopup' };
        }
      }

      if (resultado.tipo === 'clienteInfoRequerido') {
        const btnCancelar = this.panelInformacionCliente.locator('a[onclick="closeNavClient()"]');
        await btnCancelar.click().catch(() => {});
        await this.panelInformacionCliente.waitFor({ state: 'hidden', timeout: TIMEOUTS.PAYMENT_MODAL }).catch(() => {});

        if (yaSeIntentoTiqueteElectronico) {
          throw new Error(
            'El panel "Información del Cliente" volvió a exigirse incluso con "Tiquete Electrónico" ya seleccionado — no hay otra alternativa automática para no perder la venta.'
          );
        }
        const cambiado = await this._cambiarATiqueteElectronicoSiEsPosible();
        if (!cambiado) {
          throw new Error(
            'El documento electrónico actual exige información del cliente (panel "Información del Cliente") y este ambiente no ofrece la opción "Tiquete Electrónico" para evitarlo.'
          );
        }
        yaSeIntentoTiqueteElectronico = true;
        continue; // reintentar "Facturar" ya con "Tiquete Electrónico" seleccionado
      }

      if (resultado.tipo === 'popup') {
        await this.core.mostrarYCerrarVentanaImpresion(resultado.printPage);

        // El sistema puede mostrar además un SweetAlert "¿Desea imprimir copia?"
        // independiente del popup ya cerrado (confirmado en vivo) — la venta ya
        // se completó, así que se descarta con "Cancelar" en vez de pedir una
        // copia extra. Su overlay, si queda abierto, bloquea clicks posteriores.
        const avisoCopia = this.page.locator('.sweet-alert.visible', { hasText: '¿Desea imprimir copia?' });
        const aparecioAvisoCopia = await avisoCopia
          .waitFor({ state: 'visible', timeout: 5_000 })
          .then(() => true)
          .catch(() => false);
        if (aparecioAvisoCopia) {
          await avisoCopia.locator('button.cancel').click();
          await avisoCopia.waitFor({ state: 'hidden', timeout: TIMEOUTS.PAYMENT_MODAL }).catch(() => {});
        }

        return;
      }

      if (resultado.tipo === 'ventaCompletadaSinPopup') {
        console.log('[confirmarPagoAbriendoCajaSiEsNecesario] Venta completada sin ventana de impresión (carrito vacío detectado) — comportamiento válido de este ambiente.');
        return;
      }

      // El modal "Abrir Caja" apareció: se valida, se completa la apertura y se
      // confirma que desapareció antes de volver al inicio del ciclo, donde se arma
      // una nueva espera de popup/modal antes del siguiente click en "Facturar".
      intentosCaja++;
      if (intentosCaja > MAX_INTENTOS_CAJA) {
        throw new Error(
          `La facturación no se completó tras ${MAX_INTENTOS_CAJA} intentos de abrir la caja: ` +
          'el sistema siguió pidiendo abrir la caja o nunca mostró la ventana de impresión.'
        );
      }
      await expect(this.core.modalAbrirCaja).toBeVisible();
      await this.core.completarAperturaCaja();
      await expect(this.core.modalAbrirCaja).toBeHidden();
    }
  }


  /**
   * Arma la carrera entre los resultados válidos tras confirmar un pago
   * (popup de impresión, modal "Abrir Caja", el panel "Información del
   * Cliente" y, opcionalmente, el SweetAlert "Información de pago") ANTES de
   * ejecutar `accionClick`, para no perder un evento que puede dispararse de
   * forma síncrona junto con la respuesta del click — usado tanto para el
   * click inicial en "Facturar" como para el click en "Pagar" cuando la
   * confirmación opcional aparece.
   *
   * `incluirConfirmacionPago` se desactiva para el click en "Pagar": el modal
   * de confirmación sigue técnicamente visible en el instante en que se arma
   * esa segunda carrera (recién se está cerrando), así que incluirlo ahí
   * resolvería la carrera de inmediato contra el mismo modal en vez de
   * esperar una aparición nueva.
   *
   * Si NINGUNA de estas señales llega (ni popup, ni modal, ni confirmación
   * opcional, ni el panel de cliente), esta función deja que el timeout se
   * propague como rechazo — quien llama
   * (confirmarPagoAbriendoCajaSiEsNecesario()) decide entonces, de forma
   * secuencial y solo en ese momento, si el carrito ya quedó vacío (ambiente
   * que confirma la venta sin ningún popup ni modal) antes de darlo por
   * error real. No se agrega esa comprobación a esta misma carrera para no
   * arriesgar que "carrito vacío" gane la carrera antes de tiempo en
   * ambientes donde el popup sí llega, solo un poco más tarde.
   */
  async _armarCarreraFacturacion(accionClick: () => Promise<void>, incluirConfirmacionPago: boolean) {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP })
      .then((printPage) => ({ tipo: 'popup' as const, printPage }));
    const modalPromise = this.core.modalAbrirCaja.waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP })
      .then(() => ({ tipo: 'modalAbrirCaja' as const }));
    const clienteInfoPromise = this.panelInformacionCliente.waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP })
      .then(() => ({ tipo: 'clienteInfoRequerido' as const }));
    const promesas: Promise<
      { tipo: 'popup'; printPage: Page } | { tipo: 'modalAbrirCaja' } | { tipo: 'confirmacionPago' } | { tipo: 'clienteInfoRequerido' }
    >[] = [popupPromise, modalPromise, clienteInfoPromise];
    if (incluirConfirmacionPago) {
      promesas.push(
        this.confirmacionPago.waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP })
          .then(() => ({ tipo: 'confirmacionPago' as const }))
      );
    }
    const carrera = Promise.race(promesas);

    await accionClick();
    return carrera;
  }


  /** Verifica que no quedan filas en el carrito tras la venta. */
  async validarCarritoVacio() {
    const claves = await this.page.locator(L.CARRITO_CLAVES).count();
    expect(claves).toBe(0);
    await this.page.waitForTimeout(PAUSES.ESTADO_FINAL);
  }


  /** Pago mixto: activa tarjeta manteniendo efectivo, luego llena ambos montos. */
  async seleccionarPagoMixto(montoTarjeta: string, montoEfectivo: string) {
    await this.page.evaluate(
      (id) => (document.getElementById(id) as HTMLInputElement).click(),
      CHECKBOX_ID.TARJETA
    );
    await this.page.waitForTimeout(PAUSES.CAMPO_HABILITADO);
    await this.page.locator('#payment_credit_card_total').fill(montoTarjeta);
    await this.page.getByPlaceholder('Referencia pago en tarjeta').fill('AUTOMATIZADO');
    await this.page.locator(L.EFECTIVO_MONTO).fill(montoEfectivo);
    await this.page.waitForTimeout(PAUSES.VER_MONTO);
  }


  /**
   * Cambia el método activo de efectivo (predeterminado) al indicado.
   * Usa evaluate() porque los checkboxes tienen slider CSS y están fuera del viewport.
   */
  async _cambiarMetodoPago(checkboxId: string) {
    await this.page.evaluate(
      (id) => (document.getElementById(id) as HTMLInputElement).click(),
      CHECKBOX_ID.EFECTIVO
    );
    await this.page.waitForTimeout(PAUSES.CHECKBOX_ACTIVACION);

    await this.page.evaluate(
      (id) => (document.getElementById(id) as HTMLInputElement).click(),
      checkboxId
    );
    await this.page.waitForTimeout(PAUSES.CAMPO_HABILITADO);
  }


  // ─── Modal de Pago: "Tipo de pago" y "Asignar vendedor" ────────────────────
  // Controles propios de #dialog_payment (Facturar) — ver el comentario de
  // L.DIALOG_PAGO_CHECK_CONTADO para la evidencia de por qué son distintos de
  // los homólogos de "Enviar a caja" (ORDEN_CAJA_CHECK_CONTADO/CREDITO,
  // ORDEN_CAJA_VENDEDOR_CHOSEN). abrirModalDePago() (ya existente) debe
  // llamarse antes.

  /** Lee cuál "Tipo de pago" está actualmente marcado en el modal de pago, sin tocarlo. */
  async obtenerTipoPagoEnModalPago(): Promise<TipoPagoOrdenCaja> {
    const credito = await this.page.locator(L.DIALOG_PAGO_CHECK_CREDITO).isChecked();
    return credito ? 'credito' : 'contado';
  }


  /**
   * Cambia el "Tipo de pago" del modal de pago al indicado — mismo patrón de
   * checkbox de slider CSS (_asegurarCheckboxEstado()) que el resto de la
   * suite. Confirmado en vivo que elegir "Crédito" aquí también revela
   * DIALOG_PAGO_FECHA_VENCIMIENTO, igual que en "Enviar a caja".
   */
  async cambiarTipoPagoEnModalPago(tipo: TipoPagoOrdenCaja) {
    if (tipo === 'credito') {
      await this.core._asegurarCheckboxEstado(this.page.locator(L.DIALOG_PAGO_CHECK_CREDITO), 'ck_is_payment_credit', true);
      await expect(
        this.page.locator(L.DIALOG_PAGO_FECHA_VENCIMIENTO),
        '"Fecha de Vencimiento" no apareció tras seleccionar Crédito en el modal de pago'
      ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
    } else {
      await this.core._asegurarCheckboxEstado(this.page.locator(L.DIALOG_PAGO_CHECK_CONTADO), 'ck_is_payment_cash', true);
    }
  }


  /** Lee el vendedor actualmente seleccionado en el modal de pago (reutiliza el mismo lector de Chosen que "Enviar a caja"). */
  async obtenerVendedorEnModalPago(): Promise<string> {
    return this.core._obtenerTextoChosenSeleccionado(L.DIALOG_PAGO_VENDEDOR_CHOSEN);
  }


  /**
   * Selecciona explícitamente el primer vendedor real disponible en el modal
   * de pago — mismo criterio que seleccionarVendedorOrdenCaja() (catálogo
   * configurable por la empresa, sin nombre estable, primera opción real).
   * Complementa a obtenerVendedorEnModalPago() (que solo lee): necesario para
   * escenarios que además de validar el vendedor, lo eligen de forma
   * explícita (a diferencia del ya prellenado automáticamente al cargar una
   * venta pendiente — ver el comentario de L.DIALOG_PAGO_VENDEDOR_CHOSEN).
   */
  async seleccionarVendedorEnModalPago(): Promise<string> {
    await this.core._seleccionarPrimeraOpcionChosen(L.DIALOG_PAGO_VENDEDOR_CHOSEN);
    const nombreVendedor = await this.obtenerVendedorEnModalPago();
    expect(nombreVendedor, 'El vendedor seleccionado en el modal de pago no quedó visible').not.toBe('');
    console.log(`[seleccionarVendedorEnModalPago] Vendedor seleccionado: "${nombreVendedor}"`);
    return nombreVendedor;
  }
}
