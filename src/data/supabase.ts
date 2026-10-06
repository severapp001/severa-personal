import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

import { secureStorage } from './secureStorage';

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!rawUrl || !publishableKey) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ver .env.example)');
}

// Con Supabase local, el teléfono no llega a 127.0.0.1: se usa la IP del computador
// que sirve la app (la misma de Metro).
function resolveUrl(url: string): string {
  const isLocal = /127\.0\.0\.1|localhost/.test(url);
  const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (isLocal && metroHost && Platform.OS !== 'web') {
    return url.replace(/127\.0\.0\.1|localhost/, metroHost);
  }
  return url;
}

export const supabaseUrl = resolveUrl(rawUrl);

export const supabase = createClient(supabaseUrl, publishableKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Renueva el token solo mientras la app está en primer plano.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
