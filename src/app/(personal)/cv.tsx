import { useState } from 'react';
import { Alert, Share } from 'react-native';

import { useCv, type CvEntry, type CvKind } from '@/data/modules';
import { authErrorMessage } from '@/features/account/authErrors';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { AppText, Button, Notice, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { Chips, DateField, Empty, Field, Kicker, Panel, Row, Sheet } from '@/ui/kit';

// CV: trabajos, estudios, cursos, habilidades, idiomas y logros, listo para compartir.

const KINDS: { value: CvKind; label: string; plural: string }[] = [
  { value: 'job', label: 'Trabajo', plural: 'Experiencia' },
  { value: 'education', label: 'Estudio', plural: 'Estudios' },
  { value: 'course', label: 'Curso', plural: 'Cursos y certificaciones' },
  { value: 'skill', label: 'Habilidad', plural: 'Habilidades' },
  { value: 'language', label: 'Idioma', plural: 'Idiomas' },
  { value: 'achievement', label: 'Logro', plural: 'Logros' },
];

const year = (d: string | null) => (d ? d.slice(0, 4) : '');
const period = (e: CvEntry) => (e.started_on ? `${year(e.started_on)} – ${e.current ? 'hoy' : year(e.ended_on) || '…'}` : '');

function asText(name: string, entries: CvEntry[]) {
  const lines = [name ? name.toUpperCase() : 'CURRÍCULUM', ''];
  for (const k of KINDS) {
    const list = entries.filter((e) => e.kind === k.value);
    if (!list.length) continue;
    lines.push(k.plural.toUpperCase());
    for (const e of list) {
      lines.push(`• ${e.title}${e.organization ? ` — ${e.organization}` : ''}${period(e) ? ` (${period(e)})` : ''}`);
      if (e.description) lines.push(`  ${e.description}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export default function CvScreen() {
  const cv = useCv();
  const [adding, setAdding] = useState(false);
  const groups = KINDS.map((k) => ({ ...k, list: cv.entries.filter((e) => e.kind === k.value) })).filter((g) => g.list.length);

  return (
    <Screen>
      <ModuleHeader kicker="Personal" title="CV" />
      <Button label="+ Agregar" onPress={() => setAdding(true)} />
      {cv.entries.length ? <Button label="Compartir como texto" kind="secondary" onPress={() => Share.share({ message: asText('', cv.entries) })} /> : null}
      {groups.length ? (
        groups.map((g) => (
          <Panel key={g.value}>
            <Kicker>{g.plural}</Kicker>
            {g.list.map((e) => (
              <Row
                key={e.id}
                title={e.title}
                sub={[e.organization, period(e), e.description].filter(Boolean).join(' · ') || undefined}
                onLongPress={() =>
                  Alert.alert('¿Borrar?', `Se borra «${e.title}».`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Borrar', style: 'destructive', onPress: () => cv.remove(e.id) },
                  ])
                }
              />
            ))}
          </Panel>
        ))
      ) : (
        <Empty text="Arma tu CV de a poco: tus trabajos, estudios, cursos e idiomas. Después lo compartes cuando lo necesites." />
      )}
      <AddEntry visible={adding} onClose={() => setAdding(false)} onSave={cv.addEntry} />
    </Screen>
  );
}

function AddEntry({ visible, onClose, onSave }: { visible: boolean; onClose: () => void; onSave: (v: Omit<CvEntry, 'id'>) => Promise<unknown> }) {
  const [kind, setKind] = useState<CvKind>('job');
  const [title, setTitle] = useState('');
  const [org, setOrg] = useState('');
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [current, setCurrent] = useState(false);
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dated = kind === 'job' || kind === 'education' || kind === 'course';
  return (
    <Sheet visible={visible} title="Agregar al CV" onClose={onClose}>
      <Chips options={KINDS.map((k) => ({ value: k.value, label: k.label }))} value={kind} onChange={setKind} />
      <Field
        label={kind === 'job' ? 'Cargo' : kind === 'education' ? 'Carrera o título' : kind === 'language' ? 'Idioma y nivel' : 'Nombre'}
        value={title}
        onChangeText={setTitle}
      />
      {dated ? <Field label={kind === 'job' ? 'Empresa' : 'Institución'} value={org} onChangeText={setOrg} /> : null}
      {dated ? (
        <>
          <DateField label="Desde" value={start} onChange={setStart} />
          <Chips options={[{ value: 'yes', label: current ? '✓ Sigo aquí' : 'Sigo aquí' }]} value={current ? 'yes' : null} onChange={() => setCurrent(!current)} />
          {!current ? <DateField label="Hasta" value={end} onChange={setEnd} /> : null}
        </>
      ) : null}
      <Field label="Detalle (opcional)" value={desc} onChangeText={setDesc} multiline />
      {error ? <Notice text={error} /> : null}
      <Button
        label="Guardar"
        loading={busy}
        onPress={async () => {
          if (!title.trim()) return setError('Escribe el nombre.');
          setBusy(true);
          setError(null);
          try {
            await onSave({ kind, title: title.trim(), organization: org.trim() || null, started_on: start, ended_on: current ? null : end, current, description: desc.trim() || null });
            tap();
            setTitle('');
            setOrg('');
            setDesc('');
            setStart(null);
            setEnd(null);
            setCurrent(false);
            onClose();
          } catch (e) {
            setError(authErrorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      />
      <AppText variant="caption" muted>
        Mantén presionado un elemento para borrarlo.
      </AppText>
    </Sheet>
  );
}
