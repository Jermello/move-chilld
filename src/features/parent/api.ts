import { supabase } from "../../lib/supabase";
import type {
  Child,
  Route,
  Stop,
  StopEvent,
  TripSession,
  VehicleLocation,
} from "../../lib/types";

/** First child linked to this parent (MVP: one child). */
export async function fetchChildForParent(
  parentId: string
): Promise<Child | null> {
  const { data, error } = await supabase
    .from("children")
    .select("id, parent_id, route_id, stop_id, full_name")
    .eq("parent_id", parentId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Child | null;
}

export async function fetchRoute(routeId: string): Promise<Route | null> {
  const { data, error } = await supabase
    .from("routes")
    .select("id, name, driver_id")
    .eq("id", routeId)
    .maybeSingle();
  if (error) throw error;
  return data as Route | null;
}

export async function fetchStopsForRoute(routeId: string): Promise<Stop[]> {
  const { data, error } = await supabase
    .from("stops")
    .select("id, route_id, name, lat, lng, stop_order")
    .eq("route_id", routeId)
    .order("stop_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Stop[];
}

export async function fetchActiveTripForRoute(
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

export async function fetchLatestLocation(
  tripId: string
): Promise<VehicleLocation | null> {
  const { data, error } = await supabase
    .from("vehicle_locations")
    .select("id, trip_session_id, lat, lng, created_at")
    .eq("trip_session_id", tripId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as VehicleLocation | null;
}

export async function fetchTripStopEvents(tripId: string): Promise<StopEvent[]> {
  const { data, error } = await supabase
    .from("stop_events")
    .select("id, trip_session_id, stop_id, status, arrived_at")
    .eq("trip_session_id", tripId);
  if (error) throw error;
  return (data ?? []) as StopEvent[];
}
