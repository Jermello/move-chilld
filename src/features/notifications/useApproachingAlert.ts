import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";

import type { ShuttleStatus } from "../../lib/types";

type Trigger = {
  status: ShuttleStatus;
  title: string;
  body: string;
};

/**
 * Each trigger fires at most once per trip, the first time the parent's
 * status reaches the corresponding state. Reset on trip change.
 */
const TRIGGERS: Trigger[] = [
  {
    status: "approaching",
    title: "Le bus arrive 🚌",
    body: "Moins de 500 m. C'est le moment de partir !",
  },
  {
    status: "at_stop",
    title: "Le bus est à ton arrêt 🚏",
    body: "Le bus est juste à côté de ton arrêt.",
  },
];

/**
 * Fires local notifications as the shuttle progresses through the
 * approach phases. Each phase fires once per trip.
 */
export function useApproachingAlert(
  status: ShuttleStatus,
  tripId: string | null
) {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    firedRef.current = new Set();
  }, [tripId]);

  useEffect(() => {
    if (!tripId) return;
    const trigger = TRIGGERS.find((t) => t.status === status);
    if (!trigger) return;

    const key = `${tripId}:${status}`;
    if (firedRef.current.has(key)) return;
    firedRef.current.add(key);

    Notifications.scheduleNotificationAsync({
      content: { title: trigger.title, body: trigger.body },
      trigger: null,
    }).catch(() => {});
  }, [status, tripId]);
}
