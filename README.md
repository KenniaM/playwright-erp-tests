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
