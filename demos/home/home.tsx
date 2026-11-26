"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import {
  CatalystChrome,
  type CatalystChromeProps,
  CatalystSidebar,
  CatalystSidebarGroup,
  CatalystSidebarItem,
} from "macalicious/catalyst-chrome";
import { Checkbox } from "macalicious/checkbox";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EmptyState } from "macalicious/empty-state";
import { HomekitTile, HomekitTileGrid } from "macalicious/homekit-tile";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { Sheet, SheetPopup } from "macalicious/sheet";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarPullDown } from "macalicious/toolbar-pop-up";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { readString, useKeptValue } from "../desktop/desktop-kept-value";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import { servedByDesktopApp, sessionFetch, useServerState } from "../desktop/desktop-server";
import {
  dueAutomations,
  moved,
  movedRoom,
  rangeOf,
  removeAccessory,
  removeRoom,
  removeScene,
  renameRoom,
  runAutomations,
  triggeredBy,
  triggerText,
} from "./home-changes";
import {
  accessoryStatus,
  applyScene,
  defaultHome,
  defaultHomes,
  emptyHome,
  type HomeAccessory,
  type HomeAccessoryKind,
  type HomeAutomation,
  type HomeDefinition,
  type HomeScene,
  isLight,
  isSwitchable,
  sceneIsActive,
  statusLines,
} from "./home-data";
import {
  AccessoryGlyph,
  ChevronGlyph,
  HomeGlyph,
  MicrophoneOffGlyph,
  PlusGlyph,
  SceneGlyph,
} from "./home-icons";
import { type HomeTab, NO_LIGHT_FOR_SCENE, useHomeMenus } from "./home-menus";
import {
  HOME_HOMES_URL,
  HOME_LIMITS,
  homesFromServer,
  homesReadable,
  homesToServer,
} from "./home-server";
import {
  AccessoryForm,
  AddForm,
  type Addition,
  AutomationForm,
  ConfirmForm,
  HomeSettingsForm,
  NameForm,
  RoomSettingsForm,
  SceneForm,
} from "./home-sheets";
import { onRunSceneRequest } from "./home-siri";
import "./home.tokens.css";
import "./home.css";

const TABS: readonly { value: HomeTab; label: string; style: CSSProperties }[] = [
  // Measured: the control is 290 pt wide, with its dividers 96.5 and 193 pt from its start.
  { value: "home", label: "Home", style: { flex: "none", width: 96.5 } },
  { value: "rooms", label: "Rooms", style: { flex: "none", width: 96.5 } },
  { value: "automation", label: "Automation", style: { flex: "none", width: 97 } },
];

const readTab = (stored: unknown): HomeTab | undefined =>
  TABS.find(({ value }) => value === stored)?.value;

/** Measured widths of the toolbar's two buttons: 47 pt with the chevron, 39 pt without. */
const PULL_DOWN: CSSProperties = { width: 47 };
const ADD_BUTTON: CSSProperties = { width: 39, padding: 0 };
/**
 * The items before the segmented control end 124.5 pt from the window's leading edge and the
 * add button starts 46.5 pt from its trailing edge. This much fixed space on the trailing side
 * (the difference, less one 7 pt gap) makes the two flexible spaces equal, which keeps the
 * control centred on the window at every width.
 */
const CENTRING_SPACE = 71;

/** How many status lines are shown before "and 1 More". */
const STATUS_LINES = 3;

/** How often an open window looks for an automation whose time has come. */
const AUTOMATION_TICK_MS = 15_000;

const SIMULATED =
  "No real accessories: this desktop has no HomeKit, so nothing here switches anything in the world. What you add is simulated and kept on the server.";

/** `prefix-n` for the first `n` from `start` that no id in `taken` has. */
function freshId(prefix: string, start: number, taken: ReadonlySet<string>): string {
  let n = start;
  while (taken.has(`${prefix}-${n}`)) n += 1;
  return `${prefix}-${n}`;
}

/** The glyph's colour on a tile that is on; a light takes the tile's own yellow. */
const TINTS: Partial<Record<HomeAccessoryKind, string>> = {
  lamp: "var(--mac-home-tint-lamp)",
  tv: "var(--mac-home-tint-media)",
  speaker: "var(--mac-home-tint-media)",
  "garage-door": "var(--mac-home-tint-door)",
};

export interface HomeProps extends Omit<WindowProps, "children"> {
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /**
   * For the toolbar row, which is this window's drag region: called when the primary pointer
   * button goes down on the bar itself, not on a control in it. A window manager starts moving
   * the window here.
   */
  onDragRegionPointerDown?: CatalystChromeProps["onDragRegionPointerDown"];
  /** For the toolbar row: called when the bar itself is double-clicked. */
  onDragRegionDoubleClick?: CatalystChromeProps["onDragRegionDoubleClick"];
}

/** What a tile hands to a drag: the tile's kind and id, or a room's name. */
interface Dragged {
  kind: "accessory" | "scene" | "room";
  id: string;
}

interface AccessoryTileProps {
  accessory: HomeAccessory;
  selected: boolean;
  onSwitch: (id: string, on: boolean) => void;
  drag: (kind: Dragged["kind"], id: string) => Record<string, unknown>;
}

/** Why a click on a tile changes nothing: each says it as the tile's tooltip. */
const SENSOR_REASON = "A sensor only reports: it has nothing to switch.";
const SCENE_ON_REASON = "This scene is on: choosing it again changes nothing.";

/** One accessory: a click switches it, unless it is a sensor, which only reports. */
function AccessoryTile({ accessory, selected, onSwitch, drag }: AccessoryTileProps) {
  const status = accessoryStatus(accessory);
  return (
    <HomekitTile
      {...drag("accessory", accessory.id)}
      data-home-accessory={accessory.id}
      data-home-selected={selected ? "" : undefined}
      aria-description={selected ? "Selected" : undefined}
      room={accessory.room}
      name={accessory.name}
      status={
        accessory.muted ? (
          <>
            {status}
            <span className="mac-home-note">, microphone off</span>
          </>
        ) : (
          status
        )
      }
      icon={<AccessoryGlyph kind={accessory.kind} active={accessory.on} />}
      badge={accessory.muted ? <MicrophoneOffGlyph /> : undefined}
      tint={accessory.color ?? TINTS[accessory.kind]}
      active={accessory.on}
      title={isSwitchable(accessory) ? undefined : SENSOR_REASON}
      onActiveChange={(on) => {
        if (isSwitchable(accessory)) onSwitch(accessory.id, on);
      }}
    />
  );
}

interface SummaryProps {
  /** The large title: the home's or the room's name. */
  title: string;
  /** The status lines under it. */
  lines: readonly string[];
  /** The line that says nothing here is real, on the served desktop. */
  note?: string;
}

/** The title and the status lines; lines beyond the third wait behind "and 1 More". */
function Summary({ title, lines, note }: SummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const more = lines.length - STATUS_LINES;
  const shown = expanded ? lines : lines.slice(0, STATUS_LINES);
  return (
    <div className="mac-home-summary">
      <h2 className="mac-home-title">{title}</h2>
      {shown.length > 0 ? (
        <p className="mac-home-status">
          {shown.map((line) => (
            <span key={line} className="mac-home-status-line">
              {line}
            </span>
          ))}
        </p>
      ) : null}
      {more > 0 ? (
        <div className="mac-home-more">
          <BorderlessButton
            aria-expanded={expanded}
            // The chevron stands 4.5 pt after the words; the focus ring's corners are 3 pt.
            style={{ gap: 4.5, borderRadius: 3 }}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              "Show Less"
            ) : (
              <>
                and {more} More
                <ChevronGlyph />
              </>
            )}
          </BorderlessButton>
        </div>
      ) : null}
      {note ? <p className="mac-home-simulated">{note}</p> : null}
    </div>
  );
}

/** A header and the grid of tiles it names. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="mac-home-section">
      <h3 id={id} className="mac-home-heading">
        {title}
      </h3>
      <HomekitTileGrid aria-labelledby={id}>{children}</HomekitTileGrid>
    </div>
  );
}

/** The sheet the window shows. */
type Dialog =
  | { kind: "accessory" }
  | { kind: "scene" }
  | { kind: "new-room" }
  | { kind: "new-home" }
  | { kind: "home-settings" }
  | { kind: "room-settings"; room: string }
  | { kind: "accessory-settings"; id: string }
  | { kind: "scene-settings"; id: string }
  | { kind: "automation"; id?: string }
  | { kind: "confirm"; title: string; text: string; run: () => void };

/** Which tile a secondary click was on. */
type ContextTarget = { kind: "accessory" | "scene"; id: string } | null;

const ACCESSORY_TILES = "[data-home-accessory]";
const TILES = "[data-home-accessory], [data-home-scene]";

/** The tile an arrow key goes to from `from`, by where the tiles stand on the screen. */
function tileFrom(from: HTMLElement, key: string, view: Element): HTMLElement | undefined {
  const all = [...view.querySelectorAll<HTMLElement>(TILES)];
  const at = all.indexOf(from);
  if (key === "ArrowLeft") return all[at - 1];
  if (key === "ArrowRight") return all[at + 1];
  const box = from.getBoundingClientRect();
  const sign = key === "ArrowUp" ? -1 : 1;
  const below = all
    .map((tile) => ({ tile, box: tile.getBoundingClientRect() }))
    .filter((each) => (each.box.top - box.top) * sign > 1);
  below.sort(
    (a, b) =>
      Math.abs(a.box.top - box.top) - Math.abs(b.box.top - box.top) ||
      Math.abs(a.box.left - box.left) - Math.abs(b.box.left - box.left),
  );
  return below[0]?.tile;
}

/** Tells Notification Center that an automation ran, once for each run. */
function notifyRan(automation: HomeAutomation, at: number) {
  void sessionFetch("/api/notification-center/notify", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "idempotency-key": `home-automation-${automation.id}-${Math.floor(at / 60_000)}`,
    },
    body: JSON.stringify({
      app: "home",
      title: `Automation “${automation.name}” ran`,
      body: "On simulated accessories: nothing in the world changed.",
    }),
  }).catch((error: unknown) => console.error(error));
}

/**
 * Home, as in macOS 10.15 Catalina: an iPad app in a Mac window, with a translucent toolbar
 * over a wallpaper, and the home's scenes and accessories as tiles.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a page
 * or a window manager places it (`style`, `width`, `height`, `ref`) and tells it whether it is
 * key (`state`); the window controls' and the toolbar row's callbacks, the eight props a
 * managed window's `render` supplies beside the window's, are handed to those parts.
 *
 * Nothing is connected to a real home: the accessories are simulated. Served by the desktop's
 * Ferrite application, a person starts from an empty home and it is kept on the server
 * (`ferrite-apps/desktop/src/apps/home`), and the window says that nothing in it is real;
 * everywhere else the sample homes live in the component's state for as long as it is mounted.
 */
export function Home({
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  state = "key",
  width = 914,
  height = 768,
  className,
  ...windowProps
}: HomeProps) {
  const served = servedByDesktopApp();
  const [homes, setHomes] = useState<readonly HomeDefinition[]>(() =>
    served ? [emptyHome] : defaultHomes,
  );
  const [homeId, setHomeId] = useKeptValue("home.homeId", readString, homes[0]?.id ?? "");
  const [tab, setTab] = useKeptValue<HomeTab>("home.tab", readTab, "home");
  const [roomName, setRoomName] = useState<string>();
  const [dialog, setDialog] = useState<Dialog>({ kind: "accessory" });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [contextTarget, setContextTarget] = useState<ContextTarget>(null);
  // The accessories chosen with Command- or Shift-click, while this tab shows them.
  const [chosenIds, setChosenIds] = useState<ReadonlySet<string>>(new Set());
  const lastChosen = useRef<string | null>(null);
  // A scene Spotlight or Siri asked to show, until its tile is on the screen.
  const [sceneToShow, setSceneToShow] = useState<string | null>(null);
  const view = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  // The sheet hangs from this line, under the toolbar.
  const [sheetAnchor, setSheetAnchor] = useState<HTMLDivElement | null>(null);
  const dragged = useRef<Dragged | null>(null);

  const home = homes.find((candidate) => candidate.id === homeId) ?? homes[0] ?? defaultHome;
  const room = home.rooms.find((name) => name === roomName) ?? home.rooms[0] ?? "";
  const { accessories } = home;
  const automations = home.automations ?? [];

  // Served by the desktop's Ferrite application: the person's homes replace the empty one, and
  // every change is saved. Until the first load settles the window is inert, so no change is made
  // that the load would replace.
  const loading = useServerState({
    url: HOME_HOMES_URL,
    enabled: served,
    value: homes,
    onLoad: (stored) => {
      if (!homesReadable(stored)) return false;
      setHomes(homesFromServer(stored) ?? [emptyHome]);
    },
    toBody: homesToServer,
  });
  const taken = () =>
    new Set(
      homes.flatMap((candidate) => [
        candidate.id,
        ...candidate.accessories.map((accessory) => accessory.id),
        ...candidate.scenes.map((scene) => scene.id),
        ...(candidate.automations ?? []).map((automation) => automation.id),
      ]),
    );

  const change = (next: (current: HomeDefinition) => HomeDefinition) =>
    setHomes((all) =>
      all.map((candidate) => (candidate.id === home.id ? next(candidate) : candidate)),
    );

  const switchAccessory = (id: string, on: boolean) => {
    const at = Date.now();
    const set = (current: HomeDefinition): HomeDefinition => ({
      ...current,
      accessories: current.accessories.map((accessory) =>
        accessory.id === id ? { ...accessory, on } : accessory,
      ),
    });
    const ran = triggeredBy(home, id, on);
    change((current) => runAutomations(set(current), ran, at));
    if (served) for (const automation of ran) notifyRan(automation, at);
  };
  const runScene = (scene: HomeScene) =>
    change((current) => ({ ...current, accessories: applyScene(scene, current.accessories) }));

  const chosen = accessories.filter((accessory) => chosenIds.has(accessory.id));
  const clearChosen = () => {
    setChosenIds(new Set());
    lastChosen.current = null;
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: a selection lasts while one tab of one home or room shows it
  useEffect(clearChosen, [home.id, tab, room]);
  const switchChosen = (on: boolean) => {
    for (const accessory of chosen) {
      if (isSwitchable(accessory) && accessory.on !== on) switchAccessory(accessory.id, on);
    }
  };
  const moveChosen = (to: string) =>
    change((current) => ({
      ...current,
      accessories: current.accessories.map((accessory) =>
        chosenIds.has(accessory.id) ? { ...accessory, room: to } : accessory,
      ),
    }));

  useOpenItemRequests("home", (request) => setSceneToShow(request.id));
  useEffect(() => {
    if (!sceneToShow || loading) return;
    const holder = homes.find((each) => each.scenes.some((scene) => scene.id === sceneToShow));
    if (!holder) {
      setSceneToShow(null);
      return;
    }
    if (holder.id !== home.id) setHomeId(holder.id);
    if (tab !== "home") setTab("home");
    const tile = view.current?.querySelector<HTMLElement>(`[data-home-scene="${sceneToShow}"]`);
    if (tile) {
      tile.focus();
      setSceneToShow(null);
    }
  });
  useEffect(
    () =>
      onRunSceneRequest(({ home: holder, scene: id }) =>
        setHomes((all) =>
          all.map((each) => {
            const scene = each.id === holder && each.scenes.find((one) => one.id === id);
            return scene ? { ...each, accessories: applyScene(scene, each.accessories) } : each;
          }),
        ),
      ),
    [],
  );
  const changeAccessory = (id: string, changes: Partial<HomeAccessory>) =>
    change((current) => ({
      ...current,
      accessories: current.accessories.map((accessory) =>
        accessory.id === id ? { ...accessory, ...changes } : accessory,
      ),
    }));
  const add = ({ name, room: place, kind, on, sets }: Addition) =>
    change((current) => {
      // An addition past the module's limits, or to a room the home lacks, would be refused.
      if (dialog.kind === "accessory") {
        if (!current.rooms.includes(place)) return current;
        if (current.accessories.length >= HOME_LIMITS.accessories) return current;
        const id = freshId(`${current.id}-accessory`, current.accessories.length, taken());
        const accessory: HomeAccessory = { id, room: place, name, kind, on: false, favorite: true };
        return { ...current, accessories: [...current.accessories, accessory] };
      }
      if (current.scenes.length >= HOME_LIMITS.scenes) return current;
      const lights = current.accessories.filter(
        (accessory) => accessory.room === place && isLight(accessory),
      );
      const scene: HomeScene = {
        id: freshId(`${current.id}-scene`, current.scenes.length, taken()),
        name,
        icon: "house",
        sets: { ...Object.fromEntries(lights.map((light) => [light.id, on])), ...sets },
      };
      return { ...current, scenes: [...current.scenes, scene] };
    });
  const addHome = (name: string) => {
    const id = freshId("home", homes.length, taken());
    setHomes((all) => [...all, { ...emptyHome, id, name }]);
    setHomeId(id);
    setRoomName(undefined);
  };
  const open = (next: Dialog) => {
    setDialog(next);
    setSheetOpen(true);
  };
  const confirm = (title: string, text: string, run: () => void) =>
    open({ kind: "confirm", title, text, run });
  const askRemoveAccessory = (accessory: HomeAccessory) =>
    confirm(
      `Remove “${accessory.name}”?`,
      "The simulated accessory goes from its room, from every scene and from any automation that watches it.",
      () => change((current) => removeAccessory(current, accessory.id)),
    );
  const askRemoveScene = (scene: HomeScene) =>
    confirm(`Remove “${scene.name}”?`, "Any automation that runs it goes too.", () =>
      change((current) => removeScene(current, scene.id)),
    );
  const askRemoveChosen = () =>
    confirm(
      `Remove ${chosen.length} Accessories?`,
      "The simulated accessories go from their rooms, from every scene and from any automation that watches them.",
      () => {
        const ids = chosen.map((accessory) => accessory.id);
        change((current) => ids.reduce(removeAccessory, current));
        clearChosen();
      },
    );
  const askRemoveRoom = (name: string) =>
    confirm(`Remove “${name}”?`, "What is in the room moves to the first room left.", () => {
      change((current) => removeRoom(current, name));
      setRoomName(undefined);
    });

  // A scene sets accessories, and a room's lights in one go where the room has any.
  const litRooms = home.rooms.filter((name) =>
    accessories.some((accessory) => accessory.room === name && isLight(accessory)),
  );
  const canAddAccessory = home.rooms.length > 0 && accessories.length < HOME_LIMITS.accessories;
  const canAddScene =
    accessories.some((accessory) => accessory.kind !== "sensor") &&
    home.scenes.length < HOME_LIMITS.scenes;
  const canAddRoom = home.rooms.length < HOME_LIMITS.rooms;
  const canAddHome = homes.length < HOME_LIMITS.homes;
  const canAddAutomation = home.scenes.length > 0 && automations.length < HOME_LIMITS.automations;

  useHomeMenus({
    within: sheetAnchor,
    keysLive: state === "key" && !sheetOpen && !loading,
    tab,
    setTab,
    scenes: home.scenes,
    canAddAccessory,
    canAddScene,
    canAddRoom,
    canAddHome,
    newHome: () => open({ kind: "new-home" }),
    newRoom: () => open({ kind: "new-room" }),
    addAccessory: () => open({ kind: "accessory" }),
    addScene: () => open({ kind: "scene" }),
    homeSettings: () => open({ kind: "home-settings" }),
    runScene,
    say: setMessage,
  });

  // While the window is open, an automation whose time has come runs. There is no hub to run it
  // otherwise, and the sheet that makes one says so.
  const homesNow = useRef(homes);
  homesNow.current = homes;
  const hasTimed = homes.some((each) =>
    (each.automations ?? []).some((automation) => automation.trigger.kind === "time"),
  );
  useEffect(() => {
    if (loading || !hasTimed) return;
    const tick = () => {
      const now = new Date();
      const due = homesNow.current.map((each) => dueAutomations(each, now));
      if (due.every((list) => list.length === 0)) return;
      const at = now.getTime();
      setHomes((all) =>
        all.map((each) => {
          const ran = due.flat().filter((one) => each.automations?.includes(one));
          return ran.length > 0 ? runAutomations(each, ran, at) : each;
        }),
      );
      if (served) for (const automation of due.flat()) notifyRan(automation, at);
    };
    tick();
    const timer = setInterval(tick, AUTOMATION_TICK_MS);
    return () => clearInterval(timer);
  }, [loading, hasTimed, served]);

  const onDragEnter = (event: DragEvent) => event.preventDefault();
  const drag = (kind: Dragged["kind"], id: string) => ({
    draggable: true,
    onDragStart: (event: DragEvent) => {
      dragged.current = { kind, id };
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    },
    onDragEnd: () => {
      dragged.current = null;
    },
    onDragEnter,
    onDragOver: (event: DragEvent) => {
      const held = dragged.current;
      if (held?.kind === kind || (held?.kind === "accessory" && kind === "room")) {
        event.preventDefault();
      }
    },
    onDrop: (event: DragEvent) => {
      const held = dragged.current;
      if (!held) return;
      event.preventDefault();
      if (held.kind === "accessory" && kind === "room") {
        if (chosenIds.has(held.id)) moveChosen(id);
        else changeAccessory(held.id, { room: id });
      } else if (held.kind === "accessory" && kind === "accessory") {
        change((current) => ({
          ...current,
          accessories: moved(current.accessories, held.id, id),
        }));
      } else if (held.kind === "scene" && kind === "scene") {
        change((current) => ({ ...current, scenes: moved(current.scenes, held.id, id) }));
      } else if (held.kind === "room" && kind === "room") {
        change((current) => ({ ...current, rooms: movedRoom(current.rooms, held.id, id) }));
      }
    },
  });

  const onViewKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && chosen.length > 0) {
      clearChosen();
      return;
    }
    const tile = (event.target as Element).closest<HTMLElement>(TILES);
    if (!tile) return;
    if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      tileFrom(tile, event.key, event.currentTarget)?.focus();
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      const accessory = accessories.find((each) => each.id === tile.dataset.homeAccessory);
      const scene = home.scenes.find((each) => each.id === tile.dataset.homeScene);
      if (accessory && chosen.length > 1 && chosenIds.has(accessory.id)) askRemoveChosen();
      else if (accessory) askRemoveAccessory(accessory);
      else if (scene) askRemoveScene(scene);
    }
  };

  // Command-click adds or takes away a tile and Shift-click reaches from the last one chosen; a
  // plain click on a tile switches it, as ever, and ends the selection.
  const onViewClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const tile = (event.target as Element).closest<HTMLElement>(ACCESSORY_TILES);
    const id = tile?.dataset.homeAccessory;
    if (id && (event.metaKey || event.ctrlKey || event.shiftKey)) {
      event.preventDefault();
      event.stopPropagation();
      const next = new Set(chosenIds);
      if (event.shiftKey && lastChosen.current) {
        const order = [...event.currentTarget.querySelectorAll<HTMLElement>(ACCESSORY_TILES)].map(
          (each) => each.dataset.homeAccessory ?? "",
        );
        for (const each of rangeOf(order, lastChosen.current, id)) next.add(each);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      lastChosen.current = id;
      setChosenIds(next);
    } else if (chosen.length > 0) {
      clearChosen();
    }
  };

  const tiles = (shown: readonly HomeAccessory[]) =>
    shown.map((accessory) => (
      <AccessoryTile
        key={accessory.id}
        accessory={accessory}
        selected={chosenIds.has(accessory.id)}
        onSwitch={switchAccessory}
        drag={drag}
      />
    ));

  const contextAccessory =
    contextTarget?.kind === "accessory"
      ? accessories.find((each) => each.id === contextTarget.id)
      : undefined;
  const contextScene =
    contextTarget?.kind === "scene"
      ? home.scenes.find((each) => each.id === contextTarget.id)
      : undefined;
  const note = served ? SIMULATED : undefined;
  const empty = served && accessories.length === 0 && home.scenes.length === 0;
  const addRows = (
    <>
      <MenuItem disabled={!canAddAccessory} onClick={() => open({ kind: "accessory" })}>
        Add Accessory…
      </MenuItem>
      <MenuItem
        disabled={!canAddScene}
        title={canAddScene ? undefined : NO_LIGHT_FOR_SCENE}
        onClick={() => open({ kind: "scene" })}
      >
        Add Scene…
      </MenuItem>
      <MenuItem disabled={!canAddRoom} onClick={() => open({ kind: "new-room" })}>
        Add Room…
      </MenuItem>
      <MenuItem disabled={!canAddAutomation} onClick={() => open({ kind: "automation" })}>
        Add Automation…
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={!canAddHome} onClick={() => open({ kind: "new-home" })}>
        Add Home…
      </MenuItem>
    </>
  );

  return (
    <Window
      aria-label="Home"
      {...windowProps}
      // A window is main, not key, while its sheet is open.
      state={sheetOpen && state === "key" ? "main" : state}
      width={width}
      height={height}
      aria-busy={loading || undefined}
      className={className ? `mac-home ${className}` : "mac-home"}
    >
      <CatalystChrome
        underToolbar
        inert={sheetOpen || loading}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        toolbar={
          <Toolbar aria-label="Home toolbar">
            <ToolbarPullDown aria-label="Homes" image={<HomeGlyph />} style={PULL_DOWN}>
              <MenuRadioGroup
                value={home.id}
                onValueChange={(value) => {
                  setHomeId(value);
                  setRoomName(undefined);
                }}
              >
                {homes.map((candidate) => (
                  <MenuRadioItem key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
              <MenuSeparator />
              <MenuItem onClick={() => open({ kind: "home-settings" })}>Home Settings…</MenuItem>
              <MenuItem
                disabled={room === ""}
                onClick={() => open({ kind: "room-settings", room })}
              >
                Room Settings…
              </MenuItem>
              {served ? (
                <>
                  <MenuSeparator />
                  <MenuItem disabled>Accessories Are Simulated</MenuItem>
                </>
              ) : null}
            </ToolbarPullDown>
            <ToolbarSpace />
            <ToolbarSegmentedControl
              aria-label="View"
              value={[tab]}
              onValueChange={(next) => {
                const chosen = TABS.find((candidate) => candidate.value === next[0]);
                if (chosen) setTab(chosen.value);
              }}
            >
              {TABS.map(({ value, label, style }) => (
                <ToolbarSegment key={value} value={value} style={style}>
                  {label}
                </ToolbarSegment>
              ))}
            </ToolbarSegmentedControl>
            <ToolbarSpace />
            <ToolbarSpace width={CENTRING_SPACE} />
            <Menu>
              <MenuTrigger
                render={
                  <ToolbarButton aria-label="Add" style={ADD_BUTTON}>
                    <PlusGlyph />
                  </ToolbarButton>
                }
              />
              <MenuPopup align="end" sideOffset={4}>
                {addRows}
              </MenuPopup>
            </Menu>
          </Toolbar>
        }
        sidebar={
          tab === "rooms" ? (
            <CatalystSidebar aria-label="Rooms" width={170}>
              <CatalystSidebarGroup title={home.name}>
                {home.rooms.map((name) => (
                  <ContextualMenu key={name}>
                    <ContextualMenuTrigger className="mac-home-room-row">
                      <CatalystSidebarItem
                        {...drag("room", name)}
                        selected={name === room}
                        onClick={() => setRoomName(name)}
                      >
                        {name}
                      </CatalystSidebarItem>
                    </ContextualMenuTrigger>
                    <ContextualMenuPopup aria-label={`${name} commands`}>
                      <MenuItem onClick={() => open({ kind: "room-settings", room: name })}>
                        Room Settings…
                      </MenuItem>
                      <MenuItem
                        disabled={home.rooms.length < 2}
                        title={
                          home.rooms.length < 2 ? "A home keeps at least one room." : undefined
                        }
                        onClick={() => askRemoveRoom(name)}
                      >
                        Remove Room…
                      </MenuItem>
                    </ContextualMenuPopup>
                  </ContextualMenu>
                ))}
              </CatalystSidebarGroup>
            </CatalystSidebar>
          ) : undefined
        }
      >
        <ContextualMenu>
          <ContextualMenuTrigger
            ref={view}
            className="mac-home-view"
            data-wallpaper={home.wallpaper}
            onKeyDown={onViewKeyDown}
            onClickCapture={onViewClickCapture}
            onContextMenu={(event) => {
              const tile = (event.target as Element).closest<HTMLElement>(TILES);
              const accessory = tile?.dataset.homeAccessory;
              const scene = tile?.dataset.homeScene;
              if (!accessory || !chosenIds.has(accessory)) clearChosen();
              setContextTarget(
                accessory
                  ? { kind: "accessory", id: accessory }
                  : scene
                    ? { kind: "scene", id: scene }
                    : null,
              );
            }}
          >
            {tab === "home" ? (
              <>
                <Summary
                  key={home.id}
                  title={home.name}
                  lines={statusLines(accessories)}
                  note={note}
                />
                {empty ? (
                  <div className="mac-home-empty-offer" data-appearance="dark">
                    <EmptyState className="mac-home-empty-title">No Accessories</EmptyState>
                    <p>
                      Add a simulated accessory to give this home something to show, then make
                      scenes and automations from it.
                    </p>
                    <PushButton onClick={() => open({ kind: "accessory" })}>
                      Add Accessory…
                    </PushButton>
                  </div>
                ) : (
                  <>
                    <Section title="Favorite Scenes">
                      {home.scenes.map((scene) => {
                        const active = sceneIsActive(scene, accessories);
                        return (
                          <HomekitTile
                            {...drag("scene", scene.id)}
                            data-home-scene={scene.id}
                            key={scene.id}
                            kind="scene"
                            name={scene.name}
                            icon={<SceneGlyph icon={scene.icon} active={active} />}
                            tint="var(--mac-home-tint-scene)"
                            active={active}
                            title={active ? SCENE_ON_REASON : undefined}
                            onClick={() => runScene(scene)}
                          />
                        );
                      })}
                    </Section>
                    <Section title="Favorite Accessories">
                      {tiles(accessories.filter((accessory) => accessory.favorite))}
                    </Section>
                  </>
                )}
              </>
            ) : tab === "rooms" ? (
              <>
                <Summary
                  key={`${home.id}/${room}`}
                  title={room}
                  lines={statusLines(accessories, room)}
                  note={note}
                />
                <Section title="Accessories">
                  {tiles(accessories.filter((accessory) => accessory.room === room))}
                </Section>
              </>
            ) : (
              <>
                <Summary title="Automation" lines={[]} note={note} />
                {/* The wallpaper is dark in both appearances: the placeholder takes light text. */}
                <div className="mac-home-empty" data-appearance="dark">
                  {automations.length === 0 ? (
                    <div className="mac-home-empty-offer">
                      <EmptyState className="mac-home-empty-title">No Automations</EmptyState>
                      <p>
                        An automation runs a scene at a time of day, or when an accessory is
                        switched. It runs while this window is open: there is no home hub to run it
                        otherwise.
                      </p>
                      <PushButton
                        disabled={!canAddAutomation}
                        title={canAddAutomation ? undefined : "Add a scene first."}
                        onClick={() => open({ kind: "automation" })}
                      >
                        Add Automation…
                      </PushButton>
                    </div>
                  ) : (
                    <div className="mac-home-automations">
                      {automations.map((automation) => (
                        <div key={automation.id} className="mac-home-automation">
                          <Checkbox
                            aria-label={`Enable ${automation.name}`}
                            checked={automation.enabled}
                            onCheckedChange={(enabled) =>
                              change((current) => ({
                                ...current,
                                automations: (current.automations ?? []).map((each) =>
                                  each.id === automation.id ? { ...each, enabled } : each,
                                ),
                              }))
                            }
                          />
                          <span className="mac-home-automation-text">
                            {automation.name}: {triggerText(automation.trigger, accessories)}, run{" "}
                            {home.scenes.find((scene) => scene.id === automation.scene)?.name}
                            {automation.lastRun
                              ? `. Last ran ${new Date(automation.lastRun).toLocaleTimeString("en-US", { timeStyle: "short" })}`
                              : ""}
                          </span>
                          <PushButton
                            onClick={() => open({ kind: "automation", id: automation.id })}
                          >
                            Edit…
                          </PushButton>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </ContextualMenuTrigger>
          <ContextualMenuPopup aria-label="Home commands">
            {contextAccessory && chosen.length > 1 ? (
              <>
                <MenuItem onClick={() => switchChosen(true)}>
                  {`Turn On ${chosen.length} Accessories`}
                </MenuItem>
                <MenuItem onClick={() => switchChosen(false)}>
                  {`Turn Off ${chosen.length} Accessories`}
                </MenuItem>
                <MenuSeparator />
                <Submenu>
                  <SubmenuTrigger>Move to Room</SubmenuTrigger>
                  <SubmenuPopup>
                    {home.rooms.map((name) => (
                      <MenuItem key={name} onClick={() => moveChosen(name)}>
                        {name}
                      </MenuItem>
                    ))}
                  </SubmenuPopup>
                </Submenu>
                <MenuSeparator />
                <MenuItem
                  onClick={askRemoveChosen}
                >{`Remove ${chosen.length} Accessories…`}</MenuItem>
              </>
            ) : contextAccessory ? (
              <>
                <MenuItem
                  disabled={!isSwitchable(contextAccessory)}
                  title={isSwitchable(contextAccessory) ? undefined : SENSOR_REASON}
                  onClick={() => switchAccessory(contextAccessory.id, !contextAccessory.on)}
                >
                  {contextAccessory.on ? "Turn Off" : "Turn On"}
                </MenuItem>
                <MenuItem
                  onClick={() =>
                    changeAccessory(contextAccessory.id, { favorite: !contextAccessory.favorite })
                  }
                >
                  {contextAccessory.favorite ? "Remove from Favorites" : "Include in Favorites"}
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  onClick={() => open({ kind: "accessory-settings", id: contextAccessory.id })}
                >
                  Accessory Settings…
                </MenuItem>
                <MenuItem onClick={() => askRemoveAccessory(contextAccessory)}>
                  Remove Accessory…
                </MenuItem>
              </>
            ) : contextScene ? (
              <>
                <MenuItem onClick={() => runScene(contextScene)}>Run Scene</MenuItem>
                <MenuSeparator />
                <MenuItem onClick={() => open({ kind: "scene-settings", id: contextScene.id })}>
                  Edit Scene…
                </MenuItem>
                <MenuItem onClick={() => askRemoveScene(contextScene)}>Remove Scene…</MenuItem>
              </>
            ) : (
              addRows
            )}
          </ContextualMenuPopup>
        </ContextualMenu>
      </CatalystChrome>
      <div ref={setSheetAnchor} className="mac-home-sheet-anchor" />
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetPopup anchor={sheetAnchor} width={dialog.kind === "scene-settings" ? 460 : 400}>
          {dialog.kind === "accessory" || dialog.kind === "scene" ? (
            <AddForm
              kind={dialog.kind}
              rooms={dialog.kind === "scene" ? litRooms : home.rooms}
              room={room}
              accessories={dialog.kind === "scene" ? accessories : undefined}
              served={served}
              onAdd={add}
            />
          ) : dialog.kind === "new-room" ? (
            <NameForm
              title="Add Room"
              description="A room to put accessories in."
              taken={home.rooms}
              onDone={(name) => {
                change((current) => ({ ...current, rooms: [...current.rooms, name] }));
                setRoomName(name);
              }}
            />
          ) : dialog.kind === "new-home" ? (
            <NameForm
              title="Add Home"
              description="A home with one room and nothing in it, kept beside your other homes."
              onDone={addHome}
            />
          ) : dialog.kind === "home-settings" ? (
            <HomeSettingsForm
              home={home}
              only={homes.length < 2}
              onDone={(name, wallpaper) => change((current) => ({ ...current, name, wallpaper }))}
              onRemove={() =>
                confirm(
                  `Remove “${home.name}”?`,
                  "Its rooms, simulated accessories, scenes and automations go with it.",
                  () => {
                    setHomes((all) => all.filter((each) => each.id !== home.id));
                    setRoomName(undefined);
                  },
                )
              }
            />
          ) : dialog.kind === "room-settings" ? (
            <RoomSettingsForm
              room={dialog.room}
              rooms={home.rooms}
              onDone={(name) => {
                change((current) => renameRoom(current, dialog.room, name));
                if (room === dialog.room) setRoomName(name);
              }}
              onRemove={() => askRemoveRoom(dialog.room)}
            />
          ) : dialog.kind === "accessory-settings" ? (
            (() => {
              const accessory = accessories.find((each) => each.id === dialog.id);
              return accessory ? (
                <AccessoryForm
                  accessory={accessory}
                  rooms={home.rooms}
                  onDone={(changes) => changeAccessory(accessory.id, changes)}
                  onRemove={() => askRemoveAccessory(accessory)}
                />
              ) : null;
            })()
          ) : dialog.kind === "scene-settings" ? (
            (() => {
              const scene = home.scenes.find((each) => each.id === dialog.id);
              return scene ? (
                <SceneForm
                  scene={scene}
                  accessories={accessories}
                  onDone={(changes) =>
                    change((current) => ({
                      ...current,
                      scenes: current.scenes.map((each) =>
                        each.id === scene.id ? { ...each, ...changes } : each,
                      ),
                    }))
                  }
                  onRemove={() => askRemoveScene(scene)}
                />
              ) : null;
            })()
          ) : dialog.kind === "automation" ? (
            <AutomationForm
              automation={automations.find((each) => each.id === dialog.id)}
              home={home}
              onDone={(changes) =>
                change((current) => {
                  const list = current.automations ?? [];
                  return {
                    ...current,
                    automations: dialog.id
                      ? list.map((each) => (each.id === dialog.id ? { ...each, ...changes } : each))
                      : [
                          ...list,
                          {
                            ...changes,
                            id: freshId(`${current.id}-automation`, list.length, taken()),
                          },
                        ],
                  };
                })
              }
              onRemove={() =>
                confirm("Remove this automation?", "Its scene stays.", () =>
                  change((current) => ({
                    ...current,
                    automations: (current.automations ?? []).filter(
                      (each) => each.id !== dialog.id,
                    ),
                  })),
                )
              }
            />
          ) : (
            <ConfirmForm title={dialog.title} text={dialog.text} onConfirm={dialog.run} />
          )}
          {message ? <p className="mac-home-reason">{message}</p> : null}
        </SheetPopup>
      </Sheet>
    </Window>
  );
}
