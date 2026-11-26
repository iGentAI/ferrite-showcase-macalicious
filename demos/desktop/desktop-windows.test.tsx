import { act, render, screen, waitFor } from "@testing-library/react";
import { ManagedWindow } from "macalicious/managed-window";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { useWindowManager, WindowManager } from "macalicious/window-manager";
import { useEffect, useState } from "react";
import { describe, expect, it } from "vitest";
import { DesktopSecondaryWindow, DesktopWindowHostContext } from "./desktop-windows";

/**
 * A further window of an application, as the desktop hosts it: a close from the desktop (the
 * window's button, File > Close Window, Command-W) only asks the application, which closes the
 * window by no longer rendering it, and may keep it open.
 */
describe("a further window of an application", () => {
  function Hosted({ keep }: { keep: boolean }) {
    // Opened once the page is there, as an application opens one: the stage is then in place.
    const [open, setOpen] = useState(false);
    useEffect(() => setOpen(true), []);
    const [asked, setAsked] = useState(0);
    const manager = useWindowManager();
    return (
      <>
        <output aria-label="Close requests">{asked}</output>
        <button type="button" onClick={() => manager.close("mail:compose-1")}>
          Close Window
        </button>
        {open ? (
          <DesktopSecondaryWindow
            id="compose-1"
            title="New Message"
            defaultSize={{ width: 300, height: 200 }}
            onClose={() => {
              setAsked((count) => count + 1);
              if (!keep) setOpen(false);
            }}
            render={(props) => (
              <Window aria-label="New Message" width={300} height={200}>
                <WindowControls onClose={props.onClose} />
                <WindowBody>Text</WindowBody>
              </Window>
            )}
          />
        ) : null}
      </>
    );
  }

  const desktop = (keep: boolean) =>
    render(
      <WindowManager style={{ height: 500 }}>
        <DesktopWindowHostContext
          value={{
            app: "mail",
            stage: () => document.querySelector(".mac-window-manager"),
            place: () => ({ x: 40, y: 40 }),
          }}
        >
          <Hosted keep={keep} />
        </DesktopWindowHostContext>
      </WindowManager>,
    );

  it("stays in front when it opens from a menu in the window that asked for it", async () => {
    function Opener() {
      const [opened, setOpened] = useState(false);
      const [menu, setMenu] = useState(true);
      return (
        <>
          <ManagedWindow
            id="finder"
            title="Finder"
            defaultFrame={{ x: 0, y: 0, width: 300, height: 200 }}
            render={() => (
              <Window aria-label="Finder" width={300} height={200}>
                <button type="button" onClick={() => setOpened(true)}>
                  Get Info
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    act(() =>
                      screen
                        .getByRole("button", { name: "Get Info" })
                        .focus({ preventScroll: true }),
                    );
                  }}
                >
                  Menu closes
                </button>
              </Window>
            )}
          />
          {menu ? <div role="menu" /> : null}
          {opened ? (
            <DesktopSecondaryWindow
              id="info"
              title="Info"
              defaultSize={{ width: 200, height: 200 }}
              onClose={() => setOpened(false)}
              render={() => (
                <Window aria-label="Info" width={200} height={200}>
                  <WindowBody>About</WindowBody>
                </Window>
              )}
            />
          ) : null}
        </>
      );
    }
    render(
      <WindowManager style={{ height: 500 }}>
        <DesktopWindowHostContext
          value={{
            app: "finder",
            stage: () => document.querySelector(".mac-window-manager"),
            place: () => ({ x: 40, y: 40 }),
          }}
        >
          <Opener />
        </DesktopWindowHostContext>
      </WindowManager>,
    );
    const z = (id: string) =>
      Number((document.querySelector(`[data-window-id="${id}"]`) as HTMLElement).style.zIndex);
    act(() => screen.getByRole("button", { name: "Get Info" }).click());
    await screen.findByRole("region", { name: "Info" });
    act(() => screen.getByRole("button", { name: "Menu closes" }).click());
    expect(z("finder")).toBeGreaterThan(z("finder:info"));
    await waitFor(() => expect(z("finder:info")).toBeGreaterThan(z("finder")));
  });

  it("stays open when its application keeps it, whichever close asked", async () => {
    desktop(true);
    expect(await screen.findByRole("region", { name: "New Message" })).toBeTruthy();
    act(() => screen.getByRole("button", { name: "Close" }).click());
    act(() => screen.getByRole("button", { name: "Close Window" }).click());
    expect(screen.getByRole("status", { name: "Close requests" })).toHaveTextContent("2");
    expect(screen.getByRole("region", { name: "New Message" })).toBeTruthy();
  });

  it("goes when its application stops rendering it", async () => {
    desktop(false);
    expect(await screen.findByRole("region", { name: "New Message" })).toBeTruthy();
    act(() => screen.getByRole("button", { name: "Close Window" }).click());
    expect(screen.getByRole("status", { name: "Close requests" })).toHaveTextContent("1");
    expect(screen.queryByRole("region", { name: "New Message" })).toBeNull();
  });
});
