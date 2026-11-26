import { NotificationCenter, NotificationCenterView } from "macalicious/notification-center";

/**
 * Visual comparison target: the footer of Notification Center, its divider, the Edit button
 * and the gear. Reference crop (2x pixels) x=2672 y=2008 w=688 h=92 of the
 * Notification-Center-Today captures, the last 46 pt of the screen.
 *
 * The gradient behind the panel stands in for what the footer blurs there: the desktop
 * picture and the end of the Dock.
 */
export default function VisualFooter() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 344,
        height: 46,
        background:
          "linear-gradient(to right, light-dark(#506377, #313e4c) 6.25%, light-dark(#425671, #233245) 18.75%, light-dark(#465870, #263447) 31.25%, light-dark(#697a8e, #313e4c) 43.75%, light-dark(#4f6378, #242f3e) 56.25%, light-dark(#1a3149, #0e1a2a) 68.75%, light-dark(#0d243d, #0b1726) 81.25%, light-dark(#0c243b, #0a1725) 93.75%)",
      }}
    >
      <div style={{ position: "absolute", inset: "auto 0 0 0", height: 300 }}>
        <NotificationCenter editLabel="Edit" onSettings={() => {}}>
          <NotificationCenterView value="today" />
        </NotificationCenter>
      </div>
    </div>
  );
}
