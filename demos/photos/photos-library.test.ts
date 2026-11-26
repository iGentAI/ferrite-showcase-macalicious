import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  lastDesktopPicture,
  takePictureChoice,
  takePictureTicket,
} from "../desktop/desktop-personal";
import { FILTERS } from "./photos-edit";
import {
  base64Of,
  changePhoto,
  type Decoded,
  dropUnregistered,
  LibraryError,
  type LibraryPhoto,
  libraryFromServer,
  photoFromServer,
  readThumbs,
  removePurged,
  setDesktopPicture,
} from "./photos-library";

// jsdom has no canvas: a picture is "rendered" and "encoded" by these stand-ins (their pixels are
// checked in photos-edit.test.ts).
vi.mock("./photos-edit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./photos-edit")>();
  return {
    ...actual,
    renderEdit: vi.fn(() => ({})),
    encodeJpeg: vi.fn(async () => new Blob(["jpeg"], { type: "image/jpeg" })),
  };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const module = readFileSync(
  path.resolve(__dirname, "../../ferrite-apps/desktop/src/apps/photos/mod.rs"),
  "utf8",
);
const rustList = (name: string) =>
  [
    ...(
      module.match(new RegExp(`pub const ${name}: &\\[&str\\] = &\\[([^\\]]*)\\]`))?.[1] ?? ""
    ).matchAll(/"([a-z/-]+)"/g),
  ].map((match) => match[1]);

const stored = {
  id: "p1",
  file: "f1",
  name: "Beach",
  mime: "image/jpeg",
  bytes: 300000,
  width: 4000,
  height: 3000,
  taken_ms: 1,
  added_ms: 2,
  source: "import",
  effect: null,
  camera: "Canon",
  favorite: true,
  deleted_ms: null,
  edit: { rotate: 1, filter: "mono" },
  edited_ms: 3,
};

describe("the Photos library client", () => {
  it("sends only the filters the module accepts", () => {
    expect(rustList("FILTERS")).toEqual(FILTERS.map((filter) => filter.id));
    expect(rustList("SOURCES")).toEqual(["import", "photo-booth"]);
  });

  it("reads only a library in the module's shape", () => {
    const library = libraryFromServer({
      photos: [stored],
      albums: [{ id: "a", name: "Trip", photos: ["p1", 7], created_ms: 4 }],
      purge: ["f0"],
      limits: { photos: 1000, recently_deleted_days: 30 },
    });
    expect(library?.photos[0]?.edit?.filter).toBe("mono");
    expect(library?.photos[0]?.edit?.rotate).toBe(1);
    expect(library?.albums[0]?.photos).toEqual(["p1"]);
    expect(library?.purge).toEqual(["f0"]);
    expect(libraryFromServer({ photos: [{ ...stored, bytes: "9" }], albums: [] })).toBeUndefined();
    expect(libraryFromServer({ photos: [], albums: "none" })).toBeUndefined();
    expect(libraryFromServer(null)).toBeUndefined();
    expect(photoFromServer({ ...stored, source: "elsewhere" })?.source).toBe("import");
  });

  it("sends a change with its thumbnail as base64, and repeats it once after a server failure", async () => {
    const answers = [
      { status: 503, body: { error: "busy" } },
      { status: 200, body: { photo: { ...stored, favorite: false } } },
    ];
    const fetch = vi.fn(async () => {
      const next = answers.shift() ?? { status: 500, body: {} };
      return new Response(JSON.stringify(next.body), { status: next.status });
    });
    vi.stubGlobal("fetch", fetch);
    const thumb = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: "image/jpeg" });
    const photo = await changePhoto("p1", { favorite: false, edit: null, thumb });
    expect(photo.favorite).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = fetch.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("/api/photos/photos/p1");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      favorite: false,
      edit: null,
      thumb: await base64Of(thumb),
    });
    expect(await base64Of(thumb)).toBe("/9j/4A==");
  });

  it("reads thumbnails in batches and decodes them", async () => {
    const fetch = vi.fn(async (url: string) => {
      const ids = decodeURIComponent(url.split("ids=")[1] ?? "").split(",");
      // "/9j/4A" in base64url without padding is the bytes ff d8 ff e0.
      return new Response(
        JSON.stringify({ thumbs: Object.fromEntries(ids.map((id) => [id, "_9j_4A"])) }),
      );
    });
    vi.stubGlobal("fetch", fetch);
    const ids = Array.from({ length: 50 }, (_, at) => `p${at}`);
    const thumbs = await readThumbs(ids);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(thumbs.size).toBe(50);
    const bytes = new Uint8Array(await (thumbs.get("p49") as Blob).arrayBuffer());
    expect([...bytes]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
  });

  it("says what the module refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "the library has no photo" }), { status: 404 }),
      ),
    );
    await expect(changePhoto("nope", { favorite: true })).rejects.toThrow(
      "the library has no photo",
    );
  });

  it("sends a request at most twice, whatever the first failure was", async () => {
    let sent = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        sent += 1;
        if (sent === 1) return new Response(JSON.stringify({ error: "busy" }), { status: 503 });
        throw new TypeError("network down");
      }),
    );
    await expect(changePhoto("p1", { favorite: true })).rejects.toMatchObject({
      message: "network down",
      ambiguous: true,
    });
    expect(sent).toBe(2);
  });

  it("removes the original of an import the library refused, and keeps one it took", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const removed: string[] = [];
    let kept: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/files/ops") {
          removed.push(JSON.parse(String(init?.body)).ops[0].id);
          return new Response(JSON.stringify({ entries: [], rev: 1, created: [] }));
        }
        return new Response(
          JSON.stringify({
            photos: kept.map((id) => ({ ...stored, id })),
            albums: [],
            purge: [],
          }),
        );
      }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // Refused (a full library), and the listing shows it is not kept: removed.
    await dropUnregistered("p1", "f1", new LibraryError("full", 409));
    // No answer, or a server failure: the registration may still commit, so the file stays even
    // though a listing shows no photo yet.
    await dropUnregistered("p2", "f2", new TypeError("network down"));
    await dropUnregistered("p3", "f3", new LibraryError("no reply", 0, true));
    await dropUnregistered("p5", "f5", new LibraryError("busy", 503));
    // Refused on a retry after an unanswered first attempt: still not a definite refusal.
    await dropUnregistered("p6", "f6", new LibraryError("session", 401, true));
    // A definite refusal, but the photo turns out to be kept: the file stays.
    kept = ["p4"];
    await dropUnregistered("p4", "f4", new LibraryError("session", 401));
    expect(removed).toEqual(["f1"]);
  });

  it("confirms only the originals the drive removed", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(String(init.body)) : null;
        calls.push({ url, body });
        if (url === "/api/files/ops") {
          const id = body.ops[0].id;
          // The drive has "gone" no more (already removed), and refuses "stuck".
          if (id === "gone")
            return new Response(JSON.stringify({ error: "no such entry" }), { status: 404 });
          if (id === "stuck") return new Response(JSON.stringify({ error: "no" }), { status: 400 });
          return new Response(JSON.stringify({ entries: [], rev: 1, created: [] }));
        }
        return new Response(JSON.stringify({ purge: ["stuck"] }));
      }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await removePurged(["done", "gone", "stuck"]);
    const confirmed = calls.find((call) => call.url === "/api/photos/purged");
    expect(confirmed?.body).toEqual({ files: ["done", "gone"] });
  });
});

describe("Set Desktop Picture", () => {
  const photo = { ...stored, edit: null } as unknown as LibraryPhoto;
  const decoded = (): Decoded => ({
    image: {} as CanvasImageSource,
    width: 40,
    height: 30,
    close: vi.fn(),
  });

  it("names the drawn photo to the desktop with the ticket taken when the person chose it", async () => {
    let made = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:picture-${++made}`);
    const ticket = takePictureTicket();
    expect(await setDesktopPicture(photo, ticket, async () => decoded())).toBe(true);
    expect(lastDesktopPicture()).toMatchObject({
      day: "blob:picture-1",
      night: "blob:picture-1",
      source: "photos",
      choice: ticket.choice,
      generation: ticket.generation,
    });
  });

  it("shows nothing when another picture is chosen while the photo is drawn", async () => {
    const created = vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:late");
    const ticket = takePictureTicket();
    const shownBefore = lastDesktopPicture();
    let release: (value: Decoded) => void = () => {};
    const asked = setDesktopPicture(
      photo,
      ticket,
      () =>
        new Promise<Decoded>((resolve) => {
          release = resolve;
        }),
    );
    // The person picks a picture in System Preferences meanwhile.
    takePictureChoice();
    const picture = decoded();
    release(picture);
    expect(await asked).toBe(false);
    expect(picture.close).toHaveBeenCalled();
    expect(created).not.toHaveBeenCalled();
    expect(lastDesktopPicture()).toBe(shownBefore);
  });
});
