import { LoginWindow } from "macalicious/login-window";

const users = [{ value: "mhackett", name: "mhackett" }];

/**
 * Visual comparison target: the empty password field, 160 x 28 pt, exactly its own box.
 * Reference crop (2x pixels) x=1520 y=1022 w=320 h=56 of the Fast User Switching captures,
 * which show the same screen in a light and in a dark session.
 *
 * The field blurs the desktop picture, which is not reproduced: the gradient behind it is the
 * colour that, under the field's material, gives the colours measured at its two ends (dark
 * rock, lighter towards the right). The crop stops at the field's edge because the rock
 * around it cannot be matched; the four corners therefore show the placeholder backdrop.
 */
export default function VisualField() {
  return (
    <div style={{ position: "relative", overflow: "hidden", width: 160, height: 28 }}>
      <LoginWindow
        users={users}
        style={{
          position: "absolute",
          left: -120,
          top: -186,
          width: 400,
          height: 400,
          background: "linear-gradient(to right, #352623 30%, #4a352e 70%)",
        }}
      />
    </div>
  );
}
