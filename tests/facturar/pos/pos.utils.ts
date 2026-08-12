import { expect, Page } from '@playwright/test';

/**
 * Registra los errores de JavaScript NO capturados ("pageerror") desde el
 * momento en que se llama, no desde el inicio de la página — función
 * independiente (no método de PosPage: no usa `this.page`, solo recibe un
 * Page), reutilizada por pos-navegacion.spec.ts y pos-orden-caja.spec.ts.
 * Centralizada aquí: existía duplicada de forma idéntica como función local
 * en pos-orden-caja.spec.ts.
 */
export function espiarErroresJS(page: Page): string[] {
  const errores: string[] = [];
  page.on('pageerror', (err) => errores.push(err.message));
  return errores;
}

/**
 * Espera (con reintentos reales, no una pausa fija) a que la condición de
 * "activo" dada se cumpla — usado para confirmar que una categoría o un tab
 * quedó seleccionado tras hacer click. Mismo patrón que espiarErroresJS: función
 * independiente, no método de PosPage (no usa `this.page`, solo recibe un
 * predicado arbitrario). Centralizada aquí: existía duplicada de forma
 * idéntica como función local en pos-crear.spec.ts, pos-navegacion.spec.ts y
 * pos.spec.ts.
 */
export async function esperarQuedaActivo(chequeoActivo: () => Promise<boolean>) {
  await expect.poll(chequeoActivo).toBe(true);
}

// ─── Medición de tiempo de acciones reales ─────────────────────────────────

export type MedicionAccion = {
  accion: string;
  ms: number;
  segundos: number;
  resultado: 'OK' | 'ERROR';
  error?: string;
};

/**
 * Mide el tiempo REAL de una acción del sistema: desde justo antes de
 * ejecutarla hasta que la condición real de "la acción terminó" se cumple —
 * nunca el tiempo hasta que el click se registra. La responsabilidad de
 * definir "terminó" es de `ejecutar` (el llamador debe pasar la operación
 * COMPLETA, incluida su propia espera real ya existente en el Page Object —
 * `expect(...).toBeVisible()`, `waitForResponse(...)`, `expect.poll(...)` —
 * nunca solo el `.click()` suelto): este helper no adivina cuándo termina
 * nada, solo cronometra lo que ya se le da. Nunca usar con una función que
 * solo dispara la acción y no espera su resultado real (eso mediría "tiempo
 * hasta que el click se registró", no el tiempo de respuesta real de la
 * acción, que es justo lo que se prohíbe medir).
 *
 * Acumula cada medición en el arreglo `registro` dado por el llamador
 * (normalmente uno por test o uno compartido por todo el archivo) para
 * poder armar una tabla de rendimiento al finalizar — ver
 * `formatearTablaMediciones()`. Si `ejecutar` lanza, la medición se registra
 * igual (con resultado "ERROR") antes de relanzar el error original, para
 * no perder la evidencia de cuánto tardó en fallar.
 */
export async function medirAccion<T>(
  registro: MedicionAccion[],
  accion: string,
  ejecutar: () => Promise<T>
): Promise<T> {
  const inicio = Date.now();
  try {
    const resultado = await ejecutar();
    const ms = Date.now() - inicio;
    registro.push({ accion, ms, segundos: Number((ms / 1000).toFixed(2)), resultado: 'OK' });
    return resultado;
  } catch (e: any) {
    const ms = Date.now() - inicio;
    registro.push({ accion, ms, segundos: Number((ms / 1000).toFixed(2)), resultado: 'ERROR', error: e.message });
    throw e;
  }
}

/** Formatea el registro de mediciones como tabla Markdown — para volcar en consola/reporte final. */
export function formatearTablaMediciones(registro: MedicionAccion[]): string {
  const filas = registro
    .map((m) => `| ${m.accion} | ${m.ms} ms (${m.segundos}s) | ${m.resultado}${m.error ? ` — ${m.error.slice(0, 80)}` : ''} |`)
    .join('\n');
  return `| Acción | Tiempo | Resultado |\n|---|---:|---|\n${filas}`;
}

/**
 * Espera la ventana emergente de impresión (`window.open(...)`) que dispara
 * `disparar()` y confirma que efectivamente se abrió — la señal real de
 * éxito ya documentada en el módulo Restaurante (Mesas) para Pre-Factura/
 * Comanda: esa ventana nunca navega a una URL real (permanece en
 * about:blank) y se cierra sola casi instantáneamente, así que leer su
 * contenido no es viable con Playwright en este ambiente (las 3 vías
 * probadas — `textContent` tras `domcontentloaded`, interceptar `response`,
 * `content()` en un bucle de reintentos — fueron descartadas, ver el
 * comentario original en `pos-restaurante-mesas.page.ts`). Centralizada aquí
 * (función independiente, no método de ninguna clase) para que cualquier
 * flujo de impresión de este estilo (Mesas, Órdenes para Llevar, y
 * cualquier módulo futuro que dispare un popup de impresión sin navegación
 * real) reutilice la misma señal, en vez de duplicar el mismo `waitForEvent`.
 */
export async function esperarVentanaImpresion(page: Page, disparar: () => Promise<void>, timeout: number): Promise<void> {
  const popupPromise = page.waitForEvent('popup', { timeout });
  await disparar();
  await popupPromise;
}
