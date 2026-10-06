// Configuración de Metro (https://docs.expo.dev/guides/customizing-metro/).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// El adaptador de PowerSync para Expo Go (SQLite compilado a JavaScript) trae ramas para
// Node.js que importan «fs» y «crypto». En el teléfono no se usan: se reemplazan por un módulo vacío.
const NODE_ONLY = new Set(['fs', 'crypto', 'path', 'node:fs', 'node:crypto', 'node:path']);
const emptyModule = path.join(__dirname, 'src', 'data', 'powersync', 'empty-module.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = context.originModulePath.split(path.sep).join('/');
  const fromSqlJs = origin.includes('/@powersync/adapter-sql-js/') || origin.includes('/@powersync/sql-js/');
  if (fromSqlJs && NODE_ONLY.has(moduleName)) {
    return { type: 'sourceFile', filePath: emptyModule };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
