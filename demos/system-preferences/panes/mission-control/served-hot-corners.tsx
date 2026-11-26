"use client";

import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { type CSSProperties, useId, useState } from "react";
import { PaneChoice } from "../../choice";
import { HOT_CORNER_ACTIONS, HOT_CORNERS, hotCornerKey, NO_ACTION } from "./hot-corners";

function Corner({ corner, label }: { corner: (typeof HOT_CORNERS)[number][0]; label: string }) {
  const id = useId();
  return (
    <div className="mac-system-preferences-hot-corner">
      <Label id={id} textStyle="small">
        {label}
      </Label>
      <PaneChoice
        setting={hotCornerKey(corner)}
        options={HOT_CORNER_ACTIONS}
        initial={NO_ACTION}
        width={180}
        aria-labelledby={id}
      />
    </div>
  );
}

/** Hot Corners… on the served desktop: a panel over the pane, as a Mac's sheet comes down over it. */
export function HotCornersButton({ style }: { style?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PushButton style={style} onClick={() => setOpen(true)}>
        Hot Corners…
      </PushButton>
      {open ? (
        <div
          role="dialog"
          aria-label="Active Screen Corners"
          className="mac-system-preferences-hot-corners"
        >
          <Label textStyle="emphasized">Active Screen Corners</Label>
          <div className="mac-system-preferences-hot-corners-grid">
            {HOT_CORNERS.map(([corner, label]) => (
              <Corner key={corner} corner={corner} label={label} />
            ))}
          </div>
          <Label textStyle="small">
            A web page sees only its own pointer, so these are the corners of this page, not of your
            screen.
          </Label>
          <DefaultButton onClick={() => setOpen(false)}>OK</DefaultButton>
        </div>
      ) : null}
    </>
  );
}
