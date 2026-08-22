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

test('El "Resumen por moneda" es matemáticamente consistente con la suma real de los clientes listados', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);
  await cxc.irA();

  const resumen = await cxc.leerResumenPorMoneda();
  const clientes = await cxc.leerClientesVisibles();
  expect(clientes.length).toBeGreaterThan(0);

  // Invariante interna del propio resumen: Vencido + Por vencer = Saldo pendiente.
  expect(resumen.vencido + resumen.porVencer, 'Resumen por moneda: Vencido + Por vencer ≠ Saldo pendiente').toBeCloseTo(resumen.saldoPendiente, 2);

  // El agregado del resumen debe coincidir con la SUMA real de todos los
  // clientes listados (no solo "ser mayor a 0") — mismo criterio de
  // precisión pedido para el resto de esta suite.
  const sumaSaldos = clientes.reduce((acc, c) => acc + c.saldo, 0);
  const sumaVencido = clientes.reduce((acc, c) => acc + c.vencido, 0);
  const sumaPorVencer = clientes.reduce((acc, c) => acc + c.porVencer, 0);
  expect(resumen.saldoPendiente, 'Resumen "Saldo pendiente" ≠ suma real de los saldos de cada cliente listado').toBeCloseTo(sumaSaldos, 2);
  expect(resumen.vencido, 'Resumen "Vencido" ≠ suma real del vencido de cada cliente listado').toBeCloseTo(sumaVencido, 2);
  expect(resumen.porVencer, 'Resumen "Por vencer" ≠ suma real del por vencer de cada cliente listado').toBeCloseTo(sumaPorVencer, 2);
  expect(resumen.clientes, 'Resumen "Clientes" ≠ cantidad real de filas listadas').toBe(clientes.length);

  // Cada fila también cumple su propia identidad: Vencido + Por vencer = Saldo, y Total − Abonado = Saldo.
  for (const c of clientes) {
    expect(c.vencido + c.porVencer, `${c.cliente}: Vencido + Por vencer ≠ Saldo`).toBeCloseTo(c.saldo, 2);
    expect(c.total - c.abonado, `${c.cliente}: Total − Abonado ≠ Saldo`).toBeCloseTo(c.saldo, 2);
  }
});

test('Los filtros "En morosidad" y "Al día" muestran ÚNICAMENTE clientes en ese estado real (no solo reducen la cantidad)', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);
  await cxc.irA();

  for (const condicion of ['En morosidad', 'Al día'] as const) {
    await test.step(`Condición = "${condicion}"`, async () => {
      await cxc.filtrarPorCondicion(condicion);
      const clientes = await cxc.leerClientesVisibles();
      test.skip(clientes.length === 0, `El ambiente de QA no tiene ningún cliente en estado "${condicion}" en este momento.`);
      for (const c of clientes) {
        expect(c.estado, `El cliente "${c.cliente}" aparece bajo el filtro "${condicion}" pero su estado real es "${c.estado}"`).toBe(condicion);
      }
    });
  }

  await cxc.limpiarFiltros();
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

// ─── "Ver productos y servicios" / "Ver historial de abonos" ──────────────
//
// Dos acciones reales del menú por factura, investigadas en vivo pero nunca
// cubiertas hasta ahora (ver el comentario de `abrirDetalleFactura()` /
// `abrirHistorialAbonos()` en cuentas-por-cobrar.page.ts para la evidencia
// completa). No dependen de datos creados en esta sesión — funcionan contra
// CUALQUIER factura pendiente real del ambiente compartido.

test('"Ver productos y servicios" — Subtotal − Descuento + Impuesto = Total, y Total − Saldo = suma del historial de abonos', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);

  await cxc.irA();
  const clientes = await cxc.leerClientesVisibles();
  expect(clientes.length, 'No hay clientes con saldo pendiente para validar').toBeGreaterThan(0);

  await cxc.abrirGestionCliente(0);
  const ids = await cxc.obtenerIdsFacturasPendientes();
  expect(ids.length).toBeGreaterThan(0);
  const idFactura = ids[0];
  const saldoEnGestion = await cxc.leerSaldoFacturaPendiente(idFactura);

  let resumen: Awaited<ReturnType<typeof cxc.leerResumenDetalleFactura>>;
  await test.step('"Ver productos y servicios": Subtotal − Descuento + Impuesto = Total', async () => {
    await cxc.abrirDetalleFactura(idFactura);
    resumen = await cxc.leerResumenDetalleFactura();
    expect(resumen.subtotal - resumen.descuento + resumen.impuesto, 'Subtotal − Descuento + Impuesto ≠ Total').toBeCloseTo(resumen.total, 2);
    expect(resumen.saldo, 'El saldo mostrado en "Productos y servicios" no coincide con el de la fila de gestión').toBeCloseTo(saldoEnGestion, 2);
    await cxc.volverAFacturasDesdeSubmodal();
  });

  await test.step('"Ver historial de abonos": Total − Saldo = suma de todos los abonos aplicados', async () => {
    await cxc.abrirHistorialAbonos(idFactura);
    const historial = await cxc.leerHistorialAbonos();
    const sumaAbonos = historial.reduce((acc, h) => acc + h.monto, 0);
    expect(resumen.total - resumen.saldo, 'Total − Saldo ≠ suma real de los abonos del historial').toBeCloseTo(sumaAbonos, 2);
  });
});

test('Registrar un abono deja un registro nuevo y exacto en "Ver historial de abonos"', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);
  const erroresJS = espiarErroresJS(page);

  await cxc.irA();
  const clientes = await cxc.leerClientesVisibles();
  expect(clientes.length).toBeGreaterThan(0);
  const nombreCliente = clientes[0].cliente;
  await cxc.abrirGestionCliente(0);
  const ids = await cxc.obtenerIdsFacturasPendientes();
  expect(ids.length).toBeGreaterThan(0);
  const idFactura = ids[0];

  let historialAntes = 0;
  let saldoAntes = 0;
  await test.step('Contar los abonos ya registrados ANTES', async () => {
    await cxc.abrirHistorialAbonos(idFactura);
    historialAntes = (await cxc.leerHistorialAbonos()).length;
    await cxc.volverAFacturasDesdeSubmodal();
    saldoAntes = await cxc.leerSaldoFacturaPendiente(idFactura);
  });

  const montoAbono = Number((saldoAntes / 3).toFixed(2));
  await test.step(`Registrar un abono parcial (${montoAbono}) en Efectivo`, async () => {
    await cxc.abrirRegistrarAbono(idFactura);
    await cxc.seleccionarAbonoEfectivo(montoAbono.toFixed(2));
    await cxc.confirmarAbono();
  });

  await test.step('El historial ganó al menos 1 registro, y contiene uno con el monto y método EXACTOS del abono recién registrado', async () => {
    await cxc.irA();
    await cxc.buscar(nombreCliente);
    await cxc.abrirGestionCliente(0);
    await cxc.abrirHistorialAbonos(idFactura);
    const historialDespues = await cxc.leerHistorialAbonos();
    // Comparación por CONTENIDO (monto+método exactos), no por posición ni
    // por delta exacto de conteo: el ambiente de QA es compartido (ver
    // CLAUDE.md) y esta misma factura puede recibir otros abonos reales de
    // otro escenario/corrida entre la lectura ANTES y la lectura DESPUÉS —
    // la validación real y precisa es que NUESTRO abono específico aparece,
    // no cuántos registros hay en total.
    expect(historialDespues.length, 'El historial no ganó ningún registro nuevo').toBeGreaterThan(historialAntes);
    const nuestroAbono = historialDespues.find((h) => h.metodo === 'Efectivo' && Math.abs(h.monto - montoAbono) < 0.01);
    expect(nuestroAbono, `No se encontró en el historial el abono recién registrado (Efectivo, ${montoAbono})`).toBeTruthy();
  });

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});

test('La búsqueda dentro del modal de gestión acota las facturas al término buscado', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);

  await cxc.irA();
  const clientes = await cxc.leerClientesVisibles();
  const conVariasFacturas = clientes.find((c) => c.cantidadFacturas > 1);
  test.skip(!conVariasFacturas, 'No hay ningún cliente con más de 1 factura pendiente para probar la búsqueda de forma significativa.');

  const indice = clientes.indexOf(conVariasFacturas!);
  await cxc.abrirGestionCliente(indice);
  const totalSinFiltrar = await cxc.contarFacturasPendientesEnGestion();
  expect(totalSinFiltrar).toBeGreaterThan(1);

  const idFactura = (await cxc.obtenerIdsFacturasPendientes())[0];
  await cxc.buscarFacturaEnGestion(idFactura);
  const totalFiltrado = await cxc.contarFacturasPendientesEnGestion();
  expect(totalFiltrado, 'La búsqueda por el id de una factura real no devolvió ningún resultado').toBeGreaterThan(0);
  expect(totalFiltrado).toBeLessThanOrEqual(totalSinFiltrar);
});

test('Abono con Tarjeta (parcial, monto controlado): saldo restante y "Ver historial de abonos" quedan matemáticamente exactos', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);
  const erroresJS = espiarErroresJS(page);

  await cxc.irA();
  const clientes = await cxc.leerClientesVisibles();
  expect(clientes.length).toBeGreaterThan(0);
  // Se toma el ÚLTIMO cliente (mismo criterio ya documentado en el resto de
  // esta suite: reduce la probabilidad de colisión con otros escenarios de
  // esta misma corrida que operan sobre el primero).
  const indice = clientes.length - 1;
  const nombreCliente = clientes[indice].cliente;
  await cxc.abrirGestionCliente(indice);
  const ids = await cxc.obtenerIdsFacturasPendientes();
  expect(ids.length).toBeGreaterThan(0);
  const idFactura = ids[0];
  const saldoAntes = await cxc.leerSaldoFacturaPendiente(idFactura);

  // Monto PARCIAL controlado (90% del saldo, nunca el 100%): a diferencia de
  // seleccionarAbonoMetodoExacto() (siempre el saldo completo), esto deja la
  // factura todavía pendiente — necesario para poder reabrir "Ver historial
  // de abonos" de la MISMA factura después (una factura saldada a 0 ya no
  // aparece en el listado de pendientes, ver el test de arriba con Efectivo).
  const montoAbono = Number((saldoAntes * 0.9).toFixed(2));
  await test.step(`Registrar el abono con Tarjeta (${montoAbono}, 90% del saldo)`, async () => {
    await cxc.abrirRegistrarAbono(idFactura);
    await cxc.seleccionarAbonoMetodoConMonto('tarjeta', montoAbono.toFixed(2));
    await cxc.confirmarAbono();
  });

  const saldoEsperado = Number((saldoAntes - montoAbono).toFixed(2));
  await test.step('SALDO ANTERIOR − ABONO = SALDO NUEVO, y el historial refleja Tarjeta por el monto exacto', async () => {
    await cxc.irA();
    await cxc.buscar(nombreCliente);
    await cxc.abrirGestionCliente(0);
    const saldoDespues = await cxc.leerSaldoFacturaPendiente(idFactura);
    expect(saldoDespues, 'SALDO ANTERIOR − ABONO ≠ SALDO NUEVO').toBeCloseTo(saldoEsperado, 2);

    await cxc.abrirHistorialAbonos(idFactura);
    const historial = await cxc.leerHistorialAbonos();
    const abonoTarjeta = historial.find((h) => h.metodo === 'Tarjeta' && Math.abs(h.monto - montoAbono) < 0.01);
    expect(abonoTarjeta, `El historial no muestra un abono con Tarjeta por ${montoAbono}`).toBeTruthy();
  });

  expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
});

test('Cliente con múltiples facturas: abonar UNA no afecta el saldo de las demás (aislamiento)', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const cxc = new CuentasPorCobrarPage(page);

  await cxc.irA();
  const clientes = await cxc.leerClientesVisibles();
  const conVariasFacturas = clientes.find((c) => c.cantidadFacturas > 1);
  test.skip(!conVariasFacturas, 'No hay ningún cliente con más de 1 factura pendiente para probar aislamiento entre facturas.');

  const indice = clientes.indexOf(conVariasFacturas!);
  const nombreCliente = conVariasFacturas!.cliente;
  await cxc.abrirGestionCliente(indice);
  const ids = await cxc.obtenerIdsFacturasPendientes();
  expect(ids.length).toBeGreaterThan(1);

  const idAbonar = ids[0];
  const idsTestigo = ids.slice(1); // NO se tocan — deben permanecer exactamente iguales
  const saldosTestigoAntes: Record<string, number> = {};
  for (const id of idsTestigo) {
    saldosTestigoAntes[id] = await cxc.leerSaldoFacturaPendiente(id);
  }
  const saldoAbonarAntes = await cxc.leerSaldoFacturaPendiente(idAbonar);

  const montoAbono = Number((saldoAbonarAntes / 2).toFixed(2));
  await test.step(`Abonar SOLO la primera factura (${idAbonar}), un monto parcial (${montoAbono})`, async () => {
    await cxc.abrirRegistrarAbono(idAbonar);
    await cxc.seleccionarAbonoEfectivo(montoAbono.toFixed(2));
    await cxc.confirmarAbono();
  });

  await test.step('La factura abonada bajó exactamente el monto; las demás quedaron intactas', async () => {
    await cxc.irA();
    await cxc.buscar(nombreCliente);
    await cxc.abrirGestionCliente(0);

    const saldoAbonarDespues = await cxc.leerSaldoFacturaPendiente(idAbonar);
    expect(saldoAbonarDespues, 'La factura abonada no bajó exactamente el monto del abono').toBeCloseTo(
      Number((saldoAbonarAntes - montoAbono).toFixed(2)), 2
    );

    for (const id of idsTestigo) {
      const saldoTestigoDespues = await cxc.leerSaldoFacturaPendiente(id);
      expect(saldoTestigoDespues, `La factura testigo ${id} cambió de saldo pese a no haber sido abonada`).toBeCloseTo(saldosTestigoAntes[id], 2);
    }
  });
});
