"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { PushButton } from "macalicious/push-button";
import { ScrollView } from "macalicious/scroll-view";
import { Sheet, SheetActions, SheetDescription, SheetPopup, SheetTitle } from "macalicious/sheet";
import { useState } from "react";
import { DriveSavePanel, type DriveSaveTarget } from "../finder/finder-file-dialogs";
import type { FontTables } from "./font-book-tables";
import {
  type DuplicateFonts,
  type FontCheck,
  type FontCheckState,
  validationVerdict,
} from "./font-book-validate";

/** One font's result in the validation window. `checks` is empty for a font with no file here. */
export interface FontValidation {
  name: string;
  checks: readonly FontCheck[];
}

const VERDICT: Record<FontCheckState, string> = {
  passed: "Passed",
  warning: "Passed with warnings",
  failed: "Failed",
};

/** File > Validate Font and Validate File: each font's result, and what was wrong. */
export function FontValidationSheet({
  results,
  anchor,
  onClose,
}: {
  results: readonly FontValidation[] | null;
  anchor: HTMLElement | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={results !== null} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={420}>
        <SheetTitle>Font Validation</SheetTitle>
        <SheetDescription>
          These checks read the font file itself. A font this desktop only names has no file to
          read.
        </SheetDescription>
        <ScrollView className="mac-font-book-sheet-list">
          <ul aria-label="Validation results">
            {results?.map(({ name, checks }) => (
              <li key={name}>
                <strong>{name}</strong>:{" "}
                {checks.length === 0 ? "No file to check" : VERDICT[validationVerdict(checks)]}
                {checks.some(({ state }) => state !== "passed") ? (
                  <ul>
                    {checks
                      .filter(({ state }) => state !== "passed")
                      .map((check) => (
                        <li key={check.name}>
                          {check.name}: {check.detail}
                        </li>
                      ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </ScrollView>
        <SheetActions>
          <DefaultButton onClick={onClose}>Done</DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/** What a font's check calls whether the browser could load it. */
const BROWSER_CHECK = "The browser can draw it";

const browserRefused = (checks: readonly FontCheck[]) =>
  checks.some(({ name, state }) => name === BROWSER_CHECK && state === "failed");

/** One file of Add Fonts that was validated first. */
export interface FontToInstall {
  file: File;
  checks: readonly FontCheck[];
}

/**
 * Add Fonts with Validate fonts before installing on, when a file did not pass: what was found, and
 * which to install. A file that failed starts unchecked; one the browser refused cannot be installed.
 */
export function FontInstallCheckSheet({
  fonts,
  anchor,
  onInstall,
  onClose,
}: {
  fonts: readonly FontToInstall[] | null;
  anchor: HTMLElement | null;
  onInstall: (files: readonly File[]) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={fonts !== null} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={440}>
        {fonts ? (
          <FontInstallChecks
            key={fonts.map(({ file }) => file.name).join()}
            fonts={fonts}
            onInstall={onInstall}
            onClose={onClose}
          />
        ) : null}
      </SheetPopup>
    </Sheet>
  );
}

function FontInstallChecks({
  fonts,
  onInstall,
  onClose,
}: {
  fonts: readonly FontToInstall[];
  onInstall: (files: readonly File[]) => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<readonly string[]>(() =>
    fonts
      .filter(({ checks }) => validationVerdict(checks) !== "failed")
      .map(({ file }) => file.name),
  );
  return (
    <>
      <SheetTitle>Font Validation</SheetTitle>
      <SheetDescription>
        Some of these fonts did not pass. Choose which to install.
      </SheetDescription>
      <ScrollView className="mac-font-book-sheet-list">
        <ul aria-label="Fonts to install">
          {fonts.map(({ file, checks }) => (
            <li key={file.name}>
              <Checkbox
                size="small"
                disabled={browserRefused(checks)}
                checked={checked.includes(file.name)}
                onCheckedChange={(next) =>
                  setChecked(
                    next === true
                      ? [...checked, file.name]
                      : checked.filter((name) => name !== file.name),
                  )
                }
              >
                {file.name}: {VERDICT[validationVerdict(checks)]}
              </Checkbox>
              {checks.some(({ state }) => state !== "passed") ? (
                <ul>
                  {checks
                    .filter(({ state }) => state !== "passed")
                    .map((check) => (
                      <li key={check.name}>
                        {check.name}: {check.detail}
                      </li>
                    ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </ScrollView>
      <SheetActions>
        <PushButton onClick={onClose}>Cancel</PushButton>
        <DefaultButton
          disabled={checked.length === 0}
          onClick={() =>
            onInstall(fonts.map(({ file }) => file).filter(({ name }) => checked.includes(name)))
          }
        >
          Install Checked
        </DefaultButton>
      </SheetActions>
    </>
  );
}

/** A font file Finder opened, not yet installed. */
export interface OpenedFont {
  file: File;
  tables: FontTables | null;
  /** The CSS family the file is loaded under for this sheet. */
  stack: string;
  sample: string;
}

/** A font file opened from Finder: the font in its own face, and the offer to install it. */
export function FontInstallSheet({
  font,
  anchor,
  onInstall,
  onClose,
}: {
  font: OpenedFont | null;
  anchor: HTMLElement | null;
  onInstall: (file: File) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={font !== null} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={460}>
        <SheetTitle>{font?.tables?.fullName ?? font?.file.name}</SheetTitle>
        <SheetDescription>
          {[font?.tables?.styleName, font?.tables?.version, "Not Installed"]
            .filter(Boolean)
            .join(", ")}
        </SheetDescription>
        <div
          role="img"
          aria-label="Sample of the font"
          className="mac-font-book-install-sample"
          style={{ fontFamily: font?.stack }}
        >
          {font?.sample}
        </div>
        <SheetActions>
          <PushButton onClick={onClose}>Cancel</PushButton>
          <DefaultButton onClick={() => font && onInstall(font.file)}>Install Font</DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/** Edit > Look for Enabled Duplicates: which files hold the same font. */
export function FontDuplicatesSheet({
  groups,
  anchor,
  onResolve,
  onClose,
}: {
  groups: readonly DuplicateFonts[] | null;
  anchor: HTMLElement | null;
  onResolve: (groups: readonly DuplicateFonts[]) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={groups !== null} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={420}>
        <SheetTitle>Duplicate Fonts</SheetTitle>
        <SheetDescription>
          Resolving keeps the first file of each font and moves the others to the Trash.
        </SheetDescription>
        <ScrollView className="mac-font-book-sheet-list">
          <ul aria-label="Duplicate fonts">
            {groups?.map(({ keep, extra }) => (
              <li key={keep.id}>
                <strong>{keep.name}</strong>: also {extra.map(({ name }) => name).join(", ")}
              </li>
            ))}
          </ul>
        </ScrollView>
        <SheetActions>
          <PushButton onClick={onClose}>Cancel</PushButton>
          <DefaultButton onClick={() => groups && onResolve(groups)}>Resolve</DefaultButton>
        </SheetActions>
      </SheetPopup>
    </Sheet>
  );
}

/** File > Export Fonts: a folder on the drive, which takes the files of the fonts chosen. */
export function FontExportSheet({
  count,
  anchor,
  onExport,
  onClose,
}: {
  /** How many font files go; `null` while the sheet is closed. */
  count: number | null;
  anchor: HTMLElement | null;
  onExport: (target: DriveSaveTarget) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={count !== null} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor ?? undefined} width={640} aria-label="Export Fonts">
        {count !== null ? (
          <DriveSavePanel defaultName="Exported Fonts" onSave={onExport} onCancel={onClose} />
        ) : null}
      </SheetPopup>
    </Sheet>
  );
}
