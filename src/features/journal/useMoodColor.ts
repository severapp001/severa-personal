import { moodOf } from '@/core/journal';
import { useTheme } from '@/theme/ThemeProvider';

/** El color de un ánimo del diario (como los colores de la primera versión): difícil en rojo,
 *  regular en naranjo, bien y muy bien en verdes. Sin ánimo, el color de las líneas. */
export function useMoodColor() {
  const { colors } = useTheme();
  return (mood: number | null | undefined) => {
    const tone = moodOf(mood)?.tone;
    return tone === 'bad' ? colors.bad : tone === 'mid' ? colors.mid : tone === 'ok' ? colors.accent2 : tone === 'great' ? colors.ok : colors.line;
  };
}
