"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import { Label } from "macalicious/label";
import { MenuItem } from "macalicious/menu-item";
import { ScrollView } from "macalicious/scroll-view";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  Fragment,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import { useWindowKeys } from "../desktop/desktop-window-keys";
import { MailGlyph } from "./mail-artwork";
import { type MailMessage, showingAddresses } from "./mail-data";
import { useMailFind } from "./mail-find";
import { MailAddressToken } from "./mail-links";
import { MailFindItems } from "./mail-menus";
import { MailTabViewItems } from "./mail-tabs";
import { MailTextMenu } from "./mail-text-menu";

const VIEW_ITEMS = <MailTabViewItems />;

/** The header lines this desktop's mail keeps, as Raw Source and All Headers show them. */
export function mailHeaderLines(message: MailMessage): string[] {
  const to = message.toAddresses ?? message.to;
  return [
    `From: ${message.fromAddress ?? message.from}`,
    `To: ${to.join(", ")}`,
    ...(message.cc?.length ? [`Cc: ${message.cc.join(", ")}`] : []),
    ...(message.bcc?.length ? [`Bcc: ${message.bcc.join(", ")}`] : []),
    ...(message.replyTo ? [`Reply-To: ${message.replyTo}`] : []),
    ...(message.priority ? [`Priority: ${message.priority === "high" ? "High" : "Low"}`] : []),
    `Subject: ${message.subject}`,
    `Date: ${new Date(message.time).toUTCString()}`,
  ];
}

/** A message as it is kept: its header lines and its whole text, unformatted. */
export function MailRawSource({
  message,
  readBody,
}: {
  message: MailMessage;
  readBody?: (message: MailMessage) => Promise<string | null>;
}) {
  const [body, setBody] = useState<string | null | undefined>(readBody ? undefined : message.body);
  useEffect(() => {
    if (!readBody) return;
    let current = true;
    readBody(message).then(
      (text) => {
        if (current) setBody(text);
      },
      () => {
        if (current) setBody(null);
      },
    );
    return () => {
      current = false;
    };
  }, [message, readBody]);
  return (
    <ScrollView
      role="article"
      aria-label={`Raw source of ${message.subject}`}
      className="mac-mail-message"
    >
      <pre className="mac-mail-source">
        {mailHeaderLines(message).join("\n")}
        {"\n\n"}
        {body === undefined ? "" : (body ?? "The message's text could not be read.")}
      </pre>
    </ScrollView>
  );
}

/** A message's people as tokens, in the order of the line they stand in, with its commas. */
function AddressTokens({
  names,
  written,
}: {
  names: readonly string[];
  written?: readonly string[];
}) {
  return names.map((name, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: a line of one message never reorders
    <Fragment key={index}>
      {index > 0 ? ", " : null}
      <MailAddressToken name={name} written={written?.[index] ?? name} />
    </Fragment>
  ));
}

/** A message as the viewer's pane and a window of its own show it: its header, then its text. */
export function MailMessageContent({
  message: held,
  renderBody,
  allHeaders = false,
  rawSource = false,
  readBody,
  showAddresses = false,
  stacked = false,
  elsewhere,
  hoverBar,
  notice,
}: {
  message: MailMessage;
  renderBody?: (message: MailMessage) => ReactNode;
  /** View > Message > All Headers: every header line kept, over the text. */
  allHeaders?: boolean;
  /** View > Message > Raw Source: the message as it is kept, in place of how it reads. */
  rawSource?: boolean;
  /** Reads the whole text of a message the list holds only the start of. */
  readBody?: (message: MailMessage) => Promise<string | null>;
  /** Use Smart Addresses is off: people are shown by their addresses. */
  showAddresses?: boolean;
  /** One message of a conversation in a stack: the stack scrolls, not the message. */
  stacked?: boolean;
  /** The mailbox it is in, for a message of the conversation the list does not show. */
  elsewhere?: string;
  /** The buttons that show while the pointer is over the message. */
  hoverBar?: ReactNode;
  /** A line over the message: its sender is one the person blocked. */
  notice?: ReactNode;
}) {
  const [details, setDetails] = useState(false);
  if (rawSource) return <MailRawSource message={held} readBody={readBody} />;
  const message = showAddresses ? showingAddresses(held) : held;
  const content = (
    <>
      {elsewhere ? (
        <Label color="secondary" textStyle="small" className="mac-mail-elsewhere">
          In {elsewhere}
        </Label>
      ) : null}
      <div className="mac-mail-message-content">
        {hoverBar}
        {notice}
        <div className="mac-mail-header">
          <div className="mac-mail-header-text">
            <div className="mac-mail-header-line">
              <span className="mac-mail-from">{message.from}</span>
              <Label textStyle="small" color="secondary" className="mac-mail-received">
                {message.received}
              </Label>
            </div>
            <div className="mac-mail-header-line">
              <Label truncate selectable className="mac-mail-subject">
                {message.subject}
              </Label>
              <Label color="link" className="mac-mail-details">
                <BorderlessButton
                  aria-expanded={details}
                  // The corners of its focus ring.
                  style={{ borderRadius: 2 }}
                  onClick={() => setDetails(!details)}
                >
                  {details ? "Hide" : "Details"}
                </BorderlessButton>
              </Label>
            </div>
            {details ? (
              <Label color="secondary" selectable>
                To: <AddressTokens names={message.to} written={held.toAddresses} />
              </Label>
            ) : null}
            {details && message.cc?.length ? (
              <Label color="secondary" selectable>
                Cc: <AddressTokens names={message.cc} written={message.cc} />
              </Label>
            ) : null}
            {details && message.bcc?.length ? (
              <Label color="secondary" selectable>
                Bcc: <AddressTokens names={message.bcc} written={message.bcc} />
              </Label>
            ) : null}
            {details && message.replyTo ? (
              <Label color="secondary" selectable>
                Reply-To: <AddressTokens names={[message.replyTo]} written={[message.replyTo]} />
              </Label>
            ) : null}
            {allHeaders ? (
              <pre className="mac-mail-source" data-mail-headers="">
                {mailHeaderLines(message).join("\n")}
              </pre>
            ) : null}
          </div>
          <span className="mac-mail-avatar" aria-hidden="true">
            {message.from.charAt(0)}
          </span>
        </div>
        {renderBody
          ? renderBody(message)
          : message.body.split("\n\n").map((paragraph, index) => (
              <Label
                // biome-ignore lint/suspicious/noArrayIndexKey: the paragraphs of one message never reorder
                key={index}
                render={<p />}
                color="text"
                selectable
                className="mac-mail-paragraph"
              >
                {paragraph}
              </Label>
            ))}
      </div>
    </>
  );
  return stacked ? (
    <article aria-label={message.subject} className="mac-mail-stacked">
      {content}
    </article>
  ) : (
    <ScrollView role="article" aria-label={message.subject} className="mac-mail-message">
      {content}
    </ScrollView>
  );
}

export interface MailMessageWindowProps extends WindowProps {
  /** The window's tabs, under its title bar. */
  tabBar?: ReactNode;
  message: MailMessage;
  renderBody?: (message: MailMessage) => ReactNode;
  canReply: boolean;
  onReply: (kind: "reply" | "all" | "forward") => void;
  /** Why the message cannot go to the Trash, if it cannot. */
  deleteRefusal?: string;
  onDelete: () => void;
  onNewMessage: () => void;
  onPrint: () => void;
  onRedirect: () => void;
  /** Use Smart Addresses is off: people are shown by their addresses. */
  showAddresses?: boolean;
  controlsProps?: WindowControlsProps;
  onDragRegionPointerDown?: (event: PointerEvent<HTMLElement>) => void;
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * One message in a window of its own, as a double click on its row opens it. While it is the window
 * last used the menu bar's commands are this window's, on this message: never the viewer's selection.
 */
export function MailMessageWindow({
  tabBar,
  message,
  renderBody,
  canReply,
  onReply,
  deleteRefusal,
  onDelete,
  onNewMessage,
  onPrint,
  onRedirect,
  showAddresses,
  controlsProps,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  ...props
}: MailMessageWindowProps) {
  const [titleBar, setTitleBar] = useState<HTMLDivElement | null>(null);
  const text = useRef<HTMLDivElement>(null);
  const find = useMailFind(text);
  const remove = () => {
    if (deleteRefusal === undefined) onDelete();
  };
  useDesktopAppMenu(
    "mail",
    "File",
    <>
      <MenuItem keyEquivalent="command+n" onClick={onNewMessage}>
        New Message
      </MenuItem>
      <MenuItem onClick={onPrint}>Export as PDF…</MenuItem>
      <MenuItem keyEquivalent="command+p" onClick={onPrint}>
        Print…
      </MenuItem>
    </>,
    titleBar,
  );
  useDesktopAppMenu(
    "mail",
    "Edit",
    <>
      <MenuItem disabled={deleteRefusal !== undefined} title={deleteRefusal} onClick={remove}>
        Delete
      </MenuItem>
      <Submenu>
        <SubmenuTrigger>Find</SubmenuTrigger>
        <SubmenuPopup>
          <MailFindItems find={find.commands} />
        </SubmenuPopup>
      </Submenu>
    </>,
    titleBar,
  );
  useDesktopAppMenu("mail", "View", VIEW_ITEMS, titleBar);
  useDesktopAppMenu("mail", "Mailbox", null, titleBar);
  useDesktopAppMenu("mail", "Format", null, titleBar);
  useDesktopAppMenu(
    "mail",
    "Message",
    <>
      <MenuItem disabled={!canReply} keyEquivalent="command+r" onClick={() => onReply("reply")}>
        Reply
      </MenuItem>
      <MenuItem disabled={!canReply} keyEquivalent="shift+command+r" onClick={() => onReply("all")}>
        Reply All
      </MenuItem>
      <MenuItem keyEquivalent="shift+command+f" onClick={() => onReply("forward")}>
        Forward
      </MenuItem>
      <MenuItem keyEquivalent="shift+command+e" onClick={onRedirect}>
        Redirect
      </MenuItem>
      <MenuItem
        disabled={deleteRefusal !== undefined}
        title={deleteRefusal}
        keyEquivalent="command+delete"
        onClick={remove}
      >
        Delete
      </MenuItem>
    </>,
    titleBar,
  );
  useWindowKeys(titleBar, props.state === "key", [
    { equivalent: "command+n", run: onNewMessage },
    { equivalent: "command+r", run: () => canReply && onReply("reply") },
    { equivalent: "shift+command+r", run: () => canReply && onReply("all") },
    { equivalent: "shift+command+f", run: () => onReply("forward") },
    { equivalent: "shift+command+e", run: onRedirect },
    { equivalent: "command+p", run: onPrint },
    { equivalent: "command+delete", run: remove, notInText: true },
    { equivalent: "command+f", run: find.commands.find },
    { equivalent: "command+g", run: find.commands.next },
    { equivalent: "shift+command+g", run: find.commands.previous },
    { equivalent: "command+e", run: find.commands.findSelection },
    { equivalent: "command+j", run: find.commands.jump },
  ]);
  return (
    <Window className="mac-mail-reader" {...props}>
      <TitleBar
        ref={setTitleBar}
        variant="unified"
        divider="bar"
        title={message.subject}
        controls={<WindowControls {...controlsProps} />}
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        <Toolbar aria-label="Message toolbar">
          <ToolbarButton
            aria-label="Delete"
            disabled={deleteRefusal !== undefined}
            title={deleteRefusal}
            style={{ width: 39 }}
            onClick={onDelete}
          >
            <MailGlyph name="trash" />
          </ToolbarButton>
          <ToolbarSpace />
          <ToolbarSegmentedControl tracking="momentary" aria-label="Respond">
            <ToolbarSegment
              aria-label="Reply"
              disabled={!canReply}
              style={{ width: 37.5 }}
              onClick={() => onReply("reply")}
            >
              <MailGlyph name="reply" />
            </ToolbarSegment>
            <ToolbarSegment
              aria-label="Reply All"
              disabled={!canReply}
              style={{ width: 36 }}
              onClick={() => onReply("all")}
            >
              <MailGlyph name="replyAll" />
            </ToolbarSegment>
            <ToolbarSegment
              aria-label="Forward"
              style={{ width: 37.5 }}
              onClick={() => onReply("forward")}
            >
              <MailGlyph name="forward" />
            </ToolbarSegment>
          </ToolbarSegmentedControl>
        </Toolbar>
      </TitleBar>
      {tabBar}
      <WindowBody background="content" className="mac-mail-reader-body">
        <div className="mac-mail-find-area">
          {find.bar}
          <MailTextMenu paneRef={text} className="mac-mail-find-text">
            <MailMessageContent
              message={message}
              renderBody={renderBody}
              showAddresses={showAddresses}
            />
          </MailTextMenu>
        </div>
      </WindowBody>
    </Window>
  );
}
