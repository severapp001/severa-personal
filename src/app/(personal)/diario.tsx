import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { addDays, longDay, shortDay } from '@/core/agenda';
import { activitiesOf, activityInsights, dayEntry, journalStreak, moodDistribution, moodOf, MOODS, SUGGESTED_ACTIVITIES, type Mood } from '@/core/journal';
import { dayKey } from '@/core/today';
import { useJournal, type Journal } from '@/data/journal';
import { useMoodColor } from '@/features/journal/useMoodColor';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { PlusIcon } from '@/ui/icons';
import { BarRow, DateField, Empty, Field, Kicker, Panel, Segmented } from '@/ui/kit';

// Diario y Gratitud (MD6, frente P3, 25-10-2026), con la primera versión como referencia:
// - el día: ánimo por colores, actividades, lo que pasó y lo que agradeces;
// - Gratitud: todo lo agradecido;
// - Mirada: el ánimo del período y qué se repite en los días buenos y en los difíciles.

type Tab = 'dia' | 'gratitud' | 'mirada';

export default function DiarioScreen() {
  const { tab: initial } = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(initial === 'gratitud' || initial === 'mirada' ? initial : 'dia');
  const j = useJournal();
  const today = dayKey(new Date());
  const [day, setDay] = useState(today);

  return (
    <Screen>
      <ModuleHeader kicker="Personal" title="Diario" />
      <Segmented
        options={[
          { value: 'dia', label: 'El día' },
          { value: 'gratitud', label: 'Gratitud' },
          { value: 'mirada', label: 'Mirada' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'dia' ? (
        <>
          <DateField label="Día" value={day} onChange={(d) => d && d <= today && setDay(d)} />
          {/* El formulario nace con la entrada del día elegido. */}
          <DayForm key={`${day}:${dayEntry(j.days, day)?.id ?? 'nuevo'}`} j={j} day={day} />
          <GratitudeBox j={j} day={day} />
        </>
      ) : tab === 'gratitud' ? (
        <GratitudeList j={j} today={today} />
      ) : (
        <Insights j={j} today={today} />
      )}
    </Screen>
  );
}

function DayForm({ j, day }: { j: Journal; day: string }) {
  const { colors } = useTheme();
  const color = useMoodColor();
  const entry = dayEntry(j.days, day);
  const [mood, setMood] = useState<number | null>(entry?.mood ?? null);
  const [acts, setActs] = useState<string[]>(activitiesOf(entry?.activities));
  const [body, setBody] = useState(entry?.body ?? '');
  const [other, setOther] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // Las sugeridas más las propias que ya usaste.
  const used = new Set(j.days.flatMap((d) => activitiesOf(d.activities)));
  const options = [...new Set([...SUGGESTED_ACTIVITIES, ...used, ...acts])];
  const toggle = (a: string) => {
    tap();
    setSaved(false);
    setActs((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]));
  };

  async function save(closed?: boolean) {
    setBusy(true);
    try {
      await j.saveDay(day, { mood, activities: acts, body, ...(closed === undefined ? {} : { closed }) });
      tap();
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <Kicker>{`¿Cómo estuvo tu ${longDay(day)}?`}</Kicker>
      <View style={styles.moods}>
        {MOODS.map((m) => {
          const on = mood === m.value;
          return (
            <Pressable
              key={m.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => {
                tap();
                setSaved(false);
                setMood(on ? null : m.value);
              }}
              style={[styles.mood, { backgroundColor: on ? color(m.value) : colors.surface2 }]}
            >
              <View style={[styles.dot, { backgroundColor: on ? colors.onAccent : color(m.value) }]} />
              <AppText variant="label" style={{ fontSize: 13 }} color={on ? colors.onAccent : colors.text}>
                {m.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption" muted>
        ¿Qué hiciste?
      </AppText>
      <View style={styles.chips}>
        {options.map((a) => {
          const on = acts.includes(a);
          return (
            <Pressable key={a} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(a)} style={[styles.chip, { backgroundColor: on ? colors.accent : colors.surface2 }]}>
              <AppText variant="label" style={{ fontSize: 13 }} color={on ? colors.onAccent : colors.text}>
                {a}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.input, { backgroundColor: colors.surface2 }]}>
        <TextInput
          value={other}
          onChangeText={setOther}
          placeholder="Otra actividad"
          placeholderTextColor={colors.muted}
          onSubmitEditing={() => {
            if (other.trim()) toggle(other.trim().slice(0, 30));
            setOther('');
          }}
          returnKeyType="done"
          style={{ flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 10 }}
        />
      </View>
      <Field
        label="Lo que pasó (solo para ti)"
        value={body}
        onChangeText={(t) => {
          setSaved(false);
          setBody(t);
        }}
        multiline
        placeholder="Escribe con calma…"
      />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button label={saved ? 'Guardado' : 'Guardar'} loading={busy} onPress={() => save()} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={entry?.closed ? 'Día cerrado' : 'Cerrar el día'} kind="secondary" disabled={busy} onPress={() => save(!entry?.closed)} />
        </View>
      </View>
    </Panel>
  );
}

function GratitudeBox({ j, day }: { j: Journal; day: string }) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const list = j.gratitude.filter((g) => g.day === day);
  const add = async () => {
    if (!draft.trim()) return;
    tap();
    const text = draft;
    setDraft('');
    await j.addGratitude(day, text);
  };
  return (
    <Panel>
      <Kicker>Agradezco</Kicker>
      {list.map((g) => (
        <AppText key={g.id} variant="body" style={{ fontSize: 15 }}>
          {`• ${g.body}`}
        </AppText>
      ))}
      <View style={[styles.input, { backgroundColor: colors.surface2 }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={list.length ? 'Algo más' : 'Una cosa buena de este día'}
          placeholderTextColor={colors.muted}
          onSubmitEditing={add}
          returnKeyType="done"
          style={{ flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 10 }}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Agregar" onPress={add} hitSlop={8}>
          <PlusIcon size={20} color={draft.trim() ? colors.accent : colors.muted} />
        </Pressable>
      </View>
    </Panel>
  );
}

function GratitudeList({ j, today }: { j: Journal; today: string }) {
  const days = [...new Set(j.gratitude.map((g) => g.day))];
  return (
    <>
      <GratitudeBox j={j} day={today} />
      {days.length ? (
        days
          .filter((d) => d !== today)
          .map((d) => (
            <Panel key={d}>
              <Kicker>{longDay(d)}</Kicker>
              {j.gratitude
                .filter((g) => g.day === d)
                .map((g) => (
                  <AppText
                    key={g.id}
                    variant="body"
                    style={{ fontSize: 15 }}
                    onLongPress={() =>
                      Alert.alert('¿Borrar?', g.body, [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Borrar', style: 'destructive', onPress: () => j.removeGratitude(g.id) },
                      ])
                    }
                  >
                    {`• ${g.body}`}
                  </AppText>
                ))}
            </Panel>
          ))
      ) : (
        <Empty text="Cada día, una cosa buena. Con el tiempo se vuelve un hábito que se nota." />
      )}
    </>
  );
}

function Insights({ j, today }: { j: Journal; today: string }) {
  const { colors } = useTheme();
  const color = useMoodColor();
  const [range, setRange] = useState<'7' | '30' | '90'>('30');
  const from = addDays(today, -(Number(range) - 1));
  const dist = moodDistribution(j.days, from, today);
  const max = Math.max(1, ...dist.map((m) => m.count));
  const ins = activityInsights(j.days, from, today);
  const streak = journalStreak(j.days, today, addDays);
  const recent = [...j.days].filter((d) => d.day >= from).sort((a, b) => b.day.localeCompare(a.day)).slice(0, 10);
  const strip = Array.from({ length: Number(range) === 7 ? 7 : 14 }, (_, i) => addDays(today, -(Number(range) === 7 ? 6 : 13) + i));

  return (
    <>
      <Segmented
        options={[
          { value: '7', label: '7 días' },
          { value: '30', label: '30 días' },
          { value: '90', label: '90 días' },
        ]}
        value={range}
        onChange={setRange}
      />
      <Panel>
        <Kicker>{streak ? `Racha: ${streak} ${streak === 1 ? 'día' : 'días'} seguidos` : 'Sin racha todavía'}</Kicker>
        <View style={styles.strip}>
          {strip.map((d) => (
            <View key={d} style={[styles.square, { backgroundColor: color(dayEntry(j.days, d)?.mood) }]} accessibilityLabel={`${shortDay(d)}: ${moodOf(dayEntry(j.days, d)?.mood)?.label ?? 'sin registro'}`} />
          ))}
        </View>
        <AppText variant="caption" muted>
          {Number(range) === 7 ? 'Los últimos 7 días' : 'Los últimos 14 días'}
        </AppText>
      </Panel>
      <Panel>
        <Kicker>Tu ánimo</Kicker>
        {dist.some((m) => m.count) ? dist.map((m) => <BarRow key={m.mood} label={m.label} value={m.count} max={max} text={`${m.count}`} tone={m.mood === 1 ? 'bad' : m.mood >= 3 ? 'ok' : 'data'} />) : <Empty text="Todavía no hay días con ánimo en este período." />}
      </Panel>
      <Panel>
        <Kicker>En tus días buenos</Kicker>
        {ins.good.length ? (
          <AppText variant="body" style={{ fontSize: 15 }}>
            {ins.good.map((a) => `${a.name} (${a.count})`).join(' · ')}
          </AppText>
        ) : (
          <Empty text="Marca actividades en tus días para ver qué te hace bien." />
        )}
        <Kicker color={colors.bad}>En tus días difíciles</Kicker>
        {ins.bad.length ? (
          <AppText variant="body" style={{ fontSize: 15 }}>
            {ins.bad.map((a) => `${a.name} (${a.count})`).join(' · ')}
          </AppText>
        ) : (
          <Empty text="Nada que se repita en los días difíciles. Bien." />
        )}
      </Panel>
      <Panel>
        <Kicker>Últimos días</Kicker>
        {recent.length ? (
          recent.map((d) => (
            <View key={d.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={[styles.dot, { backgroundColor: color(d.mood as Mood), marginTop: 6 }]} />
              <View style={{ flex: 1 }}>
                <AppText variant="label">{`${shortDay(d.day)} · ${moodOf(d.mood)?.label ?? 'Sin ánimo'}`}</AppText>
                {d.body ? (
                  <AppText variant="caption" muted numberOfLines={2}>
                    {d.body}
                  </AppText>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Empty text="Aquí aparecerán tus días." />
        )}
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  moods: { flexDirection: 'row', gap: 6 },
  mood: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, paddingHorizontal: 12 },
  strip: { flexDirection: 'row', gap: 4 },
  square: { flex: 1, height: 22, borderRadius: 5 },
});
