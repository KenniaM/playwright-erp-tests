# CLAUDE_CONTEXT.md

Contexto operativo para cualquier sesión de Claude que trabaje en este repositorio. Complementa a `CLAUDE.md` (que documenta las reglas permanentes/estructurales del repo) sin repetirlo — este archivo se enfoca en **cómo trabajar** dentro de esa arquitectura: flujos operativos, investigación en vivo, manejo de casos ya resueltos, y qué evitar específicamente al automatizar contra este ambiente.

## Antes de empezar: qué tipo de ambiente es este

Es un ERP real corriendo en un ambiente compartido de QA/desarrollo (`https://dev.designsoftcr.com/qa_talleralpha/public/`), no un mock ni un servidor local. Cada acción de un test (crear un cliente, un producto, una factura) es una escritura real contra ese backend, visible para cualquier otra persona/proceso que use el mismo ambiente en ese momento. Consecuencias prácticas:

- El catálogo/datos del ambiente **no está limpio**: acumula entradas de pruebas manuales y de corridas previas de la suite (ver ejemplo concreto más abajo, catálogo de Marca de vehículo). No asumir que "la primera opción de un catálogo" es una opción de datos sanos.
- Bajo carga (varios workers en paralelo, u otras personas usando el mismo ambiente), tiempos de respuesta y comportamiento de condiciones de carrera pueden variar entre corridas — varios mecanismos de reintento acotado en el código existen específicamente por esto, confirmados en vivo, no por precaución genérica.
- No hay limpieza de datos después de cada test (ver `CLAUDE.md`) — es coherente con el resto del diseño, no lo cambies agregando `afterEach` de borrado salvo que el usuario lo pida explícitamente.

## Login, Dashboard y selección de compañía — flujo operativo

- La sesión ya viene autenticada vía `storageState` (ver `CLAUDE.md`, Auth Flow). Si un test falla con algo que huele a sesión expirada (redirección a `/log/login`, elementos del Dashboard nunca aparecen), lo primero a probar es regenerar `admin.json` (`npx playwright test --project=setup`), no asumir un bug de automatización.
- Cargar el POS **siempre** a través de `PosCore.irAlPos()` / `cargarPosDesdeDashboard()` — nunca construir a mano la URL del POS. La URL real incluye un `company_pos` que resuelve la propia aplicación (varía por compañía/ambiente) y se cachea a nivel de módulo (una vez por worker) precisamente para no tener que re-resolver la compañía en cada test.
- La selección de compañía (modal `#dialog_select_company_pos` vs. navegación directa cuando la cuenta solo tiene una) es una carrera real entre dos comportamientos legítimos de la aplicación, no un bug — si se toca este flujo, no colapsarlo a un solo camino asumiendo cuál va a ocurrir.
- El Dashboard puede mostrar, además, un modal de tipo de cambio (BCCR) y, en cuentas cuya compañía por defecto tiene pendiente configuración inicial, un modal "Setup Inicial del Sistema" — ambos ajenos al flujo bajo prueba, se cierran y se continúa, nunca se completan.

## Manejo de modales y overlays — patrón a seguir

Cuando un flujo nuevo se tope con un modal/overlay que puede aparecer de forma asíncrona (banner de notificaciones del navegador, avisos "noty", cualquier modal que pueda reaparecer tras cerrarlo):

1. No asumir que cerrarlo una vez basta — puede reaparecer antes del siguiente click real.
2. Usar un bucle acotado de pocos intentos (no una sola espera larga): cerrar los overlays conocidos justo antes de cada intento de click, con timeouts cortos por intento.
3. Reutilizar `PosCore.cerrarOverlaysConocidos()` como primer paso estándar tras cargar el POS, en vez de reinventar el cierre de notificaciones/toasts en cada spec nuevo.

Este patrón ya está confirmado en vivo como la diferencia entre un modal que cierra en 2-3 segundos vs. uno que puede tardar hasta el timeout completo de un único intento largo (documentado con evidencia real en los comentarios de `_cerrarOverlayDashboardSiAparece` en `pos-core.page.ts`) — no es una precaución teórica.

## Widgets "Chosen" (selects estilizados) — cuál helper usar

La app usa jQuery Chosen para casi todos los `<select>`. El `<select>` real queda oculto (`display:none`); solo el trigger visual (`.chosen-single` para selección simple, `.chosen-choices`/`<ul>` para selección múltiple) es interactuable. `PosCore` ya expone 3 variantes — elegir según lo que se sepa del campo:

| Situación | Helper |
|---|---|
| El campo siempre está visible y siempre debería tener al menos una opción real (si no, es un error) | `_seleccionarPrimeraOpcionChosen()` |
| El trigger es visible pero su catálogo puede legítimamente venir vacío (depende de otro campo, ej. Subcategoría depende de Categoría) | `_seleccionarPrimeraOpcionChosenSiHayOpciones()` |
| La sección completa (label + Chosen) puede no renderizarse según configuración de compañía/país | `_seleccionarPrimeraOpcionChosenSiEsPosible()` (devuelve `boolean`) |
| Selección múltiple (`chosen-container-multi`) | No hay helper genérico — replicar el patrón acotado de `_seleccionarPrimeraOpcionChosenMultiple` en `pos-crear-cliente.page.ts`, documentando por qué el widget es distinto |

**Caso especial a recordar**: si la opción elegida alimenta un campo dependiente (cascada tipo Marca→Modelo), "la primera opción real" puede no tener datos dependientes aunque el mecanismo de la app funcione perfectamente — es un problema de calidad de datos del catálogo QA, no de la aplicación. Antes de asumir un bug del sistema, recorrer el catálogo completo probando varias opciones y contar cuántas sí tienen datos dependientes; si la mayoría los tiene, el problema es la estrategia de selección (corregirla, ver `_seleccionarMarcaVehiculoConModelosReales`), no la app.

## Flujo de investigación de errores (probado en este repo)

Cuando un escenario falla y la causa no es obvia desde el mensaje de error de Playwright:

1. **No reintentar a ciegas ni aumentar timeouts.** Leer primero el error completo: locator, valor esperado vs. recibido, y el `error-context.md`/screenshot que Playwright ya generó en `test-results/`.
2. Si el error no es suficiente, escribir un **spec de investigación temporal** (p. ej. `tests/facturar/pos/_investigacion-temp.spec.ts`) que reproduzca el paso exacto con logging explícito: valores intermedios de campos (`inputValue()`), el payload real enviado a un endpoint (`page.on('request', ...)` + `req.postData()`), y capturas (`page.screenshot()`) en los puntos clave. Correrlo con `npx playwright test <archivo> --project=chromium --reporter=list --workers=1` para ver el log completo.
3. Aislar la causa reduciendo el repro al mínimo: si el flujo completo falla, probar el mismo paso SIN los pasos intermedios sospechosos para confirmar cuál específicamente dispara el problema (ejemplo real: para aislar que "Batch" se perdía por la tab "Opciones avanzadas" y no por "Ubicación", se corrió una vez guardando directo desde "Opciones avanzadas" sin pasar por "Ubicación", y el problema persistió — eso descartó "Ubicación"/"Agregar dirección" como causa).
4. **Eliminar el spec de investigación temporal al terminar** — nunca commitearlo. No es parte de la suite, es una herramienta de una sola sesión.
5. Clasificar la causa antes de tocar nada:
   - **Automatización**: el selector/estrategia/espera de Playwright está mal — corregirlo en el Page Object real, no en el spec (a menos que el spec tenga la lógica indebidamente inline).
   - **Sistema/backend**: el frontend envía el dato correcto (confirmarlo interceptando la red) pero no persiste, o el comportamiento contradice lo esperado del negocio — **no modificar la aserción para que pase**. Documentar con evidencia (payload enviado, valor esperado vs. recibido, pasos mínimos para reproducir) en el reporte final y, si aplica, como comentario en el Page Object cerca del código afectado.
   - **Datos/ambiente**: el catálogo/estado del ambiente compartido está sucio o inconsistente (ver ejemplo de Marca de vehículo) — si se puede hacer la automatización robusta ante eso sin ocultar un problema real, hacerlo (documentando el porqué); si no, documentarlo igual que un bug de sistema.

## Reglas para documentar bugs encontrados

- Nunca reportar "algo falla" sin evidencia reproducible: locator exacto, valor esperado vs. recibido, y — cuando aplique — el payload de red real enviado.
- Distinguir explícitamente si el bug es de automatización (y ya se corrigió), de sistema/backend, o de datos/ambiente — el usuario de este proyecto pidió explícitamente esta clasificación y que no se oculten bugs reales debilitando aserciones.
- Si el bug de sistema es específico de un flujo ya cubierto por un Page Object, dejar constancia como comentario junto al código relevante (mismo estilo que el resto del repo: causa raíz investigada en vivo, no asumida) además de en el reporte final — así una sesión futura no necesita re-descubrirlo desde cero.

## Formato esperado de los reportes finales

Cuando se complete un trabajo de automatización/investigación no trivial, entregar un resumen que cubra (adaptando según lo que realmente aplique, sin inventar secciones vacías):

- Análisis del flujo investigado.
- Arquitectura usada (qué Page Objects/fixtures se reutilizaron vs. se crearon).
- Métodos reutilizados y métodos nuevos, con motivo de cada uno nuevo.
- Resultado de cada escenario ejecutado contra el ambiente real (pasa/falla, tiempo), no solo "el código compila".
- Causa raíz de cada fallo, clasificada (automatización/sistema/datos).
- Bugs de sistema o problemas de ambiente encontrados, con evidencia.
- Recomendaciones.

**Los reportes y explicaciones a este usuario deben entregarse en español** (preferencia explícita ya indicada en este proyecto).

## Qué NO hacer en este proyecto

La lista completa de prácticas a evitar (con su motivo y el método real del repo que las resuelve correctamente) vive en `CLAUDE.md` → "Buenas prácticas / qué evitar" — no se repite aquí. Como complemento operativo, específico de cómo trabajar en sesiones de investigación (no cubierto allí):

- No asumir el comportamiento de un flujo de UI nuevo sin haberlo investigado en vivo primero — navegar el flujo real, inspeccionar DOM/red, nunca adivinar selectores ni dar por sentado un mensaje de error o un valor persistido.
- No cerrar una investigación de bug con "parece que es X" sin la evidencia mínima descrita arriba (payload real, valor antes/después, repro aislado) — "parece" no es una clasificación válida entre automatización/sistema/datos.
