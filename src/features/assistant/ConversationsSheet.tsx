import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDays } from '@/core/agenda';
import { CONV_KIND, CONV_MODULE, convOf, filterConvs, STATE_LABEL, type ConvFilter, type ConvState } from '@/core/conversations';
import { useEntries, type Entry } from '@/data/entries';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui';
import { ChipRow, Empty, Sheet } from '@/ui/kit';

// «Lo que conversamos» (Z3, 29-10-2026): lo que le dijiste a Severa aquí y por Telegram, lo que
// entendió y en qué quedó. Lo que no entendió se puede volver a escribir de otra forma.

const FILTERS: { value: ConvFilter; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'app', label: 'En la app' },
  { value: 'no_entendido', label: 'No entendí' },
];
const CHANNEL = { telegram: 'Telegram', app: 'App', correo: 'Correo del banco' } as const;
const WEEK = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const timeOf = (e: Entry) => {
  const at = convOf(e.data).at ?? e.created_at;
  if (!at) return '';
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Cuántas frases no entendió en la última semana (para el número del botón). */
export function useNotUnderstood(today: string): number {
  const talk = useEntries(CONV_MODULE);
  const from = addDays(today, -6);
  return talk.of(CONV_KIND).filter((e) => (e.day ?? '') >= from && convOf(e.data).estado === 'no_entendido').length;
}

export function ConversationsSheet({ visible, today, onClose, onRetry }: { visible: boolean; today: string; onClose: () => void; onRetry: (text: string) => void }) {
  const { colors } = useTheme();
  const talk = useEntries(CONV_MODULE);
  const [filter, setFilter] = useState<ConvFilter>('todo');
  const rows = filterConvs(talk.of(CONV_KIND), filter).slice(0, 80);
  const days = [...new Set(rows.map((r) => r.day ?? ''))];
  const tone = (s: ConvState) => (s === 'guardado' || s === 'corregido' || s === 'idea' ? colors.ok : s === 'no_entendido' || s === 'error' ? colors.bad : s === 'propuesto' ? colors.mid : colors.muted);
  const dayLabel = (d: string) => {
    if (d === today) return 'Hoy';
    if (d === addDays(today, -1)) return 'Ayer';
    const x = new Date(`${d}T12:00:00`);
    return Number.isNaN(x.getTime()) ? d : `${WEEK[x.getDay()]} ${d.slice(8, 10)}-${d.slice(5, 7)}`;
  };

  return (
    <Sheet visible={visible} title="Lo que conversamos" onClose={onClose}>
      <AppText variant="caption" muted>
        Lo que le dices a Severa aquí y por Telegram, lo que entendió y en qué quedó. Queda solo en tu cuenta y, cuando Severa tenga IA, será su memoria.
      </AppText>
      <ChipRow options={FILTERS} value={filter} onChange={setFilter} />
      {rows.length ? (
        days.map((d) => (
          <View key={d} style={{ gap: 8 }}>
            <AppText variant="label" muted>
              {dayLabel(d)}
            </AppText>
            {rows
              .filter((r) => (r.day ?? '') === d)
              .map((r) => {
                const c = convOf(r.data);
                return (
                  <View key={r.id} style={[styles.item, { backgroundColor: colors.surface2 }]}>
                    <AppText variant="caption" muted>{`${timeOf(r)} · ${CHANNEL[c.canal]}`}</AppText>
                    <AppText variant="body">{r.title ?? ''}</AppText>
                    {c.lineas?.length ? c.lineas.map((l) => <AppText key={l} variant="caption">{`• ${l}`}</AppText>) : null}
                    {!c.lineas?.length && r.body && c.estado === 'respondido' ? (
                      <AppText variant="caption" muted numberOfLines={4}>
                        {r.body}
                      </AppText>
                    ) : null}
                    <AppText variant="label" style={{ fontSize: 13 }} color={tone(c.estado)}>
                      {STATE_LABEL[c.estado]}
                    </AppText>
                    {c.estado === 'no_entendido' && r.title && c.canal !== 'correo' ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          onClose();
                          onRetry(r.title ?? '');
                        }}
                      >
                        <AppText variant="caption" color={colors.accent}>
                          Escribirlo de otra forma
                        </AppText>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
          </View>
        ))
      ) : (
        <Empty text={filter === 'no_entendido' ? 'Todo lo que le escribiste lo entendió.' : 'Todavía no hay conversaciones. Escríbele a Severa aquí o por Telegram.'} />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({ item: { borderRadius: 14, padding: 12, gap: 4 } });
