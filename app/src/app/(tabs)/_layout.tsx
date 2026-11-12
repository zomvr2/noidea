import { router } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { TabBar } from "@/components/tab-bar";
import { useSession } from "@/features/auth/use-session";

const TABS = {
  index: { label: "Mapa", icon: "map" },
  tanks: { label: "Estanques", icon: "tanks" },
  profile: { label: "Perfil", icon: "profile" },
} as const;

export default function TabsLayout() {
  const { profile } = useSession();
  const isAdmin = profile?.role === "admin";

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (
        <TabBar
          {...props}
          tabs={TABS}
          centerAction={
            isAdmin ? { label: "Ubicar estanque con NFC", onPress: () => router.push("/admin/locate") } : undefined
          }
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tanks" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
