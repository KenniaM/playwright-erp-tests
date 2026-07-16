import { SubmoduloReportes } from './reportes.page';

export const SUBMODULOS_REPORTES_GASTOS_OPERATIVOS: SubmoduloReportes[] = [
  {
    // Sin `.content-header` en esta pantalla (confirmado en vivo) — se valida
    // con el botón real de búsqueda, que sí es visible. (`#code_expense`
    // existe en el DOM pero queda oculto dentro de un panel colapsado,
    // confirmado en vivo.)
    nombre: 'Gastos Operativos',
    url: 'https://dev.designsoftcr.com/qa_talleralpha/public/family_expenses/familyExpenses',
    rutaEsperada: 'familyExpenses',
    tituloEsperado: /gastos operativos/i,
    obtenerLocatorDeCarga: (page) => page.locator('#btn_search'),
  },
];
