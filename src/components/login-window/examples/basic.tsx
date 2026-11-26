import { LoginWindow, LoginWindowButton } from "macalicious/login-window";
import { useEffect, useRef, useState } from "react";

const users = [{ value: "mhackett", name: "mhackett" }];

/**
 * One user: the password is asked at once. Nothing is checked by the window; here any
 * password but "catalina" is rejected, after a moment in which the window is busy. `invalid`
 * is taken back with every new attempt, so that each rejection shakes the field again.
 */
export default function Basic() {
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [message, setMessage] = useState("");
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div style={{ width: 560, maxWidth: "100%", height: 520 }}>
      <LoginWindow
        users={users}
        busy={busy}
        invalid={invalid}
        hint={message}
        onSubmit={(password) => {
          const ok = password === "catalina";
          setBusy(true);
          setInvalid(false);
          timer.current = window.setTimeout(() => {
            setBusy(false);
            setInvalid(!ok);
            setMessage(ok ? "Welcome." : "Hint: the name of macOS 10.15");
          }, 600);
        }}
        onCancel={() => setMessage("Cancelled.")}
        actions={
          <LoginWindowButton onClick={() => setMessage("Cancelled.")}>Cancel</LoginWindowButton>
        }
      >
        <span>100%</span>
        <span>3:37 PM</span>
      </LoginWindow>
    </div>
  );
}
