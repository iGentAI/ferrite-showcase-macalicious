import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useState } from "react";

export default function Basic() {
  const [open, setOpen] = useState(false);
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  return (
    <>
      {/* The window is main, not key, while its sheet is open, and its content is inert. */}
      <Window state={open ? "main" : "key"} width={420} height={220}>
        <TitleBar
          ref={setTitleBar}
          title="Untitled"
          controls={<WindowControls closeDisabled={open} />}
        />
        <WindowBody inert={open} style={{ padding: 20 }}>
          <PushButton onClick={() => setOpen(true)}>Close Document…</PushButton>
        </WindowBody>
      </Window>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetPopup anchor={titleBar} width={360}>
          <SheetTitle>Do you want to keep this new document “Untitled”?</SheetTitle>
          <SheetDescription>
            You can choose to save your changes, or delete this document immediately.
          </SheetDescription>
          <SheetActions leading={<SheetClose>Delete</SheetClose>}>
            <SheetClose>Cancel</SheetClose>
            <SheetClose render={<DefaultButton />}>Save</SheetClose>
          </SheetActions>
        </SheetPopup>
      </Sheet>
    </>
  );
}
