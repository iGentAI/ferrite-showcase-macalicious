"use client";

import { useRender } from "@base-ui/react/use-render";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import "./message-bubble.tokens.css";
import "./message-bubble.css";

export interface MessageTranscriptProps extends useRender.ComponentProps<"div"> {
  /**
   * The transcript's items in reading order: `MessageTranscriptHeader`, `MessageBubble` and
   * `MessageStatus`. Each is a list item.
   */
  children?: ReactNode;
}

/**
 * The transcript of Messages: a column of bubbles, received ones at the leading edge and sent
 * ones at the trailing edge, on the transcript's own background.
 *
 * Renders a `<div role="log">`, so a message added later is announced politely, around a
 * list that holds the items. Name it with `aria-label` ("Conversation with Ada"). It does
 * not scroll by itself: give it a height and `overflow`, or put it in a scroll view. Props
 * and `ref` go to the `<div>`; Base UI's `render` prop renders another element.
 *
 * The list and its items are `<div>`s with the list roles, not `<ol>` and `<li>`, so that a
 * page's own list styles do not reach into the transcript.
 */
export function MessageTranscript({
  className,
  render,
  ref,
  children,
  ...props
}: MessageTranscriptProps) {
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      role: "log",
      ...props,
      className: cn("mac-message-bubble-transcript", className),
      children: (
        // biome-ignore lint/a11y/useSemanticElements: an <ol> would pick up a page's list styles; the roles give the same list without it
        <div role="list" className="mac-message-bubble-list">
          {children}
        </div>
      ),
    },
  });
}

export interface MessageTranscriptHeaderProps
  extends Omit<useRender.ComponentProps<"div">, "title"> {
  /** The first line: the service and the other party, such as "iMessage with Ada Appleseed". */
  title?: ReactNode;
  /** The second line: when the messages below were exchanged, such as "Today, 3:26 PM". */
  children?: ReactNode;
}

/**
 * The centred lines above a run of bubbles: whom the conversation is with, over the time. Both
 * are small grey text. Renders a `<div role="listitem">`; use it only inside a
 * `MessageTranscript`.
 */
export function MessageTranscriptHeader({
  title,
  className,
  render,
  ref,
  children,
  ...props
}: MessageTranscriptHeaderProps) {
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      role: "listitem",
      ...props,
      className: cn("mac-message-bubble-header", className),
      children: (
        <>
          {title == null || title === false ? null : (
            <>
              <span className="mac-message-bubble-header-title">{title}</span>{" "}
            </>
          )}
          {children}
        </>
      ),
    },
  });
}

export interface MessageBubbleProps extends useRender.ComponentProps<"div"> {
  /**
   * Who wrote the message. A sent bubble is tinted and sits at the trailing edge; a received
   * one is grey and sits at the leading edge.
   * @default "received"
   */
  direction?: "sent" | "received";
  /**
   * The service a sent message went through, which picks its tint: blue for iMessage, green
   * for a text message. A received bubble is grey whatever the service.
   * @default "imessage"
   */
  service?: "imessage" | "sms";
  /**
   * Draws the tail at the bottom corner on the writer's side. Messages gives it to the last
   * bubble of a run from one writer only.
   * @default true
   */
  tail?: boolean;
  /**
   * Marks a message that is still on its way: the bubble is drawn at half opacity and is
   * `aria-busy`. Clear it when the message is delivered.
   * @default false
   */
  sending?: boolean;
  /**
   * The writer's name, read before the text by assistive technology and not shown: "You",
   * "Ada". Without it only the bubble's side tells who wrote the message.
   */
  sender?: ReactNode;
  /** The text of the message. Line breaks in a string are kept. */
  children?: ReactNode;
}

/**
 * One message of a Messages transcript: text in a rounded bubble with a tail.
 *
 * AppKit has no public class for it and Base UI no primitive, so it is a styled list item
 * (`<div role="listitem">`) drawn in CSS: use it inside a `MessageTranscript`, which is the
 * list. The bubble is as wide as its text, up to `--mac-message-bubble-max-width` of the
 * transcript. Base UI's `render` prop renders another element.
 */
export function MessageBubble({
  direction = "received",
  service = "imessage",
  tail = true,
  sending = false,
  sender,
  className,
  render,
  ref,
  children,
  ...props
}: MessageBubbleProps) {
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: {
      role: "listitem",
      "data-direction": direction,
      "data-service": service,
      "data-tail": tail ? "" : undefined,
      "data-sending": sending ? "" : undefined,
      "aria-busy": sending || undefined,
      ...props,
      className: cn("mac-message-bubble", className),
      children: (
        <>
          {sender == null || sender === false ? null : (
            <span className="mac-message-bubble-sender">{sender} </span>
          )}
          {children}
        </>
      ),
    },
  });
}

export interface MessageStatusProps extends useRender.ComponentProps<"div"> {
  /** The delivery state of the sent message above: "Delivered", "Read 3:27 PM", "Not Delivered". */
  children?: ReactNode;
}

/**
 * The small grey label under the last sent bubble that says what became of it, such as
 * "Delivered". It lines up with the tip of that bubble's tail. Renders a
 * `<div role="listitem">`; use it only inside a `MessageTranscript`.
 */
export function MessageStatus({ className, render, ref, ...props }: MessageStatusProps) {
  return useRender({
    defaultTagName: "div",
    render,
    ref,
    props: { role: "listitem", ...props, className: cn("mac-message-bubble-status", className) },
  });
}
