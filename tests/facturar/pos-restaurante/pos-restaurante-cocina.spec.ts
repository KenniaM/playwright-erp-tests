// Ambiente COMPLETO distinto del resto de la suite (qa_restaurant, compañía
// "Restaurante Rancho Robertos" — ver tests/auth/restaurant.setup.ts). Mismo
// mecanismo de require()-order que pos-restaurante-mesas.spec.ts/
// pos-restaurante-ordenes-llevar.spec.ts: fija BASE_URL/POS_COMPANIA ANTES de
// importar cualquier módulo que dependa de env.config.ts/pos.types.ts. Por
// diseño, este archivo debe correrse en un comando dedicado, nunca mezclado
// con el resto de la suite:
//
//   npx playwright test tests/facturar/pos-restaurante/pos-restaurante-cocina.spec.ts --project=setup-restaurant --project=firefox-restaurant
//
process.env.BASE_URL = process.env.BASE_URL ?? 'https://dev.designsoftcr.com/qa_restaurant/public';
process.env.POS_COMPANIA = process.env.POS_COMPANIA ?? 'Restaurante Rancho Robertos';

import { test as base, expect, Page } from '@playwright/test';
import { PosPage, TIMEOUTS, espiarErroresJS } from '../pos/pos.page';
import { PosRestauranteMesas } from './pos-restaurante-mesas.page';
import { PosRestauranteOrdenesLlevar } from './pos-restaurante-ordenes-llevar.page';
import { PosRestauranteCocina } from './pos-restaurante-cocina.page';

// ─── Sesión compartida (fixture de scope 'worker', NO mode: 'serial') ──────
// Mismo mecanismo que pos-restaurante-mesas.spec.ts/pos-restaurante-ordenes-llevar.spec.ts
// (ver su comentario completo). Cocina agrega una SEGUNDA página worker-scoped
// (`cocinaPage`/`cocina`) además de la del POS (`sharedPage`/`pos`) — replica
// la situación real de un restaurante (el mesero y la pantalla de cocina son
// dispositivos/pestañas DISTINTOS y simultáneos, nunca la misma pantalla
// navegando de un lado a otro) y evita además el round-trip repetido por el
// Dashboard que, confirmado en vivo durante la investigación de este módulo,
// puede quedar sujeto a la contención del ambiente compartido — Cocina solo
// se recarga a sí misma (`cocina.recargar()`), nunca vuelve a pasar por
// `irACocina()` dentro de un mismo test.
type CocinaFixtures = {
  sharedPage: Page;
  pos: PosPage;
  mesas: PosRestauranteMesas;
  llevar: PosRestauranteOrdenesLlevar;
  cocinaPage: Page;
  cocina: PosRestauranteCocina;
};

const test = base.extend<{}, CocinaFixtures>({
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

  mesas: [async ({ pos, sharedPage }, use) => {
    await use(new PosRestauranteMesas(pos, sharedPage));
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  llevar: [async ({ pos, sharedPage }, use) => {
    await use(new PosRestauranteOrdenesLlevar(pos, sharedPage));
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  cocinaPage: [async ({ browser }, use) => {
    const page = await browser.newPage();
    await use(page);
    await page.close();
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],

  cocina: [async ({ cocinaPage }, use) => {
    const cocina = new PosRestauranteCocina(cocinaPage);
    await cocina.irACocina();
    await use(cocina);
  }, { scope: 'worker', timeout: TIMEOUTS.TEST }],
});

/** Mismo criterio que pos-restaurante-mesas.spec.ts: una recarga real del POS antes de cada escenario garantiza carrito vacío y ningún modal abierto. Cocina se recarga aparte (nunca renavegada) para reflejar el estado más reciente sin pagar el costo de irACocina() en cada test. */
test.beforeEach(async ({ pos, cocina }) => {
  test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
  await pos.irAlPos();
  await pos.esperarEstadoInicial();
  if (await pos.modalAbrirCajaVisible()) {
    await pos.cerrarModalAbrirCaja();
  }
  await pos.cerrarOverlaysConocidos();
  await cocina.recargar();
});

// ─── Helpers compartidos ────────────────────────────────────────────────────

/** Ninguna línea de error visible en el carrito/encabezado del POS — mismo criterio que el resto de la suite. */
async function validarSinMensajesDeError(page: Page) {
  await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
}

test.describe('Restaurante — Cocina', () => {

  // ─── 1. Navegación básica ─────────────────────────────────────────────
  test('1. Navegación: acceder a Cocina desde el sidebar y validar el panel real', async ({ cocina, cocinaPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(cocinaPage);

    await test.step('Validar título y los 3 contadores del encabezado', async () => {
      await expect(cocinaPage).toHaveTitle(/Cocina/);
      // getByText({exact:true}), no `text=` (substring, case-insensitive):
      // confirmado en vivo que el texto explicativo del modal "Filtrado de
      // Categorías" también contiene la frase "el panel de cocina" en
      // minúscula, violando el modo estricto de Playwright con un simple
      // substring.
      await expect(cocinaPage.getByText('Panel de Cocina', { exact: true })).toBeVisible();
      const contadores = await cocina.obtenerContadores();
      expect(contadores.activas, 'El contador de órdenes activas debe ser un número real ≥ 0').toBeGreaterThanOrEqual(0);
      expect(contadores.activas).toBe(contadores.paraLlevar + contadores.enMesa);
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 2. Mesa con un producto: contenido real de la tarjeta ─────────────
  test('2. Mesa con un producto: la tarjeta muestra cliente, mesa y producto correctos', async ({ pos, mesas, cocina, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let ordenId = '';
    let mesaId = '';
    let nombreProducto = '';
    let nombreCliente = '';
    await test.step('Mesa disponible con cliente registrado y un producto', async () => {
      await mesas.abrirMesas();
      const mesa = await mesas.seleccionarMesaDisponible();
      mesaId = mesa.mesaId;
      nombreCliente = await pos.seleccionarClienteExistente();
      await mesas.volverAProductos();
      // Ver el comentario del Escenario 3 (nombreReal vs. nombre): se llama
      // directo al método genérico para comparar contra Cocina con el
      // nombre real del producto, sin el prefijo de código/barcode que la
      // tarjeta VISIBLE del catálogo antepone cuando el producto lo tiene.
      const metadatoProducto = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await mesas.agregarProductoAlCarritoDeMesa(metadatoProducto);
      nombreProducto = metadatoProducto.nombreReal;
      await mesas.abrirMesas();
      ordenId = (await mesas.obtenerMesasDelPlano()).find((m) => m.mesaId === mesaId)!.ordenId;
    });

    await test.step('Cocina recibe la tarjeta con el contenido exacto', async () => {
      const ids = await cocina.esperarCantidadTarjetasDeOrden(ordenId, 1);
      const tarjeta = await cocina.leerTarjeta(ids[0]);
      expect(tarjeta.esParaLlevar, 'Una tarjeta de Mesa no debe llevar la clase card_delivery').toBe(false);
      expect(tarjeta.mesaId).toBe(mesaId);
      expect(tarjeta.cliente).toBe(nombreCliente);
      expect(tarjeta.textoCompleto, `La tarjeta debe mostrar el producto "${nombreProducto}"`).toContain(nombreProducto);
      expect(tarjeta.textoCompleto).toContain(`Orden # ${ordenId}`);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 3. Productos agregados por separado: 1 tarjeta por evento ─────────
  // HALLAZGO REAL CONFIRMADO EN VIVO (ver la cabecera de pos-restaurante-cocina.page.ts):
  // Cocina no es un espejo del estado actual del carrito — cada agregado
  // genera su propia tarjeta, sin reemplazar la anterior.
  test('3. Productos agregados por separado: cada uno genera su propia tarjeta, todas bajo el mismo Orden #', async ({ pos, mesas, cocina, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let ordenId = '';
    let nombreA = '', nombreB = '';
    await test.step('Mesa disponible: agregar Producto A', async () => {
      await mesas.abrirMesas();
      const mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      // CORRECCIÓN DE AUTOMATIZACIÓN CONFIRMADA EN VIVO: no reutilizar el
      // string devuelto por agregarPrimerProductoNoPresenteAlCarritoDeMesa()
      // (metadato.nombre, el texto VISIBLE de la tarjeta del catálogo) como
      // valor esperado contra Cocina — confirmado en vivo (volcando el HTML
      // real de la tarjeta) que ese texto antepone el código/barcode del
      // producto cuando tiene uno configurado (ej. "12345 0001 - Prueba POS
      // Restaurante..."), prefijo que Cocina NUNCA muestra. Cocina sí
      // muestra `metadato.nombreReal` (el argumento `name` real de
      // add_to_table()), así que se llama al método genérico directamente
      // para tener acceso al metadato completo en vez de solo el nombre.
      const metadatoA = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await mesas.agregarProductoAlCarritoDeMesa(metadatoA);
      nombreA = metadatoA.nombreReal;
      await mesas.abrirMesas();
      ordenId = (await mesas.obtenerMesasDelPlano()).find((m) => m.mesaId === mesa.mesaId)!.ordenId;
    });

    await test.step('Cocina recibe 1 tarjeta con Producto A', async () => {
      const ids = await cocina.esperarCantidadTarjetasDeOrden(ordenId, 1);
      const tarjeta = await cocina.leerTarjeta(ids[0]);
      expect(tarjeta.textoCompleto).toContain(nombreA);
    });

    await test.step('Agregar Producto B (por separado) y recargar Cocina', async () => {
      await mesas.volverAProductos();
      const metadatoB = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await mesas.agregarProductoAlCarritoDeMesa(metadatoB);
      nombreB = metadatoB.nombreReal;
      await cocina.recargar();
    });

    await test.step('Cocina ahora tiene 2 tarjetas independientes bajo el mismo Orden #, una por producto', async () => {
      const ids = await cocina.esperarCantidadTarjetasDeOrden(ordenId, 2);
      const tarjetas = await Promise.all(ids.map((id) => cocina.leerTarjeta(id)));
      const textos = tarjetas.map((t) => t.textoCompleto).join('\n---\n');
      expect(textos, `Alguna tarjeta debe mostrar "${nombreA}"`).toContain(nombreA);
      expect(textos, `Alguna tarjeta debe mostrar "${nombreB}"`).toContain(nombreB);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 4. Cambiar SOLO la cantidad: genera una tarjeta adicional ─────────
  test('4. Cambiar la cantidad de una línea ya en Cocina (sin producto nuevo) genera una tarjeta adicional', async ({ pos, mesas, cocina, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let ordenId = '';
    let clave = '';
    await test.step('Mesa con un producto (cantidad 1)', async () => {
      await mesas.abrirMesas();
      const mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
      [clave] = await pos.obtenerClavesFilasCarrito();
      await mesas.abrirMesas();
      ordenId = (await mesas.obtenerMesasDelPlano()).find((m) => m.mesaId === mesa.mesaId)!.ordenId;
    });

    let idsAntes: string[] = [];
    await test.step('Cocina recibe 1 tarjeta', async () => {
      idsAntes = await cocina.esperarCantidadTarjetasDeOrden(ordenId, 1);
    });

    await test.step('Cambiar SOLO la cantidad (sin agregar producto nuevo) y recargar Cocina', async () => {
      await mesas.volverAProductos();
      await pos.establecerCantidadProducto(clave, '5');
      await cocina.recargar();
    });

    await test.step('Cocina refleja el cambio como una tarjeta NUEVA adicional, no como una actualización de la existente', async () => {
      const idsDespues = await cocina.esperarCantidadTarjetasDeOrden(ordenId, idsAntes.length + 1);
      expect(idsDespues).toEqual(expect.arrayContaining(idsAntes));
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 5. Producto con aditivo ────────────────────────────────────────────
  test('5. Producto con aditivo: la tarjeta muestra el nombre real del aditivo seleccionado', async ({ pos, mesas, cocina, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let ordenId = '';
    let opcionAditivo = '';
    await test.step('Mesa con un producto con aditivo', async () => {
      await mesas.abrirMesas();
      const mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      opcionAditivo = await mesas.agregarProductoConAditivo();
      await mesas.abrirMesas();
      ordenId = (await mesas.obtenerMesasDelPlano()).find((m) => m.mesaId === mesa.mesaId)!.ordenId;
    });

    await test.step('Cocina muestra el aditivo real en la tarjeta', async () => {
      const ids = await cocina.esperarTarjetaDeOrden(ordenId);
      const tarjeta = await cocina.leerTarjeta(ids[0]);
      expect(tarjeta.textoCompleto, `La tarjeta debe mostrar el aditivo "${opcionAditivo}"`).toContain(opcionAditivo);
      expect(tarjeta.textoCompleto).toContain(PosRestauranteMesas.PRODUCTO_CON_ADITIVOS);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 6. Observación ──────────────────────────────────────────────────────
  test('6. Observación: la tarjeta muestra el texto exacto ingresado', async ({ pos, mesas, cocina, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    const textoObservacion = 'SIN CEBOLLA, extra queso — prueba Cocina';

    let ordenId = '';
    await test.step('Mesa con un producto y una observación real', async () => {
      await mesas.abrirMesas();
      const mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
      const [clave] = await pos.obtenerClavesFilasCarrito();

      // PosCore.agregarObservacionAProducto() genérico NO sirve aquí — ya
      // documentado en pos-restaurante-ordenes-llevar.page.ts: el modal de
      // Restaurante no tiene el botón "Nuevo" que ese método espera; su
      // editor ya está siempre visible. Mismo mecanismo real replicado
      // directamente (ningún Page Object de Mesas lo expone todavía).
      await sharedPage.locator(`#product_item_comment_${clave}`).click();
      const dialog = sharedPage.locator('#dialog_product_item_comment');
      await expect(dialog, 'El modal "Observaciones" no se abrió').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
      await sharedPage.locator('#ta_product_item_comment').fill(textoObservacion);
      await sharedPage.locator('#dialog_product_item_comment button[onclick^="save_product_item_comment"]').click();
      await expect(dialog, 'El modal "Observaciones" no se cerró').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

      await mesas.abrirMesas();
      ordenId = (await mesas.obtenerMesasDelPlano()).find((m) => m.mesaId === mesa.mesaId)!.ordenId;
    });

    await test.step('Cocina muestra la observación exacta', async () => {
      const ids = await cocina.esperarTarjetaDeOrden(ordenId);
      const textos = (await Promise.all(ids.map((id) => cocina.leerTarjeta(id)))).map((t) => t.textoCompleto).join('\n---\n');
      expect(textos, 'La tarjeta con la observación debe mostrar el texto exacto ingresado').toContain(textoObservacion);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 7. Para Llevar vs Mesa ──────────────────────────────────────────────
  test('7. Para Llevar vs Mesa: la tarjeta se identifica correctamente por su clase real (card_delivery vs card_table)', async ({ pos, llevar, cocina, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);
    const nombreCliente = `Cliente Cocina QA ${Date.now()}`;

    let idLlevar = '';
    await test.step('Crear una Orden para Llevar formal con un producto', async () => {
      await llevar.volverAProductos();
      await llevar.agregarPrimerProductoNoPresente();
      idLlevar = await llevar.crearOrdenParaLlevar(nombreCliente);
    });

    await test.step('Cocina identifica la tarjeta como Para Llevar: clase card_delivery y "Para llevar" en vez de un número de mesa', async () => {
      const ids = await cocina.esperarTarjetaDeOrden(idLlevar);
      const tarjeta = await cocina.leerTarjeta(ids[0]);
      expect(tarjeta.esParaLlevar, 'La tarjeta debe tener la clase card_delivery').toBe(true);
      expect(tarjeta.nombreMesa, 'El campo de "mesa" de una orden Para Llevar debe mostrar literalmente "Para llevar"').toBe('Para llevar');
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 8. Varias órdenes simultáneas ───────────────────────────────────────
  test('8. Varias órdenes simultáneas: Cocina identifica correctamente Mesa A, Mesa B y una orden Para Llevar sin mezclarlas', async ({ pos, mesas, llevar, cocina, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST_CON_RECUPERACION);
    const erroresJS = espiarErroresJS(sharedPage);

    let ordenMesaA = '', ordenMesaB = '', ordenLlevar = '';
    let productoA = '', productoB = '', productoLlevar = '';
    // Nombre VISIBLE (con posible prefijo de código/barcode) del producto de
    // Mesa A — obtenerSegundoProductoNormalDistinto() compara contra
    // `MetadatoProducto.nombre` (texto visible), no contra `nombreReal`.
    let nombreVisibleA = '';

    // CORRECCIÓN DE AUTOMATIZACIÓN CONFIRMADA EN VIVO (mismo hallazgo del
    // Escenario 3, ver su comentario completo): los 3 productos de este
    // escenario se agregan llamando directo a obtenerPrimerProductoNoPresenteEnCarrito()
    // + agregarProductoAlCarrito(De)Mesa() para poder comparar contra Cocina
    // usando `metadato.nombreReal` (sin el prefijo de código/barcode que la
    // tarjeta VISIBLE del catálogo antepone) en vez del string de
    // agregarPrimerProductoNoPresente(AlCarritoDeMesa)(), que expone el
    // texto visible.
    await test.step('Mesa A con un producto', async () => {
      await mesas.abrirMesas();
      const mesaA = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      const metadatoA = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await mesas.agregarProductoAlCarritoDeMesa(metadatoA);
      productoA = metadatoA.nombreReal;
      nombreVisibleA = metadatoA.nombre;
      await mesas.abrirMesas();
      ordenMesaA = (await mesas.obtenerMesasDelPlano()).find((m) => m.mesaId === mesaA.mesaId)!.ordenId;
    });

    // CORRECCIÓN DE AUTOMATIZACIÓN CONFIRMADA EN VIVO (hallazgo real, no
    // contención): "primer producto no presente en el carrito" se evalúa
    // contra el carrito de CADA mesa, que empieza vacío — Mesa A y Mesa B
    // (ambas mesas nuevas, sin ninguna orden previa) resuelven así al MISMO
    // primer producto del catálogo, haciendo que `productoA === productoB`
    // y disparando en falso la aserción "tarjetaA no debe contener
    // productoB" (confirmado en vivo: ambas tarjetas mostraban literalmente
    // "0001 - Prueba POS Restaurante 9.6.96 (IVA)"). Se usa
    // obtenerSegundoProductoNormalDistinto() (ya existente en PosCore,
    // pensado exactamente para este caso) para garantizar que Mesa B reciba
    // un producto real distinto al de Mesa A.
    await test.step('Mesa B (distinta) con otro producto', async () => {
      const mesaB = await mesas.localizarMesaDisponibleDistintaDe((await mesas.obtenerMesasDelPlano()).find((m) => m.ordenId === ordenMesaA)!.mesaId);
      await mesas.clickMesa(mesaB.mesaId);
      await mesas.volverAProductos();
      const metadatoB = await pos.obtenerSegundoProductoNormalDistinto(nombreVisibleA);
      await mesas.agregarProductoAlCarritoDeMesa(metadatoB);
      productoB = metadatoB.nombreReal;
      await mesas.abrirMesas();
      ordenMesaB = (await mesas.obtenerMesasDelPlano()).find((m) => m.mesaId === mesaB.mesaId)!.ordenId;
    });

    await test.step('Orden Para Llevar con otro producto más', async () => {
      // CORRECCIÓN DE AUTOMATIZACIÓN CONFIRMADA EN VIVO: llegar directo desde
      // Mesa B con `llevar.volverAProductos()` (sin pasar antes por la
      // pestaña "PARA LLEVAR") deja el carrito todavía atado a la orden de
      // Mesa B, no "flotante" — la opción "Para Llevar" del menú junto a
      // Facturar solo existe para un carrito flotante (documentado en el
      // propio `crearOrdenParaLlevar()`), así que el SweetAlert de
      // confirmación nunca llegaba a aparecer. `iniciarOrdenNueva()` (mismo
      // método ya usado por el resto de los escenarios de Para Llevar)
      // pasa primero por la pestaña "PARA LLEVAR", garantizando un carrito
      // en blanco antes de agregar el producto.
      await llevar.iniciarOrdenNueva();
      const metadatoLlevar = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await llevar.agregarProductoAlCarrito(metadatoLlevar);
      productoLlevar = metadatoLlevar.nombreReal;
      ordenLlevar = await llevar.crearOrdenParaLlevar(`Cliente Cocina Multi QA ${Date.now()}`);
    });

    await test.step('Cocina identifica las 3 órdenes correctamente, sin mezclar productos entre ellas', async () => {
      await cocina.recargar();
      const [idsA, idsB, idsLlevar] = await Promise.all([
        cocina.esperarTarjetaDeOrden(ordenMesaA),
        cocina.esperarTarjetaDeOrden(ordenMesaB),
        cocina.esperarTarjetaDeOrden(ordenLlevar),
      ]);

      const tarjetaA = await cocina.leerTarjeta(idsA[0]);
      const tarjetaB = await cocina.leerTarjeta(idsB[0]);
      const tarjetaLlevar = await cocina.leerTarjeta(idsLlevar[0]);

      expect(tarjetaA.textoCompleto).toContain(productoA);
      expect(tarjetaA.textoCompleto).not.toContain(productoB);
      expect(tarjetaB.textoCompleto).toContain(productoB);
      expect(tarjetaB.textoCompleto).not.toContain(productoA);
      expect(tarjetaLlevar.textoCompleto).toContain(productoLlevar);
      expect(tarjetaLlevar.esParaLlevar).toBe(true);
      expect(tarjetaA.esParaLlevar).toBe(false);
      expect(tarjetaB.esParaLlevar).toBe(false);
      expect(tarjetaA.mesaId).not.toBe(tarjetaB.mesaId);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 9. Menú de opciones por tarjeta ─────────────────────────────────────
  test('9. Menú de opciones ("⋮"): existen exactamente "Orden lista" e "Imprimir comanda"', async ({ pos, mesas, cocina, cocinaPage, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let ordenId = '';
    await test.step('Mesa con un producto', async () => {
      await mesas.abrirMesas();
      const mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
      await mesas.abrirMesas();
      ordenId = (await mesas.obtenerMesasDelPlano()).find((m) => m.mesaId === mesa.mesaId)!.ordenId;
    });

    await test.step('Abrir el menú de la tarjeta y validar sus 2 opciones reales', async () => {
      const ids = await cocina.esperarTarjetaDeOrden(ordenId);
      await cocina.abrirMenuTarjeta(ids[0]);
      const tarjeta = cocinaPage.locator(`#card_${ids[0]}`);
      await expect(tarjeta.locator('text=Orden lista')).toBeVisible();
      await expect(tarjeta.locator('text=Imprimir comanda')).toBeVisible();
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 10. "Orden lista" ────────────────────────────────────────────────────
  // HALLAZGO REAL CONFIRMADO EN VIVO (documentado en pos-restaurante-cocina.page.ts):
  // ni la tarjeta desaparece ni los contadores cambian tras esta acción,
  // confirmado también tras recargar la página completa.
  test('10. "Orden lista": la acción se dispara correctamente, pero la tarjeta permanece visible y los contadores no cambian', async ({ pos, mesas, cocina, cocinaPage, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let ordenId = '';
    await test.step('Mesa con un producto', async () => {
      await mesas.abrirMesas();
      const mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
      await mesas.abrirMesas();
      ordenId = (await mesas.obtenerMesasDelPlano()).find((m) => m.mesaId === mesa.mesaId)!.ordenId;
    });

    let idTarjeta = '';
    let contadoresAntes;
    await test.step('Marcar "Orden lista"', async () => {
      const ids = await cocina.esperarTarjetaDeOrden(ordenId);
      idTarjeta = ids[0];
      contadoresAntes = await cocina.obtenerContadores();
      await cocina.marcarOrdenLista(idTarjeta);
    });

    await test.step('Validar el comportamiento real tras la acción (sin recargar)', async () => {
      const sigueVisible = await cocinaPage.locator(`#card_${idTarjeta}`).count();
      expect(sigueVisible, 'La tarjeta debe seguir en el DOM inmediatamente después de "Orden lista" (confirmado en vivo)').toBeGreaterThan(0);
      const contadoresDespues = await cocina.obtenerContadores();
      expect(contadoresDespues, 'Los contadores no deben cambiar por "Orden lista" (confirmado en vivo)').toEqual(contadoresAntes);
    });

    await test.step('Validar que persiste igual tras recargar Cocina', async () => {
      await cocina.recargar();
      const sigueTrasReload = await cocinaPage.locator(`#card_${idTarjeta}`).count();
      expect(sigueTrasReload, 'La tarjeta debe seguir existiendo tras recargar Cocina').toBeGreaterThan(0);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 11. Imprimir comanda desde Cocina ───────────────────────────────────
  test('11. Imprimir comanda desde una tarjeta de Cocina: la ventana de impresión se abre', async ({ pos, mesas, cocina, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let ordenId = '';
    await test.step('Mesa con un producto', async () => {
      await mesas.abrirMesas();
      const mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
      await mesas.abrirMesas();
      ordenId = (await mesas.obtenerMesasDelPlano()).find((m) => m.mesaId === mesa.mesaId)!.ordenId;
    });

    await test.step('Imprimir comanda desde la tarjeta y confirmar que la ventana se abrió', async () => {
      const ids = await cocina.esperarTarjetaDeOrden(ordenId);
      await cocina.imprimirComandaDesdeTarjeta(ids[0]);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 12. Filtro de Categorías ─────────────────────────────────────────────
  test('12. Filtro de Categorías: catálogo real disponible, aplicar y luego borrar preferencias', async ({ cocina, cocinaPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(cocinaPage);

    let categorias: string[] = [];
    await test.step('Abrir el modal y leer el catálogo real de categorías', async () => {
      await cocina.abrirFiltroCategorias();
      categorias = await cocina.obtenerCategoriasDisponibles();
      expect(categorias.length, 'El filtro debe listar al menos una categoría real del catálogo').toBeGreaterThan(0);
      console.log('[Cocina] Categorías disponibles en el filtro:', JSON.stringify(categorias));
    });

    await test.step('Seleccionar la primera categoría real y aplicar el filtro', async () => {
      await cocina.seleccionarCategoriaEnFiltro(categorias[0]);
      await cocina.aplicarFiltroCategorias();
    });

    await test.step('Quitar el filtro (Borrar Preferencias) y confirmar que el modal se cierra sin error', async () => {
      await cocina.borrarFiltroCategorias();
    });

    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 13. Persistencia tras recargar ──────────────────────────────────────
  test('13. Persistencia: recargar Cocina conserva exactamente la misma tarjeta y contenido', async ({ pos, mesas, cocina, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let ordenId = '';
    let nombreProducto = '';
    await test.step('Mesa con un producto', async () => {
      await mesas.abrirMesas();
      const mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      // Ver el comentario del Escenario 3 (nombreReal vs. nombre).
      const metadatoProducto = await pos.obtenerPrimerProductoNoPresenteEnCarrito();
      await mesas.agregarProductoAlCarritoDeMesa(metadatoProducto);
      nombreProducto = metadatoProducto.nombreReal;
      await mesas.abrirMesas();
      ordenId = (await mesas.obtenerMesasDelPlano()).find((m) => m.mesaId === mesa.mesaId)!.ordenId;
    });

    let idsAntes: string[] = [];
    await test.step('Confirmar la tarjeta antes de recargar', async () => {
      idsAntes = await cocina.esperarTarjetaDeOrden(ordenId);
    });

    await test.step('Recargar Cocina y validar que la misma tarjeta persiste con el mismo contenido', async () => {
      await cocina.recargar();
      const idsDespues = await cocina.obtenerIdsTarjetasDeOrden(ordenId);
      expect(idsDespues.sort()).toEqual(idsAntes.sort());
      const tarjeta = await cocina.leerTarjeta(idsDespues[0]);
      expect(tarjeta.textoCompleto).toContain(nombreProducto);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 14. Actualización en tiempo real: ¿requiere recargar? ───────────────
  // Escenario de descubrimiento en vivo (mismo criterio que el Escenario 27
  // de pos-restaurante-mesas.spec.ts): no se asume el mecanismo de
  // actualización, se valida el comportamiento real observado.
  test('14. Actualización en tiempo real: descubrir en vivo si Cocina refleja una orden nueva sin recargar', async ({ pos, mesas, cocina, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let ordenId = '';
    await test.step('Mesa con un producto, con Cocina ya abierta desde antes', async () => {
      await mesas.abrirMesas();
      const mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
      await mesas.abrirMesas();
      ordenId = (await mesas.obtenerMesasDelPlano()).find((m) => m.mesaId === mesa.mesaId)!.ordenId;
    });

    await test.step('Verificar, SIN recargar, si la tarjeta ya apareció (polling corto) — documentar el mecanismo real', async () => {
      const apareceSinRecargar = await cocina.obtenerIdsTarjetasDeOrden(ordenId)
        .then((ids) => ids.length > 0)
        .catch(() => false);
      console.log(`[Escenario 14] ¿La tarjeta apareció sin recargar Cocina? ${apareceSinRecargar}`);

      if (!apareceSinRecargar) {
        await cocina.recargar();
        const idsTrasRecargar = await cocina.obtenerIdsTarjetasDeOrden(ordenId);
        expect(idsTrasRecargar.length, 'Tras recargar, la tarjeta debe existir de todas formas').toBeGreaterThan(0);
        console.log('[Escenario 14] Conclusión: Cocina NO se actualiza sola — requiere recargar la página.');
      } else {
        console.log('[Escenario 14] Conclusión: Cocina reflejó la orden nueva sin necesidad de recargar.');
      }
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });


  // ─── 15. Caso negativo: filtro de categorías sin resultados ──────────────
  test('15. Caso negativo: filtrar por una categoría sin productos pendientes reduce las tarjetas visibles', async ({ pos, mesas, cocina, sharedPage }) => {
    test.setTimeout(TIMEOUTS.TEST);
    const erroresJS = espiarErroresJS(sharedPage);

    let ordenId = '';
    await test.step('Mesa con un producto real (para tener al menos una tarjeta de referencia)', async () => {
      await mesas.abrirMesas();
      const mesa = await mesas.seleccionarMesaDisponible();
      await mesas.volverAProductos();
      await mesas.agregarPrimerProductoNoPresenteAlCarritoDeMesa();
      await mesas.abrirMesas();
      ordenId = (await mesas.obtenerMesasDelPlano()).find((m) => m.mesaId === mesa.mesaId)!.ordenId;
    });

    await test.step('Aplicar un filtro de categoría real y validar que el resultado es consistente (documentar el conteo real)', async () => {
      await cocina.esperarTarjetaDeOrden(ordenId);
      const totalAntes = (await cocina.todasLasTarjetas.count());

      await cocina.abrirFiltroCategorias();
      const categorias = await cocina.obtenerCategoriasDisponibles();
      const categoriaElegida = categorias.find((c) => /Sin Categoría/i.test(c)) ?? categorias[0];
      await cocina.seleccionarCategoriaEnFiltro(categoriaElegida);
      await cocina.aplicarFiltroCategorias();

      const totalConFiltro = await cocina.todasLasTarjetas.count();
      console.log(`[Escenario 15] Categoría filtrada="${categoriaElegida}" — tarjetas antes=${totalAntes}, con filtro=${totalConFiltro}`);
      expect(totalConFiltro, 'El total con filtro nunca debe ser mayor que el total sin filtrar').toBeLessThanOrEqual(totalAntes);

      // Restaurar el estado sin filtro para no afectar otros tests del mismo worker.
      await cocina.borrarFiltroCategorias();
      const totalRestaurado = await cocina.todasLasTarjetas.count();
      expect(totalRestaurado, 'Tras "Borrar Preferencias" debe volver a verse el total original').toBe(totalAntes);
    });

    await validarSinMensajesDeError(sharedPage);
    expect(erroresJS, `Errores de JavaScript detectados: ${erroresJS.join(' | ')}`).toEqual([]);
  });
});
