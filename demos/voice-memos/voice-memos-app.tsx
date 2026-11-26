"use client";

import { CatalystSidebar } from "macalicious/catalyst-chrome";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DefaultButton } from "macalicious/default-button";
import { EmptyState } from "macalicious/empty-state";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { ShareMenu } from "macalicious/share-menu";
import {
  Sheet,
  SheetActions,
  SheetClose,
  SheetDescription,
  SheetPopup,
  SheetTitle,
} from "macalicious/sheet";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TextField } from "macalicious/text-field";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { WindowBanner, WindowBannerAction } from "macalicious/window-banner";
import {
  type KeyboardEvent,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { beginDesktopDrag } from "../desktop/desktop-drag";
import { EditRows } from "../desktop/desktop-edit-rows";
import { DriveError } from "../desktop/desktop-files";
import {
  desktopValuesLoaded,
  subscribeDesktopValues,
  useDesktopValue,
} from "../desktop/desktop-personal";
import {
  currentDesktopSession,
  servedByDesktopApp,
  useServerState,
} from "../desktop/desktop-server";
import { FileShareItems } from "../desktop/desktop-share-link";
import { showInFinder } from "../finder/finder-open";
import {
  recordingsMatching,
  SIDEBAR_WIDTH,
  VoiceMemos,
  VoiceMemosFrame,
  VoiceMemosLibrary,
  type VoiceMemosListItem,
  type VoiceMemosProps,
  VoiceMemosTimer,
  VoiceMemosTransport,
  VoiceMemosTrimButton,
  VoiceMemosWaveform,
} from "./voice-memos";
import {
  cutChannels,
  decodeAudio,
  encodeWavChannels,
  extensionForType,
  formatMemoDate,
  keepsWhole,
  moveTrimEnd,
  moveTrimStart,
  PEAKS_PER_SECOND,
  peaksOf,
  removeRange,
  spliceChannels,
  splicePeaks,
  type TrimRange,
  WAV_TYPE,
} from "./voice-memos-audio";
import { useClearDeleted } from "./voice-memos-clear-deleted";
import { MAX_EDITED_DURATION, nextTitle } from "./voice-memos-data";
import { defaultDrive, type VoiceMemoFile, type VoiceMemosDrive } from "./voice-memos-drive";
import type { HeldTake, VoiceMemosHolding } from "./voice-memos-holding";
import { RecordPauseGlyph } from "./voice-memos-icons";
import { locationTitle } from "./voice-memos-location";
import { useNowPlaying } from "./voice-memos-now-playing";
import { keepPlace, readPlace, VOICE_MEMOS_PLACE, type VoiceMemosPlace } from "./voice-memos-place";
import {
  DEFAULT_PREFERENCES,
  preferencesFromServer,
  preferencesToServer,
  VOICE_MEMOS_PREFERENCES_URL,
  type VoiceMemosPreferences,
} from "./voice-memos-preferences";
import { VoiceMemosPreferencesPanel } from "./voice-memos-preferences-panel";
import { startTake, type VoiceMemosTake } from "./voice-memos-recorder";
import { VoiceMemosTrimActions, VoiceMemosTrimHandles } from "./voice-memos-trim-handles";

export type { VoiceMemoFile, VoiceMemosDrive } from "./voice-memos-drive";

export interface VoiceMemosAppProps extends VoiceMemosProps {
  /**
   * Where recordings are kept: Music/Voice Memos of the person's drive. Without one the window is
   * the demo, `VoiceMemos`, which records and plays nothing and takes the demo's own props
   * (`defaultRecordings`, `defaultRecordingId`, `defaultView`); with one those are not used.
   * @default the person's drive where the desktop app serves the page, otherwise none
   */
  drive?: VoiceMemosDrive | null;
  /** Given by a desktop: the application renders its own Preferences (`preferences: "own"`). */
  preferencesOpen?: boolean;
  onPreferencesOpenChange?: (open: boolean) => void;
}

/** What decoding a recording found: its length and its waveform. */
interface Decoded {
  duration: number;
  peaks: readonly number[];
}

/**
 * The recordings decoded on this page, by drive and file id (a file's bytes never change under
 * its id, so an entry never goes stale; ids name files only within their drive), and the
 * decodings under way. `null` marks a file the browser could not decode. Shared by every window
 * of the same drive, so a window opened again decodes nothing twice.
 */
interface DecodeCache {
  decoded: Map<string, Decoded | null>;
  decoding: Map<string, Promise<Decoded | null>>;
}
const caches = new WeakMap<object, DecodeCache>();
function cacheOf(drive: object): DecodeCache {
  let cache = caches.get(drive);
  if (!cache) {
    cache = { decoded: new Map(), decoding: new Map() };
    caches.set(drive, cache);
  }
  return cache;
}

/**
 * Every decoding on the page, one after another (the background lengths, the chosen recording,
 * a trim, in any window): a decoding holds the whole recording's samples, so two at once could
 * double what the page holds.
 */
let decodings: Promise<void> = Promise.resolve();
function inTurn<T>(task: () => Promise<T>): Promise<T> {
  const turn = decodings.then(task);
  // The tail keeps no result: a turn's samples are let go once its task is done with them.
  decodings = turn.then(
    () => undefined,
    () => undefined,
  );
  return turn;
}

/** Decodes the file `id` once: a read that fails is not remembered, and is tried again later. What
 * this browser kept of an earlier decoding spares the read. */
function decodeOnce(
  { decoded, decoding }: DecodeCache,
  id: string,
  read: () => Promise<Blob>,
  holding: Promise<VoiceMemosHolding | null>,
): Promise<Decoded | null> {
  const known = decoded.get(id);
  if (known !== undefined) return Promise.resolve(known);
  let pending = decoding.get(id);
  if (!pending) {
    pending = (async () => {
      const place = await holding.catch(() => null);
      const kept = await place?.knownDecoded?.(id).catch(() => undefined);
      if (kept) {
        decoded.set(id, kept);
        return kept;
      }
      const blob = await read();
      let result: Decoded | null = null;
      try {
        // Only the length and the waveform leave the turn, not the samples.
        result = await inTurn(async () => {
          const audio = await decodeAudio(blob);
          return { duration: audio.duration, peaks: peaksOf(audio.channels, audio.sampleRate) };
        });
      } catch {
        // Not a recording this browser can decode: its length is not known.
      }
      decoded.set(id, result);
      if (result) await place?.keepDecoded?.(id, result).catch(() => undefined);
      return result;
    })().finally(() => decoding.delete(id));
    decoding.set(id, pending);
  }
  return pending;
}

/** One state of a recording being edited: its sound, as a file, and what decoding that found. */
interface EditStage {
  blob: Blob;
  decoded: Decoded;
}

/**
 * The edits of a trim not saved yet: the recording as it was, then a state for each Trim or Delete
 * pressed. `at` is the state shown, so Undo and Redo move it and Revert returns it to the first.
 */
interface EditSession {
  stages: readonly EditStage[];
  at: number;
}

/** Sound as a WAV file, every channel kept as it was. */
function stageOf(channels: readonly Float32Array[], sampleRate: number): EditStage {
  const frames = channels[0]?.length ?? 0;
  if (frames === 0) throw new Error("the change leaves no sound");
  return {
    blob: new Blob([encodeWavChannels(channels, sampleRate)], { type: WAV_TYPE }),
    decoded: { duration: frames / sampleRate, peaks: peaksOf(channels, sampleRate) },
  };
}

/**
 * Decoded, changed and encoded in one turn: only the WAV file and its waveform leave it, so no
 * samples are held while it uploads.
 */
const changedStage = (
  blob: Blob,
  change: (channels: readonly Float32Array[], sampleRate: number) => Float32Array[],
) =>
  inTurn(async () => {
    const audio = await decodeAudio(blob);
    return stageOf(change(audio.channels, audio.sampleRate), audio.sampleRate);
  });

/**
 * A take the drive does not have yet, which only this window holds: being saved, or refused by
 * the drive (and why). It is a row of the window's list, "Not saved", until it is saved or the
 * person discards it.
 */
interface UnsavedTake {
  /** The take's id, given when it started. */
  id: string;
  title: string;
  /** The file name it is saved under: a retry can never make a second copy. Another recording
   * that took the name first is the one thing that changes it, and the title with it. */
  name: string;
  blob: Blob;
  created: number;
  saving: boolean;
  error: string | null;
  /** Whether the browser holds it too, so that it outlives this window. */
  held?: boolean;
}

/** The list's id of an unsaved take's row, apart from every file id of the drive. */
const rowIdOf = (take: Pick<UnsavedTake, "id">) => `take:${take.id}`;

/** How far the left and right arrow keys move the playhead, in seconds. */
const ARROW_STEP = 1;

const TAKE_ID_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A new take's id, drawn at random: what keeps it apart while its title may still change. */
function newTakeId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => TAKE_ID_LETTERS[byte % TAKE_ID_LETTERS.length]).join("");
}

/** A title Voice Memos gave, which it may change for a free one: never one the person chose. */
const NUMBERED_TITLE = /^New Recording( \d+)?$/;

/** How long the place waits for the person to stop moving before it is saved, in milliseconds. */
const PLACE_SAVE_MS = 400;

/**
 * Stops a take whose window has closed and saves what it recorded under its own name, as best it
 * can: if the drive refuses it, it waits in the browser for the next time Voice Memos opens.
 */
/** Where a window's takes can wait for the drive, and the session they belong to: found once, when
 * it opens. A save names the session, and the server refuses it if someone else has signed in. */
interface Bound {
  holding: Promise<VoiceMemosHolding | null>;
  session: string | null;
}

function stopWithoutWindow(
  running: VoiceMemosTake,
  drive: VoiceMemosDrive,
  bound: Bound,
  title: string,
) {
  void tracked(
    running.stop().then(
      (blob) =>
        blob.size > 0
          ? keepWithoutWindow(drive, bound, {
              id: title,
              title,
              name: `${title}.${extensionForType(running.type)}`,
              blob,
              created: Date.now(),
            })
          : undefined,
      () => undefined,
    ),
  );
}

/**
 * Saves a recording no window shows: held first, so that a save that fails, or a page that goes
 * away during it, leaves it for the next time Voice Memos opens.
 */
/** Saves of windows that have closed: the next window waits for them, so that none is made twice. */
const leaving = new Set<Promise<unknown>>();

/** Counts `work` among the saves the next window waits for. */
function tracked<T>(work: Promise<T>): Promise<T> {
  leaving.add(work);
  const done = () => leaving.delete(work);
  work.then(done, done);
  return work;
}

async function keepWithoutWindow(drive: VoiceMemosDrive, bound: Bound, take: HeldTake) {
  const place = await bound.holding;
  await place?.put(take).catch(() => undefined);
  await drive.save(take.blob, take.name, undefined, bound.session).then(
    () => place?.remove(take.id).catch(() => undefined),
    () => undefined,
  );
}

/** A key for each drive object, so that another drive gets a window of its own. */
const driveKeys = new WeakMap<object, number>();
let lastDriveKey = 0;
function keyOf(drive: object): number {
  let key = driveKeys.get(drive);
  if (key === undefined) {
    lastDriveKey += 1;
    key = lastDriveKey;
    driveKeys.set(drive, key);
  }
  return key;
}

/**
 * How long a recording whose file names no length (`MediaRecorder`'s WebM) may take to have it
 * found before it plays without.
 */
const FIND_LENGTH_MS = 3000;

/** The width of the Rename sheet, in points. Provisional: Voice Memos renames in place. */
const RENAME_SHEET_WIDTH = 320;

/** The width of the sheet that asks before a take that is not saved is lost, in points. */
const CONFIRM_SHEET_WIDTH = 360;

/** What a take that reached the longest it gets says. */
const endedAtLimit = (seconds: number) =>
  `Voice Memos ends a recording at ${seconds >= 3600 ? "an hour" : `${Math.round(seconds / 60)} minutes`}, so this one stopped there. What was recorded is kept.`;

/** The seconds a take stops at: going onto a saved recording, the file it makes is WAV. */
const takeLimit = (running: VoiceMemosTake, onto: TakeOnto | undefined) =>
  onto ? MAX_EDITED_DURATION : running.longest;

/** Why a recording too long for it has no Replace or Resume, and cannot be trimmed longer. */
const TOO_LONG_TO_EDIT = `A changed recording is saved uncompressed, and the drive holds ${MAX_EDITED_DURATION / 60} minutes of that in a file.`;

const NO_SAMPLES: readonly number[] = [];

/** Why Cut, Copy and Paste are dimmed while a recording is trimmed. */
const NO_SOUND_CLIPBOARD =
  "A browser takes no sound onto the clipboard. Trim and Delete change the recording here.";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
const newestFirst = (memos: readonly VoiceMemoFile[]) =>
  [...memos].sort((a, b) => b.created - a.created || a.name.localeCompare(b.name));

/** A message in the window, which the person dismisses. */
interface Notice {
  message: string;
}

/** The saved recording a take goes onto, from `at` seconds on: Resume at its end, else Replace. */
interface TakeOnto {
  memo: VoiceMemoFile;
  blob: Blob;
  at: number;
  duration: number;
  peaks: readonly number[];
}

/** A take, as the window shows it. */
interface TakeState {
  /** The saved recording it goes onto; none for a new recording. */
  onto?: TakeOnto;
  /** The take's id, given when it starts. */
  id: string;
  title: string;
  paused: boolean;
  /** Seconds recorded. */
  elapsed: number;
  /** The microphone's levels, `PEAKS_PER_SECOND` a second. */
  samples: readonly number[];
  /** The take has ended and is being saved. */
  saving: boolean;
}

/** The take with the levels of the time recorded since the last frame. */
function grown(take: TakeState, elapsed: number, level: number): TakeState {
  const count = Math.floor(elapsed * PEAKS_PER_SECOND);
  if (count <= take.samples.length) return { ...take, elapsed };
  const samples = take.samples.slice();
  while (samples.length < count) samples.push(Math.round(level * 1000) / 1000);
  return { ...take, elapsed, samples };
}

function setRef<T>(ref: Ref<T> | undefined, value: T) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

/**
 * Voice Memos as the desktop served by the `macalicious-desktop` Ferrite application runs it: it
 * records from the microphone and keeps each recording as an audio file in Music/Voice Memos on
 * the person's drive, where Finder shows it too; it lists those files newest first, plays them
 * with an `<audio>` element and draws their decoded waveform; it renames them, moves them to
 * the drive's Trash, and trims them into a WAV file that replaces the original. Elsewhere, as on
 * the documentation site, it is the demo, `VoiceMemos`, and requests nothing.
 */
export function VoiceMemosApp({ drive = defaultDrive(), ...props }: VoiceMemosAppProps) {
  // Another drive gets a window of its own: nothing of one drive (a take, a save, a rename under
  // way, its list) can reach the other's.
  if (drive) return <DriveVoiceMemos key={keyOf(drive)} {...props} drive={drive} />;
  const { preferencesOpen, onPreferencesOpenChange, ...demo } = props;
  return (
    <VoiceMemos
      {...demo}
      onKeyDown={(event) => {
        demo.onKeyDown?.(event);
        if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key === ",") {
          event.preventDefault();
          onPreferencesOpenChange?.(true);
        }
      }}
      panel={
        preferencesOpen ? (
          <VoiceMemosPreferencesPanel
            value={DEFAULT_PREFERENCES}
            onClose={() => onPreferencesOpenChange?.(false)}
          />
        ) : null
      }
    />
  );
}

function DriveVoiceMemos({
  drive,
  defaultRecordings: _recordings,
  defaultRecordingId: _recordingId,
  defaultView: _view,
  preferencesOpen = false,
  onPreferencesOpenChange,
  ref,
  ...frameProps
}: VoiceMemosAppProps & { drive: VoiceMemosDrive }) {
  // The recordings, newest first; null until the first listing answers.
  const [memos, setMemos] = useState<readonly VoiceMemoFile[] | null>(null);
  // Recently Deleted: whether the list shows it, and what it holds.
  const [inDeleted, setInDeleted] = useState(false);
  const [deleted, setDeleted] = useState<readonly VoiceMemoFile[]>([]);
  // The Preferences, once read: nothing is cleared on the defaults of a store that could not be read.
  const [preferences, setPreferences] = useState<VoiceMemosPreferences>(DEFAULT_PREFERENCES);
  const [preferencesRead, setPreferencesRead] = useState(false);
  // Where the person is, asked ahead: a take starts within the press and cannot wait for an answer.
  const placeName = useRef<string | null>(null);
  const [namingProblem, setNamingProblem] = useState<string | null>(null);
  const [placeAsked, setPlaceAsked] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new `placeAsked` asks again after each take begins.
  useEffect(() => {
    if (!preferences.locationNaming) {
      placeName.current = null;
      setNamingProblem(null);
      return;
    }
    let live = true;
    void locationTitle().then((answer) => {
      if (!live) return;
      placeName.current = "title" in answer ? answer.title : null;
      setNamingProblem("problem" in answer ? answer.problem : null);
    });
    return () => {
      live = false;
    };
  }, [preferences.locationNaming, placeAsked]);
  useServerState({
    url: VOICE_MEMOS_PREFERENCES_URL,
    enabled: servedByDesktopApp(),
    value: preferences,
    onLoad: (stored) => {
      const loaded = preferencesFromServer(stored);
      if (!loaded) return false;
      setPreferences(loaded);
      setPreferencesRead(true);
    },
    toBody: preferencesToServer,
  });
  const [selectedId, setSelectedId] = useState<string>();
  // The rows chosen together; they count only while they hold the recording shown, so that any
  // other choice of it (a save, a recording that left) ends them.
  const [picked, setPicked] = useState<readonly string[]>([]);
  const [view, setView] = useState<"library" | "editor">("library");
  const [query, setQuery] = useState("");
  const [take, setTake] = useState<TakeState | null>(null);
  const [trim, setTrim] = useState<TrimRange | null>(null);
  const [edit, setEdit] = useState<EditSession | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  // The row whose title is a field: a double click or Return on it.
  const [renamingRow, setRenamingRow] = useState<string>();
  const renamingRowNow = useRef(renamingRow);
  renamingRowNow.current = renamingRow;
  // Where the person left off: read once, as the list and the settings have both answered.
  const storedPlace = useDesktopValue<VoiceMemosPlace | null>(VOICE_MEMOS_PLACE, readPlace, null);
  const valuesLoaded = useSyncExternalStore(
    subscribeDesktopValues,
    desktopValuesLoaded,
    () => false,
  );
  const placeRead = useRef(false);
  const restoring = useRef<{ id: string; position: number } | null>(null);
  // What the window is doing that the person waits for, and a message for them.
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  // The chosen recording's file, read from the drive, for the audio element.
  const [source, setSource] = useState<{ id: string; url: string; blob: Blob } | null>(null);
  const [ready, setReady] = useState(false);
  const [lengthOfFile, setLengthOfFile] = useState<number>();
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  // Rendered again when a decoding finishes (the decodings live outside the component).
  const [, decoded] = useReducer((count: number) => count + 1, 0);
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  // This drive's decodings.
  const cache = useMemo(() => cacheOf(drive), [drive]);
  const decodedById = cache.decoded;

  const audioRef = useRef<HTMLAudioElement>(null);
  const recorder = useRef<VoiceMemosTake | null>(null);
  // Set when a take ended by itself, with the recorder's reason.
  const ended = useRef<{ take: VoiceMemosTake; reason: Error | null } | null>(null);
  // The title of the take under way, from the moment its recorder starts.
  const takeTitle = useRef<string | null>(null);
  const starting = useRef(false);
  // The microphone is being asked for: a take is starting, which closing would lose.
  const [opening, setOpening] = useState(false);
  const mounted = useRef(true);
  // The takes the drive does not have yet, newest first: rows of the list, "Not saved".
  const [unsaved, setUnsaved] = useState<readonly UnsavedTake[]>([]);
  const unsavedRef = useRef(unsaved);
  unsavedRef.current = unsaved;
  // Where this window's takes wait, and for whom: whoever is signed in as it opens.
  const [bound] = useState<Bound>(() => {
    const session = currentDesktopSession();
    return { session, holding: drive.holding?.(session) ?? Promise.resolve(null) };
  });
  const { holding } = bound;
  const [canHold, setCanHold] = useState(false);
  // The ids of the takes being saved now, so that no take is ever saved twice at once.
  const savingNow = useRef(new Set<string>());
  // A question before a take that is not saved could be lost: Discard, or closing the window.
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    action: string;
    run: () => void;
  } | null>(null);
  // A file this window has in hand (just recorded or trimmed), so it is not read back to play.
  const handoff = useRef<{ id: string; blob: Blob } | null>(null);
  // The recording last marked opened, for Finder's Recents: once each time it is chosen.
  const opened = useRef<string | null>(null);
  const latest = useRef({ selectedId, position, take, drive });
  latest.current = { selectedId, position, take, drive };
  const holdingNow = useRef(bound);

  const selected = inDeleted ? undefined : memos?.find((memo) => memo.id === selectedId);
  const chosenDeleted = inDeleted ? deleted.find((memo) => memo.id === selectedId) : undefined;
  const selectedUnsaved = inDeleted
    ? undefined
    : unsaved.find((each) => rowIdOf(each) === selectedId);
  const decodedNow =
    selected || selectedUnsaved || chosenDeleted ? decodedById.get(selectedId ?? "") : undefined;
  const stage = edit?.stages[edit.at];
  const fileDuration = stage?.decoded.duration ?? decodedNow?.duration ?? lengthOfFile ?? 0;
  const chosenIds =
    selectedId === undefined ? [] : picked.includes(selectedId) ? picked : [selectedId];
  const chosenMemos = inDeleted ? [] : (memos ?? []).filter((m) => chosenIds.includes(m.id));
  const chosenGone = inDeleted ? deleted.filter((m) => chosenIds.includes(m.id)) : [];

  const outerRef = useRef(ref);
  outerRef.current = ref;
  // Stable, so a host's ref that changes on every render does not detach and attach the window.
  const setFrameRef = useCallback((node: HTMLDivElement | null) => {
    setFrame(node);
    setRef(outerRef.current, node);
  }, []);

  const show = useCallback((message: string) => {
    if (mounted.current) setNotice({ message });
  }, []);

  // The recordings: listed once, then again whenever the drive changes, here or elsewhere.
  useEffect(() => {
    let live = true;
    const stop = drive.watch((list) => {
      if (live) setMemos(list);
    });
    drive.list().then(
      // A change heard while the listing was under way is newer than it.
      (list) => live && setMemos((now) => now ?? list),
      (error) => {
        if (!live) return;
        setMemos((now) => now ?? []);
        show(`The recordings could not be read: ${messageOf(error)}`);
      },
    );
    return () => {
      live = false;
      stop();
    };
  }, [drive, show]);

  // What Recently Deleted holds: the recordings in the drive's Trash, here or put there elsewhere.
  useEffect(() => {
    const store = drive.deleted;
    if (!store) return;
    let live = true;
    const stop = store.watch((list) => {
      if (live) setDeleted(list);
    });
    store.list().then(
      (list) => {
        if (!live) return;
        setDeleted(list);
        setDeletedRead(true);
      },
      () => {},
    );
    return () => {
      live = false;
      stop();
    };
  }, [drive]);

  // Clear Deleted waits for the Preferences to be read: nothing is cleared on mere defaults.
  useClearDeleted(drive.deleted, deleted, preferences.clearDeleted, preferencesRead);

  // The chosen recording is one that is listed: the newest, when there is none or it left.
  useEffect(() => {
    if (!memos) return;
    const listed = inDeleted
      ? deleted.map((memo) => memo.id)
      : [...unsaved.map(rowIdOf), ...memos.map((memo) => memo.id)];
    const wanted = restoring.current?.id;
    if (!selectedId && wanted && listed.includes(wanted)) setSelectedId(wanted);
    else if (!selectedId || !listed.includes(selectedId)) setSelectedId(listed[0]);
  }, [memos, unsaved, deleted, inDeleted, selectedId]);

  // Back to where the person left off, once: the recording and the list now, the playhead when the
  // file has loaded.
  useEffect(() => {
    if (placeRead.current || !memos || (!storedPlace && !valuesLoaded)) return;
    placeRead.current = true;
    if (!storedPlace || !memos.some((memo) => memo.id === storedPlace.recording)) return;
    restoring.current = { id: storedPlace.recording, position: storedPlace.position };
    setSelectedId(storedPlace.recording);
    if (!storedPlace.sidebar) setView("editor");
  }, [memos, storedPlace, valuesLoaded]);

  // What this browser kept of files that have left the drive goes, once a window has read the list.
  const [deletedRead, setDeletedRead] = useState(false);
  const prunedDecoded = useRef(false);
  useEffect(() => {
    if (!memos || !(deletedRead || !drive.deleted) || prunedDecoded.current) return;
    prunedDecoded.current = true;
    const ids = [...memos, ...deleted].map((memo) => memo.id);
    void bound.holding.then((place) => place?.keepDecodedOnly?.(ids)).catch(() => undefined);
  }, [memos, deleted, deletedRead, drive.deleted, bound]);

  // The lengths and waveforms of the listed recordings, newest first, whatever their size: each
  // decoding waits its turn (`decodeInTurn`).
  useEffect(() => {
    if (!memos) return;
    let stopped = false;
    void (async () => {
      for (const memo of inDeleted ? deleted : memos) {
        if (stopped) return;
        if (cache.decoded.has(memo.id) || memo.id === latest.current.selectedId) continue;
        try {
          await decodeOnce(cache, memo.id, () => drive.read(memo.id), bound.holding);
        } catch {
          // A file that could not be read is tried again when the list changes.
        }
        if (!stopped) decoded();
      }
    })();
    return () => {
      stopped = true;
    };
  }, [memos, deleted, inDeleted, drive, cache, bound]);

  // The chosen recording's file, for the audio element, and its decoding.
  useEffect(() => {
    audioRef.current?.pause();
    setSource(null);
    setReady(false);
    setLengthOfFile(undefined);
    setPlaying(false);
    setPosition(0);
    setTrim(null);
    setEdit(null);
    opened.current = null;
    if (restoring.current?.id !== selectedId && selectedId) restoring.current = null;
    if (!selectedId) return;
    let live = true;
    const kept =
      handoff.current?.id === selectedId
        ? handoff.current.blob
        : unsavedRef.current.find((each) => rowIdOf(each) === selectedId)?.blob;
    // A take not saved has no file of the drive to keep its decoding under.
    const keepsDecoding = unsavedRef.current.some((each) => rowIdOf(each) === selectedId)
      ? Promise.resolve(null)
      : bound.holding;
    handoff.current = null;
    (kept ? Promise.resolve(kept) : drive.read(selectedId)).then(
      (blob) => {
        if (!live) return;
        setSource({ id: selectedId, url: URL.createObjectURL(blob), blob });
        void decodeOnce(cache, selectedId, async () => blob, keepsDecoding).then(
          () => {
            if (live) decoded();
          },
          // A decoding that fails leaves the length unknown; the file still plays.
          () => {},
        );
      },
      (error) => {
        if (live) show(`The recording could not be read: ${messageOf(error)}`);
      },
    );
    return () => {
      live = false;
    };
  }, [selectedId, drive, show, cache, bound]);

  // A file's address lives as long as it is the audio element's; the element stops playing it
  // when another file is chosen or the window closes.
  useEffect(() => {
    if (!source) return;
    const audio = audioRef.current;
    return () => {
      audio?.pause();
      URL.revokeObjectURL(source.url);
    };
  }, [source]);

  // The audio element's events. A file that names no length (WebM from `MediaRecorder`) is
  // sought past its end first: the browser then finds the length, and only then can it seek.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !source) return;
    let finding = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      if (finding) {
        finding = false;
        clearTimeout(timer);
        audio.currentTime = latest.current.position;
      }
      setLengthOfFile(Number.isFinite(audio.duration) ? audio.duration : undefined);
      setReady(true);
    };
    const metadata = () => {
      if (audio.duration !== Number.POSITIVE_INFINITY) {
        settle();
        return;
      }
      finding = true;
      timer = setTimeout(settle, FIND_LENGTH_MS);
      audio.currentTime = 1e101;
    };
    const lengthChange = () => {
      if (!Number.isFinite(audio.duration)) return;
      if (finding) settle();
      else setLengthOfFile(audio.duration);
    };
    const time = () => {
      if (!finding && audio.paused) setPosition(audio.currentTime);
    };
    const play = () => {
      if (!finding) setPlaying(true);
    };
    const pause = () => setPlaying(false);
    const ended = () => {
      if (finding) return;
      setPlaying(false);
      setPosition(audio.duration > 0 && Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const failed = () => {
      setReady(false);
      setPlaying(false);
      show("This browser cannot play the recording.");
    };
    const events: [string, () => void][] = [
      ["loadedmetadata", metadata],
      ["durationchange", lengthChange],
      ["timeupdate", time],
      ["play", play],
      ["pause", pause],
      ["ended", ended],
      ["error", failed],
    ];
    for (const [name, listener] of events) audio.addEventListener(name, listener);
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) metadata();
    return () => {
      clearTimeout(timer);
      for (const [name, listener] of events) audio.removeEventListener(name, listener);
    };
  }, [source, show]);

  // The playhead follows the audio while it plays.
  useEffect(() => {
    if (!playing) return;
    let frameId = requestAnimationFrame(function follow() {
      const audio = audioRef.current;
      if (audio) setPosition(audio.currentTime);
      frameId = requestAnimationFrame(follow);
    });
    return () => cancelAnimationFrame(frameId);
  }, [playing]);

  // The recording the person left off in has loaded: the playhead goes back to where it was.
  useEffect(() => {
    const back = restoring.current;
    const audio = audioRef.current;
    if (!back || !ready || !audio || source?.id !== back.id) return;
    restoring.current = null;
    audio.currentTime = back.position;
    setPosition(audio.currentTime);
  }, [ready, source]);

  /**
   * Saves a take this window holds under its own name. Resolves whether the drive has it: the
   * take's row then becomes the saved file's; a refusal leaves the row, "Not saved", with Retry
   * and Discard. A take already being saved is not saved again.
   */
  const saveNow = useCallback(
    async (take: UnsavedTake): Promise<boolean> => {
      if (savingNow.current.has(take.id)) return false;
      savingNow.current.add(take.id);
      const mark = (change: Partial<UnsavedTake>) =>
        setUnsaved((now) =>
          now.map((each) => (each.id === take.id ? { ...each, ...change } : each)),
        );
      mark({ saving: true, error: null });
      try {
        const place = await holding;
        let memo: VoiceMemoFile;
        try {
          memo = await drive.save(take.blob, take.name, undefined, bound.session);
        } catch (error) {
          // Another recording took a number while this take was being made, here or elsewhere: the
          // take has the next. Held under it first, so that a retry after a crash is the same save.
          if (
            !(error instanceof DriveError) ||
            error.status !== 409 ||
            bound.session !== currentDesktopSession() ||
            !(
              NUMBERED_TITLE.test(take.title) ||
              (placeName.current !== null && take.title.startsWith(placeName.current))
            )
          ) {
            throw error;
          }
          const listed = await drive.list();
          const name = take.name.toLowerCase();
          if (!listed.some((each) => each.name.toLowerCase() === name)) throw error;
          const title = nextTitle(
            [...listed, ...unsavedRef.current],
            NUMBERED_TITLE.test(take.title) ? undefined : (placeName.current ?? undefined),
          );
          const changed = { title, name: `${title}${take.name.slice(take.title.length)}` };
          await place?.put({ ...take, ...changed });
          mark({ ...changed, held: place ? true : take.held });
          memo = await drive.save(take.blob, changed.name, undefined, bound.session);
        }
        await place?.remove(take.id).catch(() => undefined);
        handoff.current = { id: memo.id, blob: take.blob };
        void decodeOnce(cache, memo.id, async () => take.blob, holding).catch(() => {});
        if (!mounted.current) return true;
        setUnsaved((now) => now.filter((each) => each.id !== take.id));
        setMemos((now) => newestFirst([...(now ?? []).filter((m) => m.id !== memo.id), memo]));
        setSelectedId((now) => (now === rowIdOf(take) ? memo.id : now));
        return true;
      } catch (error) {
        if (mounted.current) {
          const why = messageOf(error).replace(/[.\s]+$/, "");
          mark({ saving: false, error: why });
          show(`“${take.title}” could not be saved: ${why}. It stays in the list, not saved.`);
        }
        return false;
      } finally {
        savingNow.current.delete(take.id);
      }
    },
    [drive, bound, holding, cache, show],
  );
  // All of it counts for the next window: the check, the save and forgetting the held copy.
  const saveUnsaved = useCallback((take: UnsavedTake) => tracked(saveNow(take)), [saveNow]);

  /** Saves the chosen take again, under the same name. */
  const retry = () => {
    if (selectedUnsaved && !selectedUnsaved.saving) void saveUnsaved(selectedUnsaved);
  };

  // What an earlier window or page left waiting: a "Not saved" row each, and tried again at once.
  const heldRead = useRef(false);
  useEffect(() => {
    if (heldRead.current) return;
    heldRead.current = true;
    void holding
      .then(async (place) => {
        if (mounted.current) setCanHold(place !== null);
        if (mounted.current && place === null && drive.holding) {
          show(
            "This browser cannot keep a copy of your recordings, so one the drive refuses is lost when this window closes.",
          );
        }
        await Promise.allSettled(leaving);
        return (await place?.list()) ?? [];
      })
      .catch(() => [])
      .then((held) => {
        if (!mounted.current) return;
        const rows = held
          .filter((each) => !unsavedRef.current.some((row) => row.id === each.id))
          .map((each) => ({ ...each, saving: false, error: null, held: true }));
        if (rows.length === 0) return;
        setUnsaved((now) => [...now, ...rows].sort((a, b) => b.created - a.created));
        for (const row of rows) void saveUnsaved(row);
      });
  }, [drive.holding, holding, saveUnsaved, show]);

  /** Asks, then forgets the chosen take for good. */
  const discard = () => {
    const doomed = selectedUnsaved;
    if (!doomed || doomed.saving) return;
    setConfirm({
      title: `Discard “${doomed.title}”?`,
      message: "This recording is not saved. Discarding it deletes it for good.",
      action: "Discard",
      run: () => {
        audioRef.current?.pause();
        const forget = () => setUnsaved((now) => now.filter((each) => each.id !== doomed.id));
        if (!doomed.held) {
          forget();
          return;
        }
        // The row stays, busy, until the browser's copy has gone: it would come back on the next open.
        setUnsaved((now) =>
          now.map((each) => (each.id === doomed.id ? { ...each, saving: true } : each)),
        );
        void tracked(
          holding
            .then((place) => place?.remove(doomed.id))
            .then(forget, (error) => {
              setUnsaved((now) =>
                now.map((each) => (each.id === doomed.id ? { ...each, saving: false } : each)),
              );
              show(`“${doomed.title}” could not be discarded: ${messageOf(error)}`);
            }),
        );
      },
    });
  };

  /**
   * Puts a take into the saved recording it went onto: a new WAV file in its place, the old one in
   * the Trash. The take is held until then, and if this fails it becomes a recording of its own:
   * the saved recording stays as it was, and what was recorded is not lost.
   */
  const keepOnto = useCallback(
    async (take: TakeState, onto: TakeOnto, blob: Blob, name: string) => {
      const made: UnsavedTake = {
        id: take.id,
        title: take.title,
        name,
        blob,
        created: Date.now(),
        saving: false,
        error: null,
      };
      const place = await holding;
      const held = await place?.put(made).then(
        () => true,
        () => false,
      );
      if (mounted.current) setBusy(`Saving “${onto.memo.title}”…`);
      try {
        const joined = await inTurn(async () => {
          const before = await decodeAudio(onto.blob);
          const added = await decodeAudio(blob);
          const channels = spliceChannels(
            before.channels,
            added.channels,
            before.sampleRate,
            onto.at,
          );
          return stageOf(channels, before.sampleRate);
        });
        const changed = await drive.replace(onto.memo, joined.blob, `${onto.memo.title}.wav`);
        await place?.remove(take.id).catch(() => undefined);
        cache.decoded.set(changed.id, joined.decoded);
        handoff.current = { id: changed.id, blob: joined.blob };
        if (!mounted.current) return;
        setMemos((now) =>
          newestFirst([
            ...(now ?? []).filter((each) => each.id !== onto.memo.id && each.id !== changed.id),
            changed,
          ]),
        );
        setSelectedId(changed.id);
      } catch (error) {
        if (!mounted.current) {
          await keepWithoutWindow(drive, bound, made);
          return;
        }
        show(
          `“${onto.memo.title}” could not be changed: ${messageOf(error)}. What you recorded is kept as “${take.title}”.`,
        );
        setUnsaved((now) => [{ ...made, saving: true, held }, ...now]);
        setSelectedId(rowIdOf(made));
        await saveUnsaved({ ...made, held });
      } finally {
        if (mounted.current) setBusy(null);
      }
    },
    [bound, cache, drive, holding, saveUnsaved, show],
  );

  /** Ends the take and saves it: Done, or a take that reached the longest a recording gets. */
  const finishNow = useCallback(async () => {
    const take = latest.current.take;
    const running = recorder.current;
    if (!take || !running || take.saving) return;
    recorder.current = null;
    // Why the take ended by itself, when it did.
    const endedBy = ended.current?.take === running ? ended.current : null;
    ended.current = null;
    const limit = takeLimit(running, take.onto);
    const atLimit = running.elapsed() + (take.onto?.at ?? 0) >= limit;
    setTake({ ...take, saving: true, paused: true, elapsed: running.elapsed() });
    let blob: Blob;
    try {
      blob = await running.stop();
    } catch (error) {
      setTake(null);
      setView("library");
      show(`The recording could not be finished: ${messageOf(error)}`);
      return;
    }
    const name = `${take.title}.${extensionForType(running.type)}`;
    if (!mounted.current) {
      // The window closed while the take ended: saved once, as best it can be.
      if (blob.size > 0) {
        void tracked(
          keepWithoutWindow(latest.current.drive, bound, {
            // The take's title, as when the window closes under it: both paths can run for one take.
            id: take.title,
            title: take.title,
            name,
            blob,
            created: Date.now(),
          }),
        );
      }
      return;
    }
    setTake(null);
    setView("library");
    if (blob.size === 0) {
      show("Nothing was recorded.");
      return;
    }
    if (take.onto) {
      if (atLimit) show(endedAtLimit(limit));
      await keepOnto(take, take.onto, blob, name);
      return;
    }
    const made: UnsavedTake = {
      id: take.id,
      title: take.title,
      name,
      blob,
      created: Date.now(),
      // Until its first save has ended: nothing can be done to it while the browser takes it.
      saving: true,
      error: null,
    };
    setUnsaved((now) => [made, ...now]);
    setSelectedId(rowIdOf(made));
    const place = await holding;
    const held = await place?.put(made).then(
      () => true,
      () => false,
    );
    if (held && mounted.current) {
      setUnsaved((now) => now.map((each) => (each.id === made.id ? { ...each, held } : each)));
    }
    const kept = await saveUnsaved(made);
    // A take that could not be saved says so, and stays in the list.
    if (kept && endedBy) {
      show(
        endedBy.reason
          ? `The recording stopped (${endedBy.reason.message}). What was recorded is kept.`
          : "The microphone stopped, so the recording ended. What was recorded is kept.",
      );
    } else if (kept && atLimit) {
      show(endedAtLimit(limit));
    }
  }, [bound, holding, keepOnto, saveUnsaved, show]);
  // All of it counts for the next window: the stop, the hold and the save.
  const finish = useCallback(() => tracked(finishNow()), [finishNow]);
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // A take that ended by itself before it was the window's take is finished once it is.
  useEffect(() => {
    if (take && !take.saving && ended.current && ended.current.take === recorder.current) {
      void finishRef.current();
    }
  }, [take]);

  // A take's clock, levels and waveform, a frame at a time, until it is paused or ends. A hidden
  // page gets no animation frames while the recorder goes on, so a timer, which runs there too,
  // ends the take at the longest a recording gets.
  const takeRunning = take !== null && !take.paused && !take.saving;
  useEffect(() => {
    if (!takeRunning) return;
    let frameId = requestAnimationFrame(function step() {
      const running = recorder.current;
      if (!running) return;
      const elapsed = running.elapsed();
      const level = running.level();
      setTake((now) => (now ? grown(now, elapsed, level) : now));
      const onto = latest.current.take?.onto;
      if (elapsed + (onto?.at ?? 0) >= takeLimit(running, onto)) {
        void finishRef.current();
        return;
      }
      frameId = requestAnimationFrame(step);
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = () => {
      const running = recorder.current;
      if (!running) return;
      const onto = latest.current.take?.onto;
      const left = takeLimit(running, onto) - (onto?.at ?? 0) - running.elapsed();
      if (left <= 0) {
        void finishRef.current();
        return;
      }
      timer = setTimeout(limit, Math.min(left * 1000 + 20, 60_000));
    };
    limit();
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timer);
    };
  }, [takeRunning]);

  // A window that closes with a take under way stops it and saves it once, as best it can; one
  // whose recorder started only after the window closed is stopped and saved the same way.
  // Closing from the window's own close button asks first (`close`).
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const running = recorder.current;
      const { take, drive: store } = latest.current;
      recorder.current = null;
      if (!running) return;
      stopWithoutWindow(
        running,
        store,
        holdingNow.current,
        take?.title ?? takeTitle.current ?? nextTitle([]),
      );
    };
  }, []);

  // Something only this window holds: a take starting (the microphone being asked for), under
  // way, being saved, or not saved.
  const editsUnsaved = (edit?.at ?? 0) > 0;
  const atRisk = opening || take !== null || unsaved.length > 0 || editsUnsaved;

  // Leaving the page would lose it: the browser asks first.
  useEffect(() => {
    if (!atRisk) return;
    const ask = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [atRisk]);

  const { onClose, onKeyDown: onWindowKeyDown, ...windowProps } = frameProps;
  /** The close button: a window that holds a take not saved asks before it closes. */
  const close: VoiceMemosAppProps["onClose"] = onClose
    ? (event) => {
        if (!atRisk) {
          onClose(event);
          return;
        }
        const running = take !== null || opening;
        const kept = unsaved.filter((each) => each.held).length;
        const only = unsaved.length - kept;
        const notSaved = [
          kept === 0
            ? ""
            : `${kept === 1 ? "A recording is" : `${kept} recordings are`} not saved. ${kept === 1 ? "It waits" : "They wait"} in this browser for the next time Voice Memos opens.`,
          only === 0
            ? ""
            : `${only === 1 ? "A recording is" : `${only} recordings are`} not saved; closing the window loses ${only === 1 ? "it" : "them"}.`,
        ]
          .filter(Boolean)
          .join(" ");
        setConfirm({
          title: "Close Voice Memos?",
          message: [
            running
              ? canHold
                ? "A recording is under way: closing stops it and saves it. If the drive refuses it, this browser keeps it for the next time Voice Memos opens, if it has the room; if not, it is lost."
                : "A recording is under way: closing stops it and saves it once, and if the drive refuses it, it is lost."
              : "",
            notSaved,
            editsUnsaved ? "Closing loses the changes you have not saved to this recording." : "",
          ]
            .filter(Boolean)
            .join(" "),
          action: "Close",
          run: () => onClose(event),
        });
      }
    : undefined;

  /** Shows a state of the edit: the audio element gets its file, and the handles hold it whole. */
  const showStage = (memo: VoiceMemoFile, next: EditStage) => {
    audioRef.current?.pause();
    setSource({ id: memo.id, url: URL.createObjectURL(next.blob), blob: next.blob });
    setReady(false);
    setPlaying(false);
    setPosition(0);
    setTrim({ start: 0, end: next.decoded.duration });
  };

  /** Ends the trim, leaving the recording as it was on the drive. */
  const leaveTrim = () => {
    const first = edit?.stages[0];
    if (selected && first && edit?.at) showStage(selected, first);
    setEdit(null);
    setTrim(null);
  };

  const beginTake = (onto?: TakeOnto) => {
    if (starting.current || take || busy !== null || memos === null) return;
    starting.current = true;
    setOpening(true);
    setNotice(null);
    if (trim) leaveTrim();
    setInDeleted(false);
    audioRef.current?.pause();
    // The take's id keeps it apart while it is unsaved; its title is the first number of the place's
    // name, or of "New Recording", not in use, and a save of it, or any retry, keeps it under that name.
    const id = newTakeId();
    const title = nextTitle([...memos, ...unsaved, ...deleted], placeName.current ?? undefined);
    setPlaceAsked((times) => times + 1);
    // Started within the press: the take's audio context counts it as the person's gesture. A
    // take that ends by itself (the recorder failed, the microphone went away) is finished and
    // kept, and its microphone released.
    startTake(
      (which, reason) => {
        ended.current = { take: which, reason };
        if (recorder.current === which) void finishRef.current();
      },
      { lossless: preferences.audioQuality === "lossless" },
    ).then(
      (running) => {
        starting.current = false;
        if (!mounted.current) {
          // The window closed while the microphone was being opened: the take is kept anyway.
          stopWithoutWindow(running, drive, bound, title);
          return;
        }
        setOpening(false);
        recorder.current = running;
        takeTitle.current = title;
        setTake({ id, title, onto, paused: false, elapsed: 0, samples: [], saving: false });
        setView("editor");
      },
      (error) => {
        starting.current = false;
        if (mounted.current) setOpening(false);
        show(messageOf(error));
      },
    );
  };

  const record = () => beginTake();

  // A saved recording takes more from the playhead on, within the longest a recording gets; its
  // sound must be decodable, since saving decodes it.
  const canAddTo =
    selected !== undefined &&
    source?.id === selected.id &&
    decodedNow != null &&
    ready &&
    !take &&
    busy === null &&
    !opening &&
    !trim &&
    fileDuration <= MAX_EDITED_DURATION &&
    position < MAX_EDITED_DURATION;
  const atEnd = position >= fileDuration - 0.05;
  const addTo = () => {
    if (!canAddTo || !selected || !source || !decodedNow) return;
    setPicked([]);
    beginTake({
      memo: selected,
      blob: source.blob,
      at: Math.min(position, fileDuration),
      duration: fileDuration,
      peaks: decodedNow.peaks,
    });
  };

  const pauseOrResume = () => {
    const running = recorder.current;
    if (!running || !take || take.saving) return;
    if (running.paused) running.resume();
    else running.pause();
    setTake({ ...take, paused: running.paused, elapsed: running.elapsed() });
  };

  // The end a seek stops at: none known for a file whose length was not found.
  const end = fileDuration > 0 ? fileDuration : Number.POSITIVE_INFINITY;
  const seek = (to: number) => {
    const target = clamp(to, 0, end);
    const audio = audioRef.current;
    if (audio && ready) {
      audio.currentTime = target;
      // The browser stops a seek at the end of a file whose length only it knows.
      setPosition(audio.currentTime);
    } else {
      setPosition(target);
    }
  };

  const play = () => {
    const audio = audioRef.current;
    if (!audio || !ready || (!selected && !selectedUnsaved && !chosenDeleted)) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (audio.ended || (fileDuration > 0 && position >= fileDuration - 0.05)) {
      audio.currentTime = 0;
    }
    if (selected && opened.current !== selected.id) {
      opened.current = selected.id;
      drive.opened(selected.id);
    }
    audio.play().catch((error: unknown) => {
      // A play that a pause or a new file interrupted is no failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      show(`The recording could not be played: ${messageOf(error)}`);
    });
  };

  const beginRename = (id: string) => {
    const memo = memos?.find((each) => each.id === id);
    if (memo && busy === null && !take) setRenaming({ id, title: memo.title });
  };

  /** A double click or Return on a row: its title becomes a field. */
  const beginRowRename = (id: string) => {
    if (memos?.some((each) => each.id === id) && busy === null && !take) setRenamingRow(id);
  };

  const renameTo = async (id: string, typed: string) => {
    const memo = memos?.find((each) => each.id === id);
    const title = typed.trim();
    if (!memo || !title || title === memo.title) return;
    setBusy(`Renaming “${memo.title}”…`);
    try {
      const renamed = await drive.rename(memo.id, `${title}${memo.extension}`);
      if (mounted.current) {
        setMemos((now) =>
          newestFirst([...(now ?? []).filter((each) => each.id !== renamed.id), renamed]),
        );
      }
    } catch (error) {
      show(`“${memo.title}” could not be renamed: ${messageOf(error)}`);
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const rename = async () => {
    const pending = renaming;
    setRenaming(null);
    if (pending) await renameTo(pending.id, pending.title);
  };

  const renameToNow = useRef(renameTo);
  renameToNow.current = renameTo;
  // Stable: a row's field stays the same while the window goes on rendering around it.
  const endRowRename = useCallback((title: string | null) => {
    const id = renamingRowNow.current;
    setRenamingRow(undefined);
    if (id !== undefined && title !== null) void renameToNow.current(id, title);
  }, []);

  const remove = async () => {
    const doomed = chosenMemos;
    const first = doomed[0];
    if (!first || busy !== null || take) return;
    audioRef.current?.pause();
    setTrim(null);
    setEdit(null);
    setBusy(
      doomed.length === 1
        ? `Moving “${first.title}” to the Trash…`
        : `Moving ${doomed.length} recordings to the Trash…`,
    );
    const list = memos ?? [];
    const at = list.findIndex((each) => each.id === first.id);
    for (const memo of doomed) {
      try {
        await drive.trash(memo.id);
        if (!mounted.current) return;
        setMemos((now) => now?.filter((each) => each.id !== memo.id) ?? now);
      } catch (error) {
        show(`“${memo.title}” could not be moved to the Trash: ${messageOf(error)}`);
        if (mounted.current) setBusy(null);
        return;
      }
    }
    const rest = list.filter((each) => !doomed.includes(each));
    setSelectedId(rest[Math.min(Math.max(at, 0), rest.length - 1)]?.id);
    setView("library");
    setBusy(null);
  };

  /** Puts the chosen deleted recordings back among the recordings. */
  const recover = async () => {
    const store = drive.deleted;
    const first = chosenGone[0];
    if (!first || !store || busy !== null || take) return;
    audioRef.current?.pause();
    setBusy(
      chosenGone.length === 1
        ? `Recovering “${first.title}”…`
        : `Recovering ${chosenGone.length} recordings…`,
    );
    for (const memo of chosenGone) {
      try {
        await store.recover(memo.id);
      } catch (error) {
        show(`“${memo.title}” could not be recovered: ${messageOf(error)}`);
        break;
      }
    }
    if (mounted.current) setBusy(null);
  };

  /** Asks, then deletes the chosen deleted recordings for good. */
  const erase = () => {
    const doomed = chosenGone;
    const first = doomed[0];
    const store = drive.deleted;
    if (!first || !store || busy !== null || take) return;
    const named = doomed.length === 1 ? `“${first.title}”` : `${doomed.length} recordings`;
    setConfirm({
      title: `Delete ${named} forever?`,
      message: "You can’t undo this action.",
      action: "Delete",
      run: () => {
        audioRef.current?.pause();
        setBusy(`Deleting ${named}…`);
        void (async () => {
          for (const memo of doomed) {
            try {
              await store.erase(memo.id);
            } catch (error) {
              show(`“${memo.title}” could not be deleted: ${messageOf(error)}`);
              break;
            }
          }
          if (mounted.current) setBusy(null);
        })();
      },
    });
  };

  const canTrim = selected !== undefined && fileDuration > 0 && ready && !take && busy === null;
  const beginTrim = () => {
    if (!canTrim || !source) return;
    audioRef.current?.pause();
    setPicked([]);
    setView("editor");
    setEdit({
      stages: [
        {
          blob: source.blob,
          decoded: decodedNow ?? { duration: fileDuration, peaks: NO_SAMPLES },
        },
      ],
      at: 0,
    });
    setTrim({ start: 0, end: fileDuration });
  };

  /** Trim or Delete: a new state of the edit, shown and playing, which Save then keeps. */
  const applyEdit = async (
    verb: string,
    change: (
      channels: readonly Float32Array[],
      sampleRate: number,
      range: TrimRange,
    ) => Float32Array[],
  ) => {
    const range = trim;
    const memo = selected;
    if (!range || !memo || !edit || !stage || busy !== null) return;
    audioRef.current?.pause();
    setBusy(`${verb} “${memo.title}”…`);
    try {
      const next = await changedStage(stage.blob, (channels, rate) =>
        change(channels, rate, range),
      );
      if (!mounted.current) return;
      setEdit({ stages: [...edit.stages.slice(0, edit.at + 1), next], at: edit.at + 1 });
      showStage(memo, next);
    } catch (error) {
      show(`“${memo.title}” could not be changed: ${messageOf(error)}`);
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const moveEdit = (at: number) => {
    const next = edit?.stages[at];
    if (!edit || !next || !selected || busy !== null) return;
    setEdit({ ...edit, at });
    showStage(selected, next);
  };
  const canUndo = trim !== null && (edit?.at ?? 0) > 0 && busy === null;
  const canRedo = trim !== null && edit !== null && edit.at < edit.stages.length - 1 && !busy;
  const undo = () => {
    if (canUndo && edit) moveEdit(edit.at - 1);
  };
  const redo = () => {
    if (canRedo && edit) moveEdit(edit.at + 1);
  };
  const undoRedo = useRef({ undo, redo });
  undoRedo.current = { undo, redo };
  // On the document, before the menu that may still hold the focus: Trim, Delete and Revert go dim
  // once pressed and a menu keeps the focus as it closes, so it is rarely in the window here.
  const editOpen = edit !== null;
  useEffect(() => {
    if (!editOpen) return;
    const key = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      if ((event.target as Element | null)?.closest?.("input, textarea")) return;
      const state = frame?.getAttribute("data-window-state");
      if (state !== null && state !== "key") return;
      event.preventDefault();
      if (event.shiftKey) undoRedo.current.redo();
      else undoRedo.current.undo();
    };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [editOpen, frame]);

  const saveTrim = async () => {
    const range = trim;
    const memo = selected;
    if (!range || !memo || !edit || !stage || busy !== null) return;
    const whole = keepsWhole(range, fileDuration);
    if (whole && edit.at === 0) {
      setEdit(null);
      setTrim(null);
      return;
    }
    if (range.end - range.start > MAX_EDITED_DURATION) {
      show(`“${memo.title}” could not be trimmed: ${TOO_LONG_TO_EDIT} Keep no more than that.`);
      return;
    }
    audioRef.current?.pause();
    setBusy(`Trimming “${memo.title}”…`);
    try {
      // Handles moved and not yet pressed Trim: Save keeps what they hold.
      const final = whole
        ? stage
        : await changedStage(stage.blob, (channels, rate) => cutChannels(channels, rate, range));
      const made = await drive.replace(memo, final.blob, `${memo.title}.wav`);
      decodedById.set(made.id, final.decoded);
      handoff.current = { id: made.id, blob: final.blob };
      if (!mounted.current) return;
      setMemos((now) =>
        newestFirst([
          ...(now ?? []).filter((each) => each.id !== memo.id && each.id !== made.id),
          made,
        ]),
      );
      setSelectedId(made.id);
      setEdit(null);
      setTrim(null);
    } catch (error) {
      show(`“${memo.title}” could not be trimmed: ${messageOf(error)}`);
    } finally {
      if (mounted.current) setBusy(null);
    }
  };

  const listKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      if (chosenDeleted) erase();
      else if (selectedUnsaved && chosenMemos.length === 0) discard();
      else void remove();
    }
  };

  // Rows again only when the recordings, their lengths or the day change. The takes not saved
  // come first, newest first, saying so where the date goes.
  const day = new Date().toDateString();
  const decodedCount = decodedById.size;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the day and the count of decodings stand for the clock and the decodings, which live outside React
  const rows = useMemo<VoiceMemosListItem[]>(() => {
    const now = Date.now();
    if (inDeleted) {
      return deleted.map((memo) => ({
        id: memo.id,
        title: memo.title,
        date: formatMemoDate(memo.deleted ?? memo.created, now),
        duration: decodedById.get(memo.id)?.duration,
      }));
    }
    return [
      ...unsaved.map((each) => ({
        id: rowIdOf(each),
        title: each.title,
        date: formatMemoDate(each.created, now),
        status: each.saving ? "Saving…" : "Not saved",
        duration: decodedById.get(rowIdOf(each))?.duration,
      })),
      ...(memos ?? []).map((memo) => ({
        id: memo.id,
        title: memo.title,
        date: formatMemoDate(memo.created, now),
        duration: decodedById.get(memo.id)?.duration,
      })),
    ];
  }, [memos, unsaved, deleted, inDeleted, day, decodedCount]);

  const taking = take !== null;
  const editing =
    view === "editor" &&
    (taking ||
      selected !== undefined ||
      selectedUnsaved !== undefined ||
      chosenDeleted !== undefined);
  const title =
    take?.onto?.memo.title ??
    take?.title ??
    selected?.title ??
    selectedUnsaved?.title ??
    chosenDeleted?.title ??
    "Voice Memos";
  const onto = take?.onto;
  const duration = take
    ? onto
      ? Math.max(onto.duration, onto.at + take.elapsed)
      : take.elapsed
    : fileDuration;
  const shownPosition = take ? (onto?.at ?? 0) + take.elapsed : Math.min(position, end);
  // The waveform of a recording of unknown length has no playhead to place.
  const waveformPosition = Math.min(shownPosition, duration);
  const samples = take
    ? onto
      ? splicePeaks(onto.peaks, take.samples, onto.at)
      : take.samples
    : (stage?.decoded.peaks ?? decodedNow?.peaks ?? NO_SAMPLES);
  const idle = busy === null && !taking;
  const anchor = frame?.querySelector<HTMLElement>("[data-window-drag-region]") ?? frame;

  const duplicate = async () => {
    const originals = chosenMemos;
    const first = originals[0];
    if (!first || !idle || trim) return;
    setBusy(
      originals.length === 1
        ? `Duplicating “${first.title}”…`
        : `Duplicating ${originals.length} recordings…`,
    );
    const copies: string[] = [];
    for (const memo of originals) {
      try {
        const blob = source?.id === memo.id ? source.blob : await drive.read(memo.id);
        const copy = await drive.save(
          blob,
          `${memo.title} copy${memo.extension}`,
          undefined,
          bound.session,
        );
        if (!mounted.current) return;
        copies.push(copy.id);
        setMemos((now) =>
          newestFirst([...(now ?? []).filter((each) => each.id !== copy.id), copy]),
        );
      } catch (error) {
        show(`“${memo.title}” could not be duplicated: ${messageOf(error)}`);
        break;
      }
    }
    if (!mounted.current) return;
    if (copies.length > 0) {
      setPicked(copies);
      setSelectedId(copies[copies.length - 1]);
    }
    setBusy(null);
  };
  const renameSelected = () => {
    if (selected) beginRename(selected.id);
  };
  const newDisabled = !idle || memos === null;
  const noneChosen = !selected || !idle;
  // A title names one recording: not offered for several.
  const noRename = noneChosen || chosenMemos.length > 1;
  // The chosen recordings' files, for a Share menu.
  const toShare = chosenMemos.map((memo) => ({
    id: memo.id,
    name: memo.name,
    kind: "file" as const,
    type: memo.type,
  }));
  const openEditor = () => {
    setPicked([]);
    setView("editor");
  };
  /** A press on a row, which may become a drag: of the chosen rows, when it is one of them. */
  const pressRow = (down: PointerEvent, id: string) => {
    const pressed = (memos ?? []).find((memo) => memo.id === id);
    if (inDeleted || !pressed || renamingRow === id) return;
    const dragged = chosenIds.includes(id) ? chosenMemos : [pressed];
    beginDesktopDrag(down, {
      from: "voice-memos",
      items: () =>
        dragged.map((memo) => ({
          id: memo.id,
          name: memo.name,
          kind: "file" as const,
          type: memo.type,
          size: memo.size,
        })),
    });
  };
  useNowPlaying({
    playing,
    title,
    position: () => audioRef.current?.currentTime ?? 0,
    play: () => {
      if (audioRef.current?.paused) play();
    },
    pause: () => audioRef.current?.pause(),
    seek,
  });

  // Where the person is, kept once they stop moving, and as the window closes. A playing recording
  // is kept when it stops, not on every frame.
  const placeNow: VoiceMemosPlace | null = selected
    ? {
        recording: selected.id,
        position:
          restoring.current?.id === selected.id
            ? restoring.current.position
            : source?.id === selected.id
              ? Math.round(position * 100) / 100
              : 0,
        sidebar: view === "library",
      }
    : null;
  const lastPlace = useRef(placeNow);
  lastPlace.current = placeNow;
  const savesPlace = valuesLoaded && !taking;
  const savesPlaceNow = useRef(savesPlace);
  savesPlaceNow.current = savesPlace;
  const placeKey = placeNow && `${placeNow.recording}|${playing ? "" : placeNow.position}|${view}`;
  useEffect(() => {
    if (!savesPlace || !placeRead.current || !placeKey) return;
    const timer = setTimeout(() => {
      if (lastPlace.current) keepPlace(lastPlace.current);
    }, PLACE_SAVE_MS);
    return () => clearTimeout(timer);
  }, [placeKey, savesPlace]);
  useEffect(
    () => () => {
      if (savesPlaceNow.current && placeRead.current && lastPlace.current) {
        keepPlace(lastPlace.current);
      }
    },
    [],
  );
  /** The rows the list now holds: the shown recording is the one just added, else stays. */
  const chooseRows = (ids: readonly string[]) => {
    if (ids.length === 0) return;
    setPicked(ids);
    const added = ids.find((id) => !chosenIds.includes(id));
    setSelectedId(
      added ?? (selectedId !== undefined && ids.includes(selectedId) ? selectedId : ids[0]),
    );
  };
  const rowMenu = (id: string) => {
    if (chosenIds.includes(id)) return;
    setPicked([id]);
    setSelectedId(id);
  };
  const listedIds = recordingsMatching(rows, query).map((row) => row.id);
  /** Every row the list shows is chosen; the recording shown stays, if it is among them. */
  const chooseAll = () => {
    if (editing || !idle || listedIds.length === 0) return;
    setPicked(listedIds);
    if (selectedId === undefined || !listedIds.includes(selectedId)) setSelectedId(listedIds[0]);
  };
  /** While trimming, the handles go to the two ends of the recording. */
  const holdWhole = () => {
    if (trim && busy === null) setTrim({ start: 0, end: fileDuration });
  };
  useDesktopAppMenu(
    "voice-memos",
    "File",
    <>
      <MenuItem keyEquivalent="command+n" disabled={newDisabled} onClick={record}>
        New Recording
      </MenuItem>
      <MenuItem disabled={noneChosen || trim !== null} onClick={() => void duplicate()}>
        Duplicate
      </MenuItem>
      <Submenu>
        <SubmenuTrigger disabled={noneChosen}>Share</SubmenuTrigger>
        <SubmenuPopup>
          <FileShareItems items={toShare} from="voice-memos" />
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
    </>,
    frame,
  );
  useDesktopAppMenu(
    "voice-memos",
    "Edit",
    <>
      {edit ? (
        <>
          <MenuItem keyEquivalent="command+z" disabled={!canUndo} onClick={undo}>
            Undo
          </MenuItem>
          <MenuItem keyEquivalent="shift+command+z" disabled={!canRedo} onClick={redo}>
            Redo
          </MenuItem>
          <MenuSeparator />
          <MenuItem keyEquivalent="command+x" disabled title={NO_SOUND_CLIPBOARD}>
            Cut
          </MenuItem>
          <MenuItem keyEquivalent="command+c" disabled title={NO_SOUND_CLIPBOARD}>
            Copy
          </MenuItem>
          <MenuItem keyEquivalent="command+v" disabled title={NO_SOUND_CLIPBOARD}>
            Paste
          </MenuItem>
          <MenuItem keyEquivalent="command+a" disabled={busy !== null} onClick={holdWhole}>
            Select All
          </MenuItem>
        </>
      ) : (
        <EditRows
          nothing="Click in the search field, or select text, first."
          selectAll={{
            enabled: !editing && idle && listedIds.length > 0,
            title: editing
              ? "The list of recordings is hidden: click Done first."
              : "The list shows no recordings to select.",
            run: chooseAll,
          }}
          say={show}
        />
      )}
      <MenuSeparator />
      <MenuItem disabled={noRename} onClick={renameSelected}>
        Rename
      </MenuItem>
      <MenuItem
        disabled={noneChosen && !(chosenDeleted && idle)}
        onClick={() => (chosenDeleted ? erase() : void remove())}
      >
        Delete
      </MenuItem>
      <MenuSeparator />
      <MenuItem keyEquivalent="command+t" disabled={!canTrim} onClick={beginTrim}>
        Trim Recording
      </MenuItem>
      <MenuItem
        disabled={!canAddTo || atEnd}
        title={fileDuration > MAX_EDITED_DURATION ? TOO_LONG_TO_EDIT : undefined}
        onClick={addTo}
      >
        Replace
      </MenuItem>
    </>,
    frame,
  );
  useDesktopAppMenu(
    "voice-memos",
    "View",
    <MenuItem
      disabled={taking || (!selected && !selectedUnsaved && !chosenDeleted)}
      onClick={() => (editing ? setView("library") : openEditor())}
    >
      {editing ? "Show Sidebar" : "Hide Sidebar"}
    </MenuItem>,
    frame,
  );
  const onFrameKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onWindowKeyDown?.(event);
    if (event.defaultPrevented) return;
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, [role='slider'], button, a, [role='menu']")) {
      if (!(event.metaKey || event.ctrlKey)) return;
    }
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key === ",") {
      event.preventDefault();
      onPreferencesOpenChange?.(true);
    } else if (!event.metaKey && !event.ctrlKey && event.key === " ") {
      event.preventDefault();
      if (take) pauseOrResume();
      else play();
    } else if (
      !event.metaKey &&
      !event.ctrlKey &&
      !taking &&
      ready &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      event.preventDefault();
      seek(shownPosition + (event.key === "ArrowLeft" ? -ARROW_STEP : ARROW_STEP));
    } else if ((event.metaKey || event.ctrlKey) && !event.shiftKey && key === "n") {
      event.preventDefault();
      if (!newDisabled) record();
    } else if ((event.metaKey || event.ctrlKey) && !event.shiftKey && key === "t") {
      event.preventDefault();
      beginTrim();
    } else if (
      (event.metaKey || event.ctrlKey) &&
      !event.shiftKey &&
      key === "a" &&
      !target.closest("input, textarea")
    ) {
      event.preventDefault();
      if (trim) holdWhole();
      else chooseAll();
    }
  };

  return (
    <VoiceMemosFrame
      {...windowProps}
      onKeyDown={onFrameKeyDown}
      onClose={close}
      ref={setFrameRef}
      aria-busy={busy !== null || memos === null || undefined}
      title={title}
      toolbar={
        <Toolbar aria-label="Voice Memos toolbar">
          <ToolbarSpace />
          {editing ? (
            <VoiceMemosTrimButton
              disabled={busy !== null || (!canTrim && trim === null)}
              pressed={trim !== null}
              onPressedChange={(on) => (on ? beginTrim() : leaveTrim())}
            />
          ) : inDeleted ? (
            <>
              <ToolbarButton disabled={!chosenDeleted || !idle} onClick={() => void recover()}>
                Recover
              </ToolbarButton>
              <ToolbarButton disabled={!chosenDeleted || !idle} onClick={erase}>
                Delete
              </ToolbarButton>
            </>
          ) : selectedUnsaved ? (
            <>
              <ToolbarButton disabled={selectedUnsaved.saving || taking} onClick={retry}>
                Retry
              </ToolbarButton>
              <ToolbarButton disabled={selectedUnsaved.saving} onClick={discard}>
                Discard
              </ToolbarButton>
            </>
          ) : (
            <>
              <ToolbarButton disabled={noRename} onClick={renameSelected}>
                Rename
              </ToolbarButton>
              <ShareMenu disabled={noneChosen}>
                <FileShareItems items={toShare} from="voice-memos" />
              </ShareMenu>
              <ToolbarButton disabled={!selected || !idle} onClick={() => void remove()}>
                Delete
              </ToolbarButton>
              <ToolbarButton disabled={!selected} onClick={openEditor}>
                Edit
              </ToolbarButton>
            </>
          )}
        </Toolbar>
      }
      sidebar={
        editing ? undefined : (
          <CatalystSidebar aria-label="Recordings" width={SIDEBAR_WIDTH}>
            <ContextualMenu>
              <ContextualMenuTrigger className="mac-voice-memos-library-menu">
                <VoiceMemosLibrary
                  recordings={rows}
                  query={query}
                  onQueryChange={setQuery}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  selection={chosenIds}
                  onSelectionChange={chooseRows}
                  onRowAction={inDeleted ? () => {} : beginRowRename}
                  renamingId={renamingRow}
                  onRenameEnd={endRowRename}
                  onRowPress={pressRow}
                  onRowMenu={rowMenu}
                  onNew={record}
                  newDisabled={newDisabled}
                  emptyText={
                    memos === null
                      ? "Loading…"
                      : inDeleted
                        ? "No Recently Deleted Recordings"
                        : "No Recordings"
                  }
                  onListKeyDown={listKey}
                  footer={
                    drive.deleted ? (
                      <button
                        type="button"
                        className="mac-voice-memos-place"
                        onClick={() => {
                          audioRef.current?.pause();
                          setSelectedId(undefined);
                          setInDeleted((now) => !now);
                        }}
                      >
                        {inDeleted ? "All Recordings" : "Recently Deleted"}
                      </button>
                    ) : null
                  }
                />
              </ContextualMenuTrigger>
              <ContextualMenuPopup>
                {inDeleted ? (
                  <>
                    <MenuItem disabled={!chosenDeleted || !idle} onClick={() => void recover()}>
                      Recover
                    </MenuItem>
                    <MenuItem disabled={!chosenDeleted || !idle} onClick={erase}>
                      Delete
                    </MenuItem>
                  </>
                ) : (
                  <>
                    <MenuItem disabled={noRename} onClick={renameSelected}>
                      Rename
                    </MenuItem>
                    <MenuItem disabled={noneChosen} onClick={() => void duplicate()}>
                      Duplicate
                    </MenuItem>
                    <Submenu>
                      <SubmenuTrigger disabled={noneChosen}>Share</SubmenuTrigger>
                      <SubmenuPopup>
                        <FileShareItems items={toShare} from="voice-memos" />
                      </SubmenuPopup>
                    </Submenu>
                    <MenuItem
                      disabled={noRename}
                      onClick={() => selected && showInFinder({ id: selected.id })}
                    >
                      Show in Finder
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem disabled={noneChosen} onClick={() => void remove()}>
                      Delete
                    </MenuItem>
                  </>
                )}
              </ContextualMenuPopup>
            </ContextualMenu>
          </CatalystSidebar>
        )
      }
    >
      {notice || busy ? (
        <div className="mac-voice-memos-notices">
          {notice ? (
            <WindowBanner
              role="alert"
              title={notice.message}
              trailing={<WindowBannerAction onClick={() => setNotice(null)}>OK</WindowBannerAction>}
            >
              {notice.message}
            </WindowBanner>
          ) : null}
          {busy ? <WindowBanner role="status">{busy}</WindowBanner> : null}
        </div>
      ) : null}
      {taking || selected || selectedUnsaved || chosenDeleted ? (
        <>
          <VoiceMemosWaveform
            title={title}
            samples={samples}
            duration={duration}
            position={waveformPosition}
            onSeek={seek}
            disabled={taking}
          >
            {trim && !taking ? (
              <VoiceMemosTrimHandles
                range={trim}
                duration={fileDuration}
                onStartChange={(value) => {
                  const next = moveTrimStart(trim, value);
                  setTrim(next);
                  seek(next.start);
                }}
                onEndChange={(value) => {
                  const next = moveTrimEnd(trim, value, fileDuration);
                  setTrim(next);
                  seek(next.end);
                }}
              />
            ) : null}
          </VoiceMemosWaveform>
          {trim && !taking ? (
            <VoiceMemosTrimActions
              holdsWhole={keepsWhole(trim, fileDuration)}
              unchanged={(edit?.at ?? 0) === 0}
              disabled={busy !== null}
              onRevert={() => moveEdit(0)}
              onDelete={() =>
                void applyEdit("Deleting from", (channels, rate, range) =>
                  removeRange(channels, rate, range),
                )
              }
              onTrim={() =>
                void applyEdit("Trimming", (channels, rate, range) =>
                  cutChannels(channels, rate, range),
                )
              }
            >
              <VoiceMemosTimer position={shownPosition} />
            </VoiceMemosTrimActions>
          ) : (
            <VoiceMemosTimer position={shownPosition} />
          )}
        </>
      ) : (
        // The content is dark in both appearances: the placeholder takes light text.
        <div className="mac-voice-memos-empty" data-appearance="dark">
          <EmptyState>
            {memos === null
              ? "Loading…"
              : (inDeleted ? deleted.length > 0 : memos.length > 0 || unsaved.length > 0)
                ? "No Recording Selected"
                : "No Recordings"}
          </EmptyState>
        </div>
      )}
      <div className="mac-voice-memos-bar">
        {editing && take ? (
          <button
            type="button"
            className="mac-voice-memos-pill"
            aria-label={take.paused ? "Resume Recording" : "Pause Recording"}
            disabled={take.saving}
            onClick={pauseOrResume}
          >
            {take.paused ? "Resume" : <RecordPauseGlyph />}
          </button>
        ) : editing && trim ? (
          <button
            type="button"
            className="mac-voice-memos-pill"
            disabled={busy !== null}
            onClick={leaveTrim}
          >
            Cancel
          </button>
        ) : editing && selected ? (
          <button
            type="button"
            className="mac-voice-memos-pill"
            aria-label={atEnd ? "Resume Recording" : "Replace Recording"}
            disabled={!canAddTo}
            title={fileDuration > MAX_EDITED_DURATION ? TOO_LONG_TO_EDIT : undefined}
            onClick={addTo}
          >
            {atEnd ? "Resume" : "Replace"}
          </button>
        ) : null}
        <VoiceMemosTransport
          playing={playing}
          playDisabled={taking || !ready}
          skipDisabled={taking || !ready}
          onPlay={play}
          onSkip={(seconds) => seek(shownPosition + seconds)}
        />
        {editing ? (
          <button
            type="button"
            className="mac-voice-memos-done"
            disabled={take ? take.saving : busy !== null}
            onClick={() => {
              if (take) void finish();
              else if (trim) void saveTrim();
              else setView("library");
            }}
          >
            {trim && !take ? "Save" : "Done"}
          </button>
        ) : null}
      </div>
      {/* No controls: the window's own transport plays it. */}
      {/* biome-ignore lint/a11y/useMediaCaption: the person's own recording comes with no captions. */}
      <audio ref={audioRef} src={source?.url} preload="auto" />
      {preferencesOpen ? (
        <VoiceMemosPreferencesPanel
          value={preferences}
          onChange={preferencesRead ? setPreferences : undefined}
          namingProblem={namingProblem}
          onClose={() => onPreferencesOpenChange?.(false)}
        />
      ) : null}
      <Sheet
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
      >
        <SheetPopup anchor={anchor} width={RENAME_SHEET_WIDTH}>
          <SheetTitle>Rename Recording</SheetTitle>
          <TextField
            aria-label="Recording name"
            value={renaming?.title ?? ""}
            onValueChange={(next) => setRenaming((now) => (now ? { ...now, title: next } : now))}
          />
          <SheetActions>
            <SheetClose>Cancel</SheetClose>
            <DefaultButton disabled={!renaming?.title.trim()} onClick={() => void rename()}>
              Rename
            </DefaultButton>
          </SheetActions>
        </SheetPopup>
      </Sheet>
      <Sheet
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <SheetPopup anchor={anchor} width={CONFIRM_SHEET_WIDTH}>
          <SheetTitle>{confirm?.title}</SheetTitle>
          <SheetDescription>{confirm?.message}</SheetDescription>
          <SheetActions>
            <SheetClose>Cancel</SheetClose>
            <DefaultButton
              onClick={() => {
                const run = confirm?.run;
                setConfirm(null);
                run?.();
              }}
            >
              {confirm?.action}
            </DefaultButton>
          </SheetActions>
        </SheetPopup>
      </Sheet>
    </VoiceMemosFrame>
  );
}
