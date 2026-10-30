// Copiado de src/core/bankMail.ts por scripts/bot-core.js. No editar aquí.
// Correos del banco → Finanzas (usuario, 28-10-2026: «tener acceso al correo y así obtener la
// información del banco, que se envíe al chatbot y este la suba a Severa»). Un script de Google
// Apps Script en la cuenta de la persona manda a Severa los correos de sus bancos; aquí se lee cada
// uno: qué banco, si es cargo o abono, el monto, el comercio y la tarjeta (solo los 4 últimos
// dígitos). Las promociones se descartan. Nada se guarda sin confirmarlo por Telegram.
// Los formatos cambian por banco: se lee lo común (montos «$12.990», «en COMERCIO», «terminada en
// 1234») y lo que no se entiende se avisa, para mejorar con ejemplos reales.

import { fold } from './intent.ts';

export type Bank = { code: string; name: string; senders: string[] };

/** Los bancos y billeteras de Chile que Severa reconoce, con las direcciones desde donde escriben. */
export const BANKS: Bank[] = [
  { code: 'bancoestado', name: 'BancoEstado', senders: ['bancoestado.cl'] },
  { code: 'santander', name: 'Santander', senders: ['santander.cl'] },
  { code: 'bci', name: 'BCI', senders: ['bci.cl'] },
  { code: 'mach', name: 'MACH', senders: ['somosmach.com', 'mach.cl'] },
  { code: 'coopeuch', name: 'Coopeuch', senders: ['coopeuch.cl'] },
  { code: 'lider', name: 'Tarjeta Líder', senders: ['liderbci.cl', 'tarjetalider.cl', 'lider.cl'] },
  { code: 'bancochile', name: 'Banco de Chile', senders: ['bancochile.cl', 'bancoedwards.cl'] },
  { code: 'scotiabank', name: 'Scotiabank', senders: ['scotiabank.cl'] },
  { code: 'itau', name: 'Itaú', senders: ['itau.cl'] },
  { code: 'falabella', name: 'Banco Falabella', senders: ['bancofalabella.cl', 'cmr.cl'] },
  { code: 'ripley', name: 'Banco Ripley', senders: ['bancoripley.cl'] },
  { code: 'mercadopago', name: 'Mercado Pago', senders: ['mercadopago.com', 'mercadopago.cl'] },
  { code: 'tenpo', name: 'Tenpo', senders: ['tenpo.cl'] },
];

export type BankMail = { from: string; subject: string; body: string; date: string };
export type BankMove = { bank: string; kind: 'expense' | 'income'; amount: number; merchant: string | null; card: string | null; date: string };

/** El banco de un remitente («Notificaciones <avisos@bci.cl>» → BCI), o null. */
export function bankOf(from: string, banks: Bank[] = BANKS): Bank | null {
  const f = from.toLowerCase();
  return banks.find((b) => b.senders.some((s) => f.includes(`@${s}`) || f.includes(`.${s}`))) ?? null;
}

const PROMO = /\b(oferta|ofertas|promocion|promo|descuento|descuentos|cyber|black friday|sorteo|concurso|cuotas sin interes|invitacion|beneficio|beneficios|aprovecha|exclusivo|catalogo|newsletter)\b/;
const MOVE = /\b(compra|cargo|pago|pagaste|giro|transferencia|transferiste|abono|deposito|avance|transaccion|movimiento|recibiste|te transfirieron|compraste)\b/;
const INCOME = /\b(abono|abonaron|deposito|transferencia recibida|te transfirieron|recibiste|has recibido|ingreso de fondos)\b/;

/** «$12.990», «$ 1.250.000», «CLP 8.500», «monto: 12990» → pesos. */
function amountIn(t: string): number | null {
  const m = /\$\s?(\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?/.exec(t) ?? /\b(?:clp|monto|valor|total)\s*:?\s*\$?\s?(\d{1,3}(?:\.\d{3})+|\d+)/.exec(t);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, ''));
  return n > 0 && n < 100_000_000 ? n : null;
}

/** El comercio, con sus mayúsculas: «en LIDER EXPRESS», «Comercio: SHELL», «a Juan Pérez». */
function merchantIn(text: string, income: boolean): string | null {
  const m =
    /(?:comercio|establecimiento|destinatario|origen)\s*:?\s+([^\n,;]{2,40})/i.exec(text) ??
    (income ? /\b(?:de|desde)\s+([A-ZÁÉÍÓÚÑ][^\n,;]{2,40}?)(?=\s+(?:por|el|con|a las|en tu)\b|[.,;\n]|$)/.exec(text) : null) ??
    /\ben\s+([A-ZÁÉÍÓÚÑ0-9][^\n,;]{2,40}?)(?=\s+(?:por|el|con|a las|del)\b|[.,;\n]|$)/.exec(text);
  const name = m?.[1].replace(/\s+/g, ' ').trim();
  return name && !/^\d+$/.test(name) ? name.slice(0, 40) : null;
}

/** La fecha en Chile («AAAA-MM-DD») de la fecha del correo. */
export function chileDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Lee un correo del banco. Null si no es de un banco conocido, es una promoción o no trae monto. */
export function parseBankMail(mail: BankMail, banks: Bank[] = BANKS): BankMove | null {
  const bank = bankOf(mail.from, banks);
  if (!bank) return null;
  const text = `${mail.subject}\n${mail.body}`;
  const t = fold(text);
  if (!MOVE.test(t) || (PROMO.test(t) && !/\b(compra|cargo|abono|transferencia)\s+(?:por|de)\b/.test(t))) return null;
  const amount = amountIn(t);
  if (!amount) return null;
  const income = INCOME.test(t);
  const card = /(?:terminad[ao]|finalizad[ao]|que termina)\s+en\s+(\d{4})|(?:\*{2,}|x{3,}|·{2,})\s?(\d{4})/i.exec(text);
  return { bank: bank.name, kind: income ? 'income' : 'expense', amount, merchant: merchantIn(text, income), card: card ? (card[1] ?? card[2]) : null, date: chileDay(mail.date) };
}

/** La consulta de Gmail para los bancos elegidos (la usa el script). */
export function gmailQuery(codes: string[], banks: Bank[] = BANKS): string {
  const senders = banks.filter((b) => codes.includes(b.code)).flatMap((b) => b.senders);
  return senders.length ? `(${senders.map((s) => `from:${s}`).join(' OR ')})` : '';
}

/** Lo que se deja fuera de la búsqueda de Gmail: las pestañas Promociones, Social y Foros (29-10-2026,
 *  usuario: «que sean de movimientos y no promociones»). */
export const GMAIL_EXCLUDE = '-category:promotions -category:social -category:forums';

/** ¿Parece un aviso de movimiento que no se pudo leer? Solo entonces se avisa por Telegram. */
export function looksLikeMove(mail: Pick<BankMail, 'subject' | 'body'>): boolean {
  const t = fold(`${mail.subject}\n${mail.body.slice(0, 1500)}`);
  if (PROMO.test(t)) return false;
  return /\b(compra|cargo|abono|transferencia|giro|pago|avance)\b.{0,40}\b(por|de|realizad[ao]|exitos[ao]|recibid[ao]|aprobad[ao]|enviad[ao])\b|\b(comprobante|aviso de (compra|cargo|abono)|notificacion de (compra|transferencia))\b/.test(t);
}

/** La «forma» de un asunto, sin números ni montos, para reconocer correos del mismo tipo. */
export const subjectKey = (subject: string) => fold(subject).replace(/[\d$.,:#*-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
