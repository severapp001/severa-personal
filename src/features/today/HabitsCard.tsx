import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useHabits, type Habit } from '@/data/modules';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, space } from '@/theme/tokens';
import { AppText, Button } from '@/ui';
import { tap } from '@/ui/haptics';
import { CheckIcon, PlusIcon } from '@/ui/icons';
import { Card } from './PersonalCards';
import type { Today } from './useToday';

// Hábitos de hoy (sincronizados). 26-10-2026 (usuario): sin repetidos y separados en «para sumar»
// y «para bajar»; en la noche, como anillos de avance: cada hábito es un anillo que se llena al
// tocarlo (mantener presionado resta). Los que se quieren bajar cuentan hacia arriba en otro color
// y avisan, sin juicios, cuando pasan el límite.

const RING = 58;
const STROKE = 6;

function Ring({ value, color, track, children }: { value: number; color: string; track: string; children: React.ReactNode }) {
  const r = (RING - STROKE) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={track} strokeWidth={STROKE} fill="none" />
        {value > 0 ? (
          <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={color} strokeWidth={STROKE} fill="none" strokeDasharray={`${c * Math.min(1, value)} ${c}`} strokeLinecap="round" rotation={-90} origin={`${RING / 2}, ${RING / 2}`} />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

export function HabitsCard({ t }: { t: Today }) {
  const { colors } = useTheme();
  const h = useHabits(t.day);
  const [seeding, setSeeding] = useState(false);

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

  const tile = (x: Habit) => {
    const n = h.countFor(x.id);
    const target = Number(x.daily_target) || 1;
    const reduce = x.direction === 'reduce';
    const full = !reduce && n >= target;
    const over = reduce && target > 1 && n > target;
    const color = reduce ? (over ? colors.bad : colors.mid) : full ? colors.ok : colors.accent;
    const value = reduce ? (n ? Math.min(1, n / Math.max(target, n, 1)) : 0) : n / target;
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
        style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Ring value={value} color={color} track={reduce ? colors.midSoft : colors.surface2}>
          {full ? (
            <CheckIcon size={22} weight="bold" color={colors.ok} />
          ) : reduce || target > 1 ? (
            <AppText style={{ fontFamily: fonts.extrabold, fontSize: target > 9 && !reduce ? 13 : 16, fontVariant: ['tabular-nums'] }} color={n ? color : colors.muted}>
              {reduce ? String(n) : `${n}/${target}`}
            </AppText>
          ) : (
            <PlusIcon size={20} weight="bold" color={colors.accent} />
          )}
        </Ring>
        <AppText variant="caption" numberOfLines={2} style={{ fontSize: 12, textAlign: 'center', fontFamily: fonts.semibold }} color={full ? colors.ok : colors.text}>
          {x.name}
        </AppText>
        {reduce && target > 1 ? (
          <AppText variant="caption" muted style={{ fontSize: 10 }}>
            {`límite ${target}`}
          </AppText>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Card
      kicker="Hábitos de hoy"
      title={h.good.length ? `${done} de ${h.good.length} hechos` : 'Lo que quieres bajar'}
      right={
        <AppText variant="label" color={colors.accent} onPress={() => router.push('/habitos')}>
          Editar
        </AppText>
      }
    >
      {h.good.length ? (
        <View style={{ gap: 8 }}>
          <AppText variant="caption" color={colors.accent} style={styles.group}>
            PARA SUMAR
          </AppText>
          <View style={styles.grid}>{h.good.map(tile)}</View>
        </View>
      ) : null}
      {h.reduce.length ? (
        <View style={[{ gap: 8 }, h.good.length ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: space.md } : null]}>
          <AppText variant="caption" color={colors.mid} style={styles.group}>
            PARA BAJAR · SIN CULPAS, SOLO NÚMEROS
          </AppText>
          <View style={styles.grid}>{h.reduce.map(tile)}</View>
        </View>
      ) : null}
      <AppText variant="caption" muted style={{ fontSize: 11 }}>
        Toca para sumar uno · mantén presionado para restar
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  group: { fontFamily: fonts.extrabold, letterSpacing: 1.2, fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  tile: { width: '25%', alignItems: 'center', gap: 4, paddingHorizontal: 2 },
});
