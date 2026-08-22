import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { HapticTab } from "@/components/haptic-tab";
import { useAppLanguage } from "@/lib/app-language";
import { useColors } from "@/hooks/use-colors";

export default function TabLayout() {
  const colors = useColors();
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.tint, headerShown: false, tabBarButton: HapticTab, tabBarStyle: { paddingTop: 8, paddingBottom: bottomPadding, height: tabBarHeight, backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: 0.5 }, tabBarLabelStyle: { fontFamily: "Inter_600SemiBold", fontSize: 11 } }}>
      <Tabs.Screen name="index" options={{ title: t.check, tabBarIcon: ({ color, size }) => <MaterialIcons size={size} name="radar" color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: t.history, tabBarIcon: ({ color, size }) => <MaterialIcons size={size} name="history" color={color} /> }} />
      <Tabs.Screen name="about" options={{ title: t.about, tabBarIcon: ({ color, size }) => <MaterialIcons size={size} name="info-outline" color={color} /> }} />
    </Tabs>
  );
}
