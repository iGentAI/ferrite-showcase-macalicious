import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EpisodeList, EpisodePage, type PodcastsLibrary } from "./podcasts-views";

const episode = (id: string) => ({ id, title: `Episode ${id}`, duration: 60, day: "Today" });
const episodes = ["a", "b", "c", "d"].map(episode) as never[];

const library: PodcastsLibrary = {
  showOf: () => ({ id: "s", title: "Show", colors: ["#000", "#111"] }) as never,
  positionOf: () => undefined,
  isPlayed: () => false,
  current: null,
  playing: false,
  onPlay: vi.fn(),
  onToggle: vi.fn(),
  episodesMenu: () => null,
};

const chosen = () =>
  [...document.querySelectorAll(".mac-podcasts-chosen")].map((card) =>
    card.getAttribute("data-episode-id"),
  );

describe("an episode's page", () => {
  const notes = {
    id: "e",
    show: "s",
    title: "The Long Road",
    description: "First paragraph.\n\nSecond paragraph.",
    date: "October 1, 2026",
    day: "Today",
    published: 1,
    duration: 1800,
  };

  it("shows its notes and commands, plays it, and says why it cannot be downloaded", () => {
    const onPlay = vi.fn();
    const onBack = vi.fn();
    const onGoToShow = vi.fn();
    render(
      <EpisodePage
        episode={notes}
        library={{ ...library, onPlay }}
        noDownload="Episodes stream."
        origin="Episodes"
        onBack={onBack}
        onGoToShow={onGoToShow}
      />,
    );
    expect(screen.getByRole("heading", { name: "The Long Road" })).toBeTruthy();
    expect(screen.getByText("First paragraph.")).toBeTruthy();
    expect(screen.getByText("Second paragraph.")).toBeTruthy();
    expect(screen.getByText(/^October 1, 2026 · /)).toBeTruthy();
    const download = screen.getByRole("button", { name: "Download" }) as HTMLButtonElement;
    expect(download.disabled).toBe(true);
    expect(download.title).toBe("Episodes stream.");
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onPlay).toHaveBeenCalledWith([notes], 0);
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(onGoToShow).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Back to Episodes" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("pauses when it is the episode playing", () => {
    const onToggle = vi.fn();
    render(
      <EpisodePage
        episode={notes}
        library={{ ...library, current: notes, playing: true, onToggle }}
        noDownload=""
        origin="Episodes"
        onBack={vi.fn()}
        onGoToShow={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(onToggle).toHaveBeenCalled();
  });
});

describe("choosing episodes by keyboard", () => {
  const list = () => {
    const onRemove = vi.fn();
    render(
      <EpisodeList title="Up Next" episodes={episodes} library={library} onRemove={onRemove} />,
    );
    fireEvent.click(screen.getByText("Episode b"));
    const grid = document.querySelector<HTMLElement>('[tabindex="0"]') as HTMLElement;
    return { grid, onRemove };
  };

  it("steps with the arrows and widens with Shift", () => {
    const { grid } = list();
    expect(chosen()).toEqual(["b"]);
    fireEvent.keyDown(grid, { key: "ArrowDown" });
    expect(chosen()).toEqual(["c"]);
    fireEvent.keyDown(grid, { key: "ArrowUp", shiftKey: true });
    fireEvent.keyDown(grid, { key: "ArrowUp", shiftKey: true });
    expect(chosen()).toEqual(["a", "b", "c"]);
  });

  it("takes every episode with Command-A, and removes those chosen with Delete", () => {
    const { grid, onRemove } = list();
    fireEvent.keyDown(grid, { key: "a", metaKey: true });
    expect(chosen()).toEqual(["a", "b", "c", "d"]);
    fireEvent.keyDown(grid, { key: "Delete" });
    expect(onRemove.mock.calls[0]?.[0].map((one: { id: string }) => one.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(chosen()).toEqual([]);
  });
});
