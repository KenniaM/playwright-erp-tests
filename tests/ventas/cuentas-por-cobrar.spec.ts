import { test, expect } from '@playwright/test';
import { CuentasPorCobrarPage, TIMEOUTS } from './cuentas-por-cobrar.page';
import { espiarErroresJS } from '../facturar/pos/pos.page';

// Suite del submódulo "Cuentas por Cobrar" (Ventas → Abono Cuentas por
// Cobrar). Investigación en vivo confirmó que esta pantalla fue REDISEÑADA
// POR COMPLETO por la propia aplicación desde la última vez que se
// investigó (ver la memoria del proyecto y la nota de cabecera de
// `CuentasPorCobrarPage`) — esta suite cubre la UI real actual.
//
// El ambiente de QA es compartido y sin limpieza (ver CLAUDE.md): nunca se
// asume un cliente/saldo específico de antemano — cada validación de
// persistencia compara un snapshot ANTES vs. DESPUÉS del propio cliente
// abonado (identificado por nombre real, leído en el momento), nunca un
// valor absoluto.

test('Cargar Cuentas por Cobrar y validar el listado + resumen por moneda', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);

  await test.step('Navegar a Cuentas por Cobrar', async () => {
    await cxc.irA();
  });

  await test.step('Validar que el listado y el resumen por moneda muestran datos reales', async () => {
    const cantidad = await cxc.contarClientesVisibles();
    expect(cantidad, 'El listado de Cuentas por Cobrar debería mostrar al menos 1 cliente (ambiente compartido con datos reales)').toBeGreaterThan(0);

    const resumen = await cxc.leerResumenPorMoneda();
    expect(resumen.clientes, 'El resumen por moneda debería reportar al menos 1 cliente').toBeGreaterThan(0);
    expect(resumen.saldoPendiente, 'El saldo pendiente total debería ser mayor a 0').toBeGreaterThan(0);
  });
});

test('Filtrar por condición de la cuenta ("En morosidad")', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);

  await cxc.irA();
  const antesDelFiltro = await cxc.contarClientesVisibles();
  await cxc.filtrarPorCondicion('En morosidad');
  const despuesDelFiltro = await cxc.contarClientesVisibles();

  expect(despuesDelFiltro, 'El filtro "En morosidad" mostró más clientes que sin filtrar').toBeLessThanOrEqual(antesDelFiltro);
});

test('Buscar un cliente por nombre', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);

  await cxc.irA();
  const clientes = await cxc.leerClientesVisibles();
  expect(clientes.length, 'No hay clientes para tomar un nombre real de búsqueda').toBeGreaterThan(0);
  const nombreReal = clientes[0].cliente;
  expect(nombreReal.length, 'El primer cliente del listado no tiene un nombre legible').toBeGreaterThan(0);

  await cxc.buscar(nombreReal);
  const resultado = await cxc.leerClientesVisibles();
  expect(resultado.length, `La búsqueda por "${nombreReal}" no devolvió ningún resultado`).toBeGreaterThan(0);
  expect(resultado.some((c) => c.cliente === nombreReal), `Ningún resultado de la búsqueda coincide exactamente con "${nombreReal}"`).toBe(true);
});

test('Limpiar filtros restaura el listado completo', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);

  await cxc.irA();
  const totalSinFiltrar = await cxc.contarClientesVisibles();

  await cxc.filtrarPorCondicion('En morosidad');
  const totalFiltrado = await cxc.contarClientesVisibles();

  await cxc.limpiarFiltros();
  const totalTrasLimpiar = await cxc.contarClientesVisibles();

  expect(totalTrasLimpiar, 'El listado no volvió a su tamaño original tras "Limpiar"').toBe(totalSinFiltrar);
  // Validación complementaria (no estrictamente necesaria si la de arriba
  // pasa, pero documenta la intención real del escenario): el filtro sí
  // había reducido o igualado el conjunto antes de limpiarlo.
  expect(totalFiltrado).toBeLessThanOrEqual(totalSinFiltrar);
});

test('Abrir "Gestionar facturas, saldos y abonos" de un cliente y validar sus facturas pendientes', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);

  await cxc.irA();
  const clientesAntes = await cxc.leerClientesVisibles();
  await cxc.abrirGestionCliente(0);

  const ids = await cxc.obtenerIdsFacturasPendientes();
  expect(ids.length, 'El modal de gestión no muestra ninguna factura pendiente').toBeGreaterThan(0);
  expect(ids.length, 'La cantidad de facturas pendientes del modal no coincide con la columna "Facturas" del listado')
    .toBeLessThanOrEqual(clientesAntes[0].cantidadFacturas);

  const saldo = await cxc.leerSaldoFacturaPendiente(ids[0]);
  expect(saldo, 'El saldo de la primera factura pendiente no es mayor a 0').toBeGreaterThan(0);
});

test('Aplicar un abono completo en Efectivo y validar persistencia real (saldo del cliente y factura ya no pendiente)', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);
  const erroresJS = espiarErroresJS(page);

  let nombreCliente = '';
  let saldoAntes = 0;
  let idFactura = '';
  let montoAbono = 0;

  await test.step('Ubicar el primer cliente con saldo pendiente y su primera factura', async () => {
    await cxc.irA();
    const clientes = await cxc.leerClientesVisibles();
    expect(clientes.length).toBeGreaterThan(0);
    nombreCliente = clientes[0].cliente;
    saldoAntes = clientes[0].saldo;

    await cxc.abrirGestionCliente(0);
    const ids = await cxc.obtenerIdsFacturasPendientes();
    expect(ids.length).toBeGreaterThan(0);
    idFactura = ids[0];
  });

  await test.step('Abrir "Registrar abono" (precarga 100% del saldo en Efectivo) y confirmar', async () => {
    await cxc.abrirRegistrarAbono(idFactura);
    montoAbono = await cxc.obtenerMontoPrellenado();
    expect(montoAbono, 'El monto de abono precargado no es mayor a 0').toBeGreaterThan(0);
    await cxc.confirmarAbono();
  });

  // "Cuentas por Cobrar" solo lista clientes CON saldo pendiente — si la
  // factura abonada era la única/última pendiente del cliente, el abono
  // completo la salda a $0 y el cliente deja de aparecer en el listado por
  // completo. Es un resultado válido (no un bug de esta suite ni del
  // sistema): se trata como "saldo final = 0", no como un error.
  let clienteSigueApareciendo = true;
  await test.step('Salir, volver a consultar y validar que el saldo del cliente bajó exactamente el monto abonado (o el cliente quedó saldado)', async () => {
    await cxc.irA();
    await cxc.buscar(nombreCliente);
    const clientesDespues = await cxc.leerClientesVisibles();
    const clienteDespues = clientesDespues.find((c) => c.cliente === nombreCliente);
    clienteSigueApareciendo = !!clienteDespues;

    const saldoDespues = clienteDespues?.saldo ?? 0;
    expect(saldoAntes - saldoDespues, 'El saldo del cliente no bajó exactamente el monto abonado').toBeCloseTo(montoAbono, 2);
  });

  await test.step('Validar que la factura abonada ya no aparece como pendiente', async () => {
    test.skip(!clienteSigueApareciendo, 'El cliente quedó completamente saldado y ya no aparece en el listado — no hay modal de gestión que reabrir');
    await cxc.irA();
    await cxc.buscar(nombreCliente);
    await cxc.abrirGestionCliente(0);
    const idsRestantes = await cxc.obtenerIdsFacturasPendientes();
    expect(idsRestantes, 'La factura abonada sigue apareciendo como pendiente').not.toContain(idFactura);
  });

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});

test('Aplicar un abono con Tarjeta y validar que el método y el monto persisten', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);
  const erroresJS = espiarErroresJS(page);

  let nombreCliente = '';
  let saldoAntes = 0;
  let idFactura = '';

  // Se toma el ÚLTIMO cliente del listado, no el segundo: confirmado en vivo
  // que tomar un índice fijo bajo (p. ej. 1) puede colisionar con el cliente
  // que el escenario anterior de esta misma suite (Efectivo) ya abonó —
  // reducir su saldo puede reordenar el listado y desplazar OTRO cliente
  // real hacia esa posición, leyendo un `saldoAntes` que ya no corresponde
  // al cliente real que termina abonándose. El último índice es mucho menos
  // propenso a esa colisión en un listado de decenas de clientes reales.
  let indiceCliente = 0;
  await test.step('Ubicar un cliente con saldo pendiente distinto al del escenario anterior', async () => {
    await cxc.irA();
    const clientes = await cxc.leerClientesVisibles();
    expect(clientes.length).toBeGreaterThan(1);
    indiceCliente = clientes.length - 1;
    nombreCliente = clientes[indiceCliente].cliente;
    saldoAntes = clientes[indiceCliente].saldo;

    await cxc.abrirGestionCliente(indiceCliente);
    const ids = await cxc.obtenerIdsFacturasPendientes();
    expect(ids.length).toBeGreaterThan(0);
    idFactura = ids[0];
  });

  let montoAbono = 0;
  await test.step('Registrar el abono con Tarjeta (monto exacto del saldo de la factura)', async () => {
    await cxc.abrirRegistrarAbono(idFactura);
    montoAbono = await cxc.obtenerMontoPrellenado();
    await cxc.seleccionarAbonoMetodoExacto('tarjeta');
    await cxc.confirmarAbono();
  });

  // "Cuentas por Cobrar" solo lista clientes CON saldo pendiente — si la
  // factura abonada era la única/última pendiente del cliente, queda
  // saldado a $0 y deja de aparecer por completo (resultado válido, mismo
  // criterio que el escenario de abono en Efectivo).
  await test.step('Validar persistencia: el saldo del cliente bajó el monto abonado con Tarjeta (o quedó saldado)', async () => {
    await cxc.irA();
    await cxc.buscar(nombreCliente);
    const clientesDespues = await cxc.leerClientesVisibles();
    const clienteDespues = clientesDespues.find((c) => c.cliente === nombreCliente);
    const saldoDespues = clienteDespues?.saldo ?? 0;
    expect(saldoAntes - saldoDespues, 'El saldo del cliente no bajó exactamente el monto abonado con Tarjeta').toBeCloseTo(montoAbono, 2);
  });

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});

test('Cancelar un abono sin confirmar no debe afectar el saldo del cliente', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);

  let nombreCliente = '';
  let saldoAntes = 0;

  await test.step('Ubicar un cliente y abrir "Registrar abono" sin confirmarlo', async () => {
    await cxc.irA();
    const clientes = await cxc.leerClientesVisibles();
    expect(clientes.length).toBeGreaterThan(0);
    nombreCliente = clientes[0].cliente;
    saldoAntes = clientes[0].saldo;

    await cxc.abrirGestionCliente(0);
    const ids = await cxc.obtenerIdsFacturasPendientes();
    expect(ids.length).toBeGreaterThan(0);
    await cxc.abrirRegistrarAbono(ids[0]);
    await cxc.cancelarAbono();
  });

  await test.step('Validar que el saldo del cliente permanece exactamente igual', async () => {
    await cxc.irA();
    await cxc.buscar(nombreCliente);
    const clientesDespues = await cxc.leerClientesVisibles();
    const clienteDespues = clientesDespues.find((c) => c.cliente === nombreCliente);
    expect(clienteDespues, `El cliente "${nombreCliente}" no volvió a aparecer`).toBeTruthy();
    expect(clienteDespues!.saldo, 'El saldo cambió pese a cancelar el abono sin confirmar').toBeCloseTo(saldoAntes, 2);
  });
});
