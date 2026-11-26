import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Mail } from "./mail";
import { DEFAULT_SETTINGS, type MailMessage } from "./mail-data";
import { isJunk, JUNK_NEEDED, junkChance, learnJunk } from "./mail-junk";
import { firstWebAddress, linkAddressNodes, MailAddressToken, mailLinkedText } from "./mail-links";
import { markBetween, picturePoint, textAt } from "./mail-markup";

const asked = vi.hoisted(() => vi.fn());
vi.mock("../desktop/desktop-reach", async (original) => ({
  ...(await original<typeof import("../desktop/desktop-reach")>()),
  askToReach: asked,
}));

beforeEach(() => asked.mockClear());

const message = (id: string, mailbox: MailMessage["mailbox"], body: string): MailMessage => ({
  id,
  mailbox,
  from: `${id}@macalicious`,
  to: ["me@macalicious"],
  subject: id,
  date: "1/1/26",
  received: "January 1, 2026",
  time: 1,
  body,
});
const PRIZE = "winner prize lottery claim money";
const taught = (junkCount: number) =>
  learnJunk(
    [
      ...Array.from({ length: junkCount }, (_, at) => message(`junk${at}`, "junk", PRIZE)),
      message("friend", "inbox", "lunch on friday near the harbor"),
    ],
    "junk",
  );

describe("the junk mail filter", () => {
  it("says nothing until it has seen enough junk", () => {
    const arriving = message("new", "inbox", PRIZE);
    expect(isJunk(taught(JUNK_NEEDED - 1), arriving, new Set())).toBe(false);
    expect(isJunk(taught(JUNK_NEEDED), arriving, new Set())).toBe(true);
  });

  it("lets through what the person's other mail reads like, and what it has never seen", () => {
    const model = taught(5);
    expect(isJunk(model, message("new", "inbox", "lunch near the harbor"), new Set())).toBe(false);
    expect(junkChance(model, message("new", "inbox", "zzz qqq"))).toBe(0.5);
  });

  it("exempts a sender, by address", () => {
    expect(isJunk(taught(5), message("ada", "inbox", PRIZE), new Set(["ada@macalicious"]))).toBe(
      false,
    );
  });

  it("learns nothing from Sent, Drafts or the Trash", () => {
    const model = learnJunk([message("a", "sent", PRIZE), message("b", "trash", PRIZE)], "junk");
    expect([model.junkCount, model.goodCount]).toEqual([0, 0]);
  });

  it("takes a mailbox standing in for Junk", () => {
    expect(learnJunk([message("a", "box-spam", PRIZE)], "box-spam").junkCount).toBe(1);
  });
});

describe("data detectors in a message's text", () => {
  it("offer a date to Calendar from plain text, the words left as they are", () => {
    render(<p>{mailLinkedText("See you on March 3, 2027 at 4 PM by the ferry.")}</p>);
    expect(screen.getByRole("paragraph")).toHaveTextContent(
      "See you on March 3, 2027 at 4 PM by the ferry.",
    );
    fireEvent.click(screen.getByRole("button", { name: "March 3, 2027 at 4 PM" }));
    expect(asked).toHaveBeenCalledWith({
      app: "calendar",
      to: "March 3, 2027 at 4 PM",
      name: "March 3, 2027 at 4 PM",
    });
  });

  it("offer one from styled text, and leave what is in a link", () => {
    const root = document.createElement("div");
    root.innerHTML = "<b>tomorrow at 9</b> <a href='https://a.example'>tomorrow</a>";
    linkAddressNodes(root);
    const dated = root.querySelector("button");
    expect(dated).toHaveTextContent("tomorrow at 9");
    expect(root.querySelectorAll("button")).toHaveLength(1);
    dated?.click();
    expect(asked).toHaveBeenCalledWith(
      expect.objectContaining({ app: "calendar", to: "tomorrow at 9" }),
    );
  });

  it("add a person of this desktop to Contacts from their name in Details", async () => {
    render(<MailAddressToken name="Martin Klein" written="Martin Klein <martin@macalicious>" />);
    fireEvent.contextMenu(screen.getByText("Martin Klein"));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Add to Contacts" }));
    expect(asked).toHaveBeenCalledWith({
      app: "contacts",
      to: "martin",
      name: "Martin Klein",
    });
  });

  it("offer no card for an address outside this desktop", async () => {
    render(<MailAddressToken name="Ada" written="ada@example.com" />);
    fireEvent.contextMenu(screen.getByText("Ada"));
    await screen.findByRole("menuitem", { name: "Copy Address" });
    expect(screen.queryByRole("menuitem", { name: "Add to Contacts" })).toBeNull();
  });

  it("find the first web address a message holds", () => {
    expect(firstWebAddress("see https://a.example/x and https://b.example")).toBe(
      "https://a.example/x",
    );
    expect(firstWebAddress("no address here")).toBeNull();
  });
});

describe("Markup", () => {
  it("finds a point on the picture however large the picture is shown", () => {
    expect(
      picturePoint({ clientX: 150, clientY: 60 }, { left: 100, top: 50, width: 100, height: 50 }),
    ).toEqual([0.5, 0.2]);
  });

  it("draws each shape from the press to the pointer, as Preview's marks", () => {
    const style = { color: "#e0352b", stroke: 0.01 };
    expect(markBetween("rect", [0.5, 0.5], [0.25, 0.75], style)).toMatchObject({
      kind: "rect",
      color: "#e0352b",
      x: 0.25,
      y: 0.5,
      w: 0.25,
      h: 0.25,
    });
    expect(markBetween("oval", [0, 0], [1, 1], style).kind).toBe("oval");
    expect(markBetween("arrow", [0.5, 0.5], [0.25, 0.75], style)).toMatchObject({
      kind: "arrow",
      x: 0.5,
      y: 0.5,
      w: -0.25,
      h: 0.25,
    });
  });

  it("adds to the line a sketch has, and a press alone leaves a dot", () => {
    const style = { color: "#000000", stroke: 0.01 };
    const dot = markBetween("sketch", [0.1, 0.1], [0.1, 0.1], style);
    expect(dot.points).toEqual([
      [0.1, 0.1],
      [0.1, 0.1],
    ]);
    const line = markBetween("sketch", [0.1, 0.1], [0.2, 0.2], style, dot);
    expect(line.id).toBe(dot.id);
    expect(line.points).toHaveLength(3);
  });

  it("places typed text, and nothing for an empty field", () => {
    const style = { color: "#000000", stroke: 0.01 };
    expect(textAt([0.2, 0.3], "  Look here ", style, 0.05)).toMatchObject({
      kind: "text",
      x: 0.2,
      y: 0.3,
      text: "Look here",
      size: 0.05,
    });
    expect(textAt([0.2, 0.3], "   ", style, 0.05)).toBeNull();
  });
});

describe("the classic layout's columns", () => {
  it("shows a line a message and sorts by the column pressed", async () => {
    const user = userEvent.setup();
    render(<Mail defaultSettings={{ ...DEFAULT_SETTINGS, classicLayout: true }} />);
    const columns = screen.getByRole("group", { name: "Columns" });
    expect(
      within(columns)
        .getAllByRole("button")
        .map((each) => each.textContent),
    ).toEqual(["From", "Subject", "Date Received ▼"]);
    await user.click(within(columns).getByRole("button", { name: "Subject" }));
    expect(within(columns).getByRole("button", { name: /Subject/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const subjects = [...document.querySelectorAll(".mac-mail-classic-subject")].map(
      (each) => each.textContent ?? "",
    );
    expect(subjects.length).toBeGreaterThan(1);
    expect(subjects).toEqual([...subjects].sort((a, b) => a.localeCompare(b)));
  });
});

describe("File > Share", () => {
  it("offers Notes and dims AirDrop, saying why", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    await user.pointer({
      keys: "[MouseRight]",
      target: screen.getAllByRole("option")[0] as HTMLElement,
    });
    await user.click(await screen.findByRole("menuitem", { name: "Share" }));
    const airdrop = await screen.findByRole("menuitem", { name: "AirDrop" });
    expect(airdrop).toHaveAttribute("aria-disabled", "true");
    expect(airdrop.getAttribute("title")).toMatch(/nearby devices/);
    expect(screen.getByRole("menuitem", { name: "Notes" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
