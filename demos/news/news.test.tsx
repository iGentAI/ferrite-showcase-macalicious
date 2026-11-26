import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { app, newsApp } from "./app";
import { News } from "./news";
import { allStories, CHANNELS, darkEdition, lightEdition } from "./news-data";

const frame = () => screen.getByRole("region", { name: "News" });
const button = (name: string | RegExp) => screen.getByRole("button", { name });
/** The sidebar: a navigation landmark of the channels. */
const sidebar = () => within(screen.getByRole("navigation", { name: "Channels" }));
const channel = (name: string) => sidebar().getByRole("button", { name });
/** The view beside the sidebar. */
const pane = () => within(frame().querySelector(".mac-news-pane") as HTMLElement);
/** The title of what the pane shows: the masthead, a channel's name or a story's headline. */
const title = () => pane().getByRole("heading", { level: 2 });
/** The headlines the pane lists, in order: each is the button that opens its story. */
const headlines = () =>
  Array.from(frame().querySelectorAll(".mac-news-story-link"), (link) => link.textContent);
const search = () => screen.getByRole("searchbox", { name: "Search" });
/** A toolbar button that cannot be used stays in the toolbar's arrow-key order. */
const unavailable = (name: string) => button(name).getAttribute("aria-disabled") === "true";
const top = (edition = lightEdition) => edition.top.map((story) => story.headline);

describe("News", () => {
  it("opens on Today with the sidebar of the reference capture, at its size", () => {
    render(<News />);
    expect(frame()).toHaveClass("mac-window", "mac-news");
    expect(frame()).toHaveStyle({ width: "1222px", height: "842px" });

    expect(sidebar().getAllByRole("button")).toHaveLength(16);
    expect(
      sidebar()
        .getAllByRole("group")
        .map((group) => within(group).getAllByRole("button").length),
    ).toEqual([4, 2, 10]);
    expect(channel("Today")).toHaveAttribute("aria-current", "page");

    expect(title()).toHaveTextContent("News October 3");
    expect(pane().getByRole("heading", { level: 3 })).toHaveTextContent(/^Top Stories$/);
    // Two leads and three smaller stories; the edition's sixth is not on Today.
    expect(headlines()).toEqual(top().slice(0, 5));
    // Nothing to go back from and nothing to share while no story is open.
    expect(unavailable("Back")).toBe(true);
    expect(unavailable("Share")).toBe(true);
  });

  it("shows the edition it is given", () => {
    render(<News edition={darkEdition} />);
    expect(title()).toHaveTextContent("News October 4");
    expect(headlines()).toEqual(top(darkEdition).slice(0, 5));
  });

  it("shows a channel's stories when its row is chosen", async () => {
    const user = userEvent.setup();
    render(<News />);

    await user.click(channel("Science"));
    expect(channel("Science")).toHaveAttribute("aria-current", "page");
    expect(channel("Today")).not.toHaveAttribute("aria-current");
    expect(title()).toHaveTextContent(/^Science$/);
    expect(headlines()).toEqual([
      "Amateur astronomers log a record meteor shower",
      "Survey finds otters back on a city river",
    ]);

    // A destination with nothing in it says so.
    await user.click(channel("News+"));
    expect(headlines()).toEqual([]);
    expect(pane().getByText("No Issues")).toBeInTheDocument();
  });

  it("goes from Today to all the top stories with More Top Stories", async () => {
    const user = userEvent.setup();
    render(<News />);
    await user.click(button(/^More Top Stories$/i));
    expect(channel("News Top Stories")).toHaveAttribute("aria-current", "page");
    expect(title()).toHaveTextContent(/^News Top Stories$/);
    expect(headlines()).toEqual(top());
    // The button is gone with Today: the title of the list it led to has the focus.
    expect(title()).toHaveFocus();

    // Once: when the list is shown again, the title is left alone.
    const focused: string[] = [];
    frame().addEventListener("focusin", (event) => {
      focused.push((event.target as HTMLElement).tagName);
    });
    const [first] = top();
    await user.click(button(first as string));
    await user.click(button("Back"));
    expect(button(first as string)).toHaveFocus();
    await user.type(search(), "x");
    await user.clear(search());
    expect(title()).toHaveTextContent(/^News Top Stories$/);
    expect(search()).toHaveFocus();
    // The reader's headline took the focus once; no list title did.
    expect(focused.filter((tag) => tag === "H2")).toHaveLength(1);
  });

  it("keeps Saved Stories and History when it is given another edition", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<News />);
    const [first, second] = top();

    await user.click(button(first as string));
    await user.click(button("Share"));
    await user.click(await screen.findByRole("menuitem", { name: "Save Story" }));
    await user.click(button("Back"));
    await user.click(button(second as string));
    await user.click(button("Back"));

    rerender(<News edition={darkEdition} />);
    expect(title()).toHaveTextContent("News October 4");
    await user.click(channel("Saved Stories"));
    expect(headlines()).toEqual([first]);
    await user.click(channel("History"));
    expect(headlines()).toEqual([second, first]);
    // A story of the other edition still opens from there.
    await user.click(button(second as string));
    expect(title()).toHaveTextContent(second as string);
  });

  it("opens the story it kept, not another edition's story with the same id", async () => {
    const user = userEvent.setup();
    const story = { id: "shared", publisher: "Daily Sample", age: "1h ago" };
    const before = { date: "May 1", top: [{ ...story, headline: "The first version" }] };
    const after = { date: "May 2", top: [{ ...story, headline: "The second version" }] };
    const { rerender } = render(<News edition={before} />);

    await user.click(button("The first version"));
    await user.click(button("Share"));
    await user.click(await screen.findByRole("menuitem", { name: "Save Story" }));
    await user.click(button("Back"));

    rerender(<News edition={after} />);
    expect(headlines()).toEqual(["The second version"]);

    // What History and Saved Stories list is what opens from them.
    await user.click(channel("History"));
    expect(headlines()).toEqual(["The first version"]);
    await user.click(button("The first version"));
    expect(title()).toHaveTextContent(/^The first version$/);
    await user.click(button("Back"));
    expect(button("The first version")).toHaveFocus();
    await user.click(channel("Saved Stories"));
    await user.click(button("The first version"));
    expect(title()).toHaveTextContent(/^The first version$/);

    // The edition's story is another story: it opens as itself, is not saved, and History
    // lists both.
    await user.click(channel("Today"));
    await user.click(button("The second version"));
    expect(title()).toHaveTextContent(/^The second version$/);
    await user.click(button("Share"));
    expect(await screen.findByRole("menuitem", { name: "Save Story" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(channel("History"));
    expect(headlines()).toEqual(["The second version", "The first version"]);
    await user.click(channel("Saved Stories"));
    expect(headlines()).toEqual(["The first version"]);
  });

  it("opens a story, returns with Back and lists it in History", async () => {
    const user = userEvent.setup();
    render(<News />);
    const [first, second] = top();

    await user.click(button(second as string));
    expect(title()).toHaveTextContent(second as string);
    expect(
      pane().getByText(/^This is a sample story\. Metro Wire is not a real publisher/),
    ).toBeVisible();
    expect(headlines()).toEqual([]);
    expect(unavailable("Back")).toBe(false);
    expect(unavailable("Share")).toBe(false);

    // The focus follows the story: to its headline, and back to the button that opened it.
    expect(title()).toHaveFocus();
    await user.click(button("Back"));
    expect(title()).toHaveTextContent("News October 3");
    expect(unavailable("Back")).toBe(true);
    expect(button(second as string)).toHaveFocus();

    await user.click(button(first as string));
    await user.click(channel("History"));
    // The newest first, each story once.
    expect(headlines()).toEqual([first, second]);
  });

  it("saves the open story from the Share menu and removes it again", async () => {
    const user = userEvent.setup();
    render(<News />);
    const [first] = top();

    await user.click(channel("Saved Stories"));
    expect(pane().getByText("No Saved Stories")).toBeInTheDocument();

    await user.click(channel("Today"));
    await user.click(button(first as string));
    await user.click(button("Share"));
    await user.click(await screen.findByRole("menuitem", { name: "Save Story" }));

    await user.click(channel("Saved Stories"));
    expect(headlines()).toEqual([first]);

    await user.click(button(first as string));
    await user.click(button("Share"));
    await user.click(await screen.findByRole("menuitem", { name: "Remove from Saved Stories" }));
    await user.click(channel("Saved Stories"));
    expect(headlines()).toEqual([]);
  });

  it("searches every story by headline and publisher", async () => {
    const user = userEvent.setup();
    render(<News />);

    await user.type(search(), "otters");
    expect(title()).toHaveTextContent(/^Search Results$/);
    expect(headlines()).toEqual(["Survey finds otters back on a city river"]);

    // A publisher's name finds its stories, whatever the case and the space around it.
    await user.clear(search());
    await user.type(search(), "  METRO wire ");
    const fromMetroWire = allStories(lightEdition)
      .filter((story) => story.publisher === "Metro Wire")
      .map((story) => story.headline);
    expect(fromMetroWire.length).toBeGreaterThan(1);
    expect(fromMetroWire.join(" ")).not.toMatch(/metro wire/i);
    expect(headlines()).toEqual(fromMetroWire);

    await user.clear(search());
    await user.type(search(), "zzz");
    expect(headlines()).toEqual([]);
    expect(pane().getByText("No Results")).toBeInTheDocument();

    // Choosing a channel ends the search.
    await user.click(channel("Travel"));
    expect(search()).toHaveValue("");
    expect(title()).toHaveTextContent(/^Travel$/);
  });

  it("hides and shows the sidebar with its toolbar button", async () => {
    const user = userEvent.setup();
    render(<News />);
    await user.click(button("Hide Sidebar"));
    expect(screen.queryByRole("navigation", { name: "Channels" })).not.toBeInTheDocument();
    expect(title()).toHaveTextContent("News October 3");
    await user.click(button("Show Sidebar"));
    expect(channel("Today")).toHaveAttribute("aria-current", "page");
  });

  it("hands a window manager's commands to the window controls and the toolbar row", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDragRegionDoubleClick = vi.fn();
    render(<News onClose={onClose} onDragRegionDoubleClick={onDragRegionDoubleClick} />);

    await user.click(button("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.dblClick(frame().querySelector("[data-window-drag-region]") as HTMLElement);
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
    // A double click on a control in the row is the control's, not the row's.
    await user.dblClick(button("Hide Sidebar"));
    expect(onDragRegionDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("describes itself to a desktop page", () => {
    expect(app).toBe(newsApp);
    expect(app).toMatchObject({
      id: "news",
      name: "News",
      component: News,
      defaultSize: { width: 1222, height: 842 },
      resizable: true,
    });
    expect(app.menus[0]).toBe(app.name);
    expect(new Set(CHANNELS.map((candidate) => candidate.id)).size).toBe(CHANNELS.length);
  });
});
