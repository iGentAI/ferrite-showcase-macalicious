import { Label } from "macalicious/label";
import { TokenField } from "macalicious/token-field";
import { useState } from "react";

/**
 * The address field of a Mail message header: no bezel, tokens with a menu chevron. The
 * example shows which token's menu was asked for; an application opens a menu there.
 */
export default function Recipients() {
  const [recipients, setRecipients] = useState(["Stephen Hackett"]);
  const [asked, setAsked] = useState("");
  return (
    <div style={{ display: "grid", gap: 8, width: 360 }}>
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
        <Label render={<label htmlFor="token-field-recipients" />} color="secondary">
          To:
        </Label>
        <TokenField
          id="token-field-recipients"
          bordered={false}
          tokenMenu
          tokensLabel="Recipients"
          value={recipients}
          onValueChange={setRecipients}
          onTokenMenu={(token) => setAsked(token)}
          style={{ flex: 1, width: "auto" }}
        />
      </div>
      <Label textStyle="small" color="secondary" role="status">
        {asked
          ? `Menu asked for: ${asked}`
          : "Click a chevron, or press Space on a selected token."}
      </Label>
    </div>
  );
}
