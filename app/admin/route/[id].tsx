import * as Clipboard from "expo-clipboard";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { radii, spacing, typography, type Theme } from "@/src/lib/theme";
import { useTheme } from "@/src/lib/themeContext";
import type { AdminUser, Child, Route, Stop } from "@/src/lib/types";

export default function AdminRouteDetail() {
  const theme = useTheme();
  const { colors } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const routeId = id as string;

  const [route, setRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Route fields
  const [routeName, setRouteName] = useState("");
  const [driverId, setDriverId] = useState<string | null>(null);

  // New stop form
  const [newStopName, setNewStopName] = useState("");
  const [newStopLat, setNewStopLat] = useState("");
  const [newStopLng, setNewStopLng] = useState("");

  // New child form
  const [newChildName, setNewChildName] = useState("");
  const [newChildParentId, setNewChildParentId] = useState<string | null>(null);
  const [newChildStopId, setNewChildStopId] = useState<string | null>(null);

  const drivers = useMemo(
    () => users.filter((u) => u.role === "driver"),
    [users]
  );
  const parents = useMemo(
    () => users.filter((u) => u.role === "parent"),
    [users]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s, c, u] = await Promise.all([
        adminApi.getRoute(routeId),
        adminApi.listStops(routeId),
        adminApi.listChildrenForRoute(routeId),
        adminApi.listUsers(),
      ]);
      if (!r) {
        Alert.alert("Ligne introuvable");
        router.back();
        return;
      }
      setRoute(r);
      setStops(s);
      setChildren(c);
      setUsers(u);
      setRouteName(r.name);
      setDriverId(r.driver_id);
    } catch (e) {
      Alert.alert("Erreur", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [routeId, router]);

  useEffect(() => {
    load();
  }, [load]);

  // ---------- Route ----------

  const onSaveRoute = async () => {
    try {
      await adminApi.updateRoute(routeId, {
        name: routeName.trim(),
        driver_id: driverId,
      });
      Alert.alert("Enregistré");
      load();
    } catch (e) {
      Alert.alert("Erreur", (e as Error).message);
    }
  };

  // ---------- Stops ----------

  const onUseCurrentLocation = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission refusée");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setNewStopLat(loc.coords.latitude.toFixed(6));
      setNewStopLng(loc.coords.longitude.toFixed(6));
    } catch (e) {
      Alert.alert("Erreur", (e as Error).message);
    }
  };

  /**
   * Parse "lat, lng" formats commonly exported by Google/Apple Maps.
   * Accepts things like "48.8566, 2.3522" or "48.8566,2.3522".
   */
  const onPasteCoords = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      const m = text.match(/(-?\d+(?:\.\d+)?)[^\d-]+(-?\d+(?:\.\d+)?)/);
      if (!m) {
        Alert.alert(
          "Format invalide",
          "Copie depuis Google Maps: clic droit sur le point, tu verras quelque chose comme 48.8566, 2.3522"
        );
        return;
      }
      setNewStopLat(m[1]);
      setNewStopLng(m[2]);
    } catch (e) {
      Alert.alert("Erreur", (e as Error).message);
    }
  };

  const onAddStop = async () => {
    const name = newStopName.trim();
    const lat = parseFloat(newStopLat);
    const lng = parseFloat(newStopLng);
    if (!name || Number.isNaN(lat) || Number.isNaN(lng)) {
      Alert.alert("Champs invalides", "Nom, latitude et longitude sont requis.");
      return;
    }
    try {
      const nextOrder =
        stops.length === 0
          ? 1
          : Math.max(...stops.map((s) => s.stop_order)) + 1;
      const stop = await adminApi.createStop({
        route_id: routeId,
        name,
        lat,
        lng,
        stop_order: nextOrder,
      });
      setStops((prev) => [...prev, stop]);
      setNewStopName("");
      setNewStopLat("");
      setNewStopLng("");
    } catch (e) {
      Alert.alert("Erreur", (e as Error).message);
    }
  };

  const onDeleteStop = (stop: Stop) => {
    Alert.alert("Supprimer l'arrêt", `Supprimer "${stop.name}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await adminApi.deleteStop(stop.id);
            setStops((prev) => prev.filter((s) => s.id !== stop.id));
          } catch (e) {
            Alert.alert("Erreur", (e as Error).message);
          }
        },
      },
    ]);
  };

  const onMoveStop = async (stop: Stop, dir: -1 | 1) => {
    const sorted = [...stops].sort((a, b) => a.stop_order - b.stop_order);
    const idx = sorted.findIndex((s) => s.id === stop.id);
    const other = sorted[idx + dir];
    if (!other) return;
    try {
      await adminApi.swapStopOrder(stop, other);
      load();
    } catch (e) {
      Alert.alert("Erreur", (e as Error).message);
    }
  };

  // ---------- Children ----------

  const onAddChild = async () => {
    const name = newChildName.trim();
    if (!name || !newChildParentId || !newChildStopId) {
      Alert.alert("Champs manquants", "Nom, parent et arrêt sont requis.");
      return;
    }
    try {
      const child = await adminApi.createChild({
        parent_id: newChildParentId,
        route_id: routeId,
        stop_id: newChildStopId,
        full_name: name,
      });
      setChildren((prev) => [...prev, child]);
      setNewChildName("");
      setNewChildParentId(null);
      setNewChildStopId(null);
    } catch (e) {
      Alert.alert("Erreur", (e as Error).message);
    }
  };

  const onDeleteChild = (child: Child) => {
    Alert.alert(
      "Supprimer l'enfant",
      `Supprimer "${child.full_name ?? "l'enfant"}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await adminApi.deleteChild(child.id);
              setChildren((prev) => prev.filter((c) => c.id !== child.id));
            } catch (e) {
              Alert.alert("Erreur", (e as Error).message);
            }
          },
        },
      ]
    );
  };

  // ---------- Render ----------

  if (loading && !route) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandDeep} />
      </View>
    );
  }

  const sortedStops = [...stops].sort((a, b) => a.stop_order - b.stop_order);
  const parentName = (parentId: string) => {
    const p = users.find((u) => u.id === parentId);
    return p?.full_name || p?.email || parentId.slice(0, 8);
  };
  const stopName = (stopId: string) =>
    stops.find((s) => s.id === stopId)?.name ?? "—";

  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const SelectPill = ({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      style={[styles.pill, active && styles.pillActive]}
      onPress={onPress}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>
        {label}
      </Text>
    </Pressable>
  );

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
      {/* ----- Infos ligne ----- */}
      <Section title="Infos de la ligne">
        <TextInput
          style={styles.input}
          placeholder="Nom"
          value={routeName}
          onChangeText={setRouteName}
        />

        <Text style={styles.subLabel}>Chauffeur</Text>
        <View style={styles.rowBtns}>
          <SelectPill
            label="Aucun"
            active={driverId === null}
            onPress={() => setDriverId(null)}
          />
          {drivers.map((d) => (
            <SelectPill
              key={d.id}
              label={d.full_name || d.email}
              active={driverId === d.id}
              onPress={() => setDriverId(d.id)}
            />
          ))}
        </View>
        {drivers.length === 0 && (
          <Text style={styles.subtle}>
            {"Aucun chauffeur. Promeus un utilisateur depuis l'écran Admin."}
          </Text>
        )}

        <Pressable style={styles.primaryBtn} onPress={onSaveRoute}>
          <Text style={styles.primaryBtnText}>Enregistrer</Text>
        </Pressable>
      </Section>

      {/* ----- Arrêts ----- */}
      <Section title={`Arrêts (${stops.length})`}>
        {sortedStops.length === 0 ? (
          <Text style={styles.subtle}>
            {"Aucun arrêt. L'ordre définit l'ordre de passage."}
          </Text>
        ) : (
          sortedStops.map((s, idx) => (
            <View key={s.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>
                  {s.stop_order}. {s.name}
                </Text>
                <Text style={styles.subtle}>
                  {s.lat.toFixed(5)}, {s.lng.toFixed(5)}
                </Text>
              </View>
              <View style={styles.rowBtns}>
                <Pressable
                  style={[styles.iconBtn, idx === 0 && styles.iconBtnDisabled]}
                  disabled={idx === 0}
                  onPress={() => onMoveStop(s, -1)}
                >
                  <Text style={styles.iconBtnText}>↑</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.iconBtn,
                    idx === sortedStops.length - 1 && styles.iconBtnDisabled,
                  ]}
                  disabled={idx === sortedStops.length - 1}
                  onPress={() => onMoveStop(s, 1)}
                >
                  <Text style={styles.iconBtnText}>↓</Text>
                </Pressable>
                <Pressable
                  style={styles.dangerBtn}
                  onPress={() => onDeleteStop(s)}
                >
                  <Text style={styles.dangerBtnText}>X</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <View style={styles.subCard}>
          <Text style={styles.cardTitle}>Ajouter un arrêt</Text>
          <TextInput
            style={styles.input}
            placeholder="Nom (ex. 12 rue de Paris)"
            value={newStopName}
            onChangeText={setNewStopName}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Latitude"
              keyboardType="numbers-and-punctuation"
              value={newStopLat}
              onChangeText={setNewStopLat}
            />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Longitude"
              keyboardType="numbers-and-punctuation"
              value={newStopLng}
              onChangeText={setNewStopLng}
            />
          </View>
          <View style={styles.rowBtns}>
            <Pressable style={styles.secondaryBtn} onPress={onUseCurrentLocation}>
              <Text style={styles.secondaryBtnText}>📍 Ma position</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={onPasteCoords}>
              <Text style={styles.secondaryBtnText}>📋 Coller</Text>
            </Pressable>
          </View>
          <Pressable style={styles.primaryBtn} onPress={onAddStop}>
            <Text style={styles.primaryBtnText}>{"Ajouter l'arrêt"}</Text>
          </Pressable>
          <Text style={styles.hint}>
            Astuce: sur Google Maps, clic droit / appui long sur un point. Les
            coordonnées affichées peuvent être copiées puis collées ici.
          </Text>
        </View>
      </Section>

      {/* ----- Enfants ----- */}
      <Section title={`Enfants (${children.length})`}>
        {children.length === 0 ? (
          <Text style={styles.subtle}>Aucun enfant assigné à cette ligne.</Text>
        ) : (
          children.map((c) => (
            <View key={c.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{c.full_name ?? "—"}</Text>
                <Text style={styles.subtle}>
                  Parent : {parentName(c.parent_id)}
                </Text>
                <Text style={styles.subtle}>Arrêt : {stopName(c.stop_id)}</Text>
              </View>
              <Pressable
                style={styles.dangerBtn}
                onPress={() => onDeleteChild(c)}
              >
                <Text style={styles.dangerBtnText}>X</Text>
              </Pressable>
            </View>
          ))
        )}

        <View style={styles.subCard}>
          <Text style={styles.cardTitle}>Ajouter un enfant</Text>
          <TextInput
            style={styles.input}
            placeholder="Prénom Nom"
            value={newChildName}
            onChangeText={setNewChildName}
          />

          <Text style={styles.subLabel}>Parent</Text>
          <View style={styles.rowBtns}>
            {parents.length === 0 && (
              <Text style={styles.subtle}>Aucun parent enregistré.</Text>
            )}
            {parents.map((p) => (
              <SelectPill
                key={p.id}
                label={p.full_name || p.email}
                active={newChildParentId === p.id}
                onPress={() => setNewChildParentId(p.id)}
              />
            ))}
          </View>

          <Text style={styles.subLabel}>Arrêt</Text>
          <View style={styles.rowBtns}>
            {sortedStops.length === 0 && (
              <Text style={styles.subtle}>{"Crée d'abord un arrêt."}</Text>
            )}
            {sortedStops.map((s) => (
              <SelectPill
                key={s.id}
                label={`${s.stop_order}. ${s.name}`}
                active={newChildStopId === s.id}
                onPress={() => setNewChildStopId(s.id)}
              />
            ))}
          </View>

          <Pressable style={styles.primaryBtn} onPress={onAddChild}>
            <Text style={styles.primaryBtnText}>{"Ajouter l'enfant"}</Text>
          </Pressable>
        </View>
      </Section>
    </ScrollView>
  );
}

function makeStyles({ colors, shadow }: Theme) {
  return StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.xl, paddingBottom: 60 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  subtle: { color: colors.textMuted, fontSize: 13 },
  hint: { color: colors.textSubtle, fontSize: 12, fontStyle: "italic" },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  subLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: 4,
  },
  subCard: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  cardTitle: { ...typography.label, color: colors.textMuted },
  itemTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
  },
  rowBtns: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
    ...shadow.primary,
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
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  dangerBtnText: { color: colors.danger, fontWeight: "700" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDisabled: { opacity: 0.3 },
  iconBtnText: { fontSize: 16, fontWeight: "700", color: colors.text },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryHover,
  },
  pillText: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  pillTextActive: { color: colors.textOnDark },
  });
}
