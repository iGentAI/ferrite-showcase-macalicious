"use client";

import { Checkbox } from "macalicious/checkbox";
import { ColorWell } from "macalicious/color-well";
import { DefaultButton } from "macalicious/default-button";
import { GradientButton, GradientButtonGroup } from "macalicious/gradient-button";
import { Label } from "macalicious/label";
import { ListView } from "macalicious/list-view";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PreferencesToolbar, PreferencesToolbarItem } from "macalicious/preferences-toolbar";
import {
  PreferencesWindow,
  PreferencesWindowForm,
  PreferencesWindowPane,
  PreferencesWindowRow,
} from "macalicious/preferences-window";
import { PushButton } from "macalicious/push-button";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { Sheet, SheetActions, SheetDescription, SheetPopup, SheetTitle } from "macalicious/sheet";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { TextField } from "macalicious/text-field";
import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { type DriveEntry, driveAvailable, readFile } from "../desktop/desktop-files";
import {
  DriveOpenPanel,
  DriveSavePanel,
  type DriveSaveTarget,
  saveToDrive,
} from "../finder/finder-file-dialogs";
import {
  type AskBeforeClosing,
  addProfile,
  changeProfile,
  frameOfProfile,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  profileFromFile,
  profileNamed,
  profileNames,
  profileToFile,
  removeProfile,
  renameProfile,
  restoreDefaultProfiles,
  type TerminalProfile,
  type TerminalSettings,
  type WhenShellExits,
} from "./terminal-profiles";

/** The fonts the Text tab offers: the fixed-width ones a Mac has, each falling back to the system's. */
export const TERMINAL_FONTS: readonly (readonly [name: string, family: string | null])[] = [
  ["SF Mono", null],
  ["Menlo", "Menlo, var(--mac-font-family-monospace)"],
  ["Monaco", "Monaco, var(--mac-font-family-monospace)"],
  ["Courier", "Courier, var(--mac-font-family-monospace)"],
  ["Andale Mono", "'Andale Mono', var(--mac-font-family-monospace)"],
];

export const NO_DRIVE_REASON = "This build has no drive to keep a file on";

/** Why the Encodings pane has nothing to choose. */
export const ENCODING_REASON =
  "This terminal is the page's text, which is UTF-8 only: no other encoding reaches it";

const ENCODINGS = [
  "Unicode (UTF-8)",
  "Western (ASCII)",
  "Western (Mac OS Roman)",
  "Western (ISO Latin 1)",
  "Western (Windows Latin 1)",
  "Japanese (Shift JIS)",
  "Japanese (EUC)",
  "Simplified Chinese (GB 18030)",
  "Traditional Chinese (Big 5)",
  "Korean (EUC)",
  "Cyrillic (KOI8-R)",
];

/** A colour well's value for a colour of `null`: Basic's in the page's appearance. */
export function shownColour(colour: string | null, dark: string, light: string): string {
  if (colour) return colour;
  return typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-appearance") === "dark"
    ? dark
    : light;
}

const COLOUR_ROWS: readonly (readonly [
  key: "background" | "foreground" | "bold" | "selection" | "cursor",
  label: string,
  dark: string,
  light: string,
])[] = [
  ["background", "Background:", "#1e1e1e", "#ffffff"],
  ["foreground", "Text:", "#ffffff", "#000000"],
  ["bold", "Bold Text:", "#ffffff", "#000000"],
  ["selection", "Selection:", "#3f638b", "#b3d7ff"],
  ["cursor", "Cursor:", "#ffffff", "#7f7f7f"],
];

function PaneGlyph({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
      <path d={path} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

const GLYPHS = {
  general:
    "M14 3h4l1 4 3 1.2 3.6-2.1 2.8 2.8-2.1 3.6L27 15v2l-4 1-1.200 3 2.100 3.600-2.800 2.800-3.600-2.100L15.500 27h-3l-1-4-3-1.200-3.600 2.100-2.800-2.800 2.100-3.600L3 17v-3l4-1 1.200-3-2.100-3.600 2.800-2.800 3.600 2.100zM16 11a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  profiles: "M4 6h24v20H4zM6 10v14h20V10zM8 13l5 3-5 3v-2l2-1-2-1zM14 19h5v1.500h-5z",
  groups: "M3 5h17v13H3zM5 9v7h13V9zM12 14h17v13H12v-7h2v5h13v-7h-7v-2z",
  encodings: "M5 5h22v3H5zM5 11h14v3H5zM5 17h22v3H5zM5 23h14v3H5z",
};

interface ProfileEditorProps {
  profile: TerminalProfile;
  change: (change: Partial<TerminalProfile>) => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <PreferencesWindowRow label={label}>{children}</PreferencesWindowRow>;
}

function TextTab({ profile, change }: ProfileEditorProps) {
  const font = TERMINAL_FONTS.find(([, family]) => family === profile.fontFamily)?.[0] ?? "SF Mono";
  return (
    <PreferencesWindowForm>
      <Row label="Font:">
        <PopUpButton
          aria-label="Font"
          value={font}
          onValueChange={(name) =>
            change({
              fontFamily: TERMINAL_FONTS.find(([each]) => each === name)?.[1] ?? null,
            })
          }
        >
          {TERMINAL_FONTS.map(([name]) => (
            <PopUpButtonItem key={name} value={name}>
              {name}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      </Row>
      <Row label="Size:">
        <TextField
          aria-label="Font size"
          type="number"
          min={MIN_FONT_SIZE}
          max={MAX_FONT_SIZE}
          value={profile.fontSize}
          onChange={(event) => {
            const size = Number(event.currentTarget.value);
            if (Number.isInteger(size) && size >= MIN_FONT_SIZE && size <= MAX_FONT_SIZE) {
              change({ fontSize: size });
            }
          }}
          style={{ width: 56 }}
        />
      </Row>
      {COLOUR_ROWS.map(([key, label, dark, light]) => (
        <Row key={key} label={label}>
          <ColorWell
            aria-label={label.slice(0, -1)}
            value={shownColour(profile[key], dark, light)}
            onChange={(event) => change({ [key]: event.currentTarget.value })}
          />
        </Row>
      ))}
      <Row label="Cursor Style:">
        <RadioGroup
          aria-label="Cursor shape"
          value={profile.cursorShape}
          onValueChange={(cursorShape) =>
            change({ cursorShape: cursorShape as TerminalProfile["cursorShape"] })
          }
        >
          <RadioButton value="block">Block</RadioButton>
          <RadioButton value="underline">Underline</RadioButton>
          <RadioButton value="bar">Vertical Bar</RadioButton>
        </RadioGroup>
      </Row>
      <Checkbox
        checked={profile.cursorBlink}
        onCheckedChange={(cursorBlink) => change({ cursorBlink })}
      >
        Blink cursor
      </Checkbox>
    </PreferencesWindowForm>
  );
}

function WindowTabPane({ profile, change }: ProfileEditorProps) {
  const whole = (value: string, least: number, most: number) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= least && number <= most ? number : undefined;
  };
  const { width, height } = frameOfProfile(profile);
  return (
    <PreferencesWindowForm>
      <Row label="Title:">
        <TextField
          aria-label="Window title"
          value={profile.windowTitle}
          placeholder="Terminal"
          onChange={(event) => change({ windowTitle: event.currentTarget.value })}
        />
      </Row>
      <Checkbox
        checked={profile.showDirectory}
        onCheckedChange={(showDirectory) => change({ showDirectory })}
      >
        Working directory or document
      </Checkbox>
      <Checkbox
        checked={profile.showProcess}
        onCheckedChange={(showProcess) => change({ showProcess })}
      >
        Active process name
      </Checkbox>
      <Checkbox checked={profile.showSize} onCheckedChange={(showSize) => change({ showSize })}>
        Dimensions
      </Checkbox>
      <Row label="Window Size:">
        <span className="mac-terminal-size-row">
          <TextField
            aria-label="Columns"
            type="number"
            value={profile.columns}
            onChange={(event) => {
              const columns = whole(event.currentTarget.value, 20, 400);
              if (columns) change({ columns });
            }}
            style={{ width: 56 }}
          />
          <Label>Columns</Label>
          <TextField
            aria-label="Rows"
            type="number"
            value={profile.rows}
            onChange={(event) => {
              const rows = whole(event.currentTarget.value, 2, 200);
              if (rows) change({ rows });
            }}
            style={{ width: 56 }}
          />
          <Label>Rows</Label>
        </span>
      </Row>
      <Label textStyle="small">
        A new window of this profile opens at {width}×{height}. Scrollback is the terminal's 10,000
        rows, in every profile.
      </Label>
    </PreferencesWindowForm>
  );
}

function TabTabPane({ profile, change }: ProfileEditorProps) {
  return (
    <PreferencesWindowForm>
      <Row label="Title:">
        <TextField
          aria-label="Tab title"
          value={profile.tabTitle}
          onChange={(event) => change({ tabTitle: event.currentTarget.value })}
        />
      </Row>
      <Checkbox
        checked={profile.tabShowProcess}
        onCheckedChange={(tabShowProcess) => change({ tabShowProcess })}
      >
        Active process name
      </Checkbox>
    </PreferencesWindowForm>
  );
}

function ShellTab({ profile, change }: ProfileEditorProps) {
  return (
    <PreferencesWindowForm>
      <Row label="Run command:">
        <TextField
          aria-label="Run command"
          value={profile.startupCommand}
          onChange={(event) => change({ startupCommand: event.currentTarget.value })}
        />
      </Row>
      <Checkbox
        checked={profile.startupInShell}
        onCheckedChange={(startupInShell) => change({ startupInShell })}
      >
        Run inside shell
      </Checkbox>
      <Row label="When the shell exits:">
        <PopUpButton
          aria-label="When the shell exits"
          value={profile.whenExits}
          onValueChange={(whenExits) => change({ whenExits: whenExits as WhenShellExits })}
        >
          <PopUpButtonItem value="keep">Don’t close the window</PopUpButtonItem>
          <PopUpButtonItem value="close-clean">Close if the shell exited cleanly</PopUpButtonItem>
          <PopUpButtonItem value="close">Close the window</PopUpButtonItem>
        </PopUpButton>
      </Row>
      <Row label="Ask before closing:">
        <PopUpButton
          aria-label="Ask before closing"
          value={profile.askBeforeClosing}
          onValueChange={(askBeforeClosing) =>
            change({ askBeforeClosing: askBeforeClosing as AskBeforeClosing })
          }
        >
          <PopUpButtonItem value="always">Always</PopUpButtonItem>
          <PopUpButtonItem value="never">Never</PopUpButtonItem>
          <PopUpButtonItem value="running">Only if a command is running</PopUpButtonItem>
        </PopUpButton>
      </Row>
    </PreferencesWindowForm>
  );
}

function KeyboardTab({ profile, change }: ProfileEditorProps) {
  return (
    <PreferencesWindowForm>
      <Checkbox
        checked={profile.optionAsMeta}
        onCheckedChange={(optionAsMeta) => change({ optionAsMeta })}
      >
        Use Option as Meta key
      </Checkbox>
      <Label textStyle="small">
        The keys a program reads are the terminal's fixed ones: this Terminal has no table of them
        to change.
      </Label>
    </PreferencesWindowForm>
  );
}

function AdvancedTab({ profile, change }: ProfileEditorProps) {
  return (
    <PreferencesWindowForm>
      <Row label="Declare terminal as:">
        <PopUpButton aria-label="Declare terminal as" value="xterm-256color" disabled>
          <PopUpButtonItem value="xterm-256color">xterm-256color</PopUpButtonItem>
        </PopUpButton>
      </Row>
      <Row label="Bell:">
        <span className="mac-terminal-checks">
          <Checkbox
            checked={profile.audibleBell}
            onCheckedChange={(audibleBell) => change({ audibleBell })}
          >
            Audible bell
          </Checkbox>
          <Checkbox
            checked={profile.visualBell}
            onCheckedChange={(visualBell) => change({ visualBell })}
          >
            Visual bell
          </Checkbox>
        </span>
      </Row>
      <Row label="Text encoding:">
        <PopUpButton aria-label="Text encoding" value="utf-8" disabled title={ENCODING_REASON}>
          <PopUpButtonItem value="utf-8">Unicode (UTF-8)</PopUpButtonItem>
        </PopUpButton>
      </Row>
    </PreferencesWindowForm>
  );
}

const EDITOR_TABS: readonly (readonly [
  value: string,
  label: string,
  Pane: (props: ProfileEditorProps) => ReactNode,
])[] = [
  ["text", "Text", TextTab],
  ["window", "Window", WindowTabPane],
  ["tab", "Tab", TabTabPane],
  ["shell", "Shell", ShellTab],
  ["keyboard", "Keyboard", KeyboardTab],
  ["advanced", "Advanced", AdvancedTab],
];

export interface ExportFileSheetProps {
  /** The file's name at first; `null` while the sheet is closed. */
  name: string | null;
  anchor: Element | null;
  /** The file's contents, read as Save is pressed. */
  contents: () => string;
  /** The extension the file keeps, with its dot. */
  extension: string;
  type: string;
  onClose: () => void;
}

/** The Save sheet that writes a text to the person's drive. */
export function ExportFileSheet({
  name,
  anchor,
  contents,
  extension,
  type,
  onClose,
}: ExportFileSheetProps) {
  const [problem, setProblem] = useState<string | null>(null);
  const open = name !== null;
  const save = (target: DriveSaveTarget) => {
    saveToDrive(target, new Blob([contents()], { type })).then(onClose, (error: Error) =>
      setProblem(error.message),
    );
  };
  const close = () => {
    setProblem(null);
    onClose();
  };
  return (
    <Sheet open={open} onOpenChange={(next) => next || close()}>
      <SheetPopup anchor={anchor ?? undefined} width={problem ? 360 : 640} aria-label="Export">
        {open && problem ? (
          <>
            <SheetTitle>The file could not be saved</SheetTitle>
            <SheetDescription>{problem}</SheetDescription>
            <SheetActions>
              <DefaultButton onClick={close}>OK</DefaultButton>
            </SheetActions>
          </>
        ) : open ? (
          <DriveSavePanel
            defaultName={name}
            nameToSave={(typed) => (typed.endsWith(extension) ? typed : `${typed}${extension}`)}
            onSave={save}
            onCancel={close}
          />
        ) : null}
      </SheetPopup>
    </Sheet>
  );
}

/** The Open panel for a `.terminal` file on the person's drive. */
export function ImportProfilePanel({
  onImported,
  onClose,
}: {
  onImported: (profile: Partial<TerminalProfile>) => void;
  onClose: () => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const open = (entry: DriveEntry) => {
    readFile(entry.id)
      .then((file) => file.text())
      .then((text) => {
        const profile = profileFromFile(text);
        if (!profile) {
          setProblem(`“${entry.name}” is not a Terminal profile.`);
          return;
        }
        onImported(profile);
        onClose();
      })
      .catch((error: Error) => setProblem(error.message));
  };
  return createPortal(
    <div className="mac-terminal-panel-layer">
      {problem ? (
        <div className="mac-terminal-panel" role="alert">
          <Label>{problem}</Label>
          <DefaultButton onClick={onClose}>OK</DefaultButton>
        </div>
      ) : (
        <DriveOpenPanel
          accept={(entry) => entry.kind === "file" && /\.terminal$/i.test(entry.name)}
          onOpen={open}
          onCancel={onClose}
        />
      )}
    </div>,
    document.body,
  );
}

export interface TerminalPreferencesProps {
  windowProps: ManagedWindowRenderProps;
  settings: TerminalSettings;
  changeSettings: (change: (settings: TerminalSettings) => TerminalSettings) => void;
  /** Too much to keep: the last change holds only until a reload. */
  tooLong?: boolean;
}

/** Terminal's Preferences window: General, Profiles, Window Groups and Encodings. */
export function TerminalPreferences({
  windowProps,
  settings,
  changeSettings,
  tooLong,
}: TerminalPreferencesProps) {
  const {
    onMinimize: _onMinimize,
    onZoom: _onZoom,
    zoomRole: _zoomRole,
    minimizeDisabled: _minimizeDisabled,
    zoomDisabled: _zoomDisabled,
    ...rest
  } = windowProps;
  const names = profileNames(settings);
  const [selected, setSelected] = useState(settings.defaultProfile);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const shownName = names.includes(selected) ? selected : (names[0] as string);
  const profile = profileNamed(settings, shownName);
  const own = settings.own.includes(shownName);
  const change = (part: Partial<TerminalProfile>) =>
    changeSettings((current) => changeProfile(current, shownName, part));
  const names2 = (value: string) => (
    <PopUpButtonItem key={value} value={value}>
      {value}
    </PopUpButtonItem>
  );

  return (
    <PreferencesWindow
      {...rest}
      ref={setRoot}
      width={680}
      toolbar={
        <PreferencesToolbar aria-label="Preferences">
          <PreferencesToolbarItem value="general" icon={<PaneGlyph path={GLYPHS.general} />}>
            General
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="profiles" icon={<PaneGlyph path={GLYPHS.profiles} />}>
            Profiles
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="groups" icon={<PaneGlyph path={GLYPHS.groups} />}>
            Window Groups
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="encodings" icon={<PaneGlyph path={GLYPHS.encodings} />}>
            Encodings
          </PreferencesToolbarItem>
        </PreferencesToolbar>
      }
    >
      <PreferencesWindowPane value="general">
        <PreferencesWindowForm>
          <Row label="On startup, open:">
            <RadioGroup
              aria-label="On startup, open"
              value={settings.startup}
              onValueChange={(startup) =>
                changeSettings((current) => ({
                  ...current,
                  startup: startup as TerminalSettings["startup"],
                }))
              }
            >
              <RadioButton value="profile">New window with profile:</RadioButton>
              <PopUpButton
                aria-label="Profile at startup"
                value={settings.startupProfile}
                onValueChange={(startupProfile) =>
                  changeSettings((current) => ({
                    ...current,
                    startupProfile: startupProfile ?? current.startupProfile,
                  }))
                }
              >
                {names.map(names2)}
              </PopUpButton>
              <RadioButton value="group" disabled={settings.groups.length === 0}>
                New window group:
              </RadioButton>
              <PopUpButton
                aria-label="Window Group at startup"
                value={settings.startupGroup}
                disabled={settings.groups.length === 0}
                onValueChange={(startupGroup) =>
                  changeSettings((current) => ({
                    ...current,
                    startupGroup: startupGroup ?? current.startupGroup,
                  }))
                }
              >
                {settings.groups.map(({ name }) => names2(name))}
              </PopUpButton>
            </RadioGroup>
          </Row>
          <Row label="New windows open with:">
            <PopUpButton
              aria-label="New windows open with"
              value={settings.newWindowProfile}
              onValueChange={(newWindowProfile) =>
                changeSettings((current) => ({
                  ...current,
                  newWindowProfile: newWindowProfile as TerminalSettings["newWindowProfile"],
                }))
              }
            >
              <PopUpButtonItem value="default">Default Profile</PopUpButtonItem>
              <PopUpButtonItem value="same">Same Profile</PopUpButtonItem>
            </PopUpButton>
            <PopUpButton
              aria-label="New windows open in"
              value={settings.newWindowFolder}
              onValueChange={(newWindowFolder) =>
                changeSettings((current) => ({
                  ...current,
                  newWindowFolder: newWindowFolder as TerminalSettings["newWindowFolder"],
                }))
              }
            >
              <PopUpButtonItem value="same">Same Working Directory</PopUpButtonItem>
              <PopUpButtonItem value="home">Default Working Directory</PopUpButtonItem>
            </PopUpButton>
          </Row>
          <Row label="New tabs open with:">
            <PopUpButton
              aria-label="New tabs open with"
              value={settings.newTabProfile}
              onValueChange={(newTabProfile) =>
                changeSettings((current) => ({
                  ...current,
                  newTabProfile: newTabProfile as TerminalSettings["newTabProfile"],
                }))
              }
            >
              <PopUpButtonItem value="same">Same Profile</PopUpButtonItem>
              <PopUpButtonItem value="default">Default Profile</PopUpButtonItem>
            </PopUpButton>
            <PopUpButton
              aria-label="New tabs open in"
              value={settings.newTabFolder}
              onValueChange={(newTabFolder) =>
                changeSettings((current) => ({
                  ...current,
                  newTabFolder: newTabFolder as TerminalSettings["newTabFolder"],
                }))
              }
            >
              <PopUpButtonItem value="same">Same Working Directory</PopUpButtonItem>
              <PopUpButtonItem value="home">Default Working Directory</PopUpButtonItem>
            </PopUpButton>
          </Row>
          <Label textStyle="small">
            Shells open with this page's simulated zsh: no other shell runs in a browser.
          </Label>
          {tooLong ? (
            <Label textStyle="small" role="alert">
              Your settings have grown too large to keep. The last change holds until you reload.
            </Label>
          ) : null}
        </PreferencesWindowForm>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="profiles">
        <div className="mac-terminal-profiles">
          <div className="mac-terminal-profile-list">
            <ListView
              aria-label="Profiles"
              count={names.length}
              rowHeight={46}
              style={{ height: 300 }}
              value={[shownName]}
              getRowId={(index) => names[index] as string}
              getRowLabel={(index) => names[index] as string}
              onValueChange={(value) => {
                const next = value[0];
                if (typeof next === "string") setSelected(next);
              }}
              renderRow={(index) => {
                const each = profileNamed(settings, names[index] as string);
                return (
                  <span className="mac-terminal-profile-row">
                    <span
                      aria-hidden="true"
                      className="mac-terminal-profile-tile"
                      style={{
                        color: shownColour(each.foreground, "#ffffff", "#000000"),
                        background: shownColour(each.background, "#1e1e1e", "#ffffff"),
                      }}
                    >
                      Text
                    </span>
                    <span>
                      {each.name}
                      {each.name === settings.defaultProfile ? (
                        <Label textStyle="small">Default</Label>
                      ) : null}
                    </span>
                  </span>
                );
              }}
            />
            <GradientButtonGroup aria-label="Profiles">
              <GradientButton
                glyph="add"
                aria-label="New profile"
                onClick={() =>
                  changeSettings((current) => {
                    const added = addProfile(current, "New Profile");
                    setSelected(added.name);
                    return added.settings;
                  })
                }
              />
              <GradientButton
                glyph="remove"
                aria-label="Remove profile"
                disabled={names.length <= 1}
                onClick={() => changeSettings((current) => removeProfile(current, shownName))}
              />
            </GradientButtonGroup>
            <div className="mac-terminal-profile-actions">
              <PushButton
                size="small"
                disabled={settings.defaultProfile === shownName}
                onClick={() =>
                  changeSettings((current) => ({ ...current, defaultProfile: shownName }))
                }
              >
                Default
              </PushButton>
              <PushButton
                size="small"
                onClick={() =>
                  changeSettings((current) => {
                    const added = addProfile(current, `${shownName} Copy`, profile);
                    setSelected(added.name);
                    return added.settings;
                  })
                }
              >
                Duplicate
              </PushButton>
              <PushButton
                size="small"
                onClick={() => changeSettings((current) => restoreDefaultProfiles(current))}
              >
                Restore Defaults
              </PushButton>
              <PushButton
                size="small"
                disabled={!driveAvailable()}
                title={driveAvailable() ? undefined : NO_DRIVE_REASON}
                onClick={() => setImporting(true)}
              >
                Import…
              </PushButton>
              <PushButton
                size="small"
                disabled={!driveAvailable()}
                title={driveAvailable() ? undefined : NO_DRIVE_REASON}
                onClick={() => setExporting(true)}
              >
                Export…
              </PushButton>
            </div>
          </div>
          <div className="mac-terminal-profile-editor">
            <PreferencesWindowForm>
              <Row label="Name:">
                <TextField
                  key={shownName}
                  aria-label="Profile name"
                  defaultValue={shownName}
                  disabled={!own}
                  title={own ? undefined : "A profile a Mac comes with keeps its name"}
                  onBlur={(event) => {
                    const typed = event.currentTarget.value;
                    changeSettings((current) => renameProfile(current, shownName, typed));
                    if (typed.trim()) setSelected(typed.trim());
                  }}
                />
              </Row>
            </PreferencesWindowForm>
            <TabView defaultValue="text">
              <TabViewList aria-label="Profile">
                {EDITOR_TABS.map(([value, label]) => (
                  <TabViewTab key={value} value={value}>
                    {label}
                  </TabViewTab>
                ))}
              </TabViewList>
              {EDITOR_TABS.map(([value, , Pane]) => (
                <TabViewPanel key={value} value={value}>
                  <Pane profile={profile} change={change} />
                </TabViewPanel>
              ))}
            </TabView>
          </div>
        </div>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="groups">
        <div className="mac-terminal-groups">
          {settings.groups.length === 0 ? (
            <Label textStyle="small">
              No Window Groups yet. Choose Window &gt; Save Windows as Group to keep the open
              windows, their tabs and their folders as one.
            </Label>
          ) : (
            <ul aria-label="Window Groups">
              {settings.groups.map((group) => (
                <li key={group.name}>
                  <span>
                    {group.name} (
                    {group.windows.length === 1 ? "1 window" : `${group.windows.length} windows`})
                  </span>
                  <PushButton
                    size="small"
                    aria-label={`Remove ${group.name}`}
                    onClick={() =>
                      changeSettings((current) => ({
                        ...current,
                        groups: current.groups.filter((each) => each.name !== group.name),
                        startupGroup:
                          current.startupGroup === group.name ? "" : current.startupGroup,
                        startup: current.startupGroup === group.name ? "profile" : current.startup,
                      }))
                    }
                  >
                    Remove
                  </PushButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="encodings">
        <div className="mac-terminal-groups">
          <Label textStyle="small">{ENCODING_REASON}.</Label>
          <div className="mac-terminal-checks">
            {ENCODINGS.map((name) => (
              <Checkbox
                key={name}
                disabled
                title={ENCODING_REASON}
                checked={name === "Unicode (UTF-8)"}
              >
                {name}
              </Checkbox>
            ))}
          </div>
        </div>
      </PreferencesWindowPane>
      {importing ? (
        <ImportProfilePanel
          onClose={() => setImporting(false)}
          onImported={(imported) =>
            changeSettings((current) => {
              const added = addProfile(current, imported.name ?? "Imported", imported);
              setSelected(added.name);
              return added.settings;
            })
          }
        />
      ) : null}
      <ExportFileSheet
        name={exporting ? `${shownName}.terminal` : null}
        anchor={root}
        contents={() => profileToFile(profile)}
        extension=".terminal"
        type="application/x-apple-terminal"
        onClose={() => setExporting(false)}
      />
    </PreferencesWindow>
  );
}

export interface NewCommandSheetProps {
  open: boolean;
  anchor: Element | null;
  profiles: readonly string[];
  profile: string;
  onRun: (command: { command: string; inShell: boolean; profile: string }) => void;
  onClose: () => void;
}

/** Shell > New Command: what to run, in a new window. */
export function NewCommandSheet({
  open,
  anchor,
  profiles,
  profile,
  onRun,
  onClose,
}: NewCommandSheetProps) {
  const [command, setCommand] = useState("");
  const [inShell, setInShell] = useState(true);
  const [chosen, setChosen] = useState<string | null>(null);
  const run = () => {
    onRun({ command: command.trim(), inShell, profile: chosen ?? profile });
    onClose();
  };
  return (
    <Sheet open={open} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor ?? undefined} width={420} aria-label="New Command">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (command.trim()) run();
          }}
        >
          <SheetTitle>New Command</SheetTitle>
          <div className="mac-terminal-sheet-rows">
            <TextField
              aria-label="Command"
              autoFocus
              value={command}
              onChange={(event) => setCommand(event.currentTarget.value)}
            />
            <Checkbox checked={inShell} onCheckedChange={setInShell}>
              Run command inside a shell
            </Checkbox>
            <PopUpButton
              aria-label="Profile"
              value={chosen ?? profile}
              onValueChange={(value) => setChosen(value)}
            >
              {profiles.map((name) => (
                <PopUpButtonItem key={name} value={name}>
                  {name}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </div>
          <SheetActions>
            <PushButton onClick={onClose}>Cancel</PushButton>
            <DefaultButton type="submit" disabled={!command.trim()}>
              Run
            </DefaultButton>
          </SheetActions>
        </form>
      </SheetPopup>
    </Sheet>
  );
}

export interface SaveGroupSheetProps {
  open: boolean;
  anchor: Element | null;
  onSave: (name: string) => void;
  onClose: () => void;
}

/** Window > Save Windows as Group. */
export function SaveGroupSheet({ open, anchor, onSave, onClose }: SaveGroupSheetProps) {
  const [name, setName] = useState("");
  return (
    <Sheet open={open} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor ?? undefined} width={360} aria-label="Save Windows as Group">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            onSave(name.trim());
            onClose();
          }}
        >
          <SheetTitle>Save Windows as Group</SheetTitle>
          <div className="mac-terminal-sheet-rows">
            <TextField
              aria-label="Window Group name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </div>
          <SheetActions>
            <PushButton onClick={onClose}>Cancel</PushButton>
            <DefaultButton type="submit" disabled={!name.trim()}>
              Save
            </DefaultButton>
          </SheetActions>
        </form>
      </SheetPopup>
    </Sheet>
  );
}
