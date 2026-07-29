import { test, expect } from '@playwright/test';
import { PosPage } from './pos/pos.page';
import { FacturarPage, TIMEOUTS } from './facturar.page';

// Suite específica del submódulo "Cotizaciones" (acceso directo de
// Facturación), NO de la pestaña interna "Proforma / Cotizaciones" del POS
// — esa ya está cubierta por tests/facturar/pos/pos-proforma.spec.ts
// (describe "Proformas — Facturar y Convertir" → "Seleccionar y
// Facturar"), que sigue intacto.
//
// Reutiliza exactamente los mismos métodos de PosProforma/PosPage que ya
// usa esa suite (obtenerPrimeraProformaEnTab, cargarProformaEnCarritoDesdeTab,
// desactivarDescuentoGeneral, y para crear una Cotización de respaldo si el
// ambiente no tuviera ninguna: abrirCrearProforma, seleccionarTipoProforma,
// guardarProformaYObtenerRespuesta, validarProformaCreada,
// cerrarModalGestionProforma) — no se reimplementa ninguna lógica de
// negocio. El punto de entrada es FacturarPage.abrirCotizaciones() (link
// directo del sidebar "FACTURAR", `get_company_pos_select(5)`, confirmado
// en vivo que aterriza con el tab "Proforma / Cotizaciones" ya activo).
//
// ── Hallazgo real de ambiente/producto (investigado en vivo, no automatización) ──
// Igual que "Ordenes de caja" (ver facturar-orden-caja.spec.ts): la página
// que renderiza el link directo "Cotizaciones" del sidebar
// (`get_company_pos_select(5)`) NO incluye el botón "Facturar"
// (`#btn_pay_sale`) — confirmado en vivo, mismo síntoma exacto
// (locator.click cuelga el timeout completo esperando un elemento con
// count()=0) tras cargar una Cotización real al carrito. Es una limitación
// real de esta ruta de entrada en el ERP (no del tab interno, que sí
// funciona — pos-proforma.spec.ts lo prueba), no un bug de automatización.
// Por eso esta suite valida hasta donde el flujo real llega (cargar la
// Cotización al carrito), sin forzar un paso de "Facturar" que la propia
// aplicación no ofrece desde aquí. Ver también el reporte final de esta
// sesión.
//
// Sin fixture de worker propia (mismo criterio que facturar-orden-caja.spec.ts):
// el punto bajo prueba es justamente pasar por el Dashboard cada vez a
// través del link real.

/**
 * Reutiliza la primera Cotización ("normal") ya existente en la pestaña, o
 * crea una básica de respaldo si el ambiente no tuviera ninguna — misma
 * composición que buscarOCrearProformaEnTab() de pos-proforma.spec.ts (no se
 * duplica la lógica de negocio: cada paso llama al método real de
 * PosProforma/PosPage ya existente), replicada aquí porque ese helper es
 * local a ese archivo, no parte de la API pública del Page Object.
 */
async function buscarOCrearCotizacionNormal(pos: PosPage) {
  let encontrada = await pos.obtenerPrimeraProformaEnTab('normal');
  if (encontrada) return encontrada;

  const productoNormal = await pos.obtenerPrimerProductoNormal();
  await pos.agregarProductoAlCarrito(productoNormal);
  await pos.seleccionarClienteExistente();
  await pos.abrirCrearProforma();
  await pos.seleccionarTipoProforma('normal');
  const respuesta = await pos.guardarProformaYObtenerRespuesta();
  await pos.validarProformaCreada(respuesta);
  await pos.cerrarModalGestionProforma();

  encontrada = await pos.obtenerPrimeraProformaEnTab('normal');
  expect(encontrada, 'La Cotización recién creada para reutilizar no apareció en la pestaña "Proforma / Cotizaciones"').not.toBeNull();
  return encontrada!;
}

test('Seleccionar la primera Cotización disponible entrando por el link directo de Facturación', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const facturar = new FacturarPage(pos, page);

  await test.step('Ingresar a "Cotizaciones" por el link directo de Facturación (no por el tab interno del POS)', async () => {
    await facturar.abrirCotizaciones();
  });

  let nombreCliente = '';
  await test.step('Reutilizar la primera Cotización disponible, o crear una básica si no hay ninguna', async () => {
    const { tarjeta, nombreCliente: cliente } = await buscarOCrearCotizacionNormal(pos);
    nombreCliente = cliente;
    expect(nombreCliente.length, 'La Cotización reutilizada no trae ningún cliente asociado').toBeGreaterThan(0);
    await pos.cargarProformaEnCarritoDesdeTab(tarjeta);
  });

  await test.step('Descartar Descuento General residual de una corrida previa (mismo criterio defensivo de pos-proforma.spec.ts)', async () => {
    await pos.desactivarDescuentoGeneral();
  });

  await test.step('Validar que la Cotización cargó líneas al carrito con un total real', async () => {
    const claves = await pos.obtenerClavesFilasCarrito();
    expect(claves.length, 'La Cotización cargada no trajo ninguna línea al carrito').toBeGreaterThan(0);
    const total = await pos.obtenerTotalVentaNumerico();
    expect(total).toBeGreaterThan(0);
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});
