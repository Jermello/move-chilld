import { useApproachingAlert } from "@/src/features/notifications/useApproachingAlert";
import { usePushToken } from "@/src/features/notifications/usePushToken";
import { ShuttleMap } from "@/src/features/parent/ShuttleMap";
import { getStatusColors, STATUS_LABELS } from "@/src/features/parent/status";
import { useParentTrip } from "@/src/features/parent/useParentTrip";
import { useProfile } from "@/src/hooks/useProfile";
import { useSession } from "@/src/hooks/useSession";
import { formatDistance, formatEta } from "@/src/lib/geo";
import { supabase } from "@/src/lib/supabase";
import { radii, spacing, typography, type Theme } from "@/src/lib/theme";
import { useTheme } from "@/src/lib/themeContext";
import { Redirect, useRouter } from "expo-router";
import { useMemo } from "react";
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
  const theme = useTheme();
  const { colors, shadow } = theme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

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
        <ActivityIndicator color={colors.brandDeep} />
      </View>
    );
  }
  if (!session) return <Redirect href="/" />;
  if (profile?.role === "driver") return <Redirect href="/driver" />;
  if (profile?.role === "admin") return <Redirect href="/admin" />;

  const statusColor = getStatusColors(colors)[status.status];
  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const isLive = trip?.status === "active";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={reload}
          tintColor={colors.brandDeep}
        />
      }
    >
      <View style={styles.heroBlock}>
        <Text style={styles.greeting}>Bonjour {firstName} 👋</Text>
        {!!child?.full_name && (
          <Text style={styles.childLine}>
            <Text style={styles.childLabel}>On suit </Text>
            <Text style={styles.childName}>{child.full_name}</Text>
            <Text style={styles.childLabel}>{" aujourd'hui"}</Text>
          </Text>
        )}
      </View>

      {!child ? (
        <View style={[styles.emptyCard, shadow.sm]}>
          <Text style={styles.emptyEmoji}>🤝</Text>
          <Text style={styles.cardTitle}>Pas encore configuré</Text>
          <Text style={styles.subtle}>
            {"Aucun enfant n'est encore associé à ton compte. Contacte l'administrateur pour configurer ta route et ton arrêt."}
          </Text>
        </View>
      ) : (
        <>
          <View
            style={[
              styles.statusCard,
              shadow.sm,
              { borderColor: statusColor },
              isLive && [styles.statusCardLive, shadow.accent],
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusLabel}>{STATUS_LABELS[status.status]}</Text>
              <Text style={styles.subtle}>
                {route?.name ?? "Route"} · {parentStop?.name ?? "Arrêt"}
              </Text>
            </View>
            {isLive && (
              <View style={styles.livePill}>
                <View style={styles.livePillDot} />
                <Text style={styles.livePillText}>LIVE</Text>
              </View>
            )}
          </View>

          <View style={styles.metricsRow}>
            <Metric
              styles={styles}
              label="Distance"
              value={
                status.distanceMeters != null
                  ? formatDistance(status.distanceMeters)
                  : "—"
              }
              tone="brand"
            />
            <Metric
              styles={styles}
              label="ETA"
              value={
                status.etaSeconds != null ? formatEta(status.etaSeconds) : "—"
              }
              tone="primary"
            />
          </View>

          <View style={[styles.mapWrap, shadow.sm]}>
            <ShuttleMap
              stops={stops}
              parentStopId={parentStop?.id}
              location={location}
            />
          </View>

          <View style={[styles.stopCard, shadow.sm]}>
            <View style={styles.stopIcon}>
              <Text style={styles.stopEmoji}>📍</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Ton arrêt</Text>
              <Text style={styles.cardValue}>{parentStop?.name ?? "—"}</Text>
            </View>
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

function Metric({
  label,
  value,
  tone,
  styles,
}: {
  label: string;
  value: string;
  tone: "brand" | "primary";
  styles: ReturnType<typeof makeStyles>;
}) {
  const isBrand = tone === "brand";
  return (
    <View style={[styles.metric, isBrand ? styles.metricBrand : styles.metricPrimary]}>
      <Text
        style={[
          styles.metricLabel,
          isBrand ? styles.metricLabelBrand : styles.metricLabelPrimary,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.metricValue,
          isBrand ? styles.metricValueBrand : styles.metricValuePrimary,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function makeStyles({ colors }: Theme) {
  return StyleSheet.create({
    container: {
      padding: spacing.xl,
      gap: spacing.lg,
      paddingBottom: 40,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.bg,
    },

    heroBlock: { gap: 4 },
    greeting: { ...typography.title, color: colors.text },
    childLine: { fontSize: 15 },
    childLabel: { color: colors.textMuted, fontWeight: "500" },
    childName: { color: colors.brandDeep, fontWeight: "800" },

    subtle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },

    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.xl,
      padding: spacing.xl,
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    emptyEmoji: { fontSize: 40, marginBottom: spacing.xs },

    statusCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 2,
    },
    statusCardLive: {
      backgroundColor: colors.accentSoft,
    },
    statusDot: { width: 14, height: 14, borderRadius: 7 },
    statusLabel: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 2,
    },

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

    metricsRow: { flexDirection: "row", gap: spacing.md },
    metric: {
      flex: 1,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: 4,
      borderWidth: 1,
    },
    metricBrand: {
      backgroundColor: colors.brandSoft,
      borderColor: colors.brand,
    },
    metricPrimary: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    metricLabel: { ...typography.label, fontSize: 11 },
    metricLabelBrand: { color: colors.brandDeep },
    metricLabelPrimary: { color: colors.primary },
    metricValue: { fontSize: 24, fontWeight: "800" },
    metricValueBrand: { color: colors.text },
    metricValuePrimary: { color: colors.text },

    mapWrap: {
      borderRadius: radii.xl,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },

    stopCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stopIcon: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      backgroundColor: colors.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    stopEmoji: { fontSize: 22 },
    cardTitle: { ...typography.label, color: colors.textMuted },
    cardValue: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      marginTop: 2,
    },

    ghostBtn: { padding: spacing.md, marginTop: spacing.sm },
    ghostBtnText: {
      color: colors.textMuted,
      textAlign: "center",
      fontWeight: "600",
    },
  });
}
