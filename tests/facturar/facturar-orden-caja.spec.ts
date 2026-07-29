import { test, expect } from '@playwright/test';
import { PosPage } from './pos/pos.page';
import { FacturarPage, TIMEOUTS } from './facturar.page';

// Suite específica del submódulo "Ordenes de caja" (acceso directo de
// Facturación), NO de la pestaña interna del POS — esa ya está cubierta por
// tests/facturar/pos/pos-orden-caja.spec.ts (patrón "Orden de Caja —
// Seleccionar y Facturar", tests 16-22), que sigue intacto.
//
// Reutiliza exactamente los mismos métodos de PosOrdenCaja/PosPage que ya
// usa esa suite (cargarPrimeraOrdenCajaDisponible, abrirAgregarItem,
// agregarProductoDelGridAlCarrito) — no se reimplementa ninguna lógica de
// negocio. El punto de entrada es FacturarPage.abrirOrdenesDeCaja() (link
// directo del sidebar "FACTURAR", confirmado en vivo que aterriza directo
// en #content_invoice_order_list) en vez de PosPage.abrirOrdenesCaja() (tab
// interno #btn_cashier_option).
//
// ── Hallazgo real de ambiente/producto (investigado en vivo, no automatización) ──
// A diferencia de entrar por "Crear factura" → tab interno "Órdenes de
// caja" (que sí permite completar la venta), la página que renderiza el
// link directo "Ordenes de caja" del sidebar NO incluye el botón
// "Facturar" (`#btn_pay_sale`) en ningún punto: confirmado en vivo que
// count()=0 tanto justo después de cargar una orden al carrito, como tras
// cambiar al tab "POS Facturación" (`#btn_pos_option`) sin salir de la
// página, como tras abrir "AGREGAR ITEMS" — en los tres casos el carrito sí
// queda poblado (mismas líneas reales), pero el botón de checkout
// simplemente no existe en el DOM de esta página. Es una limitación real de
// esta ruta de entrada en el ERP, no un bug de automatización ni algo que
// se pueda resolver con un selector distinto — por eso esta suite valida
// hasta donde el flujo real llega (cargar la Orden de Caja y agregar ítems
// al carrito), sin forzar un paso de "Facturar" que la propia aplicación no
// ofrece desde aquí. Ver también el reporte final de esta sesión.
//
// Sin fixture de worker propia: el punto bajo prueba es justamente pasar
// por el Dashboard cada vez a través del link real, así que no hay nada
// barato que cachear entre tests — mismo criterio del resto de specs
// "simples" del repo (fixture `page` estándar).

test('Seleccionar la primera Orden de Caja disponible entrando por el link directo de Facturación', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const facturar = new FacturarPage(pos, page);

  await test.step('Ingresar a "Ordenes de caja" por el link directo de Facturación (no por el tab interno del POS)', async () => {
    await facturar.abrirOrdenesDeCaja();
  });

  await test.step('Cargar la primera Orden de Caja disponible', async () => {
    await pos.cargarPrimeraOrdenCajaDisponible();
    expect(await pos.obtenerCantidadFilasCarrito(), 'La Orden de Caja no cargó ninguna línea al carrito').toBeGreaterThan(0);
  });

  await test.step('Validar que el total de la venta cargada es real (mayor que cero)', async () => {
    const total = await pos.obtenerTotalVentaNumerico();
    expect(total).toBeGreaterThan(0);
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});

test('Seleccionar una Orden de Caja entrando por el link directo de Facturación y agregar un producto vía "AGREGAR ITEMS"', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const facturar = new FacturarPage(pos, page);

  await test.step('Ingresar a "Ordenes de caja" por el link directo de Facturación y cargar la primera disponible', async () => {
    await facturar.abrirOrdenesDeCaja();
    await pos.cargarPrimeraOrdenCajaDisponible();
  });

  await test.step('Presionar "AGREGAR ITEMS" y agregar un producto', async () => {
    const clavesAntes = await pos.obtenerClavesProductos();
    await pos.abrirAgregarItem();
    const producto = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
    const claveProducto = await pos.agregarProductoDelGridAlCarrito(producto);
    expect(await pos.obtenerClavesProductos(), 'El producto agregado no aparece en el carrito').toContain(claveProducto);
    expect(
      (await pos.obtenerClavesProductos()).length,
      'El carrito no creció tras agregar el producto vía "AGREGAR ITEMS"'
    ).toBeGreaterThan(clavesAntes.length);
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});
