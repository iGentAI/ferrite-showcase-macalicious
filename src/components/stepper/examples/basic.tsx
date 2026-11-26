import { Stepper } from "macalicious/stepper";
import { useId, useState } from "react";

export default function Basic() {
  const [copies, setCopies] = useState(1);
  // The page can show this example more than once, so the label's id is generated.
  const labelId = useId();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span id={labelId} style={{ font: "var(--mac-font-control-regular)", marginRight: 4 }}>
        Copies:
      </span>
      <output
        style={{
          font: "var(--mac-font-control-regular)",
          minWidth: 24,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {copies}
      </output>
      <Stepper
        aria-labelledby={labelId}
        value={copies}
        onValueChange={setCopies}
        min={1}
        max={99}
      />
    </div>
  );
}
