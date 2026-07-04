import { test, expect, Page } from '@playwright/test';
import { PosPage, MONTO_EFECTIVO, TIMEOUTS, CABYS_BUSQUEDA, PRECIO_PRODUCTO_RAPIDO } from './pos.page';

const NOMBRE_CLIENTE_FACTURA = 'Cliente De Prueba QA';

/**
 * Presiona el primer "Facturar" (abre el modal de pago). Este botón nunca requiere
 * abrir la caja —eso solo puede ocurrir al confirmar el pago, más adelante— así que
 * aquí no se valida ni se intenta abrir la caja en ningún caso.
 */
async function abrirModalDePago(pos: PosPage) {
  await pos.presionarFacturar();
  await pos.esperarModalPago();
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
 */
async function confirmarPagoAbriendoCajaSiEsNecesario(pos: PosPage, page: Page) {
  const MAX_INTENTOS = 3;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const popupPromise = page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP })
      .then((printPage) => ({ tipo: 'popup' as const, printPage }));
    const modalPromise = pos.modalAbrirCaja.waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP })
      .then(() => ({ tipo: 'modalAbrirCaja' as const }));

    await pos.presionarConfirmarPago();
    await pos.cerrarAvisoConsecutivoSiAparece();

    const resultado = await Promise.race([popupPromise, modalPromise]);

    if (resultado.tipo === 'popup') {
      await pos.mostrarYCerrarVentanaImpresion(resultado.printPage);
      return;
    }

    // El modal "Abrir Caja" apareció: se valida, se completa la apertura y se
    // confirma que desapareció antes de volver al inicio del ciclo, donde se arma
    // una nueva espera de popup/modal antes del siguiente click en "Facturar".
    await expect(pos.modalAbrirCaja).toBeVisible();
    await pos.completarAperturaCaja();
    await expect(pos.modalAbrirCaja).toBeHidden();
  }

  throw new Error(
    `La facturación no se completó tras ${MAX_INTENTOS} intentos de abrir la caja: ` +
    'el sistema siguió pidiendo abrir la caja o nunca mostró la ventana de impresión.'
  );
}

/**
 * Agrega un producto rápido al carrito para las pruebas de validación de
 * IVA, con la cantidad indicada. Reutiliza los métodos ya existentes de
 * PosPage —abrirProductoRapido, llenarDatosBasicosProductoRapido,
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
 * ver `validarLineaCarrito()` en pos.page.ts.
 *
 * Cuando `activarIva` es true: si el CABYS aparece, lo completa (el IVA se
 * autocompleta a partir de él); si no aparece, lo selecciona manualmente.
 * Cuando es false: no toca CABYS ni el checkbox de IVA en absoluto —queda
 * en su estado por defecto, sin marcar—, que es la forma real de guardar
 * un producto sin IVA en este ambiente (confirmado en vivo: el país
 * configurado actualmente para esta compañía no exige CABYS para poder
 * guardar).
 */
async function agregarProductoRapidoParaValidacionIva(
  pos: PosPage,
  nombre: string,
  precio: string,
  activarIva: boolean,
  cantidad = 1
) {
  await pos.abrirProductoRapido();
  await pos.llenarDatosBasicosProductoRapido(nombre, precio);
  if (cantidad !== 1) {
    await pos.establecerCantidadProductoRapido(cantidad);
  }

  if (activarIva) {
    const cabysAplicado = await pos.manejarCabysSiAplica(CABYS_BUSQUEDA);
    if (cabysAplicado) {
      await pos.esperarIvaAutocompletado();
    } else {
      await pos.seleccionarIvaManualmente();
    }
  }

  await pos.guardarProductoRapidoYObtenerRespuesta();
  await expect(pos.modalProductoRapido).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
}

test('facturar producto rápido con IVA y cliente existente en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
  });

  await test.step('Agregar un producto rápido con IVA activado', async () => {
    await agregarProductoRapidoParaValidacionIva(pos, `Producto Rápido IVA Cliente Existente ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO, true);
  });

  await test.step('Seleccionar un cliente existente', async () => {
    const nombreCliente = await pos.seleccionarClienteExistente();
    expect(nombreCliente.length).toBeGreaterThan(0);
  });

  await test.step('Abrir modal de pago', async () => {
    await abrirModalDePago(pos);
  });

  await test.step('Pagar en efectivo', async () => {
    await pos.seleccionarPagoEfectivo(MONTO_EFECTIVO);
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await confirmarPagoAbriendoCajaSiEsNecesario(pos, page);
  });

  await test.step('Validar carrito vacío', async () => {
    await pos.validarCarritoVacio();
  });
});

test('facturar producto rápido con IVA y nombre del cliente en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
  });

  await test.step('Agregar un producto rápido con IVA activado', async () => {
    await agregarProductoRapidoParaValidacionIva(pos, `Producto Rápido IVA Nombre Cliente ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO, true);
  });

  await test.step('Ingresar solo el nombre del cliente (sin seleccionar uno registrado)', async () => {
    await pos.ingresarNombreCliente(NOMBRE_CLIENTE_FACTURA);
  });

  await test.step('Abrir modal de pago', async () => {
    await abrirModalDePago(pos);
  });

  await test.step('Pagar en efectivo', async () => {
    await pos.seleccionarPagoEfectivo(MONTO_EFECTIVO);
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await confirmarPagoAbriendoCajaSiEsNecesario(pos, page);
  });

  await test.step('Validar carrito vacío', async () => {
    await pos.validarCarritoVacio();
  });
});
