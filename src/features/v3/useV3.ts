import { useSyncExternalStore } from 'react';

import type { Capa } from '@/core/parts';
import { usePref } from '@/features/space/usePref';
import { useTheme } from '@/theme/ThemeProvider';

// Severa v3 (C64–C70, 29-10-2026): va detrás del interruptor «Probar Severa v3» de Ajustes, para que
// quien no lo encienda (la pareja del usuario) siga en la v2. La preferencia viaja con la cuenta y
// guarda lo que cada persona eligió ver en cada capa (`picks`) y sus favoritos de cada parte para el
// Ser (`favs`). La capa abierta en Hoy vive solo mientras la app está abierta (`useCapa`).

export type V3Pref = { on: boolean; picks: Partial<Record<Capa, string[]>>; favs: string[] | null };

const FALLBACK: V3Pref = { on: false, picks: {}, favs: null };

export function useV3() {
  const [pref, save] = usePref<V3Pref>('v3', FALLBACK);
  return { ...pref, save };
}

// La capa abierta en Hoy: la cambian el selector de Hoy, la barra del escritorio y «Tu cuerpo».
let current: Capa = 'ser';
const listeners = new Set<() => void>();

export function setCapa(capa: Capa) {
  if (capa === current) return;
  current = capa;
  listeners.forEach((l) => l());
}

export function useCapa(): Capa {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

/** Los colores de cada capa (los de Cuerpo, mente y alma; el Ser, el del texto). */
export function useCapaColors(): Record<Capa, string> {
  const { colors } = useTheme();
  return { ser: colors.text, cuerpo: colors.ok, mente: colors.accent2, alma: colors.accent };
}
