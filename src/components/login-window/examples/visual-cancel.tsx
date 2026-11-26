import { LoginWindow, LoginWindowButton } from "macalicious/login-window";

const users = [{ value: "mhackett", name: "mhackett" }];

/**
 * Visual comparison target: the Cancel button, 60 x 70 pt. Reference crop (2x pixels) x=1620
 * y=1840 w=120 h=140 of the Fast User Switching captures: the 39 pt disc starts 10.5 pt from
 * the left and 6.5 pt from the top, and the title's baseline is 62 pt down.
 *
 * The backdrop is the dark water measured around the button (#080c15); the picture's ripples
 * are not reproduced.
 */
export default function VisualCancel() {
  return (
    <div style={{ position: "relative", overflow: "hidden", width: 60, height: 70 }}>
      <LoginWindow
        users={users}
        actions={<LoginWindowButton>Cancel</LoginWindowButton>}
        style={{
          position: "absolute",
          left: -120,
          top: -270,
          width: 300,
          height: 400,
          background: "#080c15",
        }}
      />
    </div>
  );
}
