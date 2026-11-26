import { act, fireEvent, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { describe, expect, it } from "vitest";
import { WindowBody } from "../window";
import { useWindowManager, WindowManager, type WindowManagerApi } from "../window-manager";
import { ManagedWindow } from "./index";

// A window renders some of what it shows elsewhere on the page through a portal: an application's further window (the
// desktop renders Calculator's Paper Tape into the window manager from inside Calculator), or a popup. React hands the
// window's frame the events of those elements too; only the frame's own may raise it, or bring it back from the Dock.

let manager: WindowManagerApi;

function Probe() {
  manager = useWindowManager();
  return null;
}

function Host() {
  return (
    <ManagedWindow id="host" title="host">
      <WindowBody>
        <button type="button">host button</button>
        {createPortal(<button type="button">portalled</button>, document.body)}
      </WindowBody>
    </ManagedWindow>
  );
}

function Desktop() {
  return (
    <WindowManager>
      <Probe />
      <Host />
      <ManagedWindow id="other" title="other">
        <WindowBody>
          <button type="button">other button</button>
        </WindowBody>
      </ManagedWindow>
    </WindowManager>
  );
}

const shellOf = (id: string) => document.querySelector(`[data-window-id="${id}"]`) as HTMLElement;
const info = (id: string) => manager.windows.find((window) => window.id === id);

describe("ManagedWindow and what it renders through a portal", () => {
  it("stays in the Dock when the focus moves into an element it portals out of its frame", () => {
    render(<Desktop />);
    act(() => manager.minimize("host"));
    expect(shellOf("host")).toHaveAttribute("data-minimized");
    act(() => screen.getByRole("button", { name: "portalled" }).focus());
    expect(shellOf("host")).toHaveAttribute("data-minimized");
    expect(info("host")?.minimized).toBe(true);
  });

  it("stays in the Dock, and behind, after a press in an element it portals out of its frame", () => {
    render(<Desktop />);
    act(() => manager.minimize("host"));
    fireEvent.pointerDown(screen.getByRole("button", { name: "portalled" }));
    expect(info("host")?.minimized).toBe(true);
    act(() => manager.focus("host"));
    act(() => manager.focus("other"));
    fireEvent.pointerDown(screen.getByRole("button", { name: "portalled" }));
    expect(manager.windows.at(-1)?.id).toBe("other");
  });

  it("is still raised, and brought back, by focus or a press in its own frame", () => {
    render(<Desktop />);
    act(() => manager.focus("other"));
    fireEvent.pointerDown(screen.getByRole("button", { name: "host button" }));
    expect(manager.windows.at(-1)?.id).toBe("host");
    act(() => manager.minimize("host"));
    act(() => screen.getByRole("button", { name: "host button" }).focus());
    expect(info("host")?.minimized).toBe(false);
  });
});
