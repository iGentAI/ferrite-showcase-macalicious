import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MiniPlayer } from "./music-mini-player";

const props = {
  origin: { left: 100, top: 50 },
  playing: false,
  elapsed: 0,
  duration: 0,
  hasSong: false,
  onToggle: () => {},
  onPrevious: () => {},
  onNext: () => {},
  onSeek: () => {},
  onClose: () => {},
};

/** Press the MiniPlayer's bar outside its controls and move the pointer 40 by 30 points. */
function dragBar() {
  const bar = screen.getByRole("toolbar", { name: "MiniPlayer controls" });
  Element.prototype.setPointerCapture ??= () => {};
  fireEvent.pointerDown(bar, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
  fireEvent.pointerMove(bar, { clientX: 50, clientY: 40, pointerId: 1 });
  fireEvent.pointerUp(bar, { pointerId: 1 });
  return screen.getByRole("region", { name: "MiniPlayer" });
}

describe("Music's MiniPlayer", () => {
  it("moves by its bar, after the host's own press handler has heard the press", () => {
    const raised = vi.fn();
    render(<MiniPlayer {...props} onPointerDown={raised} />);
    const window = dragBar();
    expect(raised).toHaveBeenCalledTimes(1);
    expect(window.style.left).toBe("140px");
    expect(window.style.top).toBe("80px");
  });

  it("stays put when the host cancels the press", () => {
    render(<MiniPlayer {...props} onPointerDown={(event) => event.preventDefault()} />);
    const window = dragBar();
    expect(window.style.left).toBe("100px");
    expect(window.style.top).toBe("50px");
  });

  it("gives the host every move, release and cancel, and holds still for a cancelled move", () => {
    const moved = vi.fn();
    const released = vi.fn();
    const cancelled = vi.fn();
    const { unmount } = render(
      <MiniPlayer
        {...props}
        onPointerMove={moved}
        onPointerUp={released}
        onPointerCancel={cancelled}
      />,
    );
    const window = dragBar();
    expect(moved).toHaveBeenCalledTimes(1);
    expect(released).toHaveBeenCalledTimes(1);
    expect(window.style.left).toBe("140px");
    fireEvent.pointerCancel(window, { pointerId: 1 });
    expect(cancelled).toHaveBeenCalledTimes(1);
    unmount();

    // A host that cancels the move keeps the MiniPlayer in place.
    render(<MiniPlayer {...props} onPointerMove={(event) => event.preventDefault()} />);
    const held = dragBar();
    expect(held.style.left).toBe("100px");
    expect(held.style.top).toBe("50px");
  });
});
