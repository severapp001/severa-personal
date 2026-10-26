import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ageOn } from '@/core/age';
import { GOALS, INTERESTS } from '@/core/discovery';
import { dayKey } from '@/core/today';
import { useAuth } from '@/data/auth';
import { useRows } from '@/data/live';
import { updateRecord } from '@/data/records';
import { supabase } from '@/data/supabase';
import { useMoodColor } from '@/features/journal/useMoodColor';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useLifeStats } from '@/features/stats/useLifeStats';
import { useToday } from '@/features/today/useToday';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Notice, Screen } from '@/ui';
import { DateField, Field, Kicker, Panel, Segmented, Sheet } from '@/ui/kit';

// Perfil personal (P11, 26-10-2026; usuario: «debería mostrar un perfil real: rachas, calendario
// anual, un tracker»). Tus datos básicos, para qué usas Severa, tus rachas y tu año en cuadros.

const MONTHS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function PerfilScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const t = useToday();
  const today = dayKey(new Date());
  const s = useLifeStats(today);
  const moodColor = useMoodColor();
  const [view, setView] = useState<'activity' | 'mood'>('activity');
  const [editing, setEditing] = useState(false);
  const { data } = useRows<{ id: string; name: string; birth_date: string | null }>(
    "SELECT id, name, birth_date FROM people WHERE account_id = ? AND type = 'self'",
    [session?.user.id ?? ''],
    () => supabase.from('people').select('id, name, birth_date').eq('account_id', session?.user.id ?? '').eq('type', 'self'),
    `self-edit:${session?.user.id}`,
  );
  const me = data[0];
  const age = me?.birth_date ? ageOn(new Date(`${String(me.birth_date).slice(0, 10)}T12:00:00`)) : null;
  const year = Number(today.slice(0, 4));
  const goals = GOALS.filter((g) => t.onboarding?.goals.includes(g.code)).map((g) => g.name);
  const interests = INTERESTS.filter((i) => t.onboarding?.interests.includes(i.code)).map((i) => i.name);
  const max = Math.max(1, ...s.activity.values());

  const cell = (m: number, d: number) => {
    const date = new Date(year, m, d);
    if (date.getMonth() !== m) return 'transparent';
    const key = dayKey(date);
    if (key > today) return colors.surface2;
    if (view === 'mood') return s.moodByDay.has(key) ? moodColor(s.moodByDay.get(key)) : colors.surface2;
    const n = s.activity.get(key) ?? 0;
    if (!n) return colors.surface2;
    const level = Math.min(4, Math.ceil((n / max) * 4));
    return [colors.surface2, colors.accent2Soft, colors.accent2 + '88', colors.accent2 + 'CC', colors.accent2][level];
  };

  const streaks = [
    { label: 'Hábitos', n: s.habitStreak, unit: 'días' },
    { label: 'Diario', n: s.journalStreak, unit: 'días' },
    { label: 'Biblia', n: s.bibleStreak, unit: 'días' },
    { label: 'Ejercicio', n: s.exercise.total, unit: 'min/sem' },
  ];
  const numbers = [
    ['Días con algo registrado', s.activity.size],
    ['Días con hábitos cumplidos', s.habitDays.size],
    ['Días en el Diario', s.journal.days.length],
    ['Cosas agradecidas', s.journal.gratitude.length],
    ['Movimientos de plata', s.finance.movements.length],
    ['Sesiones de ejercicio', s.entries.of('sesion').length],
  ] as const;

  return (
    <Screen>
      <ModuleHeader kicker="Personal" title="Perfil" />
      <Panel>
        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
            <AppText style={{ fontFamily: fonts.extrabold, fontSize: 26 }} color={colors.accent}>
              {(me?.name ?? t.name ?? '?').slice(0, 1).toUpperCase()}
            </AppText>
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="title">{me?.name ?? t.name ?? 'Tú'}</AppText>
            <AppText variant="caption" muted>
              {[age !== null ? `${age} años` : 'Sin fecha de nacimiento', t.trade?.name].filter(Boolean).join(' · ')}
            </AppText>
          </View>
          <AppText variant="label" color={colors.accent} onPress={() => setEditing(true)}>
            Editar
          </AppText>
        </View>
        {goals.length ? <AppText variant="caption" muted>{`Usas Severa para: ${goals.join(', ').toLowerCase()}.`}</AppText> : null}
        {interests.length ? <AppText variant="caption" muted>{`Te gusta: ${interests.join(', ').toLowerCase()}.`}</AppText> : null}
      </Panel>

      <View style={styles.streaks}>
        {streaks.map((x) => (
          <View key={x.label} style={[styles.streak, { backgroundColor: colors.surface }]}>
            <AppText style={{ fontFamily: fonts.extrabold, fontSize: 26, fontVariant: ['tabular-nums'] }} color={x.n ? colors.accent : colors.muted}>
              {`${x.n ? '🔥' : ''}${x.n}`}
            </AppText>
            <AppText variant="caption" muted style={{ fontSize: 11 }}>
              {`${x.label} · ${x.unit}`}
            </AppText>
          </View>
        ))}
      </View>

      <Panel>
        <Kicker>{`Tu ${year}`}</Kicker>
        <Segmented
          options={[
            { value: 'activity', label: 'Actividad' },
            { value: 'mood', label: 'Ánimo' },
          ]}
          value={view}
          onChange={setView}
        />
        <View style={styles.year}>
          {MONTHS.map((m, mi) => (
            <View key={mi} style={styles.month}>
              <AppText variant="caption" muted style={{ fontSize: 10, textAlign: 'center' }}>
                {m}
              </AppText>
              {Array.from({ length: 31 }, (_, d) => (
                <View key={d} style={[styles.px, { backgroundColor: cell(mi, d + 1) }]} />
              ))}
            </View>
          ))}
        </View>
        <AppText variant="caption" muted>
          {view === 'activity' ? 'Cada cuadro es un día: más intenso, más cosas registradas (hábitos, diario, plata y módulos).' : 'Cada cuadro es un día con el color de tu ánimo en el Diario.'}
        </AppText>
      </Panel>

      <Panel>
        <Kicker>Tus números</Kicker>
        {numbers.map(([label, n]) => (
          <View key={label} style={styles.line}>
            <AppText style={{ flex: 1, fontSize: 15 }}>{label}</AppText>
            <AppText variant="label" style={{ fontVariant: ['tabular-nums'] }}>
              {String(n)}
            </AppText>
          </View>
        ))}
      </Panel>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label="Logros" kind="secondary" onPress={() => router.push('/logros')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Resumen" kind="secondary" onPress={() => router.push('/resumen')} />
        </View>
      </View>
      <EditSheet visible={editing} me={me} onClose={() => setEditing(false)} />
    </Screen>
  );
}

function EditSheet({ visible, me, onClose }: { visible: boolean; me: { id: string; name: string; birth_date: string | null } | undefined; onClose: () => void }) {
  const [name, setName] = useState(me?.name ?? '');
  const [birth, setBirth] = useState<string | null>(me?.birth_date ? String(me.birth_date).slice(0, 10) : null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet visible={visible} title="Tus datos" onClose={onClose}>
      <Field label="Cómo te llamamos" value={name} onChangeText={setName} />
      <DateField label="Fecha de nacimiento" value={birth} onChange={setBirth} />
      {error ? <Notice text={error} /> : null}
      <Button
        label="Guardar"
        onPress={async () => {
          if (!me) return setError('Todavía no se carga tu perfil.');
          if (!name.trim()) return setError('Escribe tu nombre.');
          try {
            await updateRecord('people', me.id, { name: name.trim().slice(0, 60), birth_date: birth });
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo guardar.');
          }
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  streaks: { flexDirection: 'row', gap: 8 },
  streak: { flex: 1, borderRadius: 18, padding: 10, alignItems: 'center', gap: 2 },
  year: { flexDirection: 'row', gap: 3 },
  month: { flex: 1, gap: 2 },
  px: { height: 7, borderRadius: 2 },
  line: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
});
