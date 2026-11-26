"use client";

import { ColorWell } from "macalicious/color-well";
import { Label } from "macalicious/label";
import { ListView } from "macalicious/list-view";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { PushButton } from "macalicious/push-button";
import { Stepper } from "macalicious/stepper";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { TextField } from "macalicious/text-field";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { shownColour } from "./terminal-preferences";
import {
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  profileNames,
  type TerminalProfile,
  type TerminalSettings,
} from "./terminal-profiles";
import type { TerminalSession } from "./terminal-shell";

export type InspectorPane = "info" | "settings";

export interface TerminalInspectorProps {
  windowProps: ManagedWindowRenderProps;
  session: TerminalSession;
  settings: TerminalSettings;
  /** The profile the tab was given, and what it shows after the tab's own changes. */
  profileName: string;
  profile: TerminalProfile;
  title: string;
  pane: InspectorPane;
  onPaneChange: (pane: InspectorPane) => void;
  /** Changes with each Edit Title: the field takes the keyboard. */
  focusTitle: number;
  onTitleChange: (title: string) => void;
  onProfileChoose: (name: string) => void;
  onTabChange: (change: Partial<TerminalProfile>) => void;
  onUseAsDefault: () => void;
  onSizeChange: (columns: number, rows: number) => void;
}

/** The Inspector: what the front tab is and how it looks, following the tab in front. */
export function TerminalInspector({
  windowProps,
  session,
  settings,
  profileName,
  profile,
  title,
  pane,
  onPaneChange,
  focusTitle,
  onTitleChange,
  onProfileChoose,
  onTabChange,
  onUseAsDefault,
  onSizeChange,
}: TerminalInspectorProps) {
  const {
    onClose,
    onMinimize,
    onZoom,
    zoomRole,
    minimizeDisabled,
    zoomDisabled,
    onDragRegionPointerDown,
    onDragRegionDoubleClick,
    className,
    ...rest
  } = windowProps;
  const titleField = useRef<HTMLInputElement>(null);
  const subscribe = useCallback((listener: () => void) => session.subscribe(listener), [session]);
  const read = () =>
    `${session.processName}\u0000${session.scope.cwd}\u0000${session.emulator.cols}\u0000${session.emulator.rows}`;
  const [processName, cwd, cols, rows] = useSyncExternalStore(subscribe, read, read).split(
    "\u0000",
  ) as [string, string, string, string];
  const columns = Number(cols);
  const lines = Number(rows);
  const names = profileNames(settings);

  useEffect(() => {
    if (focusTitle > 0) {
      titleField.current?.focus();
      titleField.current?.select();
    }
  }, [focusTitle]);

  return (
    <Window
      {...rest}
      className={className ? `mac-terminal-inspector ${className}` : "mac-terminal-inspector"}
    >
      <TitleBar
        title="Inspector"
        controls={
          <WindowControls
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
      <WindowBody className="mac-terminal-inspector-body">
        <TabView value={pane} onValueChange={(value) => onPaneChange(value as InspectorPane)}>
          <TabViewList aria-label="Inspector">
            <TabViewTab value="info">Info</TabViewTab>
            <TabViewTab value="settings">Profile</TabViewTab>
          </TabViewList>
          <TabViewPanel value="info" keepMounted>
            <div className="mac-terminal-sheet-rows">
              <Label>Title:</Label>
              <TextField
                inputRef={titleField}
                aria-label="Title"
                value={title}
                placeholder={profile.windowTitle}
                onChange={(event) => onTitleChange(event.currentTarget.value)}
              />
              <Label>Processes:</Label>
              <ul aria-label="Processes" className="mac-terminal-processes">
                <li>zsh</li>
                {processName !== "zsh" ? <li>{processName}</li> : null}
              </ul>
              <Label>Working directory:</Label>
              <Label textStyle="small">{cwd}</Label>
              <div className="mac-terminal-size-row">
                <Label>Columns: {columns}</Label>
                <Stepper
                  aria-label="Columns"
                  min={20}
                  max={400}
                  value={columns}
                  onValueChange={(next) => onSizeChange(next, lines)}
                />
                <Label>Rows: {lines}</Label>
                <Stepper
                  aria-label="Rows"
                  min={2}
                  max={200}
                  value={lines}
                  onValueChange={(next) => onSizeChange(columns, next)}
                />
              </div>
            </div>
          </TabViewPanel>
          <TabViewPanel value="settings" keepMounted>
            <div className="mac-terminal-sheet-rows">
              <ListView
                aria-label="Profile of this tab"
                count={names.length}
                rowHeight={20}
                style={{ height: 160 }}
                value={[profileName]}
                getRowId={(index) => names[index] as string}
                getRowLabel={(index) => names[index] as string}
                renderRow={(index) => names[index]}
                onValueChange={(value) => {
                  const next = value[0];
                  if (typeof next === "string") onProfileChoose(next);
                }}
              />
              <div className="mac-terminal-size-row">
                <Label>Background:</Label>
                <ColorWell
                  aria-label="Background"
                  value={shownColour(profile.background, "#1e1e1e", "#ffffff")}
                  onChange={(event) => onTabChange({ background: event.currentTarget.value })}
                />
                <Label>Text:</Label>
                <ColorWell
                  aria-label="Text"
                  value={shownColour(profile.foreground, "#ffffff", "#000000")}
                  onChange={(event) => onTabChange({ foreground: event.currentTarget.value })}
                />
              </div>
              <div className="mac-terminal-size-row">
                <Label>Font size: {profile.fontSize}</Label>
                <Stepper
                  aria-label="Font size"
                  min={MIN_FONT_SIZE}
                  max={MAX_FONT_SIZE}
                  value={profile.fontSize}
                  onValueChange={(fontSize) => onTabChange({ fontSize })}
                />
              </div>
              <PushButton size="small" onClick={onUseAsDefault}>
                Use Settings as Default
              </PushButton>
            </div>
          </TabViewPanel>
        </TabView>
      </WindowBody>
    </Window>
  );
}
