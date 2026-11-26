import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearCopiedDriveItems,
  copiedDriveItems,
  copyDriveItems,
  useCopiedDriveItems,
} from "./desktop-clipboard";
import type { DesktopDragItem } from "./desktop-drag";
import { copyText } from "./desktop-share-link";

const A: DesktopDragItem = { id: "a", name: "a.png", kind: "file" };
const B: DesktopDragItem = { id: "b", name: "Plans", kind: "folder" };

afterEach(() => {
  clearCopiedDriveItems();
  vi.restoreAllMocks();
});

describe("the desktop's clipboard of drive items", () => {
  it("holds what was copied, the newest copy in place of the one before", () => {
    copyDriveItems([A]);
    expect(copiedDriveItems()).toEqual([A]);
    copyDriveItems([A, B]);
    expect(copiedDriveItems()).toEqual([A, B]);
  });

  it("writes nothing to the system clipboard", () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    copyDriveItems([A]);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("is what every window sees, at once", () => {
    const first = renderHook(() => useCopiedDriveItems());
    const second = renderHook(() => useCopiedDriveItems());
    act(() => copyDriveItems([A]));
    expect(first.result.current).toEqual([A]);
    expect(second.result.current).toEqual([A]);
    act(() => clearCopiedDriveItems());
    expect(first.result.current).toEqual([]);
  });

  it("lets go of the items when anything else is copied or cut in the page", () => {
    for (const kind of ["copy", "cut"]) {
      copyDriveItems([A]);
      document.body.dispatchEvent(new Event(kind, { bubbles: true }));
      expect(copiedDriveItems()).toEqual([]);
    }
  });

  it("lets go of the items when the page copies text through copyText", async () => {
    copyDriveItems([A]);
    await copyText("https://example.com/");
    expect(copiedDriveItems()).toEqual([]);
  });
});
