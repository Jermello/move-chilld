import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import * as adminApi from "@/src/features/admin/api";
import { supabase } from "@/src/lib/supabase";
import { radii, spacing, typography, type Theme } from "@/src/lib/theme";
import { useTheme } from "@/src/lib/themeContext";
import type { AdminUser, Role, Route } from "@/src/lib/types";

const ROLE_LABELS: Record<Role, string> = {
  parent: "Parent",
  driver: "Chauffeur",
  admin: "Admin",
};

const ROLES: Role[] = ["parent", "driver", "admin"];

type Tab = "routes" | "users";

export default function AdminHome() {
  const theme = useTheme();
  const { colors, shadow } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const router = useRouter();
  const [tab, setTab] = useState<Tab>("routes");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRouteName, setNewRouteName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, u] = await Promise.all([
        adminApi.listRoutes(),
        adminApi.listUsers(),
      ]);
      setRoutes(r);
      setUsers(u);
    } catch (e) {
      Alert.alert("Erreur", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const driverName = (driverId: string | null) => {
    if (!driverId) return "Pas de chauffeur";
    const u = users.find((x) => x.id === driverId);
    return u?.full_name || u?.email || driverId.slice(0, 8);
  };

  const onCreateRoute = async () => {
    const name = newRouteName.trim();
    if (!name) return;
    try {
      const route = await adminApi.createRoute(name, null);
      setNewRouteName("");
      router.push(`/admin/route/${route.id}`);
    } catch (e) {
      Alert.alert("Erreur", (e as Error).message);
    }
  };

  const onDeleteRoute = (route: Route) => {
    Alert.alert(
      "Supprimer la ligne",
      `Supprimer "${route.name}" ? Les arrêts et enfants associés seront aussi supprimés.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await adminApi.deleteRoute(route.id);
              setRoutes((prev) => prev.filter((r) => r.id !== route.id));
            } catch (e) {
              Alert.alert("Erreur", (e as Error).message);
            }
          },
        },
      ]
    );
  };

  const onSetRole = async (user: AdminUser, role: Role) => {
    if (user.role === role) return;
    try {
      await adminApi.setUserRole(user.id, role);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role } : u))
      );
    } catch (e) {
      Alert.alert("Erreur", (e as Error).message);
    }
  };

  const onLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={load}
          tintColor={colors.brandDeep}
        />
      }
    >
      <View style={styles.statRow}>
        <StatCard
          styles={styles}
          label="Lignes"
          value={routes.length}
          tone="brand"
          emoji="🚌"
        />
        <StatCard
          styles={styles}
          label="Utilisateurs"
          value={users.length}
          tone="primary"
          emoji="👥"
        />
      </View>

      <View style={styles.tabBar}>
        <TabBtn
          styles={styles}
          shadow={shadow.sm}
          label="Lignes"
          active={tab === "routes"}
          onPress={() => setTab("routes")}
        />
        <TabBtn
          styles={styles}
          shadow={shadow.sm}
          label="Utilisateurs"
          active={tab === "users"}
          onPress={() => setTab("users")}
        />
      </View>

      {loading && routes.length === 0 && users.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandDeep} />
        </View>
      ) : tab === "routes" ? (
        <View style={{ gap: spacing.md }}>
          <View style={[styles.cardElevated, shadow.sm]}>
            <Text style={styles.cardLabel}>Nouvelle ligne</Text>
            <TextInput
              style={styles.input}
              placeholder="Nom (ex. Navette matin)"
              placeholderTextColor={colors.textSubtle}
              value={newRouteName}
              onChangeText={setNewRouteName}
              autoCapitalize="sentences"
            />
            <Pressable
              style={[styles.primaryBtn, shadow.primary]}
              onPress={onCreateRoute}
            >
              <Text style={styles.primaryBtnText}>Créer</Text>
            </Pressable>
          </View>

          {routes.length === 0 ? (
            <Text style={styles.subtle}>Aucune ligne pour l&apos;instant.</Text>
          ) : (
            routes.map((r) => (
              <View key={r.id} style={[styles.routeCard, shadow.sm]}>
                <Pressable
                  onPress={() => router.push(`/admin/route/${r.id}`)}
                  style={{ flex: 1 }}
                >
                  <Text style={styles.itemTitle}>🚌 {r.name}</Text>
                  <Text style={styles.subtle}>
                    Chauffeur : {driverName(r.driver_id)}
                  </Text>
                </Pressable>
                <View style={styles.rowBtns}>
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => router.push(`/admin/route/${r.id}`)}
                  >
                    <Text style={styles.secondaryBtnText}>Éditer</Text>
                  </Pressable>
                  <Pressable
                    style={styles.dangerBtn}
                    onPress={() => onDeleteRoute(r)}
                  >
                    <Text style={styles.dangerBtnText}>Supprimer</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {users.length === 0 ? (
            <Text style={styles.subtle}>Aucun utilisateur.</Text>
          ) : (
            users.map((u) => (
              <View key={u.id} style={[styles.userCard, shadow.sm]}>
                <View style={styles.userHeader}>
                  <View
                    style={[
                      styles.avatar,
                      u.role === "admin" && styles.avatarAdmin,
                      u.role === "driver" && styles.avatarDriver,
                    ]}
                  >
                    <Text style={styles.avatarText}>
                      {(u.full_name || u.email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>
                      {u.full_name || u.email}
                      {u.role === "admin" ? "  👑" : ""}
                    </Text>
                    <Text style={styles.subtle}>{u.email}</Text>
                  </View>
                </View>

                <View style={styles.rowBtns}>
                  {ROLES.map((role) => {
                    const active = u.role === role;
                    return (
                      <Pressable
                        key={role}
                        style={[
                          styles.pill,
                          active && role === "admin" && styles.pillAdmin,
                          active && role === "driver" && styles.pillDriver,
                          active && role === "parent" && styles.pillParent,
                        ]}
                        onPress={() => onSetRole(u, role)}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            active && styles.pillTextActive,
                            active && role === "admin" && styles.pillTextOnBrand,
                          ]}
                        >
                          {ROLE_LABELS[role]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </View>
      )}

      <Pressable onPress={onLogout} style={styles.ghostBtn}>
        <Text style={styles.ghostBtnText}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}

function TabBtn({
  label,
  active,
  onPress,
  styles,
  shadow,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  shadow: object;
}) {
  return (
    <Pressable
      style={[styles.tabBtn, active && [styles.tabBtnActive, shadow]]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatCard({
  label,
  value,
  tone,
  emoji,
  styles,
}: {
  label: string;
  value: number;
  tone: "brand" | "primary";
  emoji: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  const isBrand = tone === "brand";
  return (
    <View
      style={[
        styles.statCard,
        isBrand ? styles.statCardBrand : styles.statCardPrimary,
      ]}
    >
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text
        style={[
          styles.statValue,
          isBrand ? styles.statValueBrand : styles.statValuePrimary,
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.statLabel,
          isBrand ? styles.statLabelBrand : styles.statLabelPrimary,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function makeStyles({ colors }: Theme) {
  return StyleSheet.create({
    container: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 40 },
    center: { alignItems: "center", justifyContent: "center", padding: 40 },
    subtle: { color: colors.textMuted, fontSize: 13 },

    statRow: { flexDirection: "row", gap: spacing.md },
    statCard: {
      flex: 1,
      borderRadius: radii.lg,
      padding: spacing.md,
      gap: 4,
      borderWidth: 1,
    },
    statCardBrand: {
      backgroundColor: colors.brandSoft,
      borderColor: colors.brand,
    },
    statCardPrimary: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    statEmoji: { fontSize: 22 },
    statValue: { fontSize: 28, fontWeight: "800" },
    statValueBrand: { color: colors.text },
    statValuePrimary: { color: colors.text },
    statLabel: { ...typography.label, fontSize: 11 },
    statLabelBrand: { color: colors.brandDeep },
    statLabelPrimary: { color: colors.primary },

    tabBar: {
      flexDirection: "row",
      backgroundColor: colors.surfaceAlt,
      borderRadius: radii.lg,
      padding: 4,
      gap: 4,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: radii.md,
    },
    tabBtnActive: { backgroundColor: colors.surface },
    tabText: { color: colors.textMuted, fontWeight: "600" },
    tabTextActive: { color: colors.text },

    cardElevated: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardLabel: { ...typography.label, color: colors.textMuted },
    itemTitle: { fontSize: 16, fontWeight: "700", color: colors.text },

    routeCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    userCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    userHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarAdmin: { backgroundColor: colors.brand },
    avatarDriver: { backgroundColor: colors.accentSoft },
    avatarText: { fontSize: 16, fontWeight: "800", color: colors.text },

    input: {
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: 12,
      alignItems: "center",
    },
    primaryBtnText: { color: colors.textOnDark, fontWeight: "700" },
    secondaryBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    secondaryBtnText: { color: colors.text, fontWeight: "600" },
    dangerBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radii.sm,
      backgroundColor: colors.dangerSoft,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
    },
    dangerBtnText: { color: colors.danger, fontWeight: "700" },
    rowBtns: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },

    pill: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: radii.pill,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    pillAdmin: { backgroundColor: colors.brand, borderColor: colors.brandDeep },
    pillDriver: {
      backgroundColor: colors.accent,
      borderColor: colors.accentDeep,
    },
    pillParent: {
      backgroundColor: colors.primary,
      borderColor: colors.primaryHover,
    },
    pillText: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
    pillTextActive: { color: colors.textOnDark },
    pillTextOnBrand: { color: colors.textOnBrand },

    ghostBtn: { padding: spacing.md, marginTop: spacing.md },
    ghostBtnText: {
      color: colors.textMuted,
      textAlign: "center",
      fontWeight: "600",
    },
  });
}
