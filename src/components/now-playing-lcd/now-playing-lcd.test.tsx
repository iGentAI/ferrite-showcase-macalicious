import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { NowPlayingLcd, type NowPlayingLcdProps } from "./index";

describe("NowPlayingLcd", () => {
  it("is an idle group named Now Playing that shows its children", () => {
    render(<NowPlayingLcd>Mark</NowPlayingLcd>);
    const lcd = screen.getByRole("group", { name: "Now Playing" });
    expect(lcd).toHaveClass("mac-now-playing-lcd");
    expect(lcd).toHaveAttribute("data-state", "idle");
    expect(lcd).toHaveAttribute("data-variant", "music");
    expect(lcd).toHaveTextContent("Mark");
    expect(lcd).not.toHaveAttribute("tabindex");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("shows the title and subtitle instead of the idle content when an item is loaded", () => {
    render(
      <NowPlayingLcd title="Morning Walk" subtitle="The Placeholders">
        Mark
      </NowPlayingLcd>,
    );
    const lcd = screen.getByRole("group");
    expect(lcd).toHaveAttribute("data-state", "playing");
    expect(lcd).toHaveTextContent("Morning Walk");
    expect(lcd).toHaveTextContent("The Placeholders");
    expect(lcd).not.toHaveTextContent("Mark");
  });

  it("reflects the variant", () => {
    render(<NowPlayingLcd variant="podcasts" />);
    expect(screen.getByRole("group")).toHaveAttribute("data-variant", "podcasts");
  });

  it("shows the placeholder in an empty well and the artwork in its place", () => {
    const { rerender } = render(<NowPlayingLcd placeholder={<span>glyph</span>} />);
    expect(screen.getByText("glyph")).toBeInTheDocument();
    rerender(
      <NowPlayingLcd
        placeholder={<span>glyph</span>}
        artwork={<img alt="Cover" src="cover.png" />}
      />,
    );
    expect(screen.queryByText("glyph")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Cover" })).toBeInTheDocument();
  });

  it("renders a progress bar with the position in words when a length is known", () => {
    render(<NowPlayingLcd title="Episode" elapsed={62} duration={6360} />);
    const bar = screen.getByRole("progressbar", { name: "Playback position" });
    expect(bar).toHaveAttribute("aria-valuenow", "62");
    expect(bar).toHaveAttribute("aria-valuemax", "6360");
    expect(bar).toHaveAttribute("aria-valuetext", "1:02 of 1:46:00");
    // The visible labels repeat that and are hidden from assistive technology.
    expect(screen.getByText("1:02")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("-1:44:58")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("renders no progress line without a length or without a title", () => {
    const { rerender } = render(<NowPlayingLcd title="Episode" elapsed={10} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    rerender(<NowPlayingLcd title="Episode" elapsed={10} duration={0} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    rerender(<NowPlayingLcd elapsed={10} duration={100} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("keeps the position within the item's length", () => {
    const { rerender } = render(<NowPlayingLcd title="Song" elapsed={500} duration={215} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "3:35 of 3:35");
    rerender(<NowPlayingLcd title="Song" elapsed={-5} duration={215} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "0:00 of 3:35");
    expect(screen.getByText("-3:35")).toBeInTheDocument();
  });

  it("names the progress line with seekLabel", () => {
    render(<NowPlayingLcd title="Song" duration={215} seekLabel="Position" />);
    expect(screen.getByRole("progressbar", { name: "Position" })).toBeInTheDocument();
  });

  function Player(props: NowPlayingLcdProps) {
    const [elapsed, setElapsed] = useState(60);
    return (
      <NowPlayingLcd
        title="Song"
        duration={215}
        elapsed={elapsed}
        {...props}
        onSeek={(seconds) => {
          setElapsed(seconds);
          props.onSeek?.(seconds);
        }}
      />
    );
  }

  it("becomes a slider with onSeek and seeks with the keyboard", async () => {
    const user = userEvent.setup();
    const onSeek = vi.fn();
    const onSeekCommitted = vi.fn();
    render(<Player onSeek={onSeek} onSeekCommitted={onSeekCommitted} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    const slider = screen.getByRole("slider", { name: "Playback position" });
    expect(slider).toHaveAttribute("aria-valuetext", "1:00 of 3:35");

    await user.tab();
    expect(slider).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(onSeek).toHaveBeenLastCalledWith(61);
    expect(onSeekCommitted).toHaveBeenLastCalledWith(61);
    expect(slider).toHaveAttribute("aria-valuetext", "1:01 of 3:35");
    await user.keyboard("{PageUp}");
    expect(onSeek).toHaveBeenLastCalledWith(76);
    await user.keyboard("{ArrowLeft}");
    expect(onSeek).toHaveBeenLastCalledWith(75);
    await user.keyboard("{End}");
    expect(onSeek).toHaveBeenLastCalledWith(215);
    await user.keyboard("{Home}");
    expect(onSeek).toHaveBeenLastCalledWith(0);
    expect(screen.getByText("-3:35")).toBeInTheDocument();
  });

  it("does not move when the consumer ignores onSeek", async () => {
    const user = userEvent.setup();
    render(<NowPlayingLcd title="Song" duration={215} elapsed={60} onSeek={() => {}} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "1:00 of 3:35");
  });

  it("shows no progress for a live or unknown length, and treats a bad position as zero", () => {
    const { rerender } = render(<NowPlayingLcd title="Live" duration={Infinity} elapsed={30} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("group")).not.toHaveTextContent("NaN");
    rerender(<NowPlayingLcd title="Live" duration={Number.NaN} onSeek={() => {}} />);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    rerender(<NowPlayingLcd title="Song" duration={215} elapsed={Number.NaN} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuetext", "0:00 of 3:35");
  });

  it("can be renamed, and forwards ref, className and native attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <NowPlayingLcd
        ref={ref}
        className="extra"
        id="lcd"
        aria-label="Lecture en cours"
        style={{ width: 320 }}
      />,
    );
    const lcd = screen.getByRole("group", { name: "Lecture en cours" });
    expect(ref.current).toBe(lcd);
    expect(lcd).toHaveClass("mac-now-playing-lcd", "extra");
    expect(lcd).toHaveAttribute("id", "lcd");
    expect(lcd).toHaveStyle({ width: "320px" });
  });
});
