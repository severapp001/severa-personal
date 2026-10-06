// Componentes base de Severa (E3·12). Cada uno toma los colores del tema activo.
import { forwardRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import { EyeIcon, EyeSlashIcon } from 'phosphor-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { displayAmount } from '@/core/money';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';

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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

export const TextField = forwardRef<TextInput, TextInputProps & { label: string; hint?: string; error?: string }>(
  function TextField({ label, hint, error, style, ...props }, ref) {
    const { colors } = useTheme();
    const [focused, setFocused] = useState(false);
    return (
      <View style={{ gap: space.xs }}>
        <AppText variant="label">{label}</AppText>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.muted}
          {...props}
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
            style,
          ]}
        />
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
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  checkBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  notice: { borderRadius: radius.sm, padding: space.md },
  eye: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
