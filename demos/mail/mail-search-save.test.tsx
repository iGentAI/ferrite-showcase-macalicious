import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Mail } from "./mail";
import { DEFAULT_SETTINGS, type MailMessage } from "./mail-data";
import { readSmartMailboxes } from "./mail-smart";

const message = (id: string, mailbox: MailMessage["mailbox"], time: number): MailMessage => ({
  id,
  mailbox,
  from: "Ada",
  fromAddress: "Ada <ada@macalicious>",
  to: ["Robin"],
  toAddresses: ["Robin <robin@macalicious>"],
  subject: `Kelp in ${id}`,
  date: "",
  received: "",
  time,
  body: "Word kelp here",
});
const MESSAGES = [
  message("inbox", "inbox", 5),
  message("junk", "junk", 4),
  message("drafts", "drafts", 3),
  message("sent", "sent", 2),
];

const listed = () =>
  within(screen.getByRole("listbox", { name: "Messages" }))
    .getAllByRole("option")
    .map((row) => row.querySelector(".mac-mail-row-subject")?.textContent);
const mailbox = (name: string) =>
  within(screen.getByRole("tree", { name: "Mailboxes" })).getByRole("treeitem", {
    name: new RegExp(`^${name}`),
  });

/** Searches, as scoped, then saves it, leaves the Smart Mailbox and opens it again: what each lists. */
async function saved(scope: string | null, settings = DEFAULT_SETTINGS) {
  const user = userEvent.setup();
  render(<Mail messages={MESSAGES} defaultMessage={null} defaultSettings={settings} />);
  if (scope) await user.click(mailbox(scope));
  await user.type(screen.getByRole("searchbox", { name: "Search" }), "kelp");
  if (scope) {
    await user.click(
      within(screen.getByRole("radiogroup", { name: "Search In" })).getByRole("radio", {
        name: scope,
      }),
    );
  }
  const found = listed();
  await user.click(screen.getByRole("button", { name: "Save" }));
  const sheet = await screen.findByRole("dialog");
  await user.clear(within(sheet).getByRole("textbox", { name: "Smart Mailbox Name" }));
  await user.type(within(sheet).getByRole("textbox", { name: "Smart Mailbox Name" }), "Saved");
  await user.click(within(sheet).getByRole("button", { name: "OK" }));
  await user.click(mailbox("Inbox"));
  await user.click(mailbox("Saved"));
  return { found, reopened: listed() };
}

describe("Save on a search", () => {
  it.each([
    ["Junk", ["Kelp in junk"]],
    ["Drafts", ["Kelp in drafts"]],
  ])("keeps a search scoped to %s listing what it found", async (scope, wanted) => {
    const { found, reopened } = await saved(scope);
    expect(found).toEqual(wanted);
    expect(reopened).toEqual(wanted);
  });

  it("keeps a search of all mailboxes that takes in Junk listing the same", async () => {
    const { found, reopened } = await saved(null, { ...DEFAULT_SETTINGS, searchJunk: true });
    expect(found).toEqual(["Kelp in inbox", "Kelp in junk", "Kelp in drafts", "Kelp in sent"]);
    expect(reopened).toEqual(found);
  });

  it("leaves Junk out of a search of all mailboxes that does", async () => {
    const { found, reopened } = await saved(null, { ...DEFAULT_SETTINGS, searchJunk: false });
    expect(found).toEqual(["Kelp in inbox", "Kelp in drafts", "Kelp in sent"]);
    expect(reopened).toEqual(found);
  });

  it("keeps what it looked through across a reload", () => {
    const box = {
      id: "smart-1",
      name: "Saved",
      matchAll: true,
      rules: [{ field: "subject", test: "contains", value: "kelp" }],
      includeTrash: false,
      includeSent: true,
      includeJunk: true,
      includeDrafts: true,
    };
    expect(readSmartMailboxes(JSON.parse(JSON.stringify([box])))).toEqual([box]);
  });
});
