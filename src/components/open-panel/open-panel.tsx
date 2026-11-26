"use client";

import type { ComponentProps, CSSProperties, MouseEvent, ReactNode } from "react";
import { useControlled } from "../../lib/use-controlled";
import { DefaultButton } from "../default-button";
import { PopUpButton, PopUpButtonItem, PopUpButtonSeparator } from "../pop-up-button";
import { PushButton } from "../push-button";
import { SplitView, SplitViewDivider, SplitViewPane } from "../split-view";
import { Toolbar } from "../toolbar";
import { ToolbarButton, type ToolbarButtonProps } from "../toolbar-button";
import { ToolbarSearchField } from "../toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "../toolbar-segmented-control";
import { Window, type WindowState } from "../window";
import "./open-panel.tokens.css";
import "./open-panel.css";

/** Why Back, Forward and the default button are dimmed: each says it as its tooltip. */
const BACK_REASON = "There is no folder to go back to.";
const FORWARD_REASON = "There is no folder to go forward to.";
const OPEN_REASON = "Select an item to open.";

/** How the browser shows a folder: the four views of Finder. */
export type OpenPanelView = "icon" | "list" | "column" | "gallery";

/** One place in the location pop-up button of the toolbar. */
export interface OpenPanelLocation {
  /** Identifies the place: the value of `location`. */
  value: string;
  /** Its name, in the button and in the menu. */
  label: ReactNode;
  /** A 16 pt icon before the name: a folder, a disk, a cloud. */
  icon?: ReactNode;
  /** Draws a separator line above this item in the menu: between the path and Favorites. */
  separatorBefore?: boolean;
  /** Shows the item dimmed; it cannot be chosen. */
  disabled?: boolean;
}

// The names of the browser's controls, which assistive technology reads; all English.
const LABELS = {
  toolbar: "Navigation",
  history: "History",
  back: "Back",
  forward: "Forward",
  view: "View",
  icon: "as Icons",
  list: "as List",
  column: "as Columns",
  gallery: "as Gallery",
  newFolder: "New Folder",
  location: "Location",
  resizeSidebar: "Resize sidebar",
};

// The glyphs of the toolbar, drawn for this library on the measured boxes; not Apple's. The
// four views, each 19 x 12 pt.
const VIEWS = {
  icon: "M.5.5h4v4h-4zm7 0h4v4h-4zm7 0h4v4h-4zm-14 7h4v4h-4zm7 0h4v4h-4zm7 0h4v4h-4z",
  list: "M0 1h19M0 4.5h19M0 8h19M0 11.5h19",
  column: "M.5.5h18v11H.5zm6 0v11m6-11v11",
  gallery: "M.5.5h18v7H.5zM0 11h3m1 0h3m1 0h3m1 0h3m1 0h3",
};
const CHEVRON = "M6 .5.75 6l5.5 5.5";

const glyph = (width: number, height: number, d: string, strokeWidth?: number) => (
  <svg
    width={width}
    height={height}
    viewBox={`0 0 ${width} ${height}`}
    aria-hidden="true"
    focusable="false"
  >
    <path d={d} fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
  </svg>
);

const present = (node: ReactNode) => node != null && node !== false;
const classes = (own: string, given?: string) => (given ? `${own} ${given}` : own);

// A pop-up button of the toolbar: the library's pop-up button, whose button is drawn as a
// toolbar button (the textured bezel) instead of the push-button bezel, with the arrows after
// the title: two for the location, one for the view.
function ToolbarPopUp({
  double,
  children,
  ...props
}: ComponentProps<"button"> & { double?: boolean }) {
  return (
    <ToolbarButton {...(props as ToolbarButtonProps)}>
      <span className="mac-open-panel-pop-up-title">{children}</span>
      {double
        ? glyph(8, 12, "M1 4.25l3-3 3 3m-6 3.5 3 3 3-3", 1.5)
        : glyph(8, 5, "M1 .75l3 3 3-3", 1.5)}
    </ToolbarButton>
  );
}

export interface OpenPanelBrowserProps extends Omit<ComponentProps<"div">, "onChange"> {
  /**
   * The places of the location pop-up button: the path to the current folder, then favourite
   * and recent places. Without any the button is not shown.
   */
  locations?: readonly OpenPanelLocation[];
  /**
   * The value of the place shown in the location button, when controlled; `null` shows none
   * and still controls it.
   */
  location?: string | null;
  /** The place shown at first, when uncontrolled. */
  defaultLocation?: string;
  /** Called with the value of the place chosen from the location button. */
  onLocationChange?: (location: string) => void;
  /** The view shown in the view button, when controlled. Showing that view is the caller's. */
  view?: OpenPanelView;
  /**
   * The view shown at first, when uncontrolled.
   * @default "column"
   */
  defaultView?: OpenPanelView;
  /** Called with the view chosen from the view button. */
  onViewChange?: (view: OpenPanelView) => void;
  /**
   * Whether there is a folder to go back to: enables the Back button.
   * @default false
   */
  canGoBack?: boolean;
  /**
   * Whether there is a folder to go forward to: enables the Forward button.
   * @default false
   */
  canGoForward?: boolean;
  /** Called when the Back button is activated. */
  onBack?: (event: MouseEvent<HTMLElement>) => void;
  /** Called when the Forward button is activated. */
  onForward?: (event: MouseEvent<HTMLElement>) => void;
  /** Called when the New Folder button is activated. Without it the button is not shown. */
  onNewFolder?: (event: MouseEvent<HTMLElement>) => void;
  /** The text of the search field, when controlled. */
  search?: string;
  /** The text of the search field at first, when uncontrolled. */
  defaultSearch?: string;
  /** Called with the text of the search field on every change. */
  onSearchChange?: (search: string) => void;
  /**
   * The placeholder of the search field, which also names it.
   * @default "Search"
   */
  searchPlaceholder?: string;
  /** The source list: a `Sidebar` element. Without it the browser fills the width. */
  sidebar?: ReactNode;
  /**
   * The width of the sidebar at first, in points. The divider after it resizes it.
   * @default 155
   */
  sidebarWidth?: number;
  /**
   * A band over the browser, beside the sidebar: the banner Finder shows for a shared or an
   * iCloud folder ("Shared Folder").
   */
  header?: ReactNode;
  /**
   * Other names for the browser's controls, for another language: any of `toolbar`,
   * `history`, `back`, `forward`, `view`, `icon`, `list`, `column`, `gallery`, `newFolder`,
   * `location` and `resizeSidebar`.
   * @default the English names: "Navigation", "Back", "as Icons", "New Folder" and so on
   */
  labels?: Partial<Record<keyof typeof LABELS, string>>;
  /** The browser: a `ColumnView`, `ListView`, `IconView` or `GalleryView` of the folder. */
  children?: ReactNode;
}

// The props above, by name: `OpenPanel` hands these to its browser and the rest to its window.
const BROWSER =
  "locations location defaultLocation onLocationChange view defaultView onViewChange canGoBack canGoForward onBack onForward onNewFolder search defaultSearch onSearchChange searchPlaceholder sidebar sidebarWidth header labels children".split(
    " ",
  );

/*
 * The miniature Finder of the Open and Save panels: a toolbar (Back and Forward, the view
 * button, New Folder, the location pop-up button centred on the panel, a search field) over a
 * sidebar and a file browser. `OpenPanel` and the expanded `SavePanel` are built from it; use
 * it yourself to show the browser in a sheet.
 *
 * It draws the controls and reports what the user asks for. The files are yours: give the
 * sidebar and the browser as elements, and answer the callbacks by changing what they show.
 * (The description below is one line because the build keeps it and the size budget counts
 * it.)
 */
/** The toolbar, sidebar and file browser that the Open and Save panels share. */
export function OpenPanelBrowser({
  locations,
  location,
  defaultLocation,
  onLocationChange,
  view,
  defaultView = "column",
  onViewChange,
  canGoBack = false,
  canGoForward = false,
  onBack,
  onForward,
  onNewFolder,
  search,
  defaultSearch,
  onSearchChange,
  searchPlaceholder = "Search",
  sidebar,
  sidebarWidth = 155,
  header,
  labels,
  className,
  children,
  ...props
}: OpenPanelBrowserProps) {
  const names = { ...LABELS, ...labels };
  const [shownView, setView] = useControlled(view, defaultView, onViewChange);
  const browser = (
    <div className="mac-open-panel-main">
      {present(header) && <div className="mac-open-panel-header">{header}</div>}
      <div className="mac-open-panel-files">{children}</div>
    </div>
  );
  return (
    <div className={classes("mac-open-panel-browser", className)} {...props}>
      <Toolbar aria-label={names.toolbar} className="mac-open-panel-toolbar">
        <div className="mac-open-panel-toolbar-leading">
          <ToolbarSegmentedControl
            variant="navigation"
            tracking="momentary"
            aria-label={names.history}
          >
            <ToolbarSegment
              aria-label={names.back}
              disabled={!canGoBack}
              title={canGoBack ? undefined : BACK_REASON}
              onClick={onBack}
              className="mac-open-panel-history"
            >
              {glyph(7, 12, CHEVRON, 1.5)}
            </ToolbarSegment>
            <ToolbarSegment
              aria-label={names.forward}
              disabled={!canGoForward}
              title={canGoForward ? undefined : FORWARD_REASON}
              onClick={onForward}
              className="mac-open-panel-history mac-open-panel-forward"
            >
              {glyph(7, 12, CHEVRON, 1.5)}
            </ToolbarSegment>
          </ToolbarSegmentedControl>
          <PopUpButton<OpenPanelView>
            aria-label={names.view}
            value={shownView}
            onValueChange={(next) => next && setView(next)}
            render={<ToolbarPopUp />}
            className="mac-open-panel-view"
          >
            {(Object.keys(VIEWS) as OpenPanelView[]).map((value) => (
              <PopUpButtonItem key={value} value={value} image={glyph(19, 12, VIEWS[value])}>
                <span className="mac-open-panel-view-label">{names[value]}</span>
              </PopUpButtonItem>
            ))}
          </PopUpButton>
          {onNewFolder && (
            <ToolbarButton
              aria-label={names.newFolder}
              onClick={onNewFolder}
              className="mac-open-panel-new-folder"
            >
              {glyph(18, 13, "M11 12.5H.5V.5h5l1.5 2h7.5v2m-14 0h10m4 2v6m-3-3h6")}
            </ToolbarButton>
          )}
        </div>
        {locations?.[0] ? (
          <PopUpButton
            aria-label={names.location}
            value={location}
            defaultValue={defaultLocation}
            onValueChange={(next) => next != null && onLocationChange?.(next)}
            render={<ToolbarPopUp double />}
            className="mac-open-panel-location"
          >
            {locations.flatMap((place) => [
              place.separatorBefore && <PopUpButtonSeparator key={`s${place.value}`} />,
              <PopUpButtonItem
                key={`i${place.value}`}
                value={place.value}
                image={place.icon}
                disabled={place.disabled}
              >
                {place.label}
              </PopUpButtonItem>,
            ])}
          </PopUpButton>
        ) : (
          <span />
        )}
        <ToolbarSearchField
          className="mac-open-panel-search"
          placeholder={searchPlaceholder}
          value={search}
          defaultValue={defaultSearch}
          onValueChange={onSearchChange}
        />
      </Toolbar>
      {present(sidebar) ? (
        <SplitView
          className="mac-open-panel-split"
          style={
            { "--mac-split-view-divider-color": "var(--mac-open-panel-divider)" } as CSSProperties
          }
        >
          <SplitViewPane defaultSize={sidebarWidth} minSize={100} maxSize={320}>
            {sidebar}
          </SplitViewPane>
          <SplitViewDivider aria-label={names.resizeSidebar} />
          <SplitViewPane>{browser}</SplitViewPane>
        </SplitView>
      ) : (
        browser
      )}
    </div>
  );
}

export interface OpenPanelProps extends OpenPanelBrowserProps {
  /**
   * The title of the default button (NSSavePanel.prompt).
   * @default "Open"
   */
  prompt?: ReactNode;
  /**
   * The title of the button that dismisses the panel without a choice.
   * @default "Cancel"
   */
  cancelLabel?: ReactNode;
  /**
   * Disables the default button: nothing that can be opened is selected.
   * @default false
   */
  openDisabled?: boolean;
  /** Called when the default button is activated, by a click or by Return. */
  onOpen?: (event: MouseEvent<HTMLElement>) => void;
  /** Called when Cancel is activated, by a click, by Escape or by Command-Period. */
  onCancel?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Buttons at the leading end of the bottom bar: the application's own, such as
   * "New Document" and "Options" (`PushButton` elements).
   */
  leading?: ReactNode;
  /**
   * The accessory view (NSSavePanel.accessoryView): the application's options, shown between
   * the browser and the bottom bar. Show and hide it from an "Options" button in `leading`.
   */
  accessory?: ReactNode;
  /**
   * Whether the panel is key, main or inactive (see `Window`). An open panel is key while it
   * is shown; the window it was opened from is main.
   * @default "key"
   */
  state?: WindowState;
  /** Frame width: a number of points, or any CSS length. */
  width?: number | string;
  /** Frame height: a number of points, or any CSS length. */
  height?: number | string;
}

/*
 * The Open panel (NSOpenPanel): the dialog in which the user chooses a file to open. A window
 * without a title bar that holds the browser of `OpenPanelBrowser`, and a bottom bar with the
 * application's buttons at the leading end and Cancel and the default button at the trailing
 * end.
 *
 * It is a `dialog` named "Open" unless you pass `aria-label`. Return activates the default
 * button and Escape activates Cancel, from anywhere in the panel, and Command-F moves to the
 * search field. It draws and reports; reading folders, showing them in the browser and closing
 * the panel are the application's.
 */
/** The Open panel (NSOpenPanel): the dialog in which the user chooses a file to open. */
export function OpenPanel({
  prompt = "Open",
  cancelLabel = "Cancel",
  openDisabled = false,
  onOpen,
  onCancel,
  leading,
  accessory,
  className,
  onKeyDown,
  "aria-label": ariaLabel,
  ...props
}: OpenPanelProps) {
  // The browser's own props go to the browser; every other prop goes to the window.
  const browser: Record<string, unknown> = {};
  const frame: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    (BROWSER.includes(key) ? browser : frame)[key] = value;
  }
  return (
    <Window
      role="dialog"
      aria-label={ariaLabel ?? (props["aria-labelledby"] ? undefined : "Open")}
      className={classes("mac-open-panel", className)}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        const field =
          !event.defaultPrevented &&
          event.metaKey &&
          event.key.toLowerCase() === "f" &&
          // As the key equivalents: only the key window answers.
          !event.currentTarget.closest(
            '[data-window-state="main"],[data-window-state="inactive"]',
          ) &&
          event.currentTarget.querySelector<HTMLElement>(".mac-open-panel-search input");
        if (field) {
          // Command-F is the panel's here, not the browser's Find.
          event.preventDefault();
          field.focus();
        }
      }}
      {...frame}
    >
      <OpenPanelBrowser {...browser} />
      {present(accessory) && <div className="mac-open-panel-accessory">{accessory}</div>}
      <div className="mac-open-panel-bar">
        <div className="mac-open-panel-bar-leading">{leading}</div>
        <PushButton keyEquivalent="escape" onClick={onCancel} className="mac-open-panel-button">
          {cancelLabel}
        </PushButton>
        <DefaultButton
          disabled={openDisabled}
          title={openDisabled ? OPEN_REASON : undefined}
          onClick={onOpen}
          className="mac-open-panel-button"
        >
          {prompt}
        </DefaultButton>
      </div>
    </Window>
  );
}
