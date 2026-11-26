"use client";

import { Checkbox } from "macalicious/checkbox";
import { DefaultButton } from "macalicious/default-button";
import { HelpButton } from "macalicious/help-button";
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
import { Slider } from "macalicious/slider";
import { type CSSProperties, type ReactNode, useId, useState } from "react";
import { type MusicPreferencesPane, PaneIcon } from "./music-artwork";
import { CROSSFADE_SECONDS } from "./music-audio";
import {
  defaultSettings as initialSettings,
  type MusicListSize,
  type MusicSettingKey,
  type MusicSettings,
} from "./music-data";
import type { UnavailableSetting } from "./music-settings";

/** Frame width of the Preferences window in points, as measured. */
export const PREFERENCES_WIDTH = 533;

/**
 * The toolbar items with their measured widths in points. Music centres the group and sets
 * the items closer than their natural width, so each one carries its own.
 */
const ITEMS: [value: MusicPreferencesPane, label: string, width: number][] = [
  ["general", "General", 49],
  ["playback", "Playback", 54.75],
  ["files", "Files", 41],
  ["restrictions", "Restrictions", 69.75],
  ["advanced", "Advanced", 59.75],
];

/** Music lays its panes out against the left edge: a 152 pt label column, rows without a gap. */
const FORM: CSSProperties = {
  gridTemplateColumns: "152px 1fr",
  justifyContent: "start",
  ["--mac-preferences-window-row-gap" as string]: "0px",
};
const PANE: CSSProperties = { paddingBlock: "17px 20px" };
const ROW: CSSProperties = { height: 24 };
const LAST_ROW: CSSProperties = { height: 20 };
/**
 * The List Size row: the pop-up button with the space Music leaves around it. Its bezel is
 * 80 pt wide in the captures, which is an alignment rectangle of 81.5 pt, and is centred
 * half a point under the middle of the 30 pt between the checkbox and the separator.
 */
const LIST_SIZE_ROW: CSSProperties = { height: 31 };
const LIST_SIZE: CSSProperties = { width: 81.5 };
const BUTTON: CSSProperties = { width: 70, paddingInline: 0 };
/** A Playback row: its check box, and the slider that says how much. */
const SLIDER_ROW: CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const SLIDER: CSSProperties = { width: 110 };
const SLIDER_LABEL: CSSProperties = { font: "var(--mac-font-label)", whiteSpace: "nowrap" };
/** The note under a pane that says why its dimmed settings cannot be changed. */
const NOTE: CSSProperties = {
  margin: "10px 0 0",
  maxWidth: 440,
  color: "var(--mac-color-label-secondary)",
  font: "var(--mac-font-label)",
};

/** The check boxes of each pane, for the note that explains those dimmed there. */
const PANE_SETTINGS: Readonly<Record<MusicPreferencesPane, readonly MusicSettingKey[]>> = {
  general: ["showStore", "starRatings", "songCheckboxes", "notifications"],
  playback: ["crossfade", "soundEnhancer", "soundCheck"],
  files: ["keepOrganized", "copyFiles"],
  restrictions: ["restrictStore", "restrictShared", "restrictExplicit"],
  advanced: ["addToLibrary", "updateArtwork", "miniPlayerOnTop"],
};

/** The pane a check box is on. */
function paneOf(key: MusicSettingKey): MusicPreferencesPane {
  const found = (Object.keys(PANE_SETTINGS) as MusicPreferencesPane[]).find((pane) =>
    PANE_SETTINGS[pane].includes(key),
  );
  return found ?? "general";
}

export interface MusicPreferencesProps
  extends Omit<PreferencesWindowProps, "toolbar" | "children" | "modal" | "onClose" | "title"> {
  /**
   * The settings the window opens with. The window edits a copy and hands it back through
   * `onApply`.
   * @default the settings of the reference screenshots
   */
  settings?: MusicSettings;
  /** Called with the edited settings when OK is chosen (or Return is pressed). */
  onApply?: (settings: MusicSettings) => void;
  /** Called when Cancel is chosen or Escape is pressed: the edits are dropped. */
  onCancel?: () => void;
  /**
   * Settings shown dimmed, each with the value it shows and the reason it cannot be changed,
   * which a note under its pane gives. A setting named here is never part of what `onApply`
   * hands back changed.
   * @default none: every setting can be changed
   */
  unavailable?: Readonly<Partial<Record<MusicSettingKey, UnavailableSetting>>>;
  /** What the Help button under each pane does. */
  onHelp?: () => void;
}

/**
 * Music's Preferences: the modal kind of the library's `PreferencesWindow`, with a centred
 * toolbar of five panes and Cancel and OK under each. Changes take effect when OK is chosen.
 *
 * The root is the `PreferencesWindow`, and every one of its props that this component does not
 * set goes to it: `state`, `style`, `value`, `onValueChange`, `ref`.
 */
export function MusicPreferences({
  settings = initialSettings,
  onApply,
  onCancel,
  unavailable,
  onHelp,
  width = PREFERENCES_WIDTH,
  ...props
}: MusicPreferencesProps) {
  const [draft, setDraft] = useState(settings);
  const listSize = useId();
  const noteId = useId();
  const box = (key: MusicSettingKey, title: string) => {
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
  const pane = (value: MusicPreferencesPane, form: ReactNode) => {
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
          <p id={`${noteId}-${value}`} className="mac-music-preferences-note" style={NOTE}>
            Dimmed settings are not available here. {reasons.join(" ")}
          </p>
        ) : null}
        <Separator style={{ marginInline: -20, marginBlockStart: 7 }} />
        <PreferencesWindowFooter
          leading={<HelpButton onClick={onHelp} />}
          style={{ height: 22, marginBlockStart: 17.5 }}
        >
          <PushButton style={BUTTON} onClick={() => onCancel?.()}>
            Cancel
          </PushButton>
          <DefaultButton style={BUTTON} onClick={() => onApply?.(draft)}>
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
      onClose={() => onCancel?.()}
      toolbar={
        <PreferencesToolbar aria-label="Music preferences" alignment="center">
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
          <PreferencesWindowRow label="Show:" align="center" style={ROW}>
            {box("showStore", "iTunes Store")}
          </PreferencesWindowRow>
          <PreferencesWindowRow align="center" style={ROW}>
            {box("starRatings", "Star ratings")}
          </PreferencesWindowRow>
          <PreferencesWindowRow align="center" style={LAST_ROW}>
            {box("songCheckboxes", "Songs list checkboxes")}
          </PreferencesWindowRow>
          <PreferencesWindowRow
            label="List Size:"
            labelFor={listSize}
            align="center"
            style={LIST_SIZE_ROW}
          >
            <PopUpButton<MusicListSize>
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
          <Separator style={{ marginBlock: "3px 7px" }} />
          <PreferencesWindowRow label="Notifications:" align="center" style={LAST_ROW}>
            {box("notifications", "When song changes")}
          </PreferencesWindowRow>
        </>,
      )}
      {pane(
        "playback",
        <>
          <PreferencesWindowRow label="Playback:" align="center" style={ROW}>
            <div style={SLIDER_ROW}>
              {box("crossfade", "Crossfade songs")}
              <Slider
                aria-label="Crossfade length"
                size="small"
                style={SLIDER}
                min={CROSSFADE_SECONDS.least}
                max={CROSSFADE_SECONDS.most}
                step={1}
                disabled={!draft.crossfade}
                value={draft.crossfadeSeconds}
                onValueChange={(next) =>
                  setDraft((now) => ({ ...now, crossfadeSeconds: next as number }))
                }
              />
              <span style={SLIDER_LABEL}>{draft.crossfadeSeconds} seconds</span>
            </div>
          </PreferencesWindowRow>
          <PreferencesWindowRow align="center" style={ROW}>
            <div style={SLIDER_ROW}>
              {box("soundEnhancer", "Sound Enhancer")}
              <span style={SLIDER_LABEL}>Low</span>
              <Slider
                aria-label="Sound Enhancer amount"
                size="small"
                style={SLIDER}
                min={0}
                max={100}
                step={5}
                disabled={!draft.soundEnhancer}
                value={draft.soundEnhancerLevel}
                onValueChange={(next) =>
                  setDraft((now) => ({ ...now, soundEnhancerLevel: next as number }))
                }
              />
              <span style={SLIDER_LABEL}>High</span>
            </div>
          </PreferencesWindowRow>
          <PreferencesWindowRow align="center" style={LAST_ROW}>
            {box("soundCheck", "Sound Check")}
          </PreferencesWindowRow>
        </>,
      )}
      {pane(
        "files",
        <>
          <PreferencesWindowRow label="Media folder:" align="center" style={ROW}>
            {box("keepOrganized", "Keep Music Media folder organized")}
          </PreferencesWindowRow>
          <PreferencesWindowRow align="center" style={LAST_ROW}>
            {box("copyFiles", "Copy files to Music Media folder")}
          </PreferencesWindowRow>
        </>,
      )}
      {pane(
        "restrictions",
        <>
          <PreferencesWindowRow label="Disable:" align="center" style={ROW}>
            {box("restrictStore", "iTunes Store")}
          </PreferencesWindowRow>
          <PreferencesWindowRow align="center" style={LAST_ROW}>
            {box("restrictShared", "Shared Libraries")}
          </PreferencesWindowRow>
          <Separator style={{ marginBlock: "11px 7px" }} />
          <PreferencesWindowRow label="Restrict:" align="center" style={LAST_ROW}>
            {box("restrictExplicit", "Music with explicit content")}
          </PreferencesWindowRow>
        </>,
      )}
      {pane(
        "advanced",
        <>
          <PreferencesWindowRow label="Library:" align="center" style={ROW}>
            {box("addToLibrary", "Add songs to Library when adding to playlists")}
          </PreferencesWindowRow>
          <PreferencesWindowRow align="center" style={LAST_ROW}>
            {box("updateArtwork", "Automatically update artwork")}
          </PreferencesWindowRow>
          <Separator style={{ marginBlock: "11px 7px" }} />
          <PreferencesWindowRow label="MiniPlayer:" align="center" style={LAST_ROW}>
            {box("miniPlayerOnTop", "Keep on top of all other windows")}
          </PreferencesWindowRow>
        </>,
      )}
    </PreferencesWindow>
  );
}
