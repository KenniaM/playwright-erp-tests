import { test, expect, Page } from '@playwright/test';
import { PosPage, TIMEOUTS as POS_TIMEOUTS, espiarErroresJS } from '../facturar/pos/pos.page';
import { CuentasPorCobrarPage } from '../ventas/cuentas-por-cobrar.page';
import { ReporteEstadoCuentaPage } from './rp-clientes.page';

// Suite de INTEGRACIÓN — agnóstica de ambiente/compañía (funciona con
// cualquier `--project`, incluido el ambiente original y `firefox-restaurant`
// vía `--project=setup-restaurant --project=firefox-restaurant`): nunca
// asume BASE_URL/COMPANIA_POS propios ni un cliente ya existente del
// catálogo compartido — crea su propio cliente con crédito en cada corrida.
//
// Cierra el ciclo completo pedido: generar datos CONTROLADOS (factura a
// crédito con monto conocido), registrar abonos reales desde "Cuentas por
// Cobrar" (Ventas — componente "acr-v2") y comparar matemáticamente el
// resultado contra el Reporte de Estado de Cuenta (Reportes > Clientes —
// componente "casv2", ver rp-clientes.page.ts) para el MISMO cliente/factura,
// en vez de validar cada pantalla por separado.
//
// Reutiliza 100% infraestructura ya existente: PosPage (crear cliente +
// factura a crédito), CuentasPorCobrarPage (abonar) y ReporteEstadoCuentaPage
// (leer el reporte) — ningún locator/selector nuevo se define en este
// archivo.

/**
 * Crea un cliente real NUEVO, con perfil completo (Nombre, Correo,
 * Identificación) y un límite de crédito alto, para usarlo en una venta a
 * crédito — mismo flujo real ya documentado y confirmado en vivo en
 * `pos-cierre-caja.spec.ts` (`crearClienteConCreditoYPerfilCompleto()`,
 * componente `CustomerForm`/`#dialog_customer_form`), replicado aquí acotado
 * a este archivo (mismo criterio de "funcionalidad acotada" de CLAUDE.md: no
 * se exporta desde un spec ajeno). Deliberadamente NO se reutiliza ningún
 * cliente preexistente del catálogo compartido — es lo que hace a esta suite
 * agnóstica de ambiente/compañía (ningún cliente real es garantizado en
 * todos los ambientes).
 */
async function crearClienteConCreditoYPerfilCompleto(pos: PosPage, page: Page): Promise<string> {
  const sufijo = Date.now();
  const nombre = `QA Estado Cuenta ${sufijo}`;
  const identificacion = `${sufijo}`.slice(-9);
  const email = `qa.estado.cuenta.${sufijo}@example.com`;

  await pos.cerrarOverlaysConocidos();
  await page.locator('.panel-customer-search .dropdown-toggle').click();
  await page.locator('#add_quick_customer').click();

  const modal = page.locator('#dialog_customer_form');
  await expect(modal, 'El modal "Agregar Cliente" (#dialog_customer_form) no apareció').toBeVisible({ timeout: POS_TIMEOUTS.PAYMENT_MODAL });

  await modal.locator('#cf_name').fill(nombre);
  await modal.locator('#cf_email').fill(email);
  await pos._seleccionarPrimeraOpcionChosen('#dialog_customer_form #cf_identification_type_chosen');
  await modal.locator('#cf_identifier').fill(identificacion);

  const tabOpcionesAvanzadas = modal.locator('.cf-tab[data-cf-step="2"]');
  await tabOpcionesAvanzadas.scrollIntoViewIfNeeded();
  await tabOpcionesAvanzadas.click();
  await expect(modal.locator('#cf_limit'), 'El tab "Opciones avanzadas" no quedó activo (Límite de crédito no visible)').toBeVisible({ timeout: POS_TIMEOUTS.PAYMENT_MODAL });
  await modal.locator('#cf_limit').fill('999999');

  await modal.locator('[data-cf-save]').click();
  await expect(modal, 'El modal "Agregar Cliente" no se cerró tras guardar').toBeHidden({ timeout: POS_TIMEOUTS.PAYMENT_MODAL });

  return nombre;
}

/** Crea un cliente propio con crédito y le genera una factura a crédito con monto conocido. Devuelve el nombre del cliente y el total real facturado. */
async function crearClienteYFacturaACredito(pos: PosPage, page: Page, monto: string): Promise<{ nombreCliente: string; total: number }> {
  const nombreCliente = await crearClienteConCreditoYPerfilCompleto(pos, page);
  await pos.agregarProductoRapidoSimple(`QA Estado Cuenta ${Date.now()}`, monto);
  await pos.abrirModalDePago();
  await pos.cambiarTipoPagoEnModalPago('credito');
  const total = await pos.obtenerTotalVentaNumerico();
  await pos.confirmarPagoAbriendoCajaSiEsNecesario();
  return { nombreCliente, total };
}

/** Ubica, dentro de Cuentas por Cobrar ya cargado, la factura pendiente MÁS RECIENTE del cliente indicado. */
async function ubicarFacturaMasRecienteDeCliente(cxc: CuentasPorCobrarPage, nombreCliente: string): Promise<{ idFactura: string; saldo: number }> {
  await cxc.irA();
  await cxc.buscar(nombreCliente);
  // La búsqueda real de "Cuentas por Cobrar" puede devolver más de una
  // coincidencia cuando dos clientes comparten un prefijo (confirmado en
  // vivo: dos clientes "QA Estado Cuenta <timestamp>" creados por escenarios
  // distintos de esta misma suite, en la misma corrida) — nunca asumir que
  // el índice 0 es el cliente correcto; se busca la coincidencia EXACTA por
  // nombre entre los resultados visibles.
  const clientes = await cxc.leerClientesVisibles();
  const indice = clientes.findIndex((c) => c.cliente === nombreCliente);
  expect(indice, `La búsqueda de "${nombreCliente}" no devolvió ninguna coincidencia EXACTA (candidatos: ${clientes.map((c) => c.cliente).join(', ')})`).toBeGreaterThanOrEqual(0);
  await cxc.abrirGestionCliente(indice);
  const ids = await cxc.obtenerIdsFacturasPendientes();
  expect(ids.length, `No se encontró ninguna factura pendiente para "${nombreCliente}"`).toBeGreaterThan(0);
  // Los ids nuevos son numéricamente mayores (autoincrement real del backend, confirmado en vivo).
  const idFactura = ids.map(Number).sort((a, b) => b - a)[0].toString();
  const saldo = await cxc.leerSaldoFacturaPendiente(idFactura);
  return { idFactura, saldo };
}

/**
 * Ubica, dentro del Reporte de Estado de Cuenta ya cargado, la fila del
 * cliente indicado (búsqueda por texto) — mismo cuidado que
 * `ubicarFacturaMasRecienteDeCliente()`: la búsqueda puede devolver más de
 * un cliente con el mismo prefijo, nunca asumir que la fila 0 es la
 * correcta.
 */
async function leerFilaClienteEnEstadoCuenta(estadoCuenta: ReporteEstadoCuentaPage, nombreCliente: string) {
  await estadoCuenta.buscarPorTexto(nombreCliente);
  const filas = await estadoCuenta.contarFilas();
  expect(filas, `El Reporte de Estado de Cuenta no muestra a "${nombreCliente}"`).toBeGreaterThan(0);
  for (let i = 0; i < filas; i++) {
    const cliente = await estadoCuenta.obtenerClienteDeFila(i);
    if (cliente === nombreCliente) return estadoCuenta.leerFilaFinanciera(i);
  }
  throw new Error(`Ninguna de las ${filas} filas del Reporte de Estado de Cuenta coincide exactamente con "${nombreCliente}"`);
}

test.describe('Integración: Abono de Cuentas por Cobrar + Reporte de Estado de Cuenta', () => {
  test('Abono PARCIAL en Efectivo: CxC y Estado de Cuenta reflejan exactamente el mismo saldo restante', async ({ page }) => {
    test.setTimeout(POS_TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const erroresJS = espiarErroresJS(page);
    const cxc = new CuentasPorCobrarPage(page);
    const estadoCuenta = new ReporteEstadoCuentaPage(page);

    let nombreCliente = '';
    let total = 0;
    await test.step('Crear un cliente propio con crédito y generarle una factura a crédito con monto conocido (5000)', async () => {
      await pos.cargarPosDesdeDashboard();
      await pos.cerrarOverlaysConocidos();
      const resultado = await crearClienteYFacturaACredito(pos, page, '5000');
      nombreCliente = resultado.nombreCliente;
      total = resultado.total;
      expect(total).toBeGreaterThan(0);
    });

    let idFactura = '';
    let saldoAntes = 0;
    await test.step('Ubicar la factura recién creada en Cuentas por Cobrar', async () => {
      const encontrada = await ubicarFacturaMasRecienteDeCliente(cxc, nombreCliente);
      idFactura = encontrada.idFactura;
      saldoAntes = encontrada.saldo;
      expect(saldoAntes, 'El saldo pendiente inicial no coincide con el total facturado').toBeCloseTo(total, 2);
    });

    const montoAbono = Number((saldoAntes / 2).toFixed(2));
    await test.step(`Registrar un abono PARCIAL en Efectivo (${montoAbono}, la mitad del saldo)`, async () => {
      await cxc.abrirRegistrarAbono(idFactura);
      await cxc.seleccionarAbonoEfectivo(montoAbono.toFixed(2));
      await cxc.confirmarAbono();
    });

    const saldoEsperadoFactura = Number((saldoAntes - montoAbono).toFixed(2));
    let saldoAgregadoClienteCxC = 0;
    await test.step('Cuentas por Cobrar refleja el saldo restante exacto (Saldo anterior − Abono = Saldo nuevo)', async () => {
      const { saldo: saldoDespues } = await ubicarFacturaMasRecienteDeCliente(cxc, nombreCliente);
      expect(saldoDespues, 'SALDO ANTERIOR − ABONO ≠ SALDO NUEVO en Cuentas por Cobrar').toBeCloseTo(saldoEsperadoFactura, 2);

      // Saldo AGREGADO real del cliente (suma de TODAS sus facturas
      // pendientes, no solo esta) — leído del propio listado de CxC, para
      // comparar contra el agregado equivalente del Reporte de Estado de
      // Cuenta sin asumir que esta es la única factura pendiente del cliente.
      // Es un cliente recién creado por esta suite, así que en la práctica
      // SIEMPRE será la única — pero la validación no depende de esa
      // coincidencia.
      await cxc.irA();
      await cxc.buscar(nombreCliente);
      const clientes = await cxc.leerClientesVisibles();
      const cliente = clientes.find((c) => c.cliente === nombreCliente);
      expect(cliente, `"${nombreCliente}" no aparece en el listado de Cuentas por Cobrar tras el abono`).toBeTruthy();
      saldoAgregadoClienteCxC = cliente!.saldo;
    });

    await test.step('El Reporte de Estado de Cuenta refleja el MISMO saldo agregado y el mismo facturado para este cliente', async () => {
      await estadoCuenta.abrir();
      const fila = await leerFilaClienteEnEstadoCuenta(estadoCuenta, nombreCliente);
      expect(fila.facturado, 'Facturado en Estado de Cuenta no incluye la factura recién creada').toBeGreaterThanOrEqual(total);
      expect(fila.saldoTotal, 'Saldo total en Estado de Cuenta no coincide con el saldo agregado real visto en Cuentas por Cobrar').toBeCloseTo(saldoAgregadoClienteCxC, 2);
      expect(fila.facturado - fila.pagado, 'Facturado − Pagado ≠ Saldo total en la fila del Reporte de Estado de Cuenta').toBeCloseTo(fila.saldoTotal, 2);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });

  test('Abonos MÚLTIPLES acumulados con SINPE y Transacción: el saldo desciende correctamente en cada paso', async ({ page }) => {
    test.setTimeout(POS_TIMEOUTS.TEST);
    const pos = new PosPage(page);
    const erroresJS = espiarErroresJS(page);
    const cxc = new CuentasPorCobrarPage(page);

    let nombreCliente = '';
    let total = 0;
    await test.step('Crear un cliente propio con crédito y generarle una factura a crédito con monto conocido (9000)', async () => {
      await pos.cargarPosDesdeDashboard();
      await pos.cerrarOverlaysConocidos();
      const resultado = await crearClienteYFacturaACredito(pos, page, '9000');
      nombreCliente = resultado.nombreCliente;
      total = resultado.total;
      expect(total).toBeGreaterThan(0);
    });

    let idFactura = '';
    let saldoInicial = 0;
    await test.step('Ubicar la factura recién creada', async () => {
      const encontrada = await ubicarFacturaMasRecienteDeCliente(cxc, nombreCliente);
      idFactura = encontrada.idFactura;
      saldoInicial = encontrada.saldo;
    });

    // Primer abono: SINPE, un tercio del saldo (monto parcial controlado —
    // seleccionarAbonoMetodoConMonto(), no el 100% automático de
    // seleccionarAbonoMetodoExacto()).
    const primerAbono = Number((saldoInicial / 3).toFixed(2));
    await test.step(`Primer abono — SINPE, monto parcial (${primerAbono})`, async () => {
      await cxc.abrirRegistrarAbono(idFactura);
      await cxc.seleccionarAbonoMetodoConMonto('sinpe', primerAbono.toFixed(2));
      await cxc.confirmarAbono();
    });

    let saldoTrasPrimerAbono = 0;
    await test.step('CxC refleja el saldo tras el primer abono (SINPE)', async () => {
      const { saldo } = await ubicarFacturaMasRecienteDeCliente(cxc, nombreCliente);
      saldoTrasPrimerAbono = saldo;
      expect(saldoTrasPrimerAbono, 'Saldo tras el abono con SINPE no coincide con Saldo inicial − primer abono').toBeCloseTo(
        Number((saldoInicial - primerAbono).toFixed(2)), 2
      );
    });

    // Segundo abono: Transacción, cubre el resto exacto — usa el helper
    // existente (monto exacto del saldo restante).
    await test.step('Segundo abono — Transacción, cubre el saldo restante completo', async () => {
      await cxc.abrirRegistrarAbono(idFactura);
      await cxc.seleccionarAbonoMetodoExacto('transaccion');
      await cxc.confirmarAbono();
    });

    await test.step('La factura queda completamente saldada (ya no aparece pendiente)', async () => {
      await cxc.irA();
      await cxc.buscar(nombreCliente);
      const clientes = await cxc.leerClientesVisibles();
      const cliente = clientes.find((c) => c.cliente === nombreCliente);
      if (cliente) {
        // El cliente puede seguir apareciendo si tiene OTRAS facturas pendientes
        // — se valida que esta factura puntual ya no esté entre las
        // pendientes, no que el cliente desaparezca del todo.
        await cxc.abrirGestionCliente(0);
        const idsRestantes = await cxc.obtenerIdsFacturasPendientes();
        expect(idsRestantes, 'La factura abonada por completo sigue apareciendo como pendiente').not.toContain(idFactura);
      }
      // Si el cliente ya no aparece en absoluto, la factura quedó saldada por definición (mismo criterio que el resto de la suite).
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});
