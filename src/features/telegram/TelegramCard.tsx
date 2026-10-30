import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { useAuth } from '@/data/auth';
import { supabase } from '@/data/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText, Button, Notice } from '@/ui';
import { tap } from '@/ui/haptics';

// Conectar Telegram (27-10-2026; ver docs/02 Producto/Bot de Telegram de Severa.md). La función
// `telegram` registra el bot y entrega un código de un solo uso; se abre el bot con ese código
// («/start CÓDIGO») y el chat queda conectado. Mientras se espera, se revisa cada pocos segundos.

type Link = { username: string | null; linked_at: string };
type Started = { bot: string | null; code: string };

export function TelegramCard() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const [link, setLink] = useState<Link | null>(null);
  const [started, setStarted] = useState<Started | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cada cambio de `tick` vuelve a mirar si el chat está conectado.
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  useEffect(() => {
    let alive = true;
    supabase
      .from('telegram_links')
      .select('username, linked_at')
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setLink((data as Link | null) ?? null);
        if (data) setStarted(null);
      });
    return () => {
      alive = false;
    };
  }, [tick, session?.user.id]);

  // Con el código entregado, se revisa cada 3 segundos (hasta 3 minutos) si ya se conectó.
  useEffect(() => {
    if (!started) return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      if (n > 60) clearInterval(id);
      setTick((t) => t + 1);
    }, 3000);
    return () => clearInterval(id);
  }, [started]);

  async function connect() {
    tap();
    setBusy(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke<Started & { error?: string }>('telegram', { body: { accion: 'conectar' } });
      if (fnError) {
        const body = (await (fnError as { context?: Response }).context?.json?.().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'No se pudo conectar con el bot. Revisa tu conexión.');
      }
      if (!data?.code) throw new Error(data?.error ?? 'No se pudo crear el código.');
      setStarted(data);
      if (data.bot) await Linking.openURL(`https://t.me/${data.bot}?start=${data.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar.');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    tap();
    if (!session) return;
    await supabase.from('telegram_links').delete().eq('account_id', session.user.id);
    refresh();
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <AppText variant="subtitle">Telegram</AppText>
      {link ? (
        <>
          <AppText variant="label" color={colors.ok}>
            {`✓ Conectado${link.username ? ` como @${link.username}` : ''}`}
          </AppText>
          <AppText variant="caption" muted>
            Escríbele al bot como hablas («gasté 5 lucas en el almuerzo», «idea: …») o usa /hoy y /cerrar. Lo que guardes llega aquí solo.
          </AppText>
          <Button label="Ver lo que conversamos" kind="secondary" onPress={() => router.push({ pathname: '/asistente', params: { ver: 'conversaciones' } })} />
          <Button label="Desconectar" kind="link" onPress={disconnect} />
        </>
      ) : (
        <>
          <AppText variant="caption" muted>
            Anota gastos, tareas e ideas desde Telegram y cierra el día con botones, sin abrir la app. Gratis y sin IA. Lo de Salud, Íntimo y Terapia queda solo en la app.
          </AppText>
          <Button label={started ? 'Abrir el bot otra vez' : 'Conectar Telegram'} loading={busy} onPress={connect} />
          {started ? (
            <AppText variant="caption" muted>
              {`Toca «Iniciar» en Telegram. Si no se abrió, busca ${started.bot ? `@${started.bot}` : 'tu bot'} y envíale: /start ${started.code} (vale 15 minutos).`}
            </AppText>
          ) : null}
        </>
      )}
      {error ? <Notice text={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ card: { borderRadius: 22, padding: 16, gap: 12 } });
