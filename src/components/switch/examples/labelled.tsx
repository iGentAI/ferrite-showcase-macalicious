"use client";

import { Switch } from "macalicious/switch";
import { useId, useState } from "react";

/**
 * A switch has no title of its own. Give it a `<label>`: `id` goes to the switch's input, so
 * `htmlFor` names it and a click on the text toggles it. Controlled here, to show the state.
 */
export default function Labelled() {
  const id = useId();
  const [on, setOn] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: 220 }}>
      <label htmlFor={id} style={{ flex: 1, font: "var(--mac-font-body)" }}>
        Do Not Disturb
      </label>
      <Switch id={id} checked={on} onCheckedChange={setOn} />
      <span style={{ font: "var(--mac-font-label)", color: "var(--mac-color-label-secondary)" }}>
        {on ? "On" : "Off"}
      </span>
    </div>
  );
}
