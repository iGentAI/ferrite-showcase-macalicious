"use client";

import { DefaultButton } from "macalicious/default-button";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { type ComponentProps, useState } from "react";
import { DriveSavePanel, saveToDrive } from "../finder/finder-file-dialogs";
import { printDocument } from "../textedit/textedit-drive";
import type { TapeLine } from "./calculator-tape";

/** The tape as a text file or a printed page: each calculation over its result. */
export const tapeTextLines = (lines: readonly TapeLine[]): string[] =>
  lines.flatMap(({ expression, result }) => [expression, `= ${result}`]);

export const printTape = (lines: readonly TapeLine[]) =>
  printDocument({ name: "Paper Tape", plain: true, lines: tapeTextLines(lines) });

export interface CalculatorTapeFileItemsProps {
  /** No lines to work on, or no tape on this build. */
  empty: boolean;
  commands: () => { clear: () => void; save: () => void; print: () => void };
}

/** Calculator's File menu rows, on the paper tape. */
export function CalculatorTapeFileItems({ empty, commands }: CalculatorTapeFileItemsProps) {
  return (
    <>
      <MenuItem disabled={empty} onClick={() => commands().clear()}>
        Clear Tape
      </MenuItem>
      <MenuItem keyEquivalent="shift+command+s" disabled={empty} onClick={() => commands().save()}>
        Save Tape As…
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="shift+command+p"
        disabled
        title="The browser's print dialog sets the page"
      >
        Page Setup…
      </MenuItem>
      <MenuItem keyEquivalent="command+p" disabled={empty} onClick={() => commands().print()}>
        Print Tape…
      </MenuItem>
    </>
  );
}

export interface TapeSaveSheetProps {
  open: boolean;
  lines: readonly TapeLine[];
  anchor: ComponentProps<typeof SheetPopup>["anchor"];
  finalFocus: ComponentProps<typeof SheetPopup>["finalFocus"];
  onClose: () => void;
}

/** File > Save Tape As: a text file on the person's drive, or a sheet that says why not. */
export function TapeSaveSheet({ open, lines, anchor, finalFocus, onClose }: TapeSaveSheetProps) {
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <>
      <Sheet open={open} onOpenChange={(next) => next || onClose()}>
        <SheetPopup anchor={anchor} width={420} finalFocus={finalFocus} aria-label="Save Tape As">
          {open ? (
            <DriveSavePanel
              defaultName="Paper Tape.txt"
              defaultFolder="documents"
              onSave={(target) => {
                onClose();
                const text = `${tapeTextLines(lines).join("\n")}\n`;
                saveToDrive(target, new Blob([text], { type: "text/plain" })).catch(
                  (error: unknown) =>
                    setFailure(error instanceof Error ? error.message : String(error)),
                );
              }}
              onCancel={onClose}
            />
          ) : null}
        </SheetPopup>
      </Sheet>
      <Sheet open={failure !== null} onOpenChange={(next) => next || setFailure(null)}>
        <SheetPopup anchor={anchor} width={340} finalFocus={finalFocus}>
          <SheetTitle>The tape could not be saved.</SheetTitle>
          <SheetDescription>{failure}</SheetDescription>
          <SheetActions>
            <SheetClose render={<DefaultButton />}>OK</SheetClose>
          </SheetActions>
        </SheetPopup>
      </Sheet>
    </>
  );
}
