import { useState } from 'react';
import { Alert, View } from 'react-native';

import { hhmm, LAYERS, parseTime, REMINDERS, REPEATS, type CalendarEvent, type EventLayer, type Repeat, type Task } from '@/core/agenda';
import type { Agenda } from '@/data/agenda';
import { AppText, Button, Checkbox, Notice } from '@/ui';
import { tap } from '@/ui/haptics';
import { ChipRow, DateField, Field, normalizeTime, Segmented, Sheet, TimeField } from '@/ui/kit';

// Crear o editar un evento del calendario o una tarea (F05, MD4). Con hora, el evento va a la
// línea del día; sin hora, es de todo el día. La tarea con fecha aparece en las prioridades.

export type AgendaTarget = { kind: 'event'; event?: CalendarEvent } | { kind: 'task'; task?: Task };

export function AgendaSheet({ agenda, target, day, onClose }: { agenda: Agenda; target: AgendaTarget | null; day: string; onClose: () => void }) {
  const editing = target?.kind === 'event' ? target.event : target?.kind === 'task' ? target.task : undefined;
  return (
    <Sheet visible={!!target} title={editing ? (target?.kind === 'event' ? 'Editar evento' : 'Editar tarea') : 'Agregar a tu agenda'} onClose={onClose}>
      {/* El formulario nace con lo que se edita (o limpio) cada vez que se abre la hoja. */}
      {target ? <AgendaForm key={editing?.id ?? `nuevo:${target.kind}`} agenda={agenda} target={target} day={day} onClose={onClose} /> : null}
    </Sheet>
  );
}

function AgendaForm({ agenda, target, day, onClose }: { agenda: Agenda; target: AgendaTarget; day: string; onClose: () => void }) {
  const e = target.kind === 'event' ? target.event : undefined;
  const t = target.kind === 'task' ? target.task : undefined;
  const editing = e ?? t;
  const [kind, setKind] = useState<'event' | 'task'>(target.kind);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [date, setDate] = useState<string | null>(e ? e.event_date : t ? t.due_on : day);
  const [start, setStart] = useState(hhmm(e ? e.starts_at : t?.due_at) ?? '');
  const [end, setEnd] = useState(hhmm(e?.ends_at) ?? '');
  const [layer, setLayer] = useState<EventLayer>(e?.layer ?? 'personal');
  const [repeat, setRepeat] = useState<Repeat>(e?.repeat ?? 'none');
  const [remind, setRemind] = useState<string>(e?.remind_minutes === null || e?.remind_minutes === undefined ? 'none' : String(e.remind_minutes));
  const [place, setPlace] = useState(e?.location ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [urgent, setUrgent] = useState(!!t?.urgent);
  const [importance, setImportance] = useState(String(e?.importance ?? 0));
  const [until, setUntil] = useState<string | null>(e?.repeat_until ? String(e.repeat_until).slice(0, 10) : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const name = title.trim();
    if (!name) return setError('Escribe un título.');
    const startsAt = start.trim() ? parseTime(normalizeTime(start) || start) : null;
    const endsAt = end.trim() ? parseTime(normalizeTime(end) || end) : null;
    if (start.trim() && !startsAt) return setError('La hora de inicio no se entiende. Escríbela como 09:30.');
    if (end.trim() && (!endsAt || !startsAt || endsAt <= startsAt)) return setError('La hora de término debe ser después del inicio.');
    if (kind === 'event' && !date) return setError('Elige la fecha.');
    setBusy(true);
    setError(null);
    try {
      if (kind === 'event') {
        const values = {
          title: name,
          event_date: date!,
          starts_at: startsAt,
          ends_at: endsAt,
          layer,
          repeat,
          remind_minutes: remind === 'none' ? null : Number(remind),
          location: place.trim() || null,
          notes: notes.trim() || null,
          importance: Number(importance),
          repeat_until: repeat === 'none' ? null : until,
        };
        if (e) await agenda.updateEvent(e.id, values);
        else await agenda.addEvent(values);
      } else {
        const values = { title: name, due_on: date, due_at: startsAt, urgent, notes: notes.trim() || null };
        if (t) await agenda.updateTask(t.id, values);
        else await agenda.addTask(values);
      }
      tap();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    Alert.alert(target.kind === 'event' ? '¿Borrar el evento?' : '¿Borrar la tarea?', 'No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          if (e) await agenda.removeEvent(e.id);
          if (t) await agenda.removeTask(t.id);
          onClose();
        },
      },
    ]);
  }

  return (
    <>
      {editing ? null : (
        <Segmented
          options={[
            { value: 'event', label: 'Evento' },
            { value: 'task', label: 'Tarea' },
          ]}
          value={kind}
          onChange={setKind}
        />
      )}
      <Field label={kind === 'event' ? 'Qué' : 'Qué tienes que hacer'} value={title} onChangeText={setTitle} placeholder={kind === 'event' ? 'Dentista, reunión, cumpleaños…' : 'Pagar la luz'} />
      <DateField label={kind === 'event' ? 'Fecha' : 'Para cuándo (vacío = sin fecha)'} value={date} onChange={setDate} future />
      {/* Horas que se arman solas: 1200 → 12:00 (usuario, 26-10-2026). */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TimeField label={kind === 'event' ? 'Desde (vacío = todo el día)' : 'Hora (opcional)'} value={start} onChange={setStart} />
        {kind === 'event' ? <TimeField label="Hasta" value={end} onChange={setEnd} placeholder="10:30" /> : null}
      </View>
      {kind === 'event' ? (
        <>
          <AppText variant="caption" muted>
            ¿Qué tan importante es?
          </AppText>
          <ChipRow
            options={[
              { value: '0', label: 'Normal' },
              { value: '1', label: '★ Prioridad del día' },
              { value: '2', label: '‼ Urgente' },
            ]}
            value={importance}
            onChange={setImportance}
          />
          <AppText variant="caption" muted>
            Tipo
          </AppText>
          <ChipRow options={LAYERS} value={layer} onChange={setLayer} />
          <AppText variant="caption" muted>
            Repetir
          </AppText>
          <ChipRow options={REPEATS} value={repeat} onChange={setRepeat} />
          {repeat !== 'none' ? <DateField label="Hasta cuándo (vacío = siempre)" value={until} onChange={setUntil} future /> : null}
          <AppText variant="caption" muted>
            Aviso en el teléfono
          </AppText>
          <ChipRow options={REMINDERS.map((r) => ({ value: r.value === null ? 'none' : String(r.value), label: r.label }))} value={remind} onChange={setRemind} />
          <Field label="Lugar (opcional)" value={place} onChangeText={setPlace} />
        </>
      ) : (
        <Checkbox checked={urgent} onChange={setUrgent}>
          Es urgente
        </Checkbox>
      )}
      <Field label="Notas (opcional)" value={notes} onChangeText={setNotes} multiline />
      {error ? <Notice text={error} /> : null}
      <Button label="Guardar" loading={busy} onPress={save} />
      {editing ? <Button label="Borrar" kind="link" onPress={remove} /> : null}
    </>
  );
}
