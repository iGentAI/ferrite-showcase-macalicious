"use client";

import { Checkbox } from "macalicious/checkbox";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import {
  PreferencesWindow,
  PreferencesWindowForm,
  PreferencesWindowPane,
  type PreferencesWindowProps,
  PreferencesWindowRow,
} from "macalicious/preferences-window";
import type { ReactNode } from "react";
import { useDesktopSetting } from "../desktop/desktop-personal";

/** The desktop value of Validate fonts before installing. */
export const FONT_BOOK_VALIDATE = "fontBook.validateBeforeInstalling";

export const readFlag = (stored: unknown): boolean | undefined =>
  typeof stored === "boolean" ? stored : undefined;

const COMPUTER_REASON =
  "Computer would install for every account, and this desktop keeps fonts on your own drive.";
const ACTIVATION_REASON =
  "Activation loads a font when another application's document asks for it; applications here do not ask.";
const SYSTEM_REASON = "This desktop has no system font files to watch.";

export type FontBookPreferencesProps = Omit<
  PreferencesWindowProps,
  "toolbar" | "children" | "modal" | "title"
>;

/** Why the row above it is as it is, wrapped to the pane: a form's column grows to what it holds. */
function Note({ children }: { children: ReactNode }) {
  return (
    <PreferencesWindowRow label="">
      <Label
        textStyle="small"
        color="secondary"
        className="mac-font-book-preference-note"
        render={<p />}
      >
        {children}
      </Label>
    </PreferencesWindowRow>
  );
}

/**
 * Font Book's Preferences. Validation decides what Add Fonts does; the rest would need the system's
 * font services, so it shows dimmed and says why.
 */
export function FontBookPreferences(props: FontBookPreferencesProps) {
  const [validate, setValidate] = useDesktopSetting(FONT_BOOK_VALIDATE, readFlag, true);
  return (
    <PreferencesWindow
      title="Font Book Preferences"
      toolbar={null}
      defaultValue="general"
      width={520}
      {...props}
    >
      <PreferencesWindowPane value="general">
        <PreferencesWindowForm>
          <PreferencesWindowRow label="Default Install Location:">
            <PopUpButton aria-label="Default Install Location" value="user">
              <PopUpButtonItem value="user">User</PopUpButtonItem>
              <PopUpButtonItem value="computer" disabled title={COMPUTER_REASON}>
                Computer
              </PopUpButtonItem>
            </PopUpButton>
          </PreferencesWindowRow>
          <Note>In Documents/Fonts on your drive. {COMPUTER_REASON}</Note>
          <PreferencesWindowRow label="">
            <Checkbox checked={validate} onCheckedChange={(next) => setValidate(next === true)}>
              Validate fonts before installing
            </Checkbox>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="">
            <Checkbox disabled title={ACTIVATION_REASON}>
              Automatic font activation
            </Checkbox>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="">
            <Checkbox disabled title={ACTIVATION_REASON}>
              Ask me before activating
            </Checkbox>
          </PreferencesWindowRow>
          <Note>{ACTIVATION_REASON}</Note>
          <PreferencesWindowRow label="">
            <Checkbox disabled title={SYSTEM_REASON}>
              Alert me if system font files change
            </Checkbox>
          </PreferencesWindowRow>
          <Note>{SYSTEM_REASON}</Note>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
