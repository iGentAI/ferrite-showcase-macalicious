import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TitleBar } from "../title-bar";
import { Window } from "../window";
import { FullScreenWindow, type FullScreenWindowProps } from "./index";

function Example(props: FullScreenWindowProps) {
  return (
    <>
      <FullScreenWindow
        data-testid="root"
        menuBar={
          <div data-testid="menu-bar">
            <button type="button">File</button>
          </div>
        }
        titleBar={<TitleBar title="Albums" controls={<button type="button">Close</button>} />}
        {...props}
      >
        <button type="button">Play</button>
      </FullScreenWindow>
      <button type="button">Outside</button>
    </>
  );
}

const root = () => screen.getByTestId("root");
const part = (name: string) => {
  const element = root().querySelector(`.mac-full-screen-window-${name}`);
  if (!(element instanceof HTMLElement)) throw new Error(`no ${name}`);
  return element;
};
const button = (name: string) => screen.getByRole("button", { name });

describe("FullScreenWindow", () => {
  it("renders a full-screen window named by its title bar, with the bars hidden", () => {
    render(<Example />);
    const region = screen.getByRole("region", { name: "Albums" });
    expect(region).toBe(root());
    expect(region).toHaveClass("mac-window", "mac-full-screen-window");
    expect(region).toHaveAttribute("data-full-screen");
    expect(region).toHaveAttribute("data-window-state", "key");
    expect(region).not.toHaveAttribute("data-revealed");
    expect(region).not.toHaveAttribute("data-auto-hide-toolbar");
    // The bars come before the content, so that they are first in the tab order.
    expect(part("menu-bar")).toContainElement(screen.getByTestId("menu-bar"));
    expect(part("panel")).toContainElement(button("Close"));
    expect(part("bars").compareDocumentPosition(button("Play"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("reveals the bars when the pointer reaches the top edge and hides them when it leaves", async () => {
    const user = userEvent.setup();
    const onRevealedChange = vi.fn();
    render(<Example onRevealedChange={onRevealedChange} />);
    await user.hover(part("edge"));
    expect(root()).toHaveAttribute("data-revealed");
    expect(onRevealedChange).toHaveBeenCalledExactlyOnceWith(true);
    // From the edge onto the bars: still over them.
    await user.hover(button("File"));
    expect(root()).toHaveAttribute("data-revealed");
    await user.hover(button("Play"));
    expect(root()).not.toHaveAttribute("data-revealed");
    expect(onRevealedChange).toHaveBeenLastCalledWith(false);
  });

  it("does not reveal the bars when the pointer is over a title bar that stays", async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.hover(button("Close"));
    expect(root()).not.toHaveAttribute("data-revealed");
  });

  it("reveals the menu bar when keyboard focus moves into it", async () => {
    const user = userEvent.setup();
    const onRevealedChange = vi.fn();
    render(<Example onRevealedChange={onRevealedChange} />);
    await user.tab();
    expect(button("File")).toHaveFocus();
    expect(root()).toHaveAttribute("data-revealed");
    // The title bar is always on screen here: focus in it calls for nothing.
    await user.tab();
    expect(button("Close")).toHaveFocus();
    expect(root()).not.toHaveAttribute("data-revealed");
    expect(onRevealedChange.mock.calls.map(([value]) => value)).toEqual([true, false]);
  });

  it("reveals a title bar that hides when keyboard focus moves into it", async () => {
    const user = userEvent.setup();
    render(<Example autoHideToolbar />);
    expect(root()).toHaveAttribute("data-auto-hide-toolbar");
    await user.tab();
    expect(root()).toHaveAttribute("data-revealed");
    await user.tab();
    expect(button("Close")).toHaveFocus();
    expect(root()).toHaveAttribute("data-revealed");
    await user.tab();
    expect(button("Play")).toHaveFocus();
    expect(root()).not.toHaveAttribute("data-revealed");
    await user.tab({ shift: true });
    expect(root()).toHaveAttribute("data-revealed");
  });

  it("keeps the bars down while focus is inside, wherever the pointer goes", async () => {
    const user = userEvent.setup();
    render(<Example autoHideToolbar />);
    await user.hover(part("edge"));
    await user.click(button("Close"));
    await user.hover(button("Play"));
    expect(root()).toHaveAttribute("data-revealed");
    await user.click(button("Play"));
    expect(root()).not.toHaveAttribute("data-revealed");
  });

  it("starts revealed with defaultRevealed", async () => {
    const user = userEvent.setup();
    render(<Example defaultRevealed />);
    expect(root()).toHaveAttribute("data-revealed");
    await user.hover(part("edge"));
    await user.hover(button("Play"));
    expect(root()).not.toHaveAttribute("data-revealed");
  });

  it("leaves a controlled reveal to its owner", async () => {
    const user = userEvent.setup();
    const onRevealedChange = vi.fn();
    render(<Example revealed={false} onRevealedChange={onRevealedChange} />);
    await user.hover(part("edge"));
    expect(onRevealedChange).toHaveBeenCalledWith(true);
    expect(root()).not.toHaveAttribute("data-revealed");
  });

  it("follows a controlled reveal", async () => {
    const user = userEvent.setup();
    function Controlled() {
      const [revealed, setRevealed] = useState(true);
      return <Example revealed={revealed} onRevealedChange={setRevealed} />;
    }
    render(<Controlled />);
    expect(root()).toHaveAttribute("data-revealed");
    await user.hover(part("edge"));
    await user.hover(button("Outside"));
    expect(root()).not.toHaveAttribute("data-revealed");
    await user.hover(part("edge"));
    expect(root()).toHaveAttribute("data-revealed");
  });

  it("is an ordinary window outside full screen", async () => {
    const user = userEvent.setup();
    const onRevealedChange = vi.fn();
    render(<Example fullScreen={false} autoHideToolbar onRevealedChange={onRevealedChange} />);
    expect(root()).not.toHaveAttribute("data-full-screen");
    expect(root()).toHaveClass("mac-window");
    expect(screen.queryByTestId("menu-bar")).toBeNull();
    expect(root().querySelector(".mac-full-screen-window-edge")).toBeNull();
    expect(button("Close")).toBeVisible();
    await user.tab();
    expect(button("Close")).toHaveFocus();
    await user.hover(button("Close"));
    expect(root()).not.toHaveAttribute("data-revealed");
    expect(onRevealedChange).not.toHaveBeenCalled();
  });

  it("enters and leaves full screen without remounting its content", () => {
    const { rerender } = render(<Example fullScreen={false} />);
    const play = button("Play");
    rerender(<Example />);
    expect(root()).toHaveAttribute("data-full-screen");
    expect(screen.getByTestId("menu-bar")).toBeInTheDocument();
    expect(button("Play")).toBe(play);
  });

  it("renders another root inside a window that is already there", async () => {
    const user = userEvent.setup();
    render(
      <Window fullScreen>
        <Example render={<div />} />
      </Window>,
    );
    // One window, named by the title bar inside the full-screen container.
    expect(screen.getByRole("region", { name: "Albums" })).toContainElement(root());
    expect(root()).not.toHaveClass("mac-window");
    expect(root()).not.toHaveAttribute("role");
    expect(root()).toHaveClass("mac-full-screen-window");
    expect(root()).toHaveAttribute("data-full-screen");
    await user.hover(part("edge"));
    expect(root()).toHaveAttribute("data-revealed");
  });

  it("passes the window's props on", () => {
    render(<Example state="inactive" width={640} height={400} aria-label="Photos" />);
    expect(screen.getByRole("region", { name: "Photos" })).toBe(root());
    expect(root()).toHaveAttribute("data-window-state", "inactive");
    expect(root()).toHaveStyle({ width: "640px", height: "400px" });
  });

  it("renders without a menu bar or a title bar", async () => {
    const user = userEvent.setup();
    render(
      <FullScreenWindow data-testid="root" aria-label="Bare">
        content
      </FullScreenWindow>,
    );
    expect(root()).toHaveTextContent("content");
    expect(root().querySelector(".mac-full-screen-window-menu-bar")).toBeNull();
    await user.hover(part("edge"));
    expect(root()).toHaveAttribute("data-revealed");
  });

  it("forwards ref, className, style and other attributes", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <FullScreenWindow
        ref={ref}
        className="viewer"
        style={{ height: 300 }}
        id="viewer"
        aria-label="Viewer"
      />,
    );
    expect(ref.current).toHaveClass("mac-full-screen-window", "viewer");
    expect(ref.current).toHaveStyle({ height: "300px" });
    expect(ref.current).toHaveAttribute("id", "viewer");
    expect(ref.current).toBe(screen.getByRole("region", { name: "Viewer" }));
  });
});
