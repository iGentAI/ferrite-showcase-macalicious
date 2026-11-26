import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReceivedAttachment } from "./mail-attachment-views";
import { isAudio } from "./mail-attachments";

const LONG = 9 * 1024 * 1024;

vi.mock("./mail-attachments", async (original) => ({
  ...(await original<typeof import("./mail-attachments")>()),
  readAttachment: vi.fn(async () => new Blob(["sound"], { type: "audio/webm" })),
}));

afterEach(() => vi.restoreAllMocks());

describe("a recording among the attachments", () => {
  it.each(["audio/webm", "audio/webm;codecs=opus", "AUDIO/OGG; codecs=opus"])(
    "plays when it is %s",
    (type) => {
      expect(isAudio({ type })).toBe(true);
    },
  );

  it("does not take a document for a recording", () => {
    expect(isAudio({ type: "application/pdf" })).toBe(false);
    expect(isAudio({ type: "image/png" })).toBe(false);
  });

  it("reads a long recording only when Play is pressed, then gives its player", async () => {
    URL.createObjectURL = vi.fn(() => "blob:sound");
    URL.revokeObjectURL = vi.fn();
    const { container } = render(
      <ReceivedAttachment
        url="/x"
        attachment={{
          id: "a",
          name: "Audio Message.webm",
          type: "audio/webm;codecs=opus",
          size: LONG,
        }}
      />,
    );
    expect(container.querySelector("audio")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Play" }));
    await act(async () => {});
    expect(container.querySelector("audio")?.getAttribute("src")).toBe("blob:sound");
  });
});
