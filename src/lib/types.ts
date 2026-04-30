export type Role = "parent" | "driver" | "admin";

export type Profile = {
  id: string;
  role: Role;
  email: string | null;
  full_name: string | null;
  push_token: string | null;
};

/** Returned by the `admin_list_users` RPC. */
export type AdminUser = {
  id: string;
  email: string;
  role: Role;
  full_name: string | null;
};

export type Route = {
  id: string;
  name: string;
  driver_id: string | null;
};

export type Stop = {
  id: string;
  route_id: string;
  name: string;
  lat: number;
  lng: number;
  stop_order: number;
};

export type Child = {
  id: string;
  parent_id: string;
  route_id: string;
  stop_id: string;
  full_name: string | null;
};

export type TripStatus = "pending" | "active" | "completed";

export type TripSession = {
  id: string;
  route_id: string;
  driver_id: string;
  status: TripStatus;
  started_at: string | null;
  ended_at: string | null;
};

export type VehicleLocation = {
  id: number;
  trip_session_id: string;
  lat: number;
  lng: number;
  created_at: string;
};

export type StopEventStatus = "pending" | "arrived";

export type StopEvent = {
  id: string;
  trip_session_id: string;
  stop_id: string;
  status: StopEventStatus;
  arrived_at: string | null;
};

/**
 * UI-facing shuttle status for a given parent stop.
 * Distance thresholds are defined in `features/parent/status.ts`.
 *
 *   not_started → en_route → coming_soon → approaching → at_stop → passed → completed
 */
export type ShuttleStatus =
  | "not_started"
  | "en_route"
  | "coming_soon"
  | "approaching"
  | "at_stop"
  | "passed"
  | "completed";
