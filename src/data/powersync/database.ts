import { PowerSyncDatabase } from '@powersync/react-native';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { powerSyncUrl } from './connector';
import { AppSchema } from './schema';

// Expo Go no trae op-sqlite: ahí se usa SQLite en JavaScript (alfa, en memoria, sin cifrado,
// solo para desarrollar). En el development build y en producción, op-sqlite con SQLCipher.
export const isExpoGo = Constants.executionEnvironment === 'storeClient';

const KEY_NAME = 'severa.db.key';

// Llave de cifrado de la base del teléfono (MD-D4): 256 bits al azar, guardada en el llavero
// (Keychain / Keystore). Si se pierde, la base se vuelve a bajar del servidor.
function databaseKey(): string {
  const existing = SecureStore.getItem(KEY_NAME);
  if (existing) return existing;
  const key = Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
  SecureStore.setItem(KEY_NAME, key);
  return key;
}

function createDatabase(): PowerSyncDatabase {
  // Solo en desarrollo: en producción __DEV__ es false, la rama desaparece y el adaptador
  // (SQLite compilado a JavaScript, que Hermes no puede precompilar) no entra al paquete.
  if (__DEV__ && isExpoGo) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SQLJSOpenFactory } = require('@powersync/adapter-sql-js') as typeof import('@powersync/adapter-sql-js');
    return new PowerSyncDatabase({ schema: AppSchema, factory: new SQLJSOpenFactory({ dbFilename: 'severa.db' }) });
  }
  return new PowerSyncDatabase({
    schema: AppSchema,
    database: { dbFilename: 'severa.db', sqliteOptions: { encryptionKey: databaseKey() } },
  });
}

// Sin URL de PowerSync no se crea la base local: la app funciona en línea, como antes.
export const db: PowerSyncDatabase | null = powerSyncUrl ? createDatabase() : null;
