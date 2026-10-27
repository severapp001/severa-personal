import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { Neuron, NeuronState } from '@/core/discovery';
import { LiveBrain } from '@/features/discovery/LiveBrain';
import { NeuronSheet } from '@/features/discovery/NeuronSheet';
import { ModuleIcon } from '@/features/modules/moduleIcons';
import { MODULE_ROUTES } from '@/features/space/moduleRoutes';
import { SettingsButton } from '@/features/space/SpaceHeader';
import { usePref } from '@/features/space/usePref';
import { useToday } from '@/features/today/useToday';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, personalThemes, radius } from '@/theme/tokens';
import { AppText, Screen } from '@/ui';
import { tap } from '@/ui/haptics';
import { StarIcon } from '@/ui/icons';
import { PillTabs } from '@/ui/kit';

// Módulos (26-10-2026, noche; usuario: «que no aparezcan como tarjetas sino como lista, o con la
// opción de poner una imagen en tarjeta más el nombre… sumado a la personalización del usuario
// sobre qué módulos quiere»): en lista o en tarjetas con su ícono, con buscador y «Tus módulos»
// arriba (la estrella). El cerebro vivo queda como portada.

const LABEL: Record<NeuronState, string> = { discovered: 'Encendida', suggested: 'Por completar', undiscovered: 'Por descubrir', off: 'Apagada' };
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function ModulosScreen() {
  const { colors, theme, mode } = useTheme();
  const t = useToday();
  const [sheet, setSheet] = useState<string | null>(null);
  const [brainW, setBrainW] = useState(0);
  const [q, setQ] = useState('');
  const [prefs, savePrefs] = usePref<{ vista: 'lista' | 'tarjetas'; favoritos: string[] }>('modulos', { vista: 'lista', favoritos: [] });
  const base = personalThemes[theme];
  const favs = prefs.favoritos;
  const colorOf = (h: string) => (h === 'work' ? base.accent2 : h === 'bridge' ? colors.text : base.accent);
  const open = (n: Neuron) => {
    tap();
    if (MODULE_ROUTES[n.code]) router.push(MODULE_ROUTES[n.code]);
    else setSheet(n.code);
  };
  const toggleFav = (code: string) => {
    tap();
    savePrefs({ favoritos: favs.includes(code) ? favs.filter((c) => c !== code) : [...favs, code] });
  };
  const query = norm(q.trim());
  const match = (n: Neuron) => !query || norm(n.name).includes(query);
  const sorted = [...t.neurons].sort((a, b) => a.sort_order - b.sort_order);
  const mine = favs.map((c) => sorted.find((n) => n.code === c)).filter((n): n is Neuron => !!n && match(n));
  const groups = (mode === 'work' ? (['work', 'personal', 'bridge'] as const) : (['bridge', 'personal', 'work'] as const)).map((h) => ({ h, list: sorted.filter((n) => n.hemisphere === h && match(n)) }));
  const neuron = sheet ? (t.neurons.find((n) => n.code === sheet) ?? null) : null;

  const row = (n: Neuron) => {
    const st = t.states[n.code] ?? 'undiscovered';
    const fav = favs.includes(n.code);
    return (
      <Pressable key={n.code} accessibilityRole="button" accessibilityLabel={`${n.name}, ${LABEL[st]}`} onPress={() => open(n)} onLongPress={() => setSheet(n.code)} style={({ pressed }) => [styles.row, { borderBottomColor: colors.line, opacity: pressed ? 0.7 : st === 'undiscovered' ? 0.65 : 1 }]}>
        <View style={[styles.icon, { backgroundColor: st === 'discovered' ? colors.accentSoft : colors.surface2 }]}>
          <ModuleIcon code={n.code} size={20} color={st === 'discovered' ? colorOf(n.hemisphere) : colors.muted} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="label" numberOfLines={1} style={{ fontSize: 15 }}>
            {n.name}
          </AppText>
          <AppText variant="caption" muted numberOfLines={1}>
            {n.summary ?? LABEL[st]}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={fav ? `Quitar ${n.name} de tus módulos` : `Agregar ${n.name} a tus módulos`} hitSlop={10} onPress={() => toggleFav(n.code)}>
          <StarIcon size={20} weight={fav ? 'fill' : 'regular'} color={fav ? colors.accent : colors.muted} />
        </Pressable>
      </Pressable>
    );
  };

  const tile = (n: Neuron) => {
    const st = t.states[n.code] ?? 'undiscovered';
    const fav = favs.includes(n.code);
    return (
      <Pressable key={n.code} accessibilityRole="button" onPress={() => open(n)} onLongPress={() => toggleFav(n.code)} style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, opacity: pressed ? 0.85 : st === 'undiscovered' ? 0.65 : 1 }]}>
        <View style={[styles.image, { backgroundColor: st === 'discovered' ? colors.accentSoft : colors.surface2 }]}>
          <ModuleIcon code={n.code} size={34} color={st === 'discovered' ? colorOf(n.hemisphere) : colors.muted} weight="duotone" />
          {fav ? (
            <View style={styles.star}>
              <StarIcon size={14} weight="fill" color={colors.accent} />
            </View>
          ) : null}
        </View>
        <AppText variant="label" numberOfLines={2} style={{ fontSize: 13, textAlign: 'center' }}>
          {n.name}
        </AppText>
      </Pressable>
    );
  };

  const render = (list: Neuron[]) => (prefs.vista === 'tarjetas' ? <View style={styles.grid}>{list.map(tile)}</View> : <View>{list.map(row)}</View>);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="title">Módulos</AppText>
        <SettingsButton />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir tu cerebro" onPress={() => router.push('/cerebro')} onLayout={(e) => setBrainW(e.nativeEvent.layout.width - 24)} style={[styles.brain, { backgroundColor: colors.surface }]}>
        {brainW > 0 ? <LiveBrain neurons={t.neurons} synapses={t.synapses} states={t.states} width={brainW} impulses={8} /> : <View style={{ height: 160 }} />}
        <AppText variant="label" color={colors.accent} style={{ textAlign: 'center' }}>
          Abrir tu cerebro y ver las conexiones
        </AppText>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput value={q} onChangeText={setQ} placeholder="Buscar un módulo" placeholderTextColor={colors.muted} style={[styles.search, { backgroundColor: colors.surface, color: colors.text }]} />
        <PillTabs
          options={[
            { value: 'lista', label: 'Lista' },
            { value: 'tarjetas', label: 'Tarjetas' },
          ]}
          value={prefs.vista}
          onChange={(v) => savePrefs({ vista: v })}
        />
      </View>
      <View style={{ gap: 6 }}>
        <AppText variant="caption" color={colors.accent} style={styles.kicker}>
          TUS MÓDULOS
        </AppText>
        {mine.length ? render(mine) : (
          <AppText variant="caption" muted>
            {prefs.vista === 'tarjetas' ? 'Mantén presionada una tarjeta para dejarla aquí arriba.' : 'Toca la estrella de los módulos que más usas y quedan aquí arriba.'}
          </AppText>
        )}
      </View>
      {groups.map(({ h, list }) =>
        list.length ? (
          <View key={h} style={{ gap: 6 }}>
            <AppText variant="caption" color={colorOf(h)} style={styles.kicker}>
              {h === 'work' ? 'TRABAJO' : h === 'bridge' ? 'TÚ Y EL PUENTE ENTRE LOS DOS' : 'PERSONAL'}
            </AppText>
            {render(list)}
          </View>
        ) : null,
      )}
      <NeuronSheet neuron={neuron} neurons={t.neurons} synapses={t.synapses} states={t.states} age={null} onClose={() => setSheet(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: fonts.extrabold, letterSpacing: 1.4, fontSize: 11 },
  brain: { borderRadius: 24, padding: 12, gap: 8, overflow: 'hidden' },
  search: { flex: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, fontFamily: fonts.medium, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31%', flexGrow: 1, borderRadius: 18, padding: 8, gap: 6, alignItems: 'center' },
  image: { width: '100%', aspectRatio: 1.3, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  star: { position: 'absolute', top: 6, right: 6 },
});
