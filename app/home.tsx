import { useApproachingAlert } from "@/src/features/notifications/useApproachingAlert";
import { usePushToken } from "@/src/features/notifications/usePushToken";
import { ShuttleMap } from "@/src/features/parent/ShuttleMap";
import { STATUS_COLORS, STATUS_LABELS } from "@/src/features/parent/status";
import { useParentTrip } from "@/src/features/parent/useParentTrip";
import { useProfile } from "@/src/hooks/useProfile";
import { useSession } from "@/src/hooks/useSession";
import { formatDistance, formatEta } from "@/src/lib/geo";
import { supabase } from "@/src/lib/supabase";
import { Redirect, useRouter } from "expo-router";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

export default function ParentHome() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const { profile } = useProfile(session?.user.id);

  usePushToken(session?.user.id);

  const { child, route, stops, parentStop, trip, location, status, loading, reload } =
    useParentTrip(session?.user.id);

  useApproachingAlert(status.status, trip?.id ?? null);

  if (sessionLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!session) return <Redirect href="/" />;
  if (profile?.role === "driver") return <Redirect href="/driver" />;
  if (profile?.role === "admin") return <Redirect href="/admin" />;

  const statusColor = STATUS_COLORS[status.status];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#fff" }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      <Text style={styles.hello}>Bonjour {profile?.full_name?.split(" ")[0] ?? ""} 👋</Text>

      {!child ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pas encore configuré</Text>
          <Text style={styles.subtle}>
            Aucun enfant n'est encore associé à ton compte. Contacte l'administrateur pour
            configurer ta route et ton arrêt.
          </Text>
        </View>
      ) : (
        <>
          <View style={[styles.statusCard, { borderColor: statusColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusLabel}>{STATUS_LABELS[status.status]}</Text>
              <Text style={styles.subtle}>
                {route?.name ?? "Route"} · {parentStop?.name ?? "Arrêt"}
              </Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <Metric
              label="Distance"
              value={status.distanceMeters != null ? formatDistance(status.distanceMeters) : "—"}
            />
            <Metric
              label="ETA"
              value={status.etaSeconds != null ? formatEta(status.etaSeconds) : "—"}
            />
          </View>

          <ShuttleMap stops={stops} parentStopId={parentStop?.id} location={location} />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ton arrêt</Text>
            <Text style={styles.cardValue}>{parentStop?.name ?? "—"}</Text>
          </View>
        </>
      )}

      <Pressable
        onPress={async () => {
          await supabase.auth.signOut();
          router.replace("/");
        }}
        style={styles.ghostBtn}
      >
        <Text style={styles.ghostBtnText}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hello: { fontSize: 22, fontWeight: "700" },
  subtle: { color: "#666", fontSize: 13 },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#fafafa",
    borderWidth: 2,
  },
  statusDot: { width: 16, height: 16, borderRadius: 8 },
  statusLabel: { fontSize: 20, fontWeight: "700" },
  metricsRow: { flexDirection: "row", gap: 12 },
  metric: {
    flex: 1,
    backgroundColor: "#f5f5f7",
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  metricLabel: { color: "#666", fontSize: 12, textTransform: "uppercase" },
  metricValue: { fontSize: 22, fontWeight: "800" },
  card: {
    backgroundColor: "#f5f5f7",
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  cardTitle: { fontSize: 12, color: "#666", textTransform: "uppercase" },
  cardValue: { fontSize: 18, fontWeight: "700" },
  ghostBtn: { padding: 10, marginTop: 8 },
  ghostBtnText: { color: "#666", textAlign: "center", fontWeight: "600" },
});
