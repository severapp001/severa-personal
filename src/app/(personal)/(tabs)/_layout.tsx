import { Tabs } from 'expo-router/js-tabs';
import { View } from 'react-native';

import { TabBar } from '@/features/space/TabBar';
import { useTheme } from '@/theme/ThemeProvider';
import { useLayout } from '@/ui/layout';

// Pestañas de Personal y Trabajo (variante B, 18-10-2026). La barra la dibuja TabBar. El botón
// flotante del asistente (25-10-2026) salió el 27-10: el Asistente ya está en la barra.
// En el computador (29-10-2026) no hay barra de abajo: navega la barra de arriba (features/space/TopNav).
export default function TabsLayout() {
  const { colors } = useTheme();
  const { wide } = useLayout();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => (wide ? null : <TabBar {...props} />)}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="calendario" />
        <Tabs.Screen name="trabajo" />
        <Tabs.Screen name="modulos" />
        <Tabs.Screen name="ajustes" />
      </Tabs>
    </View>
  );
}
