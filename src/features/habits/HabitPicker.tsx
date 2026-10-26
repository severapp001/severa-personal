import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { AppText } from '@/ui';
import { tap } from '@/ui/haptics';
import { CheckIcon, PlusIcon } from '@/ui/icons';

// Elegir hábitos (pedido del usuario, 18-10-2026): una sola lista de sugerencias con buscador,
// sin separar «buenos» y «malos»; se marcan los propios y se puede crear uno nuevo.

export type HabitSuggestion = { code: string; name: string; direction: 'good' | 'reduce'; target?: number; unit?: string | null };

/** Sugerencias además de las plantillas del catálogo. */
export const EXTRA_HABITS: HabitSuggestion[] = [
  { code: 'estirar', name: 'Estirar 5 minutos', direction: 'good' },
  { code: 'fruta', name: 'Comer fruta', direction: 'good' },
  { code: 'vitaminas', name: 'Tomar vitaminas', direction: 'good' },
  { code: 'diario', name: 'Escribir en el diario', direction: 'good' },
  { code: 'estudiar', name: 'Estudiar 30 minutos', direction: 'good' },
  { code: 'ordenar', name: 'Ordenar 10 minutos', direction: 'good' },
  { code: 'ahorrar', name: 'No gastar en antojos', direction: 'good' },
  { code: 'dormir_temprano', name: 'Acostarme antes de las 23:00', direction: 'good' },
  { code: 'azucar', name: 'Azúcar o bebidas', direction: 'reduce' },
  { code: 'cafe', name: 'Café', direction: 'reduce' },
  { code: 'apuestas', name: 'Apuestas', direction: 'reduce' },
  { code: 'compras_impulso', name: 'Compras por impulso', direction: 'reduce' },
];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function HabitPicker({
  suggestions,
  chosen,
  onToggle,
  onCreate,
}: {
  suggestions: HabitSuggestion[];
  chosen: string[];
  onToggle: (s: HabitSuggestion) => void;
  onCreate: (name: string) => void;
}) {
  const { colors } = useTheme();
  const [q, setQ] = useState('');
  const query = norm(q.trim());
  const list = suggestions.filter((s) => !query || norm(s.name).includes(query));
  const exact = suggestions.some((s) => norm(s.name) === query);
  return (
    <View style={{ gap: space.sm }}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Busca o escribe un hábito"
        placeholderTextColor={colors.muted}
        style={[styles.search, { backgroundColor: colors.surface, color: colors.text }]}
      />
      {query && !exact ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            tap();
            onCreate(q.trim());
            setQ('');
          }}
          style={[styles.item, { backgroundColor: colors.accentSoft }]}
        >
          <PlusIcon size={18} color={colors.accent} />
          <AppText variant="label" color={colors.accent} style={{ flex: 1 }}>
            {`Crear «${q.trim()}»`}
          </AppText>
        </Pressable>
      ) : null}
      {list.map((s) => {
        const on = chosen.includes(s.code);
        return (
          <Pressable
            key={s.code}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => {
              tap();
              onToggle(s);
            }}
            style={[styles.item, { backgroundColor: colors.surface, borderColor: on ? colors.accent : 'transparent' }]}
          >
            <AppText variant="label" style={{ flex: 1, fontSize: 15 }}>
              {s.name}
            </AppText>
            {s.direction === 'reduce' ? (
              <AppText variant="caption" muted>
                para bajar
              </AppText>
            ) : null}
            <View style={[styles.box, { borderColor: on ? colors.accent : colors.line, backgroundColor: on ? colors.accent : 'transparent' }]}>
              {on ? <CheckIcon size={14} weight="bold" color={colors.onAccent} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: 13, fontFamily: fonts.medium, fontSize: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderRadius: radius.md, paddingHorizontal: space.lg, borderWidth: 2, borderColor: 'transparent' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
