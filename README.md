# Playwright ERP Tests
Proyecto de automatización de pruebas end-to-end utilizando Playwright.
## Requisitos
Antes de comenzar, asegúrate de tener instalado:
- Git
- Node.js 20 o superior
- Visual Studio Code (opcional)
- Claude Code (opcional, para asistencia en desarrollo)
Verificar las versiones:
```bash
node -v
npm -v
git --version
```
---
# 1. Clonar el repositorio
```bash
git clone https://github.com/KenniaM/playwright-erp-tests.git
```
Entrar al proyecto:
```bash
cd playwright-erp-tests
```
---
# 2. Instalar dependencias
```bash
npm install
```
Este comando instalará todas las dependencias definidas en `package.json`.
---
# 3. Instalar los navegadores de Playwright
```bash
npx playwright install
```
Si es la primera vez que se instala Playwright:
```bash
npx playwright install --with-deps
```
---
# 4. Verificar la instalación
```bash
npx playwright --version
```
---
# 5. Ejecutar las pruebas
Ejecutar todas las pruebas:
```bash
npx playwright test
```
Ejecutar únicamente las pruebas del POS:
```bash
npx playwright test tests/pos/pos.spec.ts
```
Ejecutar en Chrome:
```bash
npx playwright test --project=chromium
```
Ejecutar mostrando el navegador:
```bash
npx playwright test --headed
```
Ejecutar un único test:
```bash
npx playwright test -g "facturar producto con efectivo en POS"
```
---
# 6. Ver el reporte
Después de ejecutar las pruebas:
```bash
npx playwright show-report
```
---
# 7. Login
El proyecto utiliza una sesión previamente autenticada mediante:
```
playwright/.auth/admin.json
```
Las pruebas reutilizan esta sesión para evitar iniciar sesión en cada ejecución.
Si la sesión expira, ejecutar el setup de autenticación:
```bash
npx playwright test tests/auth/auth.setup.ts
```
o generar nuevamente el archivo `admin.json`.
---
# 8. Claude Code (Opcional)
## Instalar
```bash
npm install -g @anthropic-ai/claude-code
```
Verificar instalación:
```bash
claude --version
```
Iniciar sesión:
```text
/login
```
Verificar estado:
```text
/status
```
Abrir Claude dentro del proyecto:
```bash
claude
```
---
# 9. Actualizar dependencias
Actualizar paquetes:
```bash
npm update
```
Actualizar Playwright:
```bash
npm install @playwright/test@latest
npx playwright install
```
---
# 10. Estructura del proyecto
```
playwright-erp-tests
│
├── .github/
│   └── workflows/
│
├── playwright/
│   └── .auth/
│
├── tests/
│   ├── auth/
│   └── pos/
│       ├── pos.page.ts
│       └── pos.spec.ts
│
├── playwright.config.ts
├── package.json
└── README.md
```
---
# 11. Convenciones del proyecto
- Cada submódulo tendrá su propia carpeta dentro de `tests`.
- Cada submódulo tendrá un archivo `*.page.ts` para encapsular la lógica de la interfaz (Page Object Model).
- Cada submódulo tendrá uno o varios archivos `*.spec.ts` con los casos de prueba.
- Los selectores deberán mantenerse únicamente en los archivos `*.page.ts`.
- Los archivos `*.spec.ts` solo contendrán el flujo del caso de prueba utilizando los métodos del Page Object.
- Siempre reutilizar la sesión almacenada (`storageState`) y no modificar la lógica del login salvo que sea estrictamente necesario.
---
# 12. Comandos útiles
Limpiar la terminal:
Windows CMD
```cmd
cls
```
PowerShell
```powershell
Clear-Host
```
o
```powershell
cls
```
Limpiar caché de Playwright:
```bash
npx playwright clear-cache
```
Ejecutar con UI:
```bash
npx playwright test --ui
```
Grabar un nuevo test:
```bash
npx playwright codegen
```
Abrir el inspector:
```bash
PWDEBUG=1 npx playwright test
```
---
# 13. Prompt de validación QA — Módulo POS
 
Este prompt está pensado para ejecutarse con **Claude Code** (ver sección 8) dentro de este proyecto, para correr una validación completa de la suite automatizada del módulo POS contra un ambiente de QA específico.
 
## Cómo usarlo
 
1. Abre una terminal en la raíz del proyecto.
2. Inicia Claude Code:
```bash
   claude
```
3. Pega el siguiente prompt tal cual (ajusta URL, usuario, contraseña y compañía si cambian):
```text
Quiero que ejecutes una validación completa de toda la suite de pruebas automatizadas del módulo POS.
 
Ambiente de pruebas
URL Base
https://dev.designsoftcr.com/qa_talleralpha/public
 
Usuario:
kadmin@gmail.com
 
Contraseña:
kadmin
 
Compañía a utilizar:
HONDURAS
 
No asumas ningún otro dato distinto a estos.
 
Objetivo
Ejecutar todas las pruebas automatizadas del POS compatibles con este ambiente.
Quiero validar el comportamiento completo del sistema sin modificar la arquitectura existente del proyecto.
 
Reglas obligatorias
 
Login
Utiliza el flujo normal de autenticación.
No modifiques el proceso de login.
 
Dashboard
Después del login siempre debe pasar por el Dashboard.
Si al intentar ingresar al POS aparece el modal de selección de compañía:
- Buscar la compañía HONDURAS.
- Seleccionarla.
- Esperar la navegación real hacia el POS.
Si el modal no aparece:
- Continuar normalmente.
No asumir ningún company_id.
No construir manualmente la URL del POS.
Debe utilizarse exactamente el mismo flujo que usa la aplicación.
 
Compatibilidad con cualquier ambiente
Antes de ejecutar cada suite verifica que la funcionalidad exista.
Por ejemplo:
- Facturas
- Apartados
- Proformas
- Órdenes de Caja
- Ruteo
- Enderezado y Pintura
- Servicios
- Combos
- Importar Factura
- cualquier otra opción del POS
 
Si una funcionalidad no existe:
- No ejecutar esa suite.
- Marcarla como:
  SKIPPED - Funcionalidad no disponible en este ambiente
Nunca marcarla como FAILED.
Continuar con el resto de la ejecución.
 
Suites
Identifica automáticamente las suites disponibles.
Por ejemplo:
- pos.spec.ts
- pos-crear.spec.ts
- pos-facturar.spec.ts
- pos-apartado.spec.ts
- pos-importar-factura.spec.ts
- pos-orden-caja.spec.ts
- pos-ruteo.spec.ts
- cualquier otra suite del POS
 
Dependencias entre pruebas
Analiza las pruebas antes de ejecutarlas.
Si detectas que un test depende del resultado de otro:
- No modificar el código.
- Ejecutarlo por separado para no afectar el resto de la suite.
Debe quedar documentado:
- qué pruebas dependen de otras
- cuáles fueron ejecutadas individualmente
- por qué fue necesario
 
No modificar código innecesariamente
No quiero:
- refactorizaciones
- cambios de arquitectura
- cambios de fixtures
- cambios de Page Objects
- cambios de estructura
Solo modificar código si encuentras un defecto real que impida ejecutar correctamente la prueba.
Antes de modificar cualquier archivo debes:
- investigar
- demostrar la causa raíz
- presentar evidencia
 
Durante la ejecución
Recopila métricas de rendimiento.
Como mínimo mide:
 
Login
- duración
 
Dashboard
- tiempo de carga
- tiempo hasta quedar utilizable
 
POS
- tiempo para abrir
- tiempo hasta quedar listo
 
Productos
- tiempo para cargar catálogo
 
Clientes
- tiempo para cargar búsqueda
 
Facturas
- tiempo para cargar listado
 
Apartados
- tiempo para cargar listado
 
Proformas
- tiempo para cargar listado
 
Órdenes de Caja
- tiempo para cargar listado
 
Importar Factura
- tiempo para cargar listado
 
Ruteo
- tiempo para cargar listado
 
Enderezado y Pintura
- tiempo para cargar vehículos
- tiempo para cargar piezas
- tiempo para cargar servicios
 
Además registra:
- errores JavaScript
- errores HTTP
- tiempos excesivos
- timeouts
- reintentos
- popups inesperados
- modales inesperados
 
Si una prueba falla
No asumir inmediatamente que es un bug.
Investigar la causa.
Clasificar el problema como:
- Datos
- Configuración
- Ambiente
- Automatización
- Sincronización
- Selector obsoleto
- Cambio funcional
- Defecto real del sistema
Respaldar siempre la conclusión con evidencia.
 
Si descubres un cambio funcional
Investigar completamente.
Documentar:
- cómo funcionaba antes
- cómo funciona ahora
- qué cambió
- qué pruebas deben actualizarse
No modificar inmediatamente.
Primero documentarlo.
 
Reporte final
Generar un reporte completo.
 
Resumen general
- Suites encontradas
- Suites ejecutadas
- Suites omitidas
- Motivo de cada omisión
- Total de pruebas
- Pruebas ejecutadas
- Pruebas exitosas
- Pruebas fallidas
- Pruebas omitidas
 
Rendimiento
Mostrar una tabla como esta:
 
Operación | Promedio | Máximo | Mínimo
--- | --- | --- | ---
Login | | |
Dashboard | | |
Abrir POS | | |
Cargar Productos | | |
Buscar Clientes | | |
Abrir Facturas | | |
Abrir Apartados | | |
Abrir Proformas | | |
Abrir Ruteo | | |
Abrir Órdenes de Caja | | |
Importar Factura | | |
Enderezado y Pintura | | |
 
Resultado por suite
Para cada suite indicar:
- cantidad de pruebas
- pasadas
- fallidas
- omitidas
- duración
 
Errores encontrados
Para cada error indicar:
- nombre de la prueba
- causa raíz
- evidencia
- captura (si aplica)
- si es problema del ambiente
- si es problema del sistema
- si es problema del test
- recomendación
 
Advertencias
Listar:
- módulos no disponibles
- pestañas no disponibles
- permisos insuficientes
- errores JavaScript
- errores HTTP
- lentitud
- configuraciones incorrectas
- datos faltantes
- funcionalidades deshabilitadas
 
Conclusión
Clasificar el ambiente como:
- ✅ Aprobado para QA
- ⚠️ Aprobado con observaciones
- ❌ No apto para pruebas
Justificar la decisión con evidencia.
 
Restricciones
- No utilizar waitForTimeout() salvo para diagnóstico temporal.
- Reutilizar todos los Page Objects existentes.
- Mantener la arquitectura actual del proyecto.
- No introducir lógica duplicada.
- No cambiar el diseño de la suite.
- Documentar cualquier modificación realizada y explicar por qué fue necesaria.
- Si una funcionalidad no existe en este ambiente, omitir únicamente las pruebas relacionadas y continuar ejecutando el resto de la suite hasta finalizar el proceso completo.
```
 
> ⚠️ **Nota sobre credenciales:** este prompt incluye usuario y contraseña de un ambiente de QA en texto plano. Si el repositorio es público, considera mover estas credenciales a variables de entorno o a un archivo `.env` ignorado por git, y referenciarlas en el prompt en lugar de dejarlas hardcodeadas en el README.
 
