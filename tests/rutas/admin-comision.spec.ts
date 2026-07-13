import { test, expect } from '@playwright/test';
import { ComisionPage, TIMEOUTS } from './comision.page';

test('CP-134: Editar comisión de repartidores (validar cálculos)', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const comisiones = new ComisionPage(page);
  const TOLERANCIA = 1;
  const montoComision = Math.floor(Math.random() * 400) + 100; // entre 100 y 500
  let nombreDocumento = '';
  let valorAntes: string | null = null;

  await test.step('Navegar al módulo Admin. Comisiones', async () => {
    await comisiones.irAComisiones();
    await comisiones.esperarFilasCargadas();
  });

  await test.step('Registrar el estado inicial de la primera comisión', async () => {
    const fila = comisiones.filasComision.first();
    nombreDocumento = await comisiones.nombreDocumento(fila);
    valorAntes = await comisiones.valorComision(fila);

    expect(nombreDocumento, 'No se pudo leer el tipo de documento de la primera comisión').not.toBe('');
    expect(valorAntes, 'No se pudo leer el valor de la primera comisión').not.toBeNull();
  });

  await test.step('Abrir "Editar Comision" desde el menú de acciones', async () => {
    await comisiones.abrirModalEditar(comisiones.filasComision.first());
  });

  await test.step('Ingresar el monto y guardar', async () => {
    await comisiones.guardarMonto(montoComision);
  });

  await test.step('Recargar y validar que el monto guardado coincide con el ingresado', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await comisiones.esperarFilasCargadas();

    const fila = comisiones.filaDocumento(nombreDocumento);
    await expect
      .poll(() => comisiones.valorComision(fila), { timeout: TIMEOUTS.TABLE_LOAD })
      .not.toBe('N/A');

    const valorTexto = await comisiones.valorComision(fila);
    const valorNumerico = valorTexto ? parseFloat(valorTexto.replace(/,/g, '')) : NaN;

    expect(
      Math.abs(valorNumerico - montoComision),
      `El monto guardado (${valorNumerico}) no coincide con el ingresado (${montoComision}) ±${TOLERANCIA}`,
    ).toBeLessThanOrEqual(TOLERANCIA);
  });
});
