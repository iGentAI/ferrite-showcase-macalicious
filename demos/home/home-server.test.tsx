import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Home } from "./home";
import { defaultHomes } from "./home-data";
import { homesFromServer, homesReadable, homesToServer } from "./home-server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const URL = "/api/home/homes";

function serve(reply: unknown) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "PUT"
      ? { ok: true, json: async () => JSON.parse(String(init.body)) }
      : { ok: true, json: async () => reply },
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const saves = (fetch: ReturnType<typeof serve>) =>
  fetch.mock.calls
    .filter(([, init]) => init?.method === "PUT")
    .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }));

const frame = () => screen.getByRole("region", { name: "Home" });
const names = (group: string) =>
  within(screen.getByRole("group", { name: group }))
    .getAllByRole("button")
    .map((tile) => tile.textContent?.trim());

const stored = [
  {
    id: "flat",
    name: "Flat",
    rooms: ["Hall"],
    accessories: [
      { id: "hall-light", room: "Hall", name: "Light", kind: "light", on: false, favorite: true },
    ],
    scenes: [{ id: "hall-on", name: "Hall On", icon: "house", sets: { "hall-light": true } }],
  },
];

describe("Home on the desktop's Ferrite application", () => {
  it("reads only homes in the module's shape", () => {
    expect(homesReadable({ homes: null })).toBe(true);
    expect(homesReadable({ homes: stored })).toBe(true);
    expect(homesReadable({ homes: "Flat" })).toBe(false);
    expect(homesReadable({ rev: 2 })).toBe(false);
    const toaster = structuredClone(stored);
    (toaster[0]?.accessories[0] as { kind: string }).kind = "toaster";
    expect(homesReadable({ homes: toaster })).toBe(false);
    expect(homesFromServer({ homes: null })).toBeUndefined();
    expect(homesFromServer({ homes: [] })).toBeUndefined();
    expect(homesFromServer({ homes: stored })).toEqual(stored);
    // The sample homes go to the server as they are, and come back the same.
    const body = JSON.parse(JSON.stringify(homesToServer(defaultHomes)));
    expect(homesFromServer(body)).toEqual(defaultHomes);
  });

  it("asks no server when the page is not served by the application", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<Home />);
    expect(fetch).not.toHaveBeenCalled();
    expect(frame()).not.toHaveAttribute("aria-busy");
  });

  it("stays inert until the homes have loaded, then shows the session's homes", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    let answer: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise((resolve) => (answer = resolve))),
    );
    render(<Home />);
    expect(frame()).toHaveAttribute("aria-busy", "true");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    answer({ ok: true, json: async () => ({ homes: stored, rev: 3 }) });
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/^Flat$/);
    expect(names("Favorite Accessories")).toEqual(["Hall Light Off"]);
  });

  it("saves a switched accessory and a scene run, and says the accessories are simulated", async () => {
    const user = userEvent.setup();
    const fetch = serve({ homes: stored, rev: 1 });
    render(<Home />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    expect(saves(fetch)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Hall Light Off" }));
    await waitFor(() => {
      const last = saves(fetch).at(-1);
      expect(last?.url).toBe(URL);
      expect(last?.body.homes[0].accessories[0].on).toBe(true);
    });
    await user.click(screen.getByRole("button", { name: "Hall Light On" }));
    await waitFor(() => expect(saves(fetch).at(-1)?.body.homes[0].accessories[0].on).toBe(false));
    await user.click(screen.getByRole("button", { name: "Hall On" }));
    await waitFor(() => expect(saves(fetch).at(-1)?.body.homes[0].accessories[0].on).toBe(true));

    await user.click(screen.getByRole("button", { name: "Homes" }));
    expect(
      await screen.findByRole("menuitem", { name: "Accessories Are Simulated" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("starts from one empty home when the person has none, says so, and saves nothing until a change", async () => {
    const user = userEvent.setup();
    const fetch = serve({ homes: null, rev: 0 });
    render(<Home />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/^My Home$/);
    expect(screen.getByText("No Accessories")).toBeInTheDocument();
    expect(screen.getByText(/^No real accessories: this desktop has no HomeKit/)).toBeVisible();
    expect(saves(fetch)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Add Accessory…" }));
    expect(await screen.findByText(/^Home found no accessories/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Name:" }), "Lamp");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(saves(fetch)).toHaveLength(1));
    expect(saves(fetch)[0]?.body.homes).toEqual([
      {
        id: "my-home",
        name: "My Home",
        rooms: ["Default Room"],
        accessories: [
          {
            id: "my-home-accessory-0",
            room: "Default Room",
            name: "Lamp",
            kind: "light",
            on: false,
            favorite: true,
          },
        ],
        scenes: [],
      },
    ]);
  });

  it("runs a scene when an accessory an automation watches is switched", async () => {
    const user = userEvent.setup();
    const homes = structuredClone(stored) as unknown as Record<string, unknown>[];
    const flat = homes[0] as { accessories: unknown[]; automations?: unknown[] };
    flat.accessories.push({
      id: "hall-outlet",
      room: "Hall",
      name: "Fan",
      kind: "outlet",
      on: false,
      favorite: true,
    });
    flat.automations = [
      {
        id: "fan-light",
        name: "Fan Light",
        trigger: { kind: "accessory", accessory: "hall-outlet", on: true },
        scene: "hall-on",
        enabled: true,
      },
    ];
    const fetch = serve({ homes, rev: 1 });
    render(<Home />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.click(screen.getByRole("button", { name: "Hall Fan Off" }));
    await waitFor(() => {
      const saved = saves(fetch).at(-1)?.body.homes[0];
      expect(saved.accessories[0].on).toBe(true);
      expect(saved.automations[0].lastRun).toEqual(expect.any(Number));
    });
    expect(fetch.mock.calls.some(([url]) => url === "/api/notification-center/notify")).toBe(true);
  });

  it("offers no addition the module would refuse", async () => {
    const user = userEvent.setup();
    const full = structuredClone(stored);
    const flat = full[0] as (typeof stored)[number] & { scenes: unknown[] };
    flat.scenes = Array.from({ length: 100 }, (_, n) => ({
      id: `scene-${n}`,
      name: `Scene ${n}`,
      icon: "house",
      sets: { "hall-light": true },
    }));
    const roomless = { id: "empty", name: "Empty", rooms: [], accessories: [], scenes: [] };
    serve({ homes: [full[0], roomless], rev: 1 });
    render(<Home />);
    await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("menuitem", { name: "Add Scene…" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("menuitem", { name: "Add Accessory…" })).not.toHaveAttribute(
      "aria-disabled",
    );
  });

  it("saves nothing over stored homes it cannot read", async () => {
    for (const reply of [{ homes: "Flat" }, { rev: 3 }]) {
      const user = userEvent.setup();
      const fetch = serve(reply);
      const { unmount } = render(<Home />);
      await waitFor(() => expect(frame()).not.toHaveAttribute("aria-busy"));
      await user.click(screen.getByRole("button", { name: "Add Accessory…" }));
      await user.type(await screen.findByRole("textbox", { name: "Name:" }), "Lamp");
      await user.click(screen.getByRole("button", { name: "Add" }));
      expect(
        await screen.findByRole("button", { name: "Default Room Lamp Off" }),
      ).toBeInTheDocument();
      expect(saves(fetch)).toEqual([]);
      unmount();
    }
  });
});
