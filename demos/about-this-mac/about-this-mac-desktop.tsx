import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { use, useEffect, useRef, useState } from "react";
import { requestHelp } from "../desktop/desktop-help";
import { openUrl } from "../desktop/desktop-open-url";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { servedByDesktopApp, sessionFetch } from "../desktop/desktop-server";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { requestPane } from "../system-preferences/pane-request";
import { AboutThisMac, type AboutThisMacProps } from "./about-this-mac";
import { type AboutThisMacVolume, formatSize, resolveTab } from "./about-this-mac-data";
import { useAboutThisMacMenus } from "./about-this-mac-menus";

/**
 * The facts the `macalicious-desktop` Ferrite application can know about itself, as its About
 * This Mac module answers them (`ferrite-apps/desktop/src/apps/about_this_mac`).
 */
export const ABOUT_FACTS_URL = "/api/about-this-mac/facts";

/** What one module keeps for this browser's session. */
export interface DesktopAppStorage {
  name: string;
  title: string;
  bytes: number;
  keys: number;
  /** The server stopped counting this module's keys at its limit: the figures are a floor. */
  truncated: boolean;
}

/** The module's reply. */
export interface DesktopFacts {
  application: string;
  /** The deployment generation: 0 when nothing deployed the application (`ferrite dev`). */
  generation: number;
  /** The instance that answered; `null` under `ferrite dev`. */
  instance: string | null;
  /** The site build the application serves: `sha256:` and a digest. */
  build: string;
  siteFiles: number;
  modules: number;
  /** The platform clock when the reply was made. */
  nowMs: number;
  storage: {
    bytes: number;
    keys: number;
    /** Some module's count stopped at its limit: the totals are a floor. */
    truncated: boolean;
    apps: readonly DesktopAppStorage[];
  };
  /** The person's Ferrite drive against its quota, when the server reports it. */
  drive?: DesktopDrive;
}

/** The person's Ferrite drive, as Storage Management reports it. */
export interface DesktopDrive {
  quota: number;
  used: number;
  available: number;
  categories: readonly { id: string; name: string; bytes: number }[];
}

/** A drive in the reply's shape, or `undefined`. */
function driveOf(value: unknown): DesktopDrive | undefined {
  const drive = value as Record<string, unknown> | null;
  if (typeof drive !== "object" || drive === null) return undefined;
  const { quota, used, available, categories } = drive;
  if (!count(quota) || !count(used) || !count(available) || !Array.isArray(categories)) {
    return undefined;
  }
  const kinds = categories.filter(
    (c): c is { id: string; name: string; bytes: number } =>
      typeof c === "object" &&
      c !== null &&
      typeof c.id === "string" &&
      typeof c.name === "string" &&
      count(c.bytes),
  );
  return {
    quota,
    used,
    available,
    categories: kinds.map(({ id, name, bytes }) => ({ id, name, bytes })),
  };
}

const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isStorage = (
  value: unknown,
): value is Omit<DesktopAppStorage, "truncated"> & {
  truncated?: unknown;
} => {
  const app = value as Record<string, unknown> | null;
  return (
    typeof app === "object" &&
    app !== null &&
    typeof app.name === "string" &&
    typeof app.title === "string" &&
    count(app.bytes) &&
    count(app.keys)
  );
};

/** The facts of a reply, or `undefined` when it is not the module's. */
export function factsFromServer(reply: unknown): DesktopFacts | undefined {
  const facts = reply as Record<string, unknown> | null;
  if (typeof facts !== "object" || facts === null) return undefined;
  const storage = facts.storage as Record<string, unknown> | null;
  if (
    typeof facts.application !== "string" ||
    !count(facts.generation) ||
    !(facts.instance === null || typeof facts.instance === "string") ||
    typeof facts.build !== "string" ||
    !count(facts.site_files) ||
    !count(facts.modules) ||
    !count(facts.now_ms) ||
    typeof storage !== "object" ||
    storage === null ||
    !count(storage.bytes) ||
    !count(storage.keys) ||
    !Array.isArray(storage.apps) ||
    !storage.apps.every(isStorage)
  )
    return undefined;
  const apps = storage.apps.map((app) => ({ ...app, truncated: app.truncated === true }));
  return {
    application: facts.application,
    generation: facts.generation,
    instance: facts.instance,
    build: facts.build,
    siteFiles: facts.site_files,
    modules: facts.modules,
    nowMs: facts.now_ms,
    storage: {
      bytes: storage.bytes,
      keys: storage.keys,
      truncated: storage.truncated === true || apps.some((app) => app.truncated),
      apps,
    },
    drive: driveOf(facts.drive),
  };
}

/** "Chrome 141", "Firefox 144", "Safari 26": the browser a user agent names, or the agent. */
export function browserName(userAgent: string): string {
  const named = [
    [/Edg\/(\d+)/, "Edge"],
    [/Firefox\/(\d+)/, "Firefox"],
    [/Chrome\/(\d+)/, "Chrome"],
    [/Version\/(\d+)[.\d]* .*Safari\//, "Safari"],
  ] as const;
  for (const [pattern, name] of named) {
    const match = pattern.exec(userAgent);
    if (match) return `${name} ${match[1]}`;
  }
  return userAgent;
}

/** The deployment as a line: generation 0 is a run that nothing deployed. */
export function deploymentText(generation: number): string {
  return generation === 0
    ? "Not deployed (local ferrite dev)"
    : `Generation ${generation.toLocaleString("en-US")}`;
}

/** The first 12 characters of a build's digest. */
export const shortBuild = (build: string) => build.replace(/^sha256:/, "").slice(0, 12);

/** What stands for the model, processor, memory and serial number a real Mac lists here. */
const NO_HARDWARE = "A web page cannot read the model or serial";

/** What the window shows of the facts and of this browser, in its own props. */
export function aboutProps(
  facts: DesktopFacts | undefined,
  failed: boolean,
  browser: {
    userAgent: string;
    processors?: number;
    width?: number;
    height?: number;
    scale?: number;
  },
): Partial<AboutThisMacProps> {
  const processors =
    browser.processors && browser.processors > 0
      ? `${browser.processors} logical (as the browser reports)`
      : "";
  // The person's Ferrite drive against its quota, as macOS shows the startup disk; without it
  // (an earlier server), the data store, which reports no capacity.
  const drive = facts?.drive;
  const volume: AboutThisMacVolume = drive
    ? {
        name: "Ferrite Drive",
        kind: `${formatSize(drive.quota)} for your files`,
        capacity: drive.quota,
        available: drive.available,
        categories: drive.categories
          .filter((kind) => kind.bytes > 0)
          .map((kind) => ({ id: kind.id, name: kind.name, size: kind.bytes })),
      }
    : {
        name: "Ferrite Data Store",
        kind: "This session's data",
        capacity: 0,
        available: 0,
        categories: (facts?.storage.apps ?? [])
          .filter((app) => app.bytes > 0)
          .map((app) => ({ id: app.name, name: app.title, size: app.bytes })),
      };
  return {
    info: {
      systemName: "Macalicious",
      releaseName: "Desktop",
      version: facts ? `build ${shortBuild(facts.build)}` : "",
      model: "macalicious-desktop on Ferrite",
      copyright: "Served by a Ferrite application. Macalicious is not an Apple product.",
    },
    versionDetails: facts ? [`Site ${facts.build}`, deploymentText(facts.generation)] : undefined,
    details: facts
      ? [
          ["Deployment", deploymentText(facts.generation)],
          ["Instance", facts.instance ?? ""],
          ["App Modules", String(facts.modules)],
          [
            "Session Data",
            `${facts.storage.truncated ? "At least " : ""}${formatSize(facts.storage.bytes)}`,
          ],
          ["Browser", browserName(browser.userAgent)],
          ["Processors", processors],
          ["Hardware", NO_HARDWARE],
        ]
      : [
          ["Server", failed ? "Not available" : "Loading…"],
          ["Browser", browserName(browser.userAgent)],
          ["Processors", processors],
          ["Hardware", NO_HARDWARE],
        ],
    displays:
      browser.width && browser.height
        ? [
            {
              id: "screen",
              name: "This Browser's Screen",
              size: `${browser.width} × ${browser.height} points at ${browser.scale ?? 1}×`,
            },
          ]
        : [],
    volume,
    storageSummary: facts
      ? drive
        ? `${formatSize(drive.available)} available of ${formatSize(drive.quota)}; the apps keep ${facts.storage.truncated ? "at least " : ""}${formatSize(facts.storage.bytes)} more for you, which the quota does not count`
        : `${facts.storage.truncated ? "At least " : ""}${formatSize(facts.storage.bytes)} in ${facts.storage.truncated ? "at least " : ""}${facts.storage.keys.toLocaleString("en-US")} ${facts.storage.keys === 1 ? "key" : "keys"} for this session; the store reports no capacity`
      : failed
        ? "Not available"
        : "Loading…",
  };
}

/** Reads `url` when the window opens and each time `reading` turns true: the facts, or whether the read failed. */
export function useDesktopFacts(url: string = ABOUT_FACTS_URL, reading = true) {
  const [facts, setFacts] = useState<DesktopFacts>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!reading) return;
    let live = true;
    sessionFetch(url, { credentials: "same-origin", headers: { accept: "application/json" } })
      .then(async (response) => (response.ok ? factsFromServer(await response.json()) : undefined))
      .catch(() => undefined)
      .then((read) => {
        if (!live) return;
        setFacts(read);
        setFailed(!read);
      });
    return () => {
      live = false;
    };
  }, [url, reading]);
  return { facts, failed };
}

const readTab = (stored: unknown) => (typeof stored === "string" ? resolveTab(stored) : undefined);

interface ScreenDetail {
  label?: string;
  width: number;
  height: number;
  devicePixelRatio: number;
}
type ReadScreens = () => Promise<{ screens: readonly ScreenDetail[] }>;

/** The Window Management API, in Chromium browsers only: every screen, once the person allows it. */
const screenReader = (): ReadScreens | undefined => {
  const read = (window as unknown as { getScreenDetails?: ReadScreens }).getScreenDetails;
  return read?.bind(window);
};

function useEveryScreen() {
  const read = screenReader();
  const [screens, setScreens] = useState<readonly ScreenDetail[]>();
  const [refused, setRefused] = useState(false);
  const ask = () => {
    read?.()
      .then((details) => setScreens(details.screens))
      .catch(() => setRefused(true));
  };
  const askRef = useRef(ask);
  askRef.current = ask;
  // Only a browser that was already told yes is read unasked: opening a window must not raise a prompt.
  const readable = read !== undefined;
  useEffect(() => {
    if (!readable) return;
    let live = true;
    navigator.permissions
      ?.query({ name: "window-management" as PermissionName })
      .then((permission) => {
        if (!live) return;
        if (permission.state === "granted") askRef.current();
        else if (permission.state === "denied") setRefused(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [readable]);
  return { screens, refused, readable, ask };
}

function ServedAboutThisMac({ state: windowState = "key", ...props }: AboutThisMacProps) {
  // Read again each time the window comes to the front: the drive changes behind it.
  const { facts, failed } = useDesktopFacts(ABOUT_FACTS_URL, windowState === "key");
  const [tab, setTab] = useDesktopSetting("about-this-mac.tab", readTab, "overview");
  const browser = {
    userAgent: navigator.userAgent,
    processors: navigator.hardwareConcurrency,
    width: window.screen?.width,
    height: window.screen?.height,
    scale: window.devicePixelRatio,
  };
  const every = useEveryScreen();
  const about = aboutProps(facts, failed, browser);
  const displays = every.screens?.map((entry, index) => ({
    id: `screen-${index}`,
    name: entry.label || `Screen ${index + 1}`,
    size: `${entry.width} × ${entry.height} points at ${entry.devicePixelRatio}×`,
  }));
  const displaysNote = every.screens ? null : !every.readable ? (
    <Label textStyle="small" color="secondary">
      This browser tells a page about its own screen only.
    </Label>
  ) : every.refused ? (
    <Label textStyle="small" color="secondary">
      The browser did not allow other screens to be named.
    </Label>
  ) : (
    <PushButton size="small" onClick={every.ask}>
      Show Every Screen…
    </PushButton>
  );
  return (
    <AboutThisMac
      {...props}
      {...about}
      displays={displays ?? about.displays}
      displaysNote={displaysNote}
      state={windowState}
      tab={tab}
      onTabChange={setTab}
      coloredUsage
    />
  );
}

/**
 * Where the Support and Service panes' links and the footer's License Agreement lead, as on a Mac: Apple's pages, opened
 * in Safari (`openUrl`). macOS Help opens Help Viewer instead.
 */
export const ABOUT_LINKS: Readonly<Record<string, string>> = {
  "macos-support": "https://support.apple.com/macos",
  "user-manual": "https://support.apple.com/manuals/",
  specifications: "https://support.apple.com/specs/",
  "hardware-support": "https://support.apple.com/mac",
  "important-information": "https://www.apple.com/legal/",
  "coverage-status": "https://checkcoverage.apple.com/",
  "repair-options": "https://support.apple.com/repair",
  "service-plans": "https://www.apple.com/support/products/mac/",
  "license-agreement": "https://www.apple.com/legal/sla/",
};

/**
 * What the window's buttons and links do on the desktop, through the host the desktop gives every application window
 * (`DesktopWindowHostContext`): System Report… opens System Information, Manage… Storage Management, Software Update…
 * and Displays Preferences… System Preferences on their panes, macOS Help Help Viewer, and every other link its page
 * in Safari. Outside a desktop the window has no host and opens nothing, as `AboutThisMac` says.
 */
function useDesktopActions(): Partial<AboutThisMacProps> {
  const host = use(DesktopWindowHostContext);
  const launch = host?.launch;
  if (!launch) return {};
  const pane = (id: string) => {
    requestPane(id);
    launch("system-preferences");
  };
  return {
    onSystemReport: () => launch("system-information"),
    onSoftwareUpdate: () => pane("software-update"),
    onDisplaysPreferences: () => pane("displays"),
    onManageStorage: () => launch("storage-management"),
    onLink: (id) => {
      if (id === "macos-help") requestHelp("macOS");
      else openUrl(ABOUT_LINKS[id] ?? "https://support.apple.com/", "about-this-mac");
    },
  };
}

/**
 * About This Mac as the desktop shows it. When the `macalicious-desktop` Ferrite application
 * serves the desktop, the window shows only what that application and the browser can know:
 * the deployment, the site build, the modules, what this session keeps on the server, the
 * browser, its processor count and its screen, and it says that a page cannot read the hardware.
 * Every other build
 * shows the captured Mac, as `AboutThisMac` does. Its buttons and links act through the desktop
 * (`useDesktopActions`).
 */
export function DesktopAboutThisMac(props: AboutThisMacProps) {
  const actions = useDesktopActions();
  useAboutThisMacMenus(props.state === "key");
  return servedByDesktopApp() ? (
    <ServedAboutThisMac {...actions} {...props} />
  ) : (
    <AboutThisMac {...actions} {...props} />
  );
}
