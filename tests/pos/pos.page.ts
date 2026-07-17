import { Page } from '@playwright/test';
import { espiarErroresJS, esperarQuedaActivo } from './pos.utils';
import { PosCore } from './pos-core.page';
import { PosCierreCaja } from './pos-cierre-caja.page';
import { PosPayment } from './pos-payment.page';
import { PosNavigation } from './pos-navegacion.page';
import { PosProforma } from './pos-proforma.page';
import { PosCrearProducto } from './pos-crear-producto.page';
import { PosImportarFactura } from './pos-importar-factura.page';
import { PosOrdenCaja } from './pos-orden-caja.page';
import { PosApartados } from './pos-apartado.page';
import { PosRuteo } from './pos-ruteo.page';

// Migración a composición completa (ver el plan aprobado en
// /Users/mobileimacimac/.claude/plans/hazy-noodling-stream.md): tipos,
// constantes y locators viven en pos.types.ts/pos.locators.ts, las 2
// funciones sueltas en pos.utils.ts, y cada dominio de negocio (Core, Pago,
// Cierre de Caja, Navegación, Proforma, Crear Producto, Importar Factura,
// Orden de Caja, Apartado, Ruteo) en su propia clase, compuesta aquí. Este
// archivo es ahora únicamente la fachada: instancia las 9 clases de
// dominio y delega cada miembro público con un one-liner. Sigue siendo el
// punto de entrada público único (barrel): re-exporta todo para que ningún
// import existente en los .spec.ts, ni el cruzado desde
// tests/gestion-de-taller/recepcion.page.ts, tenga que cambiar.
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
  private readonly apartados: PosApartados;
  private readonly ruteo: PosRuteo;

  constructor(private readonly page: Page) {
    this.core = new PosCore(page);
    this.cierreCaja = new PosCierreCaja(this.core);
    this.payment = new PosPayment(this.core);
    this.navigation = new PosNavigation(this.core);
    this.proforma = new PosProforma(this.core, this.payment, this.navigation);
    this.crearProducto = new PosCrearProducto(this.core);
    this.importarFactura = new PosImportarFactura(this.core, this.payment);
    this.ordenCaja = new PosOrdenCaja(this.core, this.payment);
    this.apartados = new PosApartados(this.core, this.payment);
    this.ruteo = new PosRuteo(this.core, this.payment);
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
  async obtenerSaldoActualApartado(...args: Parameters<PosApartados['obtenerSaldoActualApartado']>) {
    return this.apartados.obtenerSaldoActualApartado(...args);
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
  get modalRuteo() { return this.ruteo.modalRuteo; }
  async abrirCrearOrdenRuteo(...args: Parameters<PosRuteo['abrirCrearOrdenRuteo']>) {
    return this.ruteo.abrirCrearOrdenRuteo(...args);
  }
  async seleccionarClienteEnRuteo(...args: Parameters<PosRuteo['seleccionarClienteEnRuteo']>) {
    return this.ruteo.seleccionarClienteEnRuteo(...args);
  }
  async obtenerClienteEnRuteo(...args: Parameters<PosRuteo['obtenerClienteEnRuteo']>) {
    return this.ruteo.obtenerClienteEnRuteo(...args);
  }
  async seleccionarRutaRuteo(...args: Parameters<PosRuteo['seleccionarRutaRuteo']>) {
    return this.ruteo.seleccionarRutaRuteo(...args);
  }
  async seleccionarRepartidorRuteo(...args: Parameters<PosRuteo['seleccionarRepartidorRuteo']>) {
    return this.ruteo.seleccionarRepartidorRuteo(...args);
  }
  async seleccionarDireccionRuteoSiExiste(...args: Parameters<PosRuteo['seleccionarDireccionRuteoSiExiste']>) {
    return this.ruteo.seleccionarDireccionRuteoSiExiste(...args);
  }
  async llenarObservacionesRuteo(...args: Parameters<PosRuteo['llenarObservacionesRuteo']>) {
    return this.ruteo.llenarObservacionesRuteo(...args);
  }
  async guardarOrdenRuteoYObtenerRespuesta(...args: Parameters<PosRuteo['guardarOrdenRuteoYObtenerRespuesta']>) {
    return this.ruteo.guardarOrdenRuteoYObtenerRespuesta(...args);
  }
  async cerrarModalRuteoForzado(...args: Parameters<PosRuteo['cerrarModalRuteoForzado']>) {
    return this.ruteo.cerrarModalRuteoForzado(...args);
  }
  async validarOrdenRuteoCreada(...args: Parameters<PosRuteo['validarOrdenRuteoCreada']>) {
    return this.ruteo.validarOrdenRuteoCreada(...args);
  }
  tarjetaRuteo(...args: Parameters<PosRuteo['tarjetaRuteo']>) {
    return this.ruteo.tarjetaRuteo(...args);
  }
  async abrirListadoOrdenesRuteo(...args: Parameters<PosRuteo['abrirListadoOrdenesRuteo']>) {
    return this.ruteo.abrirListadoOrdenesRuteo(...args);
  }
  async pestanaRuteoActiva(...args: Parameters<PosRuteo['pestanaRuteoActiva']>) {
    return this.ruteo.pestanaRuteoActiva(...args);
  }
  async volverDesdeAgregarItemHaciaRuteo(...args: Parameters<PosRuteo['volverDesdeAgregarItemHaciaRuteo']>) {
    return this.ruteo.volverDesdeAgregarItemHaciaRuteo(...args);
  }
  async ordenVisibleEnFiltroEntregado(...args: Parameters<PosRuteo['ordenVisibleEnFiltroEntregado']>) {
    return this.ruteo.ordenVisibleEnFiltroEntregado(...args);
  }
  async ordenVisibleEnHistorial(...args: Parameters<PosRuteo['ordenVisibleEnHistorial']>) {
    return this.ruteo.ordenVisibleEnHistorial(...args);
  }
  async asegurarOrdenRuteoVisibleEnListado(...args: Parameters<PosRuteo['asegurarOrdenRuteoVisibleEnListado']>) {
    return this.ruteo.asegurarOrdenRuteoVisibleEnListado(...args);
  }
  async abrirMenuAccionesOrdenRuteo(...args: Parameters<PosRuteo['abrirMenuAccionesOrdenRuteo']>) {
    return this.ruteo.abrirMenuAccionesOrdenRuteo(...args);
  }
  async verOrdenRuteo(...args: Parameters<PosRuteo['verOrdenRuteo']>) {
    return this.ruteo.verOrdenRuteo(...args);
  }
  async editarOrdenRuteo(...args: Parameters<PosRuteo['editarOrdenRuteo']>) {
    return this.ruteo.editarOrdenRuteo(...args);
  }
  async cambiarEstadoOrdenRuteo(...args: Parameters<PosRuteo['cambiarEstadoOrdenRuteo']>) {
    return this.ruteo.cambiarEstadoOrdenRuteo(...args);
  }
  async obtenerEstadoTarjetaRuteo(...args: Parameters<PosRuteo['obtenerEstadoTarjetaRuteo']>) {
    return this.ruteo.obtenerEstadoTarjetaRuteo(...args);
  }
  async obtenerPrimeraOrdenRuteoSeleccionable(...args: Parameters<PosRuteo['obtenerPrimeraOrdenRuteoSeleccionable']>) {
    return this.ruteo.obtenerPrimeraOrdenRuteoSeleccionable(...args);
  }
  async obtenerPrimeraOrdenRuteoConEstado(...args: Parameters<PosRuteo['obtenerPrimeraOrdenRuteoConEstado']>) {
    return this.ruteo.obtenerPrimeraOrdenRuteoConEstado(...args);
  }
  async obtenerPrimeraOrdenRuteoConEstadoYSeleccionable(...args: Parameters<PosRuteo['obtenerPrimeraOrdenRuteoConEstadoYSeleccionable']>) {
    return this.ruteo.obtenerPrimeraOrdenRuteoConEstadoYSeleccionable(...args);
  }
  async seleccionarOrdenRuteoParaFacturar(...args: Parameters<PosRuteo['seleccionarOrdenRuteoParaFacturar']>) {
    return this.ruteo.seleccionarOrdenRuteoParaFacturar(...args);
  }
  async obtenerEstadoFacturacionOrdenRuteo(...args: Parameters<PosRuteo['obtenerEstadoFacturacionOrdenRuteo']>) {
    return this.ruteo.obtenerEstadoFacturacionOrdenRuteo(...args);
  }
  async ordenRuteoSeleccionable(...args: Parameters<PosRuteo['ordenRuteoSeleccionable']>) {
    return this.ruteo.ordenRuteoSeleccionable(...args);
  }
  async irAFiltroRuteo(...args: Parameters<PosRuteo['irAFiltroRuteo']>) {
    return this.ruteo.irAFiltroRuteo(...args);
  }
  async obtenerIdsOrdenesRuteoVisibles(...args: Parameters<PosRuteo['obtenerIdsOrdenesRuteoVisibles']>) {
    return this.ruteo.obtenerIdsOrdenesRuteoVisibles(...args);
  }
  get _btnAccionesMasivasRuteo() { return this.ruteo._btnAccionesMasivasRuteo; }
  async _abrirMenuAccionesMasivasRuteo(...args: Parameters<PosRuteo['_abrirMenuAccionesMasivasRuteo']>) {
    return this.ruteo._abrirMenuAccionesMasivasRuteo(...args);
  }
  async entrarModoSeleccionMasivaRuteo(...args: Parameters<PosRuteo['entrarModoSeleccionMasivaRuteo']>) {
    return this.ruteo.entrarModoSeleccionMasivaRuteo(...args);
  }
  async seleccionMasivaRuteoHabilitada(...args: Parameters<PosRuteo['seleccionMasivaRuteoHabilitada']>) {
    return this.ruteo.seleccionMasivaRuteoHabilitada(...args);
  }
  async marcarOrdenParaAccionMasivaRuteo(...args: Parameters<PosRuteo['marcarOrdenParaAccionMasivaRuteo']>) {
    return this.ruteo.marcarOrdenParaAccionMasivaRuteo(...args);
  }
  async seleccionarTodasLasOrdenesRuteoVisibles(...args: Parameters<PosRuteo['seleccionarTodasLasOrdenesRuteoVisibles']>) {
    return this.ruteo.seleccionarTodasLasOrdenesRuteoVisibles(...args);
  }
  async limpiarSeleccionMasivaRuteo(...args: Parameters<PosRuteo['limpiarSeleccionMasivaRuteo']>) {
    return this.ruteo.limpiarSeleccionMasivaRuteo(...args);
  }
  async obtenerContadorSeleccionadasRuteo(...args: Parameters<PosRuteo['obtenerContadorSeleccionadasRuteo']>) {
    return this.ruteo.obtenerContadorSeleccionadasRuteo(...args);
  }
  async obtenerContadorTotalRuteo(...args: Parameters<PosRuteo['obtenerContadorTotalRuteo']>) {
    return this.ruteo.obtenerContadorTotalRuteo(...args);
  }
  async seleccionarFiltroRepartidorRuteo(...args: Parameters<PosRuteo['seleccionarFiltroRepartidorRuteo']>) {
    return this.ruteo.seleccionarFiltroRepartidorRuteo(...args);
  }
  async limpiarFiltroRepartidorRuteo(...args: Parameters<PosRuteo['limpiarFiltroRepartidorRuteo']>) {
    return this.ruteo.limpiarFiltroRepartidorRuteo(...args);
  }
  async buscarOrdenRuteoPorCliente(...args: Parameters<PosRuteo['buscarOrdenRuteoPorCliente']>) {
    return this.ruteo.buscarOrdenRuteoPorCliente(...args);
  }
  async limpiarBusquedaRuteo(...args: Parameters<PosRuteo['limpiarBusquedaRuteo']>) {
    return this.ruteo.limpiarBusquedaRuteo(...args);
  }
  async _confirmarModalAccionMasivaRuteo(...args: Parameters<PosRuteo['_confirmarModalAccionMasivaRuteo']>) {
    return this.ruteo._confirmarModalAccionMasivaRuteo(...args);
  }
  async abrirModalEnviarRuteoMasivo(...args: Parameters<PosRuteo['abrirModalEnviarRuteoMasivo']>) {
    return this.ruteo.abrirModalEnviarRuteoMasivo(...args);
  }
  async leerInfoModalEnviarRuteoMasivo(...args: Parameters<PosRuteo['leerInfoModalEnviarRuteoMasivo']>) {
    return this.ruteo.leerInfoModalEnviarRuteoMasivo(...args);
  }
  async enviarOrdenesRuteoMasivamente(...args: Parameters<PosRuteo['enviarOrdenesRuteoMasivamente']>) {
    return this.ruteo.enviarOrdenesRuteoMasivamente(...args);
  }
  async enviarOrdenesRuteoMasivamenteConFacturacionAutomatica(...args: Parameters<PosRuteo['enviarOrdenesRuteoMasivamenteConFacturacionAutomatica']>) {
    return this.ruteo.enviarOrdenesRuteoMasivamenteConFacturacionAutomatica(...args);
  }
  async confirmarEnvioRuteoMasivoConFacturacionAutomatica(...args: Parameters<PosRuteo['confirmarEnvioRuteoMasivoConFacturacionAutomatica']>) {
    return this.ruteo.confirmarEnvioRuteoMasivoConFacturacionAutomatica(...args);
  }
  async cambiarRepartidorOrdenesRuteoMasivamente(...args: Parameters<PosRuteo['cambiarRepartidorOrdenesRuteoMasivamente']>) {
    return this.ruteo.cambiarRepartidorOrdenesRuteoMasivamente(...args);
  }
  async eliminarOrdenesRuteoMasivamente(...args: Parameters<PosRuteo['eliminarOrdenesRuteoMasivamente']>) {
    return this.ruteo.eliminarOrdenesRuteoMasivamente(...args);
  }
  async descargarReporteRuteoPDF(...args: Parameters<PosRuteo['descargarReporteRuteoPDF']>) {
    return this.ruteo.descargarReporteRuteoPDF(...args);
  }
  async imprimirReporteRuteoPDF(...args: Parameters<PosRuteo['imprimirReporteRuteoPDF']>) {
    return this.ruteo.imprimirReporteRuteoPDF(...args);
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
  async obtenerSimbolosMonedaDisponibles(...args: Parameters<PosCore['obtenerSimbolosMonedaDisponibles']>) {
    return this.core.obtenerSimbolosMonedaDisponibles(...args);
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
  get campoObservacionProforma() { return this.proforma.campoObservacionProforma; }
  async llenarObservacionProforma(...args: Parameters<PosProforma['llenarObservacionProforma']>) {
    return this.proforma.llenarObservacionProforma(...args);
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
  async obtenerIdProformaCreada(...args: Parameters<PosProforma['obtenerIdProformaCreada']>) {
    return this.proforma.obtenerIdProformaCreada(...args);
  }
  async abrirVistaPreviaWhatsApp(...args: Parameters<PosProforma['abrirVistaPreviaWhatsApp']>) {
    return this.proforma.abrirVistaPreviaWhatsApp(...args);
  }
  async enviarPorWhatsAppYObtenerPestana(...args: Parameters<PosProforma['enviarPorWhatsAppYObtenerPestana']>) {
    return this.proforma.enviarPorWhatsAppYObtenerPestana(...args);
  }
  async abrirListadoProformas(...args: Parameters<PosProforma['abrirListadoProformas']>) {
    return this.proforma.abrirListadoProformas(...args);
  }
  async seleccionarPrimeraProformaDelListado(...args: Parameters<PosProforma['seleccionarPrimeraProformaDelListado']>) {
    return this.proforma.seleccionarPrimeraProformaDelListado(...args);
  }
  async eliminarProformaSeleccionadaDelListado(...args: Parameters<PosProforma['eliminarProformaSeleccionadaDelListado']>) {
    return this.proforma.eliminarProformaSeleccionadaDelListado(...args);
  }
  async imprimirProformaSeleccionadaDelListado(...args: Parameters<PosProforma['imprimirProformaSeleccionadaDelListado']>) {
    return this.proforma.imprimirProformaSeleccionadaDelListado(...args);
  }
  async descargarPdfProformaSeleccionadaDelListado(...args: Parameters<PosProforma['descargarPdfProformaSeleccionadaDelListado']>) {
    return this.proforma.descargarPdfProformaSeleccionadaDelListado(...args);
  }
  async enviarProformaSeleccionadaDelListadoPorCorreo(...args: Parameters<PosProforma['enviarProformaSeleccionadaDelListadoPorCorreo']>) {
    return this.proforma.enviarProformaSeleccionadaDelListadoPorCorreo(...args);
  }
  async abrirLinkFacturarDelListado(...args: Parameters<PosProforma['abrirLinkFacturarDelListado']>) {
    return this.proforma.abrirLinkFacturarDelListado(...args);
  }
  async cargarProformaEnCarritoDesdeTab(...args: Parameters<PosProforma['cargarProformaEnCarritoDesdeTab']>) {
    return this.proforma.cargarProformaEnCarritoDesdeTab(...args);
  }
  async intentarConvertirAOrdenDeReparacion(...args: Parameters<PosProforma['intentarConvertirAOrdenDeReparacion']>) {
    return this.proforma.intentarConvertirAOrdenDeReparacion(...args);
  }
  async seleccionarPlacaClienteEnCarrito(...args: Parameters<PosProforma['seleccionarPlacaClienteEnCarrito']>) {
    return this.proforma.seleccionarPlacaClienteEnCarrito(...args);
  }
  async confirmarConversionAOrdenDeReparacionYObtenerRespuesta(...args: Parameters<PosProforma['confirmarConversionAOrdenDeReparacionYObtenerRespuesta']>) {
    return this.proforma.confirmarConversionAOrdenDeReparacionYObtenerRespuesta(...args);
  }
  async abrirMenuTarjetaProformaEnTab(...args: Parameters<PosProforma['abrirMenuTarjetaProformaEnTab']>) {
    return this.proforma.abrirMenuTarjetaProformaEnTab(...args);
  }
  async cambiarSubTabProforma(...args: Parameters<PosProforma['cambiarSubTabProforma']>) {
    return this.proforma.cambiarSubTabProforma(...args);
  }
  async editarProformaSeleccionada(...args: Parameters<PosProforma['editarProformaSeleccionada']>) {
    return this.proforma.editarProformaSeleccionada(...args);
  }
  async guardarEdicionProformaYObtenerRespuesta(...args: Parameters<PosProforma['guardarEdicionProformaYObtenerRespuesta']>) {
    return this.proforma.guardarEdicionProformaYObtenerRespuesta(...args);
  }
  async abrirWhatsAppDesdeTab(...args: Parameters<PosProforma['abrirWhatsAppDesdeTab']>) {
    return this.proforma.abrirWhatsAppDesdeTab(...args);
  }
  async obtenerPrimeraProformaEnTab(...args: Parameters<PosProforma['obtenerPrimeraProformaEnTab']>) {
    return this.proforma.obtenerPrimeraProformaEnTab(...args);
  }
  async descargarProformaDesdeModalWhatsApp(...args: Parameters<PosProforma['descargarProformaDesdeModalWhatsApp']>) {
    return this.proforma.descargarProformaDesdeModalWhatsApp(...args);
  }
  async imprimirProformaDesdeTab(...args: Parameters<PosProforma['imprimirProformaDesdeTab']>) {
    return this.proforma.imprimirProformaDesdeTab(...args);
  }
  async descargarPdfProformaDesdeTab(...args: Parameters<PosProforma['descargarPdfProformaDesdeTab']>) {
    return this.proforma.descargarPdfProformaDesdeTab(...args);
  }
  async enviarEmailDesdeTab(...args: Parameters<PosProforma['enviarEmailDesdeTab']>) {
    return this.proforma.enviarEmailDesdeTab(...args);
  }
  async eliminarProformaDesdeTab(...args: Parameters<PosProforma['eliminarProformaDesdeTab']>) {
    return this.proforma.eliminarProformaDesdeTab(...args);
  }
  get botonGenerarApartado() { return this.apartados.botonGenerarApartado; }
  async abrirCrearApartado(...args: Parameters<PosApartados['abrirCrearApartado']>) {
    return this.apartados.abrirCrearApartado(...args);
  }
  async seleccionarClienteEnModalApartado(...args: Parameters<PosApartados['seleccionarClienteEnModalApartado']>) {
    return this.apartados.seleccionarClienteEnModalApartado(...args);
  }
  async guardarApartadoYObtenerRespuesta(...args: Parameters<PosApartados['guardarApartadoYObtenerRespuesta']>) {
    return this.apartados.guardarApartadoYObtenerRespuesta(...args);
  }
  async validarApartadoCreado(...args: Parameters<PosApartados['validarApartadoCreado']>) {
    return this.apartados.validarApartadoCreado(...args);
  }
  async cargarPrimerApartadoDisponible(...args: Parameters<PosApartados['cargarPrimerApartadoDisponible']>) {
    return this.apartados.cargarPrimerApartadoDisponible(...args);
  }
  async buscarApartadosPorTexto(...args: Parameters<PosApartados['buscarApartadosPorTexto']>) {
    return this.apartados.buscarApartadosPorTexto(...args);
  }
  async contarApartadosVisibles(...args: Parameters<PosApartados['contarApartadosVisibles']>) {
    return this.apartados.contarApartadosVisibles(...args);
  }
  async contarApartadosConTexto(...args: Parameters<PosApartados['contarApartadosConTexto']>) {
    return this.apartados.contarApartadosConTexto(...args);
  }
  async obtenerNumeroApartadoTarjetaMasReciente(...args: Parameters<PosApartados['obtenerNumeroApartadoTarjetaMasReciente']>) {
    return this.apartados.obtenerNumeroApartadoTarjetaMasReciente(...args);
  }
  async cargarPrimerApartadoConTotalRazonable(...args: Parameters<PosApartados['cargarPrimerApartadoConTotalRazonable']>) {
    return this.apartados.cargarPrimerApartadoConTotalRazonable(...args);
  }
  async abrirRealizarAbono(...args: Parameters<PosApartados['abrirRealizarAbono']>) {
    return this.apartados.abrirRealizarAbono(...args);
  }
  async aplicarAbonoYObtenerRespuesta(...args: Parameters<PosApartados['aplicarAbonoYObtenerRespuesta']>) {
    return this.apartados.aplicarAbonoYObtenerRespuesta(...args);
  }
  async validarAbonoAplicado(...args: Parameters<PosApartados['validarAbonoAplicado']>) {
    return this.apartados.validarAbonoAplicado(...args);
  }
  async abrirImportarFactura(...args: Parameters<PosImportarFactura['abrirImportarFactura']>) {
    return this.importarFactura.abrirImportarFactura(...args);
  }
  async importarPrimeraFacturaDisponible(...args: Parameters<PosImportarFactura['importarPrimeraFacturaDisponible']>) {
    return this.importarFactura.importarPrimeraFacturaDisponible(...args);
  }
  async hayClienteRealSeleccionado(...args: Parameters<PosCore['hayClienteRealSeleccionado']>) {
    return this.core.hayClienteRealSeleccionado(...args);
  }
  async obtenerClienteSeleccionado(...args: Parameters<PosCore['obtenerClienteSeleccionado']>) {
    return this.core.obtenerClienteSeleccionado(...args);
  }
  async quitarClienteSeleccionado(...args: Parameters<PosCore['quitarClienteSeleccionado']>) {
    return this.core.quitarClienteSeleccionado(...args);
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
