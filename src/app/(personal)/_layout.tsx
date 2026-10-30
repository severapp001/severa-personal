import { Stack } from 'expo-router';
import { View } from 'react-native';

import { useOpenFromNotification, useReminders } from '@/features/notifications/useReminders';
import { SpaceCrossProvider } from '@/features/space/SpaceCross';
import { TopNav } from '@/features/space/TopNav';
import { IntroOverlay } from '@/features/welcome/IntroOverlay';
import { useTheme } from '@/theme/ThemeProvider';
import { useLayout } from '@/ui/layout';

// Personal y Trabajo: las pestañas (Hoy · Calendario · + · Módulos · Ajustes) y, encima, el
// cerebro, que se abre desde el logo. El cruce entre espacios cubre todas estas pantallas.
// Aquí también se mantienen programados los avisos de la agenda en el teléfono y, encima de todo,
// corre el inicio animado cada vez que se abre la app (26-10-2026).
// En el computador (29-10-2026) la barra de arriba (TopNav, Severa v3) queda fija sobre todas las
// pantallas; el hueco se mantiene vacío en el teléfono para que la navegación no se reinicie al
// cambiar el ancho.
export default function PersonalLayout() {
  const { colors } = useTheme();
  const { wide } = useLayout();
  useReminders();
  useOpenFromNotification();
  return (
    <SpaceCrossProvider>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {wide ? <TopNav /> : null}
        <View style={{ flex: 1 }}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="cerebro" options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom' }} />
          </Stack>
        </View>
      </View>
      <IntroOverlay />
    </SpaceCrossProvider>
  );
}
