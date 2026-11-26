import { BorderlessButton } from "macalicious/borderless-button";
import { Label } from "macalicious/label";
import { useState } from "react";

/** "Details" shows the recipients and turns into "Hide". */
export default function Basic() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "grid", gap: 3, width: 280 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
        <Label truncate style={{ flex: 1 }}>
          Your order has shipped
        </Label>
        <Label>
          <BorderlessButton color="link" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Hide" : "Details"}
          </BorderlessButton>
        </Label>
      </div>
      {open ? <Label color="secondary">To: Stephen, Harbour Books</Label> : null}
    </div>
  );
}
