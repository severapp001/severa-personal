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

// Logo v3, el «M13 de cuatro» (C70, docs/03 Diseño/Logo e ícono.md): cada mitad del M13 lleva dentro un
// semicírculo de radio R ÷ φ (34,5 → 21,32). Arriba van la mente (oro, por fuera) y el alma (por dentro);
// abajo, el Ser (por dentro) y el cuerpo (por fuera), como en la figura. `lit` resalta una capa y
// apaga un poco las demás (el selector de Hoy).
type Capa = 'ser' | 'cuerpo' | 'mente' | 'alma';
const PIECES: { capa: Capa; d: string; fill: string }[] = [
  { capa: 'mente', d: 'M80.39 20.09A34.5 34.5 0 0 0 29.57 66.66L38.32 58.64A22.6 22.6 0 0 1 71.64 28.11Z', fill: 'url(#oroM13v3)' },
  { capa: 'alma', d: 'M70.70 28.97A21.32 21.32 0 0 0 39.26 57.78Z', fill: '#8E6B24' },
  { capa: 'cuerpo', d: 'M70.43 33.34A34.5 34.5 0 0 1 19.61 79.91L28.36 71.89A22.6 22.6 0 0 0 61.68 41.36Z', fill: '#F4F1EA' },
  { capa: 'ser', d: 'M60.74 42.22A21.32 21.32 0 0 1 29.30 71.03Z', fill: '#C9C2B2' },
];

export function LogoCuatro({ size = 64, boxed = false, lit }: { size?: number; boxed?: boolean; lit?: Capa | null }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityRole="image" accessibilityLabel="Severa">
      <Defs>
        <LinearGradient id="oroM13v3" gradientUnits="userSpaceOnUse" x1="18" y1="86" x2="82" y2="14">
          <Stop offset="0" stopColor="#F6DE9A" />
          <Stop offset="0.5" stopColor="#D4AF5A" />
          <Stop offset="1" stopColor="#8E6B24" />
        </LinearGradient>
      </Defs>
      {boxed ? <Path d="M22 0h56a22 22 0 0 1 22 22v56a22 22 0 0 1-22 22H22A22 22 0 0 1 0 78V22A22 22 0 0 1 22 0Z" fill="#0B0B0C" /> : null}
      {PIECES.map((p) => (
        <Path key={p.capa} d={p.d} fill={p.fill} opacity={lit && lit !== p.capa ? 0.35 : 1} />
      ))}
    </Svg>
  );
}
