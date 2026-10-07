import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// La bienvenida (logo vivo y presentación) se muestra la primera vez que se abre la app.
const KEY = 'severa.welcome.seen';

export function welcomeSeen(): boolean {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) === '1';
    return SecureStore.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function markWelcomeSeen() {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, '1');
    else SecureStore.setItem(KEY, '1');
  } catch {
    // Si no se puede guardar, la bienvenida vuelve a aparecer: no es grave.
  }
}
