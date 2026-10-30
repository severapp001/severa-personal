import { Platform, useWindowDimensions } from 'react-native';

import { fonts } from '@/theme/tokens';

// Escritorio (29-10-2026, usuario: «la optimización para escritorio está pésima… debe ser como un
// programa nativo de computador»): desde 1024 px de ancho hay menú lateral en vez de la barra de
// abajo, las pantallas tienen un ancho cómodo e Inicio va en columnas. En el teléfono no cambia nada.
export const WIDE = 1024;

/** Letra de los títulos de Severa v3 en el escritorio (Cormorant Garamond, en la línea de Leonardo;
 *  se carga en public/index.html). En el teléfono sigue Manrope. */
export const SERIF = Platform.OS === 'web' ? '"Cormorant Garamond", Georgia, serif' : fonts.bold;

export function useLayout() {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  return { wide, width, columns: width >= 1500 ? 3 : wide ? 2 : 1 };
}
