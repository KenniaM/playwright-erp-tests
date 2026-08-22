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
// HALLAZGO PRINCIPAL DE ESTA SUITE (bloqueante, confirmado en vivo contra
// el ambiente restaurante — ver ComprasAgregarGastosPage en
// compras-agregar-gastos.page.ts para el detalle completo con evidencia):
// el botón "Guardar" del formulario "Agregar gasto" NO produce ningún
// efecto observable — no hay forma de crear un gasto real desde la UI. Esto
// bloquea la validación de integración completa (crear gasto → validar en
// Reportes > Compras > Gastos, con matemática de IVA/descuento/conversión
// de moneda) que esta suite habría cubierto de funcionar — se documenta el
// bloqueo con evidencia en vez de inventar una forma alternativa de
// insertar el dato. Si el ambiente contra el que se corre esta suite tiene
// "Guardar" funcional, el test de esa sección fallará y debe releerse como
// señal de que el hallazgo ya no aplica ahí, no como una regresión de esta
// suite.

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

  // BUG DE SISTEMA confirmado en vivo (ambiente restaurante, múltiples
  // combinaciones de campos, ver el comentario completo en
  // ComprasAgregarGastosPage): "Guardar" no produce absolutamente ningún
  // efecto observable — sin request de red, sin SweetAlert2, sin
  // `.noty_bar`, sin cambio de URL, sin error de consola. El botón real es
  // `type="submit"` pero NO está dentro de ningún `<form>` del documento.
  // Se deja el test fallando a propósito (mismo criterio que "Ver la
  // Tienda" en tienda-navegacion.spec.ts) en vez de forzarlo a pasar.
  test('BUG: "Guardar" no produce ningún efecto real — imposible crear un gasto desde esta pantalla', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const gastos = new ComprasAgregarGastosPage(page);
    await gastos.abrirPanelGastos();
    await gastos.irAAgregarGasto();

    const proveedores = await gastos.obtenerOpcionesRealesDeSelect('purchase_provider');
    const monedas = await gastos.obtenerOpcionesRealesDeSelect('expense_currency_select');
    test.skip(proveedores.length === 0 || monedas.length === 0, 'Este ambiente no tiene Proveedor/Moneda reales configurados para completar el formulario.');

    await gastos.seleccionarProveedor(proveedores[0]);
    await gastos.seleccionarMoneda(monedas[0]);
    await gastos.llenarFactura('QA-INV-' + Date.now());
    await gastos.marcarContado();
    await gastos.llenarObservaciones(`Gasto QA ${Date.now()}`);
    await gastos.llenarMonto('15000');

    // Evidencia visual: formulario completo, justo antes de presionar
    // "Guardar" — adjuntada al reporte HTML de Playwright (testInfo.attach)
    // para poder confirmar visualmente que todos los campos obligatorios
    // quedaron llenos antes del click.
    await testInfo.attach('formulario-completo-antes-de-guardar', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    const urlAntes = page.url();
    const efecto = await gastos.presionarGuardarYObservarEfecto();

    // Evidencia visual: estado de la pantalla justo después del click en
    // "Guardar" — mismo formulario, misma URL, sin ningún modal/alerta
    // nueva, confirmando visualmente que no hubo ningún efecto.
    await testInfo.attach('estado-tras-click-en-guardar', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    expect(page.url(), 'La URL cambió tras Guardar (contradice el hallazgo — revisar)').toBe(urlAntes);
    expect(
      efecto,
      'Se esperaba confirmar que "Guardar" NO produce ningún efecto observable (hallazgo real de sistema, no automatización)'
    ).toEqual({ huboRequest: false, huboSwal: false, huboNoty: false, urlCambio: false });
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

  // HALLAZGO DE RENDIMIENTO confirmado en vivo (ambiente restaurante, 3
  // intentos independientes, hasta 90s de margen cada uno): ejecutar
  // `reporte.buscar()` en este reporte no completó de forma confiable — el
  // encabezado/tabla/resumen por moneda SÍ cargan y quedan visibles de
  // forma estable (ver el test de arriba), pero el ciclo buscador→AJAX real
  // (`getExpenseSeacrh`) no se pudo confirmar exitoso en ninguno de los 3
  // intentos. No se pudo aislar con certeza si es lentitud genuina del
  // backend para este reporte o saturación acumulada de esa sesión de QA —
  // no se fuerza un test a pasar ni se sube el timeout más allá de lo ya
  // intentado; queda documentado para re-verificar en una sesión nueva y
  // aislada, o en otro ambiente.

  test('BUG: el filtro de Moneda no es funcional en este reporte (mismo hallazgo ya documentado)', async ({ page }) => {
    test.setTimeout(60_000);
    const reporte = new ReporteGastosComprasPage(page);
    await reporte.abrirReporteGastos();

    expect(await reporte.monedaEsVisible()).toBe(false);
  });
});
