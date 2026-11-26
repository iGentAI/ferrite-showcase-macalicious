import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ItemIcon } from "./finder-artwork";
import { itemInfo } from "./finder-views";

describe("View Options of the icon view", () => {
  const picture = {
    name: "Beach.png",
    kind: "image" as const,
    dimensions: "2560×1920",
    size: 2048,
  };

  it("shows a picture as itself, or as a document without Show icon preview", () => {
    const { container, rerender } = render(<ItemIcon node={picture} size={64} />);
    expect(container.querySelector("svg")).toBeNull();
    rerender(<ItemIcon node={picture} size={64} preview={false} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("says what a folder holds, a picture's size in pixels, and a file's in bytes", () => {
    const folder = {
      name: "Work",
      kind: "folder" as const,
      children: [
        { name: "a", kind: "file" as const },
        { name: "b", kind: "file" as const },
        { name: ".c", kind: "file" as const, hidden: true },
      ],
    };
    expect(itemInfo(folder)).toBe("2 items");
    expect(itemInfo({ ...folder, children: [{ name: "a", kind: "file" as const }] })).toBe(
      "1 item",
    );
    expect(itemInfo(picture)).toBe("2560 × 1920");
    expect(itemInfo({ name: "n.txt", kind: "file" as const, size: 5 })).toBe("5 bytes");
    expect(itemInfo({ name: "n.txt", kind: "file" as const })).toBeUndefined();
  });
});
