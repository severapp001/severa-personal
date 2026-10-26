import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui';
import { CaretLeftIcon } from '@/ui/icons';

/** Encabezado de un módulo: volver, título y una acción a la derecha. */
export function ModuleHeader({ title, kicker, right }: { title: string; kicker?: string; right?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={[styles.back, { backgroundColor: colors.surface }]}
      >
        <CaretLeftIcon size={20} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        {kicker ? (
          <AppText variant="caption" muted style={{ letterSpacing: 1.4 }}>
            {kicker.toUpperCase()}
          </AppText>
        ) : null}
        {/* Los nombres largos («Gastos compartidos») bajan de tamaño en vez de cortarse. */}
        <AppText variant="title" numberOfLines={2} style={title.length > 16 ? { fontSize: 23, lineHeight: 28 } : undefined}>
          {title}
        </AppText>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
