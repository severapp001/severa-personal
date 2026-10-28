import { usePref } from '@/features/space/usePref';

// «Mi forma de funcionar» (27-10-2026): cómo se acomoda Severa a la cabeza de cada persona. Se
// ajusta en Salud mental y lo usan Prioridades (una cosa a la vez) y el modo foco (sus minutos).
export const WAY_DEFAULT = { tdah: false, unaCosa: false, foco: 25, ayuda: '', cuesta: '' };

export const useWay = () => usePref('funcionamiento', WAY_DEFAULT);
