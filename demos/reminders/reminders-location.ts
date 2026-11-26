import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { LatLon } from "../maps/maps-geo";
import { locationProblem, watchLocation } from "../maps/maps-location";
import { searchPlaces } from "../maps/maps-server";
import type { Reminder } from "./reminders-data";
import {
  changeReminderDetail,
  type ReminderDetail,
  reminderDetail,
  useDetailsVersion,
} from "./reminders-details";
import type { ReminderAlert } from "./reminders-sync";

/*
 * At a Location: the place is looked up once through Maps' geocoder, and while the Reminders window
 * is open the browser's position is held against it. A page cannot run with its window closed, so
 * no alert comes then; the crossing is seen at the next position, since where the person last stood
 * is kept with the reminder.
 */

/** How far from a place counts as being there, in metres: what Find My's rules use. */
export const PLACE_RADIUS_M = 200;

/** An alert of a place: Complete finishes the reminder whatever its date says. */
export interface LocationAlert extends ReminderAlert {
  place: string;
}

/** Great-circle distance between two points, in metres. */
export function metresBetween(a: LatLon, b: LatLon): number {
  const EARTH_M = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * What a position means for a reminder that last stood at `inside`: where it stands now, and whether
 * its alert fires. The first position only says where it stands, so no crossing nobody saw is told.
 */
export function placeCrossing(
  detail: Pick<ReminderDetail, "inside" | "leaving">,
  distance: number,
): { inside: boolean; fires: boolean } {
  const inside = distance <= PLACE_RADIUS_M;
  const fires =
    detail.inside !== undefined && detail.inside !== inside && inside === !detail.leaving;
  return { inside, fires };
}

/** A change of a reminder's place: what was worked out from the old one goes with it. */
export const changeOfPlace = (place: string): ReminderDetail => ({
  place,
  point: undefined,
  notFound: undefined,
  inside: undefined,
  firedAt: undefined,
  closedAt: undefined,
});

let problem: string | null = null;
const listeners = new Set<() => void>();
const setProblem = (next: string | null) => {
  if (next === problem) return;
  problem = next;
  for (const listen of listeners) listen();
};
const subscribeProblem = (listen: () => void) => {
  listeners.add(listen);
  return () => listeners.delete(listen);
};

/** What the info popover says of a reminder's place. */
export function useLocationHint(detail: ReminderDetail): string {
  const why = useSyncExternalStore(
    subscribeProblem,
    () => problem,
    () => null,
  );
  if (!detail.place) return "Enter a place to be reminded when you arrive or leave.";
  if (detail.notFound) return `Maps found no place called “${detail.place}”, so no alert comes.`;
  if (why) return why;
  return "The alert comes while Reminders is open and this browser gives its location.";
}

/** The window's alerts of places, for its reminders still to do. */
export function useLocationAlerts(reminders: readonly Reminder[], enabled: boolean) {
  const version = useDetailsVersion();
  const [position, setPosition] = useState<LatLon | null>(null);
  const asked = useRef(new Set<string>());
  const waiting = enabled
    ? reminders.flatMap((reminder) => {
        const detail = reminderDetail(reminder.id);
        return reminder.atLocation && !reminder.completed && detail.place
          ? [{ reminder, detail, place: detail.place }]
          : [];
      })
    : [];
  const watching = waiting.some(({ detail }) => !detail.notFound);

  useEffect(() => {
    if (!watching) return;
    setProblem(navigator.geolocation ? null : locationProblem(null));
    return watchLocation((at) => {
      setProblem(null);
      setPosition({ lat: at.lat, lon: at.lon });
    }, setProblem);
  }, [watching]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the kept details, which `version` follows, and the position are what change the answer
  useEffect(() => {
    for (const { reminder, detail, place } of waiting) {
      if (detail.notFound) continue;
      if (!detail.point) {
        const lookUp = `${reminder.id}\n${place}`;
        if (asked.current.has(lookUp)) continue;
        asked.current.add(lookUp);
        void searchPlaces(place).then((answer) => {
          if (reminderDetail(reminder.id).place !== place) return;
          if (!answer.ok) {
            asked.current.delete(lookUp);
            setProblem(`Maps could not look the place up: ${answer.message}.`);
          } else if (answer.value[0]) {
            const { lat, lon } = answer.value[0];
            changeReminderDetail(reminder.id, { point: { lat, lon } });
          } else changeReminderDetail(reminder.id, { notFound: true });
        });
        continue;
      }
      if (!position) continue;
      const { inside, fires } = placeCrossing(detail, metresBetween(position, detail.point));
      if (inside !== detail.inside) {
        changeReminderDetail(reminder.id, {
          inside,
          ...(fires ? { firedAt: Date.now() } : {}),
        });
      }
    }
  }, [version, position, enabled]);

  const alerts: LocationAlert[] = waiting.flatMap(({ reminder, detail, place }) =>
    detail.firedAt !== undefined && detail.closedAt !== detail.firedAt
      ? [
          {
            id: reminder.id,
            title: `${reminder.title}: ${detail.leaving ? "leaving" : "arriving at"} ${place}`,
            at: detail.firedAt,
            place,
          },
        ]
      : [],
  );
  return alerts;
}

/** Closes an alert of a place: it comes again only at another crossing. */
export const closeLocationAlert = (alert: LocationAlert) => {
  changeReminderDetail(alert.id, { closedAt: alert.at });
};
