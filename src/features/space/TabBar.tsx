import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dayKey } from '@/core/today';
import { setMark, useDayMarks } from '@/data/day';
import { QuickHabitsBar } from '@/features/today/WorkToday';
import { QuickPanel } from './QuickPanel';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';
import { CalendarBlankIcon, ChatCircleTextIcon, HouseIcon, PlusIcon, SquaresFourIcon, type Icon } from '@/ui/icons';

// Barra inferior (sistema de diseño §5). Ajustes queda en el engranaje de arriba. En Trabajo, encima va la barra de hábitos rápidos (A3). El + abre el registro rápido
// personalizable (QuickPanel).

// 26-10-2026 (noche, usuario: «quisiera sacar el botón de Trabajo de la barra inferior, con el
// botón superior está bien»): Hoy · Calendario · + · Metas · Módulos. Metas es lo central para
// cumplir objetivos (TDAH); Trabajo se abre con el interruptor de arriba.
// 27-10-2026 (usuario: «Metas no me convence del todo… dejaría algo como ideas, quizás el asistente
// estaría bien»): en su lugar va el Asistente, que también guarda ideas; Metas se abre desde Hoy
// («Tu próximo paso»), Módulos y Cuerpo, mente y alma. Ya no hace falta su botón flotante.
const TABS: Record<string, { label: string; Icon: Icon }> = {
  index: { label: 'Hoy', Icon: HouseIcon },
  calendario: { label: 'Calendario', Icon: CalendarBlankIcon },
  modulos: { label: 'Módulos', Icon: SquaresFourIcon },
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Asistente"
          onPress={() => {
            tap();
            router.push('/asistente');
          }}
          style={styles.tab}
        >
          <ChatCircleTextIcon size={24} color={colors.muted} />
          <AppText variant="caption" color={colors.muted} style={styles.label}>
            Asistente
          </AppText>
        </Pressable>
        {routes.slice(2).map((r) => tabButton(r.name))}
      </View>
      <QuickPanel visible={quick} onClose={() => setQuick(false)} day={day} pauses={marks['h:pausa']?.value ?? 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  label: { fontFamily: fonts.bold, fontSize: 11 },
  plus: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: -22 },
});
