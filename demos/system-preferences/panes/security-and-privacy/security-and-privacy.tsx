"use client";

import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { LockButton } from "macalicious/lock-button";
import { PushButton } from "macalicious/push-button";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { Separator } from "macalicious/separator";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { type MouseEvent, useEffect, useId, useRef, useState } from "react";
import { servedByDesktopApp } from "../../../desktop/desktop-server";
import { PaneChoice } from "../../choice";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference, usePreferences } from "../../pane";
import { Uncaptured } from "../uncaptured";
import { AdvancedPanel, LockMessagePanel } from "./served-panels";
import { SHOW_MESSAGE_KEY } from "./served-security";

/**
 * The tab view's top-left corner in the window frame: the strip is centred on the box's top
 * edge, which is at y 73.
 */
const TABS = { x: 20, y: 63 };

/** Value, title and measured width of each tab. */
const TAB_LIST = [
  ["general", "General", 72],
  ["filevault", "FileVault", 74],
  ["firewall", "Firewall", 68],
  ["privacy", "Privacy", 68],
] as const;

/** The browser's permissions a page can ask about, by the names Privacy lists them under. */
const PERMISSIONS = [
  ["camera", "Camera"],
  ["microphone", "Microphone"],
  ["geolocation", "Location Services"],
  ["notifications", "Notifications"],
] as const;

const PERMISSION_WORDS: Readonly<Record<string, string>> = {
  granted: "Allowed for this desktop",
  denied: "Refused for this desktop",
  prompt: "The browser will ask",
};

/** Privacy on the served desktop: what the browser says this page may use, which it alone changes. */
function ServedPrivacy() {
  const [states, setStates] = useState<Readonly<Record<string, string>>>({});
  useEffect(() => {
    let live = true;
    for (const [name] of PERMISSIONS) {
      Promise.resolve()
        .then(() => navigator.permissions.query({ name: name as PermissionName }))
        .then(
          (status) => status.state as string,
          () => "",
        )
        .then((state) => {
          if (live) setStates((current) => ({ ...current, [name]: state }));
        });
    }
    return () => {
      live = false;
    };
  }, []);
  return (
    <PaneForm origin={TABS}>
      <PaneAt x={82.5} y={113} width={500}>
        <Label>
          These are what your browser lets this desktop use. Only the browser can change them, in
          its settings for this site.
        </Label>
      </PaneAt>
      {PERMISSIONS.map(([name, title], index) => (
        <PaneAt key={name} x={82.5} y={160 + index * 24} width={500}>
          <Label id={`privacy-${name}`} style={{ width: 170 }}>
            {title}:
          </Label>
          <Label aria-labelledby={`privacy-${name}`}>
            {name in states
              ? (PERMISSION_WORDS[states[name] ?? ""] ?? "Not reported by this browser")
              : "Reading…"}
          </Label>
        </PaneAt>
      ))}
    </PaneForm>
  );
}

/** What the served desktop says of a tab that a web page has no part in. */
const SERVED_TABS: Readonly<Record<string, string>> = {
  filevault:
    "A web page cannot see or change whether your computer's disk is encrypted. Your Ferrite Drive is kept on the server, and the Keychain Access app encrypts its items in this browser.",
  firewall:
    "A web page cannot see or change your computer's firewall. This desktop reaches only the addresses its server allows.",
};

/** Why the served desktop dims what it cannot change. */
const NO_AUTOMATIC_LOGIN = "This desktop has no automatic login: the login window always asks.";
const ALLOW_APPS =
  "A web page cannot decide what your computer may run. That stays in your computer's own settings.";
const NO_ADMINISTRATOR = "Nothing on this desktop's Security & Privacy needs an administrator.";

/**
 * System Preferences > Security & Privacy: the General tab of a locked pane. The settings an
 * administrator must unlock are disabled, as captured. In the library demo the lock button toggles
 * its own state and asks for no password, and only the General tab is captured; the other three say
 * so. On the served desktop Require password is followed by the screen saver and display sleep, the
 * pane goes to Users & Groups to change the password, Set Lock Message… and Advanced… work
 * (`served-security.ts`), what a page cannot change is dimmed with why, and the other tabs say what
 * is true of a web page.
 *
 * Distances are those of reference/spec/apps/system-preferences-security-and-privacy.md, in
 * points from the top-left corner of the window frame.
 */
export function SecurityAndPrivacy() {
  const [tab, setTab] = usePreference<string>("security-and-privacy.tab", "general");
  const [lock, setLock] = usePreference<"locked" | "unlocked">(
    "security-and-privacy.lock",
    "locked",
  );
  const [requirePassword, setRequirePassword] = usePreference(
    "security-and-privacy.requirePassword",
    true,
  );
  const [showMessage, setShowMessage] = usePreference(SHOW_MESSAGE_KEY, false);
  const [noAutoLogin, setNoAutoLogin] = usePreference(
    "security-and-privacy.disableAutomaticLogin",
    true,
  );
  const [allowApps, setAllowApps] = usePreference<string>(
    "security-and-privacy.allowApps",
    "identified-developers",
  );
  const id = useId();
  const served = servedByDesktopApp();
  const [panel, setPanel] = useState<{ kind: "message" | "advanced"; frame: Element } | null>(null);
  // The button a sheet was opened from, which has the keyboard back when it closes.
  const opener = useRef<HTMLElement | null>(null);
  const openPanel = (kind: "message" | "advanced") => (event: MouseEvent<HTMLElement>) => {
    const frame = event.currentTarget.closest(".mac-window");
    if (!frame) return;
    opener.current = event.currentTarget;
    setPanel({ kind, frame });
  };
  useEffect(() => {
    if (panel) return;
    opener.current?.focus();
    opener.current = null;
  }, [panel]);
  const { showPane } = usePreferences();

  return (
    <>
      <TabView
        value={tab}
        onValueChange={(value) => setTab(value as string)}
        style={{ position: "absolute", left: TABS.x, top: TABS.y - 38, width: 628, height: 440 }}
      >
        <TabViewList aria-label="Security & Privacy">
          {TAB_LIST.map(([value, title, width]) => (
            <TabViewTab key={value} value={value} style={{ width, padding: 0 }}>
              {title}
            </TabViewTab>
          ))}
        </TabViewList>
        <TabViewPanel value="general">
          <PaneForm origin={TABS}>
            <PaneAt x={82.5} y={113}>
              <Label>A login password has been set for this user</Label>
            </PaneAt>
            <PaneAt x={354.5} y={110.5}>
              {served ? (
                <PushButton
                  onClick={() => showPane("users-and-groups")}
                  style={{ width: 146, paddingInline: 0 }}
                >
                  Change Password…
                </PushButton>
              ) : (
                <Uncaptured action="Change Password…">
                  <PushButton style={{ width: 146, paddingInline: 0 }}>Change Password…</PushButton>
                </Uncaptured>
              )}
            </PaneAt>

            <PaneAt x={108} y={142}>
              <Checkbox checked={requirePassword} onCheckedChange={setRequirePassword}>
                Require password
              </Checkbox>
            </PaneAt>
            {/* The delay stays enabled under the lock, as in the captures; it has nothing to
                delay while the checkbox is off. */}
            <PaneAt x={240.5} y={139}>
              <PaneChoice
                setting="security-and-privacy.passwordDelay"
                options={[
                  "immediately",
                  "5 seconds",
                  "1 minute",
                  "5 minutes",
                  "15 minutes",
                  "1 hour",
                  "4 hours",
                  "8 hours",
                ]}
                initial="5 minutes"
                width={106}
                aria-label="Require password after"
                disabled={!requirePassword}
              />
            </PaneAt>
            <PaneAt x={354} y={142}>
              <Label>after sleep or screen saver begins</Label>
            </PaneAt>

            {/* The button follows the checkbox's title, 5.5 pt after it (x 393.5 in the captures),
                so a wider fallback font moves it instead of running under it. */}
            <PaneAt x={108} y={163.5} style={{ alignItems: "center", gap: 5.5 }}>
              <Checkbox checked={showMessage} onCheckedChange={setShowMessage} disabled={!served}>
                Show a message when the screen is locked
              </Checkbox>
              <PushButton
                disabled={!served || !showMessage}
                onClick={openPanel("message")}
                style={{ width: 148, paddingInline: 0 }}
              >
                Set Lock Message…
              </PushButton>
            </PaneAt>
            <PaneAt x={108} y={188}>
              <Checkbox
                checked={served ? true : noAutoLogin}
                onCheckedChange={setNoAutoLogin}
                disabled
                title={served ? NO_AUTOMATIC_LOGIN : undefined}
              >
                Disable automatic login
              </Checkbox>
            </PaneAt>

            <PaneAt x={43} y={309} width={582}>
              <Separator aria-hidden="true" style={{ width: "100%" }} />
            </PaneAt>

            <PaneAt x={82.5} y={327}>
              <Label id={`${id}-allow-apps`}>Allow apps downloaded from:</Label>
            </PaneAt>
            <PaneAt x={108} y={351}>
              <RadioGroup
                aria-labelledby={`${id}-allow-apps`}
                value={served ? "" : allowApps}
                onValueChange={(value) => setAllowApps(value as string)}
                disabled
                title={served ? ALLOW_APPS : undefined}
              >
                <RadioButton value="app-store">App Store</RadioButton>
                <RadioButton value="identified-developers">
                  App Store and identified developers
                </RadioButton>
              </RadioGroup>
            </PaneAt>
            {served ? (
              <PaneAt x={108} y={400}>
                <Label textStyle="small">{ALLOW_APPS}</Label>
              </PaneAt>
            ) : null}
          </PaneForm>
        </TabViewPanel>
        {TAB_LIST.slice(1, served ? 3 : undefined).map(([value, title]) => (
          <TabViewPanel key={value} value={value}>
            <EmptyState>
              {served
                ? (SERVED_TABS[value] ?? `The ${title} tab is not part of this demo.`)
                : `The ${title} tab is not part of this demo.`}
            </EmptyState>
          </TabViewPanel>
        ))}
        {served ? (
          <TabViewPanel value="privacy">
            <ServedPrivacy />
          </TabViewPanel>
        ) : null}
      </TabView>

      {served ? (
        <PaneFooter x={25.5} y={525}>
          <LockButton state="locked" disabled title={NO_ADMINISTRATOR}>
            Nothing here needs an administrator.
          </LockButton>
        </PaneFooter>
      ) : (
        <PaneFooter x={25.5} y={525}>
          <LockButton
            state={lock}
            onClick={() => setLock(lock === "locked" ? "unlocked" : "locked")}
          />
        </PaneFooter>
      )}
      <PaneAt x={516.5} y={532.5}>
        <PushButton
          disabled={!served}
          onClick={openPanel("advanced")}
          style={{ width: 98, paddingInline: 0 }}
        >
          Advanced…
        </PushButton>
      </PaneAt>
      <PaneFooter x={627.5} y={530.5}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
      {panel?.kind === "message" ? (
        <LockMessagePanel frame={panel.frame} onClose={() => setPanel(null)} />
      ) : null}
      {panel?.kind === "advanced" ? (
        <AdvancedPanel frame={panel.frame} onClose={() => setPanel(null)} />
      ) : null}
    </>
  );
}
