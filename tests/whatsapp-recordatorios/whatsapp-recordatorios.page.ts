import { Locator, Page } from '@playwright/test';
import { BASE_URL } from '../env.config';

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const TIMEOUTS = {
  TEST:     60_000,
  NAVIGATE: 60_000,
  CARGA:    15_000,
} as const;

// ─── Submódulos ───────────────────────────────────────────────────────────────

/**
 * Los 4 submódulos del menú "WhatsApp Recordatorios" (URLs y contenido
 * confirmados en vivo desde el menú lateral del dashboard). Módulo visible
 * en el Sidebar pero sin ninguna prueba de navegación previa — se agrega
 * siguiendo el patrón 1 "tabla de submódulos" documentado en CLAUDE.md.
 *
 * Investigación en vivo relevante: las 4 pantallas comparten el mismo
 * `<title>` ("WhatsApp Business | Sistema Web ERP") y NO usan `.content-header`
 * (arquitectura de UI distinta al resto del ERP, sin breadcrumb clásico) —
 * la validación real de "cargó el submódulo correcto" recae en el `id` único
 * de la sección visible de cada tab (`#wb_section_<tab>`, confirmado en vivo
 * vía dump del DOM real), no en el título de documento ni en un
 * `.content-header` inexistente.
 *
 * Un primer intento de investigación usando un locator genérico sin timeout
 * acotado (`.content-header`, que no existe en esta pantalla) quedó
 * esperando indefinidamente hasta el timeout completo del test (~90s) — este
 * proyecto no configura `actionTimeout` global, así que una acción contra un
 * elemento inexistente sin `timeout` propio no fallaba rápido. No es un
 * cuelgue real de la aplicación: con un locator real y acotado, las 5
 * pantallas de este hallazgo (las 4 de aquí + "Personaliza tus Módulos")
 * cargan en menos de 10s cada una.
 */
export type SubmoduloWhatsapp = {
  nombre: string;
  url: string;
  rutaEsperada: string;
  tituloEsperado: RegExp;
  obtenerLocatorDeCarga: (page: Page) => Locator;
};

export const SUBMODULOS_WHATSAPP: SubmoduloWhatsapp[] = [
  {
    nombre: 'Configuracion Meta',
    url: BASE_URL + '/whatsappBusiness/meta',
    rutaEsperada: 'whatsappBusiness/meta',
    tituloEsperado: /whatsapp business/i,
    obtenerLocatorDeCarga: (page) => page.locator('#wb_section_meta'),
  },
  {
    nombre: 'Plantillas aprobadas',
    url: BASE_URL + '/whatsappBusiness/templates',
    rutaEsperada: 'whatsappBusiness/templates',
    tituloEsperado: /whatsapp business/i,
    obtenerLocatorDeCarga: (page) => page.locator('#wb_section_templates'),
  },
  {
    nombre: 'Recordatorios',
    url: BASE_URL + '/whatsappBusiness/reminders',
    rutaEsperada: 'whatsappBusiness/reminders',
    tituloEsperado: /whatsapp business/i,
    obtenerLocatorDeCarga: (page) => page.locator('#wb_section_reminders'),
  },
  {
    nombre: 'General de recordatorios',
    url: BASE_URL + '/whatsappBusiness/recipients',
    rutaEsperada: 'whatsappBusiness/recipients',
    tituloEsperado: /whatsapp business/i,
    obtenerLocatorDeCarga: (page) => page.locator('#wb_section_recipients'),
  },
];

// ─── Page Object ──────────────────────────────────────────────────────────────

export class WhatsappRecordatoriosPage {
  constructor(private readonly page: Page) {}

  /** Único punto de entrada a cualquier submódulo de WhatsApp Recordatorios. */
  async irA(url: string) {
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATE });
  }
}
