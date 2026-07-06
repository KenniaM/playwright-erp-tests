import { test, expect, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, CABYS_BUSQUEDA, CABYS_BUSQUEDA_SIN_IVA, MONTO_EFECTIVO, PRECIO_PRODUCTO_RAPIDO, COMBO_BUSQUEDA_PRODUCTO, LineaCarrito } from './pos.page';

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

/**
 * Presiona el primer "Facturar" (abre el modal de pago). Este botón nunca requiere
 * abrir la caja —eso solo puede ocurrir al confirmar el pago, más adelante— así que
 * aquí no se valida ni se intenta abrir la caja en ningún caso.
 */
async function abrirModalDePago(pos: PosPage) {
  await pos.presionarFacturar();
  await pos.esperarModalPago();
}

/**
 * Espera (con reintentos reales, no una pausa fija) a que la condición de
 * "activo" dada se cumpla — usado para confirmar que una categoría o un tab
 * quedó seleccionado tras hacer click.
 */
async function esperarQuedaActivo(chequeoActivo: () => Promise<boolean>) {
  await expect.poll(chequeoActivo).toBe(true);
}

/**
 * Presiona el "Facturar" del modal de pago (confirma el pago) y monitorea lo que
 * ocurre después, sin asumir que el modal "Abrir Caja" —si aparece— lo hace
 * inmediatamente: el backend puede tardar en procesar la solicitud antes de
 * mostrarlo. Por la misma razón, la ventana de impresión puede abrirse de forma
 * síncrona junto con la respuesta del click, así que la espera de ambos eventos
 * (popup y modal) se arma ANTES de cada click —incluidos los reintentos—, nunca
 * después: un listener registrado después del click puede perderse el evento.
 *
 * Si el modal "Abrir Caja" aparece en cualquier momento antes de terminar la
 * facturación (comportamiento esperado, no un error), se valida, se completa la
 * apertura, se confirma que desapareció y se vuelve a presionar "Facturar" —con
 * las esperas nuevamente armadas antes de ese click— hasta obtener el resultado
 * final: la ventana de impresión, que sí forma parte del flujo real del sistema.
 */
async function confirmarPagoAbriendoCajaSiEsNecesario(pos: PosPage, page: Page) {
  const MAX_INTENTOS = 3;

  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const popupPromise = page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP })
      .then((printPage) => ({ tipo: 'popup' as const, printPage }));
    const modalPromise = pos.modalAbrirCaja.waitFor({ state: 'visible', timeout: TIMEOUTS.PRINT_POPUP })
      .then(() => ({ tipo: 'modalAbrirCaja' as const }));

    await pos.presionarConfirmarPago();
    await pos.cerrarAvisoConsecutivoSiAparece();

    const resultado = await Promise.race([popupPromise, modalPromise]);

    if (resultado.tipo === 'popup') {
      await pos.mostrarYCerrarVentanaImpresion(resultado.printPage);
      return;
    }

    // El modal "Abrir Caja" apareció: se valida, se completa la apertura y se
    // confirma que desapareció antes de volver al inicio del ciclo, donde se arma
    // una nueva espera de popup/modal antes del siguiente click en "Facturar".
    await expect(pos.modalAbrirCaja).toBeVisible();
    await pos.completarAperturaCaja();
    await expect(pos.modalAbrirCaja).toBeHidden();
  }

  throw new Error(
    `La facturación no se completó tras ${MAX_INTENTOS} intentos de abrir la caja: ` +
    'el sistema siguió pidiendo abrir la caja o nunca mostró la ventana de impresión.'
  );
}

/**
 * Agrega un producto rápido al carrito para las pruebas de validación de
 * IVA, con la cantidad indicada. Reutiliza los métodos ya existentes de
 * PosPage —abrirProductoRapido, llenarDatosBasicosProductoRapido,
 * manejarCabysSiAplica, seleccionarIvaManualmente— en vez de duplicar su
 * lógica.
 *
 * Ya NO lee ni depende del checkbox del formulario "Producto Rápido"
 * (#check_quick_product_apply_tax) para determinar qué validar después: ese
 * checkbox solo sirve aquí para CONFIGURAR el producto al crearlo —sigue
 * siendo la forma real de decirle al sistema si debe llevar impuesto—, pero
 * la verificación de qué quedó realmente aplicado se hace por separado,
 * después de guardar, contra `product_hide_apply_iva_<clave>` (la única
 * fuente de verdad confirmada por el trace de red) y contra el checkbox
 * `#show_price_with_iva` (arriba del carrito) para saber qué total leer —
 * ver `validarLineaCarrito()` en pos.page.ts.
 *
 * Cuando `activarIva` es true: si el CABYS aparece, lo completa (el IVA se
 * autocompleta a partir de él); si no aparece, lo selecciona manualmente.
 * Cuando es false: no toca CABYS ni el checkbox de IVA en absoluto —queda
 * en su estado por defecto, sin marcar—, que es la forma real de guardar
 * un producto sin IVA en este ambiente (confirmado en vivo: el país
 * configurado actualmente para esta compañía no exige CABYS para poder
 * guardar).
 */
async function agregarProductoRapidoParaValidacionIva(
  pos: PosPage,
  nombre: string,
  precio: string,
  activarIva: boolean,
  cantidad = 1
) {
  await pos.abrirProductoRapido();
  await pos.llenarDatosBasicosProductoRapido(nombre, precio);
  if (cantidad !== 1) {
    await pos.establecerCantidadProductoRapido(cantidad);
  }

  if (activarIva) {
    const cabysAplicado = await pos.manejarCabysSiAplica(CABYS_BUSQUEDA);
    if (cabysAplicado) {
      await pos.esperarIvaAutocompletado();
    } else {
      await pos.seleccionarIvaManualmente();
    }
  }

  await pos.guardarProductoRapidoYObtenerRespuesta();
  await expect(pos.modalProductoRapido).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
}

/**
 * Pasos comunes a ambos escenarios de "Crear Combo": abrir el modal, llenar
 * nombre/cantidad y agregar un producto real. El manejo del checkbox de IVA
 * y de CABYS es responsabilidad de cada escenario (crearComboConIva /
 * crearComboSinIva), porque el orden entre ambos —no solo su presencia—
 * determina el resultado (ver el comentario de activarIvaCombo() en
 * pos.page.ts): factorizarlo aquí evitaría poder expresar ese orden.
 */
async function abrirCrearComboConProducto(pos: PosPage, nombre: string) {
  await pos.abrirCrearCombo();
  await pos.llenarDatosBasicosCombo(nombre);
  await pos.buscarYAgregarPrimerProductoAlCombo(COMBO_BUSQUEDA_PRODUCTO);
}

/**
 * Fija un precio válido y guarda el combo ya configurado, validando la
 * respuesta real de red (save_company_combo) — mismo cierre para ambos
 * escenarios, sin duplicarlo.
 */
async function guardarComboConfigurado(pos: PosPage) {
  await pos.establecerPrecioValidoCombo();

  const respuesta = await pos.guardarComboYObtenerRespuesta();
  expect(respuesta.ok(), `La petición a save_company_combo no respondió OK (status ${respuesta.status()})`).toBe(true);
  await expect(pos.modalCrearCombo).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
}

/**
 * Escenario "Crear Combo con IVA": activa el checkbox "¿Aplicar impuesto?"
 * PRIMERO y verifica que quedó marcado, y solo después maneja CABYS (si el
 * formulario lo ofrece en este ambiente — depende del país configurado para
 * la compañía, no es fijo). Ese orden es obligatorio, no cosmético:
 * confirmado en vivo que el select de tasa (`#tax_rate_list`) SOLO se
 * autosincroniza con la tasa real del CABYS aplicado si el checkbox ya
 * estaba activado en ese momento — con el checkbox desmarcado, aplicar el
 * mismo CABYS deja el select en su valor por defecto ("0% Exento") sin
 * tocarlo. Por eso, a diferencia de una versión anterior de este helper,
 * activarIvaCombo() ya no se limita a ser un respaldo para cuando CABYS no
 * aparece: es el primer paso siempre.
 *
 * Si CABYS aparece, se aplica (CABYS_BUSQUEDA = "aceite", tasa 13%) y se
 * valida que la tasa seleccionada en el combo coincide exactamente con la
 * tasa que el propio CABYS sugiere (validarIvaCoincideConCabysCombo()) — no
 * solo que "algo" quedó aplicado. Si CABYS no aparece, no se lo toca: el
 * checkbox ya activado en el paso anterior es la única señal de "con IVA"
 * disponible en ese ambiente.
 *
 * Devuelve si CABYS terminó aplicado, para que el test lo registre.
 */
async function crearComboConIva(pos: PosPage, nombre: string): Promise<boolean> {
  await abrirCrearComboConProducto(pos, nombre);

  await pos.activarIvaCombo();
  await expect(
    pos.checkboxIvaCombo,
    'El checkbox "¿Aplicar impuesto?" de "Crear Combo" no quedó activado'
  ).toBeChecked();

  const cabysAplicado = await pos.manejarCabysSiAplica(CABYS_BUSQUEDA, pos.configCabysCombo);
  if (cabysAplicado) {
    await pos.validarIvaCoincideConCabysCombo();
  }

  await guardarComboConfigurado(pos);
  return cabysAplicado;
}

/**
 * Escenario "Crear Combo sin IVA": "sin IVA" es simplemente no agregarlo —
 * el checkbox "¿Aplicar impuesto?" ya está desactivado por defecto al abrir
 * el modal, así que no hace falta tocarlo de entrada. "Sin IVA" tampoco se
 * simula buscando deliberadamente un CABYS de clasificación "Exento":
 * CABYS es un campo fiscal obligatorio independiente del checkbox, así que
 * se usa el mismo término que el escenario "con IVA" (CABYS_BUSQUEDA,
 * "aceite") si el formulario lo ofrece en este ambiente.
 *
 * Aplicar ese CABYS SÍ activa el checkbox de IVA como efecto secundario —
 * confirmado en vivo, con un desfase de ~500ms (ver
 * esperarIvaAutocompletadoCombo(), homóloga de esperarIvaAutocompletado()
 * de Producto Rápido) — así que hay que ESPERAR esa activación automática
 * antes de revertirla: desactivar el checkbox de inmediato, sin esperar,
 * corre el riesgo de ganarle la carrera al propio sistema y terminar con
 * el checkbox marcado de todos modos.
 *
 * Nota de comportamiento real del sistema (confirmado en vivo): esperando
 * correctamente esa auto-activación antes de revertirla, el checkbox
 * termina realmente desactivado, y el combo queda guardado con
 * `product_hide_apply_iva_<clave>="0"` e IVA real = 0 en el carrito, sin
 * importar si se aplicó un CABYS o no — a diferencia de lo que se había
 * observado en una versión anterior de este flujo (que leía el checkbox
 * antes de que la auto-activación disparara, y por eso el "desactivar"
 * corría antes de que hubiera algo real que desactivar, dejando el
 * checkbox marcado al final). "Sin IVA" es entonces siempre
 * ivaAplicado=false en la línea del carrito, consistente con que el
 * checkbox es lo único que define este escenario.
 *
 * Devuelve si CABYS terminó aplicado, para que el test lo registre.
 */
async function crearComboSinIva(pos: PosPage, nombre: string): Promise<boolean> {
  await abrirCrearComboConProducto(pos, nombre);

  const cabysAplicado = await pos.manejarCabysSiAplica(CABYS_BUSQUEDA, pos.configCabysCombo);
  if (cabysAplicado) {
    await pos.esperarIvaAutocompletadoCombo();
    await pos.desactivarIvaCombo();
  }

  await expect(
    pos.checkboxIvaCombo,
    'El checkbox "¿Aplicar impuesto?" de "Crear Combo" no quedó desactivado'
  ).not.toBeChecked();

  await guardarComboConfigurado(pos);
  return cabysAplicado;
}

/**
 * Busca por nombre exacto el combo recién creado en la categoría "Combos"
 * (reutilizando productoPorNombre/agregarProductoPorNombre, igual que el
 * resto de la suite para cualquier producto del catálogo) y devuelve la
 * clave de la línea que se agregó al carrito.
 */
async function buscarComboYAgregarAlCarrito(pos: PosPage, nombre: string): Promise<string> {
  await pos.categoriaCombos.click();
  await esperarQuedaActivo(() => pos.categoriaEstaActiva(pos.categoriaCombos));
  await expect(
    pos.productoPorNombre(nombre),
    `El combo "${nombre}" no aparece en la categoría "Combos"`
  ).toHaveCount(1, { timeout: TIMEOUTS.PRODUCTS_LOAD });

  const clavesAntes = await pos.obtenerClavesProductos();
  await pos.agregarProductoPorNombre(nombre);
  await expect.poll(async () => (await pos.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntes.length);
  const clavesDespues = await pos.obtenerClavesProductos();
  return clavesDespues.find(c => !clavesAntes.includes(c))!;
}

test('agregar producto rápido con IVA en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard (evita la condición de carrera del binding de "Agregar")', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
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
    await abrirModalDePago(pos);
  });

  await test.step('Pagar en efectivo', async () => {
    await pos.seleccionarPagoEfectivo(MONTO_EFECTIVO);
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await confirmarPagoAbriendoCajaSiEsNecesario(pos, page);
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
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
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
    await abrirModalDePago(pos);
  });

  await test.step('Pagar en efectivo', async () => {
    await pos.seleccionarPagoEfectivo(MONTO_EFECTIVO);
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await confirmarPagoAbriendoCajaSiEsNecesario(pos, page);
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
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
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
    await agregarProductoRapidoParaValidacionIva(pos, `Validación IVA A ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO, true, 1);
    let clavesDespues = await pos.obtenerClavesProductos();
    claves.push(clavesDespues.find(c => !clavesAntes.includes(c))!);

    clavesAntes = clavesDespues;
    await agregarProductoRapidoParaValidacionIva(pos, `Validación IVA B ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO, true, 2);
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
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
  });

  // Misma lógica que el escenario "con IVA": la expectativa es la intención
  // propia del test, no algo leído de ningún checkbox del formulario.
  const IVA_ESPERADO = false;
  const claves: string[] = [];
  await test.step('Agregar dos productos rápidos con IVA desactivado, con distinta cantidad cada uno', async () => {
    let clavesAntes = await pos.obtenerClavesProductos();
    await agregarProductoRapidoParaValidacionIva(pos, `Validación sin IVA A ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO, false, 1);
    let clavesDespues = await pos.obtenerClavesProductos();
    claves.push(clavesDespues.find(c => !clavesAntes.includes(c))!);

    clavesAntes = clavesDespues;
    await agregarProductoRapidoParaValidacionIva(pos, `Validación sin IVA B ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO, false, 3);
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
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
  });

  const nombreCombo = `Combo QA con IVA ${Date.now()}`;

  await test.step('Crear el combo: activar IVA, verificarlo, y agregar CABYS si el formulario lo ofrece (validando que su tasa coincide con la seleccionada)', async () => {
    const cabysAplicado = await crearComboConIva(pos, nombreCombo);
    console.log(`[crear un Combo con IVA] cabysAplicado=${cabysAplicado}`);
  });

  let claveCombo = '';
  await test.step('Buscar el combo en la categoría "Combos" y agregarlo al carrito', async () => {
    claveCombo = await buscarComboYAgregarAlCarrito(pos, nombreCombo);
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
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
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
    cabysAplicado = await crearComboSinIva(pos, nombreCombo);
    console.log(`[crear un Combo sin IVA] cabysAplicado=${cabysAplicado}`);
  });

  let claveCombo = '';
  await test.step('Buscar el combo en la categoría "Combos" y agregarlo al carrito', async () => {
    claveCombo = await buscarComboYAgregarAlCarrito(pos, nombreCombo);
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
  await pos.cerrarModalNotificacionesSiAparece();
  await pos.cerrarAvisoConsecutivoSiAparece();
  await pos.cerrarTodosLosToastsSiAparecen();

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
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
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
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
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
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
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
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
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
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
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
    await pos.cerrarModalNotificacionesSiAparece();
    await pos.cerrarAvisoConsecutivoSiAparece();
    await pos.cerrarTodosLosToastsSiAparecen();
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
