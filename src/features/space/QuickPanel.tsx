import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setMark } from '@/data/day';
import { useEntries } from '@/data/entries';
import { useHabits } from '@/data/modules';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';
import {
  AirplaneIcon,
  BarbellIcon,
  BookOpenIcon,
  CalendarPlusIcon,
  CarIcon,
  ChatCircleTextIcon,
  CheckIcon,
  CoffeeIcon,
  DropIcon,
  FileTextIcon,
  ForkKnifeIcon,
  GasPumpIcon,
  HeartIcon,
  HeartbeatIcon,
  ListChecksIcon,
  NotePencilIcon,
  PillIcon,
  PlusIcon,
  ShoppingCartIcon,
  SlidersIcon,
  SmileyIcon,
  UsersThreeIcon,
  WalletIcon,
  type Icon,
} from '@/ui/icons';

// El + como el centro de control del iPhone (usuario, 26-10-2026): una grilla de accesos que cada
// persona elige y ordena. La elección se guarda sincronizada (motor común, módulo «severa»).

type Action = { id: string; label: string; Icon: Icon; go?: Href; run?: () => string | void; work?: boolean };

const DEFAULT = ['agua', 'evento', 'tarea', 'gasto', 'ingreso', 'diario', 'habito', 'asistente'];

export function QuickPanel({ visible, onClose, day, pauses }: { visible: boolean; onClose: () => void; day: string; pauses: number }) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const h = useHabits(day);
  const prefs = useEntries('severa');
  const saved = prefs.of('ajuste').find((e) => e.title === 'rapido') ?? null;
  const chosen = Array.isArray(saved?.data.ids) ? (saved!.data.ids as string[]) : DEFAULT;
  const water = h.habits.find((x) => x.template_code === 'agua') ?? h.habits.find((x) => /agua/i.test(x.name));

  const actions: Action[] = [
    {
      id: 'agua',
      label: 'Agua',
      Icon: DropIcon,
      ...(water
        ? {
            run: () => {
              const n = h.countFor(water.id) + 1;
              h.log(water.id, 1);
              return `${water.name}: ${n} de ${Number(water.daily_target) || 1}`;
            },
          }
        : { go: '/habitos' as Href }),
    },
    { id: 'evento', label: 'Evento', Icon: CalendarPlusIcon, go: { pathname: '/calendario', params: { nuevo: 'event' } } },
    { id: 'tarea', label: 'Tarea', Icon: ListChecksIcon, go: { pathname: '/calendario', params: { nuevo: 'task' } } },
    { id: 'gasto', label: 'Gasto', Icon: WalletIcon, go: { pathname: '/finanzas', params: { nuevo: 'expense' } } },
    { id: 'ingreso', label: 'Ingreso', Icon: PlusIcon, go: { pathname: '/finanzas', params: { nuevo: 'income' } } },
    { id: 'diario', label: 'Diario', Icon: NotePencilIcon, go: '/diario' },
    { id: 'gratitud', label: 'Gratitud', Icon: HeartIcon, go: { pathname: '/diario', params: { tab: 'gratitud' } } },
    { id: 'habito', label: 'Hábitos', Icon: CheckIcon, go: '/habitos' },
    { id: 'asistente', label: 'Severa', Icon: ChatCircleTextIcon, go: '/asistente' },
    { id: 'ejercicio', label: 'Ejercicio', Icon: BarbellIcon, go: { pathname: '/modulo/[code]', params: { code: 'ejercicio', nuevo: 'sesion' } } },
    { id: 'comida', label: 'Comida', Icon: ForkKnifeIcon, go: { pathname: '/modulo/[code]', params: { code: 'alimentacion', nuevo: 'comida' } } },
    { id: 'super', label: 'Súper', Icon: ShoppingCartIcon, go: { pathname: '/modulo/[code]', params: { code: 'alimentacion', nuevo: 'compra' } } },
    { id: 'remedio', label: 'Remedios', Icon: PillIcon, go: { pathname: '/modulo/[code]', params: { code: 'salud' } } },
    { id: 'sintoma', label: 'Síntoma', Icon: HeartbeatIcon, go: { pathname: '/modulo/[code]', params: { code: 'salud', nuevo: 'sintoma' } } },
    { id: 'compartido', label: 'Compartido', Icon: UsersThreeIcon, go: { pathname: '/modulo/[code]', params: { code: 'gastos_compartidos' } } },
    { id: 'viaje', label: 'Viajes', Icon: AirplaneIcon, go: { pathname: '/modulo/[code]', params: { code: 'viajes' } } },
    { id: 'documento', label: 'Documento', Icon: FileTextIcon, go: { pathname: '/modulo/[code]', params: { code: 'documentos', nuevo: 'documento' } } },
    { id: 'biblia', label: 'Biblia', Icon: BookOpenIcon, go: '/biblia' },
    { id: 'animo', label: 'Ánimo', Icon: SmileyIcon, go: '/diario' },
    { id: 'jornada', label: 'Jornada', Icon: CarIcon, go: '/trabajo', work: true },
    { id: 'bencina', label: 'Bencina', Icon: GasPumpIcon, go: { pathname: '/finanzas', params: { nuevo: 'expense' } }, work: true },
    { id: 'pausa', label: 'Pausa', Icon: CoffeeIcon, run: () => (setMark(day, 'h:pausa', { value: pauses + 1 }), 'Pausa registrada'), work: true },
  ];
  const byId = new Map(actions.map((a) => [a.id, a]));
  const shown = [...chosen, ...(mode === 'work' ? ['jornada', 'pausa'] : [])].filter((id, i, all) => all.indexOf(id) === i).map((id) => byId.get(id)).filter((a): a is Action => !!a);

  async function toggle(id: string) {
    tap();
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    try {
      if (saved) await prefs.update(saved.id, { data: { ids: next } });
      else await prefs.add({ kind: 'ajuste', title: 'rapido', data: { ids: next } });
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'No se pudo guardar.');
    }
  }

  const tile = (a: Action, on: boolean, onPress: () => void) => (
    <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={a.label} onPress={onPress} style={styles.cell}>
      <View style={[styles.round, { backgroundColor: on ? colors.accent : colors.surface2 }]}>
        <a.Icon size={26} color={on ? colors.onAccent : colors.text} weight={on ? 'fill' : 'regular'} />
      </View>
      <AppText variant="caption" numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 12 }}>
        {a.label}
      </AppText>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <Animated.View entering={ZoomIn.duration(220)} style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <AppText variant="subtitle">{editing ? 'Elige tus accesos' : 'Registro rápido'}</AppText>
            <AppText variant="caption" color={note ? colors.accent : colors.muted}>
              {editing ? 'Toca para sumar o quitar. Quedan en el orden en que los eliges.' : (note ?? 'Toca lo que quieres anotar.')}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={editing ? 'Listo' : 'Personalizar'}
            onPress={() => {
              tap();
              setEditing(!editing);
            }}
            style={[styles.edit, { backgroundColor: editing ? colors.accent : colors.surface2 }]}
          >
            {editing ? (
              <AppText variant="label" color={colors.onAccent}>
                Listo
              </AppText>
            ) : (
              <SlidersIcon size={20} color={colors.text} />
            )}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.grid}>
          {editing
            ? actions.filter((a) => !a.work || mode === 'work').map((a) => tile(a, chosen.includes(a.id), () => toggle(a.id)))
            : shown.map((a) =>
                tile(a, false, () => {
                  tap();
                  if (a.go) {
                    onClose();
                    router.push(a.go);
                    return;
                  }
                  setNote(a.run?.() ?? null);
                }),
              )}
        </ScrollView>
        {note && !editing ? (
          <Animated.View entering={FadeIn}>
            <AppText variant="caption" color={colors.ok} style={{ textAlign: 'center' }}>
              {`✓ ${note}`}
            </AppText>
          </Animated.View>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { position: 'absolute', left: 10, right: 10, bottom: 10, borderRadius: 32, padding: space.lg, gap: space.md, maxHeight: '78%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  edit: { minWidth: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  cell: { width: '25%', alignItems: 'center', gap: 6 },
  round: { width: 60, height: 60, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
