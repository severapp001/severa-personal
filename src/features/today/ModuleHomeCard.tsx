import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ageOn } from '@/core/age';
import { displayAmount } from '@/core/money';
import { useAuth } from '@/data/auth';
import { useSelfPerson } from '@/data/discovery';
import { useEntries } from '@/data/entries';
import { entryTitle, type ModuleDef } from '@/features/modules/catalog';
import { ModuleIcon } from '@/features/modules/moduleIcons';
import { ModuleWidget } from '@/features/modules/widgets';
import { useAmountVisibility } from '@/features/privacy/useAmountVisibility';
import { moduleHref } from '@/features/space/moduleRoutes';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';
import { CaretRightIcon, PlusIcon } from '@/ui/icons';

// La tarjeta de Hoy de cualquier módulo del motor común (26-10-2026, usuario: «cada módulo debe
// tener una tarjeta para inicio»). Desde el 27-10 (usuario: «son algún tipo de acceso directo… si
// se completa lo necesario, la tarjeta debe mostrar un desarrollo del módulo»): mientras falta lo
// mínimo, invita a completarlo; con datos, muestra el mismo resumen que el módulo (remedios del día,
// semana de ejercicio, próximo período, saldos, vencimientos…).

const fmt = (d: string | null) => (d ? `${d.slice(8, 10)}-${d.slice(5, 7)}` : '');

export function ModuleHomeCard({ def, today }: { def: ModuleDef; today: string }) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const store = useEntries(def.code);
  const money = useAmountVisibility();
  const person = useSelfPerson(session?.user.id);
  const age = person?.birthDate ? ageOn(new Date(`${person.birthDate}T12:00:00`)) : null;
  const first = def.kinds.find((k) => !k.parent)!;
  const tops = store.entries.filter((e) => def.kinds.some((k) => k.kind === e.kind && !k.parent));
  const pending = tops.filter((e) => def.kinds.find((k) => k.kind === e.kind)?.checkable && !e.done);
  const show = (pending.length ? pending : tops).slice(0, 3);
  const config = store.of('config')[0] ?? null;
  const answer = def.setup ? ((config?.data[def.setup.key] as string | undefined) ?? null) : null;
  const open = () => router.push(moduleHref(def.code));

  const head = (
    <View style={styles.head}>
      <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
        <ModuleIcon code={def.code} size={18} color={colors.accent} />
      </View>
      <Pressable accessibilityRole="button" onPress={open} style={{ flex: 1 }}>
        <AppText variant="caption" muted style={styles.kicker}>
          {def.title.toUpperCase()}
        </AppText>
        <AppText variant="label" numberOfLines={1}>
          {tops.length ? (pending.length ? `${pending.length} por hacer` : `${tops.length} ${tops.length === 1 ? 'registro' : 'registros'}`) : 'Falta lo mínimo para que funcione'}
        </AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Agregar ${first.one}`}
        hitSlop={6}
        onPress={() => {
          tap();
          router.push(moduleHref(def.code, first.kind));
        }}
        style={[styles.add, { backgroundColor: colors.surface2 }]}
      >
        <PlusIcon size={18} color={colors.accent} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${def.title}`} hitSlop={6} onPress={open} style={[styles.add, { backgroundColor: colors.surface2 }]}>
        <CaretRightIcon size={16} color={colors.muted} />
      </Pressable>
    </View>
  );

  // Con datos y con resumen propio: el desarrollo del módulo, como en su pantalla.
  if (tops.length && def.widget) {
    return (
      <View style={[styles.card, styles.withWidget, { backgroundColor: colors.surface }]}>
        <View style={styles.widgetHead}>{head}</View>
        <ModuleWidget
          def={def}
          store={store}
          today={today}
          age={age}
          parent={null}
          money={(n) => displayAmount(n, money.visible)}
          onAdd={(kind) => router.push(moduleHref(def.code, kind))}
          onOpen={open}
          answer={answer}
        />
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {head}
      {tops.length ? (
        show.map((e) => (
          <View key={e.id} style={styles.line}>
            <AppText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
              {`• ${entryTitle(e)}`}
            </AppText>
            <AppText variant="caption" muted>
              {fmt(e.until ?? e.day)}
            </AppText>
          </View>
        ))
      ) : (
        <AppText variant="caption" muted>
          {`Lo mínimo: ${def.minimum}. Con eso, aquí verás cómo va.`}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 14, gap: 8 },
  withWidget: { padding: 0, gap: 0, overflow: 'hidden' },
  widgetHead: { paddingHorizontal: 14, paddingTop: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: fonts.extrabold, letterSpacing: 1.1, fontSize: 10 },
  add: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', gap: 8 },
});
