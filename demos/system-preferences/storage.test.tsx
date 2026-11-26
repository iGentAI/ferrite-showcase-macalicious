import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalinaDesktop } from "../desktop/desktop";
import { discoveredApps } from "../desktop/desktop-apps";
import {
  changeDesktopValue,
  DESKTOP_PICTURE_EVENT,
  desktopValues,
  lastDesktopPicture,
  pictureFileOf,
  showDesktopPicture,
  takePictureChoice,
  takePictureTicket,
} from "../desktop/desktop-personal";
import { onSessionEnd, serverDocument } from "../desktop/desktop-server";
import { app } from "./app";
import { requestPane } from "./pane-request";
import { keepPhotosPicture } from "./panes/desktop-and-screen-saver/stored-picture";
import { restoreSavedTheme, settingsFromServer, themeOf } from "./storage";
import { SystemPreferences } from "./system-preferences";

// Saving a photo from Photos to the drive is held by stored-picture.test.ts; here it answers the
// drive picture it was saved as.
// The settings are what this file counts: who is signed in is read apart (`served-pages.test.tsx`).
vi.mock("./served-pages", async (original) => ({
  ...(await original<typeof import("./served-pages")>()),
  useServedAccount: () => null,
}));

vi.mock("./panes/desktop-and-screen-saver/stored-picture", async (original) => ({
  ...(await original<typeof import("./panes/desktop-and-screen-saver/stored-picture")>()),
  keepPhotosPicture: vi.fn(async () => "drive:photo"),
}));

const html = document.documentElement;

/** Cleanups of `restoreSavedTheme` calls, so that each test starts with no settings session. */
const stops: (() => void)[] = [];
const startDesktop = () => {
  stops.push(restoreSavedTheme());
};

afterEach(() => {
  cleanup();
  for (const stop of stops.splice(0)) stop();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const name of ["data-appearance", "data-accent", "data-highlight"]) {
    html.removeAttribute(name);
  }
});

const SAVED = {
  values: { "general.scrollBars": "always" },
  theme: { appearance: "dark", accent: "pink", highlight: null },
};

/** A Ferrite application holding `reply`, which answers each save with its next revision. */
function serve(reply: { rev?: number } & Record<string, unknown>) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  let rev = reply.rev ?? 0;
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    // Only the settings: a mounted desktop's other services find no server behind them.
    if (!url.startsWith("/api/system-preferences/"))
      return { ok: false, status: 404, json: async () => ({}) };
    if (init?.method !== "PUT")
      return { ok: true, status: 200, json: async () => ({ ...reply, rev }) };
    rev += 1;
    return { ok: true, status: 200, json: async () => ({ ...JSON.parse(String(init.body)), rev }) };
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const loads = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls.filter(([, init]) => init?.method !== "PUT").length;

const saves = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([url, init]) => {
      // The per-save ids (`save`, `after`) are random.
      const { save: _save, after: _after, ...body } = JSON.parse(String(init?.body));
      return { url, body };
    });

const openGeneral = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(
    within(screen.getByRole("group", { name: "All preferences" })).getByRole("button", {
      name: "General",
    }),
  );

describe("System Preferences on the desktop's Ferrite application", () => {
  it("reads the theme an element sets, and checks a reply", () => {
    expect(themeOf(html)).toEqual({ appearance: "auto", accent: "blue", highlight: null });
    html.setAttribute("data-appearance", "dark");
    html.setAttribute("data-accent", "custom");
    expect(themeOf(html)).toEqual({ appearance: "dark", accent: null, highlight: null });
    expect(settingsFromServer(SAVED)).toEqual({ ...SAVED, valid: true });
    expect(settingsFromServer({ values: null, theme: null, rev: 0 })).toEqual({
      values: null,
      theme: null,
      valid: true,
    });
    expect(settingsFromServer({ values: [], theme: { appearance: "dim" } })).toEqual({
      values: null,
      theme: null,
      valid: false,
    });
  });

  it("saves nothing over settings it could not read", async () => {
    expect(settingsFromServer([]).valid).toBe(false);
    const broken = { values: "broken", theme: null, rev: 2 };
    const fetch = serve(broken);
    startDesktop();
    await vi.waitFor(() => expect(loads(fetch)).toBe(1));
    html.setAttribute("data-appearance", "light");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saves(fetch)).toEqual([]);
  });

  it("asks no server when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<SystemPreferences />);
    startDesktop();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("puts the saved theme on the page when the desktop starts", async () => {
    serve(SAVED);
    expect(app.onDesktopStart).toBe(restoreSavedTheme);
    startDesktop();
    await waitFor(() => expect(html).toHaveAttribute("data-appearance", "dark"));
    expect(html).toHaveAttribute("data-accent", "pink");
    expect(html).toHaveAttribute("data-highlight", "accent");
  });

  it("puts the saved theme on the page of a mounted desktop, and saves nothing for it", async () => {
    const fetch = serve(SAVED);
    // The real desktop, with System Preferences as its application: its own start-up effects
    // run beside `onDesktopStart`, and none of them may count as a change of the theme.
    const hosted = discoveredApps.filter((entry) => entry.id === "system-preferences");
    expect(hosted).toHaveLength(1);
    render(<CatalinaDesktop apps={hosted} clock="Thu 10:07 AM" />);
    await waitFor(() => expect(html).toHaveAttribute("data-appearance", "dark"));
    expect(html).toHaveAttribute("data-accent", "pink");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saves(fetch)).toEqual([]);
  });

  it("saves a theme changed on the desktop while System Preferences is closed", async () => {
    const fetch = serve({ ...SAVED, rev: 3 });
    startDesktop();
    await waitFor(() => expect(html).toHaveAttribute("data-appearance", "dark"));
    // Putting the saved theme back saved nothing.
    expect(saves(fetch)).toEqual([]);
    html.setAttribute("data-appearance", "light");
    await waitFor(() =>
      expect(saves(fetch).at(-1)?.body).toEqual({
        values: SAVED.values,
        theme: { appearance: "light", accent: "pink", highlight: null },
        rev: 3,
      }),
    );
  });

  it("keeps and saves a theme set on the page before the saved one arrived", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let answer: (value: unknown) => void = () => {};
    const fetch = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? Promise.resolve({ ok: true, status: 200, json: async () => ({ rev: 2 }) })
        : new Promise((resolve) => (answer = resolve)),
    );
    vi.stubGlobal("fetch", fetch);
    startDesktop();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    // The person chooses Light first.
    html.setAttribute("data-appearance", "light");
    answer({ ok: true, status: 200, json: async () => ({ ...SAVED, rev: 1 }) });
    await waitFor(() =>
      expect(saves(fetch as never).at(-1)?.body).toMatchObject({
        values: SAVED.values,
        theme: { appearance: "light", accent: "blue", highlight: null },
      }),
    );
    expect(html).toHaveAttribute("data-appearance", "light");
    expect(html).not.toHaveAttribute("data-accent");
  });

  it("keeps a theme change queued before the desktop's start completed, and saves it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let answer: (value: unknown) => void = () => {};
    const fetch = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? Promise.resolve({ ok: true, status: 200, json: async () => ({ rev: 2 }) })
        : new Promise((resolve) => (answer = resolve)),
    );
    vi.stubGlobal("fetch", fetch);
    // A task queued before the desktop starts, which runs after the load has been sent.
    const queued = new Promise<void>((resolve) =>
      setTimeout(() => {
        html.setAttribute("data-appearance", "light");
        resolve();
      }, 0),
    );
    startDesktop();
    await queued;
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    answer({ ok: true, status: 200, json: async () => ({ ...SAVED, rev: 1 }) });
    // The local change wins over the stored theme, and is saved.
    await waitFor(() =>
      expect(saves(fetch as never).at(-1)?.body).toMatchObject({
        values: SAVED.values,
        theme: { appearance: "light", accent: "blue", highlight: null },
      }),
    );
    expect(html).toHaveAttribute("data-appearance", "light");
    expect(html).not.toHaveAttribute("data-accent");
  });

  it("loads the settings once for the desktop and its System Preferences window", async () => {
    const fetch = serve(SAVED);
    startDesktop();
    render(<SystemPreferences defaultPane="general" />);
    await waitFor(() => expect(screen.getByRole("radio", { name: "Always" })).toBeChecked());
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(loads(fetch)).toBe(1);
  });

  it("shows what the page holds in a window opened again, and saves on the latest revision", async () => {
    const user = userEvent.setup();
    const fetch = serve({ ...SAVED, rev: 7 });
    startDesktop();
    const first = render(<SystemPreferences defaultPane="general" />);
    await waitFor(() => expect(screen.getByRole("radio", { name: "Always" })).toBeChecked());
    await user.click(screen.getByRole("radio", { name: "When scrolling" }));
    await waitFor(() => expect(saves(fetch)).toHaveLength(1));
    first.unmount();
    render(<SystemPreferences defaultPane="general" />);
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "When scrolling" })).toBeChecked(),
    );
    expect(loads(fetch)).toBe(1);
    await user.click(screen.getByRole("radio", { name: "Always" }));
    await waitFor(() => expect(saves(fetch)).toHaveLength(2));
    expect(saves(fetch).map(({ body }) => body.rev)).toEqual([7, 8]);
  });

  it("keeps a change made in one window when another window, open meanwhile, changes another setting", async () => {
    const user = userEvent.setup();
    const fetch = serve({ ...SAVED, rev: 1 });
    startDesktop();
    const one = render(<SystemPreferences defaultPane="general" />);
    const two = render(<SystemPreferences defaultPane="general" />);
    const first = within(one.container);
    const second = within(two.container);
    await waitFor(() => expect(second.getByRole("radio", { name: "Always" })).toBeChecked());
    await user.click(first.getByRole("radio", { name: "When scrolling" }));
    await waitFor(() => expect(saves(fetch)).toHaveLength(1));
    // The other window's control, mounted all along, shows the change at once.
    expect(second.getByRole("radio", { name: "When scrolling" })).toBeChecked();
    await user.click(second.getByRole("radio", { name: "Jump to the spot that’s clicked" }));
    await waitFor(() => expect(saves(fetch)).toHaveLength(2));
    expect(first.getByRole("radio", { name: "Jump to the spot that’s clicked" })).toBeChecked();
    expect(saves(fetch).at(-1)?.body.values).toEqual({
      "general.scrollBars": "scrolling",
      "general.scrollClick": "spot",
    });
  });

  it("keeps the window's content inert until the saved settings have loaded", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let answer: (value: unknown) => void = () => {};
    const fetch = vi.fn(() => new Promise((resolve) => (answer = resolve)));
    vi.stubGlobal("fetch", fetch);
    render(<SystemPreferences />);
    const body = document.querySelector(".mac-system-preferences-body") as HTMLElement;
    expect(body).toHaveAttribute("inert");
    expect(screen.getByRole("toolbar", { name: "System Preferences toolbar" })).toHaveAttribute(
      "inert",
    );
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    answer({ ok: false, json: async () => ({ error: "storage failed" }) });
    // A failed load ends the wait too.
    await waitFor(() => expect(body).not.toHaveAttribute("inert"));
  });

  it("shows the saved settings in a pane that was open before they loaded", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let answer: (value: unknown) => void = () => {};
    const fetch = vi.fn(() => new Promise((resolve) => (answer = resolve)));
    vi.stubGlobal("fetch", fetch);
    render(<SystemPreferences defaultPane="general" />);
    expect(screen.getByRole("radio", { name: "Always" })).not.toBeChecked();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    answer({ ok: true, json: async () => SAVED });
    await waitFor(() => expect(screen.getByRole("radio", { name: "Always" })).toBeChecked());
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  });

  it("keeps a pane asked for from outside as the last shown, without navigating", async () => {
    const fetch = serve({ values: { "window.pane": "sound" } });
    requestPane("general");
    render(<SystemPreferences />);
    await waitFor(() =>
      expect(saves(fetch).at(-1)?.body.values).toMatchObject({ "window.pane": "general" }),
    );
  });

  it("opens on the pane last shown, and saves nothing for it", async () => {
    const fetch = serve({ values: { "window.pane": "sound" } });
    const { container } = render(<SystemPreferences />);
    await waitFor(() => expect(container.querySelector('[data-pane="sound"]')).not.toBeNull());
    expect(saves(fetch)).toEqual([]);
  });

  it("loads the saved settings and theme, and saves what a pane changes", async () => {
    const user = userEvent.setup();
    const fetch = serve(SAVED);
    render(<SystemPreferences />);
    await waitFor(() => expect(html).toHaveAttribute("data-appearance", "dark"));
    await waitFor(() =>
      expect(document.querySelector(".mac-system-preferences-body")).not.toHaveAttribute("inert"),
    );
    await openGeneral(user);
    expect(screen.getByRole("radio", { name: "Always" })).toBeChecked();
    // Showing a pane keeps which pane it was, and no other setting changes.
    await waitFor(() =>
      expect(saves(fetch).at(-1)?.body.values).toEqual({
        ...SAVED.values,
        "window.pane": "general",
      }),
    );

    await user.click(screen.getByRole("radio", { name: "Light" }));
    await waitFor(() =>
      expect(saves(fetch).at(-1)?.body.theme).toEqual({
        appearance: "light",
        accent: "pink",
        highlight: null,
      }),
    );
    expect(saves(fetch).at(-1)?.url).toBe("/api/system-preferences/settings");

    await user.click(screen.getByRole("radio", { name: "When scrolling" }));
    await waitFor(() =>
      expect(saves(fetch).at(-1)?.body.values).toMatchObject({
        "general.scrollBars": "scrolling",
      }),
    );
  });

  it("hands the person's desktop settings to the desktop, and saves the desktop's changes", async () => {
    const fetch = serve({
      values: { "dock.position": "left", "dock.order": ["notes"] },
      theme: null,
      rev: 30,
    });
    startDesktop();
    await waitFor(() => expect(desktopValues()["dock.position"]).toBe("left"));
    // A tile dragged on the Dock: saved with the rest of the settings.
    changeDesktopValue("dock.order", ["safari", "notes"]);
    await waitFor(() =>
      expect(saves(fetch).at(-1)?.body.values).toEqual({
        "dock.position": "left",
        "dock.order": ["safari", "notes"],
      }),
    );
    // A change made in a System Preferences window reaches the desktop at once.
    const user = userEvent.setup();
    render(<SystemPreferences defaultPane="dock" />);
    await waitFor(() =>
      expect(document.querySelector(".mac-system-preferences-body")).not.toHaveAttribute("inert"),
    );
    expect(screen.getByRole("radio", { name: "Left" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Right" }));
    expect(desktopValues()["dock.position"]).toBe("right");
    // The desktop's change reaches the open window too.
    act(() => changeDesktopValue("dock.position", "bottom"));
    expect(screen.getByRole("radio", { name: "Bottom" })).toBeChecked();
  });

  it("shows the stored desktop picture again when the desktop starts", async () => {
    serve({
      values: {
        "desktop-and-screen-saver.picture": "mojave",
        "desktop-and-screen-saver.mode": "dark",
      },
      theme: null,
      rev: 40,
    });
    const shown: unknown[] = [];
    const hear = (event: Event) => shown.push((event as CustomEvent).detail);
    window.addEventListener(DESKTOP_PICTURE_EVENT, hear);
    try {
      startDesktop();
      await waitFor(() => expect(shown).toHaveLength(1));
      expect(shown[0]).toMatchObject({ look: "night", restored: true });
    } finally {
      window.removeEventListener(DESKTOP_PICTURE_EVENT, hear);
    }
  });

  it("keeps a photo made the desktop picture in Photos as the person's choice", async () => {
    const fetch = serve({ values: { "dock.size": 20 }, theme: null, rev: 50 });
    startDesktop();
    await waitFor(() => expect(desktopValues()["dock.size"]).toBe(20));
    showDesktopPicture({
      day: "blob:a",
      night: "blob:a",
      look: "auto",
      source: "photos",
      ...takePictureTicket(),
    });
    await waitFor(() =>
      expect(saves(fetch).at(-1)?.body.values).toEqual({
        "dock.size": 20,
        "desktop-and-screen-saver.picture": "drive:photo",
      }),
    );
    // A picture shown again at start is no new choice.
    const before = saves(fetch).length;
    showDesktopPicture({ day: "blob:b", look: "auto", source: "photos", restored: true });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saves(fetch)).toHaveLength(before);
  });

  it("does not keep the photo when a newer choice is made just before it is saved", async () => {
    const fetch = serve({ values: { "dock.size": 20 }, theme: null, rev: 57 });
    startDesktop();
    await waitFor(() => expect(desktopValues()["dock.size"]).toBe(20));
    // The photo is stored on the drive, and the person picks another picture before it is kept.
    vi.mocked(keepPhotosPicture).mockImplementationOnce(async () => {
      takePictureChoice();
      return "drive:photo";
    });
    showDesktopPicture({
      day: "blob:a",
      night: "blob:a",
      look: "auto",
      source: "photos",
      ...takePictureTicket(),
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      saves(fetch).some((save) => save.body.values?.["desktop-and-screen-saver.picture"]),
    ).toBe(false);
  });

  it("neither shows nor keeps a photo from Photos whose choice is no longer the newest", async () => {
    const fetch = serve({ values: { "dock.size": 20 }, theme: null, rev: 55 });
    startDesktop();
    await waitFor(() => expect(desktopValues()["dock.size"]).toBe(20));
    // Set Desktop Picture is pressed in Photos; while its photo is read, the person picks
    // another picture; then the photo arrives.
    const ticket = takePictureTicket();
    takePictureChoice();
    showDesktopPicture({ day: "blob:old", night: "blob:old", look: "auto", source: "photos" });
    showDesktopPicture({
      day: "blob:old",
      night: "blob:old",
      look: "auto",
      source: "photos",
      ...ticket,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(lastDesktopPicture()?.day).not.toBe("blob:old");
    expect(
      saves(fetch).some((save) => save.body.values?.["desktop-and-screen-saver.picture"]),
    ).toBe(false);
  });

  it("keeps a photo set in Photos while the settings load, and does not put the stored picture back", async () => {
    let answer: (value: unknown) => void = () => {};
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let rev = 60;
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        rev += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ...JSON.parse(String(init.body)), rev }),
        };
      }
      await new Promise((resolve) => {
        answer = resolve;
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          values: { "desktop-and-screen-saver.picture": "mountains" },
          theme: null,
          rev,
        }),
      };
    });
    vi.stubGlobal("fetch", fetch);
    const shown: { day?: string }[] = [];
    const hear = (event: Event) => shown.push((event as CustomEvent).detail);
    window.addEventListener(DESKTOP_PICTURE_EVENT, hear);
    try {
      startDesktop();
      await vi.waitFor(() => expect(loads(fetch)).toBe(1));
      showDesktopPicture({
        day: "blob:photo",
        night: "blob:photo",
        look: "auto",
        source: "photos",
        ...takePictureTicket(),
      });
      answer(undefined);
      await waitFor(() =>
        expect(saves(fetch).at(-1)?.body.values).toEqual({
          "desktop-and-screen-saver.picture": "drive:photo",
        }),
      );
      // Mountains, the stored choice, was not shown over the photo; a Space can keep it by its file.
      expect(shown.map((detail) => detail.day)).toEqual(["blob:photo"]);
      expect(pictureFileOf("blob:photo")).toBe("photo");
    } finally {
      window.removeEventListener(DESKTOP_PICTURE_EVENT, hear);
    }
  });

  // Last in the file: the page's session stays ended for the rest of it.
  it("saves nothing more once another demo's load finds a new session", async () => {
    const user = userEvent.setup();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let replaced = false;
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return { ok: true, status: 200, json: async () => ({ rev: 9 }) };
      // The cookie is replaced once the settings have loaded: every later load names session B.
      const session = replaced ? "b".repeat(64) : "a".repeat(64);
      const reply =
        url === "/api/system-preferences/settings"
          ? { ...SAVED, rev: 4, session }
          : { events: null, rev: 0, session };
      return { ok: true, status: 200, json: async () => reply };
    });
    vi.stubGlobal("fetch", fetch);
    const ended = vi.fn();
    const stop = onSessionEnd(ended);
    startDesktop();
    render(<SystemPreferences defaultPane="general" />);
    await waitFor(() => expect(screen.getByRole("radio", { name: "Always" })).toBeChecked());
    // Calendar loads its events, and finds the new session: the page is loaded again.
    replaced = true;
    expect(await serverDocument("/api/calendar/events").load()).toBeUndefined();
    expect(ended).toHaveBeenCalledTimes(1);
    // Until it is, nothing of the old session is saved into the new one.
    await user.click(screen.getByRole("radio", { name: "When scrolling" }));
    html.setAttribute("data-appearance", "light");
    await serverDocument("/api/system-preferences/settings").idle();
    expect(saves(fetch)).toEqual([]);
    stop();
  });
});
