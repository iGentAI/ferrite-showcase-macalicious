import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SongTable, type SongTableProps } from "./music-library-views";
import type { LibrarySong } from "./music-server";

const song = (id: string, title: string): LibrarySong => ({
  id,
  title,
  artist: "Ada Rowan",
  album: "Slow Tide",
  genre: "",
  year: null,
  track: null,
  duration: 100,
  added: 0,
  artwork: null,
  source: { kind: "file", file: `f-${id}`, name: `${id}.mp3`, type: "audio/mpeg", size: 1 },
});

function table(songs: LibrarySong[], more: Partial<SongTableProps> = {}) {
  return (
    <SongTable
      songs={songs}
      label="Songs"
      loved={new Set()}
      plays={{}}
      playlists={[]}
      currentId={null}
      rowHeight={20}
      onPlay={vi.fn()}
      onAction={vi.fn()}
      {...more}
    />
  );
}

const rowOf = (title: string) => screen.getByText(title).closest("[data-row]") as HTMLElement;

describe("Music's song table", () => {
  it("keeps its contextual menu on the song it was opened on while the rows change", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onPlay = vi.fn();
    const songs = [song("b", "Bell"), song("c", "Cove")];
    const { rerender } = render(table(songs, { onAction, onPlay }));
    fireEvent.contextMenu(rowOf("Cove"), { clientX: 10, clientY: 10 });
    await screen.findByRole("menu");

    // A song sorting first arrives while the menu is open: Cove is now the third row.
    rerender(table([song("a", "Anchor"), ...songs], { onAction, onPlay }));
    await user.click(screen.getByRole("menuitem", { name: "Delete from Library" }));
    expect(onAction).toHaveBeenCalledWith({ type: "delete", ids: ["c"] });

    fireEvent.contextMenu(rowOf("Bell"), { clientX: 10, clientY: 10 });
    await screen.findByRole("menu");
    rerender(table([song("a", "Anchor"), song("aa", "Aardvark"), ...songs], { onAction, onPlay }));
    await user.click(screen.getByRole("menuitem", { name: "Play" }));
    expect(onPlay).toHaveBeenCalledWith(["aa", "a", "b", "c"], 2);
  });

  it("acts on the whole selection from a selected song's menu, and on one song from another's", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const songs = [song("a", "Anchor"), song("b", "Bell"), song("c", "Cove")];
    render(table(songs, { onAction }));
    fireEvent.mouseDown(rowOf("Anchor"));
    fireEvent.mouseDown(rowOf("Bell"), { shiftKey: true });
    expect(screen.getAllByRole("row", { selected: true })).toHaveLength(2);

    fireEvent.contextMenu(rowOf("Bell"), { clientX: 10, clientY: 10 });
    await screen.findByRole("menu");
    await user.click(screen.getByRole("menuitem", { name: "Love" }));
    expect(onAction).toHaveBeenLastCalledWith({ type: "love", ids: ["a", "b"] });

    fireEvent.contextMenu(rowOf("Cove"), { clientX: 10, clientY: 10 });
    await screen.findByRole("menu");
    expect(screen.getAllByRole("row", { selected: true, hidden: true })).toHaveLength(1);
    await user.click(screen.getByRole("menuitem", { name: "Play Later" }));
    expect(onAction).toHaveBeenLastCalledWith({ type: "play-later", ids: ["c"] });
  });

  it("closes its contextual menu when the song it was opened on is gone", async () => {
    const onAction = vi.fn();
    const { rerender } = render(table([song("b", "Bell"), song("c", "Cove")], { onAction }));
    fireEvent.contextMenu(rowOf("Cove"), { clientX: 10, clientY: 10 });
    await screen.findByRole("menu");
    rerender(table([song("b", "Bell")], { onAction }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(screen.queryByRole("menuitem", { name: "Delete from Library" })).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
  });
});
