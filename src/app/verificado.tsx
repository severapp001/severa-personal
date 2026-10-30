import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { useAuth } from '@/data/auth';
import { authErrorMessage } from '@/features/account/authErrors';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Notice, Screen } from '@/ui';
import { Logo } from '@/ui/Logo';

// Aquí vuelve la persona al tocar «Confirmar» en el correo. Al abrir la sesión,
// la navegación pasa sola a Conocerte o a Personal (se crea el espacio personal).
// 28-10-2026: se ve como Severa (antes era una página negra con «Verificando tu correo»).
export default function VerificadoScreen() {
  const url = Linking.useURL();
  const { completeFromUrl } = useAuth();
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    // En la web, el enlace deja la sesión en la barra de direcciones: se borra apenas se lee.
    if (Platform.OS === 'web' && window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    completeFromUrl(url).catch((e) => setError(authErrorMessage(e)));
  }, [url, completeFromUrl]);

  return (
    <Screen width="narrow">
      <View style={{ alignItems: 'center', gap: 12, paddingTop: 48, paddingBottom: 8 }}>
        <Logo size={96} boxed={!colors.isDark} />
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 24, letterSpacing: 6 }}>SEVERA</AppText>
      </View>
      {error ? (
        <>
          <AppText variant="title">No pudimos abrir tu sesión</AppText>
          <Notice text={error} />
          <AppText muted>Si ya habías confirmado el correo, entra con tu contraseña.</AppText>
          <Button label="Entrar" onPress={() => router.replace('/entrar')} />
        </>
      ) : (
        <>
          <AppText variant="title" style={{ textAlign: 'center' }}>
            ¡Listo! Confirmaste tu correo
          </AppText>
          <AppText muted style={{ textAlign: 'center' }}>
            Entrando a Severa…
          </AppText>
          <ActivityIndicator color={colors.accent} />
        </>
      )}
    </Screen>
  );
}
