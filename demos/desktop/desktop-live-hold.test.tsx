import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ManagedWindowRenderProps } from "macalicious/managed-window";
import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CatalinaDesktop } from "./desktop";
import type { DesktopApp } from "./desktop-apps";

/*
 * The person's live stream on the desktop served by Ferrite (`desktop-live.ts`: notifications, Do Not Disturb, other
 * browsers' changes) is one connection for as long as the desktop shows. The menu bar is made afresh for each front
 * application (desktop.tsx, `key={front.id}`); were the notification banners in its status menus the stream's only
 * holder, every change of application would release it, close the stream and open another with a new ticket, and the
 * browser would report the closed one as an aborted request of /live/me.
 */

/** Stands in for the browser's `EventSource`. */
class FakeEventSource {
  static all: FakeEventSource[] = [];
  closed = false;
  constructor(readonly url: string) {
    FakeEventSource.all.push(this);
  }
  addEventListener() {}
  close() {
    this.closed = true;
  }
}

function double(name: string): DesktopApp {
  const id = name.toLowerCase();
  function Double({
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
    return (
      <Window {...windowProps}>
        <TitleBar
          title={name}
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
          <button type="button">{name} button</button>
        </WindowBody>
      </Window>
    );
  }
  return {
    id,
    name,
    component: Double,
    defaultSize: { width: 400, height: 300 },
    minSize: { width: 200, height: 120 },
    menus: [name, "File", "Edit", "View", "Window", "Help"],
  };
}

/** The menu bar's titles after the Apple menu: the front application's name first. */
const menuTitles = () =>
  Array.from(
    document.querySelectorAll(
      ".mac-desktop-shell-menu-bar [role='menubar']:first-of-type > [role='menuitem']",
    ),
  )
    .map((item) => item.getAttribute("aria-label") ?? item.textContent ?? "")
    .slice(1);

beforeEach(() => {
  FakeEventSource.all = [];
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  // The served desktop's server: the stream's ticket, and nothing else it asks for.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url).startsWith("/api/session/ticket")
        ? new Response(JSON.stringify({ ticket: "a".repeat(64), tag: "mine" }), { status: 201 })
        : new Response(JSON.stringify({ error: "not found" }), { status: 404 }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the person's live stream on the served desktop", () => {
  it("stays one connection while the front application changes, and closes when the desktop goes", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const view = render(
      <CatalinaDesktop apps={[double("Alpha"), double("Beta")]} defaultOpen={["alpha", "beta"]} />,
    );
    await waitFor(() => expect(FakeEventSource.all.length).toBeGreaterThan(0));
    const first = FakeEventSource.all[0];
    // Each click makes another application front, and the menu bar is made afresh for it.
    for (const name of ["Alpha", "Beta", "Alpha"]) {
      await user.click(screen.getByRole("button", { name: `${name} button` }));
      await waitFor(() => expect(menuTitles()[0]).toBe(name));
    }
    // A new connection would ask for its ticket first: it is given the time to.
    await new Promise((done) => setTimeout(done, 200));
    expect(FakeEventSource.all).toEqual([first]);
    expect(first?.closed).toBe(false);
    view.unmount();
    expect(first?.closed).toBe(true);
  });
});
