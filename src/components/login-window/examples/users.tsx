import { LoginWindow, LoginWindowButton } from "macalicious/login-window";
import { useState } from "react";

const users = [
  { value: "ada", name: "Ada" },
  { value: "grace", name: "Grace" },
  { value: "guest", name: "Guest User" },
];

/**
 * Several users: the window lists them, and asks for the password of the one that is chosen.
 * Escape returns to the list. The buttons of the login window after a start are Sleep,
 * Restart and Shut Down.
 */
export default function Users() {
  const [message, setMessage] = useState("");
  return (
    <div style={{ width: 640, maxWidth: "100%", height: 520 }}>
      <LoginWindow
        users={users}
        hint={message}
        onValueChange={() => setMessage("")}
        onSubmit={(_password, user) => setMessage(`Checking the password of ${user}.`)}
        actions={
          <>
            <LoginWindowButton glyph="sleep">Sleep</LoginWindowButton>
            <LoginWindowButton glyph="restart">Restart</LoginWindowButton>
            <LoginWindowButton glyph="shut-down">Shut Down</LoginWindowButton>
          </>
        }
      />
    </div>
  );
}
