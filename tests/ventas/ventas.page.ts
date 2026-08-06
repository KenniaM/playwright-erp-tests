import { Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  // Cada submódulo popula su contenido (filtros/tabla) vía AJAX tras cargar
  // la página — se hace polling hasta este límite antes de leer su estado.
  CARGA:    15_000,
} as const;

// ─── Submódulos ───────────────────────────────────────────────────────────────

/**
 * Los 6 submódulos del menú "Ventas" (URLs confirmadas en vivo desde el menú
 * lateral del dashboard). Cada uno define, además del título de página
 * esperado, un locator propio de su contenido — no compartido con ningún
 * otro submódulo — para confirmar que cargó su pantalla real y no solo que
 * el layout general (header/sidebar) respondió.
 */
export type SubmoduloVentas = {
  nombre: string;
  url: string;
  // Substring que debe contener la URL final tras navegar, para detectar
  // redirecciones inesperadas (p.ej. a login por sesión expirada).
  rutaEsperada: string;
  tituloEsperado: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

export const SUBMODULOS_VENTAS: SubmoduloVentas[] = [
  {
    nombre: 'Histórico de Ventas',
    url: BASE_URL + '/receip/printPosReceip',
    rutaEsperada: 'printPosReceip',
    tituloEsperado: /facturas/i,
    obtenerLocatorDeCarga: (page) =>
      page.locator('input[placeholder="Buscar por factura, orden de compra, orden de reparación o proforma..."]'),
  },
  {
    nombre: 'Abono Cuentas por Cobrar',
    url: BASE_URL + '/credit_sale/clientCreditSales',
    rutaEsperada: 'clientCreditSales',
    tituloEsperado: /cuentas por cobrar/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_search'),
  },
  {
    nombre: 'Lista de Cobros',
    url: BASE_URL + '/receip/receivableList',
    rutaEsperada: 'receivableList',
    tituloEsperado: /lista de cobro/i,
    obtenerLocatorDeCarga: (page) => page.locator('#show_list_status_0'),
  },
  {
    nombre: 'Historial Mov. de Caja',
    url: BASE_URL + '/cash_movement/movements',
    rutaEsperada: 'cash_movement/movements',
    tituloEsperado: /movimientos de caja/i,
    obtenerLocatorDeCarga: (page) => page.locator('input[placeholder="Fecha inicio"]'),
  },
  {
    nombre: 'Devoluciones',
    url: BASE_URL + '/refund/refund',
    rutaEsperada: 'refund/refund',
    tituloEsperado: /devoluciones/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_add_refund'),
  },
  {
    nombre: 'Nota de crédito',
    url: BASE_URL + '/creditNote/creditNote',
    rutaEsperada: 'creditNote/creditNote',
    tituloEsperado: /registro de notas de crédito/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_credit_note_actions'),
  },
];

// ─── Histórico de Ventas: detalle de factura ───────────────────────────────────

/**
 * Datos reales del panel de detalle de una factura en Histórico de Ventas
 * (`.receip-v2-order-item`, confirmado en vivo volcando su DOM real: dos
 * bloques `<span class="order-label">`/`<span class="order-value">`, uno
 * para "Número Orden de Compra" y otro para "Número Orden de Reparación").
 * Ambos campos vienen vacíos ("—") cuando la factura no tiene ese origen —
 * nunca `undefined`, el propio template siempre renderiza el bloque.
 */
export type DetalleFacturaHistorico = {
  numeroOrdenCompra: string;
  numeroOrdenReparacion: string;
};

/**
 * Sección "Forma de pago" del detalle de una factura en Histórico de Ventas.
 * A diferencia de `.receip-v2-order-item` (usado por `leerDetalleFacturaAbierta()`),
 * esta sección NO expone una clase CSS propia y predecible por bloque
 * (confirmado en vivo intentando localizarla por `.receip-v2-order-item` —
 * cuenta 0) — se parsea desde el texto plano del panel, mismo criterio ya
 * usado en otras investigaciones de este repo cuando el marcado real no
 * ofrece un selector estable (ver `pos-permisos.page.ts`). Cada monto queda
 * `null` cuando ese método no aparece en la factura (nunca "0.00": la propia
 * plantilla solo imprime la línea de un método si se usó).
 */
export type FormaDePagoFacturaHistorico = {
  estado: string;
  efectivoRecibido: number | null;
  vuelto: number | null;
  tarjeta: number | null;
  sinpe: number | null;
  transaccion: number | null;
};

// ─── Page Object ──────────────────────────────────────────────────────────────

export class VentasPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de Ventas. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }


  // ─── Histórico de Ventas ──────────────────────────────────────────────────
  //
  // Único submódulo de Ventas con flujo de negocio propio hoy (buscar una
  // factura y verificar su origen real) — el resto sigue cubierto solo por
  // el patrón navegación (ventas-navegacion.spec.ts). Los métodos de esta
  // sección se agregan aquí (no en un archivo aparte) porque el módulo es
  // pequeño: mismo criterio que documenta CLAUDE.md para módulos que no
  // alcanzan la escala de POS.

  /**
   * Abre "Histórico de Ventas" y busca por el término dado usando el
   * buscador real de la pantalla (soporta número de factura, orden de
   * compra, orden de reparación o proforma — confirmado en vivo por su
   * propio placeholder). Espera la respuesta real de red antes de continuar
   * en vez de un tiempo fijo.
   */
  async buscarEnHistoricoVentas(termino: string) {
    await this.irA(SUBMODULOS_VENTAS[0].url);
    const buscador = this.page.locator('input[placeholder="Buscar por factura, orden de compra, orden de reparación o proforma..."]');
    await buscador.waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA });

    await buscador.fill(termino);
    await buscador.press('Enter');
    await this.page.waitForLoadState('networkidle', { timeout: TIMEOUTS.CARGA }).catch(() => {});
  }

  /**
   * Abre el detalle de una factura ya visible en la lista filtrada
   * (`buscarEnHistoricoVentas()` primero), localizándola por su propio
   * consecutivo real (`span.receip-v2-sale-consecutive`, texto real
   * "Consec. <numeroFactura>" — confirmado en vivo volcando su DOM) en vez
   * de buscar el texto en toda la página, que puede coincidir con otros
   * elementos (fecha, monto) que contengan el mismo número.
   */
  async abrirFacturaEnHistorico(numeroFactura: string) {
    const tarjeta = this.page.locator('.receip-v2-sale-consecutive', { hasText: `Consec. ${numeroFactura}` }).first();
    await tarjeta.waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA });
    await tarjeta.click();

    await this.page.locator('.receip-v2-order-item', { hasText: 'Número Orden de Reparación' })
      .waitFor({ state: 'visible', timeout: TIMEOUTS.CARGA });
  }

  /**
   * Lee "Número Orden de Compra"/"Número Orden de Reparación" del panel de
   * detalle YA ABIERTO (`abrirFacturaEnHistorico()`). Localiza cada bloque
   * por su propio label real (`.order-label`), nunca por posición fija —
   * confirmado en vivo que ambos bloques comparten la misma estructura
   * (`.receip-v2-order-item` > `.order-label` + `.order-value`).
   */
  async leerDetalleFacturaAbierta(): Promise<DetalleFacturaHistorico> {
    const leerValor = async (etiqueta: string) => {
      const bloque = this.page.locator('.receip-v2-order-item', { hasText: etiqueta }).first();
      const valor = await bloque.locator('.order-value').textContent();
      return (valor ?? '').trim();
    };

    return {
      numeroOrdenCompra: await leerValor('Número Orden de Compra'),
      numeroOrdenReparacion: await leerValor('Número Orden de Reparación'),
    };
  }

  /**
   * Lee la sección "Forma de pago" del detalle de factura YA ABIERTO
   * (`abrirFacturaEnHistorico()`) — expone cuánto quedó registrado por cada
   * método (Efectivo/Tarjeta/SINPE/Transacción) y el Vuelto real, incluida
   * la posibilidad de que una factura muestre más de un método a la vez
   * (pago mixto declarado, o el saldo/abono acumulado de un Apartado —
   * ambos casos legítimos, confirmados en vivo, investigación 2026-08-06).
   */
  async leerFormaDePagoFacturaAbierta(): Promise<FormaDePagoFacturaHistorico> {
    const texto = await this.page.locator('body').innerText();

    // No reutiliza PosCore._leerMontoDeTexto() (asume coma=miles/punto=decimal,
    // correcto para los montos que expone el propio modal de pago del POS) —
    // este panel de Histórico de Ventas usa el formato latinoamericano real
    // ("L1.000,00": punto=miles, coma=decimal), confirmado en vivo. Variante
    // acotada a este formato distinto, mismo criterio que documenta
    // CLAUDE.md para no forzar un helper que asume el separador contrario.
    const leerMonto = (etiqueta: string): number | null => {
      // `[^:\n]*` entre la etiqueta y los dos puntos: confirmado en vivo que
      // la etiqueta real de Transacción es "Transacción Bancaria" (no solo
      // "Transacción"), palabra extra que un patrón sin este comodín no
      // contempla — sin él, la regex nunca llega a los ":" reales y el
      // monto se pierde por completo, devolviendo null pese a que el dato
      // sí está en la página (hallazgo de fase37: causó un falso positivo
      // de "Transacción no se guardó", ver metodo-pago-mismatch-bug).
      const m = new RegExp(`${etiqueta}[^:\\n]*:?\\s*[A-Za-z$₡]*\\s*([0-9.,]+)`, 'i').exec(texto);
      if (!m) return null;
      const crudo = m[1];
      const limpio = crudo.lastIndexOf(',') > crudo.lastIndexOf('.')
        ? crudo.replace(/\./g, '').replace(',', '.') // punto=miles, coma=decimal
        : crudo.replace(/,/g, '');                    // coma=miles, punto=decimal (o sin separador de miles)
      const valor = parseFloat(limpio);
      return Number.isNaN(valor) ? null : valor;
    };
    const leerTexto = (etiqueta: string): string => {
      const m = new RegExp(`${etiqueta}:?\\s*([^\\n|]+)`, 'i').exec(texto);
      return m ? m[1].trim() : '';
    };

    return {
      estado: leerTexto('Estado'),
      efectivoRecibido: leerMonto('Efectivo recibido'),
      vuelto: leerMonto('Vuelto'),
      tarjeta: leerMonto('Tarjeta'),
      sinpe: leerMonto('SINPE'),
      transaccion: leerMonto('Transacci[oó]n'),
    };
  }
}
