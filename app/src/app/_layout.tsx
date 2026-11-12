import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SessionProvider, useSession } from "@/features/auth/use-session";
import { QuotaProvider } from "@/features/quota/use-quota";
import { TanksProvider } from "@/features/tanks/use-tanks";
import { colors } from "@/theme";

// Mantener el splash hasta saber si hay sesión: evita el parpadeo login → mapa.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const { session, profile, loading } = useSession();
  const signedIn = !!session;

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  return (
    <TanksProvider enabled={signedIn}>
      <QuotaProvider familyId={signedIn ? (profile?.familyId ?? null) : null}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.primary,
            headerTitleStyle: { color: colors.text, fontWeight: "600" },
            headerBackButtonDisplayMode: "minimal",
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="tank/[id]" options={{ title: "" }} />
            <Stack.Screen name="admin/locate" options={{ presentation: "modal", headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="login" options={{ headerShown: false, animation: "fade" }} />
          </Stack.Protected>
        </Stack>
      </QuotaProvider>
    </TanksProvider>
  );
}
