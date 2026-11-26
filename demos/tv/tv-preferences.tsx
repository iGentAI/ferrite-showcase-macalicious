"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PreferencesToolbar, PreferencesToolbarItem } from "macalicious/preferences-toolbar";
import {
  PreferencesWindow,
  PreferencesWindowFooter,
  PreferencesWindowForm,
  PreferencesWindowPane,
  type PreferencesWindowProps,
  PreferencesWindowRow,
} from "macalicious/preferences-window";
import { PushButton } from "macalicious/push-button";
import { Separator } from "macalicious/separator";
import { type CSSProperties, type ReactNode, useId, useState } from "react";
import { PaneIcon, type TvPreferencesPane } from "./tv-artwork";
import { defaultSettings, type TvListSize, type TvSettingKey, type TvSettings } from "./tv-data";
import "./tv.css";

/**
 * Why Help cannot open on the Ferrite desktop: Help Viewer has no help book for TV (TV's Help menu
 * item is dimmed saying so). The desktop passes it as `helpUnavailable`.
 */
export const NO_HELP = "TV Help is not available: this desktop has no help book for TV";

/** Frame of the Preferences window on its General pane in points, as measured. */
export const PREFERENCES_WIDTH = 640;
export const PREFERENCES_HEIGHT = 360;

/**
 * The toolbar items with their widths in points, as in Music's Preferences, whose toolbar TV
 * shares: the group is centred and the items are set closer than their natural width.
 */
const ITEMS: [value: TvPreferencesPane, label: string, width: number][] = [
  ["general", "General", 49],
  ["playback", "Playback", 54.75],
  ["files", "Files", 41],
  ["restrictions", "Restrictions", 69.75],
  ["advanced", "Advanced", 59.75],
];

/*
 * The panes are laid out against the left edge: the controls start 200 pt from it, after a
 * 172 pt label column and the 8 pt between a label and its control. The rows have no gap;
 * each carries its height, the distance to the next row in the capture.
 */
const FORM: CSSProperties = {
  gridTemplateColumns: "172px 1fr",
  justifyContent: "start",
  ["--mac-preferences-window-row-gap" as string]: "0px",
};
const PANE: CSSProperties = { paddingBlock: "20px 19.5px" };
const row = (height: number): CSSProperties => ({ height });
const LIST_SIZE: CSSProperties = { width: 81.5 };
const BUTTON: CSSProperties = { width: 70, paddingInline: 0 };

export interface TvPreferencesProps
  extends Omit<PreferencesWindowProps, "toolbar" | "children" | "modal" | "title"> {
  /**
   * The settings the window opens with. The window edits a copy and reports it through
   * `onSettingsChange` when OK is chosen.
   * @default the settings of the reference screenshots
   */
  settings?: TvSettings;
  /** Called with the edited settings when OK is chosen, before `onClose`. */
  onSettingsChange?: (settings: TvSettings) => void;
  /**
   * Settings shown dimmed, each with the value it shows and the reason it cannot be changed,
   * which its title and a note under its pane give. A setting named here is never reported
   * changed. Naming `checkDownloads` also gives its reason to the Automatic Downloads boxes.
   * @default none: every setting can be changed
   */
  unavailable?: Readonly<Partial<Record<TvSettingKey, { checked: boolean; reason: string }>>>;
  /**
   * Why Help cannot open, when it cannot: the Help button under each pane is then dimmed with
   * this as its title, rather than left doing nothing. The Ferrite desktop gives `NO_HELP`.
   * @default none: the Help button is enabled, as captured
   */
  helpUnavailable?: string;
}

/** The settings each pane holds, for the note that explains its dimmed ones. */
const PANE_SETTINGS: Record<TvPreferencesPane, readonly TvSettingKey[]> = {
  general: ["checkDownloads", "checkboxes"],
  playback: ["screenSaver"],
  files: ["keepOrganized"],
  restrictions: ["restrictMature"],
  advanced: ["resetWarnings"],
};
const paneOf = (key: TvSettingKey) =>
  (Object.keys(PANE_SETTINGS) as TvPreferencesPane[]).find((pane) =>
    PANE_SETTINGS[pane].includes(key),
  ) ?? "general";
const NOTE: CSSProperties = { margin: "6px 0 0", maxWidth: 560 };

/**
 * TV's Preferences: the modal kind of the library's `PreferencesWindow`, with a centred
 * toolbar of five panes and Cancel and OK under each. Changes take effect when OK is chosen;
 * Cancel and Escape drop them. All three call `onClose`.
 *
 * The root is the `PreferencesWindow`, and every one of its props that this component does not
 * set goes to it: `state`, `style`, `value`, `onValueChange`, `onClose`, `ref`.
 */
export function TvPreferences({
  settings = defaultSettings,
  onSettingsChange,
  unavailable,
  helpUnavailable,
  onClose,
  width = PREFERENCES_WIDTH,
  ...props
}: TvPreferencesProps) {
  const [draft, setDraft] = useState(settings);
  const listSize = useId();
  const noteId = useId();
  const box = (key: TvSettingKey, title: string) => {
    const fixed = unavailable?.[key];
    return (
      <Checkbox
        checked={fixed ? fixed.checked : draft[key]}
        disabled={fixed !== undefined}
        title={fixed?.reason}
        aria-describedby={fixed ? `${noteId}-${paneOf(key)}` : undefined}
        onCheckedChange={(checked) => {
          if (!fixed) setDraft((now) => ({ ...now, [key]: checked }));
        }}
      >
        {title}
      </Checkbox>
    );
  };
  const downloadsReason = unavailable?.checkDownloads?.reason;
  const note = (text: string) => (
    <Label textStyle="small" className="mac-tv-note">
      {text}
    </Label>
  );
  const pane = (value: TvPreferencesPane, form: ReactNode) => {
    // Each reason once, in the order of the settings it explains.
    const reasons = [
      ...new Set(
        PANE_SETTINGS[value].flatMap((key) => {
          const reason = unavailable?.[key]?.reason;
          return reason ? [reason] : [];
        }),
      ),
    ];
    return (
      <PreferencesWindowPane value={value} style={PANE}>
        <PreferencesWindowForm style={FORM}>{form}</PreferencesWindowForm>
        {reasons.length > 0 ? (
          <p id={`${noteId}-${value}`} className="mac-tv-note" style={NOTE}>
            Dimmed settings are not available here. {reasons.join(" ")}
          </p>
        ) : null}
        <Separator style={{ marginInline: -20, marginBlockStart: 7 }} />
        <PreferencesWindowFooter
          leading={
            <HelpButton
              disabled={helpUnavailable !== undefined || undefined}
              title={helpUnavailable}
            />
          }
          style={{ height: 22, marginBlockStart: 17.5 }}
        >
          <PushButton style={BUTTON} onClick={(event) => onClose?.(event)}>
            Cancel
          </PushButton>
          <DefaultButton
            style={BUTTON}
            onClick={(event) => {
              onSettingsChange?.(draft);
              onClose?.(event);
            }}
          >
            OK
          </DefaultButton>
        </PreferencesWindowFooter>
      </PreferencesWindowPane>
    );
  };

  return (
    <PreferencesWindow
      modal
      width={width}
      onClose={onClose}
      toolbar={
        <PreferencesToolbar aria-label="TV preferences" alignment="center">
          {ITEMS.map(([value, label, itemWidth], index) => (
            <PreferencesToolbarItem
              key={value}
              value={value}
              icon={<PaneIcon pane={value} />}
              style={{
                width: itemWidth,
                minWidth: 0,
                paddingInline: 0,
                marginInlineStart: index === 0 ? -4.5 : 0,
              }}
            >
              {label}
            </PreferencesToolbarItem>
          ))}
        </PreferencesToolbar>
      }
      {...props}
    >
      {pane(
        "general",
        <>
          <PreferencesWindowRow align="start" style={row(22.5)}>
            {box("checkDownloads", "Always check for available downloads")}
          </PreferencesWindowRow>
          <PreferencesWindowRow align="start" style={row(23.5)}>
            <Label>Automatic Downloads</Label>
          </PreferencesWindowRow>
          <PreferencesWindowRow align="start" style={row(36)}>
            {note(
              "Automatically download TV shows and movies you add to your Library and purchases you make on other devices",
            )}
          </PreferencesWindowRow>
          {/* Downloads need an account, which the demo has none of: as captured, unavailable. */}
          <PreferencesWindowRow align="start" style={row(36)}>
            <Checkbox disabled title={downloadsReason} style={{ width: 103 }}>
              Movies
            </Checkbox>
            <Checkbox disabled title={downloadsReason}>
              TV Shows
            </Checkbox>
          </PreferencesWindowRow>
          <Separator style={{ marginBlock: "0 9px" }} />
          <PreferencesWindowRow label="Show:" align="start" style={row(23)}>
            {box("checkboxes", "Checkboxes in library")}
          </PreferencesWindowRow>
          <PreferencesWindowRow align="start" style={row(21.5)}>
            {note("Only checked items will be automatically synced")}
          </PreferencesWindowRow>
          <PreferencesWindowRow
            label="List Size:"
            labelFor={listSize}
            align="center"
            style={row(22.5)}
          >
            <PopUpButton<TvListSize>
              id={listSize}
              value={draft.listSize}
              onValueChange={(next) => {
                if (next) setDraft((now) => ({ ...now, listSize: next }));
              }}
              style={LIST_SIZE}
            >
              <PopUpButtonItem value="small">Small</PopUpButtonItem>
              <PopUpButtonItem value="medium">Medium</PopUpButtonItem>
              <PopUpButtonItem value="large">Large</PopUpButtonItem>
            </PopUpButton>
          </PreferencesWindowRow>
        </>,
      )}
      {pane(
        "playback",
        <PreferencesWindowRow label="Playback:" align="center" style={row(20)}>
          {box("screenSaver", "Use the screen saver while paused")}
        </PreferencesWindowRow>,
      )}
      {pane(
        "files",
        <PreferencesWindowRow label="Media folder:" align="center" style={row(20)}>
          {box("keepOrganized", "Keep Media folder organized")}
        </PreferencesWindowRow>,
      )}
      {pane(
        "restrictions",
        <PreferencesWindowRow label="Restrict:" align="center" style={row(20)}>
          {box("restrictMature", "Movies and TV shows with mature content")}
        </PreferencesWindowRow>,
      )}
      {pane(
        "advanced",
        <PreferencesWindowRow label="Warnings:" align="center" style={row(20)}>
          {box("resetWarnings", "Reset all dialog warnings")}
        </PreferencesWindowRow>,
      )}
    </PreferencesWindow>
  );
}
