// Frases de Zen (26-10-2026). Por derechos de autor, de los libros con derechos vigentes solo va la
// IDEA, escrita con palabras de Severa y con «inspirado en»; las citas textuales son solo de obras
// de dominio público (Marco Aurelio, Séneca, Epicteto, Proverbios), en traducción propia. Nada de
// letras de canciones (tienen derechos).

export type Phrase = { id: string; text: string; who: string; kind: 'idea' | 'cita'; topic: 'Cuerpo, mente y alma' | 'TDAH y hábitos' | 'Metas' | 'Estoicismo' | 'Fe' };

export const PHRASES: Phrase[] = [
  // Cuerpo, mente y alma (ideas inspiradas en «Deja de ser tú», de Joe Dispenza)
  { id: 'd1', kind: 'idea', topic: 'Cuerpo, mente y alma', who: 'Idea inspirada en Joe Dispenza', text: 'Si quieres una vida distinta, empieza por pensar, sentir y actuar hoy como la persona que quieres ser.' },
  { id: 'd2', kind: 'idea', topic: 'Cuerpo, mente y alma', who: 'Idea inspirada en Joe Dispenza', text: 'Muchos días se repiten porque repetimos los mismos pensamientos. Cambiar uno ya es empezar a cambiar el día.' },
  { id: 'd3', kind: 'idea', topic: 'Cuerpo, mente y alma', who: 'Idea inspirada en Joe Dispenza', text: 'Date cuenta de cuándo vas en piloto automático. Notarlo es el primer paso para elegir otra cosa.' },
  { id: 'd4', kind: 'idea', topic: 'Cuerpo, mente y alma', who: 'Idea inspirada en Joe Dispenza', text: 'Antes de que llegue lo que esperas, practica sentirte agradecido por ello: la emoción también se entrena.' },
  { id: 'd5', kind: 'idea', topic: 'Cuerpo, mente y alma', who: 'Idea inspirada en Joe Dispenza', text: 'Tu cuerpo aprende lo que tu mente repite. Repítele cosas buenas.' },
  // TDAH y hábitos (ideas de la terapia cognitivo-conductual)
  { id: 't1', kind: 'idea', topic: 'TDAH y hábitos', who: 'Idea de la terapia cognitivo-conductual', text: 'No confíes en la memoria: anótalo. Lo que está escrito ya no ocupa espacio en tu cabeza.' },
  { id: 't2', kind: 'idea', topic: 'TDAH y hábitos', who: 'Idea de la terapia cognitivo-conductual', text: 'Si una tarea te paraliza, achícala hasta que dé risa: diez minutos, un párrafo, un correo.' },
  { id: 't3', kind: 'idea', topic: 'TDAH y hábitos', who: 'Idea de la terapia cognitivo-conductual', text: 'Empezar es la parte más difícil. Comprométete solo a empezar; seguir suele venir solo.' },
  { id: 't4', kind: 'idea', topic: 'TDAH y hábitos', who: 'Idea de la terapia cognitivo-conductual', text: 'Un pensamiento no es un hecho. Pregúntate qué evidencia tienes a favor y en contra.' },
  { id: 't5', kind: 'idea', topic: 'TDAH y hábitos', who: 'Idea de la terapia cognitivo-conductual', text: 'Ata un hábito nuevo a uno que ya tienes: después del café, cinco minutos de lo que quieres instalar.' },
  { id: 't6', kind: 'idea', topic: 'TDAH y hábitos', who: 'Idea de la terapia cognitivo-conductual', text: 'Prepara el ambiente: deja a la vista lo que quieres hacer y esconde lo que te distrae.' },
  { id: 't7', kind: 'idea', topic: 'TDAH y hábitos', who: 'Idea de la terapia cognitivo-conductual', text: 'Un mal día no borra tu racha de esfuerzo. Vuelve mañana, sin castigarte.' },
  { id: 't8', kind: 'idea', topic: 'TDAH y hábitos', who: 'Idea de la terapia cognitivo-conductual', text: 'Premia el avance, no solo el resultado: cada paso chico cuenta.' },
  // Metas (ideas inspiradas en Brian Tracy y en la visualización)
  { id: 'm1', kind: 'idea', topic: 'Metas', who: 'Idea inspirada en Brian Tracy', text: 'Escribe tus metas. Lo que se escribe se vuelve claro; lo claro se puede planificar.' },
  { id: 'm2', kind: 'idea', topic: 'Metas', who: 'Idea inspirada en Brian Tracy', text: 'Haz primero la tarea que más pesa del día. El resto se vuelve más liviano.' },
  { id: 'm3', kind: 'idea', topic: 'Metas', who: 'Idea inspirada en Brian Tracy', text: 'Divide cada meta en pasos y haz al menos uno cada día, por pequeño que sea.' },
  { id: 'm4', kind: 'idea', topic: 'Metas', who: 'Idea inspirada en Brian Tracy', text: 'Ponle fecha a tu meta. Una meta sin fecha es solo un deseo.' },
  { id: 'm5', kind: 'idea', topic: 'Metas', who: 'Idea inspirada en «El secreto» (la visualización)', text: 'Imagina con detalle lo que quieres lograr y cómo te sentirás. Úsalo como motivación para dar el siguiente paso.' },
  { id: 'm6', kind: 'idea', topic: 'Metas', who: 'Idea inspirada en «El secreto» (la visualización)', text: 'Pon tu atención en lo que quieres construir, no solo en lo que temes. Donde va tu atención, va tu energía.' },
  // Estoicismo (dominio público, traducción propia)
  { id: 'e1', kind: 'idea', topic: 'Estoicismo', who: 'Idea de Marco Aurelio (Meditaciones)', text: 'Tienes poder sobre tu mente, no sobre lo que pasa afuera. Date cuenta de eso y encontrarás fuerza.' },
  { id: 'e2', kind: 'cita', topic: 'Estoicismo', who: 'Marco Aurelio, Meditaciones', text: 'Al amanecer, dite: hoy me encontraré con gente difícil; aun así, no dejaré que me aparten de lo que es correcto.' },
  { id: 'e3', kind: 'cita', topic: 'Estoicismo', who: 'Marco Aurelio, Meditaciones', text: 'Lo que estorba el camino se vuelve el camino.' },
  { id: 'e4', kind: 'idea', topic: 'Estoicismo', who: 'Idea de Marco Aurelio (Meditaciones)', text: 'Tu mente toma el color de tus pensamientos de cada día: cuídalos.' },
  { id: 'e5', kind: 'cita', topic: 'Estoicismo', who: 'Marco Aurelio, Meditaciones', text: 'No pierdas más tiempo discutiendo cómo debe ser una buena persona. Sé una.' },
  { id: 'e6', kind: 'cita', topic: 'Estoicismo', who: 'Séneca, Sobre la brevedad de la vida', text: 'No es que tengamos poco tiempo, es que perdemos mucho.' },
  { id: 'e7', kind: 'cita', topic: 'Estoicismo', who: 'Séneca, Cartas a Lucilio', text: 'Sufrimos más en la imaginación que en la realidad.' },
  { id: 'e8', kind: 'cita', topic: 'Estoicismo', who: 'Séneca, Cartas a Lucilio', text: 'Mientras se aplaza la vida, la vida pasa.' },
  { id: 'e9', kind: 'cita', topic: 'Estoicismo', who: 'Epicteto, Enquiridión', text: 'No nos perturban las cosas, sino las opiniones que tenemos sobre ellas.' },
  { id: 'e10', kind: 'cita', topic: 'Estoicismo', who: 'Epicteto, Disertaciones', text: 'Primero di qué quieres ser; después haz lo que tengas que hacer.' },
  // Fe (Reina-Valera 1909, dominio público)
  { id: 'f1', kind: 'cita', topic: 'Fe', who: 'Proverbios 16:3 (RV 1909)', text: 'Encomienda á Jehová tus obras, y tus pensamientos serán afirmados.' },
  { id: 'f2', kind: 'cita', topic: 'Fe', who: 'Filipenses 4:13 (RV 1909)', text: 'Todo lo puedo en Cristo que me fortalece.' },
  { id: 'f3', kind: 'cita', topic: 'Fe', who: 'Eclesiastés 3:1 (RV 1909)', text: 'Para todas las cosas hay sazón, y todo lo que se quiere debajo del cielo, tiene su tiempo.' },
];

/** La frase del día (cambia cada día, igual para todo el día). */
export function phraseOfDay(day: string): Phrase {
  const n = Number(day.replace(/-/g, '')) % 997;
  return PHRASES[n % PHRASES.length];
}
