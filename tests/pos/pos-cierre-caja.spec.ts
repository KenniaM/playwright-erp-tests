import { test, expect } from '@playwright/test';
import { PosPage, CAJA_TEXTO, TIMEOUTS } from './pos.page';

test('Cerrar caja', async ({ page }) => {
  test.setTimeout(TIMEOUTS.TEST);
  const pos = new PosPage(page);

  await test.step('Abrir el POS', async () => {
    // El modal "Abrir Caja" al cargar bloquea toda la página (incluido el menú
    // "Caja"), sin importar el estado real de la caja: hay que cerrarlo para poder
    // continuar. Cerrarlo con "Cancelar" no abre la caja, así que no interfiere con
    // la detección de estado que hace el propio flujo de "Abrir/Cerrar Caja (F12)".
    await pos.cargarPosYCerrarModalSiAparece();
  });

  await test.step('Verificar y descartar modales/mensajes opcionales antes del flujo principal', async () => {
    // Ninguno de los dos es parte del flujo de cerrar caja: se comprueban y
    // descartan aquí, en este orden, para que no interfieran con los clicks del
    // menú "Caja" más adelante. Su ausencia es igual de válida que su aparición.
    if (await pos.modalNotificaciones.isVisible().catch(() => false)) {
      await pos.cerrarModalNotificacionesSiAparece();
      await expect(pos.modalNotificaciones).toBeHidden();
    }

    if (await pos.avisoConsecutivoFueraDeRango.isVisible().catch(() => false)) {
      await pos.cerrarAvisoConsecutivoSiAparece();
      await expect(pos.avisoConsecutivoFueraDeRango).toBeHidden();
    }
  });

  await test.step('Abrir el menú "Caja", detectar el estado y cerrarla (abriéndola primero si es necesario)', async () => {
    // El mismo ítem "Abrir/Cerrar Caja (F12)" muestra el modal "Abrir Caja" (cerrada)
    // o "Detalle de Cierre" (abierta): la decisión se basa únicamente en cuál de los
    // dos aparece, nunca se asume de antemano. Además, que la caja parezca abierta
    // en un momento no garantiza que lo siga estando en el siguiente (el sistema
    // puede volver a reportarla cerrada de forma asíncrona), así que todo el ciclo
    // —entrar al menú, abrir si hace falta, y finalmente cerrar— se reintenta como
    // una unidad hasta lograrlo, monitoreando continuamente el estado real.
    //
    // El click sobre el <li> del menú puede quedar bloqueado por un overlay
    // transitorio del encabezado (banner de notificaciones, un toast "noty") que
    // en ese instante ocupe esa esquina — confirmado en vivo inspeccionando el
    // DOM real. Por eso cada vuelta: (1) limpia esos overlays antes de tocar el
    // menú, (2) nunca vuelve a pulsar #menu_cash si el menú ya está desplegado
    // (es un toggle: un segundo click lo cerraría en vez de dejarlo abierto), y
    // (3) nunca vuelve a tocar el menú si algún modal de caja ya está visible —
    // con el modal abierto, #menu_cash queda bloqueado por su backdrop estático
    // hasta agotar su propio timeout, sin lograr nada.
    const MAX_INTENTOS = 5;
    let cerrada = false;

    for (let intento = 1; intento <= MAX_INTENTOS && !cerrada; intento++) {
      const abrirCajaYaVisible = await pos.modalAbrirCajaVisible();
      const cerrarCajaYaVisible = await pos.modalCerrarCaja.isVisible().catch(() => false);

      if (!abrirCajaYaVisible && !cerrarCajaYaVisible) {
        await pos.abrirMenuCaja();
        await pos.seleccionarAbrirCerrarCaja().catch((e) => {
          console.log(`[Cerrar caja] click en "Abrir/Cerrar Caja" no tuvo éxito en el intento ${intento}: ${e.message}`);
        });
        await pos.esperarResultadoMenuCaja().catch(() => {});
      }

      if (await pos.modalAbrirCajaVisible()) {
        // Escenario: caja cerrada (o se cerró de nuevo). Abrirla y reintentar el
        // ciclo completo desde el menú, sin asumir que quedará abierta de inmediato.
        await expect(pos.modalAbrirCaja).toBeVisible();
        await pos.completarAperturaCaja();
        await expect(pos.modalAbrirCaja).toBeHidden();
        continue;
      }

      if (await pos.modalCerrarCaja.isVisible().catch(() => false)) {
        // Escenario: caja abierta. Completar y confirmar el cierre.
        await pos.completarFormularioCerrarCaja('0', '0', 'Cierre de prueba automatizado');
        await pos.confirmarCerrarCaja();
        cerrada = !(await pos.modalCerrarCaja.isVisible().catch(() => false));
        continue;
      }

      // Ninguno de los dos modales apareció: el click pudo haber sido bloqueado
      // por completo (menú nunca se abrió) o el menú quedó abierto pero tapado.
      // La siguiente vuelta vuelve a comprobar el estado real en vez de asumir.
    }

    expect(cerrada, `La caja no quedó cerrada tras ${MAX_INTENTOS} intentos`).toBe(true);
  });

  await test.step('Validar que la caja quedó cerrada y que el sistema no muestra errores', async () => {
    // El modal de cierre debe haber desaparecido y el POS debe seguir funcionando.
    await expect(pos.modalCerrarCaja).toBeHidden();
    await expect(pos.primerProducto).toBeVisible();

    // Verificación independiente (no basada solo en la UI que ya se manipuló):
    // recargar el POS y confirmar que ahora sí pide abrir la caja.
    await pos.irAlPos();
    await pos.esperarEstadoInicial();
    await expect(pos.modalAbrirCaja).toBeVisible();
    await expect(pos.modalAbrirCaja.getByText(CAJA_TEXTO)).toBeVisible();

    // No debe quedar ningún mensaje de error visible tras el cierre.
    await expect(page.locator('.noty_bar', { hasText: /error/i })).toHaveCount(0);
  });
});
