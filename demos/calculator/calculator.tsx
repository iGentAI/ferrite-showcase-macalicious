"use client";

import {
  CalculatorKeypad,
  CalculatorKeypadDisplay,
  CalculatorKeypadKey,
} from "macalicious/calculator-keypad";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { matchesMenuKeyEquivalent } from "macalicious/lib/menu-key-commands";
import { useManagedWindow } from "macalicious/managed-window";
import { MenuCheckboxItem, MenuItem } from "macalicious/menu-item";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { useWindowManagerStore } from "macalicious/window-manager";
import {
  type ClipboardEvent,
  type ComponentType,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import type { DesktopSecondaryWindowProps } from "../desktop/desktop-apps";
import { isClosedBehind } from "../desktop/desktop-hidden";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { SpeechItems } from "../notes/notes-edit-menu";
import { whenMenusClosed } from "../notes/notes-menus";
import {
  formatProgrammer,
  fromNumber,
  initialProgrammerState,
  type ProgrammerAction,
  type ProgrammerState,
  parseProgrammer,
  programmerActionForKey,
  programmerFinished,
  reduceProgrammer,
} from "./calculator-bits";
import {
  type ConvertCategoryId,
  convert,
  type RecentConversion,
  readRecent,
  withRecent,
} from "./calculator-convert";
import {
  CalculatorConvertItems,
  ConvertSheet,
  NO_CONVERT_IN_PROGRAMMER,
  RatesUpdateSheet,
} from "./calculator-convert-menu";
import { CalculatorEditItems, type EditCommands, parsePasted } from "./calculator-edit";
import {
  type BasicOperator,
  type CalculatorAction,
  type CalculatorState,
  currentValue,
  initialCalculatorState,
  reduce,
} from "./calculator-engine";
import { ProgrammerKeypad } from "./calculator-programmer";
import { type RatesState, readRates, useExchangeRates } from "./calculator-rates";
import {
  EMPTY_BITS,
  EMPTY_STACK,
  reduceBitsRpn,
  reduceRpn,
  type Stack,
  type StackAction,
} from "./calculator-rpn";
import { type MemoryAction, ScientificRow, scientificActionForKey } from "./calculator-scientific";
import {
  CALCULATOR_SETTINGS,
  type CalculatorLayout,
  frameOf,
  MAX_DECIMALS,
  readBoolean,
  readDecimals,
  readLayout,
  readSaved,
  type SavedCalculator,
  shownText,
  useCalculatorSetting,
} from "./calculator-settings";
import { CalculatorSpeechItems, speakKey, speakResult, spokenKey } from "./calculator-speech";
import { CalculatorStackKeys } from "./calculator-stack-keys";
import { type FinishedCalculation, tapeStep, useCalculatorTape } from "./calculator-tape";
import { CalculatorTapeFileItems, printTape, TapeSaveSheet } from "./calculator-tape-file";
import { CalculatorViewItems } from "./calculator-view";
import { DesktopPaperTape } from "./paper-tape";
import "./calculator.tokens.css";
import "./calculator.css";

export interface CalculatorProps extends Omit<WindowProps, "children"> {
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. The basic window has one size. */
  onZoom?: WindowControlsProps["onZoom"];
  /**
   * For the window controls: what the green button does. Calculator has no full screen.
   * @default "zoom"
   */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom, as a window manager does for a fixed-size window. */
  zoomDisabled?: boolean;
  /**
   * Called when the primary pointer button goes down on the display, which is this window's
   * title bar: a window manager starts moving the window here. Called once the window's own
   * `onPointerDown` has run; a handler there that calls `preventDefault` cancels it. Its event's
   * `target` is the display (or an element in it) and its `currentTarget` is the window's root.
   */
  onDragRegionPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  /**
   * Called when the display is double-clicked, once the window's `onDoubleClick` has not
   * cancelled it. As for a press, `target` is the display and `currentTarget` the window's root.
   */
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
  /**
   * Given by a desktop page to an application that opens further windows. On the desktop of
   * the `macalicious-desktop` Ferrite application, Calculator opens its Paper Tape with it.
   */
  DesktopWindow?: ComponentType<DesktopSecondaryWindowProps>;
}

/** What Undo and Redo bring back. */
interface Moment {
  calculator: CalculatorState;
  expression: string;
  /** What m+ and m- add to, kept apart from the sum on the display. */
  memory: number;
  /** The Programmer layout's own number: 64 bits do not fit in `calculator`'s. */
  programmer: ProgrammerState;
  /** RPN Mode's registers above X: X itself is `calculator`'s number. */
  stack: Stack<number>;
  /** The Programmer layout's registers above X. */
  bitStack: Stack<bigint>;
  /** In RPN Mode, whether the next number pushes X up. */
  lift: boolean;
}

const UNDO_LIMIT = 100;
const SAVE_DELAY_MS = 300;

/** The calculator, the calculation being written down, and those finished but not recorded. */
interface Session extends Moment {
  /** The moments before this one for Undo, the latest last; Undo moves them to `future`. */
  past: readonly Moment[];
  future: readonly Moment[];
  /** How many changes the person made here: until the first, nothing is saved over the stored. */
  changes: number;
  /**
   * The calculations `=` finished that the tape has not taken yet, the oldest first and
   * numbered from 1, so that every one is recorded once even when several finish before the
   * page renders. None is dropped: the tape takes them all, then they are let go (`recorded`).
   */
  finished: readonly (FinishedCalculation & { seq: number })[];
  /** The number of the newest calculation finished so far. */
  seq: number;
}

/** What changes the session: a key, Undo and Redo, or the tape having taken calculations up to `seq`. */
type SessionAction =
  | CalculatorAction
  | { type: "undo" }
  | { type: "redo" }
  | ({ type: "restore" } & SavedCalculator)
  /** The saved memory, arrived after a key was pressed: the display stays the person's. */
  | { type: "restoreMemory"; memory: number }
  | { type: "recorded"; seq: number }
  | { type: "programmer"; action: ProgrammerAction }
  /** The number on the display goes with the person to another layout. */
  | { type: "carry"; from: CalculatorLayout; to: CalculatorLayout }
  /** RPN Mode goes on or off: the number on the display stays, and any sum or stack goes. */
  | { type: "rpnMode" }
  | { type: "rpn"; action: CalculatorAction | StackAction }
  | { type: "programmerRpn"; action: ProgrammerAction | StackAction }
  | MemoryAction;

const initialSession: Session = {
  calculator: initialCalculatorState,
  expression: "",
  memory: 0,
  programmer: initialProgrammerState,
  stack: EMPTY_STACK,
  bitStack: EMPTY_BITS,
  lift: true,
  past: [],
  future: [],
  changes: 0,
  finished: [],
  seq: 0,
};

function reduceSession(session: Session, action: SessionAction): Session {
  if (action.type === "recorded") {
    const finished = session.finished.filter((calculation) => calculation.seq > action.seq);
    return finished.length === session.finished.length ? session : { ...session, finished };
  }
  if (action.type === "restore") {
    return {
      ...session,
      calculator: {
        ...initialCalculatorState,
        value: action.value,
        clearable: action.value !== 0,
      },
      memory: action.memory,
      programmer: {
        ...initialProgrammerState,
        base: action.base ?? initialProgrammerState.base,
        value:
          action.programmer === undefined ? fromNumber(action.value) : BigInt(action.programmer),
      },
    };
  }
  if (action.type === "restoreMemory") {
    return session.memory === 0 ? { ...session, memory: action.memory } : session;
  }
  if (action.type === "carry") {
    if (action.from === action.to) return session;
    const { calculator, programmer } = session;
    const carried =
      action.to === "programmer"
        ? {
            programmer: {
              ...initialProgrammerState,
              base: programmer.base,
              value: fromNumber(currentValue(calculator)),
            },
          }
        : action.from === "programmer"
          ? {
              calculator: {
                ...initialCalculatorState,
                value: Number(programmer.value),
                clearable: programmer.value !== 0n,
              },
              expression: "",
            }
          : {};
    return { ...session, ...carried, past: [], future: [], changes: session.changes + 1 };
  }
  const now: Moment = {
    calculator: session.calculator,
    expression: session.expression,
    memory: session.memory,
    programmer: session.programmer,
    stack: session.stack,
    bitStack: session.bitStack,
    lift: session.lift,
  };
  const changes = session.changes + 1;
  const remembered = {
    past: [...session.past, now].slice(-UNDO_LIMIT),
    future: [] as readonly Moment[],
    changes,
  };
  const recording = (finished?: FinishedCalculation) => {
    if (!finished) return {};
    const seq = session.seq + 1;
    return { finished: [...session.finished, { ...finished, seq }], seq };
  };
  if (action.type === "rpnMode") {
    const number = currentValue(session.calculator);
    return {
      ...session,
      calculator: { ...initialCalculatorState, value: number, clearable: number !== 0 },
      expression: "",
      programmer: {
        ...initialProgrammerState,
        base: session.programmer.base,
        value: session.programmer.value,
      },
      stack: EMPTY_STACK,
      bitStack: EMPTY_BITS,
      lift: true,
      past: [],
      future: [],
      changes,
    };
  }
  if (action.type === "rpn") {
    const { calculator, stack, lift } = session;
    const next = reduceRpn({ calculator, stack, lift }, action.action);
    if (next.calculator === calculator && next.stack === stack) return session;
    return {
      ...session,
      calculator: next.calculator,
      stack: next.stack,
      lift: next.lift,
      ...remembered,
      ...recording(next.finished),
    };
  }
  if (action.type === "programmerRpn") {
    const { programmer, bitStack, lift } = session;
    const next = reduceBitsRpn({ programmer, stack: bitStack, lift }, action.action);
    if (next.programmer === programmer && next.stack === bitStack) return session;
    return {
      ...session,
      programmer: next.programmer,
      bitStack: next.stack,
      lift: next.lift,
      ...remembered,
      ...recording(next.finished),
    };
  }
  if (action.type === "undo") {
    const moment = session.past.at(-1);
    if (!moment) return session;
    const past = session.past.slice(0, -1);
    return { ...session, ...moment, past, future: [...session.future, now], changes };
  }
  if (action.type === "redo") {
    const moment = session.future.at(-1);
    if (!moment) return session;
    const future = session.future.slice(0, -1);
    return { ...session, ...moment, past: [...session.past, now], future, changes };
  }
  if (action.type === "programmer") {
    const programmer = reduceProgrammer(session.programmer, action.action);
    if (programmer === session.programmer) return session;
    const finished =
      action.action.type === "equals"
        ? programmerFinished(session.programmer, programmer)
        : undefined;
    return { ...session, programmer, ...remembered, ...recording(finished) };
  }
  if (action.type === "memory") {
    const number = currentValue(session.calculator);
    if (action.change !== "clear" && !Number.isFinite(number)) return session;
    const memory =
      action.change === "clear" ? 0 : session.memory + (action.change === "add" ? number : -number);
    if (!Number.isFinite(memory)) return session;
    // m+ and m- finish the number: the next digit starts another.
    const calculator =
      action.change === "clear"
        ? session.calculator
        : { ...session.calculator, entry: null, value: number };
    return { ...session, calculator, memory, lift: true, ...remembered };
  }
  const calculator = reduce(session.calculator, action);
  if (calculator === session.calculator) return session;
  const { expression, finished } = tapeStep(
    session.expression,
    session.calculator,
    action,
    calculator,
  );
  return { ...session, calculator, expression, ...remembered, ...recording(finished) };
}

/** The key equivalents of Calculator's basic mode. */
function actionForKey(event: KeyboardEvent): CalculatorAction | null {
  if (event.ctrlKey || event.metaKey) return null;
  // Option-minus changes the sign; with Option held the key itself types a dash.
  if (event.altKey) return event.code === "Minus" ? { type: "negate" } : null;
  const { key } = event;
  if (/^[0-9]$/.test(key)) return { type: "digit", digit: key };
  switch (key) {
    case ".":
    case ",":
      return { type: "decimal" };
    case "+":
      return { type: "operator", operator: "add" };
    case "-":
      return { type: "operator", operator: "subtract" };
    case "*":
      return { type: "operator", operator: "multiply" };
    case "/":
      return { type: "operator", operator: "divide" };
    case "=":
    case "Enter":
      return { type: "equals" };
    case "%":
      return { type: "percent" };
    case "Escape":
    case "c":
    case "C":
      return { type: "clear" };
    case "Backspace":
    case "Delete":
      return { type: "delete" };
    default:
      return null;
  }
}

const OPERATORS: Record<BasicOperator, CalculatorAction> = {
  add: { type: "operator", operator: "add" },
  subtract: { type: "operator", operator: "subtract" },
  multiply: { type: "operator", operator: "multiply" },
  divide: { type: "operator", operator: "divide" },
};

/**
 * A window of the desktop takes its frame from the manager, so each layout's size is set there. The
 * window registers after this first renders, so the frame is watched rather than read once.
 */
function DesktopFrame({ size: { width, height } }: { size: { width: number; height: number } }) {
  const store = useWindowManagerStore();
  const { id } = useManagedWindow();
  const frame = useSyncExternalStore(
    store.subscribe,
    () => store.get(id)?.frame,
    () => undefined,
  );
  useLayoutEffect(() => {
    if (frame && (frame.width !== width || frame.height !== height)) {
      store.patch(id, { frame: { ...frame, width, height } });
    }
  }, [store, id, frame, width, height]);
  return null;
}

/**
 * Says when the desktop has taken this window off the screen and kept it only for its further
 * windows, which it does for a main window the person closed.
 */
function WhenClosedBehind({ onClosed }: { onClosed: () => void }) {
  const store = useWindowManagerStore();
  const { id } = useManagedWindow();
  const minimized = useSyncExternalStore(
    store.subscribe,
    () => store.get(id)?.minimized,
    () => undefined,
  );
  useEffect(() => {
    if (minimized && isClosedBehind(id)) onClosed();
  }, [minimized, id, onClosed]);
  return null;
}

const NO_RECENT: readonly RecentConversion[] = [];
const REGISTERS = ["T", "Z", "Y"] as const;

/**
 * Catalina's Calculator in its basic mode, as one window.
 *
 * The root is the library's `Window` and takes its props (`state`, `width`, `height`, `style`,
 * `ref`, pointer and focus handlers), so a window manager can host it; the eight props above
 * go to the window controls and to the display, which is this window's drag region. They are
 * the props a managed window's `render` supplies. The window is drawn dark in both
 * appearances, as Calculator's is.
 *
 * Keys typed while focus is anywhere in the window work the calculator.
 */
export function Calculator({
  onClose,
  onMinimize,
  onZoom,
  zoomRole = "zoom",
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  DesktopWindow,
  onKeyDown,
  onPointerDown,
  onDoubleClick,
  onClickCapture,
  width = 232,
  height = 321,
  className,
  ...windowProps
}: CalculatorProps) {
  const [session, dispatch] = useReducer(reduceSession, initialSession);
  const state = session.calculator;
  // The paper tape, kept by the Ferrite application's server; nothing anywhere else.
  const tape = useCalculatorTape();
  const [tapeOpen, setTapeOpen] = useCalculatorSetting(
    CALCULATOR_SETTINGS.tapeOpen,
    readBoolean,
    false,
  );
  // Calculator quits with its window: the tape goes too, and is open again at the next launch.
  const [quitting, setQuitting] = useState(false);
  const [pasteRefused, setPasteRefused] = useState(false);
  const displayElement = useRef<HTMLOutputElement>(null);
  const [layout, setLayout] = useCalculatorSetting<CalculatorLayout>(
    CALCULATOR_SETTINGS.layout,
    readLayout,
    "basic",
  );
  const [separators, setSeparators] = useCalculatorSetting(
    CALCULATOR_SETTINGS.separators,
    readBoolean,
    false,
  );
  const [decimals, setDecimals] = useCalculatorSetting(
    CALCULATOR_SETTINGS.decimals,
    readDecimals,
    MAX_DECIMALS,
  );
  const [saved, setSaved] = useCalculatorSetting<SavedCalculator | null>(
    CALCULATOR_SETTINGS.saved,
    readSaved,
    null,
  );
  const [degrees, setDegrees] = useCalculatorSetting(
    CALCULATOR_SETTINGS.degrees,
    readBoolean,
    true,
  );
  const [second, setSecond] = useState(false);
  const [rpn, setRpn] = useCalculatorSetting(CALCULATOR_SETTINGS.rpn, readBoolean, false);
  const [speakButtons, setSpeakButtons] = useCalculatorSetting(
    CALCULATOR_SETTINGS.speakButtons,
    readBoolean,
    false,
  );
  const [speakResults, setSpeakResults] = useCalculatorSetting(
    CALCULATOR_SETTINGS.speakResults,
    readBoolean,
    false,
  );
  const [recent, setRecent] = useCalculatorSetting(
    CALCULATOR_SETTINGS.recent,
    readRecent,
    NO_RECENT,
  );
  const [converting, setConverting] = useState<ConvertCategoryId | null>(null);
  const ratesServed = servedByDesktopApp();
  const exchange = useExchangeRates(ratesServed && converting !== null);
  const [ratesNotice, setRatesNotice] = useState<RatesState | null>(null);
  const [savingTape, setSavingTape] = useState(false);
  const sheetAnchor = useRef<HTMLSpanElement>(null);
  const windowRoot = () => displayElement.current?.closest<HTMLElement>(".mac-calculator") ?? null;

  // The settings may load after the window opens: the display comes back unless a key came first.
  const { changes } = session;
  const restored = useRef(false);
  useEffect(() => {
    if (saved === null || restored.current) return;
    restored.current = true;
    dispatch(
      changes > 0 ? { type: "restoreMemory", memory: saved.memory } : { type: "restore", ...saved },
    );
  }, [saved, changes]);

  // Written a moment after the last key, so typing a number is not one save per digit.
  const writeNow = useRef<(() => void) | null>(null);
  const value = currentValue(state);
  const { memory, programmer } = session;
  const programmerValue = programmer.value.toString();
  const programmerBase = programmer.base;
  useEffect(() => {
    if (changes === 0) return;
    const write = () => {
      writeNow.current = null;
      setSaved({
        value: Number.isFinite(value) ? value : 0,
        memory,
        programmer: programmerValue,
        base: programmerBase,
      });
    };
    writeNow.current = write;
    const timer = setTimeout(write, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [changes, value, memory, programmerValue, programmerBase, setSaved]);
  useEffect(() => {
    const writePending = () => writeNow.current?.();
    window.addEventListener("pagehide", writePending);
    return () => {
      window.removeEventListener("pagehide", writePending);
      writePending();
    };
  }, []);
  // The event of a press or a double click on the display, reported by the window's own
  // handler once a host's `onPointerDown` or `onDoubleClick` there has had the chance to cancel it.
  const onDisplay = useRef<Event | null>(null);
  const { finished } = session;
  const { append } = tape;
  // The number of the newest calculation given to the tape: a render that sees the same
  // calculations again (before the `recorded` below has let them go) gives none twice.
  const recorded = useRef(0);
  useEffect(() => {
    const fresh = finished.filter((calculation) => calculation.seq > recorded.current);
    if (fresh.length === 0) return;
    const newest = fresh.at(-1)?.seq ?? recorded.current;
    recorded.current = newest;
    for (const calculation of fresh) append(calculation);
    const spoken = fresh.at(-1)?.result;
    if (speakResults && spoken) speakResult(spoken);
    dispatch({ type: "recorded", seq: newest });
  }, [finished, append, speakResults]);

  const inProgrammer = layout === "programmer";
  const shown = inProgrammer
    ? formatProgrammer(programmer)
    : shownText(state, { separators, decimals });
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new number ends the selection of the old one.
  useEffect(() => {
    const selection = document.getSelection();
    if (selection && displayElement.current?.contains(selection.anchorNode)) {
      selection.removeAllRanges();
    }
  }, [shown]);
  const canCopy =
    !(inProgrammer ? programmer.failed : Number.isNaN(currentValue(state))) &&
    typeof navigator !== "undefined" &&
    !!navigator.clipboard;
  const shownNow = useRef(shown);
  shownNow.current = shown;
  const copy = () => {
    if (!canCopy) return Promise.resolve(false);
    // A write the browser refuses leaves the clipboard as it was, and nothing here to undo.
    return navigator.clipboard.writeText(shown).then(
      () => true,
      () => false,
    );
  };
  const act = (action: CalculatorAction) => dispatch(rpn ? { type: "rpn", action } : action);
  const press = (action: ProgrammerAction) =>
    dispatch(rpn ? { type: "programmerRpn", action } : { type: "programmer", action });
  const moveStack = (action: StackAction) =>
    dispatch(inProgrammer ? { type: "programmerRpn", action } : { type: "rpn", action });
  const clearEntry = () => (inProgrammer ? press({ type: "clear" }) : act({ type: "clear" }));
  const pasteText = (text: string) => {
    if (inProgrammer) {
      const number = parseProgrammer(text, programmer.base);
      if (number !== null) press({ type: "value", value: number });
      return;
    }
    const value = parsePasted(text);
    if (value !== null) act({ type: "value", value, fresh: true });
  };
  const editCommands: EditCommands = {
    undo: () => dispatch({ type: "undo" }),
    redo: () => dispatch({ type: "redo" }),
    copy,
    cut: () => {
      // Only once it is on the clipboard, and only that number: a refused write must not lose it.
      const cutFrom = shown;
      void copy().then((copied) => {
        if (copied && shownNow.current === cutFrom) editNow.current.delete();
      });
    },
    // A menu can only ask for the clipboard; the keyboard's Paste comes as a `paste` event.
    paste: () => {
      navigator.clipboard?.readText().then(pasteText, () => setPasteRefused(true));
    },
    delete: clearEntry,
    selectAll: () => {
      const text = displayElement.current?.firstElementChild;
      if (text) document.getSelection()?.selectAllChildren(text);
    },
  };
  const editNow = useRef(editCommands);
  editNow.current = editCommands;
  const canUndo = session.past.length > 0;
  const canRedo = session.future.length > 0;
  const editMenu = useMemo(
    () => (
      <CalculatorEditItems
        commands={() => editNow.current}
        canUndo={canUndo}
        canRedo={canRedo}
        canCopy={canCopy}
        pasteRefused={pasteRefused}
        displayText={() =>
          (displayElement.current?.firstElementChild as HTMLElement | null | undefined) ?? null
        }
      />
    ),
    [canUndo, canRedo, canCopy, pasteRefused],
  );
  useDesktopAppMenu("calculator", "Edit", editMenu);

  // The key that has the keyboard may belong to the keys going away, and a menu then has nothing
  // to give the keyboard back to.
  const keepKeyboard = () => {
    const root = windowRoot();
    root?.focus({ preventScroll: true });
    if (root) {
      whenMenusClosed(document, () => {
        const active = document.activeElement;
        if (active === null || active === document.body || active.closest('[role="menubar"]')) {
          root.focus({ preventScroll: true });
        }
      });
    }
  };
  const chooseLayout = (next: CalculatorLayout) => {
    keepKeyboard();
    dispatch({ type: "carry", from: layout, to: next });
    setLayout(next);
  };
  const chooseRpn = (next: boolean) => {
    keepKeyboard();
    if (next !== rpn) dispatch({ type: "rpnMode" });
    setRpn(next);
  };
  const viewCommands = { setLayout: chooseLayout, setSeparators, setDecimals, setRpn: chooseRpn };
  const viewNow = useRef(viewCommands);
  viewNow.current = viewCommands;
  const viewMenu = useMemo(
    () => (
      <CalculatorViewItems
        layout={layout}
        separators={separators}
        decimals={decimals}
        rpn={rpn}
        commands={() => viewNow.current}
      />
    ),
    [layout, separators, decimals, rpn],
  );
  useDesktopAppMenu("calculator", "View", viewMenu);

  const convertCommands = {
    open: setConverting,
    again: (conversion: RecentConversion) => {
      keepKeyboard();
      if (conversion.category !== "currency") {
        applyConversion(conversion);
        return;
      }
      void readRates().then((read) => {
        if (read.kind === "read") applyConversion(conversion, read.rates);
        else setConverting("currency");
      });
    },
    updateRates: () => {
      setRatesNotice({ kind: "reading" });
      void exchange.update().then(setRatesNotice);
    },
  };
  const convertNow = useRef(convertCommands);
  convertNow.current = convertCommands;
  const hasNumber = !Number.isNaN(value);
  const convertMenu = useMemo(
    () => (
      <CalculatorConvertItems
        recent={recent}
        hasNumber={hasNumber}
        ratesServed={ratesServed}
        refused={inProgrammer ? NO_CONVERT_IN_PROGRAMMER : undefined}
        commands={() => convertNow.current}
      />
    ),
    [recent, hasNumber, inProgrammer, ratesServed],
  );
  useDesktopAppMenu("calculator", "Convert", convertMenu);
  function applyConversion(
    conversion: RecentConversion,
    rates = exchange.state.kind === "read" ? exchange.state.rates : undefined,
  ) {
    const { category, from, to } = conversion;
    act({
      type: "value",
      value: convert(category, value, from, to, rates),
      fresh: true,
      ofDisplay: true,
    });
    setRecent(withRecent(recent, conversion));
    setConverting(null);
  }

  const speechCommands = { setSpeakButtons, setSpeakResults };
  const speechNow = useRef(speechCommands);
  speechNow.current = speechCommands;
  const speechMenu = useMemo(
    () => (
      <CalculatorSpeechItems
        speakButtons={speakButtons}
        speakResults={speakResults}
        commands={() => speechNow.current}
      />
    ),
    [speakButtons, speakResults],
  );
  useDesktopAppMenu("calculator", "Speech", speechMenu);
  const sayKey = (action: CalculatorAction | ProgrammerAction) => {
    const word = speakButtons ? spokenKey(action) : null;
    if (word) speakKey(word);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const native = event.nativeEvent;
    if (matchesMenuKeyEquivalent(native, "command+v")) {
      // The browser sends `paste` to where the selection is: it may still be in a window left behind.
      const selection = document.getSelection();
      if (selection && !event.currentTarget.contains(selection.anchorNode)) {
        selection.removeAllRanges();
      }
      return;
    }
    const command = (
      [
        ["command+z", editCommands.undo],
        ["shift+command+z", editCommands.redo],
        ["command+x", editCommands.cut],
        ["command+c", editCommands.copy],
        ["command+a", editCommands.selectAll],
        ["command+1", () => chooseLayout("basic")],
        ["command+2", () => chooseLayout("scientific")],
        ["command+3", () => chooseLayout("programmer")],
        ["shift+command+t", () => setSeparators(!separators)],
        ["command+r", () => chooseRpn(!rpn)],
        ["command+t", () => tapeUsable && setTapeOpen(!tapeOpen)],
        ["shift+command+s", () => !tapeEmpty && setSavingTape(true)],
        ["command+p", () => !tapeEmpty && printTape(tape.lines)],
      ] as const
    ).find(([equivalent]) => matchesMenuKeyEquivalent(native, equivalent));
    if (command) {
      event.preventDefault();
      command[1]();
      return;
    }
    // Return and Space on a focused button press that button.
    const onButton = event.target instanceof Element && event.target.closest("button") !== null;
    if (onButton && (event.key === "Enter" || event.key === " ")) return;
    if (inProgrammer) {
      const pressed = programmerActionForKey(event, programmer.base);
      if (!pressed) return;
      event.preventDefault();
      sayKey(pressed);
      press(pressed);
      return;
    }
    const action =
      (layout === "scientific" ? scientificActionForKey(event, value, degrees) : null) ??
      actionForKey(event);
    if (!action) return;
    event.preventDefault();
    sayKey(action);
    act(action);
  };

  const digit = (label: string) => (
    <CalculatorKeypadKey onClick={() => act({ type: "digit", digit: label })}>
      {label}
    </CalculatorKeypadKey>
  );
  const operator = (name: BasicOperator) => (
    <CalculatorKeypadKey
      variant="operator"
      glyph={name}
      armed={state.armed === name}
      onClick={() => act(OPERATORS[name])}
    />
  );

  // The paper tape's commands in the menu bar: Window > Show Paper Tape and the File menu's rows.
  // The rows change only with what they show; the commands are read when one is chosen.
  const tapeCommands = useRef({ setTapeOpen, clear: () => tape.clear() });
  tapeCommands.current = { setTapeOpen, clear: () => tape.clear() };
  const tapeFileCommands = {
    clear: () => tape.clear(),
    save: () => setSavingTape(true),
    print: () => printTape(tape.lines),
  };
  const tapeFileNow = useRef(tapeFileCommands);
  tapeFileNow.current = tapeFileCommands;
  const tapeUsable = !!DesktopWindow && tape.enabled;
  const tapeEmpty = !tape.enabled || tape.lines.length === 0;
  const tapeWindowMenu = useMemo(
    () => (
      <MenuCheckboxItem
        keyEquivalent="command+t"
        checked={tapeOpen && tapeUsable}
        disabled={!tapeUsable}
        onCheckedChange={(open) => tapeCommands.current.setTapeOpen(open)}
      >
        Show Paper Tape
      </MenuCheckboxItem>
    ),
    [tapeOpen, tapeUsable],
  );
  useDesktopAppMenu("calculator", "Window", tapeWindowMenu);
  const tapeFileMenu = useMemo(
    () => <CalculatorTapeFileItems empty={tapeEmpty} commands={() => tapeFileNow.current} />,
    [tapeEmpty],
  );
  useDesktopAppMenu("calculator", "File", tapeFileMenu);
  const scientific = layout === "scientific";
  const scienceRow = (row: number) =>
    scientific ? (
      <ScientificRow
        row={row}
        second={second}
        degrees={degrees}
        armed={state.armed}
        value={value}
        memory={session.memory}
        rpn={rpn}
        onAction={(action) => (action.type === "memory" ? dispatch(action) : act(action))}
        onSecond={() => setSecond(!second)}
        onDegrees={() => setDegrees(!degrees)}
      />
    ) : null;
  const frame = frameOf(layout, rpn);
  const framed = !!DesktopWindow || (layout === "basic" && !rpn);
  const registerText = (register: 0 | 1 | 2) =>
    inProgrammer
      ? formatProgrammer({ ...programmer, value: session.bitStack[register], failed: false })
      : shownText(
          { ...initialCalculatorState, value: session.stack[register] },
          { separators, decimals },
        );
  const displayText = () =>
    (displayElement.current?.firstElementChild as HTMLElement | null | undefined) ?? null;
  const display = (
    <CalculatorKeypadDisplay
      ref={displayElement}
      aria-label="Result"
      data-window-drag-region=""
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // A press on the selected number drags the number; anywhere else it moves the window.
        const selection = document.getSelection();
        const onNumber =
          !!selection &&
          !selection.isCollapsed &&
          event.currentTarget.contains(selection.anchorNode);
        event.currentTarget.draggable = onNumber;
        if (!onNumber) onDisplay.current = event.nativeEvent;
      }}
      onDoubleClick={(event) => {
        onDisplay.current = event.nativeEvent;
      }}
      onDragStart={(event: DragEvent<HTMLOutputElement>) => {
        event.dataTransfer.setData("text/plain", shown);
        event.dataTransfer.effectAllowed = "copy";
      }}
      onDragOver={(event: DragEvent<HTMLOutputElement>) => {
        if (!event.currentTarget.draggable && event.dataTransfer.types.includes("text/plain")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event: DragEvent<HTMLOutputElement>) => {
        if (event.currentTarget.draggable) return;
        event.preventDefault();
        pasteText(event.dataTransfer.getData("text/plain"));
      }}
    >
      {shown}
    </CalculatorKeypadDisplay>
  );
  const displayWithMenu = (
    <ContextualMenu>
      <ContextualMenuTrigger render={display} />
      <ContextualMenuPopup aria-label="Result">
        <MenuItem disabled={!canCopy} onClick={() => void copy()}>
          Copy
        </MenuItem>
        <SpeechItems
          target={() => {
            const element = displayText();
            return element ? { element, restore: () => {}, editable: false, rich: false } : null;
          }}
        />
      </ContextualMenuPopup>
    </ContextualMenu>
  );
  return (
    <>
      {DesktopWindow ? <DesktopFrame size={frame} /> : null}
      {DesktopWindow ? <WhenClosedBehind onClosed={() => setQuitting(true)} /> : null}
      <Window
        aria-label="Calculator"
        // Not a tab stop, but a click anywhere in the window gives it the keyboard.
        tabIndex={-1}
        // No title bar draws the two highlight rows along the top edge, so the window does:
        // the capture's top rim is brighter than its sides (white at 36% and 28% over the
        // display in the two device rows, against 20% at the sides).
        topHighlight
        {...windowProps}
        width={framed ? width : frame.width}
        height={framed ? height : frame.height}
        className={className ? `mac-calculator ${className}` : "mac-calculator"}
        onKeyDown={handleKeyDown}
        onClickCapture={(event: MouseEvent<HTMLDivElement>) => {
          onClickCapture?.(event);
          if (!speakButtons || !(event.target instanceof Element)) return;
          const key = event.target.closest<HTMLElement>(
            ".mac-calculator-keypad-key:not([data-disabled])",
          );
          const word = key?.getAttribute("aria-label") ?? key?.textContent;
          if (word) speakKey(word);
        }}
        onCopy={(event: ClipboardEvent<HTMLDivElement>) => {
          // The number alone: the browser's own copy of a selection brings the display's styles.
          event.preventDefault();
          if (canCopy) event.clipboardData.setData("text/plain", shown);
        }}
        onPaste={(event: ClipboardEvent<HTMLDivElement>) => {
          event.preventDefault();
          pasteText(event.clipboardData.getData("text/plain"));
        }}
        onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
          const reported = onDisplay.current === event.nativeEvent;
          onDisplay.current = null;
          onPointerDown?.(event);
          if (reported && !event.defaultPrevented) onDragRegionPointerDown?.(event);
        }}
        onDoubleClick={(event: MouseEvent<HTMLDivElement>) => {
          const reported = onDisplay.current === event.nativeEvent;
          onDisplay.current = null;
          onDoubleClick?.(event);
          if (reported && !event.defaultPrevented) onDragRegionDoubleClick?.(event);
        }}
      >
        <WindowControls
          className="mac-calculator-controls"
          onClose={onClose}
          onMinimize={onMinimize}
          onZoom={onZoom}
          zoomRole={zoomRole}
          minimizeDisabled={minimizeDisabled}
          zoomDisabled={zoomDisabled}
        />
        <span ref={sheetAnchor} className="mac-calculator-sheet-anchor" />
        {rpn ? (
          // biome-ignore lint/a11y/useSemanticElements: three read-out registers, not a form fieldset
          <div className="mac-calculator-stack" role="group" aria-label="Stack">
            {REGISTERS.map((name, index) => (
              <span key={name}>{`${name} ${registerText((2 - index) as 0 | 1 | 2)}`}</span>
            ))}
          </div>
        ) : null}
        {inProgrammer ? (
          <ProgrammerKeypad
            state={programmer}
            display={displayWithMenu}
            onAction={press}
            stackKeys={
              rpn ? <CalculatorStackKeys spans={[2, 2, 2, 1]} onAction={moveStack} /> : undefined
            }
          />
        ) : (
          <CalculatorKeypad
            aria-label="Keys"
            className={
              [scientific ? "mac-calculator-science" : "", rpn ? "mac-calculator-rpn" : ""]
                .join(" ")
                .trim() || undefined
            }
          >
            {displayWithMenu}
            {rpn ? (
              <CalculatorStackKeys
                spans={scientific ? [3, 3, 2, 2] : [1, 1, 1, 1]}
                onAction={moveStack}
              />
            ) : null}
            {scienceRow(0)}
            <CalculatorKeypadKey
              variant="function"
              aria-label={state.clearable ? "Clear" : "All clear"}
              onClick={() => act({ type: "clear" })}
            >
              {state.clearable ? "C" : "AC"}
            </CalculatorKeypadKey>
            <CalculatorKeypadKey
              variant="function"
              glyph="negate"
              onClick={() => act({ type: "negate" })}
            />
            <CalculatorKeypadKey
              variant="function"
              aria-label="Percent"
              onClick={() => act({ type: "percent" })}
            >
              %
            </CalculatorKeypadKey>
            {operator("divide")}
            {scienceRow(1)}
            {digit("7")}
            {digit("8")}
            {digit("9")}
            {operator("multiply")}
            {scienceRow(2)}
            {digit("4")}
            {digit("5")}
            {digit("6")}
            {operator("subtract")}
            {scienceRow(3)}
            {digit("1")}
            {digit("2")}
            {digit("3")}
            {operator("add")}
            {scienceRow(4)}
            <CalculatorKeypadKey span={2} onClick={() => act({ type: "digit", digit: "0" })}>
              0
            </CalculatorKeypadKey>
            <CalculatorKeypadKey
              aria-label="Decimal point"
              onClick={() => act({ type: "decimal" })}
            >
              .
            </CalculatorKeypadKey>
            {rpn ? (
              <CalculatorKeypadKey
                variant="operator"
                className="mac-calculator-science-key"
                aria-label="Enter"
                onClick={() => act({ type: "equals" })}
              >
                enter
              </CalculatorKeypadKey>
            ) : (
              <CalculatorKeypadKey
                variant="operator"
                glyph="equals"
                onClick={() => act({ type: "equals" })}
              />
            )}
          </CalculatorKeypad>
        )}
        {rpn ? <span className="mac-calculator-rpn-mark">RPN</span> : null}
        {scientific && !degrees ? <span className="mac-calculator-angle">Rad</span> : null}
      </Window>
      <ConvertSheet
        category={converting}
        recent={recent}
        rates={exchange.state}
        anchor={sheetAnchor}
        finalFocus={windowRoot}
        onConvert={(conversion) => applyConversion(conversion)}
        onClose={() => setConverting(null)}
      />
      <RatesUpdateSheet
        notice={ratesNotice}
        anchor={sheetAnchor}
        finalFocus={windowRoot}
        onClose={() => setRatesNotice(null)}
      />
      <TapeSaveSheet
        open={savingTape}
        lines={tape.lines}
        anchor={sheetAnchor}
        finalFocus={windowRoot}
        onClose={() => setSavingTape(false)}
      />
      {DesktopWindow && tape.enabled && tapeOpen && !quitting ? (
        <DesktopWindow
          id="tape"
          title="Paper Tape"
          defaultSize={{ width: 232, height: 321 }}
          minSize={{ width: 160, height: 160 }}
          zoomButton="zoom"
          onClose={() => setTapeOpen(false)}
          render={(props) => (
            <DesktopPaperTape
              {...props}
              lines={tape.lines}
              error={tape.error}
              onClear={tape.clear}
            />
          )}
        />
      ) : null}
    </>
  );
}
