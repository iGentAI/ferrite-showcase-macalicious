import { DefaultButton } from "macalicious/default-button";
import { Dialog, DialogActions, DialogClose, DialogPopup } from "macalicious/dialog";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { WindowControls } from "macalicious/window-controls";
import { useState } from "react";

/**
 * A modeless dialog, as Finder's Connect to Server: it has window controls, leaves the page
 * usable, and keeps a help button and an auxiliary button apart from the action.
 */
export default function Modeless() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen} modal={false}>
      <PushButton onClick={() => setOpen(true)}>Connect to Server…</PushButton>
      <DialogPopup
        title="Connect to Server"
        width={486}
        controls={<WindowControls zoomDisabled onClose={() => setOpen(false)} />}
      >
        <Label id="dialog-modeless-address-label" textStyle="small">
          Server Address:
        </Label>
        <TextField
          aria-labelledby="dialog-modeless-address-label"
          defaultValue="smb://server.local"
          style={{ width: "100%", marginTop: 6 }}
        />
        <DialogActions leading={<HelpButton />}>
          <PushButton>Browse</PushButton>
          <DialogClose render={<DefaultButton />}>Connect</DialogClose>
        </DialogActions>
      </DialogPopup>
    </Dialog>
  );
}
