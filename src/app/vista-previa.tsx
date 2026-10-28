import { useState, type ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import type { Neuron, NeuronState, Synapse } from '@/core/discovery';
import AsistenteScreen from '@/app/(personal)/asistente';
import CuerpoMenteAlmaScreen from '@/app/(personal)/cuerpo-mente-alma';
import JuegosScreen from '@/app/(personal)/juegos';
import PerfilScreen from '@/app/(personal)/perfil';
import LogrosScreen from '@/app/(personal)/logros';
import ResumenScreen from '@/app/(personal)/resumen';
import FinanzasScreen from '@/app/(personal)/finanzas';
import EstudiosScreen from '@/app/(personal)/estudios';
import TrabajoScreen from '@/app/(personal)/(tabs)/trabajo';
import InicioScreen from '@/app/(personal)/(tabs)/index';
import ModulosScreen from '@/app/(personal)/(tabs)/modulos';
import CalendarioScreen from '@/app/(personal)/(tabs)/calendario';
import HabitosScreen from '@/app/(personal)/habitos';
import MetasScreen from '@/app/(personal)/metas';
import ZenScreen from '@/app/(personal)/zen';
import RespiracionScreen from '@/app/(personal)/respiracion';
import MeditacionScreen from '@/app/(personal)/meditacion';
import CierreScreen from '@/app/(personal)/cierre';
import AjustesScreen from '@/app/(personal)/(tabs)/ajustes';
import SaludMentalScreen from '@/app/(personal)/salud-mental';
import PrioridadesScreen from '@/app/(personal)/prioridades';
import { RoutineScreen } from '@/features/routine/RoutineScreen';
import { IntroOverlay } from '@/features/welcome/IntroOverlay';
import { LiveBrain } from '@/features/discovery/LiveBrain';
import { MODULES } from '@/features/modules/catalog';
import { ModuleBody } from '@/features/modules/ModuleScreen';
import { setCrossDurationForPreview, SpaceCrossProvider, useCross } from '@/features/space/SpaceCross';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Screen } from '@/ui';
import { PillTabs } from '@/ui/kit';

// Solo en desarrollo (no existe en la APK): revisar en el navegador el cerebro vivo y el cruce
// entre hemisferios sin iniciar sesión, con neuronas de ejemplo (las mismas del catálogo).

const RAW: [string, string, 'personal' | 'work' | 'bridge', number][] = [
  ['tu_rutina', 'Tu rutina', 'bridge', 2], ['perfil_personal', 'Perfil personal', 'personal', 0], ['calendario', 'Calendario', 'personal', 1], ['finanzas', 'Finanzas', 'personal', 1],
  ['habitos', 'Hábitos', 'personal', 1], ['prioridades', 'Prioridades', 'personal', 1], ['resumen', 'Resumen', 'personal', 1], ['alimentacion', 'Alimentación', 'personal', 2],
  ['documentos', 'Documentos', 'personal', 2], ['ejercicio', 'Ejercicio', 'personal', 2], ['estudios', 'Estudios', 'personal', 2], ['gastos_compartidos', 'Gastos compartidos', 'personal', 2],
  ['biblia', 'Biblia', 'personal', 3], ['biografia', 'Biografía', 'personal', 3], ['cv', 'CV', 'personal', 3], ['diario', 'Diario', 'personal', 3], ['familia_y_mascotas', 'Familia y mascotas', 'personal', 3],
  ['foda_personal', 'FODA personal', 'personal', 3], ['gratitud', 'Gratitud', 'personal', 3], ['juegos', 'Juegos', 'personal', 3], ['logros', 'Logros', 'personal', 3], ['viajes', 'Viajes', 'personal', 3],
  ['intimo_y_ciclo', 'Íntimo y ciclo', 'personal', 4], ['salud', 'Salud', 'personal', 4], ['trabajo', 'Trabajo', 'work', 0], ['agenda_y_citas', 'Agenda y citas', 'work', 1], ['cobros_y_boletas', 'Cobros y boletas', 'work', 1],
  ['habitos_rapidos_en_trabajo', 'Hábitos rápidos', 'work', 1], ['jornada', 'Jornada', 'work', 1], ['tareas_del_trabajo', 'Tareas del trabajo', 'work', 1], ['clientes_y_pacientes', 'Clientes', 'work', 2],
  ['ficha_al_terminar', 'Ficha al terminar', 'work', 2], ['gastos_del_trabajo', 'Gastos del trabajo', 'work', 2], ['pedidos_y_costeo', 'Pedidos', 'work', 2], ['recorridos', 'Recorridos', 'work', 2],
  ['turnos_y_faenas', 'Turnos y faenas', 'work', 2], ['ventas_y_productos', 'Ventas', 'work', 2], ['documentos_laborales', 'Documentos laborales', 'work', 3],
];
const NEURONS: Neuron[] = RAW.map(([code, name, hemisphere, level], i) => ({ code, name, hemisphere, level, minimum: null, summary: null, sensitive: false, min_age: 14, sort_order: i + 1 }));
const PAIRS = 'alimentacion-habitos alimentacion-salud biblia-gratitud biblia-diario biografia-diario calendario-estudios calendario-prioridades calendario-salud cobros_y_boletas-finanzas cv-trabajo cv-estudios diario-gratitud diario-habitos diario-prioridades documentos-finanzas documentos-salud ejercicio-habitos ejercicio-salud finanzas-gastos_compartidos finanzas-habitos finanzas-resumen finanzas-viajes finanzas-jornada habitos-logros habitos-prioridades habitos-habitos_rapidos_en_trabajo jornada-recorridos jornada-trabajo jornada-tu_rutina prioridades-tareas_del_trabajo tareas_del_trabajo-trabajo agenda_y_citas-calendario clientes_y_pacientes-cobros_y_boletas';
const SYNAPSES: Synapse[] = PAIRS.split(' ').map((p) => {
  const [a, b] = p.split('-');
  return { neuron_a: a, neuron_b: b };
});
const ON = ['calendario', 'finanzas', 'habitos', 'prioridades', 'resumen', 'diario', 'biblia', 'gratitud', 'estudios', 'trabajo', 'jornada', 'recorridos', 'tareas_del_trabajo', 'habitos_rapidos_en_trabajo', 'perfil_personal'];
const STATES: Record<string, NeuronState> = Object.fromEntries([...ON.map((c) => [c, 'discovered']), ['salud', 'suggested'], ['ejercicio', 'suggested'], ['alimentacion', 'suggested']]);

export default function VistaPrevia() {
  return (
    <SpaceCrossProvider>
      <Preview />
    </SpaceCrossProvider>
  );
}

function Preview() {
  const { width } = useWindowDimensions();
  const { mode } = useTheme();
  const cross = useCross();
  const [tab, setTab] = useState<'brain' | 'cross' | 'screens'>('brain');
  const [screen, setScreen] = useState<string | null>(null);
  const [replay, setReplay] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const screens: Record<string, ReactNode> = {
    'Intro (palabras → logo)': <IntroOverlay key={replay} preview />,
    Inicio: <InicioScreen />,
    Módulos: <ModulosScreen />,
    Calendario: <CalendarioScreen />,
    Hábitos: <HabitosScreen />,
    Metas: <MetasScreen />,
    Zen: <ZenScreen />,
    Respiración: <RespiracionScreen />,
    Meditación: <MeditacionScreen />,
    'Cerrar el día': <CierreScreen />,
    Ajustes: <AjustesScreen />,
    'Salud mental': <SaludMentalScreen />,
    Prioridades: <PrioridadesScreen />,
    'Tu rutina (pantalla nueva)': <RoutineScreen />,
    Resumen: <ResumenScreen />,
    Perfil: <PerfilScreen />,
    'Cuerpo, mente y alma': <CuerpoMenteAlmaScreen />,
    Asistente: <AsistenteScreen />,
    Logros: <LogrosScreen />,
    Juegos: <JuegosScreen />,
    Finanzas: <FinanzasScreen />,
    Estudios: <EstudiosScreen />,
    Trabajo: <TrabajoScreen />,
    ...Object.fromEntries(Object.values(MODULES).map((m) => [m.title, <ModuleBody key={m.code} def={m} />])),
  };
  if (screen) {
    return (
      <View style={{ flex: 1 }}>
        {screens[screen]}
        <Pressable accessibilityRole="button" onPress={() => setScreen(null)} style={{ position: 'absolute', right: 16, bottom: 24, backgroundColor: '#D4AF5A', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}>
          <AppText variant="label" color="#0B0B0C">
            Volver a la vista previa
          </AppText>
        </Pressable>
      </View>
    );
  }
  return (
    <Screen>
      <AppText variant="title">Vista previa</AppText>
      <PillTabs
        options={[
          { value: 'brain', label: 'Cerebro vivo' },
          { value: 'cross', label: 'Cruce de hemisferio' },
          { value: 'screens', label: 'Pantallas' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'brain' ? (
        <>
          <View style={{ alignItems: 'center' }}>
            <LiveBrain neurons={NEURONS} synapses={SYNAPSES} states={STATES} width={Math.min(width, 520) - 48} replay={replay} selected={selected} labels={!!selected} />
          </View>
          <Button label="Ver nacer otra vez" onPress={() => setReplay((r) => r + 1)} />
          <Button label={selected ? 'Quitar selección' : 'Seleccionar Finanzas'} kind="secondary" onPress={() => setSelected(selected ? null : 'finanzas')} />
        </>
      ) : tab === 'screens' ? (
        <View style={{ gap: 8 }}>
          {Object.keys(screens).map((k) => (
            <Button key={k} label={k} kind="secondary" onPress={() => setScreen(k)} />
          ))}
        </View>
      ) : (
        <>
          <AppText muted>{`Ahora estás en ${mode === 'work' ? 'Trabajo' : 'Personal'}.`}</AppText>
          <Button label={mode === 'work' ? 'Cruzar a Personal' : 'Cruzar a Trabajo'} onPress={() => (setCrossDurationForPreview(1050), cross(mode === 'work' ? 'personal' : 'work'))} />
          <Button label="En cámara lenta (8 s)" kind="secondary" onPress={() => (setCrossDurationForPreview(8000), cross(mode === 'work' ? 'personal' : 'work'))} />
        </>
      )}
    </Screen>
  );
}
