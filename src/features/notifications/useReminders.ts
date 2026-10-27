import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { addDays, closingReminders, upcomingReminders, type Reminder } from '@/core/agenda';
import { dayEntry } from '@/core/journal';
import { dayKey } from '@/core/today';
import { useAgenda } from '@/data/agenda';
import { useJournal } from '@/data/journal';
import { usePref } from '@/features/space/usePref';

// Avisos en el teléfono (P2, 25-10-2026): los eventos con aviso de los próximos 14 días se
// programan en el teléfono y suenan sin Internet. Cada vez que cambia la agenda se vuelven a
// programar todos. La versión de la app que no trae el módulo de avisos (el development build
// anterior) simplemente no avisa.

type NotificationsModule = typeof import('expo-notifications');

let loaded: Promise<NotificationsModule | null> | null = null;
function notifications(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return Promise.resolve(null);
  loaded ??= import('expo-notifications')
    .then(async (N) => {
      N.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
      });
      if (Platform.OS === 'android') {
        await N.setNotificationChannelAsync('recordatorios', { name: 'Recordatorios', importance: N.AndroidImportance.HIGH });
      }
      return N;
    })
    .catch(() => null);
  return loaded;
}

async function schedule(reminders: Reminder[]) {
  const N = await notifications();
  if (!N) return;
  const perm = await N.getPermissionsAsync();
  if (!perm.granted) {
    if (!reminders.length || !perm.canAskAgain) return;
    const asked = await N.requestPermissionsAsync();
    if (!asked.granted) return;
  }
  await N.cancelAllScheduledNotificationsAsync();
  for (const r of reminders) {
    await N.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: r.url ? { url: r.url } : {} },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: 'recordatorios' },
    });
  }
}

/** La hora del aviso para cerrar el día (27-10-2026); se cambia en la pantalla «Cerrar el día». */
export const CLOSING_DEFAULT = { hora: '21:30', aviso: true };

/** Mantiene programados los avisos de la agenda y el de cerrar el día. Va una vez, en el layout de
 *  Personal y Trabajo. Al tocar un aviso que trae pantalla (el cierre), la abre. */
export function useReminders() {
  const today = dayKey(new Date());
  const agenda = useAgenda(today, addDays(today, 14));
  const journal = useJournal();
  const [closing] = usePref('cierre', CLOSING_DEFAULT);
  const closed = new Set(Array.from({ length: 7 }, (_, i) => addDays(today, i)).filter((d) => !!dayEntry(journal.days, d)?.closed));
  const reminders = [...upcomingReminders(agenda.events, new Date()), ...(closing.aviso ? closingReminders(String(closing.hora), new Date(), closed) : [])];
  const key = reminders.map((r) => `${r.id}@${r.at.getTime()}:${r.title}:${r.body}`).join('|');
  useEffect(() => {
    // Espera un momento: al abrir, la agenda llega en partes desde la base del teléfono.
    const t = setTimeout(() => {
      schedule(reminders).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(t);
    // reminders cambia en cada render; su contenido lo identifica key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Abre la pantalla que trae el aviso tocado (también si la app estaba cerrada). */
export function useOpenFromNotification() {
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let alive = true;
    notifications().then(async (N) => {
      if (!N || !alive) return;
      const go = (data: unknown) => {
        const url = (data as { url?: unknown } | null)?.url;
        if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
      };
      const last = await N.getLastNotificationResponseAsync();
      // Solo si se tocó hace poco: la última respuesta queda guardada y no debe abrirse en cada apertura.
      if (last && Date.now() - last.notification.date < 10 * 60 * 1000) go(last.notification.request.content.data);
      sub = N.addNotificationResponseReceivedListener((r) => go(r.notification.request.content.data));
    });
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
}
