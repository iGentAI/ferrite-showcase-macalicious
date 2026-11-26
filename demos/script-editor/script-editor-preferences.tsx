"use client";

import { Checkbox } from "macalicious/checkbox";
import { ColorWell } from "macalicious/color-well";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PreferencesToolbar, PreferencesToolbarItem } from "macalicious/preferences-toolbar";
import {
  PreferencesWindow,
  PreferencesWindowForm,
  PreferencesWindowPane,
  type PreferencesWindowProps,
  PreferencesWindowRow,
} from "macalicious/preferences-window";
import { PushButton } from "macalicious/push-button";
import { SystemImage } from "macalicious/system-image";
import type { CSSProperties } from "react";
import { readBoolean, useDesktopSetting } from "../desktop/desktop-personal";
import { LANGUAGES, type ScriptLanguage } from "./script-editor-data";
import {
  clearHistory,
  DEFAULT_HISTORY_SIZE,
  HISTORY_ENABLED,
  HISTORY_MOST,
  HISTORY_SIZES,
  readHistorySize,
  useLogHistory,
} from "./script-editor-history";
import { SCRIPT_MENU_SETTING } from "./script-editor-server";

/** Where the settings are kept among the person's desktop values, which every window reads. */
export const SCRIPT_EDITOR_SETTINGS = {
  wrapLines: "scriptEditor.wrapLines",
  wrapIndent: "scriptEditor.wrapIndent",
  tabWidth: "scriptEditor.tabWidth",
  spelling: "scriptEditor.spelling",
  assistant: "scriptEditor.assistant",
  escapeCompletes: "scriptEditor.escapeCompletes",
  defaultLanguage: "scriptEditor.defaultLanguage",
  formatting: "scriptEditor.formatting",
  ruler: "scriptEditor.ruler",
  tabs: "scriptEditor.tabs",
  hiddenTools: "scriptEditor.hiddenTools",
  scriptMenu: SCRIPT_MENU_SETTING,
} as const;

/** The tab widths on offer, in points; a level of 29 pt is what the app starts with. */
export const TAB_WIDTHS = [15, 22, 29, 36, 43] as const;
export const DEFAULT_TAB_WIDTH = 29;

export const readTabWidth = (stored: unknown): number | undefined =>
  TAB_WIDTHS.find((width) => width === stored);

/** Preferences > Editing's indent of a wrapped line's continuation, in points. */
export const WRAP_INDENTS = [0, 15, 29] as const;
export const readWrapIndent = (stored: unknown): number | undefined =>
  WRAP_INDENTS.find((width) => width === stored);

export const readLanguage = (stored: unknown): ScriptLanguage | undefined =>
  LANGUAGES.find((name) => name === stored);

/** Preferences > Formatting's rows: each sets one colour of the script's styles. */
export const FORMATTING_ROWS = [
  { id: "keyword", label: "Language keywords:", color: "#000000" },
  { id: "term", label: "Application keywords:", color: "#0432ff" },
  { id: "variable", label: "Variables:", color: "#4e8f00" },
  { id: "comment", label: "Comments:", color: "#5e6060" },
  { id: "string", label: "JavaScript strings:", color: "#c41a16" },
  { id: "number", label: "JavaScript numbers:", color: "#1c00cf" },
  { id: "pattern", label: "JavaScript patterns:", color: "#8a4b08" },
  { id: "template", label: "JavaScript template strings:", color: "#a2217f" },
] as const;
export type ScriptFormatting = Partial<Record<(typeof FORMATTING_ROWS)[number]["id"], string>>;
const NO_FORMATTING: ScriptFormatting = {};

export function readFormatting(stored: unknown): ScriptFormatting | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  return Object.fromEntries(
    Object.entries(stored).filter(
      ([id, color]) =>
        FORMATTING_ROWS.some((row) => row.id === id) &&
        typeof color === "string" &&
        /^#[0-9a-f]{6}$/i.test(color),
    ),
  );
}

/** The custom properties a script view takes its chosen colours from (script-editor.css). */
export const formattingStyle = (formatting: ScriptFormatting): CSSProperties =>
  Object.fromEntries(
    Object.entries(formatting).map(([id, color]) => [`--mac-script-editor-${id}`, color]),
  ) as CSSProperties;

/** Why Preferences > Plug-ins has nothing to add. */
export const NO_PLUG_INS =
  "A plug-in is compiled code for a Mac, which a web page cannot load. None are installed here.";

/** What the Preferences window takes: a window of the desktop. */
export type ScriptEditorPreferencesProps = Omit<
  PreferencesWindowProps,
  "toolbar" | "children" | "modal" | "title"
>;

/** Script Editor's Preferences: what a new script starts in and how scripts look, in every window. */
export function ScriptEditorPreferences(props: ScriptEditorPreferencesProps) {
  const [wrapLines, setWrapLines] = useDesktopSetting(
    SCRIPT_EDITOR_SETTINGS.wrapLines,
    readBoolean,
    false,
  );
  const [wrapIndent, setWrapIndent] = useDesktopSetting(
    SCRIPT_EDITOR_SETTINGS.wrapIndent,
    readWrapIndent,
    0,
  );
  const [tabWidth, setTabWidth] = useDesktopSetting(
    SCRIPT_EDITOR_SETTINGS.tabWidth,
    readTabWidth,
    DEFAULT_TAB_WIDTH,
  );
  const [assistant, setAssistant] = useDesktopSetting(
    SCRIPT_EDITOR_SETTINGS.assistant,
    readBoolean,
    true,
  );
  const [escapeCompletes, setEscapeCompletes] = useDesktopSetting(
    SCRIPT_EDITOR_SETTINGS.escapeCompletes,
    readBoolean,
    false,
  );
  const [language, setLanguage] = useDesktopSetting(
    SCRIPT_EDITOR_SETTINGS.defaultLanguage,
    readLanguage,
    "JavaScript",
  );
  const [formatting, setFormatting] = useDesktopSetting(
    SCRIPT_EDITOR_SETTINGS.formatting,
    readFormatting,
    NO_FORMATTING,
  );
  const [historyOn, setHistoryOn] = useDesktopSetting(HISTORY_ENABLED, readBoolean, true);
  const [historyMost, setHistoryMost] = useDesktopSetting(
    HISTORY_MOST,
    readHistorySize,
    DEFAULT_HISTORY_SIZE,
  );
  const history = useLogHistory();
  const [scriptMenu, setScriptMenu] = useDesktopSetting(
    SCRIPT_EDITOR_SETTINGS.scriptMenu,
    readBoolean,
    false,
  );
  return (
    <PreferencesWindow
      title="Script Editor Preferences"
      toolbar={
        <PreferencesToolbar aria-label="Script Editor preferences">
          <PreferencesToolbarItem value="general" icon={<SystemImage name="action" />}>
            General
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="editing" icon={<SystemImage name="list-view" />}>
            Editing
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="formatting" icon={<SystemImage name="action" />}>
            Formatting
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="history" icon={<SystemImage name="list-view" />}>
            History
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="plug-ins" icon={<SystemImage name="action" />}>
            Plug-ins
          </PreferencesToolbarItem>
        </PreferencesToolbar>
      }
      defaultValue="editing"
      width={460}
      {...props}
    >
      <PreferencesWindowPane value="general">
        <PreferencesWindowForm>
          <PreferencesWindowRow label="Default language:">
            <PopUpButton
              size="small"
              aria-label="Default language"
              value={language}
              onValueChange={(next) => {
                const chosen = readLanguage(next);
                if (chosen) setLanguage(chosen);
              }}
            >
              {LANGUAGES.map((name) => (
                <PopUpButtonItem key={name} value={name}>
                  {name}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="Script Menu:">
            <Checkbox checked={scriptMenu} onCheckedChange={(next) => setScriptMenu(next === true)}>
              Show Script menu in menu bar
            </Checkbox>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="editing">
        <PreferencesWindowForm>
          <PreferencesWindowRow label="Code completion:">
            <Checkbox checked={assistant} onCheckedChange={(next) => setAssistant(next === true)}>
              Use Script Assistant
            </Checkbox>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="Escape key:">
            <Checkbox
              checked={escapeCompletes}
              disabled={!assistant}
              onCheckedChange={(next) => setEscapeCompletes(next === true)}
            >
              Shows Script Assistant
            </Checkbox>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="Wrapping:">
            <Checkbox checked={wrapLines} onCheckedChange={(next) => setWrapLines(next === true)}>
              Wrap lines
            </Checkbox>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="Indent wrapped lines:">
            <PopUpButton
              size="small"
              aria-label="Indent wrapped lines"
              disabled={!wrapLines}
              value={String(wrapIndent)}
              onValueChange={(next) => next !== null && setWrapIndent(Number(next))}
            >
              {WRAP_INDENTS.map((width) => (
                <PopUpButtonItem key={width} value={String(width)}>
                  {width === 0 ? "Not indented" : `${width} points`}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="Tab width:">
            <PopUpButton
              size="small"
              aria-label="Tab width"
              value={String(tabWidth)}
              onValueChange={(next) => next && setTabWidth(Number(next))}
            >
              {TAB_WIDTHS.map((width) => (
                <PopUpButtonItem key={width} value={String(width)}>
                  {width} points
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="formatting">
        <PreferencesWindowForm>
          {FORMATTING_ROWS.map((row) => (
            <PreferencesWindowRow key={row.id} label={row.label}>
              <ColorWell
                aria-label={row.label.slice(0, -1)}
                value={formatting[row.id] ?? row.color}
                onValueChange={(color) => setFormatting({ ...formatting, [row.id]: color })}
              />
            </PreferencesWindowRow>
          ))}
          <PreferencesWindowRow>
            <PushButton size="small" onClick={() => setFormatting(NO_FORMATTING)}>
              Use Defaults
            </PushButton>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="history">
        <PreferencesWindowForm>
          <PreferencesWindowRow label="Log History:">
            <Checkbox checked={historyOn} onCheckedChange={(next) => setHistoryOn(next === true)}>
              Enable log history
            </Checkbox>
          </PreferencesWindowRow>
          <PreferencesWindowRow label="Maximum entries:">
            <PopUpButton
              size="small"
              aria-label="Maximum entries"
              disabled={!historyOn}
              value={String(historyMost)}
              onValueChange={(next) => next && setHistoryMost(Number(next))}
            >
              {HISTORY_SIZES.map((size) => (
                <PopUpButtonItem key={size} value={String(size)}>
                  {size}
                </PopUpButtonItem>
              ))}
            </PopUpButton>
          </PreferencesWindowRow>
          <PreferencesWindowRow>
            <PushButton size="small" disabled={history.length === 0} onClick={clearHistory}>
              Clear History
            </PushButton>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="plug-ins">
        <PreferencesWindowForm>
          <PreferencesWindowRow label="Plug-ins:">
            <Label>{NO_PLUG_INS}</Label>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
