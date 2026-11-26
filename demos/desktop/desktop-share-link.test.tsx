import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopDragItem } from "./desktop-drag";
import { DESKTOP_EFFECTS_EVENT, type DesktopEffect } from "./desktop-effects";
import {
  AIRDROP_REASON,
  copyText,
  FileShareItems,
  LinkShareItems,
  MAX_PENDING_SHARES,
  NO_ADDRESS_REASON,
  onSharedFiles,
  onSharedLink,
  registerFileReceivers,
  SHARE_LINK_EVENT,
  SHARE_RECEIVERS,
  type SharedLink,
  shareFiles,
  shareLink,
  shareTargets,
  takeSharedFiles,
  takeSharedLinks,
} from "./desktop-share-link";

const PAGE = "https://en.wikipedia.org/wiki/MacOS_Catalina";

afterEach(() => {
  for (const app of ["mail", "messages", "notes", "reminders"]) {
    takeSharedLinks(app);
    takeSharedFiles(app);
  }
  vi.restoreAllMocks();
});

describe("sharing files", () => {
  const FILE: DesktopDragItem = { id: "f1", name: "Plan.pdf", kind: "file" };
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
  });

  it("keeps them for an app that takes files, and opens it", () => {
    stops.push(registerFileReceivers([{ id: "mail", takesSharedFiles: true }]));
    const opened: unknown[] = [];
    const hear = (event: Event) => opened.push((event as CustomEvent).detail);
    window.addEventListener(DESKTOP_EFFECTS_EVENT, hear);
    stops.push(() => window.removeEventListener(DESKTOP_EFFECTS_EVENT, hear));
    expect(shareFiles("mail", [FILE], "finder")).toEqual({
      items: [FILE],
      from: "finder",
      to: "mail",
    });
    expect(opened).toEqual([[{ open: "mail" }]]);
    expect(takeSharedFiles("mail")).toEqual([{ items: [FILE], from: "finder", to: "mail" }]);
    expect(takeSharedFiles("mail")).toEqual([]);
  });

  it("hands them to a window that hears, and keeps nothing for later", () => {
    stops.push(registerFileReceivers([{ id: "notes", takesSharedFiles: true }]));
    const heard = vi.fn();
    stops.push(onSharedFiles("notes", heard));
    shareFiles("notes", [FILE], "finder");
    expect(heard).toHaveBeenCalledTimes(1);
    expect(takeSharedFiles("notes")).toEqual([]);
  });

  it("refuses an app that takes no files, and a share with no file in it", () => {
    stops.push(registerFileReceivers([{ id: "mail", takesSharedFiles: true }, { id: "notes" }]));
    expect(shareFiles("notes", [FILE], "finder")).toBeNull();
    expect(shareFiles("mail", [], "finder")).toBeNull();
  });

  it("refuses a share once the queue is full, and drops none it accepted", () => {
    stops.push(registerFileReceivers([{ id: "mail", takesSharedFiles: true }]));
    for (let n = 0; n < MAX_PENDING_SHARES; n += 1) {
      expect(shareFiles("mail", [{ ...FILE, id: `f${n}` }], "finder")).not.toBeNull();
    }
    expect(shareFiles("mail", [{ ...FILE, id: "late" }], "finder")).toBeNull();
    const kept = takeSharedFiles("mail").map((shared) => shared.items[0]?.id);
    expect(kept).toHaveLength(MAX_PENDING_SHARES);
    expect(kept[0]).toBe("f0");
    expect(kept).not.toContain("late");
  });

  it("lists the rows, dimming with its reason an app that takes no files yet", async () => {
    const user = userEvent.setup();
    stops.push(registerFileReceivers([{ id: "mail", takesSharedFiles: true }]));
    render(
      <Menu>
        <MenuTrigger>Share</MenuTrigger>
        <MenuPopup>
          <FileShareItems items={[FILE]} from="finder" />
        </MenuPopup>
      </Menu>,
    );
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect((await screen.findAllByRole("menuitem")).map((row) => row.textContent)).toEqual([
      "Mail",
      "Messages",
      "AirDrop",
      "Notes",
      "Add to Photos",
    ]);
    expect(screen.getByRole("menuitem", { name: "Mail" })).not.toHaveAttribute("data-reason");
    expect(screen.getByRole("menuitem", { name: "Add to Photos" })).toHaveAttribute(
      "data-reason",
      "Photos can’t take a file yet.",
    );
    expect(screen.getByRole("menuitem", { name: "AirDrop" })).toHaveAttribute(
      "data-reason",
      AIRDROP_REASON,
    );
  });
});

describe("Copy Link", () => {
  it("puts the text on the clipboard", async () => {
    userEvent.setup();
    expect(await copyText(PAGE)).toBe(true);
    expect(await navigator.clipboard.readText()).toBe(PAGE);
  });

  it("copies through a selected text when the clipboard refuses, and says when that fails too", async () => {
    userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );
    const copied: string[] = [];
    const exec = vi.fn(() => {
      copied.push((document.activeElement as HTMLTextAreaElement | null)?.value ?? "");
      return true;
    });
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true });
    expect(await copyText(PAGE)).toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
    expect(copied).toEqual([PAGE]);
    expect(document.querySelector("textarea"), "the text area is removed").toBeNull();
    exec.mockReturnValue(false);
    expect(await copyText(PAGE)).toBe(false);
    // A copy command that throws leaves nothing behind either.
    exec.mockImplementation(() => {
      throw new Error("not supported");
    });
    expect(await copyText(PAGE)).toBe(false);
    expect(document.querySelector("textarea")).toBeNull();
  });
});

describe("sharing a link with an app", () => {
  it("names why each app that does not take links cannot, and enables the ones that do", () => {
    // Whichever apps take links when this runs (each intake adds itself to SHARE_RECEIVERS): a
    // receiver has no reason, every other app says why it cannot take one.
    const titles: Record<string, string> = {
      mail: "Mail",
      messages: "Messages",
      notes: "Notes",
      reminders: "Reminders",
      safari: "Add to Reading List",
    };
    expect(shareTargets().map((target) => [target.app, target.reason])).toEqual(
      Object.entries(titles).map(([app, title]) => [
        app,
        SHARE_RECEIVERS.has(app) ? null : `${title} can’t take a shared link yet.`,
      ]),
    );
    expect(SHARE_RECEIVERS.has("messages") && SHARE_RECEIVERS.has("notes")).toBe(true);
    expect(shareTargets(new Set())[0]?.reason).toBe("Mail can’t take a shared link yet.");
    expect(shareTargets(new Set(["mail"]))[0]?.reason).toBeNull();
  });

  it("keeps a link for the app it is shared with, announces it and opens the app", () => {
    const effects: DesktopEffect[] = [];
    const hearEffects = (event: Event) =>
      effects.push(...(event as CustomEvent<DesktopEffect[]>).detail);
    const announced: unknown[] = [];
    const hearShare = (event: Event) => announced.push((event as CustomEvent).detail);
    window.addEventListener(DESKTOP_EFFECTS_EVENT, hearEffects);
    window.addEventListener(SHARE_LINK_EVENT, hearShare);
    try {
      expect(
        shareLink("mail", PAGE, "Catalina", "safari", new Set()),
        "an app that takes no links gets none",
      ).toBeNull();
      const receivers = new Set(["mail"]);
      const link = shareLink("mail", PAGE, "  Catalina ", "safari", receivers);
      expect(link).toEqual({ url: PAGE, title: "Catalina", from: "safari", to: "mail" });
      expect(announced).toEqual([link]);
      expect(effects).toContainEqual({ open: "mail" });
      expect(shareLink("mail", "javascript:alert(1)", "x", "safari", receivers)).toBeNull();
      expect(takeSharedLinks("notes")).toEqual([]);
      expect(takeSharedLinks("mail")).toEqual([link]);
      expect(takeSharedLinks("mail"), "taken once").toEqual([]);
    } finally {
      window.removeEventListener(DESKTOP_EFFECTS_EVENT, hearEffects);
      window.removeEventListener(SHARE_LINK_EVENT, hearShare);
    }
  });

  it("hands a link to the app hearing for it, and only to that app", () => {
    const heard: SharedLink[] = [];
    const other = vi.fn();
    const stop = onSharedLink("notes", (link) => heard.push(link));
    const stopOther = onSharedLink("mail", other);
    try {
      shareLink("notes", PAGE, "Catalina", "news", new Set(["notes"]));
      expect(heard).toEqual([{ url: PAGE, title: "Catalina", from: "news", to: "notes" }]);
      expect(other).not.toHaveBeenCalled();
      expect(takeSharedLinks("notes"), "heard, so not kept as well").toEqual([]);
    } finally {
      stop();
      stopOther();
    }
  });
});

describe("the rows of a Share menu for a link", () => {
  const share = (url: string, onCopied?: (copied: boolean) => void) =>
    render(
      <Menu>
        <MenuTrigger>Share</MenuTrigger>
        <MenuPopup>
          <LinkShareItems plain url={url} title="Catalina" from="news" onCopied={onCopied} />
        </MenuPopup>
      </Menu>,
    );

  it("leaves Add to Reading List to Safari's own menu", async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <MenuTrigger>Share</MenuTrigger>
        <MenuPopup>
          <LinkShareItems plain url={PAGE} title="Catalina" from="safari" />
        </MenuPopup>
      </Menu>,
    );
    await user.click(screen.getByRole("button", { name: "Share" }));
    const rows = await screen.findAllByRole("menuitem");
    expect(rows.map((row) => row.textContent)).not.toContain("Add to Reading List");
  });

  it("copies the link, and dims each app that cannot take it with the reason", async () => {
    const user = userEvent.setup();
    const copied = vi.fn();
    share(PAGE, copied);
    await user.click(screen.getByRole("button", { name: "Share" }));
    const rows = await screen.findAllByRole("menuitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Copy Link",
      "Mail",
      "Messages",
      "AirDrop",
      "Notes",
      "Reminders",
      "Add to Reading List",
    ]);
    const mail = screen.getByRole("menuitem", { name: "Mail" });
    if (SHARE_RECEIVERS.has("mail")) {
      expect(mail).not.toHaveAttribute("aria-disabled", "true");
    } else {
      expect(mail).toHaveAttribute("aria-disabled", "true");
      expect(mail).toHaveAttribute("title", "Mail can’t take a shared link yet.");
    }
    expect(screen.getByRole("menuitem", { name: "AirDrop" })).toHaveAttribute(
      "title",
      AIRDROP_REASON,
    );
    expect(screen.getByRole("menuitem", { name: "Copy Link" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(screen.getByRole("menuitem", { name: "Copy Link" }));
    await vi.waitFor(() => expect(copied).toHaveBeenCalledWith(true));
    expect(await navigator.clipboard.readText()).toBe(PAGE);
  });

  it("dims every row of something without a web address", async () => {
    const user = userEvent.setup();
    share("");
    await user.click(screen.getByRole("button", { name: "Share" }));
    const copy = await screen.findByRole("menuitem", { name: "Copy Link" });
    expect(copy).toHaveAttribute("aria-disabled", "true");
    expect(copy).toHaveAttribute("title", NO_ADDRESS_REASON);
  });
});
