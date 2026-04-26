import type { Stop, VehicleLocation } from "@/src/lib/types";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  stops: Stop[];
  parentStopId?: string;
  location: VehicleLocation | null;
};

/**
 * Web fallback — react-native-maps is native-only.
 * Metro resolves `ShuttleMap.native.tsx` on iOS/Android and this file on web.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ShuttleMap(_props: Props) {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>
        La carte n'est disponible que sur mobile.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    width: "100%",
    height: 260,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
  },
  fallbackText: { color: "#666" },
});
