"use client";

import { Checkbox } from "macalicious/checkbox";
import { HelpButton } from "macalicious/help-button";
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
import { TextField } from "macalicious/text-field";
import {
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useId,
  useSyncExternalStore,
} from "react";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { FolderGlyph, PaneIcon, StarGlyph } from "./safari-glyphs";
import {
  AUTO_READER,
  COMMAND_CLICK,
  changeSafariSetting,
  choiceOf,
  ENGINE_SUGGESTIONS,
  FIELD_FAVORITES,
  FULL_ADDRESS,
  MAKE_ACTIVE,
  optionOf,
  SAFE_FILES,
  type SafariPopUp,
  type SafariSettings,
  TAB_KEYS,
  useSafariSettings,
} from "./safari-settings";
import { frontSafariPage, subscribeSafariWindows } from "./safari-windows";
import "./safari.tokens.css";
import "./safari.css";

export interface SafariPreferencesProps
  extends Omit<PreferencesWindowProps, "toolbar" | "children" | "modal"> {
  /**
   * The address of the page in the front Safari window. “Set to Current Page” copies it to
   * the Homepage field and is disabled without it, as in the Dark Aqua capture.
   * @default the page in the front window of the Safari open beside it
   */
  currentPage?: string;
  /**
   * The homepage the field starts with until the person sets one.
   * @default "https://start.example/"; empty on the Ferrite desktop app
   */
  defaultHomepage?: string;
  /** Called with the new homepage when the field is edited or set to the current page. */
  onHomepageChange?: (homepage: string) => void;
  /**
   * Called when the primary pointer button goes down on the title bar or the toolbar's
   * surface, not on a control or a toolbar item: a window manager starts moving the window
   * here.
   */
  onDragRegionPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  /** Called when the title bar or the toolbar's surface is double-clicked. */
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
  /** Accepted from a window manager and not used: a preferences window is never minimized. */
  onMinimize?: (event: MouseEvent<HTMLElement>) => void;
  /** Accepted from a window manager and not used: a preferences window does not zoom. */
  onZoom?: (event: MouseEvent<HTMLElement>) => void;
  /** Accepted from a window manager and not used. */
  zoomRole?: "full-screen" | "zoom" | "exit-full-screen";
  /** Accepted from a window manager and not used: the minimize button is always disabled. */
  minimizeDisabled?: boolean;
  /** Accepted from a window manager and not used: the zoom button is always disabled. */
  zoomDisabled?: boolean;
}

/* The window's bar is its drag region, except for what takes a click itself. */
const onBar = (target: EventTarget) =>
  target instanceof Element &&
  target.closest("[data-window-drag-region]") !== null &&
  target.closest("button, [role='tab'], a[href], input") === null;

/* The ten panes of Safari 13, in toolbar order; icons are stand-ins in the system colours. */
const PANES = [
  ["general", "General", "var(--mac-color-system-gray)", "M11 10h10v12H11zM14 14h4"],
  ["tabs", "Tabs", "var(--mac-color-system-gray)", "M8 12h7v-2h9v12H8zM15 12h9"],
  ["autofill", "AutoFill", "var(--mac-color-system-orange)", "M9 23l2-6 9-9 4 4-9 9zM18 10l4 4"],
  [
    "passwords",
    "Passwords",
    "var(--mac-color-system-gray)",
    "M16 14a4 4 0 1 0 0-.1zM16 14v10M16 20h3",
  ],
  [
    "search",
    "Search",
    "var(--mac-color-system-gray)",
    "M19 14a5 5 0 1 1-10 0 5 5 0 0 1 10 0zM18 18l5 5",
  ],
  [
    "security",
    "Security",
    "var(--mac-color-system-yellow)",
    "M10 15h12v8H10zM12.5 15v-3a3.5 3.5 0 0 1 7 0v3",
  ],
  ["privacy", "Privacy", "var(--mac-color-system-blue)", "M12 22v-9M16 22V10M20 22v-9M12 22h8"],
  [
    "websites",
    "Websites",
    "var(--mac-color-system-blue)",
    "M24 16a8 8 0 1 1-16 0 8 8 0 0 1 16 0zM8 16h16M16 8c-4 4-4 12 0 16 4-4 4-12 0-16",
  ],
  [
    "extensions",
    "Extensions",
    "var(--mac-color-system-indigo)",
    "M10 12h5a2 2 0 1 1 4 0h3v4a2 2 0 1 0 0 4v3H10z",
  ],
  [
    "advanced",
    "Advanced",
    "var(--mac-color-system-gray)",
    "M20 16a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM16 8v3M16 21v3M8 16h3M21 16h3",
  ],
] as const;

/* The width of the control column of the General pane in the captures. */
const COLUMN = 289;

type Choice = readonly [label: string, image?: ReactNode];

const OPEN_WITH: readonly Choice[] = [["Favorites"], ["Homepage"], ["Empty Page"], ["Same Page"]];

/* The pop-up buttons of the General pane: label and choices, as in the captures. What is chosen at
   first is `POP_UP_DEFAULTS`. */
const POP_UPS = {
  opens: [
    "Safari opens with:",
    [["A new window"], ["A new private window"], ["All windows from last session"]],
  ],
  windows: ["New windows open with:", OPEN_WITH],
  tabs: ["New tabs open with:", OPEN_WITH],
  history: [
    "Remove history items:",
    [
      ["After one day"],
      ["After one week"],
      ["After two weeks"],
      ["After one month"],
      ["After one year"],
      ["Manually"],
    ],
  ],
  favorites: ["Favorites shows:", [["Favorites", <StarGlyph key="star" />], ["Bookmarks Menu"]]],
  topSites: ["Top Sites shows:", [["6 sites"], ["12 sites"], ["24 sites"]]],
  downloads: [
    "File download location:",
    [["Downloads", <FolderGlyph key="folder" />], ["Ask for each download"]],
  ],
  downloadList: [
    "Remove download list items:",
    [["After one day"], ["When Safari quits"], ["Upon successful download"], ["Manually"]],
  ],
} satisfies Record<SafariPopUp, readonly [string, readonly Choice[]]>;

const DOWNLOADS_FOLDER = "Safari saves every download to your Downloads folder on the drive.";

/** One row of the General pane: a label and the pop-up button it names. */
function PopUpRow({
  name,
  settings,
  why,
}: {
  name: SafariPopUp;
  settings: SafariSettings;
  /** Why it is dimmed. */
  why?: string;
}) {
  const id = useId();
  const [label, choices] = POP_UPS[name];
  return (
    <PreferencesWindowRow label={label} labelFor={id}>
      <PopUpButton
        id={id}
        value={choiceOf(settings, name)}
        onValueChange={(next) => next !== null && changeSafariSetting(name, next)}
        disabled={why !== undefined}
        title={why}
        style={{ width: COLUMN }}
      >
        {choices.map(([title, image]) => (
          <PopUpButtonItem key={title} value={title} image={image}>
            {title}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
    </PreferencesWindowRow>
  );
}

/** A checkbox of a pane after General. `why` dims it on the desktop's Safari, where nothing could
 * carry it out, showing `state`: what is true there, whatever a Mac starts it at. */
interface PaneOption {
  title: string;
  /** What it starts at where no `why` applies and `optionOf` has no opinion. */
  on?: boolean;
  why?: string;
  state?: boolean;
}

const NO_AUTOFILL = "Safari on Ferrite keeps no contact or password to fill a form with.";
const NO_EXTENSIONS = "Safari in a browser runs no extensions.";
const SERVER_FETCHES =
  "The server fetches each page itself and keeps no cookie, so a site sees the server, not you, and a page’s frame can store nothing.";

const OPTIONS: Record<string, readonly PaneOption[]> = {
  tabs: [
    { title: COMMAND_CLICK },
    { title: MAKE_ACTIVE },
    { title: TAB_KEYS },
    {
      title: "Show website icons in tabs",
      why: "The server drops a page’s icon when it makes the page safe, so a tab has none to show.",
      state: false,
    },
  ],
  autofill: [
    { title: "Using information from my contacts", on: true, why: NO_AUTOFILL, state: false },
    { title: "User names and passwords", on: true, why: NO_AUTOFILL, state: false },
    { title: "Other forms", on: true, why: NO_AUTOFILL, state: false },
  ],
  passwords: [
    { title: "AutoFill user names and passwords", on: true, why: NO_AUTOFILL, state: false },
  ],
  search: [
    { title: ENGINE_SUGGESTIONS },
    {
      title: "Enable Quick Website Search",
      on: true,
      why: "Searches go to Wikipedia, so no other site’s own search can be learned.",
      state: false,
    },
    {
      title: "Preload Top Hit in the background",
      on: true,
      why: "The server fetches a page only when you open it.",
      state: false,
    },
    { title: FIELD_FAVORITES },
  ],
  security: [
    {
      title: "Warn when visiting a fraudulent website",
      on: true,
      why: "Safari here has no list of fraudulent websites to check an address against.",
      state: false,
    },
    {
      title: "Enable JavaScript",
      on: true,
      why: "The server removes a page’s scripts before showing it, so they never run.",
      state: false,
    },
    {
      title: "Block pop-up windows",
      on: true,
      why: "A page’s frame is not allowed to open a window, so pop-ups are always blocked.",
      state: true,
    },
  ],
  privacy: [
    { title: "Prevent cross-site tracking", on: true, why: SERVER_FETCHES, state: true },
    { title: "Block all cookies", why: SERVER_FETCHES, state: true },
  ],
  websites: [{ title: AUTO_READER }],
  extensions: [
    {
      title: "Automatically update extensions from the App Store",
      on: true,
      why: NO_EXTENSIONS,
      state: false,
    },
  ],
  advanced: [
    { title: FULL_ADDRESS },
    {
      title: "Never use font sizes smaller than 9",
      why: "The browser’s own settings set the smallest text it shows.",
      state: false,
    },
    {
      title: "Press Tab to highlight each item on a webpage",
      why: "The browser decides what Tab reaches in a page.",
      state: false,
    },
    {
      title: "Show Develop menu in menu bar",
      why: "The browser’s own developer tools inspect the pages here.",
      state: false,
    },
  ],
};

const NO_ENGINE = "Searches go to Wikipedia, the one search the server may fetch.";
const WEBSITE_DATA = "Safari here holds no website data to manage.";

/**
 * Safari's preferences window: ten panes behind a preferences toolbar, General in front.
 *
 * The root is the library's `PreferencesWindow` and takes its props (`state`, `width`,
 * `height`, `style`, `ref`, `onClose`, `value`, `defaultValue`, `onValueChange`), and it
 * accepts what a `ManagedWindow` hands to its `render` function, so a window manager can host
 * it next to the browser window. A preferences window sizes itself to its pane: host it as a
 * window that is not resizable.
 */
export function SafariPreferences({
  currentPage,
  defaultHomepage,
  onHomepageChange,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  onMinimize: _onMinimize,
  onZoom: _onZoom,
  zoomRole: _zoomRole,
  minimizeDisabled: _minimizeDisabled,
  zoomDisabled: _zoomDisabled,
  onPointerDown,
  onDoubleClick,
  ...props
}: SafariPreferencesProps) {
  const served = servedByDesktopApp();
  const settings = useSafariSettings();
  const front = useSyncExternalStore(subscribeSafariWindows, frontSafariPage, frontSafariPage);
  const page = currentPage ?? (front || undefined);
  const stored = settings.homepage;
  const homepage =
    typeof stored === "string"
      ? stored
      : (defaultHomepage ?? (served ? "" : "https://start.example/"));
  const homepageId = useId();
  const searchEngineId = useId();
  const setHomepage = (next: string) => {
    changeSafariSetting("homepage", next);
    onHomepageChange?.(next);
  };
  const popUp = (name: SafariPopUp, why?: string) => (
    <PopUpRow name={name} settings={settings} why={why} />
  );
  const option = ({ title, on, why, state }: PaneOption) => {
    const dimmed = served && why !== undefined;
    const value = settings[title];
    const checked =
      dimmed && state !== undefined
        ? state
        : typeof value === "boolean"
          ? value
          : (on ?? optionOf(settings, title, served));
    return (
      <Checkbox
        key={title}
        checked={checked}
        disabled={dimmed}
        title={dimmed ? why : undefined}
        onCheckedChange={(next) => changeSafariSetting(title, next)}
      >
        {title}
      </Checkbox>
    );
  };
  /* A dimmed control's reason, where a person can read it without waiting on a tooltip. */
  const reasons = (options: readonly PaneOption[], more: readonly string[] = []) =>
    served
      ? [...new Set([...options.flatMap((each) => each.why ?? []), ...more])].map((reason) => (
          <p key={reason} className="mac-safari-preferences-reason">
            {reason}
          </p>
        ))
      : null;

  return (
    <PreferencesWindow
      width={774}
      toolbar={
        <PreferencesToolbar aria-label="Safari preferences">
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
      // The preferences window does not pass on its title bar's drag-region callbacks, so the
      // bar is watched from the root.
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented && event.button === 0 && onBar(event.target)) {
          onDragRegionPointerDown?.(event);
        }
      }}
      onDoubleClick={(event) => {
        onDoubleClick?.(event);
        if (!event.defaultPrevented && onBar(event.target)) onDragRegionDoubleClick?.(event);
      }}
      {...props}
    >
      <PreferencesWindowPane value="general" className="mac-safari-preferences-general">
        <PreferencesWindowForm
          className="mac-safari-preferences-form"
          // The captures have a pitch of 30 pt for the 21 pt rows.
          style={{ ["--mac-preferences-window-row-gap" as string]: "9px" }}
        >
          {popUp("opens")}
          {popUp("windows")}
          {popUp("tabs")}
          <PreferencesWindowRow label="Homepage:" labelFor={homepageId}>
            <TextField
              id={homepageId}
              value={homepage}
              onValueChange={setHomepage}
              style={{ width: COLUMN }}
            />
          </PreferencesWindowRow>
          <PreferencesWindowRow>
            <PushButton
              disabled={!page}
              onClick={() => page && setHomepage(page)}
              style={{ minWidth: 147 }}
            >
              Set to Current Page
            </PushButton>
          </PreferencesWindowRow>
          <div className="mac-safari-preferences-gap" data-after="button" />
          {popUp("history")}
          {popUp("favorites")}
          {popUp("topSites")}
          <div className="mac-safari-preferences-gap" />
          {popUp("downloads", served ? DOWNLOADS_FOLDER : undefined)}
          {popUp("downloadList")}
          <PreferencesWindowRow>
            <div className="mac-safari-preferences-safe">
              {option({ title: SAFE_FILES })}
              <p className="mac-safari-preferences-note">
                “Safe” files include movies, pictures, sounds, PDF and text documents, and archives.
              </p>
            </div>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
        {/* Beside the last lines of the form, as in the captures, not in a row under it. */}
        <HelpButton className="mac-safari-preferences-help" />
      </PreferencesWindowPane>
      {PANES.slice(1).map(([value]) => (
        <PreferencesWindowPane key={value} value={value}>
          <PreferencesWindowForm>
            {value === "search" && served ? (
              <PreferencesWindowRow label="Search engine:" labelFor={searchEngineId}>
                <PopUpButton id={searchEngineId} value="Wikipedia" disabled title={NO_ENGINE}>
                  <PopUpButtonItem value="Wikipedia">Wikipedia</PopUpButtonItem>
                </PopUpButton>
              </PreferencesWindowRow>
            ) : null}
            {(OPTIONS[value] ?? []).map(option)}
            {value === "privacy" && served ? (
              <PushButton disabled title={WEBSITE_DATA}>
                Manage Website Data…
              </PushButton>
            ) : null}
            {reasons(
              OPTIONS[value] ?? [],
              value === "search" ? [NO_ENGINE] : value === "privacy" ? [WEBSITE_DATA] : [],
            )}
          </PreferencesWindowForm>
        </PreferencesWindowPane>
      ))}
    </PreferencesWindow>
  );
}
