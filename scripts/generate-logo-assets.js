// Uso: npm run assets:logo
// Genera los recursos del logo M13 (docs/03 Diseño/Logo e ícono.md).
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] ?? path.join(__dirname, '..', 'assets', 'images');
const BLACK = '#0B0B0C', WHITE = '#F4F1EA';
const GOLD = `<linearGradient id="oro" gradientUnits="userSpaceOnUse" x1="18" y1="86" x2="82" y2="14">
  <stop offset="0" stop-color="#F6DE9A"/><stop offset="0.5" stop-color="#D4AF5A"/><stop offset="1" stop-color="#8E6B24"/></linearGradient>`;
const TOP = 'M80.39 20.09A34.5 34.5 0 0 0 29.57 66.66Z';
const BOTTOM = 'M70.43 33.34A34.5 34.5 0 0 1 19.61 79.91Z';

// scale: fracción del lienzo que ocupa el cuadro de 100 del logo (el dibujo ocupa ~61 % de ese cuadro)
function svg({ size, bg, scale, mono }) {
  const s = (size * scale) / 100, off = (size - size * scale) / 2;
  const top = mono ? '#FFFFFF' : 'url(#oro)', bottom = mono ? '#FFFFFF' : WHITE;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${GOLD}</defs>
  ${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}
  <g transform="translate(${off} ${off}) scale(${s})"><path d="${TOP}" fill="${top}"/><path d="${BOTTOM}" fill="${bottom}"/></g>
</svg>`;
}

function png(name, opts) {
  const data = new Resvg(svg(opts), { fitTo: { mode: 'original' } }).render().asPng();
  fs.writeFileSync(path.join(OUT, name), data);
  console.log(name, opts.size + 'px', (data.length / 1024).toFixed(0) + ' KB');
}

png('icon.png', { size: 1024, bg: BLACK, scale: 0.9 });                    // iOS y tiendas: logo ~61 % del ícono
png('android-icon-foreground.png', { size: 1024, scale: 0.92 });            // dentro de la zona segura de 66/108
png('android-icon-background.png', { size: 1024, bg: BLACK, scale: 0 });    // fondo negro liso
png('android-icon-monochrome.png', { size: 1024, scale: 0.92, mono: true }); // íconos temáticos
png('splash-icon.png', { size: 1024, scale: 1.0 });                          // pantalla de carga, sobre negro
png('favicon.png', { size: 48, bg: BLACK, scale: 1.0 });
fs.writeFileSync(path.join(OUT, 'logo-m13.svg'), svg({ size: 100, scale: 1 }));
