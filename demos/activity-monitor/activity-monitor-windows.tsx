"use client";

import { Label } from "macalicious/label";
import { LevelIndicator } from "macalicious/level-indicator";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { PushButton } from "macalicious/push-button";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import type { ReactNode } from "react";
import { Graph, Statistics } from "./activity-monitor";
import type { ActivityMonitorSample } from "./activity-monitor-data";

/** One small window of the served Activity Monitor, as the desktop hands its props over. */
function Panel({
  title,
  windowProps,
  children,
}: {
  title: string;
  windowProps: ManagedWindowRenderProps;
  children: ReactNode;
}) {
  const {
    onClose,
    onMinimize,
    onZoom,
    zoomRole,
    minimizeDisabled,
    zoomDisabled,
    onDragRegionPointerDown,
    onDragRegionDoubleClick,
    ...rest
  } = windowProps;
  return (
    <Window {...rest}>
      <TitleBar
        title={title}
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
      <WindowBody className="mac-activity-monitor-panel">{children}</WindowBody>
    </Window>
  );
}

/** What the inspector shows of one application: what the desktop and the server count. */
export interface InspectedFacts {
  name: string;
  lines: readonly { label: string; value: string }[];
}

export function InspectorPanel({
  facts,
  canQuit,
  onQuit,
  windowProps,
}: {
  facts: InspectedFacts;
  canQuit: boolean;
  onQuit: () => void;
  windowProps: ManagedWindowRenderProps;
}) {
  return (
    <Panel title={facts.name} windowProps={windowProps}>
      <Statistics lines={facts.lines} />
      <Label textStyle="small">
        A web page is shown no process id, memory, open files or statistics of an application, so it
        can’t sample one either. These are what this desktop counts.
      </Label>
      <PushButton disabled={!canQuit} onClick={onQuit}>
        Quit
      </PushButton>
    </Panel>
  );
}

export function CpuUsagePanel({
  busy,
  windowProps,
}: {
  busy: number | null;
  windowProps: ManagedWindowRenderProps;
}) {
  return (
    <Panel title="CPU Usage" windowProps={windowProps}>
      <LevelIndicator aria-label="This page's main thread, busy" value={busy ?? 0} />
      <Label textStyle="small">
        {busy === null ? "Measuring…" : `This page’s main thread: ${busy.toFixed(1)}% busy`}
      </Label>
    </Panel>
  );
}

export function CpuHistoryPanel({
  history,
  windowProps,
}: {
  history: readonly ActivityMonitorSample[];
  windowProps: ManagedWindowRenderProps;
}) {
  return (
    <Panel title="CPU History" windowProps={windowProps}>
      <Graph
        history={history}
        tab="cpu"
        maximum={100}
        label="How busy this page's main thread was, every second"
      />
      <Label textStyle="small">This page’s main thread, every second.</Label>
    </Panel>
  );
}
