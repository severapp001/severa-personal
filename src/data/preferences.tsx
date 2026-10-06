import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeKey } from '@/theme/tokens';
import { useAuth } from './auth';
import { supabase } from './supabase';

type PreferencesState = {
  /** Los montos parten ocultos (•••) y se muestran con el ojo. Activado por defecto. */
  hideAmounts: boolean;
  setHideAmounts: (value: boolean) => void;
  setTheme: (theme: ThemeKey) => void;
};

const PreferencesContext = createContext<PreferencesState | null>(null);

const THEMES: ThemeKey[] = ['gold', 'dark', 'light', 'pink', 'blue'];

// Lee user_preferences al entrar y guarda los cambios. El tema «auto» (I4) llega después.
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const theme = useTheme();
  const [hideAmounts, setHide] = useState(true);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId || !ready) return;
    supabase
      .from('user_preferences')
      .select('theme, work_theme, hide_amounts')
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (THEMES.includes(data.theme)) theme.setTheme(data.theme);
        theme.setWorkTheme(data.work_theme === 'same' ? 'same' : 'pair');
        setHide(data.hide_amounts);
      });
    // Solo al cambiar de cuenta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ready]);

  const save = useCallback(
    (patch: Record<string, unknown>) => {
      if (!userId) return;
      supabase.from('user_preferences').update(patch).eq('account_id', userId).then();
    },
    [userId],
  );

  const value = useMemo<PreferencesState>(
    () => ({
      hideAmounts,
      setHideAmounts(next) {
        setHide(next);
        save({ hide_amounts: next });
      },
      setTheme(next) {
        theme.setTheme(next);
        save({ theme: next });
      },
    }),
    [hideAmounts, save, theme],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesState {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error('usePreferences debe usarse dentro de PreferencesProvider');
  return value;
}
