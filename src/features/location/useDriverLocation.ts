import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { pushLocation } from "../driver/api";

/** Push GPS updates at most every N ms to keep the db light. */
const MIN_PUSH_INTERVAL_MS = 5000;

/**
 * Tracks the driver's GPS while a trip is active and writes each update
 * to `vehicle_locations`. Uses foreground tracking for MVP — background
 * updates can be layered in later with expo-task-manager.
 */
export function useDriverLocation(tripId: string | null) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [permission, setPermission] = useState<"granted" | "denied" | "unknown">(
    "unknown"
  );
  const [error, setError] = useState<string | null>(null);
  const lastPushRef = useRef<number>(0);

  useEffect(() => {
    if (!tripId) return;
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== "granted") {
        setPermission("denied");
        setError("Autorisation de localisation refusée.");
        return;
      }
      setPermission("granted");

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: MIN_PUSH_INTERVAL_MS,
          distanceInterval: 10,
        },
        async (loc) => {
          const lat = loc.coords.latitude;
          const lng = loc.coords.longitude;
          setCoords({ lat, lng });

          const now = Date.now();
          if (now - lastPushRef.current < MIN_PUSH_INTERVAL_MS) return;
          lastPushRef.current = now;

          try {
            await pushLocation(tripId, lat, lng);
          } catch (e) {
            console.warn("pushLocation failed", e);
          }
        }
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [tripId]);

  return { coords, permission, error };
}
