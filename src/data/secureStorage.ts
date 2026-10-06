import * as SecureStore from 'expo-secure-store';

// La sesión de Supabase va al llavero del teléfono (Keychain / Keystore).
// SecureStore acepta ~2 KB por valor, así que los valores largos se guardan en partes.
const CHUNK_SIZE = 1800;
const countKey = (key: string) => `${key}.parts`;
const partKey = (key: string, i: number) => `${key}.${i}`;

// Las llaves de SecureStore solo admiten letras, números, «.», «-» y «_».
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safe(key);
    const parts = await SecureStore.getItemAsync(countKey(k));
    if (parts === null) return null;
    const chunks: string[] = [];
    for (let i = 0; i < Number(parts); i++) {
      const chunk = await SecureStore.getItemAsync(partKey(k, i));
      if (chunk === null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const k = safe(key);
    await secureStorage.removeItem(key);
    const total = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
    for (let i = 0; i < total; i++) {
      await SecureStore.setItemAsync(partKey(k, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(countKey(k), String(total));
  },

  async removeItem(key: string): Promise<void> {
    const k = safe(key);
    const parts = await SecureStore.getItemAsync(countKey(k));
    if (parts !== null) {
      for (let i = 0; i < Number(parts); i++) await SecureStore.deleteItemAsync(partKey(k, i));
    }
    await SecureStore.deleteItemAsync(countKey(k));
  },
};
