import { useState } from 'react';
import { Alert, View } from 'react-native';

import { ageOn } from '@/core/age';
import { daysUntil } from '@/core/studies';
import { useFamily, type Person } from '@/data/modules';
import { authErrorMessage } from '@/features/account/authErrors';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Notice, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { Chips, DateField, Empty, Field, Kicker, Panel, Row, Sheet } from '@/ui/kit';

// Familia y mascotas (F23): las personas a cargo, con su edad, su próximo cumpleaños y una nota
// (alergias, colegio, veterinario). Sus gastos, salud y documentos se conectan después.

const TYPES = [
  { value: 'child', label: 'Hijo o hija' },
  { value: 'pet', label: 'Mascota' },
  { value: 'other', label: 'Otra persona' },
] as const;
type PType = (typeof TYPES)[number]['value'];

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
  const today = todayIso();

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

  const groups = TYPES.map((t) => ({ ...t, list: fam.people.filter((p) => p.type === t.value) })).filter((g) => g.list.length);
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
            <Kicker>{g.value === 'child' ? 'Hijos' : g.value === 'pet' ? 'Mascotas' : 'Otras personas a cargo'}</Kicker>
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
      <AddPerson visible={adding} onClose={() => setAdding(false)} onSave={fam.addPerson} />
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
        label={type === 'pet' ? 'Especie (perro, gato…)' : type === 'other' ? 'Relación (mamá, abuelo…)' : 'Nota (opcional)'}
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
              relationship: type === 'other' ? extra.trim() || null : type === 'child' ? 'hijo o hija' : null,
              notes: type === 'child' ? extra.trim() || null : null,
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
