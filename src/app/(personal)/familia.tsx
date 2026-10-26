import { useState } from 'react';
import { Alert, View } from 'react-native';

import { ageOn } from '@/core/age';
import { daysUntil } from '@/core/studies';
import { router } from 'expo-router';

import { useAgenda } from '@/data/agenda';
import { useEntries } from '@/data/entries';
import { useFamily, type Person } from '@/data/modules';
import type { KindDef } from '@/features/modules/catalog';
import { EntrySheet, type SheetTarget } from '@/features/modules/EntrySheet';
import { moduleHref } from '@/features/space/moduleRoutes';
import { authErrorMessage } from '@/features/account/authErrors';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Notice, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { Chips, DateField, Empty, Field, Kicker, Panel, Row, Sheet } from '@/ui/kit';

// Familia y mascotas (F23): las personas a cargo, con su edad, su próximo cumpleaños y una nota
// (alergias, colegio, veterinario). Desde el 26-10-2026: pareja, fechas y cuidados de cada uno
// (aniversario, alimento, vacunas, controles) que pasan al Calendario, y acceso a Gastos compartidos.

const TYPES = [
  { value: 'child', label: 'Hijo o hija' },
  { value: 'partner', label: 'Pareja' },
  { value: 'pet', label: 'Mascota' },
  { value: 'other', label: 'Otra persona' },
] as const;
type PType = (typeof TYPES)[number]['value'];

// Fechas y cuidados de cada persona o mascota (26-10-2026; usuario: «falta pareja con fecha de
// aniversario, mascotas con qué alimento, cuándo se compró…»). Las fechas quedan en el Calendario.
const careKind = (names: string[]): KindDef => ({
  kind: 'cuidado',
  label: 'Fechas y cuidados',
  one: 'Fecha o cuidado',
  empty: 'Aniversarios, alimento de la mascota, vacunas, controles, colegio.',
  fields: [
    { key: 'persona', label: '¿De quién?', kind: 'choice', options: names, required: true },
    { key: 'tipo', label: 'Qué es', kind: 'choice', required: true, options: ['Aniversario', 'Alimento', 'Vacuna', 'Veterinario o control', 'Colegio', 'Salud', 'Compra', 'Otro'], initial: 'Aniversario' },
    { key: 'title', label: 'Detalle', kind: 'text', placeholder: 'Marca del alimento, nombre de la vacuna…' },
    { key: 'day', label: 'Fecha', kind: 'date' },
    { key: 'amount', label: 'Costo (opcional)', kind: 'amount' },
    { key: 'body', label: 'Nota (opcional)', kind: 'long' },
  ],
});

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function nextBirthday(birth: string, today: string): number {
  const year = Number(today.slice(0, 4));
  let next = `${year}${birth.slice(4)}`;
  if (next < today) next = `${year + 1}${birth.slice(4)}`;
  return daysUntil(next, today);
}

export default function FamiliaScreen() {
  const { colors } = useTheme();
  const fam = useFamily();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [careSheet, setCareSheet] = useState<SheetTarget | null>(null);
  const care = useEntries('familia');
  const agenda = useAgenda(todayIso(), todayIso());
  const today = todayIso();
  const kind = careKind(fam.people.map((p) => p.name));
  const cares = care.of('cuidado');
  const fmt = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;

  const describe = (p: Person) => {
    const parts: string[] = [];
    if (p.type === 'pet' && p.species) parts.push(p.species);
    if (p.relationship) parts.push(p.relationship);
    if (p.birth_date) {
      const age = ageOn(new Date(`${p.birth_date}T12:00:00`));
      parts.push(`${age} ${age === 1 ? 'año' : 'años'}`);
      const d = nextBirthday(p.birth_date, today);
      parts.push(d === 0 ? '¡cumple hoy!' : `cumple en ${d} días`);
    }
    return parts.join(' · ') || 'Toca para agregar una nota';
  };

  const groups = TYPES.filter((t) => t.value !== 'partner').map((t) => ({ ...t, list: fam.people.filter((p) => p.type === t.value) })).filter((g) => g.list.length);
  const soon = fam.people.filter((p) => p.birth_date && nextBirthday(p.birth_date, today) <= 30);

  return (
    <Screen>
      <ModuleHeader kicker="Personal" title="Familia y mascotas" />
      <Button label="+ Agregar" onPress={() => setAdding(true)} />
      {soon.length ? (
        <Panel>
          <Kicker color={colors.accent}>Cumpleaños que vienen</Kicker>
          {soon.map((p) => (
            <AppText key={p.id}>{`${p.name}: ${nextBirthday(p.birth_date!, today) === 0 ? 'hoy' : `en ${nextBirthday(p.birth_date!, today)} días`}`}</AppText>
          ))}
        </Panel>
      ) : null}
      {groups.length ? (
        groups.map((g) => (
          <Panel key={g.value}>
            <Kicker>{g.value === 'child' ? 'Hijos' : g.value === 'pet' ? 'Mascotas' : 'Pareja y otras personas'}</Kicker>
            {g.list.map((p) => (
              <Row
                key={p.id}
                title={p.name}
                sub={p.notes ? `${describe(p)}\n${p.notes}` : describe(p)}
                onPress={() => setEditing(p)}
                onLongPress={() =>
                  Alert.alert('¿Borrar?', `Se borra ${p.name}.`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Borrar', style: 'destructive', onPress: () => fam.remove(p.id) },
                  ])
                }
              />
            ))}
          </Panel>
        ))
      ) : (
        <Empty text="Agrega a quienes cuidas: hijos, mascotas, tus papás. Severa te recuerda sus cumpleaños y guarda lo importante de cada uno." />
      )}
      {fam.people.length ? (
        <Panel>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Kicker>Fechas y cuidados</Kicker>
            <AppText variant="label" color={colors.accent} onPress={() => setCareSheet({ kind })}>
              + Agregar
            </AppText>
          </View>
          {cares.length ? (
            cares.map((c) => (
              <Row
                key={c.id}
                title={`${String(c.data.persona)} · ${String(c.data.tipo)}${c.title ? `: ${c.title}` : ''}`}
                sub={[c.day ? fmt(c.day) : null, c.amount ? `$${Number(c.amount).toLocaleString('es-CL')}` : null, c.body].filter(Boolean).join(' · ') || undefined}
                onPress={() => setCareSheet({ kind, entry: c })}
              />
            ))
          ) : (
            <Empty text={kind.empty} />
          )}
        </Panel>
      ) : null}
      <Button label="Gastos compartidos con tu familia o pareja" kind="secondary" onPress={() => router.push(moduleHref('gastos_compartidos'))} />
      <AddPerson visible={adding} onClose={() => setAdding(false)} onSave={(v) => fam.addPerson(v.type === 'partner' ? { ...v, type: 'other', relationship: 'Pareja' } : { ...v, type: v.type })} />
      <EntrySheet
        target={careSheet}
        ctx={{ parent: null, entries: care.entries }}
        onClose={() => setCareSheet(null)}
        onSave={async (input, target) => {
          if (target.entry) return care.update(target.entry.id, input);
          await care.add(input);
          // Aniversarios y controles quedan en el Calendario (el aniversario, cada año).
          const tipo = String(input.data?.tipo ?? '');
          if (input.day && ['Aniversario', 'Vacuna', 'Veterinario o control', 'Colegio', 'Salud'].includes(tipo)) {
            await agenda.addEvent({ title: `${tipo} · ${String(input.data?.persona ?? '')}${input.title ? `: ${input.title}` : ''}`.slice(0, 120), event_date: input.day, starts_at: null, ends_at: null, layer: 'familia', repeat: tipo === 'Aniversario' ? 'yearly' : 'none', remind_minutes: null, location: null, notes: null, importance: tipo === 'Aniversario' ? 1 : 0, repeat_until: null });
          }
        }}
        onRemove={(e) => care.remove(e.id)}
      />
      <EditNotes person={editing} onClose={() => setEditing(null)} onSave={(notes) => (editing ? fam.updatePerson(editing.id, { notes }) : undefined)} />
    </Screen>
  );
}

function AddPerson({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (v: { type: PType; name: string; birth_date: string | null; relationship: string | null; species: string | null; notes: string | null }) => Promise<unknown>;
}) {
  const [type, setType] = useState<PType>('child');
  const [name, setName] = useState('');
  const [birth, setBirth] = useState<string | null>(null);
  const [extra, setExtra] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet visible={visible} title="Agregar a la familia" onClose={onClose}>
      <Chips options={[...TYPES]} value={type} onChange={setType} />
      <Field label="Nombre" value={name} onChangeText={setName} />
      <DateField label="Fecha de nacimiento (opcional)" value={birth} onChange={setBirth} />
      <Field
        label={type === 'pet' ? 'Especie (perro, gato…)' : type === 'other' ? 'Relación (mamá, abuelo…)' : type === 'partner' ? 'Nota (opcional; el aniversario va en «Fechas y cuidados»)' : 'Nota (opcional)'}
        value={extra}
        onChangeText={setExtra}
      />
      {error ? <Notice text={error} /> : null}
      <Button
        label="Guardar"
        loading={busy}
        onPress={async () => {
          if (!name.trim()) return setError('Escribe el nombre.');
          setBusy(true);
          setError(null);
          try {
            await onSave({
              type,
              name: name.trim(),
              birth_date: birth,
              species: type === 'pet' ? extra.trim() || null : null,
              relationship: type === 'other' ? extra.trim() || null : type === 'child' ? 'hijo o hija' : type === 'partner' ? 'Pareja' : null,
              notes: type === 'child' || type === 'partner' ? extra.trim() || null : null,
            });
            tap();
            setName('');
            setExtra('');
            setBirth(null);
            onClose();
          } catch (e) {
            setError(authErrorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      />
    </Sheet>
  );
}

function EditNotes({ person, onClose, onSave }: { person: Person | null; onClose: () => void; onSave: (notes: string | null) => Promise<unknown> | undefined }) {
  const [notes, setNotes] = useState<string | null>(null);
  const value = notes ?? person?.notes ?? '';
  return (
    <Sheet
      visible={!!person}
      title={person?.name ?? ''}
      onClose={() => {
        setNotes(null);
        onClose();
      }}
    >
      <Field label="Lo importante (alergias, colegio, veterinario, tallas…)" value={value} onChangeText={setNotes} multiline />
      <View style={{ gap: 8 }}>
        <Button
          label="Guardar"
          onPress={async () => {
            await onSave(value.trim() || null);
            tap();
            setNotes(null);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
