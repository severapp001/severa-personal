import type { PowerSyncDatabase } from '@powersync/react-native';

// La web solo sirve para revisar pantallas: sin base local ni sincronización.
export const isExpoGo = false;
export const db: PowerSyncDatabase | null = null;
