import { PushButton } from "macalicious/push-button";
import { useState } from "react";

/**
 * A first page: a Catalina dialog made of tokens and two push buttons. The surface is a plain
 * element; everything that makes it look like a window is a token.
 */
export default function FirstPage() {
  const [answer, setAnswer] = useState("Nothing chosen yet.");

  return (
    <section
      aria-label="Go to the folder"
      style={{
        width: 320,
        padding: "var(--mac-space-window-margin)",
        borderRadius: "var(--mac-radius-window)",
        background: "var(--mac-color-window-background)",
        boxShadow: "var(--mac-shadow-window)",
        color: "var(--mac-color-label)",
        font: "var(--mac-font-body)",
      }}
    >
      <p style={{ margin: 0 }}>Go to the folder?</p>
      <p
        role="status"
        style={{
          margin: "4px 0 16px",
          color: "var(--mac-color-label-secondary)",
          font: "var(--mac-font-subheadline)",
        }}
      >
        {answer}
      </p>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--mac-space-control-gap)",
        }}
      >
        <PushButton onClick={() => setAnswer("Cancelled.")}>Cancel</PushButton>
        <PushButton variant="primary" onClick={() => setAnswer("Going.")}>
          Go
        </PushButton>
      </div>
    </section>
  );
}
