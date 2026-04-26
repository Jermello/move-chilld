import { haversineMeters } from "../../lib/geo";
import type {
  ShuttleStatus,
  Stop,
  StopEvent,
  TripSession,
  VehicleLocation,
} from "../../lib/types";

/** Distance thresholds (meters) for the parent's status state machine. */
export const COMING_SOON_METERS = 1000;
export const APPROACHING_METERS = 500;
export const AT_STOP_METERS = 100;

/** Assumed bus speed for ETA fallback (m/s). ~30 km/h. */
export const AVG_SPEED_MPS = 8.3;

export type ParentStatus = {
  status: ShuttleStatus;
  distanceMeters: number | null;
  etaSeconds: number | null;
};

/**
 * Computes the UI status for the parent's stop given the current trip state.
 *
 * Rules:
 *  - no active trip && stop never arrived  → not_started
 *  - trip completed                        → completed
 *  - stop_event arrived                    → passed
 *  - distance < AT_STOP_METERS             → at_stop
 *  - distance < APPROACHING_METERS         → approaching
 *  - distance < COMING_SOON_METERS         → coming_soon
 *  - otherwise                             → en_route
 */
export function computeParentStatus(params: {
  trip: TripSession | null;
  stop: Stop | null;
  location: VehicleLocation | null;
  stopEvents: StopEvent[];
}): ParentStatus {
  const { trip, stop, location, stopEvents } = params;

  if (!trip && !stopEvents.some((e) => e.stop_id === stop?.id)) {
    return { status: "not_started", distanceMeters: null, etaSeconds: null };
  }

  if (trip?.status === "completed") {
    return { status: "completed", distanceMeters: null, etaSeconds: null };
  }

  const myEvent = stop ? stopEvents.find((e) => e.stop_id === stop.id) : null;
  if (myEvent?.status === "arrived") {
    return { status: "passed", distanceMeters: 0, etaSeconds: 0 };
  }

  if (!location || !stop) {
    return { status: "en_route", distanceMeters: null, etaSeconds: null };
  }

  const distance = haversineMeters(
    { lat: location.lat, lng: location.lng },
    { lat: stop.lat, lng: stop.lng }
  );
  const eta = distance / AVG_SPEED_MPS;

  let status: ShuttleStatus;
  if (distance < AT_STOP_METERS) status = "at_stop";
  else if (distance < APPROACHING_METERS) status = "approaching";
  else if (distance < COMING_SOON_METERS) status = "coming_soon";
  else status = "en_route";

  return { status, distanceMeters: distance, etaSeconds: eta };
}

export const STATUS_LABELS: Record<ShuttleStatus, string> = {
  not_started: "Pas encore démarré",
  en_route: "En route",
  coming_soon: "Bientôt là",
  approaching: "Arrive bientôt",
  at_stop: "À ton arrêt 🚌",
  passed: "Déjà passé",
  completed: "Trajet terminé",
};

export const STATUS_COLORS: Record<ShuttleStatus, string> = {
  not_started: "#9ca3af",
  en_route: "#2563eb",
  coming_soon: "#fbbf24",
  approaching: "#f59e0b",
  at_stop: "#dc2626",
  passed: "#10b981",
  completed: "#6b7280",
};
