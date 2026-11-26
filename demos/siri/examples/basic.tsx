import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { useEffect, useRef, useState } from "react";
import { SiriAssistant } from "../siri";

/**
 * Type a request, click the question mark for examples to choose from, or click the orb: it
 * listens for a moment and then answers the next request of its list. The close button and
 * Escape close the window, and the button above it asks Siri again. The grey behind the window
 * stands in for a desktop: the window is translucent.
 */
export default function Basic() {
  const [open, setOpen] = useState(true);
  const [last, setLast] = useState("nothing yet");
  const button = useRef<HTMLElement>(null);
  // The window takes the keyboard when it is shown again; hand it back when it goes.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) button.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <PushButton ref={button} disabled={open} onClick={() => setOpen(true)}>
        Ask Siri
      </PushButton>
      <div
        style={{
          display: "flex",
          boxSizing: "border-box",
          width: "100%",
          maxWidth: 480,
          height: 644,
          justifyContent: "flex-end",
          padding: 22,
          borderRadius: 6,
          background: "#757575",
        }}
      >
        <SiriAssistant
          open={open}
          onOpenChange={setOpen}
          typeToSiri
          onAnswer={(request) => setLast(request.phrase)}
        />
      </div>
      <Label color="secondary" role="status">
        Last request answered: {last}
      </Label>
    </div>
  );
}
