import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DRAFT_MOVE_UNAVAILABLE, Mail, MOVE_TO_DRAFTS_UNAVAILABLE } from "./mail";
import type { MailMessage } from "./mail-data";

// The server keeps Drafts for drafts the person saves and lets a draft go only to the Trash
// (`ferrite-apps/desktop/src/apps/mail/model.rs`: "only a saved draft is in Drafts", "a draft can
// only be deleted"). The viewer offers no move the server refuses, and each dimmed move says why:
// offered, the move showed the message leave and then put it back without a word.

const base = {
  from: "Martin",
  to: ["Chris"],
  date: "10/23/26",
  received: "October 23, 2026 at 8:00 AM",
  body: "Meet at the pier.",
};
const MESSAGES: MailMessage[] = [
  { ...base, id: "m1", mailbox: "inbox", subject: "Ferry times", time: 2 },
  { ...base, id: "d1", mailbox: "drafts", subject: "Unsent plan", time: 1 },
];
const dimmed = (element: HTMLElement) =>
  element.getAttribute("aria-disabled") === "true" ||
  element.hasAttribute("data-disabled") ||
  element.hasAttribute("disabled");

describe("Move to… and the toolbar's moves", () => {
  it("never offer Drafts as a destination, and say why", async () => {
    const user = userEvent.setup();
    render(<Mail messages={MESSAGES} defaultMessage="m1" />);
    await user.click(screen.getByRole("button", { name: "Move to…" }));
    const drafts = await screen.findByRole("menuitem", { name: "Drafts" });
    expect(dimmed(drafts)).toBe(true);
    expect(drafts.getAttribute("title")).toBe(MOVE_TO_DRAFTS_UNAVAILABLE);
    for (const name of ["Sent", "Junk", "Trash", "Archive"]) {
      expect(dimmed(screen.getByRole("menuitem", { name }))).toBe(false);
    }
  });

  it("only delete a draft, and say why the other moves are unavailable", async () => {
    const user = userEvent.setup();
    render(<Mail messages={MESSAGES} defaultMailbox="drafts" defaultMessage="d1" />);
    const archive = screen.getByRole("button", { name: "Archive" });
    expect(dimmed(archive)).toBe(true);
    expect(archive.getAttribute("title")).toBe(DRAFT_MOVE_UNAVAILABLE);
    const junk = screen.getByRole("button", { name: "Junk" });
    expect(dimmed(junk)).toBe(true);
    expect(junk.getAttribute("title")).toBe(DRAFT_MOVE_UNAVAILABLE);
    await user.click(screen.getByRole("button", { name: "Move to…" }));
    for (const name of ["Inbox", "Sent", "Junk", "Archive"]) {
      const item = await screen.findByRole("menuitem", { name });
      expect(dimmed(item)).toBe(true);
      expect(item.getAttribute("title")).toBe(DRAFT_MOVE_UNAVAILABLE);
    }
    expect(dimmed(screen.getByRole("menuitem", { name: "Trash" }))).toBe(false);
  });
});
