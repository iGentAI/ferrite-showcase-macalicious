import { LoginWindow, LoginWindowButton } from "macalicious/login-window";

const users = [{ value: "mhackett", name: "mhackett" }];
const others = [{ value: "guest", name: "Guest User" }];

/**
 * The states of the prompt, side by side: a rejected password with its hint (the field shakes
 * once when `invalid` is set), a password being checked, and a disabled button.
 */
export default function States() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <div style={{ width: 300, height: 460 }}>
        <LoginWindow
          users={users}
          invalid
          hint="Hint: the name of macOS 10.15"
          actions={<LoginWindowButton>Cancel</LoginWindowButton>}
        />
      </div>
      <div style={{ width: 300, height: 460 }}>
        <LoginWindow
          users={others}
          busy
          actions={<LoginWindowButton disabled>Cancel</LoginWindowButton>}
        />
      </div>
    </div>
  );
}
