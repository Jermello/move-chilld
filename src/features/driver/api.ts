import { supabase } from "../../lib/supabase";
import type { Route, Stop, StopEvent, TripSession } from "../../lib/types";

/** The route assigned to this driver (first one, MVP). */
export async function fetchDriverRoute(driverId: string): Promise<Route | null> {
  const { data, error } = await supabase
    .from("routes")
    .select("id, name, driver_id")
    .eq("driver_id", driverId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Route | null;
}

export async function fetchStops(routeId: string): Promise<Stop[]> {
  const { data, error } = await supabase
    .from("stops")
    .select("id, route_id, name, lat, lng, stop_order")
    .eq("route_id", routeId)
    .order("stop_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Stop[];
}

/** Active trip for this route, if any. */
export async function fetchActiveTrip(
  routeId: string
): Promise<TripSession | null> {
  const { data, error } = await supabase
    .from("trip_sessions")
    .select("id, route_id, driver_id, status, started_at, ended_at")
    .eq("route_id", routeId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data as TripSession | null;
}

export async function startTrip(
  routeId: string,
  driverId: string,
  stops: Stop[]
): Promise<TripSession> {
  const { data: trip, error } = await supabase
    .from("trip_sessions")
    .insert({
      route_id: routeId,
      driver_id: driverId,
      status: "active",
      started_at: new Date().toISOString(),
    })
    .select("id, route_id, driver_id, status, started_at, ended_at")
    .single();
  if (error) throw error;

  // Seed a pending stop_event for each stop on the route.
  if (stops.length > 0) {
    const rows = stops.map((s) => ({
      trip_session_id: trip.id,
      stop_id: s.id,
      status: "pending" as const,
    }));
    const { error: seedError } = await supabase.from("stop_events").insert(rows);
    if (seedError) throw seedError;
  }

  return trip as TripSession;
}

export async function endTrip(tripId: string): Promise<void> {
  const { error } = await supabase
    .from("trip_sessions")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", tripId);
  if (error) throw error;
}

export async function markStopArrived(
  tripId: string,
  stopId: string
): Promise<void> {
  const { error } = await supabase
    .from("stop_events")
    .update({ status: "arrived", arrived_at: new Date().toISOString() })
    .eq("trip_session_id", tripId)
    .eq("stop_id", stopId);
  if (error) throw error;
}

export async function fetchStopEvents(tripId: string): Promise<StopEvent[]> {
  const { data, error } = await supabase
    .from("stop_events")
    .select("id, trip_session_id, stop_id, status, arrived_at")
    .eq("trip_session_id", tripId);
  if (error) throw error;
  return (data ?? []) as StopEvent[];
}

export async function pushLocation(
  tripId: string,
  lat: number,
  lng: number
): Promise<void> {
  const { error } = await supabase
    .from("vehicle_locations")
    .insert({ trip_session_id: tripId, lat, lng });
  if (error) throw error;
}
