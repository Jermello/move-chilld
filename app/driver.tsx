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
import type {
  Route,
  Stop,
  StopEvent,
  TripSession,
} from "@/src/lib/types";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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

  // Refresh stop events while the trip is running so the list stays in sync.
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
        <ActivityIndicator />
      </View>
    );
  }
  if (!session) return <Redirect href="/" />;
  if (profile?.role === "admin") return <Redirect href="/admin" />;
  if (profile?.role === "parent") return <Redirect href="/home" />;

  if (!route) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Aucun trajet assigné</Text>
        <Text style={styles.subtle}>
          Contacte l'administrateur pour qu'il t'assigne une route.
        </Text>
        <LogoutButton onAfter={() => router.replace("/")} />
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
  const eventByStop = new Map(events.map((e) => [e.stop_id, e]));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{route.name}</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Statut</Text>
        <Text style={styles.cardValue}>
          {active
            ? "🟢 Trajet en cours"
            : trip?.status === "completed"
            ? "✅ Trajet terminé"
            : "⚪️ Pas démarré"}
        </Text>
        {active && coords && (
          <Text style={styles.subtle}>
            Position: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </Text>
        )}
        {active && permission === "denied" && (
          <Text style={styles.error}>{locError ?? "GPS désactivé"}</Text>
        )}
      </View>

      <View style={styles.toggleCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>Détection auto des arrêts</Text>
          <Text style={styles.subtle}>
            Marque l'arrêt comme atteint quand tu passes à moins de 60m.
          </Text>
        </View>
        <Switch value={autoArrive} onValueChange={setAutoArrive} />
      </View>

      {!active ? (
        <Pressable
          onPress={onStart}
          disabled={busy || stops.length === 0}
          style={[styles.primaryBtn, (busy || stops.length === 0) && styles.disabled]}
        >
          <Text style={styles.primaryBtnText}>Démarrer le trajet</Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onEnd}
          disabled={busy}
          style={[styles.dangerBtn, busy && styles.disabled]}
        >
          <Text style={styles.primaryBtnText}>Terminer le trajet</Text>
        </Pressable>
      )}

      <Text style={styles.sectionTitle}>Arrêts</Text>
      <FlatList
        data={stops}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ gap: 8, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const ev = eventByStop.get(item.id);
          const arrived = ev?.status === "arrived";
          return (
            <View style={[styles.stopRow, arrived && styles.stopRowDone]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.stopName}>
                  {item.stop_order}. {item.name}
                </Text>
                {arrived && ev?.arrived_at && (
                  <Text style={styles.subtle}>
                    Arrivé à {new Date(ev.arrived_at).toLocaleTimeString()}
                  </Text>
                )}
              </View>
              <Pressable
                disabled={!active || arrived}
                onPress={() => onMarkArrived(item.id)}
                style={[
                  styles.markBtn,
                  (!active || arrived) && styles.disabled,
                ]}
              >
                <Text style={styles.markBtnText}>
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

      <LogoutButton onAfter={() => router.replace("/")} />
    </View>
  );
}

function LogoutButton({ onAfter }: { onAfter: () => void }) {
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 14, backgroundColor: "#fff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
    backgroundColor: "#fff",
  },
  title: { fontSize: 26, fontWeight: "800" },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginTop: 8 },
  subtle: { color: "#666", fontSize: 13 },
  error: { color: "#b91c1c", fontSize: 13 },
  card: {
    backgroundColor: "#f5f5f7",
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  cardLabel: { color: "#666", fontSize: 12, textTransform: "uppercase" },
  cardValue: { fontSize: 18, fontWeight: "700" },
  toggleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f5f5f7",
    borderRadius: 14,
    padding: 14,
  },
  toggleLabel: { fontSize: 15, fontWeight: "600" },
  primaryBtn: {
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 12,
  },
  dangerBtn: {
    backgroundColor: "#b91c1c",
    padding: 16,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eee",
  },
  stopRowDone: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  stopName: { fontSize: 15, fontWeight: "600" },
  markBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  markBtnText: { color: "#fff", fontWeight: "700" },
  ghostBtn: { padding: 10 },
  ghostBtnText: { color: "#666", textAlign: "center", fontWeight: "600" },
  disabled: { opacity: 0.45 },
});
