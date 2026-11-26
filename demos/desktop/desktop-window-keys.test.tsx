import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useWindowKeys } from "./desktop-window-keys";

function Standalone({ isKey, run }: { isKey: boolean; run: () => void }) {
  const [within, setWithin] = useState<Element | null>(null);
  useWindowKeys(within, isKey, [{ equivalent: "command+e", run }]);
  return (
    <div data-window-state={isKey ? "key" : "inactive"}>
      <button ref={setWithin} type="button">
        In the window
      </button>
    </div>
  );
}

describe("useWindowKeys in a window on a page", () => {
  it("runs the command when the window is key and takes the key", () => {
    const run = vi.fn();
    const { getByRole } = render(<Standalone isKey run={run} />);
    const taken = !fireEvent.keyDown(getByRole("button"), { key: "e", ctrlKey: true });
    expect(run).toHaveBeenCalledTimes(1);
    expect(taken).toBe(true);
  });

  it("leaves the key alone when the window is not key", () => {
    const run = vi.fn();
    const { getByRole } = render(<Standalone isKey={false} run={run} />);
    const taken = !fireEvent.keyDown(getByRole("button"), { key: "e", ctrlKey: true });
    expect(run).not.toHaveBeenCalled();
    expect(taken).toBe(false);
  });
});
