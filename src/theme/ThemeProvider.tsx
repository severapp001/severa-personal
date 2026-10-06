import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { paletteFor, type Palette, type SpaceMode, type ThemeKey } from './tokens';

type ThemeState = {
  colors: Palette;
  theme: ThemeKey;
  mode: SpaceMode;
  workTheme: 'pair' | 'same';
  setTheme: (theme: ThemeKey) => void;
  setMode: (mode: SpaceMode) => void;
  setWorkTheme: (workTheme: 'pair' | 'same') => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

// Por ahora el tema vive en memoria; en la entrega 1 se lee de user_preferences.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeKey>('gold');
  const [mode, setMode] = useState<SpaceMode>('personal');
  const [workTheme, setWorkTheme] = useState<'pair' | 'same'>('pair');

  const value = useMemo(
    () => ({ colors: paletteFor(theme, mode, workTheme), theme, mode, workTheme, setTheme, setMode, setWorkTheme }),
    [theme, mode, workTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return value;
}
