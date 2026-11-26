"use client";

import { Checkbox } from "macalicious/checkbox";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { FONT_FAMILIES, FONT_SIZES } from "macalicious/lib/rich-text";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PreferencesToolbar, PreferencesToolbarItem } from "macalicious/preferences-toolbar";
import {
  PreferencesWindow,
  PreferencesWindowFooter,
  PreferencesWindowForm,
  PreferencesWindowPane,
  type PreferencesWindowProps,
  PreferencesWindowRow,
} from "macalicious/preferences-window";
import { WindowControls } from "macalicious/window-controls";
import { type CSSProperties, type ReactNode, useId, useState } from "react";
import { MailChoiceIcon, MailPaneIcon } from "./mail-artwork";
import {
  DEFAULT_SETTINGS,
  GENERAL_CHECKS,
  GENERAL_CHOICES,
  type MailChoice,
  type MailSettings,
  OTHER_PANES,
  SEARCH_CHECKS,
} from "./mail-data";
import { playMailSound } from "./mail-sounds";
import "./mail.tokens.css";
import "./mail.css";

export interface MailPreferencesProps
  extends Omit<PreferencesWindowProps, "toolbar" | "children" | "modal"> {
  /**
   * Why a General setting does nothing where this window is hosted, by the setting's id: it shows
   * dimmed, saying so. The capture shows every one enabled, so the served desktop alone passes
   * `SERVED_SETTING_REASONS`.
   */
  settingReasons?: Readonly<Record<string, string>>;
  /** What the Accounts pane holds, from a host that knows the person. */
  accountPane?: ReactNode;
  /** What the Junk Mail pane holds besides its filter's checks. */
  blockedPane?: ReactNode;
  /** The settings, when the owner holds them. Use with `onSettingsChange`. */
  settings?: MailSettings;
  /** The settings the window starts with, when it holds them itself. */
  defaultSettings?: MailSettings;
  /** Called with all settings whenever one changes: they take effect at once, as in Mail. */
  onSettingsChange?: (settings: MailSettings) => void;
  /**
   * Why the panes' Help buttons are dimmed, given by a host that has no help book for Mail (the
   * served desktop passes `MAIL_HELP_UNAVAILABLE`): shown as each button's tooltip.
   * @default none: the buttons are drawn enabled, as captured
   */
  helpUnavailable?: string;
  /**
   * What the Rules pane holds, given the element a sheet hangs from: only a host that runs rules has
   * one.
   */
  rulesPane?: (anchor: HTMLElement | null) => ReactNode;
  /** What the Signatures pane holds, from a host that keeps signatures. */
  signaturesPane?: ReactNode;
}

/**
 * Why the panes' Help buttons are unavailable on the served desktop: it has no help book for Mail
 * (its Help menu's Mail Help is dimmed too). The desktop passes it to `MailPreferences` as
 * `helpUnavailable`, which shows it as each button's tooltip and dims the buttons.
 */
export const MAIL_HELP_UNAVAILABLE =
  "Mail Help is not available: this desktop has no help book for Mail.";

/** The General settings that a desktop served by its Ferrite application cannot act on. */
export const SERVED_SETTING_REASONS: Readonly<Record<string, string>> = {
  notifications:
    "The server notifies a person of everything delivered to them, but for a muted conversation.",
  splitView: "Mail here has no split view: a message opens in a window of its own.",
  searchEncrypted: "Mail on this desktop neither encrypts nor reads encrypted messages.",
};

/** Why Composing's Send new messages from is dimmed. */
const ONE_SENDER = "This desktop gives each person one account, which every message comes from.";

/** The fonts' sizes the message list's rows have room for. */
const LIST_SIZES = ["9", "10", "11", "12", "13"];

/**
 * The message list's font chosen in Fonts & Colors, or nothing while none has been: its rows then
 * have the fonts the reference screenshots show.
 */
export function listFontStyle(settings: MailSettings): CSSProperties | undefined {
  const { listFont, listSize } = settings;
  if (listFont === undefined && listSize === undefined) return undefined;
  const family = FONT_FAMILIES.find(({ name }) => name === listFont)?.css;
  return {
    "--mac-mail-list-font": `${Number(listSize) || 12}px ${family ?? "Helvetica, Arial, sans-serif"}`,
  } as CSSProperties;
}

/**
 * The message font chosen in Fonts & Colors as the styles a window sets, or nothing while none has
 * been: a message then has the window's own font, as the reference screenshots show.
 */
export function messageFontStyle(settings: MailSettings): CSSProperties | undefined {
  const { messageFont, messageSize } = settings;
  if (messageFont === undefined && messageSize === undefined) return undefined;
  const family = FONT_FAMILIES.find(({ name }) => name === messageFont)?.css;
  const font = `${Number(messageSize) || 12}px / 1.1667 ${family ?? "Helvetica, Arial, sans-serif"}`;
  return {
    "--mac-mail-compose-message-font": font,
    "--mac-mail-message-font": font,
  } as CSSProperties;
}

/**
 * Mail's Preferences window: eight panes, of which General is the one in the reference
 * screenshots. Its root is the library's `PreferencesWindow`, which takes every other prop
 * (`state`, `onClose`, `value`, `style` and so on).
 */
export function MailPreferences({
  settings: controlled,
  defaultSettings = DEFAULT_SETTINGS,
  onSettingsChange,
  onClose,
  helpUnavailable,
  rulesPane,
  signaturesPane,
  settingReasons,
  accountPane,
  blockedPane,
  width = 550,
  className,
  ...props
}: MailPreferencesProps) {
  const [own, setOwn] = useState(defaultSettings);
  const [toolbarElement, setToolbarElement] = useState<HTMLDivElement | null>(null);
  const id = useId();
  const settings = controlled ?? own;
  const help =
    helpUnavailable === undefined ? (
      <HelpButton />
    ) : (
      <HelpButton disabled title={helpUnavailable} />
    );
  const set = (id: string, value: boolean | string) => {
    const next = { ...settings, [id]: value };
    setOwn(next);
    onSettingsChange?.(next);
  };
  const check = ([id, label, given]: readonly [string, string, string?]) => {
    const why = given ?? settingReasons?.[id];
    return (
      <Checkbox
        key={id}
        checked={why === undefined && settings[id] === true}
        disabled={why !== undefined}
        title={why}
        onCheckedChange={(checked) => set(id, checked)}
      >
        {label}
      </Checkbox>
    );
  };
  const choice = ({ id: name, label, options, width, icon }: MailChoice) => (
    <PreferencesWindowRow key={name} label={label} labelFor={`${id}${name}`} align="center">
      <PopUpButton
        id={`${id}${name}`}
        value={String(settings[name] ?? options[0])}
        disabled={settingReasons?.[name] !== undefined}
        title={settingReasons?.[name]}
        onValueChange={(value) => {
          if (value == null) return;
          set(name, value);
          if (name === "sound") playMailSound(value);
        }}
        style={{ width }}
      >
        {options.map((option, index) => (
          <PopUpButtonItem
            key={option}
            value={option}
            image={icon && index === 0 ? <MailChoiceIcon name={icon} /> : undefined}
          >
            {option}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
    </PreferencesWindowRow>
  );

  return (
    <PreferencesWindow
      width={width}
      onClose={onClose}
      // Mail leaves the minimize button of its Preferences enabled, as the captures show.
      controls={<WindowControls zoomDisabled onClose={onClose} />}
      className={className ? `mac-mail-preferences ${className}` : "mac-mail-preferences"}
      toolbar={
        <PreferencesToolbar ref={setToolbarElement} aria-label="Mail preferences">
          <PreferencesToolbarItem value="general" icon={<MailPaneIcon pane="general" />}>
            General
          </PreferencesToolbarItem>
          {OTHER_PANES.map(({ value, label }) => (
            <PreferencesToolbarItem key={value} value={value} icon={<MailPaneIcon pane={value} />}>
              {label}
            </PreferencesToolbarItem>
          ))}
        </PreferencesToolbar>
      }
      {...props}
    >
      <PreferencesWindowPane value="general" className="mac-mail-preferences-general">
        <div className="mac-mail-preferences-form">
          <PreferencesWindowForm>
            {GENERAL_CHOICES.slice(0, 3).map(choice)}
            <PreferencesWindowRow style={{ marginBlockStart: -2 }}>
              {check(["playSounds", "Play sounds for other mail actions"])}
            </PreferencesWindowRow>
            <div className="mac-mail-preferences-gap" />
            {GENERAL_CHOICES.slice(3).map(choice)}
          </PreferencesWindowForm>
        </div>
        <div className="mac-mail-preferences-checks">{GENERAL_CHECKS.map(check)}</div>
        {/* biome-ignore lint/a11y/useSemanticElements: a group of checkboxes named by its label, not a form fieldset */}
        <div role="group" aria-labelledby={`${id}search`}>
          <Label id={`${id}search`} className="mac-mail-preferences-heading">
            When searching all mailboxes, include results from:
          </Label>
          <div className="mac-mail-preferences-checks" data-indent="">
            {SEARCH_CHECKS.map(check)}
          </div>
        </div>
        <PreferencesWindowFooter className="mac-mail-preferences-footer">
          {help}
        </PreferencesWindowFooter>
      </PreferencesWindowPane>
      {OTHER_PANES.map(({ value, checks }) => (
        <PreferencesWindowPane key={value} value={value}>
          {value === "rules" && rulesPane ? rulesPane(toolbarElement) : null}
          {value === "signatures" ? signaturesPane : null}
          {value === "accounts" ? accountPane : null}
          {value === "composing" ? (
            <div className="mac-mail-preferences-checks">
              <div className="mac-mail-smart-line">
                <Label>Message format:</Label>
                <PopUpButton
                  aria-label="Message Format"
                  value={String(settings.messageFormat ?? "Rich Text")}
                  onValueChange={(next) => next != null && set("messageFormat", String(next))}
                >
                  <PopUpButtonItem value="Rich Text">Rich Text</PopUpButtonItem>
                  <PopUpButtonItem value="Plain Text">Plain Text</PopUpButtonItem>
                </PopUpButton>
              </div>
              <div className="mac-mail-smart-line">
                <Label>Send new messages from:</Label>
                <PopUpButton
                  aria-label="Send New Messages From"
                  disabled
                  title={ONE_SENDER}
                  value="account"
                >
                  <PopUpButtonItem value="account">This desktop’s account</PopUpButtonItem>
                </PopUpButton>
              </div>
            </div>
          ) : null}
          {value === "fonts" ? (
            <div className="mac-mail-preferences-checks mac-mail-smart-line">
              <Label>Message list font:</Label>
              <PopUpButton
                aria-label="Message List Font"
                value={String(settings.listFont ?? "Helvetica")}
                onValueChange={(next) => next != null && set("listFont", String(next))}
              >
                {FONT_FAMILIES.map(({ name }) => (
                  <PopUpButtonItem key={name} value={name}>
                    {name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
              <PopUpButton
                aria-label="Message List Font Size"
                value={String(settings.listSize ?? "12")}
                onValueChange={(next) => next != null && set("listSize", String(next))}
              >
                {LIST_SIZES.map((size) => (
                  <PopUpButtonItem key={size} value={size}>
                    {size}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </div>
          ) : null}
          {value === "fonts" ? (
            <div className="mac-mail-preferences-checks mac-mail-smart-line">
              <Label>Message font:</Label>
              <PopUpButton
                aria-label="Message Font"
                value={String(settings.messageFont ?? "Helvetica")}
                onValueChange={(value) => value != null && set("messageFont", String(value))}
              >
                {FONT_FAMILIES.map(({ name }) => (
                  <PopUpButtonItem key={name} value={name}>
                    {name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
              <PopUpButton
                aria-label="Message Font Size"
                value={String(settings.messageSize ?? "12")}
                onValueChange={(value) => value != null && set("messageSize", String(value))}
              >
                {FONT_SIZES.map((size) => (
                  <PopUpButtonItem key={size} value={String(size)}>
                    {size}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </div>
          ) : null}
          {checks.length > 0 && !(value === "signatures" && signaturesPane) ? (
            <div className="mac-mail-preferences-checks">{checks.map(check)}</div>
          ) : null}
          {value === "junk" ? blockedPane : null}
          <PreferencesWindowFooter>{help}</PreferencesWindowFooter>
        </PreferencesWindowPane>
      ))}
    </PreferencesWindow>
  );
}
