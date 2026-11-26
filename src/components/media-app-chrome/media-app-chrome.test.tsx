import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  MediaAppChrome,
  MediaAppChromeBar,
  MediaAppChromeButton,
  MediaAppChromeControls,
  MediaAppChromeDisplay,
  MediaAppChromePane,
  MediaAppChromeSidebar,
  MediaAppChromeTransport,
  MediaAppChromeVolume,
} from "./index";

function Player({ onPlay, onVolume }: { onPlay?: () => void; onVolume?: (value: number) => void }) {
  return (
    <MediaAppChrome data-testid="chrome">
      <MediaAppChromeSidebar controls={<span>lights</span>} search={<input aria-label="Search" />}>
        <nav aria-label="Library">list</nav>
      </MediaAppChromeSidebar>
      <MediaAppChromeBar aria-label="Playback controls">
        <MediaAppChromeTransport>
          <MediaAppChromeButton glyph="previous" aria-label="Previous" />
          <MediaAppChromeButton glyph="play" aria-label="Play" onClick={onPlay} />
          <MediaAppChromeButton glyph="next" aria-label="Next" />
        </MediaAppChromeTransport>
        <MediaAppChromeDisplay>display</MediaAppChromeDisplay>
        <MediaAppChromeControls>
          <MediaAppChromeVolume defaultValue={50} onValueChange={onVolume}>
            <MediaAppChromeButton glyph="output" aria-label="Audio output" />
          </MediaAppChromeVolume>
          <MediaAppChromeButton glyph="up-next" aria-label="Up Next" />
        </MediaAppChromeControls>
      </MediaAppChromeBar>
      <MediaAppChromePane>content</MediaAppChromePane>
    </MediaAppChrome>
  );
}

describe("MediaAppChrome", () => {
  it("renders the music variant with a 220 pt sidebar by default", () => {
    render(<Player />);
    const chrome = screen.getByTestId("chrome");
    expect(chrome).toHaveClass("mac-media-app-chrome");
    expect(chrome).toHaveAttribute("data-variant", "music");
    expect(chrome.style.getPropertyValue("--mac-media-app-chrome-sidebar-width")).toBe("220px");
  });

  it("reflects the variant and the sidebar width, and keeps the caller's style", () => {
    render(
      <MediaAppChrome
        data-testid="chrome"
        variant="podcasts"
        sidebarWidth={260}
        style={{ height: 300 }}
      />,
    );
    const chrome = screen.getByTestId("chrome");
    expect(chrome).toHaveAttribute("data-variant", "podcasts");
    expect(chrome.style.getPropertyValue("--mac-media-app-chrome-sidebar-width")).toBe("260px");
    expect(chrome).toHaveStyle({ height: "300px" });
  });

  it("puts the window controls, the search field and the list in the sidebar", () => {
    render(<Player />);
    const sidebar = screen.getByText("lights").closest(".mac-media-app-chrome-sidebar");
    expect(sidebar).not.toBeNull();
    const inside = within(sidebar as HTMLElement);
    expect(inside.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
    expect(inside.getByRole("navigation", { name: "Library" })).toBeInTheDocument();
  });

  it("reflects the material of the sidebar header", () => {
    const { container, rerender } = render(<MediaAppChromeSidebar />);
    const header = () => container.querySelector(".mac-media-app-chrome-header");
    expect(header()).toHaveAttribute("data-material", "translucent");
    rerender(<MediaAppChromeSidebar material="opaque" />);
    expect(header()).toHaveAttribute("data-material", "opaque");
  });

  it("is a named toolbar with a transport group of named buttons", () => {
    render(<Player />);
    const bar = screen.getByRole("toolbar", { name: "Playback controls" });
    const transport = within(bar).getByRole("group", { name: "Playback" });
    expect(within(transport).getAllByRole("button")).toHaveLength(3);
    expect(within(bar).getByRole("button", { name: "Up Next" })).toBeInTheDocument();
  });

  it("activates a button with the pointer, Enter and Space", async () => {
    const user = userEvent.setup();
    const onPlay = vi.fn();
    render(<Player onPlay={onPlay} />);
    const play = screen.getByRole("button", { name: "Play" });
    await user.click(play);
    expect(onPlay).toHaveBeenCalledTimes(1);
    play.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onPlay).toHaveBeenCalledTimes(3);
  });

  it("is one tab stop for its buttons, with the arrow keys moving between them", async () => {
    const user = userEvent.setup();
    render(<Player />);
    screen.getByRole("textbox", { name: "Search" }).focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Previous" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Play" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("button", { name: "Previous" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("slider", { name: "Volume" })).toHaveFocus();
  });

  it("does not activate a disabled button", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <MediaAppChromeBar aria-label="Bar">
        <MediaAppChromeButton glyph="next" aria-label="Next" disabled onClick={onClick} />
      </MediaAppChromeBar>,
    );
    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toHaveAttribute("data-disabled");
    await user.click(next);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("changes the volume with the arrow keys without moving between the buttons", async () => {
    const user = userEvent.setup();
    const onVolume = vi.fn();
    render(<Player onVolume={onVolume} />);
    const slider = screen.getByRole("slider", { name: "Volume" });
    expect(slider).toHaveAttribute("aria-valuenow", "50");
    slider.focus();
    await user.keyboard("{ArrowRight}");
    expect(onVolume.mock.lastCall?.[0]).toBe(51);
    expect(slider).toHaveFocus();
    expect(slider).toHaveAttribute("aria-valuenow", "51");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(onVolume.mock.lastCall?.[0]).toBe(49);
    expect(slider).toHaveFocus();
  });

  it("controls the volume and takes another name for it", () => {
    const { rerender } = render(<MediaAppChromeVolume value={20} aria-label="Level" />);
    const slider = screen.getByRole("slider", { name: "Level" });
    expect(slider).toHaveAttribute("aria-valuenow", "20");
    rerender(<MediaAppChromeVolume value={80} aria-label="Level" />);
    expect(slider).toHaveAttribute("aria-valuenow", "80");
  });

  it("draws the seconds in a skip glyph and shows children when there is no glyph", () => {
    render(
      <MediaAppChromeBar aria-label="Bar">
        <MediaAppChromeButton glyph="skip-back" seconds={15} aria-label="Back" />
        <MediaAppChromeButton aria-label="Custom">mine</MediaAppChromeButton>
      </MediaAppChromeBar>,
    );
    expect(screen.getByRole("button", { name: "Back" })).toHaveTextContent("15");
    expect(screen.getByRole("button", { name: "Custom" })).toHaveTextContent("mine");
  });

  it("passes aria-pressed through for a toggle", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <MediaAppChromeBar aria-label="Bar">
        <MediaAppChromeButton
          glyph="lyrics"
          aria-label="Lyrics"
          aria-pressed="true"
          onClick={onClick}
        />
      </MediaAppChromeBar>,
    );
    const lyrics = screen.getByRole("button", { name: "Lyrics", pressed: true });
    await user.click(lyrics);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("forwards ref, className and native attributes on every part", () => {
    const chrome = createRef<HTMLDivElement>();
    const sidebar = createRef<HTMLDivElement>();
    const bar = createRef<HTMLDivElement>();
    const transport = createRef<HTMLDivElement>();
    const display = createRef<HTMLDivElement>();
    const controls = createRef<HTMLDivElement>();
    const button = createRef<HTMLElement>();
    const volume = createRef<HTMLDivElement>();
    const pane = createRef<HTMLDivElement>();
    render(
      <MediaAppChrome ref={chrome} className="a" id="chrome">
        <MediaAppChromeSidebar ref={sidebar} className="b" id="sidebar" />
        <MediaAppChromeBar ref={bar} className="c" id="bar" aria-label="Bar">
          <MediaAppChromeTransport ref={transport} className="d" aria-label="Transport">
            <MediaAppChromeButton
              ref={button}
              className="e"
              id="play"
              glyph="play"
              aria-label="Play"
            />
          </MediaAppChromeTransport>
          <MediaAppChromeDisplay ref={display} className="f" id="display" />
          <MediaAppChromeControls ref={controls} className="g" id="controls">
            <MediaAppChromeVolume ref={volume} className="h" style={{ width: 120 }} />
          </MediaAppChromeControls>
        </MediaAppChromeBar>
        <MediaAppChromePane ref={pane} className="i" id="pane" />
      </MediaAppChrome>,
    );
    expect(chrome.current).toHaveClass("mac-media-app-chrome", "a");
    expect(chrome.current).toHaveAttribute("id", "chrome");
    expect(sidebar.current).toHaveClass("mac-media-app-chrome-sidebar", "b");
    expect(bar.current).toHaveClass("mac-media-app-chrome-bar", "c");
    expect(bar.current).toHaveAttribute("id", "bar");
    expect(transport.current).toHaveClass("mac-media-app-chrome-transport", "d");
    expect(transport.current).toHaveAccessibleName("Transport");
    expect(button.current).toHaveClass("mac-media-app-chrome-button", "e");
    expect(button.current).toHaveAttribute("id", "play");
    expect(display.current).toHaveClass("mac-media-app-chrome-display", "f");
    expect(controls.current).toHaveClass("mac-media-app-chrome-controls", "g");
    expect(volume.current).toHaveClass("mac-media-app-chrome-volume", "h");
    expect(volume.current).toHaveStyle({ width: "120px" });
    expect(pane.current).toHaveClass("mac-media-app-chrome-pane", "i");
  });
});
