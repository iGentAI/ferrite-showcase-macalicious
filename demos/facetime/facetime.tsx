"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { HudWindow, HudWindowText } from "macalicious/hud-window";
import { ImageButton } from "macalicious/image-button";
import { ImageView } from "macalicious/image-view";
import { cn } from "macalicious/lib/cn";
import { windowDragRegion } from "macalicious/lib/window-drag-region";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { Sidebar, SidebarItem } from "macalicious/sidebar";
import { TextField } from "macalicious/text-field";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { CARDS_DRAG } from "../contacts/contacts-groups";
import { type ContactPerson, offeredPeople } from "../contacts/contacts-people";
import {
  AudioGlyph,
  CAMERA_PLACEHOLDER_DESCRIPTION,
  CameraPicture,
  InfoGlyph,
  VideoGlyph,
} from "./facetime-artwork";
import {
  callDetail,
  describeList,
  type FaceTimeCall,
  type FaceTimeCallKind,
  type FaceTimeFilter,
  type FaceTimeHeldCall,
  type FaceTimeIncomingCall,
  type FaceTimeOutgoingCall,
  filterCalls,
  groupCalls,
  kindName,
  peopleName,
} from "./facetime-data";
import "./facetime.tokens.css";
import "./facetime.css";

/*
 * The library's variables that FaceTime's dark, vibrant sidebar sets, each given a colour of
 * the demo's own (facetime.tokens.css) or a metric, and where each is documented:
 *
 * SIDEBAR --mac-material-sidebar: the Theming page's Materials table (the sidebar's surface).
 *         FaceTime's sidebar is the darker material of a media window, not a source list's.
 *         --mac-sidebar-row-height, --mac-sidebar-row-spacing: sidebar.mdx, "CSS variable"
 *         table, and the Hooks of sidebar.css. A recent call's row has two lines.
 * FILTER  --mac-bezel-fill: the Theming page's Controls table (the fill of a standard bezel).
 *         Over the dark material the segment that is not selected is lighter than a Dark Aqua
 *         bezel. The width is the control's box around its measured 134 pt of fill.
 * FIELD   --mac-text-field-background: text-field.mdx, "CSS variable" table.
 * CALL    --mac-image-button-padding: image-button.mdx, "Attribute or variable" table. 4 pt
 *         around the glyph keeps the button inside the row.
 */
const SIDEBAR = {
  "--mac-material-sidebar": "var(--mac-facetime-sidebar)",
  "--mac-sidebar-row-height": "40px",
  "--mac-sidebar-row-spacing": "0px",
} as CSSProperties;
const FILTER = {
  width: 136,
  "--mac-bezel-fill": "var(--mac-facetime-segment-fill)",
} as CSSProperties;
/* The measured boundary is 67 pt into the fill: 66 pt of segment and the 1 pt of the divider. */
const FIRST_SEGMENT: CSSProperties = { width: 66 };
const SECOND_SEGMENT: CSSProperties = { width: 67 };
const FIELD = {
  width: 239,
  "--mac-text-field-background": "var(--mac-facetime-field)",
} as CSSProperties;
const CALL = { "--mac-image-button-padding": "4px" } as CSSProperties;

export interface FaceTimeProps extends Omit<WindowProps, "children"> {
  /**
   * The recent calls the list holds when the window opens, newest first. Read once; calls
   * placed in the window are added above them.
   * @default []
   */
  defaultCalls?: readonly FaceTimeCall[];
  /**
   * Which calls the list shows when the window opens: all of them, or the missed ones.
   * @default "all"
   */
  defaultFilter?: FaceTimeFilter;
  /** Which calls the list shows, when the owner holds it. Use with `onFilterChange`. */
  filter?: FaceTimeFilter;
  /** Called when the person chooses All or Missed. */
  onFilterChange?: (filter: FaceTimeFilter) => void;
  /**
   * The text in the recipient field when the window opens.
   * @default ""
   */
  defaultRecipient?: string;
  /** Who the recipient field offers as it is typed: a name to show, and what to call. */
  recipientSuggestions?: readonly ContactPerson[];
  /**
   * The camera's picture, shown instead of the placeholder: your own `<video>` or image. It
   * fills the preview and is cropped to it. The demo asks for no camera and no microphone.
   * @default undefined
   */
  children?: ReactNode;
  /**
   * Called when a call starts, from the field or from a recent call. Nothing is dialled.
   * @default undefined
   */
  onCallStart?: (call: FaceTimeOutgoingCall) => void;
  /**
   * Called when a call ends, with the line it adds to the top of the recent calls.
   * @default undefined
   */
  onCallEnd?: (call: FaceTimeCall) => void;
  /**
   * For the window controls: a window manager's close command.
   * @default undefined
   */
  onClose?: WindowControlsProps["onClose"];
  /**
   * For the window controls: a window manager's minimize command.
   * @default undefined
   */
  onMinimize?: WindowControlsProps["onMinimize"];
  /**
   * For the window controls: a window manager's zoom command.
   * @default undefined
   */
  onZoom?: WindowControlsProps["onZoom"];
  /**
   * For the window controls: what the green button does now.
   * @default undefined
   */
  zoomRole?: WindowControlsProps["zoomRole"];
  /**
   * For the window controls: disables minimize, as in full screen.
   * @default undefined
   */
  minimizeDisabled?: boolean;
  /**
   * For the window controls: disables zoom.
   * @default undefined
   */
  zoomDisabled?: boolean;
  /**
   * Called when the primary pointer button goes down on the strip of the sidebar that holds
   * the window controls, the filter and the recipient field, not on a control in it. FaceTime
   * has no title bar: this is its drag region, and a window manager starts moving the window
   * here.
   * @default undefined
   */
  onDragRegionPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  /**
   * Called when the drag region is double-clicked: a window manager zooms the window.
   * @default undefined
   */
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
  /**
   * The recent calls, when the owner holds them (a server's list): the window shows these and
   * adds nothing to them itself. Without it the window keeps its own list, from `defaultCalls`.
   * @default undefined
   */
  calls?: readonly FaceTimeCall[];
  /**
   * The call under way, when the owner holds it: `null` for none. The call panel shows its
   * `status`, and End only calls `onCallEnd`'s companion `onHangUp`; starting a call only calls
   * `onCallStart`. Without it the window models a call itself.
   * @default undefined
   */
  call?: FaceTimeHeldCall | null;
  /**
   * Called when End is clicked on a call the owner holds (`call`).
   * @default undefined
   */
  onHangUp?: () => void;
  /**
   * With `calls`: called by a row's Remove from Recents with its id, and by Remove All Recents
   * with `null`. Without `calls` the window removes them itself.
   */
  onRemoveCalls?: (id: string | null) => void;
  /** A row's Add to Contacts, with the account it called and the name it shows. */
  onAddToContacts?: (to: string, name: string) => void;
  /**
   * A row's info button, with the account it called and the name it shows. It is dimmed, saying why,
   * for someone not among `recipientSuggestions`. Without this the rows have no info button.
   */
  onShowContact?: (to: string, name: string) => void;
  /** The account names blocked, for the row's Block This Caller. Without `onBlock` the item is absent. */
  blocked?: ReadonlySet<string>;
  /** A row's Block This Caller and Unblock This Caller, with the account it called. */
  onBlock?: (to: string, blocked: boolean) => void;
  /** FaceTime is off: nothing is placed, and the pane says so with Turn On. */
  off?: boolean;
  /** Called by the pane's Turn On. */
  onTurnOn?: () => void;
  /** More controls beside End during a call: mute and pause, on a window that has a real call. */
  callControls?: ReactNode;
  /** Under the call panel's first line: who else is ringing, and adding a person to the call. */
  callPeople?: ReactNode;
  /**
   * A call ringing for the person: a panel over the preview with Decline and Accept.
   * @default null
   */
  incoming?: FaceTimeIncomingCall | null;
  /**
   * Called when the person accepts the ringing call (`incoming`).
   * @default undefined
   */
  onAccept?: () => void;
  /**
   * Called when the person declines the ringing call (`incoming`).
   * @default undefined
   */
  onDecline?: () => void;
  /**
   * The other people's pictures during a call (their `<video>` elements, one tile each): they
   * fill the pane, and the camera's own picture (`children`) moves to a small view in its
   * corner.
   * @default undefined
   */
  stage?: ReactNode;
  /**
   * A sentence shown over the preview, such as why a call could not be placed.
   * @default undefined
   */
  notice?: string;
}

/** The time of a call that has just ended, as the list words it: "9:41 AM". */
const timeNow = () =>
  new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** A recent call's info button: the person's card in Contacts, dimmed when they have none. */
function InfoButton({
  name,
  known,
  onClick,
}: {
  name: string;
  known: boolean;
  onClick: () => void;
}) {
  return (
    <ImageButton
      aria-label={`Show ${name} in Contacts`}
      title={known ? undefined : `${name} is not in your Contacts. Choose Add to Contacts.`}
      style={CALL}
      disabled={!known}
      onClick={onClick}
    >
      <InfoGlyph />
    </ImageButton>
  );
}

/**
 * The FaceTime window of macOS 10.15: a dark sidebar with the window controls, the All and
 * Missed filter, the recipient field and the list of recent calls, and beside it the camera
 * preview. The window is dark in Aqua and in Dark Aqua alike.
 *
 * It is a model of the app: typing a recipient offers an Audio and a Video button, a call
 * shows a panel over the preview until it is ended, and an ended call joins the recent calls.
 * Nothing is dialled, no camera and no microphone is asked for, and the preview is an
 * abstract placeholder unless `children` replace it.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' callbacks go to that
 * part and the drag region's to the top of the sidebar.
 */
export function FaceTime({
  defaultCalls = [],
  defaultFilter = "all",
  filter: heldFilter,
  onFilterChange,
  defaultRecipient = "",
  children,
  onCallStart,
  onCallEnd,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  calls: heldCalls,
  onRemoveCalls,
  onAddToContacts,
  onShowContact,
  blocked,
  onBlock,
  off = false,
  onTurnOn,
  call: heldCall,
  onHangUp,
  callControls,
  callPeople,
  incoming = null,
  onAccept,
  onDecline,
  stage,
  notice,
  recipientSuggestions,
  width = 652,
  height = 585,
  className,
  ...windowProps
}: FaceTimeProps) {
  const [ownCalls, setCalls] = useState(defaultCalls);
  const calls = heldCalls ?? ownCalls;
  const [ownFilter, setFilter] = useState(defaultFilter);
  const filter = heldFilter ?? ownFilter;
  const [recipient, setRecipient] = useState(defaultRecipient);
  const [selected, setSelected] = useState<string | null>(null);
  // The rows chosen with the selected one, by Command- and Shift-click: Remove acts on them all.
  const [alsoChosen, setAlsoChosen] = useState<ReadonlySet<string>>(() => new Set());
  // The row a contextual menu was asked for on, and removing it or all of them.
  const [menuCall, setMenuCall] = useState<string | null>(null);
  const removeCalls = (id: string | null) => {
    if (heldCalls) onRemoveCalls?.(id);
    else setCalls((all) => (id === null ? [] : all.filter((each) => each.id !== id)));
    if (id === null || id === selected) setSelected(null);
    if (id === null) setAlsoChosen(new Set());
  };
  const removeRows = (rowIds: readonly string[]) => {
    for (const row of rowsShown) {
      if (!rowIds.includes(row.id)) continue;
      for (const id of row.ids) removeCalls(id);
    }
    setSelected(null);
    setAlsoChosen(new Set());
  };
  // The call that is under way, if one is.
  const [ownCall, setCall] = useState<FaceTimeOutgoingCall | null>(null);
  const held = heldCall !== undefined;
  const call: FaceTimeHeldCall | null = held
    ? heldCall
    : ownCall && { ...ownCall, status: "Calling…" };
  // What assistive technology hears of a change that is otherwise only seen.
  const [announcement, setAnnouncement] = useState("");
  // Calls placed here get ids of their own, `placed-1`, `placed-2` and so on; the count
  // steps past any id the list holds already, so that no id of `defaultCalls` equals one.
  // The prefix makes the ids of the two lines that name a row.
  const prefix = useId();
  const placed = useRef(0);
  const field = useRef<HTMLInputElement>(null);
  const offers = useRef<HTMLFieldSetElement>(null);
  const endButton = useRef<HTMLElement>(null);

  const shown = filterCalls(calls, filter);
  const rowsShown = groupCalls(shown);
  // What is chosen and still listed: a removal or the filter can take a row away.
  const chosenRows = [...(selected ? [selected] : []), ...alsoChosen].filter((id) =>
    rowsShown.some((row) => row.id === id),
  );
  const menuRow = rowsShown.find((each) => each.id === menuCall);
  const calling = call !== null;
  const typed = recipient.trim();
  // The text Escape put the offers away for: they come back when it changes.
  const [offersDismissed, setOffersDismissed] = useState<string | null>(null);
  const suggestions =
    offersDismissed === typed ? [] : offeredPeople(recipientSuggestions ?? [], typed, [typed]);
  const contactDragged = (event: DragEvent<HTMLElement>) =>
    !off && event.dataTransfer.types.includes(CARDS_DRAG);

  // A call takes the keyboard to its End button, since the control that started it is
  // disabled or gone; ending it gives the keyboard to the recipient field.
  const wasCalling = useRef(false);
  useEffect(() => {
    if (calling === wasCalling.current) return;
    wasCalling.current = calling;
    (calling ? endButton.current : field.current)?.focus();
  }, [calling]);

  const start = (name: string, kind: FaceTimeCallKind, to?: string) => {
    const who = name.trim();
    if (calling || off || who === "") return;
    const next: FaceTimeOutgoingCall = to ? { name: who, kind, to } : { name: who, kind };
    if (!held) setCall(next);
    setRecipient("");
    setAnnouncement(`Calling ${who} with ${kindName(kind)}`);
    onCallStart?.(next);
  };

  const end = () => {
    if (!call) return;
    if (held) {
      onHangUp?.();
      return;
    }
    if (!ownCall) return;
    let id: string;
    do {
      placed.current += 1;
      id = `placed-${placed.current}`;
    } while (calls.some((each) => each.id === id));
    const record: FaceTimeCall = {
      id,
      name: ownCall.name,
      kind: ownCall.kind,
      status: "outgoing",
      when: timeNow(),
      // Calling back dials whoever this call dialled.
      ...(ownCall.to ? { to: ownCall.to } : {}),
    };
    setCalls([record, ...ownCalls]);
    setCall(null);
    setAnnouncement(`Call with ${ownCall.name} ended`);
    onCallEnd?.(record);
  };

  const changeFilter = (next: FaceTimeFilter) => {
    if (next === filter) return;
    setFilter(next);
    onFilterChange?.(next);
    setAnnouncement(describeList(next, filterCalls(calls, next).length));
  };

  // How many are chosen, said whenever it changes: only one row can say so itself (aria-selected).
  const chosenCount = chosenRows.length;
  const saidCount = useRef(chosenCount);
  useEffect(() => {
    if (chosenCount === saidCount.current) return;
    saidCount.current = chosenCount;
    setAnnouncement(
      chosenCount === 0
        ? "No calls selected"
        : chosenCount === 1
          ? "1 call selected"
          : `${chosenCount} calls selected`,
    );
  }, [chosenCount]);
  const clearAlsoChosen = () => {
    if (alsoChosen.size > 0) setAlsoChosen(new Set());
  };

  // FaceTime has no title bar: the strip over the list moves the window.
  const dragRegion = windowDragRegion<HTMLDivElement>(
    onDragRegionPointerDown,
    onDragRegionDoubleClick,
  );

  return (
    <Window
      // Dark in both appearances: everything inside is drawn in Dark Aqua.
      data-appearance="dark"
      aria-label="FaceTime"
      width={width}
      height={height}
      className={cn("mac-facetime", className)}
      {...windowProps}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a drop target for a card; the keyboard has the recipient field */}
      <div
        className="mac-facetime-body"
        onDragOver={(event) => {
          if (!contactDragged(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          if (!contactDragged(event)) return;
          event.preventDefault();
          // The first of the cards: the field holds one person.
          const name = event.dataTransfer.getData("text/plain").split("\n")[0]?.trim();
          if (!name) return;
          const person = recipientSuggestions?.find((each) => each.name === name);
          setRecipient(person?.to ?? name);
          field.current?.focus();
        }}
      >
        <ContextualMenu>
          <ContextualMenuTrigger
            className="mac-facetime-menu-area"
            onContextMenu={(event) => {
              const row = (event.target as Element).closest<HTMLElement>("[data-call]");
              setMenuCall(row?.dataset.call ?? null);
              if (row?.dataset.call && !chosenRows.includes(row.dataset.call)) {
                setSelected(row.dataset.call);
                clearAlsoChosen();
              }
            }}
          >
            <Sidebar
              aria-label="Recent calls"
              className="mac-facetime-sidebar"
              style={SIDEBAR}
              value={selected}
              onValueChange={(id) => {
                setSelected(id);
                clearAlsoChosen();
              }}
              onMouseDown={(event) => {
                const target = event.target as Element;
                const id = target.closest<HTMLElement>("[data-call]")?.dataset.call;
                if (!id || event.button !== 0 || target.closest("button")) return;
                if (event.metaKey || event.ctrlKey) {
                  // The row joins or leaves what is chosen, and the sidebar selects nothing.
                  event.preventDefault();
                  const next = new Set(chosenRows);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  const [first, ...rest] = next;
                  setSelected(first ?? null);
                  setAlsoChosen(new Set(rest));
                } else if (event.shiftKey && selected && chosenRows.includes(selected)) {
                  event.preventDefault();
                  const ids = rowsShown.map((row) => row.id);
                  const [from, to] = [ids.indexOf(selected), ids.indexOf(id)].sort((a, b) => a - b);
                  const range = ids.slice(from, (to ?? 0) + 1).filter((each) => each !== selected);
                  setAlsoChosen(new Set(range));
                } else {
                  clearAlsoChosen();
                }
              }}
              onKeyDown={(event) => {
                if (
                  (event.key === "Backspace" || event.key === "Delete") &&
                  event.target === event.currentTarget &&
                  chosenRows.length > 0
                ) {
                  event.preventDefault();
                  removeRows(chosenRows);
                  return;
                }
                // Return calls the selected row back, as its button does.
                if (event.key !== "Enter" || event.target !== event.currentTarget) return;
                const row = rowsShown.find((item) => item.id === selected);
                if (!row) return;
                event.preventDefault();
                start(row.name, row.kind, row.to);
              }}
              header={
                <div className="mac-facetime-header" {...dragRegion}>
                  <WindowControls
                    className="mac-facetime-controls"
                    onClose={onClose}
                    onMinimize={onMinimize}
                    onZoom={onZoom}
                    zoomRole={zoomRole}
                    minimizeDisabled={minimizeDisabled}
                    zoomDisabled={zoomDisabled}
                  />
                  <SegmentedControl<FaceTimeFilter>
                    aria-label="Calls shown"
                    className="mac-facetime-filter"
                    style={FILTER}
                    distribution="fit"
                    value={[filter]}
                    onValueChange={(value) => {
                      if (value[0]) changeFilter(value[0]);
                    }}
                  >
                    <Segment value="all" style={FIRST_SEGMENT}>
                      All
                    </Segment>
                    <Segment value="missed" style={SECOND_SEGMENT}>
                      Missed
                    </Segment>
                  </SegmentedControl>
                  <TextField
                    aria-label="Recipient"
                    className="mac-facetime-recipient"
                    style={FIELD}
                    inputRef={field}
                    disabled={off}
                    placeholder="Enter a name, email, or number"
                    autoComplete="off"
                    spellCheck={false}
                    value={recipient}
                    onValueChange={(next) => setRecipient(next)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" && suggestions.length > 0) {
                        event.preventDefault();
                        offers.current?.querySelector("button")?.focus();
                        return;
                      }
                      if (event.key === "Escape" && suggestions.length > 0) {
                        setOffersDismissed(typed);
                        return;
                      }
                      // Return places FaceTime's own kind of call, a video call. A Return that
                      // ends a composition (an input method confirming a name) only confirms it.
                      // Some browsers report that Return with keyCode 229 and without
                      // isComposing, so either one marks it.
                      if (
                        event.key !== "Enter" ||
                        event.nativeEvent.isComposing ||
                        event.keyCode === 229 ||
                        typed === ""
                      ) {
                        return;
                      }
                      event.preventDefault();
                      start(typed, "video");
                    }}
                  />
                  {suggestions.length > 0 ? (
                    <fieldset
                      ref={offers}
                      aria-label="Contacts"
                      className="mac-facetime-suggestions mac-facetime-offers"
                      onKeyDown={(event) => {
                        const buttons = [...event.currentTarget.querySelectorAll("button")];
                        const at = buttons.indexOf(event.target as HTMLButtonElement);
                        if (event.key === "Escape") setOffersDismissed(typed);
                        else if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                        event.preventDefault();
                        const next = event.key === "ArrowDown" ? at + 1 : at - 1;
                        if (event.key === "Escape" || next < 0) field.current?.focus();
                        else buttons[next]?.focus();
                      }}
                    >
                      {suggestions.map(({ name, to }) => (
                        <BorderlessButton
                          key={to}
                          onClick={() => {
                            setRecipient(to);
                            field.current?.focus();
                          }}
                        >
                          {name}
                        </BorderlessButton>
                      ))}
                    </fieldset>
                  ) : null}
                </div>
              }
              footer={
                typed === "" ? undefined : (
                  // FaceTime's two call buttons are green: the library's default-button look in
                  // the green accent, which this group sets for itself.
                  // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and a border; these are two buttons.
                  <div
                    role="group"
                    aria-label={`Call ${typed}`}
                    data-accent="green"
                    className="mac-facetime-actions"
                  >
                    <PushButton
                      variant="primary"
                      className="mac-facetime-action"
                      disabled={calling}
                      onClick={() => start(typed, "audio")}
                    >
                      Audio
                    </PushButton>
                    <PushButton
                      variant="primary"
                      className="mac-facetime-action"
                      disabled={calling}
                      onClick={() => start(typed, "video")}
                    >
                      Video
                    </PushButton>
                  </div>
                )
              }
            >
              {rowsShown.map((item, index) => (
                <SidebarItem
                  key={item.id}
                  value={item.id}
                  data-call={item.id}
                  data-chosen={alsoChosen.has(item.id) ? "" : undefined}
                  // The row is named by its two lines, a space apart, and not by the label of the
                  // button at its end, which the sidebar would add as the row's accessory.
                  aria-labelledby={`${prefix}name${index} ${prefix}detail${index}`}
                  label={
                    <span className="mac-facetime-call">
                      <span
                        id={`${prefix}name${index}`}
                        className="mac-facetime-call-name"
                        data-missed={item.status === "missed" ? "" : undefined}
                      >
                        {peopleName(item.name, item.also)}
                        {item.ids.length > 1 ? ` (${item.ids.length})` : null}
                      </span>
                      <span id={`${prefix}detail${index}`} className="mac-facetime-call-detail">
                        {callDetail(item)}
                      </span>
                    </span>
                  }
                  accessory={
                    <span className="mac-facetime-row-buttons">
                      {onShowContact && item.to ? (
                        <InfoButton
                          name={item.name}
                          known={recipientSuggestions?.some(({ to }) => to === item.to) === true}
                          onClick={() => item.to && onShowContact(item.to, item.name)}
                        />
                      ) : null}
                      <ImageButton
                        aria-label={`Call ${item.name} with ${kindName(item.kind)}`}
                        style={CALL}
                        disabled={calling || off}
                        onClick={() => start(item.name, item.kind, item.to)}
                      >
                        {item.kind === "audio" ? <AudioGlyph /> : <VideoGlyph />}
                      </ImageButton>
                    </span>
                  }
                />
              ))}
            </Sidebar>
          </ContextualMenuTrigger>
          <ContextualMenuPopup aria-label="Recent call commands">
            <MenuItem
              disabled={calling || off || !menuRow}
              onClick={() => menuRow && start(menuRow.name, menuRow.kind, menuRow.to)}
            >
              Call Back
            </MenuItem>
            {onAddToContacts ? (
              <MenuItem
                disabled={!menuRow?.to}
                onClick={() => menuRow?.to && onAddToContacts(menuRow.to, menuRow.name)}
              >
                Add to Contacts
              </MenuItem>
            ) : null}
            {onBlock ? (
              <MenuItem
                disabled={!menuRow?.to}
                onClick={() => menuRow?.to && onBlock(menuRow.to, !blocked?.has(menuRow.to))}
              >
                {menuRow?.to && blocked?.has(menuRow.to)
                  ? "Unblock This Caller"
                  : "Block This Caller"}
              </MenuItem>
            ) : null}
            <MenuSeparator />
            <MenuItem
              disabled={!menuRow}
              onClick={() =>
                menuRow && removeRows(chosenRows.includes(menuRow.id) ? chosenRows : [menuRow.id])
              }
            >
              Remove from Recents
            </MenuItem>
            <MenuItem disabled={calls.length === 0} onClick={() => removeCalls(null)}>
              Remove All Recents
            </MenuItem>
          </ContextualMenuPopup>
        </ContextualMenu>
        <div className="mac-facetime-camera" data-stage={stage ? "" : undefined}>
          {stage ? <div className="mac-facetime-stage">{stage}</div> : null}
          {/* The placeholder picture stands in only when there is neither a call to show nor a
              preview of one's own: it never covers the people in a call. */}
          {children ? (
            stage ? (
              <div className="mac-facetime-self">{children}</div>
            ) : (
              children
            )
          ) : stage ? null : (
            <ImageView
              className="mac-facetime-picture"
              alt={CAMERA_PLACEHOLDER_DESCRIPTION}
              scaling="axes-independently"
            >
              <CameraPicture className="mac-facetime-frame" />
            </ImageView>
          )}
          {notice ? (
            <HudWindow aria-label="Notice" className="mac-facetime-notice">
              <HudWindowText role="alert" className="mac-facetime-hud-line">
                {notice}
              </HudWindowText>
            </HudWindow>
          ) : null}
          {off ? (
            <HudWindow aria-label="FaceTime is off" className="mac-facetime-hud">
              <div className="mac-facetime-hud-content">
                <div className="mac-facetime-hud-text">
                  <HudWindowText className="mac-facetime-hud-line">FaceTime is off</HudWindowText>
                </div>
                <PushButton onClick={onTurnOn}>Turn On</PushButton>
              </div>
            </HudWindow>
          ) : null}
          {incoming && !call ? (
            <HudWindow aria-label="Incoming call" className="mac-facetime-hud">
              <div className="mac-facetime-hud-content">
                <div className="mac-facetime-hud-text">
                  <HudWindowText className="mac-facetime-hud-line mac-facetime-callee">
                    {incoming.name}
                  </HudWindowText>
                  <HudWindowText className="mac-facetime-hud-line">
                    {incoming.detail ?? `${kindName(incoming.kind)} · Incoming call`}
                  </HudWindowText>
                </div>
                <span data-accent="red">
                  <PushButton variant="primary" onClick={onDecline}>
                    {incoming.declineLabel ?? "Decline"}
                  </PushButton>
                </span>
                <span data-accent="green">
                  <PushButton variant="primary" onClick={onAccept}>
                    {incoming.acceptLabel ?? "Accept"}
                  </PushButton>
                </span>
              </div>
            </HudWindow>
          ) : null}
          {call ? (
            <HudWindow aria-label="Call" className="mac-facetime-hud">
              <div className="mac-facetime-hud-content">
                <div className="mac-facetime-hud-text">
                  <HudWindowText className="mac-facetime-hud-line mac-facetime-callee">
                    {call.name}
                  </HudWindowText>
                  <HudWindowText className="mac-facetime-hud-line">
                    {kindName(call.kind)} · {call.status}
                  </HudWindowText>
                </div>
                {/* The button that ends a call is red: the default-button look in the red
                    accent, set on the element around it. */}
                <span data-accent="red">
                  <PushButton variant="primary" ref={endButton} onClick={end}>
                    End
                  </PushButton>
                </span>
                {callControls}
              </div>
              {callPeople}
            </HudWindow>
          ) : null}
        </div>
      </div>
      <div role="status" className="mac-facetime-status">
        {announcement}
      </div>
    </Window>
  );
}
