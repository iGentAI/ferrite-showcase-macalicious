"use client";

import { Label } from "macalicious/label";
import { ListView, ListViewRowDetail, ListViewRowTitle } from "macalicious/list-view";
import { ProgressSpinner } from "macalicious/progress-spinner";
import { PushButton } from "macalicious/push-button";
import { SearchField } from "macalicious/search-field";
import { TagDot } from "macalicious/tag-dot";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MailMessage } from "./mail-data";
import { NO_OUTSIDE_MAIL } from "./mail-menus";
import { MailRawSource } from "./mail-message-window";
import type { MailRecipient } from "./mail-tools";

/** Window > Activity, Previous Recipients and Connection Doctor: small windows of Mail's own. */
export interface MailToolWindowProps extends WindowProps {
  controlsProps?: WindowControlsProps;
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

function ToolWindow({
  title,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  children,
  ...props
}: MailToolWindowProps & { title: string }) {
  return (
    <Window aria-label={title} {...props}>
      <TitleBar
        title={title}
        controls={<WindowControls {...controlsProps} />}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />
      <WindowBody background="content" className="mac-mail-tool">
        {children}
      </WindowBody>
    </Window>
  );
}

const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** View > Message > Raw Source: a message as it is kept, in a window of its own. */
export function MailSourceWindow({
  message,
  readBody,
  ...props
}: MailToolWindowProps & {
  message: MailMessage;
  readBody?: (message: MailMessage) => Promise<string | null>;
}) {
  return (
    <ToolWindow title={`Raw Source of ${message.subject}`} {...props}>
      <MailRawSource message={message} readBody={readBody} />
    </ToolWindow>
  );
}

/** What Mail is doing: looking for new mail and sending, each with when it last did so. */
export function MailActivityWindow({
  checking,
  sending,
  lastChecked,
  ...props
}: MailToolWindowProps & {
  checking: boolean;
  sending: boolean;
  /** When new mail was last looked for, or `null` since Mail opened. */
  lastChecked: number | null;
}) {
  const row = (busy: boolean, what: string, idle: string) => (
    <li className="mac-mail-tool-row">
      {busy ? <ProgressSpinner size="small" aria-label={what} /> : null}
      <Label>{busy ? what : idle}</Label>
    </li>
  );
  return (
    <ToolWindow title="Activity" {...props}>
      <ul className="mac-mail-tool-list">
        {row(
          checking,
          "Checking for new mail…",
          lastChecked === null
            ? "Not checked since Mail opened"
            : `Last checked at ${timeOf(lastChecked)}`,
        )}
        {row(sending, "Sending a message…", "No messages being sent")}
      </ul>
    </ToolWindow>
  );
}

/** The people written to, from what the Sent mailbox holds: search, write to, add or take off. */
export function MailRecipientsWindow({
  recipients,
  onNewMessage,
  canAddContact,
  onAddContact,
  onRemove,
  ...props
}: MailToolWindowProps & {
  recipients: readonly MailRecipient[];
  onNewMessage: (recipient: MailRecipient) => void;
  canAddContact: (recipient: MailRecipient) => boolean;
  onAddContact: (recipient: MailRecipient) => void;
  onRemove: (recipient: MailRecipient) => void;
}) {
  const [query, setQuery] = useState("");
  const [chosenAddress, setChosenAddress] = useState<string | null>(null);
  const shown = useMemo(
    () =>
      recipients.filter((each) => each.written.toLowerCase().includes(query.trim().toLowerCase())),
    [recipients, query],
  );
  const chosen = shown.find((each) => each.address === chosenAddress) ?? null;
  return (
    <ToolWindow title="Previous Recipients" {...props}>
      <SearchField
        aria-label="Search recipients"
        size="small"
        value={query}
        onValueChange={setQuery}
        className="mac-mail-tool-search"
      />
      {shown.length > 0 ? (
        <ListView
          aria-label="Previous recipients"
          className="mac-mail-tool-people"
          count={shown.length}
          rowHeight={56}
          selectionMode="single"
          getRowId={(index) => shown[index]?.address ?? index}
          getRowLabel={(index) => shown[index]?.written ?? ""}
          value={chosen ? [chosen.address] : []}
          onValueChange={(value) =>
            setChosenAddress(value[0] === undefined ? null : String(value[0]))
          }
          renderRow={(index) => {
            const each = shown[index];
            return each ? (
              <>
                <ListViewRowTitle>{each.written}</ListViewRowTitle>
                <ListViewRowDetail>
                  {new Date(each.last).toLocaleDateString("en-US", { dateStyle: "short" })}
                </ListViewRowDetail>
              </>
            ) : null;
          }}
        />
      ) : (
        <Label color="secondary" role="status" className="mac-mail-tool-people">
          {recipients.length === 0 ? "Nobody has been written to yet." : "No Results"}
        </Label>
      )}
      <Label color="secondary" textStyle="small">
        Read from the messages in Sent that are loaded.
      </Label>
      <div className="mac-mail-tool-buttons">
        <PushButton disabled={!chosen} onClick={() => chosen && onRemove(chosen)}>
          Remove From List
        </PushButton>
        <PushButton
          disabled={!chosen || !canAddContact(chosen)}
          title={
            chosen && !canAddContact(chosen)
              ? "Only someone with an account on this desktop has a card to add."
              : undefined
          }
          onClick={() => chosen && onAddContact(chosen)}
        >
          Add to Contacts
        </PushButton>
        <PushButton disabled={!chosen} onClick={() => chosen && onNewMessage(chosen)}>
          New Message
        </PushButton>
      </div>
    </ToolWindow>
  );
}

/** What asking the server came to. */
export interface MailConnectionReport {
  ok: boolean;
  detail: string;
}

/** Asks the server this Mail talks to whether it answers, and says the other connections it lacks. */
export function MailDoctorWindow({
  check,
  ...props
}: MailToolWindowProps & { check: () => Promise<MailConnectionReport> }) {
  const [report, setReport] = useState<MailConnectionReport | null>(null);
  const run = useCallback(() => {
    setReport(null);
    check().then(setReport, () =>
      setReport({ ok: false, detail: "The request could not be made." }),
    );
  }, [check]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: asked once as the window opens; Check Again asks again
  useEffect(run, []);
  return (
    <ToolWindow title="Connection Doctor" {...props}>
      <ul className="mac-mail-tool-list">
        <li className="mac-mail-tool-row">
          {report ? (
            <TagDot color={report.ok ? "green" : "red"} size="small" />
          ) : (
            <ProgressSpinner size="small" aria-label="Checking" />
          )}
          <Label>This desktop’s mail server: {report ? report.detail : "Checking…"}</Label>
        </li>
        <li className="mac-mail-tool-row">
          <TagDot color="gray" size="small" />
          <Label color="secondary">Outside mail: {NO_OUTSIDE_MAIL}</Label>
        </li>
      </ul>
      <div className="mac-mail-tool-buttons">
        <PushButton disabled={report === null} onClick={run}>
          Check Again
        </PushButton>
      </div>
    </ToolWindow>
  );
}
