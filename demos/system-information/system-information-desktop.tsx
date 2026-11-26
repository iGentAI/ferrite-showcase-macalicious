import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import { onMenuKeyEquivalents } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { TextField } from "macalicious/text-field";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { requestHelp } from "../desktop/desktop-help";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { servedByDesktopApp, sessionFetch } from "../desktop/desktop-server";
import { copyText } from "../desktop/desktop-share-link";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { DriveSavePanel, type DriveSaveTarget, saveToDrive } from "../finder/finder-file-dialogs";
import { printDocument } from "../textedit/textedit-drive";
import { SystemInformation, type SystemInformationProps } from "./system-information";
import type {
  SystemInformationItem,
  SystemInformationReport,
  SystemInformationSection,
} from "./system-information-data";
import {
  findCategory,
  pathTo,
  reportAsText,
  rowsAsText,
  type SystemInformationSort,
  sortRows,
} from "./system-information-data";

/**
 * The report of the `macalicious-desktop` Ferrite application's System Information module
 * (`ferrite-apps/desktop/src/apps/system_information`): the application's facts, its modules
 * and its request counts.
 */
export const SYSTEM_REPORT_URL = "/api/system-information/report";

/** What the browser itself reports: `navigator`, `screen`, the window and the time zone. */
export interface BrowserFacts {
  userAgent: string;
  languages: readonly string[];
  platform: string;
  processors?: number;
  /** `navigator.deviceMemory`, a rough figure in gigabytes; only some browsers give it. */
  memory?: number;
  cookies: boolean;
  online: boolean;
  timeZone: string;
  screen?: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
  };
  scale: number;
  viewport: { width: number; height: number };
  dark: boolean;
  /** `navigator.storage.estimate()`, when the browser answers it. */
  storage?: { usage: number; quota: number };
  /** `navigator.connection`, which only some browsers have. */
  connection?: { type?: string; effectiveType?: string; downlink?: number; rtt?: number };
}

/** The browser's facts now. */
export function readBrowserFacts(): BrowserFacts {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: BrowserFacts["connection"];
  };
  let timeZone = "";
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timeZone = "";
  }
  const screen = window.screen;
  return {
    userAgent: nav.userAgent,
    languages: nav.languages?.length ? nav.languages : [nav.language],
    platform: nav.platform,
    processors: nav.hardwareConcurrency || undefined,
    memory: nav.deviceMemory,
    cookies: nav.cookieEnabled,
    online: nav.onLine,
    timeZone,
    screen: screen
      ? {
          width: screen.width,
          height: screen.height,
          availWidth: screen.availWidth,
          availHeight: screen.availHeight,
          colorDepth: screen.colorDepth,
        }
      : undefined,
    scale: window.devicePixelRatio || 1,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    dark: window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
    connection: nav.connection
      ? {
          type: nav.connection.type,
          effectiveType: nav.connection.effectiveType,
          downlink: nav.connection.downlink,
          rtt: nav.connection.rtt,
        }
      : undefined,
  };
}

/** The server's report, read loosely: every part the window shows is checked where it is used. */
export interface ServerReport {
  facts: Record<string, unknown>;
  modules: readonly Record<string, unknown>[];
  counters: readonly Record<string, unknown>[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCount = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isFacts = (facts: unknown): facts is Record<string, unknown> => {
  if (!isRecord(facts) || !isRecord(facts.storage)) return false;
  const storage = facts.storage;
  return (
    typeof facts.application === "string" &&
    isCount(facts.generation) &&
    (facts.instance === null || typeof facts.instance === "string") &&
    typeof facts.build === "string" &&
    isCount(facts.site_files) &&
    isCount(facts.modules) &&
    isCount(facts.now_ms) &&
    isCount(storage.bytes) &&
    isCount(storage.keys) &&
    Array.isArray(storage.apps) &&
    storage.apps.every(
      (app) =>
        isRecord(app) &&
        typeof app.name === "string" &&
        app.name !== "" &&
        typeof app.title === "string" &&
        isCount(app.bytes) &&
        isCount(app.keys),
    )
  );
};

const isModule = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) &&
  typeof value.name === "string" &&
  value.name !== "" &&
  typeof value.title === "string" &&
  typeof value.api === "string";

const isCounter = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) &&
  typeof value.name === "string" &&
  isCount(value.requests) &&
  isCount(value.writes) &&
  isCount(value.errors) &&
  isCount(value.last_ms);

/**
 * The report of a reply, or `undefined` when it is not the module's: every part the window
 * shows must be there in its type, and each module named once, or the report is not shown.
 */
export function reportFromServer(reply: unknown): ServerReport | undefined {
  if (!isRecord(reply) || !isFacts(reply.facts)) return undefined;
  if (!Array.isArray(reply.modules) || !Array.isArray(reply.counters)) return undefined;
  if (!reply.modules.every(isModule) || !reply.counters.every(isCounter)) return undefined;
  const names = reply.modules.map((module) => module.name);
  if (new Set(names).size !== names.length) return undefined;
  return { facts: reply.facts, modules: reply.modules, counters: reply.counters };
}

const text = (value: unknown) =>
  typeof value === "string"
    ? value
    : typeof value === "number"
      ? value.toLocaleString("en-US")
      : "";
const yesNo = (value: boolean) => (value ? "Yes" : "No");
const time = (ms: unknown) =>
  typeof ms === "number" && ms > 0 ? new Date(ms).toLocaleString("en-US") : "";
/** Bytes in decimal units, as the report writes sizes. */
export function bytesText(bytes: unknown): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "";
  if (bytes < 1000) return `${bytes} bytes`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = -1;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${Number(value.toFixed(value < 10 ? 2 : 1))} ${units[unit]}`;
}

const section = (
  heading: string,
  ...entries: readonly (readonly [string, string])[]
): SystemInformationSection => ({ heading, entries: entries.filter(([, value]) => value !== "") });

const properties = (...sections: SystemInformationSection[]): SystemInformationReport => ({
  kind: "properties",
  sections,
});

/**
 * The faces a page has really loaded, each once. A family has one `FontFace` per `@font-face` rule, with
 * unloaded ones among them and subsets of one face sharing a family, style and weight.
 */
export function loadedFontNames(
  faces: Iterable<Pick<FontFace, "family" | "style" | "weight" | "status">>,
): readonly string[] {
  const names = new Set<string>();
  for (const { family, style, weight, status } of faces) {
    if (status === "loaded") names.add(`${family} (${style}, ${weight})`);
  }
  return [...names];
}

/**
 * The outline of the served window: the browser's own facts, then the Ferrite application's.
 * Before the server has answered, the application's reports say so; the ids stay the same.
 */
export function desktopItems(
  browser: BrowserFacts,
  report: ServerReport | undefined,
  failed: boolean,
  applications?: readonly string[],
  fonts?: readonly string[],
  logs?: readonly { id: number; line: string; type: string }[] | null,
): readonly SystemInformationItem[] {
  const waiting: SystemInformationReport = {
    kind: "empty",
    message: failed ? "The application did not answer." : "Loading…",
  };
  const facts = report?.facts;
  const generation = facts?.generation;
  const storage = isRecord(facts?.storage) ? facts.storage : undefined;
  const apps = Array.isArray(storage?.apps) ? storage.apps.filter(isRecord) : [];
  const counted = new Map((report?.counters ?? []).map((counter) => [counter.name, counter]));
  return [
    {
      id: "hardware",
      name: "Hardware",
      report: properties(
        section(
          "What the Browser Tells",
          ["Logical Processors", text(browser.processors)],
          ["Device Memory", browser.memory ? `${browser.memory} GB or more (estimate)` : ""],
          ["Screen", browser.screen ? `${browser.screen.width} × ${browser.screen.height}` : ""],
        ),
        section("What a Web Page Cannot Read", [
          "Model, Processor, Serial Number, Battery, USB and Disks",
          "Not available to a web page, so not shown.",
        ]),
      ),
    },
    {
      id: "network",
      name: "Network",
      report: properties(
        section(
          "Connection",
          ["Online", yesNo(browser.online)],
          ["Type", browser.connection?.type ?? ""],
          ["Effective Type", browser.connection?.effectiveType ?? ""],
          [
            "Downlink",
            browser.connection?.downlink === undefined
              ? ""
              : `${browser.connection.downlink} Mbit/s`,
          ],
          [
            "Round Trip",
            browser.connection?.rtt === undefined ? "" : `${browser.connection.rtt} ms`,
          ],
        ),
        section("What a Web Page Cannot Read", [
          "Interfaces, Addresses and Wi-Fi Networks",
          "Not available to a web page, so not shown.",
        ]),
      ),
    },
    {
      id: "software",
      name: "Software",
      report: properties(
        section(
          "Software Overview",
          ["System", "Macalicious Desktop, in a browser"],
          ["Site Build", text(facts?.build)],
          ["Time Zone", browser.timeZone],
          ["Languages", browser.languages.join(", ")],
        ),
      ),
      children: [
        {
          id: "software/applications",
          name: "Applications",
          report: applications
            ? {
                kind: "table",
                columns: [{ id: "name", title: "Application" }],
                rows: applications.map((name) => ({
                  id: name,
                  cells: { name },
                  sections: [section(name, ["Kind", "A window of this desktop"])],
                })),
              }
            : { kind: "empty", message: "Loading…" },
        },
        {
          id: "software/fonts",
          name: "Fonts",
          report: !fonts
            ? { kind: "empty", message: "Loading…" }
            : fonts.length === 0
              ? {
                  kind: "empty",
                  message:
                    "This page has loaded no fonts of its own. It draws with your browser's system font, and a web page cannot list your computer's fonts.",
                }
              : {
                  kind: "table",
                  columns: [{ id: "name", title: "Font loaded by this page" }],
                  rows: fonts.map((name) => ({
                    id: name,
                    cells: { name },
                    sections: [
                      section(name, [
                        "Where",
                        "Loaded by this page. A web page cannot list your computer's fonts.",
                      ]),
                    ],
                  })),
                },
        },
        {
          id: "software/logs",
          name: "Logs",
          report:
            logs === undefined
              ? { kind: "empty", message: "Loading…" }
              : logs === null
                ? { kind: "empty", message: "The server's log could not be read." }
                : logs.length === 0
                  ? { kind: "empty", message: "The server's log holds nothing yet." }
                  : {
                      kind: "table",
                      columns: [
                        { id: "type", title: "Type" },
                        { id: "line", title: "This desktop's server log, newest last" },
                      ],
                      rows: logs.map(({ id, line, type }) => ({
                        id: String(id),
                        cells: { type, line },
                        sections: [section(type, ["Message", line])],
                      })),
                    },
        },
      ],
    },
    {
      id: "browser",
      name: "Browser",
      report: properties(
        section(
          "Browser Overview",
          ["User Agent", browser.userAgent],
          ["Languages", browser.languages.join(", ")],
          ["Platform", browser.platform],
          ["Logical Processors", text(browser.processors)],
          ["Device Memory", browser.memory ? `${browser.memory} GB or more (estimate)` : ""],
          ["Cookies Enabled", yesNo(browser.cookies)],
          ["Online", yesNo(browser.online)],
          ["Time Zone", browser.timeZone],
        ),
      ),
      children: [
        {
          id: "browser/display",
          name: "Display",
          report: properties(
            section(
              "Screen",
              ["Size", browser.screen ? `${browser.screen.width} × ${browser.screen.height}` : ""],
              [
                "Available Size",
                browser.screen
                  ? `${browser.screen.availWidth} × ${browser.screen.availHeight}`
                  : "",
              ],
              ["Pixel Ratio", `${browser.scale}×`],
              ["Color Depth", browser.screen ? `${browser.screen.colorDepth}-bit` : ""],
              ["Appearance", browser.dark ? "Dark" : "Light"],
            ),
            section("Window", [
              "Viewport",
              `${browser.viewport.width} × ${browser.viewport.height}`,
            ]),
          ),
        },
        {
          id: "browser/storage",
          name: "Storage",
          report: browser.storage
            ? properties(
                section(
                  "Storage for This Site",
                  ["Used", bytesText(browser.storage.usage)],
                  ["Quota", bytesText(browser.storage.quota)],
                ),
              )
            : { kind: "empty", message: "The browser did not report its storage." },
        },
      ],
    },
    {
      id: "application",
      name: "Ferrite Application",
      report: facts
        ? properties(
            section(
              "Application Overview",
              ["Name", text(facts.application)],
              [
                "Deployment",
                generation === 0
                  ? "Not deployed (local ferrite dev)"
                  : `Generation ${text(generation)}`,
              ],
              ["Instance", typeof facts.instance === "string" ? facts.instance : "Local runtime"],
              ["Site Build", text(facts.build)],
              ["Site Files", text(facts.site_files)],
              ["App Modules", text(facts.modules)],
              ["Server Clock", time(facts.now_ms)],
              ["Session Started", time(facts.session_created_ms)],
            ),
          )
        : waiting,
      children: [
        {
          id: "application/modules",
          name: "App Modules",
          report: report
            ? {
                kind: "table",
                columns: [
                  { id: "title", title: "Module" },
                  { id: "api", title: "Route", width: 200 },
                  { id: "requests", title: "Requests", width: 80 },
                ],
                rows: report.modules.map((module) => {
                  const counter = counted.get(module.name);
                  return {
                    id: text(module.name),
                    cells: {
                      title: text(module.title),
                      api: text(module.api),
                      requests: text(counter?.requests ?? 0),
                    },
                    sections: [
                      section(
                        text(module.title),
                        ["Route", text(module.api)],
                        ["Requests", text(counter?.requests ?? 0)],
                        ["Writes", text(counter?.writes ?? 0)],
                        ["Answered 400 or More", text(counter?.errors ?? 0)],
                        ["Last Request", time(counter?.last_ms)],
                      ),
                    ],
                  };
                }),
              }
            : waiting,
        },
        {
          id: "application/storage",
          name: "Session Storage",
          report: facts
            ? {
                kind: "table",
                columns: [
                  { id: "title", title: "Module" },
                  { id: "keys", title: "Keys", width: 80 },
                  { id: "bytes", title: "Size", width: 100 },
                ],
                rows: apps
                  .filter((app) => typeof app.keys === "number" && app.keys > 0)
                  .map((app) => {
                    // The server stopped counting at its limit: the figures are a floor.
                    const atLeast = app.truncated === true ? "at least " : "";
                    return {
                      id: text(app.name),
                      cells: {
                        title: text(app.title),
                        keys: `${atLeast}${text(app.keys)}`,
                        bytes: `${atLeast}${bytesText(app.bytes)}`,
                      },
                      sections: [
                        section(
                          text(app.title),
                          ["Keys", `${atLeast}${text(app.keys)}`],
                          ["Size", `${atLeast}${bytesText(app.bytes)}`],
                        ),
                      ],
                    };
                  }),
              }
            : waiting,
        },
      ],
    },
  ];
}

type TextControl = HTMLInputElement | HTMLTextAreaElement;
const isTextControl = (element: unknown): element is TextControl =>
  element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;

/**
 * What Copy takes before the whole report: the text selected in the field last focused, which an
 * open menu has taken the focus from, or on the page. A focused field with nothing selected gives
 * the empty text, which copies nothing.
 */
function selectedText(lastField: TextControl | null): string | undefined {
  const active = document.activeElement;
  const field = isTextControl(active) ? active : lastField?.isConnected ? lastField : null;
  const inField = field?.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0);
  if (inField || isTextControl(active)) return inField;
  return document.getSelection()?.toString() || undefined;
}

/** Keeps the category across a reload; a category that is gone falls back to the first. */
const readCategory = (stored: unknown) => (typeof stored === "string" ? stored : undefined);

/** The menu's hold on the keyboard ends with its fade (`menu.css`). */
const AFTER_MENU_MS = 300;

interface OutlineLayout {
  expanded?: readonly string[];
  size?: number;
}

const NO_LAYOUT: OutlineLayout = {};

/** Only what the outline can use is taken from what is stored. */
export function readOutlineLayout(stored: unknown): OutlineLayout | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { expanded, size } = stored as { expanded?: unknown; size?: unknown };
  return {
    ...(Array.isArray(expanded)
      ? { expanded: expanded.filter((id): id is string => typeof id === "string") }
      : {}),
    ...(typeof size === "number" && size >= 110 && size <= 360 ? { size } : {}),
  };
}

function ServedSystemInformation({ state: windowState = "key", ...props }: SystemInformationProps) {
  const [report, setReport] = useState<ServerReport>();
  const [failed, setFailed] = useState(false);
  const [storage, setStorage] = useState<BrowserFacts["storage"]>();
  const [read, setRead] = useState(0);
  const [applications, setApplications] = useState<readonly string[]>();
  const [fonts, setFonts] = useState<readonly string[]>();
  const [logs, setLogs] = useState<
    readonly { id: number; line: string; type: string }[] | null | undefined
  >();
  const [category, setCategory] = useDesktopSetting(
    "system-information.category",
    readCategory,
    "application",
  );
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const [layout, setLayout] = useDesktopSetting(
    "system-information.layout",
    readOutlineLayout,
    NO_LAYOUT,
  );
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);
  const findField = useRef<HTMLInputElement>(null);
  const [selectedRows, setSelectedRows] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [sorts, setSorts] = useState<Readonly<Record<string, SystemInformationSort>>>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const launch = use(DesktopWindowHostContext)?.launch;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `read` is what Refresh Information changes.
  useEffect(() => {
    let live = true;
    sessionFetch(SYSTEM_REPORT_URL, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    })
      .then(async (response) => (response.ok ? reportFromServer(await response.json()) : undefined))
      .catch(() => undefined)
      .then((answer) => {
        if (!live) return;
        setReport(answer);
        setFailed(!answer);
      });
    navigator.storage
      ?.estimate?.()
      .then((estimate) => {
        if (live && typeof estimate.usage === "number" && typeof estimate.quota === "number")
          setStorage({ usage: estimate.usage, quota: estimate.quota });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [read]);
  // The list of applications loads every application's descriptor, so only when it is asked for.
  const wantsApplications = category === "software/applications";
  useEffect(() => {
    if (!wantsApplications || applications) return;
    let live = true;
    void import("../desktop/desktop-apps").then(({ discoveredApps }) => {
      if (live) setApplications(discoveredApps.map((app) => app.name));
    });
    return () => {
      live = false;
    };
  }, [wantsApplications, applications]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `read` is what Refresh Information changes.
  useEffect(() => {
    if (category === "software/fonts") {
      setFonts(loadedFontNames(document.fonts));
      return;
    }
    if (category !== "software/logs") return;
    let live = true;
    void import("../console/console-desktop").then(async ({ consoleFeed }) => {
      const messages = await consoleFeed.read();
      if (live)
        setLogs(messages?.map(({ id, message, type }) => ({ id, line: message, type })) ?? null);
    });
    return () => {
      live = false;
    };
  }, [category, read]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `read` asks the browser again too.
  const items = useMemo(
    () =>
      desktopItems({ ...readBrowserFacts(), storage }, report, failed, applications, fonts, logs),
    [report, failed, storage, applications, fonts, logs, read],
  );
  const found = pathTo(items, category);
  const current = found[found.length - 1] ?? items[0];
  const expanded = layout.expanded ?? items.map((item) => item.id);
  const findNext = () => {
    const next = findCategory(items, query, current?.id ?? "");
    setNotFound(query.trim() !== "" && !next);
    if (!next) return;
    setCategory(next.id);
    const above = pathTo(items, next.id)
      .slice(0, -1)
      .map((item) => item.id);
    if (above.some((id) => !expanded.includes(id)))
      setLayout({ ...layout, expanded: [...new Set([...expanded, ...above])] });
  };
  // The field that had the keyboard, until something other than a menu takes it.
  const lastField = useRef<TextControl | null>(null);
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (isTextControl(target)) lastField.current = target;
      else if (!(target instanceof Element && target.closest("[role='menu'], [role='menubar']")))
        lastField.current = null;
      setEditing(lastField.current !== null);
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);
  const shown = current?.report;
  const shownRows =
    current && shown?.kind === "table"
      ? sortRows(shown.rows, shown.columns, sorts[current.id])
      : [];
  const chosenRows = shownRows.filter((row) => selectedRows[current?.id ?? ""]?.includes(row.id));
  // Runs once the menu that asked for it has let go of the keyboard.
  const inLastField = (
    work: (field: TextControl) => void,
    target: TextControl | null = lastField.current,
  ) =>
    setTimeout(() => {
      if (!target?.isConnected || target !== lastField.current) return;
      target.focus();
      work(target);
    }, AFTER_MENU_MS);
  const makeCommands = () => ({
    refresh: () => setRead((count) => count + 1),
    copy: () => {
      const rows =
        shown?.kind === "table" && chosenRows.length > 0
          ? rowsAsText(shown.columns, chosenRows)
          : undefined;
      const text = selectedText(lastField.current) ?? rows ?? (current && reportAsText(current));
      if (text) void copyText(text);
    },
    cut: () =>
      inLastField((field) => {
        const start = field.selectionStart ?? 0;
        const end = field.selectionEnd ?? 0;
        const chosen = field.value.slice(start, end);
        if (!chosen) return;
        // The words go only once they are on the clipboard, and only if the field still holds them.
        void copyText(chosen).then((copied) => {
          if (!copied || !field.isConnected) return;
          if (field.value.slice(start, end) !== chosen) return;
          field.focus();
          field.setSelectionRange(start, end);
          document.execCommand("delete");
        });
      }),
    paste: () => {
      const target = lastField.current;
      void navigator.clipboard
        ?.readText()
        .then((text) =>
          inLastField(() => {
            document.execCommand("insertText", false, text);
          }, target),
        )
        .catch(() => {});
    },
    selectAll: () => {
      const field = isTextControl(document.activeElement)
        ? document.activeElement
        : lastField.current?.isConnected
          ? lastField.current
          : null;
      if (field) {
        field.focus();
        field.select();
      } else if (current && shown?.kind === "table") {
        setSelectedRows({ ...selectedRows, [current.id]: shownRows.map((row) => row.id) });
      } else {
        const text = titleBar?.parentElement?.querySelector(".mac-system-information-report");
        if (text) document.getSelection()?.selectAllChildren(text);
      }
    },
    save: () => setSaving(true),
    find: () => {
      setFinding(true);
      setTimeout(() => {
        findField.current?.focus();
        findField.current?.select();
      }, AFTER_MENU_MS);
    },
    print: () => {
      if (!current) return;
      printDocument({
        name: `System Information: ${current.name}`,
        lines: reportAsText(current).split("\n"),
        plain: true,
      });
    },
  });
  const commands = useRef(makeCommands());
  commands.current = makeCommands();
  const saveReport = async (target: DriveSaveTarget) => {
    setSaving(false);
    try {
      if (current)
        await saveToDrive(target, new Blob([reportAsText(current)], { type: "text/plain" }));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };
  const isKey = windowState === "key";
  useEffect(() => {
    if (!isKey) return;
    return onMenuKeyEquivalents(window, {
      "command+r": () => commands.current.refresh(),
      "command+s": () => commands.current.save(),
      "command+p": () => commands.current.print(),
      "command+c": () => commands.current.copy(),
      "command+a": () => commands.current.selectAll(),
      "command+f": () => commands.current.find(),
    });
  }, [isKey]);
  const fileMenu = useMemo(
    () => (
      <>
        <MenuItem keyEquivalent="command+s" onClick={() => commands.current.save()}>
          Save…
        </MenuItem>
        <MenuItem keyEquivalent="command+p" onClick={() => commands.current.print()}>
          Print…
        </MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+r" onClick={() => commands.current.refresh()}>
          Refresh Information
        </MenuItem>
        <MenuItem disabled>Send to Apple…</MenuItem>
        <MenuItem disabled>A web page cannot send a report to Apple.</MenuItem>
        <MenuSeparator />
      </>
    ),
    [],
  );
  useDesktopAppMenu("system-information", "File", fileMenu, titleBar);
  const editMenu = useMemo(
    () => (
      <>
        <MenuItem keyEquivalent="command+z" disabled>
          Undo
        </MenuItem>
        <MenuItem keyEquivalent="shift+command+z" disabled>
          Redo
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          keyEquivalent="command+x"
          disabled={!editing}
          onClick={() => commands.current.cut()}
        >
          Cut
        </MenuItem>
        <MenuItem keyEquivalent="command+c" onClick={() => commands.current.copy()}>
          Copy
        </MenuItem>
        <MenuItem
          keyEquivalent="command+v"
          disabled={!editing}
          onClick={() => commands.current.paste()}
        >
          Paste
        </MenuItem>
        <MenuItem
          keyEquivalent="command+a"
          onClick={() => setTimeout(() => commands.current.selectAll(), AFTER_MENU_MS)}
        >
          Select All
        </MenuItem>
        <MenuSeparator />
        <MenuItem keyEquivalent="command+f" onClick={() => commands.current.find()}>
          Find
        </MenuItem>
      </>
    ),
    [editing],
  );
  useDesktopAppMenu("system-information", "Edit", editMenu, titleBar);
  const windowMenu = useMemo(
    () =>
      launch ? <MenuItem onClick={() => launch("about-this-mac")}>About This Mac</MenuItem> : null,
    [launch],
  );
  useDesktopAppMenu("system-information", "Window", windowMenu, titleBar);
  const helpMenu = useMemo(
    () =>
      launch ? (
        <MenuItem onClick={() => requestHelp("System Information")}>
          System Information Help
        </MenuItem>
      ) : null,
    [launch],
  );
  useDesktopAppMenu("system-information", "Help", helpMenu, titleBar);
  return (
    <>
      <SystemInformation
        {...props}
        state={windowState}
        titleBarRef={setTitleBar}
        items={items}
        modelName="Macalicious Desktop"
        computerName="macalicious-desktop"
        selectedId={category}
        onSelectedIdChange={setCategory}
        expanded={expanded}
        onExpandedChange={(next) => setLayout({ ...layout, expanded: next })}
        outlineSize={layout.size ?? 163}
        onOutlineSizeChange={(size) => setLayout({ ...layout, size })}
        selectedRows={selectedRows}
        onSelectedRowsChange={setSelectedRows}
        sorts={sorts}
        onSortsChange={setSorts}
        reportMenu={
          <>
            <MenuItem onClick={() => commands.current.copy()}>Copy</MenuItem>
            <MenuItem onClick={() => setTimeout(() => commands.current.selectAll(), AFTER_MENU_MS)}>
              Select All
            </MenuItem>
          </>
        }
        findBar={
          finding ? (
            <search className="mac-system-information-find">
              <TextField
                inputRef={findField}
                aria-label="Find in the report"
                placeholder="Find"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setNotFound(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") findNext();
                  if (event.key === "Escape") setFinding(false);
                }}
              />
              <PushButton size="small" onClick={findNext}>
                Next
              </PushButton>
              <PushButton size="small" onClick={() => setFinding(false)}>
                Done
              </PushButton>
              {notFound ? <Label textStyle="small">Not found</Label> : null}
            </search>
          ) : null
        }
      />
      <Sheet open={saving} onOpenChange={setSaving}>
        <SheetPopup anchor={titleBar} width={640} aria-label="Save">
          {saving ? (
            <DriveSavePanel
              defaultName={`${current?.name ?? "System Information"}.txt`}
              defaultFolder="documents"
              defaultExpanded
              onSave={(target) => void saveReport(target)}
              onCancel={() => setSaving(false)}
            />
          ) : null}
        </SheetPopup>
      </Sheet>
      <Sheet open={notice !== undefined} onOpenChange={(open) => !open && setNotice(undefined)}>
        <SheetPopup anchor={titleBar} width={420}>
          <SheetTitle>The report could not be saved.</SheetTitle>
          <SheetDescription>{notice}</SheetDescription>
          <SheetActions>
            <SheetClose render={<DefaultButton />}>OK</SheetClose>
          </SheetActions>
        </SheetPopup>
      </Sheet>
    </>
  );
}

/**
 * System Information as the desktop shows it. When the `macalicious-desktop` Ferrite
 * application serves the desktop, the outline holds what the browser reports about itself and
 * what the application reports about itself (its deployment, site build, modules, request
 * counts and this session's storage), and Hardware says what a web page cannot read. Every other build shows the
 * captured MacBook Pro, as `SystemInformation` does.
 */
export function DesktopSystemInformation(props: SystemInformationProps) {
  return servedByDesktopApp() ? (
    <ServedSystemInformation {...props} />
  ) : (
    <SystemInformation {...props} />
  );
}
