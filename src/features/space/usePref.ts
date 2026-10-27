import { useEntries } from '@/data/entries';

// Preferencias de la persona que viajan con su cuenta (motor común, módulo «severa», tipo «ajuste»):
// el + personalizado, el inicio, la vista de Módulos y el horario variable.
export function usePref<T extends Record<string, unknown>>(name: string, fallback: T): [T, (v: Partial<T>) => Promise<void>, boolean] {
  const store = useEntries('severa');
  const row = store.of('ajuste').find((e) => e.title === name) ?? null;
  const value = row ? ({ ...fallback, ...row.data } as T) : fallback;
  const save = async (v: Partial<T>) => {
    if (row) await store.update(row.id, { data: { ...row.data, ...v } });
    else await store.add({ kind: 'ajuste', title: name, data: { ...fallback, ...v } });
  };
  return [value, save, !!row];
}
