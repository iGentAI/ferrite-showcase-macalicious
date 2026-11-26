import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The served window's menus and call panel, on a stand-in server: `fetch` answers FaceTime's and
 * Contacts' routes from the test, and the browser's media devices refuse, so no camera is held and no
 * connection is made. The real calling path is `facetime-journey`'s.
 */
const recents = [
  {
    call: "c1",
    kind: "video",
    status: "outgoing",
    with: { name: "ada", full_name: "Ada Lovelace" },
    at_ms: 1_000,
    duration_ms: 0,
    done: true,
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function answer(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  if (url.endsWith("/api/facetime/me")) return json({ name: "chris", full_name: "Chris" });
  if (url.endsWith("/api/contacts/people")) {
    return json({ people: [{ user: "ada", full_name: "Ada Lovelace" }] });
  }
  if (url.endsWith("/api/facetime/calls") && init?.method === "POST") {
    const { page, kind } = JSON.parse(String(init.body)) as { page: string; kind: string };
    return json(
      {
        version: 1,
        state: {
          id: "call-1",
          kind,
          created_ms: 1,
          connected_ms: 0,
          ended_ms: 0,
          links: [],
          members: [
            {
              name: "chris",
              full_name: "Chris",
              state: "joined",
              seat: { n: 1, page },
              joined_ms: 1,
              left_ms: 0,
              me: true,
            },
            {
              name: "ada",
              full_name: "Ada Lovelace",
              state: "ringing",
              seat: null,
              joined_ms: 0,
              left_ms: 0,
              me: false,
            },
          ],
        },
      },
      201,
    );
  }
  if (url.endsWith("/api/facetime/calls")) return json({ recents, incoming: null, active: null });
  return json({ error: "not here" }, 404);
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  vi.stubGlobal("fetch", vi.fn(answer));
  document.execCommand = vi.fn(() => true);
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function show(props: Record<string, unknown> = {}) {
  const [{ FaceTimeLive }, { useDesktopAppMenuItems }, reach] = await Promise.all([
    import("./facetime-live"),
    import("../desktop/desktop-app-menus"),
    import("../desktop/desktop-reach"),
  ]);
  function MenuOf({ title }: { title: string }) {
    const items = useDesktopAppMenuItems("facetime", title);
    return (
      <Menu>
        <MenuTrigger>{title}</MenuTrigger>
        <MenuPopup aria-label={title}>{items}</MenuPopup>
      </Menu>
    );
  }
  await act(async () => {
    render(
      <>
        <FaceTimeLive {...(props as ComponentProps<typeof FaceTimeLive>)} />
        <MenuOf title="Edit" />
        <MenuOf title="Video" />
      </>,
    );
  });
  await screen.findByRole("treeitem", { name: /Ada Lovelace/ });
  return reach;
}

const menuRow = async (menu: string, name: string) => {
  fireEvent.click(screen.getByRole("button", { name: menu }));
  return screen.findByRole("menuitem", { name: new RegExp(`^${name}`) });
};
const field = () => screen.getByRole("textbox", { name: "Recipient" }) as HTMLInputElement;

describe("Edit, in the served window", () => {
  it("dims the rows, saying why, while no field has the keyboard", async () => {
    await show();
    const undo = await menuRow("Edit", "Undo");
    expect(undo).toHaveAttribute("aria-disabled", "true");
    expect(undo).toHaveAttribute("title", "Click in the recipient field to edit its text.");
  });
  it("acts on the recipient field", async () => {
    await show();
    fireEvent.change(field(), { target: { value: "martin" } });
    act(() => field().focus());
    field().setSelectionRange(0, 3);
    const copy = await menuRow("Edit", "Copy");
    expect(copy).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: /^Undo/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: /^Select All/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

describe("full screen", () => {
  it("enters from Video through the window's green-button command", async () => {
    const onZoom = vi.fn();
    await show({ onZoom, zoomRole: "full-screen" });
    fireEvent.click(await menuRow("Video", "Enter Full Screen"));
    expect(onZoom).toHaveBeenCalledTimes(1);
  });
  it("says Exit while the window is in full screen", async () => {
    await show({ onZoom: vi.fn(), zoomRole: "exit-full-screen" });
    expect(await menuRow("Video", "Exit Full Screen")).not.toHaveAttribute("aria-disabled", "true");
  });
  it("is dimmed, saying why, off the desktop", async () => {
    await show();
    const row = await menuRow("Video", "Enter Full Screen");
    expect(row).toHaveAttribute("aria-disabled", "true");
    expect(row).toHaveAttribute("title", "This window is not on the desktop.");
  });
});

describe("the call panel", () => {
  const placeCall = async () => {
    const user = userEvent.setup();
    await user.type(field(), "ada{Enter}");
    return screen.findByRole("button", { name: "Add Person" });
  };
  it("has Full Screen on a window that can enter it", async () => {
    const onZoom = vi.fn();
    await show({ onZoom, zoomRole: "full-screen" });
    await placeCall();
    fireEvent.click(screen.getByRole("button", { name: "Full Screen" }));
    expect(onZoom).toHaveBeenCalledTimes(1);
  });
  it("dims Live Photo, saying why, until there is a picture", async () => {
    await show();
    await placeCall();
    const button = screen.getByRole("button", { name: "Live Photo" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      "A Live Photo needs the other person's picture in a video call.",
    );
    expect(screen.queryByRole("button", { name: "Full Screen" })).toBeNull();
  });
});

describe("a recent call's info button", () => {
  it("asks Contacts for the person's card", async () => {
    const reach = await show();
    const info = await screen.findByRole("button", { name: "Show Ada Lovelace in Contacts" });
    await waitFor(() => expect(info).toBeEnabled());
    fireEvent.click(info);
    expect(reach.takeAddressRequests("contacts")).toEqual([
      { app: "contacts", to: "ada", name: "Ada Lovelace" },
    ]);
  });
});
