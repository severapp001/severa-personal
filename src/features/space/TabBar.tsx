import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dayKey } from '@/core/today';
import { setMark, useDayMarks } from '@/data/day';
import { useHabits } from '@/data/modules';
import { QuickHabitsBar } from '@/features/today/WorkToday';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';
import {
  CalendarBlankIcon,
  CheckIcon,
  CoffeeIcon,
  DropIcon,
  GearIcon,
  HouseIcon,
  PencilSimpleIcon,
  PlusIcon,
  SquaresFourIcon,
  WalletIcon,
  type Icon,
} from '@/ui/icons';

// Barra inferior (sistema de diseño §5): Hoy · Calendario · + · Módulos · Ajustes. En Trabajo,
// encima va la barra de hábitos rápidos (A3). El + abre el registro rápido (F03). El asistente
// tiene su propio botón flotante (AssistantFab).

const TABS: Record<string, { label: string; Icon: Icon }> = {
  index: { label: 'Hoy', Icon: HouseIcon },
  calendario: { label: 'Calendario', Icon: CalendarBlankIcon },
  modulos: { label: 'Módulos', Icon: SquaresFourIcon },
  ajustes: { label: 'Ajustes', Icon: GearIcon },
};

export function TabBar({ state, navigation, onHeight }: BottomTabBarProps & { onHeight?: (height: number) => void }) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const day = dayKey(new Date());
  const marks = useDayMarks(day);
  const [quick, setQuick] = useState(false);
  const routes = state.routes.filter((r) => TABS[r.name]);

  const tabButton = (name: string) => {
    const index = state.routes.findIndex((r) => r.name === name);
    const route = state.routes[index];
    if (!route) return null;
    const focused = state.index === index;
    const { label, Icon } = TABS[name];
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        onPress={() => {
          tap();
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        style={styles.tab}
      >
        <Icon size={24} weight={focused ? 'fill' : 'regular'} color={focused ? colors.accent : colors.muted} />
        <AppText variant="caption" color={focused ? colors.accent : colors.muted} style={styles.label}>
          {label}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View onLayout={(e) => onHeight?.(e.nativeEvent.layout.height)}>
      {mode === 'work' ? <QuickHabitsBar day={day} pauses={marks['h:pausa']?.value ?? 0} onPause={() => setMark(day, 'h:pausa', { value: (marks['h:pausa']?.value ?? 0) + 1 })} /> : null}
      <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, 10) }]}>
        {routes.slice(0, 2).map((r) => tabButton(r.name))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Registro rápido"
          onPress={() => {
            tap();
            setQuick(true);
          }}
          style={styles.tab}
        >
          <View style={[styles.plus, { backgroundColor: colors.accent }]}>
            <PlusIcon size={26} weight="bold" color={colors.onAccent} />
          </View>
        </Pressable>
        {routes.slice(2).map((r) => tabButton(r.name))}
      </View>
      <QuickSheet visible={quick} onClose={() => setQuick(false)} day={day} pauses={marks['h:pausa']?.value ?? 0} />
    </View>
  );
}

function QuickSheet({ visible, onClose, day, pauses }: { visible: boolean; onClose: () => void; day: string; pauses: number }) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState<string | null>(null);
  // El agua suma al hábito Agua (el mismo de Personal y Trabajo); si no lo cuentas, abre Hábitos.
  const h = useHabits(day);
  const water = h.habits.find((x) => x.template_code === 'agua') ?? h.habits.find((x) => /agua/i.test(x.name));
  const options: { label: string; Icon: Icon; ready?: () => string; later?: string; go?: () => void }[] = [
    water
      ? {
          label: 'Agua',
          Icon: DropIcon,
          ready: () => {
            const n = h.countFor(water.id) + 1;
            h.log(water.id, 1);
            return `${water.name}: ${n} de ${Number(water.daily_target) || 1}`;
          },
        }
      : { label: 'Agua', Icon: DropIcon, go: () => router.push('/habitos') },
    mode === 'work'
      ? { label: 'Pausa', Icon: CoffeeIcon, ready: () => (setMark(day, 'h:pausa', { value: pauses + 1 }), 'Pausa registrada') }
      : { label: 'Tarea', Icon: CheckIcon, go: () => router.push('/prioridades') },
    { label: 'Gasto', Icon: WalletIcon, go: () => router.push({ pathname: '/finanzas', params: { nuevo: 'expense' } }) },
    { label: 'Ingreso', Icon: PlusIcon, go: () => router.push({ pathname: '/finanzas', params: { nuevo: 'income' } }) },
    { label: 'Hábito', Icon: CheckIcon, go: () => router.push('/habitos') },
    { label: 'Diario', Icon: PencilSimpleIcon, go: () => router.push('/diario') },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.lg }]}>
        <AppText variant="subtitle">Registro rápido</AppText>
        {note ? (
          <AppText variant="caption" color={colors.accent}>
            {note}
          </AppText>
        ) : (
          <AppText variant="caption" muted>
            Toca lo que quieres anotar.
          </AppText>
        )}
        <View style={styles.grid}>
          {options.map(({ label, Icon, ready, later, go }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              onPress={() => {
                tap();
                if (go) {
                  onClose();
                  go();
                  return;
                }
                setNote(ready ? ready() : (later ?? null));
              }}
              style={[styles.option, { backgroundColor: colors.surface2 }]}
            >
              <Icon size={24} color={colors.accent} />
              <AppText variant="label" style={{ fontSize: 13 }}>
                {label}
              </AppText>
              {later ? (
                <AppText variant="caption" muted style={{ fontSize: 11 }}>
                  Pronto
                </AppText>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  label: { fontFamily: fonts.bold, fontSize: 11 },
  plus: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: -22 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.xl, gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { width: '48%', flexGrow: 1, borderRadius: radius.md, padding: space.md, alignItems: 'center', gap: 4 },
});
