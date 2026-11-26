"use client";

import { MenuBarExtraMenu, type MenuBarExtraMenuProps } from "macalicious/menu-bar-extra";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { showInFinder } from "../finder/finder-open";
import {
  runScriptFile,
  SCRIPT_MENU_SETTING,
  type ScriptMenuEntry,
  scriptMenuEntries,
  scriptsFolderIn,
} from "../script-editor/script-editor-server";
import { CLOCK_ANALOG_KEY } from "../system-preferences/panes/date-and-time/menu-clock";
import { AirPlayGlyph, WiFiGlyph } from "./desktop-artwork";
import { requestDesktopEffects } from "./desktop-effects";
import { useDrive } from "./desktop-files";
import {
  changeDesktopValue,
  readBoolean,
  useDesktopSetting,
  useDesktopValue,
} from "./desktop-personal";
import { followDrag } from "./desktop-spaces-bar";
import { useOnline } from "./desktop-system";

/** The order of the menu bar's extras a Command-drag chose, by their names. */
const EXTRAS_ORDER = "menuBar.extrasOrder";

const readOrder = (stored: unknown): readonly string[] | undefined =>
  Array.isArray(stored) && stored.every((each) => typeof each === "string")
    ? (stored as string[])
    : undefined;

const NO_ORDER: readonly string[] = Object.freeze([]);

/** On a Mac these stay at the end of the bar. */
const FIXED = new Set(["Spotlight", "Siri", "Notification Center"]);

/** An extra's name: what it says it is, up to any live detail after a comma. */
export const extraName = (extra: Element) =>
  (extra.getAttribute("aria-label") ?? extra.textContent ?? "").split(",")[0]?.trim() ?? "";

/**
 * The extras in the order `saved` asks for: those it names take the places of the ones that can move,
 * in its order; the rest stay in their places, the ones new since it was saved among them.
 */
export function orderedExtras(names: readonly string[], saved: readonly string[]): string[] {
  const moving = names.filter((name) => !FIXED.has(name) && saved.includes(name));
  const inOrder = saved.filter((name) => moving.includes(name));
  let next = 0;
  return names.map((name) => (moving.includes(name) ? (inOrder[next++] as string) : name));
}

/** `dragged` taken out and put where `over` stands, among the extras that can move. */
export function withExtraMoved(names: readonly string[], dragged: string, over: string): string[] {
  const rest = names.filter((name) => name !== dragged);
  const at = rest.indexOf(over);
  const before = names.indexOf(dragged) > names.indexOf(over);
  return [...rest.slice(0, before ? at : at + 1), dragged, ...rest.slice(before ? at : at + 1)];
}

/** Command, or Control where a browser has no Command and a Mac's Control-click is a secondary click. */
const commandHeld = (event: MouseEvent) =>
  /Mac/.test(navigator.platform) ? event.metaKey : event.ctrlKey;

/**
 * Command-drag moves an extra along the menu bar, kept per account. Answers the ref of the extras' group.
 * The press does not open the extra's menu.
 */
export function useExtrasOrder() {
  const [saved, setSaved] = useDesktopSetting(EXTRAS_ORDER, readOrder, NO_ORDER);
  const group = useRef<HTMLElement | null>(null);
  const latest = useRef({ saved, setSaved });
  latest.current = { saved, setSaved };

  const extras = useCallback(
    () => [...(group.current?.querySelectorAll<HTMLElement>(".mac-menu-bar-extra") ?? [])],
    [],
  );
  const apply = useCallback(
    (order: readonly string[]) => {
      const all = extras();
      const names = all.map(extraName);
      const wanted = orderedExtras(names, order);
      for (const extra of all) {
        extra.style.order = String(wanted.indexOf(extraName(extra)));
      }
    },
    [extras],
  );
  useEffect(() => apply(saved));

  const ref = useCallback(
    (element: HTMLElement | null) => {
      group.current = element;
      if (!element) return undefined;
      // Whether the press now held down began a Command-drag: its click is ours even if the key is let go first.
      let claimed = false;
      const press = (down: PointerEvent) => {
        claimed = false;
        if (down.button !== 0 || !commandHeld(down)) return;
        const extra = (down.target as Element).closest<HTMLElement>(".mac-menu-bar-extra");
        if (!extra || FIXED.has(extraName(extra))) return;
        claimed = true;
        down.preventDefault();
        down.stopPropagation();
        const name = extraName(extra);
        const inPlace = () =>
          extras()
            .sort((a, b) => Number(a.style.order) - Number(b.style.order))
            .map(extraName);
        let order = inPlace();
        followDrag(
          down,
          (move) => {
            const over = extras().find((each) => {
              const { left, right } = each.getBoundingClientRect();
              return move.clientX >= left && move.clientX <= right;
            });
            const overName = over && extraName(over);
            if (!overName || overName === name || FIXED.has(overName)) return;
            order = withExtraMoved(order, name, overName);
            apply(order);
          },
          (up, started) => {
            if (!started) return;
            if (up) latest.current.setSaved(order.filter((each) => !FIXED.has(each)));
            else apply(latest.current.saved);
          },
        );
      };
      // The extra's menu opens on the press or on the click after it: it is not to hear these.
      const swallow = (event: MouseEvent) => {
        if (event.button === 0 && (claimed || commandHeld(event))) {
          event.stopPropagation();
          if (event.type === "click") event.preventDefault();
        }
      };
      // An extra that shows later takes its place from the order saved, not the front of the bar.
      const arrivals = new MutationObserver(() => apply(latest.current.saved));
      arrivals.observe(element, { childList: true });
      element.addEventListener("pointerdown", press, true);
      element.addEventListener("mousedown", swallow, true);
      element.addEventListener("click", swallow, true);
      return () => {
        arrivals.disconnect();
        element.removeEventListener("pointerdown", press, true);
        element.removeEventListener("mousedown", swallow, true);
        element.removeEventListener("click", swallow, true);
      };
    },
    [apply, extras],
  );
  return ref;
}

/** The clock's View as Analog and View as Digital, the setting its pane's Analog writes. */
export function ClockViewRows({ analog }: { analog: boolean }) {
  return (
    <MenuRadioGroup
      value={analog ? "analog" : "digital"}
      onValueChange={(view) => changeDesktopValue(CLOCK_ANALOG_KEY, view === "analog")}
    >
      <MenuRadioItem value="analog">View as Analog</MenuRadioItem>
      <MenuRadioItem value="digital">View as Digital</MenuRadioItem>
    </MenuRadioGroup>
  );
}

function BluetoothGlyph() {
  return (
    <svg viewBox="0 0 12 16" width="12" height="16" aria-hidden="true">
      <path d="M2 4.5l8 7L6 15V1l4 3.5-8 7" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function ScriptGlyph() {
  return (
    <svg viewBox="0 0 14 16" width="14" height="16" aria-hidden="true">
      <path
        d="M4 2.5h7.5a1.5 1.5 0 0 1 1.5 1.5v1h-3V4a1.5 1.5 0 0 0-1.5-1.5M4 2.5A1.5 1.5 0 0 0 2.5 4v7h7.5v1.5a1 1 0 0 0 2 0V5M1 11h9v1.5a1 1 0 0 0 1 1H2.5A1.5 1.5 0 0 1 1 12"
        fill="none"
        stroke="currentColor"
      />
    </svg>
  );
}

/** What the row at the end of the Script menu says about the last script run from it. */
export const scriptOutcome = (name: string, result: string, failed: boolean) => {
  const shown = result.length > 60 ? `${result.slice(0, 60)}…` : result;
  if (failed) return `“${name}” stopped: ${shown}`;
  return shown === "" ? `“${name}” finished` : `“${name}”: ${shown}`;
};

function ScriptRows({
  entries,
  busy,
  onRun,
}: {
  entries: readonly ScriptMenuEntry[];
  busy: boolean;
  onRun: (name: string, file: string, applescript: boolean) => void;
}) {
  return entries.map((entry) =>
    "entries" in entry ? (
      <Submenu key={entry.name}>
        <SubmenuTrigger>{entry.name}</SubmenuTrigger>
        <SubmenuPopup aria-label={entry.name}>
          <ScriptRows entries={entry.entries} busy={busy} onRun={onRun} />
        </SubmenuPopup>
      </Submenu>
    ) : (
      <MenuItem
        key={entry.file}
        disabled={busy}
        onClick={() => onRun(entry.name, entry.file, entry.applescript)}
      >
        {entry.name}
      </MenuItem>
    ),
  );
}

/** The Script menu, once Script Editor's Preferences ask for it: the scripts of `Documents/Scripts`. */
export function ScriptMenu({ titleProps }: { titleProps: MenuBarExtraMenuProps["titleProps"] }) {
  const shown = useDesktopValue(SCRIPT_MENU_SETTING, readBoolean, false);
  const drive = useDrive(shown);
  const [running, setRunning] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  if (!shown) return null;
  const folder = drive ? scriptsFolderIn(drive) : undefined;
  const entries = drive && folder ? scriptMenuEntries(drive, folder) : [];
  const run = (name: string, file: string, applescript: boolean) => {
    setRunning(name);
    setOutcome(null);
    void runScriptFile(file, applescript).then(({ result, failed }) => {
      setRunning(null);
      setOutcome(scriptOutcome(name, result, failed));
    });
  };
  return (
    <MenuBarExtraMenu aria-label="Script Menu" titleProps={titleProps} title={<ScriptGlyph />}>
      <MenuItem onClick={() => requestDesktopEffects([{ open: "script-editor" }])}>
        Open Script Editor
      </MenuItem>
      <MenuItem
        disabled={!folder}
        title={folder ? undefined : "There is no Scripts folder in Documents yet."}
        onClick={() => folder && showInFinder({ id: folder.id })}
      >
        Open Scripts Folder
      </MenuItem>
      <MenuSeparator />
      {entries.length > 0 ? (
        <ScriptRows entries={entries} busy={running !== null} onRun={run} />
      ) : (
        <MenuItem disabled>No Scripts</MenuItem>
      )}
      {running || outcome ? (
        <>
          <MenuSeparator />
          <MenuItem disabled>{running ? `Running “${running}”…` : outcome}</MenuItem>
        </>
      ) : null}
    </MenuBarExtraMenu>
  );
}

/** What `navigator.connection` (Chromium's Network Information API) says of the link. */
interface ConnectionReport extends EventTarget {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

const connectionReport = () =>
  (navigator as Navigator & { connection?: ConnectionReport }).connection;

const CONNECTION_TYPES: Readonly<Record<string, string>> = {
  wifi: "Wi-Fi",
  ethernet: "Ethernet",
  cellular: "Cellular",
  bluetooth: "Bluetooth",
};

/** The rows of what the browser reports of the link; none where it reports nothing. */
export function connectionRows(report: ConnectionReport | undefined): string[] {
  if (!report) return [];
  const kind = report.type && CONNECTION_TYPES[report.type];
  return [
    ...(kind ? [`Connected by: ${kind}`] : []),
    ...(report.downlink ? [`Speed: about ${report.downlink} Mb/s`] : []),
    ...(report.rtt ? [`Round trip: about ${report.rtt} ms`] : []),
    ...(report.effectiveType ? [`Quality: like ${report.effectiveType.toUpperCase()}`] : []),
  ];
}

const subscribeConnection = (listener: () => void) => {
  const report = connectionReport();
  report?.addEventListener("change", listener);
  return () => report?.removeEventListener("change", listener);
};

/**
 * The Wi-Fi menu: whether the browser says it is online, what `navigator.connection` reports of the
 * link where the engine has it, and why it can neither see nor switch Wi-Fi networks.
 */
export function NetworkMenu({
  titleProps,
  preferences,
}: {
  titleProps: MenuBarExtraMenuProps["titleProps"];
  preferences: (pane: string) => void;
}) {
  const online = useOnline();
  const rows = useSyncExternalStore(
    subscribeConnection,
    () => connectionRows(connectionReport()).join("\n"),
    () => "",
  );
  return (
    <MenuBarExtraMenu aria-label="Wi-Fi" titleProps={titleProps} title={<WiFiGlyph />}>
      <MenuItem disabled>{online ? "Network: Connected" : "Network: Offline"}</MenuItem>
      {online && rows ? (
        rows.split("\n").map((row) => (
          <MenuItem key={row} disabled>
            {row}
          </MenuItem>
        ))
      ) : (
        <MenuItem disabled>This browser reports only whether it is online.</MenuItem>
      )}
      <MenuItem disabled>Turn Wi-Fi Off</MenuItem>
      <MenuItem disabled>A web page cannot switch Wi-Fi.</MenuItem>
      <MenuItem disabled>A web page cannot see or join Wi-Fi networks.</MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => preferences("network")}>Open Network Preferences…</MenuItem>
    </MenuBarExtraMenu>
  );
}

/** The parts of Chromium's Presentation API the AirPlay menu uses; other engines have none of it. */
interface DisplayConnection extends EventTarget {
  terminate: () => void;
}
interface DisplayRequest {
  getAvailability: () => Promise<EventTarget & { value: boolean }>;
  start: () => Promise<DisplayConnection>;
}

const displayRequest = (): DisplayRequest | null => {
  const Request = (window as Window & { PresentationRequest?: new (url: string) => DisplayRequest })
    .PresentationRequest;
  return Request ? new Request(window.location.href) : null;
};

/**
 * The AirPlay menu: a page cannot reach AirPlay, but where the browser has the Presentation API it
 * can look for a second display and put this desktop on it, and it says which of these holds.
 */
export function AirPlayMenu({
  titleProps,
  preferences,
}: {
  titleProps: MenuBarExtraMenuProps["titleProps"];
  preferences: (pane: string) => void;
}) {
  const [request, setRequest] = useState<DisplayRequest | null>(null);
  useEffect(() => setRequest(displayRequest()), []);
  const [found, setFound] = useState<boolean | null>(null);
  const [showing, setShowing] = useState<DisplayConnection | null>(null);
  useEffect(() => {
    if (!request) return;
    let live = true;
    let watched: (EventTarget & { value: boolean }) | undefined;
    const read = () => {
      if (live && watched) setFound(watched.value);
    };
    request
      .getAvailability()
      .then((availability) => {
        watched = availability;
        availability.addEventListener("change", read);
        read();
      })
      .catch(() => {
        if (live) setFound(null);
      });
    return () => {
      live = false;
      watched?.removeEventListener("change", read);
    };
  }, [request]);
  const show = () => {
    request
      ?.start()
      .then((connection) => {
        const gone = () => setShowing(null);
        connection.addEventListener("terminate", gone);
        connection.addEventListener("close", gone);
        setShowing(connection);
      })
      // The person closed the browser's picker, or nothing answered: AirPlay stays off.
      .catch(() => setShowing(null));
  };
  const looked = request
    ? found
      ? "A display is available"
      : found === false
        ? "No Nearby Displays"
        : "The browser cannot look for displays here."
    : "This browser cannot look for displays.";
  return (
    <MenuBarExtraMenu aria-label="AirPlay" titleProps={titleProps} title={<AirPlayGlyph />}>
      <MenuItem disabled>{showing ? "AirPlay: On" : "AirPlay: Off"}</MenuItem>
      {showing ? (
        <MenuItem onClick={() => showing.terminate()}>Turn AirPlay Off</MenuItem>
      ) : (
        <>
          <MenuItem disabled>{looked}</MenuItem>
          {found ? <MenuItem onClick={show}>Show Desktop on a Display…</MenuItem> : null}
        </>
      )}
      <MenuSeparator />
      <MenuItem onClick={() => preferences("displays")}>Open Displays Preferences…</MenuItem>
    </MenuBarExtraMenu>
  );
}

/**
 * Bluetooth's menu, once its pane asks for it: a page cannot see the Mac's devices, and says so. The
 * Script menu stands next to it.
 */
export function BluetoothMenu({
  titleProps,
  preferences,
}: {
  titleProps: MenuBarExtraMenuProps["titleProps"];
  preferences: (pane: string) => void;
}) {
  const shown = useDesktopValue("bluetooth.showInMenuBar", readBoolean, false);
  if (!shown) return null;
  return (
    <MenuBarExtraMenu aria-label="Bluetooth" titleProps={titleProps} title={<BluetoothGlyph />}>
      <MenuItem disabled>Bluetooth: Unavailable</MenuItem>
      <MenuItem disabled>A web page cannot see Bluetooth devices.</MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => preferences("bluetooth")}>Open Bluetooth Preferences…</MenuItem>
    </MenuBarExtraMenu>
  );
}
