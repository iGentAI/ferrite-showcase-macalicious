"use client";

import { Checkbox } from "macalicious/checkbox";
import { Label } from "macalicious/label";
import {
  PreferencesWindow,
  PreferencesWindowForm,
  PreferencesWindowPane,
  type PreferencesWindowProps,
} from "macalicious/preferences-window";
import { PushButton } from "macalicious/push-button";
import { readBoolean, useDesktopSetting } from "../desktop/desktop-personal";
import { KEYCHAIN_MENU_BAR_STATUS } from "./keychain-status";
import "./keychain-access.tokens.css";
import "./keychain-access.css";

const RESET_REASON =
  "Your keychain is sealed in this browser and only you can open it, so there is nothing to reset it from. Delete Keychain in the File menu removes it, and then you can make a new one.";

/** What the Preferences window takes: a window of the desktop. */
export type KeychainAccessPreferencesProps = Omit<
  PreferencesWindowProps,
  "toolbar" | "children" | "modal" | "title"
>;

/** Keychain Access's Preferences: the menu bar's status, and what cannot happen here, saying why. */
export function KeychainAccessPreferences(props: KeychainAccessPreferencesProps) {
  const [shown, setShown] = useDesktopSetting(KEYCHAIN_MENU_BAR_STATUS, readBoolean, false);
  return (
    <PreferencesWindow
      title="Keychain Access Preferences"
      toolbar={null}
      defaultValue="general"
      width={420}
      {...props}
    >
      <PreferencesWindowPane value="general">
        <PreferencesWindowForm className="mac-keychain-access-preferences">
          <Checkbox checked={shown === true} onCheckedChange={(checked) => setShown(checked)}>
            Show keychain status in menu bar
          </Checkbox>
          <PushButton disabled title={RESET_REASON}>
            Reset My Default Keychains
          </PushButton>
          <Label textStyle="small" color="secondary" render={<p />}>
            {RESET_REASON}
          </Label>
          <Label textStyle="small" color="secondary" render={<p />}>
            Certificate settings are not offered: this keychain holds passwords and notes only.
          </Label>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
