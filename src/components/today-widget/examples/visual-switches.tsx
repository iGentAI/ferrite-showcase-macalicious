import { Switch } from "macalicious/switch";
import { TodayWidget, TodayWidgetRow } from "macalicious/today-widget";

/** A sun with rays, standing in for the Night Shift glyph. */
const sun = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <circle cx="8" cy="8" r="3.5" fill="none" stroke="currentColor" />
    <path
      d="M8 .5v2M8 13.5v2M.5 8h2M13.5 8h2M2.7 2.7l1.4 1.4M11.9 11.9l1.4 1.4M2.7 13.3l1.4-1.4M11.9 4.1l1.4-1.4"
      stroke="currentColor"
    />
  </svg>
);

/** A crescent, standing in for the Do Not Disturb glyph. */
const moon = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M11 2a6.5 6.5 0 1 0 3 9.5A6 6 0 0 1 11 2z" fill="currentColor" opacity="0.6" />
  </svg>
);

/**
 * Visual comparison target: the card of switches at the top of the Today view, with 5 pt of
 * the panel around it. Reference crop (2x pixels) x=2684 y=154 w=664 h=196 of the
 * Notification-Center-Today captures, 332 x 98 pt.
 *
 * The card is a translucent overlay, so the gradient behind it is the Notification Center
 * panel as measured above and below the card (sky at the left, the sun's glow at the right).
 */
export default function VisualSwitches() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 332,
        height: 98,
        padding: 5,
        background:
          "linear-gradient(to right, light-dark(#b6def8, #1b3355) 6.25%, light-dark(#b7def8, #183153) 18.75%, light-dark(#b7dff8, #183052) 31.25%, light-dark(#b8dff8, #172f50) 43.75%, light-dark(#badff7, #19304f) 56.25%, light-dark(#c5dde9, #303c4c) 68.75%, light-dark(#d2d9d2, #4b4a47) 81.25%, light-dark(#c8dde5, #353d49) 93.75%)",
      }}
    >
      <TodayWidget aria-label="Quick settings">
        <TodayWidgetRow label="Night Shift" icon={sun}>
          <Switch />
        </TodayWidgetRow>
        <TodayWidgetRow label="Do Not Disturb" icon={moon}>
          <Switch />
        </TodayWidgetRow>
      </TodayWidget>
    </div>
  );
}
