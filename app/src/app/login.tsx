import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { colors } from "@/theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError("Correo o contraseña incorrectos.");
    else router.replace("/");
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>NoIdea</Text>
      <Text style={styles.subtitle}>Distribución comunitaria de agua (prototipo)</Text>
      <TextInput
        style={styles.input}
        placeholder="Correo"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={signIn} disabled={busy || !email || !password}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 12, justifyContent: "center", backgroundColor: colors.background },
  title: { fontSize: 32, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, marginBottom: 12 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.track,
  },
  error: { color: colors.danger },
  button: { backgroundColor: colors.water, borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
