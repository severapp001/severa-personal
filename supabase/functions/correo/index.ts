// Correos del banco → Severa (usuario, 28-10-2026; C58: Apps Script ahora, n8n si crece). El script
// de Google Apps Script de la persona manda aquí, con su clave, los correos de los bancos que eligió
// en Ajustes → Automatizaciones. Cada correo se lee con el lector de la app (src/core/bankMail.ts,
// copiado con `npm run bot:core`); lo que es un cargo o un abono se propone por Telegram con
// «Guardar · Cancelar», igual que el bot (el botón lo atiende la función `telegram`). Nada se guarda
// sin confirmarlo. Desde la app (con la sesión) también manda el script al chat de Telegram.
// 29-10-2026 (usuario: «que sean de movimientos y no promociones»): el script pide su búsqueda aquí
// («config»: los bancos elegidos en Ajustes, sin Promociones ni Social), así cambiar de bancos no
// obliga a pegarlo de nuevo; se anota cuándo se conectó (Ajustes lo muestra); y lo que no se pudo leer
// se avisa solo si parece un movimiento, con «No avisar más de este tipo».
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

import { buildRefs, proposalLine, readProposal, type Lesson } from '../_shared/core/assistant.ts';
import { CONV_KIND, CONV_MODULE, type ConvData } from '../_shared/core/conversations.ts';
import { bankOf, GMAIL_EXCLUDE, gmailQuery, looksLikeMove, parseBankMail, subjectKey, type BankMail } from '../_shared/core/bankMail.ts';
import { fold, parseMessage, type ToolCall } from '../_shared/core/intent.ts';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-severa-key', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
type Row = Record<string, unknown>;
type Pending = { calls: ToolCall[]; today: string; at: string };

const tg = async (method: string, body: Record<string, unknown>) => (await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
const hex = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, '0')).join('');
const nonce = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');
const chileToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const live = (table: string, space: string) => admin.from(table).select('*').eq('space_id', space).is('deleted_at', null);

async function personalSpace(account: string): Promise<string | null> {
  const { data: members } = await admin.from('space_members').select('space_id').eq('account_id', account).eq('status', 'active');
  const ids = (members ?? []).map((m: Row) => String(m.space_id));
  if (!ids.length) return null;
  const { data } = await admin.from('spaces').select('id').in('id', ids).eq('type', 'personal').limit(1);
  return data?.[0] ? String((data[0] as Row).id) : null;
}

/** Desde la app: manda el script armado al chat de Telegram de la persona, para copiarlo en el computador. */
async function sendScript(req: Request) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  if (!auth.user) return json({ error: 'Inicia sesión en Severa.' }, 401);
  const body = (await req.json().catch(() => ({}))) as { script?: unknown };
  const script = typeof body.script === 'string' ? body.script.slice(0, 3800) : '';
  if (!script) return json({ error: 'Falta el script.' }, 400);
  const { data: link } = await admin.from('telegram_links').select('chat_id').eq('account_id', auth.user.id).maybeSingle();
  if (!link) return json({ error: 'Primero conecta Telegram en Ajustes.' }, 409);
  const esc = script.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  await tg('sendMessage', {
    chat_id: (link as Row).chat_id,
    text: '🔐 Tu script de Severa para Google Apps Script. Ábrelo en el computador (script.google.com), pégalo en un proyecto nuevo, guarda y ejecuta «instalar». No lo compartas: lleva tu clave.',
  });
  const sent = await tg('sendMessage', { chat_id: (link as Row).chat_id, text: `<pre>${esc}</pre>`, parse_mode: 'HTML' });
  return sent.ok ? json({ ok: true }) : json({ error: 'Telegram no aceptó el mensaje.' }, 502);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Usa POST.' }, 405);
  const key = req.headers.get('x-severa-key');
  if (!key) return sendScript(req);

  // ¿De quién es la clave? Solo se guarda su hash.
  const { data: owner } = await admin
    .from('automation_keys')
    .select('account_id')
    .eq('key_hash', await hex(key))
    .maybeSingle();
  if (!owner) return json({ error: 'Clave inválida: genera un script nuevo en Ajustes → Automatizaciones.' }, 401);
  const account = String((owner as Row).account_id);
  await admin.from('automation_keys').update({ last_seen_at: new Date().toISOString() }).eq('account_id', account);
  const body = (await req.json().catch(() => ({}))) as { messages?: unknown; accion?: unknown };

  // El script pregunta qué buscar: los bancos elegidos en Ajustes → Automatizaciones.
  if (body.accion === 'config') {
    const sp = await personalSpace(account);
    const { data: pref } = sp ? await live('module_entries', sp).eq('module', 'severa').eq('kind', 'ajuste').eq('title', 'automatizaciones').maybeSingle() : { data: null };
    let banks: string[] = [];
    try {
      const d = JSON.parse(String((pref as Row | null)?.data ?? '{}')) as { bancos?: unknown };
      banks = Array.isArray(d.bancos) ? d.bancos.map(String) : [];
    } catch {
      banks = [];
    }
    const q = gmailQuery(banks);
    return json({ query: q ? `${q} ${GMAIL_EXCLUDE}` : '' });
  }

  const { data: link } = await admin.from('telegram_links').select('account_id, chat_id, state').eq('account_id', account).maybeSingle();
  // Sin Telegram no hay dónde confirmar: el script no marca los correos y los vuelve a mandar después.
  if (!link || !TOKEN) return json({ error: 'Conecta Telegram en Ajustes para confirmar los movimientos.' }, 409);
  const space = await personalSpace(account);
  if (!space) return json({ error: 'Sin espacio personal.' }, 409);

  const messages = (Array.isArray(body.messages) ? body.messages : []).slice(0, 30) as (BankMail & { id?: string })[];
  if (messages.length) await admin.from('automation_keys').update({ last_mail_at: new Date().toISOString() }).eq('account_id', account);
  const [cats, accounts, lessons, ignored] = await Promise.all([
    admin.from('fin_categories').select('*').or(`space_id.eq.${space},space_id.is.null`).is('deleted_at', null),
    live('fin_accounts', space),
    live('assistant_lessons', space).eq('active', true),
    live('module_entries', space).eq('module', 'correo').eq('kind', 'ignorar'),
  ]);
  const ignore = new Set(((ignored.data ?? []) as Row[]).map((r) => String(r.title)));
  const accountRows = ((accounts.data ?? []) as Row[]).filter((a) => !a.archived);
  const refs = buildRefs({
    categories: ((cats.data ?? []) as Row[]).map((c) => ({ id: String(c.id), name: String(c.name), kind: c.kind as 'expense' | 'income', for_work: c.for_work as boolean })),
    accounts: accountRows.map((a) => ({ id: String(a.id), name: String(a.name), kind: String(a.kind) })),
    habits: [],
  });
  const lessonList = ((lessons.data ?? []) as Row[]).map((l) => ({ kind: l.kind as Lesson['kind'], phrase: String(l.phrase), meaning: String(l.meaning) }));
  const today = chileToday();
  const chat = Number((link as Row).chat_id);
  let state = ((link as Row).state ?? {}) as { pending?: Record<string, Pending>; avisos?: Record<string, { clave: string; at: string }> } & Record<string, unknown>;
  let proposed = 0;
  // Cada aviso queda también en «Lo que conversamos» de la app (Z3, 29-10-2026).
  const logConv = (title: string, data: ConvData) =>
    admin.from('module_entries').insert({ space_id: space, created_by: account, module: CONV_MODULE, kind: CONV_KIND, title: title.slice(0, 200), day: today, data: JSON.stringify({ ...data, at: new Date().toISOString() }), done: false });

  for (const m of messages) {
    if (!m || typeof m.body !== 'string' || typeof m.from !== 'string') continue;
    const id = String(m.id ?? `${m.from}|${m.date}|${m.subject}`).slice(0, 190);
    // Cada correo se lee una sola vez.
    const { data: seen } = await live('module_entries', space).eq('module', 'correo').eq('kind', 'leido').eq('title', id).maybeSingle();
    if (seen) continue;
    const subject = String(m.subject ?? '');
    const move = parseBankMail({ from: m.from, subject, body: m.body.slice(0, 6000), date: String(m.date ?? new Date().toISOString()) });
    const bank = bankOf(m.from);
    await admin
      .from('module_entries')
      .insert({ space_id: space, created_by: account, module: 'correo', kind: 'leido', title: id, day: today, data: JSON.stringify({ de: bank?.code ?? null, asunto: subject.slice(0, 100), movimiento: !!move }), done: false });
    if (!move) {
      // Solo si parece un movimiento (y no es de un tipo que pediste no avisar), se avisa para
      // anotarlo a mano y mejorar el lector. Las promociones y los avisos de otro tipo, en silencio.
      const clave = `${bank?.code ?? 'otro'}|${subjectKey(subject)}`;
      if (bank && looksLikeMove({ subject, body: m.body }) && !ignore.has(clave)) {
        const n = nonce();
        const avisos = Object.entries(state.avisos ?? {})
          .sort(([, x], [, y]) => y.at.localeCompare(x.at))
          .slice(0, 9);
        state = { ...state, avisos: { ...Object.fromEntries(avisos), [n]: { clave, at: new Date().toISOString() } } };
        await admin.from('telegram_links').update({ state, updated_at: new Date().toISOString() }).eq('account_id', account);
        await tg('sendMessage', {
          chat_id: chat,
          text: `📩 Llegó un correo de ${bank.name} que parece un movimiento y no supe leer: «${subject.slice(0, 80)}». Si lo era, anótalo aquí con tus palabras («gasté 5 lucas en…»).`,
          reply_markup: { inline_keyboard: [[{ text: '🔕 No avisar más de este tipo', callback_data: `ig:${n}` }]] },
        });
        await logConv(`📩 ${bank.name}: ${subject}`, { canal: 'correo', estado: 'no_entendido', id: n });
      }
      continue;
    }
    // El mismo intérprete del bot elige la categoría (y usa tus reglas, como «la Copec es bencina»).
    const phrase = move.kind === 'income' ? `me pagaron ${move.amount}${move.merchant ? ` de ${move.merchant}` : ''}` : `gasté ${move.amount}${move.merchant ? ` en ${move.merchant}` : ''}`;
    const found = parseMessage(phrase, { today, refs, lessons: lessonList }, { movements: [], agenda: [], habits: [], paydayDays: null }).calls.find((c) => c.name === 'registrar_movimiento');
    const bankAccount = Object.entries(refs).find(([, r]) => r.kind === 'account' && fold(r.name).includes(fold(move.bank).split(' ')[0]))?.[0] ?? null;
    const call: ToolCall = {
      name: 'registrar_movimiento',
      input: { ...(found?.input ?? {}), tipo: move.kind === 'income' ? 'ingreso' : 'gasto', monto: move.amount, fecha: move.date, cuenta: bankAccount ?? found?.input.cuenta ?? null, descripcion: move.merchant ?? move.bank },
    };
    const p = readProposal(call.name, call.input, refs, today);
    if (!p) continue;
    const n = nonce();
    const kept = Object.entries(state.pending ?? {})
      .filter(([, v]) => !!v && Array.isArray(v.calls) && typeof v.at === 'string')
      .sort(([, x], [, y]) => y.at.localeCompare(x.at))
      .slice(0, 9);
    state = { ...state, pending: { ...Object.fromEntries(kept), [n]: { calls: [call], today, at: new Date().toISOString() } } };
    await admin.from('telegram_links').update({ state, updated_at: new Date().toISOString() }).eq('account_id', account);
    await tg('sendMessage', {
      chat_id: chat,
      text: `💳 ${move.bank}${move.card ? ` · tarjeta ···${move.card}` : ''}\n${proposalLine(p, refs)}\n¿Lo guardo?`,
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Guardar', callback_data: `ok:${n}` },
            { text: '✖️ Cancelar', callback_data: `no:${n}` },
          ],
        ],
      },
    });
    await logConv(`💳 ${move.bank}${move.card ? ` · ···${move.card}` : ''}: ${subject}`, { canal: 'correo', estado: 'propuesto', id: n, lineas: [proposalLine(p, refs)] });
    proposed++;
  }
  return json({ ok: true, propuestos: proposed });
});
