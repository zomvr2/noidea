import { type ComponentRef, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, type TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner } from "@/components/banner";
import { Button } from "@/components/button";
import { Icon } from "@/components/icon";
import { TextField } from "@/components/text-field";
import { supabase } from "@/lib/supabase";
import { colors, radius } from "@/theme";

export default function Login() {
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const signIn = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    // Con sesión, el layout raíz cambia a las pestañas automáticamente (Stack.Protected).
    if (err) setError(err.status === 400 ? "Correo o contraseña incorrectos." : "No se pudo conectar. Intenta de nuevo.");
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Icon name="tankFilled" size={30} color={colors.accent} />
          </View>
          <Text style={styles.title}>Bienvenido a NoIdea</Text>
          <Text style={styles.subtitle}>Agua comunitaria: niveles de estanques y retiros en un solo lugar.</Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Correo"
            icon="mail"
            placeholder="nombre@correo.cl"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => passwordRef.current?.focus()}
            submitBehavior="submit"
            error={!!error}
          />
          <TextField
            ref={passwordRef}
            label="Contraseña"
            icon="lock"
            password
            placeholder="Tu contraseña"
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={signIn}
            error={!!error}
          />
          {error && <Banner tone="danger" text={error} />}
          <Button label="Entrar" onPress={signIn} loading={busy} disabled={!canSubmit} style={styles.submit} />
        </View>

        <Text style={styles.footer}>Prototipo · Las cuentas las crea el administrador de la comunidad.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 32 },
  brand: { gap: 10 },
  logo: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 16, color: colors.muted, lineHeight: 22 },
  form: { gap: 16 },
  submit: { marginTop: 4 },
  footer: { marginTop: "auto", fontSize: 12, color: colors.subtle, textAlign: "center" },
});
