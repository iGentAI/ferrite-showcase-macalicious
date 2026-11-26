"use client";

import { onMenuKeyEquivalents } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { useEffect, useRef } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { EditRows } from "../desktop/desktop-edit-rows";
import type { HomeScene } from "./home-data";

/** The three views of the toolbar's segmented control. */
export type HomeTab = "home" | "rooms" | "automation";

export const NO_LIGHT_FOR_SCENE = "A scene sets accessories: add one that switches first.";
const NOTHING_TO_EDIT = "Click in a text field of a Home sheet first.";

const VIEWS: readonly { tab: HomeTab; title: string; key: string }[] = [
  { tab: "home", title: "Home", key: "command+1" },
  { tab: "rooms", title: "Rooms", key: "command+2" },
  { tab: "automation", title: "Automation", key: "command+3" },
];

export interface HomeMenusOptions {
  /** An element of the window: a use of the window makes these the application's menus. */
  within: Element | null;
  /** Whether the window is key and no sheet covers it: only then do the keys act. */
  keysLive: boolean;
  tab: HomeTab;
  setTab: (tab: HomeTab) => void;
  scenes: readonly HomeScene[];
  canAddAccessory: boolean;
  canAddScene: boolean;
  canAddRoom: boolean;
  canAddHome: boolean;
  newHome: () => void;
  newRoom: () => void;
  addAccessory: () => void;
  addScene: () => void;
  homeSettings: () => void;
  runScene: (scene: HomeScene) => void;
  say: (message: string) => void;
}

/** Home's rows in the desktop's menu bar and in its Dock menu, and the keys that go with them. */
export function useHomeMenus(options: HomeMenusOptions) {
  const { within, keysLive, tab } = options;
  const latest = useRef(options);
  latest.current = options;

  useDesktopAppMenu(
    "home",
    "File",
    <>
      <MenuItem disabled={!options.canAddHome} onClick={options.newHome}>
        New Home…
      </MenuItem>
      <MenuItem disabled={!options.canAddRoom} onClick={options.newRoom}>
        New Room…
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled={!options.canAddAccessory} onClick={options.addAccessory}>
        Add Accessory…
      </MenuItem>
      <MenuItem
        disabled={!options.canAddScene}
        title={options.canAddScene ? undefined : NO_LIGHT_FOR_SCENE}
        onClick={options.addScene}
      >
        Add Scene…
      </MenuItem>
      <MenuSeparator />
    </>,
    within,
  );
  useDesktopAppMenu(
    "home",
    "Edit",
    <>
      <EditRows nothing={NOTHING_TO_EDIT} say={options.say} />
      <MenuSeparator />
      <MenuItem onClick={options.homeSettings}>Home Settings…</MenuItem>
    </>,
    within,
  );
  useDesktopAppMenu(
    "home",
    "View",
    <>
      <MenuRadioGroup
        value={tab}
        onValueChange={(value) => {
          const chosen = VIEWS.find((view) => view.tab === value);
          if (chosen) options.setTab(chosen.tab);
        }}
      >
        {VIEWS.map((view) => (
          <MenuRadioItem key={view.tab} value={view.tab} keyEquivalent={view.key}>
            {view.title}
          </MenuRadioItem>
        ))}
      </MenuRadioGroup>
      <MenuSeparator />
    </>,
    within,
  );
  useDesktopAppMenu(
    "home",
    "Dock",
    options.scenes.length > 0
      ? options.scenes.map((scene) => (
          <MenuItem key={scene.id} onClick={() => options.runScene(scene)}>
            {scene.name}
          </MenuItem>
        ))
      : null,
    within,
  );

  useEffect(() => {
    if (!keysLive) return;
    return onMenuKeyEquivalents(
      window,
      Object.fromEntries(
        VIEWS.map((view) => [view.key, () => latest.current.setTab(view.tab)] as const),
      ),
    );
  }, [keysLive]);
}
