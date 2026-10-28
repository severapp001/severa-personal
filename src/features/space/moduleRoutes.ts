import type { Href } from 'expo-router';

import { MODULES } from '@/features/modules/catalog';

// Dónde se abre cada neurona. 18-10-2026: Finanzas, Estudios, Familia, CV y Hábitos. 25-10-2026:
// Calendario, Prioridades, Diario y Gratitud y la Biblia. 26-10-2026 (revisión del usuario: «los
// módulos aún no sirven»): todas las demás, con el motor común (`/modulo/[code]`) o su pantalla.
const OWN: Record<string, Href> = {
  finanzas: '/finanzas',
  estudios: '/estudios',
  familia_y_mascotas: '/familia',
  cv: '/cv',
  habitos: '/habitos',
  calendario: '/calendario',
  prioridades: '/prioridades',
  diario: '/diario',
  gratitud: { pathname: '/diario', params: { tab: 'gratitud' } },
  biblia: '/biblia',
  perfil_personal: '/perfil',
  cuerpo_mente_alma: '/cuerpo-mente-alma',
  metas: '/metas',
  respiracion: '/respiracion',
  meditacion: '/meditacion',
  zen: '/zen',
  // Terapia vive dentro de Salud mental desde el 27-10-2026 (pedido del usuario).
  salud_mental: '/salud-mental',
  terapia: { pathname: '/salud-mental', params: { tab: 'terapia' } },
  resumen: '/resumen',
  logros: '/logros',
  juegos: '/juegos',
  trabajo: '/trabajo',
  jornada: '/trabajo',
  recorridos: '/trabajo',
  agenda_y_citas: '/calendario',
  gastos_del_trabajo: { pathname: '/finanzas', params: { nuevo: 'expense' } },
  habitos_rapidos_en_trabajo: '/habitos',
};

/** La pantalla de un módulo del motor común. */
export const moduleHref = (code: string, nuevo?: string): Href => ({ pathname: '/modulo/[code]', params: nuevo ? { code, nuevo } : { code } });

export const MODULE_ROUTES: Record<string, Href> = {
  ...Object.fromEntries(Object.keys(MODULES).map((code) => [code, moduleHref(code)])),
  ...OWN,
};
