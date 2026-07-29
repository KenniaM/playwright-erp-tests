// Configuración de ambiente compartida por TODO el proyecto (no solo POS):
// hasta ahora cada `<modulo>.page.ts` (y auth.setup.ts) hardcodeaba
// literalmente 'https://dev.designsoftcr.com/qa_talleralpha/public' en cada
// URL — bloqueando correr la misma suite contra otro ambiente/instancia
// (p. ej. https://dev.designsoftcr.com/qa_restaurant/public) sin editar
// decenas de archivos. BASE_URL centraliza ese único valor, configurable vía
// la variable de entorno BASE_URL, con el valor real ya usado por el
// ambiente original como default — no cambia ningún comportamiento existente
// cuando la variable no se define.
//
// No reemplaza POS_COMPANIA (tests/facturar/pos/pos.types.ts) — ese sigue siendo el
// nombre visible de la compañía a seleccionar cuando el modal de selección
// de compañía aparece (cuentas con más de una compañía). BASE_URL resuelve
// la instancia/ambiente; POS_COMPANIA resuelve la compañía dentro de esa
// instancia.
export const BASE_URL = process.env.BASE_URL ?? 'https://dev.designsoftcr.com/qa_talleralpha/public';
