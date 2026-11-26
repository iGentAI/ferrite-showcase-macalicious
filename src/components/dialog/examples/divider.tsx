import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { Dialog, DialogActions, DialogClose, DialogPopup, DialogTrigger } from "macalicious/dialog";
import { HelpButton } from "macalicious/help-button";
import { PushButton } from "macalicious/push-button";
import type { CSSProperties } from "react";

/**
 * The button row of a preferences-style dialog, as in Music: a line from edge to edge above it,
 * help at the left, and Cancel and OK at their narrower 69 pt.
 */
export default function Divider() {
  return (
    <Dialog>
      <DialogTrigger render={<PushButton />}>Playback Options…</DialogTrigger>
      <DialogPopup title="Playback" width={360}>
        <div style={{ display: "grid", gap: 6, paddingBottom: 20 }}>
          <Checkbox defaultChecked>Crossfade songs</Checkbox>
          <Checkbox>Sound Enhancer</Checkbox>
          <Checkbox defaultChecked>Sound Check</Checkbox>
        </div>
        <DialogActions
          divider
          leading={<HelpButton />}
          style={{ "--mac-dialog-button-min-width": "70px" } as CSSProperties}
        >
          <DialogClose>Cancel</DialogClose>
          <DialogClose render={<DefaultButton />}>OK</DialogClose>
        </DialogActions>
      </DialogPopup>
    </Dialog>
  );
}
