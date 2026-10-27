import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { addDays, weekday } from '@/core/agenda';
import type { Agenda } from '@/data/agenda';
import type { Entry } from '@/data/entries';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Notice } from '@/ui';
import { tap } from '@/ui/haptics';
import { ChipRow, DateField, normalizeTime, Sheet, TimeField } from '@/ui/kit';

// Planificar trabajo en el calendario (26-10-2026, noche; usuario: «no encuentro dónde administrar
// los trabajos en X cantidad de días… un calendario para trabajo que trabaje con el de Personal»):
// eliges el trabajo, marcas los días (de las próximas 4 semanas) y el horario; cada día queda como
// evento de Trabajo, a la vista en los dos calendarios. También puede repetirse cada semana.

const WEEK = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export function PlanSheet({ visible, jobs, agenda, day, onClose }: { visible: boolean; jobs: Entry[]; agenda: Agenda; day: string; onClose: () => void }) {
  const { colors } = useTheme();
  const [job, setJob] = useState<string | null>(null);
  const [days, setDays] = useState<string[]>([day]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [repeat, setRepeat] = useState<'none' | 'weekly'>('none');
  const [until, setUntil] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = jobs.find((j) => j.id === (job ?? jobs[0]?.id)) ?? null;
  const next28 = Array.from({ length: 28 }, (_, i) => addDays(day, i));
  const toggle = (d: string) => {
    tap();
    setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort()));
  };

  async function save() {
    const start = normalizeTime(from || String(chosen?.data.desde ?? ''));
    const end = normalizeTime(to || String(chosen?.data.hasta ?? ''));
    if (!chosen) return setError('Primero agrega un trabajo.');
    if (!days.length) return setError('Marca al menos un día.');
    if (!start) return setError('Escribe la hora de inicio.');
    if (end && end <= start) return setError('La hora de término debe ser después del inicio.');
    setBusy(true);
    setError(null);
    try {
      for (const d of days) {
        await agenda.addEvent({ title: chosen.title ?? 'Trabajo', event_date: d, starts_at: start, ends_at: end || null, layer: 'trabajo', repeat, repeat_until: repeat === 'weekly' ? until : null, remind_minutes: 30, location: null, notes: null, importance: 1 });
      }
      tap();
      setDays([day]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} title="Planificar trabajo" onClose={onClose}>
      {jobs.length ? (
        <>
          <AppText variant="caption" muted>
            Trabajo
          </AppText>
          <ChipRow options={jobs.map((j) => ({ value: j.id, label: j.title ?? 'Trabajo' }))} value={chosen?.id ?? null} onChange={setJob} />
          <AppText variant="caption" muted>{`Días (${days.length} marcados)`}</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {next28.map((d) => {
              const on = days.includes(d);
              return (
                <Pressable key={d} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(d)} style={[styles.day, { backgroundColor: on ? colors.accent : colors.surface2 }]}>
                  <AppText variant="caption" style={{ fontSize: 11 }} color={on ? colors.onAccent : colors.muted}>
                    {WEEK[weekday(d)]}
                  </AppText>
                  <AppText style={{ fontFamily: fonts.extrabold, fontSize: 16 }} color={on ? colors.onAccent : colors.text}>
                    {Number(d.slice(8))}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TimeField label="Desde" value={from} onChange={setFrom} placeholder={String(chosen?.data.desde ?? '07:00')} />
            <TimeField label="Hasta" value={to} onChange={setTo} placeholder={String(chosen?.data.hasta ?? '13:00')} />
          </View>
          <ChipRow
            options={[
              { value: 'none', label: 'Solo esos días' },
              { value: 'weekly', label: 'Repetir cada semana' },
            ]}
            value={repeat}
            onChange={setRepeat}
          />
          {repeat === 'weekly' ? <DateField label="Hasta cuándo (vacío = sin fin)" value={until} onChange={setUntil} future /> : null}
          {error ? <Notice text={error} /> : null}
          <Button label={`Guardar ${days.length} ${days.length === 1 ? 'día' : 'días'} en el calendario`} loading={busy} onPress={save} />
          <AppText variant="caption" muted>
            Queda en tu Calendario (Personal y Trabajo) y en Hoy en Trabajo, con aviso 30 minutos antes.
          </AppText>
        </>
      ) : (
        <AppText muted>Primero agrega un trabajo en «Mis trabajos».</AppText>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  day: { width: 48, borderRadius: 12, paddingVertical: 8, alignItems: 'center', gap: 2 },
});
