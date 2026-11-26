import {
  NotificationCenter,
  NotificationCenterGroup,
  NotificationCenterView,
} from "macalicious/notification-center";
import { Switch } from "macalicious/switch";
import { TodayWidget, TodayWidgetRow } from "macalicious/today-widget";

/**
 * Visual comparison target: the top 160 pt of Notification Center's Today view, the header
 * with "Today" selected and the card of switches. Reference crop (2x pixels) x=2672 y=44
 * w=688 h=320 of the Notification-Center-Today captures.
 *
 * The panel blurs the desktop picture, which is not reproduced: the gradient behind the panel
 * is the colour that, under the panel's material, gives the panel colours measured along two
 * rows, one through the header and one between the header and the first card (sky at the left,
 * the sun's glow at the right).
 *
 * Both views are kept mounted, as an application does to keep a view's scroll position: the
 * one that is not shown must take no room, and the comparisons fail if it does.
 */
export default function VisualToday() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 344,
        height: 160,
        background:
          "linear-gradient(to right, light-dark(#85b1d7, #092243) 6.25%, light-dark(#8cb5d9, #061e41) 18.75%, light-dark(#93b9d9, #051d3f) 31.25%, light-dark(#9bbddc, #041d3e) 43.75%, light-dark(#a4c2dc, #071d3d) 56.25%, light-dark(#b3c3ce, #212d3f) 68.75%, light-dark(#bec2b9, #40413f) 81.25%, light-dark(#b7c5cc, #272f3d) 93.75%) top / 100% 50px no-repeat, linear-gradient(to right, light-dark(#99c0e0, #0d2549) 6.25%, light-dark(#9cc2e1, #0a2447) 18.75%, light-dark(#9dc4e1, #092245) 31.25%, light-dark(#9ec4e1, #072042) 43.75%, light-dark(#a1c6e1, #0a2242) 56.25%, light-dark(#abc2d2, #2c384b) 68.75%, light-dark(#b6beb9, #525252) 81.25%, light-dark(#adc4ce, #343b49) 93.75%)",
      }}
    >
      <div style={{ position: "absolute", inset: "0 0 auto 0", height: 400 }}>
        <NotificationCenter>
          <NotificationCenterView value="today" keepMounted>
            <TodayWidget aria-label="Quick settings">
              <TodayWidgetRow label="Night Shift">
                <Switch />
              </TodayWidgetRow>
              <TodayWidgetRow label="Do Not Disturb">
                <Switch />
              </TodayWidgetRow>
            </TodayWidget>
          </NotificationCenterView>
          <NotificationCenterView value="notifications" keepMounted>
            <NotificationCenterGroup heading="Today" onClear={() => {}} />
          </NotificationCenterView>
        </NotificationCenter>
      </div>
    </div>
  );
}
