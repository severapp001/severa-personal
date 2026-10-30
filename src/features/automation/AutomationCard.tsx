import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { BANKS } from '@/core/bankMail';
import { dayKey } from '@/core/today';
import { supabase } from '@/data/supabase';
import { usePref } from '@/features/space/usePref';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Notice } from '@/ui';
import { tap } from '@/ui/haptics';
import { scriptFor } from './script';

// Automatizaciones (usuario, 28/29-10-2026: «que se tenga acceso al correo y así se obtenga la
// información del banco… y se envíe al chatbot»; «que el usuario seleccione los bancos y así el
// script sepa qué bancos utiliza»). Se eligen los bancos y Severa arma el script de Google Apps
// Script, con una clave propia, para pegarlo una vez en la cuenta de Google. Cada movimiento llega
// por Telegram para confirmarlo.

export function AutomationCard() {
  const { colors } = useTheme();
  const [pref, save] = usePref('automatizaciones', { bancos: [] as string[] });
  const [script, setScript] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const chosen = pref.bancos;
  // Si el script está vivo: cuándo se conectó por última vez y cuándo mandó correos (29-10-2026).
  const [status, setStatus] = useState<{ seen: string | null; mail: string | null } | null | 'none'>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    supabase.rpc('automation_status').then(({ data }) => {
      if (!alive) return;
      const row = Array.isArray(data) ? (data[0] as { last_seen_at: string | null; last_mail_at: string | null } | undefined) : undefined;
      setStatus(row ? { seen: row.last_seen_at, mail: row.last_mail_at } : 'none');
    });
    return () => {
      alive = false;
    };
  }, [tick]);

  async function build() {
    tap();
    setBusy(true);
    setNote(null);
    try {
      const { data, error } = await supabase.rpc('automation_key');
      if (error || !data) throw new Error('No se pudo crear tu clave. Revisa tu conexión.');
      setScript(scriptFor(String(data), dayKey(new Date())));
    } catch (e) {
      setNote({ tone: 'bad', text: e instanceof Error ? e.message : 'No se pudo armar el script.' });
    } finally {
      setBusy(false);
    }
  }

  async function toTelegram() {
    if (!script) return;
    tap();
    setBusy(true);
    const { error } = await supabase.functions.invoke('correo', { body: { script } });
    setBusy(false);
    if (error) {
      const body = (await (error as { context?: Response }).context?.json?.().catch(() => null)) as { error?: string } | null;
      setNote({ tone: 'bad', text: body?.error ?? 'No se pudo mandar a Telegram.' });
    } else setNote({ tone: 'ok', text: 'Listo: te llegó a Telegram. Ábrelo en el computador y pégalo en script.google.com.' });
  }

  async function copy() {
    if (!script) return;
    tap();
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(script);
      setNote({ tone: 'ok', text: 'Copiado. Pégalo en script.google.com → Proyecto nuevo.' });
    } else {
      await Share.share({ message: script });
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <AppText variant="subtitle">Automatizaciones</AppText>
      <AppText variant="caption" muted>
        Los correos de tu banco llegan a Severa y te pregunta por Telegram si guarda cada compra o abono. Severa nunca recibe tu contraseña del correo ni del banco, y nada se guarda sin que lo confirmes.
      </AppText>
      {status && status !== 'none' ? <StatusLine seen={status.seen} mail={status.mail} onRefresh={() => setTick((t) => t + 1)} /> : null}
      <AppText variant="label">Tus bancos</AppText>
      <View style={styles.chips}>
        {BANKS.map((b) => {
          const on = chosen.includes(b.code);
          return (
            <Pressable
              key={b.code}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => {
                tap();
                setScript(null);
                save({ bancos: on ? chosen.filter((c) => c !== b.code) : [...chosen, b.code] });
              }}
              style={[styles.chip, { backgroundColor: on ? colors.accent : colors.surface2 }]}
            >
              <AppText variant="label" style={{ fontSize: 13 }} color={on ? colors.onAccent : colors.text}>
                {b.name}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {chosen.length ? <Button label={script ? 'Armar otro script (el anterior deja de funcionar)' : 'Armar mi script'} kind={script ? 'link' : 'primary'} loading={busy} onPress={build} /> : null}
      {script ? (
        <>
          <AppText variant="label">Instálalo una vez, en el computador</AppText>
          {['Mándatelo a Telegram (o cópialo) y ábrelo en el computador.', 'Entra a script.google.com → «Proyecto nuevo» y pega el script.', 'Guarda, elige «instalar» arriba y toca «Ejecutar». Acepta el permiso de Google.', 'Listo: cada 10 minutos revisa tus correos del banco y te escribe por Telegram.'].map((s, i) => (
            <AppText key={s} variant="caption">{`${i + 1}. ${s}`}</AppText>
          ))}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button label="Mandar a mi Telegram" loading={busy} onPress={toTelegram} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={Platform.OS === 'web' ? 'Copiar' : 'Compartir'} kind="secondary" onPress={copy} />
            </View>
          </View>
          <ScrollView style={[styles.code, { backgroundColor: colors.surface2 }]} nestedScrollEnabled>
            <AppText selectable style={styles.mono}>
              {script}
            </AppText>
          </ScrollView>
          <AppText variant="caption" muted>
            Necesita Telegram conectado (arriba). No compartas el script: lleva tu clave.
          </AppText>
        </>
      ) : null}
      {note ? <Notice tone={note.tone} text={note.text} /> : null}
    </View>
  );
}

const ago = (iso: string) => {
  const min = Math.max(0, Math.round((Date.parse(new Date().toISOString()) - Date.parse(iso)) / 60000));
  return min < 1 ? 'recién' : min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} días`;
};

/** «Funcionando · revisó tus correos hace 6 min», o un aviso si el script dejó de conectarse. */
function StatusLine({ seen, mail, onRefresh }: { seen: string | null; mail: string | null; onRefresh: () => void }) {
  const { colors } = useTheme();
  const fresh = !!seen && Date.parse(new Date().toISOString()) - Date.parse(seen) < 30 * 60000;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Actualizar el estado" onPress={onRefresh} style={[styles.status, { backgroundColor: fresh ? colors.okSoft : colors.midSoft }]}>
      <AppText variant="label" color={fresh ? colors.ok : colors.mid}>
        {seen ? (fresh ? `● Funcionando · revisó tus correos ${ago(seen)}` : `Sin noticias del script desde ${ago(seen)}: revisa que siga instalado`) : 'El script todavía no se conecta: instálalo en el computador'}
      </AppText>
      {mail ? (
        <AppText variant="caption" muted>
          {`Último correo del banco recibido: ${ago(mail)}. Toca para actualizar.`}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  status: { borderRadius: 14, padding: 12, gap: 2 },
  card: { borderRadius: 22, padding: 16, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  code: { maxHeight: 200, borderRadius: 12, padding: 10 },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 11, lineHeight: 15 },
});
