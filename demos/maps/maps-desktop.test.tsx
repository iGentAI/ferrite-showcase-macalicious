import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Messages } from "../messages/messages";
import { useSharedMessage } from "../messages/messages-live";
import { DesktopMaps, isEditable } from "./maps-desktop";
import { normalHeading, turned, turnedVector } from "./maps-geo";
import { frameBesideList } from "./maps-search-list";
import {
  addRecent,
  droppedPin,
  placeFromServer,
  placeSuggestions,
  placesDocumentFromServer,
  type ServedPlace,
  withFavorite,
} from "./maps-server";

/** A place as the module answers Nominatim's "Golden Gate Bridge". */
const BRIDGE: ServedPlace = {
  id: "osm-r21407754",
  name: "Golden Gate Bridge",
  category: "Bridge",
  lat: 37.818292,
  lon: -122.478384,
  address: ["Golden Gate", "San Francisco, California 24129", "United States"],
  website: "http://goldengatebridge.org/",
  wikipedia: "https://en.wikipedia.org/wiki/Golden_Gate_Bridge",
};

const HERE = { latitude: 37.8075, longitude: -122.475, accuracy: 20 };

describe("a turned map", () => {
  it("turns a pixel clockwise about the view's middle, and back", () => {
    expect(turned({ x: 400, y: 200 }, 0, 800, 600)).toEqual({ x: 400, y: 200 });
    const right = turned({ x: 400, y: 200 }, 90, 800, 600);
    expect(right.x).toBeCloseTo(500, 6);
    expect(right.y).toBeCloseTo(300, 6);
    const back = turned(right, -90, 800, 600);
    expect(back.x).toBeCloseTo(400, 6);
    expect(back.y).toBeCloseTo(200, 6);
  });

  it("turns a movement the same way", () => {
    const moved = turnedVector({ x: 10, y: 0 }, 90);
    expect(moved.x).toBeCloseTo(0, 6);
    expect(moved.y).toBeCloseTo(10, 6);
  });

  it("brings a heading to 0 up to 360, and near north onto it", () => {
    expect(normalHeading(-90)).toBe(270);
    expect(normalHeading(450)).toBe(90);
    expect(normalHeading(358, 4)).toBe(0);
    expect(normalHeading(3, 4)).toBe(0);
    expect(normalHeading(5, 4)).toBe(5);
  });
});

describe("frameBesideList", () => {
  it("takes the list and its inset from the map's width, with the margins around what is left", () => {
    expect(frameBesideList(1000, 594)).toEqual({ width: 529, height: 498, offset: 187.5 });
  });

  it("leaves a narrow map room beside a list of half its width", () => {
    const { width, offset } = frameBesideList(380, 282);
    expect(offset).toBe(122.5);
    expect(width).toBeCloseTo(90, 6);
  });
});

describe("placeSuggestions", () => {
  const TOWER = { ...BRIDGE, id: "tower", name: "Coit Tower", address: ["San Francisco"] };
  const PARK = { ...BRIDGE, id: "park", name: "Apple Park", address: ["Cupertino"] };
  const doc = {
    favorites: [BRIDGE],
    recents: [PARK, BRIDGE, TOWER],
    guides: [{ id: "g", name: "Trip", places: [TOWER] }],
  };

  it("lists each of the person's places once, Favorites, then Guides, then Recents", () => {
    expect(placeSuggestions(doc, "").map(({ place, from }) => [place.name, from])).toEqual([
      ["Golden Gate Bridge", "Favorites"],
      ["Coit Tower", "Trip"],
      ["Apple Park", "Recents"],
    ]);
  });

  it("keeps the places holding every word typed, in the name or the address", () => {
    expect(placeSuggestions(doc, "  francisco COIT ").map(({ place }) => place.id)).toEqual([
      "tower",
    ]);
    expect(placeSuggestions(doc, "nowhere")).toEqual([]);
  });
});

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

/** The desktop's server, as far as Maps uses it: the module's routes. */
function server({
  search = 200,
  favorites = null,
}: {
  search?: number;
  favorites?: ServedPlace[] | null;
} = {}) {
  const calls: Call[] = [];
  let stored: Record<string, unknown> = { favorites, recents: null, guides: null };
  let rev = 0;
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : undefined;
    calls.push({ url, method, body });
    if (url === "/api/maps/places" && method === "GET")
      return json(200, { ...stored, rev, session: "session-1" });
    if (url === "/api/maps/places" && method === "PUT") {
      rev += 1;
      stored = { favorites: body?.favorites, recents: body?.recents, guides: body?.guides };
      return json(200, { ...stored, rev });
    }
    if (url.startsWith("/api/maps/search?"))
      return search === 200
        ? json(200, { query: "Golden Gate Bridge", places: [BRIDGE], cached: false })
        : json(search, { error: "Maps asks OpenStreetMap's search at most once a second" });
    if (url.startsWith("/api/maps/route?"))
      return json(200, {
        route: {
          distance_m: 1200,
          duration_s: 600,
          path: [
            [37.8075, -122.475],
            [37.818292, -122.478384],
          ],
          steps: [
            { text: "Head north", distance_m: 1200, lat: 37.8075, lon: -122.475 },
            { text: "Arrive at your destination", distance_m: 0, lat: 37.818292, lon: -122.478384 },
          ],
        },
        cached: false,
      });
    return json(404, { error: "not found" });
  });
  return { fetch, calls, stored: () => stored };
}

function stubLocation(allowed: boolean) {
  const geolocation = {
    getCurrentPosition: vi.fn((ok: (position: unknown) => void, fail: (error: unknown) => void) =>
      allowed ? ok({ coords: HERE }) : fail({ code: 1 }),
    ),
    watchPosition: vi.fn(() => 1),
    clearWatch: vi.fn(),
  };
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: geolocation });
  return geolocation;
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(600);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "geolocation");
});

const field = () => screen.getByRole("searchbox", { name: "Search for a place or address" });

/** Serve the window, search for the bridge and wait for its card. */
async function findTheBridge(options: { search?: number } = {}) {
  vi.stubEnv("VITE_MACALICIOUS_API", "1");
  const backend = server(options);
  vi.stubGlobal("fetch", backend.fetch);
  const user = userEvent.setup();
  render(<DesktopMaps />);
  await waitFor(() =>
    expect(backend.calls.some((call) => call.url === "/api/maps/places")).toBe(true),
  );
  await user.type(field(), "Golden Gate Bridge");
  return { ...backend, user };
}

describe("keys in the Places sidebar", () => {
  it("leaves a text control's own keys to it", () => {
    const field = document.createElement("input");
    const area = document.createElement("textarea");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.append(editable);
    const row = document.createElement("div");
    expect(isEditable(field)).toBe(true);
    expect(isEditable(area)).toBe(true);
    expect(isEditable(editable)).toBe(true);
    expect(isEditable(row)).toBe(false);
    expect(isEditable(null)).toBe(false);
    editable.remove();
  });
});

describe("Maps' replies from the desktop's server", () => {
  it("keeps only places in the module's shape, and only http(s) links", () => {
    expect(placeFromServer(BRIDGE)).toEqual(BRIDGE);
    expect(placeFromServer({ ...BRIDGE, id: "a/b" })).toBeUndefined();
    expect(placeFromServer({ ...BRIDGE, lat: 91 })).toBeUndefined();
    expect(placeFromServer({ ...BRIDGE, name: " " })).toBeUndefined();
    const unsafe = placeFromServer({
      ...BRIDGE,
      website: "javascript:alert(1)",
      wikipedia: "https://evil.example/wiki/x",
    });
    expect(unsafe?.website).toBeUndefined();
    expect(unsafe?.wikipedia).toBeUndefined();
    // A link is Wikipedia's by its host and path, never by text found anywhere in it.
    for (const disguised of [
      "https://evil.example/#.wikipedia.org/wiki/x",
      "https://evil.example/?u=.wikipedia.org/wiki/x",
      "https://en.wikipedia.org.evil.example/wiki/x",
      "https://user@en.wikipedia.org/wiki/x",
      "http://en.wikipedia.org/wiki/x",
      "https://en.wikipedia.org/w/index.php",
    ]) {
      expect(placeFromServer({ ...BRIDGE, wikipedia: disguised })?.wikipedia, disguised).toBe(
        undefined,
      );
    }
    expect(placeFromServer(BRIDGE)?.wikipedia).toBe(
      "https://en.wikipedia.org/wiki/Golden_Gate_Bridge",
    );
    expect(
      placeFromServer({ ...BRIDGE, wikipedia: "https://en.wikipedia.org:443/wiki/Paris" })
        ?.wikipedia,
    ).toBe("https://en.wikipedia.org:443/wiki/Paris");
  });

  it("reads the person's places only as a whole document, empty before the first save", () => {
    expect(
      placesDocumentFromServer({ favorites: null, recents: null, guides: null, rev: 0 }),
    ).toEqual({
      favorites: [],
      recents: [],
      guides: [],
    });
    const doc = placesDocumentFromServer({
      favorites: [BRIDGE],
      recents: [BRIDGE],
      guides: [{ id: "g1", name: "Bridges", places: [BRIDGE] }],
      rev: 3,
    });
    expect(doc?.favorites).toEqual([BRIDGE]);
    expect(doc?.guides.map((guide) => guide.name)).toEqual(["Bridges"]);
    // A document read only in part is no document: the window then saves nothing over it.
    const whole = { favorites: [BRIDGE], recents: [], guides: [], rev: 3 };
    expect(placesDocumentFromServer({})).toBeUndefined();
    expect(placesDocumentFromServer({ ...whole, rev: "3" })).toBeUndefined();
    // What another window gave has no revision, and is shown as it is.
    expect(placesDocumentFromServer({ ...whole, rev: undefined })?.favorites).toEqual([BRIDGE]);
    expect(placesDocumentFromServer({ ...whole, favorites: [BRIDGE, BRIDGE] })).toBeUndefined();
    expect(
      placesDocumentFromServer({ ...whole, favorites: [BRIDGE, { id: "x" }] }),
    ).toBeUndefined();
    expect(
      placesDocumentFromServer({ ...whole, guides: [{ id: "bad id", name: "x", places: [] }] }),
    ).toBeUndefined();
    expect(
      placesDocumentFromServer({ ...whole, guides: [{ id: "g1", name: "x", places: 3 }] }),
    ).toBeUndefined();
    expect(
      placesDocumentFromServer({ ...whole, recents: Array.from({ length: 31 }, () => BRIDGE) }),
    ).toBeUndefined();
    // A place the window would read without part of it: its document is not read either.
    expect(
      placesDocumentFromServer({ ...whole, favorites: [{ ...BRIDGE, address: ["ok", 3] }] }),
    ).toBeUndefined();
    expect(
      placesDocumentFromServer({
        ...whole,
        favorites: [{ ...BRIDGE, wikipedia: "https://evil.example/wiki/x" }],
      }),
    ).toBeUndefined();
    expect(
      placesDocumentFromServer({
        ...whole,
        favorites: [{ ...BRIDGE, wikipedia: "https://evil.example/#.wikipedia.org/wiki/x" }],
      }),
      "a stored place with a disguised Wikipedia link",
    ).toBeUndefined();
    expect(
      placesDocumentFromServer({ ...whole, favorites: [{ ...BRIDGE, website: "javascript:x" }] }),
    ).toBeUndefined();
    expect(placesDocumentFromServer("nope")).toBeUndefined();
    expect(placesDocumentFromServer({ favorites: 3 })).toBeUndefined();
  });

  it("keeps recents newest first and once", () => {
    const pin = droppedPin({ lat: 37.80001234, lon: -122.4 });
    expect(pin.id).toBe("pin-37.80001_-122.40000");
    expect(addRecent([BRIDGE, pin], BRIDGE).map((place) => place.id)).toEqual([BRIDGE.id, pin.id]);
    expect(addRecent([pin], BRIDGE)[0]).toBe(BRIDGE);
    const empty = { favorites: [], recents: [], guides: [] };
    expect(withFavorite(withFavorite(empty, BRIDGE, true), BRIDGE, false).favorites).toEqual([]);
  });
});

describe("Maps served by the desktop's Ferrite application", () => {
  it("searches on Return, shows the place's pin and card, and keeps it as a favorite", async () => {
    const { calls, stored, user } = await findTheBridge();
    expect(
      calls.some((call) => call.url.startsWith("/api/maps/search")),
      "nothing is searched while typing",
    ).toBe(false);
    await user.type(field(), "{Enter}");
    const card = await screen.findByRole("dialog", { name: "Golden Gate Bridge" });
    const search = calls.find((call) => call.url.startsWith("/api/maps/search"));
    expect(search?.url).toBe("/api/maps/search?q=Golden+Gate+Bridge&near=37.334900%2C-122.009000");
    expect(document.querySelector(`.mac-maps-pin[data-place="${BRIDGE.id}"]`)).toHaveAttribute(
      "data-selected",
    );
    expect(within(card).getByText("San Francisco, California 24129")).toBeInTheDocument();
    expect(within(card).getByText("37.81829° N, 122.47838° W")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Open Wikipedia" })).toHaveAttribute(
      "href",
      BRIDGE.wikipedia,
    );
    expect(within(card).getByRole("link", { name: "goldengatebridge.org" })).toHaveAttribute(
      "href",
      BRIDGE.website,
    );
    await user.click(within(card).getByRole("button", { name: "Favorite" }));
    await waitFor(() =>
      expect((stored().favorites as ServedPlace[] | null)?.[0]?.id).toBe(BRIDGE.id),
    );
    expect((stored().recents as ServedPlace[])[0]?.id).toBe(BRIDGE.id);
    expect(within(card).getByRole("button", { name: "Favorite" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("the card's Directions routes from the current location to the place", async () => {
    stubLocation(true);
    const { calls, user } = await findTheBridge();
    await user.type(field(), "{Enter}");
    const card = await screen.findByRole("dialog", { name: "Golden Gate Bridge" });
    await user.click(within(card).getByRole("button", { name: "Directions" }));
    const panel = await screen.findByRole("complementary", { name: "Directions" });
    expect(await within(panel).findByText("Head north")).toBeInTheDocument();
    expect(within(panel).getByText(/10 min/)).toBeInTheDocument();
    expect(within(panel).getByRole("textbox", { name: "End" })).toHaveValue("Golden Gate Bridge");
    const asked = calls.find((call) => call.url.startsWith("/api/maps/route"))?.url ?? "";
    expect(new URL(asked, "http://x").searchParams.get("to")).toBe("37.818292,-122.478384");
    expect(new URL(asked, "http://x").searchParams.get("mode")).toBe("driving");
  });

  it("Share starts a message holding the place's link, in the real Messages", async () => {
    const { user } = await findTheBridge();
    await user.type(field(), "{Enter}");
    await screen.findByRole("dialog", { name: "Golden Gate Bridge" });
    const toolbar = within(screen.getByRole("toolbar", { name: "Toolbar" }));
    const share = toolbar.getByRole("button", { name: "Share" });
    function Receiver() {
      return <Messages composeText={useSharedMessage()} />;
    }
    render(<Receiver />);
    await user.click(share);
    await user.click(await screen.findByRole("menuitem", { name: /Messages/ }));
    expect(await screen.findByRole("textbox", { name: "Message" })).toHaveValue(
      "Golden Gate Bridge https://www.openstreetmap.org/?mlat=37.81829&mlon=-122.47838#map=16/37.81829/-122.47838",
    );
  });

  it("the card's own Share closes the card, which would otherwise sit over the app it opens", async () => {
    const { user } = await findTheBridge();
    await user.type(field(), "{Enter}");
    const card = await screen.findByRole("dialog", { name: "Golden Gate Bridge" });
    await user.click(within(card).getByRole("button", { name: "Share" }));
    await user.click(await screen.findByRole("menuitem", { name: /Notes/ }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Golden Gate Bridge" })).toBeNull(),
    );
  });

  it("says why a search was refused, and why the location is not shown", async () => {
    stubLocation(false);
    const { user } = await findTheBridge({ search: 429 });
    await user.type(field(), "{Enter}");
    expect(
      await screen.findByText(
        "Search failed: Maps asks OpenStreetMap's search at most once a second",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show Your Current Location" }));
    expect(
      await screen.findByText(/Location access is turned off for this page/),
    ).toBeInTheDocument();
  });

  it("a pin dropped while a search is under way leaves the search field free", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const backend = server();
    // The first search is held until the pin has been dropped.
    let release: (() => void) | undefined;
    let held = false;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/maps/search?") && !held) {
        held = true;
        const answer = backend.fetch(url, init);
        return new Promise((resolve) => {
          release = () => resolve(answer);
        });
      }
      return backend.fetch(url, init);
    });
    const user = userEvent.setup();
    render(<DesktopMaps />);
    await user.type(field(), "Golden Gate Bridge{Enter}");
    await waitFor(() => expect(release).toBeTypeOf("function"));
    fireEvent.contextMenu(screen.getByRole("application"), { clientX: 400, clientY: 300 });
    await user.click(await screen.findByRole("menuitem", { name: "Drop Pin" }));
    await screen.findByRole("dialog", { name: "Dropped Pin" });
    // The pin replaced the search: Return searches again at once (the held first search was
    // recorded when it was sent, so the second makes two).
    await user.type(field(), "{Enter}");
    await waitFor(() =>
      expect(backend.calls.filter((call) => call.url.startsWith("/api/maps/search"))).toHaveLength(
        2,
      ),
    );
    release?.();
    await screen.findByRole("dialog", { name: "Golden Gate Bridge" });
  });

  it("a search answered after Clear brings back no place or card", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const backend = server();
    // The first search is held until the search field is cleared.
    let held: (() => void) | undefined;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/maps/search?") && !held) {
        const answer = backend.fetch(url, init);
        return new Promise((resolve) => {
          held = () => resolve(answer);
        });
      }
      return backend.fetch(url, init);
    });
    const user = userEvent.setup();
    render(<DesktopMaps />);
    await user.type(field(), "Golden Gate Bridge{Enter}");
    await waitFor(() => expect(held).toBeTypeOf("function"));
    await user.click(
      within(screen.getByRole("toolbar", { name: "Toolbar" })).getByRole("button", {
        name: "Clear",
      }),
    );
    held?.();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("dialog", { name: "Golden Gate Bridge" })).toBeNull();
    expect(document.querySelector(".mac-maps-pin")).toBeNull();
  });

  it("a place found before the person's places load is still added to the recents", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const backend = server();
    let release: (() => void) | undefined;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      if (url === "/api/maps/places" && (init?.method ?? "GET") === "GET" && !release) {
        const answer = backend.fetch(url, init);
        return new Promise((resolve) => {
          release = () => resolve(answer);
        });
      }
      return backend.fetch(url, init);
    });
    const user = userEvent.setup();
    render(<DesktopMaps />);
    await user.type(field(), "Golden Gate Bridge{Enter}");
    await screen.findByRole("dialog", { name: "Golden Gate Bridge" });
    release?.();
    await waitFor(() =>
      expect((backend.stored().recents as ServedPlace[] | null)?.map((p) => p.id)).toEqual([
        BRIDGE.id,
      ]),
    );
  });

  it("Favorite waits for the person's places to load, so it cannot overwrite them", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const backend = server();
    let release: (() => void) | undefined;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      if (url === "/api/maps/places" && (init?.method ?? "GET") === "GET" && !release) {
        const answer = backend.fetch(url, init);
        return new Promise((resolve) => {
          release = () => resolve(answer);
        });
      }
      return backend.fetch(url, init);
    });
    const user = userEvent.setup();
    render(<DesktopMaps />);
    await user.type(field(), "Golden Gate Bridge{Enter}");
    const card = await screen.findByRole("dialog", { name: "Golden Gate Bridge" });
    const favorite = within(card).getByRole("button", { name: "Favorite" });
    expect(favorite).toBeDisabled();
    await user.click(favorite);
    const puts = () =>
      backend.calls.filter((call) => call.url === "/api/maps/places" && call.method === "PUT");
    expect(puts()).toHaveLength(0);
    release?.();
    await waitFor(() => expect(favorite).toBeEnabled());
    await user.click(favorite);
    await waitFor(() =>
      expect((backend.stored().favorites as ServedPlace[] | null)?.[0]?.id).toBe(BRIDGE.id),
    );
  });

  it("a place chosen in the sidebar is not replaced by a search still on its way", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const FERRY: ServedPlace = {
      id: "osm-w24292339",
      name: "Ferry Building",
      category: "Building",
      lat: 37.7955,
      lon: -122.3937,
      address: ["San Francisco, California"],
    };
    const backend = server({ favorites: [FERRY] });
    let release: (() => void) | undefined;
    vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
      if (url.startsWith("/api/maps/search?") && !release) {
        const answer = backend.fetch(url, init);
        return new Promise((resolve) => {
          release = () => resolve(answer);
        });
      }
      return backend.fetch(url, init);
    });
    const user = userEvent.setup();
    render(<DesktopMaps />);
    await user.click(
      within(screen.getByRole("toolbar", { name: "Toolbar" })).getByRole("button", {
        name: "Places",
      }),
    );
    const sidebar = await screen.findByRole("tree", { name: "Places" });
    const ferry = await within(sidebar).findByRole("treeitem", { name: "Ferry Building" });
    await waitFor(() => expect(sidebar).not.toHaveAttribute("aria-busy"));
    // A search goes out and has not answered when the person picks a favorite.
    await user.type(field(), "Golden Gate Bridge{Enter}");
    await waitFor(() => expect(release).toBeTypeOf("function"));
    await user.click(ferry);
    expect(await screen.findByRole("dialog", { name: "Ferry Building" })).toBeInTheDocument();
    release?.();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("dialog", { name: "Golden Gate Bridge" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Ferry Building" })).toBeInTheDocument();
    const recents = (backend.stored().recents as ServedPlace[] | null) ?? [];
    expect(recents.some((place) => place.id === BRIDGE.id)).toBe(false);
  });

  it("Delete right after a row's click removes the row, with its card open", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const backend = server({ favorites: [BRIDGE] });
    vi.stubGlobal("fetch", backend.fetch);
    const user = userEvent.setup();
    render(<DesktopMaps />);
    // Places stays open from the test before: the panel is kept for the person.
    if (!screen.queryByRole("tree", { name: "Places" })) {
      await user.click(
        within(screen.getByRole("toolbar", { name: "Toolbar" })).getByRole("button", {
          name: "Places",
        }),
      );
    }
    const sidebar = await screen.findByRole("tree", { name: "Places" });
    const row = await within(sidebar).findByRole("treeitem", { name: "Golden Gate Bridge" });
    await waitFor(() => expect(sidebar).not.toHaveAttribute("aria-busy"));
    await user.click(row);
    await screen.findByRole("dialog", { name: "Golden Gate Bridge" });
    await user.keyboard("{Delete}");
    await waitFor(() => expect(backend.stored().favorites).toEqual([]));
  });

  it("a full Favorites list says so instead of dropping the place", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const full = Array.from({ length: 200 }, (_, n) => ({
      ...BRIDGE,
      id: `osm-n${n}`,
      name: `Place ${n}`,
    }));
    const backend = server({ favorites: full });
    vi.stubGlobal("fetch", backend.fetch);
    const user = userEvent.setup();
    render(<DesktopMaps />);
    await waitFor(() =>
      expect(backend.calls.some((call) => call.url === "/api/maps/places")).toBe(true),
    );
    await user.type(field(), "Golden Gate Bridge{Enter}");
    const card = await screen.findByRole("dialog", { name: "Golden Gate Bridge" });
    await user.click(within(card).getByRole("button", { name: "Favorite" }));
    expect(
      await screen.findByText(
        "Favorites holds at most 200 places. Remove one to add Golden Gate Bridge.",
      ),
    ).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Favorite" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows the demo and asks nothing when not served", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<DesktopMaps />);
    expect(screen.getByRole("img", { name: /placeholder for a map/ })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
