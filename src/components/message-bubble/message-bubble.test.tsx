import { render, screen, within } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { MessageBubble, MessageStatus, MessageTranscript, MessageTranscriptHeader } from "./index";

describe("MessageTranscript", () => {
  it("is a named log that holds its items as one list, in order", () => {
    render(
      <MessageTranscript aria-label="Conversation with Ada">
        <MessageTranscriptHeader title="iMessage with Ada">Today, 3:26 PM</MessageTranscriptHeader>
        <MessageBubble direction="sent">Hello</MessageBubble>
        <MessageStatus>Delivered</MessageStatus>
        <MessageBubble>Hi</MessageBubble>
      </MessageTranscript>,
    );
    const log = screen.getByRole("log", { name: "Conversation with Ada" });
    expect(log).toHaveClass("mac-message-bubble-transcript");
    const items = within(within(log).getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "iMessage with Ada Today, 3:26 PM",
      "Hello",
      "Delivered",
      "Hi",
    ]);
  });

  it("forwards ref, className, style and other attributes to the log", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <MessageTranscript
        ref={ref}
        className="chat"
        style={{ width: 300 }}
        id="chat"
        aria-live="off"
        data-thread="7"
      />,
    );
    expect(ref.current).toHaveClass("mac-message-bubble-transcript", "chat");
    expect(ref.current).toHaveStyle({ width: "300px" });
    expect(ref.current).toHaveAttribute("id", "chat");
    expect(ref.current).toHaveAttribute("aria-live", "off");
    expect(ref.current).toHaveAttribute("data-thread", "7");
    expect(ref.current).toHaveAttribute("role", "log");
  });

  it("renders another element through the render prop and keeps the list inside", () => {
    render(<MessageTranscript render={<section />} data-testid="log" />);
    const log = screen.getByTestId("log");
    expect(log.tagName).toBe("SECTION");
    expect(within(log).getByRole("list")).toBeInTheDocument();
  });
});

describe("MessageBubble", () => {
  it("is a received iMessage bubble with a tail by default", () => {
    render(
      <MessageTranscript>
        <MessageBubble>New macOS, who dis?</MessageBubble>
      </MessageTranscript>,
    );
    const bubble = screen.getByRole("listitem");
    expect(bubble).toHaveTextContent("New macOS, who dis?");
    expect(bubble).toHaveClass("mac-message-bubble");
    expect(bubble).toHaveAttribute("data-direction", "received");
    expect(bubble).toHaveAttribute("data-service", "imessage");
    expect(bubble).toHaveAttribute("data-tail");
  });

  it("reflects direction, service and tail", () => {
    render(
      <MessageTranscript>
        <MessageBubble direction="sent" service="sms" tail={false}>
          On my way
        </MessageBubble>
      </MessageTranscript>,
    );
    const bubble = screen.getByRole("listitem");
    expect(bubble).toHaveAttribute("data-direction", "sent");
    expect(bubble).toHaveAttribute("data-service", "sms");
    expect(bubble).not.toHaveAttribute("data-tail");
  });

  it("puts the sender before the text for assistive technology, and nothing without one", () => {
    render(
      <MessageTranscript>
        <MessageBubble sender="Ada">Hi</MessageBubble>
        <MessageBubble>Anonymous</MessageBubble>
      </MessageTranscript>,
    );
    const [named, anonymous] = screen.getAllByRole("listitem");
    expect(named).toHaveTextContent(/^Ada Hi$/);
    expect(within(named as HTMLElement).getByText("Ada")).toHaveClass("mac-message-bubble-sender");
    expect(anonymous?.textContent).toBe("Anonymous");
    expect(anonymous?.querySelector(".mac-message-bubble-sender")).toBeNull();
  });

  it("forwards ref, className, style and other attributes to the list item", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <MessageTranscript>
        <MessageBubble
          ref={ref}
          className="mine"
          style={{ maxWidth: 120 }}
          id="m1"
          data-message="1"
          aria-describedby="status"
        >
          Hi
        </MessageBubble>
      </MessageTranscript>,
    );
    expect(ref.current?.tagName).toBe("DIV");
    expect(ref.current).toHaveClass("mac-message-bubble", "mine");
    expect(ref.current).toHaveStyle({ maxWidth: "120px" });
    expect(ref.current).toHaveAttribute("id", "m1");
    expect(ref.current).toHaveAttribute("data-message", "1");
    expect(ref.current).toHaveAttribute("aria-describedby", "status");
  });

  it("renders another element through the render prop, with its attributes", () => {
    render(
      <MessageTranscript>
        <MessageBubble render={<article />} direction="sent" data-testid="bubble">
          Alone
        </MessageBubble>
      </MessageTranscript>,
    );
    const bubble = screen.getByTestId("bubble");
    expect(bubble.tagName).toBe("ARTICLE");
    expect(bubble).toHaveRole("listitem");
    expect(bubble).toHaveClass("mac-message-bubble");
    expect(bubble).toHaveAttribute("data-direction", "sent");
  });
});

describe("MessageTranscriptHeader", () => {
  it("shows the title over the time as one list item", () => {
    render(
      <MessageTranscript>
        <MessageTranscriptHeader title="iMessage with Ada">Today, 3:26 PM</MessageTranscriptHeader>
      </MessageTranscript>,
    );
    const header = screen.getByRole("listitem");
    expect(header).toHaveClass("mac-message-bubble-header");
    expect(within(header).getByText("iMessage with Ada")).toHaveClass(
      "mac-message-bubble-header-title",
    );
    expect(header).toHaveTextContent("Today, 3:26 PM");
  });

  it("renders no title line without a title, and does not pass `title` to the element", () => {
    render(
      <MessageTranscript>
        <MessageTranscriptHeader>Yesterday</MessageTranscriptHeader>
        <MessageTranscriptHeader title="SMS with Ada" />
      </MessageTranscript>,
    );
    const [timeOnly, titled] = screen.getAllByRole("listitem");
    expect(timeOnly?.textContent).toBe("Yesterday");
    expect(timeOnly?.querySelector(".mac-message-bubble-header-title")).toBeNull();
    expect(titled).not.toHaveAttribute("title");
  });

  it("forwards ref, className and other attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <MessageTranscript>
        <MessageTranscriptHeader ref={ref} className="day" id="today" title="Today" />
      </MessageTranscript>,
    );
    expect(ref.current).toHaveClass("mac-message-bubble-header", "day");
    expect(ref.current).toHaveAttribute("id", "today");
  });
});

describe("MessageBubble while sending", () => {
  it("is marked and busy while sending, and not otherwise", () => {
    render(
      <MessageTranscript>
        <MessageBubble direction="sent" sending>
          On its way
        </MessageBubble>
        <MessageBubble direction="sent">Arrived</MessageBubble>
      </MessageTranscript>,
    );
    const [sending, sent] = screen.getAllByRole("listitem");
    expect(sending).toHaveAttribute("data-sending");
    expect(sending).toHaveAttribute("aria-busy", "true");
    expect(sent).not.toHaveAttribute("data-sending");
    expect(sent).not.toHaveAttribute("aria-busy");
  });
});

describe("MessageStatus", () => {
  it("is a list item of the transcript with its text", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <MessageTranscript>
        <MessageStatus ref={ref} className="state" id="status" data-state="delivered">
          Delivered
        </MessageStatus>
      </MessageTranscript>,
    );
    const status = screen.getByRole("listitem");
    expect(status).toBe(ref.current);
    expect(status).toHaveTextContent("Delivered");
    expect(status).toHaveClass("mac-message-bubble-status", "state");
    expect(status).toHaveAttribute("id", "status");
    expect(status).toHaveAttribute("data-state", "delivered");
  });
});
