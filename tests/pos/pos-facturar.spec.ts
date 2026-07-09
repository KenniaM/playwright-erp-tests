import { test, expect } from '@playwright/test';
import { PosPage, TIMEOUTS, PRECIO_PRODUCTO_RAPIDO } from './pos.page';

const NOMBRE_CLIENTE_FACTURA = 'Cliente De Prueba QA';

test('facturar producto rápido con IVA y cliente existente en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  await test.step('Agregar un producto rápido con IVA activado', async () => {
    await pos.agregarProductoRapidoParaValidacionIva(`Producto Rápido IVA Cliente Existente ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO, true);
  });

  await test.step('Seleccionar un cliente existente', async () => {
    const nombreCliente = await pos.seleccionarClienteExistente();
    expect(nombreCliente.length).toBeGreaterThan(0);
  });

  await test.step('Abrir modal de pago', async () => {
    await pos.abrirModalDePago();
  });

  await test.step('Pagar en efectivo', async () => {
    const total = await pos.obtenerTotalVentaNumerico();
    expect(total).toBeGreaterThan(0);
    await pos.seleccionarPagoEfectivo(String(total));
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
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
    await pos.cerrarOverlaysConocidos();
  });

  await test.step('Agregar un producto rápido con IVA activado', async () => {
    await pos.agregarProductoRapidoParaValidacionIva(`Producto Rápido IVA Nombre Cliente ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO, true);
  });

  await test.step('Ingresar solo el nombre del cliente (sin seleccionar uno registrado)', async () => {
    await pos.ingresarNombreCliente(NOMBRE_CLIENTE_FACTURA);
  });

  await test.step('Abrir modal de pago', async () => {
    await pos.abrirModalDePago();
  });

  await test.step('Pagar en efectivo', async () => {
    const total = await pos.obtenerTotalVentaNumerico();
    expect(total).toBeGreaterThan(0);
    await pos.seleccionarPagoEfectivo(String(total));
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
  });

  await test.step('Validar carrito vacío', async () => {
    await pos.validarCarritoVacio();
  });
});
