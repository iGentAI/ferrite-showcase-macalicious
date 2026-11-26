"use client";

import { Checkbox } from "macalicious/checkbox";
import { Form, FormRow } from "macalicious/form";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { isWindowDragRegion } from "macalicious/lib/window-drag-region";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PreferencesToolbar, PreferencesToolbarItem } from "macalicious/preferences-toolbar";
import {
  PreferencesWindow,
  PreferencesWindowFooter,
  PreferencesWindowPane,
  type PreferencesWindowProps,
} from "macalicious/preferences-window";
import { PushButton } from "macalicious/push-button";
import { Slider } from "macalicious/slider";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useId,
  useState,
} from "react";
import { FolderIcon, PaneIcon } from "./messages-artwork";
import {
  ACCOUNT,
  ADDRESSES,
  choicesWith,
  DEFAULT_SETTINGS,
  FOLDER_CHOICES,
  KEEP_CHOICES,
  type MessagesSettings,
  SOUND_CHOICES,
  TEXT_SIZES,
  textSizeStep,
} from "./messages-data";
import "./messages.tokens.css";
import "./messages.css";

/** The frame's width in the reference screenshots. */
export const PREFERENCES_WIDTH = 540;

/** The frame's height on the General pane, which the window opens on, as captured. */
export const PREFERENCES_HEIGHT = 309;

/** The pop-up buttons of the General pane: their bezels are 199 pt wide in the captures. */
const CHOICE: CSSProperties = { width: 200 };

/**
 * Why settings that have nothing to act on when served are dimmed. The desktop's server keeps every
 * conversation and decides what it notifies, and the account the person logged in with is how they
 * are reached.
 */
export const SERVED_UNAVAILABLE: Readonly<Partial<Record<keyof MessagesSettings, string>>> = {
  keep: "This desktop's server keeps messages until you delete or clear them.",
  saveHistory: "This desktop's server keeps every conversation, closed or not.",
  notifyUnknown: "This desktop's server tells you of every message, whoever sends it.",
  notifyMention:
    "This desktop's server tells you of every message, and does not look for your name in them.",
  saveTo: "Save to Downloads, under each received file, is where this desktop saves them.",
  iCloud: "This desktop's server keeps your conversations, not iCloud.",
  reachable: "People reach you here by the account you logged in with.",
  startFrom: "New conversations here start from the account you logged in with.",
};

/**
 * Why Sign Out is dimmed: Messages uses the account the person logged in to the desktop with, and signs out with it
 * (Log Out in the Apple menu).
 */
export const SIGN_OUT_UNAVAILABLE =
  "Messages uses the account you logged in to this desktop with: to sign out, choose Log Out from the Apple menu.";

/*
 * The General pane as captured, laid out by the library's Form through what its page
 * documents (form.mdx): the `labelWidth` prop for a label column of 154.5 pt, so that the
 * controls' bezels start 183 pt from the window's edge whatever the font sets the labels to,
 * and `--mac-form-row-gap` ("CSS variable" table) for rows 6 pt apart. A preferences window's
 * own form centres its columns and has no width for the label column.
 */
const LABELS = 154.5;
const ROWS = { "--mac-form-row-gap": "6px" } as CSSProperties;
/* Outer margins: the pop-up button under the checkboxes is 8.5 pt lower, 2 pt more than a
   row; the help button shares the slider's row, its disc 21 pt from the window's edge. */
const CHECKS: CSSProperties = { marginBlockEnd: 2 };
const HELP: CSSProperties = { marginBlockStart: -15, marginInlineEnd: 0.5 };

/** The four checkboxes of the General pane, in the order of the capture. */
const APPLICATION = [
  ["saveHistory", "Save history when conversations are closed"],
  ["notifyUnknown", "Notify me about messages from unknown contacts"],
  ["notifyMention", "Notify me when my name is mentioned"],
  ["playSounds", "Play sound effects"],
] as const;

/* The window's bar is its drag region, except for what takes a press itself: the library's
   test of a drag region's own surface (macalicious/lib/window-drag-region). */
const onBar = (target: EventTarget) =>
  target instanceof Element &&
  target.closest("[data-window-drag-region]") !== null &&
  isWindowDragRegion(target);

export interface MessagesPreferencesProps
  extends Omit<PreferencesWindowProps, "toolbar" | "children" | "modal"> {
  /** The settings, when the owner holds them. Use with `onSettingsChange`. */
  settings?: MessagesSettings;
  /**
   * The settings the window starts with, when it holds them itself.
   * @default the settings of the reference screenshots
   */
  defaultSettings?: MessagesSettings;
  /** Called with all settings whenever one changes: they take effect at once. */
  onSettingsChange?: (settings: MessagesSettings) => void;
  /**
   * Called when a pane's Help button is pressed: the served desktop opens Help Viewer.
   * @default none: the buttons are drawn as captured, and do nothing
   */
  onHelp?: () => void;
  /**
   * Why a setting has nothing to act on, by setting, from a host where it has not: that control is
   * dimmed, with the reason as its tooltip.
   * @default none: every control is drawn enabled, as captured
   */
  unavailable?: Readonly<Partial<Record<keyof MessagesSettings, string>>>;
  /**
   * The person's own account, from a host that has one: the iMessage pane names it instead of the
   * invented Apple ID and addresses.
   */
  account?: string;
  /** What a Blocked pane holds, from a host whose account has a list of blocked people. */
  blockedPane?: ReactNode;
  /** Called when the minimize button is activated: Messages leaves it enabled. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** Disable the minimize button, as a window manager does in full screen. */
  minimizeDisabled?: boolean;
  /**
   * Called when the primary pointer button goes down on the title bar or the toolbar's
   * surface, not on a control or a toolbar item: a window manager starts moving the window
   * here.
   */
  onDragRegionPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  /** Called when the title bar or the toolbar's surface is double-clicked. */
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
  /** Accepted from a window manager and not used: a preferences window does not zoom. */
  onZoom?: (event: MouseEvent<HTMLElement>) => void;
  /** Accepted from a window manager and not used. */
  zoomRole?: "full-screen" | "zoom" | "exit-full-screen";
  /** Accepted from a window manager and not used: the zoom button is always disabled. */
  zoomDisabled?: boolean;
}

/**
 * Messages' Preferences window: General, the pane of the reference screenshots, and iMessage.
 * Its root is the library's `PreferencesWindow`, which takes every other prop (`state`,
 * `onClose`, `value`, `style` and so on). It is modeless, as in Messages.
 *
 * It is opened by the Messages window beside itself, and it accepts what a `ManagedWindow`
 * hands to its `render` function, so a window manager can host it as a window of its own.
 * It sizes itself to its pane: host it as a window that is not resizable, at the width of
 * the descriptor and with `height="auto"`, since a managed window stretches what it hosts to
 * its frame, and give the manager's frame the height the window has.
 */
export function MessagesPreferences({
  settings: controlled,
  defaultSettings = DEFAULT_SETTINGS,
  onSettingsChange,
  onClose,
  onHelp,
  unavailable,
  account,
  blockedPane,
  onMinimize,
  minimizeDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  onZoom: _onZoom,
  zoomRole: _zoomRole,
  zoomDisabled: _zoomDisabled,
  onPointerDown,
  onDoubleClick,
  width = PREFERENCES_WIDTH,
  className,
  ...props
}: MessagesPreferencesProps) {
  const [own, setOwn] = useState(defaultSettings);
  const id = useId();
  const settings = controlled ?? own;
  const help = <HelpButton onClick={onHelp} />;
  const addresses = account ? [account] : ADDRESSES;
  const set = (change: Partial<MessagesSettings>) => {
    const next = { ...settings, ...change };
    setOwn(next);
    onSettingsChange?.(next);
  };
  const choice = (
    name: "keep" | "sound" | "saveTo" | "startFrom",
    label: string,
    options: readonly string[],
    image?: ReactNode,
    shown: string = settings[name],
  ) => (
    <FormRow label={label} align="center">
      <PopUpButton
        value={shown}
        disabled={unavailable?.[name] !== undefined}
        title={unavailable?.[name]}
        onValueChange={(value) => value != null && set({ [name]: value })}
        style={CHOICE}
      >
        {choicesWith(options, shown).map((option) => (
          <PopUpButtonItem key={option} value={option} image={image}>
            {option}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
    </FormRow>
  );

  return (
    <PreferencesWindow
      width={width}
      onClose={onClose}
      // Messages leaves the minimize button of its Preferences enabled, as the captures show.
      controls={
        <WindowControls
          zoomDisabled
          onClose={onClose}
          onMinimize={onMinimize}
          minimizeDisabled={minimizeDisabled}
        />
      }
      className={className ? `mac-messages-preferences ${className}` : "mac-messages-preferences"}
      toolbar={
        <PreferencesToolbar aria-label="Messages preferences">
          <PreferencesToolbarItem value="general" icon={<PaneIcon />}>
            General
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="imessage" icon={<PaneIcon />}>
            iMessage
          </PreferencesToolbarItem>
          {blockedPane ? (
            <PreferencesToolbarItem value="blocked" icon={<PaneIcon />}>
              Blocked
            </PreferencesToolbarItem>
          ) : null}
        </PreferencesToolbar>
      }
      // The preferences window does not pass on its title bar's drag-region callbacks, so the
      // bar is watched from the root.
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented && event.button === 0 && onBar(event.target)) {
          onDragRegionPointerDown?.(event);
        }
      }}
      onDoubleClick={(event) => {
        onDoubleClick?.(event);
        if (!event.defaultPrevented && onBar(event.target)) onDragRegionDoubleClick?.(event);
      }}
      {...props}
    >
      <PreferencesWindowPane value="general">
        <div className="mac-messages-preferences-general">
          <Form render={<div />} labelWidth={LABELS} style={ROWS}>
            {choice("keep", "Keep messages:", KEEP_CHOICES)}
            <FormRow label="Application:" kind="group" orientation="vertical" style={CHECKS}>
              {APPLICATION.map(([name, label]) => (
                <Checkbox
                  key={name}
                  checked={settings[name]}
                  disabled={unavailable?.[name] !== undefined}
                  title={unavailable?.[name]}
                  onCheckedChange={(checked) => set({ [name]: checked })}
                >
                  {label}
                </Checkbox>
              ))}
            </FormRow>
            {choice("sound", "Message received sound:", SOUND_CHOICES)}
            {choice("saveTo", "Save received files to:", FOLDER_CHOICES, <FolderIcon />)}
            {/* By their top edges, the form's own option for controls without text of their
                own line. On first baselines the row's height depended on how an engine
                rounds a font's ascent: the block's first baseline is the small letter's,
                which put the block 0, 0.28 or 0.5 pt under the label and made the window
                309 pt high in two engines and 310 in the third. The top edges are where
                the baselines put the two in the capture's engine, so nothing moves there. */}
            <FormRow label="Text size:" kind="group" align="start">
              <div className="mac-messages-preferences-size">
                <span className="mac-messages-preferences-size-small" aria-hidden="true">
                  A
                </span>
                <span className="mac-messages-preferences-size-large" aria-hidden="true">
                  A
                </span>
                <Slider
                  className="mac-messages-preferences-slider"
                  aria-label="Text size"
                  min={0}
                  max={TEXT_SIZES.length - 1}
                  tickMarks={TEXT_SIZES.length}
                  tickMarkValuesOnly
                  value={textSizeStep(settings.textSize)}
                  onValueChange={(textSize) => set({ textSize })}
                  getAriaValueText={(_, step) => `${TEXT_SIZES[step] ?? ""} points`}
                />
              </div>
            </FormRow>
          </Form>
          <PreferencesWindowFooter style={HELP}>{help}</PreferencesWindowFooter>
        </div>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="imessage">
        <div className="mac-messages-preferences-imessage">
          <div className="mac-messages-preferences-account">
            <Label selectable>{account ? `Account: ${account}` : `Apple ID: ${ACCOUNT}`}</Label>
            <PushButton disabled focusableWhenDisabled title={SIGN_OUT_UNAVAILABLE}>
              Sign Out
            </PushButton>
          </div>
          <Checkbox
            checked={settings.iCloud}
            disabled={unavailable?.iCloud !== undefined}
            title={unavailable?.iCloud}
            onCheckedChange={(iCloud) => set({ iCloud })}
          >
            Enable Messages in iCloud
          </Checkbox>
          {/* biome-ignore lint/a11y/useSemanticElements: a group of checkboxes named by its label, not a form fieldset */}
          <div role="group" aria-labelledby={`${id}reach`}>
            <Label id={`${id}reach`}>You can be reached for messages at:</Label>
            <div className="mac-messages-preferences-indent">
              {addresses.map((address) => (
                <Checkbox
                  key={address}
                  checked={account !== undefined || settings.reachable[address] === true}
                  disabled={unavailable?.reachable !== undefined}
                  title={unavailable?.reachable}
                  onCheckedChange={(checked) =>
                    set({ reachable: { ...settings.reachable, [address]: checked } })
                  }
                >
                  {address}
                </Checkbox>
              ))}
            </div>
          </div>
          <Checkbox
            checked={settings.readReceipts}
            onCheckedChange={(readReceipts) => set({ readReceipts })}
          >
            Send read receipts
          </Checkbox>
          <Form render={<div />}>
            {choice("startFrom", "Start new conversations from:", addresses, undefined, account)}
          </Form>
        </div>
        <PreferencesWindowFooter>{help}</PreferencesWindowFooter>
      </PreferencesWindowPane>
      {blockedPane ? (
        <PreferencesWindowPane value="blocked">{blockedPane}</PreferencesWindowPane>
      ) : null}
    </PreferencesWindow>
  );
}
