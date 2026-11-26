import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ManagedWindow } from "macalicious/managed-window";
import {
  useWindowManagerStore,
  WindowManager,
  type WindowManagerStore,
} from "macalicious/window-manager";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { type DesktopEffect, onDesktopEffects } from "../desktop/desktop-effects";
import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import { DESKTOP_QUIT_WINDOWS } from "../desktop/desktop-restore";
import { DocumentTabBar, DocumentTabOverview, useDocumentTabs } from "./textedit-tabs";
import {
  frameOfFile,
  keepFrameOfFile,
  keepWindow,
  readKeptWindow,
  takeWindowsToReopen,
  windowClosed,
} from "./textedit-windows";

const SETTING = "test.tabs";
const OPTIONS = { app: "doc", setting: SETTING };

let store: WindowManagerStore | null = null;
function Store() {
  store = useWindowManagerStore();
  return null;
}

function Doc({ id }: { id: string }) {
  const tabs = useDocumentTabs(OPTIONS);
  return (
    <section aria-label={id} {...tabs.rootProps}>
      <button type="button" aria-label="Close" onClick={() => store?.close(id)} />
      <DocumentTabBar tabs={tabs} />
      <DocumentTabOverview tabs={tabs} />
      <menu aria-label={`${id} menu`}>
        <DocumentTabViewItemsHost tabs={tabs} />
      </menu>
    </section>
  );
}

// The rows as commands: what the menus run, without opening a menu bar.
function DocumentTabViewItemsHost({ tabs }: { tabs: ReturnType<typeof useDocumentTabs> }) {
  return (
    <>
      <button type="button" onClick={tabs.mergeAll}>
        merge
      </button>
      <button type="button" onClick={tabs.moveToNewWindow}>
        move
      </button>
      <button type="button" onClick={() => tabs.step(1)}>
        next
      </button>
      <button type="button" onClick={tabs.newTab}>
        new
      </button>
      <button type="button" onClick={tabs.toggleBar}>
        bar
      </button>
      <button type="button" onClick={tabs.toggleOverview}>
        overview
      </button>
    </>
  );
}

function Desk({ ids }: { ids: readonly string[] }) {
  const [open, setOpen] = useState(ids);
  return (
    <WindowManager>
      <Store />
      {open.map((id, at) => (
        <ManagedWindow
          key={id}
          id={id}
          app="doc"
          title={`Title ${id}`}
          defaultFrame={{ x: 10 * at, y: 30, width: 400, height: 300 }}
          onOpenChange={(isOpen) => {
            if (!isOpen) setOpen((list) => list.filter((each) => each !== id));
          }}
          render={() => <Doc id={id} />}
        />
      ))}
    </WindowManager>
  );
}

const win = (id: string) =>
  within(document.querySelector(`section[aria-label="${id}"]`) as HTMLElement);
const press = (id: string, name: string) =>
  act(() => {
    fireEvent.click(win(id).getByRole("button", { name, hidden: true }));
  });
const hiddenTabs = () =>
  [...document.querySelectorAll("[data-document-tab-hidden]")].map((each) =>
    each.getAttribute("aria-label"),
  );
const settle = () => act(async () => void (await Promise.resolve()));

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  for (const key of [
    SETTING,
    "textedit.reopen",
    "textedit.frames",
    "textedit.windows",
    DESKTOP_QUIT_WINDOWS,
  ])
    changeDesktopValue(key, undefined);
});

describe("tabs of document windows", () => {
  it("Merge All Windows shows one window with a tab for each, on one frame", async () => {
    render(<Desk ids={["doc", "doc:2"]} />);
    await settle();
    expect(screen.queryByRole("tablist")).toBeNull();
    act(() => store?.focus("doc"));
    press("doc", "merge");
    await settle();
    expect(desktopValues()[SETTING]).toEqual({
      groups: [{ ids: ["doc", "doc:2"], selected: "doc" }],
      bars: [],
    });
    expect(hiddenTabs()).toEqual(["doc:2"]);
    expect(store?.get("doc:2")?.frame).toEqual(store?.get("doc")?.frame);
    expect(
      win("doc")
        .getAllByRole("tab")
        .map((tab) => tab.textContent),
    ).toEqual(["Title doc", "Title doc:2"]);
  });

  it("Show Next Tab brings the other to the front, and a moved window follows", async () => {
    render(<Desk ids={["doc", "doc:2"]} />);
    await settle();
    act(() => store?.focus("doc"));
    press("doc", "merge");
    await settle();
    press("doc", "next");
    await settle();
    expect(hiddenTabs()).toEqual(["doc"]);
    expect(store?.get("doc:2")?.state).toBe("key");

    act(() => store?.patch("doc:2", { frame: { x: 99, y: 88, width: 500, height: 400 } }));
    await settle();
    expect(store?.get("doc")?.frame).toEqual({ x: 99, y: 88, width: 500, height: 400 });
  });

  it("a tab asked for by the Window menu or the Dock is selected", async () => {
    render(<Desk ids={["doc", "doc:2"]} />);
    await settle();
    act(() => store?.focus("doc"));
    press("doc", "merge");
    await settle();
    act(() => store?.focus("doc:2"));
    await settle();
    expect(hiddenTabs()).toEqual(["doc"]);
  });

  it("keeps the selected tab in front though the desktop brings another back last", async () => {
    changeDesktopValue(SETTING, {
      groups: [{ ids: ["doc", "doc:2"], selected: "doc" }],
      bars: [],
    });
    render(<Desk ids={["doc", "doc:2"]} />);
    await settle();
    expect(hiddenTabs()).toEqual(["doc:2"]);
    expect(store?.get("doc")?.state).toBe("key");
  });

  it("Move Tab to New Window makes two windows, and closing a tab leaves a window", async () => {
    render(<Desk ids={["doc", "doc:2", "doc:3"]} />);
    await settle();
    act(() => store?.focus("doc"));
    press("doc", "merge");
    await settle();
    expect(hiddenTabs()).toEqual(["doc:2", "doc:3"]);
    const frame = store?.get("doc")?.frame;
    press("doc", "next");
    await settle();
    press("doc:2", "move");
    await settle();
    expect(store?.get("doc:2")?.frame.x).toBe((frame?.x ?? 0) + 24);
    expect(desktopValues()[SETTING]).toEqual({
      groups: [{ ids: ["doc", "doc:3"], selected: "doc:3" }],
      bars: [],
    });

    press("doc:3", "Close");
    await settle();
    await waitFor(() => expect(desktopValues()[SETTING]).toEqual({ groups: [], bars: [] }));
    expect(hiddenTabs()).toEqual([]);
  });

  it("Show Tab Bar shows it for one window, and + asks for a window that joins as a tab", async () => {
    const effects: DesktopEffect[] = [];
    stops.push(onDesktopEffects((more) => effects.push(...more)));
    render(<Desk ids={["doc"]} />);
    await settle();
    press("doc", "bar");
    expect(win("doc").getAllByRole("tab").length).toBe(1);
    fireEvent.click(win("doc").getByRole("button", { name: "New Tab" }));
    expect(effects).toEqual([{ newWindow: "doc" }]);
  });

  it("Show All Tabs lists every tab with a picture, and choosing one selects it", async () => {
    render(<Desk ids={["doc", "doc:2"]} />);
    await settle();
    act(() => store?.focus("doc"));
    await settle();
    act(() => store?.focus("doc"));
    press("doc", "merge");
    await settle();
    press("doc", "overview");
    const all = within(screen.getByRole("region", { name: "All Tabs" }));
    expect(document.querySelectorAll(".mac-textedit-tabs-picture section").length).toBe(2);
    fireEvent.click(all.getByRole("button", { name: "Title doc:2" }));
    await settle();
    expect(hiddenTabs()).toEqual(["doc"]);
    expect(screen.queryByRole("region", { name: "All Tabs" })).toBeNull();
  });
});

const body = (text: string) => ({
  draft: { name: "Untitled", format: "plain", lines: [text], edited: true },
});

describe("a further window as TextEdit ends", () => {
  const closing = { unsaved: true, asked: false, anyLeft: () => false };

  it("comes back with its frame when Close windows when quitting is off", () => {
    changeDesktopValue(DESKTOP_QUIT_WINDOWS, {
      textedit: [{ id: "textedit:2", app: "textedit", x: 40, y: 50, width: 600, height: 500 }],
    });
    windowClosed("textedit:2", { ...closing, unsaved: false, body: body("Mine") });
    expect(takeWindowsToReopen()).toEqual([
      { kind: "kept", body: body("Mine"), frame: { x: 40, y: 50, width: 600, height: 500 } },
    ]);
    expect(readKeptWindow("textedit:2")).toBeNull();
    expect(takeWindowsToReopen()).toEqual([]);
  });

  it("keeps text no file holds when nothing of TextEdit is left and no one was asked", async () => {
    windowClosed("textedit:2", { ...closing, body: body("Unsaved") });
    await Promise.resolve();
    expect(takeWindowsToReopen()).toEqual([{ kind: "kept", body: body("Unsaved") }]);
  });

  it("forgets it when another window stays, the person answered, or a file holds everything", async () => {
    for (const other of [{ anyLeft: () => true }, { asked: true }, { unsaved: false }]) {
      keepWindow("textedit:2", body("Earlier"));
      windowClosed("textedit:2", { ...closing, ...other, body: body("Gone") });
      await Promise.resolve();
      expect(readKeptWindow("textedit:2")).toBeNull();
      expect(takeWindowsToReopen()).toEqual([]);
    }
  });
});

describe("a frame kept with a file", () => {
  it("reads back the newest sixteen files' frames", () => {
    for (let at = 0; at < 18; at += 1) {
      keepFrameOfFile(`f${at}`, { x: at, y: at, width: 300, height: 200 });
    }
    expect(frameOfFile("f17")).toEqual({ x: 17, y: 17, width: 300, height: 200 });
    expect(frameOfFile("f2")).toEqual({ x: 2, y: 2, width: 300, height: 200 });
    expect(frameOfFile("f1")).toBeUndefined();
  });
});
