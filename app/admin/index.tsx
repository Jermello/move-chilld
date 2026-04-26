import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import type { AdminUser, Role, Route } from "@/src/lib/types";

const ROLE_LABELS: Record<Role, string> = {
  parent: "Parent",
  driver: "Chauffeur",
  admin: "Admin",
};

const ROLES: Role[] = ["parent", "driver", "admin"];

type Tab = "routes" | "users";

export default function AdminHome() {
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
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={styles.tabBar}>
        <TabBtn
          label="Lignes"
          active={tab === "routes"}
          onPress={() => setTab("routes")}
        />
        <TabBtn
          label="Utilisateurs"
          active={tab === "users"}
          onPress={() => setTab("users")}
        />
      </View>

      {loading && routes.length === 0 && users.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : tab === "routes" ? (
        <View style={{ gap: 12 }}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nouvelle ligne</Text>
            <TextInput
              style={styles.input}
              placeholder="Nom (ex. Navette matin)"
              value={newRouteName}
              onChangeText={setNewRouteName}
              autoCapitalize="sentences"
            />
            <Pressable style={styles.primaryBtn} onPress={onCreateRoute}>
              <Text style={styles.primaryBtnText}>Créer</Text>
            </Pressable>
          </View>

          {routes.length === 0 ? (
            <Text style={styles.subtle}>Aucune ligne pour l'instant.</Text>
          ) : (
            routes.map((r) => (
              <View key={r.id} style={styles.card}>
                <Pressable
                  onPress={() => router.push(`/admin/route/${r.id}`)}
                  style={{ flex: 1 }}
                >
                  <Text style={styles.itemTitle}>{r.name}</Text>
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
        <View style={{ gap: 12 }}>
          {users.length === 0 ? (
            <Text style={styles.subtle}>Aucun utilisateur.</Text>
          ) : (
            users.map((u) => (
              <View key={u.id} style={styles.card}>
                <Text style={styles.itemTitle}>
                  {u.full_name || u.email}
                  {u.role === "admin" ? "  👑" : ""}
                </Text>
                <Text style={styles.subtle}>{u.email}</Text>

                <View style={styles.rowBtns}>
                  {ROLES.map((role) => {
                    const active = u.role === role;
                    return (
                      <Pressable
                        key={role}
                        style={[
                          styles.pill,
                          active && role === "admin" && styles.pillAdmin,
                          active && role !== "admin" && styles.pillActive,
                        ]}
                        onPress={() => onSetRole(u, role)}
                      >
                        <Text
                          style={[
                            styles.pillText,
                            active && styles.pillTextActive,
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
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  center: { alignItems: "center", justifyContent: "center", padding: 40 },
  subtle: { color: "#666", fontSize: 13 },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#f0f0f3",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  tabBtnActive: { backgroundColor: "#fff" },
  tabText: { color: "#666", fontWeight: "600" },
  tabTextActive: { color: "#111" },
  card: {
    backgroundColor: "#f7f7f9",
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  cardTitle: { fontSize: 12, color: "#666", textTransform: "uppercase" },
  itemTitle: { fontSize: 17, fontWeight: "700" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e2e6",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryBtn: {
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#e9e9ed",
  },
  secondaryBtnText: { color: "#111", fontWeight: "600" },
  dangerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#ffe8e8",
  },
  dangerBtnText: { color: "#c0392b", fontWeight: "600" },
  rowBtns: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#e9e9ed",
  },
  pillActive: { backgroundColor: "#111" },
  pillAdmin: { backgroundColor: "#d4a017" },
  pillText: { color: "#333", fontWeight: "600", fontSize: 13 },
  pillTextActive: { color: "#fff" },
  ghostBtn: { padding: 10, marginTop: 12 },
  ghostBtnText: { color: "#666", textAlign: "center", fontWeight: "600" },
});
