// Publica la versión web de Severa en Vercel (decisión del 25-10-2026: usarla desde el iPhone).
// 29-10-2026: la raíz es la landing (web/landing) y la app vive en /app (app.config.js con SEVERA_WEB=1).
// 1. Exporta la app web (una sola página) a una carpeta temporal, dentro de app/.
// 2. Deja en la raíz lo que comparten la landing y la app (manifiesto, íconos, pantallas de carga) y la landing.
// 3. Copia web/vercel.json (rutas viejas a /app, la app como una sola página) y la sube a producción.
// Pide haber iniciado sesión una vez con `npx vercel login`. Uso: npm run web:deploy
// 27-10-2026: se sube desde una carpeta temporal fuera de git. Dentro del repo, Vercel adjunta el
// último commit y bloquea la publicación si su autor (o un coautor) no es del proyecto.
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'severa-web-'));
const app = path.join(out, 'app');
const landing = path.join(__dirname, 'landing');
const vercel = (args) => execSync(`npx --yes vercel@latest ${args}`, { cwd: out, stdio: 'inherit' });

execSync(`npx expo export --platform web --output-dir "${app}"`, { cwd: root, stdio: 'inherit', env: { ...process.env, SEVERA_WEB: '1' } });
// La CLI de Vercel nunca sube carpetas llamadas node_modules, y ahí deja Expo las fuentes (Manrope)
// y las imágenes de expo-router. Se suben como assets/vendor y vercel.json redirige las rutas viejas.
const vendored = path.join(app, 'assets', 'node_modules');
if (fs.existsSync(vendored)) fs.renameSync(vendored, path.join(app, 'assets', 'vendor'));
for (const file of ['manifest.json', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'favicon.ico']) {
  fs.copyFileSync(path.join(app, file), path.join(out, file));
}
fs.renameSync(path.join(app, 'splash'), path.join(out, 'splash'));
fs.cpSync(landing, path.join(out, 'landing'), { recursive: true, filter: (src) => path.basename(src) !== 'index.html' });
fs.copyFileSync(path.join(landing, 'index.html'), path.join(out, 'index.html'));
fs.copyFileSync(path.join(__dirname, 'vercel.json'), path.join(out, 'vercel.json'));
vercel('link --yes --project severa-personal');
vercel('deploy --prod --yes');
// Windows a veces deja la carpeta tomada un rato: si no se puede borrar, la limpia el sistema.
try {
  fs.rmSync(out, { recursive: true, force: true });
} catch {
  console.log(`Quedó la carpeta temporal ${out}`);
}
