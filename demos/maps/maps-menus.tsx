"use client";

import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { EditRows } from "../desktop/desktop-edit-rows";
import { LinkShareItems } from "../desktop/desktop-share-link";

const NO_PLACE = "Choose a place on the map to share it.";
const NO_TRANSIT = "OpenStreetMap's map, which this desktop shows, has no transit view.";
const NO_SATELLITE = "OpenStreetMap's map, which this desktop shows, has no satellite imagery.";
const NO_TRAFFIC = "OpenStreetMap's map, which this desktop shows, has no live traffic.";
const NO_3D = "OpenStreetMap's map, which this desktop shows, is flat.";
const NO_LOOK_AROUND = "Look Around's street photographs are Apple's, and not on this desktop.";
const NO_LABELS = "OpenStreetMap's tiles have their labels drawn into them.";
const NO_TABS = "Maps keeps each map in a window of its own here: use New Window.";
const MAP_NOT_READY = "The map has not been drawn yet.";

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
export interface MapsMenusProps {
  /** An element of the window, which makes it the application's last used. */
  within: Element | null;
  /** Whether a place is chosen, which Share acts on. */
  hasPlace: boolean;
  /** The chosen place's link and name, which Share hands on. */
  shareUrl: string;
  shareTitle: string;
  onCopied: (copied: boolean) => void;
  /** Tells the person what a command could not do. */
  say: (message: string) => void;
  /** Whether the map is on screen, to be printed. */
  mapDrawn: boolean;
  print: () => void;
  exportPdf: () => void;
  directionsShown: boolean;
  toggleDirections: () => void;
  hasDroppedPin: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  scaleShown: boolean;
  setScaleShown: (shown: boolean) => void;
  find: () => void;
  dropPin: () => void;
  removePin: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  goToCurrentLocation: () => void;
}

function dimmed(title: string, reason: string, key?: string) {
  return (
    <MenuItem key={title} disabled title={reason} keyEquivalent={key}>
      {title}
    </MenuItem>
  );
}

/**
 * Maps' own items in the desktop's menu bar, while its window is the application's last used
 * (`desktop-app-menus.ts`), and the key equivalents they show. Answers the function the window's
 * key handler calls: whether a `keydown` was a command's key.
 *
 * Rows for what OpenStreetMap's map does not have stay, dimmed, saying why. Their keys are still
 * theirs, so ⌘2 does not reach the desktop.
 */
export function useMapsMenus(props: MapsMenusProps) {
  const { within, hasPlace } = props;
  const commands = {
    find: { title: "Find", key: "command+f", enabled: true, run: props.find },
    dropPin: { title: "Drop Pin", key: "shift+command+d", enabled: true, run: props.dropPin },
    removePin: { title: "Remove Pin", enabled: props.hasDroppedPin, run: props.removePin },
    map: { title: "Map", key: "command+1", enabled: true },
    transit: { title: "Transit", key: "command+2", enabled: false, reason: NO_TRANSIT },
    satellite: { title: "Satellite", key: "command+3", enabled: false, reason: NO_SATELLITE },
    scale: {
      title: props.scaleShown ? "Hide Scale" : "Show Scale",
      enabled: true,
      run: () => props.setScaleShown(!props.scaleShown),
    },
    zoomIn: {
      title: "Zoom In",
      key: "command++",
      // The plus key is Shift and the equals key, and a Mac takes it with or without Shift.
      keys: ["command+=", "shift+command+="],
      enabled: props.canZoomIn,
      run: props.zoomIn,
    },
    zoomOut: { title: "Zoom Out", key: "command+-", enabled: props.canZoomOut, run: props.zoomOut },
    threeD: { title: "Show 3D Map", key: "command+d", enabled: false, reason: NO_3D },
    location: {
      title: "Go to Current Location",
      key: "command+l",
      enabled: true,
      run: props.goToCurrentLocation,
    },
    directions: {
      title: props.directionsShown ? "Hide Directions" : "Directions",
      key: "command+r",
      enabled: true,
      run: props.toggleDirections,
    },
    print: {
      title: "Print…",
      key: "command+p",
      enabled: props.mapDrawn,
      reason: props.mapDrawn ? undefined : MAP_NOT_READY,
      run: props.print,
    },
    exportPdf: {
      title: "Export as PDF…",
      enabled: props.mapDrawn,
      reason: props.mapDrawn ? undefined : MAP_NOT_READY,
      run: props.exportPdf,
    },
  } satisfies Record<string, Command>;

  const row = (command: Command) => (
    <MenuItem
      key={command.title}
      keyEquivalent={command.key}
      disabled={!command.enabled}
      title={command.reason}
      onClick={command.run}
    >
      {command.title}
    </MenuItem>
  );
  const typeRow = (value: string, command: Command) => (
    <MenuRadioItem
      value={value}
      keyEquivalent={command.key}
      disabled={!command.enabled}
      title={command.reason}
    >
      {command.title}
    </MenuRadioItem>
  );

  useDesktopAppMenu(
    "maps",
    "Dock",
    <>
      <MenuItem disabled={!commands.location.enabled} onClick={commands.location.run}>
        {commands.location.title}
      </MenuItem>
      <MenuItem disabled={!commands.directions.enabled} onClick={commands.directions.run}>
        {commands.directions.title}
      </MenuItem>
    </>,
    within,
  );
  useDesktopAppMenu(
    "maps",
    "File",
    <>
      {dimmed("New Tab", NO_TABS, "command+t")}
      <MenuSeparator />
      <Submenu disabled={!hasPlace}>
        <SubmenuTrigger title={hasPlace ? undefined : NO_PLACE}>Share</SubmenuTrigger>
        <SubmenuPopup>
          <LinkShareItems
            plain
            url={props.shareUrl}
            title={props.shareTitle}
            from="maps"
            onCopied={props.onCopied}
          />
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      {row(commands.exportPdf)}
      {row(commands.print)}
    </>,
    within,
  );
  useDesktopAppMenu(
    "maps",
    "Edit",
    <>
      <EditRows
        nothing="Click in the search field, a guide's name or a route's field first."
        say={props.say}
      />
      <MenuSeparator />
      {row(commands.find)}
      <MenuSeparator />
      {row(commands.dropPin)}
      {row(commands.removePin)}
    </>,
    within,
  );
  useDesktopAppMenu(
    "maps",
    "View",
    <>
      <MenuRadioGroup value="map">
        {typeRow("map", commands.map)}
        {typeRow("transit", commands.transit)}
        {typeRow("satellite", commands.satellite)}
      </MenuRadioGroup>
      <MenuSeparator />
      {dimmed("Show Labels", NO_LABELS)}
      {dimmed("Show Traffic", NO_TRAFFIC)}
      {row(commands.scale)}
      <MenuSeparator />
      {row(commands.zoomIn)}
      {row(commands.zoomOut)}
      {row(commands.threeD)}
      {dimmed("Look Around", NO_LOOK_AROUND)}
      <MenuSeparator />
      {row(commands.location)}
      {row(commands.directions)}
      <MenuSeparator />
      {dimmed("Show Tab Bar", NO_TABS)}
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
