import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ManagedWindow } from "macalicious/managed-window";
import { Menu, MenuPopup } from "macalicious/menu";
import {
  useWindowManagerStore,
  WindowManager,
  type WindowManagerStore,
} from "macalicious/window-manager";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import { useOutgoingFiles } from "./mail-attachment-views";
import { MAIL_SETTINGS, mailDownloadsFolder } from "./mail-saved";
import { MAIL_TABS, MailTabbedWindow, MailTabViewItems, MailTabWindowItems } from "./mail-tabs";

let store: WindowManagerStore | null = null;
function Store() {
  store = useWindowManagerStore();
  return null;
}

function Desk({
  ids,
  composeSlot = 1,
  onNewMessage = () => {},
}: {
  ids: readonly string[];
  composeSlot?: number | null;
  onNewMessage?: () => void;
}) {
  return (
    <WindowManager>
      <Store />
      {ids.map((id, at) => (
        <ManagedWindow
          key={id}
          id={id}
          app="mail"
          title={`Title ${id}`}
          defaultFrame={{ x: 10 * at, y: 30, width: 400, height: 300 }}
          render={({ state }) => (
            <MailTabbedWindow state={state} composeSlot={composeSlot} onNewMessage={onNewMessage}>
              {({ bar, rootProps }) => (
                <section aria-label={id} {...rootProps}>
                  {bar}
                </section>
              )}
            </MailTabbedWindow>
          )}
        />
      ))}
      <Menu open modal={false}>
        <MenuPopup>
          <MailTabViewItems />
          <MailTabWindowItems />
        </MenuPopup>
      </Menu>
    </WindowManager>
  );
}

const settle = () => act(async () => void (await Promise.resolve()));
const item = (name: string) => screen.getByRole("menuitem", { name, hidden: true });

afterEach(() => {
  changeDesktopValue(MAIL_TABS, undefined);
  changeDesktopValue(MAIL_SETTINGS, undefined);
  vi.unstubAllGlobals();
});

describe("Mail's windows as tabs", () => {
  it("dims the rows while no message or New Message window is key, and says why", async () => {
    render(<Desk ids={[]} />);
    await settle();
    const row = item("Show Tab Bar");
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row.getAttribute("title")).toMatch(/message viewer stays a window of its own/);
    expect(screen.queryByRole("menuitem", { name: "Merge All Windows", hidden: true })).toBeNull();
  });

  it("Merge All Windows joins a message and a New Message window on one frame", async () => {
    render(<Desk ids={["mail:compose-1", "mail:message-a"]} />);
    await settle();
    act(() => store?.focus("mail:message-a"));
    await settle();
    expect(screen.queryByRole("tablist", { hidden: true })).toBeNull();
    fireEvent.click(item("Merge All Windows"));
    await settle();
    expect(desktopValues()[MAIL_TABS]).toEqual({
      groups: [{ ids: ["mail:compose-1", "mail:message-a"], selected: "mail:message-a" }],
      bars: [],
    });
    expect(store?.get("mail:compose-1")?.frame).toEqual(store?.get("mail:message-a")?.frame);
    expect(
      [...document.querySelectorAll("[data-document-tab-hidden]")].map((each) =>
        each.getAttribute("aria-label"),
      ),
    ).toEqual(["mail:compose-1"]);

    fireEvent.click(item("Show All Tabs"));
    await waitFor(() =>
      expect(
        document.querySelectorAll('section[aria-label="All Tabs"] .mac-textedit-tabs-card'),
      ).toHaveLength(2),
    );
    expect(item("Exit Tab Overview")).toBeTruthy();
  });

  it("Show Tab Bar shows it on one window, and + asks for a New Message window that joins", async () => {
    const onNewMessage = vi.fn();
    const { rerender } = render(
      <Desk ids={["mail:message-a"]} composeSlot={null} onNewMessage={onNewMessage} />,
    );
    await settle();
    act(() => store?.focus("mail:message-a"));
    await settle();
    expect(screen.queryByRole("tablist", { hidden: true })).toBeNull();
    fireEvent.click(item("Show Tab Bar"));
    await settle();
    expect(screen.getByRole("tablist", { hidden: true })).toBeTruthy();
    expect(item("Hide Tab Bar")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /new tab/i, hidden: true }));
    expect(onNewMessage).toHaveBeenCalledTimes(1);
    rerender(
      <Desk
        ids={["mail:message-a", "mail:compose-1"]}
        composeSlot={1}
        onNewMessage={onNewMessage}
      />,
    );
    await settle();
    expect(desktopValues()[MAIL_TABS]).toMatchObject({
      groups: [{ ids: ["mail:message-a", "mail:compose-1"], selected: "mail:compose-1" }],
    });
    // The viewer has one New Message window, and it is here: nothing more for + to open.
    expect(screen.queryByRole("button", { name: /new tab/i, hidden: true })).toBeNull();
  });
});

describe("Markup of a picture a reopened draft holds", () => {
  const picture = { id: "file-1", name: "plan.png", type: "image/png", size: 3 };
  function Host() {
    const { attaching, begin, held } = useOutgoingFiles(false);
    // biome-ignore lint/correctness/useExhaustiveDependencies: as the window opens, once
    useEffect(() => {
      begin([picture], "draft-1");
      // Every save of a draft gives it a new id, and the first is gone.
      held([picture.id], "draft-2");
    }, []);
    return (
      <>
        {attaching.strip}
        {attaching.panel}
      </>
    );
  }

  it("reads its bytes through the draft as it is now, and opens the sheet on them", async () => {
    const fetched = vi.fn(async (_url: string) => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", fetched);
    URL.createObjectURL = vi.fn(() => "blob:picture");
    URL.revokeObjectURL = vi.fn();
    render(<Host />);
    fireEvent.click(await screen.findByRole("button", { name: "Markup" }));
    await screen.findByRole("dialog", { name: "Markup: plan.png" });
    expect(String(fetched.mock.calls[0]?.[0])).toContain(
      "/api/mail/messages/draft-2/attachments/file-1",
    );
    expect(fetched).toHaveBeenCalledTimes(1);
  });

  it("says so when they cannot be read, and sends nothing to the sheet", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 }));
    render(<Host />);
    fireEvent.click(await screen.findByRole("button", { name: "Markup" }));
    await waitFor(() => expect(screen.queryByText("Reading…")).toBeNull());
    expect(screen.queryByRole("dialog", { name: "Markup: plan.png" })).toBeNull();
  });
});

describe("Preferences > General > Downloads folder", () => {
  it("is Downloads until Desktop is chosen", () => {
    expect(mailDownloadsFolder()).toBe("Downloads");
    changeDesktopValue(MAIL_SETTINGS, { downloads: "Desktop" });
    expect(mailDownloadsFolder()).toBe("Desktop");
  });
});
