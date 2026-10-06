import { PowerSyncContext } from '@powersync/react';
import { useEffect, useMemo, type ReactNode } from 'react';

import { useAuth } from '../auth';
import { powerSyncUrl, SupabaseConnector } from './connector';
import { db } from './database';

/** Hay base local y sincronización (no en la web, y solo si hay URL de PowerSync). */
export const syncEnabled = !!db && !!powerSyncUrl;

// Conecta la base local al entrar y la borra al salir (los datos de otra cuenta no quedan en el teléfono).
export function PowerSyncProvider({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const connector = useMemo(() => new SupabaseConnector(), []);
  const userId = session?.user.id;

  useEffect(() => {
    if (!db || !syncEnabled) return;
    if (userId && ready) {
      db.connect(connector).catch((e) => console.warn('PowerSync no pudo conectar', e));
    } else if (!userId) {
      db.disconnectAndClear().catch(() => undefined);
    }
  }, [userId, ready, connector]);

  if (!db) return <>{children}</>;
  return <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>;
}
