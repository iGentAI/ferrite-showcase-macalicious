"use client";

import { Menu as BaseMenu } from "@base-ui/react/menu";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { MenuItem, MenuSection, MenuSeparator } from "macalicious/menu-item";
import { SearchField } from "macalicious/search-field";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { requestHelp } from "../desktop/desktop-help";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { type HelpTopic, RESULTS_SHOWN, searchHelp } from "./help-viewer-data";
import { searchGuides } from "./help-viewer-guides";
import {
  getJson,
  HELP_SEARCH_URL,
  resultsFromServer,
  SEARCH_DELAY_MS,
  serverSearches,
} from "./help-viewer-server";
import "./help-menu-search.css";

/*
 * The Help menu's search field: what the front application's menus hold and the help topics that
 * match, as the person types. A result for a menu row opens that row's menu with an arrow beside
 * the row, and a topic opens in Help Viewer.
 */

/** A row of the front application's menus; `via` names the submenu that holds it. */
export interface HelpMenuRow {
  menu: string;
  title: string;
  via?: string;
}

/** How many menu rows the Help menu lists. */
const MENU_ROWS_SHOWN = 8;
/** How long a menu has to close or open before it is given up on, in frames. */
const WAIT_FRAMES = 120;

const registered = new Map<string, { app: string; menu: string; items: ReactNode }>();

const TITLE = ".mac-menu-item-title";

/**
 * The rows of a menu, read from the popup that draws them: many are drawn by a component of the application's, so its
 * elements do not list them. A dimmed row is listed as well: the arrow shows where it is. The Help menu's own rows leave
 * out its results, which are in groups.
 */
function rowsIn(popup: Element | null | undefined, menu: string): HelpMenuRow[] {
  const rows = popup?.querySelectorAll('[role^="menuitem"]') ?? [];
  return [...rows].flatMap((row) => {
    const title = row.querySelector(TITLE)?.textContent?.trim();
    return title && !(menu === "Help" && row.closest('[role="group"]')) ? [{ menu, title }] : [];
  });
}

type WithChildren = ReactElement<{ children?: ReactNode }>;

/**
 * The rows of the submenus that shared components draw (`SpeechItems`, `SpellingItems`, `SubstitutionItems` and their
 * like): their elements are not in the menu's, and a submenu draws its rows only while it is open.
 */
const DRAWN_SUBMENUS: Readonly<Record<string, readonly string[]>> = {
  Speech: ["Start Speaking", "Stop Speaking"],
  "Spelling and Grammar": [
    "Show Spelling and Grammar",
    "Check Document Now",
    "Check Spelling While Typing",
    "Check Grammar With Spelling",
    "Correct Spelling Automatically",
  ],
  Substitutions: [
    "Show Substitutions",
    "Smart Copy/Paste",
    "Smart Quotes",
    "Smart Dashes",
    "Smart Links",
    "Data Detectors",
    "Text Replacement",
  ],
};

/** The rows of the submenus in `DRAWN_SUBMENUS` that this drawn popup holds a trigger for. */
function drawnSubmenuRows(popup: Element | null | undefined, menu: string): HelpMenuRow[] {
  const triggers = popup?.querySelectorAll('[role="menuitem"][aria-haspopup]') ?? [];
  return [...triggers].flatMap((trigger) => {
    const via = trigger.querySelector(TITLE)?.textContent?.trim();
    return via ? (DRAWN_SUBMENUS[via] ?? []).map((title) => ({ menu, title, via })) : [];
  });
}

/**
 * The rows inside the submenus a menu's elements name. A submenu is drawn only when it is open, so its rows are read
 * from the elements; those of a shared component's submenu are in `DRAWN_SUBMENUS`.
 */
function submenuRows(items: ReactNode, menu: string, via?: string): HelpMenuRow[] {
  return Children.toArray(items).flatMap((item): HelpMenuRow[] => {
    if (!isValidElement(item)) return [];
    const { type, props } = item as WithChildren;
    if (type === Submenu) {
      const parts = Children.toArray(props.children) as WithChildren[];
      const title = parts.find((part) => part.type === SubmenuTrigger)?.props.children;
      const popup = parts.find((part) => part.type === SubmenuPopup);
      return typeof title === "string" ? submenuRows(popup?.props.children, menu, title) : [];
    }
    if (type === MenuItem && via && typeof props.children === "string")
      return [{ menu, title: props.children, via }];
    return submenuRows(props.children, menu, via);
  });
}

/**
 * Opens a menu of the bar as a press of its title does. Base UI opens a menu on the press's `mousedown`, and takes a
 * `click` alone as the end of an earlier press, so the whole sequence is sent.
 */
function pressTitle(title: string) {
  const element = [
    ...document.querySelectorAll<HTMLElement>(".mac-menu-bar-menus .mac-menu-bar-title"),
  ].find((each) => each.textContent === title);
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"])
    element?.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }));
}

/**
 * For one menu of the bar: tells the Help menu what the menu draws, and, for the Help menu itself, opens it on
 * Shift-Command-?.
 */
export function useHelpMenuRows(app: string, menu: string, enabled: boolean, items: ReactNode) {
  const key = `${app}\u0000${menu}`;
  useEffect(() => {
    if (enabled) registered.set(key, { app, menu, items });
  });
  useEffect(() => () => void registered.delete(key), [key]);
  useEffect(() => {
    if (!enabled || menu !== "Help") return;
    // After this effect pass: the desktop hears requests from an effect of its own, which runs last.
    const timer = setTimeout(followHelpLink);
    window.addEventListener("hashchange", followHelpLink);
    const onKey = (event: KeyboardEvent) => {
      if (!matchesMenuKeyEquivalent(event, "shift+command+/")) return;
      event.preventDefault();
      event.stopPropagation();
      pressTitle(menu);
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", followHelpLink);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [enabled, menu]);
}

function whenFound<T>(find: () => T | null | undefined, then: (found: T) => void) {
  let frames = 0;
  const look = () => {
    const found = find();
    if (found) then(found);
    else if (frames++ < WAIT_FRAMES) requestAnimationFrame(look);
  };
  look();
}

function showArrow(row: HTMLElement) {
  const arrow = document.createElement("div");
  arrow.className = "mac-help-viewer-menu-arrow";
  arrow.setAttribute("aria-hidden", "true");
  const { right, top, height } = row.getBoundingClientRect();
  arrow.style.left = `${right}px`;
  arrow.style.top = `${top + height / 2}px`;
  document.body.append(arrow);
  const watch = () => {
    if (row.isConnected) requestAnimationFrame(watch);
    else arrow.remove();
  };
  watch();
}

/** Opens the row's menu, once the Help menu has gone, with the arrow beside the row and the row highlighted. */
function pointAt({ menu, title, via }: HelpMenuRow) {
  const rowTitled = (wanted: string) => () =>
    [...document.querySelectorAll<HTMLElement>('[role="menu"] [role^="menuitem"]')].find(
      (element) => element.querySelector(TITLE)?.textContent?.trim() === wanted,
    );
  const point = () =>
    whenFound(rowTitled(title), (row) => {
      showArrow(row);
      row.focus();
    });
  whenFound(
    () => !document.querySelector('[role="menu"]'),
    () => {
      pressTitle(menu);
      if (!via) point();
      else
        whenFound(rowTitled(via), (trigger) => {
          trigger.click();
          point();
        });
    },
  );
}

let requestedTopic: string | null = null;
let requestedWords = false;

/** The topic the Help menu chose, for the Help Viewer window that takes its request. */
export function takeRequestedTopic(): string | null {
  const taken = requestedTopic;
  requestedTopic = null;
  return taken;
}

/** Whether the request waiting is words typed in the Help menu, rather than an application's Help row. */
export function takeRequestedWords(): boolean {
  const taken = requestedWords;
  requestedWords = false;
  return taken;
}

function openTopic(topic: HelpTopic) {
  requestedTopic = topic.id;
  requestHelp(topic.title);
}

function searchWords(text: string) {
  requestedWords = true;
  requestHelp(text);
}

/** The address of a page of help: the desktop, which opens Help Viewer on it. */
export const helpLink = (page: string) =>
  `${location.origin}${location.pathname}#help=${encodeURIComponent(page)}`;

function followHelpLink() {
  const encoded = /^#help=(.+)$/.exec(location.hash)?.[1];
  if (!encoded) return;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  try {
    requestedTopic = decodeURIComponent(encoded);
  } catch {
    return;
  }
  requestHelp(requestedTopic);
}

/** The field and its results, at the top of the Help menu. Return shows the words in Help Viewer. */
export function HelpMenuSearch({ app }: { app: string }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<readonly HelpMenuRow[]>([]);
  const [fromServer, setFromServer] = useState<{
    query: string;
    topics: readonly HelpTopic[];
  } | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const menus = [...registered.values()].filter((each) => each.app === app && each.menu !== "Help");
  const popups = useRef(new Map<string, HTMLElement>());
  const type = (next: string) => {
    setText(next);
    const words = next.trim().toLowerCase();
    const help = field.current?.closest('[role="menu"]');
    const key = ({ menu, via, title }: HelpMenuRow) => `${menu}/${via}/${title}`;
    const found = [
      ...menus.flatMap(({ menu, items }) => [
        ...rowsIn(popups.current.get(menu), menu),
        ...submenuRows(items, menu),
        ...drawnSubmenuRows(popups.current.get(menu), menu),
      ]),
      ...rowsIn(help, "Help"),
    ];
    setRows(
      words === ""
        ? []
        : [...new Map(found.map((row) => [key(row), row])).values()]
            .filter((row) => row.title.toLowerCase().includes(words))
            .slice(0, MENU_ROWS_SHOWN),
    );
  };
  // The menu gives its popup the focus when it has opened, after this component's own effects.
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  // A row under the pointer, or the menu once that row has gone, takes the focus even when the pointer has not moved:
  // typing stays the field's, and goes on at the end of its text.
  useEffect(() => {
    const input = field.current;
    const popup = input?.closest('[role="menu"]');
    const backToField = (event: Event) => {
      const { key, target, ctrlKey, metaKey, altKey } = event as KeyboardEvent;
      if (target === input || ctrlKey || metaKey || altKey) return;
      if (key.length !== 1 && key !== "Backspace") return;
      event.stopPropagation();
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    };
    popup?.addEventListener("keydown", backToField, true);
    return () => popup?.removeEventListener("keydown", backToField, true);
  }, []);
  const wanted = text.trim();
  useEffect(() => {
    if (wanted === "" || !servedByDesktopApp() || !serverSearches(wanted)) return;
    let live = true;
    const timer = setTimeout(() => {
      void getJson(`${HELP_SEARCH_URL}?q=${encodeURIComponent(wanted)}`).then((reply) => {
        const topics = resultsFromServer(reply, wanted);
        if (live && topics) setFromServer({ query: wanted, topics });
      });
    }, SEARCH_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [wanted]);
  const topics = [
    ...(fromServer?.query === wanted ? fromServer.topics : []),
    ...(servedByDesktopApp() ? searchGuides(wanted) : []),
    ...searchHelp(wanted),
  ].slice(0, RESULTS_SHOWN);
  const onKeyDown: ComponentProps<typeof SearchField>["onKeyDown"] = (event) => {
    if (event.key === "Escape") return;
    event.stopPropagation();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.currentTarget
        .closest('[role="menu"]')
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
        ?.focus();
    }
    if (event.key !== "Enter") return;
    searchWords(text);
    event.currentTarget.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
  };
  return (
    <>
      <div role="none" className="mac-desktop-shell-help-search">
        <SearchField
          aria-label="Search"
          size="small"
          inputRef={field}
          value={text}
          onValueChange={type}
          onKeyDown={onKeyDown}
        />
      </div>
      {menus.map(({ menu, items }) => (
        <BaseMenu.Root key={menu}>
          <BaseMenu.Portal keepMounted>
            <BaseMenu.Positioner>
              <BaseMenu.Popup
                ref={(popup) => {
                  if (popup) popups.current.set(menu, popup);
                  else popups.current.delete(menu);
                }}
              >
                {items}
              </BaseMenu.Popup>
            </BaseMenu.Positioner>
          </BaseMenu.Portal>
        </BaseMenu.Root>
      ))}
      {rows.length > 0 ? (
        <MenuSection title="Menu Items">
          {rows.map((row) => (
            <MenuItem key={`${row.menu}/${row.via}/${row.title}`} onClick={() => pointAt(row)}>
              {row.menu} ▸ {row.via ? `${row.via} ▸ ` : ""}
              {row.title}
            </MenuItem>
          ))}
        </MenuSection>
      ) : null}
      {topics.length > 0 ? (
        <MenuSection title="Help Topics">
          {topics.map((topic) => (
            <MenuItem key={topic.id} onClick={() => openTopic(topic)}>
              {topic.title}
            </MenuItem>
          ))}
          <MenuItem onClick={() => searchWords(text)}>Show All Help Topics</MenuItem>
        </MenuSection>
      ) : null}
      {rows.length > 0 || topics.length > 0 ? <MenuSeparator /> : null}
    </>
  );
}
