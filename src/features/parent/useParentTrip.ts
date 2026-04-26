import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type {
  Child,
  Route,
  Stop,
  StopEvent,
  TripSession,
  VehicleLocation,
} from "../../lib/types";
import {
  fetchActiveTripForRoute,
  fetchChildForParent,
  fetchLatestLocation,
  fetchRoute,
  fetchStopsForRoute,
  fetchTripStopEvents,
} from "./api";
import { computeParentStatus } from "./status";

/**
 * Subscribes to the parent's assigned trip and keeps location + stop events
 * fresh via Supabase realtime.
 */
export function useParentTrip(parentId: string | undefined) {
  const [child, setChild] = useState<Child | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [trip, setTrip] = useState<TripSession | null>(null);
  const [location, setLocation] = useState<VehicleLocation | null>(null);
  const [events, setEvents] = useState<StopEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parentStop = useMemo(
    () => stops.find((s) => s.id === child?.stop_id) ?? null,
    [stops, child]
  );

  const reload = useCallback(async () => {
    if (!parentId) return;
    try {
      setLoading(true);
      const c = await fetchChildForParent(parentId);
      setChild(c);
      if (!c) {
        setRoute(null);
        setStops([]);
        setTrip(null);
        setLocation(null);
        setEvents([]);
        return;
      }
      const [r, s, t] = await Promise.all([
        fetchRoute(c.route_id),
        fetchStopsForRoute(c.route_id),
        fetchActiveTripForRoute(c.route_id),
      ]);
      setRoute(r);
      setStops(s);
      setTrip(t);
      if (t) {
        const [loc, ev] = await Promise.all([
          fetchLatestLocation(t.id),
          fetchTripStopEvents(t.id),
        ]);
        setLocation(loc);
        setEvents(ev);
      } else {
        setLocation(null);
        setEvents([]);
      }
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Poll for trip start: if there's no active trip yet, periodically recheck.
  useEffect(() => {
    if (!route || trip) return;
    const id = setInterval(() => {
      fetchActiveTripForRoute(route.id)
        .then(async (t) => {
          if (!t) return;
          setTrip(t);
          const [loc, ev] = await Promise.all([
            fetchLatestLocation(t.id),
            fetchTripStopEvents(t.id),
          ]);
          setLocation(loc);
          setEvents(ev);
        })
        .catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [route, trip]);

  // Realtime subscriptions for the active trip.
  useEffect(() => {
    if (!trip) return;
    const tripId = trip.id;

    const locChannel = supabase
      .channel(`parent-loc-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vehicle_locations",
          filter: `trip_session_id=eq.${tripId}`,
        },
        (payload) => setLocation(payload.new as VehicleLocation)
      )
      .subscribe();

    const eventsChannel = supabase
      .channel(`parent-events-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stop_events",
          filter: `trip_session_id=eq.${tripId}`,
        },
        () => fetchTripStopEvents(tripId).then(setEvents).catch(() => {})
      )
      .subscribe();

    const tripChannel = supabase
      .channel(`parent-trip-${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trip_sessions",
          filter: `id=eq.${tripId}`,
        },
        (payload) => setTrip(payload.new as TripSession)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(locChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(tripChannel);
    };
  }, [trip]);

  const status = useMemo(
    () =>
      computeParentStatus({
        trip,
        stop: parentStop,
        location,
        stopEvents: events,
      }),
    [trip, parentStop, location, events]
  );

  return {
    child,
    route,
    stops,
    parentStop,
    trip,
    location,
    events,
    status,
    loading,
    error,
    reload,
  };
}
