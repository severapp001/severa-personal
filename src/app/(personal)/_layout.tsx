import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';

// Navegación de Personal. La barra inferior (Hoy · Calendario · + · Módulos · Ajustes) llega en la entrega 1.
export default function PersonalLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
