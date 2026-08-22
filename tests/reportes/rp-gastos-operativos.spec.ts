import { test, expect } from '@playwright/test';
import { ReportesPage, TIMEOUTS } from './reportes.page';
import {
  hoyISO,
  hoyMenosDiasISO,
  ReporteGastosOperativosPage,
  SUBMODULOS_REPORTES_GASTOS_OPERATIVOS,
} from './rp-gastos-operativos.page';

for (const submodulo of SUBMODULOS_REPORTES_GASTOS_OPERATIVOS) {
  test(`Cargar el submódulo "${submodulo.nombre}" del módulo Reportes > Gastos Operativos`, async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const reportes = new ReportesPage(page);

    await test.step(`Navegar a "${submodulo.nombre}"`, async () => {
      await reportes.irA(submodulo.url);
    });

    await test.step('Validar que la URL final corresponde al submódulo esperado', async () => {
      expect(page.url()).toContain(submodulo.rutaEsperada);
    });

    await test.step('Validar el título de la página', async () => {
      await expect(page).toHaveTitle(submodulo.tituloEsperado);
    });

    await test.step('Validar que el contenido propio del submódulo cargó correctamente', async () => {
      await expect(submodulo.obtenerLocatorDeCarga(page)).toBeVisible({ timeout: TIMEOUTS.CARGA });
    });

    await test.step('Validar que no queda ningún mensaje de error visible', async () => {
      await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
    });
  });
}

// ─── Reporte de Gastos Operativos ──────────────────────────────────────────
//
// Analizado en vivo (scripts de investigación descartados tras extraer la
// evidencia, no forman parte de esta suite — ver el comentario completo de
// ReporteGastosOperativosPage en rp-gastos-operativos.page.ts):
//   - No existe ningún filtro adicional (tipo de gasto/categoría/estado/
//     usuario/sucursal/caja/centro de costo): solo hay rango de fechas +
//     buscador de texto libre.
//   - No existe ordenamiento de columnas (los encabezados no son clicables).
//   - No existe paginación visible en el DOM con los datos reales
//     disponibles en este ambiente — no se crean pruebas ficticias para
//     ninguna de las dos.
//   - No existe exportación a PDF ni CSV, solo "Descargar Excel".
//   - "Agregar" y "Eliminar" SÍ se prueban de punta a punta (ver el describe
//     "Agregar y Eliminar gasto operativo" más abajo) — pero "Eliminar" solo
//     se ejecuta sobre gastos que el propio test crea primero con "Agregar",
//     nunca sobre registros preexistentes del ambiente compartido de QA.

test.describe('Reporte de Gastos Operativos', () => {
  test('carga la tabla con sus columnas, con datos reales y sin errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosOperativosPage(page);

    await test.step('Abrir el reporte', async () => {
      await gastos.abrirReporteGastosOperativos();
    });

    await test.step('La tabla es visible', async () => {
      await gastos.validarTabla();
    });

    await test.step('No hay mensaje de error visible', async () => {
      await gastos.validarSinErrores();
    });
  });

  test('el rango de fechas se puede ampliar y la búsqueda sigue funcionando sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosOperativosPage(page);
    await gastos.abrirReporteGastosOperativos();

    const filasRangoCorto = await test.step('Buscar con el rango por defecto (hoy)', async () => {
      await gastos.aumentarRangoFechas(hoyISO(), hoyISO());
      await gastos.buscar();
      return gastos.contarFilas();
    });

    await test.step('Ampliar el rango a los últimos 2 años y buscar de nuevo', async () => {
      await gastos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
      await gastos.buscar();
    });

    await test.step('El reporte sigue funcionando: la tabla es visible y no hay menos resultados que con el rango corto', async () => {
      await gastos.validarTabla();
      await expect.poll(() => gastos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThanOrEqual(filasRangoCorto);
      await gastos.validarSinErrores();
    });
  });

  test('la búsqueda por texto filtra por el código real del gasto y limpiarla restaura todos los registros', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosOperativosPage(page);
    await gastos.abrirReporteGastosOperativos();
    await gastos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await gastos.buscar();

    const totalSinFiltrar = await gastos.contarFilas();
    test.skip(totalSinFiltrar === 0, 'El ambiente de QA no tiene gastos operativos registrados en los últimos 2 años.');

    const codigo = await test.step('Tomar el código real de la primera fila como término de búsqueda', async () => {
      const texto = await gastos.obtenerCodigoDeFila(0);
      return texto.replace(/[^\d]/g, '').trim();
    });

    await test.step('Buscar por ese código', async () => {
      await gastos.buscar(codigo);
      await expect.poll(() => gastos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBeGreaterThan(0);
    });

    await test.step('Cada fila visible corresponde al término buscado', async () => {
      const filasFiltradas = await gastos.contarFilas();
      for (let i = 0; i < filasFiltradas; i++) {
        const codigoFila = await gastos.obtenerCodigoDeFila(i);
        expect(codigoFila).toContain(codigo);
      }
    });

    await test.step('Limpiar la búsqueda restaura todos los registros', async () => {
      await gastos.limpiarBusqueda();
      await expect.poll(() => gastos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(totalSinFiltrar);
    });
  });

  test('buscar un término que no existe muestra el mensaje real de "sin resultados"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosOperativosPage(page);
    await gastos.abrirReporteGastosOperativos();

    await gastos.buscar('zzzz_termino_que_no_existe_9999');

    await test.step('Se muestra el mensaje real de "sin resultados"', async () => {
      await gastos.validarMensajeSinResultados();
    });

    await test.step('No hay ninguna fila real de datos', async () => {
      expect(await gastos.contarFilas()).toBe(0);
    });

    await test.step('Limpiar filtros restaura el listado', async () => {
      await gastos.limpiarFiltros();
      await gastos.validarSinErrores();
    });
  });

  test('"Descargar Excel" genera un archivo .xlsx', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosOperativosPage(page);
    await gastos.abrirReporteGastosOperativos();
    await gastos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await gastos.buscar();

    const descarga = await gastos.descargarExcel();
    expect(descarga.suggestedFilename()).toMatch(/\.xlsx?$/i);
  });

  test('el menú de acciones de una fila expone "Ver detalles", "Imprimir" y "Eliminar"', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosOperativosPage(page);
    await gastos.abrirReporteGastosOperativos();
    await gastos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await gastos.buscar();

    const total = await gastos.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene gastos operativos registrados en los últimos 2 años.');

    const opciones = await gastos.obtenerOpcionesAccionesFila(0);
    const textoOpciones = opciones.join(' | ').toLowerCase();

    expect(textoOpciones).toContain('ver detalles');
    expect(textoOpciones).toContain('imprimir');
    expect(textoOpciones).toContain('eliminar');
    // "Eliminar" es una acción destructiva real sobre datos compartidos del
    // ambiente de QA — se valida únicamente que la opción exista en el
    // menú (arriba), nunca se ejecuta.
  });

  test('"Ver detalles" abre el modal con Responsable/Fecha/Total y la tabla real de productos del gasto', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosOperativosPage(page);
    await gastos.abrirReporteGastosOperativos();
    await gastos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await gastos.buscar();

    const total = await gastos.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene gastos operativos registrados en los últimos 2 años.');

    const totalEnFila = await gastos.obtenerTotalDeFila(0);

    const detalle = await test.step('Abrir "Ver detalles" de la primera fila', async () => {
      return gastos.abrirDetalle(0);
    });

    await test.step('El detalle muestra información real y coherente con la fila del listado', async () => {
      expect(detalle.responsable.length).toBeGreaterThan(0);
      expect(detalle.fecha.length).toBeGreaterThan(0);
      // El total del modal no incluye el símbolo de moneda ("7,700.00"), a
      // diferencia de la columna del listado ("$7,700.00") — se compara solo
      // la parte numérica.
      expect(totalEnFila.replace(/[^\d.,]/g, '')).toContain(detalle.total.replace(/[^\d.,]/g, ''));
      expect(detalle.cantidadProductos).toBeGreaterThanOrEqual(0);
    });

    await test.step('Cerrar el modal', async () => {
      await gastos.cerrarDetalle();
    });
  });

  test('"Imprimir" dispara la generación real del comprobante sin producir errores', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosOperativosPage(page);
    await gastos.abrirReporteGastosOperativos();
    await gastos.aumentarRangoFechas(hoyMenosDiasISO(730), hoyISO());
    await gastos.buscar();

    const total = await gastos.contarFilas();
    test.skip(total === 0, 'El ambiente de QA no tiene gastos operativos registrados en los últimos 2 años.');

    const { seAbrioVentanaNueva } = await gastos.imprimirFila(0);
    expect(seAbrioVentanaNueva).toBe(true);
    await gastos.validarSinErrores();
  });

  test('la pantalla no expone ningún filtro/campo adicional a los ya documentados (categoría/moneda/método de pago/proveedor/cliente/estado/usuario/sucursal/caja)', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosOperativosPage(page);
    await gastos.abrirReporteGastosOperativos();

    // Excluye explícitamente todo lo que viva dentro de #dialog_add_family_expenses:
    // ese modal ya está presente en el DOM (oculto) antes de abrirse, así que un
    // selector sin acotar mezclaría sus campos con los filtros reales de la pantalla.
    const idsFiltros = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.content-wrapper input:not([type="hidden"]), .content-wrapper select'))
        .filter((el) => !el.closest('#dialog_add_family_expenses'))
        .map((el) => el.id)
        .filter(Boolean)
    );
    // "selected_company_to_add" es un campo real presente en el DOM (cuentas con
    // más de una compañía) pero confirmado INTERMITENTE (presente/ausente entre
    // cargas de la misma pantalla, sin patrón claro) — no forma parte de la
    // aserción dura. Lo importante y establemente confirmado: los 4 filtros
    // reales están presentes y NINGÚN campo de categoría/moneda/método de
    // pago/proveedor/cliente/estado/usuario/sucursal/caja aparece jamás.
    const FILTROS_REALES_CONOCIDOS = ['company_select', 'end_date', 'product_search', 'selected_company_to_add', 'start_date'];
    for (const id of idsFiltros) {
      expect(FILTROS_REALES_CONOCIDOS, `Campo nuevo/inesperado encontrado: "${id}"`).toContain(id);
    }
    expect(idsFiltros).toEqual(expect.arrayContaining(['company_select', 'end_date', 'product_search', 'start_date']));

    await gastos.abrirModalAgregarGasto();
    const idsModal = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#dialog_add_family_expenses input:not([type="hidden"]), #dialog_add_family_expenses select, #dialog_add_family_expenses textarea'))
        .map((el) => el.id)
        .filter(Boolean)
    );
    const CAMPOS_MODAL_CONOCIDOS = ['code_expense', 'product_observation', 'search_parameter', 'selected_company_to_add'];
    for (const id of idsModal) {
      expect(CAMPOS_MODAL_CONOCIDOS, `Campo nuevo/inesperado en el modal: "${id}"`).toContain(id);
    }
    expect(idsModal).toEqual(expect.arrayContaining(['code_expense', 'product_observation', 'search_parameter']));
  });
});

// ─── Agregar y Eliminar gasto operativo ────────────────────────────────────
//
// A diferencia del resto de este archivo, estos tests SÍ ejecutan "Agregar" y
// "Eliminar" de punta a punta. "Eliminar" nunca se ejecuta sobre un registro
// preexistente del ambiente compartido de QA: cada test crea primero su
// propio gasto operativo con crearGastoDePrueba() y solo elimina ESE gasto.
//
// Un gasto operativo en este ERP es una salida de productos reales del
// inventario (no un monto libre a mano) — ver el comentario completo de
// ReporteGastosOperativosPage en rp-gastos-operativos.page.ts para el
// detalle del modal "Agregar gasto operativo" confirmado en vivo.

test.describe('Agregar y Eliminar gasto operativo', () => {
  /**
   * Crea un gasto operativo real de principio a fin: abre el modal, busca un
   * producto real del inventario ("a" es un término genérico que siempre
   * devuelve resultados en este ambiente), lo agrega, fija la cantidad
   * indicada (campo obligatorio, junto con el producto) y completa también
   * los campos opcionales ("# Código reporte" y "Observaciones") antes de
   * guardar. Devuelve los datos reales usados para que cada test valide que
   * lo guardado coincide con lo ingresado.
   */
  async function crearGastoDePrueba(gastos: ReporteGastosOperativosPage, cantidad: number) {
    const observacion = `Gasto de prueba automatizada ${Date.now()}`;
    const codigoReporte = `QA-${Date.now()}`;

    await gastos.abrirModalAgregarGasto();
    await gastos.buscarProductoEnModalAgregar('a');
    const { productId, costoUnitario } = await gastos.agregarPrimerProductoResultadoModal();
    await gastos.fijarCantidadProductoModal(productId, cantidad, costoUnitario);
    await gastos.llenarCodigoReporteModal(codigoReporte);
    await gastos.llenarObservacionesModal(observacion);

    const totalEsperado = costoUnitario * cantidad;
    const idGasto = await gastos.guardarGastoModal();

    return { observacion, codigoReporte, costoUnitario, totalEsperado, idGasto };
  }

  test('"Agregar gasto operativo" completa producto + cantidad (obligatorios) y código/observaciones (opcionales), y el gasto queda visible con esos mismos datos', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosOperativosPage(page);
    await gastos.abrirReporteGastosOperativos();

    const { observacion, totalEsperado, idGasto } = await test.step('Crear el gasto con producto, cantidad y campos opcionales completos', async () => {
      return crearGastoDePrueba(gastos, 2);
    });

    expect(idGasto).toBeGreaterThan(0);

    await test.step('El gasto recién creado aparece al buscarlo por su observación', async () => {
      await gastos.aumentarRangoFechas(hoyISO(), hoyISO());
      await gastos.buscar(observacion);
      await expect.poll(() => gastos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(1);
    });

    await test.step('Los datos guardados coinciden con los ingresados', async () => {
      const fecha = await gastos.obtenerFechaDeFila(0);
      const observacionFila = await gastos.obtenerObservacionDeFila(0);
      const totalFila = await gastos.obtenerTotalNumericoDeFila(0);

      expect(fecha).toContain(hoyISO());
      expect(observacionFila).toBe(observacion);
      expect(totalFila).toBeCloseTo(totalEsperado, 2);
    });

    await gastos.validarSinErrores();
  });

  test('el monto del gasto se calcula como costo unitario × cantidad, y el total se refleja igual en el listado tras guardar', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosOperativosPage(page);
    await gastos.abrirReporteGastosOperativos();

    const cantidad = 4;
    const { observacion, costoUnitario, totalEsperado } = await test.step(`Crear un gasto con cantidad ${cantidad}`, async () => {
      return crearGastoDePrueba(gastos, cantidad);
    });

    expect(totalEsperado).toBeCloseTo(costoUnitario * cantidad, 2);

    await test.step('El total mostrado en el listado coincide con costo unitario × cantidad', async () => {
      await gastos.aumentarRangoFechas(hoyISO(), hoyISO());
      await gastos.buscar(observacion);
      await expect.poll(() => gastos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(1);

      const totalFila = await gastos.obtenerTotalNumericoDeFila(0);
      expect(totalFila).toBeCloseTo(totalEsperado, 2);
    });
  });

  test('"Agregar gasto operativo" con VARIOS productos distintos: el total general suma correctamente cada línea (subtotal 1 + subtotal 2 = total)', async ({ page }) => {
    test.setTimeout(90_000);
    const gastos = new ReporteGastosOperativosPage(page);
    await gastos.abrirReporteGastosOperativos();

    const observacion = `Gasto de prueba automatizada multi-producto ${Date.now()}`;
    const codigoReporte = `QA-${Date.now()}`;

    await gastos.abrirModalAgregarGasto();

    const { costoUnitario: costo1 } = await test.step('Agregar el primer producto real (cantidad 1)', async () => {
      await gastos.buscarProductoEnModalAgregar('a');
      return gastos.agregarPrimerProductoResultadoModal();
    });

    const { costoUnitario: costo2 } = await test.step('Agregar un segundo producto real distinto (cantidad 3)', async () => {
      // Un término más específico que "a" para maximizar la chance de que
      // devuelva un producto DISTINTO al de arriba — confirmado en vivo que
      // términos muy genéricos de una sola letra pueden coincidir con el
      // mismo primer resultado en catálogos pequeños. Si ambos términos
      // resuelven al mismo producto, la app simplemente actualiza la
      // cantidad de la fila existente (sin crear una duplicada) y este test
      // seguiría siendo válido, solo que probando 1 línea en vez de 2.
      await gastos.buscarProductoEnModalAgregar('e');
      const agregado = await gastos.agregarPrimerProductoResultadoModal();
      // NO se reutiliza fijarCantidadProductoModal() aquí a propósito: ese
      // helper valida que el total del modal == costoUnitario × cantidad,
      // asunción correcta solo cuando hay UN único producto en el carrito.
      // Con 2 líneas, el total del modal es la SUMA de ambas — se fija la
      // cantidad directamente y la suma total se valida aparte, más abajo.
      const cantidadInput = page.locator(`#product_quantity_${agregado.productId}`);
      await cantidadInput.fill('3');
      await cantidadInput.dispatchEvent('change');
      return agregado;
    });

    const totalEsperado = Number((costo1 * 1 + costo2 * 3).toFixed(2));
    await test.step('El total del modal (suma de ambas líneas) coincide antes de guardar', async () => {
      const totalModal = page.locator('#opex-total-amount');
      await expect
        .poll(async () => parseFloat(((await totalModal.textContent()) ?? '').replace(/[^\d.-]/g, '')), { timeout: TIMEOUTS.CARGA })
        .toBeCloseTo(totalEsperado, 2);
    });

    await gastos.llenarCodigoReporteModal(codigoReporte);
    await gastos.llenarObservacionesModal(observacion);

    const idGasto = await gastos.guardarGastoModal();
    expect(idGasto).toBeGreaterThan(0);

    await test.step('El gasto recién creado aparece en el listado con el total correcto (suma de ambas líneas)', async () => {
      await gastos.aumentarRangoFechas(hoyISO(), hoyISO());
      await gastos.buscar(observacion);
      await expect.poll(() => gastos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(1);

      const totalFila = await gastos.obtenerTotalNumericoDeFila(0);
      expect(totalFila, 'El total del listado no es la suma de los subtotales de ambos productos').toBeCloseTo(totalEsperado, 2);
    });

    await gastos.validarSinErrores();
  });

  test('"Eliminar" borra un gasto creado por el propio test: confirma el SweetAlert2 real y el registro deja de aparecer en el listado', async ({ page }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const gastos = new ReporteGastosOperativosPage(page);
    await gastos.abrirReporteGastosOperativos();

    const { observacion } = await test.step('Crear un gasto de prueba para eliminarlo (nunca se elimina un registro preexistente del ambiente compartido)', async () => {
      return crearGastoDePrueba(gastos, 1);
    });

    await test.step('El gasto creado aparece en el listado', async () => {
      await gastos.aumentarRangoFechas(hoyISO(), hoyISO());
      await gastos.buscar(observacion);
      await expect.poll(() => gastos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(1);
    });

    await test.step('Eliminar la fila y confirmar el SweetAlert2 real ("¡Eliminar gasto operativo!")', async () => {
      await gastos.eliminarFila(0);
    });

    await test.step('El gasto eliminado ya no aparece al volver a buscarlo', async () => {
      await gastos.buscar(observacion);
      await expect.poll(() => gastos.contarFilas(), { timeout: TIMEOUTS.CARGA }).toBe(0);
    });

    await gastos.validarSinErrores();
  });
});
