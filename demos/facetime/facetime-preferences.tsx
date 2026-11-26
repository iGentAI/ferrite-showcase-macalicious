"use client";

import { Checkbox } from "macalicious/checkbox";
import { Form, FormRow } from "macalicious/form";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PreferencesToolbar, PreferencesToolbarItem } from "macalicious/preferences-toolbar";
import {
  PreferencesWindow,
  PreferencesWindowPane,
  type PreferencesWindowProps,
} from "macalicious/preferences-window";
import { useEffect, useState } from "react";
import { changeDesktopValue, useDesktopValue } from "../desktop/desktop-personal";
import { sessionFetch } from "../desktop/desktop-server";
import { BlockedPeoplePane } from "../messages/messages-blocked-list";
import { VideoGlyph } from "./facetime-artwork";
import { DEFAULT_RINGTONE, playRing, RINGTONES } from "./facetime-ring";
import "./facetime.tokens.css";
import "./facetime.css";

/** FaceTime > Turn FaceTime Off, kept with the person's settings. */
export const FACETIME_OFF = "facetime.off";
export const FACETIME_RINGTONE = "facetime.ringtone";

export const readOff = (stored: unknown) => (stored === true ? true : undefined);
export const readRingtone = (stored: unknown) =>
  typeof stored === "string" && RINGTONES.includes(stored) ? stored : undefined;

const LOCATION_UNAVAILABLE = "The desktop does not know where a person is.";
const LIVE_PHOTOS_UNAVAILABLE =
  "Your picture goes straight to the other person's browser, so this desktop cannot stop it being kept.";

const BlockedIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M6 6 L18 18" stroke="currentColor" strokeWidth="2" />
  </svg>
);

/**
 * FaceTime > Preferences: Settings (the account the person logged in with, whether FaceTime is on, the
 * ringtone) and Blocked, the list Messages shares. What needs a phone or Apple's servers is dimmed and
 * says why.
 */
export function FaceTimePreferences({
  className,
  ...props
}: Omit<PreferencesWindowProps, "toolbar" | "children" | "modal">) {
  const off = useDesktopValue(FACETIME_OFF, readOff, false) === true;
  const ringtone = useDesktopValue(FACETIME_RINGTONE, readRingtone, DEFAULT_RINGTONE);
  const [me, setMe] = useState<{ name?: string | null; full_name?: string } | null>(null);
  useEffect(() => {
    let stopped = false;
    void sessionFetch("/api/facetime/me", { credentials: "same-origin" })
      .then((reply) => (reply.ok ? reply.json() : null))
      .then((body) => {
        if (!stopped) setMe(body);
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, []);
  return (
    <PreferencesWindow
      width={480}
      className={className ? `mac-facetime-preferences ${className}` : "mac-facetime-preferences"}
      toolbar={
        <PreferencesToolbar aria-label="FaceTime preferences">
          <PreferencesToolbarItem value="settings" icon={<VideoGlyph />}>
            Settings
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="blocked" icon={<BlockedIcon />}>
            Blocked
          </PreferencesToolbarItem>
        </PreferencesToolbar>
      }
      {...props}
    >
      <PreferencesWindowPane value="settings">
        <div className="mac-facetime-preferences-settings">
          <Form render={<div />} labelWidth={84}>
            <FormRow label="Account:" align="center">
              <Label selectable>
                {me?.name ? `${me.full_name || me.name} (${me.name}@macalicious)` : "Not signed in"}
              </Label>
            </FormRow>
            <FormRow label="" kind="group" orientation="vertical">
              <Checkbox
                checked={!off}
                onCheckedChange={(checked) => changeDesktopValue(FACETIME_OFF, checked !== true)}
              >
                Enable this account
              </Checkbox>
            </FormRow>
            <FormRow label="Ringtone:" align="center">
              <PopUpButton
                aria-label="Ringtone"
                value={ringtone}
                onValueChange={(next) => {
                  if (next == null) return;
                  changeDesktopValue(FACETIME_RINGTONE, String(next));
                  playRing(String(next));
                }}
              >
                {RINGTONES.map((name) => (
                  <PopUpButtonItem key={name} value={name}>
                    {name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </FormRow>
            <FormRow label="" kind="group" orientation="vertical">
              <Checkbox disabled title={LOCATION_UNAVAILABLE}>
                Use location for making calls
              </Checkbox>
              <Checkbox disabled title={LIVE_PHOTOS_UNAVAILABLE}>
                Allow Live Photos to be captured during Video calls
              </Checkbox>
            </FormRow>
          </Form>
        </div>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="blocked">
        <BlockedPeoplePane />
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
