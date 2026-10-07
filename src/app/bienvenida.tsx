import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { markWelcomeSeen } from '@/data/welcome';
import { LiveLogo } from '@/features/welcome/LiveLogo';
import { SlideConectados, SlidePersonal, SlideTrabajo } from '@/features/welcome/Slides';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';
import { AppText, Button, Screen } from '@/ui';

// F01 v2 · Bienvenida: logo vivo y tres pantallas que se tocan, antes de crear la cuenta.
export default function BienvenidaScreen() {
  const { colors } = useTheme();
  const [step, setStep] = useState<'logo' | 0 | 1 | 2>('logo');
  const [run, setRun] = useState(0);
  const [logoDone, setLogoDone] = useState(false);

  function finish(to: '/crear-cuenta' | '/entrar') {
    markWelcomeSeen();
    router.replace(to);
  }

  if (step === 'logo') {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 24 }}>
          <LiveLogo run={run} onDone={() => setLogoDone(true)} />
          {logoDone ? (
            <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: 'center', gap: 8 }}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 30, letterSpacing: 7 }}>SEVERA</AppText>
              <AppText muted>Tu vida y tu trabajo, en un solo cerebro.</AppText>
            </Animated.View>
          ) : (
            <View style={{ height: 70 }} />
          )}
        </View>
        {logoDone ? (
          <Animated.View entering={FadeIn.delay(300).duration(400)} style={{ gap: 8 }}>
            <Button label="Comenzar" onPress={() => setStep(0)} />
            <Button
              label="Ver de nuevo"
              kind="link"
              onPress={() => {
                setLogoDone(false);
                setRun((r) => r + 1);
              }}
            />
          </Animated.View>
        ) : null}
      </Screen>
    );
  }

  const last = step === 2;
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={`Paso ${step + 1} de 3`}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: i === step ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? colors.accent : colors.surface2 }} />
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={() => finish('/crear-cuenta')} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="label" muted>
            Saltar
          </AppText>
        </Pressable>
      </View>

      {step === 0 ? <SlidePersonal /> : step === 1 ? <SlideTrabajo /> : <SlideConectados />}

      <View style={{ flexGrow: 1 }} />
      <Button label={last ? 'Crear mi cuenta' : 'Siguiente'} onPress={() => (last ? finish('/crear-cuenta') : setStep((step + 1) as 1 | 2))} />
      <Button label="Ya tengo cuenta" kind="link" onPress={() => finish('/entrar')} />
    </Screen>
  );
}
