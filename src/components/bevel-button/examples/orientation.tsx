import { BevelButton, BevelButtonGroup } from "macalicious/bevel-button";
import { useState } from "react";

/* Stand-in pictograms drawn for this example: a page, upright and on its side. */
function Page({ landscape = false }: { landscape?: boolean }) {
  return (
    <svg viewBox="0 0 26 26" width="26" height="26" aria-hidden="true" focusable="false">
      <rect
        x={landscape ? 3.5 : 6.5}
        y={landscape ? 6.5 : 3.5}
        width={landscape ? 19 : 13}
        height={landscape ? 13 : 19}
        fill="none"
        stroke="currentColor"
      />
      <circle cx="13" cy="10.5" r="2" fill="currentColor" />
      <path d="M11 13.5h4v5h-4z" fill="currentColor" />
    </svg>
  );
}

/**
 * The Orientation pair of the Print dialog: exactly one of the two is on. The group reports an
 * empty value when the button that is on is clicked again; ignoring it keeps one on.
 */
export default function Orientation() {
  const [value, setValue] = useState(["portrait"]);
  return (
    <BevelButtonGroup
      aria-label="Orientation"
      value={value}
      onValueChange={(next) => {
        if (next.length > 0) setValue(next);
      }}
    >
      <BevelButton value="portrait" aria-label="Portrait">
        <Page />
      </BevelButton>
      <BevelButton value="landscape" aria-label="Landscape">
        <Page landscape />
      </BevelButton>
    </BevelButtonGroup>
  );
}
