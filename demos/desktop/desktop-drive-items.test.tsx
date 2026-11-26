import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriveItemIcon } from "./desktop-drive-items";

const readFile = vi.hoisted(() => vi.fn());
vi.mock("./desktop-files", async (original) => ({
  ...(await original<typeof import("./desktop-files")>()),
  readFile,
}));

const picture = (modified: string) =>
  ({ id: "f1", name: "Dot.png", kind: "image", size: 10, modified }) as Parameters<
    typeof DriveItemIcon
  >[0]["node"];

describe("an item's preview on the desktop", () => {
  beforeEach(() => {
    let made = 0;
    URL.createObjectURL = vi.fn(() => `blob:read-${++made}`);
    URL.revokeObjectURL = vi.fn();
    readFile.mockReset();
    readFile.mockImplementation(async () => new Blob(["x"], { type: "image/png" }));
  });

  it("reads the file again when it was saved over, and gives the old address back", async () => {
    const { container, rerender } = render(
      <DriveItemIcon node={picture("2026-10-10 09:00")} size={64} preview />,
    );
    await waitFor(() =>
      expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:read-1"),
    );
    rerender(<DriveItemIcon node={picture("2026-10-10 09:00")} size={64} preview />);
    expect(readFile).toHaveBeenCalledTimes(1);
    rerender(<DriveItemIcon node={picture("2026-10-10 09:05")} size={64} preview />);
    await waitFor(() =>
      expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:read-2"),
    );
    expect(readFile).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:read-1");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
