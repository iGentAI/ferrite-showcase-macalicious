import { NotificationBanner } from "macalicious/notification-banner";
import {
  NotificationCenter,
  NotificationCenterGroup,
  NotificationCenterView,
} from "macalicious/notification-center";
import { Switch } from "macalicious/switch";
import {
  TodayWidget,
  TodayWidgetDate,
  TodayWidgetRow,
  TodayWidgetSummary,
} from "macalicious/today-widget";

/**
 * Notification Center with both views. The panel blurs what is behind it in the same page:
 * here a plain gradient stands in for the desktop.
 */
export default function Basic() {
  return (
    <div
      style={{
        display: "flex",
        height: 420,
        justifyContent: "flex-end",
        background: "linear-gradient(light-dark(#7fb0dc, #0b2145), light-dark(#b9c6c4, #233349))",
      }}
    >
      <NotificationCenter editLabel="Edit" onSettings={() => {}}>
        <NotificationCenterView value="today">
          <TodayWidget aria-label="Quick settings">
            <TodayWidgetRow label="Night Shift">
              <Switch />
            </TodayWidgetRow>
            <TodayWidgetRow label="Do Not Disturb">
              <Switch />
            </TodayWidgetRow>
          </TodayWidget>
          <TodayWidgetDate weekday="Thursday," date="October 3" />
          <TodayWidgetSummary>
            <p>Partly Cloudy currently. The high will be 97°. Fair tonight with a low of 64°.</p>
          </TodayWidgetSummary>
        </NotificationCenterView>
        <NotificationCenterView value="notifications">
          <NotificationCenterGroup heading="Today" onClear={() => {}}>
            <NotificationBanner app="Music" time="now" title="Every Breaking Wave">
              U2 — Songs of Innocence
            </NotificationBanner>
          </NotificationCenterGroup>
        </NotificationCenterView>
      </NotificationCenter>
    </div>
  );
}
