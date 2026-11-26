"use client";

import { Checkbox } from "macalicious/checkbox";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import {
  PreferencesWindow,
  PreferencesWindowForm,
  PreferencesWindowPane,
  type PreferencesWindowProps,
} from "macalicious/preferences-window";
import { readBoolean, useDesktopSetting } from "../desktop/desktop-personal";
import "./app-store.tokens.css";
import "./app-store.css";

/** Whether the store says apps update by themselves, in the desktop's settings. */
export const APP_STORE_AUTO_UPDATES = "app-store.automaticUpdates";
export const readAutoUpdates = readBoolean;

const SAME_LIBRARY =
  "Apps you get are kept with your account, so they are already here on any computer you sign in on.";
const NO_VIDEO = "The store shows no video.";
const NO_ASKING = "Apps on this desktop do not ask for ratings; you rate them on their pages.";

/** What the store's Preferences window takes: a window of the desktop. */
export type AppStorePreferencesProps = Omit<
  PreferencesWindowProps,
  "toolbar" | "children" | "modal" | "title"
>;

/** The store's Preferences: the one choice this desktop acts on, and the others dimmed, saying why. */
export function AppStorePreferences(props: AppStorePreferencesProps) {
  const [automatic, setAutomatic] = useDesktopSetting(
    APP_STORE_AUTO_UPDATES,
    readAutoUpdates,
    true,
  );
  return (
    <PreferencesWindow
      title="App Store Preferences"
      toolbar={null}
      defaultValue="general"
      width={480}
      {...props}
    >
      <PreferencesWindowPane value="general">
        <PreferencesWindowForm className="mac-app-store-preferences">
          <Checkbox checked={automatic} onCheckedChange={(checked) => setAutomatic(checked)}>
            Automatic Updates
          </Checkbox>
          <Checkbox checked disabled title={SAME_LIBRARY}>
            Automatically download apps purchased on other computers
          </Checkbox>
          <PopUpButton aria-label="Video Autoplay" value="off" disabled title={NO_VIDEO}>
            <PopUpButtonItem value="off">Video Autoplay: Off</PopUpButtonItem>
          </PopUpButton>
          <Checkbox disabled title={NO_ASKING}>
            Ask for feedback about apps
          </Checkbox>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
