import { router } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { TabBar } from "@/components/tab-bar";
import { useSession } from "@/features/auth/use-session";

const TABS = {
  index: { label: "Mapa", icon: "map" },
  tanks: { label: "Estanques", icon: "tanks" },
  profile: { label: "Perfil", icon: "profile" },
} as const;

/** Admin y municipal ven además la pestaña Recargas (la barra solo muestra las rutas de este objeto). */
const MANAGER_TABS = {
  index: TABS.index,
  tanks: TABS.tanks,
  refills: { label: "Recargas", icon: "truck" },
  profile: TABS.profile,
} as const;

export default function TabsLayout() {
  const { profile } = useSession();
  const isAdmin = profile?.role === "admin";
  const isFamily = profile?.role === "family";
  const isManager = isAdmin || profile?.role === "municipal";

  return (
    <Tabs
      // «shift»: la pantalla entrante se desliza levemente y aparece; corre con el driver nativo.
      screenOptions={{ headerShown: false, animation: "shift" }}
      tabBar={(props) => (
        <TabBar
          {...props}
          tabs={isManager ? MANAGER_TABS : TABS}
          centerAction={
            isAdmin
              ? { label: "Ubicar estanque con NFC", onPress: () => router.push("/admin/locate") }
              : isFamily
                ? { label: "Retirar agua con NFC", icon: "tankFilled", onPress: () => router.push("/withdraw") }
                : undefined
          }
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="tanks" />
      <Tabs.Screen name="refills" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
