import { test, expect, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, CABYS_BUSQUEDA, CABYS_BUSQUEDA_SIN_IVA, PRECIO_PRODUCTO_RAPIDO, LineaCarrito, espiarErroresJS } from './pos.page';
import {
  PosCrearCliente, type DatosClienteSencillo, type DatosClientePrincipal,
  type DatosClienteOpcionesAvanzadas, type DatosClienteUbicacion, type DatosVehiculoCompleto,
} from './pos-crear-cliente.page';

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

// ═══════════════════════════════════════════════════════════════════════════
// Crear Cliente — investigado en vivo (ver el informe final de esta suite):
// el modal real es #dialog_add_customer, abierto desde el dropdown "Nuevo
// Cliente" del panel "Buscar Cliente" DENTRO del POS (nunca desde el módulo
// completo /cust/customer del Dashboard — ese camino tiene un bug real de
// navegación, documentado más abajo, ajeno a esta automatización).
// ═══════════════════════════════════════════════════════════════════════════

// Fixture propia de scope 'worker' — mismo mecanismo ya adoptado en
// pos-productos-externos.spec.ts (ver su propio comentario extenso): una
// sola carga de Dashboard→POS por worker, sin test.describe.configure
// ({mode:'serial'}) para no entrar en conflicto con fullyParallel. `base` es
// el mismo `test` ya importado arriba (sin una segunda importación del
// mismo módulo, que confundía la inferencia de tipos de .extend()) — solo
// se le da otro nombre para no pisar el `test` simple que ya usan los
// escenarios de "Crear Producto" de este mismo archivo.
const base = test;

type CrearClienteFixtures = {
  sharedPage: Page;
  pos: PosPage;
  cc: PosCrearCliente;
};

const testCliente = base.extend<{}, CrearClienteFixtures>({
  sharedPage: [async ({ browser }, use) => {
    const page = await browser.newPage();
    await use(page);
    await page.close();
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  pos: [async ({ sharedPage }, use) => {
    const pos = new PosPage(sharedPage);
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
    await use(pos);
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  cc: [async ({ pos, sharedPage }, use) => {
    await use(new PosCrearCliente(pos, sharedPage));
  }, { scope: 'worker' }],
});

/** Ningún modal ni SweetAlert inesperado siga abierto — mismo criterio que pos-productos-externos.spec.ts. */
async function validarSinModalesInesperadosCliente(page: Page) {
  await expect(page.locator('.modal.in')).toHaveCount(0);
  await expect(page.locator('.sweet-alert.visible')).toHaveCount(0);
}

/** Ninguna línea de error visible — mismo criterio que el resto de la suite. */
async function validarSinMensajesDeErrorCliente(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

/**
 * Cierra el modal "Agregar Cliente" con su botón real de cierre (#closing_modal)
 * — necesario tras reabrir un cliente ya guardado (reabrirPrimerResultado())
 * para no dejarlo abierto al final del escenario (validarSinModalesInesperadosCliente
 * fallaría de otro modo).
 */
async function cerrarModalClienteSiAbierto(cc: PosCrearCliente, page: Page) {
  if (await cc.modal.isVisible().catch(() => false)) {
    await cc.modal.locator('#closing_modal').click();
    await expect(cc.modal, 'El modal "Agregar Cliente" no se cerró').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }
}

/**
 * Busca el cliente recién creado y reabre su edición para validar que los
 * datos persistieron — recarga el POS primero (pos.irAlPos()+esperarEstadoInicial())
 * porque confirmado en vivo que, justo tras guardar, el panel "Buscar
 * Cliente" puede no reflejar de inmediato el estado por defecto necesario
 * para una nueva búsqueda (mismo criterio de "recargar para confirmar
 * persistencia del lado del servidor" ya usado en pos-productos-externos.spec.ts).
 */
async function buscarYReabrirCliente(pos: PosPage, cc: PosCrearCliente, nombre: string) {
  await pos.irAlPos();
  await pos.esperarEstadoInicial();
  // Confirmado en vivo (causa raíz real del cuelgue de búsqueda ya
  // documentado en pos-importar-factura.spec.ts junto a
  // #search_pos_customer): la venta en curso persiste del lado del
  // servidor, así que crear un cliente desde el POS lo deja auto-asignado
  // al carrito — incluso después de recargar con irAlPos(). Con un cliente
  // real ya seleccionado, el panel "Buscar Cliente" nunca vuelve a mostrar
  // el buscador. Se reutiliza quitarClienteSeleccionado() (mismo criterio
  // ya usado en esa otra suite) antes de buscar.
  if (await pos.hayClienteRealSeleccionado()) {
    await pos.quitarClienteSeleccionado();
  }
  const cantidad = await cc.buscarClientesSinSeleccionar(nombre);
  expect(cantidad, `El cliente "${nombre}" no apareció en la búsqueda tras guardarlo`).toBeGreaterThanOrEqual(1);
  await cc.reabrirPrimerResultado();
}

testCliente.describe('Crear Cliente', () => {
  testCliente.beforeEach(async ({ pos }) => {
    testCliente.setTimeout(TIMEOUTS.TEST);
    await pos.irAlPos();
    await pos.esperarEstadoInicial();
    if (await pos.modalAbrirCajaVisible()) {
      await pos.cerrarModalAbrirCaja();
    }
    await pos.cerrarOverlaysConocidos();
  });

  testCliente('1. Crear cliente sencillo (Tipo de identificación, Identificación, Nombre, Correo electrónico)', async ({ pos, cc, sharedPage }) => {
    testCliente.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    const sufijo = Date.now();
    const datos: DatosClienteSencillo = {
      nombre: `QA Cliente Sencillo ${sufijo}`,
      identificacion: `${sufijo}`.slice(-9),
      email: `qa.cliente.sencillo.${sufijo}@example.com`,
    };

    let idCreado = '';
    await test.step('Abrir "Agregar Cliente" y llenar únicamente los 4 campos básicos', async () => {
      await cc.abrirAgregarCliente();
      await cc.llenarClienteSencillo(datos);
    });

    await test.step('Guardar y validar el mensaje de creación exitosa', async () => {
      const resultado = await cc.guardarCliente();
      expect(resultado.respuesta.ok(), `${resultado.respuesta.url()} no respondió OK (status ${resultado.respuesta.status()})`).toBe(true);
      expect(Number(resultado.id), `La respuesta de guardado no fue un id numérico válido: "${resultado.id}"`).toBeGreaterThan(0);
      idCreado = resultado.id;
    });

    await test.step('Buscar el cliente y validar que los datos persistieron al reabrirlo', async () => {
      await buscarYReabrirCliente(pos, cc, datos.nombre);
      await expect(cc.modal.locator('#c_name'), 'El nombre no persistió').toHaveValue(datos.nombre.trim());
      await expect(cc.modal.locator('#c_identifier'), 'La identificación no persistió').toHaveValue(datos.identificacion);
      await expect(cc.modal.locator('#c_email'), 'El correo electrónico no persistió').toHaveValue(datos.email);
      // Tipo de Identificación: se validó ya al guardar (Chosen con opción
      // real seleccionada); tras reabrir, su trigger no debe seguir en el
      // placeholder "Seleccione...".
      await expect(
        cc.modal.locator('#c_identification_type_chosen .chosen-single span'),
        'El Tipo de Identificación no persistió (sigue en el placeholder)'
      ).not.toHaveText('Seleccione...');
      await cerrarModalClienteSiAbierto(cc, sharedPage);
    });

    await validarSinMensajesDeErrorCliente(sharedPage);
    await validarSinModalesInesperadosCliente(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    console.log(`[Escenario 1] Cliente creado con id=${idCreado}`);
  });


  testCliente('2. Crear cliente completo (Principal + Opciones avanzadas + Ubicación)', async ({ pos, cc, sharedPage }) => {
    testCliente.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    const sufijo = Date.now();
    const datosPrincipal: DatosClientePrincipal = {
      nombre: `QA Cliente Completo ${sufijo}`,
      identificacion: `${sufijo}`.slice(-9),
      email: `qa.cliente.completo.${sufijo}@example.com`,
      codigo: `COD-QA-${sufijo}`,
      batch: `BATCH-QA-${sufijo}`,
      direccion: 'Dirección de prueba generada por automatización QA, 500m norte del parque central.',
      whatsapp: '88887777',
      telefono: '22223333',
    };
    const datosAvanzados: DatosClienteOpcionesAvanzadas = { limiteCredito: '5000' };
    const datosUbicacion: DatosClienteUbicacion = {
      lugar: 'Oficina QA',
      direccionEscrita: 'Frente al parque central, edificio azul',
      // Confirmado en vivo: "Agregar dirección" es 100% cliente (nunca
      // dispara AJAX propio) y parsea lat/lng directamente de esta URL —
      // sin un par de coordenadas reales aquí, el botón no agrega ninguna
      // fila y no muestra ningún error visible, pese a que el label del
      // campo dice "(opcional)".
      url: 'https://maps.google.com/?q=9.9281,-84.0907',
    };

    await test.step('Abrir "Agregar Cliente" y llenar todos los campos de "Principal"', async () => {
      await cc.abrirAgregarCliente();
      await cc.llenarPrincipalCompleto(datosPrincipal);
    });

    await test.step('Llenar todos los campos de "Opciones avanzadas"', async () => {
      await cc.irATabOpcionesAvanzadas();
      await cc.llenarOpcionesAvanzadasCompleto(datosAvanzados);
    });

    await test.step('Agregar una dirección completa en "Ubicación"', async () => {
      await cc.irATabUbicacion();
      await cc.agregarDireccion(datosUbicacion);
    });

    let idCreado = '';
    await test.step('Guardar y validar el mensaje de creación exitosa', async () => {
      const resultado = await cc.guardarCliente();
      expect(resultado.respuesta.ok()).toBe(true);
      expect(Number(resultado.id)).toBeGreaterThan(0);
      idCreado = resultado.id;
    });

    await test.step('Buscar el cliente y validar que TODOS los datos persistieron al reabrirlo', async () => {
      await buscarYReabrirCliente(pos, cc, datosPrincipal.nombre);

      await expect(cc.modal.locator('#c_name')).toHaveValue(datosPrincipal.nombre.trim());
      await expect(cc.modal.locator('#c_identifier')).toHaveValue(datosPrincipal.identificacion);
      await expect(cc.modal.locator('#c_email')).toHaveValue(datosPrincipal.email);
      await expect(cc.modal.locator('#c_code')).toHaveValue(datosPrincipal.codigo);
      await expect(cc.modal.locator('#c_batch')).toHaveValue(datosPrincipal.batch);
      await expect(cc.modal.locator('#c_address')).toHaveValue(datosPrincipal.direccion);

      await cc.irATabOpcionesAvanzadas();
      await expect(cc.modal.locator('#c_limit')).toHaveValue(datosAvanzados.limiteCredito);
      await expect(cc.modal.locator('#ck_is_exempt')).toBeChecked();

      await cc.irATabUbicacion();
      await expect(
        cc.modal.locator('#table_client_address'),
        'La dirección agregada no aparece en "Direcciones Guardadas" tras reabrir el cliente'
      ).toContainText(datosUbicacion.lugar);

      await cerrarModalClienteSiAbierto(cc, sharedPage);
    });

    await validarSinMensajesDeErrorCliente(sharedPage);
    await validarSinModalesInesperadosCliente(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    console.log(`[Escenario 2] Cliente creado con id=${idCreado}`);
  });


  testCliente('3. Crear cliente completo con actividades económicas (si el campo existe para esta compañía)', async ({ pos, cc, sharedPage }) => {
    testCliente.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    const sufijo = Date.now();
    const datosPrincipal: DatosClientePrincipal = {
      nombre: `QA Cliente Actividades ${sufijo}`,
      identificacion: `${sufijo}`.slice(-9),
      email: `qa.cliente.actividades.${sufijo}@example.com`,
      codigo: `COD-QA-${sufijo}`,
      batch: `BATCH-QA-${sufijo}`,
      direccion: 'Dirección de prueba generada por automatización QA.',
      whatsapp: '88886666',
      telefono: '22224444',
    };

    let actividadPrincipalExiste = false;
    await test.step('Abrir "Agregar Cliente", llenar "Principal" completo, e intentar Actividad Económica (omitir sin fallar si no existe)', async () => {
      await cc.abrirAgregarCliente();
      await cc.llenarPrincipalCompleto(datosPrincipal);
      actividadPrincipalExiste = await cc.agregarActividadEconomicaPrincipalSiExiste();
      console.log(`[Escenario 3] Actividad Económica principal: ${actividadPrincipalExiste ? 'tiene opciones reales, se seleccionó una' : 'sin opciones para esta compañía, se omitió'}`);
    });

    let filasActividadesSecundarias = 0;
    if (actividadPrincipalExiste) {
      await test.step('Agregar varias actividades económicas secundarias', async () => {
        filasActividadesSecundarias = await cc.agregarFilaActividadEconomicaSecundaria();
        filasActividadesSecundarias = await cc.agregarFilaActividadEconomicaSecundaria();
        console.log(`[Escenario 3] Filas de actividad económica secundaria agregadas: ${filasActividadesSecundarias}`);
      });
    }

    let idCreado = '';
    await test.step('Guardar y validar el mensaje de creación exitosa', async () => {
      const resultado = await cc.guardarCliente();
      expect(resultado.respuesta.ok()).toBe(true);
      expect(Number(resultado.id)).toBeGreaterThan(0);
      idCreado = resultado.id;
    });

    await test.step('Buscar el cliente y validar que los datos persistieron al reabrirlo', async () => {
      await buscarYReabrirCliente(pos, cc, datosPrincipal.nombre);
      await expect(cc.modal.locator('#c_name')).toHaveValue(datosPrincipal.nombre.trim());
      await expect(cc.modal.locator('#c_identifier')).toHaveValue(datosPrincipal.identificacion);
      if (actividadPrincipalExiste) {
        await expect(
          cc.modal.locator('#c_principal_economic_activity_chosen .chosen-single span'),
          'La Actividad Económica principal no persistió (sigue en el placeholder) a pesar de haber tenido opciones reales al guardar'
        ).not.toHaveText('Seleccionar opción');
      }
      await cerrarModalClienteSiAbierto(cc, sharedPage);
    });

    await validarSinMensajesDeErrorCliente(sharedPage);
    await validarSinModalesInesperadosCliente(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    console.log(`[Escenario 3] Cliente creado con id=${idCreado}`);
  });


  testCliente('4. Crear cliente completo con información de vehículo completa', async ({ pos, cc, sharedPage }) => {
    testCliente.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    const sufijo = Date.now();
    const datosPrincipal: DatosClientePrincipal = {
      nombre: `QA Cliente Vehiculo Completo ${sufijo}`,
      identificacion: `${sufijo}`.slice(-9),
      email: `qa.cliente.vehiculo.${sufijo}@example.com`,
      codigo: `COD-QA-${sufijo}`,
      batch: `BATCH-QA-${sufijo}`,
      direccion: 'Dirección de prueba generada por automatización QA.',
      whatsapp: '88885555',
      telefono: '22225555',
    };
    const datosVehiculo: DatosVehiculoCompleto = {
      placa: `QA-${sufijo}`.slice(-8),
      numeroUnidad: `UNIT-${sufijo}`.slice(-10),
      chasis: `CHASIS-${sufijo}`,
    };

    await test.step('Abrir "Agregar Cliente" y llenar todos los datos del cliente ("Principal")', async () => {
      await cc.abrirAgregarCliente();
      await cc.llenarPrincipalCompleto(datosPrincipal);
    });

    await test.step('Activar "Información de vehículo" y llenar TODOS los campos disponibles', async () => {
      await cc.activarSeccionVehiculo();
      await cc.llenarVehiculoCompleto(datosVehiculo);
      await cc.agregarVehiculoALaTabla();
    });

    let idCreado = '';
    await test.step('Guardar y validar el mensaje de creación exitosa', async () => {
      const resultado = await cc.guardarCliente();
      expect(resultado.respuesta.ok()).toBe(true);
      expect(Number(resultado.id)).toBeGreaterThan(0);
      idCreado = resultado.id;
    });

    await test.step('Buscar el cliente y validar que el vehículo quedó asociado correctamente al reabrirlo', async () => {
      await buscarYReabrirCliente(pos, cc, datosPrincipal.nombre);
      await expect(cc.modal.locator('#c_name')).toHaveValue(datosPrincipal.nombre.trim());

      const filasVehiculo = cc.modal.locator('#table_client_vehicle tr');
      await expect(filasVehiculo, 'El vehículo agregado no aparece en la tabla de vehículos tras reabrir el cliente').toHaveCount(1);
      await expect(filasVehiculo.first(), 'La placa del vehículo no coincide').toContainText(datosVehiculo.placa);
      await expect(filasVehiculo.first(), 'El número de chasis del vehículo no coincide').toContainText(datosVehiculo.chasis);

      await cerrarModalClienteSiAbierto(cc, sharedPage);
    });

    await validarSinMensajesDeErrorCliente(sharedPage);
    await validarSinModalesInesperadosCliente(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    console.log(`[Escenario 4] Cliente creado con id=${idCreado}`);
  });


  testCliente('5. Crear cliente sencillo con vehículo básico (Placa, Marca, Modelo, Año)', async ({ pos, cc, sharedPage }) => {
    testCliente.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    const sufijo = Date.now();
    const datos: DatosClienteSencillo = {
      nombre: `QA Cliente Vehiculo Basico ${sufijo}`,
      identificacion: `${sufijo}`.slice(-9),
      email: `qa.cliente.vehiculobasico.${sufijo}@example.com`,
    };
    const placa = `QA-${sufijo}`.slice(-8);

    await test.step('Abrir "Agregar Cliente" y llenar el cliente sencillo', async () => {
      await cc.abrirAgregarCliente();
      await cc.llenarClienteSencillo(datos);
    });

    await test.step('Activar "Información de vehículo" y llenar únicamente Placa, Marca, Modelo y Año', async () => {
      await cc.activarSeccionVehiculo();
      await cc.llenarVehiculoBasico(placa);
      await cc.agregarVehiculoALaTabla();
    });

    let idCreado = '';
    await test.step('Guardar y validar el mensaje de creación exitosa', async () => {
      const resultado = await cc.guardarCliente();
      expect(resultado.respuesta.ok()).toBe(true);
      expect(Number(resultado.id)).toBeGreaterThan(0);
      idCreado = resultado.id;
    });

    await test.step('Buscar el cliente y validar que el vehículo básico quedó registrado al reabrirlo', async () => {
      await buscarYReabrirCliente(pos, cc, datos.nombre);
      await expect(cc.modal.locator('#c_name')).toHaveValue(datos.nombre.trim());

      const filasVehiculo = cc.modal.locator('#table_client_vehicle tr');
      await expect(filasVehiculo, 'El vehículo básico agregado no aparece en la tabla de vehículos tras reabrir el cliente').toHaveCount(1);
      await expect(filasVehiculo.first(), 'La placa del vehículo no coincide').toContainText(placa);

      await cerrarModalClienteSiAbierto(cc, sharedPage);
    });

    await validarSinMensajesDeErrorCliente(sharedPage);
    await validarSinModalesInesperadosCliente(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
    console.log(`[Escenario 5] Cliente creado con id=${idCreado}`);
  });
});
