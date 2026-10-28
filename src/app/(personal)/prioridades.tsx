import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDays, hhmm, longDay, shortDay, type Task } from '@/core/agenda';
import { dayKey } from '@/core/today';
import { AgendaSheet, type AgendaTarget } from '@/features/agenda/AgendaSheet';
import { FocusCard } from '@/features/agenda/FocusCard';
import { useWay } from '@/features/mind/way';
import { PriorityList } from '@/features/agenda/PriorityList';
import { usePriorities } from '@/features/agenda/usePriorities';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { CheckIcon } from '@/ui/icons';
import { Empty, Kicker, Panel } from '@/ui/kit';

// Prioridades (F05, MD4): la lista de hoy, que se arma sola con la agenda, los hábitos, Estudios
// y Familia, y todas las tareas pendientes: atrasadas, próximas y sin fecha.
// 27-10-2026 (en la barra de abajo): arriba lo más importante ahora con modo foco, y lo de mañana
// para verlo venir.

export default function PrioridadesScreen() {
  const { colors } = useTheme();
  const today = dayKey(new Date());
  const p = usePriorities(today);
  const tomorrow = usePriorities(addDays(today, 1));
  const first = p.items.find((i) => !i.done && i.origin !== 'habits') ?? null;
  const nextDay = tomorrow.items.filter((i) => !i.done && i.origin !== 'habits' && !i.overdue);
  // «Una cosa a la vez» (Mi forma de funcionar): el resto queda plegado hasta pedirlo.
  const [way] = useWay();
  const [all, setAll] = useState(false);
  const folded = way.unaCosa && !all;
  const [target, setTarget] = useState<AgendaTarget | null>(null);
  const pending = p.agenda.tasks.filter((t) => t.status === 'pending');
  const groups: { title: string; list: Task[] }[] = [
    { title: 'Atrasadas', list: pending.filter((t) => t.due_on && t.due_on < today) },
    { title: 'Próximas', list: pending.filter((t) => t.due_on && t.due_on > today) },
    { title: 'Sin fecha', list: pending.filter((t) => !t.due_on) },
  ];

  return (
    <Screen>
      <ModuleHeader kicker="Personal" title="Prioridades" />
      <FocusCard item={first} onDone={p.toggle} onLater={p.later} />
      {folded ? <Button label="Ver todo lo de hoy" kind="link" onPress={() => setAll(true)} /> : null}
      {folded ? null : (
        <>
          <Panel>
            <Kicker>{`Hoy · ${longDay(today)}`}</Kicker>
            {p.items.length ? (
              <PriorityList
                items={p.items}
                onToggle={p.toggle}
                onLater={p.later}
                onOpen={(i) => {
                  const task = i.origin === 'task' ? p.agenda.tasks.find((t) => t.id === i.originId) : undefined;
                  const event = i.origin === 'event' ? p.agenda.events.find((e) => e.id === i.originId) : undefined;
                  if (task) setTarget({ kind: 'task', task });
                  else if (event) setTarget({ kind: 'event', event });
                }}
              />
            ) : (
              <Empty text="Nada para hoy. Agrega una tarea o un evento." />
            )}
            <Button label="+ Agregar" onPress={() => setTarget({ kind: 'task' })} />
          </Panel>

          {nextDay.length ? (
            <Panel>
              <Kicker>{`Mañana · ${longDay(addDays(today, 1))}`}</Kicker>
              {nextDay.map((i) => (
                <AppText key={i.key} variant="label" style={{ fontSize: 15 }}>{`• ${i.time ? `${i.time} ` : ''}${i.title}`}</AppText>
              ))}
            </Panel>
          ) : null}

          {groups.map((g) =>
            g.list.length ? (
              <Panel key={g.title}>
                <Kicker>{g.title}</Kicker>
                {g.list.map((t) => (
                  <View key={t.id} style={[styles.row, { borderBottomColor: colors.line }]}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: false }}
                      accessibilityLabel={t.title}
                      hitSlop={8}
                      onPress={() => {
                        tap();
                        p.agenda.completeTask(t.id, true, today);
                      }}
                      style={[styles.check, { borderColor: g.title === 'Atrasadas' ? colors.bad : colors.line }]}
                    >
                      <CheckIcon size={15} color="transparent" />
                    </Pressable>
                    <Pressable style={{ flex: 1, gap: 2 }} onPress={() => setTarget({ kind: 'task', task: t })} accessibilityRole="button">
                      <AppText variant="label" style={{ fontSize: 15 }}>
                        {t.title}
                        {t.urgent ? '  ·  urgente' : ''}
                      </AppText>
                      <AppText variant="caption" muted>
                        {t.due_on ? `${t.due_on === addDays(today, 1) ? 'Mañana' : shortDay(t.due_on)}${hhmm(t.due_at) ? ` · ${hhmm(t.due_at)}` : ''}` : 'Cuando puedas'}
                      </AppText>
                    </Pressable>
                  </View>
                ))}
              </Panel>
            ) : null,
          )}
        </>
      )}
      <AgendaSheet agenda={p.agenda} target={target} day={today} onClose={() => setTarget(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  check: { width: 28, height: 28, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
