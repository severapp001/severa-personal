import { PowerSyncDatabase } from '@powersync/react-native';
import Constants from 'expo-constants';

import { powerSyncUrl } from './connector';
import { AppSchema } from './schema';

// Expo Go no trae op-sqlite: ahí se usa SQLite en JavaScript (alfa, en memoria, sin cifrado,
// solo para desarrollar). En el development build y en producción, op-sqlite (con SQLCipher después).
export const isExpoGo = Constants.executionEnvironment === 'storeClient';

function createDatabase(): PowerSyncDatabase {
  // Solo en desarrollo: en producción __DEV__ es false, la rama desaparece y el adaptador
  // (SQLite compilado a JavaScript, que Hermes no puede precompilar) no entra al paquete.
  if (__DEV__ && isExpoGo) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SQLJSOpenFactory } = require('@powersync/adapter-sql-js') as typeof import('@powersync/adapter-sql-js');
    return new PowerSyncDatabase({ schema: AppSchema, factory: new SQLJSOpenFactory({ dbFilename: 'severa.db' }) });
  }
  return new PowerSyncDatabase({ schema: AppSchema, database: { dbFilename: 'severa.db' } });
}

// Sin URL de PowerSync no se crea la base local: la app funciona en línea, como antes.
export const db: PowerSyncDatabase | null = powerSyncUrl ? createDatabase() : null;
