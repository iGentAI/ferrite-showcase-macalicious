import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { SavePanel, SavePanelRow } from "macalicious/save-panel";
import { Sheet, SheetPopup } from "macalicious/sheet";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useId, useState } from "react";

const places = [
  { value: "documents", label: "Documents" },
  { value: "desktop", label: "Desktop" },
  { value: "icloud", label: "iCloud Drive", separatorBefore: true },
];

/**
 * The Save panel as AppKit presents it: in a sheet on the document's window. The window is
 * main, not key, while its sheet is open. Return saves and Escape cancels.
 */
export default function Basic() {
  const [open, setOpen] = useState(false);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const [saved, setSaved] = useState("Untitled");
  const format = useId();
  return (
    <>
      <Window state={open ? "main" : "key"} width={420} height={260}>
        <TitleBar
          ref={setTitleBar}
          title={saved}
          controls={<WindowControls closeDisabled={open} />}
        />
        <WindowBody inert={open} style={{ padding: 20 }}>
          <PushButton onClick={() => setOpen(true)}>Save…</PushButton>
        </WindowBody>
      </Window>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetPopup anchor={titleBar} width={440} aria-label="Save">
          <SavePanel
            locations={places}
            defaultLocation="documents"
            onCancel={() => setOpen(false)}
            onSave={({ name }) => {
              setSaved(name);
              setOpen(false);
            }}
            accessory={
              <SavePanelRow label="File Format:" labelId={format}>
                <PopUpButton aria-labelledby={format} defaultValue="rtf" style={{ width: 252 }}>
                  <PopUpButtonItem value="rtf">Rich Text Document</PopUpButtonItem>
                  <PopUpButtonItem value="txt">Plain Text</PopUpButtonItem>
                  <PopUpButtonItem value="html">Web Page (.html)</PopUpButtonItem>
                </PopUpButton>
              </SavePanelRow>
            }
          />
        </SheetPopup>
      </Sheet>
    </>
  );
}
