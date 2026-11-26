"use client";

import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { useManagedWindow } from "macalicious/managed-window";
import { SavePanelRow } from "macalicious/save-panel";
import { TextField } from "macalicious/text-field";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useWindowManagerStore, type WindowFrame } from "macalicious/window-manager";
import {
  use,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { DesktopSecondaryWindow, DesktopWindowHostContext } from "../desktop/desktop-windows";
import { whenMenusClosed } from "../notes/notes-menus";
import { MOST_PROPERTY_CHARS, PROPERTY_FIELDS, type TextEditProperties } from "./textedit-data";

/*
 * File > Show Properties: one floating panel that shows the document in front. Whether it is shown
 * and where it stands belong to the app, not to a window: each document window renders the panel
 * while it is the front one, so the panel goes over to whichever window comes to the front.
 */

const listeners = new Set<() => void>();
let shown = false;
let asked = false;
let place: WindowFrame | undefined;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function setShown(next: boolean) {
  shown = next;
  asked = next;
  for (const listener of listeners) listener();
}

/** Whether Show Properties has the panel up. */
export const usePropertiesShown = () =>
  useSyncExternalStore(
    subscribe,
    () => shown,
    () => false,
  );

/** File > Show Properties and Hide Properties. */
export const toggleProperties = () => setShown(!shown);

/** The panel's own close button. */
export const hideProperties = () => setShown(false);

/** Keeps where the panel stands, for the panel that opens next. */
function PanelPlace() {
  const store = useWindowManagerStore();
  const { id } = useManagedWindow();
  useLayoutEffect(
    () =>
      store.subscribe(() => {
        place = store.get(id)?.frame ?? place;
      }),
    [store, id],
  );
  return null;
}

function PropertyFields({
  value,
  disabled,
  onChange,
  onHide,
}: {
  value: TextEditProperties | undefined;
  disabled: boolean;
  onChange: (properties: TextEditProperties) => void;
  onHide: () => void;
}) {
  // Its own copy: the document keeps them cleaned, and a space typed between two words is not yet.
  const [fields, setFields] = useState<TextEditProperties>(value ?? {});
  const id = useId();
  const [focusFirst] = useState(asked);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the panel's key equivalent, from any field
    <div
      className="mac-save-panel-form mac-textedit-properties"
      inert={disabled || undefined}
      onKeyDown={(event) => {
        if (matchesMenuKeyEquivalent(event.nativeEvent, "option+command+p")) {
          event.preventDefault();
          onHide();
        }
      }}
    >
      {PROPERTY_FIELDS.map(({ key, label }, at) => (
        <SavePanelRow key={key} label={label} labelFor={`${id}-${key}`}>
          <TextField
            id={`${id}-${key}`}
            autoFocus={focusFirst && at === 0}
            maxLength={MOST_PROPERTY_CHARS}
            value={fields[key] ?? ""}
            onValueChange={(text) => {
              const next = { ...fields, [key]: text };
              setFields(next);
              onChange(next);
            }}
            style={{ width: 240 }}
          />
        </SavePanelRow>
      ))}
    </div>
  );
}

/** The panel, for the document in the window `documentWindow`. `document` tells one document from the next. */
export function TextEditPropertiesPanel({
  documentWindow,
  document,
  value,
  disabled,
  onChange,
  onHide,
}: {
  documentWindow: string;
  document: string;
  value: TextEditProperties | undefined;
  /** While a sheet is on the document. */
  disabled: boolean;
  /** Each change, as it is typed. */
  onChange: (properties: TextEditProperties) => void;
  onHide: () => void;
}) {
  const store = useWindowManagerStore();
  const host = use(DesktopWindowHostContext);
  const standing = useMemo(
    () =>
      host && {
        ...host,
        place: (...at: Parameters<typeof host.place>) => place ?? host.place(...at),
      },
    [host],
  );
  // A parent's effect runs after the managed window's and the secondary window's, whose registering
  // makes the panel key and, with a menu closing (File > New), makes it key again once it has. A
  // person's Show Properties leaves the keyboard in it; a panel that came along with a window brought
  // to the front gives that window the keyboard back, last of all.
  // biome-ignore lint/correctness/useExhaustiveDependencies: as the panel opens, once
  useEffect(() => {
    if (asked) {
      asked = false;
      return;
    }
    let open = true;
    store.focus(documentWindow);
    whenMenusClosed(globalThis.document, () => {
      if (open) store.focus(documentWindow);
    });
    return () => {
      open = false;
    };
  }, []);
  return (
    <DesktopWindowHostContext value={standing}>
      <DesktopSecondaryWindow
        id={`properties-${documentWindow}`}
        title="Document Properties"
        panel
        resizable={false}
        fitsContent
        defaultSize={{ width: 380, height: 240 }}
        onClose={onHide}
        render={({
          onClose,
          onMinimize,
          onZoom,
          zoomRole,
          minimizeDisabled,
          zoomDisabled,
          onDragRegionPointerDown,
          onDragRegionDoubleClick,
          variant: _variant,
          fullScreen: _fullScreen,
          height: _height,
          ...windowProps
        }) => (
          <Window {...windowProps} variant="panel" role="dialog" aria-label="Document Properties">
            <PanelPlace />
            <TitleBar
              variant="utility"
              title="Document Properties"
              controls={
                <WindowControls
                  size="small"
                  onClose={onClose}
                  onMinimize={onMinimize}
                  onZoom={onZoom}
                  zoomRole={zoomRole}
                  minimizeDisabled={minimizeDisabled}
                  zoomDisabled={zoomDisabled}
                />
              }
              onDragRegionPointerDown={onDragRegionPointerDown}
              onDragRegionDoubleClick={onDragRegionDoubleClick}
            />
            <WindowBody>
              <PropertyFields
                key={document}
                value={value}
                disabled={disabled}
                onChange={onChange}
                onHide={onHide}
              />
            </WindowBody>
          </Window>
        )}
      />
    </DesktopWindowHostContext>
  );
}
