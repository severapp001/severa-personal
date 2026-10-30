import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { plusDays } from '@/core/modules';
import { dayKey } from '@/core/today';
import type { Entries, Entry } from '@/data/entries';
import { MODULES } from '@/features/modules/catalog';
import { ModuleHomeCard } from '@/features/today/ModuleHomeCard';
import { setDemoData } from '@/data/demo';
import { AgendaPrioritiesCard } from '@/features/agenda/PrioritiesCard';
import { NextStepCard } from '@/features/goals/NextStepCard';
import { Figure } from '@/features/today/Figure';
import { HabitsCard } from '@/features/today/HabitsCard';
import { BreathCard, MeditationCard, ZenCard } from '@/features/today/MindCards';
import { BibleCard, DayCard, JournalCard, MoneyCard } from '@/features/today/PersonalCards';
import { useToday } from '@/features/today/useToday';
import { demoSource } from '@/features/web/demoData';
import { useTheme } from '@/theme/ThemeProvider';

// Solo en desarrollo (no existe en la APK ni en la web publicada): las tarjetas de Inicio de cada
// módulo con datos de ejemplo, para fotografiarlas para la landing (web/landing, frente Y, 29-10-2026).
// `/vitrina?card=salud` muestra una sola, del ancho de un teléfono.

let seq = 0;
const e = (module: string, kind: string, v: Partial<Entry> = {}): Entry => ({
  id: `demo-${(seq += 1)}`,
  module,
  kind,
  parent_id: null,
  person_id: null,
  title: null,
  body: null,
  day: null,
  until: null,
  amount: null,
  value: null,
  done: false,
  data: {},
  created_at: null,
  ...v,
});

const demoStore = (entries: Entry[]) =>
  ({
    space: null,
    entries,
    of: (kind: string, parentId?: string | null) => entries.filter((x) => x.kind === kind && (parentId === undefined || x.parent_id === parentId)),
    children: (parentId: string) => entries.filter((x) => x.parent_id === parentId),
    add: async () => undefined,
    update: async () => undefined,
    remove: async () => undefined,
  }) as unknown as Entries;

function demoData(t: string): Record<string, Entry[]> {
  const wd = new Date(`${t}T12:00:00`).getDay();
  const monday = plusDays(t, wd === 0 ? -6 : 1 - wd);
  const losartan = e('salud', 'remedio', { title: 'Losartán', data: { dosis: '50 mg', veces: 1, hora: '08:00' } });
  const omeprazol = e('salud', 'remedio', { title: 'Omeprazol', data: { dosis: '20 mg', veces: 2, hora: '08:00' } });
  const vitamina = e('salud', 'remedio', { title: 'Vitamina D', data: { dosis: '1 cápsula', veces: 1 } });
  const correr = e('metas', 'meta', { title: 'Correr 10K', data: { parte: 'Cuerpo' } });
  const leer = e('metas', 'meta', { title: 'Leer 12 libros', data: { parte: 'Mente' } });
  const orar = e('metas', 'meta', { title: 'Orar cada mañana', data: { parte: 'Alma' } });
  const pasos = (m: Entry, total: number, done: number) => Array.from({ length: total }, (_, i) => e('metas', 'paso', { parent_id: m.id, title: `Paso ${i + 1}`, done: i < done }));
  const turnos = ['Día', 'Día', 'Noche', 'Noche', 'Libre', 'Libre', 'Día'];
  return {
    salud: [losartan, omeprazol, vitamina, e('salud', 'toma', { parent_id: losartan.id, day: t, done: true }), e('salud', 'toma', { parent_id: omeprazol.id, day: t, done: true })],
    ejercicio: [
      e('ejercicio', 'sesion', { title: 'Caminata', day: monday, value: 35 }),
      e('ejercicio', 'sesion', { title: 'Bicicleta', day: plusDays(monday, 2), value: 45 }),
      e('ejercicio', 'sesion', { title: 'Trote', day: t, value: 30 }),
    ].filter((x) => (x.day ?? '') <= t),
    alimentacion: [
      e('alimentacion', 'medida', { day: plusDays(t, -2), value: 72.4, data: { estatura: 172, sexo: 'Hombre', actividad: 'Moderada' } }),
      e('alimentacion', 'medida', { day: plusDays(t, -32), value: 73.6, data: { estatura: 172, sexo: 'Hombre', actividad: 'Moderada' } }),
    ],
    documentos: [
      e('documentos', 'documento', { title: 'Licencia de conducir', until: plusDays(t, 9), data: { tipo: 'Licencia' } }),
      e('documentos', 'documento', { title: 'Permiso de circulación', until: plusDays(t, 21), data: { tipo: 'Vehículo' } }),
      e('documentos', 'documento', { title: 'Cédula de identidad', until: plusDays(t, 52), data: { tipo: 'Identidad' } }),
    ],
    tu_rutina: [
      e('tu_rutina', 'bloque', { title: 'Gimnasio', data: { dias: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'], desde: '07:00', hasta: '08:00' } }),
      e('tu_rutina', 'bloque', { title: 'Trabajo', data: { dias: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'], desde: '09:00', hasta: '18:00' } }),
      e('tu_rutina', 'bloque', { title: 'Clases de inglés', data: { dias: ['Mar', 'Jue'], desde: '19:30', hasta: '21:00' } }),
      e('tu_rutina', 'bloque', { title: 'Feria', data: { dias: ['Sáb'], desde: '10:00' } }),
    ],
    metas: [correr, leer, orar, ...pasos(correr, 4, 3), ...pasos(leer, 12, 5), ...pasos(orar, 3, 1)],
    turnos_y_faenas: turnos.map((tipo, i) => e('turnos_y_faenas', 'turno', { day: plusDays(t, i), data: { tipo } })),
    ventas_y_productos: [
      ...[12990, 8500, 24000].map((amount) => e('ventas_y_productos', 'venta', { day: t, amount })),
      ...[31000, 18990, 45500, 22000, 9990, 37500].map((amount, i) => e('ventas_y_productos', 'venta', { day: plusDays(t, -(i + 1)), amount })),
    ],
    cobros_y_boletas: [
      e('cobros_y_boletas', 'cobro', { title: 'Asesoría', day: plusDays(t, -3), amount: 450000, done: true, data: { forma: 'Boleta de honorarios' } }),
      e('cobros_y_boletas', 'cobro', { title: 'Taller', day: plusDays(t, -10), amount: 180000, done: true, data: { forma: 'Transferencia' } }),
      e('cobros_y_boletas', 'cobro', { title: 'Mantención', day: plusDays(t, 5), amount: 120000 }),
    ],
  };
}

// Las tarjetas que leen de verdad (Tu día, Tu plata, Hábitos, Prioridades, Pan de vida…): usan los datos
// de ejemplo de features/web/demoData.ts a través de data/demo.ts, mientras la vitrina está abierta.
const LIVE = ['dia', 'plata', 'habitos', 'prio', 'paso', 'pan', 'meditacion', 'respiracion', 'cierre'];

function LiveCard({ code }: { code: string }) {
  const t = useToday();
  switch (code) {
    case 'dia':
      return <DayCard t={t} onSeeAll={() => undefined} />;
    case 'plata':
      return <MoneyCard t={t} />;
    case 'habitos':
      return <HabitsCard t={t} />;
    case 'prio':
      return <AgendaPrioritiesCard day={t.day} />;
    case 'paso':
      return <NextStepCard day={t.day} />;
    case 'pan':
      return <BibleCard t={t} />;
    case 'meditacion':
      return <MeditationCard day={t.day} />;
    case 'respiracion':
      return <BreathCard day={t.day} />;
    case 'cierre':
      return <JournalCard t={t} />;
    default:
      return null;
  }
}

export default function VitrinaScreen() {
  const { colors } = useTheme();
  const { card } = useLocalSearchParams<{ card?: string }>();
  const [today] = useState(() => dayKey(new Date()));
  const [data] = useState(() => demoData(today));
  // Los datos de ejemplo se ponen antes de que se dibujen las tarjetas y se quitan al salir.
  const [source] = useState(() => {
    const src = demoSource(today);
    setDemoData(src);
    return src;
  });
  // Se vuelve a poner en el efecto: en desarrollo React monta dos veces y la limpieza la borraría.
  useEffect(() => {
    setDemoData(source);
    return () => setDemoData(null);
  }, [source]);
  const codes = card ? [card] : [...Object.keys(data), 'zen', 'figura', ...LIVE];
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 10, gap: 12, width: card === 'figura' ? 460 : 380 }}>
      {codes.map((code) => {
        if (code === 'zen') return <ZenCard key={code} day={today} />;
        if (code === 'figura') return <Figure key={code} day={today} size={440} demo={{ cuerpo: 71, mente: 62, alma: 48 }} />;
        if (LIVE.includes(code)) return <LiveCard key={code} code={code} />;
        const def = MODULES[code];
        if (!def || !data[code]) return null;
        return (
          <View key={code} nativeID={`tarjeta-${code}`}>
            <ModuleHomeCard def={def} today={today} demo={{ store: demoStore(data[code]), age: 34 }} />
          </View>
        );
      })}
    </ScrollView>
  );
}
