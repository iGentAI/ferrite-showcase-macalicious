"use client";

import {
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import { useControlled } from "../../lib/use-controlled";
import { DefaultButton } from "../default-button";
import { DisclosureButton } from "../disclosure-button";
import {
  OpenPanelBrowser,
  type OpenPanelBrowserProps,
  type OpenPanelLocation,
} from "../open-panel";
import { PopUpButton, PopUpButtonItem, PopUpButtonSeparator } from "../pop-up-button";
import { PushButton } from "../push-button";
import { TextField } from "../text-field";
import { TokenField } from "../token-field";
import "./save-panel.css";

/** What the panel holds when Save is activated. */
export interface SavePanelValues {
  /** The text of the name field. */
  name: string;
  /** The tags of the tags field; empty when the field is not shown. */
  tags: string[];
  /** The value of the place chosen in the Where button, if there is one. */
  location: string | undefined;
}

const NO_TAGS: readonly string[] = [];

export interface SavePanelProps extends Omit<ComponentProps<"form">, "onSubmit"> {
  /** The text of the name field (NSSavePanel.nameFieldStringValue), when controlled. */
  name?: string;
  /**
   * The text of the name field at first, when uncontrolled.
   * @default "Untitled"
   */
  defaultName?: string;
  /** Called with the text of the name field on every change. */
  onNameChange?: (name: string) => void;
  /**
   * The label before the name field (NSSavePanel.nameFieldLabel).
   * @default "Save As:"
   */
  nameLabel?: ReactNode;
  /**
   * Whether the Tags field is shown (NSSavePanel.showsTagField).
   * @default true
   */
  showsTagField?: boolean;
  /** The tags, when controlled. */
  tags?: readonly string[];
  /** The tags at first, when uncontrolled. */
  defaultTags?: readonly string[];
  /** Called with the new list whenever a tag is added or removed. */
  onTagsChange?: (tags: string[]) => void;
  /**
   * The places of the Where pop-up button, and of the browser's location button in the
   * expanded form: the current folder, then favourite and recent places.
   */
  locations?: readonly OpenPanelLocation[];
  /** The value of the place the document is saved in, when controlled. */
  location?: string;
  /** The place at first, when uncontrolled. */
  defaultLocation?: string;
  /** Called with the value of the place chosen. */
  onLocationChange?: (location: string) => void;
  /** Whether the file browser is shown (NSSavePanel.isExpanded), when controlled. */
  expanded?: boolean;
  /**
   * Whether the file browser is shown at first, when uncontrolled.
   * @default false
   */
  defaultExpanded?: boolean;
  /** Called when the disclosure button beside the name field is activated. */
  onExpandedChange?: (expanded: boolean) => void;
  /**
   * The browser of the expanded form: the props of `OpenPanelBrowser` (`sidebar`, `children`,
   * `canGoBack`, `onBack`, `view` and the others), except the place, which is the panel's own
   * `location`: the Where button, the browser's location button and `onSave` share it. The
   * browser lists the panel's `locations` unless it names its own. Without `browser` the panel
   * has no disclosure button.
   */
  browser?: Omit<OpenPanelBrowserProps, "location" | "defaultLocation" | "onLocationChange">;
  /**
   * The application's own rows (NSSavePanel.accessoryView), after the panel's: `SavePanelRow`
   * elements, such as a File Format pop-up button.
   */
  accessory?: ReactNode;
  /**
   * The title of the default button (NSSavePanel.prompt).
   * @default "Save"
   */
  prompt?: ReactNode;
  /**
   * The title of the button that dismisses the panel without saving.
   * @default "Cancel"
   */
  cancelLabel?: ReactNode;
  /**
   * Disables the default button. It is disabled in any case while the name is empty.
   * @default false
   */
  saveDisabled?: boolean;
  /** Called with the name, tags and place when the default button is activated. */
  onSave?: (values: SavePanelValues, event: MouseEvent<HTMLElement>) => void;
  /** Called when Cancel is activated, by a click, by Escape or by Command-Period. */
  onCancel?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Called when New Folder is activated. The button is at the leading end of the button row
   * in the expanded form (NSSavePanel.canCreateDirectories); without this it is not shown.
   */
  onNewFolder?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Other texts for the panel's own labels, for another language: any of `tags`, `where`,
   * `newFolder`, `showBrowser` and `hideBrowser` (the two names of the disclosure button).
   * The browser's are in `browser.labels`.
   * @default "Tags:", "Where:", "New Folder", "Show the file browser", "Hide the file browser"
   */
  labels?: Partial<Record<keyof typeof LABELS, string>>;
}

const LABELS = {
  tags: "Tags:",
  where: "Where:",
  newFolder: "New Folder",
  showBrowser: "Show the file browser",
  hideBrowser: "Hide the file browser",
};

/*
 * The Save panel (NSSavePanel): names a document and chooses where it is saved. The collapsed
 * form is a name field, a Tags field and a Where pop-up button; the disclosure button beside
 * the name expands it to the file browser of the Open panel.
 *
 * It is the panel's content, a `form` named "Save" with no frame of its own: put it in a
 * `SheetPopup` on the document's window, as AppKit presents it, or in a `Window`. Return
 * activates the default button and Escape activates Cancel. No screenshot of the reference
 * set shows a Save panel: its layout is inferred from the Open panel and the Print sheet.
 * (The description below is one line because the build keeps it and the size budget counts
 * it.)
 */
/** The content of a Save dialog (NSSavePanel): names a document and chooses its place. */
export function SavePanel({
  name,
  defaultName = "Untitled",
  onNameChange,
  nameLabel = "Save As:",
  showsTagField = true,
  tags,
  defaultTags,
  onTagsChange,
  locations,
  location,
  defaultLocation,
  onLocationChange,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  browser,
  accessory,
  prompt = "Save",
  cancelLabel = "Cancel",
  saveDisabled = false,
  onSave,
  onCancel,
  onNewFolder,
  labels,
  className,
  "aria-label": ariaLabel,
  ...props
}: SavePanelProps) {
  const id = useId();
  const [shownName, setName] = useControlled(name, defaultName, onNameChange);
  const [shownTags, setTags] = useControlled<readonly string[]>(
    tags,
    defaultTags ?? NO_TAGS,
    onTagsChange as ((tags: readonly string[]) => void) | undefined,
  );
  // The place may start unset, which `undefined` cannot tell from "not controlled".
  const [ownLocation, setOwnLocation] = useState(defaultLocation);
  const shownLocation = location === undefined ? ownLocation : location;
  const setLocation = (next: string) => {
    setOwnLocation(next);
    onLocationChange?.(next);
  };
  const names = { ...LABELS, ...labels };
  const [isExpanded, setExpanded] = useControlled(expanded, defaultExpanded, onExpandedChange);
  const showsBrowser = browser !== undefined && isExpanded;

  // The name without its extension is selected the first time the field takes the focus, so
  // that typing replaces it, as in AppKit.
  const selected = useRef(false);

  return (
    <form
      noValidate
      aria-label={props["aria-labelledby"] === undefined ? (ariaLabel ?? "Save") : ariaLabel}
      data-expanded={showsBrowser ? "" : undefined}
      className={classes("mac-save-panel", className)}
      onSubmit={(event) => event.preventDefault()}
      {...props}
    >
      <div className="mac-save-panel-form">
        <SavePanelRow label={nameLabel} labelFor={`${id}-name`}>
          <TextField
            id={`${id}-name`}
            className="mac-save-panel-field"
            value={shownName}
            onValueChange={setName}
            onFocus={(event) => {
              if (selected.current) return;
              selected.current = true;
              const input = event.currentTarget as HTMLInputElement;
              // After the browser's own selection on focus (all of the text, on Tab).
              queueMicrotask(() => {
                if (input.ownerDocument.activeElement !== input) return;
                const dot = input.value.lastIndexOf(".");
                input.setSelectionRange(0, dot > 0 ? dot : input.value.length);
              });
            }}
          />
          {browser ? (
            <DisclosureButton
              expanded={isExpanded}
              onExpandedChange={setExpanded}
              aria-controls={showsBrowser ? `${id}-browser` : undefined}
              aria-label={isExpanded ? names.hideBrowser : names.showBrowser}
              className="mac-save-panel-disclosure"
            />
          ) : null}
        </SavePanelRow>
        {showsTagField ? (
          <SavePanelRow label={names.tags} labelFor={`${id}-tags`}>
            <TokenField
              id={`${id}-tags`}
              className="mac-save-panel-field"
              tokensLabel={names.tags.replace(/:$/, "")}
              value={shownTags}
              onValueChange={setTags}
            />
          </SavePanelRow>
        ) : null}
        {locations?.length && !showsBrowser ? (
          <SavePanelRow label={names.where} labelId={`${id}-where`}>
            <PopUpButton
              aria-labelledby={`${id}-where`}
              className="mac-save-panel-field"
              value={shownLocation ?? null}
              onValueChange={(next) => next != null && setLocation(next)}
            >
              {places(locations)}
            </PopUpButton>
          </SavePanelRow>
        ) : null}
        {showsBrowser ? null : accessory}
      </div>
      {showsBrowser ? (
        <>
          <OpenPanelBrowser
            locations={locations}
            {...browser}
            location={shownLocation ?? null}
            defaultLocation={undefined}
            onLocationChange={setLocation}
            id={`${id}-browser`}
            className={classes("mac-save-panel-browser", browser.className)}
          />
          {accessory === undefined || accessory === null || accessory === false ? null : (
            <div className="mac-save-panel-form">{accessory}</div>
          )}
        </>
      ) : null}
      <div className="mac-save-panel-actions">
        {showsBrowser && onNewFolder ? (
          <PushButton onClick={onNewFolder}>{names.newFolder}</PushButton>
        ) : null}
        <PushButton
          keyEquivalent="escape"
          onClick={onCancel}
          className="mac-save-panel-button mac-save-panel-cancel"
        >
          {cancelLabel}
        </PushButton>
        <DefaultButton
          disabled={saveDisabled || shownName.trim() === ""}
          onClick={(event) =>
            onSave?.(
              {
                name: shownName,
                tags: showsTagField ? [...shownTags] : [],
                location: shownLocation,
              },
              event,
            )
          }
          className="mac-save-panel-button"
        >
          {prompt}
        </DefaultButton>
      </div>
    </form>
  );
}

const classes = (own: string, given?: string) => (given ? `${own} ${given}` : own);

/* The items of the Where menu: the places, with a separator line where one is asked for. */
function places(locations: readonly OpenPanelLocation[]) {
  return locations.flatMap((place) => [
    place.separatorBefore ? <PopUpButtonSeparator key={`s${place.value}`} /> : null,
    <PopUpButtonItem
      key={`i${place.value}`}
      value={place.value}
      image={place.icon}
      disabled={place.disabled}
    >
      {place.label}
    </PopUpButtonItem>,
  ]);
}

export interface SavePanelRowProps extends ComponentProps<"div"> {
  /** The row's label, right-aligned in the label column: text ending in a colon. */
  label?: ReactNode;
  /** The `id` of the one control the label is for; the label is then a `<label>` for it. */
  labelFor?: string;
  /**
   * An `id` for the label, to name a control that takes no `<label>` with `aria-labelledby`:
   * a pop-up button.
   */
  labelId?: string;
}

/*
 * One row of the Save panel's form: a right-aligned label and its control. The panel's own
 * rows are made of it; give more of them as the panel's `accessory` (a File Format pop-up
 * button), and they line up with the others.
 */
/** One row of the Save panel's form: a right-aligned label and its control. */
export function SavePanelRow({
  label,
  labelFor,
  labelId,
  className,
  children,
  ...props
}: SavePanelRowProps) {
  const hasLabel = label !== undefined && label !== null && label !== false;
  return (
    <div className={classes("mac-save-panel-row", className)} {...props}>
      {hasLabel ? (
        labelFor === undefined ? (
          <span id={labelId} className="mac-save-panel-label">
            {label}
          </span>
        ) : (
          <label id={labelId} htmlFor={labelFor} className="mac-save-panel-label">
            {label}
          </label>
        )
      ) : null}
      <div className="mac-save-panel-control">{children}</div>
    </div>
  );
}
