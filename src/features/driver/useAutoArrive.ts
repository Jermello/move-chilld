import { useEffect, useRef } from "react";

import { haversineMeters } from "@/src/lib/geo";
import type { Stop, StopEvent } from "@/src/lib/types";

/**
 * Radius (in meters) inside which a pending stop is auto-marked as arrived.
 * 60m is a sweet spot: tight enough to avoid drive-by false positives on
 * parallel streets, loose enough to tolerate GPS noise in cities.
 */
const AUTO_ARRIVE_METERS = 60;

/**
 * Watches the driver's GPS and auto-marks a stop as arrived when the bus
 * enters its proximity radius. Idempotent: a stop is only triggered once,
 * and already-arrived stops are skipped.
 */
export function useAutoArrive(args: {
  enabled: boolean;
  coords: { lat: number; lng: number } | null;
  stops: Stop[];
  events: StopEvent[];
  onArrived: (stopId: string) => Promise<void> | void;
}) {
  const { enabled, coords, stops, events, onArrived } = args;
  const triggeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !coords) return;

    for (const stop of stops) {
      if (triggeredRef.current.has(stop.id)) continue;
      const ev = events.find((e) => e.stop_id === stop.id);
      if (!ev || ev.status === "arrived") continue;

      const d = haversineMeters(coords, { lat: stop.lat, lng: stop.lng });
      if (d <= AUTO_ARRIVE_METERS) {
        triggeredRef.current.add(stop.id);
        Promise.resolve(onArrived(stop.id)).catch(() => {
          triggeredRef.current.delete(stop.id);
        });
      }
    }
  }, [enabled, coords, stops, events, onArrived]);
}

export { AUTO_ARRIVE_METERS };
