import { useQuery, useStatus } from '@powersync/react';
import { View } from 'react-native';

import { isExpoGo } from '@/data/powersync/database';
import { syncEnabled } from '@/data/powersync/PowerSyncProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { AppText } from '@/ui';

// Estado de la sincronización (F18): qué hay en el teléfono y si está al día.
function SyncStatusInner() {
  const { colors } = useTheme();
  const status = useStatus();
  const { data: spaces } = useQuery<{ n: number }>('SELECT count(*) AS n FROM spaces');
  const { data: people } = useQuery<{ name: string }>("SELECT name FROM people WHERE type = 'self'");

  const label = !status.connected
    ? status.connecting
      ? 'Conectando…'
      : 'Sin conexión: trabajas con lo guardado en el teléfono'
    : status.dataFlowStatus.downloading || status.dataFlowStatus.uploading
      ? 'Sincronizando…'
      : status.hasSynced
        ? 'Al día'
        : 'Bajando tus datos…';
  const dot = status.connected ? colors.ok : colors.mid;

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 16, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
        <AppText variant="label">{label}</AppText>
      </View>
      <AppText variant="caption" muted>
        En este teléfono: {spaces?.[0]?.n ?? 0} espacio(s){people?.[0]?.name ? ` · ${people[0].name}` : ''}
        {isExpoGo ? ' · Expo Go (base de prueba, sin cifrar)' : ''}
      </AppText>
    </View>
  );
}

export function SyncStatus() {
  if (!syncEnabled) return null;
  return <SyncStatusInner />;
}
