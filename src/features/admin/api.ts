import { supabase } from "../../lib/supabase";
import type {
  AdminUser,
  Child,
  Role,
  Route,
  Stop,
} from "../../lib/types";

// =====================================================================
// Users
// =====================================================================

export async function listUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc("admin_list_users");
  if (error) throw error;
  return (data ?? []) as AdminUser[];
}

export async function setUserRole(userId: string, role: Role): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) throw error;
}

// =====================================================================
// Routes
// =====================================================================

export async function listRoutes(): Promise<Route[]> {
  const { data, error } = await supabase
    .from("routes")
    .select("id, name, driver_id")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Route[];
}

export async function getRoute(routeId: string): Promise<Route | null> {
  const { data, error } = await supabase
    .from("routes")
    .select("id, name, driver_id")
    .eq("id", routeId)
    .maybeSingle();
  if (error) throw error;
  return data as Route | null;
}

export async function createRoute(
  name: string,
  driverId: string | null
): Promise<Route> {
  const { data, error } = await supabase
    .from("routes")
    .insert({ name, driver_id: driverId })
    .select("id, name, driver_id")
    .single();
  if (error) throw error;
  return data as Route;
}

export async function updateRoute(
  id: string,
  patch: { name?: string; driver_id?: string | null }
): Promise<void> {
  const { error } = await supabase.from("routes").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteRoute(id: string): Promise<void> {
  const { error } = await supabase.from("routes").delete().eq("id", id);
  if (error) throw error;
}

// =====================================================================
// Stops
// =====================================================================

export async function listStops(routeId: string): Promise<Stop[]> {
  const { data, error } = await supabase
    .from("stops")
    .select("id, route_id, name, lat, lng, stop_order")
    .eq("route_id", routeId)
    .order("stop_order");
  if (error) throw error;
  return (data ?? []) as Stop[];
}

export async function createStop(input: {
  route_id: string;
  name: string;
  lat: number;
  lng: number;
  stop_order: number;
}): Promise<Stop> {
  const { data, error } = await supabase
    .from("stops")
    .insert(input)
    .select("id, route_id, name, lat, lng, stop_order")
    .single();
  if (error) throw error;
  return data as Stop;
}

export async function updateStop(
  id: string,
  patch: { name?: string; lat?: number; lng?: number; stop_order?: number }
): Promise<void> {
  const { error } = await supabase.from("stops").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteStop(id: string): Promise<void> {
  const { error } = await supabase.from("stops").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Swaps stop_order between two stops. We use a temp value to avoid
 * violating the unique (route_id, stop_order) constraint.
 */
export async function swapStopOrder(a: Stop, b: Stop): Promise<void> {
  const tempOrder = -Math.abs(a.stop_order) - 1;
  const { error: e1 } = await supabase
    .from("stops")
    .update({ stop_order: tempOrder })
    .eq("id", a.id);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from("stops")
    .update({ stop_order: a.stop_order })
    .eq("id", b.id);
  if (e2) throw e2;
  const { error: e3 } = await supabase
    .from("stops")
    .update({ stop_order: b.stop_order })
    .eq("id", a.id);
  if (e3) throw e3;
}

// =====================================================================
// Children
// =====================================================================

export async function listChildrenForRoute(
  routeId: string
): Promise<Child[]> {
  const { data, error } = await supabase
    .from("children")
    .select("id, parent_id, route_id, stop_id, full_name")
    .eq("route_id", routeId);
  if (error) throw error;
  return (data ?? []) as Child[];
}

export async function createChild(input: {
  parent_id: string;
  route_id: string;
  stop_id: string;
  full_name: string;
}): Promise<Child> {
  const { data, error } = await supabase
    .from("children")
    .insert(input)
    .select("id, parent_id, route_id, stop_id, full_name")
    .single();
  if (error) throw error;
  return data as Child;
}

export async function deleteChild(id: string): Promise<void> {
  const { error } = await supabase.from("children").delete().eq("id", id);
  if (error) throw error;
}
