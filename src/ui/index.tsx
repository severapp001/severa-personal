// Componentes base de Severa (E3·12). Cada uno toma los colores del tema activo.
import { forwardRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { displayAmount } from '@/core/money';
import { passwordChecks } from '@/core/password';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';
import { tap } from './haptics';
import { CheckIcon, EyeIcon, EyeSlashIcon } from './icons';

type Variant = 'title' | 'subtitle' | 'body' | 'label' | 'caption';

const variantStyle: Record<Variant, { fontFamily: string; fontSize: number; lineHeight: number }> = {
  title: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34 },
  subtitle: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
};

export function AppText({
  variant = 'body',
  muted,
  color,
  style,
  ...props
}: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const { colors } = useTheme();
  return (
    <Text
      {...props}
      style={[variantStyle[variant], { color: color ?? (muted ? colors.muted : colors.text) }, style]}
    />
  );
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const { colors } = useTheme();
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.screenBody} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={styles.screenBody}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Android va de borde a borde: la ventana ya no se achica sola con el teclado, así que
          en los dos sistemas se deja espacio abajo y el campo enfocado queda a la vista. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'link';
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const isPrimary = kind === 'primary';
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        kind === 'link' ? styles.link : styles.button,
        kind !== 'link' && { backgroundColor: isPrimary ? colors.accent : colors.surface },
        { opacity: off ? 0.55 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onAccent : colors.text} />
      ) : (
        <AppText
          variant="label"
          style={{ fontSize: kind === 'link' ? 15 : 16 }}
          color={isPrimary ? colors.onAccent : kind === 'link' ? colors.accent : colors.text}
        >
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

// Con `secureTextEntry` el campo trae un ojo para ver lo que se escribe. `footer` va bajo el campo
// (por ejemplo, las reglas de la contraseña en vivo).
export const TextField = forwardRef<TextInput, TextInputProps & { label: string; hint?: string; error?: string; footer?: ReactNode }>(
  function TextField({ label, hint, error, footer, style, secureTextEntry, ...props }, ref) {
    const { colors } = useTheme();
    const [focused, setFocused] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const Eye = revealed ? EyeSlashIcon : EyeIcon;
    return (
      <View style={{ gap: space.xs }}>
        <AppText variant="label">{label}</AppText>
        <View>
          <TextInput
            ref={ref}
            placeholderTextColor={colors.muted}
            {...props}
            secureTextEntry={secureTextEntry && !revealed}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: error ? colors.bad : focused ? colors.accent : colors.line,
              },
              secureTextEntry && { paddingRight: 56 },
              style,
            ]}
          />
          {secureTextEntry ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={revealed ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
              onPress={() => setRevealed((v) => !v)}
              hitSlop={6}
              style={styles.reveal}
            >
              <Eye size={22} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        {footer}
        {error ? (
          <AppText variant="caption" color={colors.bad}>
            {error}
          </AppText>
        ) : hint ? (
          <AppText variant="caption" muted>
            {hint}
          </AppText>
        ) : null}
      </View>
    );
  },
);

/** Las reglas de la contraseña, que se marcan mientras se escribe. */
export function PasswordRules({ password }: { password: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.rules} accessibilityLiveRegion="polite">
      {passwordChecks(password).map((c) => (
        <View key={c.key} style={[styles.rule, { backgroundColor: c.ok ? colors.okSoft : colors.surface2 }]}>
          {c.ok ? <CheckIcon size={14} weight="bold" color={colors.ok} /> : null}
          <AppText variant="caption" color={c.ok ? colors.ok : colors.muted} style={{ fontFamily: fonts.semibold, fontVariant: ['tabular-nums'] }}>
            {c.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.checkRow}
    >
      <View
        style={[
          styles.checkBox,
          { borderColor: checked ? colors.accent : colors.muted, backgroundColor: checked ? colors.accent : 'transparent' },
        ]}
      >
        {checked ? <AppText variant="label" color={colors.onAccent}>✓</AppText> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

/** Opción que se marca y desmarca (selección múltiple). `work` usa el color de Trabajo. */
export function Chip({ label, selected, onPress, work }: { label: string; selected: boolean; onPress: () => void; work?: boolean }) {
  const { colors } = useTheme();
  const on = work ? colors.accent2 : colors.accent;
  const onText = work ? (colors.isDark ? colors.bg : '#FFFFFF') : colors.onAccent;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? on : colors.surface,
          borderColor: selected ? on : colors.line,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <AppText variant="label" color={selected ? onText : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Monto en pesos: muestra «$ •••••» mientras no se toque el ojo. */
export function Amount({ value, visible, size = 'body' }: { value: number; visible: boolean; size?: 'body' | 'big' }) {
  return (
    <AppText
      variant={size === 'big' ? 'title' : 'subtitle'}
      accessibilityLabel={visible ? undefined : 'Monto oculto'}
      style={{ fontVariant: ['tabular-nums'] }}
    >
      {displayAmount(value, visible)}
    </AppText>
  );
}

/** El ojo que muestra u oculta los montos de la pantalla. */
export function EyeButton({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const Icon = visible ? EyeSlashIcon : EyeIcon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Ocultar montos' : 'Mostrar montos'}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.eye, { backgroundColor: colors.surface2, opacity: pressed ? 0.8 : 1 }]}
    >
      <Icon size={22} color={colors.text} />
    </Pressable>
  );
}

export function Notice({ text, tone = 'bad' }: { text: string; tone?: 'bad' | 'ok' | 'mid' }) {
  const { colors } = useTheme();
  const map = { bad: [colors.badSoft, colors.bad], ok: [colors.okSoft, colors.ok], mid: [colors.midSoft, colors.mid] } as const;
  const [bg, fg] = map[tone];
  return (
    <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: bg }]}>
      <AppText variant="caption" color={fg} style={{ fontFamily: fonts.semibold }}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screenBody: { flexGrow: 1, padding: space.xl, gap: space.lg },
  button: { minHeight: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1.5, paddingHorizontal: space.lg, fontFamily: fonts.medium, fontSize: 16 },
  reveal: { position: 'absolute', right: 4, top: 0, bottom: 0, width: 48, alignItems: 'center', justifyContent: 'center' },
  rules: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  checkBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  notice: { borderRadius: radius.sm, padding: space.md },
  eye: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
