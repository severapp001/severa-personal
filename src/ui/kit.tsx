import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCLP } from '@/core/money';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { tap } from './haptics';
import { AppText } from './index';
import { useLayout } from './layout';

// Piezas comunes de los módulos (Finanzas, Estudios, Familia, CV, Hábitos).

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.seg, { backgroundColor: colors.surface }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[styles.segBtn, on && { backgroundColor: colors.surface2 }]}
          >
            <AppText variant="label" numberOfLines={1} style={{ fontSize: 13 }} color={on ? colors.text : colors.muted}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Hoja que sube desde abajo, con su propio desplazamiento y espacio para el teclado. */
// En el computador (29-10-2026) la hoja es una ventana centrada, como un diálogo.
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { wide } = useLayout();
  if (wide) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.dialogWrap}>
          <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={onClose} accessibilityLabel="Cerrar" />
          <View style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <AppText variant="subtitle">{title}</AppText>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md, paddingBottom: space.sm }}>
              {children}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.lg }]}>
          <View style={[styles.grab, { backgroundColor: colors.line }]} />
          <AppText variant="subtitle">{title}</AppText>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md, paddingBottom: space.sm }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, multiline }: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: 'default' | 'number-pad' | 'decimal-pad'; multiline?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, { backgroundColor: colors.surface2, color: colors.text, minHeight: multiline ? 88 : 48 }]}
      />
    </View>
  );
}

/** Monto en pesos: se escribe solo con números y se muestra con puntos. */
export function AmountField({ label, value, onChange, autoFocus }: { label: string; value: number; onChange: (v: number) => void; autoFocus?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <TextInput
        autoFocus={autoFocus}
        value={value ? formatCLP(value) : ''}
        onChangeText={(t) => onChange(Number(t.replace(/\D/g, '')) || 0)}
        keyboardType="number-pad"
        placeholder="$0"
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.amount, { backgroundColor: colors.surface2, color: colors.text }]}
      />
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[styles.chip, { backgroundColor: on ? colors.accent : colors.surface2 }]}
          >
            <AppText variant="label" style={{ fontSize: 13 }} color={on ? colors.onAccent : colors.text}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayIso = () => iso(new Date());

/** Escribe solo números y se arma «dd-mm-aaaa» mientras se escribe (26102026 → 26-10-2026). */
export function maskDate(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('-');
}

/** «dd-mm-aaaa» → «aaaa-mm-dd», o null si no es una fecha real. */
export function parseDate(text: string): string | null {
  const m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(text.trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Fecha con atajos (hoy, ayer) o escrita con números: los guiones se ponen solos. */
export function DateField({ label, value, onChange, future }: { label: string; value: string | null; onChange: (v: string | null) => void; future?: boolean }) {
  const { colors } = useTheme();
  const today = new Date();
  const shift = (days: number) => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));
  const quick = future
    ? [
        { v: shift(0), l: 'Hoy' },
        { v: shift(1), l: 'Mañana' },
        { v: shift(7), l: 'En 1 semana' },
      ]
    : [
        { v: shift(0), l: 'Hoy' },
        { v: shift(-1), l: 'Ayer' },
      ];
  const shown = value ? `${value.slice(8, 10)}-${value.slice(5, 7)}-${value.slice(0, 4)}` : '';
  const [text, setText] = useState(shown);
  const [seen, setSeen] = useState(shown);
  // Si la fecha cambia desde afuera (un atajo), el campo la muestra.
  if (seen !== shown) {
    setSeen(shown);
    setText(shown);
  }
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TextInput
          value={text}
          placeholder="dd-mm-aaaa"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          maxLength={10}
          onChangeText={(t) => {
            const masked = maskDate(t);
            setText(masked);
            if (masked.length === 10) {
              const parsed = parseDate(masked);
              if (parsed) onChange(parsed);
            } else if (!masked) onChange(null);
          }}
          style={[styles.input, { backgroundColor: colors.surface2, color: colors.text, width: 138, paddingHorizontal: 12, fontVariant: ['tabular-nums'] }]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6 }}>
          {quick.map((q) => (
            <Pressable key={q.l} onPress={() => onChange(q.v)} style={[styles.chip, { backgroundColor: value === q.v ? colors.accent : colors.surface2 }]}>
              <AppText variant="label" style={{ fontSize: 13 }} color={value === q.v ? colors.onAccent : colors.text}>
                {q.l}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

/** Escribe solo números y se arma «HH:MM» (1200 → 12:00, 930 → 9:30). */
export function maskTime(text: string): string {
  const d = text.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, d.length - 2)}:${d.slice(-2)}`;
}

/** «9», «930», «9:30» o «0930» → «09:30»; vacío si no es una hora válida. */
export function normalizeTime(text: string): string {
  const d = text.replace(/\D/g, '');
  if (!d) return '';
  const h = Number(d.length <= 2 ? d : d.slice(0, -2));
  const m = d.length <= 2 ? 0 : Number(d.slice(-2));
  return h < 24 && m < 60 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : '';
}

/** Hora libre de 00:00 a 23:59: se escriben los números y los dos puntos se ponen solos. */
export function TimeField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { colors } = useTheme();
  const shown = maskTime(value);
  const bad = value.replace(/\D/g, '').length >= 3 && !normalizeTime(value);
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      <TextInput
        value={shown}
        onChangeText={(t) => onChange(maskTime(t))}
        onEndEditing={() => {
          const n = normalizeTime(value);
          if (n && n !== value) onChange(n);
        }}
        placeholder={placeholder ?? '09:30'}
        placeholderTextColor={colors.muted}
        keyboardType="number-pad"
        maxLength={5}
        style={[styles.input, { backgroundColor: colors.surface2, color: bad ? colors.bad : colors.text, fontVariant: ['tabular-nums'] }]}
      />
    </View>
  );
}

/** Opciones en una fila que se desliza de lado: no ocupan media pantalla (Finanzas, 26-10-2026). */
export function ChipRow<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[styles.chip, { backgroundColor: on ? colors.accent : colors.surface2 }]}
          >
            <AppText variant="label" style={{ fontSize: 13 }} color={on ? colors.onAccent : colors.text}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Pestañas con el nombre completo: se deslizan de lado y la elegida queda marcada. */
export function PillTabs<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingRight: 8 }} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={[styles.pillTab, { backgroundColor: on ? colors.text : colors.surface }]}
          >
            <AppText variant="label" style={{ fontSize: 14 }} color={on ? colors.bg : colors.muted}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Barra horizontal con su etiqueta y su valor (datos en el color de datos, §6 del sistema de diseño). */
export function BarRow({ label, value, max, text, tone }: { label: string; value: number; max: number; text: string; tone?: 'data' | 'bad' | 'ok' }) {
  const { colors } = useTheme();
  const color = tone === 'bad' ? colors.bad : tone === 'ok' ? colors.ok : colors.accent2;
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.between}>
        <AppText variant="label" numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>
          {label}
        </AppText>
        <AppText variant="label" style={{ fontSize: 14, fontVariant: ['tabular-nums'] }}>
          {text}
        </AppText>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surface2 }]}>
        <View style={[styles.fill, { width: `${max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function Row({ title, sub, right, onPress, onLongPress }: { title: string; sub?: string; right?: ReactNode; onPress?: () => void; onLongPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      disabled={!onPress && !onLongPress}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.line, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <AppText variant="label" numberOfLines={1} style={{ fontSize: 15 }}>
          {title}
        </AppText>
        {sub ? (
          <AppText variant="caption" muted numberOfLines={2}>
            {sub}
          </AppText>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <AppText variant="caption" muted style={{ textAlign: 'center', paddingVertical: space.md }}>
      {text}
    </AppText>
  );
}

export function Kicker({ children, color }: { children: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <AppText variant="caption" color={color ?? colors.muted} style={{ fontFamily: fonts.extrabold, letterSpacing: 1.2, fontSize: 11 }}>
      {children.toUpperCase()}
    </AppText>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.panel, { backgroundColor: colors.surface }]}>{children}</View>;
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center', paddingHorizontal: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  dialogWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  dialog: { width: '100%', maxWidth: 560, maxHeight: '86%', borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: space.xl, gap: space.md },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.xl, paddingTop: space.md, gap: space.md, maxHeight: '88%' },
  grab: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center' },
  input: { borderRadius: radius.md, paddingHorizontal: space.lg, fontFamily: fonts.medium, fontSize: 16, paddingVertical: 12 },
  amount: { fontFamily: fonts.extrabold, fontSize: 26 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  pillTab: { borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  track: { height: 10, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  panel: { borderRadius: 22, padding: space.lg, gap: space.md },
});
