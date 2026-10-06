import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { useAuth } from '@/data/auth';
import { authErrorMessage } from '@/features/account/authErrors';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Notice, Screen } from '@/ui';

// Aquí vuelve la persona al tocar «Confirmar» en el correo. Al abrir la sesión,
// la navegación pasa sola a Personal (se crea el espacio personal).
export default function VerificadoScreen() {
  const url = Linking.useURL();
  const { completeFromUrl } = useAuth();
  const { colors } = useTheme();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    completeFromUrl(url).catch((e) => setError(authErrorMessage(e)));
  }, [url, completeFromUrl]);

  return (
    <Screen>
      <AppText variant="title">Verificando tu correo</AppText>
      {error ? (
        <>
          <Notice text={error} />
          <AppText muted>Si ya habías confirmado el correo, entra con tu contraseña.</AppText>
        </>
      ) : (
        <ActivityIndicator color={colors.accent} />
      )}
      <Button label="Ir a entrar" kind="link" onPress={() => router.replace('/entrar')} />
    </Screen>
  );
}
