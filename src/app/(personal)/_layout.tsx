import { Stack } from 'expo-router';

import { useReminders } from '@/features/notifications/useReminders';
import { SpaceCrossProvider } from '@/features/space/SpaceCross';
import { useTheme } from '@/theme/ThemeProvider';

// Personal y Trabajo: las pestañas (Hoy · Calendario · + · Módulos · Ajustes) y, encima, el
// cerebro, que se abre desde el logo. El cruce entre espacios cubre todas estas pantallas.
// Aquí también se mantienen programados los avisos de la agenda en el teléfono.
export default function PersonalLayout() {
  const { colors } = useTheme();
  useReminders();
  return (
    <SpaceCrossProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cerebro" options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom' }} />
      </Stack>
    </SpaceCrossProvider>
  );
}
