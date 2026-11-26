import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HelpViewer } from "./help-viewer";
import { pagePicture } from "./help-viewer-pictures";

describe("Help Viewer's pictures", () => {
  it("shows this desktop on the welcome page, not a placeholder", () => {
    render(<HelpViewer />);
    const page = screen.getByRole("article");
    const picture = within(page).getByRole("img", {
      name: "This desktop, with Finder and Notes open.",
    }) as HTMLImageElement;
    expect(picture.src).toMatch(/desktop\.webp/);
  });

  it("gives a guide's page and its first topic the application's picture, and no others", () => {
    expect(pagePicture("guide:notes")?.url).toMatch(/notes\.webp/);
    expect(pagePicture("guide:notes:1")?.alt).toBe(
      "Notes on this desktop, with a note about a trip open.",
    );
    expect(pagePicture("guide:notes:2")).toBeUndefined();
    expect(pagePicture("guide:system-preferences:1")?.url).toMatch(/system-preferences\.webp/);
    expect(pagePicture("guide:chess")).toBeUndefined();
    expect(pagePicture("organize-your-work-in-folders")?.url).toMatch(/finder\.webp/);
  });
});
