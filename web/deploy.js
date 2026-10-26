// Publica la versión web de Severa en Vercel (decisión del 25-10-2026: usarla desde el iPhone).
// 1. Exporta la app web (una sola página) a web-build/.
// 2. Copia web/vercel.json, que manda todas las rutas a index.html.
// 3. La enlaza al proyecto «severa-personal» (lo crea la primera vez) y la sube a producción.
// Pide haber iniciado sesión una vez con `npx vercel login`. Uso: npm run web:deploy
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'web-build');
const vercel = (args) => execSync(`npx --yes vercel@latest ${args}`, { cwd: root, stdio: 'inherit' });

fs.rmSync(out, { recursive: true, force: true });
execSync('npx expo export --platform web --output-dir web-build', { cwd: root, stdio: 'inherit' });
fs.copyFileSync(path.join(__dirname, 'vercel.json'), path.join(out, 'vercel.json'));
vercel('link --yes --project severa-personal --cwd web-build');
vercel('deploy --prod --yes --cwd web-build');
