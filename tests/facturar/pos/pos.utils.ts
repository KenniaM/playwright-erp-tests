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
