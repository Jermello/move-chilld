import {
  endTrip,
  fetchActiveTrip,
  fetchDriverRoute,
  fetchStopEvents,
  fetchStops,
  markStopArrived,
  startTrip,
} from "@/src/features/driver/api";
import { useAutoArrive } from "@/src/features/driver/useAutoArrive";
import { useDriverLocation } from "@/src/features/location/useDriverLocation";
import { useProfile } from "@/src/hooks/useProfile";
import { useSession } from "@/src/hooks/useSession";
import { supabase } from "@/src/lib/supabase";
import { radii, spacing, typography, type Theme } from "@/src/lib/theme";
import { useTheme } from "@/src/lib/themeContext";
import type {
  Route,
  Stop,
  StopEvent,
  TripSession,
} from "@/src/lib/types";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

export default function DriverScreen() {
  const theme = useTheme();
  const { colors, shadow } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const { profile } = useProfile(session?.user.id);

  const [route, setRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [trip, setTrip] = useState<TripSession | null>(null);
  const [events, setEvents] = useState<StopEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [autoArrive, setAutoArrive] = useState(true);

  const tripId = trip?.id ?? null;
  const { coords, permission, error: locError } = useDriverLocation(
    trip?.status === "active" ? tripId : null
  );

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const r = await fetchDriverRoute(session.user.id);
      setRoute(r);
      if (r) {
        const [s, t] = await Promise.all([
          fetchStops(r.id),
          fetchActiveTrip(r.id),
        ]);
        setStops(s);
        setTrip(t);
        if (t) setEvents(await fetchStopEvents(t.id));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      Alert.alert("Erreur", msg);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!tripId) return;
    const channel = supabase
      .channel(`driver-events-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stop_events",
          filter: `trip_session_id=eq.${tripId}`,
        },
        () => {
          fetchStopEvents(tripId).then(setEvents).catch(() => {});
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  const onMarkArrived = useCallback(
    async (stopId: string) => {
      if (!trip) return;
      try {
        await markStopArrived(trip.id, stopId);
        setEvents((prev) =>
          prev.map((e) =>
            e.stop_id === stopId
              ? { ...e, status: "arrived", arrived_at: new Date().toISOString() }
              : e
          )
        );
      } catch (e: unknown) {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Échec de l'arrivée");
      }
    },
    [trip]
  );

  useAutoArrive({
    enabled: trip?.status === "active" && autoArrive,
    coords,
    stops,
    events,
    onArrived: onMarkArrived,
  });

  if (sessionLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandDeep} />
      </View>
    );
  }
  if (!session) return <Redirect href="/" />;
  if (profile?.role === "admin") return <Redirect href="/admin" />;
  if (profile?.role === "parent") return <Redirect href="/home" />;

  if (!route) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>🚌</Text>
        <Text style={styles.title}>Aucun trajet assigné</Text>
        <Text style={styles.subtle}>
          {"Contacte l'administrateur pour qu'il t'assigne une route."}
        </Text>
        <LogoutButton onAfter={() => router.replace("/")} styles={styles} />
      </View>
    );
  }

  const onStart = async () => {
    setBusy(true);
    try {
      const t = await startTrip(route.id, session.user.id, stops);
      setTrip(t);
      setEvents(await fetchStopEvents(t.id));
    } catch (e: unknown) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Échec du démarrage");
    } finally {
      setBusy(false);
    }
  };

  const onEnd = async () => {
    if (!trip) return;
    setBusy(true);
    try {
      await endTrip(trip.id);
      setTrip({ ...trip, status: "completed" });
    } catch (e: unknown) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Échec de la fin");
    } finally {
      setBusy(false);
    }
  };

  const active = trip?.status === "active";
  const completed = trip?.status === "completed";
  const eventByStop = new Map(events.map((e) => [e.stop_id, e]));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.routeBadge}>LIGNE</Text>
        <Text style={styles.title}>{route.name}</Text>
      </View>

      <View
        style={[
          styles.statusCard,
          shadow.sm,
          active && [styles.statusCardActive, shadow.accent],
          completed && styles.statusCardDone,
        ]}
      >
        <View style={styles.statusHeader}>
          <Text
            style={[
              styles.statusLabel,
              active && styles.statusLabelActive,
              completed && styles.statusLabelDone,
            ]}
          >
            STATUT
          </Text>
          {active && (
            <View style={styles.livePill}>
              <View style={styles.livePillDot} />
              <Text style={styles.livePillText}>EN COURS</Text>
            </View>
          )}
        </View>
        <Text style={styles.statusValue}>
          {active
            ? "Trajet en cours"
            : completed
            ? "Trajet terminé"
            : "Pas démarré"}
        </Text>
        {active && coords && (
          <Text style={styles.subtle}>
            📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </Text>
        )}
        {active && permission === "denied" && (
          <Text style={styles.error}>{locError ?? "GPS désactivé"}</Text>
        )}
      </View>

      <View style={[styles.toggleCard, shadow.sm]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>Détection auto des arrêts</Text>
          <Text style={styles.subtle}>
            Marque l&apos;arrêt comme atteint à moins de 60m.
          </Text>
        </View>
        <Switch
          value={autoArrive}
          onValueChange={setAutoArrive}
          trackColor={{ false: colors.borderStrong, true: colors.brand }}
          thumbColor={colors.surface}
        />
      </View>

      {!active ? (
        <Pressable
          onPress={onStart}
          disabled={busy || stops.length === 0}
          style={[
            styles.startBtn,
            shadow.brand,
            (busy || stops.length === 0) && styles.disabled,
          ]}
        >
          <Text style={styles.startBtnText}>🚀  Démarrer le trajet</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onEnd}
          disabled={busy}
          style={[styles.endBtn, shadow.sm, busy && styles.disabled]}
        >
          <Text style={styles.endBtnText}>Terminer le trajet</Text>
        </Pressable>
      )}

      <Text style={styles.sectionTitle}>Arrêts ({stops.length})</Text>
      <FlatList
        data={stops}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const ev = eventByStop.get(item.id);
          const arrived = ev?.status === "arrived";
          return (
            <View style={[styles.stopRow, arrived && styles.stopRowDone]}>
              <View
                style={[
                  styles.stopOrderBadge,
                  arrived && styles.stopOrderBadgeDone,
                ]}
              >
                <Text
                  style={[
                    styles.stopOrderText,
                    arrived && styles.stopOrderTextDone,
                  ]}
                >
                  {arrived ? "✓" : item.stop_order}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stopName, arrived && styles.stopNameDone]}>
                  {item.name}
                </Text>
                {arrived && ev?.arrived_at && (
                  <Text style={styles.subtleSuccess}>
                    Arrivé à {new Date(ev.arrived_at).toLocaleTimeString()}
                  </Text>
                )}
              </View>
              <Pressable
                disabled={!active || arrived}
                onPress={() => onMarkArrived(item.id)}
                style={[
                  styles.markBtn,
                  arrived && styles.markBtnDone,
                  (!active || arrived) && styles.disabled,
                ]}
              >
                <Text
                  style={[
                    styles.markBtnText,
                    arrived && styles.markBtnTextDone,
                  ]}
                >
                  {arrived ? "OK" : "Arrivé"}
                </Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.subtle}>Aucun arrêt sur cette route.</Text>
        }
      />

      <LogoutButton onAfter={() => router.replace("/")} styles={styles} />
    </View>
  );
}

function LogoutButton({
  onAfter,
  styles,
}: {
  onAfter: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={async () => {
        await supabase.auth.signOut();
        onAfter();
      }}
      style={styles.ghostBtn}
    >
      <Text style={styles.ghostBtnText}>Se déconnecter</Text>
    </Pressable>
  );
}

function makeStyles({ colors }: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing.xl,
      gap: spacing.md,
      backgroundColor: colors.bg,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      gap: spacing.md,
      backgroundColor: colors.bg,
    },
    emptyEmoji: { fontSize: 48 },

    header: { gap: 4 },
    routeBadge: {
      ...typography.label,
      color: colors.brandDeep,
      fontSize: 11,
    },
    title: { ...typography.title, color: colors.text },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      marginTop: spacing.sm,
      color: colors.text,
    },
    subtle: { color: colors.textMuted, fontSize: 13 },
    subtleSuccess: { color: colors.success, fontSize: 12, fontWeight: "600" },
    error: { color: colors.danger, fontSize: 13, fontWeight: "500" },

    statusCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusCardActive: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accent,
    },
    statusCardDone: {
      backgroundColor: colors.successSoft,
      borderColor: colors.success,
    },
    statusHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    statusLabel: { ...typography.label, color: colors.textMuted },
    statusLabelActive: { color: colors.accentDeep },
    statusLabelDone: { color: colors.success },
    statusValue: { fontSize: 22, fontWeight: "800", color: colors.text },

    livePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.accent,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radii.pill,
    },
    livePillDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surface,
    },
    livePillText: {
      color: colors.textOnDark,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
    },

    toggleCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    toggleLabel: { fontSize: 15, fontWeight: "700", color: colors.text },

    startBtn: {
      backgroundColor: colors.brand,
      padding: spacing.lg,
      borderRadius: radii.lg,
    },
    startBtnText: {
      color: colors.textOnBrand,
      textAlign: "center",
      fontWeight: "800",
      fontSize: 17,
    },
    endBtn: {
      backgroundColor: colors.danger,
      padding: spacing.lg,
      borderRadius: radii.lg,
    },
    endBtnText: {
      color: colors.textOnDark,
      textAlign: "center",
      fontWeight: "800",
      fontSize: 17,
    },

    stopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stopRowDone: {
      backgroundColor: colors.successSoft,
      borderColor: colors.successBorder,
    },
    stopOrderBadge: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      backgroundColor: colors.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    stopOrderBadgeDone: { backgroundColor: colors.success },
    stopOrderText: {
      color: colors.brandDeep,
      fontWeight: "800",
      fontSize: 14,
    },
    stopOrderTextDone: { color: colors.surface, fontSize: 16 },
    stopName: { fontSize: 15, fontWeight: "700", color: colors.text },
    stopNameDone: { color: colors.success },

    markBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: radii.md,
    },
    markBtnDone: { backgroundColor: colors.success },
    markBtnText: { color: colors.textOnDark, fontWeight: "700" },
    markBtnTextDone: { color: colors.textOnDark },

    ghostBtn: { padding: spacing.md },
    ghostBtnText: {
      color: colors.textMuted,
      textAlign: "center",
      fontWeight: "600",
    },
    disabled: { opacity: 0.45 },
  });
}
