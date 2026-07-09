import { test, expect } from '@playwright/test';
import { PosPage, METODO, DESCUENTO_INDIVIDUAL_PCT, TIMEOUTS, ResultadoDescuento, VEHICULO_PINTURA_TIPO, CABYS_BUSQUEDA, CABYS_BUSQUEDA_SIN_IVA, PRECIO_PRODUCTO_RAPIDO, LineaCarrito, PESTANA_POS_FACTURACION, PESTANAS_POS_A_RECORRER, esperarQuedaActivo } from './pos.page';

const NOMBRE_CLIENTE_FACTURA = 'Cliente De Prueba QA';

test('facturar producto con efectivo en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir POS y agregar producto al carrito', async () => {
    await pos.cargarPosYCerrarModalSiAparece();
    await pos.agregarPrimerProductoDePrecioFijo();
  });

  await test.step('Abrir modal de pago', async () => {
    await pos.abrirModalDePago();
  });

  await test.step('Ingresar pago en efectivo', async () => {
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

test('facturar producto con tarjeta en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir POS y agregar producto al carrito', async () => {
    await pos.cargarPosYCerrarModalSiAparece();
    await pos.agregarPrimerProductoDePrecioFijo();
  });

  await test.step('Abrir modal de pago', async () => {
    await pos.abrirModalDePago();
  });

  await test.step('Seleccionar tarjeta y llenar monto exacto', async () => {
    await pos.seleccionarPagoExacto(METODO.TARJETA);
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
  });

  await test.step('Validar carrito vacío', async () => {
    await pos.validarCarritoVacio();
  });
});

test('facturar producto con SINPE Móvil en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir POS y agregar producto al carrito', async () => {
    await pos.cargarPosYCerrarModalSiAparece();
    await pos.agregarPrimerProductoDePrecioFijo();
  });

  await test.step('Abrir modal de pago', async () => {
    await pos.abrirModalDePago();
  });

  await test.step('Seleccionar SINPE Móvil y llenar monto exacto', async () => {
    await pos.seleccionarPagoExacto(METODO.SINPE);
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
  });

  await test.step('Validar carrito vacío', async () => {
    await pos.validarCarritoVacio();
  });
});

test('facturar producto con transacción bancaria en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir POS y agregar producto al carrito', async () => {
    await pos.cargarPosYCerrarModalSiAparece();
    await pos.agregarPrimerProductoDePrecioFijo();
  });

  await test.step('Abrir modal de pago', async () => {
    await pos.abrirModalDePago();
  });

  await test.step('Seleccionar transacción bancaria y llenar monto exacto', async () => {
    await pos.seleccionarPagoExacto(METODO.TRANSACCION);
  });

  await test.step('Confirmar factura y cerrar impresión', async () => {
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
  });

  await test.step('Validar carrito vacío', async () => {
    await pos.validarCarritoVacio();
  });
});

test('facturar dos productos con descuento individual y pago mixto (tarjeta + efectivo)', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  let clavesProductos: string[] = [];
  let totalAntes = 0;
  let resultadosDescuento: ResultadoDescuento[] = [];

  await test.step('Cargar el POS y validar el modal "Abrir Caja" si aparece', async () => {
    await pos.cargarPosYCerrarModalSiAparece();
    // Escenario 1 (no apareció) o tras cerrar el modal: el POS debe seguir funcionando.
  });

  await test.step('Agregar dos productos al carrito', async () => {
    // Dos productos normales reales y distintos, localizados por
    // característica funcional (item_type/is_fragmented en add_to_table(),
    // ver obtenerPrimerProductoNormal()/obtenerSegundoProductoNormalDistinto()
    // en pos.page.ts) — nunca por un nombre fijo del catálogo. Se necesitan
    // dos líneas reales y diferentes para que el descuento individual por
    // producto tenga dos claves reales sobre las que aplicarse.
    const primero = await pos.obtenerPrimerProductoNormal();
    await pos.agregarProductoAlCarrito(primero);
    const segundo = await pos.obtenerSegundoProductoNormalDistinto(primero.nombre);
    await pos.agregarProductoAlCarrito(segundo);
  });

  await test.step('Desactivar descuento general si está activo', async () => {
    await pos.desactivarDescuentoGeneral();
  });

  await test.step('Registrar total de venta y claves antes de aplicar descuentos', async () => {
    clavesProductos = await pos.obtenerClavesProductos();
    totalAntes      = await pos.obtenerTotalVentaNumerico();
    expect(clavesProductos.length).toBeGreaterThanOrEqual(2);
    expect(totalAntes).toBeGreaterThan(0);
  });

  await test.step(`Aplicar descuento del ${DESCUENTO_INDIVIDUAL_PCT}% por producto — adaptarse a reglas del sistema`, async () => {
    for (const clave of clavesProductos) {
      const r = await pos.aplicarDescuentoIndividual(clave, DESCUENTO_INDIVIDUAL_PCT);
      resultadosDescuento.push(r);

      // Validar el escenario que respondió el sistema
      if (r.escenario === 'sin_descuento') {
        // Producto sin descuento: mensaje esperado y porcentaje aplicado = 0
        expect(parseFloat(r.porcentajeAplicado)).toBe(0);
      } else if (r.escenario === 'maximo_superado') {
        // Descuento capado al máximo: se aplicó algo, pero menos de lo solicitado
        expect(parseFloat(r.porcentajeAplicado)).toBeGreaterThan(0);
        expect(parseFloat(r.porcentajeAplicado)).toBeLessThan(parseFloat(DESCUENTO_INDIVIDUAL_PCT));
      } else {
        // Descuento aplicado exactamente
        expect(parseFloat(r.porcentajeAplicado)).toBeCloseTo(parseFloat(DESCUENTO_INDIVIDUAL_PCT), 1);
      }
    }
  });

  await test.step('Verificar que los totales reflejan los descuentos efectivamente aplicados', async () => {
    const hayDescuento = resultadosDescuento.some(r => parseFloat(r.porcentajeAplicado) > 0);
    if (hayDescuento) {
      const totalDespues = await pos.obtenerTotalVentaNumerico();
      expect(totalDespues).toBeLessThan(totalAntes);
    }
    // Cada producto debe seguir teniendo un total positivo independientemente del descuento
    for (const clave of clavesProductos) {
      expect(await pos.obtenerTotalProducto(clave)).toBeGreaterThan(0);
    }
  });

  await test.step('Presionar "Facturar": debe abrir el modal de pago (sin intentar abrir caja aquí)', async () => {
    await pos.abrirModalDePago();
  });

  await test.step('Configurar pago mixto: 50% tarjeta + 50% efectivo', async () => {
    const totalNum  = await pos.obtenerTotalVentaNumerico();
    const montoCard = (Math.floor(totalNum * 100 / 2) / 100).toFixed(2);
    const montoCash = (totalNum - parseFloat(montoCard)).toFixed(2);
    await pos.seleccionarPagoMixto(montoCard, montoCash);
  });

  await test.step('Presionar "Facturar" del modal de pago y validar el modal "Abrir Caja" si aparece', async () => {
    // El aviso de consecutivo fuera de rango es una advertencia informativa del
    // sistema, no un error: no debe hacer fallar el test. El criterio de éxito real
    // es el resultado final de la operación, validado en el siguiente paso.
    await pos.confirmarPagoAbriendoCajaSiEsNecesario();
  });

  await test.step('Validar resultado final: factura generada y carrito vacío', async () => {
    await pos.validarCarritoVacio();
  });
});

test('facturar un servicio del tab Servicios en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS y cerrar overlays conocidos si aparecen', async () => {
    await pos.cargarPosYCerrarModalSiAparece();
    await pos.cerrarOverlaysConocidos();
  });

  await test.step('Cambiar al tab Servicios y validar que quedó activo', async () => {
    await pos.tabServicios.click();
    await esperarQuedaActivo(() => pos.tabEstaActivo(pos.tabServicios));
  });

  let clavesAntes: string[] = [];
  await test.step('Seleccionar el primer servicio disponible y validar que se agregó al carrito', async () => {
    // Localizado por característica funcional (item_type=2 en add_to_table(),
    // ver obtenerPrimerServicio() en pos.page.ts), nunca por un nombre fijo
    // del catálogo — varios servicios reales comparten nombre, así que
    // depender de uno exacto era además frágil por partida doble.
    clavesAntes = await pos.obtenerClavesProductos();
    const servicio = await pos.obtenerPrimerServicio();
    await pos.agregarProductoAlCarrito(servicio);
    await expect.poll(async () => (await pos.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntes.length);
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

test('facturar un servicio de End. Pintura en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS y cerrar overlays conocidos si aparecen', async () => {
    await pos.cargarPosYCerrarModalSiAparece();
    await pos.cerrarOverlaysConocidos();
  });

  await test.step('Cambiar al tab End. Pintura y validar que quedó activo', async () => {
    await pos.tabPintura.click();
    await esperarQuedaActivo(() => pos.tabEstaActivo(pos.tabPintura));
  });

  await test.step('Recorrer el wizard: vehículo → parte → pieza', async () => {
    // El tipo de vehículo es una lista fija de la interfaz (se selecciona por
    // nombre); parte y pieza son catálogo configurable por la empresa sin
    // nombre estable, así que se toma la primera opción disponible en cada
    // paso — mismo criterio que ya usa agregarPrimerProductoDePrecioFijo cuando
    // no hay un nombre por el cual buscar.
    await pos.seleccionarVehiculoPintura(VEHICULO_PINTURA_TIPO);
    await pos.seleccionarPrimeraParte();
    await pos.seleccionarPrimeraPieza();
  });

  let clavesAntes: string[] = [];
  await test.step('Seleccionar el servicio y, si el sistema lo requiere, un precio en el modal — validar que el servicio se agregó al carrito', async () => {
    // clavesAntes se captura ANTES de seleccionarPrimerServicioPintura(): ese
    // clic puede agregar la línea directo al carrito (precio único
    // pre-cableado en la tarjeta del servicio — ver el comentario de
    // esperarServicioPinturaAgregadoOModalPrecio() en pos.page.ts), así que
    // capturarlo después ya incluiría esa línea y el poll de más abajo nunca
    // detectaría el crecimiento.
    clavesAntes = await pos.obtenerClavesProductos();
    await pos.seleccionarPrimerServicioPintura();

    const resultado = await pos.esperarServicioPinturaAgregadoOModalPrecio(clavesAntes);
    if (resultado === 'requiere_modal') {
      await pos.seleccionarPrimerPrecioDisponible();
    }

    await expect.poll(async () => (await pos.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntes.length);
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

test('agregar y facturar un Producto Rápido en POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard y cerrar overlays conocidos si aparecen', async () => {
    // cargarPosDesdeDashboard(), no irAlPos() directo: evita una condición de
    // carrera real de la aplicación (pos.js) que deja sin ligar el click del
    // botón "Agregar" cuando el POS es la primera página de un contexto
    // nuevo — ver el comentario de ese método en pos.page.ts para la
    // evidencia completa.
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  let clavesAntes: string[] = [];
  await test.step('Abrir "Producto Rápido" desde el botón flotante', async () => {
    clavesAntes = await pos.obtenerClavesProductos();
    await pos.abrirProductoRapido();
  });

  await test.step('Llenar nombre y precio', async () => {
    await pos.llenarDatosBasicosProductoRapido(`Producto Rápido ${Date.now()}`, PRECIO_PRODUCTO_RAPIDO);
  });

  await test.step('Detectar si aparece CABYS: si aparece, completarlo obligatoriamente; si no, seleccionar IVA manualmente', async () => {
    const cabysAplicado = await pos.manejarCabysSiAplica(CABYS_BUSQUEDA);
    console.log(`[agregar y facturar un Producto Rápido en POS] cabysAplicado=${cabysAplicado}`);
    if (cabysAplicado) {
      await pos.esperarIvaAutocompletado();
    } else {
      // Confirmado en vivo que sí ocurre: la visibilidad de CABYS depende
      // del país configurado para la compañía (server-side), no es fija —
      // ver el comentario de seleccionarIvaManualmente() en pos.page.ts.
      await pos.seleccionarIvaManualmente();
    }
  });

  await test.step('Presionar "Agregar" y validar que el producto se agregó al carrito', async () => {
    await pos.guardarProductoRapido();
    await expect(pos.modalProductoRapido).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
    await expect.poll(async () => (await pos.obtenerClavesProductos()).length).toBeGreaterThan(clavesAntes.length);
  });

  await test.step('Validar el toast de confirmación "Producto agregado"', async () => {
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

test('Seleccionar un cliente existente en el POS', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard y cerrar overlays conocidos si aparecen', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  await test.step('Buscar y seleccionar el primer cliente existente disponible', async () => {
    const nombreCliente = await pos.seleccionarClienteExistente();
    expect(nombreCliente.length).toBeGreaterThan(0);
  });
});

test('Ingresar nombre del cliente en el POS sin seleccionar uno registrado', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Cargar el POS pasando por el Dashboard y cerrar overlays conocidos si aparecen', async () => {
    await pos.cargarPosDesdeDashboard();
    await pos.cerrarOverlaysConocidos();
  });

  await test.step('Abrir "Agregar" → "Nombre del cliente" e ingresar el nombre', async () => {
    await pos.ingresarNombreCliente(NOMBRE_CLIENTE_FACTURA);
  });
});
