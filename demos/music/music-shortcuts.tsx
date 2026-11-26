"use client";

import { DefaultButton } from "macalicious/default-button";
import { parseMenuKeyEquivalent } from "macalicious/lib/menu-key-equivalent";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";

/** One command and its key equivalent. */
export interface MusicShortcut {
  title: string;
  key: string;
}

/** Help > Keyboard Shortcuts: the menus' key equivalents, read from the commands they run. */
export function MusicShortcuts({
  anchor,
  shortcuts,
  onClose,
}: {
  anchor: Element | null;
  shortcuts: readonly MusicShortcut[];
  onClose: () => void;
}) {
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetPopup anchor={anchor} width={340} aria-label="Keyboard Shortcuts">
        <SheetTitle>Keyboard Shortcuts</SheetTitle>
        <dl className="mac-music-shortcuts">
          {shortcuts.map(({ title, key }) => {
            const { modifiers, key: character } = parseMenuKeyEquivalent(key);
            return (
              <div key={key}>
                <dt>{title}</dt>
                <dd>
                  {modifiers}
                  {character}
                </dd>
              </div>
            );
          })}
        </dl>
        <SheetActions>
          <SheetClose render={<DefaultButton />}>Done</SheetClose>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
