import { test, expect, Page } from '@playwright/test';
import { ContabilidadPage } from './contabilidad.page';
import {
  ContabilidadMesFiscalPage,
  TIMEOUTS,
  URL_MES_FISCAL,
  MESES_GENERADOS_ESPERADOS,
} from './contabilidad-mes-fiscal.page';
// Reutilización cruzada de módulos ya confirmada en el repo (mismo criterio
// que recepcion.page.ts importando espiarErroresJS/esperarQuedaActivo desde
// pos.page.ts): espiarErroresJS no depende de nada propio de POS, solo de un
// Page, así que se importa tal cual en vez de duplicarla.
import { espiarErroresJS } from '../facturar/pos/pos.utils';

// Compañías reales de la cuenta Super Administrador (TALLER ALPHA PREMIUM),
// confirmadas en vivo desde el propio <select id="company_select"> de esta
// pantalla — nunca un id numérico (ver CLAUDE.md, "no hardcodear ids").
// Nombre con doble espacio real entre "ALPHA" y "PREMIUM", mismo hallazgo ya
// documentado en super-admin.setup.ts para esta misma cuenta.
const COMPANIA_CON_DATOS = 'TALLER ALPHA  PREMIUM';
// Compañía sugerida por el usuario para los escenarios de consulta/creación
// — confirmada en vivo sin período fiscal 2026 registrado al iniciar esta
// investigación (por eso es apta para los escenarios "Caso A"/creación).
const COMPANIA_SIN_DATOS = 'COMPAÑIA DE INDUCCIÓN';
const ANIO_BASE = 2026;

type Fixtures = { sharedPage: Page; mesFiscal: ContabilidadMesFiscalPage };

// Alias `base`/fixture worker: mismo patrón documentado en CLAUDE.md (ver
// pos-crear.spec.ts) — carga el submódulo una sola vez por worker en vez de
// una vez por test, sin `test.describe.configure({mode:'serial'})` (entraría
// en conflicto con `fullyParallel`); el aislamiento real lo da que cada
// worker es su propio proceso.
const base = test;
const testX = base.extend<{}, Fixtures>({
  sharedPage: [async ({ browser }, use) => {
    const page = await browser.newPage();
    await use(page);
    await page.close();
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  mesFiscal: [async ({ sharedPage }, use) => {
    const mesFiscal = new ContabilidadMesFiscalPage(new ContabilidadPage(sharedPage), sharedPage);
    await mesFiscal.irA();
    await use(mesFiscal);
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],
});

/** Sin `.noty_bar` de error visible (mismo patrón que contabilidad-navegacion.spec.ts) ni toast de error del sistema propio de Mes Fiscal. */
async function validarSinMensajesDeError(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  await expect(page.locator('.toast-error')).toHaveCount(0);
}

/** La sesión sigue autenticada: la URL final nunca redirigió a /log/login. */
function validarSesionAutenticada(page: Page) {
  expect(page.url(), 'La sesión expiró o redirigió a login inesperadamente').not.toContain('/log/login');
}

testX.describe('Contabilidad — Mes Fiscal', () => {
  testX.beforeEach(async ({ mesFiscal }) => {
    // Devolver la pantalla a un estado conocido antes de cada test —
    // recarga el submódulo (equivalente a "Actualizar" desde cero).
    await mesFiscal.irA();
  });

  testX('1. Consulta de períodos fiscales: seleccionar compañía y año fiscal 2026 o posterior', async ({ mesFiscal, sharedPage }) => {
    testX.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await test.step('Validar URL y encabezado del submódulo', async () => {
      expect(sharedPage.url()).toContain('acfiscalmonth/ac_fiscal_month');
      await expect(mesFiscal.encabezado).toBeVisible();
    });

    await test.step(`Seleccionar la compañía "${COMPANIA_SIN_DATOS}"`, async () => {
      await mesFiscal.seleccionarCompania(COMPANIA_SIN_DATOS);
      // No se valida contra un id numérico (ver CLAUDE.md): se confirma por
      // el nombre visible de la opción que quedó realmente seleccionada.
      await expect(mesFiscal.selectCompania.locator('option:checked')).toHaveText(COMPANIA_SIN_DATOS);
    });

    await test.step(`Seleccionar el año fiscal ${ANIO_BASE}`, async () => {
      await mesFiscal.seleccionarAnioFiscal(ANIO_BASE);
      await expect(mesFiscal.valorAnioFiscal).toHaveText(String(ANIO_BASE));
    });

    await test.step('Validar que el filtro se aplicó correctamente (título y subtítulo del listado)', async () => {
      await expect(mesFiscal.tituloListado).toContainText(`EJERCICIO ${ANIO_BASE}`);
      await expect(mesFiscal.tituloListado).toContainText('Meses Fiscales');
    });

    await validarSinMensajesDeError(sharedPage);
    validarSesionAutenticada(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  testX('2. Validación de registros: período sin datos (Caso A) y período con datos (Caso B)', async ({ mesFiscal, sharedPage }) => {
    testX.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await test.step(`Caso A: compañía "${COMPANIA_SIN_DATOS}" en un año fiscal sin meses registrados`, async () => {
      await mesFiscal.seleccionarCompania(COMPANIA_SIN_DATOS);
      const anioVacio = await mesFiscal.buscarAnioSinRegistros(ANIO_BASE);
      console.log(`[Escenario 2 - Caso A] Año sin registros encontrado: ${anioVacio}`);

      await expect(mesFiscal.estadoVacio).toBeVisible();
      await expect(mesFiscal.estadoVacio).toContainText('Sin meses fiscales');
      await expect(mesFiscal.estadoVacio).toContainText('No hay meses registrados para el período seleccionado.');
      expect(await mesFiscal.filasTabla.count()).toBe(0);
    });

    await test.step(`Caso B: compañía "${COMPANIA_CON_DATOS}" en el año fiscal ${ANIO_BASE} (con meses ya registrados)`, async () => {
      await mesFiscal.seleccionarCompania(COMPANIA_CON_DATOS);
      await mesFiscal.seleccionarAnioFiscal(ANIO_BASE);

      await expect(mesFiscal.estadoVacio).toBeHidden();
      const filas = await mesFiscal.filasTabla.count();
      expect(filas, 'Se esperaba al menos un mes fiscal ya registrado para esta compañía/año').toBeGreaterThan(0);

      const primeraFila = await mesFiscal.obtenerFilaComoObjeto(mesFiscal.filasTabla.first());
      expect(primeraFila.mes).not.toBe('');
      expect(primeraFila.periodo).toContain(String(ANIO_BASE));
    });

    await validarSinMensajesDeError(sharedPage);
    validarSesionAutenticada(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  testX('3. Validación de columnas de la tabla (N°, Período, Mes, Inicio, Fin, Estado, Acciones)', async ({ mesFiscal, sharedPage }) => {
    testX.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await mesFiscal.seleccionarCompania(COMPANIA_CON_DATOS);
    await mesFiscal.seleccionarAnioFiscal(ANIO_BASE);

    await test.step('Validar que las 7 columnas esperadas son visibles en el encabezado', async () => {
      const textos = await mesFiscal.encabezadosTabla.allInnerTexts();
      const columnasEsperadas: RegExp[] = [/^N°/i, /per[ií]odo/i, /^mes/i, /^inicio/i, /^fin/i, /^estado/i, /^acciones/i];
      expect(textos, `Encabezados reales: ${JSON.stringify(textos)}`).toHaveLength(columnasEsperadas.length);
      columnasEsperadas.forEach((regex, i) => {
        expect(textos[i], `Columna #${i} no coincide con ${regex}`).toMatch(regex);
      });
      for (const columna of columnasEsperadas) {
        await expect(mesFiscal.encabezadosTabla.filter({ hasText: columna }).first()).toBeVisible();
      }
    });

    await test.step('Validar que cada fila visible tiene información consistente en las 7 columnas', async () => {
      const filas = await mesFiscal.filasTabla.all();
      expect(filas.length).toBeGreaterThan(0);
      for (const fila of filas) {
        const datos = await mesFiscal.obtenerFilaComoObjeto(fila);
        expect(datos.numero, 'N° vacío').not.toBe('');
        expect(datos.periodo, 'Período vacío').toContain(String(ANIO_BASE));
        expect(datos.mes, 'Mes vacío').not.toBe('');
        expect(datos.inicio, 'Fecha de inicio vacía').toMatch(/^\d{2}-\d{2}-\d{4}$/);
        expect(datos.fin, 'Fecha final vacía').toMatch(/^\d{2}-\d{2}-\d{4}$/);
        expect(datos.estado, 'Estado vacío').not.toBe('');
        await expect(fila.locator('.fm-action-menu button').first(), 'La fila no expone el menú de Acciones').toBeVisible();
      }
    });

    await validarSinMensajesDeError(sharedPage);
    validarSesionAutenticada(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  testX('4. Validación de los filtros de estado (Todos / Abiertos / Cerrados)', async ({ mesFiscal, sharedPage }) => {
    testX.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await mesFiscal.seleccionarCompania(COMPANIA_CON_DATOS);
    await mesFiscal.seleccionarAnioFiscal(ANIO_BASE);

    let totalTodos = 0;

    await test.step('Filtro "Todos": muestra todos los meses fiscales del año', async () => {
      await mesFiscal.filtrarPorEstado('todos');
      totalTodos = await mesFiscal.filasTabla.count();
      expect(totalTodos).toBeGreaterThan(0);
    });

    await test.step('Filtro "Abiertos": el contenido de la tabla cambia según el filtro', async () => {
      await mesFiscal.filtrarPorEstado('abierto');
      const filasAbiertas = await mesFiscal.filasTabla.count();
      expect(filasAbiertas).toBeGreaterThan(0);
      for (const fila of await mesFiscal.filasTabla.all()) {
        await expect(fila, 'Con el filtro "Abiertos" activo apareció una fila que no está Abierta').toHaveAttribute('data-fm-status', 'abierto');
      }
    });

    await test.step('Filtro "Cerrados": sin meses cerrados en este año recién generado, se muestra el estado vacío', async () => {
      await mesFiscal.filtrarPorEstado('cerrado');
      // Hallazgo confirmado en vivo: el mismo widget de estado vacío
      // (#fmEmptyState, "Sin meses fiscales") se reutiliza tanto para
      // "sin registros para el período" como para "sin resultados tras
      // aplicar el filtro de estado" — no es un mensaje distinto por caso.
      await expect(mesFiscal.estadoVacio).toBeVisible();
      expect(await mesFiscal.filasTabla.count()).toBe(0);
    });

    await test.step('Volver a "Todos": el contenido se restaura por completo', async () => {
      await mesFiscal.filtrarPorEstado('todos');
      expect(await mesFiscal.filasTabla.count()).toBe(totalTodos);
    });

    await validarSinMensajesDeError(sharedPage);
    validarSesionAutenticada(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  testX('5. Crear un nuevo Mes Fiscal: el formulario carga con los valores por defecto correctos', async ({ mesFiscal, sharedPage }) => {
    testX.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await mesFiscal.seleccionarCompania(COMPANIA_SIN_DATOS);
    const anioVacio = await mesFiscal.buscarAnioSinRegistros(ANIO_BASE);
    console.log(`[Escenario 5] Año sin registros usado para el formulario: ${anioVacio}`);

    await test.step('Abrir "Agregar mes fiscal" y validar que el formulario carga correctamente', async () => {
      await mesFiscal.abrirModalAgregar();
      await expect(mesFiscal.modalAgregar).toBeVisible();
    });

    await test.step('Validar los valores por defecto: Año Fiscal, Mes = Enero, Nombre, fechas y nota informativa', async () => {
      const valores = await mesFiscal.obtenerValoresPorDefectoModal();

      expect(valores.anioFiscal, 'El Año Fiscal del modal no coincide con el seleccionado previamente').toBe(String(anioVacio));
      expect(valores.mes, 'El Mes por defecto no es Enero (valor "1")').toBe('1');
      expect(valores.nombre, 'El nombre del mes fiscal no sigue el patrón "Enero <Año Fiscal>"').toBe(`Enero ${anioVacio}`);
      expect(valores.fechaInicio, 'La fecha inicial por defecto no es el 1 de enero del año fiscal').toBe(`${anioVacio}-01-01`);
      expect(valores.fechaFin, 'La fecha final por defecto no es el 31 de enero del año fiscal').toBe(`${anioVacio}-01-31`);
      expect(valores.esCierre, 'El checkbox "Es mes de cierre fiscal" no debería iniciar marcado').toBe(false);
      expect(valores.nota, 'El mensaje informativo del modal no es el esperado').toContain('se crearán automáticamente los meses de enero a diciembre y el mes de cierre fiscal');
      expect(valores.nota).toContain('Todos se crearán abiertos');
    });

    await test.step('Cancelar sin guardar (no persistir: Escenario 6 hace la creación real)', async () => {
      await mesFiscal.cancelarModalAgregar();
      await expect(mesFiscal.estadoVacio).toBeVisible();
    });

    await validarSinMensajesDeError(sharedPage);
    validarSesionAutenticada(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  testX('6. Generación automática de los 12 meses + mes de cierre al guardar', async ({ mesFiscal, sharedPage }) => {
    testX.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await mesFiscal.seleccionarCompania(COMPANIA_SIN_DATOS);
    const anio = await mesFiscal.buscarAnioSinRegistros(ANIO_BASE);
    console.log(`[Escenario 6] Año fiscal generado: ${anio}`);

    await mesFiscal.abrirModalAgregar();

    let respuesta: Awaited<ReturnType<typeof mesFiscal.guardarMes>>;
    await test.step('Guardar el formulario con los valores por defecto', async () => {
      respuesta = await mesFiscal.guardarMes();
      expect(respuesta.status, `Respuesta real del servidor: ${JSON.stringify(respuesta)}`).toBe('OK');
      expect(respuesta.created_months).toBe(13);
    });

    await test.step('Validar el mensaje informativo de éxito', async () => {
      await expect(mesFiscal.toastExito).toBeVisible({ timeout: TIMEOUTS.CARGA });
      await expect(mesFiscal.toastExito).toContainText('Año fiscal procesado correctamente');
    });

    await test.step('Validar que se generaron los 12 meses + el mes de cierre fiscal, todos Abiertos y sin duplicados', async () => {
      const filas = await mesFiscal.filasTabla.all();
      expect(filas.length).toBe(13);

      const datos = await Promise.all(filas.map((f) => mesFiscal.obtenerFilaComoObjeto(f)));
      const nombresMes = datos.map((d) => d.mes.replace(/\s*cierre\s*$/i, '').trim());

      // Los 12 meses calendario están presentes y sin duplicados.
      for (const mesEsperado of MESES_GENERADOS_ESPERADOS) {
        const apariciones = nombresMes.filter((m) => m === mesEsperado).length;
        expect(apariciones, `El mes "${mesEsperado}" no apareció exactamente una vez (apareció ${apariciones} veces)`).toBe(1);
      }
      // El mes 13 es el mes de cierre fiscal.
      expect(nombresMes.filter((m) => m.includes('CIERRE')).length, 'No se generó (o se duplicó) el mes de cierre fiscal').toBe(1);

      // Todos pertenecen al año fiscal seleccionado y quedan Abiertos.
      for (const fila of datos) {
        expect(fila.periodo, `Período inconsistente en la fila del mes "${fila.mes}"`).toBe(`EJERCICIO ${anio}`);
        expect(fila.estado, `Estado inconsistente en la fila del mes "${fila.mes}"`).toBe('Abierto');
      }

      // Orden cronológico: los 12 meses calendario aparecen en el orden
      // Enero..Diciembre y el mes de Cierre queda al final.
      const ordenReal = nombresMes.slice(0, 12);
      expect(ordenReal, 'El orden cronológico de los meses generados no es Enero..Diciembre').toEqual([...MESES_GENERADOS_ESPERADOS]);
      expect(nombresMes[12], 'El mes de cierre fiscal no quedó como el último registro').toContain('CIERRE');
    });

    await validarSinMensajesDeError(sharedPage);
    validarSesionAutenticada(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  testX('7. Editar, cerrar y eliminar un mes fiscal desde el menú de acciones de la fila', async ({ mesFiscal, sharedPage }) => {
    testX.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    await mesFiscal.seleccionarCompania(COMPANIA_SIN_DATOS);
    const anio = await mesFiscal.buscarAnioSinRegistros(ANIO_BASE);
    console.log(`[Escenario 7] Año fiscal usado: ${anio}`);
    await mesFiscal.abrirModalAgregar();
    await mesFiscal.guardarMes();

    const filaEnero = mesFiscal.filasTabla.nth(0);
    const filaFebrero = mesFiscal.filasTabla.nth(1);
    const filaMarzo = mesFiscal.filasTabla.nth(2);
    const nombreEditado = `ENERO ${anio} EDITADO`;

    await test.step('Editar: el modal reutiliza el formulario, precarga los datos reales de la fila y actualiza el nombre', async () => {
      const original = await mesFiscal.obtenerFilaComoObjeto(filaEnero);

      await mesFiscal.abrirModalEditar(filaEnero);
      await expect(mesFiscal.campoIdModal).not.toHaveValue('0');
      expect(await mesFiscal.campoMesModal.inputValue()).toBe('1');
      expect(await mesFiscal.campoNombreModal.inputValue()).toBe(original.mes);

      await mesFiscal.campoNombreModal.fill(nombreEditado);
      const respuesta = await mesFiscal.actualizarMes();
      expect(respuesta.status, `Respuesta real: ${JSON.stringify(respuesta)}`).toBe('OK');
      expect(respuesta.message).toContain('actualizado correctamente');

      await sharedPage.screenshot({ path: 'test-results/evidencia-mes-fiscal-editar.png', fullPage: true });
      await expect(filaEnero.locator('.fm-month-name')).toHaveText(nombreEditado);
    });

    await test.step('Cerrar: pide confirmación (SweetAlert2) y el estado de la fila cambia a "Cerrado"', async () => {
      const respuesta = await mesFiscal.cerrarMes(filaFebrero);
      expect(respuesta.status, `Respuesta real: ${JSON.stringify(respuesta)}`).toBe('OK');
      expect(respuesta.message).toContain('cerrado correctamente');

      await sharedPage.screenshot({ path: 'test-results/evidencia-mes-fiscal-cerrar.png', fullPage: true });
      const filaTrasCerrar = await mesFiscal.obtenerFilaComoObjeto(filaFebrero);
      expect(filaTrasCerrar.estado).toBe('Cerrado');
      await expect(filaFebrero).toHaveAttribute('data-fm-status', 'cerrado');
    });

    await test.step('El filtro "Cerrados" ahora sí muestra el mes recién cerrado (cruce con Escenario 4)', async () => {
      await mesFiscal.filtrarPorEstado('cerrado');
      expect(await mesFiscal.filasTabla.count()).toBe(1);
      await expect(mesFiscal.filasTabla.first().locator('.fm-month-name')).toHaveText('FEBRERO');
      await mesFiscal.filtrarPorEstado('todos');
    });

    await test.step('Eliminar: pide confirmación (SweetAlert2) y la fila desaparece de la tabla', async () => {
      const filasAntes = await mesFiscal.filasTabla.count();

      const respuesta = await mesFiscal.eliminarMes(filaMarzo);
      expect(respuesta.result).toBe(1);
      expect(respuesta.message).toContain('eliminado correctamente');

      await sharedPage.screenshot({ path: 'test-results/evidencia-mes-fiscal-eliminar.png', fullPage: true });
      await expect.poll(() => mesFiscal.filasTabla.count(), { timeout: TIMEOUTS.CARGA }).toBe(filasAntes - 1);
      await expect(mesFiscal.filasTabla.filter({ hasText: 'MARZO' })).toHaveCount(0);
    });

    await validarSinMensajesDeError(sharedPage);
    validarSesionAutenticada(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});
