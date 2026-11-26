import { DefaultButton } from "macalicious/default-button";
import { Dialog, DialogActions, DialogClose, DialogPopup } from "macalicious/dialog";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { WindowControls } from "macalicious/window-controls";
import { type CSSProperties, useState } from "react";

/**
 * Visual comparison target: Finder's Connect to Server dialog, the whole window capture with
 * its shadow (1196 x 686 px, 598 x 343 pt; the frame is 486 x 231 pt at 56, 38). It is the
 * modeless kind: window controls with the zoom button disabled, a help button and an auxiliary
 * button at the leading end of the row, and buttons 72 pt and 79 pt wide.
 *
 * The dialog is rendered into this box instead of the document body, so that it is part of the
 * capture, and placed where the capture has it. The capture's address field is a combo box,
 * its list a list of favourite servers and the control under the list a segmented add, remove
 * and action control: they are other components, so a text field and two empty boxes of their
 * sizes stand in and the comparisons mask them. The dark capture's window background is the
 * tinted #303031, not the catalog window colour.
 */
export default function VisualConnectToServer() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={
        {
          position: "relative",
          width: 598,
          height: 343,
          overflow: "hidden",
          background: "white",
          "--mac-color-window-background": "light-dark(#ececec, #303031)",
        } as CSSProperties
      }
    >
      <Dialog defaultOpen modal={false}>
        <DialogPopup
          title="Connect to Server"
          width={486}
          container={stage}
          controls={<WindowControls zoomDisabled />}
          style={
            {
              position: "absolute",
              left: 56,
              margin: 0,
              "--mac-dialog-top": "38px",
            } as CSSProperties
          }
        >
          <TextField
            aria-label="Server Address"
            defaultValue="smb://castle.local"
            style={{ width: "100%", marginTop: -0.5 }}
          />
          <Label style={{ display: "block", marginTop: 11.5 }}>Favorite Servers:</Label>
          {/* Room for the list of favourite servers: 446 x 87 pt, 95 pt under the frame's top. */}
          <div style={{ height: 87, marginTop: 6 }} />
          <DialogActions
            // Room for the segmented add, remove and action control, then the help button.
            leading={
              <>
                <div style={{ width: 99, height: 21 }} />
                <HelpButton />
              </>
            }
            style={{ marginTop: 8, "--mac-dialog-button-min-width": "72px" } as CSSProperties}
          >
            <PushButton>Browse</PushButton>
            <DialogClose render={<DefaultButton />} style={{ minWidth: 80 }}>
              Connect
            </DialogClose>
          </DialogActions>
        </DialogPopup>
      </Dialog>
    </div>
  );
}
