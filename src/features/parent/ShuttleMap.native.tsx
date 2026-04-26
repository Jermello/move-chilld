import type { Stop, VehicleLocation } from "@/src/lib/types";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";

type Props = {
  stops: Stop[];
  parentStopId?: string;
  location: VehicleLocation | null;
};

/** Zoom level used when actively following the bus. */
const FOLLOW_LATITUDE_DELTA = 0.012;
const FOLLOW_LONGITUDE_DELTA = 0.012;

/**
 * Map showing the bus + all stops on the route. Parent's own stop is highlighted.
 * Auto-follows the bus when `follow` is on; user can disable to pan freely.
 */
export function ShuttleMap({ stops, parentStopId, location }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const [follow, setFollow] = useState(true);

  const overviewRegion = useMemo<Region>(() => {
    const points = [
      ...stops.map((s) => ({ lat: s.lat, lng: s.lng })),
      ...(location ? [{ lat: location.lat, lng: location.lng }] : []),
    ];
    if (points.length === 0) {
      return {
        latitude: 48.8566,
        longitude: 2.3522,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.6),
      longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.6),
    };
  }, [stops, location]);

  // Auto-follow: animate to the bus position whenever it updates and follow is on.
  useEffect(() => {
    if (!follow || !location || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: FOLLOW_LATITUDE_DELTA,
        longitudeDelta: FOLLOW_LONGITUDE_DELTA,
      },
      600
    );
  }, [follow, location]);

  const onRecenter = () => {
    setFollow(true);
    if (location && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: FOLLOW_LATITUDE_DELTA,
          longitudeDelta: FOLLOW_LONGITUDE_DELTA,
        },
        600
      );
    } else if (mapRef.current) {
      mapRef.current.animateToRegion(overviewRegion, 600);
    }
  };

  return (
    <View style={styles.wrapper}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={overviewRegion}
        // A user gesture turns off auto-follow so we don't fight them.
        onPanDrag={() => follow && setFollow(false)}
      >
        {stops.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            title={s.name}
            pinColor={s.id === parentStopId ? "#f59e0b" : "#2563eb"}
          />
        ))}
        {location && (
          <Marker
            coordinate={{ latitude: location.lat, longitude: location.lng }}
            title="Bus"
            description={new Date(location.created_at).toLocaleTimeString()}
            pinColor="#b91c1c"
          />
        )}
      </MapView>

      <Pressable
        onPress={onRecenter}
        style={[styles.recenterBtn, follow && styles.recenterBtnActive]}
      >
        <Text style={[styles.recenterText, follow && styles.recenterTextActive]}>
          {follow ? "🎯 Suit le bus" : "🎯 Recentrer"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    height: 260,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  map: { width: "100%", height: "100%" },
  recenterBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  recenterBtnActive: {
    backgroundColor: "#111",
  },
  recenterText: { color: "#111", fontWeight: "700", fontSize: 13 },
  recenterTextActive: { color: "#fff" },
});
