"use client";

import { cn } from "macalicious/lib/cn";
import {
  Spotlight,
  SpotlightGroup,
  type SpotlightProps,
  SpotlightResult,
} from "macalicious/spotlight";
import { useEffect, useMemo, useRef, useState } from "react";
import { SpotlightArtwork } from "./spotlight-artwork";
import { defaultItems, type SpotlightItem, search, topHitOf } from "./spotlight-data";
import { SpotlightPreviewPane } from "./spotlight-preview";
import "./spotlight.tokens.css";
import "./spotlight.css";

/** The props of the library's window that the demo fills in itself. */
type Managed =
  | "children"
  | "value"
  | "defaultValue"
  | "onValueChange"
  | "selectedValue"
  | "defaultSelectedValue"
  | "onSelectedValueChange"
  | "onOpenResult"
  | "onClose"
  | "completion"
  | "topHit"
  | "preview"
  | "inputRef";

export interface CatalinaSpotlightProps extends Omit<SpotlightProps, Managed> {
  /**
   * The index that is searched: `defaultItems`, the Mac of the Aqua capture, or
   * `developerItems`, the Mac of the Dark Aqua capture, or a list of your own.
   * @default defaultItems
   */
  items?: readonly SpotlightItem[];
  /**
   * The text in the field when the window is first shown. A window that is opened again
   * starts empty.
   * @default ""
   */
  defaultQuery?: string;
  /**
   * Called with the text of the field when the user changes it: typing, Escape in a field
   * with text, a cross-reference. Not called when a closed window drops its text.
   */
  onQueryChange?: (query: string) => void;
  /** Whether the window is shown, when the host controls it. A closed window renders nothing. */
  open?: boolean;
  /**
   * Whether the window is shown at first, when it keeps that itself.
   * @default true
   */
  defaultOpen?: boolean;
  /**
   * Called with `false` when the window closes itself: after it opened a result, and on
   * Escape in the empty field. A host puts the keyboard focus back where it was.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Called with the selected result when it is opened: Return or a double click. `reveal` is
   * true for Command-Return, which shows the item in the Finder instead. The window closes
   * afterwards; nothing is opened by the demo itself.
   */
  onOpenItem?: (item: SpotlightItem, details: { reveal: boolean }) => void;
}

/**
 * Spotlight of macOS 10.15 over a small index of the demo's own. Typing searches the index
 * and groups what is found by kind; the top hit is selected, names the completion behind the
 * typed text and puts its icon at the end of the field; the arrow keys move the selection and
 * the preview follows it; Return opens the selection and closes the window; Escape clears the
 * field, then closes the window; an empty field is the window's collapsed form.
 *
 * The root is the library's `Spotlight`, which takes every prop that is not listed here, so
 * the host places the window with `style` or `className`.
 */
export function CatalinaSpotlight({
  items = defaultItems,
  defaultQuery = "",
  onQueryChange,
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  onOpenItem,
  className,
  ...props
}: CatalinaSpotlightProps) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const open = openProp ?? ownOpen;
  const [query, setQuery] = useState(defaultQuery);
  // The result the user moved the selection to; null stands for the top hit.
  const [picked, setPicked] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // A window that was closed, by itself or by its host, starts empty when it is shown again.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setQuery("");
      setPicked(null);
    }
  }

  // Opening the window is asking to type: the field takes the keyboard. Not on the first
  // render, where a window that is simply part of the page leaves the focus alone.
  const shown = useRef(open);
  useEffect(() => {
    if (open && !shown.current) input.current?.focus();
    shown.current = open;
  }, [open]);

  const groups = useMemo(() => search(items, query), [items, query]);
  const results = groups.flatMap((group) => group.results);
  const topHit = topHitOf(groups);
  const selected = results.find((item) => item.id === picked) ?? topHit;

  // Whatever changes the text searches again, and the new top hit is selected.
  const type = (next: string) => {
    setQuery(next);
    setPicked(null);
    if (next !== query) onQueryChange?.(next);
  };
  const close = () => {
    setOwnOpen(false);
    onOpenChange?.(false);
  };

  if (!open) return null;

  return (
    <Spotlight
      className={cn("mac-spotlight-app", className)}
      {...props}
      inputRef={input}
      value={query}
      onValueChange={type}
      selectedValue={selected?.id ?? null}
      onSelectedValueChange={setPicked}
      onOpenResult={(value, details) => {
        const item = results.find((result) => result.id === value);
        if (!item) return;
        onOpenItem?.(item, details);
        close();
      }}
      onClose={close}
      completion={topHit?.name}
      topHit={topHit ? <SpotlightArtwork category={topHit.category} size="top-hit" /> : undefined}
      preview={
        selected ? (
          <SpotlightPreviewPane
            item={selected}
            onSee={(phrase) => {
              // The cross-reference goes with the entry it was in: the field takes the focus.
              type(phrase);
              input.current?.focus();
            }}
          />
        ) : undefined
      }
    >
      {groups.map((group) => (
        <SpotlightGroup key={group.category} label={group.label}>
          {group.results.map((item) => (
            <SpotlightResult
              key={item.id}
              value={item.id}
              icon={<SpotlightArtwork category={item.category} />}
            >
              {item.name}
            </SpotlightResult>
          ))}
        </SpotlightGroup>
      ))}
    </Spotlight>
  );
}
