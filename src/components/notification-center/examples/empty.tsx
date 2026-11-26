import {
  NotificationCenter,
  NotificationCenterEmpty,
  NotificationCenterView,
} from "macalicious/notification-center";

/** The Notifications view with nothing delivered, and a footer without buttons. */
export default function Empty() {
  return (
    <div
      style={{
        display: "flex",
        height: 260,
        justifyContent: "flex-end",
        background: "linear-gradient(light-dark(#7fb0dc, #0b2145), light-dark(#b9c6c4, #233349))",
      }}
    >
      <NotificationCenter defaultValue="notifications">
        <NotificationCenterView value="today" />
        <NotificationCenterView value="notifications">
          <NotificationCenterEmpty>No Notifications</NotificationCenterEmpty>
        </NotificationCenterView>
      </NotificationCenter>
    </div>
  );
}
