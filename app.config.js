// 29-10-2026: en la web, la raíz es la landing y la app vive en /app. La ruta base solo se aplica
// al exportar la web (web/deploy.js pone SEVERA_WEB=1); la app del teléfono y `npm run web` no cambian.
module.exports = ({ config }) => (process.env.SEVERA_WEB === '1' ? { ...config, experiments: { ...config.experiments, baseUrl: '/app' } } : config);
