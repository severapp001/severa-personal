import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useHabits, type Habit } from '@/data/modules';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, space } from '@/theme/tokens';
import { AppText, Button } from '@/ui';
import { tap } from '@/ui/haptics';
import { CaretDownIcon, CaretUpIcon } from '@/ui/icons';
import { Card } from './PersonalCards';
import type { Today } from './useToday';

// Hábitos de hoy (sincronizados). Desde el 26-10-2026 (usuario: «se repiten… una tarjeta
// absurdamente larga… quiero ver diferenciados los hábitos que hay que sumar y los que hay que
// bajar»): sin repetidos (useHabits los junta), en dos grupos con su color y siempre compacta. Un
// toque suma uno; mantener presionado resta. La flecha muestra el detalle con el avance.

let openedOnce = false;

export function HabitsCard({ t }: { t: Today }) {
  const { colors } = useTheme();
  const h = useHabits(t.day);
  const [seeding, setSeeding] = useState(false);
  const [open, setOpen] = useState(openedOnce);

  if (!h.habits.length) {
    if (!t.habits.length) return null;
    return (
      <Card kicker="Hábitos de hoy" title="Activa los hábitos que elegiste">
        <AppText variant="caption" muted>
          {t.habits.map((x) => x.name).join(' · ')}
        </AppText>
        <Button
          label="Empezar a contarlos"
          loading={seeding}
          onPress={async () => {
            setSeeding(true);
            try {
              for (const x of t.habits) {
                await h.addHabit({ name: x.name, direction: x.direction, template_code: x.code, daily_target: x.target && x.target > 1 && x.target <= 20 ? x.target : 1, unit: x.unit ?? null });
              }
            } finally {
              setSeeding(false);
            }
          }}
        />
      </Card>
    );
  }

  const done = h.good.filter((x) => h.countFor(x.id) >= (Number(x.daily_target) || 1)).length;
  const Caret = open ? CaretUpIcon : CaretDownIcon;

  const pill = (x: Habit) => {
    const n = h.countFor(x.id);
    const target = Number(x.daily_target) || 1;
    const reduce = x.direction === 'reduce';
    const full = !reduce && n >= target;
    const tone = reduce ? colors.mid : full ? colors.ok : colors.accent;
    return (
      <Pressable
        key={x.id}
        accessibilityRole="button"
        accessibilityLabel={`${x.name}: ${reduce ? `${n} hoy` : `${n} de ${target}`}. Toca para sumar uno; mantén presionado para restar.`}
        onPress={() => {
          tap();
          if (reduce || n < target) h.log(x.id, 1);
        }}
        onLongPress={() => n && h.log(x.id, -1)}
        style={[styles.pill, { backgroundColor: full ? colors.okSoft : reduce ? colors.midSoft : colors.surface2 }]}
      >
        <View style={{ gap: 4 }}>
          <AppText variant="label" numberOfLines={1} style={{ fontSize: 13, maxWidth: 140 }} color={full ? colors.ok : colors.text}>
            {x.name}
          </AppText>
          {open && !reduce && target > 1 ? (
            <View style={[styles.mini, { backgroundColor: colors.line }]}>
              <View style={[styles.miniFill, { width: `${Math.min(100, Math.round((n / target) * 100))}%`, backgroundColor: full ? colors.ok : colors.accent2 }]} />
            </View>
          ) : null}
          {open ? (
            <AppText variant="caption" muted style={{ fontSize: 11 }}>
              {reduce ? (n ? 'Sin culpas, solo números' : 'Hoy, ninguno') : full ? '¡Listo!' : `${target - n} por hacer${x.unit ? ` · ${x.unit}` : ''}`}
            </AppText>
          ) : null}
        </View>
        <AppText variant="label" style={{ fontSize: 13, fontVariant: ['tabular-nums'] }} color={tone}>
          {reduce ? n : target > 1 ? `${n}/${target}` : full ? '✓' : '+'}
        </AppText>
      </Pressable>
    );
  };

  return (
    <Card
      kicker="Hábitos de hoy"
      title={h.good.length ? `${done} de ${h.good.length} hechos` : 'Lo que quieres bajar'}
      right={
        <View style={styles.head}>
          <AppText variant="label" color={colors.accent} onPress={() => router.push('/habitos')}>
            Editar
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={open ? 'Ver menos' : 'Ver el detalle'}
            hitSlop={8}
            onPress={() => {
              tap();
              openedOnce = !open;
              setOpen(!open);
            }}
            style={[styles.caret, { backgroundColor: colors.surface2 }]}
          >
            <Caret size={18} color={colors.text} />
          </Pressable>
        </View>
      }
    >
      {h.good.length ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" color={colors.accent} style={styles.group}>
            PARA SUMAR
          </AppText>
          <View style={styles.pills}>{h.good.map(pill)}</View>
        </View>
      ) : null}
      {h.reduce.length ? (
        <View style={{ gap: 6 }}>
          <AppText variant="caption" color={colors.mid} style={styles.group}>
            PARA BAJAR
          </AppText>
          <View style={styles.pills}>{h.reduce.map(pill)}</View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  caret: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  group: { fontFamily: fonts.extrabold, letterSpacing: 1.2, fontSize: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  mini: { height: 4, width: 80, borderRadius: 2, overflow: 'hidden' },
  miniFill: { height: 4, borderRadius: 2 },
});
