"use client";

import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import type { FindMyList } from "./find-my-data";
import type { ServedDevice } from "./find-my-server";

const NO_UNDO = "Find My keeps no changes to undo.";
const NO_TEXT = "Find My has no text to edit.";
const COPY_BY_KEY = "Select the coordinates on a device's card, then press Command-C.";
export const NO_IMAGERY =
  "OpenStreetMap's map, which this desktop shows, has no satellite imagery.";
const NOT_HERE = "Directions go to a device; this is where you already are.";
const ONE_DEVICE = "Choose one device for directions.";
const SELECT_ALL_DEVICES = "Only the Devices list has rows to select together.";
export const NO_REMOVE_THIS =
  "This browser reports where it is while Find My is open, so it cannot remove itself.";
const NO_REMOVE_CHOSEN = "Choose a device under Devices to remove it.";
const NO_SHARING = "Sign in to an account to share your location.";
const NO_REMOTE = "A web page cannot lock, erase or watch a browser from another one.";

/** The devices of a selection that Remove can take: never the browser showing the window. */
export function removableDevices(chosen: readonly ServedDevice[]): ServedDevice[] {
  return chosen.filter((device) => !device.this);
}

/** Why Delete is dimmed for a selection, or `undefined` when it is not. */
export function removeReason(chosen: readonly ServedDevice[]): string | undefined {
  if (chosen.length === 0) return NO_REMOVE_CHOSEN;
  return removableDevices(chosen).length === 0 ? NO_REMOVE_THIS : undefined;
}

/** What the alert before a removal asks. */
export function removeQuestion(targets: readonly ServedDevice[]): string {
  const [only] = targets;
  return targets.length === 1 && only
    ? `Remove \u201c${only.label}\u201d from Find My?`
    : `Remove ${targets.length} devices from Find My?`;
}

/** One command of a menu, which its key equivalent also runs. */
interface Command {
  title: string;
  key?: string;
  /** The keys that run it, where they are not just the one its row shows. */
  keys?: readonly string[];
  enabled: boolean;
  /** Why it is dimmed. */
  reason?: string;
  run?: () => void;
}

/** What the window hands its menus. */
export interface FindMyMenusProps {
  /** An element of the window, which makes it the application's last used. */
  within: Element | null;
  list: FindMyList;
  showList: (list: FindMyList) => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  goToCurrentLocation: () => void;
  /** The devices chosen in the list shown; none while People shows. */
  chosen: readonly ServedDevice[];
  /** Asks before removing these devices. */
  remove: (targets: readonly ServedDevice[]) => void;
  /** Selects every row of the Devices list; `null` while there are none to select. */
  selectAll: (() => void) | null;
  /** Opens the sheet that starts sharing; `null` while nobody is signed in. */
  shareMyLocation: (() => void) | null;
}

function dimmed(title: string, reason: string, key?: string) {
  return (
    <MenuItem key={title} disabled title={reason} keyEquivalent={key}>
      {title}
    </MenuItem>
  );
}

/**
 * The contextual menu of a device, or of several: from a row of the Devices list or a marker on
 * the map. Play Sound asks each of them.
 */
export function DeviceMenuItems({
  targets,
  playSound,
  directions,
  remove,
}: {
  targets: readonly ServedDevice[];
  playSound: (device: ServedDevice) => void;
  /** Asks Maps for directions to this device. */
  directions: (device: ServedDevice) => void;
  remove: (targets: readonly ServedDevice[]) => void;
}) {
  const removable = removableDevices(targets);
  const [only] = targets;
  const directionsReason = targets.length !== 1 ? ONE_DEVICE : only?.this ? NOT_HERE : undefined;
  return (
    <>
      <MenuItem
        onClick={() => {
          for (const device of targets) playSound(device);
        }}
      >
        Play Sound
      </MenuItem>
      <MenuItem
        disabled={directionsReason !== undefined}
        title={directionsReason}
        onClick={() => {
          if (only) directions(only);
        }}
      >
        Directions
      </MenuItem>
      {dimmed("Notify When Found", NO_REMOTE)}
      {dimmed("Mark As Lost", NO_REMOTE)}
      {dimmed("Erase This Device", NO_REMOTE)}
      <MenuSeparator />
      <MenuItem
        disabled={removable.length === 0}
        title={removeReason(targets)}
        onClick={() => remove(removable)}
      >
        {removable.length > 1 ? `Remove ${removable.length} Devices` : "Remove This Device"}
      </MenuItem>
    </>
  );
}

/** The contextual menu of the person's own row in the People list. */
export function PersonMenuItems({ goToCurrentLocation }: { goToCurrentLocation: () => void }) {
  return (
    <>
      <MenuItem onClick={goToCurrentLocation}>Go to Current Location</MenuItem>
      {dimmed("Directions", NOT_HERE)}
    </>
  );
}

/**
 * Find My's own items in the desktop's menu bar, while its window is the application's last used
 * (`desktop-app-menus.ts`), and the key equivalents they show. Answers the function the window's
 * key handler calls: whether a `keydown` was a command's key.
 *
 * Rows for what this desktop's map or window cannot do stay, dimmed, saying why.
 */
export function useFindMyMenus(props: FindMyMenusProps) {
  const { within, list, showList, chosen } = props;
  const targets = removableDevices(chosen);
  const commands = {
    delete: {
      title: "Delete",
      key: "delete",
      enabled: targets.length > 0,
      reason: removeReason(chosen),
      run: () => props.remove(targets),
    },
    selectAll: {
      title: "Select All",
      key: "command+a",
      enabled: props.selectAll !== null,
      reason: SELECT_ALL_DEVICES,
      run: () => props.selectAll?.(),
    },
    people: { title: "People", key: "command+1", enabled: true, run: () => showList("people") },
    devices: { title: "Devices", key: "command+2", enabled: true, run: () => showList("devices") },
    zoomIn: {
      title: "Zoom In",
      key: "command++",
      // The plus key is Shift and the equals key, and a Mac takes it with or without Shift.
      keys: ["command+=", "shift+command+="],
      enabled: props.canZoomIn,
      run: props.zoomIn,
    },
    zoomOut: { title: "Zoom Out", key: "command+-", enabled: props.canZoomOut, run: props.zoomOut },
    location: {
      title: "Go to Current Location",
      key: "command+l",
      enabled: true,
      run: props.goToCurrentLocation,
    },
  } satisfies Record<string, Command>;

  const row = (command: Command) => (
    <MenuItem
      key={command.title}
      keyEquivalent={command.key}
      disabled={!command.enabled}
      title={command.enabled ? undefined : command.reason}
      onClick={command.run}
    >
      {command.title}
    </MenuItem>
  );

  useDesktopAppMenu(
    "find-my",
    "Dock",
    <>
      <MenuItem onClick={commands.people.run}>{commands.people.title}</MenuItem>
      <MenuItem onClick={commands.devices.run}>{commands.devices.title}</MenuItem>
    </>,
    within,
  );
  useDesktopAppMenu(
    "find-my",
    "File",
    <MenuItem
      disabled={props.shareMyLocation === null}
      title={props.shareMyLocation === null ? NO_SHARING : undefined}
      onClick={() => props.shareMyLocation?.()}
    >
      Share My Location
    </MenuItem>,
    within,
  );
  useDesktopAppMenu(
    "find-my",
    "Edit",
    <>
      {dimmed("Undo", NO_UNDO, "command+z")}
      {dimmed("Redo", NO_UNDO, "shift+command+z")}
      <MenuSeparator />
      {dimmed("Cut", NO_TEXT, "command+x")}
      {dimmed("Copy", COPY_BY_KEY, "command+c")}
      {dimmed("Paste", NO_TEXT, "command+v")}
      {row(commands.delete)}
      {row(commands.selectAll)}
    </>,
    within,
  );
  useDesktopAppMenu(
    "find-my",
    "View",
    <>
      <MenuRadioGroup value={list} onValueChange={(value) => showList(value as FindMyList)}>
        <MenuRadioItem value="people" keyEquivalent={commands.people.key}>
          {commands.people.title}
        </MenuRadioItem>
        <MenuRadioItem value="devices" keyEquivalent={commands.devices.key}>
          {commands.devices.title}
        </MenuRadioItem>
      </MenuRadioGroup>
      <MenuSeparator />
      <MenuRadioGroup value="map">
        <MenuRadioItem value="map">Map</MenuRadioItem>
        <MenuRadioItem value="hybrid" disabled title={NO_IMAGERY}>
          Hybrid
        </MenuRadioItem>
        <MenuRadioItem value="satellite" disabled title={NO_IMAGERY}>
          Satellite
        </MenuRadioItem>
      </MenuRadioGroup>
      <MenuSeparator />
      {row(commands.zoomIn)}
      {row(commands.zoomOut)}
      <MenuSeparator />
      {row(commands.location)}
    </>,
    within,
  );

  return (event: KeyboardEvent): boolean => {
    const command = (Object.values(commands) as Command[]).find((each) =>
      (each.keys ?? [each.key]).some((key) => key && matchesMenuKeyEquivalent(event, key)),
    );
    if (!command) return false;
    if (command.enabled) command.run?.();
    return true;
  };
}
