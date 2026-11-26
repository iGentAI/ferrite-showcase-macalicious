"use client";

import { MenuItem } from "macalicious/menu-item";
import { readBoolean, readNumber, useDesktopSetting } from "../desktop/desktop-personal";

/*
 * How the person looks at a document: the magnification of View > Zoom and Format > Wrap to Page,
 * desktop values saved with their account.
 */

const ZOOM_KEY = "textedit.zoom";
const WRAP_KEY = "textedit.wrapToPage";
const HYPHENATION_KEY = "textedit.hyphenation";

/** The magnifications View > Zoom steps through. */
export const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

const readZoom = (stored: unknown) => {
  const zoom = readNumber(stored);
  return zoom !== undefined && (ZOOMS as readonly number[]).includes(zoom) ? zoom : undefined;
};

export interface TextEditView {
  zoom: number;
  wrap: boolean;
  /** Whether words may break at line ends, Format > Allow Hyphenation. */
  hyphenation: boolean;
  /** Show the document at its actual size. */
  actualSize: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleWrap: () => void;
  toggleHyphenation: () => void;
}

/** The window's view of its document, saved with the person's account. */
export function useTextEditView(): TextEditView {
  const [zoom, setZoom] = useDesktopSetting<number>(ZOOM_KEY, readZoom, 1);
  const [wrap, setWrap] = useDesktopSetting(WRAP_KEY, readBoolean, false);
  const [hyphenation, setHyphenation] = useDesktopSetting(HYPHENATION_KEY, readBoolean, false);
  return {
    zoom,
    wrap,
    hyphenation,
    actualSize: () => setZoom(1),
    zoomIn: () => setZoom(ZOOMS.find((step) => step > zoom) ?? zoom),
    zoomOut: () => setZoom([...ZOOMS].reverse().find((step) => step < zoom) ?? zoom),
    toggleWrap: () => setWrap(!wrap),
    toggleHyphenation: () => setHyphenation(!hyphenation),
  };
}

/** The items of TextEdit's View menu that act on the document. */
export function TextEditViewItems({
  zoom,
  disabled = false,
  onActualSize,
  onZoomIn,
  onZoomOut,
}: {
  zoom: number;
  disabled?: boolean;
  onActualSize: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <>
      <MenuItem disabled={disabled || zoom === 1} keyEquivalent="command+0" onClick={onActualSize}>
        Actual Size
      </MenuItem>
      <MenuItem
        disabled={disabled || zoom === ZOOMS.at(-1)}
        keyEquivalent="shift+command+."
        onClick={onZoomIn}
      >
        Zoom In
      </MenuItem>
      <MenuItem
        disabled={disabled || zoom === ZOOMS[0]}
        keyEquivalent="shift+command+,"
        onClick={onZoomOut}
      >
        Zoom Out
      </MenuItem>
    </>
  );
}
