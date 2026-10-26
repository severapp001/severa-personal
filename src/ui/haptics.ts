import { Platform, Vibration } from 'react-native';

// Vibración corta al elegir algo (pedido del usuario, 17-10-2026). Por ahora solo en Android,
// con la vibración del sistema; en iPhone llegará con expo-haptics en el próximo build.
export function tap() {
  if (Platform.OS === 'android') Vibration.vibrate(12);
}
