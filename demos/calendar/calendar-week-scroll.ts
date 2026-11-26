import { useRef } from "react";

/** How far a sideways scroll goes, in points, for one step of the week view. */
const WHEEL_STEP = 60;
/** How long a sideways scroll rests before another one counts as a new gesture, in milliseconds. */
const WHEEL_PAUSE = 250;

/**
 * A sideways scroll of the week view steps it, by what Scroll in week view by says. With Stop on
 * Today, a gesture that reaches today's week ends there, however far it goes on.
 */
export function useWeekWheel(options: {
  enabled: boolean;
  stopOnToday: boolean;
  landsOnToday: (by: 1 | -1) => boolean;
  step: (by: 1 | -1) => void;
}) {
  const latest = useRef(options);
  latest.current = options;
  const gesture = useRef({ total: 0, last: 0, stopped: false });
  return (event: { deltaX: number; deltaY: number }) => {
    const { enabled, stopOnToday, landsOnToday, step } = latest.current;
    if (!enabled || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    const now = Date.now();
    const held = gesture.current;
    if (now - held.last > WHEEL_PAUSE) {
      held.total = 0;
      held.stopped = false;
    }
    held.last = now;
    if (held.stopped) return;
    held.total += event.deltaX;
    if (Math.abs(held.total) < WHEEL_STEP) return;
    const by = held.total > 0 ? 1 : -1;
    held.total = 0;
    held.stopped = stopOnToday && landsOnToday(by);
    step(by);
  };
}
