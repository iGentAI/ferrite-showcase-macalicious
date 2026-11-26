import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickTimeTrimBar } from "./quicktime-player-trim";

const bar = () => {
  const onTrim = vi.fn();
  const onCancel = vi.fn();
  render(
    <QuickTimeTrimBar
      length={10}
      start={0}
      end={10}
      onChange={() => {}}
      onTrim={onTrim}
      onCancel={onCancel}
    />,
  );
  return { onTrim, onCancel };
};

describe("the trim bar's keys", () => {
  it("leaves Return on Cancel to the button, and does not trim", () => {
    const { onTrim } = bar();
    const notCancelled = fireEvent.keyDown(screen.getByRole("button", { name: "Cancel" }), {
      key: "Enter",
    });
    expect(notCancelled).toBe(true);
    expect(onTrim).not.toHaveBeenCalled();
  });

  it("trims on Return on a handle", () => {
    const { onTrim } = bar();
    fireEvent.keyDown(screen.getByRole("slider", { name: "Trim end" }), { key: "Enter" });
    expect(onTrim).toHaveBeenCalledOnce();
  });

  it("cancels on Escape", () => {
    const { onCancel } = bar();
    fireEvent.keyDown(screen.getByRole("button", { name: "Cancel" }), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
