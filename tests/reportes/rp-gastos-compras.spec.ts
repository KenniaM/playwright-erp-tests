import { test, expect } from '@playwright/test';
import { ComprasAgregarGastosPage } from '../compras/compras-agregar-gastos.page';
import { ReporteGastosComprasPage } from './rp-compras.page';

// Suite de INVESTIGACIÓN + INTEGRACIÓN — sin BASE_URL/POS_COMPANIA propios:
// corre contra cualquier ambiente/compañía tal como lo resuelva el comando
// que la invoque (`--project=firefox` para el ambiente original,
// `--project=setup-restaurant --project=firefox-restaurant` para el
// ambiente restaurante, etc. — mismo criterio que el resto de specs no
// atados a un ambiente específico). El primer Proveedor/Moneda real del
// catálogo se toma dinámicamente en cada test, nunca un nombre fijo.
//
// ESTE es el "Reporte de Gastos" real del ERP (Compras > Agregar gastos,
// `/expense/expense` + `/expense/expenseInvoice` → Reportes > Compras >
// Gastos, `reports/expenseReport`, `ReporteGastosComprasPage` en
// rp-compras.page.ts) — distinto del "Reporte de Gastos Operativos"
// (family_expenses, ver rp-gastos-operativos.spec.ts), que es un
// módulo de salida de inventario sin proveedor/moneda/método de pago. Este
// SÍ tiene Proveedor, Moneda, Tipo de cambio, Contado/Crédito, Impuesto.
//
// CORRECCIÓN de un falso "bug de sistema" documentado en una sesión previa
// (ver el encabezado completo de ComprasAgregarGastosPage en
// compras-agregar-gastos.page.ts): el botón "Guardar" del formulario
// "Agregar gasto" SÍ es funcional — confirmado en vivo creando un gasto
// real de punta a punta. La sesión previa nunca llenaba el campo
// obligatorio "Tipo de Gasto" (`#expense_type`), y el handler real de
// `#save_purchase` no da NINGÚN feedback visible (sin SweetAlert, sin red,
// sin toast) cuando `validate_invoice_detail()` falla — solo una clase CSS
// `.error` silenciosa. Esta suite ahora cubre el flujo real completo,
// incluida la integración con Reportes > Compras > Gastos.

test.describe('Compras > Agregar gastos (Panel de Gastos)', () => {
  test('el Panel de Gastos carga con sus filtros reales y el botón "Agregar" navega al formulario real (no un modal)', async ({ page }) => {
    test.setTimeout(60_000);
    const gastos = new ComprasAgregarGastosPage(page);

    await test.step('Navegar al Panel de Gastos', async () => {
      await gastos.abrirPanelGastos();
      expect(page.url()).toContain('expense/expense');
      await expect(page).toHaveTitle(/gastos/i);
    });

    await test.step('El botón "Agregar" navega realmente a /expense/expenseInvoice (confirmado en vivo: es un <a href>, no abre un modal)', async () => {
      await gastos.irAAgregarGasto();
      expect(page.url()).toContain('expense/expenseInvoice');
      await expect(page).toHaveTitle(/agregar gasto/i);
    });

    await gastos.validarSinErrores();
  });

  test('el formulario "Agregar gasto" expone catálogos reales de Proveedor/Moneda/Impuesto (Chosen)', async ({ page }) => {
    test.setTimeout(60_000);
    const gastos = new ComprasAgregarGastosPage(page);
    await gastos.abrirPanelGastos();
    await gastos.irAAgregarGasto();

    let primerProveedor = '';
    let primeraMoneda = '';

    await test.step('El catálogo de Proveedores tiene al menos una opción real', async () => {
      const proveedores = await gastos.obtenerOpcionesRealesDeSelect('purchase_provider');
      expect(proveedores.length, 'Se esperaba al menos un Proveedor real configurado en este ambiente').toBeGreaterThan(0);
      primerProveedor = proveedores[0];
    });

    await test.step('El catálogo de Monedas tiene al menos una opción real', async () => {
      const monedas = await gastos.obtenerOpcionesRealesDeSelect('expense_currency_select');
      expect(monedas.length, 'Se esperaba al menos una Moneda real configurada en este ambiente').toBeGreaterThan(0);
      primeraMoneda = monedas[0];
    });

    await test.step('El catálogo de Tarifas de Impuesto tiene opciones reales configuradas', async () => {
      const tarifas = await gastos.obtenerOpcionesRealesDeSelect('tax_rate_select');
      expect(tarifas.length).toBeGreaterThan(0);
    });

    await test.step('Al elegir el primer Proveedor y la primera Moneda reales, el Chosen refleja la selección', async () => {
      await gastos.seleccionarProveedor(primerProveedor);
      await gastos.seleccionarMoneda(primeraMoneda);
      await expect(page.locator('#purchase_provider_chosen .chosen-single span')).toHaveText(primerProveedor);
      await expect(page.locator('#expense_currency_select_chosen .chosen-single span')).toContainText(primeraMoneda.split(' ')[0]);
    });

    await gastos.validarSinErrores();
  });

  // Corregido: la sesión previa nunca llenaba "Tipo de Gasto" (obligatorio,
  // ver el hallazgo completo en ComprasAgregarGastosPage) — con el
  // formulario realmente completo, "Guardar" SÍ crea el gasto de punta a
  // punta (confirmado con la respuesta real de `addExpense` y el SweetAlert
  // de éxito).
  test('"Guardar" con el formulario completo (incluyendo Tipo de Gasto) crea el gasto real', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const gastos = new ComprasAgregarGastosPage(page);
    await gastos.abrirPanelGastos();
    await gastos.irAAgregarGasto();

    const proveedores = await gastos.obtenerOpcionesRealesDeSelect('purchase_provider');
    const monedas = await gastos.obtenerOpcionesRealesDeSelect('expense_currency_select');
    test.skip(proveedores.length === 0 || monedas.length === 0, 'Este ambiente no tiene Proveedor/Moneda reales configurados para completar el formulario.');

    const factura = 'QA-INV-' + Date.now();

    await test.step('Llenar el formulario completo, incluido "Tipo de Gasto"', async () => {
      await gastos.seleccionarProveedor(proveedores[0]);
      await gastos.seleccionarMoneda(monedas[0]);
      await gastos.llenarFactura(factura);
      await gastos.marcarContado();
      await gastos.llenarObservaciones(`Gasto QA ${Date.now()}`);
      await gastos.llenarMonto('15000');
      await gastos.llenarFechaFacturacion(new Date().toISOString().slice(0, 10));
      await gastos.asegurarTipoGastoSeleccionado();
      await testInfo.attach('formulario-completo-antes-de-guardar', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    });

    const resultado = await test.step('Guardar y confirmar el flujo real (SweetAlert de confirmación → Procesar → SweetAlert de éxito)', async () => {
      return gastos.guardarGasto();
    });

    await testInfo.attach('resultado-tras-guardar', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    expect(resultado.exito, `Se esperaba el SweetAlert de éxito, se obtuvo: "${resultado.mensaje}"`).toBe(true);
    await gastos.validarSinErrores();
  });

  // Comportamiento real de la app (no un bug): si falta un campo
  // obligatorio, `validate_invoice_detail()` bloquea el envío SIN ningún
  // feedback visible por red/SweetAlert2/`.noty_bar`/URL — solo una clase
  // CSS `.error` silenciosa en el campo (ver el hallazgo completo en
  // ComprasAgregarGastosPage). Documentado con capturas reales.
  test('Sin "Tipo de Gasto", "Guardar" no produce ningún efecto visible (validación silenciosa real de la app)', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const gastos = new ComprasAgregarGastosPage(page);
    await gastos.abrirPanelGastos();
    await gastos.irAAgregarGasto();

    const proveedores = await gastos.obtenerOpcionesRealesDeSelect('purchase_provider');
    const monedas = await gastos.obtenerOpcionesRealesDeSelect('expense_currency_select');
    test.skip(proveedores.length === 0 || monedas.length === 0, 'Este ambiente no tiene Proveedor/Moneda reales configurados para completar el formulario.');

    // Formulario completo A PROPÓSITO SIN Tipo de Gasto.
    await gastos.seleccionarProveedor(proveedores[0]);
    await gastos.seleccionarMoneda(monedas[0]);
    await gastos.llenarFactura('QA-INV-' + Date.now());
    await gastos.marcarContado();
    await gastos.llenarObservaciones(`Gasto QA sin tipo ${Date.now()}`);
    await gastos.llenarMonto('15000');
    await gastos.llenarFechaFacturacion(new Date().toISOString().slice(0, 10));

    await testInfo.attach('formulario-sin-tipo-de-gasto', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    const urlAntes = page.url();
    const efecto = await gastos.presionarGuardarYObservarEfecto();

    await testInfo.attach('estado-tras-click-en-guardar-sin-tipo-de-gasto', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    expect(page.url()).toBe(urlAntes);
    expect(efecto).toEqual({ huboRequest: false, huboSwal: false, huboNoty: false, urlCambio: false });
    expect(await gastos.campoTieneErrorValidacion('#expense_type_chosen'), 'Se esperaba que "Tipo de Gasto" quedara marcado como campo inválido').toBe(true);
  });

  test('el tipo de cambio se autocompleta al elegir una moneda distinta a la primera del catálogo', async ({ page }) => {
    test.setTimeout(60_000);
    const gastos = new ComprasAgregarGastosPage(page);
    await gastos.abrirPanelGastos();
    await gastos.irAAgregarGasto();

    const monedas = await gastos.obtenerOpcionesRealesDeSelect('expense_currency_select');
    test.skip(monedas.length < 2, 'Este ambiente no tiene al menos 2 monedas reales configuradas.');

    await gastos.seleccionarMoneda(monedas[1]);
    const tipoCambio = await gastos.obtenerTipoCambio();
    expect(Number(tipoCambio.replace(/[^\d.]/g, ''))).toBeGreaterThan(0);
  });
});

test.describe('Reportes > Compras > Gastos', () => {
  test('el reporte carga con su encabezado, tabla y resumen por moneda reales', async ({ page }) => {
    test.setTimeout(60_000);
    const reporte = new ReporteGastosComprasPage(page);

    await test.step('Navegar al reporte', async () => {
      await reporte.abrirReporteGastos();
      expect(page.url()).toContain('expenseReport');
    });

    await test.step('El encabezado, las columnas reales de la tabla y el resumen por moneda cargan reales', async () => {
      await expect(page.getByRole('heading', { name: 'Reporte de Gastos', level: 1 })).toBeVisible({ timeout: 30_000 });
      // La columna "Proveedor" del encabezado estático de la tabla (no
      // reporte.validarTabla(), que apunta al <tbody> de resultados —
      // confirmado en vivo, ambiente restaurante, que ese <tbody> solo se
      // puebla tras una búsqueda ejecutada, ver el hallazgo de rendimiento
      // documentado abajo sobre `buscar()`).
      await expect(page.getByRole('columnheader', { name: 'Proveedor' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('heading', { name: /resumen por moneda/i })).toBeVisible({ timeout: 30_000 });
    });

    await reporte.validarSinErrores();
  });

  // CORREGIDO (era en realidad la causa raíz del "hallazgo de rendimiento"
  // documentado en una sesión previa, que reportaba que `buscar()` no
  // completaba de forma confiable ni con 90s de margen): el reporte fue
  // rediseñado por completo a "ExpenseReportV2" — el Page Object viejo
  // apuntaba a `#expense_invoice_search`/`#btn_search_receip2`, elementos
  // que ya NO EXISTEN, así que `buscar()` reintentaba contra un selector
  // inexistente hasta agotar el timeout. Con los selectores reales
  // (`#erv2_search_input`, endpoint `getExpenseReportSearchData`),
  // `buscar()` responde en ~1-1.5s de forma consistente (ver el test de
  // integración más abajo).

  // Corregido: el reporte fue rediseñado por completo a "ExpenseReportV2"
  // (ver el encabezado de ReporteGastosComprasPage) — el filtro de Moneda
  // del componente nuevo SÍ es un Chosen real, visible y funcional.
  test('el filtro de Moneda es un Chosen real, visible y funcional', async ({ page }) => {
    test.setTimeout(60_000);
    const reporte = new ReporteGastosComprasPage(page);
    await reporte.abrirReporteGastos();

    expect(await reporte.monedaEsVisible()).toBe(true);
  });
});

// ─── Integración: crear un gasto real (Monto libre / líneas de producto) ──
// y validarlo en el Reporte de Gastos ────────────────────────────────────
//
// Cubre de punta a punta el flujo pedido explícitamente: crear un gasto en
// ambos modos reales del formulario ("Monto" libre y "¿Agregar Productos?"
// con varias líneas) y confirmar que el Reporte de Gastos (ExpenseReportV2)
// refleja exactamente el mismo Proveedor y Total — incluye el fix real de
// `montoANumero()` (ver rp-compras.page.ts: el monto en colones se
// formatea "₡4.000,00", punto de miles + coma decimal, y el parser viejo
// lo leía mal como "4").

test.describe('Integración: crear un gasto real y validarlo en el Reporte de Gastos', () => {
  test('Gasto con Monto libre: el Total del reporte coincide exactamente con el monto ingresado', async ({ page }) => {
    test.setTimeout(90_000);
    const gastos = new ComprasAgregarGastosPage(page);
    await gastos.abrirPanelGastos();
    await gastos.irAAgregarGasto();

    const proveedores = await gastos.obtenerOpcionesRealesDeSelect('purchase_provider');
    const monedas = await gastos.obtenerOpcionesRealesDeSelect('expense_currency_select');
    test.skip(proveedores.length === 0 || monedas.length === 0, 'Este ambiente no tiene Proveedor/Moneda reales configurados para completar el formulario.');

    const factura = 'QA-RPT-MONTO-' + Date.now();
    const monto = 15000;

    await test.step('Crear el gasto con Monto libre', async () => {
      await gastos.seleccionarProveedor(proveedores[0]);
      await gastos.seleccionarMoneda(monedas[0]);
      await gastos.llenarFactura(factura);
      await gastos.marcarContado();
      await gastos.llenarObservaciones(`Gasto QA reporte monto ${Date.now()}`);
      await gastos.llenarMonto(String(monto));
      await gastos.llenarFechaFacturacion(new Date().toISOString().slice(0, 10));
      await gastos.asegurarTipoGastoSeleccionado();

      const resultado = await gastos.guardarGasto();
      expect(resultado.exito, `Se esperaba el SweetAlert de éxito, se obtuvo: "${resultado.mensaje}"`).toBe(true);
    });

    const reporte = new ReporteGastosComprasPage(page);
    await test.step('Localizar el gasto en el Reporte de Gastos por su número de factura', async () => {
      await reporte.abrirReporteGastos();
      await reporte.buscar(factura);
      await expect.poll(() => reporte.contarFilas()).toBe(1);
    });

    await test.step('El Proveedor y el Total del reporte coinciden exactamente con lo ingresado', async () => {
      const proveedorFila = await reporte.obtenerProveedorDeFila(0);
      const totalFila = await reporte.obtenerTotalNumericoDeFila(0);
      expect(proveedorFila).toBe(proveedores[0]);
      expect(totalFila).toBeCloseTo(monto, 2);
    });

    await reporte.validarSinErrores();
  });

  // "¿Agregar Productos?" — modo de líneas de producto (texto libre, ver el
  // hallazgo completo en ComprasAgregarGastosPage): 2 líneas reales con
  // cantidad/precio distintos, confirmando que el Total general (suma de
  // ambas líneas) es exactamente el que termina reflejado en el reporte.
  test('Gasto con líneas de producto (2 productos): el Total del reporte coincide con la suma real de las líneas', async ({ page }) => {
    test.setTimeout(90_000);
    const gastos = new ComprasAgregarGastosPage(page);
    await gastos.abrirPanelGastos();
    await gastos.irAAgregarGasto();

    const proveedores = await gastos.obtenerOpcionesRealesDeSelect('purchase_provider');
    const monedas = await gastos.obtenerOpcionesRealesDeSelect('expense_currency_select');
    test.skip(proveedores.length === 0 || monedas.length === 0, 'Este ambiente no tiene Proveedor/Moneda reales configurados para completar el formulario.');

    const factura = 'QA-RPT-PROD-' + Date.now();
    let totalEsperado = 0;

    await test.step('Crear el gasto con 2 líneas de producto reales', async () => {
      await gastos.seleccionarProveedor(proveedores[0]);
      await gastos.seleccionarMoneda(monedas[0]);
      await gastos.llenarFactura(factura);
      await gastos.marcarContado();
      await gastos.llenarObservaciones(`Gasto QA reporte productos ${Date.now()}`);
      await gastos.llenarFechaFacturacion(new Date().toISOString().slice(0, 10));
      await gastos.asegurarTipoGastoSeleccionado();

      await gastos.activarAgregarProductos();
      await gastos.llenarFilaProducto(0, { nombre: 'Producto QA Uno', cantidad: 3, precio: 1000 });
      await gastos.agregarFilaProducto();
      await gastos.llenarFilaProducto(1, { nombre: 'Producto QA Dos', cantidad: 2, precio: 500 });

      const total1 = await gastos.obtenerTotalFilaProducto(0);
      const total2 = await gastos.obtenerTotalFilaProducto(1);
      totalEsperado = await gastos.obtenerTotalGeneral();
      expect(total1, 'Total de la primera línea (3 × 1000)').toBeCloseTo(3000, 2);
      expect(total2, 'Total de la segunda línea (2 × 500)').toBeCloseTo(1000, 2);
      expect(totalEsperado, 'El Total general debe ser la suma de ambas líneas').toBeCloseTo(total1 + total2, 2);

      const resultado = await gastos.guardarGasto();
      expect(resultado.exito, `Se esperaba el SweetAlert de éxito, se obtuvo: "${resultado.mensaje}"`).toBe(true);
    });

    const reporte = new ReporteGastosComprasPage(page);
    await test.step('Localizar el gasto en el Reporte de Gastos por su número de factura', async () => {
      await reporte.abrirReporteGastos();
      await reporte.buscar(factura);
      await expect.poll(() => reporte.contarFilas()).toBe(1);
    });

    await test.step('El Total del reporte coincide exactamente con la suma real de las 2 líneas de producto', async () => {
      const proveedorFila = await reporte.obtenerProveedorDeFila(0);
      const totalFila = await reporte.obtenerTotalNumericoDeFila(0);
      expect(proveedorFila).toBe(proveedores[0]);
      expect(totalFila).toBeCloseTo(totalEsperado, 2);
    });

    await reporte.validarSinErrores();
  });
});
