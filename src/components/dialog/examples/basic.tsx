import { DefaultButton } from "macalicious/default-button";
import { Dialog, DialogActions, DialogClose, DialogPopup, DialogTrigger } from "macalicious/dialog";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";

export default function Basic() {
  return (
    <Dialog>
      <DialogTrigger render={<PushButton />}>Go to Folder…</DialogTrigger>
      <DialogPopup title="Go to Folder" width={429}>
        <Label id="dialog-basic-folder-label">Go to the folder:</Label>
        <TextField
          aria-labelledby="dialog-basic-folder-label"
          defaultValue="~/Documents/"
          style={{ width: "100%", marginTop: 7.5 }}
        />
        <DialogActions>
          <DialogClose>Cancel</DialogClose>
          <DialogClose render={<DefaultButton />}>Go</DialogClose>
        </DialogActions>
      </DialogPopup>
    </Dialog>
  );
}
