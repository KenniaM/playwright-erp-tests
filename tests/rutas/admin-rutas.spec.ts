import { test, expect } from '@playwright/test';
import { RutasPage, TIMEOUTS } from './rutas.page';

test('Carga del módulo Admin. Rutas', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const rutas = new RutasPage(page);

  await test.step('Navegar al módulo Admin. Rutas', async () => {
    await rutas.irARutas();
  });

  await test.step('Esperar a que la tabla de rutas termine de cargar (AJAX)', async () => {
    await rutas.esperarFilasCargadas();
  });

  await test.step('Validar título, buscador y botón "Agregar Nueva Ruta"', async () => {
    await expect(page.locator('body')).toContainText(/administrar rutas/i);
    await expect(rutas.buscador).toBeVisible();
    await expect(rutas.botonBuscar).toBeVisible();
    await expect(rutas.botonAgregar).toBeVisible();
  });

  await test.step('Validar que el listado tiene al menos una ruta', async () => {
    const cantidad = await rutas.filasRutas.count();
    expect(cantidad, 'El listado de rutas está vacío').toBeGreaterThan(0);
  });

  await test.step('Validar que no queda ningún mensaje de error visible', async () => {
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});

test('CP-129: Crear una nueva ruta', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const rutas = new RutasPage(page);
  const nombreRuta = `Ruta QA CP129 ${Date.now()}`;
  let zonaSeleccionada = '';

  await test.step('Navegar al módulo Admin. Rutas', async () => {
    await rutas.irARutas();
    await rutas.esperarFilasCargadas();
  });

  await test.step('Abrir el formulario "Agregar Nueva Ruta"', async () => {
    await rutas.abrirFormularioAgregar();
  });

  await test.step('Completar nombre y zona, y guardar', async () => {
    zonaSeleccionada = await rutas.crearRuta(nombreRuta);
    expect(zonaSeleccionada, 'No se pudo seleccionar una zona en el formulario').not.toBe('');
  });

  await test.step('Validar que el modal se cerró tras guardar', async () => {
    await expect(rutas.modalAgregar).toBeHidden();
  });

  await test.step('Recargar y buscar la ruta creada', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await rutas.esperarFilasCargadas();
    await rutas.buscarRuta(nombreRuta);
  });

  await test.step('Validar que la nueva ruta aparece en el listado', async () => {
    await expect(rutas.filaRuta(nombreRuta)).toBeVisible();
  });
});

test('CP-130: Validar que el formulario rechaza nombre de ruta vacío', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const rutas = new RutasPage(page);
  let rutasAntes = 0;

  await test.step('Navegar al módulo Admin. Rutas', async () => {
    await rutas.irARutas();
    await rutas.esperarFilasCargadas();
  });

  await test.step('Registrar la cantidad de rutas antes del intento', async () => {
    rutasAntes = await rutas.filasRutas.count();
  });

  await test.step('Abrir el formulario y dejar el nombre vacío', async () => {
    await rutas.abrirFormularioAgregar();
    await rutas.intentarGuardarConNombreVacio();
  });

  await test.step('Validar que el modal no se cierra con nombre vacío', async () => {
    await expect(rutas.modalAgregar).toBeVisible();
  });

  await test.step('Cerrar el formulario sin guardar', async () => {
    await rutas.cancelarFormularioAgregar();
    await expect(rutas.modalAgregar).toBeHidden();
  });

  await test.step('Validar que no se creó ninguna ruta nueva', async () => {
    await expect(rutas.filasRutas).toHaveCount(rutasAntes);
  });
});

test('CP-131: Buscador de rutas por nombre', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const rutas = new RutasPage(page);
  const TERMINO_INEXISTENTE = `ZZZ-No-Existe-${Date.now()}`;
  let totalInicial = 0;
  let terminoExistente = '';

  await test.step('Navegar al módulo Admin. Rutas', async () => {
    await rutas.irARutas();
    await rutas.esperarFilasCargadas();
  });

  await test.step('Registrar el listado sin filtrar y tomar una ruta existente', async () => {
    totalInicial = await rutas.filasRutas.count();
    expect(totalInicial, 'No hay rutas para probar la búsqueda').toBeGreaterThan(0);

    // Se toma el nombre de una ruta real del listado en vez de asumir un
    // nombre fijo ("RUTA 3"), ya que el set de datos varía según el ambiente.
    const [primerNombre] = await rutas.nombresRutasLimpios();
    terminoExistente = primerNombre;
  });

  await test.step('Buscar una ruta existente y validar que filtra', async () => {
    await rutas.buscarRuta(terminoExistente);
    await expect.poll(() => rutas.filasRutas.count(), { timeout: TIMEOUTS.TABLE_LOAD }).toBeGreaterThan(0);

    const nombres = await rutas.nombresRutasLimpios();
    const regex = new RegExp(terminoExistente.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    expect(
      nombres.every((n) => regex.test(n)),
      `Se esperaba que todas las rutas contuvieran "${terminoExistente}": ${JSON.stringify(nombres)}`,
    ).toBe(true);
  });

  await test.step('Buscar un término inexistente y validar que no hay resultados', async () => {
    await rutas.buscarRuta(TERMINO_INEXISTENTE);
    await expect(rutas.filasRutas).toHaveCount(0, { timeout: TIMEOUTS.TABLE_LOAD });
  });

  await test.step('Limpiar la búsqueda y validar que el listado se restaura', async () => {
    await rutas.buscarRuta('');
    await expect(rutas.filasRutas).toHaveCount(totalInicial, { timeout: TIMEOUTS.TABLE_LOAD });
  });
});

test('CP-132: Asignar cliente a una ruta', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const rutas = new RutasPage(page);
  const nombreRuta = `Ruta QA CP132 ${Date.now()}`;
  let clientesAntes: number | null = null;
  let clienteAgregado = '';

  await test.step('Crear una ruta nueva y aislada para la prueba', async () => {
    await rutas.irARutas();
    await rutas.esperarFilasCargadas();
    await rutas.abrirFormularioAgregar();
    await rutas.crearRuta(nombreRuta);
    await expect(rutas.modalAgregar).toBeHidden();
  });

  await test.step('Buscar la ruta creada y registrar los clientes vinculados', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await rutas.esperarFilasCargadas();
    await rutas.buscarRuta(nombreRuta);
    await expect(rutas.filaRuta(nombreRuta)).toBeVisible();

    clientesAntes = await rutas.clientesDeRuta(nombreRuta);
    expect(clientesAntes, 'No se pudo leer el contador de clientes de la ruta recién creada').not.toBeNull();
    expect(clientesAntes, 'La ruta recién creada no debería tener clientes vinculados').toBe(0);
  });

  await test.step('Abrir "Asignar clientes" desde el menú de acciones de la ruta', async () => {
    await rutas.abrirModalAsignarClientes(nombreRuta);
  });

  await test.step('Agregar el primer cliente seleccionable', async () => {
    clienteAgregado = await rutas.agregarPrimerClienteDisponible();
    expect(clienteAgregado, 'No se encontró ningún cliente seleccionable en el modal').not.toBe('');
  });

  await test.step('Validar que el cliente aparece en el panel de clientes vinculados', async () => {
    await expect(rutas.tbodyClientesVinculados).toContainText(clienteAgregado, { timeout: TIMEOUTS.TABLE_LOAD });
  });

  await test.step('Cerrar el modal de asignación', async () => {
    await rutas.cerrarModalAsignarClientes();
    await expect(rutas.modalAsignarClientes).toBeHidden();
  });

  await test.step('Recargar y validar que el contador de clientes incrementó', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await rutas.esperarFilasCargadas();
    await rutas.buscarRuta(nombreRuta);
    await expect(rutas.filaRuta(nombreRuta)).toBeVisible();

    await expect
      .poll(() => rutas.clientesDeRuta(nombreRuta), { timeout: TIMEOUTS.TABLE_LOAD })
      .toBe((clientesAntes ?? 0) + 1);
  });
});

test('CP-133: Asignar repartidor a una ruta', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const rutas = new RutasPage(page);
  const nombreRuta = `Ruta QA CP133 ${Date.now()}`;
  let repartidoresAntes: number | null = null;
  let repartidorAgregado = '';

  await test.step('Crear una ruta nueva y aislada para la prueba', async () => {
    await rutas.irARutas();
    await rutas.esperarFilasCargadas();
    await rutas.abrirFormularioAgregar();
    await rutas.crearRuta(nombreRuta);
    await expect(rutas.modalAgregar).toBeHidden();
  });

  await test.step('Buscar la ruta creada y registrar los repartidores vinculados', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await rutas.esperarFilasCargadas();
    await rutas.buscarRuta(nombreRuta);
    await expect(rutas.filaRuta(nombreRuta)).toBeVisible();

    repartidoresAntes = await rutas.repartidoresDeRuta(nombreRuta);
    expect(repartidoresAntes, 'No se pudo leer el contador de repartidores de la ruta recién creada').not.toBeNull();
    expect(repartidoresAntes, 'La ruta recién creada no debería tener repartidores vinculados').toBe(0);
  });

  await test.step('Abrir "Asignar repartidores" desde el menú de acciones de la ruta', async () => {
    await rutas.abrirModalAsignarRepartidores(nombreRuta);
  });

  await test.step('Agregar el primer repartidor seleccionable', async () => {
    repartidorAgregado = await rutas.agregarPrimerRepartidorDisponible();
    expect(repartidorAgregado, 'No se encontró ningún repartidor seleccionable en el modal').not.toBe('');
  });

  await test.step('Validar que el repartidor aparece en el panel de repartidores vinculados', async () => {
    await expect(rutas.tbodyRepartidoresVinculados).toContainText(repartidorAgregado, { timeout: TIMEOUTS.TABLE_LOAD });
  });

  await test.step('Cerrar el modal de asignación', async () => {
    await rutas.cerrarModalAsignarRepartidores();
    await expect(rutas.modalAsignarRepartidores).toBeHidden();
  });

  await test.step('Recargar y validar que el contador de repartidores incrementó', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await rutas.esperarFilasCargadas();
    await rutas.buscarRuta(nombreRuta);
    await expect(rutas.filaRuta(nombreRuta)).toBeVisible();

    await expect
      .poll(() => rutas.repartidoresDeRuta(nombreRuta), { timeout: TIMEOUTS.TABLE_LOAD })
      .toBe((repartidoresAntes ?? 0) + 1);
  });
});

test('CP-135: Editar una ruta existente', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const rutas = new RutasPage(page);
  const nombreOriginal = `Ruta QA CP135 ${Date.now()}`;
  const nombreEditado = `${nombreOriginal} EDITADA`;

  await test.step('Crear una ruta nueva y aislada para la prueba', async () => {
    await rutas.irARutas();
    await rutas.esperarFilasCargadas();
    await rutas.abrirFormularioAgregar();
    await rutas.crearRuta(nombreOriginal);
    await expect(rutas.modalAgregar).toBeHidden();
  });

  await test.step('Buscar la ruta creada', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await rutas.esperarFilasCargadas();
    await rutas.buscarRuta(nombreOriginal);
    await expect(rutas.filaRuta(nombreOriginal)).toBeVisible();
  });

  await test.step('Editar el nombre de la ruta en línea y guardar', async () => {
    await rutas.editarNombreRuta(nombreOriginal, nombreEditado);
  });

  await test.step('Recargar y validar que la ruta aparece con el nombre editado', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await rutas.esperarFilasCargadas();
    await rutas.buscarRuta(nombreEditado);
    await expect(rutas.filaRuta(nombreEditado)).toBeVisible();
  });

  await test.step('Validar que ya no existe una ruta con el nombre original', async () => {
    // El nombre editado contiene el nombre original como prefijo, así que la
    // búsqueda por sustring devolvería ambos — se valida por coincidencia
    // EXACTA del nombre real de cada fila en vez de "contiene".
    await rutas.buscarRuta(nombreOriginal);
    const nombres = await rutas.nombresRutasLimpios();
    expect(
      nombres,
      `No debería quedar ninguna ruta con el nombre original exacto: ${JSON.stringify(nombres)}`,
    ).not.toContain(nombreOriginal);
  });
});

test('CP-136: Eliminar una ruta existente', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const rutas = new RutasPage(page);
  // Nombre único de esta corrida — la ruta que se elimina es SIEMPRE la
  // creada por este mismo test, nunca una ruta de otro CP o de datos reales
  // (acción destructiva sin deshacer).
  const nombreRuta = `Ruta QA CP136 DESCARTABLE ${Date.now()}`;

  await test.step('Crear una ruta nueva exclusiva para esta prueba', async () => {
    await rutas.irARutas();
    await rutas.esperarFilasCargadas();
    await rutas.abrirFormularioAgregar();
    await rutas.crearRuta(nombreRuta);
    await expect(rutas.modalAgregar).toBeHidden();
  });

  await test.step('Confirmar que la ruta existe antes de eliminar', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await rutas.esperarFilasCargadas();
    await rutas.buscarRuta(nombreRuta);
    await expect(rutas.filaRuta(nombreRuta)).toBeVisible();
  });

  await test.step('Eliminar la ruta y confirmar el diálogo', async () => {
    const [respuestaEliminar] = await Promise.all([
      page.waitForResponse((resp) => resp.request().method() === 'POST' && /deleteRoute/i.test(resp.url())),
      rutas.eliminarRuta(nombreRuta),
    ]);
    expect(respuestaEliminar.status(), 'La petición para eliminar la ruta no respondió 200').toBe(200);
  });

  await test.step('Recargar y validar que la ruta ya no aparece en el listado', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await rutas.esperarFilasCargadas();
    await rutas.buscarRuta(nombreRuta);
    await expect(rutas.filaRuta(nombreRuta)).toHaveCount(0, { timeout: TIMEOUTS.TABLE_LOAD });
  });
});
