import { useEffect } from 'react';
import { Platform } from 'react-native';

import { addDays, upcomingReminders, type Reminder } from '@/core/agenda';
import { dayKey } from '@/core/today';
import { useAgenda } from '@/data/agenda';

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
      content: { title: r.title, body: r.body },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: 'recordatorios' },
    });
  }
}

/** Mantiene programados los avisos de la agenda. Va una vez, en el layout de Personal y Trabajo. */
export function useReminders() {
  const today = dayKey(new Date());
  const agenda = useAgenda(today, addDays(today, 14));
  const reminders = upcomingReminders(agenda.events, new Date());
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
