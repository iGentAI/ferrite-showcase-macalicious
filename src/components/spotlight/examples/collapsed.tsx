import { Spotlight } from "macalicious/spotlight";
import { useState } from "react";

/**
 * The window before anything is typed: the field alone. Escape in the empty field asks to
 * close it; here that is only counted.
 */
export default function Collapsed() {
  const [closed, setClosed] = useState(0);
  return (
    <div style={{ padding: 24, background: "light-dark(#8f8a7c, #1c2733)" }}>
      <Spotlight onClose={() => setClosed((count) => count + 1)} style={{ maxWidth: "100%" }} />
      <p style={{ margin: "12px 0 0", color: "light-dark(#ffffff, #d0d0d0)" }}>
        Asked to close {closed} {closed === 1 ? "time" : "times"}.
      </p>
    </div>
  );
}
