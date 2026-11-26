import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetActions, SheetClose, SheetPopup } from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useState } from "react";

/** A sheet that asks for a value: the text field takes the focus, Return renames. */
export default function Form() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Untitled");
  const [draft, setDraft] = useState(name);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <Window state={open ? "main" : "key"} width={420} height={200}>
        <TitleBar
          ref={setTitleBar}
          title={name}
          controls={<WindowControls closeDisabled={open} />}
        />
        <WindowBody inert={open} style={{ padding: 20 }}>
          <PushButton
            onClick={() => {
              setDraft(name);
              setOpen(true);
            }}
          >
            Rename…
          </PushButton>
        </WindowBody>
      </Window>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetPopup anchor={titleBar} width={300} aria-label="Rename the document">
          <Label id="sheet-form-name-label">Name:</Label>
          <TextField
            aria-labelledby="sheet-form-name-label"
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            style={{ width: "100%", marginTop: 7.5 }}
          />
          <SheetActions>
            <SheetClose>Cancel</SheetClose>
            <SheetClose
              render={<DefaultButton />}
              disabled={draft.trim() === ""}
              onClick={() => setName(draft.trim())}
            >
              Rename
            </SheetClose>
          </SheetActions>
        </SheetPopup>
      </Sheet>
    </>
  );
}
