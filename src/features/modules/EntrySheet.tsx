import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { Entry, EntryInput } from '@/data/entries';
import { authErrorMessage } from '@/features/account/authErrors';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { AppText, Button, Checkbox, Notice } from '@/ui';
import { tap } from '@/ui/haptics';
import { AmountField, ChipRow, DateField, Field, normalizeTime, Sheet, TimeField, todayIso } from '@/ui/kit';
import type { FieldDef, KindDef, OptionsCtx } from './catalog';

// Formulario de cualquier registro del motor común: se arma con los campos de la ficha del módulo.

const COLUMNS = new Set(['title', 'body', 'day', 'until', 'amount', 'value', 'done']);

export type SheetTarget = { kind: KindDef; entry?: Entry; parent?: Entry | null };

function initialValues(kind: KindDef, entry?: Entry): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of kind.fields) {
    const current = entry ? (COLUMNS.has(f.key) ? (entry as unknown as Record<string, unknown>)[f.key] : entry.data[f.key]) : undefined;
    if (current !== undefined && current !== null) out[f.key] = current;
    else if (f.initial === 'today') out[f.key] = todayIso();
    else if (f.initial !== undefined) out[f.key] = f.kind === 'number' ? Number(f.initial) : f.initial;
    else out[f.key] = f.kind === 'multi' ? [] : f.kind === 'check' ? false : f.kind === 'amount' ? 0 : '';
  }
  return out;
}

const filled = (v: unknown) => !(v === '' || v === null || v === undefined || v === 0 || (Array.isArray(v) && !v.length));

export function EntrySheet({
  target,
  ctx,
  onClose,
  onSave,
  onRemove,
}: {
  target: SheetTarget | null;
  ctx: OptionsCtx;
  onClose: () => void;
  onSave: (input: EntryInput, target: SheetTarget) => Promise<unknown>;
  onRemove: (entry: Entry) => Promise<unknown>;
}) {
  return (
    <Sheet visible={!!target} title={target ? (target.entry ? `Editar ${target.kind.one.toLowerCase()}` : target.kind.one) : ''} onClose={onClose}>
      {target ? <EntryForm key={target.entry?.id ?? `nuevo:${target.kind.kind}`} target={target} ctx={{ ...ctx, parent: target.parent ?? ctx.parent }} onClose={onClose} onSave={onSave} onRemove={onRemove} /> : null}
    </Sheet>
  );
}

function EntryForm({
  target,
  ctx,
  onClose,
  onSave,
  onRemove,
}: {
  target: SheetTarget;
  ctx: OptionsCtx;
  onClose: () => void;
  onSave: (input: EntryInput, target: SheetTarget) => Promise<unknown>;
  onRemove: (entry: Entry) => Promise<unknown>;
}) {
  const { kind, entry } = target;
  const [values, setValues] = useState(() => initialValues(kind, entry));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: string, v: unknown) => setValues((s) => ({ ...s, [key]: v }));

  async function save() {
    const missing = kind.fields.find((f) => f.required && !filled(values[f.key]));
    if (missing) return setError(`Falta: ${missing.label.replace(/ \(.*\)$/, '').toLowerCase()}.`);
    const input: EntryInput = { kind: kind.kind, data: { ...(entry?.data ?? {}) } };
    for (const f of kind.fields) {
      let v = values[f.key];
      if (f.kind === 'time') v = normalizeTime(String(v ?? '')) || null;
      if (f.kind === 'number') v = filled(v) ? Number(String(v).replace(',', '.')) : null;
      if (f.kind === 'amount') v = filled(v) ? Number(v) : null;
      if ((f.kind === 'text' || f.kind === 'long' || f.kind === 'choice' || f.kind === 'date') && !filled(v)) v = null;
      if (COLUMNS.has(f.key)) (input as Record<string, unknown>)[f.key] = f.kind === 'check' ? !!v : v;
      else input.data![f.key] = v;
    }
    if (input.day && input.until && input.until < input.day) return setError('La fecha de término debe ser después del inicio.');
    if (!entry && target.parent) input.parent_id = target.parent.id;
    setBusy(true);
    setError(null);
    try {
      await onSave(input, target);
      tap();
      onClose();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {kind.fields.map((f) => (
        <FieldInput key={f.key} field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} ctx={ctx} />
      ))}
      {error ? <Notice text={error} /> : null}
      <Button label="Guardar" loading={busy} onPress={save} />
      {entry ? (
        <Button
          label="Borrar"
          kind="link"
          onPress={() =>
            Alert.alert('¿Borrar?', 'No se puede deshacer.', [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Borrar',
                style: 'destructive',
                onPress: async () => {
                  await onRemove(entry);
                  onClose();
                },
              },
            ])
          }
        />
      ) : null}
    </>
  );
}

function FieldInput({ field: f, value, onChange, ctx }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void; ctx: OptionsCtx }) {
  const { colors } = useTheme();
  const options = typeof f.options === 'function' ? f.options(ctx) : (f.options ?? []);
  switch (f.kind) {
    case 'text':
    case 'long':
      return <Field label={f.label} value={String(value ?? '')} onChangeText={onChange} placeholder={f.placeholder} multiline={f.kind === 'long'} />;
    case 'number':
      return <Field label={f.label} value={value === null || value === undefined ? '' : String(value)} onChangeText={(t) => onChange(t.replace(/[^\d,.]/g, ''))} keyboardType="decimal-pad" placeholder={f.placeholder} />;
    case 'amount':
      return <AmountField label={f.label} value={Number(value) || 0} onChange={onChange} />;
    case 'date':
      return <DateField label={f.label} value={value ? String(value) : null} onChange={onChange} future={f.key === 'until' || f.initial !== 'today'} />;
    case 'time':
      return (
        <View style={{ flexDirection: 'row' }}>
          <TimeField label={f.label} value={String(value ?? '')} onChange={onChange} />
        </View>
      );
    case 'check':
      return (
        <Checkbox checked={!!value} onChange={onChange}>
          <AppText>{f.label}</AppText>
        </Checkbox>
      );
    case 'choice':
      return (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" muted>
            {f.label}
          </AppText>
          {options.length ? (
            <ChipRow options={options.map((o) => ({ value: o, label: o }))} value={value ? String(value) : null} onChange={(v) => onChange(v === value ? '' : v)} />
          ) : (
            <AppText variant="caption" muted>
              Primero agrega opciones (por ejemplo, tus productos).
            </AppText>
          )}
        </View>
      );
    case 'multi': {
      const list = Array.isArray(value) ? (value as string[]) : [];
      return (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" muted>
            {f.label}
          </AppText>
          <View style={styles.wrap}>
            {options.map((o) => {
              const on = list.includes(o);
              return (
                <Pressable
                  key={o}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    tap();
                    onChange(on ? list.filter((x) => x !== o) : [...list, o]);
                  }}
                  style={[styles.chip, { backgroundColor: on ? colors.accent : colors.surface2 }]}
                >
                  <AppText variant="label" style={{ fontSize: 13 }} color={on ? colors.onAccent : colors.text}>
                    {o}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }
    case 'scale': {
      const max = f.max ?? 5;
      return (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" muted>
            {f.label}
          </AppText>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
              const on = Number(value) === n;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    tap();
                    onChange(on ? null : n);
                  }}
                  style={[styles.scale, { backgroundColor: on ? colors.accent : colors.surface2 }]}
                >
                  <AppText variant="label" color={on ? colors.onAccent : colors.text}>
                    {n}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 8 },
  scale: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
