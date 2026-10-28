import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LAYERS, parseTime, REMINDERS, REPEATS } from '@/core/agenda';
import { describeProposal, WEEKDAY_NAMES, type Proposal, type Refs, type ResultStatus } from '@/core/assistant';
import { MOODS } from '@/core/journal';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { AppText, Button, Notice } from '@/ui';
import { tap } from '@/ui/haptics';
import { AmountField, ChipRow, Chips, DateField, Field, Segmented } from '@/ui/kit';

// Tarjeta de una propuesta del asistente: Confirmar, Corregir o Cancelar. Nada se guarda sin el
// visto bueno del usuario, y lo que corrige queda como lección (aprendizaje humano).

const STATUS: Record<ResultStatus, { label: string; tone: 'ok' | 'mid' | 'bad' }> = {
  done: { label: 'Guardado', tone: 'ok' },
  corrected: { label: 'Guardado con tu corrección · Severa lo aprendió', tone: 'ok' },
  cancelled: { label: 'Cancelado', tone: 'mid' },
  skipped: { label: 'Sin responder: no se guardó', tone: 'mid' },
  failed: { label: 'No se guardó', tone: 'bad' },
};

export function ProposalCard({
  proposal,
  refs,
  today,
  status,
  onConfirm,
  onCancel,
}: {
  proposal: Proposal | null;
  refs: Refs;
  today: string;
  status: ResultStatus | null;
  onConfirm: (final: Proposal) => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<Proposal | null>(proposal);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = editing ? draft : proposal;
  const info = shown ? describeProposal(shown, refs, today) : { title: 'No entendí bien esta acción', detail: 'Faltó un dato o una opción que no existe.' };
  const tone = status ? STATUS[status].tone : null;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      tap();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: tone === 'ok' ? colors.ok : tone === 'bad' ? colors.bad : status ? colors.line : colors.accent },
      ]}
    >
      <AppText variant="label" style={{ fontSize: 16 }}>
        {info.title}
      </AppText>
      <AppText variant="caption" muted>
        {info.detail}
      </AppText>

      {editing && draft ? <Editor draft={draft} refs={refs} onChange={setDraft} /> : null}
      {error ? <Notice text={error} /> : null}

      {status ? (
        <AppText variant="caption" color={tone === 'ok' ? colors.ok : tone === 'bad' ? colors.bad : colors.mid}>
          {STATUS[status].label}
        </AppText>
      ) : proposal ? (
        <View style={styles.actions}>
          <View style={{ flex: 1 }}>
            <Button label={editing ? 'Guardar así' : 'Confirmar'} loading={busy} onPress={() => run(() => onConfirm(editing && draft ? draft : proposal))} />
          </View>
          {editing ? null : (
            <View style={{ flex: 1 }}>
              <Button
                label="Corregir"
                kind="secondary"
                disabled={busy}
                onPress={() => {
                  setDraft(proposal);
                  setEditing(true);
                }}
              />
            </View>
          )}
          <Button label="Cancelar" kind="link" disabled={busy} onPress={() => (editing ? setEditing(false) : run(onCancel))} />
        </View>
      ) : (
        <Button label="Descartar" kind="secondary" disabled={busy} onPress={() => run(onCancel)} />
      )}
    </View>
  );
}

/** Los campos que se pueden corregir, según la acción. */
function Editor({ draft, refs, onChange }: { draft: Proposal; refs: Refs; onChange: (p: Proposal) => void }) {
  const options = (kind: 'category' | 'account' | 'habit' | 'course', sub?: string) =>
    Object.entries(refs)
      .filter(([, r]) => r.kind === kind && (!sub || r.sub === sub))
      .map(([key, r]) => ({ value: key, label: r.name }));

  switch (draft.tool) {
    case 'escribir_diario':
    case 'agradecer':
      return <JournalEditor draft={draft} onChange={onChange} />;
    case 'registrar_movimiento': {
      const accounts = options('account');
      return (
        <View style={{ gap: space.md }}>
          <Segmented
            options={[
              { value: 'expense', label: 'Gasto' },
              { value: 'income', label: 'Ingreso' },
            ]}
            value={draft.kind}
            onChange={(kind) => onChange({ ...draft, kind, category: null })}
          />
          <AmountField label="Monto" value={draft.amount} onChange={(amount) => onChange({ ...draft, amount })} />
          <Chips options={options('category', draft.kind)} value={draft.category} onChange={(category) => onChange({ ...draft, category })} />
          {accounts.length ? <Chips options={accounts} value={draft.account} onChange={(account) => onChange({ ...draft, account })} /> : null}
          <DateField label="Fecha" value={draft.date} onChange={(date) => date && onChange({ ...draft, date })} />
          <Field label="Descripción" value={draft.description ?? ''} onChangeText={(t) => onChange({ ...draft, description: t.trim() ? t : null })} />
        </View>
      );
    }
    case 'marcar_habito':
      return (
        <View style={{ gap: space.md }}>
          <Chips options={options('habit')} value={draft.habit} onChange={(habit) => onChange({ ...draft, habit })} />
          <Field
            label="Cuántas veces"
            keyboardType="number-pad"
            value={String(draft.times)}
            onChangeText={(t) => onChange({ ...draft, times: Math.min(100, Math.max(1, Number(t.replace(/\D/g, '')) || 1)) })}
          />
          <DateField label="Fecha" value={draft.date} onChange={(date) => date && onChange({ ...draft, date })} />
        </View>
      );
    case 'crear_habito':
      return (
        <View style={{ gap: space.md }}>
          <Field label="Nombre" value={draft.name} onChangeText={(name) => onChange({ ...draft, name })} />
          <Segmented
            options={[
              { value: 'good', label: 'Bueno' },
              { value: 'reduce', label: 'Por bajar' },
            ]}
            value={draft.direction}
            onChange={(direction) => onChange({ ...draft, direction })}
          />
          {draft.direction === 'good' ? (
            <Field
              label="Meta al día"
              keyboardType="number-pad"
              value={String(draft.target)}
              onChangeText={(t) => onChange({ ...draft, target: Math.min(100, Math.max(1, Number(t.replace(/\D/g, '')) || 1)) })}
            />
          ) : null}
        </View>
      );
    case 'recordar':
      return (
        <View style={{ gap: space.md }}>
          <Field label="Cuando digo" value={draft.phrase} onChangeText={(phrase) => onChange({ ...draft, phrase })} />
          <Field label="Significa" value={draft.meaning} onChangeText={(meaning) => onChange({ ...draft, meaning })} multiline />
        </View>
      );
    case 'crear_evento':
      return (
        <View style={{ gap: space.md }}>
          <Field label="Qué" value={draft.title} onChangeText={(title) => onChange({ ...draft, title })} />
          <DateField label="Fecha" value={draft.date} onChange={(date) => date && onChange({ ...draft, date })} future />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <TimeInput label="Desde (vacío = todo el día)" value={draft.start} onChange={(start) => onChange({ ...draft, start, end: start ? draft.end : null })} />
            </View>
            <View style={{ flex: 1 }}>
              <TimeInput label="Hasta" value={draft.end} onChange={(end) => onChange({ ...draft, end: draft.start && end && end > draft.start ? end : null })} />
            </View>
          </View>
          <Chips options={LAYERS} value={draft.layer} onChange={(layer) => onChange({ ...draft, layer })} />
          <Chips options={REPEATS} value={draft.repeat} onChange={(repeat) => onChange({ ...draft, repeat })} />
          <Chips
            options={REMINDERS.map((r) => ({ value: r.value === null ? 'none' : String(r.value), label: r.label }))}
            value={draft.remind === null ? 'none' : String(draft.remind)}
            onChange={(v) => onChange({ ...draft, remind: v === 'none' ? null : Number(v) })}
          />
        </View>
      );
    case 'crear_ramo':
      return (
        <View style={{ gap: space.md }}>
          <Field label="Ramo" value={draft.name} onChangeText={(name) => onChange({ ...draft, name })} />
          <Chips options={WEEKDAY_NAMES.map((w, i) => ({ value: String(i + 1), label: w.slice(0, 3) }))} value={draft.weekday ? String(draft.weekday) : null} onChange={(v) => onChange({ ...draft, weekday: Number(v) })} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <TimeInput label="Empieza" value={draft.start} onChange={(start) => onChange({ ...draft, start })} />
            </View>
            <View style={{ flex: 1 }}>
              <TimeInput label="Termina" value={draft.end} onChange={(end) => onChange({ ...draft, end: draft.start && end && end > draft.start ? end : null })} />
            </View>
          </View>
          <DateField label="Hasta cuándo (fin del semestre o trimestre)" value={draft.until} onChange={(until) => onChange({ ...draft, until })} future />
          <Field label="Profesor o profesora" value={draft.teacher ?? ''} onChangeText={(teacher) => onChange({ ...draft, teacher: teacher || null })} />
          <Segmented
            options={[
              { value: 'na', label: 'Sin trabajos' },
              { value: 'grupo', label: 'En grupo' },
              { value: 'solo', label: 'Individual' },
            ]}
            value={draft.group === null ? 'na' : draft.group ? 'grupo' : 'solo'}
            onChange={(v) => onChange({ ...draft, group: v === 'na' ? null : v === 'grupo' })}
          />
          <Field label="Pruebas o trabajos (opcional)" value={draft.evaluations ?? ''} onChangeText={(evaluations) => onChange({ ...draft, evaluations: evaluations || null })} placeholder="Solemne 1 el 20-11, 30 %" />
        </View>
      );
    case 'crear_evaluacion':
      return (
        <View style={{ gap: space.md }}>
          <Field label="Qué es (prueba, control, entrega, unidad…)" value={draft.title} onChangeText={(title) => onChange({ ...draft, title })} />
          <ChipRow options={options('course')} value={draft.course} onChange={(course) => onChange({ ...draft, course })} />
          <DateField label="Día" value={draft.date} onChange={(date) => date && onChange({ ...draft, date })} future />
          <Field label="Porcentaje (opcional)" value={draft.weight ? String(draft.weight) : ''} onChangeText={(v) => onChange({ ...draft, weight: Number(v.replace(/\D/g, '')) || null })} keyboardType="number-pad" />
        </View>
      );
    case 'crear_tarea':
      return (
        <View style={{ gap: space.md }}>
          <Field label="Qué tienes que hacer" value={draft.title} onChangeText={(title) => onChange({ ...draft, title })} />
          <DateField label="Para cuándo (vacío = sin fecha)" value={draft.date} onChange={(date) => onChange({ ...draft, date, time: date ? draft.time : null })} future />
          {draft.date ? <TimeInput label="Hora (opcional)" value={draft.time} onChange={(time) => onChange({ ...draft, time })} /> : null}
          <Segmented
            options={[
              { value: 'no', label: 'Normal' },
              { value: 'si', label: 'Urgente' },
            ]}
            value={draft.urgent ? 'si' : 'no'}
            onChange={(v) => onChange({ ...draft, urgent: v === 'si' })}
          />
        </View>
      );
  }
}

/** Ánimo y texto del diario, y lo que se agradece (se usa desde el Editor). */
function JournalEditor({ draft, onChange }: { draft: Extract<Proposal, { tool: 'escribir_diario' | 'agradecer' }>; onChange: (p: Proposal) => void }) {
  if (draft.tool === 'agradecer') {
    return (
      <View style={{ gap: space.md }}>
        <Field label="Agradezco" value={draft.text} onChangeText={(text) => onChange({ ...draft, text })} multiline />
        <DateField label="Día" value={draft.date} onChange={(date) => date && onChange({ ...draft, date })} />
      </View>
    );
  }
  return (
    <View style={{ gap: space.md }}>
      <Chips options={MOODS.map((m) => ({ value: String(m.value), label: m.label }))} value={draft.mood ? String(draft.mood) : null} onChange={(v) => onChange({ ...draft, mood: Number(v) })} />
      <Field label="Actividades (separadas por coma)" value={draft.activities.join(', ')} onChangeText={(t) => onChange({ ...draft, activities: t.split(',').map((a) => a.trim()).filter(Boolean) })} />
      <Field label="Lo que pasó" value={draft.text ?? ''} onChangeText={(t) => onChange({ ...draft, text: t.trim() ? t : null })} multiline />
      <DateField label="Día" value={draft.date} onChange={(date) => date && onChange({ ...draft, date })} />
    </View>
  );
}

/** Hora escrita a mano («930» o «09:30»); vacía = sin hora. */
function TimeInput({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const [text, setText] = useState(value ?? '');
  return (
    <Field
      label={label}
      value={text}
      keyboardType="number-pad"
      placeholder="09:30"
      onChangeText={(t) => {
        setText(t);
        onChange(t.trim() ? parseTime(t) : null);
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 1, padding: space.md, gap: space.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
