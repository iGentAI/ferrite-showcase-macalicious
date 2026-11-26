import { Switch } from "macalicious/switch";
import {
  TodayWidget,
  TodayWidgetDate,
  TodayWidgetRow,
  TodayWidgetSummary,
} from "macalicious/today-widget";

/** A crescent, standing in for the Do Not Disturb glyph. */
const moon = (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
    <path d="M11 2a6.5 6.5 0 1 0 3 9.5A6 6 0 0 1 11 2z" fill="currentColor" opacity="0.6" />
  </svg>
);

/**
 * The system blocks at the top of the Today view: a card of switch rows without a header, the
 * date, and the summary.
 */
export default function SystemCards() {
  return (
    <div style={{ padding: 11, background: "light-dark(#b5ddf8, #152c4a)" }}>
      <TodayWidget aria-label="Quick settings">
        <TodayWidgetRow label="Night Shift">
          <Switch />
        </TodayWidgetRow>
        <TodayWidgetRow label="Do Not Disturb" icon={moon}>
          <Switch defaultChecked />
        </TodayWidgetRow>
      </TodayWidget>
      <TodayWidgetDate weekday="Thursday," date="October 3" />
      <TodayWidgetSummary>
        <p>Partly Cloudy currently. The high will be 97°. Fair tonight with a low of 64°.</p>
        <p>The first thing on your calendar today is “Lunch”, in 30 minutes.</p>
      </TodayWidgetSummary>
    </div>
  );
}
