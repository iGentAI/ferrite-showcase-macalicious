import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArchiveResult, ArchiveSearchPage } from "./music-server";

/**
 * The Internet Archive browser with `searchArchive` replaced by requests the test answers by
 * hand, in any order: this checks which answers the browser shows, not the Archive itself.
 */

interface Pending {
  query: string;
  page: number;
  resolve: (page: ArchiveSearchPage) => void;
  reject: (error: Error) => void;
}
const pending: Pending[] = [];

vi.mock("./music-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./music-server")>();
  return {
    ...actual,
    searchArchive: (query: string, page = 1) =>
      new Promise<ArchiveSearchPage>((resolve, reject) =>
        pending.push({ query, page, resolve, reject }),
      ),
  };
});

const { ArchiveBrowser } = await import("./music-archive");

const results = (prefix: string, count: number): ArchiveResult[] =>
  Array.from({ length: count }, (_, i) => ({
    identifier: `${prefix}${i}`,
    title: `${prefix} item ${i}`,
    creator: "Someone",
    year: 2014,
    license: "http://creativecommons.org/licenses/by/4.0/",
  }));

function answer(query: string, page: number, items: ArchiveResult[], total: number) {
  const at = pending.findIndex((entry) => entry.query === query && entry.page === page);
  if (at < 0) throw new Error(`no request for ${query} page ${page}`);
  const [request] = pending.splice(at, 1);
  if (!request) throw new Error(`no request for ${query} page ${page}`);
  return act(async () => request.resolve({ results: items, total, page, rows: 24 }));
}

const grid = () => document.body;

afterEach(() => {
  pending.length = 0;
});

describe("Music's Internet Archive browser", () => {
  it("searches the same words again after a failed search", async () => {
    const user = userEvent.setup();
    render(
      <ArchiveBrowser
        initialQuery="jazz"
        libraryIds={new Set()}
        rowHeight={20}
        onPlay={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    const first = pending.splice(0, 1)[0];
    await act(async () => first?.reject(new Error("timed out")));
    expect(await screen.findByRole("alert")).toHaveTextContent("timed out");
    // Try Again, then the Search button with the words unchanged: each asks again.
    await user.click(screen.getByRole("button", { name: "Try Again" }));
    expect(pending.filter((entry) => entry.query === "jazz")).toHaveLength(1);
    const second = pending.splice(0, 1)[0];
    await act(async () => second?.reject(new Error("timed out")));
    await user.click(await screen.findByRole("button", { name: "Search" }));
    await answer("jazz", 1, results("jazz", 2), 2);
    expect(screen.getByText("jazz item 0")).toBeInTheDocument();
  });

  it("shows no page of an earlier search once a newer search has started", async () => {
    const user = userEvent.setup();
    render(
      <ArchiveBrowser
        initialQuery="jazz"
        libraryIds={new Set()}
        rowHeight={20}
        onPlay={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    await answer("jazz", 1, results("jazz", 24), 48);
    await user.click(screen.getByRole("button", { name: "More Results" }));
    expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();

    const field = screen.getByRole("searchbox", { name: "Search the Internet Archive" });
    await user.clear(field);
    await user.type(field, "folk{Enter}");
    await answer("folk", 1, results("folk", 24), 30);
    // The page of the search before arrives last: it is dropped, and the button is the new
    // search's, ready.
    await answer("jazz", 2, results("late", 24), 48);
    expect(within(grid()).queryByText("late item 0")).toBeNull();
    expect(within(grid()).queryByText("jazz item 0")).toBeNull();
    expect(within(grid()).getByText("folk item 0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More Results" })).toBeEnabled();
  });

  it("shows the newer search when an earlier one answers after it", async () => {
    const user = userEvent.setup();
    render(
      <ArchiveBrowser
        initialQuery="jazz"
        libraryIds={new Set()}
        rowHeight={20}
        onPlay={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    const field = screen.getByRole("searchbox", { name: "Search the Internet Archive" });
    await user.clear(field);
    await user.type(field, "folk{Enter}");
    await answer("folk", 1, results("folk", 3), 3);
    await answer("jazz", 1, results("jazz", 3), 3);
    expect(within(grid()).getByText("folk item 0")).toBeInTheDocument();
    expect(within(grid()).queryByText("jazz item 0")).toBeNull();
  });

  it("appends a page once, from the search it belongs to", async () => {
    const user = userEvent.setup();
    render(
      <ArchiveBrowser
        initialQuery="jazz"
        libraryIds={new Set()}
        rowHeight={20}
        onPlay={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    await answer("jazz", 1, results("jazz", 24), 30);
    await user.click(screen.getByRole("button", { name: "More Results" }));
    await answer("jazz", 2, results("more", 6), 30);
    expect(within(grid()).getByText("more item 5")).toBeInTheDocument();
    expect(within(grid()).getByText("jazz item 0")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More Results" })).toBeNull();
  });
});
