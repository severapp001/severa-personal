// Publica la versión web de Severa en Vercel (decisión del 25-10-2026: usarla desde el iPhone).
// 1. Exporta la app web (una sola página) a una carpeta temporal.
// 2. Copia web/vercel.json, que manda todas las rutas a index.html.
// 3. La enlaza al proyecto «severa-personal» (lo crea la primera vez) y la sube a producción.
// Pide haber iniciado sesión una vez con `npx vercel login`. Uso: npm run web:deploy
// 27-10-2026: se sube desde una carpeta temporal fuera de git. Dentro del repo, Vercel adjunta el
// último commit y bloquea la publicación si su autor (o un coautor) no es del proyecto.
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'severa-web-'));
const vercel = (args) => execSync(`npx --yes vercel@latest ${args}`, { cwd: out, stdio: 'inherit' });

execSync(`npx expo export --platform web --output-dir "${out}"`, { cwd: root, stdio: 'inherit' });
// La CLI de Vercel nunca sube carpetas llamadas node_modules, y ahí deja Expo las fuentes (Manrope)
// y las imágenes de expo-router. Se suben como assets/vendor y vercel.json redirige las rutas viejas.
const vendored = path.join(out, 'assets', 'node_modules');
if (fs.existsSync(vendored)) fs.renameSync(vendored, path.join(out, 'assets', 'vendor'));
fs.copyFileSync(path.join(__dirname, 'vercel.json'), path.join(out, 'vercel.json'));
vercel('link --yes --project severa-personal');
vercel('deploy --prod --yes');
// Windows a veces deja la carpeta tomada un rato: si no se puede borrar, la limpia el sistema.
try {
  fs.rmSync(out, { recursive: true, force: true });
} catch {
  console.log(`Quedó la carpeta temporal ${out}`);
}
