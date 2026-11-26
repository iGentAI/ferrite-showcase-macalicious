"use client";

import {
  CatalystChrome,
  type CatalystChromeProps,
  CatalystSidebar,
} from "macalicious/catalyst-chrome";
import { EmptyState } from "macalicious/empty-state";
import {
  ListView,
  ListViewRowDetail,
  ListViewRowTitle,
  ListViewRowTrailing,
} from "macalicious/list-view";
import { SearchField } from "macalicious/search-field";
import { TextField } from "macalicious/text-field";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton, type ToolbarButtonProps } from "macalicious/toolbar-button";
import { WaveformView, WaveformViewDetail, WaveformViewOverview } from "macalicious/waveform-view";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type KeyboardEventHandler,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  defaultRecordingId as capturedRecordingId,
  defaultRecordings as capturedRecordings,
  extend,
  formatClock,
  formatTimer,
  MAX_DURATION,
  newRecording,
  type VoiceMemosRecording,
} from "./voice-memos-data";
import { PauseGlyph, PlayGlyph, RecordPauseGlyph, SkipGlyph, TrimGlyph } from "./voice-memos-icons";
import "./voice-memos.tokens.css";
import "./voice-memos.css";

/** The two views: one recording over the whole window, or the list beside the player. */
export type VoiceMemosView = "editor" | "library";

/**
 * What the app is doing. `"held"` is the moment of the reference captures, a take 3 s in
 * that waits: it looks like `"recording"`, and no time passes until something is pressed.
 */
type Activity = "held" | "recording" | "playing" | "idle";

interface State {
  recordings: readonly VoiceMemosRecording[];
  /** The recording shown; none only when there are no recordings. */
  selectedId: string | undefined;
  view: VoiceMemosView;
  activity: Activity;
  /** Seconds from the start of the recording shown. */
  position: number;
}

type Action =
  | { type: "select"; id: string }
  | { type: "seek"; position: number }
  | { type: "skip"; seconds: number }
  | { type: "play" }
  | { type: "record" }
  | { type: "tick"; seconds: number }
  | { type: "done" }
  | { type: "edit" }
  | { type: "new" };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const shown = (state: State) =>
  state.recordings.find((recording) => recording.id === state.selectedId);

/** Moves the position by hand: a take that is being made stops, playback goes on from there. */
function moveTo(state: State, to: number): State {
  const duration = shown(state)?.duration ?? 0;
  const position = clamp(to, 0, duration);
  const playing = state.activity === "playing" && position < duration;
  return { ...state, position, activity: playing ? "playing" : "idle" };
}

function reduce(state: State, action: Action): State {
  const current = shown(state);
  if (action.type === "select") {
    return state.recordings.some((recording) => recording.id === action.id) &&
      action.id !== state.selectedId
      ? { ...state, selectedId: action.id, position: 0, activity: "idle" }
      : state;
  }
  if (action.type === "new") {
    const take = newRecording(state.recordings);
    return {
      recordings: [take, ...state.recordings],
      selectedId: take.id,
      view: "editor",
      activity: "recording",
      position: take.duration,
    };
  }
  if (!current) return state;
  switch (action.type) {
    case "seek":
      return moveTo(state, action.position);
    case "skip":
      return moveTo(state, state.position + action.seconds);
    case "play":
      if (state.activity === "playing") return { ...state, activity: "idle" };
      if (current.duration <= 0) return state;
      // From the end, where a take leaves the playhead, playback starts over.
      return {
        ...state,
        activity: "playing",
        position: state.position >= current.duration ? 0 : state.position,
      };
    case "record":
      if (state.activity === "held" || state.activity === "recording") {
        return { ...state, activity: "idle" };
      }
      // A take continues at the end of what is recorded, wherever the playhead was.
      return current.duration >= MAX_DURATION
        ? state
        : { ...state, activity: "recording", position: current.duration };
    case "tick": {
      if (state.activity === "playing") {
        const position = state.position + action.seconds;
        return position >= current.duration
          ? { ...state, position: current.duration, activity: "idle" }
          : { ...state, position };
      }
      if (state.activity !== "recording") return state;
      const longer = extend(current, action.seconds);
      return {
        ...state,
        recordings: state.recordings.map((recording) =>
          recording === current ? longer : recording,
        ),
        position: longer.duration,
        activity: longer.duration >= MAX_DURATION ? "idle" : "recording",
      };
    }
    case "done":
      return { ...state, view: "library", activity: "idle" };
    case "edit":
      return { ...state, view: "editor", activity: "idle" };
  }
}

/**
 * Measured: the Trim button's bezel is 39 pt wide and ends 7.5 pt from the window's trailing
 * edge. The toolbar button draws the bezel's outline around its box, half a point outside it,
 * so the box is 38 pt, half a point further in than the chrome puts its last item.
 */
const TRIM_BUTTON: CSSProperties = { width: 38, padding: 0, marginInlineEnd: 0.5 };

/** Seconds the overview's strip stands for when the recording is shorter (fitted, see the page). */
export const OVERVIEW_SPAN = 20;

/** Width of the list of recordings, in points. Provisional: no capture shows it. */
export const SIDEBAR_WIDTH = 250;

/** The props of the window and of the parts a window manager hands it. */
export interface VoiceMemosWindowProps extends Omit<WindowProps, "children" | "title"> {
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /**
   * For the toolbar row, which is this window's drag region: called when the primary pointer
   * button goes down on the bar itself, not on a control in it. A window manager starts moving
   * the window here.
   */
  onDragRegionPointerDown?: CatalystChromeProps["onDragRegionPointerDown"];
  /** For the toolbar row: called when the bar itself is double-clicked. */
  onDragRegionDoubleClick?: CatalystChromeProps["onDragRegionDoubleClick"];
}

export interface VoiceMemosFrameProps extends VoiceMemosWindowProps {
  /** The window's title, in the toolbar row: the recording shown, or the app's name. */
  title: string;
  /** The toolbar's content, a `Toolbar`. */
  toolbar: ReactNode;
  /** The list of recordings beside the player, a `CatalystSidebar`; none in the editing view. */
  sidebar?: ReactNode;
  /** The player: the waveform, the timer and the bottom bar, on black. */
  children?: ReactNode;
}

/**
 * The window of Voice Memos without its content: the library's `Window` with the Catalyst chrome
 * over black content, the window controls and the toolbar row, which is the drag region. The
 * demo and the app on the desktop (`VoiceMemosApp`) both fill it.
 */
export function VoiceMemosFrame({
  title,
  toolbar,
  sidebar,
  children,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 789,
  height = 630,
  className,
  ...windowProps
}: VoiceMemosFrameProps) {
  return (
    <Window
      {...windowProps}
      width={width}
      height={height}
      className={className ? `mac-voice-memos ${className}` : "mac-voice-memos"}
    >
      <CatalystChrome
        underToolbar
        title={title}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
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
        toolbar={toolbar}
        sidebar={sidebar}
      >
        <div className="mac-voice-memos-player">{children}</div>
      </CatalystChrome>
    </Window>
  );
}

/** The Trim button of the editing view's toolbar, the crop glyph in its measured bezel. */
export function VoiceMemosTrimButton(props: Omit<ToolbarButtonProps, "children">) {
  return (
    <ToolbarButton aria-label="Trim" style={TRIM_BUTTON} {...props}>
      <TrimGlyph />
    </ToolbarButton>
  );
}

/** A recording as the list shows it. */
export interface VoiceMemosListItem {
  id: string;
  title: string;
  /** When it was made, as the list writes it. */
  date: string;
  /**
   * Written where the date goes instead, for a recording that is not saved yet ("Not saved",
   * "Saving…"). Absent for a saved recording.
   */
  status?: string;
  /** Length in seconds; not known yet when absent. */
  duration?: number;
}

export interface VoiceMemosLibraryProps {
  /** The recordings, newest first. */
  recordings: readonly VoiceMemosListItem[];
  /** The search field's text: the list keeps the rows whose title contains it. */
  query: string;
  onQueryChange: (query: string) => void;
  /** The recording shown in the player. */
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /**
   * The rows chosen together, when the list takes several (Command-click, Shift-click). Without
   * `onSelectionChange` the list chooses one row, `selectedId`.
   */
  selection?: readonly string[];
  /** Called with the chosen rows, in place of `onSelect`. */
  onSelectionChange?: (ids: readonly string[]) => void;
  /** Called for a row on a double click, and on Return for the current row. */
  onRowAction: (id: string) => void;
  /** Called for the row a contextual menu opens on, before it opens. */
  onRowMenu?: (id: string) => void;
  /** Called by the round button under the list. */
  onNew: () => void;
  /**
   * Makes the round button unavailable, while a recording cannot be started.
   * @default false
   */
  newDisabled?: boolean;
  /**
   * What the list says when there are no recordings at all.
   * @default "No Recordings"
   */
  emptyText?: string;
  /** Called for a key pressed in the list, before the list's own keys. */
  onListKeyDown?: KeyboardEventHandler<HTMLElement>;
  /** What stands between the list and the round button: the row of another list of recordings. */
  footer?: ReactNode;
  /** The row whose title is a field, being renamed. */
  renamingId?: string;
  /** The field is done: its text on Return or on leaving it, `null` on Escape. */
  onRenameEnd?: (title: string | null) => void;
  /** A press on a row, which may become a drag. */
  onRowPress?: (down: PointerEvent, id: string) => void;
}

/** The title of a row being renamed, as a field that holds the title, selected. */
function RowTitleField({ title, onEnd }: { title: string; onEnd: (title: string | null) => void }) {
  const [text, setText] = useState(title);
  const input = useRef<HTMLInputElement>(null);
  const ended = useRef(false);
  const end = (result: string | null) => {
    if (ended.current) return;
    ended.current = true;
    onEnd(result);
  };
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  return (
    <TextField
      className="mac-voice-memos-row-field"
      size="small"
      aria-label="Recording name"
      inputRef={input}
      value={text}
      onValueChange={setText}
      onBlur={() => end(text)}
      onKeyDown={(event) => {
        // The keys are the field's, not the list's (Delete) or the window's (Space).
        event.stopPropagation();
        if (event.key !== "Enter" && event.key !== "Escape") return;
        event.preventDefault();
        end(event.key === "Enter" ? text : null);
        event.currentTarget.closest<HTMLElement>('[role="listbox"]')?.focus();
      }}
    />
  );
}

/** The recordings a search of `query` lists, by their titles. */
export function recordingsMatching<T extends { title: string }>(
  recordings: readonly T[],
  query: string,
): readonly T[] {
  const needle = query.trim().toLowerCase();
  return needle
    ? recordings.filter((candidate) => candidate.title.toLowerCase().includes(needle))
    : recordings;
}

/**
 * The column of the list view, for a `CatalystSidebar`: the search field, the recordings with a
 * title, a date and a length to a row, and the round button that starts a recording.
 */
export function VoiceMemosLibrary({
  recordings,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  selection,
  onSelectionChange,
  onRowAction,
  onRowMenu,
  onNew,
  newDisabled = false,
  emptyText = "No Recordings",
  onListKeyDown,
  footer,
  renamingId,
  onRenameEnd,
  onRowPress,
}: VoiceMemosLibraryProps) {
  // Kept while the recordings and the search are the same, so that the rows, which are
  // memoised on `renderRow`, are not rendered again by every frame of playback.
  const listed = useMemo(() => recordingsMatching(recordings, query), [recordings, query]);
  const renderRow = useCallback(
    (index: number) => {
      const row = listed[index];
      return row ? (
        <>
          {row.id === renamingId && onRenameEnd ? (
            <RowTitleField title={row.title} onEnd={onRenameEnd} />
          ) : (
            <ListViewRowTitle>{row.title}</ListViewRowTitle>
          )}
          <ListViewRowDetail>{row.status ?? row.date}</ListViewRowDetail>
          <ListViewRowTrailing className="mac-voice-memos-length">
            {row.duration === undefined ? "--:--" : formatClock(row.duration)}
          </ListViewRowTrailing>
        </>
      ) : null;
    },
    [listed, renamingId, onRenameEnd],
  );
  return (
    <div className="mac-voice-memos-library">
      <SearchField
        variant="sidebar"
        aria-label="Search recordings"
        value={query}
        onValueChange={(next) => onQueryChange(next)}
        className="mac-voice-memos-search"
      />
      {listed.length > 0 ? (
        <ListView
          aria-label="Recordings"
          className="mac-voice-memos-list"
          count={listed.length}
          rowHeight={48}
          separator="inset"
          separatorInset={14}
          renderRow={renderRow}
          getRowId={(index) => listed[index]?.id ?? index}
          getRowLabel={(index) => listed[index]?.title ?? ""}
          selectionMode={onSelectionChange ? "multiple" : "single"}
          value={selection ? [...selection] : selectedId === undefined ? [] : [selectedId]}
          onValueChange={(ids) => {
            if (onSelectionChange) onSelectionChange(ids.map(String));
            else if (typeof ids[0] === "string") onSelect(ids[0]);
          }}
          onRowAction={(index) => {
            const row = listed[index];
            if (row) onRowAction(row.id);
          }}
          onKeyDown={onListKeyDown}
          onPointerDown={(event) => {
            const target = event.target as HTMLElement;
            if (event.button !== 0 || target.closest("input, button")) return;
            const at = target.closest("[data-index]")?.getAttribute("data-index");
            const row = at == null ? undefined : listed[Number(at)];
            if (row) onRowPress?.(event.nativeEvent, row.id);
          }}
          onContextMenuCapture={(event) => {
            const at = (event.target as HTMLElement)
              .closest("[data-index]")
              ?.getAttribute("data-index");
            const row = at == null ? undefined : listed[Number(at)];
            if (row) onRowMenu?.(row.id);
          }}
        />
      ) : (
        <EmptyState role="status" className="mac-voice-memos-list">
          {recordings.length > 0 ? "No Results" : emptyText}
        </EmptyState>
      )}
      {footer}
      <div className="mac-voice-memos-new">
        <button
          type="button"
          className="mac-voice-memos-record"
          aria-label="New Recording"
          disabled={newDisabled || undefined}
          onClick={onNew}
        />
      </div>
    </div>
  );
}

/** The waveform's points to a second, as the reference captures show it. */
const DETAIL_SCALE = 77;
/** How far a pinch zooms the waveform out and in, in points to a second. */
const MIN_DETAIL_SCALE = 20;
const MAX_DETAIL_SCALE = 308;
/** How fast a pinch zooms, per unit of the wheel's delta. */
const PINCH_RATE = 0.01;
const zoomed = (scale: number) => clamp(scale, MIN_DETAIL_SCALE, MAX_DETAIL_SCALE);

export interface VoiceMemosWaveformProps {
  /** The recording's title, which names the waveform. */
  title: string;
  /** The amplitude envelope, evenly spaced over `duration` (see `WaveformView`). */
  samples: readonly number[];
  /** Length in seconds. */
  duration: number;
  /** The position in seconds. */
  position: number;
  /** Called with the position the person seeks to. */
  onSeek: (position: number) => void;
  /**
   * Shows the recording without letting the position be changed, as while a take runs.
   * @default false
   */
  disabled?: boolean;
  /** What stands over the overview: the trim handles. */
  children?: ReactNode;
}

/** The library's waveform with its detailed view and its overview, placed on the player. */
export function VoiceMemosWaveform({
  title,
  samples,
  duration,
  position,
  onSeek,
  disabled = false,
  children,
}: VoiceMemosWaveformProps) {
  const [scale, setScale] = useState(DETAIL_SCALE);
  const scaleNow = useRef(scale);
  scaleNow.current = scale;
  const pinchable = useCallback((element: HTMLDivElement | null) => {
    if (!element) return undefined;
    // Listeners of the element itself: only a listener that is not passive can keep the browser
    // from zooming the page. A trackpad's pinch is a wheel with Control, except in Safari.
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setScale((now) => zoomed(now * Math.exp(-event.deltaY * PINCH_RATE)));
    };
    let start = DETAIL_SCALE;
    const gestureStart = (event: Event) => {
      event.preventDefault();
      start = scaleNow.current;
    };
    const gestureChange = (event: Event) => {
      event.preventDefault();
      setScale(zoomed(start * (event as Event & { scale: number }).scale));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    element.addEventListener("gesturestart", gestureStart);
    element.addEventListener("gesturechange", gestureChange);
    return () => {
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("gesturestart", gestureStart);
      element.removeEventListener("gesturechange", gestureChange);
    };
  }, []);
  return (
    <WaveformView
      ref={pinchable}
      className="mac-voice-memos-waveform"
      aria-label={title}
      samples={samples}
      duration={duration}
      value={position}
      onValueChange={onSeek}
      disabled={disabled}
    >
      <WaveformViewDetail aria-label={`Waveform of ${title}`} scale={scale} />
      {/* A recording of no length keeps the strip: the view disables its slider. */}
      <WaveformViewOverview className="mac-voice-memos-overview" span={OVERVIEW_SPAN} />
      {children}
    </WaveformView>
  );
}

/** The large timer: minutes, seconds and hundredths of `position`. */
export function VoiceMemosTimer({ position }: { position: number }) {
  return (
    <div role="timer" aria-label="Position" className="mac-voice-memos-timer">
      {formatTimer(position)}
    </div>
  );
}

export interface VoiceMemosTransportProps {
  /** Whether the recording plays: the middle button is Pause then. */
  playing: boolean;
  /** Makes the middle button unavailable. */
  playDisabled: boolean;
  /** Makes the two skip buttons unavailable. */
  skipDisabled: boolean;
  onPlay: () => void;
  /** Called with -15 or 15. */
  onSkip: (seconds: number) => void;
}

/** Skip back 15 seconds, play or pause, skip forward 15 seconds: the bar's middle. */
export function VoiceMemosTransport({
  playing,
  playDisabled,
  skipDisabled,
  onPlay,
  onSkip,
}: VoiceMemosTransportProps) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring form semantics to three transport buttons
    <div role="group" aria-label="Playback" className="mac-voice-memos-transport">
      <button
        type="button"
        className="mac-voice-memos-key"
        aria-label="Skip Back 15 Seconds"
        disabled={skipDisabled}
        onClick={() => onSkip(-15)}
      >
        <SkipGlyph direction="back" />
      </button>
      <button
        type="button"
        className="mac-voice-memos-key mac-voice-memos-play"
        aria-label={playing ? "Pause" : "Play"}
        disabled={playDisabled}
        onClick={onPlay}
      >
        {playing ? <PauseGlyph /> : <PlayGlyph />}
      </button>
      <button
        type="button"
        className="mac-voice-memos-key"
        aria-label="Skip Forward 15 Seconds"
        disabled={skipDisabled}
        onClick={() => onSkip(15)}
      >
        <SkipGlyph direction="forward" />
      </button>
    </div>
  );
}

export interface VoiceMemosProps extends VoiceMemosWindowProps {
  /**
   * The recordings the window opens with, newest first.
   * @default the six of `voice-memos-data.ts`
   */
  defaultRecordings?: readonly VoiceMemosRecording[];
  /**
   * The id of the recording shown first; the first of the list when none has that id.
   * @default "new-recording-3"
   */
  defaultRecordingId?: string;
  /**
   * The view the window opens in: `"editor"` is one recording over the whole window, as in the
   * reference captures; `"library"` is the list of recordings beside the player.
   * @default "editor"
   */
  defaultView?: VoiceMemosView;
  /** What floats over the window: its Preferences, on a desktop. */
  panel?: ReactNode;
}

/**
 * Voice Memos, as in macOS 10.15 Catalina: an iPad app in a Mac window, with a translucent
 * toolbar over black content that is the same in both appearances. It opens on the view of
 * the reference captures, one recording with its waveform, its overview and the large timer
 * over a bar of transport buttons; Done shows the list of recordings beside the player.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a page
 * or a window manager places it (`style`, `width`, `height`, `ref`) and tells it whether it is
 * key (`state`); the window controls' and the toolbar row's callbacks, the eight props a
 * managed window's `render` supplies beside the window's, are handed to those parts.
 *
 * No sound is played or recorded: a recording is an invented amplitude envelope, playing moves
 * the position at one second a second, and a take that is resumed grows by more of the same
 * invented envelope. Everything lives in the component's state for as long as it is mounted.
 * The desktop served by Ferrite hosts `VoiceMemosApp` instead, which records and plays for real.
 */
export function VoiceMemos({
  defaultRecordings = capturedRecordings,
  defaultRecordingId = capturedRecordingId,
  defaultView = "editor",
  panel,
  ...frameProps
}: VoiceMemosProps) {
  const [state, dispatch] = useReducer(reduce, undefined, (): State => {
    const first =
      defaultRecordings.find((recording) => recording.id === defaultRecordingId) ??
      defaultRecordings[0];
    const view = first ? defaultView : "library";
    return {
      recordings: defaultRecordings,
      selectedId: first?.id,
      view,
      // The captures show a take that is being made, with the playhead at its end.
      activity: view === "editor" ? "held" : "idle",
      position: view === "editor" && first ? first.duration : 0,
    };
  });
  const [query, setQuery] = useState("");

  const { recordings, view, activity } = state;
  const recording = shown(state);
  const duration = recording?.duration ?? 0;
  const position = Math.min(state.position, duration);
  const editing = view === "editor" && recording !== undefined;
  const taking = activity === "held" || activity === "recording";
  const playing = activity === "playing";

  // The clock of playback and of a take: the time between frames, at most a tenth of a second
  // at once, so a page that was in the background does not jump ahead when it returns.
  const running = activity === "playing" || activity === "recording";
  useEffect(() => {
    if (!running) return;
    let last: number | undefined;
    let frame = requestAnimationFrame(function step(now) {
      const seconds = last === undefined ? 0 : clamp((now - last) / 1000, 0, 0.1);
      last = now;
      if (seconds > 0) dispatch({ type: "tick", seconds });
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [running]);

  return (
    <VoiceMemosFrame
      {...frameProps}
      title={recording?.title ?? "Voice Memos"}
      toolbar={
        <Toolbar aria-label="Voice Memos toolbar">
          <ToolbarSpace />
          {editing ? (
            // The demo trims nothing: the button is as the captures show it, unavailable.
            <VoiceMemosTrimButton disabled />
          ) : (
            <ToolbarButton disabled={!recording} onClick={() => dispatch({ type: "edit" })}>
              Edit
            </ToolbarButton>
          )}
        </Toolbar>
      }
      sidebar={
        editing ? undefined : (
          <CatalystSidebar aria-label="Recordings" width={SIDEBAR_WIDTH}>
            <VoiceMemosLibrary
              recordings={recordings}
              query={query}
              onQueryChange={setQuery}
              selectedId={state.selectedId}
              onSelect={(id) => dispatch({ type: "select", id })}
              onRowAction={() => dispatch({ type: "play" })}
              onNew={() => dispatch({ type: "new" })}
            />
          </CatalystSidebar>
        )
      }
    >
      {recording ? (
        <>
          <VoiceMemosWaveform
            title={recording.title}
            samples={recording.samples}
            duration={duration}
            position={position}
            onSeek={(next) => dispatch({ type: "seek", position: next })}
          />
          <VoiceMemosTimer position={position} />
        </>
      ) : (
        // The content is dark in both appearances: the placeholder takes light text.
        <div className="mac-voice-memos-empty" data-appearance="dark">
          <EmptyState>No Recording Selected</EmptyState>
        </div>
      )}
      <div className="mac-voice-memos-bar">
        {editing ? (
          <button
            type="button"
            className="mac-voice-memos-pill"
            aria-label={taking ? "Pause Recording" : "Resume Recording"}
            disabled={!taking && duration >= MAX_DURATION}
            onClick={() => dispatch({ type: "record" })}
          >
            {taking ? <RecordPauseGlyph /> : "Resume"}
          </button>
        ) : null}
        <VoiceMemosTransport
          playing={playing}
          playDisabled={duration <= 0}
          skipDisabled={!recording}
          onPlay={() => dispatch({ type: "play" })}
          onSkip={(seconds) => dispatch({ type: "skip", seconds })}
        />
        {editing ? (
          <button
            type="button"
            className="mac-voice-memos-done"
            onClick={() => dispatch({ type: "done" })}
          >
            Done
          </button>
        ) : null}
      </div>
      {panel}
    </VoiceMemosFrame>
  );
}
