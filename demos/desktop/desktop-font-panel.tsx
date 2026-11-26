"use client";

import { FontPanel, type FontPanelProps } from "macalicious/font-panel";
import { useEffect, useMemo, useState } from "react";
import { familiesWith, refreshFontPanelFonts, useFontPanelFonts } from "./desktop-font-panel-fonts";
import { familyRenders, firstFamily } from "./font-family-check";

/** Why a family is dimmed: the computer showing the page has no font of that name. */
export const NOT_INSTALLED =
  "Dimmed families are not installed on this computer: text set in them would show in another font.";

type Dimmed = NonNullable<FontPanelProps["dimmedFamilies"]>;
const NONE: Dimmed = [];

/**
 * The families of `families` the browser showing the page has no font for (text set in them
 * measures as in a generic fallback, `font-family-check.ts`), each with the reason, measured once
 * the panel is shown. A document that cannot measure (jsdom) dims none.
 */
export function useDimmedFamilies(families: FontPanelProps["families"]): Dimmed {
  const [dimmed, setDimmed] = useState<Dimmed>(NONE);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const absent = families
      .filter((each) => familyRenders(firstFamily(each.css), document) === false)
      .map((each) => ({ name: each.name, reason: NOT_INSTALLED }));
    setDimmed(absent.length > 0 ? absent : NONE);
  }, [families]);
  return dimmed;
}

/**
 * The Fonts panel of the desktop's editors (Notes, TextEdit, Stickies). They list Catalina's
 * families, which the desktop does not serve: the families the browser has no font for are
 * dimmed, cannot be chosen, and the panel says why, so that no family is offered whose text would
 * show in another font. The library's `FontPanel` dims what it is given and measures nothing.
 * Font Book's changes reach every panel here (`desktop-font-panel-fonts.ts`).
 */
export function DesktopFontPanel({
  families: given,
  ...props
}: Omit<FontPanelProps, "dimmedFamilies">) {
  const fonts = useFontPanelFonts();
  const families = useMemo(() => familiesWith(given, fonts), [given, fonts]);
  useEffect(() => refreshFontPanelFonts(), []);
  const dimmed = useDimmedFamilies(families);
  return <FontPanel {...props} families={families} dimmedFamilies={dimmed} />;
}
