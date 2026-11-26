import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AUDIO_UNAVAILABLE, Messages } from "./messages";

// Audio messages are not part of this Messages: Record audio stays dimmed, stays reachable by
// the keyboard, and says why.

describe("Record audio", () => {
  it("is unavailable and says why", () => {
    render(<Messages />);
    const button = screen.getByRole("button", { name: "Record audio" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("title")).toBe(AUDIO_UNAVAILABLE);
  });
});
