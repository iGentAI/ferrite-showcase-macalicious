"use client";

import { Checkbox } from "macalicious/checkbox";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PreferencesToolbar, PreferencesToolbarItem } from "macalicious/preferences-toolbar";
import {
  PreferencesWindow,
  PreferencesWindowForm,
  PreferencesWindowPane,
  type PreferencesWindowProps,
  PreferencesWindowRow,
} from "macalicious/preferences-window";
import { WindowControls } from "macalicious/window-controls";
import { type CSSProperties, type ReactNode, useId, useState } from "react";
import { PaneIcon } from "./podcasts-artwork";
import {
  DEFAULT_SETTINGS,
  DOWNLOAD_CHOICES,
  type PodcastsSettings,
  REFRESH_CHOICES,
  SKIP_CHOICES,
} from "./podcasts-data";
import "./podcasts.tokens.css";
import "./podcasts.css";

/** The frame's width in the reference screenshots. */
export const PREFERENCES_WIDTH = 383;

/** The General pane's pop-up bezels run from 240 to 357 pt across the window in the capture,
 * which the library's 118.5 pt pop-up button draws (its bezel starts 1 pt inside its box). */
const CHOICE = { width: 118.5 };

/**
 * The pop-up buttons are 27 pt apart: 6 pt between the 21 pt rows. The labels end 6 pt before
 * the pop-up's box (the colon's ink at 232 pt across the window, 8 pt before the bezel).
 */
const FORM = {
  "--mac-preferences-window-row-gap": "6px",
  "--mac-preferences-window-label-gap": "6px",
} as CSSProperties;

export interface PodcastsPreferencesProps
  extends Omit<PreferencesWindowProps, "toolbar" | "children" | "modal"> {
  /** The settings, when the owner holds them. Use with `onSettingsChange`. */
  settings?: PodcastsSettings;
  /**
   * The settings the window starts with, when it holds them itself.
   * @default the settings of the reference screenshots
   */
  defaultSettings?: PodcastsSettings;
  /** Called with all settings whenever one changes: they take effect at once. */
  onSettingsChange?: (settings: PodcastsSettings) => void;
  /**
   * Why no episode is downloaded: the General pane then shows it under its pop-up buttons, and
   * Automatically Download Episodes keeps its choice but cannot be changed. The Ferrite desktop
   * gives it, since it never downloads anyone's audio.
   */
  downloadNote?: string;
  /**
   * Why subscriptions need no syncing: the Advanced pane then shows it, and the checkbox stays
   * ticked and dimmed. The Ferrite desktop gives it, since the server keeps the person's shows.
   */
  syncNote?: string;
  /**
   * The window has a fixed size: its zoom button is dimmed, as a Preferences window's is. The
   * Ferrite desktop gives it, so the button does not sit enabled doing nothing.
   * @default false: the zoom button is enabled, as the captures show
   */
  fixedSize?: boolean;
}

/**
 * Podcasts' Preferences window: General, the pane of the reference screenshots, Playback and
 * Advanced. Its root is the library's `PreferencesWindow`, which takes every other prop
 * (`state`, `onClose`, `value`, `style` and so on). It is modeless, as in Podcasts.
 */
export function PodcastsPreferences({
  settings: controlled,
  defaultSettings = DEFAULT_SETTINGS,
  onSettingsChange,
  downloadNote,
  syncNote,
  fixedSize = false,
  onClose,
  width = PREFERENCES_WIDTH,
  className,
  ...props
}: PodcastsPreferencesProps) {
  const [own, setOwn] = useState(defaultSettings);
  const id = useId();
  const settings = controlled ?? own;
  const set = (change: Partial<PodcastsSettings>) => {
    const next = { ...settings, ...change };
    setOwn(next);
    onSettingsChange?.(next);
  };
  const choice = (
    name: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    items: ReactNode,
    disabled = false,
  ) => (
    <PreferencesWindowRow label={label} labelFor={`${id}${name}`} align="center">
      <PopUpButton
        id={`${id}${name}`}
        value={value}
        onValueChange={(next) => next != null && onChange(next)}
        disabled={disabled || undefined}
        style={CHOICE}
      >
        {items}
      </PopUpButton>
    </PreferencesWindowRow>
  );
  const titled = (options: readonly string[]) =>
    options.map((option) => (
      <PopUpButtonItem key={option} value={option}>
        {option}
      </PopUpButtonItem>
    ));
  const seconds = SKIP_CHOICES.map((option) => (
    <PopUpButtonItem key={option} value={String(option)}>
      {option} Seconds
    </PopUpButtonItem>
  ));

  return (
    <PreferencesWindow
      width={width}
      onClose={onClose}
      // The captures show Podcasts' zoom button enabled; where the window's size is fixed (the
      // desktop says so with `fixedSize`) it is dimmed, keeping its Zoom role and name.
      controls={
        <WindowControls
          minimizeDisabled
          zoomRole="zoom"
          zoomDisabled={fixedSize}
          onClose={onClose}
        />
      }
      className={className ? `mac-podcasts-preferences ${className}` : "mac-podcasts-preferences"}
      toolbar={
        <PreferencesToolbar aria-label="Podcasts preferences">
          <PreferencesToolbarItem value="general" icon={<PaneIcon pane="general" />}>
            General
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="playback" icon={<PaneIcon pane="playback" />}>
            Playback
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="advanced" icon={<PaneIcon pane="advanced" />}>
            Advanced
          </PreferencesToolbarItem>
        </PreferencesToolbar>
      }
      {...props}
    >
      <PreferencesWindowPane value="general" className="mac-podcasts-preferences-pane">
        <PreferencesWindowForm style={FORM}>
          {choice(
            "refresh",
            "Refresh Podcasts:",
            settings.refresh,
            (refresh) => set({ refresh }),
            titled(REFRESH_CHOICES),
          )}
          {choice(
            "download",
            "Automatically Download Episodes:",
            settings.download,
            (download) => set({ download }),
            titled(DOWNLOAD_CHOICES),
            downloadNote !== undefined,
          )}
          {downloadNote !== undefined ? (
            <PreferencesWindowRow>
              <p className="mac-podcasts-preferences-note">{downloadNote}</p>
            </PreferencesWindowRow>
          ) : null}
        </PreferencesWindowForm>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="playback" className="mac-podcasts-preferences-pane">
        <PreferencesWindowForm style={FORM}>
          {choice(
            "forward",
            "Skip Forward:",
            String(settings.skipForward),
            (value) => set({ skipForward: Number(value) }),
            seconds,
          )}
          {choice(
            "back",
            "Skip Back:",
            String(settings.skipBack),
            (value) => set({ skipBack: Number(value) }),
            seconds,
          )}
          <PreferencesWindowRow>
            <Checkbox
              checked={settings.continuous}
              onCheckedChange={(continuous) => set({ continuous })}
            >
              Continuous Playback
            </Checkbox>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="advanced" className="mac-podcasts-preferences-pane">
        <Checkbox
          checked={syncNote !== undefined || settings.sync}
          disabled={syncNote !== undefined}
          title={syncNote}
          onCheckedChange={(sync) => set({ sync })}
        >
          Sync subscriptions across devices
        </Checkbox>
        {syncNote !== undefined ? (
          <p className="mac-podcasts-preferences-note">{syncNote}</p>
        ) : null}
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
