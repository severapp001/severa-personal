import { Tabs } from 'expo-router/js-tabs';
import { useState } from 'react';
import { View } from 'react-native';

import { AssistantFab } from '@/features/assistant/AssistantFab';
import { TabBar } from '@/features/space/TabBar';
import { useTheme } from '@/theme/ThemeProvider';

// Pestañas de Personal y Trabajo (variante B, 18-10-2026). La barra la dibuja TabBar; encima,
// el botón flotante del asistente (25-10-2026), que sube o baja según el alto de la barra.
export default function TabsLayout() {
  const { colors } = useTheme();
  const [barHeight, setBarHeight] = useState(80);
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <TabBar {...props} onHeight={setBarHeight} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="calendario" />
        <Tabs.Screen name="trabajo" />
        <Tabs.Screen name="modulos" />
        <Tabs.Screen name="ajustes" />
      </Tabs>
      <AssistantFab bottom={barHeight + 14} />
    </View>
  );
}
