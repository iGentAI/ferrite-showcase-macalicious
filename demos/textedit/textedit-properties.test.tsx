import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ManagedWindow } from "macalicious/managed-window";
import { useWindowManager, useWindowManagerStore, WindowManager } from "macalicious/window-manager";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { TextEdit, type TextEditActions } from "./textedit";
import { hideProperties } from "./textedit-properties";

afterEach(() => {
  act(() => hideProperties());
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const DRIVE = {
  rev: 1,
  entries: [],
  usage: 0,
  quota: 1_000_000,
  piece_bytes: 1 << 20,
  max_file_bytes: 1 << 24,
  max_entries: 100,
  session: "s",
};

/** The drive and the draft as a fresh desktop answers them: a stand-in for the server. */
function serve() {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () =>
        String(input).startsWith("/api/files/")
          ? DRIVE
          : init?.method === "PUT"
            ? { rev: 1 }
            : { draft: null, rev: 0 },
    })),
  );
}

const windows: Record<string, { current: TextEditActions | null }> = {};
let manager: ReturnType<typeof useWindowManager>;
let store: ReturnType<typeof useWindowManagerStore>;
function Manager() {
  manager = useWindowManager();
  store = useWindowManagerStore();
  return null;
}

function Doc({ id }: { id: string }) {
  windows[id] ??= { current: null };
  return (
    <ManagedWindow
      id={id}
      app="textedit"
      title={id}
      defaultFrame={{ x: 0, y: 30, width: 624, height: 537 }}
      render={(props) => (
        <TextEdit
          {...props}
          actionsRef={(value) => {
            const held = windows[id];
            if (held) held.current = value;
          }}
        />
      )}
    />
  );
}

async function desk(ids: readonly string[]) {
  serve();
  render(
    <WindowManager style={{ height: 800 }}>
      <Manager />
      <DesktopWindowHostContext
        value={{
          app: "textedit",
          stage: () => document.querySelector(".mac-window-manager"),
          place: () => ({ x: 40, y: 40 }),
        }}
      >
        {ids.map((id) => (
          <Doc key={id} id={id} />
        ))}
      </DesktopWindowHostContext>
    </WindowManager>,
  );
  await waitFor(() => expect(windows[ids.at(-1) ?? ""]?.current?.file).toBeTruthy());
  await waitFor(() =>
    expect(document.querySelector(".mac-textedit-body:not([inert])")).not.toBeNull(),
  );
}

const panel = () => screen.findByRole("dialog", { name: "Document Properties" });

describe("File > Show Properties", () => {
  it("is a panel window that leaves the document open to work in, and keeps what is typed", async () => {
    const user = userEvent.setup();
    await desk(["textedit"]);
    act(() => windows.textedit?.current?.file?.showProperties());
    const shown = await panel();
    expect(shown.closest("[data-window-id]")).toHaveAttribute(
      "data-window-id",
      "textedit:properties-textedit",
    );
    expect(manager.windows.find((each) => each.id === "textedit")?.state).toBe("main");
    expect(within(shown).queryByRole("button", { name: "OK" })).toBeNull();
    expect(document.querySelector(".mac-textedit-body")).not.toHaveAttribute("inert");

    await user.type(within(shown).getByLabelText("Author:"), "Ada Lovelace");
    act(() => windows.textedit?.current?.file?.showProperties());
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    act(() => windows.textedit?.current?.file?.showProperties());
    expect(within(await panel()).getByLabelText("Author:")).toHaveValue("Ada Lovelace");
  });

  it("goes over to the window brought to the front, which keeps the keyboard", async () => {
    const user = userEvent.setup();
    await desk(["one", "two"]);
    act(() => windows.two?.current?.file?.showProperties());
    await user.type(within(await panel()).getByLabelText("Author:"), "Second");
    const moved = { x: 300, y: 200, width: 380, height: 240 };
    act(() => store.patch("textedit:properties-two", { frame: moved }));

    act(() => manager.focus("one"));
    await waitFor(() =>
      expect(document.querySelector('[data-window-id="textedit:properties-one"]')).not.toBeNull(),
    );
    expect(within(await panel()).getByLabelText("Author:")).toHaveValue("");
    expect(manager.windows.find((each) => each.id === "one")?.state).toBe("key");
    expect(
      manager.windows.find((each) => each.id === "textedit:properties-one")?.frame,
    ).toMatchObject({ x: 300, y: 200 });

    act(() => manager.focus("two"));
    await waitFor(() =>
      expect(document.querySelector('[data-window-id="textedit:properties-two"]')).not.toBeNull(),
    );
    expect(within(await panel()).getByLabelText("Author:")).toHaveValue("Second");
    expect(screen.getAllByRole("dialog", { name: "Document Properties" })).toHaveLength(1);
  });
});
