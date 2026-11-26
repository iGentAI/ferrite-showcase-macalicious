import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DesktopApp } from "../desktop/desktop-apps";
import { type DesktopEffect, onDesktopEffects } from "../desktop/desktop-effects";
import { takeOpenItemRequests } from "../desktop/desktop-open-item";
import { takeAddressRequests } from "../desktop/desktop-reach";
import { SpotlightSearchPanel } from "./spotlight-desktop";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const APPS = [
  { id: "messages", name: "Messages" },
  { id: "facetime", name: "FaceTime" },
  { id: "books", name: "Books" },
  { id: "help-viewer", name: "Help Viewer" },
] as unknown as DesktopApp[];

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

/** Spotlight asking the server, which answers `results` for the words typed. */
async function search(words: string, results: readonly unknown[]) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.startsWith("/api/dictionary/")
        ? { ok: false, status: 404, json: async () => ({}) }
        : json({ query: words, results, truncated: false }),
    ),
  );
  const user = userEvent.setup();
  const launch = vi.fn();
  const onClose = vi.fn();
  render(<SpotlightSearchPanel apps={APPS} launch={launch} onClose={onClose} />);
  const field = screen.getByRole("combobox", { name: "Spotlight Search" });
  await user.type(field, words);
  return { user, launch, field };
}

const group = (label: string) => screen.getByRole("group", { name: label });

describe("What Spotlight finds beyond the documents", () => {
  it("lists a person's conversation under Messages and opens it with that person", async () => {
    const opened: DesktopEffect[] = [];
    const stop = onDesktopEffects((effects) => opened.push(...effects));
    const { user, field } = await search("lunch", [
      {
        kind: "messages",
        app: "messages",
        id: "conv-1",
        title: "Ada Lovelace",
        detail: "Ada Lovelace: Lunch at noon?",
        at: 1_600_000_000_000,
        to: "ada",
      },
    ]);
    const row = await screen.findByRole("option", { name: "Ada Lovelace" });
    expect(group("Messages")).toContainElement(row);
    await user.click(row);
    expect(screen.getByText("Ada Lovelace: Lunch at noon?")).toBeInTheDocument();
    expect(screen.getByText(/^Sent /)).toBeInTheDocument();
    await user.type(field, "{Enter}");
    expect(takeAddressRequests("messages")).toMatchObject([{ to: "ada", name: "Ada Lovelace" }]);
    expect(opened).toEqual([{ open: "messages" }]);
    stop();
  });

  it("opens a group's conversation by its id, in Messages", async () => {
    const { user, field } = await search("club", [
      { kind: "messages", app: "messages", id: "conv-2", title: "Book club", detail: "" },
    ]);
    await screen.findByRole("option", { name: "Book club" });
    await user.type(field, "{Enter}");
    expect(takeAddressRequests("messages")).toEqual([]);
    expect(takeOpenItemRequests("messages")).toEqual([
      { app: "messages", id: "conv-2", title: "Book club" },
    ]);
  });

  it("lists a recent call under FaceTime and opens FaceTime without ringing anyone", async () => {
    const { user, field, launch } = await search("grace", [
      {
        kind: "facetime",
        app: "facetime",
        id: "grace",
        title: "Grace Hopper",
        detail: "Missed FaceTime Audio",
      },
    ]);
    const row = await screen.findByRole("option", { name: "Grace Hopper" });
    expect(group("Top Hit")).toContainElement(row);
    expect(screen.getByText("Missed FaceTime Audio")).toBeInTheDocument();
    await user.type(field, "{Enter}");
    expect(takeAddressRequests("facetime")).toEqual([]);
    expect(takeOpenItemRequests("facetime")).toMatchObject([{ id: "grace" }]);
    expect(launch).toHaveBeenCalledWith("facetime");
  });

  it("lists a book under Books with its author", async () => {
    const { user, field } = await search("austen", [
      {
        kind: "books",
        app: "books",
        id: "pg-1342",
        title: "Pride and Prejudice",
        detail: "Jane Austen",
      },
    ]);
    const row = await screen.findByRole("option", { name: "Pride and Prejudice" });
    expect(group("Books")).toContainElement(row);
    expect(screen.getByText("Jane Austen")).toBeInTheDocument();
    await user.type(field, "{Enter}");
    expect(takeOpenItemRequests("books")).toMatchObject([{ id: "pg-1342" }]);
  });

  it("lists help topics by title and opens Help Viewer on the one chosen", async () => {
    const { user } = await search("filevault", []);
    const row = await screen.findByRole("option", { name: "Change FileVault preferences on Mac" });
    expect(group("Help")).toContainElement(row);
    await user.dblClick(row);
    const { takeHelpRequest } = await import("../desktop/desktop-help");
    expect(takeHelpRequest()).toBe("Change FileVault preferences on Mac");
  });

  it("shows a contact's card and a kept place's map in the preview", async () => {
    const { user } = await search("ada", [
      {
        kind: "contacts",
        app: "contacts",
        id: "c",
        title: "Ada Lovelace",
        detail: "ada@example.org",
        lines: ["mobile 555-0100", "home ada@example.org"],
      },
      {
        kind: "places",
        app: "maps",
        id: "p",
        title: "Ada's Cafe",
        detail: "1 High St",
        lat: 51.5,
        lon: -0.12,
      },
    ]);
    expect(await screen.findByText("mobile 555-0100")).toBeInTheDocument();
    expect(screen.getByText("home ada@example.org")).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Ada's Cafe" }));
    const map = await screen.findByRole("img", { name: "Map of Ada's Cafe" });
    expect(map).toHaveAttribute("src", "https://tile.openstreetmap.org/15/16373/10897.png");
    await waitFor(() => expect(within(group("Places")).getByRole("option")).toBeInTheDocument());
  });
});
