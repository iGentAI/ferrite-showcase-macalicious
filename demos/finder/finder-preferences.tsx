"use client";

import { Checkbox } from "macalicious/checkbox";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PreferencesToolbar, PreferencesToolbarItem } from "macalicious/preferences-toolbar";
import {
  PreferencesWindow,
  PreferencesWindowForm,
  PreferencesWindowPane,
  type PreferencesWindowProps,
} from "macalicious/preferences-window";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { TagDot } from "macalicious/tag-dot";
import type { ReactNode } from "react";
import { readBoolean, useDesktopSetting } from "../desktop/desktop-personal";
import { COMPUTER_NAME, HOME, RECENTS, TAGS } from "./finder-data";
import {
  FINDER_FOLDERS_FIRST,
  FINDER_HIDDEN_MENU_TAGS,
  FINDER_HIDDEN_PLACES,
  FINDER_HIDDEN_TAGS,
  FINDER_NEW_WINDOW,
  FINDER_SEARCH_SCOPE,
  FINDER_SHOW_EXTERNAL,
  FINDER_SHOW_HARD_DISKS,
  FINDER_SHOWN_PLACES,
  FINDER_SIDEBAR_DISKS,
  FINDER_TRASH_AFTER_30,
  FINDER_WARN_EMPTY,
  FINDER_WARN_EXTENSION,
  NO_NAMES,
  OPTIONAL_PLACES,
  RECENT_TAGS,
  readNames,
  readScope,
  readText,
} from "./finder-saved";
import "./finder.tokens.css";
import "./finder-view-options.css";

const NOT_KEPT = "The drive does not keep this.";

/** Where a new window can open, by path. */
const NEW_WINDOW_PLACES: readonly (readonly [string, string])[] = [
  [RECENTS, "Recents"],
  [HOME, "Home"],
  [`${HOME}/Desktop`, "Desktop"],
  [`${HOME}/Documents`, "Documents"],
  [`${HOME}/Downloads`, "Downloads"],
];

/** The rows of the Sidebar pane: the label of each row Finder's sidebar can leave out. */
const SIDEBAR_ROWS: readonly (readonly [string, readonly string[]])[] = [
  ["Favorites", ["AirDrop", "Recents", "Applications", "Desktop", "Documents", "Downloads"]],
  ["Locations", [COMPUTER_NAME]],
  ["Tags", [RECENT_TAGS]],
];

/** Stand-in pane icons, drawn for this demo: a tile with a mark, in the system colours. */
function PaneIcon({ color, mark }: { color: string; mark: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="6" fill={color} />
      <path d={mark} fill="none" stroke="#ffffff" strokeWidth="2" />
    </svg>
  );
}

const PANES = [
  ["general", "General", "var(--mac-color-system-gray)", "M10 10h12v12H10z"],
  ["tags", "Tags", "var(--mac-color-system-orange)", "M9 16l7-7h7v7l-7 7z"],
  ["sidebar", "Sidebar", "var(--mac-color-system-blue)", "M9 10h14v12H9zM14 10v12"],
  ["advanced", "Advanced", "var(--mac-color-system-gray)", "M16 9v14M9 16h14"],
] as const;

/** A checkbox on a yes-or-no setting of Finder's. */
function Option({
  setting,
  fallback,
  children,
}: {
  setting: string;
  fallback: boolean;
  children: string;
}) {
  const [checked, setChecked] = useDesktopSetting(setting, readBoolean, fallback);
  return (
    <Checkbox checked={checked} onCheckedChange={setChecked}>
      {children}
    </Checkbox>
  );
}

/** A checkbox on whether a name is in one of Finder's lists of what to leave out. */
function Shown({
  hidden,
  name,
  onHiddenChange,
  label,
  children,
}: {
  hidden: readonly string[];
  name: string;
  onHiddenChange: (next: readonly string[]) => void;
  /** What assistive technology calls it, where a name is listed twice in a pane. */
  label?: string;
  children?: ReactNode;
}) {
  return (
    <Checkbox
      aria-label={label}
      checked={!hidden.includes(name)}
      onCheckedChange={(shown) =>
        onHiddenChange(shown ? hidden.filter((each) => each !== name) : [...hidden, name])
      }
    >
      {children ?? name}
    </Checkbox>
  );
}

export type FinderPreferencesProps = Omit<PreferencesWindowProps, "toolbar" | "children">;

/** Finder's Preferences: General, Tags, Sidebar and Advanced, each changing what Finder does. */
export function FinderPreferences(props: FinderPreferencesProps) {
  const [newWindow, setNewWindow] = useDesktopSetting(FINDER_NEW_WINDOW, readText, HOME);
  const [hiddenPlaces, setHiddenPlaces] = useDesktopSetting(
    FINDER_HIDDEN_PLACES,
    readNames,
    NO_NAMES,
  );
  const [shownPlaces, setShownPlaces] = useDesktopSetting(FINDER_SHOWN_PLACES, readNames, NO_NAMES);
  const [hiddenTags, setHiddenTags] = useDesktopSetting(FINDER_HIDDEN_TAGS, readNames, NO_NAMES);
  const [hiddenMenuTags, setHiddenMenuTags] = useDesktopSetting(
    FINDER_HIDDEN_MENU_TAGS,
    readNames,
    NO_NAMES,
  );
  const [scope, setScope] = useDesktopSetting(FINDER_SEARCH_SCOPE, readScope, "folder");
  return (
    <PreferencesWindow
      width={420}
      toolbar={
        <PreferencesToolbar aria-label="Finder preferences">
          {PANES.map(([value, label, color, mark]) => (
            <PreferencesToolbarItem
              key={value}
              value={value}
              icon={<PaneIcon color={color} mark={mark} />}
            >
              {label}
            </PreferencesToolbarItem>
          ))}
        </PreferencesToolbar>
      }
      {...props}
    >
      <PreferencesWindowPane value="general">
        <PreferencesWindowForm className="mac-finder-options-body">
          <span>Show these items on the desktop:</span>
          <Option setting={FINDER_SHOW_HARD_DISKS} fallback>
            Hard disks
          </Option>
          <Option setting={FINDER_SHOW_EXTERNAL} fallback>
            External disks
          </Option>
          <Checkbox disabled title="The desktop has no discs.">
            CDs, DVDs, and iPods
          </Checkbox>
          <Checkbox disabled title="The desktop connects to no servers.">
            Connected servers
          </Checkbox>
          <Label className="mac-finder-options-row">
            <span>New Finder windows show:</span>
            <PopUpButton
              aria-label="New Finder windows show"
              value={newWindow}
              onValueChange={(value) => setNewWindow(String(value))}
            >
              {NEW_WINDOW_PLACES.map(([path, label]) => (
                <PopUpButtonItem key={path} value={path}>
                  {label}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </Label>
          <Checkbox disabled title="A folder opens in the window it was opened from.">
            Open folders in tabs instead of new windows
          </Checkbox>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="tags">
        <PreferencesWindowForm className="mac-finder-options-body">
          <span>Show these tags in the sidebar:</span>
          {TAGS.map(({ name, color }) => (
            <Shown key={name} hidden={hiddenTags} name={name} onHiddenChange={setHiddenTags}>
              <span className="mac-finder-options-tag">
                <TagDot color={color} size="small" />
                {name}
              </span>
            </Shown>
          ))}
          <span>Favorite Tags, shown in Finder's menus:</span>
          {TAGS.map(({ name, color }) => (
            <Shown
              key={name}
              hidden={hiddenMenuTags}
              name={name}
              onHiddenChange={setHiddenMenuTags}
              label={`${name} in menus`}
            >
              <span className="mac-finder-options-tag">
                <TagDot color={color} size="small" />
                {name}
              </span>
            </Shown>
          ))}
        </PreferencesWindowForm>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="sidebar">
        <PreferencesWindowForm className="mac-finder-options-body">
          <span>Show these items in the sidebar:</span>
          {SIDEBAR_ROWS.map(([section, rows]) => (
            <div key={section} className="mac-finder-options-stack">
              <span>{section}</span>
              {rows.map((row) => (
                <Shown
                  key={row}
                  hidden={hiddenPlaces}
                  name={row}
                  onHiddenChange={setHiddenPlaces}
                />
              ))}
              {section === "Favorites"
                ? OPTIONAL_PLACES.map((row) => (
                    <Checkbox
                      key={row}
                      checked={shownPlaces.includes(row)}
                      onCheckedChange={(shown) =>
                        setShownPlaces(
                          shown
                            ? [...shownPlaces, row]
                            : shownPlaces.filter((each) => each !== row),
                        )
                      }
                    >
                      {row}
                    </Checkbox>
                  ))
                : null}
              {section === "Locations"
                ? [
                    <Option key="disks" setting={FINDER_SIDEBAR_DISKS} fallback={false}>
                      Hard disks
                    </Option>,
                    ...[
                      ["External disks", "A web page has no external disks."],
                      ["CDs, DVDs, and iOS Devices", "A web page has no discs or devices."],
                      ["Bonjour computers", "A web page finds no computers nearby."],
                      ["Connected servers", "The desktop connects to no servers."],
                    ].map(([label, reason]) => (
                      <Checkbox key={label} disabled title={reason}>
                        {label}
                      </Checkbox>
                    )),
                  ]
                : null}
            </div>
          ))}
        </PreferencesWindowForm>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="advanced">
        <PreferencesWindowForm className="mac-finder-options-body">
          <Checkbox disabled checked title="Names always show what the drive keeps.">
            Show all filename extensions
          </Checkbox>
          <Option setting={FINDER_WARN_EXTENSION} fallback>
            Show warning before changing an extension
          </Option>
          <Checkbox disabled title={NOT_KEPT}>
            Show warning before removing from iCloud Drive
          </Checkbox>
          <Option setting={FINDER_WARN_EMPTY} fallback>
            Show warning before emptying the Trash
          </Option>
          <Option setting={FINDER_TRASH_AFTER_30} fallback={false}>
            Remove items from the Trash after 30 days
          </Option>
          <span>Keep folders on top:</span>
          <Option setting={FINDER_FOLDERS_FIRST} fallback={false}>
            In windows when sorting by name
          </Option>
          <RadioGroup
            aria-label="When performing a search"
            className="mac-finder-options-group"
            value={scope}
            onValueChange={(value) => setScope(value === "mac" ? "mac" : "folder")}
          >
            <span>When performing a search:</span>
            <RadioButton value="mac">Search This Mac</RadioButton>
            <RadioButton value="folder">Search the Current Folder</RadioButton>
          </RadioGroup>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
