// El script de Google Apps Script que se pega una vez en la cuenta de Google de la persona
// (29-10-2026). Cada 10 minutos le pregunta a Severa qué buscar (los bancos elegidos en Ajustes, sin
// Promociones ni Social), busca esos correos de los últimos 2 días, los manda a la función `correo`
// con su clave y los marca con la etiqueta «Severa/Listo» para no mandarlos de nuevo. Como la
// búsqueda viene de Severa, cambiar de bancos no obliga a pegarlo otra vez (versión 2).

export const MAIL_URL = 'https://hcwmbeokrcagrqbhvkoa.supabase.co/functions/v1/correo';
export const SCRIPT_VERSION = 2;

export function scriptFor(key: string, day: string): string {
  return `// Severa · los correos de tu banco → Severa → Telegram (versión ${SCRIPT_VERSION}, armado el ${day}).
// 1. Abre script.google.com/create y pega todo esto (borra lo que venía).
// 2. Guarda (Ctrl+S).
// 3. Arriba elige la función «instalar» y toca «Ejecutar». Google te pedirá permiso: acéptalo.
// Desde ahí, cada 10 minutos busca los correos de los bancos que elegiste en Severa y te escribe por
// Telegram. Si cambias tus bancos en Severa, se aplica solo: no hay que volver a pegarlo.
// Para apagarlo: «Activadores» (el reloj) → borrar, o borra el proyecto.
// No compartas este script: lleva tu clave. Si la pierdes, arma uno nuevo en Severa.

var SEVERA_URL = '${MAIL_URL}';
var SEVERA_KEY = '${key}';

function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('revisar').timeBased().everyMinutes(10).create();
  revisar();
}

function llamar(cuerpo) {
  return UrlFetchApp.fetch(SEVERA_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-severa-key': SEVERA_KEY },
    payload: JSON.stringify(cuerpo),
    muteHttpExceptions: true,
  });
}

function revisar() {
  var cfg = llamar({ accion: 'config' });
  if (cfg.getResponseCode() !== 200) return console.log('Severa respondió ' + cfg.getResponseCode() + ': ' + cfg.getContentText());
  var busqueda = JSON.parse(cfg.getContentText()).query;
  if (!busqueda) return console.log('No elegiste bancos en Severa (Ajustes → Automatizaciones).');
  var listo = GmailApp.getUserLabelByName('Severa/Listo') || GmailApp.createLabel('Severa/Listo');
  var hilos = GmailApp.search(busqueda + ' newer_than:2d -label:Severa/Listo', 0, 20);
  if (!hilos.length) return;
  var correos = [];
  hilos.forEach(function (h) {
    h.getMessages().forEach(function (m) {
      correos.push({ id: m.getId(), from: m.getFrom(), subject: m.getSubject(), date: m.getDate().toISOString(), body: m.getPlainBody().slice(0, 6000) });
    });
  });
  var r = llamar({ messages: correos.slice(0, 30) });
  if (r.getResponseCode() === 200) hilos.forEach(function (h) { h.addLabel(listo); });
  else console.log('Severa respondió ' + r.getResponseCode() + ': ' + r.getContentText());
}
`;
}
