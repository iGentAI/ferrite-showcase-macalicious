"use client";

import {
  AssistantWindow,
  AssistantWindowActions,
  AssistantWindowContent,
  AssistantWindowHeading,
  type AssistantWindowProps,
  AssistantWindowText,
} from "macalicious/assistant-window";
import { Checkbox } from "macalicious/checkbox";
import { Label } from "macalicious/label";
import { ProgressBar } from "macalicious/progress-bar";
import { PushButton } from "macalicious/push-button";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { Slider } from "macalicious/slider";
import type { TitleBarProps } from "macalicious/title-bar";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { type MouseEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react";
import { AssistantArtwork } from "./boot-camp-assistant-artwork";
import "./boot-camp-assistant.tokens.css";
import "./boot-camp-assistant.css";

/** The steps, in order. Only the first is in the reference captures. */
export const STEPS = ["introduction", "tasks", "partition", "installing", "finished"] as const;
export type BootCampStep = (typeof STEPS)[number];

const HEADINGS: Record<BootCampStep, string> = {
  introduction: "Introduction",
  tasks: "Select Tasks",
  partition: "Create a Partition for Windows",
  installing: "Installing",
  finished: "Finished",
};

/** The tasks of the second step; all three are chosen at first. */
const TASKS = [
  ["disk", "Create a Windows install disk"],
  ["software", "Download the latest Windows support software from Apple"],
  ["install", "Install Windows"],
] as const;
type Task = (typeof TASKS)[number][0];

/** The demo's disk, in gigabytes, and the least each system keeps of it. */
const DISK = 251;
const WINDOWS_MIN = 42;
const MACOS_MIN = 80;

/** The installation: a part of its length every tick, so that it takes five seconds. */
const TICK = 100;
const PART = 2;

/**
 * Measured: the help button's bezel is 164 pt wide. A least width, not a width: off Apple
 * devices the fallback font needs a little more for the title, and it is never cut.
 */
const HELP_BUTTON = { minWidth: 164 };

export interface BootCampAssistantProps
  extends Omit<
    AssistantWindowProps,
    "title" | "artwork" | "controls" | "children" | "onCancel" | "onClose"
  > {
  /**
   * The step the assistant opens on.
   * @default "introduction"
   */
  defaultStep?: BootCampStep;
  /** For the window controls, and for Quit on the last step: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** Taken so that a window manager's props can be spread; the assistant does not zoom. */
  onZoom?: WindowControlsProps["onZoom"];
  /** Taken so that a window manager's props can be spread; the green button stays unavailable. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize. */
  minimizeDisabled?: boolean;
  /** Taken so that a window manager's props can be spread; zoom is always unavailable. */
  zoomDisabled?: boolean;
  /**
   * Called when the primary pointer button goes down on the title bar itself, not on a window
   * control. A window manager starts moving the window here.
   */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** Called when the title bar itself is double-clicked. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/**
 * Boot Camp Assistant, as in macOS 10.15 Catalina: a fixed window that walks through a task
 * one step at a time, on the library's `AssistantWindow`.
 *
 * The root is that window, which is a `Window` and takes every prop that is not listed here, so
 * a page or a window manager places it (`style`, `ref`) and tells it whether it is key
 * (`state`). The eight props a managed window's `render` supplies beside the window's are
 * taken too: close and minimize go to the window controls, and the three about zoom are
 * accepted and not used, because an assistant has one size. The two drag-region callbacks are
 * called for the assistant window's title bar, which says what a press on the bar itself is,
 * once the window's own `onPointerDown` or `onDoubleClick` has run: a handler there that calls
 * `preventDefault` cancels them.
 *
 * Nothing is downloaded, partitioned or installed: the steps keep what is chosen in them for as
 * long as the component is mounted, and the installation is a timer.
 */
export function BootCampAssistant({
  defaultStep = "introduction",
  onClose,
  onMinimize,
  onZoom: _onZoom,
  zoomRole: _zoomRole,
  minimizeDisabled,
  zoomDisabled: _zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  state = "key",
  className,
  onPointerDown,
  onDoubleClick,
  ...windowProps
}: BootCampAssistantProps) {
  const id = useId();
  // The event the title bar reported as a press or a double click on itself. The bar is inside
  // the window and hears the event first; its report waits here for the window's own handler,
  // which may cancel it.
  const onBar = useRef<Event | null>(null);
  const [step, setStep] = useState<BootCampStep>(defaultStep);
  const [tasks, setTasks] = useState<readonly Task[]>(TASKS.map(([task]) => task));
  const [windows, setWindows] = useState(WINDOWS_MIN);
  const [progress, setProgress] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  // The sheet hangs from this line, under the title bar.
  const [sheetAnchor, setSheetAnchor] = useState<HTMLDivElement | null>(null);

  const at = STEPS.indexOf(step);
  const installing = step === "installing";

  // The installation is a clock: it runs while its step is shown and ends on the last step.
  useEffect(() => {
    if (!installing) return;
    const timer = setInterval(() => setProgress((done) => Math.min(100, done + PART)), TICK);
    return () => clearInterval(timer);
  }, [installing]);
  useEffect(() => {
    if (installing && progress >= 100) setStep("finished");
  }, [installing, progress]);

  const go = (to: BootCampStep) => {
    if (to === "installing") setProgress(0);
    setStep(to);
  };
  // Going back from the last step, or from the installation, returns to what can be changed.
  const back = () => {
    if (at > 0) go(at >= 3 ? "partition" : (STEPS[at - 1] as BootCampStep));
  };
  const next = () => go(STEPS[at + 1] as BootCampStep);

  const heading = `${id}heading`;
  const macos = DISK - windows;

  return (
    <AssistantWindow
      {...windowProps}
      title="Boot Camp Assistant"
      // A window is main, not key, while its sheet is open.
      state={helpOpen && state === "key" ? "main" : state}
      className={className ? `mac-boot-camp-assistant ${className}` : "mac-boot-camp-assistant"}
      artwork={<AssistantArtwork />}
      controls={
        <WindowControls
          zoomRole="zoom"
          zoomDisabled
          onClose={onClose}
          onMinimize={onMinimize}
          minimizeDisabled={minimizeDisabled}
        />
      }
      // Escape goes back a step, as in every assistant; the sheet takes its own Escape.
      onCancel={installing ? undefined : back}
      onDragRegionPointerDown={(event) => {
        onBar.current = event.nativeEvent;
      }}
      onDragRegionDoubleClick={(event) => {
        onBar.current = event.nativeEvent;
      }}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        const reported = onBar.current === event.nativeEvent;
        onBar.current = null;
        onPointerDown?.(event);
        if (reported && !event.defaultPrevented) onDragRegionPointerDown?.(event);
      }}
      onDoubleClick={(event: MouseEvent<HTMLDivElement>) => {
        const reported = onBar.current === event.nativeEvent;
        onBar.current = null;
        onDoubleClick?.(event);
        if (reported && !event.defaultPrevented) onDragRegionDoubleClick?.(event);
      }}
    >
      <div className="mac-boot-camp-assistant-step" inert={helpOpen}>
        <AssistantWindowHeading id={heading}>{HEADINGS[step]}</AssistantWindowHeading>
        {step === "introduction" ? (
          <AssistantWindowText aria-labelledby={heading}>
            <p>
              Boot Camp Assistant helps install Microsoft Windows on an Intel-based Mac by
              downloading the necessary support software, creating a partition on your disk for
              Windows, and then starting the Windows installer. Please click the Open Boot Camp Help
              button for instructions to finish installing Windows and the support software you
              downloaded.
            </p>
            <p>
              IMPORTANT: Back up your disk before partitioning it or installing Windows. If you have
              a portable computer, make sure the power adapter is connected.
            </p>
          </AssistantWindowText>
        ) : step === "tasks" ? (
          <AssistantWindowContent className="mac-boot-camp-assistant-tasks">
            <Label id={`${id}tasks`}>Select all tasks you want to perform:</Label>
            {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and a border to three checkboxes */}
            <div
              role="group"
              aria-labelledby={`${id}tasks`}
              className="mac-boot-camp-assistant-choices"
            >
              {TASKS.map(([task, title]) => (
                <Checkbox
                  key={task}
                  checked={tasks.includes(task)}
                  onCheckedChange={(checked) =>
                    setTasks(checked ? [...tasks, task] : tasks.filter((other) => other !== task))
                  }
                >
                  {title}
                </Checkbox>
              ))}
            </div>
          </AssistantWindowContent>
        ) : step === "partition" ? (
          <AssistantWindowContent className="mac-boot-camp-assistant-partition">
            <Label id={`${id}partition`}>
              Drag the slider to set the size of the Windows partition. The disk holds {DISK} GB.
            </Label>
            <Slider
              aria-labelledby={`${id}partition`}
              min={WINDOWS_MIN}
              max={DISK - MACOS_MIN}
              step={1}
              value={windows}
              onValueChange={(value) => setWindows(value as number)}
              getAriaValueText={(_formatted, value) =>
                `Windows ${value} GB, macOS ${DISK - value} GB`
              }
            />
            <p className="mac-boot-camp-assistant-sizes">
              <span>Windows: {windows} GB</span>
              <span>macOS: {macos} GB</span>
            </p>
          </AssistantWindowContent>
        ) : installing ? (
          <AssistantWindowContent className="mac-boot-camp-assistant-progress">
            <Label id={`${id}progress`}>
              {progress < 40
                ? "Downloading Windows support software…"
                : progress < 70
                  ? "Partitioning disk…"
                  : "Copying Windows files…"}
            </Label>
            <ProgressBar aria-labelledby={`${id}progress`} value={progress} />
          </AssistantWindowContent>
        ) : (
          <AssistantWindowText aria-labelledby={heading}>
            <p>
              The assistant has gone through its steps: a Windows partition of {windows} GB and{" "}
              {tasks.length === 1 ? "one task" : `${tasks.length} tasks`}.
            </p>
            <p>
              This is a demonstration. Nothing was downloaded, no disk was partitioned and nothing
              was installed.
            </p>
          </AssistantWindowText>
        )}
        <AssistantWindowActions
          leading={
            <PushButton style={HELP_BUTTON} onClick={() => setHelpOpen(true)}>
              Open Boot Camp Help
            </PushButton>
          }
        >
          {at > 0 ? (
            <PushButton disabled={installing} onClick={back}>
              Go Back
            </PushButton>
          ) : null}
          {step === "finished" ? (
            <PushButton onClick={onClose}>Quit</PushButton>
          ) : installing ? (
            <PushButton onClick={() => go("partition")}>Stop</PushButton>
          ) : step === "partition" ? (
            <PushButton onClick={next}>Install</PushButton>
          ) : (
            <PushButton disabled={step === "tasks" && tasks.length === 0} onClick={next}>
              Continue
            </PushButton>
          )}
        </AssistantWindowActions>
      </div>
      <div ref={setSheetAnchor} className="mac-boot-camp-assistant-sheet-anchor" />
      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetPopup anchor={sheetAnchor} width={420}>
          <SheetTitle>Boot Camp Help</SheetTitle>
          <SheetDescription>
            Boot Camp Assistant would open its pages in Help Viewer. The demo has none: follow the
            steps with Continue, and go back with Go Back or Escape.
          </SheetDescription>
          <SheetActions>
            <SheetClose>OK</SheetClose>
          </SheetActions>
        </SheetPopup>
      </Sheet>
    </AssistantWindow>
  );
}
