import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useHabits } from '@/data/modules';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { AppText, Button } from '@/ui';
import { tap } from '@/ui/haptics';
import { CaretDownIcon, CaretUpIcon, CheckIcon, PlusIcon } from '@/ui/icons';
import { Card } from './PersonalCards';
import type { Today } from './useToday';

// Hábitos de hoy (sincronizados): metas con puntos (agua), los de una vez con un toque y los que
// se quieren bajar con contador. Mantener presionado el + resta uno.
// Plegada por defecto (pedido del usuario, 25-10-2026: «ocupa mucho espacio»): muestra cada hábito
// con su avance en una pastilla que suma con un toque, y se despliega con la flecha. Recuerda si
// quedó abierta mientras la app siga abierta.

let openedOnce = false;

export function HabitsCard({ t }: { t: Today }) {
  const { colors } = useTheme();
  const h = useHabits(t.day);
  const [seeding, setSeeding] = useState(false);
  const [open, setOpen] = useState(openedOnce);
  const toggle = () => {
    tap();
    openedOnce = !open;
    setOpen(!open);
  };

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
                await h.addHabit({
                  name: x.name,
                  direction: x.direction,
                  template_code: x.code,
                  daily_target: x.target && x.target > 1 && x.target <= 20 ? x.target : 1,
                  unit: x.unit ?? null,
                });
              }
            } finally {
              setSeeding(false);
            }
          }}
        />
      </Card>
    );
  }

  const good = h.habits.filter((x) => x.direction !== 'reduce');
  const done = good.filter((x) => h.countFor(x.id) >= (Number(x.daily_target) || 1)).length;
  const Caret = open ? CaretUpIcon : CaretDownIcon;
  return (
    <Card
      kicker="Hábitos de hoy"
      title={good.length ? `${done} de ${good.length} hechos` : 'Lo que quieres bajar'}
      right={
        <View style={styles.head}>
          <AppText variant="label" color={colors.accent} onPress={() => router.push('/habitos')}>
            Todos
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={open ? 'Plegar hábitos' : 'Desplegar hábitos'}
            hitSlop={8}
            onPress={toggle}
            style={[styles.caret, { backgroundColor: colors.surface2 }]}
          >
            <Caret size={18} color={colors.text} />
          </Pressable>
        </View>
      }
    >
      {/* Plegada: cada hábito con su avance; un toque suma uno y mantener presionado resta. */}
      {open ? null : (
        <View style={styles.pills}>
          {h.habits.map((x) => {
            const n = h.countFor(x.id);
            const target = Number(x.daily_target) || 1;
            const reduce = x.direction === 'reduce';
            const full = !reduce && n >= target;
            return (
              <Pressable
                key={x.id}
                accessibilityRole="button"
                accessibilityLabel={`${x.name}: ${reduce ? n : `${n} de ${target}`}. Toca para sumar uno.`}
                onPress={() => {
                  tap();
                  if (reduce || n < target) h.log(x.id, 1);
                }}
                onLongPress={() => n && h.log(x.id, -1)}
                style={[styles.pill, { backgroundColor: full ? colors.okSoft : reduce ? colors.midSoft : colors.surface2 }]}
              >
                <View style={{ gap: 4 }}>
                  <AppText variant="label" numberOfLines={1} style={{ fontSize: 13, maxWidth: 130 }} color={full ? colors.ok : colors.text}>
                    {x.name}
                  </AppText>
                  {!reduce && target > 1 ? (
                    <View style={[styles.mini, { backgroundColor: colors.line }]}>
                      <View style={[styles.miniFill, { width: `${Math.min(100, Math.round((n / target) * 100))}%`, backgroundColor: full ? colors.ok : colors.accent2 }]} />
                    </View>
                  ) : null}
                </View>
                <AppText variant="label" style={{ fontSize: 13, fontVariant: ['tabular-nums'] }} color={full ? colors.ok : reduce ? colors.mid : colors.accent}>
                  {reduce ? n : target > 1 ? `${n}/${target}` : full ? '✓' : '+'}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      )}
      {!open ? null : h.habits.map((x) => {
        const n = h.countFor(x.id);
        const target = Number(x.daily_target) || 1;
        if (x.direction === 'reduce') {
          return (
            <View key={x.id} style={[styles.line, styles.reduce, { borderTopColor: colors.line }]}>
              <View style={{ flex: 1 }}>
                <AppText variant="label" style={{ fontSize: 15 }}>
                  {`Por bajar: ${x.name.toLowerCase()}`}
                </AppText>
                <AppText variant="caption" muted>
                  {n ? `Hoy: ${n}. Mantén el pulso, sin culpas.` : 'Hoy: ninguno. Vas bien.'}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Sumar uno: ${x.name}`}
                onPress={() => {
                  tap();
                  h.log(x.id, 1);
                }}
                onLongPress={() => h.log(x.id, -1)}
                style={[styles.add, { backgroundColor: colors.midSoft }]}
              >
                <PlusIcon size={18} color={colors.mid} />
              </Pressable>
            </View>
          );
        }
        if (target > 1) {
          return (
            <View key={x.id} style={styles.line}>
              <View style={{ flex: 1, gap: 6 }}>
                <AppText variant="label" style={{ fontSize: 15 }}>
                  {x.name}{' '}
                  <AppText variant="caption" muted>
                    {`· ${n} de ${target}${x.unit ? ` ${x.unit}` : ''}`}
                  </AppText>
                </AppText>
                <View style={styles.dots}>
                  {Array.from({ length: target }, (_, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: i < n ? colors.accent2 : colors.surface2 }]} />
                  ))}
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Sumar: ${x.name}`}
                onPress={() => {
                  tap();
                  if (n < target) h.log(x.id, 1);
                }}
                onLongPress={() => h.log(x.id, -1)}
                style={[styles.add, { backgroundColor: colors.surface2 }]}
              >
                <PlusIcon size={18} color={colors.accent} />
              </Pressable>
            </View>
          );
        }
        const on = n >= 1;
        return (
          <View key={x.id} style={styles.line}>
            <AppText variant="label" style={{ flex: 1, fontSize: 15 }}>
              {x.name}
            </AppText>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={x.name}
              hitSlop={8}
              onPress={() => {
                tap();
                h.log(x.id, on ? -1 : 1);
              }}
              style={[styles.check, { backgroundColor: on ? colors.accent : 'transparent', borderColor: on ? colors.accent : colors.line }]}
            >
              {on ? <CheckIcon size={15} weight="bold" color={colors.onAccent} /> : null}
            </Pressable>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  caret: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 },
  mini: { height: 4, width: 70, borderRadius: 2, overflow: 'hidden' },
  miniFill: { height: 4, borderRadius: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40 },
  reduce: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  dot: { width: 11, height: 11, borderRadius: 6 },
  add: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  check: { width: 30, height: 30, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
