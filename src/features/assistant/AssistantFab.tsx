import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { tap } from '@/ui/haptics';
import { ChatCircleTextIcon } from '@/ui/icons';

/** Botón flotante para escribirle al asistente (pedido del usuario, 25-10-2026), sobre la barra
 *  de pestañas, abajo a la derecha. */
export function AssistantFab({ bottom }: { bottom: number }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Escribirle a Severa"
      onPress={() => {
        tap();
        router.push('/asistente');
      }}
      style={({ pressed }) => [styles.fab, { bottom, backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
    >
      <ChatCircleTextIcon size={28} weight="fill" color={colors.onAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});
