import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

// Logo M13 (docs/03 Diseño/Logo e ícono.md): mitad de arriba en oro, mitad de abajo en blanco cálido.
// Sobre fondos claros va dentro de su cuadro negro (`boxed`).
export function Logo({ size = 64, boxed = false }: { size?: number; boxed?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityRole="image" accessibilityLabel="Severa">
      <Defs>
        <LinearGradient id="oroM13" gradientUnits="userSpaceOnUse" x1="18" y1="86" x2="82" y2="14">
          <Stop offset="0" stopColor="#F6DE9A" />
          <Stop offset="0.5" stopColor="#D4AF5A" />
          <Stop offset="1" stopColor="#8E6B24" />
        </LinearGradient>
      </Defs>
      {boxed ? <Path d="M22 0h56a22 22 0 0 1 22 22v56a22 22 0 0 1-22 22H22A22 22 0 0 1 0 78V22A22 22 0 0 1 22 0Z" fill="#0B0B0C" /> : null}
      <Path d="M80.39 20.09A34.5 34.5 0 0 0 29.57 66.66Z" fill="url(#oroM13)" />
      <Path d="M70.43 33.34A34.5 34.5 0 0 1 19.61 79.91Z" fill="#F4F1EA" />
    </Svg>
  );
}
