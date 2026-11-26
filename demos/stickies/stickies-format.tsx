"use client";

import { ColorPanel } from "macalicious/color-panel";
import { attachRef } from "macalicious/lib/attach-ref";
import { observeResize } from "macalicious/lib/observe-resize";
import {
  FONT_FAMILIES,
  RICH_TEXT_KEY_EQUIVALENTS,
  type RichTextAlignment,
  type RichTextCommand,
  type RichTextFormat,
  type RichTextHtmlOptions,
  richTextFromHtml,
} from "macalicious/lib/rich-text";
import {
  ManagedWindow,
  type ManagedWindowRenderProps,
  useManagedWindow,
} from "macalicious/managed-window";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import type { WindowProps } from "macalicious/window";
import { useWindowManagerStore } from "macalicious/window-manager";
import {
  type ComponentType,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { DesktopFontPanel } from "../desktop/desktop-font-panel";
import type { TextSubstitutions } from "../desktop/text-substitutions";
import { SpellingPanel, SubstitutionsPanel } from "../desktop/text-tools";
import {
  type CopiedStyle,
  STYLE_PROPERTIES,
  type TextEditExtraCommand,
  TextEditFontExtraItems,
} from "../textedit/textedit-format";
import { PICTURE_ADDRESS, PICTURE_NAME } from "./stickies-pictures";

/*
 * Stickies' text formats: the Font menu, which the menu bar and a note's contextual menu show,
 * and the two panels it opens, the Fonts panel and the Colors panel. The commands themselves
 * are those of macalicious/lib/rich-text, run on a note's selection by the note.
 */

/** The two panels of the Font menu: Show Fonts and Show Colors. */
export type StickiesPanel = "fonts" | "colors";

/** The panels of the Edit menu: Show Spelling and Grammar, and Show Substitutions. */
export type StickiesToolPanel = "spelling" | "substitutions";

export type StickiesShownPanel = StickiesPanel | StickiesToolPanel;

/** What the Edit menu's panels act on and read. */
export interface StickiesTools {
  element: () => HTMLElement | null;
  /** The words Ignore has passed over, until the app closes. */
  ignored: Set<string>;
  substitutions: TextSubstitutions;
  onSubstitutionsChange: (settings: TextSubstitutions) => void;
}

/**
 * The panels' titles and frames, in points: the library's widths, and the heights they take
 * with their content (a panel's window follows its content's height once it is shown).
 */
const PANELS: Record<
  StickiesShownPanel,
  { title: string; size: { width: number; height: number } }
> = {
  fonts: { title: "Fonts", size: { width: 444, height: 286 } },
  colors: { title: "Colors", size: { width: 228, height: 318 } },
  spelling: { title: "Spelling and Grammar", size: { width: 300, height: 300 } },
  substitutions: { title: "Substitutions", size: { width: 300, height: 220 } },
};

const ALIGNMENTS: readonly [RichTextAlignment, string][] = [
  ["left", "Align Left"],
  ["center", "Center"],
  ["justify", "Justify"],
  ["right", "Align Right"],
];

/** What a note's saved markup keeps beyond the library's formats: the Font menu's other rows. */
export const STICKIES_HTML: RichTextHtmlOptions = { styles: STYLE_PROPERTIES };

/** Font > Copy Style's style, for Paste Style in any note. */
let copiedStyle: CopiedStyle | null = null;
const copiedStyleListeners = new Set<() => void>();

export const currentCopiedStyle = () => copiedStyle;

export function setCopiedStyle(style: CopiedStyle | null) {
  copiedStyle = style;
  for (const listener of copiedStyleListeners) listener();
}

function useCopiedStyle() {
  return useSyncExternalStore(
    (listener) => {
      copiedStyleListeners.add(listener);
      return () => copiedStyleListeners.delete(listener);
    },
    currentCopiedStyle,
    () => null,
  );
}

/**
 * A note's text with its formats, as it is saved: the elements, styles and attributes that
 * formatting writes, and nothing else (`richTextFromHtml`), as markup.
 */
export function storedHtml(field: HTMLElement): string {
  const holder = field.ownerDocument.createElement("div");
  holder.append(noteRichText(field.innerHTML, field.ownerDocument));
  return holder.innerHTML;
}

/** Marks where a picture stood while the rest of the markup is rebuilt. */
const PICTURE_MARK = "data-note-picture";

/**
 * A note's markup as nodes of `target`: `richTextFromHtml`, which drops every picture whatever it
 * is told to keep, with the pictures a note may hold (`PICTURE_ADDRESS`) put back where they stood.
 */
export function noteRichText(html: string, target: Document): DocumentFragment {
  const template = target.createElement("template");
  template.innerHTML = html;
  const pictures: { src: string; alt: string }[] = [];
  for (const image of template.content.querySelectorAll("img")) {
    const src = image.getAttribute("src") ?? "";
    if (!PICTURE_ADDRESS.test(src)) continue;
    const alt = image.getAttribute("alt") ?? "";
    const mark = target.createElement("span");
    mark.setAttribute(PICTURE_MARK, String(pictures.length));
    image.replaceWith(mark);
    pictures.push({ src, alt: PICTURE_NAME.test(alt) ? alt : "" });
  }
  const rebuilt = richTextFromHtml(template.innerHTML, target, {
    ...STICKIES_HTML,
    attributes: { [PICTURE_MARK]: /^\d+$/ },
  });
  for (const mark of rebuilt.querySelectorAll(`[${PICTURE_MARK}]`)) {
    const picture = pictures[Number(mark.getAttribute(PICTURE_MARK))];
    if (!picture) {
      mark.remove();
      continue;
    }
    const image = target.createElement("img");
    image.src = picture.src;
    image.alt = picture.alt;
    mark.replaceWith(image);
  }
  return rebuilt;
}

export interface StickiesFontMenuItemsProps {
  /**
   * The format where the insertion point is in the note the menu acts on: Bold, Italic,
   * Underline and the alignment are checked from it.
   */
  format?: RichTextFormat;
  /** Called with the command chosen. */
  onCommand: (command: RichTextCommand) => void;
  /** Runs Outline, Kern, Ligature, Baseline, Copy Style and Paste Style; without it they are left out. */
  onExtra?: (command: TextEditExtraCommand) => void;
  /** Dims every item, while there is no note to act on. */
  disabled?: boolean;
}

/**
 * The items of Stickies' Font menu: Show Fonts, Bold, Italic, Underline, Bigger, Smaller, Show
 * Colors and the Text submenu with the four alignments, with their key equivalents. The styles
 * and the alignment of the text at the insertion point are checked.
 */
export function StickiesFontMenuItems({
  format,
  onCommand,
  onExtra,
  disabled = false,
}: StickiesFontMenuItemsProps) {
  const copied = useCopiedStyle();
  const command = (name: RichTextCommand, label: string) => (
    <MenuItem
      disabled={disabled}
      keyEquivalent={RICH_TEXT_KEY_EQUIVALENTS[name]}
      onClick={() => onCommand(name)}
    >
      {label}
    </MenuItem>
  );
  const style = (name: "bold" | "italic" | "underline", label: string) => (
    <MenuCheckboxItem
      disabled={disabled}
      keyEquivalent={RICH_TEXT_KEY_EQUIVALENTS[name]}
      checked={format?.[name] ?? false}
      onCheckedChange={() => onCommand(name)}
    >
      {label}
    </MenuCheckboxItem>
  );
  return (
    <>
      {command("show-fonts", "Show Fonts")}
      {style("bold", "Bold")}
      {style("italic", "Italic")}
      {style("underline", "Underline")}
      <MenuSeparator />
      {command("bigger", "Bigger")}
      {command("smaller", "Smaller")}
      <MenuSeparator />
      {command("show-colors", "Show Colors")}
      <MenuSeparator />
      {onExtra ? (
        <>
          <TextEditFontExtraItems canPasteStyle={copied !== null} onExtra={onExtra} />
          <MenuSeparator />
        </>
      ) : null}
      <Submenu disabled={disabled}>
        <SubmenuTrigger>Text</SubmenuTrigger>
        <SubmenuPopup aria-label="Text">
          <MenuRadioGroup
            value={format?.align ?? "left"}
            onValueChange={(align) => onCommand(`align-${align as RichTextAlignment}`)}
          >
            {ALIGNMENTS.map(([value, label]) => (
              <MenuRadioItem
                key={value}
                value={value}
                disabled={disabled}
                keyEquivalent={RICH_TEXT_KEY_EQUIVALENTS[`align-${value}`]}
              >
                {label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
    </>
  );
}

/** Where the panels open, from the size of a panel and its place in the order of the panels. */
export type StickiesPanelPlace = (
  size: { width: number; height: number },
  index: number,
) => { x: number; y: number };

/**
 * Panels side by side at the top right of a window manager's element, `top` points down, the
 * first one opened at the right. The element is measured once, when a panel opens.
 */
export function placeAtTopRight(
  element: () => Element | null | undefined,
  top: number,
): StickiesPanelPlace {
  return (size, index) => {
    const width = element()?.clientWidth ?? 0;
    const right = 20 + index * (PANELS.fonts.size.width + 12);
    return { x: Math.max(20, width - right - size.width), y: top };
  };
}

export interface StickiesPanelsProps<P extends StickiesShownPanel = StickiesPanel> {
  /** The panels that are shown, in the order they were opened. */
  open: readonly P[];
  /** Called when a panel is closed by its close button or by its window manager. */
  onClose: (panel: P) => void;
  /** The format where the insertion point is in the note the panels act on. */
  format?: RichTextFormat;
  /** Called with what a panel changed: apply it to the note's selection. */
  onFormatChange: (change: Partial<RichTextFormat>) => void;
  /** What the Edit menu's panels need: without it they do not open. */
  tools?: StickiesTools;
  /**
   * Called when a panel has opened: the note gives itself the keyboard back, as a Catalina
   * document keeps it when its Fonts panel is shown.
   */
  onShown?: () => void;
  /** Given by a desktop page whose descriptor says `windows`: the panels are its windows. */
  DesktopWindow?: ComponentType<DesktopSecondaryWindowProps>;
  /**
   * Without `DesktopWindow`: `"here"` makes the panels windows of the window manager this is
   * rendered in, rendered in place; `"enclosing"` makes them windows of the same manager, rendered
   * into that manager's element (out of the window this is rendered in, whose frame would
   * otherwise hold them); and `null` floats them over the page. Either way their store is the one
   * React gives them. With `"enclosing"` the element is the window manager's around where this
   * is rendered, which is that store's manager; with none around it the panels float.
   * @default null
   */
  manager?: "here" | "enclosing" | null;
  /** Where a panel opens in a window manager. */
  place?: StickiesPanelPlace;
  /**
   * What the panels' window ids start with, so that they are unique in their manager, or
   * among the application's windows on a desktop page.
   * @default "stickies-"
   */
  idPrefix?: string;
}

/** The props of the window a panel is drawn in, without the ones a panel takes for itself. */
type PanelWindowProps = Omit<
  WindowProps,
  "variant" | "fullScreen" | "title" | "defaultValue" | "onChange" | "children"
>;

/** What starts moving a panel by its title bar: a press on the bar but not on its controls. */
const CONTROL = "button, a, input, select, textarea, [role='tab'], [role='button']";

/** A managed window's render props as a panel's: the eight a panel has no part for go. */
function panelProps({
  onClose: _close,
  onMinimize: _minimize,
  onZoom: _zoom,
  zoomRole: _zoomRole,
  minimizeDisabled: _minimizeDisabled,
  zoomDisabled: _zoomDisabled,
  onDragRegionPointerDown: _drag,
  onDragRegionDoubleClick: _doubleClick,
  variant: _variant,
  fullScreen: _fullScreen,
  title: _title,
  defaultValue: _defaultValue,
  onChange: _onChange,
  children: _children,
  ...props
}: ManagedWindowRenderProps): PanelWindowProps {
  return props;
}

/**
 * The Fonts and Colors panels of Stickies, and the Edit menu's two, acting on one note: as windows
 * of a desktop page, as utility panels of a window manager, or floating over the page.
 */
export function StickiesPanels<P extends StickiesShownPanel = StickiesPanel>({
  open,
  onClose,
  format,
  onFormatChange,
  tools,
  onShown,
  DesktopWindow,
  manager = null,
  place = () => ({ x: 20, y: 40 }),
  idPrefix = "stickies-",
}: StickiesPanelsProps<P>) {
  const panel = (name: StickiesShownPanel, props: PanelWindowProps, close: () => void) => {
    if (name === "spelling") {
      return tools ? (
        <SpellingPanel
          {...props}
          element={tools.element}
          editable
          ignored={tools.ignored}
          onClose={close}
        />
      ) : null;
    }
    if (name === "substitutions") {
      return tools ? (
        <SubstitutionsPanel
          {...props}
          element={tools.element}
          editable
          settings={tools.substitutions}
          onChange={tools.onSubstitutionsChange}
          onClose={close}
        />
      ) : null;
    }
    return name === "fonts" ? (
      <DesktopFontPanel
        role="dialog"
        {...props}
        families={FONT_FAMILIES}
        value={format}
        onFontChange={onFormatChange}
        onClose={close}
      />
    ) : (
      <ColorPanel
        role="dialog"
        {...props}
        value={format?.color ?? "#000000"}
        onValueChange={(color) => onFormatChange({ color })}
        onClose={close}
      />
    );
  };

  if (DesktopWindow) {
    return open.map((name) => {
      const shown = (
        <Shown key={name} onShown={onShown}>
          <DesktopWindow
            id={`${idPrefix}${name}`}
            title={PANELS[name].title}
            defaultSize={PANELS[name].size}
            resizable={false}
            panel
            fitsContent
            dragRegion=".mac-title-bar"
            onClose={() => onClose(name)}
            render={(props) => panel(name, panelProps(props), props.onClose)}
          />
        </Shown>
      );
      return tools && (name === "spelling" || name === "substitutions") ? (
        <BesideNote key={name} windowId={`stickies:${idPrefix}${name}`} element={tools.element}>
          {shown}
        </BesideNote>
      ) : (
        shown
      );
    });
  }

  const floating = () =>
    open.length === 0 || typeof document === "undefined"
      ? null
      : createPortal(
          <div className="mac-stickies-panels">
            {open.map((name) => (
              <Shown key={name} onShown={onShown}>
                {panel(name, {}, () => onClose(name))}
              </Shown>
            ))}
          </div>,
          document.body,
        );

  if (manager) {
    const windows = open.map((name, index) => (
      <Shown key={name} onShown={onShown}>
        <PanelWindow
          id={`${idPrefix}${name}`}
          name={name}
          index={index}
          place={place}
          onClose={() => onClose(name)}
        >
          {(props, close) => panel(name, props, close)}
        </PanelWindow>
      </Shown>
    ));
    if (manager === "here") return windows;
    if (open.length === 0) return null;
    return <EnclosingManager fallback={floating()}>{windows}</EnclosingManager>;
  }

  return floating();
}

/**
 * Renders `children`, windows of the window manager this is rendered in, into that manager's
 * element: the one around a hidden anchor this renders in place. React puts what a component
 * renders inside what its ancestors render, so that element is the `WindowManager`'s whose store
 * the windows are given; nothing from outside names it. Before the anchor is read, nothing is
 * shown; with no manager's element around it, `fallback`.
 */
function EnclosingManager({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [stage, setStage] = useState<Element | null>();
  useLayoutEffect(() => {
    setStage(anchor.current?.parentElement?.closest(".mac-window-manager") ?? null);
  }, []);
  return (
    <>
      <span ref={anchor} hidden />
      {stage ? createPortal(children, stage) : stage === null ? fallback : null}
    </>
  );
}

/**
 * Moves a panel of the desktop beside the note it acts on, once, as it opens: over the note it
 * would hide the word it is showing. To the left where the right has no room.
 */
function BesideNote({
  windowId,
  element,
  children,
}: {
  windowId: string;
  element: () => HTMLElement | null;
  children: ReactNode;
}) {
  const store = useWindowManagerStore();
  const [first] = useState(() => ({ store, windowId, element }));
  useEffect(() => {
    const timer = setTimeout(() => {
      const note = first.element()?.closest(".mac-sticky-note");
      const room = note?.closest(".mac-window-manager");
      const frame = first.store.get(first.windowId)?.frame;
      if (!note || !room || !frame) return;
      const seen = note.getBoundingClientRect();
      const from = room.getBoundingClientRect();
      const right = seen.right - from.left + 12;
      const x =
        right + frame.width <= room.clientWidth ? right : seen.left - from.left - 12 - frame.width;
      first.store.patch(first.windowId, {
        frame: first.store.bound(
          { ...frame, x, y: seen.top - from.top },
          room.clientWidth,
          room.clientHeight,
        ),
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [first]);
  return children;
}

/**
 * Calls `onShown` once its content has opened, in a task of its own: after the window manager
 * has given the new panel the keyboard, which it does in a render of its own.
 */
function Shown({ onShown, children }: { onShown?: () => void; children: ReactNode }) {
  const [shown] = useState(() => onShown);
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(shown, 0);
    return () => clearTimeout(timer);
  }, [shown]);
  return children;
}

/** A panel as a utility panel of the window manager it is rendered in. */
function PanelWindow({
  id,
  name,
  index,
  place,
  onClose,
  children,
}: {
  id: string;
  name: StickiesShownPanel;
  index: number;
  place: StickiesPanelPlace;
  onClose: () => void;
  children: (props: PanelWindowProps, close: () => void) => ReactNode;
}) {
  // Read once, when the panel opens: where it stands from then on is the manager's.
  const [frame] = useState(() => ({
    ...PANELS[name].size,
    ...place(PANELS[name].size, index),
  }));
  return (
    <ManagedWindow
      id={id}
      app="stickies"
      title={PANELS[name].title}
      panel
      resizable={false}
      defaultFrame={frame}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      render={(props) => (
        <PanelFrame window={props}>
          {(windowProps) => children(windowProps, props.onClose)}
        </PanelFrame>
      )}
    />
  );
}

/**
 * A panel as a managed window: it moves by its title bar, and its window is as tall as the
 * panel's content.
 */
function PanelFrame({
  window,
  children,
}: {
  window: ManagedWindowRenderProps;
  children: (props: PanelWindowProps) => ReactNode;
}) {
  const store = useWindowManagerStore();
  const { id } = useManagedWindow();
  const element = useRef<HTMLDivElement>(null);
  const props = panelProps(window);
  // The panel measures its element and still hands it to the ref the managed window passes on.
  const windowRef = props.ref;
  const setElement = useCallback(
    (node: HTMLDivElement) => {
      element.current = node;
      const release = attachRef(windowRef, node);
      return () => {
        element.current = null;
        release();
      };
    },
    [windowRef],
  );
  useLayoutEffect(() => {
    const panel = element.current;
    if (!panel) return;
    return observeResize(panel, () => {
      const frame = store.get(id)?.frame;
      const height = panel.offsetHeight;
      if (frame && height > 0 && frame.height !== height) {
        store.patch(id, { frame: { ...frame, height } });
      }
    });
  }, [store, id]);
  return children({
    ...props,
    ref: setElement,
    height: "auto",
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      props.onPointerDown?.(event);
      const target = event.target as Element;
      if (
        !event.defaultPrevented &&
        event.button === 0 &&
        target.closest(".mac-title-bar") &&
        !target.closest(CONTROL)
      ) {
        window.onDragRegionPointerDown(event);
      }
    },
  });
}
