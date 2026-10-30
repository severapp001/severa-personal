import { router, usePathname, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import type { Part } from '@/core/modules';
import { dayKey } from '@/core/today';
import { useDayMarks } from '@/data/day';
import { CAPAS, PART_INFO } from '@/core/parts';
import { usePartColors } from '@/features/today/Figure';
import { setCapa, useCapa, useCapaColors, useV3 } from '@/features/v3/useV3';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText } from '@/ui';
import { CalendarBlankIcon, ChatCircleTextIcon, GearIcon, PlusIcon, SquaresFourIcon, type Icon } from '@/ui/icons';
import { Logo, LogoCuatro } from '@/ui/Logo';
import { QuickPanel } from './QuickPanel';
import { SpaceSwitch } from './SpaceHeader';

// Barra de arriba del escritorio (29-10-2026, dirección A de Severa v3 elegida por el usuario).
// Con «Probar Severa v3» encendido, las pestañas son el selector Ser · Cuerpo · Mente · Alma (C68), sin
// el interruptor Personal/Trabajo, y el logo de cuatro abre «Tu cuerpo».
// reemplaza al menú lateral, que «se veía como algo clásico de IA». La persona es la navegación:
// Hoy (la figura) · Cuerpo · Mente · Alma, cada parte con su color. A la derecha, SeveraOS
// (también con Ctrl K), Registrar, Calendario, Módulos, el interruptor de Trabajo y Ajustes.

const PARTS: { part: Part; label: string }[] = [
  { part: 'cuerpo', label: 'Cuerpo' },
  { part: 'mente', label: 'Mente' },
  { part: 'alma', label: 'Alma' },
];

function IconLink({ label, href, Icon, active }: { label: string; href: Href; Icon: Icon; active: boolean }) {
  const { colors } = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => router.navigate(href)}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={[styles.icon, { backgroundColor: active ? colors.accentSoft : hover ? colors.surface2 : 'transparent' }]}
    >
      <Icon size={20} color={active ? colors.accent : colors.text} />
    </Pressable>
  );
}

export function TopNav() {
  const { colors } = useTheme();
  const tint = usePartColors();
  const capaTint = useCapaColors();
  const { on: v3 } = useV3();
  const capa = useCapa();
  const path = usePathname();
  const [quick, setQuick] = useState(false);
  const day = dayKey(new Date());
  const marks = useDayMarks(day);

  // Ctrl K (o ⌘K) abre SeveraOS desde cualquier pantalla, como en un programa del computador.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        router.push('/asistente');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tab = (label: string, href: Href, active: boolean, color: string) => (
    <Pressable key={label} accessibilityRole="link" accessibilityState={{ selected: active }} onPress={() => router.navigate(href)} style={[styles.tab, active && { backgroundColor: colors.text }]}>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 14 }} color={active ? colors.bg : color}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <View style={[styles.bar, { borderBottomColor: colors.line }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={v3 ? 'Abrir tu cuerpo' : 'Abrir tu cerebro'} onPress={() => router.push(v3 ? '/tu-cuerpo' : '/cerebro')} style={styles.brand}>
        {v3 ? <LogoCuatro size={30} lit={path === '/' && capa !== 'ser' ? capa : null} /> : <Logo size={30} />}
        <AppText style={{ fontFamily: fonts.bold, fontSize: 14, letterSpacing: 4.5 }}>SEVERA</AppText>
      </Pressable>

      <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {v3
          ? // Severa v3 (C68): el selector Ser · Cuerpo · Mente · Alma de Hoy, el mismo que en el teléfono.
            CAPAS.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="tab"
                accessibilityState={{ selected: path === '/' && capa === c }}
                onPress={() => {
                  setCapa(c);
                  if (path !== '/') router.navigate('/');
                }}
                style={[styles.tab, path === '/' && capa === c && { backgroundColor: capaTint[c] }]}
              >
                <AppText style={{ fontFamily: fonts.bold, fontSize: 14 }} color={path === '/' && capa === c ? colors.bg : capaTint[c]}>
                  {PART_INFO[c].name}
                </AppText>
              </Pressable>
            ))
          : [tab('Hoy', '/', path === '/', colors.text), ...PARTS.map(({ part, label }) => tab(label, { pathname: '/parte/[parte]', params: { parte: part } }, path === `/parte/${part}`, tint[part]))]}
      </View>

      <View style={styles.right}>
        <Pressable accessibilityRole="button" accessibilityLabel="Escribirle a SeveraOS" onPress={() => router.push('/asistente')} style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <ChatCircleTextIcon size={18} color={colors.muted} />
          <AppText variant="caption" muted style={{ flex: 1 }} numberOfLines={1}>
            Escríbele a SeveraOS…
          </AppText>
          <AppText variant="caption" muted style={[styles.kbd, { borderColor: colors.line }]}>
            Ctrl K
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Registro rápido"
          onPress={() => setQuick(true)}
          style={({ pressed }) => [styles.add, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <PlusIcon size={16} weight="bold" color={colors.onAccent} />
          <AppText variant="label" style={{ fontSize: 14 }} color={colors.onAccent}>
            Registrar
          </AppText>
        </Pressable>
        <IconLink label="Calendario" href="/calendario" Icon={CalendarBlankIcon} active={path === '/calendario'} />
        <IconLink label="Módulos" href="/modulos" Icon={SquaresFourIcon} active={path === '/modulos'} />
        {v3 ? null : <SpaceSwitch />}
        <IconLink label="Ajustes" href="/ajustes" Icon={GearIcon} active={path === '/ajustes'} />
      </View>
      <QuickPanel visible={quick} onClose={() => setQuick(false)} day={day} pauses={marks['h:pausa']?.value ?? 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, paddingHorizontal: 28, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  tab: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 260, height: 42, paddingHorizontal: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  kbd: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, fontSize: 11 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: 14, borderRadius: 12 },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
