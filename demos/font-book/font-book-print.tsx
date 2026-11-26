"use client";

import { DefaultButton } from "macalicious/default-button";
import { Form, FormRow } from "macalicious/form";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { useState } from "react";
import { printDocument } from "../textedit/textedit-drive";
import {
  type FontFamily,
  type FontStyle,
  REPERTOIRE_SHOWN,
  repertoireOf,
  sampleOf,
} from "./font-book-data";

/*
 * File > Print's reports, as Font Book's Print dialog offers them: Catalog, a line of each style in
 * its own font; Repertoire, every character a family has; Waterfall, a sample at growing sizes. Each
 * is a page the browser prints, through TextEdit's print frame.
 */

export type FontReport = "catalog" | "repertoire" | "waterfall";

const REPORTS: readonly [FontReport, string][] = [
  ["catalog", "Catalog"],
  ["repertoire", "Repertoire"],
  ["waterfall", "Waterfall"],
];

export const readReport = (stored: unknown): FontReport | undefined =>
  REPORTS.find(([report]) => report === stored)?.[0];

const WATERFALL_SIZES = [9, 12, 18, 24, 36, 48];

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fontStyleOf(family: FontFamily, style: FontStyle, size: number): string {
  return escapeHtml(
    `font-family:${family.stack};font-weight:${style.weight};font-style:${
      style.italic ? "italic" : "normal"
    };font-stretch:${style.stretch};font-size:${size}px;line-height:1.3;white-space:normal`,
  );
}

const HEADING = "font:bold 14px Helvetica, Arial, sans-serif;margin:18px 0 6px;white-space:normal";
const NOTE = "font:10px Helvetica, Arial, sans-serif;color:#666;white-space:normal";

/** A font's name and its file's bytes, for a family the page brought in itself. */
export interface FontFile {
  name: string;
  dataUrl: string;
}

/** The rules that give the printed page a font added from a file: it can load nothing else. */
const faceRules = (files: readonly FontFile[]) =>
  files.length === 0
    ? ""
    : `<style>${files
        .map(
          ({ name, dataUrl }) =>
            `@font-face{font-family:${JSON.stringify(name).replace(/</g, "\\3c ")};src:url(${dataUrl})}`,
        )
        .join("")}</style>`;

const dataUrlOf = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** The page's body for `families`, with the fonts `files` gives it. */
export function reportHtml(
  report: FontReport,
  families: readonly FontFamily[],
  files: readonly FontFile[] = [],
): string {
  return (
    faceRules(files) +
    families
      .map((family) => {
        const heading = `<div style="${HEADING}">${escapeHtml(family.name)}</div>`;
        const regular = family.styles[0];
        if (!regular) return heading;
        if (report === "catalog") {
          return (
            heading +
            family.styles
              .map(
                (style) =>
                  `<div style="${NOTE}">${escapeHtml(style.name)}</div>` +
                  `<div style="${fontStyleOf(family, style, 18)}">${escapeHtml(sampleOf(family))}</div>`,
              )
              .join("")
          );
        }
        if (report === "repertoire") {
          const glyphs = repertoireOf(family).slice(0, REPERTOIRE_SHOWN).map(escapeHtml).join(" ");
          return `${heading}<div style="${fontStyleOf(family, regular, 18)}">${glyphs}</div>`;
        }
        return (
          heading +
          WATERFALL_SIZES.map(
            (size) =>
              `<div style="${NOTE}">${size} pt</div>` +
              `<div style="${fontStyleOf(family, regular, size)}">${escapeHtml(sampleOf(family))}</div>`,
          ).join("")
        );
      })
      .join("")
  );
}

/** The sheet of File > Print: which report, of the fonts selected. */
export function FontPrintSheet({
  open,
  anchor,
  families,
  report,
  onReportChange,
  fontFile,
  onClose,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  families: readonly FontFamily[];
  report: FontReport;
  onReportChange: (report: FontReport) => void;
  /** The file of a font added to the page, when `family` is one. */
  fontFile: (family: FontFamily) => Blob | undefined;
  onClose: () => void;
}) {
  const [printed, setPrinted] = useState(0);
  const print = async () => {
    const files: FontFile[] = [];
    for (const family of families) {
      const file = fontFile(family);
      if (file) files.push({ name: family.name, dataUrl: await dataUrlOf(file) });
    }
    printDocument({
      name: "Fonts",
      html: reportHtml(report, families, files),
      lines: [],
      plain: false,
    });
    setPrinted((count) => count + 1);
    onClose();
  };
  return (
    <Sheet open={open} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={360} key={printed}>
        <SheetTitle>Print Fonts</SheetTitle>
        <SheetDescription>
          {families.length === 1
            ? `“${families[0]?.name}”, as a report.`
            : `${families.length} families, as a report.`}
        </SheetDescription>
        <Form size="small" onSubmit={(event) => event.preventDefault()}>
          <FormRow label="Report Type:">
            <PopUpButton
              aria-label="Report Type"
              size="small"
              value={report}
              onValueChange={(value) => onReportChange(value as FontReport)}
            >
              {REPORTS.map(([value, title]) => (
                <PopUpButtonItem key={value} value={value}>
                  {title}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </FormRow>
        </Form>
        <SheetActions>
          <SheetClose>Cancel</SheetClose>
          <DefaultButton disabled={families.length === 0} onClick={() => void print()}>
            Print
          </DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}
