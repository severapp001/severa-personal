import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { usePreferences } from '@/data/preferences';

// Montos ocultos (usuario, 05-10-2026): cada pantalla parte según la preferencia
// (ocultos por defecto) y el ojo los muestra. Al salir de la pantalla o dejar la app
// en segundo plano, vuelve a la preferencia.
export function useAmountVisibility() {
  const { hideAmounts } = usePreferences();
  // null = sin tocar el ojo: manda la preferencia.
  const [override, setOverride] = useState<boolean | null>(null);
  const visible = override ?? !hideAmounts;

  useFocusEffect(
    useCallback(() => {
      return () => setOverride(null);
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setOverride(null);
    });
    return () => sub.remove();
  }, []);

  return { visible, toggle: () => setOverride(!visible) };
}
