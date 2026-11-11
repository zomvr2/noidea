import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Estanques" }} />
      <Stack.Screen name="login" options={{ title: "Iniciar sesión" }} />
      <Stack.Screen name="admin/locate" options={{ title: "Ubicar estanque", presentation: "modal" }} />
    </Stack>
  );
}
