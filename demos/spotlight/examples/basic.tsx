import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { useRef, useState } from "react";
import { CatalinaSpotlight } from "../spotlight";

/**
 * Spotlight over the demo's index, on a backdrop for its material to blur. Type to search
 * ("cal", "license", "aqua"), move the selection with the arrow keys, press Return to open
 * the selection or Escape to clear the field and then close the window. The button opens it
 * again, and the line beside it reports what the window told its host.
 */
export default function Basic() {
  const [open, setOpen] = useState(true);
  const [last, setLast] = useState("nothing yet");
  const button = useRef<HTMLButtonElement>(null);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        className="mac-spotlight-app-example-backdrop"
        style={{ boxSizing: "border-box", height: 470, padding: 20, overflow: "hidden" }}
      >
        <CatalinaSpotlight
          open={open}
          defaultQuery="OS X"
          onOpenItem={(item, { reveal }) =>
            setLast(`${reveal ? "revealed" : "opened"} ${item.name} (${item.kind})`)
          }
          onOpenChange={(next) => {
            setOpen(next);
            // The window is gone: the keyboard goes back to what opens it.
            button.current?.focus();
          }}
          style={{ maxWidth: "100%", marginInline: "auto" }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <PushButton ref={button} onClick={() => setOpen((shown) => !shown)}>
          {open ? "Close Spotlight" : "Open Spotlight"}
        </PushButton>
        <Label color="secondary" role="status">
          Last result: {last}
        </Label>
      </div>
    </div>
  );
}
