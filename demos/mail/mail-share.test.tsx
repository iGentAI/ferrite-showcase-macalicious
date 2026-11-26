import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { shareLink, takeSharedLinks } from "../desktop/desktop-share-link";
import { Mail } from "./mail";

/*
 * Share > Mail: a link shared with Mail from Safari, News or Stocks
 * (`demos/desktop/desktop-share-link.tsx`) opens a New Message with the page's title as its
 * subject and its address as its text. e2e/mail-share-journey.mjs shares from each app in three
 * engines, on the desktop served by Ferrite.
 */

const PAGE = "https://en.wikipedia.org/wiki/MacOS_Catalina";
const QUOTE = "https://www.cnbc.com/quotes/AAPL";
// Passed to `shareLink` so that these tests hold whichever apps the desktop lists.
const MAIL = new Set(["mail"]);

const composers = () => [...document.querySelectorAll<HTMLElement>(".mac-mail-compose")];
const subject = () => screen.getByRole("textbox", { name: "Subject:" }) as HTMLInputElement;
const message = () => screen.getByRole("textbox", { name: "Message" });
const share = (url: string, title: string, from = "safari") =>
  act(() => {
    shareLink("mail", url, title, from, MAIL);
  });

afterEach(() => {
  takeSharedLinks("mail");
});

describe("a link shared with Mail", () => {
  it("opens a New Message with the title as its subject and the address as its text", async () => {
    render(<Mail takesSharedLinks />);
    expect(composers()).toHaveLength(0);
    await share(PAGE, "macOS Catalina - Wikipedia");
    await waitFor(() => expect(composers()).toHaveLength(1));
    expect(subject().value).toBe("macOS Catalina - Wikipedia");
    expect(message()).toHaveTextContent(PAGE);
    // Waiting for a recipient, and taken: not kept for Mail as well.
    expect(screen.getByRole("combobox", { name: "To:" })).toHaveValue("");
    expect(takeSharedLinks("mail")).toEqual([]);
  });

  it("takes the links shared while Mail was closed as soon as it opens", async () => {
    await share(QUOTE, "AAPL", "stocks");
    render(<Mail takesSharedLinks />);
    await waitFor(() => expect(composers()).toHaveLength(1));
    expect(subject().value).toBe("AAPL");
    expect(message()).toHaveTextContent(QUOTE);
    expect(takeSharedLinks("mail"), "taken once").toEqual([]);
  });

  it("waits while a New Message window is open, and opens once it closes, the window's text kept", async () => {
    const user = userEvent.setup();
    render(<Mail takesSharedLinks />);
    await user.click(screen.getByRole("button", { name: "New Message" }));
    await user.type(subject(), "Mine");
    await share(PAGE, "macOS Catalina - Wikipedia");
    expect(composers()).toHaveLength(1);
    expect(subject().value).toBe("Mine");
    expect(message()).not.toHaveTextContent(PAGE);
    await user.click(within(composers()[0] as HTMLElement).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(subject().value).toBe("macOS Catalina - Wikipedia"));
    expect(composers()).toHaveLength(1);
    expect(message()).toHaveTextContent(PAGE);
  });

  it("is not taken by a Mail that does not take links: it stays kept for one that does", async () => {
    render(<Mail />);
    await share(PAGE, "macOS Catalina - Wikipedia");
    expect(composers()).toHaveLength(0);
    expect(takeSharedLinks("mail").map((link) => link.url)).toEqual([PAGE]);
  });
});
