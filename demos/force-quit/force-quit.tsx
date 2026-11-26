"use client";

import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { DefaultButton } from "macalicious/default-button";
import { Label } from "macalicious/label";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { type ReactNode, useRef, useState } from "react";
import type { DesktopWindowProps } from "../desktop/desktop-apps";
import { AppTile, FinderTile } from "../desktop/desktop-artwork";
import { servedByDesktopApp } from "../desktop/desktop-server";
import {
  buttonTitle,
  confirmationFor,
  confirmationForSeveral,
  defaultApplications,
  type ForceQuitApplication,
  forceQuit,
  NOT_RESPONDING,
  resolveSelection,
} from "./force-quit-data";
import "./force-quit.tokens.css";
import "./force-quit.css";

export interface ForceQuitProps extends Omit<WindowProps, "children"> {
  /**
   * The running applications (controlled): the window asks for an application to go through
   * `onApplicationsChange` and shows what it is given.
   */
  applications?: readonly ForceQuitApplication[];
  /**
   * The applications running at first (uncontrolled): Mail, Safari and Finder, as captured.
   * @default defaultApplications
   */
  defaultApplications?: readonly ForceQuitApplication[];
  /**
   * Id of the application selected at first. Without it, or with an id that names no
   * application, the first one is selected.
   */
  defaultSelectedId?: string;
  /**
   * Called with the application once its force quit, or its relaunch, has been confirmed. A
   * host ends or restarts the application here.
   */
  onForceQuit?: (application: ForceQuitApplication) => void;
  /**
   * Called with the list that is left when a confirmed force quit takes an application out of
   * it. An application that relaunches stays, so its relaunch does not call this.
   */
  onApplicationsChange?: (applications: readonly ForceQuitApplication[]) => void;
  /**
   * The line over the list.
   * @default "If an app doesn’t respond for a while, select its name and click Force Quit."
   */
  instruction?: string;
  /**
   * Draws an application's icon in its row. Without it the row shows a neutral placeholder.
   */
  renderIcon?: (application: ForceQuitApplication) => ReactNode;
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /**
   * For the window controls: disables minimize. The window of macOS cannot be minimized.
   * @default true
   */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /** For the title bar: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: a window manager zooms the window here. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/**
 * The Force Quit Applications window of macOS 10.15: two lines of instruction, the bordered
 * list of the running applications, a hint and the default button. The button, Return and a
 * double click on a row ask in a sheet before the selected application is quit; Finder is
 * relaunched instead and stays in the list. Nothing is quit on the machine: the applications
 * are data, and a host hears about a confirmed force quit through `onForceQuit`.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function ForceQuit({
  applications: applicationsProp,
  defaultApplications: initialApplications = defaultApplications,
  defaultSelectedId,
  onForceQuit,
  onApplicationsChange,
  instruction = "If an app doesn’t respond for a while, select its name and click Force Quit.",
  renderIcon,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled = true,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 338,
  height = 307,
  state: windowState = "key",
  ...windowProps
}: ForceQuitProps) {
  const [ownApplications, setOwnApplications] = useState(initialApplications);
  const applications = applicationsProp ?? ownApplications;
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(
    defaultSelectedId === undefined ? [] : [defaultSelectedId],
  );
  // The list always has a selection: ids that name no application, at first or after the list
  // changed, stand for the first one. Everything below reads this, never the raw ids.
  const listed = applications.filter((application) => selectedIds.includes(application.id));
  const chosen = listed.length > 0 ? listed : applications.slice(0, 1);
  const selected = resolveSelection(applications, chosen[0]?.id);

  // The sheet hangs from the title bar and gives the focus back to the list. `asked` is what it
  // asks about, kept while the sheet slides away.
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const [asked, setAsked] = useState<readonly ForceQuitApplication[]>([]);
  const [asking, setAsking] = useState(false);
  // The applications as the list holds them now. A controlled list can drop them while the sheet
  // is open: when none is left there is nothing to ask about, so the sheet goes and nothing is quit.
  const subjects = applications.filter((application) =>
    asked.some((entry) => entry.id === application.id),
  );
  if (asking && subjects.length === 0) setAsking(false);
  const open = asking && subjects.length > 0;
  const shown = subjects.length > 0 ? subjects : asked;
  const confirmation =
    shown.length > 1
      ? confirmationForSeveral(shown)
      : shown[0]
        ? confirmationFor(shown[0])
        : undefined;

  const ask = (several: readonly ForceQuitApplication[]) => {
    if (several.length === 0) return;
    setAsked(several);
    setAsking(true);
  };
  const confirm = () => {
    let left = applications;
    let nextSelected = selected?.id;
    for (const subject of subjects) {
      const next = forceQuit(left, subject.id, nextSelected);
      left = next.applications;
      nextSelected = next.selectedId;
    }
    setSelectedIds(nextSelected === undefined ? [] : [nextSelected]);
    if (left !== applications) {
      setOwnApplications(left);
      onApplicationsChange?.(left);
    }
    for (const subject of subjects) onForceQuit?.(subject);
  };

  return (
    // While its sheet is open the window is main, not key, and everything in it is held.
    <Window
      width={width}
      height={height}
      state={open && windowState === "key" ? "main" : windowState}
      {...windowProps}
    >
      <TitleBar
        ref={setTitleBar}
        title="Force Quit Applications"
        controls={
          <WindowControls
            closeDisabled={open}
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
      <WindowBody className="mac-force-quit-body" inert={open}>
        <Label render={<p />} className="mac-force-quit-instruction">
          {instruction}
        </Label>
        <BorderedList className="mac-force-quit-list">
          <BorderedListRows
            ref={list}
            aria-label="Applications"
            className="mac-force-quit-rows"
            rowHeight={22}
            selectionMode="multiple"
            value={chosen.map((application) => application.id)}
            onValueChange={(value) => {
              // A click that would clear the selection is ignored.
              if (value.length > 0) setSelectedIds(value);
            }}
            onRowAction={(id) => {
              const application = applications.find((entry) => entry.id === id);
              if (application) ask([application]);
            }}
          >
            {applications.map((application) => (
              <BorderedListRow
                key={application.id}
                value={application.id}
                className="mac-force-quit-row"
                textValue={application.name}
                leading={
                  <span className="mac-force-quit-icon" aria-hidden="true">
                    {renderIcon?.(application)}
                  </span>
                }
                title={
                  application.notResponding ? (
                    <>
                      {application.name}{" "}
                      <span className="mac-force-quit-status">{NOT_RESPONDING}</span>
                    </>
                  ) : (
                    application.name
                  )
                }
              />
            ))}
          </BorderedListRows>
        </BorderedList>
        <div className="mac-force-quit-footer">
          <Label render={<p />} textStyle="mini" className="mac-force-quit-hint">
            You can open this window by pressing Command-Option-Escape.
          </Label>
          <DefaultButton
            className="mac-force-quit-button"
            disabled={!selected}
            onClick={() => ask(chosen)}
          >
            {chosen.length > 1 ? "Force Quit" : buttonTitle(selected)}
          </DefaultButton>
        </div>
      </WindowBody>
      {/* Rendered in a portal, so the window stays the root element. */}
      <Sheet open={open} onOpenChange={setAsking}>
        <SheetPopup anchor={titleBar} width={420} finalFocus={list}>
          <SheetTitle>{confirmation?.title}</SheetTitle>
          {confirmation?.description ? (
            <SheetDescription>{confirmation.description}</SheetDescription>
          ) : null}
          <SheetActions>
            <SheetClose>Cancel</SheetClose>
            <SheetClose render={<DefaultButton />} onClick={confirm}>
              {confirmation?.action}
            </SheetClose>
          </SheetActions>
        </SheetPopup>
      </Sheet>
    </Window>
  );
}

/** On the served desktop every app runs on the page's one thread, so none can be seen to hang alone. */
const SERVED_INSTRUCTION =
  "Select an app’s name and click Force Quit. A web page can’t tell when an app has stopped responding, so none is marked.";

/**
 * Force Quit as a window of the desktop demo: it lists the applications running on the desktop
 * (`runningApplications`) and a confirmed force quit closes every window of the chosen one
 * (`onQuitApplication`). Finder relaunches: its windows close and it stays in the list. Given
 * neither, it shows the captured list, as `ForceQuit` does.
 */
export function DesktopForceQuit({
  runningApplications,
  onQuitApplication,
  DesktopWindow: _window,
  onFrameSizeChange: _frame,
  preferencesOpen: _preferences,
  onPreferencesOpenChange: _preferencesChange,
  settings: _settings,
  ...props
}: DesktopWindowProps) {
  return (
    <ForceQuit
      {...props}
      minimizeDisabled
      applications={runningApplications}
      instruction={servedByDesktopApp() ? SERVED_INSTRUCTION : undefined}
      onForceQuit={(application) => onQuitApplication?.(application.id)}
      renderIcon={(application) =>
        application.relaunches ? (
          <FinderTile />
        ) : (
          <AppTile id={application.id} name={application.name} />
        )
      }
    />
  );
}
