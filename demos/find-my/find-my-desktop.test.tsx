import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openItem } from "../desktop/desktop-open-item";
import { forgetDesktopValues } from "../desktop/desktop-personal";
import { DesktopFindMy, HEARTBEAT_MS, selectionItem, sharingNote } from "./find-my-desktop";
import { removableDevices, removeQuestion, removeReason } from "./find-my-menus";
import {
  deviceKind,
  deviceLabel,
  devicesFromServer,
  lastSeen,
  POLL_MS,
  REPORT_EVERY_MS,
  reportLocation,
  type ServedDevice,
} from "./find-my-server";

const THIS_ID = "0123456789abcdef";
const OTHER_ID = "fedcba9876543210";
const HERE = { latitude: 37.8075, longitude: -122.475, accuracy: 20 };
/** The person's other browser, as the module lists it. */
const THERE: ServedDevice = {
  id: OTHER_ID,
  label: "Firefox on Linux",
  lat: 51.5,
  lon: -0.12,
  accuracy_m: 30,
  at: 0,
  this: false,
  sound_pending: false,
  sound_request: null,
};

const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

interface Call {
  url: string;
  method: string;
  body: Record<string, unknown> | undefined;
}

/** The Find My module as far as the window uses it, with another browser of the person's. */
function server() {
  const calls: Call[] = [];
  const devices = new Map<string, ServedDevice>([
    [OTHER_ID, { ...THERE, at: Date.now() - 2 * 3_600_000 }],
  ]);
  // Each Play Sound request gets its own id, as the module gives one.
  let requests = 0;
  // The own time of the report each device holds: the module keeps the newest by it.
  const reportedAt = new Map<string, number>();
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : undefined;
    calls.push({ url, method, body });
    if (url === "/api/session") return json(200, { session: "session-1", account: null });
    if (url === "/api/find-my/me" && method === "PUT") {
      const held = devices.get(THIS_ID);
      const made = Number(body?.reported_at);
      if (held && made <= (reportedAt.get(THIS_ID) ?? -1))
        return json(200, { device: held, applied: false, session: "session-1" });
      reportedAt.set(THIS_ID, made);
      const device: ServedDevice = {
        id: THIS_ID,
        label: String(body?.label),
        lat: Number(body?.lat),
        lon: Number(body?.lon),
        accuracy_m: Number(body?.accuracy_m),
        at: Date.now(),
        this: true,
        sound_pending: devices.get(THIS_ID)?.sound_pending ?? false,
        sound_request: devices.get(THIS_ID)?.sound_request ?? null,
      };
      devices.set(THIS_ID, device);
      return json(200, { device, applied: true, session: "session-1" });
    }
    if (url === "/api/find-my/devices" && method === "GET")
      return json(200, {
        devices: [...devices.values()].sort((a, b) => Number(b.this) - Number(a.this)),
        session: "session-1",
      });
    const sound = url.match(
      /^\/api\/find-my\/devices\/([0-9a-f]{16})\/sound(?:\?request=([0-9a-f]{16}))?$/,
    );
    if (sound) {
      const device = devices.get(sound[1] as string);
      if (!device) return json(404, { error: "no device has that id" });
      if (method === "POST") {
        requests += 1;
        device.sound_pending = true;
        device.sound_request = requests.toString(16).padStart(16, "0");
      } else if (!sound[2]) {
        return json(400, { error: "name the request that was played: ?request=<its id>" });
      } else if (sound[2] === device.sound_request) {
        // Only the request named is cleared; one asked since keeps waiting.
        device.sound_pending = false;
        device.sound_request = null;
      }
      return json(200, {
        id: device.id,
        sound_pending: device.sound_pending,
        sound_request: device.sound_request,
      });
    }
    const removed = url.match(/^\/api\/find-my\/devices\/([0-9a-f]{16})$/);
    if (removed && method === "DELETE") {
      devices.delete(removed[1] as string);
      return json(200, { id: removed[1], removed: true });
    }
    return json(404, { error: "not found" });
  });
  return { fetch, calls, devices };
}

function stubLocation(allowed: boolean) {
  const geolocation = {
    getCurrentPosition: vi.fn((ok: (position: unknown) => void, fail: (error: unknown) => void) =>
      allowed ? ok({ coords: HERE }) : fail({ code: 1 }),
    ),
    watchPosition: vi.fn((ok: (position: unknown) => void, fail: (error: unknown) => void) => {
      if (allowed) ok({ coords: HERE });
      else fail({ code: 1 });
      return 1;
    }),
    clearWatch: vi.fn(),
  };
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: geolocation });
  return geolocation;
}

/** A fake oscillator whose tone ends, as a real one does, once it has been stopped (`ends`). */
function fakeTone(started: () => void, ends = true) {
  const tone: { onended: (() => void) | null; [key: string]: unknown } = {
    type: "",
    frequency: { value: 0 },
    connect: vi.fn(),
    start: started,
    onended: null,
    stop: () => {
      if (ends) setTimeout(() => tone.onended?.(), 0);
    },
  };
  return tone;
}

/**
 * Web Audio, as far as the sound uses it; counts the tones started. With `ends` false the
 * tones never end, as in a context the browser suspends while they play.
 */
function stubAudio({ ends = true } = {}) {
  const started = vi.fn();
  class FakeAudioContext {
    state = "running";
    currentTime = 0;
    destination = {};
    resume = async () => {};
    close = async () => {};
    createOscillator() {
      return fakeTone(started, ends);
    }
    createGain() {
      return {
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      };
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  return started;
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
});

afterEach(() => {
  forgetDesktopValues();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "geolocation");
});

const list = (name: string) =>
  within(screen.getByRole("radiogroup", { name: "Show" })).getByRole("radio", { name });
const rows = (name: string) => within(screen.getByRole("listbox", { name })).getAllByRole("option");

/** Remove This Device on a card, answering its alert. */
async function removeFromCard(user: ReturnType<typeof userEvent.setup>, card: HTMLElement) {
  await user.click(within(card).getByRole("button", { name: "Remove This Device" }));
  await user.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove" }),
  );
}

async function openServed(allowed = true) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const backend = server();
  vi.stubGlobal("fetch", backend.fetch);
  stubLocation(allowed);
  const user = userEvent.setup();
  render(<DesktopFindMy />);
  return { ...backend, user };
}

describe("Find My's heartbeat", () => {
  it("retries a report that failed instead of counting it as sent", async () => {
    const intervals = vi.spyOn(globalThis, "setInterval");
    const backend = server();
    let fail = true;
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/find-my/me" && init?.method === "PUT" && fail)
        return json(503, { error: "storage failed" });
      return backend.fetch(url, init);
    });
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal("fetch", fetch);
    stubLocation(true);
    render(<DesktopFindMy />);
    const puts = () =>
      fetch.mock.calls.filter(([url, init]) => url === "/api/find-my/me" && init?.method === "PUT");
    await waitFor(() => expect(puts()).toHaveLength(1));
    const beat = intervals.mock.calls.find(([, ms]) => ms === HEARTBEAT_MS)?.[0] as () => void;
    // Within the backoff nothing is sent; after it, the heartbeat tries again at once, though a
    // minute has not passed since the failed attempt.
    act(() => beat());
    expect(puts()).toHaveLength(1);
    fail = false;
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 6_000);
    act(() => beat());
    await waitFor(() => expect(puts()).toHaveLength(2));
    expect(backend.devices.get(THIS_ID)?.lat).toBe(HERE.latitude);
  });

  it("reports a browser that has not moved again once a minute has passed, and not sooner", async () => {
    const intervals = vi.spyOn(globalThis, "setInterval");
    const { calls } = await openServed();
    const reports = () =>
      calls.filter((call) => call.url === "/api/find-my/me" && call.method === "PUT");
    await waitFor(() => expect(reports()).toHaveLength(1));
    const beat = intervals.mock.calls.find(([, ms]) => ms === HEARTBEAT_MS)?.[0] as () => void;
    expect(beat).toBeTypeOf("function");
    // No new position arrives. Within the minute, the heartbeat sends nothing.
    act(() => beat());
    expect(reports()).toHaveLength(1);
    // A minute later it reports the latest known position again.
    const later = Date.now() + REPORT_EVERY_MS + 1_000;
    vi.spyOn(Date, "now").mockReturnValue(later);
    act(() => beat());
    await waitFor(() => expect(reports()).toHaveLength(2));
    expect(reports()[1]?.body).toMatchObject({ lat: HERE.latitude, lon: HERE.longitude });
    act(() => beat());
    expect(reports()).toHaveLength(2);
  });

  it("a move that arrives while a report is on its way is reported when it ends", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const backend = server();
    let release: (() => void) | undefined;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      // The first report is held until the browser has moved.
      if (url === "/api/find-my/me" && !release) {
        const answer = backend.fetch(url, init);
        return new Promise((resolve) => {
          release = () => resolve(answer);
        });
      }
      return backend.fetch(url, init);
    });
    let moved: ((position: unknown) => void) | undefined;
    const geolocation = stubLocation(true);
    geolocation.watchPosition.mockImplementation((ok: (position: unknown) => void) => {
      ok({ coords: HERE });
      moved = ok;
      return 1;
    });
    render(<DesktopFindMy />);
    const reports = () =>
      backend.calls.filter((call) => call.url === "/api/find-my/me" && call.method === "PUT");
    await waitFor(() => expect(release).toBeTypeOf("function"));
    // About 1 km north, while the first report is still on its way: not sent beside it.
    act(() => moved?.({ coords: { ...HERE, latitude: HERE.latitude + 0.01 } }));
    expect(reports()).toHaveLength(1);
    await act(async () => release?.());
    await waitFor(() => expect(reports()).toHaveLength(2));
    expect(Number(reports()[1]?.body?.lat)).toBeCloseTo(HERE.latitude + 0.01, 6);
  });
});

describe("Find My's helpers", () => {
  it("Remove takes other devices, never this browser, and says why it cannot", () => {
    const mine = { ...THERE, id: THIS_ID, label: "Chrome on Mac", this: true };
    expect(removableDevices([mine, THERE])).toEqual([THERE]);
    expect(removeReason([THERE])).toBeUndefined();
    expect(removeReason([mine, THERE])).toBeUndefined();
    expect(removeReason([mine])).toBe(
      "This browser reports where it is while Find My is open, so it cannot remove itself.",
    );
    expect(removeReason([])).toBe("Choose a device under Devices to remove it.");
  });

  it("the alert names one device, and counts several", () => {
    expect(removeQuestion([THERE])).toBe("Remove \u201cFirefox on Linux\u201d from Find My?");
    expect(removeQuestion([THERE, { ...THERE, id: THIS_ID }])).toBe(
      "Remove 2 devices from Find My?",
    );
  });
  it("reports the served selection as the demo's rows", () => {
    const device: ServedDevice = {
      id: OTHER_ID,
      label: "Firefox on Linux",
      lat: 51.5,
      lon: -0.12,
      accuracy_m: 30,
      at: 1,
      this: false,
      sound_pending: false,
      sound_request: null,
    };
    expect(selectionItem(null, null)).toBeNull();
    expect(
      selectionItem(
        { id: "me", name: "Me", detail: "This browser", device: null },
        { lat: 1, lon: 2 },
      ),
    ).toEqual({ id: "me", name: "Me", place: "This browser", coordinate: { x: 2, y: 1 } });
    expect(
      selectionItem({ id: OTHER_ID, name: device.label, detail: "2 hours ago", device }, null),
    ).toEqual({
      id: OTHER_ID,
      name: "Firefox on Linux",
      place: "2 hours ago",
      coordinate: { x: -0.12, y: 51.5 },
      kind: deviceKind("Firefox on Linux"),
    });
  });

  it("names a browser by its engine and system", () => {
    expect(
      deviceLabel(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
      ),
    ).toBe("Chrome on Mac");
    expect(
      deviceLabel(
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0 Safari/537.36",
      ),
    ).toBe("Chromium on Linux");
    expect(
      deviceLabel("Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0"),
    ).toBe("Firefox on Linux");
    expect(
      deviceLabel(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari on iPhone");
    expect(
      deviceLabel(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0",
      ),
    ).toBe("Edge on Windows");
    expect(deviceKind("Safari on iPhone")).toBe("phone");
    expect(deviceKind("Safari on iPad")).toBe("tablet");
    expect(deviceKind("Firefox on Linux")).toBe("laptop");
  });

  it("says when a device was last seen", () => {
    const now = 1_000_000_000_000;
    expect(lastSeen(now - 10_000, now)).toBe("Now");
    expect(lastSeen(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(lastSeen(now - 3 * 3_600_000, now)).toBe("3 hr ago");
    expect(lastSeen(now - 30 * 3_600_000, now)).toBe("Yesterday");
    expect(lastSeen(now - 72 * 3_600_000, now)).toBe("3 days ago");
  });

  it("stamps a report with when it is made, and shows the device the module kept", async () => {
    const backend = server();
    vi.stubGlobal("fetch", backend.fetch);
    const here = { lat: 37.8075, lon: -122.475, accuracy_m: 20 };
    const there = { lat: 37.8, lon: -122.4, accuracy_m: 20 };
    const newer = await reportLocation(there, "Chrome on Mac", 2_000);
    // A report made earlier that reaches the module afterwards changes nothing: the answer is
    // the newer position the module kept.
    const older = await reportLocation(here, "Chrome on Mac", 1_000);
    const sent = backend.calls.filter((call) => call.url === "/api/find-my/me");
    expect(sent.map((call) => call.body?.reported_at)).toEqual([2_000, 1_000]);
    expect("device" in newer && newer.device.lat).toBe(37.8);
    expect("device" in older && older.device.lat).toBe(37.8);
  });

  it("reads only devices in the module's shape", () => {
    const good = {
      id: THIS_ID,
      label: "Chrome on Mac",
      lat: 1,
      lon: 2,
      accuracy_m: 3,
      at: 4,
      this: true,
      sound_pending: false,
      sound_request: null,
    };
    expect(
      devicesFromServer({ devices: [good, { ...good, id: "x" }] }),
      "one device that cannot be read makes the list unreadable",
    ).toBeUndefined();
    expect(devicesFromServer({ devices: [good, { ...good, lat: 99 }] })).toBeUndefined();
    expect(
      devicesFromServer({ devices: [{ ...good, sound_pending: true, sound_request: null }] }),
      "a pending sound names its request",
    ).toBeUndefined();
    expect(
      devicesFromServer({
        devices: [{ ...good, sound_pending: true, sound_request: "00000000000000ff" }],
      })?.[0]?.sound_request,
    ).toBe("00000000000000ff");
    expect(devicesFromServer({ devices: [good] })).toEqual([good]);
    expect(devicesFromServer({ devices: null })).toBeUndefined();
    expect(sharingNote(false)).toMatch(/^Sign in to share your location/);
  });
});

describe("Find My served by the desktop's Ferrite application", () => {
  it("shows the people list for a person's notification, which names no device", async () => {
    const { user } = await openServed();
    await user.click(list("Devices"));
    await waitFor(() => expect(rows("Devices")).toHaveLength(2));
    for (const id of ["share-anna-1700000000000", "ask-anna-1700000000000"]) {
      await user.click(list("Devices"));
      act(() => openItem({ app: "find-my", id, title: "Anna" }));
      expect(list("People")).toBeChecked();
      expect(rows("People")[0]).toHaveTextContent("Me");
    }
  });

  it("reports this browser's location and lists the person's devices", async () => {
    const { calls, user } = await openServed();
    await waitFor(() => expect(calls.some((call) => call.url === "/api/find-my/me")).toBe(true));
    const report = calls.find((call) => call.url === "/api/find-my/me");
    expect(report?.method).toBe("PUT");
    expect(report?.body).toEqual({
      lat: 37.8075,
      lon: -122.475,
      accuracy_m: 20,
      label: deviceLabel(navigator.userAgent),
      reported_at: expect.any(Number),
    });
    expect(rows("People")[0]).toHaveTextContent("Me");
    expect(screen.getByText("Sign in to share your location")).toBeInTheDocument();
    expect(document.querySelector(".mac-maps-tiles-location")).not.toBeNull();

    await user.click(list("Devices"));
    await waitFor(() => expect(rows("Devices")).toHaveLength(2));
    expect(rows("Devices")[0]).toHaveTextContent("This browser · Now");
    expect(rows("Devices")[1]).toHaveTextContent("Firefox on Linux");
    expect(rows("Devices")[1]).toHaveTextContent("2 hr ago");
    // The other browser has a marker; this one is the location's dot.
    expect(document.querySelector(`.mac-find-my-marker[data-marker="${OTHER_ID}"]`)).not.toBeNull();
    expect(document.querySelector(`.mac-find-my-marker[data-marker="${THIS_ID}"]`)).toBeNull();
  });

  it("tells its owner which person or device is selected, also across the two lists", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const backend = server();
    vi.stubGlobal("fetch", backend.fetch);
    stubLocation(true);
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<DesktopFindMy onSelectionChange={onSelectionChange} />);
    await waitFor(() => expect(rows("People")[0]).toHaveTextContent("Me"));
    await user.click(rows("People")[0] as HTMLElement);
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "me", name: "Me" }),
    );
    await user.click(list("Devices"));
    // Nothing is selected in Devices yet.
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    await waitFor(() => expect(rows("Devices")).toHaveLength(2));
    await user.click(rows("Devices")[1] as HTMLElement);
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: OTHER_ID,
        name: "Firefox on Linux",
        coordinate: { x: -0.12, y: 51.5 },
      }),
    );
    await user.click(list("People"));
    expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: "me" }));
    expect(onSelectionChange).toHaveBeenCalledTimes(4);
  });

  it("says so when the list of devices cannot be read, instead of loading for ever", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const backend = server();
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
      url === "/api/find-my/devices"
        ? json(404, { error: "no app module is named 'find-my'" })
        : backend.fetch(url, init),
    );
    stubLocation(false);
    render(<DesktopFindMy defaultList="devices" />);
    expect(
      await screen.findByText(
        "Devices could not be loaded. Find My tries again every ten seconds.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading Devices…")).toBeNull();
  });

  it("says the list may be out of date when a refresh fails after it was read", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const backend = server();
    let down = false;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
      down && url === "/api/find-my/devices"
        ? json(503, { error: "storage failed" })
        : backend.fetch(url, init),
    );
    stubLocation(true);
    const user = userEvent.setup();
    render(<DesktopFindMy defaultList="devices" />);
    await waitFor(() => expect(rows("Devices")).toHaveLength(2));
    expect(screen.queryByRole("alert")).toBeNull();
    // The next read fails (here after Play Sound asks for one): the rows stay, marked stale.
    down = true;
    await user.click(rows("Devices")[1] as HTMLElement);
    const card = screen.getByRole("region", { name: "Firefox on Linux" });
    await user.click(within(card).getByRole("button", { name: "Play Sound" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^Devices could not be refreshed\. The list is as of /,
    );
    expect(rows("Devices")).toHaveLength(2);
    // A read that succeeds again takes the warning away.
    down = false;
    await user.click(within(card).getByRole("button", { name: "Play Sound" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("opens on the device named by defaultSelectedId once the devices are read", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    vi.stubGlobal("fetch", server().fetch);
    stubLocation(true);
    const onSelectionChange = vi.fn();
    render(
      <DesktopFindMy
        defaultList="devices"
        defaultSelectedId={OTHER_ID}
        onSelectionChange={onSelectionChange}
      />,
    );
    await waitFor(() => expect(rows("Devices")).toHaveLength(2));
    expect(rows("Devices")[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("region", { name: "Firefox on Linux" })).toBeInTheDocument();
    expect(onSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: OTHER_ID, name: "Firefox on Linux" }),
    );
  });

  it("tells its owner when the selected device is removed or is no longer listed", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const backend = server();
    const thirdId = "00000000000000aa";
    backend.devices.set(thirdId, { ...THERE, id: thirdId, label: "Safari on macOS" });
    vi.stubGlobal("fetch", backend.fetch);
    stubLocation(true);
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(<DesktopFindMy defaultList="devices" onSelectionChange={onSelectionChange} />);
    await waitFor(() => expect(rows("Devices")).toHaveLength(3));

    // Removed here.
    await user.click(rows("Devices")[2] as HTMLElement);
    expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: thirdId }));
    const card = screen.getByRole("region", { name: "Safari on macOS" });
    await removeFromCard(user, card);
    await waitFor(() => expect(rows("Devices")).toHaveLength(2));
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);

    // Removed elsewhere: the next read of the list (here after Play Sound finds it gone) no
    // longer has it.
    await user.click(rows("Devices")[1] as HTMLElement);
    expect(onSelectionChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: OTHER_ID }));
    backend.devices.delete(OTHER_ID);
    await user.click(
      within(screen.getByRole("region", { name: "Firefox on Linux" })).getByRole("button", {
        name: "Play Sound",
      }),
    );
    await waitFor(() => expect(rows("Devices")).toHaveLength(1));
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
    expect(screen.queryByRole("region", { name: "Firefox on Linux" })).not.toBeInTheDocument();
  });

  it("plays a sound asked of this browser, then clears the request", async () => {
    const started = stubAudio();
    const { calls, devices, user } = await openServed();
    await user.click(list("Devices"));
    await waitFor(() => expect(rows("Devices")).toHaveLength(2));
    await user.click(rows("Devices")[0] as HTMLElement);
    const card = screen.getByRole("region", { name: deviceLabel(navigator.userAgent) });
    expect(within(card).getByRole("button", { name: "Remove This Device" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(within(card).getByRole("button", { name: "Play Sound" }));
    await waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.method === "DELETE" &&
            call.url.startsWith(`/api/find-my/devices/${THIS_ID}/sound`),
        ),
      ).toBe(true),
    );
    expect(
      calls.some(
        (call) => call.method === "POST" && call.url === `/api/find-my/devices/${THIS_ID}/sound`,
      ),
    ).toBe(true);
    expect(started).toHaveBeenCalledTimes(3);
    expect(devices.get(THIS_ID)?.sound_pending).toBe(false);
    expect(await screen.findByText(/^Playing a sound on /)).toBeInTheDocument();
  });

  it("a read slower than the poll is still shown, and the poll sends no second read beside it", async () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
      shouldAdvanceTime: true,
    });
    try {
      vi.stubEnv("VITE_MACALICIOUS_API", "1");
      const backend = server();
      let reads = 0;
      vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
        if (url === "/api/find-my/devices" && (init?.method ?? "GET") === "GET") {
          reads += 1;
          await new Promise((resolve) => setTimeout(resolve, POLL_MS * 1.2));
        }
        return backend.fetch(url, init);
      });
      stubLocation(false);
      render(<DesktopFindMy defaultList="devices" />);
      await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 1.1));
      expect(reads, "the poll waits for the read already out").toBe(1);
      await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 0.2));
      await waitFor(() => expect(rows("Devices")).toHaveLength(1));
      expect(screen.queryByText("Loading Devices…")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("a Remove made while a slow read is out is followed by a read that shows it", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const backend = server();
    let hold: (() => void) | undefined;
    let reads = 0;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      if (url === "/api/find-my/devices" && (init?.method ?? "GET") === "GET") {
        reads += 1;
        // The second read (the poll's, after the window opened) is slow.
        if (reads === 2) {
          const answer = await backend.fetch(url, init);
          await new Promise<void>((resolve) => {
            hold = resolve;
          });
          return answer;
        }
      }
      return backend.fetch(url, init);
    });
    stubLocation(false);
    const user = userEvent.setup();
    render(<DesktopFindMy defaultList="devices" />);
    await waitFor(() => expect(rows("Devices")).toHaveLength(1));
    await user.click(rows("Devices")[0] as HTMLElement);
    const card = screen.getByRole("region", { name: "Firefox on Linux" });
    // A Play Sound starts the slow read; Remove is asked while it is out.
    await user.click(within(card).getByRole("button", { name: "Play Sound" }));
    await waitFor(() => expect(hold).toBeDefined());
    const removed = removeFromCard(user, card);
    await waitFor(() => expect(backend.devices.has(OTHER_ID)).toBe(false));
    hold?.();
    await removed;
    await waitFor(() => expect(screen.queryAllByRole("option")).toHaveLength(0));
    expect(reads, "one more read follows the slow one").toBe(3);
  });

  it("keeps the request when the tones never finish playing", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"], shouldAdvanceTime: true });
    try {
      const started = stubAudio({ ends: false });
      const { calls, devices } = await openServed();
      devices.set(THIS_ID, {
        ...THERE,
        id: THIS_ID,
        label: deviceLabel(navigator.userAgent),
        this: true,
        at: Date.now(),
        sound_pending: true,
        sound_request: "00000000000000ff",
      });
      await waitFor(() => expect(started).toHaveBeenCalledTimes(3));
      await act(() => vi.advanceTimersByTimeAsync(4_000));
      expect(
        calls.some((call) => call.method === "DELETE" && call.url.includes(`${THIS_ID}/sound`)),
        "a sound that did not finish is not cleared",
      ).toBe(false);
      expect(devices.get(THIS_ID)?.sound_pending).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("asks another device to play its sound, and removes it", async () => {
    const { calls, devices, user } = await openServed();
    await user.click(list("Devices"));
    await waitFor(() => expect(rows("Devices")).toHaveLength(2));
    await user.click(rows("Devices")[1] as HTMLElement);
    const card = screen.getByRole("region", { name: "Firefox on Linux" });
    await user.click(within(card).getByRole("button", { name: "Play Sound" }));
    expect(
      await screen.findByText("Firefox on Linux plays the sound when Find My is next open on it"),
    ).toBeInTheDocument();
    expect(devices.get(OTHER_ID)?.sound_pending).toBe(true);
    expect(
      calls.some((call) => call.method === "DELETE" && call.url.includes(`${OTHER_ID}/sound`)),
      "only the device itself clears its sound",
    ).toBe(false);
    await removeFromCard(user, card);
    await waitFor(() => expect(rows("Devices")).toHaveLength(1));
    expect(devices.has(OTHER_ID)).toBe(false);
    expect(await screen.findByText("Removed Firefox on Linux")).toBeInTheDocument();
  });

  it("keeps trying to clear a played sound until the server hears it", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      stubAudio();
      vi.stubEnv("VITE_MACALICIOUS_API", "1");
      const backend = server();
      backend.devices.set(THIS_ID, {
        id: THIS_ID,
        label: deviceLabel(navigator.userAgent),
        lat: HERE.latitude,
        lon: HERE.longitude,
        accuracy_m: HERE.accuracy,
        at: Date.now(),
        this: true,
        sound_pending: true,
        sound_request: "00000000000000a1",
      });
      // More failures than the earlier, bounded retry allowed.
      let failures = 8;
      vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
        if (init?.method === "DELETE" && url.includes(`${THIS_ID}/sound`) && failures > 0) {
          failures -= 1;
          return json(503, { error: "storage failed" });
        }
        return backend.fetch(url, init);
      });
      stubLocation(true);
      render(<DesktopFindMy />);
      for (let step = 0; step < 30 && backend.devices.get(THIS_ID)?.sound_pending; step++)
        await vi.advanceTimersByTimeAsync(30_000);
      expect(failures).toBe(0);
      expect(backend.devices.get(THIS_ID)?.sound_pending).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops reporting a position the browser withdrew, and Current Location starts again", async () => {
    const intervals = vi.spyOn(globalThis, "setInterval");
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const backend = server();
    vi.stubGlobal("fetch", backend.fetch);
    // The watch gives a position, then loses permission.
    let watcher: { ok: (position: unknown) => void; fail: (error: unknown) => void } | undefined;
    let allowed = true;
    const geolocation = {
      getCurrentPosition: vi.fn((ok: (p: unknown) => void, fail: (e: unknown) => void) =>
        allowed ? ok({ coords: { ...HERE, latitude: 40.7 } }) : fail({ code: 1 }),
      ),
      watchPosition: vi.fn((ok: (p: unknown) => void, fail: (e: unknown) => void) => {
        watcher = { ok, fail };
        if (allowed) ok({ coords: HERE });
        return 1;
      }),
      clearWatch: vi.fn(),
    };
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: geolocation });
    const user = userEvent.setup();
    render(<DesktopFindMy />);
    const reports = () =>
      backend.calls.filter((call) => call.url === "/api/find-my/me" && call.method === "PUT");
    await waitFor(() => expect(reports()).toHaveLength(1));
    const beat = intervals.mock.calls.find(([, ms]) => ms === HEARTBEAT_MS)?.[0] as () => void;

    // Permission withdrawn: the position is forgotten and the heartbeat sends nothing more.
    allowed = false;
    act(() => watcher?.fail({ code: 1 }));
    expect(rows("People")[0]).toHaveTextContent("Location not available");
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 2 * REPORT_EVERY_MS);
    act(() => beat());
    expect(reports()).toHaveLength(1);
    now.mockRestore();

    // Granted again: Current Location finds the position, reports it, and watches again.
    allowed = true;
    const watches = geolocation.watchPosition.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Show Your Current Location" }));
    await waitFor(() => expect(reports().some((call) => call.body?.lat === 40.7)).toBe(true));
    // And the restarted watch reports what it finds from then on.
    await waitFor(() => expect(geolocation.watchPosition.mock.calls.length).toBe(watches + 1));
    expect(geolocation.clearWatch).toHaveBeenCalled();
  });

  it("keeps a sound the browser blocked until a click in the window plays it", async () => {
    // The page may not play sound yet: the context stays suspended until a gesture.
    let audioState = "suspended";
    const started = vi.fn();
    class FakeAudioContext {
      get state() {
        return audioState;
      }
      currentTime = 0;
      destination = {};
      resume = async () => {};
      close = async () => {};
      createOscillator() {
        return fakeTone(started);
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
      }
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const backend = server();
    backend.devices.set(THIS_ID, {
      id: THIS_ID,
      label: deviceLabel(navigator.userAgent),
      lat: HERE.latitude,
      lon: HERE.longitude,
      accuracy_m: HERE.accuracy,
      at: Date.now(),
      this: true,
      sound_pending: true,
      sound_request: "00000000000000a1",
    });
    vi.stubGlobal("fetch", backend.fetch);
    stubLocation(true);
    render(<DesktopFindMy />);
    expect(
      await screen.findByText(
        /did not let the page play it\. Click in the window to play it\./,
        {},
        { timeout: 3_000 },
      ),
    ).toBeInTheDocument();
    const clears = () =>
      backend.calls.filter((call) => call.method === "DELETE" && call.url.includes("/sound"));
    // Not heard, so not cleared: the person who asked can still have it play.
    expect(clears()).toHaveLength(0);
    expect(backend.devices.get(THIS_ID)?.sound_pending).toBe(true);
    expect(started).not.toHaveBeenCalled();
    // A click lets the page play: the sound plays and only then is the request cleared.
    audioState = "running";
    fireEvent.pointerDown(screen.getByRole("region", { name: "Find My" }));
    await waitFor(() => expect(clears()).toHaveLength(1));
    expect(started).toHaveBeenCalled();
    expect(backend.devices.get(THIS_ID)?.sound_pending).toBe(false);
  });

  it("a sound asked while an earlier one plays is not cleared with it, and plays next", async () => {
    const started = stubAudio();
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const backend = server();
    backend.devices.set(THIS_ID, {
      id: THIS_ID,
      label: deviceLabel(navigator.userAgent),
      lat: HERE.latitude,
      lon: HERE.longitude,
      accuracy_m: HERE.accuracy,
      at: Date.now(),
      this: true,
      sound_pending: true,
      sound_request: "00000000000000a1",
    });
    let askedAgain = false;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      // Another browser asks again just before this one acknowledges the first request.
      if (init?.method === "DELETE" && url.includes(`${THIS_ID}/sound`) && !askedAgain) {
        askedAgain = true;
        await backend.fetch(`/api/find-my/devices/${THIS_ID}/sound`, {
          method: "POST",
          body: "{}",
        });
      }
      return backend.fetch(url, init);
    });
    stubLocation(true);
    render(<DesktopFindMy />);
    await waitFor(
      () =>
        expect(
          backend.calls.filter((call) => call.method === "DELETE" && call.url.includes("/sound")),
        ).toHaveLength(2),
      { timeout: 5_000 },
    );
    // Each acknowledgement named its own request: the second was not cleared by the first's, and
    // it was played in turn.
    expect(
      backend.calls
        .filter((call) => call.method === "DELETE" && call.url.includes("/sound"))
        .map((call) => call.url.split("?")[1]),
    ).toEqual(["request=00000000000000a1", "request=0000000000000001"]);
    expect(started).toHaveBeenCalledTimes(6);
    expect(backend.devices.get(THIS_ID)?.sound_pending).toBe(false);
  });

  it("says why the location is missing when the browser refuses it", async () => {
    const { calls, user } = await openServed(false);
    expect(rows("People")[0]).toHaveTextContent("Location not available");
    expect(screen.getByRole("status")).toHaveTextContent(/Location access is turned off/);
    expect(calls.some((call) => call.url === "/api/find-my/me")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Share My Location" }));
    expect(screen.getByRole("status")).toHaveTextContent(sharingNote(false));
  });

  it("shows the demo and asks nothing when not served", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<DesktopFindMy />);
    expect(screen.getByRole("img", { name: /placeholder for a map/i })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
