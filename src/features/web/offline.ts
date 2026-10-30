import { Platform } from 'react-native';

// Y4 (29-10-2026): en la web, el service worker (public/sw.js) guarda la app en el teléfono para
// que abra sin internet y muestre lo último que se vio. Solo en la web publicada, no en desarrollo.
const base = process.env.EXPO_BASE_URL ?? '';

export function registerServiceWorker() {
  if (Platform.OS !== 'web' || __DEV__ || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => undefined);
}

/** Al cerrar sesión: borra las lecturas guardadas, para que otra cuenta no las vea sin internet. */
export function clearOfflineData() {
  if (Platform.OS !== 'web' || typeof caches === 'undefined') return;
  caches.delete('severa-data').catch(() => undefined);
}
