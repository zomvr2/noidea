import type { Role } from "@noidea/shared";
import Constants from "expo-constants";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarClearance } from "@/components/tab-bar";
import { Icon, type IconName } from "@/components/icon";
import { ScreenHeader, SectionTitle } from "@/components/screen-header";
import { useSession } from "@/features/auth/use-session";
import { QuotaCard } from "@/features/quota/quota-card";
import { levelState } from "@/features/tanks/tank-status";
import { useTanks } from "@/features/tanks/use-tanks";
import { enterUp, usePressScale, useUpdatePulse } from "@/lib/motion";
import { supabase } from "@/lib/supabase";
import { colors, radius } from "@/theme";

const ROLE_LABELS: Record<Role, string> = { admin: "Administrador", family: "Familia", municipal: "Municipal" };

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { session, profile } = useSession();
  const { tanks, now } = useTanks();
  const isAdmin = profile?.role === "admin";
  const name = profile?.fullName || session?.user.email || "Usuario";

  const states = tanks.map((t) => levelState(t, now));
  const alerts = states.filter((s) => s === "low" || s === "critical").length;
  const offline = states.filter((s) => s === "offline").length;

  const signOut = () =>
    Alert.alert("Cerrar sesión", "¿Quieres salir de tu cuenta en este teléfono?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar sesión", style: "destructive", onPress: () => void supabase.auth.signOut() },
    ]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: tabBarClearance + 16 }]}
      scrollIndicatorInsets={{ bottom: tabBarClearance }}
    >
      <ScreenHeader title="Perfil" />

      <Animated.View entering={enterUp(0)} style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(name)}</Text>
        </View>
        <View style={styles.identityText}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {profile?.fullName && session?.user.email ? (
            <Text style={styles.email} numberOfLines={1}>
              {session.user.email}
            </Text>
          ) : null}
          {profile && (
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{ROLE_LABELS[profile.role]}</Text>
            </View>
          )}
        </View>
      </Animated.View>

      <QuotaCard />

      <Animated.View entering={enterUp(2)} style={styles.statsCard}>
        <Stat label="Estanques" value={tanks.length} />
        <View style={styles.divider} />
        <Stat label="Alertas" value={alerts} tone={alerts > 0 ? "#FFC966" : undefined} />
        <View style={styles.divider} />
        <Stat label="Sin conexión" value={offline} />
      </Animated.View>

      {profile?.role === "family" && (
        <>
          <SectionTitle>Agua</SectionTitle>
          <Group index={3}>
            <Row icon="tankFilled" label="Retirar agua" detail="NFC" onPress={() => router.push("/withdraw")} />
          </Group>
        </>
      )}

      {isAdmin && (
        <>
          <SectionTitle>Administración</SectionTitle>
          <Group index={3}>
            <Row icon="nfc" label="Ubicar estanque" detail="NFC + GPS" onPress={() => router.push("/admin/locate")} />
            <Row
              icon="trash"
              label="Eliminar estanque"
              detail="NFC"
              destructive
              onPress={() => router.push("/admin/remove")}
            />
          </Group>
        </>
      )}

      <SectionTitle>Cuenta</SectionTitle>
      <Group index={4}>
        <Row icon="logout" label="Cerrar sesión" destructive onPress={signOut} />
      </Group>

      <Text style={styles.footer}>
        NoIdea v{Constants.expoConfig?.version ?? "—"} · Prototipo de distribución comunitaria de agua.{"\n"}
        Los niveles y volúmenes son estimaciones.
      </Text>
    </ScrollView>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  const pulse = useUpdatePulse(value);
  return (
    <View style={styles.stat}>
      <Animated.Text style={[styles.statValue, tone ? { color: tone } : null, pulse]}>{value}</Animated.Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Group({ children, index }: { children: ReactNode; index: number }) {
  return (
    <Animated.View entering={enterUp(index)} style={styles.group}>
      {children}
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function Row({
  icon,
  label,
  detail,
  destructive,
  onPress,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  const color = destructive ? colors.danger : colors.text;
  const { pressed, onPressIn, onPressOut } = usePressScale();
  const bg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(pressed.value, [0, 1], ["rgba(230,234,232,0)", colors.border]),
  }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      style={[styles.row, bg]}
    >
      <View style={[styles.rowIcon, destructive && { backgroundColor: colors.dangerSoft }]}>
        <Icon name={icon} size={18} color={destructive ? colors.danger : colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
      {detail && <Text style={styles.rowDetail}>{detail}</Text>}
      {!destructive && <Icon name="chevronRight" size={16} color={colors.subtle} />}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  identity: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "700", color: colors.primary },
  identityText: { flex: 1, gap: 2, alignItems: "flex-start" },
  name: { fontSize: 19, fontWeight: "700", color: colors.text },
  email: { fontSize: 14, color: colors.muted },
  rolePill: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  roleText: { fontSize: 12, fontWeight: "600", color: colors.primary },
  statsCard: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 18,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { fontSize: 24, fontWeight: "700", color: colors.onPrimary, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 12, color: colors.onPrimaryMuted },
  divider: { width: 1, backgroundColor: "rgba(255,255,255,0.15)" },
  group: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 14 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: "500" },
  rowDetail: { fontSize: 14, color: colors.muted },
  footer: { fontSize: 12, color: colors.subtle, textAlign: "center", lineHeight: 18, marginTop: 8 },
});
