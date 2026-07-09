import { test, expect, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, CABYS_BUSQUEDA, CABYS_BUSQUEDA_SIN_IVA, PRECIO_PRODUCTO_RAPIDO, LineaCarrito } from './pos.page';

// Precios base para las pruebas de "Crear Producto" — arbitrarios pero
// consistentes entre escenarios, igual que PRECIO_PRODUCTO_RAPIDO para
// Producto Rápido.
const PRODUCTO_COSTO = '1000';
const PRODUCTO_PRECIO_VENTA = '2000';
const PRODUCTO_CANTIDAD = '10';
const PRODUCTO_PRECIO_CAJA = '9000';
const PRODUCTO_CANTIDAD_CAJA = '12';
const PRODUCTO_FRACCIONES_POR_UNIDAD = '10';
const PRODUCTO_PRECIO_FRACCION = '850';

test('agregar producto rápido con IVA en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  let clavesAntes: string[] = [];
  await test.step('Abrir "Producto Rápido" y llenar nombre y precio', async () => {
    clavesAntes = await pos.obtenerClavesProductos();
    await pos.abrirProductoRapido();
    await pos.llenarDatosBasicosProductoRapido(`Producto Rápido IVA ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
  });

  let cabysAplicado = false;
  await test.step('Detectar si aparece CABYS: si aparece, completarlo obligatoriamente; si no, continuar sin él', async () => {
    cabysAplicado = await pos.manejarCabysSiAplica(CABYS_BUSQUEDA);
    console.log(`[agregar producto rápido con IVA en POS] cabysAplicado=${cabysAplicado}`);
  });

  await test.step('Seleccionar un IVA válido según la regla: si hubo CABYS, debe coincidir con el que él define; si no, se puede elegir cualquiera', async () => {
    if (cabysAplicado) {
      await pos.esperarIvaAutocompletado();
      await pos.validarIvaCoincideConCabys();
      console.log('[agregar producto rápido con IVA en POS] validarIvaCoincideConCabys() PASÓ: la tasa seleccionada coincide con la del CABYS');
    } else {
      // Confirmado en vivo que sí ocurre: la visibilidad de CABYS depende
      // del país configurado para la compañía (server-side), no es fija —
      // ver el comentario de seleccionarIvaManualmente() en pos.page.ts.
      await pos.seleccionarIvaManualmente();
    }
  });

  let clave = '';
  await test.step('Confirmar creación del producto y validar carrito + red + toast', async () => {
    const respuesta = await pos.guardarProductoRapidoYObtenerRespuesta();
    expect(respuesta.ok(), `La petición a getPosProductSaleItem no respondió OK (status ${respuesta.status()})`).toBe(true);

    await expect(pos.modalProductoRapido).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await expect.poll(async () => (await pos.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntes.length);
    const clavesDespues = await pos.obtenerClavesProductos();
    clave = clavesDespues.find(c => !clavesAntes.includes(c))!;
    await expect(page.locator('.noty_bar', { hasText: 'Producto agregado' })).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  });

  await test.step('Fijar el carrito para mostrar totales con IVA y validar que el IVA de la línea se calculó correctamente', async () => {
    await pos.establecerMostrarPrecioConIva(true, [clave]);
    const linea = await pos.validarLineaCarrito(clave, true);
    await pos.validarResumenImpuestos([linea]);
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

test('agregar producto rápido sin IVA en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  let clavesAntes: string[] = [];
  await test.step('Abrir "Producto Rápido" y llenar nombre y precio', async () => {
    clavesAntes = await pos.obtenerClavesProductos();
    await pos.abrirProductoRapido();
    await pos.llenarDatosBasicosProductoRapido(`Producto Rápido sin IVA ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
  });

  let cabysAplicado = false;
  await test.step('Detectar si aparece CABYS: si aparece, completarlo obligatoriamente; si no, continuar sin él', async () => {
    // Mismo CABYS obligatorio que el resto de la suite exige, pero con un
    // término de búsqueda cuyo resultado trae tasa "0% (Exento)" — en un
    // ambiente donde el CABYS es obligatorio, esa es la forma real de
    // representar "producto sin IVA", no dejar el campo vacío.
    cabysAplicado = await pos.manejarCabysSiAplica(CABYS_BUSQUEDA_SIN_IVA);
  });

  await test.step('Seleccionar explícitamente "sin IVA" (0% / Exento)', async () => {
    if (cabysAplicado) {
      await pos.esperarIvaAutocompletado();
      await pos.validarIvaCoincideConCabys();
    } else {
      // Sin CABYS, el checkbox de IVA queda sin marcar por defecto —
      // "sin IVA" es simplemente no tocarlo.
    }
  });

  await test.step('Confirmar creación del producto y validar comportamiento consistente en UI y red', async () => {
    const respuesta = await pos.guardarProductoRapidoYObtenerRespuesta();
    expect(respuesta.ok(), `La petición a getPosProductSaleItem no respondió OK (status ${respuesta.status()})`).toBe(true);

    await expect(pos.modalProductoRapido).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await expect.poll(async () => (await pos.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntes.length);
    await expect(page.locator('.noty_bar', { hasText: 'Producto agregado' })).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
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

test('validar cálculo de IVA en productos rápidos — IVA activado', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  // La expectativa de IVA de cada producto es la intención propia de este
  // test (true, se está pidiendo explícitamente con IVA) — no se deriva de
  // leer ningún checkbox del formulario. La verificación real contra lo que
  // el sistema efectivamente aplicó ocurre dentro de validarLineaCarrito(),
  // contra product_hide_apply_iva_<clave>.
  const IVA_ESPERADO = true;
  const claves: string[] = [];
  await test.step('Agregar dos productos rápidos con IVA activado, con distinta cantidad cada uno', async () => {
    let clavesAntes = await pos.obtenerClavesProductos();
    await pos.agregarProductoRapidoParaValidacionIva(`Validación IVA A ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO, true, 1);
    let clavesDespues = await pos.obtenerClavesProductos();
    claves.push(clavesDespues.find(c => !clavesAntes.includes(c))!);

    clavesAntes = clavesDespues;
    await pos.agregarProductoRapidoParaValidacionIva(`Validación IVA B ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO, true, 2);
    clavesDespues = await pos.obtenerClavesProductos();
    claves.push(clavesDespues.find(c => !clavesAntes.includes(c))!);
  });

  await test.step('Fijar el carrito para mostrar la columna "con IVA" con un click real sobre #show_price_with_iva, y confirmar que el checkbox y los totales quedaron consistentes antes de validar', async () => {
    await pos.establecerMostrarPrecioConIva(true, claves);
  });

  let lineas: LineaCarrito[] = [];
  await test.step('Recorrer todos los productos agregados y validar (precio unitario × cantidad) + IVA = total de cada línea', async () => {
    lineas = await pos.validarLineasCarrito(claves, IVA_ESPERADO);
  });

  await test.step('Validar que la suma del IVA de todos los productos coincide con el resumen de totales', async () => {
    await pos.validarResumenImpuestos(lineas);
  });
});

test('validar cálculo de IVA en productos rápidos — IVA desactivado', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  // Misma lógica que el escenario "con IVA": la expectativa es la intención
  // propia del test, no algo leído de ningún checkbox del formulario.
  const IVA_ESPERADO = false;
  const claves: string[] = [];
  await test.step('Agregar dos productos rápidos con IVA desactivado, con distinta cantidad cada uno', async () => {
    let clavesAntes = await pos.obtenerClavesProductos();
    await pos.agregarProductoRapidoParaValidacionIva(`Validación sin IVA A ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO, false, 1);
    let clavesDespues = await pos.obtenerClavesProductos();
    claves.push(clavesDespues.find(c => !clavesAntes.includes(c))!);

    clavesAntes = clavesDespues;
    await pos.agregarProductoRapidoParaValidacionIva(`Validación sin IVA B ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO, false, 3);
    clavesDespues = await pos.obtenerClavesProductos();
    claves.push(clavesDespues.find(c => !clavesAntes.includes(c))!);
  });

  await test.step('Fijar el carrito para mostrar la columna "con IVA" con un click real sobre #show_price_with_iva, y confirmar que el checkbox y los totales quedaron consistentes antes de validar', async () => {
    await pos.establecerMostrarPrecioConIva(true, claves);
  });

  let lineas: LineaCarrito[] = [];
  await test.step('Recorrer todos los productos agregados y validar que el total de cada línea es precio unitario × cantidad, sin IVA', async () => {
    // La misma fórmula de validarLineaCarrito sirve para este escenario: con
    // IVA desactivado, iva=0 y neto=total, así que (precio × cantidad) + 0
    // = total sin necesidad de una fórmula separada.
    lineas = await pos.validarLineasCarrito(claves, IVA_ESPERADO);
  });

  await test.step('Validar que el resumen de totales no refleja IVA de estos productos', async () => {
    await pos.validarResumenImpuestos(lineas);
  });
});

test('crear un Combo con IVA desde el POS y validar que se agrega correctamente al carrito', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  const nombreCombo = `Combo QA con IVA ${Date.now()}`;

  await test.step('Crear el combo: activar IVA, verificarlo, y agregar CABYS si el formulario lo ofrece (validando que su tasa coincide con la seleccionada)', async () => {
    const cabysAplicado = await pos.crearComboConIva(nombreCombo);
    console.log(`[crear un Combo con IVA] cabysAplicado=${cabysAplicado}`);
  });

  let claveCombo = '';
  await test.step('Buscar el combo en la categoría "Combos" y agregarlo al carrito', async () => {
    claveCombo = await pos.buscarComboYAgregarAlCarrito(nombreCombo);
  });

  await test.step('Fijar el carrito para mostrar totales con IVA y validar que el combo se agregó con IVA aplicado, el nombre coincide y no hay errores', async () => {
    await pos.establecerMostrarPrecioConIva(true, [claveCombo]);
    const linea = await pos.validarLineaCarrito(claveCombo, true);
    expect(linea.nombre, 'El nombre de la línea agregada al carrito no coincide con el combo creado').toBe(nombreCombo);
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});

test('crear un Combo sin IVA desde el POS y validar que se agrega correctamente al carrito', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  const nombreCombo = `Combo QA sin IVA ${Date.now()}`;

  let cabysAplicado = false;
  await test.step('Crear el combo: desactivar IVA, verificarlo, y agregar CABYS si el formulario lo ofrece (re-desactivando IVA después)', async () => {
    // "Sin IVA" lo define el checkbox desactivado, no una búsqueda de CABYS
    // "Exento" — CABYS es un campo fiscal obligatorio independiente del
    // checkbox, así que se usa el mismo CABYS_BUSQUEDA ("aceite", 13%) que
    // el escenario "con IVA". Si el formulario no ofreciera CABYS en este
    // ambiente (depende del país configurado para la compañía, no es fijo —
    // ver el comentario de existeCampoCabys() en pos.page.ts), cabysAplicado
    // quedaría en false y ese sería el único caso real de "sin IVA"
    // (ivaAplicado=false) — ver el step de validación más abajo para la
    // explicación completa.
    cabysAplicado = await pos.crearComboSinIva(nombreCombo);
    console.log(`[crear un Combo sin IVA] cabysAplicado=${cabysAplicado}`);
  });

  let claveCombo = '';
  await test.step('Buscar el combo en la categoría "Combos" y agregarlo al carrito', async () => {
    claveCombo = await pos.buscarComboYAgregarAlCarrito(nombreCombo);
  });

  await test.step('Fijar el carrito para mostrar totales con IVA y validar el combo agregado, el nombre y que no hay errores', async () => {
    await pos.establecerMostrarPrecioConIva(true, [claveCombo]);

    // Comportamiento real del sistema (confirmado en vivo, con el checkbox
    // correctamente re-desactivado DESPUÉS de esperar la auto-activación que
    // dispara aplicar un CABYS — ver esperarIvaAutocompletadoCombo() y
    // crearComboSinIva()): el combo queda con
    // product_hide_apply_iva_<clave>="0" e IVA real = 0 sin importar si se
    // aplicó un CABYS o no. "Sin IVA" es entonces siempre ivaAplicado=false,
    // consistente con que el checkbox es lo único que define este escenario.
    const linea = await pos.validarLineaCarrito(claveCombo, false);
    expect(linea.nombre, 'El nombre de la línea agregada al carrito no coincide con el combo creado').toBe(nombreCombo);
    expect(linea.iva, 'Un combo "sin IVA" no debería cobrar IVA real en la línea').toBeCloseTo(0, 1);
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});

/**
 * Maneja CABYS para "Crear Producto" EN EL MOMENTO CORRECTO del wizard: el
 * botón "CABYS" (contenedor `#quick_pos_product_cabys_content`, debajo del
 * campo "Proveedor") pertenece al panel del paso "Inf. General" —
 * confirmado en vivo inspeccionando el DOM real, contradice lo asumido
 * antes (que compartía paso con el checkbox de IVA, en "Costos"). El panel
 * de "Inf. General" se oculta —no se destruye— al avanzar a "Costos" con
 * avanzarPasoInfoGeneralProducto(); por eso esta función debe llamarse
 * SIEMPRE ANTES de ese avance: comprobarlo después solo encuentra el
 * contenedor oculto y concluye erróneamente que CABYS no existe, aunque el
 * país configurado para esta compañía sí lo exija (`#validate_cabys_code =
 * "1"`, confirmado en vivo).
 *
 * Reutiliza `existeCampoCabys()`/`buscarYAplicarCabys()` de pos.page.ts tal
 * cual —mismas funciones que ya usan Producto Rápido y Combo, sin duplicar
 * su lógica—, separadas en dos llamadas en vez de usar el atajo
 * `manejarCabysSiAplica()` únicamente para poder loguear cada punto
 * pedido: si la sección se encontró, si se intentó interactuar con ella, y
 * si se omitió (con el motivo). Nunca falla si CABYS no existe: se limita
 * a registrarlo y devolver `false` para que el resto del flujo continúe
 * normalmente.
 */
async function manejarCabysProductoEnPasoUno(pos: PosPage, etiqueta: string): Promise<boolean> {
  const boton = pos.configCabysProducto.boton;
  const existe = await pos.existeCampoCabys(boton);

  if (!existe) {
    console.log(`[${etiqueta}] CABYS: sección NO encontrada/visible en "Inf. General" — se omite (depende del país configurado para la compañía) y se continúa sin CABYS.`);
    return false;
  }

  console.log(`[${etiqueta}] CABYS: sección encontrada y visible en "Inf. General" — se interactuará con ella.`);
  await boton.scrollIntoViewIfNeeded();
  await pos.buscarYAplicarCabys(CABYS_BUSQUEDA, pos.configCabysProducto);
  console.log(`[${etiqueta}] CABYS: interacción completada — se aplicó un CABYS.`);
  return true;
}

/**
 * Configura el IVA de "Crear Producto" ya en el paso "Costos", asumiendo
 * que CABYS (si el formulario lo ofrece) ya se manejó en el paso anterior
 * vía manejarCabysProductoEnPasoUno().
 *
 * Confirmado en vivo (inspeccionando el DOM real de la app, no asumido):
 * aplicar un CABYS en "Inf. General" SÍ autoactiva el checkbox "¿Aplica
 * Impuesto?" y sincroniza tipo/tasa con la tasa real del CABYS, con un
 * desfase medido de ~330ms. Para cuando este método corre,
 * avanzarPasoInfoGeneralProducto() ya esperó la respuesta real de
 * saveProductStepOne más el renderizado del paso "Costos" (~1.3s medidos
 * en vivo, más de 4 veces ese desfase), así que no hace falta ninguna
 * espera adicional: el checkbox y las tasas ya están estables para cuando
 * se llega aquí — a diferencia de "Crear Combo" (donde CABYS se aplica y
 * se revierte dentro del mismo paso, sin ninguna transición de por medio,
 * por lo que sí necesita esperar explícitamente el autocompletado antes de
 * desactivar).
 *
 * Sin CABYS aplicado, activar el checkbox NO deja ningún tipo/tarifa real
 * seleccionado (queda en el placeholder vacío, lo que bloquea
 * silenciosamente el avance del wizard) — de ahí que
 * seleccionarIvaManualmenteProducto() sea obligatorio en ese caso, mismo
 * criterio que ya usa seleccionarIvaManualmente() para Producto Rápido.
 */
async function configurarIvaProductoEnPasoDos(pos: PosPage, activarIva: boolean, cabysAplicado: boolean) {
  if (activarIva) {
    if (cabysAplicado) {
      await expect(
        pos.checkboxIvaProducto,
        'El checkbox "¿Aplica Impuesto?" de "Crear Producto" no quedó activado automáticamente tras aplicar el CABYS'
      ).toBeChecked();
      await pos.validarIvaCoincideConCabysProducto();
    } else {
      await pos.activarIvaProducto();
      await expect(
        pos.checkboxIvaProducto,
        'El checkbox "¿Aplica Impuesto?" de "Crear Producto" no quedó activado'
      ).toBeChecked();
      await pos.seleccionarIvaManualmenteProducto();
    }
    return;
  }

  if (cabysAplicado) {
    await pos.desactivarIvaProducto();
  }
  await expect(
    pos.checkboxIvaProducto,
    'El checkbox "¿Aplica Impuesto?" de "Crear Producto" no quedó desactivado'
  ).not.toBeChecked();
}

/**
 * Busca el producto recién creado por nombre exacto en el grid del POS
 * (reutilizando productoPorNombre/agregarProductoPorNombre, igual que el
 * resto de la suite) y devuelve la clave de la línea que se agregó al
 * carrito. Recarga el POS primero (vía cargarPosDesdeDashboard) para
 * garantizar que el grid refleje el producto recién guardado.
 *
 * Usa el buscador real del grid (buscarProductoEnGrid) en vez de solo
 * cambiar de categoría — confirmado en vivo que la vista por defecto de
 * cualquier categoría (incluida "TODOS") está limitada a un cupo fijo de
 * tarjetas ordenadas alfabéticamente: un producto recién creado cuyo
 * nombre ordena después de ese cupo (confirmado interceptando la red:
 * "Producto Sencillo..."/"Producto Fraccionado..." nunca aparecían en la
 * respuesta del backend bajo "TODOS", sin importar cuánto se esperara)
 * simplemente no aparece ahí aunque exista — el buscador sí lo encuentra.
 *
 * Para un producto Fraccionado, clickearlo abre un modal adicional
 * ("Seleccionar Cantidad", ver agregarProductoFraccionadoPorNombre() en
 * pos.page.ts) que no aparece para productos simples — confirmado en vivo.
 *
 * `clavesAntes` se captura ANTES de buscarProductoEnGrid(), no después:
 * confirmado en vivo que buscar por el nombre EXACTO y único de un producto
 * recién creado (una sola coincidencia) ya lo agrega solo al carrito como
 * efecto del propio Enter, antes de clickear nada — capturarlo después del
 * buscador ya incluiría esa línea, y la comparación de "apareció una clave
 * nueva" nunca detectaría nada (el click posterior solo incrementaría la
 * cantidad de esa misma línea, no crearía una clave distinta).
 */
async function buscarProductoYAgregarAlCarrito(pos: PosPage, nombre: string, esFraccionado = false): Promise<string> {
  await pos.cargarPosDesdeDashboard();
  await pos.cerrarOverlaysConocidos();

  const clavesAntes = await pos.obtenerClavesProductos();
  await pos.buscarProductoEnGrid(nombre);

  if (esFraccionado) {
    await pos.agregarProductoFraccionadoPorNombre(nombre, '1');
  } else {
    await pos.agregarProductoPorNombre(nombre);
  }
  await expect.poll(
    async () => (await pos.obtenerClavesProductos()).length,
    { timeout: TIMEOUTS.PRODUCTS_LOAD }
  ).toBeGreaterThan(clavesAntes.length);
  const clavesDespues = await pos.obtenerClavesProductos();
  return clavesDespues.find(c => !clavesAntes.includes(c))!;
}

/**
 * Valida, para cualquiera de los seis escenarios de "Crear Producto", que la
 * línea agregada al carrito tiene el nombre correcto, el IVA esperado y que
 * no quedó ningún mensaje de error visible — mismo criterio ya usado para
 * Producto Rápido y Combo.
 *
 * Un producto Fraccionado aparece en el carrito con el prefijo "Frac. "
 * delante de su nombre (confirmado en vivo) — se contempla explícitamente
 * en vez de asumir el mismo formato que un producto simple.
 */
async function validarProductoEnCarrito(pos: PosPage, page: Page, clave: string, nombreEsperado: string, ivaEsperado: boolean, esFraccionado = false) {
  await pos.establecerMostrarPrecioConIva(true, [clave]);
  const linea = await pos.validarLineaCarrito(clave, ivaEsperado);
  const nombreEsperadoEnCarrito = esFraccionado ? `Frac. ${nombreEsperado}` : nombreEsperado;
  expect(linea.nombre, 'El nombre de la línea agregada al carrito no coincide con el producto creado').toBe(nombreEsperadoEnCarrito);
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

test('crear un Producto Sencillo con IVA desde el POS y validar que se agrega correctamente al carrito', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const nombreProducto = `Producto Sencillo QA con IVA ${Date.now()}`;

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  let cabysAplicado = false;
  await test.step('Abrir "Crear Producto", llenar únicamente Nombre y manejar CABYS si el formulario lo ofrece (paso "Inf. General")', async () => {
    await pos.abrirCrearProducto();
    await pos.llenarNombreProducto(nombreProducto);
    cabysAplicado = await manejarCabysProductoEnPasoUno(pos, 'crear un Producto Sencillo con IVA');
    await pos.avanzarPasoInfoGeneralProducto();
  });

  await test.step('Activar IVA en el paso "Costos" (o validar que el CABYS aplicado ya lo activó) y verificar que la tasa coincide', async () => {
    await configurarIvaProductoEnPasoDos(pos, true, cabysAplicado);
  });

  await test.step('Llenar únicamente Costo, Precio de venta y Cantidad, y finalizar', async () => {
    await pos.llenarCostosBasicosProducto(PRODUCTO_COSTO, PRODUCTO_PRECIO_VENTA, PRODUCTO_CANTIDAD);
    await pos.avanzarPasoCostosProducto();
    await pos.finalizarCrearProducto();
  });

  let claveProducto = '';
  await test.step('Buscar el producto en el catálogo del POS y agregarlo al carrito', async () => {
    claveProducto = await buscarProductoYAgregarAlCarrito(pos, nombreProducto);
  });

  await test.step('Validar que el producto se agregó con IVA aplicado, el nombre coincide y no hay errores', async () => {
    await validarProductoEnCarrito(pos, page, claveProducto, nombreProducto, true);
  });
});

test('crear un Producto Sencillo sin IVA desde el POS y validar que se agrega correctamente al carrito', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const nombreProducto = `Producto Sencillo QA sin IVA ${Date.now()}`;

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  let cabysAplicado = false;
  await test.step('Abrir "Crear Producto", llenar únicamente Nombre y manejar CABYS si el formulario lo ofrece (paso "Inf. General")', async () => {
    await pos.abrirCrearProducto();
    await pos.llenarNombreProducto(nombreProducto);
    cabysAplicado = await manejarCabysProductoEnPasoUno(pos, 'crear un Producto Sencillo sin IVA');
    await pos.avanzarPasoInfoGeneralProducto();
  });

  await test.step('Dejar el IVA desactivado en el paso "Costos", re-desactivándolo si el CABYS aplicado lo activó automáticamente', async () => {
    await configurarIvaProductoEnPasoDos(pos, false, cabysAplicado);
  });

  await test.step('Llenar únicamente Costo, Precio de venta y Cantidad, y finalizar', async () => {
    await pos.llenarCostosBasicosProducto(PRODUCTO_COSTO, PRODUCTO_PRECIO_VENTA, PRODUCTO_CANTIDAD);
    await pos.avanzarPasoCostosProducto();
    await pos.finalizarCrearProducto();
  });

  let claveProducto = '';
  await test.step('Buscar el producto en el catálogo del POS y agregarlo al carrito', async () => {
    claveProducto = await buscarProductoYAgregarAlCarrito(pos, nombreProducto);
  });

  await test.step('Validar que el producto quedó realmente sin IVA, el nombre coincide y no hay errores', async () => {
    await validarProductoEnCarrito(pos, page, claveProducto, nombreProducto, false);
  });
});

test('crear un Producto Completo con IVA desde el POS y validar que se agrega correctamente al carrito', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const nombreProducto = `Producto Completo QA con IVA ${Date.now()}`;

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  let cabysAplicado = false;
  await test.step('Abrir "Crear Producto", llenar Nombre, Marca, Categoría, Subcategoría, Proveedor, Código de proveedor y Código de barras, y manejar CABYS si el formulario lo ofrece', async () => {
    await pos.abrirCrearProducto();
    await pos.llenarNombreProducto(nombreProducto);
    await pos.llenarDatosCompletosProducto('Marca QA', 'PROV-CODE-QA', `BARCODE-QA-${Date.now()}`);
    cabysAplicado = await manejarCabysProductoEnPasoUno(pos, 'crear un Producto Completo con IVA');
    await pos.avanzarPasoInfoGeneralProducto();
  });

  await test.step('Activar IVA en el paso "Costos" (o validar que el CABYS aplicado ya lo activó) y verificar que la tasa coincide', async () => {
    await configurarIvaProductoEnPasoDos(pos, true, cabysAplicado);
  });

  await test.step('Llenar Costo, Precio de venta, Cantidad, Stock mínimo, Descuento de proveedor, Descuento máximo, Tipo de unidad, Sección y Subsección', async () => {
    await pos.llenarCostosBasicosProducto(PRODUCTO_COSTO, PRODUCTO_PRECIO_VENTA, PRODUCTO_CANTIDAD);
    await pos.llenarCostosCompletosProducto('2', '5', '10');
    await pos.avanzarPasoCostosProducto();
  });

  await test.step('Llenar Tamaño y Descripción, y finalizar', async () => {
    await pos.llenarDescripcionProducto('Talla M', 'Descripción generada por prueba automatizada QA');
    await pos.finalizarCrearProducto();
  });

  let claveProducto = '';
  await test.step('Buscar el producto en el catálogo del POS y agregarlo al carrito', async () => {
    claveProducto = await buscarProductoYAgregarAlCarrito(pos, nombreProducto);
  });

  await test.step('Validar que el producto se agregó con IVA aplicado, el nombre coincide y no hay errores', async () => {
    await validarProductoEnCarrito(pos, page, claveProducto, nombreProducto, true);
  });
});

test('crear un Producto Completo sin IVA desde el POS y validar que se agrega correctamente al carrito', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const nombreProducto = `Producto Completo QA sin IVA ${Date.now()}`;

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  let cabysAplicado = false;
  await test.step('Abrir "Crear Producto", llenar Nombre, Marca, Categoría, Subcategoría, Proveedor, Código de proveedor y Código de barras, y manejar CABYS si el formulario lo ofrece', async () => {
    await pos.abrirCrearProducto();
    await pos.llenarNombreProducto(nombreProducto);
    await pos.llenarDatosCompletosProducto('Marca QA', 'PROV-CODE-QA', `BARCODE-QA-${Date.now()}`);
    cabysAplicado = await manejarCabysProductoEnPasoUno(pos, 'crear un Producto Completo sin IVA');
    await pos.avanzarPasoInfoGeneralProducto();
  });

  await test.step('Dejar el IVA desactivado en el paso "Costos", re-desactivándolo si el CABYS aplicado lo activó automáticamente', async () => {
    await configurarIvaProductoEnPasoDos(pos, false, cabysAplicado);
  });

  await test.step('Llenar Costo, Precio de venta, Cantidad, Stock mínimo, Descuento de proveedor, Descuento máximo, Tipo de unidad, Sección y Subsección', async () => {
    await pos.llenarCostosBasicosProducto(PRODUCTO_COSTO, PRODUCTO_PRECIO_VENTA, PRODUCTO_CANTIDAD);
    await pos.llenarCostosCompletosProducto('2', '5', '10');
    await pos.avanzarPasoCostosProducto();
  });

  await test.step('Llenar Tamaño y Descripción, y finalizar', async () => {
    await pos.llenarDescripcionProducto('Talla M', 'Descripción generada por prueba automatizada QA');
    await pos.finalizarCrearProducto();
  });

  let claveProducto = '';
  await test.step('Buscar el producto en el catálogo del POS y agregarlo al carrito', async () => {
    claveProducto = await buscarProductoYAgregarAlCarrito(pos, nombreProducto);
  });

  await test.step('Validar que el producto quedó realmente sin IVA, el nombre coincide y no hay errores', async () => {
    await validarProductoEnCarrito(pos, page, claveProducto, nombreProducto, false);
  });
});

test('crear un Producto Fraccionado con IVA desde el POS y validar que se agrega correctamente al carrito', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const nombreProducto = `Producto Fraccionado QA con IVA ${Date.now()}`;

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  let cabysAplicado = false;
  await test.step('Abrir "Crear Producto", llenar los mismos datos del Producto Completo, y manejar CABYS si el formulario lo ofrece', async () => {
    await pos.abrirCrearProducto();
    await pos.llenarNombreProducto(nombreProducto);
    await pos.llenarDatosCompletosProducto('Marca QA', 'PROV-CODE-QA', `BARCODE-QA-${Date.now()}`);
    cabysAplicado = await manejarCabysProductoEnPasoUno(pos, 'crear un Producto Fraccionado con IVA');
    await pos.avanzarPasoInfoGeneralProducto();
  });

  await test.step('Activar IVA en el paso "Costos" (o validar que el CABYS aplicado ya lo activó) y verificar que la tasa coincide', async () => {
    await configurarIvaProductoEnPasoDos(pos, true, cabysAplicado);
  });

  await test.step('Activar "¿Fraccionar?" y llenar los campos que aparecen dinámicamente (precio por caja y por fracción, los únicos obligatorios)', async () => {
    await pos.llenarCostoProducto(PRODUCTO_COSTO);
    await pos.activarFraccionarProducto();
    await pos.llenarCostosFraccionadoProducto(PRODUCTO_PRECIO_CAJA, PRODUCTO_PRECIO_FRACCION, PRODUCTO_CANTIDAD_CAJA, PRODUCTO_FRACCIONES_POR_UNIDAD);
    await pos.llenarCostosCompletosProducto('2', '5', '10');
    await pos.avanzarPasoCostosProducto();
  });

  await test.step('Llenar Tamaño y Descripción, y finalizar', async () => {
    await pos.llenarDescripcionProducto('Talla M', 'Descripción generada por prueba automatizada QA');
    await pos.finalizarCrearProducto();
  });

  let claveProducto = '';
  await test.step('Buscar el producto en el catálogo del POS y agregarlo al carrito (maneja el modal "Seleccionar Cantidad" propio de Fraccionado)', async () => {
    claveProducto = await buscarProductoYAgregarAlCarrito(pos, nombreProducto, true);
  });

  await test.step('Validar que el producto se agregó con IVA aplicado, el nombre coincide y no hay errores', async () => {
    await validarProductoEnCarrito(pos, page, claveProducto, nombreProducto, true, true);
  });
});

test('crear un Producto Fraccionado sin IVA desde el POS y validar que se agrega correctamente al carrito', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);
  const nombreProducto = `Producto Fraccionado QA sin IVA ${Date.now()}`;

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  let cabysAplicado = false;
  await test.step('Abrir "Crear Producto", llenar los mismos datos del Producto Completo, y manejar CABYS si el formulario lo ofrece', async () => {
    await pos.abrirCrearProducto();
    await pos.llenarNombreProducto(nombreProducto);
    await pos.llenarDatosCompletosProducto('Marca QA', 'PROV-CODE-QA', `BARCODE-QA-${Date.now()}`);
    cabysAplicado = await manejarCabysProductoEnPasoUno(pos, 'crear un Producto Fraccionado sin IVA');
    await pos.avanzarPasoInfoGeneralProducto();
  });

  await test.step('Dejar el IVA desactivado en el paso "Costos", re-desactivándolo si el CABYS aplicado lo activó automáticamente', async () => {
    await configurarIvaProductoEnPasoDos(pos, false, cabysAplicado);
  });

  await test.step('Activar "¿Fraccionar?" y llenar los campos que aparecen dinámicamente (precio por caja y por fracción, los únicos obligatorios)', async () => {
    await pos.llenarCostoProducto(PRODUCTO_COSTO);
    await pos.activarFraccionarProducto();
    await pos.llenarCostosFraccionadoProducto(PRODUCTO_PRECIO_CAJA, PRODUCTO_PRECIO_FRACCION, PRODUCTO_CANTIDAD_CAJA, PRODUCTO_FRACCIONES_POR_UNIDAD);
    await pos.llenarCostosCompletosProducto('2', '5', '10');
    await pos.avanzarPasoCostosProducto();
  });

  await test.step('Llenar Tamaño y Descripción, y finalizar', async () => {
    await pos.llenarDescripcionProducto('Talla M', 'Descripción generada por prueba automatizada QA');
    await pos.finalizarCrearProducto();
  });

  let claveProducto = '';
  await test.step('Buscar el producto en el catálogo del POS y agregarlo al carrito (maneja el modal "Seleccionar Cantidad" propio de Fraccionado)', async () => {
    claveProducto = await buscarProductoYAgregarAlCarrito(pos, nombreProducto, true);
  });

  await test.step('Validar que el producto quedó realmente sin IVA, el nombre coincide y no hay errores', async () => {
    await validarProductoEnCarrito(pos, page, claveProducto, nombreProducto, false, true);
  });
});
