import { NotificationBanner } from "macalicious/notification-banner";
import {
  NotificationCenter,
  NotificationCenterGroup,
  NotificationCenterView,
} from "macalicious/notification-center";

/**
 * Visual comparison target: the top 150 pt of Notification Center's Notifications view, the
 * header with "Notifications" selected, the day heading with its clear button and the start of
 * a notification. Reference crop (2x pixels) x=2672 y=44 w=688 h=300 of the
 * Notification-Center-Notifications captures.
 *
 * The gradient behind the panel stands in for the blurred desktop picture, as in
 * `visual-today`.
 */
export default function VisualNotifications() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 344,
        height: 150,
        background:
          "linear-gradient(to right, light-dark(#85b1d7, #092243) 6.25%, light-dark(#8cb5d9, #061e41) 18.75%, light-dark(#93b9d9, #051d3f) 31.25%, light-dark(#9bbddc, #041d3e) 43.75%, light-dark(#a4c2dc, #071d3d) 56.25%, light-dark(#b3c3ce, #212d3f) 68.75%, light-dark(#bec2b9, #40413f) 81.25%, light-dark(#b7c5cc, #272f3d) 93.75%) top / 100% 50px no-repeat, linear-gradient(to right, light-dark(#99c0e0, #0d2549) 6.25%, light-dark(#9cc2e1, #0a2447) 18.75%, light-dark(#9dc4e1, #092245) 31.25%, light-dark(#9ec4e1, #072042) 43.75%, light-dark(#a1c6e1, #0a2242) 56.25%, light-dark(#abc2d2, #2c384b) 68.75%, light-dark(#b6beb9, #525252) 81.25%, light-dark(#adc4ce, #343b49) 93.75%)",
      }}
    >
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 400 }}>
        <NotificationCenter defaultValue="notifications">
          <NotificationCenterView value="notifications">
            <NotificationCenterGroup heading="Today" onClear={() => {}}>
              <NotificationBanner app="Music" time="now" title="Every Breaking Wave">
                U2 — Songs of Innocence
              </NotificationBanner>
            </NotificationCenterGroup>
          </NotificationCenterView>
        </NotificationCenter>
      </div>
    </div>
  );
}
