// Copia la lógica pura de la app (src/core) a la función del bot de Telegram
// (supabase/functions/_shared/core), para que el bot entienda exactamente lo mismo que el
// Asistente (27-10-2026). Deno exige la extensión en cada import: se agrega «.ts».
// Uso: npm run bot:core (antes de publicar la función `telegram`). No editar los archivos copiados.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const from = path.join(root, 'src', 'core');
const to = path.join(root, 'supabase', 'functions', '_shared', 'core');
const FILES = ['intent', 'assistant', 'money', 'agenda', 'today', 'journal', 'goals', 'studies', 'bankMail', 'conversations'];

fs.mkdirSync(to, { recursive: true });
for (const name of FILES) {
  const src = fs.readFileSync(path.join(from, `${name}.ts`), 'utf8');
  const out = src.replace(/(from\s+'\.\/[a-z]+)'/g, "$1.ts'");
  fs.writeFileSync(path.join(to, `${name}.ts`), `// Copiado de src/core/${name}.ts por scripts/bot-core.js. No editar aquí.\n${out}`);
}
console.log(`Copiados ${FILES.length} archivos a supabase/functions/_shared/core`);
