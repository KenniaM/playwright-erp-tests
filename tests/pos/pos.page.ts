import { expect, Download, Locator, Page, Response } from '@playwright/test';
import { L } from './pos.locators';
import {
  TIMEOUTS, PAUSES, CAJA_TEXTO, CHECKBOX_ID, PestanaPos, PESTANA_POS_FACTURACION,
  PESTANAS_POS_A_RECORRER, MetodoPago, METODO, DESCUENTO_INDIVIDUAL_PCT, DESCUENTO_GENERAL_PCT,
  TipoPagoOrdenCaja, TipoProforma, VEHICULO_PINTURA_TIPO, COMPANIA_POS, CABYS_BUSQUEDA,
  CABYS_BUSQUEDA_SIN_IVA, PRECIO_PRODUCTO_RAPIDO, EscenarioDescuento, ResultadoDescuento,
  EstadoCheckIva, ConfigBusquedaCabys, LineaCarrito, MetadatoProducto, DASHBOARD_URL,
} from './pos.types';
import { espiarErroresJS, esperarQuedaActivo } from './pos.utils';
import { PosCore } from './pos-core.page';
import { PosCierreCaja } from './pos-cierre-caja.page';
import { PosPayment } from './pos-payment.page';
import { PosNavigation } from './pos-navegacion.page';
import { PosProforma } from './pos-proforma.page';
import { PosCrearProducto } from './pos-crear-producto.page';
import { PosImportarFactura } from './pos-importar-factura.page';
import { PosOrdenCaja } from './pos-orden-caja.page';

// Pasos 0-1 de la migración a composición (ver el plan aprobado en
// /Users/mobileimacimac/.claude/plans/hazy-noodling-stream.md): tipos,
// constantes y locators se movieron a pos.types.ts/pos.locators.ts, y las 2
// funciones sueltas a pos.utils.ts. Este archivo sigue siendo el punto de
// entrada público único (barrel): re-exporta todo para que ningún import
// existente en los .spec.ts, ni el cruzado desde
// tests/gestion-de-taller/recepcion.page.ts, tenga que cambiar. Próximos
// pasos del plan: PosCore (helpers transversales) ya se extrajo a
// pos-core.page.ts — PosPage delega a `this.core` cada uno de sus
// miembros. Quedan por extraer: Cierre de Caja, Navegación, Pago,
// Proforma, Crear Producto, Importar Factura, Orden de Caja, Apartado y
// Ruteo, cada uno a su propia clase compuesta de la misma forma.
export * from './pos.types';
export { espiarErroresJS, esperarQuedaActivo };


// ─── Page Object ──────────────────────────────────────────────────────────────

export class PosPage {
  private readonly core: PosCore;
  private readonly cierreCaja: PosCierreCaja;
  private readonly payment: PosPayment;
  private readonly navigation: PosNavigation;
  private readonly proforma: PosProforma;
  private readonly crearProducto: PosCrearProducto;
  private readonly importarFactura: PosImportarFactura;
  private readonly ordenCaja: PosOrdenCaja;

  constructor(private readonly page: Page) {
    this.core = new PosCore(page);
    this.cierreCaja = new PosCierreCaja(this.core);
    this.payment = new PosPayment(this.core);
    this.navigation = new PosNavigation(this.core);
    this.proforma = new PosProforma(this.core, this.payment);
    this.crearProducto = new PosCrearProducto(this.core);
    this.importarFactura = new PosImportarFactura(this.core, this.payment);
    this.ordenCaja = new PosOrdenCaja(this.core, this.payment);
  }
  get modalAbrirCaja() { return this.core.modalAbrirCaja; }
  get confirmacionPago() { return this.payment.confirmacionPago; }
  get panelInformacionCliente() { return this.payment.panelInformacionCliente; }
  get primerProducto() { return this.core.primerProducto; }
  async irAlPos(...args: Parameters<PosCore['irAlPos']>) {
    return this.core.irAlPos(...args);
  }
  async esperarEstadoInicial(...args: Parameters<PosCore['esperarEstadoInicial']>) {
    return this.core.esperarEstadoInicial(...args);
  }
  async modalAbrirCajaVisible(...args: Parameters<PosCore['modalAbrirCajaVisible']>) {
    return this.core.modalAbrirCajaVisible(...args);
  }
  async cargarPosYCerrarModalSiAparece(...args: Parameters<PosCore['cargarPosYCerrarModalSiAparece']>) {
    return this.core.cargarPosYCerrarModalSiAparece(...args);
  }
  async cargarPosDesdeDashboard(...args: Parameters<PosCore['cargarPosDesdeDashboard']>) {
    return this.core.cargarPosDesdeDashboard(...args);
  }
  async _cerrarModalMonedaSiAparece(...args: Parameters<PosCore['_cerrarModalMonedaSiAparece']>) {
    return this.core._cerrarModalMonedaSiAparece(...args);
  }
  async _cerrarModalSetupInicialSiAparece(...args: Parameters<PosCore['_cerrarModalSetupInicialSiAparece']>) {
    return this.core._cerrarModalSetupInicialSiAparece(...args);
  }
  async _cerrarOverlayDashboardSiAparece(...args: Parameters<PosCore['_cerrarOverlayDashboardSiAparece']>) {
    return this.core._cerrarOverlayDashboardSiAparece(...args);
  }
  async _irAlPosResolviendoCompania(...args: Parameters<PosCore['_irAlPosResolviendoCompania']>) {
    return this.core._irAlPosResolviendoCompania(...args);
  }
  async cerrarModalAbrirCaja(...args: Parameters<PosCore['cerrarModalAbrirCaja']>) {
    return this.core.cerrarModalAbrirCaja(...args);
  }
  async completarAperturaCaja(...args: Parameters<PosCore['completarAperturaCaja']>) {
    return this.core.completarAperturaCaja(...args);
  }
  get modalCerrarCaja() { return this.cierreCaja.modalCerrarCaja; }
  get modalNotificaciones() { return this.core.modalNotificaciones; }
  async cerrarModalNotificacionesSiAparece(...args: Parameters<PosCore['cerrarModalNotificacionesSiAparece']>) {
    return this.core.cerrarModalNotificacionesSiAparece(...args);
  }
  async menuCajaEstaAbierto(...args: Parameters<PosCierreCaja['menuCajaEstaAbierto']>) {
    return this.cierreCaja.menuCajaEstaAbierto(...args);
  }
  async abrirMenuCaja(...args: Parameters<PosCierreCaja['abrirMenuCaja']>) {
    return this.cierreCaja.abrirMenuCaja(...args);
  }
  async seleccionarAbrirCerrarCaja(...args: Parameters<PosCierreCaja['seleccionarAbrirCerrarCaja']>) {
    return this.cierreCaja.seleccionarAbrirCerrarCaja(...args);
  }
  async esperarResultadoMenuCaja(...args: Parameters<PosCierreCaja['esperarResultadoMenuCaja']>) {
    return this.cierreCaja.esperarResultadoMenuCaja(...args);
  }
  async completarFormularioCerrarCaja(...args: Parameters<PosCierreCaja['completarFormularioCerrarCaja']>) {
    return this.cierreCaja.completarFormularioCerrarCaja(...args);
  }
  async confirmarCerrarCaja(...args: Parameters<PosCierreCaja['confirmarCerrarCaja']>) {
    return this.cierreCaja.confirmarCerrarCaja(...args);
  }
  async presionarFacturar(...args: Parameters<PosPayment['presionarFacturar']>) {
    return this.payment.presionarFacturar(...args);
  }
  async esperarModalPago(...args: Parameters<PosPayment['esperarModalPago']>) {
    return this.payment.esperarModalPago(...args);
  }
  async abrirModalDePago(...args: Parameters<PosPayment['abrirModalDePago']>) {
    return this.payment.abrirModalDePago(...args);
  }
  async _localizarSelectorDocumentoElectronico(...args: Parameters<PosPayment['_localizarSelectorDocumentoElectronico']>) {
    return this.payment._localizarSelectorDocumentoElectronico(...args);
  }
  async _cambiarATiqueteElectronicoSiEsPosible(...args: Parameters<PosPayment['_cambiarATiqueteElectronicoSiEsPosible']>) {
    return this.payment._cambiarATiqueteElectronicoSiEsPosible(...args);
  }
  async _leerOpcionesDocumentoElectronico(...args: Parameters<PosPayment['_leerOpcionesDocumentoElectronico']>) {
    return this.payment._leerOpcionesDocumentoElectronico(...args);
  }
  async _seleccionarOpcionDocumentoElectronicoPorIndice(...args: Parameters<PosPayment['_seleccionarOpcionDocumentoElectronicoPorIndice']>) {
    return this.payment._seleccionarOpcionDocumentoElectronicoPorIndice(...args);
  }
  async agregarPrimerProductoDePrecioFijo(...args: Parameters<PosCore['agregarPrimerProductoDePrecioFijo']>) {
    return this.core.agregarPrimerProductoDePrecioFijo(...args);
  }
  async seleccionarPagoEfectivo(...args: Parameters<PosPayment['seleccionarPagoEfectivo']>) {
    return this.payment.seleccionarPagoEfectivo(...args);
  }
  async seleccionarPagoExacto(...args: Parameters<PosPayment['seleccionarPagoExacto']>) {
    return this.payment.seleccionarPagoExacto(...args);
  }
  async seleccionarPagoParcial(...args: Parameters<PosPayment['seleccionarPagoParcial']>) {
    return this.payment.seleccionarPagoParcial(...args);
  }
  get avisoConsecutivoFueraDeRango() { return this.core.avisoConsecutivoFueraDeRango; }
  async cerrarAvisoConsecutivoSiAparece(...args: Parameters<PosCore['cerrarAvisoConsecutivoSiAparece']>) {
    return this.core.cerrarAvisoConsecutivoSiAparece(...args);
  }
  async cerrarTodosLosToastsSiAparecen(...args: Parameters<PosCore['cerrarTodosLosToastsSiAparecen']>) {
    return this.core.cerrarTodosLosToastsSiAparecen(...args);
  }
  async cerrarOverlaysConocidos(...args: Parameters<PosCore['cerrarOverlaysConocidos']>) {
    return this.core.cerrarOverlaysConocidos(...args);
  }
  async presionarConfirmarPago(...args: Parameters<PosPayment['presionarConfirmarPago']>) {
    return this.payment.presionarConfirmarPago(...args);
  }
  async mostrarYCerrarVentanaImpresion(...args: Parameters<PosCore['mostrarYCerrarVentanaImpresion']>) {
    return this.core.mostrarYCerrarVentanaImpresion(...args);
  }
  async confirmarPagoAbriendoCajaSiEsNecesario(...args: Parameters<PosPayment['confirmarPagoAbriendoCajaSiEsNecesario']>) {
    return this.payment.confirmarPagoAbriendoCajaSiEsNecesario(...args);
  }
  async _confirmarPagoConReintentosDeCaja(...args: Parameters<PosPayment['_confirmarPagoConReintentosDeCaja']>) {
    return this.payment._confirmarPagoConReintentosDeCaja(...args);
  }
  async _armarCarreraFacturacion(...args: Parameters<PosPayment['_armarCarreraFacturacion']>) {
    return this.payment._armarCarreraFacturacion(...args);
  }
  async validarCarritoVacio(...args: Parameters<PosPayment['validarCarritoVacio']>) {
    return this.payment.validarCarritoVacio(...args);
  }
  async buscarProductoEnGrid(...args: Parameters<PosCore['buscarProductoEnGrid']>) {
    return this.core.buscarProductoEnGrid(...args);
  }
  productoPorNombre(...args: Parameters<PosCore['productoPorNombre']>) {
    return this.core.productoPorNombre(...args);
  }
  async agregarProductoPorNombre(...args: Parameters<PosCore['agregarProductoPorNombre']>) {
    return this.core.agregarProductoPorNombre(...args);
  }
  async agregarProductoFraccionadoPorNombre(...args: Parameters<PosCore['agregarProductoFraccionadoPorNombre']>) {
    return this.core.agregarProductoFraccionadoPorNombre(...args);
  }
  async obtenerClavesProductos(...args: Parameters<PosCore['obtenerClavesProductos']>) {
    return this.core.obtenerClavesProductos(...args);
  }
  async obtenerClavesFilasCarrito(...args: Parameters<PosCore['obtenerClavesFilasCarrito']>) {
    return this.core.obtenerClavesFilasCarrito(...args);
  }
  async _extraerArgumentosAddToTable(...args: Parameters<PosCore['_extraerArgumentosAddToTable']>) {
    return this.core._extraerArgumentosAddToTable(...args);
  }
  async obtenerMetadatosProductosVisibles(...args: Parameters<PosCore['obtenerMetadatosProductosVisibles']>) {
    return this.core.obtenerMetadatosProductosVisibles(...args);
  }
  async _cargarMasProductosScrolleando(...args: Parameters<PosCore['_cargarMasProductosScrolleando']>) {
    return this.core._cargarMasProductosScrolleando(...args);
  }
  async localizarPrimerProducto(...args: Parameters<PosCore['localizarPrimerProducto']>) {
    return this.core.localizarPrimerProducto(...args);
  }
  async obtenerPrimerProductoNormal(...args: Parameters<PosCore['obtenerPrimerProductoNormal']>) {
    return this.core.obtenerPrimerProductoNormal(...args);
  }
  async obtenerPrimerProductoNormalConCodigo(...args: Parameters<PosCore['obtenerPrimerProductoNormalConCodigo']>) {
    return this.core.obtenerPrimerProductoNormalConCodigo(...args);
  }
  async obtenerSegundoProductoNormalDistinto(...args: Parameters<PosCore['obtenerSegundoProductoNormalDistinto']>) {
    return this.core.obtenerSegundoProductoNormalDistinto(...args);
  }
  async obtenerPrimerProductoFraccionado(...args: Parameters<PosCore['obtenerPrimerProductoFraccionado']>) {
    return this.core.obtenerPrimerProductoFraccionado(...args);
  }
  async obtenerPrimerProductoConIva(...args: Parameters<PosCore['obtenerPrimerProductoConIva']>) {
    return this.core.obtenerPrimerProductoConIva(...args);
  }
  async obtenerPrimerProductoSinIva(...args: Parameters<PosCore['obtenerPrimerProductoSinIva']>) {
    return this.core.obtenerPrimerProductoSinIva(...args);
  }
  async obtenerPrimerProductoConInventario(...args: Parameters<PosCore['obtenerPrimerProductoConInventario']>) {
    return this.core.obtenerPrimerProductoConInventario(...args);
  }
  async obtenerPrimerServicio(...args: Parameters<PosCore['obtenerPrimerServicio']>) {
    return this.core.obtenerPrimerServicio(...args);
  }
  async obtenerPrimerCombo(...args: Parameters<PosCore['obtenerPrimerCombo']>) {
    return this.core.obtenerPrimerCombo(...args);
  }
  async agregarProductoAlCarrito(...args: Parameters<PosCore['agregarProductoAlCarrito']>) {
    return this.core.agregarProductoAlCarrito(...args);
  }
  async agregarProductoFraccionadoAlCarrito(...args: Parameters<PosCore['agregarProductoFraccionadoAlCarrito']>) {
    return this.core.agregarProductoFraccionadoAlCarrito(...args);
  }
  async agregarProductoDelGridAlCarrito(...args: Parameters<PosCore['agregarProductoDelGridAlCarrito']>) {
    return this.core.agregarProductoDelGridAlCarrito(...args);
  }
  async eliminarProductoDelCarrito(...args: Parameters<PosCore['eliminarProductoDelCarrito']>) {
    return this.core.eliminarProductoDelCarrito(...args);
  }
  async agregarObservacionAProducto(...args: Parameters<PosCore['agregarObservacionAProducto']>) {
    return this.core.agregarObservacionAProducto(...args);
  }
  async obtenerObservacionDeProducto(...args: Parameters<PosCore['obtenerObservacionDeProducto']>) {
    return this.core.obtenerObservacionDeProducto(...args);
  }
  async estaDescuentoGeneralActivo(...args: Parameters<PosCore['estaDescuentoGeneralActivo']>) {
    return this.core.estaDescuentoGeneralActivo(...args);
  }
  async desactivarDescuentoGeneral(...args: Parameters<PosCore['desactivarDescuentoGeneral']>) {
    return this.core.desactivarDescuentoGeneral(...args);
  }
  async aplicarDescuentoIndividual(...args: Parameters<PosCore['aplicarDescuentoIndividual']>) {
    return this.core.aplicarDescuentoIndividual(...args);
  }
  async obtenerTotalProducto(...args: Parameters<PosCore['obtenerTotalProducto']>) {
    return this.core.obtenerTotalProducto(...args);
  }
  async obtenerTotalVentaNumerico(...args: Parameters<PosCore['obtenerTotalVentaNumerico']>) {
    return this.core.obtenerTotalVentaNumerico(...args);
  }

  /**
   * Lee el "Saldo Actual" real de un Apartado ya reabierto (L.TOTAL_LAYAWAY_SALDO_ACTUAL),
   * la fila del footer principal que sí refleja el total original menos los
   * abonos ya aplicados — a diferencia de obtenerTotalVentaNumerico(), que lee
   * el total del modal de pago (L.TOTAL_MODAL) y no se actualiza fuera de ese
   * modal.
   */
  async obtenerSaldoActualApartado(): Promise<number> {
    const texto = await this.page.locator(L.TOTAL_LAYAWAY_SALDO_ACTUAL).textContent();
    return this._leerMontoDeTexto(texto ?? '$0.00');
  }
  async seleccionarPagoMixto(...args: Parameters<PosPayment['seleccionarPagoMixto']>) {
    return this.payment.seleccionarPagoMixto(...args);
  }
  async abrirMenuTresPuntos(...args: Parameters<PosNavigation['abrirMenuTresPuntos']>) {
    return this.navigation.abrirMenuTresPuntos(...args);
  }
  async abrirHistorialFacturas(...args: Parameters<PosNavigation['abrirHistorialFacturas']>) {
    return this.navigation.abrirHistorialFacturas(...args);
  }
  async abrirHistorialProformas(...args: Parameters<PosNavigation['abrirHistorialProformas']>) {
    return this.navigation.abrirHistorialProformas(...args);
  }
  get categoriaTodos() { return this.core.categoriaTodos; }
  get categoriaCombos() { return this.core.categoriaCombos; }
  categoriaOpcionalPorNombre(...args: Parameters<PosCore['categoriaOpcionalPorNombre']>) {
    return this.core.categoriaOpcionalPorNombre(...args);
  }
  get categoriaTipo() { return this.core.categoriaTipo; }
  get categoriaProductosFraccionados() { return this.core.categoriaProductosFraccionados; }
  get categoriaProductosVariantes() { return this.core.categoriaProductosVariantes; }
  async categoriaEstaActiva(...args: Parameters<PosCore['categoriaEstaActiva']>) {
    return this.core.categoriaEstaActiva(...args);
  }
  get botonVistaLista() { return this.core.botonVistaLista; }
  get botonVistaCuadricula() { return this.core.botonVistaCuadricula; }
  async vistaEstaActiva(...args: Parameters<PosCore['vistaEstaActiva']>) {
    return this.core.vistaEstaActiva(...args);
  }
  async estiloVistaTexto(...args: Parameters<PosCore['estiloVistaTexto']>) {
    return this.core.estiloVistaTexto(...args);
  }
  get tabProductos() { return this.core.tabProductos; }
  get tabServicios() { return this.core.tabServicios; }
  get tabPintura() { return this.core.tabPintura; }
  async tabEstaActivo(...args: Parameters<PosCore['tabEstaActivo']>) {
    return this.core.tabEstaActivo(...args);
  }
  get modalSeleccionarPrecio() { return this.navigation.modalSeleccionarPrecio; }
  async seleccionarVehiculoPintura(...args: Parameters<PosNavigation['seleccionarVehiculoPintura']>) {
    return this.navigation.seleccionarVehiculoPintura(...args);
  }
  async seleccionarPrimeraParte(...args: Parameters<PosNavigation['seleccionarPrimeraParte']>) {
    return this.navigation.seleccionarPrimeraParte(...args);
  }
  async seleccionarPrimeraPieza(...args: Parameters<PosNavigation['seleccionarPrimeraPieza']>) {
    return this.navigation.seleccionarPrimeraPieza(...args);
  }
  async seleccionarPrimerServicioPintura(...args: Parameters<PosNavigation['seleccionarPrimerServicioPintura']>) {
    return this.navigation.seleccionarPrimerServicioPintura(...args);
  }
  async seleccionarPrimerPrecioDisponible(...args: Parameters<PosNavigation['seleccionarPrimerPrecioDisponible']>) {
    return this.navigation.seleccionarPrimerPrecioDisponible(...args);
  }
  async esperarServicioPinturaAgregadoOModalPrecio(...args: Parameters<PosNavigation['esperarServicioPinturaAgregadoOModalPrecio']>) {
    return this.navigation.esperarServicioPinturaAgregadoOModalPrecio(...args);
  }
  get modalProductoRapido() { return this.core.modalProductoRapido; }
  get modalBusquedaCabys() { return this.core.modalBusquedaCabys; }
  async abrirProductoRapido(...args: Parameters<PosCore['abrirProductoRapido']>) {
    return this.core.abrirProductoRapido(...args);
  }
  async llenarDatosBasicosProductoRapido(...args: Parameters<PosCore['llenarDatosBasicosProductoRapido']>) {
    return this.core.llenarDatosBasicosProductoRapido(...args);
  }
  async existeCampoCabys(...args: Parameters<PosCore['existeCampoCabys']>) {
    return this.core.existeCampoCabys(...args);
  }
  async manejarCabysSiAplica(...args: Parameters<PosCore['manejarCabysSiAplica']>) {
    return this.core.manejarCabysSiAplica(...args);
  }
  async buscarYAplicarCabys(...args: Parameters<PosCore['buscarYAplicarCabys']>) {
    return this.core.buscarYAplicarCabys(...args);
  }
  get configCabysProductoRapido() { return this.core.configCabysProductoRapido; }
  get configCabysCombo() { return this.core.configCabysCombo; }
  get configCabysProducto() { return this.core.configCabysProducto; }
  async esperarIvaAutocompletado(...args: Parameters<PosCore['esperarIvaAutocompletado']>) {
    return this.core.esperarIvaAutocompletado(...args);
  }
  async esperarIvaAutocompletadoCombo(...args: Parameters<PosCrearProducto['esperarIvaAutocompletadoCombo']>) {
    return this.crearProducto.esperarIvaAutocompletadoCombo(...args);
  }
  async _normalizarPorcentajeCabys(...args: Parameters<PosCore['_normalizarPorcentajeCabys']>) {
    return this.core._normalizarPorcentajeCabys(...args);
  }
  async validarIvaCoincideConCabys(...args: Parameters<PosCore['validarIvaCoincideConCabys']>) {
    return this.core.validarIvaCoincideConCabys(...args);
  }
  async obtenerTasaIvaSeleccionadaPct(...args: Parameters<PosCore['obtenerTasaIvaSeleccionadaPct']>) {
    return this.core.obtenerTasaIvaSeleccionadaPct(...args);
  }
  async obtenerTasaIvaSeleccionadaComboPct(...args: Parameters<PosCrearProducto['obtenerTasaIvaSeleccionadaComboPct']>) {
    return this.crearProducto.obtenerTasaIvaSeleccionadaComboPct(...args);
  }
  async validarIvaCoincideConCabysCombo(...args: Parameters<PosCrearProducto['validarIvaCoincideConCabysCombo']>) {
    return this.crearProducto.validarIvaCoincideConCabysCombo(...args);
  }
  async obtenerTotalIvaGeneral(...args: Parameters<PosCore['obtenerTotalIvaGeneral']>) {
    return this.core.obtenerTotalIvaGeneral(...args);
  }
  async establecerCantidadProductoRapido(...args: Parameters<PosCore['establecerCantidadProductoRapido']>) {
    return this.core.establecerCantidadProductoRapido(...args);
  }
  async estaMostrandoPrecioConIva(...args: Parameters<PosCore['estaMostrandoPrecioConIva']>) {
    return this.core.estaMostrandoPrecioConIva(...args);
  }
  async establecerMostrarPrecioConIva(...args: Parameters<PosCore['establecerMostrarPrecioConIva']>) {
    return this.core.establecerMostrarPrecioConIva(...args);
  }
  async obtenerDatosLineaCarrito(...args: Parameters<PosCore['obtenerDatosLineaCarrito']>) {
    return this.core.obtenerDatosLineaCarrito(...args);
  }
  async obtenerClaveDeLineaPorNombre(...args: Parameters<PosCore['obtenerClaveDeLineaPorNombre']>) {
    return this.core.obtenerClaveDeLineaPorNombre(...args);
  }
  async validarLineaCarrito(...args: Parameters<PosCore['validarLineaCarrito']>) {
    return this.core.validarLineaCarrito(...args);
  }
  async validarLineasCarrito(...args: Parameters<PosCore['validarLineasCarrito']>) {
    return this.core.validarLineasCarrito(...args);
  }
  calcularTotalImpuestosEsperado(...args: Parameters<PosCore['calcularTotalImpuestosEsperado']>) {
    return this.core.calcularTotalImpuestosEsperado(...args);
  }
  calcularSubtotalEsperado(...args: Parameters<PosCore['calcularSubtotalEsperado']>) {
    return this.core.calcularSubtotalEsperado(...args);
  }
  async validarResumenImpuestos(...args: Parameters<PosCore['validarResumenImpuestos']>) {
    return this.core.validarResumenImpuestos(...args);
  }
  async seleccionarIvaManualmente(...args: Parameters<PosCore['seleccionarIvaManualmente']>) {
    return this.core.seleccionarIvaManualmente(...args);
  }
  async guardarProductoRapido(...args: Parameters<PosCore['guardarProductoRapido']>) {
    return this.core.guardarProductoRapido(...args);
  }
  async guardarProductoRapidoYObtenerRespuesta(...args: Parameters<PosCore['guardarProductoRapidoYObtenerRespuesta']>) {
    return this.core.guardarProductoRapidoYObtenerRespuesta(...args);
  }
  async agregarProductoRapidoParaValidacionIva(...args: Parameters<PosCore['agregarProductoRapidoParaValidacionIva']>) {
    return this.core.agregarProductoRapidoParaValidacionIva(...args);
  }
  get modalCrearCombo() { return this.crearProducto.modalCrearCombo; }
  async abrirCrearCombo(...args: Parameters<PosCrearProducto['abrirCrearCombo']>) {
    return this.crearProducto.abrirCrearCombo(...args);
  }
  async llenarDatosBasicosCombo(...args: Parameters<PosCrearProducto['llenarDatosBasicosCombo']>) {
    return this.crearProducto.llenarDatosBasicosCombo(...args);
  }
  async buscarYAgregarPrimerProductoAlCombo(...args: Parameters<PosCrearProducto['buscarYAgregarPrimerProductoAlCombo']>) {
    return this.crearProducto.buscarYAgregarPrimerProductoAlCombo(...args);
  }
  async obtenerPrecioRealCombo(...args: Parameters<PosCrearProducto['obtenerPrecioRealCombo']>) {
    return this.crearProducto.obtenerPrecioRealCombo(...args);
  }
  async establecerPrecioValidoCombo(...args: Parameters<PosCrearProducto['establecerPrecioValidoCombo']>) {
    return this.crearProducto.establecerPrecioValidoCombo(...args);
  }
  async guardarComboYObtenerRespuesta(...args: Parameters<PosCrearProducto['guardarComboYObtenerRespuesta']>) {
    return this.crearProducto.guardarComboYObtenerRespuesta(...args);
  }
  async guardarComboConfigurado(...args: Parameters<PosCrearProducto['guardarComboConfigurado']>) {
    return this.crearProducto.guardarComboConfigurado(...args);
  }
  async abrirCrearComboConProducto(...args: Parameters<PosCrearProducto['abrirCrearComboConProducto']>) {
    return this.crearProducto.abrirCrearComboConProducto(...args);
  }
  async crearComboConIva(...args: Parameters<PosCrearProducto['crearComboConIva']>) {
    return this.crearProducto.crearComboConIva(...args);
  }
  async crearComboSinIva(...args: Parameters<PosCrearProducto['crearComboSinIva']>) {
    return this.crearProducto.crearComboSinIva(...args);
  }
  async buscarComboYAgregarAlCarrito(...args: Parameters<PosCrearProducto['buscarComboYAgregarAlCarrito']>) {
    return this.crearProducto.buscarComboYAgregarAlCarrito(...args);
  }
  get modalCrearProducto() { return this.crearProducto.modalCrearProducto; }
  get checkboxIvaProducto() { return this.crearProducto.checkboxIvaProducto; }
  async abrirCrearProducto(...args: Parameters<PosCrearProducto['abrirCrearProducto']>) {
    return this.crearProducto.abrirCrearProducto(...args);
  }
  async llenarNombreProducto(...args: Parameters<PosCrearProducto['llenarNombreProducto']>) {
    return this.crearProducto.llenarNombreProducto(...args);
  }
  async llenarDatosCompletosProducto(...args: Parameters<PosCrearProducto['llenarDatosCompletosProducto']>) {
    return this.crearProducto.llenarDatosCompletosProducto(...args);
  }
  async avanzarPasoInfoGeneralProducto(...args: Parameters<PosCrearProducto['avanzarPasoInfoGeneralProducto']>) {
    return this.crearProducto.avanzarPasoInfoGeneralProducto(...args);
  }
  async llenarCostoProducto(...args: Parameters<PosCrearProducto['llenarCostoProducto']>) {
    return this.crearProducto.llenarCostoProducto(...args);
  }
  async llenarCostosBasicosProducto(...args: Parameters<PosCrearProducto['llenarCostosBasicosProducto']>) {
    return this.crearProducto.llenarCostosBasicosProducto(...args);
  }
  async llenarCostosCompletosProducto(...args: Parameters<PosCrearProducto['llenarCostosCompletosProducto']>) {
    return this.crearProducto.llenarCostosCompletosProducto(...args);
  }
  async _llenarDescuentoProveedorSiEsPosible(...args: Parameters<PosCrearProducto['_llenarDescuentoProveedorSiEsPosible']>) {
    return this.crearProducto._llenarDescuentoProveedorSiEsPosible(...args);
  }
  async activarIvaProducto(...args: Parameters<PosCrearProducto['activarIvaProducto']>) {
    return this.crearProducto.activarIvaProducto(...args);
  }
  async desactivarIvaProducto(...args: Parameters<PosCrearProducto['desactivarIvaProducto']>) {
    return this.crearProducto.desactivarIvaProducto(...args);
  }
  async seleccionarIvaManualmenteProducto(...args: Parameters<PosCrearProducto['seleccionarIvaManualmenteProducto']>) {
    return this.crearProducto.seleccionarIvaManualmenteProducto(...args);
  }
  async activarFraccionarProducto(...args: Parameters<PosCrearProducto['activarFraccionarProducto']>) {
    return this.crearProducto.activarFraccionarProducto(...args);
  }
  async llenarCostosFraccionadoProducto(...args: Parameters<PosCrearProducto['llenarCostosFraccionadoProducto']>) {
    return this.crearProducto.llenarCostosFraccionadoProducto(...args);
  }
  async obtenerTasaIvaSeleccionadaProductoPct(...args: Parameters<PosCrearProducto['obtenerTasaIvaSeleccionadaProductoPct']>) {
    return this.crearProducto.obtenerTasaIvaSeleccionadaProductoPct(...args);
  }
  async validarIvaCoincideConCabysProducto(...args: Parameters<PosCrearProducto['validarIvaCoincideConCabysProducto']>) {
    return this.crearProducto.validarIvaCoincideConCabysProducto(...args);
  }
  async avanzarPasoCostosProducto(...args: Parameters<PosCrearProducto['avanzarPasoCostosProducto']>) {
    return this.crearProducto.avanzarPasoCostosProducto(...args);
  }
  async llenarDescripcionProducto(...args: Parameters<PosCrearProducto['llenarDescripcionProducto']>) {
    return this.crearProducto.llenarDescripcionProducto(...args);
  }
  async finalizarCrearProducto(...args: Parameters<PosCrearProducto['finalizarCrearProducto']>) {
    return this.crearProducto.finalizarCrearProducto(...args);
  }
  async existePestanaPos(...args: Parameters<PosCore['existePestanaPos']>) {
    return this.core.existePestanaPos(...args);
  }
  async visitarPestanaPos(...args: Parameters<PosCore['visitarPestanaPos']>) {
    return this.core.visitarPestanaPos(...args);
  }
  async pestanaPosActiva(...args: Parameters<PosCore['pestanaPosActiva']>) {
    return this.core.pestanaPosActiva(...args);
  }
  async localizarPestanaApartados(...args: Parameters<PosCore['localizarPestanaApartados']>) {
    return this.core.localizarPestanaApartados(...args);
  }
  async seleccionarClienteExistente(...args: Parameters<PosCore['seleccionarClienteExistente']>) {
    return this.core.seleccionarClienteExistente(...args);
  }
  async seleccionarClienteExistenteDistintoDe(...args: Parameters<PosCore['seleccionarClienteExistenteDistintoDe']>) {
    return this.core.seleccionarClienteExistenteDistintoDe(...args);
  }
  async ingresarNombreCliente(...args: Parameters<PosCore['ingresarNombreCliente']>) {
    return this.core.ingresarNombreCliente(...args);
  }
  async _clickPrimeraOpcionDisponible(...args: Parameters<PosCore['_clickPrimeraOpcionDisponible']>) {
    return this.core._clickPrimeraOpcionDisponible(...args);
  }
  async _seleccionarPrimeraOpcionChosen(...args: Parameters<PosCore['_seleccionarPrimeraOpcionChosen']>) {
    return this.core._seleccionarPrimeraOpcionChosen(...args);
  }
  async _seleccionarPrimeraOpcionChosenSiHayOpciones(...args: Parameters<PosCore['_seleccionarPrimeraOpcionChosenSiHayOpciones']>) {
    return this.core._seleccionarPrimeraOpcionChosenSiHayOpciones(...args);
  }
  async _asegurarCheckboxEstado(...args: Parameters<PosCore['_asegurarCheckboxEstado']>) {
    return this.core._asegurarCheckboxEstado(...args);
  }
  async asegurarCheckboxIvaMarcado(...args: Parameters<PosCore['asegurarCheckboxIvaMarcado']>) {
    return this.core.asegurarCheckboxIvaMarcado(...args);
  }
  get checkboxIvaCombo() { return this.crearProducto.checkboxIvaCombo; }
  async activarIvaCombo(...args: Parameters<PosCrearProducto['activarIvaCombo']>) {
    return this.crearProducto.activarIvaCombo(...args);
  }
  async desactivarIvaCombo(...args: Parameters<PosCrearProducto['desactivarIvaCombo']>) {
    return this.crearProducto.desactivarIvaCombo(...args);
  }
  async _llamarSetProductTotal(...args: Parameters<PosCore['_llamarSetProductTotal']>) {
    return this.core._llamarSetProductTotal(...args);
  }
  async _leerValorDescuentoInput(...args: Parameters<PosCore['_leerValorDescuentoInput']>) {
    return this.core._leerValorDescuentoInput(...args);
  }
  async _leerYCerrarAlerta(...args: Parameters<PosCore['_leerYCerrarAlerta']>) {
    return this.core._leerYCerrarAlerta(...args);
  }
  async _cambiarMetodoPago(...args: Parameters<PosPayment['_cambiarMetodoPago']>) {
    return this.payment._cambiarMetodoPago(...args);
  }
  get modalOrdenCaja() { return this.ordenCaja.modalOrdenCaja; }
  get campoTercerosOrdenCaja() { return this.ordenCaja.campoTercerosOrdenCaja; }
  async abrirMenuOrdenCaja(...args: Parameters<PosOrdenCaja['abrirMenuOrdenCaja']>) {
    return this.ordenCaja.abrirMenuOrdenCaja(...args);
  }
  async seleccionarClienteEnOrdenCaja(...args: Parameters<PosOrdenCaja['seleccionarClienteEnOrdenCaja']>) {
    return this.ordenCaja.seleccionarClienteEnOrdenCaja(...args);
  }
  async obtenerClienteEnOrdenCaja(...args: Parameters<PosOrdenCaja['obtenerClienteEnOrdenCaja']>) {
    return this.ordenCaja.obtenerClienteEnOrdenCaja(...args);
  }
  async seleccionarVendedorOrdenCaja(...args: Parameters<PosOrdenCaja['seleccionarVendedorOrdenCaja']>) {
    return this.ordenCaja.seleccionarVendedorOrdenCaja(...args);
  }
  async seleccionarTipoPagoOrdenCaja(...args: Parameters<PosOrdenCaja['seleccionarTipoPagoOrdenCaja']>) {
    return this.ordenCaja.seleccionarTipoPagoOrdenCaja(...args);
  }
  async activarNombreTercerosOrdenCaja(...args: Parameters<PosOrdenCaja['activarNombreTercerosOrdenCaja']>) {
    return this.ordenCaja.activarNombreTercerosOrdenCaja(...args);
  }
  async llenarObservacionesOrdenCaja(...args: Parameters<PosOrdenCaja['llenarObservacionesOrdenCaja']>) {
    return this.ordenCaja.llenarObservacionesOrdenCaja(...args);
  }
  async enviarOrdenCaja(...args: Parameters<PosOrdenCaja['enviarOrdenCaja']>) {
    return this.ordenCaja.enviarOrdenCaja(...args);
  }
  async validarOrdenCajaCreada(...args: Parameters<PosOrdenCaja['validarOrdenCajaCreada']>) {
    return this.ordenCaja.validarOrdenCajaCreada(...args);
  }
  async _obtenerTextoChosenSeleccionado(...args: Parameters<PosOrdenCaja['_obtenerTextoChosenSeleccionado']>) {
    return this.ordenCaja._obtenerTextoChosenSeleccionado(...args);
  }
  async activarDescuentoGeneral(...args: Parameters<PosCore['activarDescuentoGeneral']>) {
    return this.core.activarDescuentoGeneral(...args);
  }
  async mostrarDetalleAvanzadoFactura(...args: Parameters<PosCore['mostrarDetalleAvanzadoFactura']>) {
    return this.core.mostrarDetalleAvanzadoFactura(...args);
  }
  async establecerPorcentajeDescuentoGeneral(...args: Parameters<PosCore['establecerPorcentajeDescuentoGeneral']>) {
    return this.core.establecerPorcentajeDescuentoGeneral(...args);
  }
  async obtenerMontoDescuentoGeneralNumerico(...args: Parameters<PosCore['obtenerMontoDescuentoGeneralNumerico']>) {
    return this.core.obtenerMontoDescuentoGeneralNumerico(...args);
  }
  async _leerMontoDeTexto(...args: Parameters<PosCore['_leerMontoDeTexto']>) {
    return this.core._leerMontoDeTexto(...args);
  }
  async _confirmarSweetAlertV1(...args: Parameters<PosCore['_confirmarSweetAlertV1']>) {
    return this.core._confirmarSweetAlertV1(...args);
  }
  async agregarProductoRapidoSimple(...args: Parameters<PosCore['agregarProductoRapidoSimple']>) {
    return this.core.agregarProductoRapidoSimple(...args);
  }
  async agregarProductoFraccionadoExistente(...args: Parameters<PosCore['agregarProductoFraccionadoExistente']>) {
    return this.core.agregarProductoFraccionadoExistente(...args);
  }
  async agregarProductoNormalFraccionadoYRapido(...args: Parameters<PosCore['agregarProductoNormalFraccionadoYRapido']>) {
    return this.core.agregarProductoNormalFraccionadoYRapido(...args);
  }
  async abrirModalExoneracion(...args: Parameters<PosCore['abrirModalExoneracion']>) {
    return this.core.abrirModalExoneracion(...args);
  }
  async aplicarExoneracion(...args: Parameters<PosCore['aplicarExoneracion']>) {
    return this.core.aplicarExoneracion(...args);
  }
  async obtenerMontoExoneracionNumerico(...args: Parameters<PosCore['obtenerMontoExoneracionNumerico']>) {
    return this.core.obtenerMontoExoneracionNumerico(...args);
  }
  async cancelarExoneracionSiEstaAplicada(...args: Parameters<PosCore['cancelarExoneracionSiEstaAplicada']>) {
    return this.core.cancelarExoneracionSiEstaAplicada(...args);
  }
  async obtenerTipoPagoEnModalPago(...args: Parameters<PosPayment['obtenerTipoPagoEnModalPago']>) {
    return this.payment.obtenerTipoPagoEnModalPago(...args);
  }
  async cambiarTipoPagoEnModalPago(...args: Parameters<PosPayment['cambiarTipoPagoEnModalPago']>) {
    return this.payment.cambiarTipoPagoEnModalPago(...args);
  }
  async obtenerVendedorEnModalPago(...args: Parameters<PosPayment['obtenerVendedorEnModalPago']>) {
    return this.payment.obtenerVendedorEnModalPago(...args);
  }
  async seleccionarVendedorEnModalPago(...args: Parameters<PosPayment['seleccionarVendedorEnModalPago']>) {
    return this.payment.seleccionarVendedorEnModalPago(...args);
  }

  // ─── "Orden de Ruteo" ───────────────────────────────────────────────────────

  /** Locator del modal "Crear Orden de Ruteo". */
  get modalRuteo() {
    return this.page.locator(L.DIALOG_RUTEO);
  }

  /**
   * Abre "Crear Orden de Ruteo" desde el menú desplegable junto a "Facturar"
   * (mismo menú que Proforma/Apartado/Enviar a caja, #demo-menu-top-right).
   * Mismo patrón de reintento (hasta 4 intentos, cerrando overlays conocidos
   * en cada vuelta) que abrirMenuOrdenCaja()/abrirCrearProforma()/
   * abrirCrearApartado() ya usan cada uno por su cuenta para este mismo
   * menú — necesario porque el modal requiere al menos un producto en el
   * carrito (create_routing_order() lo valida y aborta con un aviso si no lo
   * hay, dejando el modal sin abrir), así que quien llama debe agregar
   * producto(s) antes.
   */
  async abrirCrearOrdenRuteo() {
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarAvisoConsecutivoSiAparece();

    await this.page.locator('ul.mdl-menu[data-mdl-for="demo-menu-top-right"][data-upgraded*="MaterialMenu"]')
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const item = this.page.locator(L.RUTEO_MENU_ITEM);
    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      await this.cerrarAvisoConsecutivoSiAparece();

      await this.page.evaluate(
        (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
        L.ORDEN_CAJA_MENU_BTN
      );
      abierto = await item.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, `La opción "Orden de Ruteo" no apareció en el menú de acciones tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      L.RUTEO_MENU_ITEM
    );

    await expect(this.modalRuteo, 'El modal "Crear Orden de Ruteo" no apareció tras seleccionar la opción del menú').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Busca y selecciona un cliente DENTRO del modal "Crear Orden de Ruteo"
   * (Forma 2) — confirmado en vivo (no asumido de Apartado/Enviar a caja) que
   * usa su propio input (RUTEO_CLIENTE_INPUT_BUSQUEDA, distinto de ambos) pero
   * dispara el mismo AJAX compartido (CLIENTE_AJAX_BUSQUEDA) y llena un
   * <select> Chosen propio (RUTEO_CLIENTE_CHOSEN) — mismo mecanismo general
   * que seleccionarClienteEnOrdenCaja()/seleccionarClienteEnModalApartado(),
   * aplicado a los selectores reales de este modal. Una búsqueda vacía trae
   * todos los clientes disponibles — confirmado en vivo. Reutiliza
   * _seleccionarPrimeraOpcionChosen() para elegir la primera opción real (no
   * el placeholder "Seleccionar cliente"). Devuelve el nombre del cliente
   * realmente seleccionado.
   */
  async seleccionarClienteEnRuteo(terminoBusqueda = ''): Promise<string> {
    await this.page.locator(L.RUTEO_CLIENTE_INPUT_BUSQUEDA).fill(terminoBusqueda);

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.CLIENTE_AJAX_BUSQUEDA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.RUTEO_CLIENTE_BTN_BUSCAR).click();
    await respuestaPromise;

    await this._seleccionarPrimeraOpcionChosen(L.RUTEO_CLIENTE_CHOSEN);

    const nombreCliente = await this._obtenerTextoChosenSeleccionado(L.RUTEO_CLIENTE_CHOSEN);
    expect(nombreCliente, 'El nombre del cliente seleccionado en "Crear Orden de Ruteo" no quedó visible').not.toBe('');
    console.log(`[seleccionarClienteEnRuteo] Cliente seleccionado: "${nombreCliente}"`);
    return nombreCliente;
  }

  /**
   * Lee el nombre del cliente actualmente reflejado en el modal "Crear Orden
   * de Ruteo" — sirve tanto para confirmar lo elegido por
   * seleccionarClienteEnRuteo() (Forma 2) como para confirmar que un cliente
   * elegido arriba del carrito (seleccionarClienteExistente(), Forma 1) sí se
   * propagó aquí: confirmado en vivo (show_create_routing_order_modal() en
   * pos_routing.js) que ambas formas comparten el mismo cliente ya
   * seleccionado en el carrito (#customer_select/#customer_json_selected).
   */
  async obtenerClienteEnRuteo(): Promise<string> {
    return this._obtenerTextoChosenSeleccionado(L.RUTEO_CLIENTE_CHOSEN);
  }

  /**
   * Selecciona la primera ruta real disponible — catálogo configurable por la
   * empresa sin nombre estable, mismo criterio que el resto de la suite
   * (CABYS, tipo/tasa de IVA, vendedor de Enviar a caja). Obligatorio:
   * confirmado en vivo (confirm_send_routing_order() en pos_routing.js) que
   * el envío se rechaza con un aviso si queda en su placeholder. Devuelve el
   * nombre de la ruta realmente seleccionada.
   */
  async seleccionarRutaRuteo(): Promise<string> {
    await this._seleccionarPrimeraOpcionChosen(L.RUTEO_RUTA_CHOSEN);
    const nombreRuta = await this._obtenerTextoChosenSeleccionado(L.RUTEO_RUTA_CHOSEN);
    expect(nombreRuta, 'La ruta seleccionada en "Crear Orden de Ruteo" no quedó visible').not.toBe('');
    console.log(`[seleccionarRutaRuteo] Ruta seleccionada: "${nombreRuta}"`);
    return nombreRuta;
  }

  /**
   * Selecciona el primer repartidor real disponible — mismo criterio que
   * seleccionarRutaRuteo(). Obligatorio, igual que la ruta. No depende del
   * autocompletado que set_agent_in_modal_routing_order() intenta tras elegir
   * una ruta (ver el comentario de L.RUTEO_RUTA_CHOSEN): se selecciona
   * siempre de forma explícita, sin asumir que la ruta ya lo dejó listo.
   * Devuelve el nombre del repartidor realmente seleccionado.
   */
  async seleccionarRepartidorRuteo(): Promise<string> {
    await this._seleccionarPrimeraOpcionChosen(L.RUTEO_REPARTIDOR_CHOSEN);
    const nombreRepartidor = await this._obtenerTextoChosenSeleccionado(L.RUTEO_REPARTIDOR_CHOSEN);
    expect(nombreRepartidor, 'El repartidor seleccionado en "Crear Orden de Ruteo" no quedó visible').not.toBe('');
    console.log(`[seleccionarRepartidorRuteo] Repartidor seleccionado: "${nombreRepartidor}"`);
    return nombreRepartidor;
  }

  /**
   * Selecciona la primera dirección real del cliente si tiene alguna
   * registrada, sin fallar si no tiene ninguna — a diferencia de Ruta/
   * Repartidor, este campo es OPCIONAL (ver el comentario de
   * L.RUTEO_DIRECCION_CHOSEN).
   *
   * NO reutiliza _seleccionarPrimeraOpcionChosenSiHayOpciones() (la variante
   * "tolerante" que sí usan Subcategoría/Sub sección de "Crear Producto"):
   * confirmado en vivo que su fallback de "abrir el Chosen y presionar
   * Escape cuando no hay opciones" deja un backdrop huérfano cubriendo todo
   * el modal de Ruteo (ver el comentario de L.RUTEO_DIRECCION_CHOSEN) — un
   * problema propio de estar dentro de un modal ya abierto que Subcategoría/
   * Sub sección no tienen. En su lugar, se comprueba de antemano sobre el
   * <select> real (sin abrir nunca el Chosen) si existe alguna opción
   * distinta del placeholder, y solo se abre el Chosen cuando sí la hay —
   * evita por completo la necesidad de cancelarlo.
   *
   * Devuelve el texto actualmente reflejado (una dirección real, o el
   * placeholder "Seleccionar dirección" si el cliente no tiene ninguna).
   */
  async seleccionarDireccionRuteoSiExiste(): Promise<string> {
    const hayDirecciones = (await this.page.locator(`${L.RUTEO_DIRECCION_SELECT} option:not([value="0"])`).count()) > 0;
    if (hayDirecciones) {
      await this._seleccionarPrimeraOpcionChosen(L.RUTEO_DIRECCION_CHOSEN);
    }
    return this._obtenerTextoChosenSeleccionado(L.RUTEO_DIRECCION_CHOSEN);
  }

  /**
   * Llena las observaciones de "Crear Orden de Ruteo" — mismo patrón de
   * llenarObservacionesOrdenCaja() (un simple fill()), pero sobre el textarea
   * propio de este modal (RUTEO_OBSERVACION, id distinto). A diferencia de
   * ese método, devuelve el valor que realmente quedó en el campo: necesario
   * porque esta suite sí debe validar explícitamente que la observación se
   * registró, y no existía ningún método existente que expusiera ese valor
   * sin tocar el locator crudo desde el test.
   */
  async llenarObservacionesRuteo(texto: string): Promise<string> {
    const campo = this.page.locator(L.RUTEO_OBSERVACION);
    await campo.fill(texto);
    return campo.inputValue();
  }

  /**
   * Presiona "Enviar Orden" y confirma el SweetAlert de advertencia
   * ("¿Enviar órden a ruteo?") — mismo patrón que enviarOrdenCaja()/
   * guardarProformaYObtenerRespuesta()/guardarApartadoYObtenerRespuesta():
   * arma la espera de la respuesta AJAX ANTES del click, confirma el
   * SweetAlert reutilizando _confirmarSweetAlertV1(), y devuelve la
   * respuesta cruda para que el test decida cómo validarla.
   */
  async guardarOrdenRuteoYObtenerRespuesta(): Promise<Response> {
    await this.page.locator(L.RUTEO_BTN_ENVIAR).click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_RUTEO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this._confirmarSweetAlertV1('No apareció la confirmación "¿Enviar órden a ruteo?"');
    return respuestaPromise;
  }

  /**
   * Valida que "Crear Orden de Ruteo" terminó exitosamente: la respuesta real
   * de AJAX_GUARDAR_RUTEO respondió OK con un id numérico (>=1, mismo
   * contrato que AJAX_GUARDAR_APARTADO), el modal se cerró y el carrito quedó
   * vacío (clear_product_table() en pos_routing.js, confirmado en vivo). Sin
   * ventana de impresión que esperar ni cerrar (ver el comentario de
   * L.AJAX_GUARDAR_RUTEO): a diferencia de Facturar/Cerrar Caja, este
   * ambiente no tiene la impresión automática de comanda activada.
   */
  /**
   * Cierra el modal de Ruteo (creación/edición) a la fuerza si quedó
   * abierto — necesario tras un intento de guardar en moneda no base que el
   * ambiente bloquea en silencio (confirmado en vivo: el modal permanece
   * abierto, sin ningún AJAX_GUARDAR_RUTEO ni SweetAlert que lo cierre).
   */
  async cerrarModalRuteoForzado() {
    const modal = this.modalRuteo;
    if (!(await modal.isVisible().catch(() => false))) return;
    await modal.locator('[data-dismiss="modal"]').first().click({ force: true }).catch(() => {});
    await expect(modal, 'El modal de Ruteo no se cerró al forzar su cierre').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  async validarOrdenRuteoCreada(respuesta: Response) {
    expect(respuesta.ok(), `${L.AJAX_GUARDAR_RUTEO} no respondió OK (status ${respuesta.status()})`).toBe(true);

    const cuerpo = (await respuesta.text()).trim();
    expect(parseInt(cuerpo, 10), `${L.AJAX_GUARDAR_RUTEO} no devolvió un id válido (respondió "${cuerpo}")`).toBeGreaterThanOrEqual(1);

    await expect(
      this.modalRuteo,
      'El modal "Crear Orden de Ruteo" no se cerró tras confirmar el envío'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.validarCarritoVacio();
  }

  // ─── Listado de Órdenes de Ruteo YA CREADAS: "Ver Orden"/"Editar Orden"/estado ──
  // Ver el comentario de L.RUTEO_LISTA_TARJETA_PREFIJO para la evidencia
  // completa (estructura real de la tarjeta, opciones del menú, códigos de
  // estado). Cada Orden se localiza SIEMPRE por su id real (el mismo que
  // devuelve guardarOrdenRuteoYObtenerRespuesta()), nunca por posición en el
  // listado: bajo `fullyParallel`, otro worker puede estar creando/editando
  // sus propias órdenes en la misma pestaña "Ruteo" al mismo tiempo, así que
  // depender de "la primera tarjeta" sería una condición de carrera real.

  /** Locator de una tarjeta de Orden de Ruteo ya creada, por su id real. */
  tarjetaRuteo(ordenId: string): Locator {
    return this.page.locator(`#${L.RUTEO_LISTA_TARJETA_PREFIJO}${ordenId}`);
  }

  /**
   * Abre la pestaña superior "Ruteo" (listado de órdenes YA creadas —
   * distinta del menú "Crear Orden de Ruteo"/RUTEO_MENU_ITEM), reutilizando
   * visitarPestanaPos() con la entrada ya registrada en
   * PESTANAS_POS_A_RECORRER, sin duplicar esa lógica.
   */
  async abrirListadoOrdenesRuteo() {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Ruteo')!;
    await this.visitarPestanaPos(pestana);
  }

  /**
   * Indica si el tab superior "Ruteo" sigue activo — mismo criterio que
   * pestanaPosActiva(), con la pestaña ya resuelta. Confirmado en vivo que
   * seleccionarOrdenRuteoParaFacturar() y alternarVistaExpandida() NO sacan
   * al usuario de este tab (a diferencia de abrirAgregarItem(), que activa
   * el tab "Productos" — ver su comentario): útil para escenarios que deben
   * facturar una Orden de Ruteo sin abandonar esta pestaña.
   */
  async pestanaRuteoActiva(): Promise<boolean> {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Ruteo')!;
    return this.pestanaPosActiva(pestana);
  }

  /**
   * Presiona "Volver" desde el catálogo (abierto con abrirAgregarItem())
   * hacia el tab "Ruteo", reutilizando volverDesdeAgregarItem() con la
   * pestaña ya resuelta — mismo patrón que abrirListadoOrdenesRuteo()/
   * pestanaRuteoActiva(), sin necesitar que el archivo de test importe
   * PESTANAS_POS_A_RECORRER solo para esto.
   */
  async volverDesdeAgregarItemHaciaRuteo() {
    const pestana = PESTANAS_POS_A_RECORRER.find((p) => p.etiqueta === 'Ruteo')!;
    await this.volverDesdeAgregarItem(pestana);
  }

  /**
   * Indica si la tarjeta de una Orden de Ruteo (por id) aparece visible
   * dentro del filtro real "Entregado" (FILTRO_RUTEO_ENTREGADO) — cambia a
   * ese filtro primero. Útil para confirmar explícitamente que una orden
   * SALIÓ de "Entregado" tras un cambio de estado o facturación (a
   * diferencia de asegurarOrdenRuteoVisibleEnListado(), que solo garantiza
   * que la tarjeta aparezca EN ALGÚN LADO, sin importar cuál).
   */
  async ordenVisibleEnFiltroEntregado(ordenId: string): Promise<boolean> {
    await this.page.locator(L.FILTRO_RUTEO_ENTREGADO).click();
    return this.tarjetaRuteo(ordenId).isVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD }).catch(() => false);
  }

  /**
   * Indica si la tarjeta de una Orden de Ruteo (por id) aparece visible
   * dentro del filtro real "H. de Órdenes" (FILTRO_RUTEO_HISTORIAL) —
   * cambia a ese filtro primero. Ver el comentario de
   * ordenVisibleEnFiltroEntregado() para el criterio general.
   */
  async ordenVisibleEnHistorial(ordenId: string): Promise<boolean> {
    await this.page.locator(L.FILTRO_RUTEO_HISTORIAL).click();
    return this.tarjetaRuteo(ordenId).isVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD }).catch(() => false);
  }

  /**
   * Asegura que la tarjeta de una Orden de Ruteo (por su id real) quede
   * visible en el listado, sin importar qué filtro esté activo en este
   * momento — confirmado en vivo (investigado a fondo, no asumido) que una
   * orden que llega al estado Entregado + Facturado se MUEVE de "Todos" a
   * "H. de Órdenes" (FILTRO_RUTEO_HISTORIAL): comparando el mismo id de
   * orden en ambas vistas, la tarjeta deja de existir/verse en "Todos" y
   * aparece en "H. de Órdenes". Los métodos que localizan una tarjeta por
   * id (tarjetaRuteo()) asumían implícitamente que "Todos" siempre era el
   * lugar correcto — bajo `fullyParallel`/corridas largas donde varios
   * escenarios comparten el mismo pool de órdenes (p. ej. un escenario que
   * marca una orden como Entregada y otro que ya la había facturado antes),
   * eso deja de ser cierto y la tarjeta puede esperar su timeout completo
   * sin nunca aparecer.
   *
   * Estrategia (sin excepciones para distinguir casos, solo waitFor con
   * timeouts cortos vía `.catch(() => false)`, mismo criterio que el resto
   * de esta clase): probar primero la vista ya activa (corto, la mayoría de
   * los casos no necesitan cambiar nada), luego "H. de Órdenes", y si
   * tampoco aparece ahí, volver a "Todos" — el mismo estado por defecto que
   * el resto de la suite espera — y dejar que el propio caller reporte el
   * error real con su propio mensaje (esta orden simplemente no existe o el
   * ambiente tiene un problema genuino, no un filtro mal ubicado).
   */
  async asegurarOrdenRuteoVisibleEnListado(ordenId: string): Promise<void> {
    const tarjeta = this.tarjetaRuteo(ordenId);
    const yaVisible = await tarjeta.isVisible({ timeout: 5_000 }).catch(() => false);
    if (yaVisible) return;

    const visibleEnHistorial = await this.page.locator(L.FILTRO_RUTEO_HISTORIAL).click()
      .then(() => tarjeta.isVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD }))
      .catch(() => false);
    if (visibleEnHistorial) return;

    await this.page.locator(L.FILTRO_RUTEO_TODOS).click().catch(() => {});
  }

  /**
   * Abre el menú de acciones (ícono "more_vert") de una Orden de Ruteo ya
   * creada, localizada por su id real — falla con un mensaje claro si la
   * tarjeta no aparece en el listado ya cargado. Antes de buscarla,
   * asegura que esté visible en la vista correcta (ver el comentario de
   * asegurarOrdenRuteoVisibleEnListado(): puede haberse movido a "H. de
   * Órdenes" si ya está Entregada + Facturada).
   */
  async abrirMenuAccionesOrdenRuteo(ordenId: string) {
    await this.asegurarOrdenRuteoVisibleEnListado(ordenId);
    const tarjeta = this.tarjetaRuteo(ordenId);
    await expect(tarjeta, `La orden de Ruteo #${ordenId} no aparece en el listado "Ruteo" (ni en "Todos" ni en "H. de Órdenes")`).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });
    await tarjeta.locator(L.RUTEO_LISTA_BTN_MENU).click();
    await expect(
      tarjeta.locator('ul.dropdown-menu'),
      `El menú de acciones de la orden #${ordenId} no se abrió`
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Con el menú de acciones ya abierto (abrirMenuAccionesOrdenRuteo()),
   * selecciona "Ver órden" y lee los datos reales mostrados en el modal de
   * detalle (#dialog_view_routing_order_detail), cerrándolo al terminar.
   * Confirmado en vivo que este detalle no incluye "Vendedor" (solo
   * "Repartidor") ni etiqueta explícita de moneda/estado/fecha — esos solo
   * se reflejan en la propia tarjeta del listado (fecha) o se infieren del
   * símbolo en los montos (moneda); el estado se lee aparte con
   * obtenerEstadoTarjetaRuteo().
   */
  async verOrdenRuteo(ordenId: string) {
    await this.page.locator(`li[onclick="show_routing_order_detail(${ordenId});"]`).click();

    const modal = this.page.locator(L.DIALOG_VER_ORDEN_RUTEO);
    await expect(modal, 'El modal "Ver Orden" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const leerMonto = async (selector: string) =>
      parseFloat(((await this.page.locator(selector).textContent()) ?? '0').replace(/[^0-9.]/g, '')) || 0;

    const datos = {
      numero: ((await this.page.locator(L.VER_RUTEO_NUMERO).textContent()) ?? '').trim(),
      repartidor: ((await this.page.locator(L.VER_RUTEO_REPARTIDOR).textContent()) ?? '').trim(),
      clienteNombre: ((await this.page.locator(L.VER_RUTEO_CLIENTE_NOMBRE).textContent()) ?? '').trim(),
      direccion: ((await this.page.locator(L.VER_RUTEO_CLIENTE_DIRECCION).textContent()) ?? '').trim(),
      observacion: ((await this.page.locator(L.VER_RUTEO_OBSERVACION).textContent()) ?? '').trim(),
      cantidadProductos: await this.page.locator(L.VER_RUTEO_FILAS_PRODUCTO).count(),
      subtotal: await leerMonto(L.VER_RUTEO_SUBTOTAL),
      descuento: await leerMonto(L.VER_RUTEO_DESCUENTO),
      impuesto: await leerMonto(L.VER_RUTEO_IMPUESTO),
      total: await leerMonto(L.VER_RUTEO_TOTAL),
    };

    await modal.locator('.btn_dvrod_close, [data-dismiss="modal"]').first().click();
    await expect(modal, 'El modal "Ver Orden" no se cerró').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    return datos;
  }

  /**
   * Con el menú de acciones ya abierto, selecciona "Editar órden" (reutiliza
   * el mismo modal #dialog_add_routing_order y los mismos ids/botón que
   * crear una Orden de Ruteo — ver el comentario de
   * L.RUTEO_LISTA_TARJETA_PREFIJO) y modifica Ruta, Repartidor y
   * Observaciones: los ÚNICOS campos realmente editables en este ambiente,
   * confirmado en vivo — el bloque de cliente permanece oculto
   * (display:none) y no existe ningún campo de productos/cantidades/
   * vendedor en este modal. Guarda reutilizando
   * guardarOrdenRuteoYObtenerRespuesta() tal cual (mismo botón, misma
   * petición AJAX_GUARDAR_RUTEO que la creación, confirmado en vivo).
   */
  async editarOrdenRuteo(ordenId: string, nuevaObservacion: string) {
    await this.page.locator(`li[onclick="show_create_routing_order_modal(${ordenId});"]`).click();

    const modal = this.modalRuteo;
    await expect(modal, 'El modal "Editar Orden de Ruteo" no apareció').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const ruta = await this.seleccionarRutaRuteo();
    const repartidor = await this.seleccionarRepartidorRuteo();
    const observacionRegistrada = await this.llenarObservacionesRuteo(nuevaObservacion);

    const respuesta = await this.guardarOrdenRuteoYObtenerRespuesta();
    expect(respuesta.ok(), `El guardado de la edición no respondió OK (status ${respuesta.status()})`).toBe(true);
    await expect(modal, 'El modal "Editar Orden de Ruteo" no se cerró tras guardar').toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    return { ruta, repartidor, observacionRegistrada };
  }

  /**
   * Con el menú de acciones ya abierto, selecciona "Marcar como <estado>"
   * (change_routing_order_status(id, código)) y espera la respuesta real de
   * AJAX_CAMBIO_ESTADO_RUTEO. Códigos confirmados en vivo: 1=Pendiente,
   * 2=En camino, 3=Entregado. Sin SweetAlert de por medio (confirmado en
   * vivo, a diferencia del resto de acciones de Ruteo).
   */
  async cambiarEstadoOrdenRuteo(ordenId: string, estado: 1 | 2 | 3) {
    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_CAMBIO_ESTADO_RUTEO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(`li[onclick="change_routing_order_status(${ordenId},${estado});"]`).click();
    const respuesta = await respuestaPromise;
    expect(respuesta.ok(), `El cambio de estado de la orden #${ordenId} a ${estado} no respondió OK`).toBe(true);
  }

  /**
   * Lee el estado real de una tarjeta de Ruteo ya visible en el listado
   * desde su propia clase (delivery-status-1/2/3) — nunca asumido a partir
   * de la última acción ejecutada, mismo criterio de "leer el DOM real" que
   * el resto de la suite. Antes de leerla, asegura que esté visible en la
   * vista correcta (ver el comentario de asegurarOrdenRuteoVisibleEnListado()).
   */
  async obtenerEstadoTarjetaRuteo(ordenId: string): Promise<1 | 2 | 3> {
    await this.asegurarOrdenRuteoVisibleEnListado(ordenId);
    const clase = (await this.tarjetaRuteo(ordenId).getAttribute('class')) ?? '';
    const match = clase.match(/delivery-status-(\d)/);
    expect(match, `No se pudo leer el estado de la orden #${ordenId} desde su clase: "${clase}"`).not.toBeNull();
    return Number(match![1]) as 1 | 2 | 3;
  }

  // ─── Facturar una Orden de Ruteo ya creada ─────────────────────────────────
  // Ver el comentario de L.RUTEO_LISTA_BTN_SELECCIONAR para la evidencia
  // completa: el botón "Seleccionar órden" (fuera del menú de acciones) es el
  // único mecanismo real para llevar una Orden de Ruteo a facturación.

  /**
   * Localiza el id real de la primera Orden de Ruteo del listado que
   * TODAVÍA puede seleccionarse para facturar (botón "Seleccionar órden"
   * visible en su tarjeta — ver L.RUTEO_LISTA_BTN_SELECCIONAR) — para
   * escenarios que no necesitan crear su propia orden porque cualquier
   * orden Pendiente de facturar ya sirve (este ambiente ya trae un listado
   * grande de órdenes previas). Requiere que el listado "Ruteo" ya esté
   * abierto (abrirListadoOrdenesRuteo()). Localiza SIEMPRE leyendo el id
   * real del propio DOM (RUTEO_LISTA_TARJETA_PREFIJO + id numérico), nunca
   * por posición fija — mismo criterio "por id real" que el resto de los
   * métodos de listado de Ruteo (ver el comentario de
   * abrirMenuAccionesOrdenRuteo()).
   *
   * Nota: bajo `fullyParallel`, todos los workers comparten la misma cuenta/
   * sesión (ver el comentario de la fixture "pos" en pos-ruteo.spec.ts), así
   * que dos workers podrían intentar seleccionar la MISMA orden "primera
   * disponible" al mismo tiempo — un escenario que prefiere crear su propia
   * orden evita ese riesgo por completo; este método es para cuando esa
   * garantía no es necesaria.
   */
  async obtenerPrimeraOrdenRuteoSeleccionable(idAExcluir?: string): Promise<string> {
    const selectorBase = idAExcluir
      ? `[id^="${L.RUTEO_LISTA_TARJETA_PREFIJO}"]:not(#${L.RUTEO_LISTA_TARJETA_PREFIJO}${idAExcluir})`
      : `[id^="${L.RUTEO_LISTA_TARJETA_PREFIJO}"]`;
    const tarjetaConBoton = this.page
      .locator(selectorBase)
      .filter({ has: this.page.locator(L.RUTEO_LISTA_BTN_SELECCIONAR) })
      .first();

    await expect(
      tarjetaConBoton,
      `No se encontró ninguna Orden de Ruteo seleccionable (Pendiente de facturar)${idAExcluir ? ` distinta de #${idAExcluir}` : ''} en el listado`
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const idCompleto = await tarjetaConBoton.getAttribute('id');
    const ordenId = (idCompleto ?? '').replace(L.RUTEO_LISTA_TARJETA_PREFIJO, '');
    expect(ordenId.length, `No se pudo extraer un id numérico del atributo id="${idCompleto}"`).toBeGreaterThan(0);
    return ordenId;
  }

  /**
   * Localiza el id real de la primera Orden de Ruteo del listado que
   * actualmente tiene el estado de envío pedido (1=Pendiente, 2=En camino,
   * 3=Entregado — mismo código que obtenerEstadoTarjetaRuteo() ya usa) —
   * para escenarios que necesitan una orden YA EXISTENTE en un estado
   * específico (p. ej. "En camino" para poder marcarla como "Entregado", o
   * "Pendiente" para marcarla como "En camino") en vez de crear su propia
   * orden y llevarla paso a paso hasta ese estado. No filtra por
   * facturación: puede devolver una orden ya Facturada (ver
   * obtenerPrimeraOrdenRuteoConEstadoYSeleccionable() para cuando también
   * debe poder facturarse).
   *
   * Nota: filtra directamente sobre las tarjetas ya cargadas por su propia
   * clase (mismo criterio que obtenerEstadoTarjetaRuteo()), sin pasar por
   * los filtros reales FILTRO_RUTEO_* — evita el side-effect de dejar el
   * listado en un filtro distinto de "Todos" para escenarios (12/13/14) que
   * después necesitan localizar la MISMA orden por id sin importar el
   * filtro activo (ya cubierto por asegurarOrdenRuteoVisibleEnListado()).
   */
  async obtenerPrimeraOrdenRuteoConEstado(estado: 1 | 2 | 3): Promise<string> {
    const tarjetaConEstado = this.page
      .locator(`[id^="${L.RUTEO_LISTA_TARJETA_PREFIJO}"].delivery-status-${estado}`)
      .first();

    await expect(
      tarjetaConEstado,
      `No se encontró ninguna Orden de Ruteo con estado de envío ${estado} en el listado`
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const idCompleto = await tarjetaConEstado.getAttribute('id');
    const ordenId = (idCompleto ?? '').replace(L.RUTEO_LISTA_TARJETA_PREFIJO, '');
    expect(ordenId.length, `No se pudo extraer un id numérico del atributo id="${idCompleto}"`).toBeGreaterThan(0);
    return ordenId;
  }

  /**
   * Localiza el id real de la primera Orden de Ruteo que, dentro del filtro
   * REAL "Pendientes"/"En Camino"/"Entregado" (FILTRO_RUTEO_*, botones con
   * id técnico estable — corrige una conclusión anterior de este mismo
   * archivo que los daba por una simple leyenda decorativa, confirmado en
   * vivo que sí filtran), todavía puede seleccionarse para facturar (botón
   * "Seleccionar órden" visible) — a diferencia de
   * obtenerPrimeraOrdenRuteoConEstado() (no filtra por facturación) y de
   * obtenerPrimeraOrdenRuteoSeleccionable() (no filtra por estado de
   * envío), este combina ambos criterios: necesario para escenarios que
   * piden explícitamente una orden de un estado de envío dado que además se
   * pueda facturar de verdad (p. ej. una orden Entregada aún sin facturar).
   * Restaura el filtro "Todos" antes de devolver el id, dejando el listado
   * en el estado que el resto de la suite espera.
   */
  async obtenerPrimeraOrdenRuteoConEstadoYSeleccionable(estado: 1 | 2 | 3): Promise<string> {
    const filtro = estado === 1 ? L.FILTRO_RUTEO_PENDIENTE : estado === 2 ? L.FILTRO_RUTEO_EN_CAMINO : L.FILTRO_RUTEO_ENTREGADO;
    await this.page.locator(filtro).click();

    const tarjetaConBoton = this.page
      .locator(`[id^="${L.RUTEO_LISTA_TARJETA_PREFIJO}"]`)
      .filter({ has: this.page.locator(L.RUTEO_LISTA_BTN_SELECCIONAR) })
      .first();

    await expect(
      tarjetaConBoton,
      `No se encontró ninguna Orden de Ruteo con estado de envío ${estado} que todavía pueda seleccionarse para facturar`
    ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const idCompleto = await tarjetaConBoton.getAttribute('id');
    const ordenId = (idCompleto ?? '').replace(L.RUTEO_LISTA_TARJETA_PREFIJO, '');
    expect(ordenId.length, `No se pudo extraer un id numérico del atributo id="${idCompleto}"`).toBeGreaterThan(0);

    await this.page.locator(L.FILTRO_RUTEO_TODOS).click();
    return ordenId;
  }

  /**
   * Selecciona ("Seleccionar órden") una Orden de Ruteo YA CREADA, localizada
   * por su id real (mismo criterio "siempre por id real, nunca por posición"
   * que el resto de los métodos de listado de Ruteo — ver el comentario de
   * abrirMenuAccionesOrdenRuteo()), y la carga al carrito del POS. Deja el
   * carrito, el cliente ya asociado a la orden y el resto de controles del
   * POS (Facturar, "AGREGAR ITEMS") exactamente en el mismo estado que
   * cargarPrimeraOrdenCajaDisponible()/importarPrimeraFacturaDisponible()
   * (confirmado en vivo) — mismo flujo genérico de "venta pendiente cargada
   * al carrito", solo con un origen distinto: desde aquí aplica el resto de
   * la infraestructura ya existente (abrirAgregarItem(), presionarFacturar(),
   * cambiarTipoPagoEnModalPago(), quitarClienteSeleccionado(), etc.) sin
   * necesitar nada propio de Ruteo.
   */
  async seleccionarOrdenRuteoParaFacturar(ordenId: string) {
    const tarjeta = this.tarjetaRuteo(ordenId);
    await expect(tarjeta, `La orden de Ruteo #${ordenId} no aparece en el listado "Ruteo"`).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_CARGAR_RUTEO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await tarjeta.locator(L.RUTEO_LISTA_BTN_SELECCIONAR).click();
    await respuestaPromise;

    await expect(
      this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
      'No se cargó ninguna línea de producto tras seleccionar la Orden de Ruteo'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // El cliente ya asociado a la orden se propaga con una llamada AJAX
    // propia (getCustomerByPosOption) que corre DESPUÉS de la respuesta de
    // AJAX_CARGAR_RUTEO ya esperada arriba — confirmado en vivo (2 corridas)
    // que leer el cliente inmediatamente tras esa primera respuesta puede
    // atrapar el estado transitorio "Cliente de contado" (el placeholder por
    // defecto) en vez del cliente real de la orden, ya en vuelo pero sin
    // resolver todavía. Toda Orden de Ruteo exige un cliente real para
    // crearse (create_routing_order()/confirm_send_routing_order() en
    // pos_routing.js lo validan), así que se espera aquí, de forma explícita,
    // a que ese cliente real quede reflejado antes de devolver el control.
    await expect.poll(
      () => this.hayClienteRealSeleccionado(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El cliente real de la orden no se propagó al carrito tras seleccionarla' }
    ).toBe(true);
  }

  /**
   * Lee el estado de facturación mostrado en la propia tarjeta ("Pendiente"/
   * "Facturado", L.RUTEO_LISTA_LBL_FACTURA) — independiente del estado de
   * envío (obtenerEstadoTarjetaRuteo()): una orden puede estar Entregada y
   * seguir con la factura Pendiente, o viceversa (ver el comentario de
   * L.RUTEO_LISTA_LBL_FACTURA). Antes de leerla, asegura que esté visible
   * en la vista correcta (ver el comentario de
   * asegurarOrdenRuteoVisibleEnListado()): una orden ya Entregada +
   * Facturada vive en "H. de Órdenes", no en "Todos".
   */
  async obtenerEstadoFacturacionOrdenRuteo(ordenId: string): Promise<string> {
    await this.asegurarOrdenRuteoVisibleEnListado(ordenId);
    const texto = await this.tarjetaRuteo(ordenId).locator(L.RUTEO_LISTA_LBL_FACTURA).textContent();
    return (texto ?? '').trim();
  }

  /**
   * Indica si una Orden de Ruteo todavía puede seleccionarse para facturar
   * (el botón "Seleccionar órden" sigue visible en su tarjeta) — confirmado
   * en vivo que este botón desaparece de la tarjeta apenas la orden ya fue
   * facturada, en el mismo momento en que obtenerEstadoFacturacionOrdenRuteo()
   * pasa a "Facturado".
   */
  async ordenRuteoSeleccionable(ordenId: string): Promise<boolean> {
    return this.tarjetaRuteo(ordenId).locator(L.RUTEO_LISTA_BTN_SELECCIONAR).isVisible().catch(() => false);
  }

  /** Cambia al filtro real indicado del listado "Ruteo" (ver el comentario de FILTRO_RUTEO_TODOS). */
  async irAFiltroRuteo(filtro: 'Todos' | 'Pendiente' | 'En Camino' | 'Entregado' | 'H. de Órdenes') {
    const selector = {
      'Todos': L.FILTRO_RUTEO_TODOS,
      'Pendiente': L.FILTRO_RUTEO_PENDIENTE,
      'En Camino': L.FILTRO_RUTEO_EN_CAMINO,
      'Entregado': L.FILTRO_RUTEO_ENTREGADO,
      'H. de Órdenes': L.FILTRO_RUTEO_HISTORIAL,
    }[filtro];
    await this.page.locator(selector).click();
  }

  // ─── Acciones masivas del listado "Ruteo" (menú "Acciones": selección
  // múltiple + Enviar a Ruteo/Cambiar Repartidor/Eliminar + reporte PDF) ─────
  // Ver el comentario de RUTEO_MASIVO_LI_SELECCIONAR para la evidencia
  // completa de cómo se abre/cierra este dropdown.

  /** Ancla estable al botón `[data-toggle="dropdown"]` real del menú "Acciones" del listado Ruteo. */
  private get _btnAccionesMasivasRuteo(): Locator {
    return this.page
      .locator(L.RUTEO_MASIVO_LI_SELECCIONAR)
      .locator('xpath=ancestor::div[contains(@class,"dropdown")][1]//button[@data-toggle="dropdown"]')
      .first();
  }

  /**
   * Abre (o reabre) el dropdown "Acciones" del listado Ruteo — necesario
   * antes de CADA click dentro de él, no solo el primero: Bootstrap lo cierra
   * ante cualquier click fuera, incluido el que marca un checkbox de tarjeta
   * más abajo en la página (confirmado en vivo).
   */
  private async _abrirMenuAccionesMasivasRuteo() {
    await this._btnAccionesMasivasRuteo.click();
    await expect(
      this.page.locator(L.RUTEO_MASIVO_LI_SELECCIONAR),
      'El menú "Acciones" del listado Ruteo no se abrió'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Activa el modo de selección múltiple del listado Ruteo ("Seleccionar"):
   * revela el checkbox de cada tarjeta y los 3 `<li>` de acción masiva.
   * Llamar una sola vez por escenario, después de abrirListadoOrdenesRuteo()/
   * el filtro real que corresponda, antes de marcar ninguna orden.
   */
  async entrarModoSeleccionMasivaRuteo() {
    await this._abrirMenuAccionesMasivasRuteo();
    await this.page.locator(L.RUTEO_MASIVO_LI_SELECCIONAR).click();
  }

  /**
   * Indica si el modo de selección múltiple del listado Ruteo (activado con
   * entrarModoSeleccionMasivaRuteo()) sigue habilitado AHORA MISMO: los 3
   * `<li>` de acción masiva visibles (sin clase `hide`) y al menos un
   * checkbox de tarjeta realmente visible en el DOM. Útil tras cambiar de
   * filtro real (irAFiltroRuteo()) sin volver a clickear "Seleccionar" —
   * confirmado en vivo que `select_orders()` es un TOGGLE cuyo estado
   * persiste entre filtros (no hay que reactivarlo en cada uno).
   */
  async seleccionMasivaRuteoHabilitada(): Promise<boolean> {
    return this.page.evaluate(
      ({ eliminar, cambiarRepartidor, enviar, checkboxPrefijo }) => {
        const acciones = [eliminar, cambiarRepartidor, enviar].map((sel) => document.querySelector(sel));
        if (acciones.some((a) => !a || a.classList.contains('hide'))) return false;
        const checkboxes = Array.from(document.querySelectorAll(`[id^="${checkboxPrefijo}"]`));
        return checkboxes.some((cb) => (cb as HTMLElement).offsetParent !== null);
      },
      {
        eliminar: L.RUTEO_MASIVO_LI_ELIMINAR,
        cambiarRepartidor: L.RUTEO_MASIVO_LI_CAMBIAR_REPARTIDOR,
        enviar: L.RUTEO_MASIVO_LI_ENVIAR,
        checkboxPrefijo: L.RUTEO_MASIVO_CHECKBOX_PREFIJO,
      }
    );
  }

  /**
   * Marca (checkbox) una Orden de Ruteo, localizada por su id real, para una
   * acción masiva ya con entrarModoSeleccionMasivaRuteo() activo. Usa
   * evaluate() como el resto de checkboxes "outside of viewport" de esta
   * clase (ver el comentario de RUTEO_MASIVO_CHECKBOX_PREFIJO) — nunca
   * `.check()`/`.click()` directos, que fallan contra este listado con
   * cientos de tarjetas.
   */
  async marcarOrdenParaAccionMasivaRuteo(ordenId: string) {
    await this.asegurarOrdenRuteoVisibleEnListado(ordenId);
    const checkboxId = `${L.RUTEO_MASIVO_CHECKBOX_PREFIJO}${ordenId}`;
    await this.page.evaluate(
      (id) => (document.getElementById(id) as HTMLInputElement | null)?.click(),
      checkboxId
    );
    await expect(
      this.page.locator(`#${checkboxId}`),
      `El checkbox de selección de la Orden de Ruteo #${ordenId} no quedó marcado`
    ).toBeChecked();
  }

  /**
   * Completa el modal `#modal_change_sellers` compartido por "Enviar a
   * Ruteo"/"Cambiar Repartidor" masivos (ver el comentario de
   * RUTEO_MASIVO_MODAL): elige el primer repartidor real disponible (mismo
   * criterio que seleccionarRepartidorRuteo()) y guarda, esperando la
   * respuesta real del endpoint AJAX correspondiente — nunca solo el toast.
   * Devuelve la respuesta cruda (el caller decide cómo validarla: los dos
   * endpoints NO tienen el mismo contrato de éxito/fallo, ver el comentario
   * de RUTEO_MASIVO_MODAL) y el nombre del repartidor elegido.
   */
  private async _confirmarModalAccionMasivaRuteo(fragmentoUrlAjax: string): Promise<{ respuesta: Response; repartidorSeleccionado: string }> {
    const modal = this.page.locator(L.RUTEO_MASIVO_MODAL);
    await expect(
      modal,
      'El modal de acción masiva del listado Ruteo ("Enviar a Ruteo"/"Cambiar Repartidor") no se abrió'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    // _seleccionarPrimeraOpcionChosen() (NO un `.chosen-results li` "a mano"):
    // confirmado en vivo (root-cause real, no asumido — mismo hallazgo ya
    // documentado en el comentario de ese método) que el primer <li> de este
    // Chosen recién abierto puede ser el propio placeholder "Seleccione un
    // repartidor" en vez de una opción real, dejando la orden sin repartidor
    // nuevo asignado y el assert posterior comparando contra ese texto en
    // vez del repartidor realmente elegido.
    await this._seleccionarPrimeraOpcionChosen(L.RUTEO_MASIVO_MODAL_REPARTIDOR_CHOSEN);
    const repartidorSeleccionado = await this._obtenerTextoChosenSeleccionado(L.RUTEO_MASIVO_MODAL_REPARTIDOR_CHOSEN);
    expect(repartidorSeleccionado, 'El repartidor seleccionado en el modal de acción masiva de Ruteo no quedó visible').not.toBe('');

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(fragmentoUrlAjax),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.RUTEO_MASIVO_MODAL_BTN_GUARDAR).click();
    const respuesta = await respuestaPromise;

    return { respuesta, repartidorSeleccionado };
  }

  /**
   * "Enviar a Ruteo" masivo — ADVERTENCIA (confirmado en vivo, ver el
   * comentario de RUTEO_MASIVO_MODAL): NO reasigna in-place las órdenes ya
   * marcadas con marcarOrdenParaAccionMasivaRuteo(). Crea una orden NUEVA por
   * cada una (con el repartidor elegido aquí), DUPLICANDO en vez de
   * reemplazar — la orden original permanece intacta en el listado. La
   * respuesta responde un array JSON
   * `[{old_order_id, new_order_id, order_number, items_created}]` — el test
   * debe leer `new_order_id` para localizar la orden resultante real.
   */
  async enviarOrdenesRuteoMasivamente() {
    await this._abrirMenuAccionesMasivasRuteo();
    await this.page.locator(L.RUTEO_MASIVO_LI_ENVIAR).click();
    return this._confirmarModalAccionMasivaRuteo(L.AJAX_ENVIAR_RUTEO_MASIVO);
  }

  /**
   * "Cambiar Repartidor" masivo — a diferencia de "Enviar a Ruteo", esta
   * reasigna in-place (mismo id de orden). Ver el comentario de
   * RUTEO_MASIVO_MODAL: usar una orden PROPIA (no la "primera seleccionable"
   * de un listado compartido con ~200+ órdenes) es necesario para obtener
   * una señal confiable — confirmado en vivo que reutilizar una orden ajena
   * puede fallar en silencio ("0") sin que el endpoint tenga la culpa.
   */
  async cambiarRepartidorOrdenesRuteoMasivamente() {
    await this._abrirMenuAccionesMasivasRuteo();
    await this.page.locator(L.RUTEO_MASIVO_LI_CAMBIAR_REPARTIDOR).click();
    return this._confirmarModalAccionMasivaRuteo(L.AJAX_CAMBIAR_REPARTIDOR_MASIVO);
  }

  /**
   * "Eliminar" masivo — confirma el SweetAlert real ("Eliminar Órdenes"/
   * "¿Estás seguro de eliminar la(s) orden(es)?", botón "Enviar") reutilizando
   * _confirmarSweetAlertV1() (mismo widget que el resto de la suite), y
   * espera la respuesta real de AJAX_ELIMINAR_RUTEO_MASIVO — confirmado en
   * vivo que responde "1" (éxito) y elimina la(s) orden(es) por completo del
   * listado (ni siquiera quedan en "H. de Órdenes"). Por ser irreversible,
   * los tests que la usan deben crear sus propias órdenes desechables — nunca
   * reutilizar una orden real ya existente del ambiente QA compartido.
   */
  async eliminarOrdenesRuteoMasivamente(): Promise<Response> {
    await this._abrirMenuAccionesMasivasRuteo();
    await this.page.locator(L.RUTEO_MASIVO_LI_ELIMINAR).click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_ELIMINAR_RUTEO_MASIVO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this._confirmarSweetAlertV1('No apareció la confirmación "Eliminar Órdenes"');
    return respuestaPromise;
  }

  /**
   * Descarga el reporte PDF fijo "Ruteo Sin Repartidor" desde el menú
   * "Acciones" del listado Ruteo — ver el comentario de
   * RUTEO_REPORTE_LI_DESCARGAR_PDF: el mismo reporte sin importar el filtro
   * real activo, así que no valida "pertenece al tab actual" (no aplica en
   * este ambiente).
   */
  async descargarReporteRuteoPDF(): Promise<Download> {
    await this._abrirMenuAccionesMasivasRuteo();
    const downloadPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.RUTEO_REPORTE_LI_DESCARGAR_PDF).click();
    return downloadPromise;
  }

  /**
   * Presiona "Imprimir" (data-mode=0) del menú "Acciones" del listado Ruteo —
   * genera el MISMO reporte fijo "Ruteo Sin Repartidor" que
   * descargarReporteRuteoPDF() (ver la corrección en el comentario de
   * RUTEO_REPORTE_LI_IMPRIMIR: confirmado en vivo comparando ambos PDF byte
   * a byte). Chromium headless entrega el resultado como evento `download`
   * (nombre de archivo aleatorio, no el nombre descriptivo de "Descargar
   * PDF") en vez de `popup`, al interceptar la respuesta PDF que el botón
   * intenta abrir en una ventana nueva.
   */
  async imprimirReporteRuteoPDF(): Promise<Download> {
    await this._abrirMenuAccionesMasivasRuteo();
    const downloadPromise = this.page.waitForEvent('download', { timeout: TIMEOUTS.PRINT_POPUP });
    await this.page.locator(L.RUTEO_REPORTE_LI_IMPRIMIR).click();
    return downloadPromise;
  }
  async _seleccionarOpcionMoneda(...args: Parameters<PosCore['_seleccionarOpcionMoneda']>) {
    return this.core._seleccionarOpcionMoneda(...args);
  }
  async obtenerInfoMoneda(...args: Parameters<PosCore['obtenerInfoMoneda']>) {
    return this.core.obtenerInfoMoneda(...args);
  }
  async cambiarMoneda(...args: Parameters<PosCore['cambiarMoneda']>) {
    return this.core.cambiarMoneda(...args);
  }
  async asegurarMonedaBaseActiva(...args: Parameters<PosCore['asegurarMonedaBaseActiva']>) {
    return this.core.asegurarMonedaBaseActiva(...args);
  }
  async obtenerSimboloMonedaEnTotal(...args: Parameters<PosCore['obtenerSimboloMonedaEnTotal']>) {
    return this.core.obtenerSimboloMonedaEnTotal(...args);
  }
  get modalCrearProforma() { return this.proforma.modalCrearProforma; }
  async abrirCrearProforma(...args: Parameters<PosProforma['abrirCrearProforma']>) {
    return this.proforma.abrirCrearProforma(...args);
  }
  async seleccionarTipoProforma(...args: Parameters<PosProforma['seleccionarTipoProforma']>) {
    return this.proforma.seleccionarTipoProforma(...args);
  }
  get campoNombreClienteProforma() { return this.proforma.campoNombreClienteProforma; }
  async llenarNombreClienteProforma(...args: Parameters<PosProforma['llenarNombreClienteProforma']>) {
    return this.proforma.llenarNombreClienteProforma(...args);
  }
  async seleccionarVendedorProforma(...args: Parameters<PosProforma['seleccionarVendedorProforma']>) {
    return this.proforma.seleccionarVendedorProforma(...args);
  }
  async guardarProformaYObtenerRespuesta(...args: Parameters<PosProforma['guardarProformaYObtenerRespuesta']>) {
    return this.proforma.guardarProformaYObtenerRespuesta(...args);
  }
  async validarProformaCreada(...args: Parameters<PosProforma['validarProformaCreada']>) {
    return this.proforma.validarProformaCreada(...args);
  }
  get modalGestionProforma() { return this.proforma.modalGestionProforma; }
  async cerrarModalGestionProforma(...args: Parameters<PosProforma['cerrarModalGestionProforma']>) {
    return this.proforma.cerrarModalGestionProforma(...args);
  }
  async enviarProformaPorCorreo(...args: Parameters<PosProforma['enviarProformaPorCorreo']>) {
    return this.proforma.enviarProformaPorCorreo(...args);
  }
  async descargarPdfProforma(...args: Parameters<PosProforma['descargarPdfProforma']>) {
    return this.proforma.descargarPdfProforma(...args);
  }
  async imprimirProforma(...args: Parameters<PosProforma['imprimirProforma']>) {
    return this.proforma.imprimirProforma(...args);
  }
  async verTodasLasProformas(...args: Parameters<PosProforma['verTodasLasProformas']>) {
    return this.proforma.verTodasLasProformas(...args);
  }

  // ─── "Generar Apartado" ─────────────────────────────────────────────────────
  //
  // A diferencia de Proforma y Enviar a caja, "Generar Apartado" NO abre un
  // modal propio: reutiliza el modal de pago normal (#dialog_payment),
  // mostrando #make_layaway en vez de #make_payment (confirmado en vivo,
  // Fase 1). Todo lo demás del modal (cliente Forma 1/2, vendedor, métodos de
  // pago, descuentos) son los MISMOS campos que ya usa el resto de la suite —
  // ver seleccionarClienteExistente(), seleccionarPagoEfectivo(),
  // seleccionarPagoExacto()/seleccionarPagoParcial(), seleccionarPagoMixto(),
  // aplicarDescuentoIndividual(), activarDescuentoGeneral().

  /** Locator del botón "GENERAR APARTADO" — única señal confiable de que el modal de pago quedó en modo Apartado. */
  get botonGenerarApartado() {
    return this.page.locator(L.APARTADO_BTN_GENERAR);
  }

  /**
   * Abre el menú de acciones junto a "Facturar" (mismo menú MDL que "Enviar a
   * caja"/"Proforma", L.ORDEN_CAJA_MENU_BTN) y selecciona "Generar Apartado".
   * Reutiliza el mismo patrón de reintento + cierre de overlays ya probado en
   * abrirMenuOrdenCaja()/abrirCrearProforma(), cambiando únicamente el ítem y
   * la señal de éxito esperada (el botón #make_layaway, no un modal propio).
   *
   * IMPORTANTE (confirmado en vivo tras investigar a fondo un falso positivo):
   * el POS debe haberse cargado con cargarPosDesdeDashboard() —no con
   * cargarPosYCerrarModalSiAparece()—, igual que ya hacen pos-proforma.spec.ts
   * y pos-orden-caja.spec.ts. Cargar directo a la URL del POS dispara una
   * condición de carga en frío ya documentada (ver el comentario de
   * cargarPosDesdeDashboard()) que puede abortar la inicialización de un
   * widget no relacionado (Selectize de #invoice_customer_email) y, por
   * efecto colateral, impedir que este botón llegue a mostrarse.
   */
  async abrirCrearApartado() {
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarAvisoConsecutivoSiAparece();

    await this.page.locator('ul.mdl-menu[data-mdl-for="demo-menu-top-right"][data-upgraded*="MaterialMenu"]')
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const item = this.page.locator(L.APARTADO_MENU_ITEM);
    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      await this.cerrarAvisoConsecutivoSiAparece();

      await this.page.evaluate(
        (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
        L.ORDEN_CAJA_MENU_BTN
      );
      abierto = await item.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, `La opción "Generar Apartado" no apareció en el menú de acciones tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      L.APARTADO_MENU_ITEM
    );

    await expect(this.botonGenerarApartado, 'El botón "GENERAR APARTADO" no apareció tras seleccionar la opción del menú').toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Busca y selecciona un cliente DENTRO del modal de pago (Forma 2): escribe
   * en el input propio del modal (APARTADO_CLIENTE_INPUT_BUSQUEDA, distinto al
   * de arriba del carrito), dispara el mismo AJAX (CLIENTE_AJAX_BUSQUEDA) y
   * elige la primera opción real de un Chosen (APARTADO_CLIENTE_CHOSEN).
   *
   * Confirmado en vivo, corrigiendo un supuesto inicial equivocado: NO
   * reutiliza las tarjetas .customer-list-pos de Forma 1 —esas sí se
   * renderizan con los datos correctos, pero quedan anidadas dentro de un
   * contenedor que permanece display:none mientras el modal está abierto, así
   * que no son clickeables ni visibles para un usuario real—. El control
   * realmente visible es el Chosen #payment_credit_client_chosen (mismo
   * patrón que seleccionarClienteEnOrdenCaja()); confirmado en vivo que elegir
   * una opción ahí sí sincroniza #customer_select, el campo que add_layaway()
   * efectivamente lee al guardar.
   */
  async seleccionarClienteEnModalApartado(terminoBusqueda = ''): Promise<string> {
    await this.page.locator(L.APARTADO_CLIENTE_INPUT_BUSQUEDA).fill(terminoBusqueda);

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.CLIENTE_AJAX_BUSQUEDA),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this.page.locator(L.APARTADO_CLIENTE_BTN_BUSCAR).click();
    await respuestaPromise;

    await this._seleccionarPrimeraOpcionChosen(L.APARTADO_CLIENTE_CHOSEN);

    const nombreCliente = await this._obtenerTextoChosenSeleccionado(L.APARTADO_CLIENTE_CHOSEN);
    expect(nombreCliente, 'El nombre del cliente seleccionado en "Generar Apartado" no quedó visible').not.toBe('');

    await expect(
      this.page.locator(L.CLIENTE_SELECT_OCULTO),
      'El cliente elegido en el modal no quedó registrado en #customer_select'
    ).not.toHaveValue('');

    console.log(`[seleccionarClienteEnModalApartado] Cliente seleccionado: "${nombreCliente}"`);
    return nombreCliente;
  }

  /**
   * Presiona "GENERAR APARTADO", confirma el SweetAlert de advertencia
   * ("¿Está seguro de realizar este Apartado?") y espera la respuesta real de
   * red que efectivamente lo crea (AJAX_GUARDAR_APARTADO) — mismo patrón ya
   * usado en enviarOrdenCaja()/guardarProformaYObtenerRespuesta(): la espera
   * del AJAX se arma ANTES de confirmar el SweetAlert, no después.
   *
   * El sistema abre además una ventana de impresión del Apartado tras crearlo
   * (confirmado en vivo) que este método no cerraba — quedaba abierta de
   * fondo mientras el resto del escenario seguía interactuando con la página
   * original. Mismo patrón ya usado en confirmarCerrarCaja(): el listener de
   * "popup" se arma ANTES del click (con `.catch(() => null)`, nunca
   * bloqueante, porque no todos los ambientes la muestran) y se cierra con
   * mostrarYCerrarVentanaImpresion() recién después de confirmar el éxito
   * real vía AJAX_GUARDAR_APARTADO, para no competir con la propia creación
   * del Apartado.
   */
  async guardarApartadoYObtenerRespuesta(): Promise<Response> {
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP }).catch(() => null);

    await this.botonGenerarApartado.click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_GUARDAR_APARTADO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this._confirmarSweetAlertV1('No apareció la confirmación "¿Está seguro de realizar este Apartado?"');
    const respuesta = await respuestaPromise;

    const printPage = await popupPromise;
    if (printPage) {
      await this.mostrarYCerrarVentanaImpresion(printPage);
    }

    return respuesta;
  }

  /**
   * Valida que "Generar Apartado" terminó exitosamente: la respuesta real de
   * AJAX_GUARDAR_APARTADO respondió OK con un id numérico (>=1, mismo
   * contrato que el resto de la suite), el modal de pago se cerró y el
   * carrito quedó vacío. A diferencia de Proforma, Apartado NO tiene un modal
   * de "Gestión" posterior (confirmado en vivo, Fase 1) — solo cierra
   * #dialog_payment y limpia el carrito.
   */
  async validarApartadoCreado(respuesta: Response) {
    expect(respuesta.ok(), `${L.AJAX_GUARDAR_APARTADO} no respondió OK (status ${respuesta.status()})`).toBe(true);

    const cuerpo = (await respuesta.text()).trim();
    expect(parseInt(cuerpo, 10), `${L.AJAX_GUARDAR_APARTADO} no devolvió un id válido (respondió "${cuerpo}")`).toBeGreaterThanOrEqual(1);

    await expect(
      this.botonGenerarApartado,
      'El modal de pago no se cerró tras confirmar el Apartado'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });

    await this.validarCarritoVacio();
  }

  // ─── Apartado YA EXISTENTE: localizar, cargar y "Abonar" ───────────────────
  // Mismo criterio "primera disponible, sin buscar" que cargarPrimeraOrdenCajaDisponible()
  // — ver el comentario de L.AJAX_CARGAR_APARTADO para la evidencia de por qué
  // se reutilizan L.IMPORTAR_FACTURA_FILA/L.ORDEN_CAJA_LISTA_BTN_CARGAR tal
  // cual en vez de declarar un selector nuevo idéntico.

  /**
   * Carga el primer Apartado disponible en la pestaña ya abierta — mismo
   * patrón exacto que cargarPrimeraOrdenCajaDisponible(), solo que espera
   * AJAX_CARGAR_APARTADO en vez de AJAX_CARGAR_ORDEN_CAJA.
   */
  async cargarPrimerApartadoDisponible() {
    const filas = this.page.locator(L.IMPORTAR_FACTURA_FILA);
    const primeraFila = filas.first();
    await expect(primeraFila, 'No hay ningún Apartado disponible').toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_CARGAR_APARTADO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await primeraFila.locator(L.ORDEN_CAJA_LISTA_BTN_CARGAR).click();
    await respuestaPromise;

    await expect(
      this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
      'No se cargó ninguna línea de producto tras seleccionar el Apartado'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Busca Apartados usando el campo de búsqueda REAL de esta pestaña:
   * `#product_search` (L.PRODUCTO_BUSCADOR_GRID), el mismo input reutilizado
   * por buscarProductoEnGrid()/buscarOrdenesCajaPorTexto() — persiste en el
   * header del POS sin importar el tab activo. CORRECCIÓN: un comentario
   * previo en este archivo (igual que el que existía para Órdenes de Caja
   * antes de buscarOrdenesCajaPorTexto()) afirmaba que esta pestaña no tenía
   * campo de búsqueda propio; confirmado en vivo interceptando la red que sí
   * lo tiene — mientras "Apartados" está activa dispara su propio AJAX real
   * (`getPosLayawaySearch`, L.AJAX_BUSCAR_APARTADO, con `search=<texto>` y
   * `state=pending`) que reemplaza el listado de tarjetas por el resultado
   * filtrado en el servidor. Confirmado en vivo que este buscador indexa el
   * "Apartado No" (el número real, sin el prefijo "Apartado No:" que sí
   * muestra la tarjeta — buscar con ese prefijo devuelve 0 resultados) y el
   * nombre del cliente.
   */
  async buscarApartadosPorTexto(texto: string) {
    const totalAntes = await this.contarApartadosVisibles();

    // Mismo cuidado que buscarOrdenesCajaPorTexto(): la carga inicial de la
    // pestaña ya dispara su propia llamada a este mismo endpoint (con
    // `search=` vacío), cuya respuesta puede seguir en vuelo y resolver
    // después de que este método ya empezó a esperar la próxima — se
    // distingue por el contenido real de la petición, no solo por la URL.
    const respuestaPromise = this.page.waitForResponse((res) => {
      if (!res.url().includes(L.AJAX_BUSCAR_APARTADO)) return false;
      const post = decodeURIComponent((res.request().postData() ?? '').replace(/\+/g, ' '));
      return post.includes(texto);
    }, { timeout: TIMEOUTS.PAYMENT_MODAL });
    await this.buscarProductoEnGrid(texto);
    await respuestaPromise;

    // La respuesta ya resuelta no garantiza que el DOM ya haya reemplazado
    // las tarjetas con el resultado filtrado — se espera la condición real:
    // que el total de tarjetas cambie del valor previo a buscar.
    await expect.poll(
      () => this.contarApartadosVisibles(),
      { timeout: TIMEOUTS.PAYMENT_MODAL, message: 'El resultado de la búsqueda no terminó de renderizarse' }
    ).not.toBe(totalAntes);
  }

  /** Cuenta las tarjetas de Apartado actualmente renderizadas en la pestaña — útil antes/después de buscarApartadosPorTexto() para validar que la búsqueda realmente redujo el conjunto. */
  async contarApartadosVisibles(): Promise<number> {
    return this.page.locator(L.IMPORTAR_FACTURA_FILA).count();
  }

  /**
   * Cuenta, sobre las tarjetas de Apartado YA renderizadas (p. ej. tras un
   * buscarApartadosPorTexto() con un resultado más amplio que 1), cuántas
   * contienen `texto` en su contenido visible — util para confirmar que un
   * Apartado puntual sigue presente dentro de un resultado de búsqueda
   * parcial más amplio, sin volver a golpear el servidor.
   */
  async contarApartadosConTexto(texto: string): Promise<number> {
    return this.page.locator(L.IMPORTAR_FACTURA_FILA).filter({ hasText: texto }).count();
  }

  /**
   * Lee el "Apartado No: X" (número real y visible) de la primera tarjeta de
   * la pestaña "Apartados" ya abierta. Necesario porque el id que devuelve
   * AJAX_GUARDAR_APARTADO es un id interno de base de datos (confirmado en
   * vivo: p. ej. "670") que NO coincide con el "Apartado No" que la propia
   * tarjeta muestra (p. ej. "120", un consecutivo aparte) ni aparece en
   * ningún texto — visible u oculto — de la tarjeta por el que
   * filtrarApartadosPorTexto() pueda localizarlo. Confirmado en vivo que la
   * pestaña ordena de más reciente a más antiguo: tras crear un Apartado y
   * (re)visitar esta pestaña, el recién creado siempre queda de primero.
   */
  async obtenerNumeroApartadoTarjetaMasReciente(): Promise<string> {
    const texto = await this.page.locator(L.IMPORTAR_FACTURA_FILA).first().innerText();
    const coincidencia = texto.match(/Apartado No:\s*(\d+)/);
    expect(coincidencia, `No se pudo leer "Apartado No" de la primera tarjeta: "${texto}"`).not.toBeNull();
    return coincidencia![1];
  }

  /**
   * Carga el primer Apartado disponible cuyo "Total" visible en la tarjeta
   * sea razonable (< 100,000) — confirmado en vivo (2 hallazgos
   * independientes, en dos monedas distintas: "₡6,656,677,711.25" y
   * "$14,557,786.76") que este ambiente compartido de QA tiene Apartados ya
   * existentes con un Total corrupto, inflado varios órdenes de magnitud
   * por un bug real del sistema al leer un Apartado guardado en una moneda
   * distinta a la que esté activa en ese momento (ver el comentario del
   * describe "Apartados — Moneda contraria a la base" en
   * pos-apartado.spec.ts). cargarPrimerApartadoDisponible() sigue siendo
   * correcto para escenarios que no comparan totales numéricos (agregar
   * ítems, abonar, facturar sin comparar antes/después); este método es
   * para los que sí lo hacen, y evita heredar ese dato corrupto sin
   * necesidad de "arreglar" el Apartado en sí (fuera del alcance de esta
   * suite).
   */
  async cargarPrimerApartadoConTotalRazonable() {
    const UMBRAL_TOTAL_SOSPECHOSO = 100_000;
    const MAX_INTENTOS = 5;

    // El Total corrupto NO es detectable leyendo la tarjeta antes de cargarla
    // (su "Total:" visible ahí ya es incorrecto/inflado también, confirmado
    // en vivo) — solo se confirma tras cargar el Apartado al carrito. Por
    // eso se carga primero y se valida después, reintentando con el
    // siguiente candidato (por posición: el Apartado corrupto sigue
    // "pendiente" en el sistema tras vaciarCarrito(), así que seguiría
    // apareciendo de primero si se repitiera tarjetas.first() — se avanza
    // por índice para no reintentar siempre el mismo).
    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      const tarjetas = this.page.locator(L.IMPORTAR_FACTURA_FILA);
      await expect(
        tarjetas.nth(intento),
        `No hay un Apartado en la posición ${intento} para reintentar`
      ).toBeVisible({ timeout: TIMEOUTS.PRODUCTS_LOAD });

      const respuestaPromise = this.page.waitForResponse(
        (res) => res.url().includes(L.AJAX_CARGAR_APARTADO),
        { timeout: TIMEOUTS.PAYMENT_MODAL }
      );
      await tarjetas.nth(intento).locator(L.ORDEN_CAJA_LISTA_BTN_CARGAR).click();
      await respuestaPromise;

      await expect(
        this.page.locator(L.IMPORTAR_FACTURA_CARRITO_FILAS).first(),
        'No se cargó ninguna línea de producto tras seleccionar el Apartado'
      ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

      // Confirmado en vivo: el Total corrupto no siempre está reflejado en
      // el instante justo en que la primera línea aparece — una recalculación
      // asíncrona posterior (disparada por el propio conflicto de moneda) lo
      // termina de inflar unos instantes después. Se espera a que el carrito
      // "asiente" (mismo criterio que el resto de la suite tras un cambio de
      // carrito) antes de leer el total, para no dejar pasar un Apartado que
      // en realidad sí está corrupto.
      await this.page.waitForTimeout(PAUSES.VER_CARRITO);

      const totalCargado = await this.obtenerTotalVentaNumerico();
      if (totalCargado < UMBRAL_TOTAL_SOSPECHOSO) return;

      console.log(`[cargarPrimerApartadoConTotalRazonable] Apartado en posición ${intento} cargó con un Total corrupto (${totalCargado}) — se descarta y se reintenta con el siguiente.`);
      await this.vaciarCarrito();
      const pestanaApartados = await this.localizarPestanaApartados();
      if (pestanaApartados) await this.visitarPestanaPos(pestanaApartados);
    }
    throw new Error(`No se encontró ningún Apartado con un Total razonable (< ${UMBRAL_TOTAL_SOSPECHOSO}) entre los primeros ${MAX_INTENTOS} disponibles.`);
  }

  /**
   * Abre el menú de acciones junto a "Facturar" y selecciona "Abonar" — mismo
   * patrón de reintento que abrirCrearApartado()/abrirMenuOrdenCaja(),
   * cambiando únicamente el ítem (L.ABONO_MENU_ITEM) y la señal de éxito
   * esperada (L.ABONO_BTN_REALIZAR, "REALIZAR ABONO" — el modal de pago
   * normal reutilizado una vez más, ver el comentario de L.ABONO_MENU_ITEM).
   * Requiere un Apartado ya cargado al carrito (cargarPrimerApartadoDisponible());
   * "Abonar" no aparece visible en el menú si el carrito está vacío o si el
   * carrito no proviene de un Apartado ya existente (confirmado en vivo).
   */
  async abrirRealizarAbono() {
    await this.cerrarModalNotificacionesSiAparece();
    await this.cerrarAvisoConsecutivoSiAparece();

    await this.page.locator('ul.mdl-menu[data-mdl-for="demo-menu-top-right"][data-upgraded*="MaterialMenu"]')
      .waitFor({ state: 'attached', timeout: TIMEOUTS.PRODUCTS_LOAD })
      .catch(() => {});

    const item = this.page.locator(L.ABONO_MENU_ITEM);
    const MAX_INTENTOS = 4;
    let abierto = false;
    for (let intento = 1; intento <= MAX_INTENTOS && !abierto; intento++) {
      await this.cerrarModalNotificacionesSiAparece();
      await this.cerrarAvisoConsecutivoSiAparece();

      await this.page.evaluate(
        (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
        L.ORDEN_CAJA_MENU_BTN
      );
      abierto = await item.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
    }
    expect(abierto, `La opción "Abonar" no apareció en el menú de acciones tras ${MAX_INTENTOS} intentos`).toBe(true);

    await this.page.evaluate(
      (sel) => (document.querySelector(sel) as HTMLElement)?.click(),
      L.ABONO_MENU_ITEM
    );

    await expect(
      this.page.locator(L.ABONO_BTN_REALIZAR),
      'El botón "REALIZAR ABONO" no apareció tras seleccionar la opción del menú'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }

  /**
   * Presiona "REALIZAR ABONO", confirma el SweetAlert de advertencia
   * ("¿Está seguro(a) de realizar este abono?" — mismo widget SweetAlert v1,
   * reutiliza _confirmarSweetAlertV1() tal cual pese a que el botón real dice
   * "Continuar" en vez de "Aceptar": confirmado en vivo que el selector
   * `.sweet-alert.visible button.confirm` no depende del texto visible) y
   * espera la respuesta real de red que efectivamente registra el abono
   * (AJAX_APLICAR_ABONO).
   */
  async aplicarAbonoYObtenerRespuesta(): Promise<Response> {
    // El sistema abre una ventana de impresión del comprobante de abono tras
    // aplicarlo (confirmado en vivo: es la causa real de que el modal
    // "REALIZAR ABONO" pareciera no cerrarse — quedaba abierta de fondo,
    // mismo hallazgo ya corregido en guardarApartadoYObtenerRespuesta()). El
    // listener de "popup" se arma ANTES del click (con `.catch(() => null)`,
    // nunca bloqueante, porque no todos los ambientes la muestran) y se
    // cierra con mostrarYCerrarVentanaImpresion() recién después de
    // confirmar el éxito real vía AJAX_APLICAR_ABONO.
    const popupPromise = this.page.waitForEvent('popup', { timeout: TIMEOUTS.PRINT_POPUP }).catch(() => null);

    await this.page.locator(L.ABONO_BTN_REALIZAR).click();

    const respuestaPromise = this.page.waitForResponse(
      (res) => res.url().includes(L.AJAX_APLICAR_ABONO),
      { timeout: TIMEOUTS.PAYMENT_MODAL }
    );
    await this._confirmarSweetAlertV1('No apareció la confirmación "¿Está seguro(a) de realizar este abono?"');
    const respuesta = await respuestaPromise;

    // El toast de confirmación es transitorio (se autodesvanece a los pocos
    // segundos) — confirmado en vivo que revisarlo DESPUÉS de cerrar la
    // ventana de impresión (mostrarYCerrarVentanaImpresion() por sí sola ya
    // toma ~6s de esperas propias) puede perderlo por completo, aunque el
    // abono se haya aplicado correctamente. Se verifica aquí, apenas llega
    // la respuesta real, antes de gastar tiempo cerrando el popup — la
    // misma validación que antes vivía en validarAbonoAplicado(), reubicada
    // por la carrera de tiempo real que introdujo el manejo del popup.
    await expect(
      this.page.locator('.noty_bar', { hasText: /abono/i }),
      'No apareció el toast de confirmación del abono'
    ).toBeVisible({ timeout: TIMEOUTS.PAYMENT_MODAL });

    const printPage = await popupPromise;
    if (printPage) {
      await this.mostrarYCerrarVentanaImpresion(printPage);
    }

    return respuesta;
  }

  /**
   * Valida que "Abonar" terminó exitosamente: la respuesta real de
   * AJAX_APLICAR_ABONO respondió OK y el modal de pago se cerró (el toast de
   * confirmación ya se verificó en aplicarAbonoYObtenerRespuesta(), antes de
   * cerrar la ventana de impresión — ver su comentario). A diferencia de
   * validarApartadoCreado()/validarOrdenCajaCreada(), NO valida carrito
   * vacío: confirmado en vivo que las líneas del Apartado permanecen en el
   * carrito tras aplicar un abono (el Apartado sigue pendiente, solo se
   * registró un pago parcial).
   */
  async validarAbonoAplicado(respuesta: Response) {
    expect(respuesta.ok(), `${L.AJAX_APLICAR_ABONO} no respondió OK (status ${respuesta.status()})`).toBe(true);

    await expect(
      this.page.locator(L.ABONO_BTN_REALIZAR),
      'El modal de pago no se cerró tras confirmar el abono'
    ).toBeHidden({ timeout: TIMEOUTS.PAYMENT_MODAL });
  }
  async abrirImportarFactura(...args: Parameters<PosImportarFactura['abrirImportarFactura']>) {
    return this.importarFactura.abrirImportarFactura(...args);
  }
  async importarPrimeraFacturaDisponible(...args: Parameters<PosImportarFactura['importarPrimeraFacturaDisponible']>) {
    return this.importarFactura.importarPrimeraFacturaDisponible(...args);
  }
  async hayClienteRealSeleccionado(...args: Parameters<PosImportarFactura['hayClienteRealSeleccionado']>) {
    return this.importarFactura.hayClienteRealSeleccionado(...args);
  }
  async obtenerClienteSeleccionado(...args: Parameters<PosImportarFactura['obtenerClienteSeleccionado']>) {
    return this.importarFactura.obtenerClienteSeleccionado(...args);
  }
  async quitarClienteSeleccionado(...args: Parameters<PosImportarFactura['quitarClienteSeleccionado']>) {
    return this.importarFactura.quitarClienteSeleccionado(...args);
  }
  async _importarFacturaEnPosicion(...args: Parameters<PosImportarFactura['_importarFacturaEnPosicion']>) {
    return this.importarFactura._importarFacturaEnPosicion(...args);
  }
  async _importarFacturaQueCumpla(...args: Parameters<PosImportarFactura['_importarFacturaQueCumpla']>) {
    return this.importarFactura._importarFacturaQueCumpla(...args);
  }
  async importarPrimeraFacturaConCliente(...args: Parameters<PosImportarFactura['importarPrimeraFacturaConCliente']>) {
    return this.importarFactura.importarPrimeraFacturaConCliente(...args);
  }
  async importarPrimeraFacturaSinCliente(...args: Parameters<PosImportarFactura['importarPrimeraFacturaSinCliente']>) {
    return this.importarFactura.importarPrimeraFacturaSinCliente(...args);
  }
  async contarFacturasVisibles(...args: Parameters<PosImportarFactura['contarFacturasVisibles']>) {
    return this.importarFactura.contarFacturasVisibles(...args);
  }
  async obtenerNumeroFacturaTarjetaMasReciente(...args: Parameters<PosImportarFactura['obtenerNumeroFacturaTarjetaMasReciente']>) {
    return this.importarFactura.obtenerNumeroFacturaTarjetaMasReciente(...args);
  }
  async buscarFacturasPorTexto(...args: Parameters<PosImportarFactura['buscarFacturasPorTexto']>) {
    return this.importarFactura.buscarFacturasPorTexto(...args);
  }
  async contarFacturasConTexto(...args: Parameters<PosImportarFactura['contarFacturasConTexto']>) {
    return this.importarFactura.contarFacturasConTexto(...args);
  }
  async filtrarFacturasPorEstado(...args: Parameters<PosImportarFactura['filtrarFacturasPorEstado']>) {
    return this.importarFactura.filtrarFacturasPorEstado(...args);
  }
  async abrirOrdenesCaja(...args: Parameters<PosOrdenCaja['abrirOrdenesCaja']>) {
    return this.ordenCaja.abrirOrdenesCaja(...args);
  }
  async cargarPrimeraOrdenCajaDisponible(...args: Parameters<PosOrdenCaja['cargarPrimeraOrdenCajaDisponible']>) {
    return this.ordenCaja.cargarPrimeraOrdenCajaDisponible(...args);
  }
  async _cargarOrdenCajaQueCumpla(...args: Parameters<PosOrdenCaja['_cargarOrdenCajaQueCumpla']>) {
    return this.ordenCaja._cargarOrdenCajaQueCumpla(...args);
  }
  async cargarPrimeraOrdenCajaACreditoDisponible(...args: Parameters<PosOrdenCaja['cargarPrimeraOrdenCajaACreditoDisponible']>) {
    return this.ordenCaja.cargarPrimeraOrdenCajaACreditoDisponible(...args);
  }
  async cargarPrimeraOrdenCajaConVendedorDisponible(...args: Parameters<PosOrdenCaja['cargarPrimeraOrdenCajaConVendedorDisponible']>) {
    return this.ordenCaja.cargarPrimeraOrdenCajaConVendedorDisponible(...args);
  }
  async buscarOrdenesCajaPorTexto(...args: Parameters<PosOrdenCaja['buscarOrdenesCajaPorTexto']>) {
    return this.ordenCaja.buscarOrdenesCajaPorTexto(...args);
  }
  async contarOrdenesCajaVisibles(...args: Parameters<PosOrdenCaja['contarOrdenesCajaVisibles']>) {
    return this.ordenCaja.contarOrdenesCajaVisibles(...args);
  }
  async obtenerCantidadFilasCarrito(...args: Parameters<PosCore['obtenerCantidadFilasCarrito']>) {
    return this.core.obtenerCantidadFilasCarrito(...args);
  }
  async obtenerTextoCarrito(...args: Parameters<PosCore['obtenerTextoCarrito']>) {
    return this.core.obtenerTextoCarrito(...args);
  }
  async obtenerPrimerProductoNoPresenteEnCarrito(...args: Parameters<PosCore['obtenerPrimerProductoNoPresenteEnCarrito']>) {
    return this.core.obtenerPrimerProductoNoPresenteEnCarrito(...args);
  }
  async obtenerPrimerProductoFraccionadoNoPresenteEnCarrito(...args: Parameters<PosCore['obtenerPrimerProductoFraccionadoNoPresenteEnCarrito']>) {
    return this.core.obtenerPrimerProductoFraccionadoNoPresenteEnCarrito(...args);
  }
  async obtenerPrimerProductoConIvaNoPresenteEnCarrito(...args: Parameters<PosCore['obtenerPrimerProductoConIvaNoPresenteEnCarrito']>) {
    return this.core.obtenerPrimerProductoConIvaNoPresenteEnCarrito(...args);
  }
  async abrirAgregarItem(...args: Parameters<PosCore['abrirAgregarItem']>) {
    return this.core.abrirAgregarItem(...args);
  }
  async abrirAgregarItemImportarFactura(...args: Parameters<PosImportarFactura['abrirAgregarItemImportarFactura']>) {
    return this.importarFactura.abrirAgregarItemImportarFactura(...args);
  }
  async seEncuentraEnVistaAgregarItem(...args: Parameters<PosCore['seEncuentraEnVistaAgregarItem']>) {
    return this.core.seEncuentraEnVistaAgregarItem(...args);
  }
  async volverDesdeAgregarItem(...args: Parameters<PosCore['volverDesdeAgregarItem']>) {
    return this.core.volverDesdeAgregarItem(...args);
  }
  async volverDesdeAgregarItemImportarFactura(...args: Parameters<PosImportarFactura['volverDesdeAgregarItemImportarFactura']>) {
    return this.importarFactura.volverDesdeAgregarItemImportarFactura(...args);
  }
  precioVisibleProducto(...args: Parameters<PosCore['precioVisibleProducto']>) {
    return this.core.precioVisibleProducto(...args);
  }
  async obtenerPrecioVisibleProducto(...args: Parameters<PosCore['obtenerPrecioVisibleProducto']>) {
    return this.core.obtenerPrecioVisibleProducto(...args);
  }
  async obtenerCodigoProducto(...args: Parameters<PosCore['obtenerCodigoProducto']>) {
    return this.core.obtenerCodigoProducto(...args);
  }
  async vistaExpandidaActiva(...args: Parameters<PosNavigation['vistaExpandidaActiva']>) {
    return this.navigation.vistaExpandidaActiva(...args);
  }
  async alternarVistaExpandida(...args: Parameters<PosNavigation['alternarVistaExpandida']>) {
    return this.navigation.alternarVistaExpandida(...args);
  }
  async agregarProductoPorCodigoEnVistaExpandida(...args: Parameters<PosNavigation['agregarProductoPorCodigoEnVistaExpandida']>) {
    return this.navigation.agregarProductoPorCodigoEnVistaExpandida(...args);
  }
  async vaciarCarrito(...args: Parameters<PosCore['vaciarCarrito']>) {
    return this.core.vaciarCarrito(...args);
  }
  async obtenerTotalVisiblePosNumerico(...args: Parameters<PosCore['obtenerTotalVisiblePosNumerico']>) {
    return this.core.obtenerTotalVisiblePosNumerico(...args);
  }
  async facturarEstaDeshabilitado(...args: Parameters<PosCore['facturarEstaDeshabilitado']>) {
    return this.core.facturarEstaDeshabilitado(...args);
  }
}
