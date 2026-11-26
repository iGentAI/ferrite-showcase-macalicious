import { Label } from "macalicious/label";
import { TokenFieldCompletions } from "macalicious/token-field-completions";
import { useState } from "react";

const PEOPLE = ["Stephen Hackett", "Stephanie Lee", "Myke Hurley", "Federico Viticci"];

/**
 * The address field of a Mail message header: no bezel, tokens with a menu chevron, the
 * recipients held by the application.
 */
export default function Mail() {
  const [recipients, setRecipients] = useState(["Stephen Hackett"]);
  return (
    <div style={{ width: 360, minHeight: 120 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 4,
          padding: "4px 8px",
          background: "var(--mac-color-text-background)",
        }}
      >
        {/* biome-ignore lint/a11y/noLabelWithoutControl: the label names the input through htmlFor */}
        <Label render={<label htmlFor="token-field-completions-mail" />} color="secondary">
          To:
        </Label>
        <TokenFieldCompletions
          id="token-field-completions-mail"
          bordered={false}
          tokenMenu
          tokensLabel="Recipients"
          completions={PEOPLE}
          value={recipients}
          onValueChange={setRecipients}
          style={{ flex: 1, width: "auto" }}
        />
      </div>
    </div>
  );
}
