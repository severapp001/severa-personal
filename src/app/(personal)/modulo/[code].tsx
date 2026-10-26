import { useLocalSearchParams } from 'expo-router';

import { MODULES } from '@/features/modules/catalog';
import { ModuleBody } from '@/features/modules/ModuleScreen';
import { ModuleHeader } from '@/features/space/ModuleHeader';
import { Screen } from '@/ui';
import { Empty } from '@/ui/kit';

// Un módulo del motor común (26-10-2026): la ficha sale de features/modules/catalog.ts y el
// cuerpo, de features/modules/ModuleScreen.tsx.
export default function ModuloScreen() {
  const { code, nuevo } = useLocalSearchParams<{ code: string; nuevo?: string }>();
  const def = MODULES[code ?? ''];
  if (!def) {
    return (
      <Screen>
        <ModuleHeader title="Módulo" />
        <Empty text="Este módulo todavía no tiene pantalla." />
      </Screen>
    );
  }
  return <ModuleBody key={def.code} def={def} nuevo={nuevo} />;
}
