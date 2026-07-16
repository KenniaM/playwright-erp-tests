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
//   - "Eliminar" (menú de la fila) es una acción destructiva real: solo se
//     valida que exista en el menú, nunca se ejecuta.
//   - "Agregar" (crear un gasto nuevo) es una acción de escritura fuera del
//     alcance de este reporte: no se prueba.

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
});
