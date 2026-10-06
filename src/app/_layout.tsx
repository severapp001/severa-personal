import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthProvider, useAuth } from '@/data/auth';
import { PreferencesProvider } from '@/data/preferences';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, ready, loading, recovering } = useAuth();
  const { colors } = useTheme();
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  const booting = loading || !fontsLoaded;
  useEffect(() => {
    if (!booting) SplashScreen.hideAsync();
  }, [booting]);
  if (booting) return null;

  // Con el enlace de «cambiar contraseña» hay sesión, pero primero se escribe la clave nueva.
  const inside = !!session && ready && !recovering;
  return (
    <>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={inside}>
          <Stack.Screen name="(personal)" />
        </Stack.Protected>
        <Stack.Protected guard={!inside}>
          <Stack.Screen name="entrar" />
          <Stack.Screen name="crear-cuenta" />
          <Stack.Screen name="verificar" />
          <Stack.Screen name="verificado" />
          <Stack.Screen name="recuperar" />
          <Stack.Screen name="nueva-clave" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PreferencesProvider>
          <RootNavigator />
        </PreferencesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
