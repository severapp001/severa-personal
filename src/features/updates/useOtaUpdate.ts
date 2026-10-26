import * as Updates from 'expo-updates';
import { useEffect } from 'react';

// Versiones nuevas sin reinstalar (EAS Update, 26-10-2026). Por defecto la APK baja la versión
// nueva al abrir y la usa recién en la apertura siguiente: así el usuario siguió viendo la versión
// vieja del asistente («falta la clave de Anthropic»). Ahora, si al abrir hay una versión nueva,
// se baja y la app se reinicia sola mientras corre la animación de inicio.
export function useOtaUpdate() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    let alive = true;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!alive || !check.isAvailable) return;
        const fetched = await Updates.fetchUpdateAsync();
        if (alive && fetched.isNew) await Updates.reloadAsync();
      } catch {
        // Sin conexión: se intenta en la próxima apertura.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
}
