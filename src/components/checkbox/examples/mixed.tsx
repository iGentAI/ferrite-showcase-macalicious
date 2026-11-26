import { Checkbox } from "macalicious/checkbox";
import { useState } from "react";

const UPDATES = [
  "Check for updates",
  "Download new updates when available",
  "Install macOS updates",
  "Install app updates from the App Store",
];

/**
 * A parent checkbox shows the mixed state while its children differ, as "Automatically keep my
 * Mac up to date" does in Software Update. Dependent checkboxes are indented 26 pt under the
 * parent's title.
 */
export default function Mixed() {
  const [checked, setChecked] = useState([true, true, false, false]);
  const count = checked.filter(Boolean).length;

  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
      <Checkbox
        checked={count === UPDATES.length}
        indeterminate={count > 0 && count < UPDATES.length}
        onCheckedChange={(next) => setChecked(UPDATES.map(() => next))}
      >
        Automatically keep my Mac up to date
      </Checkbox>
      {UPDATES.map((title, index) => (
        <Checkbox
          key={title}
          style={{ marginInlineStart: 26 }}
          checked={checked[index]}
          onCheckedChange={(next) =>
            setChecked((current) => current.map((value, i) => (i === index ? next : value)))
          }
        >
          {title}
        </Checkbox>
      ))}
    </div>
  );
}
