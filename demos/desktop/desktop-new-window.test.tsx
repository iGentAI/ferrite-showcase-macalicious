import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { CatalinaDesktop } from "./desktop";
import type { DesktopApp } from "./desktop-apps";

/*
 * Finder's File > New Finder Window: another Finder window, managed like the first, whose folder is its own; and the size
 * an application that sizes itself asks for, asked again only when what it shows changes.
 */

const MENUS = ["Finder", "File", "Edit", "View", "Go", "Window", "Help"];

/** A Finder stand-in whose folder is its own state, as Finder's is (finder.tsx's reducer). */
function FinderDouble({
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  ...windowProps
}: ManagedWindowRenderProps) {
  const [folder, setFolder] = useState("Recents");
  return (
    <Window {...windowProps}>
      <TitleBar
        title={folder}
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />
      <WindowBody>
        <button type="button" onClick={() => setFolder("Documents")}>
          Go to Documents
        </button>
        <p>Showing {folder}</p>
      </WindowBody>
    </Window>
  );
}

const finder = {
  id: "finder",
  name: "Finder",
  component: FinderDouble,
  defaultSize: { width: 480, height: 320 },
  menus: MENUS,
} as DesktopApp;

const frames = () =>
  [...document.querySelectorAll(".mac-managed-window")].map((frame) =>
    frame.getAttribute("data-window-id"),
  );

describe("New Finder Window", () => {
  it("opens another Finder window from the File menu, its folder its own", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<CatalinaDesktop apps={[finder]} defaultOpen={["finder"]} />);
    await waitFor(() => expect(frames()).toEqual(["finder"]));
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "New Finder Window" }));
    await waitFor(() => expect(frames()).toEqual(["finder", "finder:2"]));
    // The first window goes to Documents; the second stays where it opened.
    const [first, second] = [...document.querySelectorAll(".mac-managed-window")];
    await user.click(
      (first as HTMLElement).querySelector("button[type=button]:not([aria-label])") as HTMLElement,
    );
    expect(first).toHaveTextContent("Showing Documents");
    expect(second).toHaveTextContent("Showing Recents");
  });

  it("opens another from the keyboard while Finder is in front (Command-N is Control-N off Apple platforms)", async () => {
    render(<CatalinaDesktop apps={[finder]} defaultOpen={["finder"]} />);
    await waitFor(() => expect(frames()).toEqual(["finder"]));
    const body = screen.getByText("Showing Recents");
    fireEvent.keyDown(body, { key: "n", code: "KeyN", ctrlKey: true });
    await waitFor(() => expect(frames()).toEqual(["finder", "finder:2"]));
    fireEvent.keyDown(body, { key: "n", code: "KeyN", ctrlKey: true });
    await waitFor(() => expect(frames()).toEqual(["finder", "finder:2", "finder:3"]));
  });

  it("is not in another application's File menu, whose Control-N is left alone", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const other = { ...finder, id: "alpha", name: "Alpha" } as DesktopApp;
    render(<CatalinaDesktop apps={[other]} defaultOpen={["alpha"]} />);
    await waitFor(() => expect(frames()).toEqual(["alpha"]));
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await screen.findByRole("menuitem", { name: "Close Window" });
    expect(screen.queryByRole("menuitem", { name: "New Finder Window" })).toBeNull();
    fireEvent.keyDown(screen.getByText("Showing Recents"), {
      key: "n",
      code: "KeyN",
      ctrlKey: true,
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(frames()).toEqual(["alpha"]);
  });
});

describe("an application that sizes itself", () => {
  it("is given the same size callback on every render, so it asks for its size once, not after each render", async () => {
    let asked = 0;
    function Sizing(
      props: ManagedWindowRenderProps & {
        onFrameSizeChange?: (size: { width: number; height: number }) => void;
      },
    ) {
      const { onFrameSizeChange, ...rest } = props;
      useEffect(() => {
        asked += 1;
        onFrameSizeChange?.({ width: 400, height: 300 });
      }, [onFrameSizeChange]);
      return <FinderDouble {...rest} />;
    }
    const sizing = {
      ...finder,
      id: "sizing",
      name: "Sizing",
      component: Sizing,
      sizesItself: true,
    } as DesktopApp;
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<CatalinaDesktop apps={[sizing]} defaultOpen={["sizing"]} />);
    await waitFor(() => expect(frames()).toEqual(["sizing"]));
    // Renders of the desktop: a menu opened and closed, the window's own state changed.
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Go to Documents" }));
    expect(asked).toBe(1);
  });
});
