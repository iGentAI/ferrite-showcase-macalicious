import { DefaultButton } from "macalicious/default-button";
import { Dialog, DialogActions, DialogClose, DialogPopup } from "macalicious/dialog";
import { Label } from "macalicious/label";
import { TextField } from "macalicious/text-field";
import { type CSSProperties, useState } from "react";

/**
 * Visual comparison target: Finder's Go to Folder dialog, the whole window capture with its
 * shadow (1082 x 516 px, 541 x 258 pt; the frame is 429 x 146 pt at 56, 38).
 *
 * The dialog is rendered into this box instead of the document body, so that it is part of the
 * capture, and placed where the capture has it. The capture's field is a combo box, which
 * belongs to another batch: a text field stands in and the comparisons mask it. The dark
 * capture's window background is the tinted #303031, not the catalog window colour.
 */
export default function VisualGoToFolder() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={
        {
          position: "relative",
          width: 541,
          height: 258,
          overflow: "hidden",
          background: "white",
          "--mac-color-window-background": "light-dark(#ececec, #303031)",
        } as CSSProperties
      }
    >
      <Dialog defaultOpen modal={false}>
        <DialogPopup
          title="Go to Folder"
          width={429}
          container={stage}
          style={
            {
              position: "absolute",
              left: 56,
              margin: 0,
              "--mac-dialog-top": "38px",
            } as CSSProperties
          }
        >
          <Label id="visual-go-to-folder-label">Go to the folder:</Label>
          <TextField
            aria-labelledby="visual-go-to-folder-label"
            defaultValue="~/Documents/"
            style={{ width: "100%", marginTop: 7.5 }}
          />
          <DialogActions>
            <DialogClose>Cancel</DialogClose>
            <DialogClose render={<DefaultButton />}>Go</DialogClose>
          </DialogActions>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
