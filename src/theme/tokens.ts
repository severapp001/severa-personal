// Tokens del sistema de diseño v1.1 (docs/03 Diseño/Sistema de diseño.md).
// Cada tema de Personal tiene su par de Trabajo (A1, aprobado el 05-10-2026).

export type ThemeKey = 'gold' | 'dark' | 'light' | 'pink' | 'blue';
export type SpaceMode = 'personal' | 'work';

export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  accent2: string;
  accent2Soft: string;
  ok: string;
  okSoft: string;
  mid: string;
  midSoft: string;
  bad: string;
  badSoft: string;
  isDark: boolean;
};

export const personalThemes: Record<ThemeKey, Palette> = {
  gold: {
    bg: '#0B0B0C', surface: '#17171A', surface2: '#222226', line: '#2C2C31',
    text: '#F1EEE6', muted: '#A9A498',
    accent: '#D4AF5A', accentSoft: '#2A2416', onAccent: '#0B0B0C',
    accent2: '#8DB6CF', accent2Soft: '#172028',
    ok: '#5FC98F', okSoft: '#13281C', mid: '#F29B55', midSoft: '#33221A', bad: '#F2766E', badSoft: '#3A1C1A',
    isDark: true,
  },
  dark: {
    bg: '#0D0D0F', surface: '#1A1A1E', surface2: '#26262C', line: '#2C2C33',
    text: '#F2F2F4', muted: '#A3A3AD',
    accent: '#7AA2FF', accentSoft: '#1E2740', onAccent: '#0D0D0F',
    accent2: '#F0A060', accent2Soft: '#3A2A1C',
    ok: '#4CC38A', okSoft: '#16301F', mid: '#F2C14E', midSoft: '#3A3016', bad: '#F2766E', badSoft: '#3A1C1A',
    isDark: true,
  },
  light: {
    bg: '#F4F3F0', surface: '#FFFFFF', surface2: '#ECEAE5', line: '#E4E1DA',
    text: '#17171A', muted: '#5E5E66',
    accent: '#2A62D6', accentSoft: '#E3EBFB', onAccent: '#FFFFFF',
    accent2: '#A4501D', accent2Soft: '#F7E6DA',
    ok: '#1F7850', okSoft: '#DFF2E8', mid: '#906306', midSoft: '#FBEFD2', bad: '#B73832', badSoft: '#F9E0DE',
    isDark: false,
  },
  pink: {
    bg: '#FBF1F3', surface: '#FFFFFF', surface2: '#F6E1E6', line: '#F0D6DD',
    text: '#3A2229', muted: '#7A5560',
    accent: '#A83C64', accentSoft: '#F8DCE6', onAccent: '#FFFFFF',
    accent2: '#6655BD', accent2Soft: '#E7E2F8',
    ok: '#287751', okSoft: '#E1F1E7', mid: '#8D610A', midSoft: '#F8EBCF', bad: '#B23645', badSoft: '#F8DDE1',
    isDark: false,
  },
  blue: {
    bg: '#0B1426', surface: '#13203A', surface2: '#1C2C4D', line: '#233559',
    text: '#EAF0FA', muted: '#9FB0CC',
    accent: '#5FB4FF', accentSoft: '#16304F', onAccent: '#0B1426',
    accent2: '#F2B84B', accent2Soft: '#3A3120',
    ok: '#54D19A', okSoft: '#15352B', mid: '#F2C14E', midSoft: '#3A3120', bad: '#FF7B72', badSoft: '#3D2130',
    isDark: true,
  },
};

// Par de Trabajo: fondo más frío y neutro; la acción principal toma el color de Trabajo.
const workOverrides: Record<ThemeKey, Pick<Palette, 'bg' | 'surface' | 'surface2' | 'line' | 'text' | 'muted' | 'onAccent'>> = {
  gold: { bg: '#0A0D10', surface: '#141A1F', surface2: '#1C242B', line: '#26303A', text: '#E9EEF2', muted: '#9AA7B2', onAccent: '#0A0D10' },
  dark: { bg: '#0C0F12', surface: '#181D22', surface2: '#222A31', line: '#2A333B', text: '#EEF2F5', muted: '#A0AAB4', onAccent: '#0C0F12' },
  blue: { bg: '#11161C', surface: '#1A222B', surface2: '#243039', line: '#2B3743', text: '#ECEFF3', muted: '#A3AEBA', onAccent: '#11161C' },
  light: { bg: '#EEF1F3', surface: '#FFFFFF', surface2: '#E2E7EB', line: '#D9DFE4', text: '#14181C', muted: '#56606A', onAccent: '#FFFFFF' },
  pink: { bg: '#F3F2FA', surface: '#FFFFFF', surface2: '#E6E3F4', line: '#DDD9EF', text: '#241F3A', muted: '#5E5878', onAccent: '#FFFFFF' },
};

export const themeNames: Record<ThemeKey, { personal: string; work: string }> = {
  gold: { personal: 'Negro y oro', work: 'Grafito y acero' },
  dark: { personal: 'Oscuro', work: 'Oscuro acero' },
  blue: { personal: 'Azul oscuro', work: 'Pizarra' },
  light: { personal: 'Claro', work: 'Oficina' },
  pink: { personal: 'Pastel rosa', work: 'Lavanda' },
};

export function paletteFor(theme: ThemeKey, mode: SpaceMode, workTheme: 'pair' | 'same' = 'pair'): Palette {
  const base = personalThemes[theme];
  if (mode === 'personal' || workTheme === 'same') return base;
  return {
    ...base,
    ...workOverrides[theme],
    accent: base.accent2,
    accentSoft: base.accent2Soft,
  };
}

export const radius = { sm: 12, md: 16, lg: 22, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;
