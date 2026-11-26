"use client";

import { onMenuKeyEquivalents } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { useEffect, useRef } from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { EditRows } from "../desktop/desktop-edit-rows";
import { linkAddress } from "../desktop/desktop-open-url";
import { LinkShareItems, NO_ADDRESS_REASON } from "../desktop/desktop-share-link";
import type { LiveChannel } from "./news-live";

const NO_STORY = "Open a story first.";
const NO_CHANNEL = "Open a story or a channel first.";
const NO_FEEDS = "This view reads no feeds.";
const BLOCKED = "Unblock this channel to follow it.";
const NO_SUGGESTIONS =
  "News here lists each channel's stories newest first: nothing learns from a suggestion.";
const NO_PRINT = "Safari prints a story: open it there with Read Full Story.";

/** The sizes a story's text can take. */
export const NEWS_TEXT_SCALES = [0.85, 1, 1.15, 1.3, 1.5] as const;

/** One command of a menu, which its key equivalent also runs. */
interface Command {
  title: string;
  key?: string;
  enabled: boolean;
  /** Why it is dimmed. */
  reason?: string;
  run: () => void;
}

/** What the window hands its menus. */
export interface NewsMenusProps {
  /** An element of the window, which makes it the application's last used. */
  within: Element | null;
  /** Whether the window is the key window, which alone takes the keys. */
  isKey: boolean;
  /** Whether the window takes commands yet. */
  ready: boolean;
  /** Whether the channel list could not be read, which is why it is not ready. */
  unavailable: boolean;
  /** The story open, when one is. */
  story?: { title: string; link?: string };
  saved: boolean;
  /** The channel the channel commands act on: the open story's, else the channel page's. */
  channel?: LiveChannel;
  followed: boolean;
  blocked: boolean;
  sidebarShown: boolean;
  canReload: boolean;
  /** Whether Saved Stories or History is showing stories, all of which can be chosen. */
  canPickAll: boolean;
  pickAll: () => void;
  /** Tells the person what a command could not do. */
  say: (message: string) => void;
  toggleSidebar: () => void;
  back: () => void;
  today: () => void;
  reload: () => void;
  toggleSaved: () => void;
  openInSafari: (address: string) => void;
  toggleFollowed: (channel: string) => void;
  toggleBlocked: (channel: string) => void;
  focusSearch: () => void;
  /** Shows the open story's find bar, with the keyboard in it. */
  findInStory: () => void;
  /** The size of a story's text, as a share of its actual size. */
  textScale: number;
  setTextScale: (scale: number) => void;
}

/**
 * News's own items in the desktop's menu bar, while its window is the application's last used
 * (`desktop-app-menus.ts`), and their key equivalents while it is the key window. The keys are
 * heard on the page, as a Mac's key window has them wherever the keyboard focus is: a story's
 * reader or a Dock click can leave the focus outside the window, and Command-R there would reload
 * the desktop. A key stays the command's while its item is dimmed.
 */
export function useNewsMenus(props: NewsMenusProps) {
  const { within, isKey, ready, story, saved, channel, followed, blocked } = props;
  const address = story?.link ? linkAddress(story.link) : null;
  const larger = NEWS_TEXT_SCALES.find((scale) => scale > props.textScale);
  const smaller = NEWS_TEXT_SCALES.findLast((scale) => scale < props.textScale);
  const notReady = props.unavailable
    ? "News could not read its list of channels."
    : "News is still loading.";
  const commands = {
    follow: {
      title: followed ? "Unfollow Channel" : "Follow Channel",
      enabled: ready && channel !== undefined && !blocked,
      reason: channel ? BLOCKED : NO_CHANNEL,
      run: () => {
        if (channel) props.toggleFollowed(channel.id);
      },
    },
    search: {
      title: "Search",
      key: "command+f",
      enabled: ready,
      run: props.focusSearch,
    },
    find: {
      title: "Find in Story",
      key: "option+command+f",
      enabled: ready && story !== undefined,
      reason: NO_STORY,
      run: props.findInStory,
    },
    sidebar: {
      title: props.sidebarShown ? "Hide Sidebar" : "Show Sidebar",
      key: "option+command+s",
      enabled: ready,
      run: props.toggleSidebar,
    },
    back: {
      title: "Go Back",
      key: "command+[",
      enabled: ready && story !== undefined,
      reason: NO_STORY,
      run: props.back,
    },
    today: {
      title: "Go to Today",
      enabled: ready,
      run: props.today,
    },
    reload: {
      title: "Reload",
      key: "command+r",
      enabled: ready && props.canReload,
      reason: NO_FEEDS,
      run: props.reload,
    },
    save: {
      title: saved ? "Remove from Saved Stories" : "Save Story",
      key: "command+s",
      enabled: ready && story !== undefined,
      reason: NO_STORY,
      run: props.toggleSaved,
    },
    block: {
      title: blocked ? "Unblock Channel" : "Block Channel",
      enabled: ready && channel !== undefined,
      reason: NO_CHANNEL,
      run: () => {
        if (channel) props.toggleBlocked(channel.id);
      },
    },
    safari: {
      title: "Open in Safari",
      enabled: ready && address !== null,
      reason: story ? NO_ADDRESS_REASON : NO_STORY,
      run: () => {
        if (address) props.openInSafari(address);
      },
    },
    actualSize: {
      title: "Actual Size",
      key: "command+0",
      enabled: ready && story !== undefined && props.textScale !== 1,
      reason: story ? "The story is at its actual size." : NO_STORY,
      run: () => props.setTextScale(1),
    },
    bigger: {
      title: "Make Text Bigger",
      key: "command+=",
      enabled: ready && story !== undefined && larger !== undefined,
      reason: story ? "The text is at its largest." : NO_STORY,
      run: () => {
        if (larger !== undefined) props.setTextScale(larger);
      },
    },
    smaller: {
      title: "Make Text Smaller",
      key: "command+-",
      enabled: ready && story !== undefined && smaller !== undefined,
      reason: story ? "The text is at its smallest." : NO_STORY,
      run: () => {
        if (smaller !== undefined) props.setTextScale(smaller);
      },
    },
  } satisfies Record<string, Command>;

  const row = (command: Command) => (
    <MenuItem
      key={command.title}
      keyEquivalent={command.key}
      disabled={!command.enabled}
      title={command.enabled ? undefined : ready ? command.reason : notReady}
      onClick={command.run}
    >
      {command.title}
    </MenuItem>
  );

  useDesktopAppMenu(
    "news",
    "Dock",
    <>
      <MenuItem disabled={!commands.today.enabled} onClick={commands.today.run}>
        {commands.today.title}
      </MenuItem>
      <MenuItem disabled={!commands.reload.enabled} onClick={commands.reload.run}>
        {commands.reload.title}
      </MenuItem>
    </>,
    within,
  );
  useDesktopAppMenu(
    "news",
    "File",
    <>
      {row(commands.follow)}
      <Submenu>
        <SubmenuTrigger
          disabled={!ready || !story}
          title={!ready ? notReady : !story ? NO_STORY : undefined}
        >
          Share Story
        </SubmenuTrigger>
        <SubmenuPopup>
          <LinkShareItems plain url={story?.link ?? ""} title={story?.title ?? ""} from="news" />
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuItem disabled keyEquivalent="command+p" title={NO_PRINT}>
        Print…
      </MenuItem>
    </>,
    within,
  );
  useDesktopAppMenu(
    "news",
    "Edit",
    <>
      <EditRows
        nothing="Click in a text field, or select text in a story, first."
        selectAll={{
          enabled: props.canPickAll,
          title: "Saved Stories and History list stories to choose.",
          run: props.pickAll,
        }}
        say={props.say}
      />
      <MenuSeparator />
      {/* The menu holds the keyboard until it has faded out (`menu.css`: 0.25 s after a choice). */}
      {row({ ...commands.search, run: () => setTimeout(commands.search.run, 300) })}
      {row({ ...commands.find, run: () => setTimeout(commands.find.run, 300) })}
    </>,
    within,
  );
  useDesktopAppMenu(
    "news",
    "View",
    <>
      {row(commands.sidebar)}
      <MenuSeparator />
      {row(commands.back)}
      {row(commands.today)}
      {row(commands.reload)}
      <MenuSeparator />
      {row(commands.actualSize)}
      {row(commands.bigger)}
      {row(commands.smaller)}
    </>,
    within,
  );
  useDesktopAppMenu(
    "news",
    "Story",
    <>
      {row(commands.save)}
      {row(commands.safari)}
      <MenuSeparator />
      <MenuItem disabled title={NO_SUGGESTIONS}>
        Suggest More Like This
      </MenuItem>
      <MenuItem disabled title={NO_SUGGESTIONS}>
        Suggest Less Like This
      </MenuItem>
      <MenuSeparator />
      {row(commands.block)}
      <MenuItem disabled title="News here reads public feeds: there is no one to send a report to.">
        Report a Concern…
      </MenuItem>
    </>,
    within,
  );

  const latest = useRef<Record<string, Command>>(commands);
  latest.current = commands;
  useEffect(() => {
    if (!isKey) return;
    const bindings: Record<string, () => void> = {};
    for (const [name, { key }] of Object.entries(latest.current)) {
      if (!key) continue;
      bindings[key] = () => {
        const command = latest.current[name];
        if (command?.enabled) command.run();
      };
    }
    return onMenuKeyEquivalents(window, bindings);
  }, [isKey]);
}
