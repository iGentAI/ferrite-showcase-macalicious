import { afterEach, describe, expect, it, vi } from "vitest";
import { serverDocument } from "../desktop/desktop-server";
import type { LibraryPhoto } from "../photos/photos-library";
import { contactChoices, setContactPicture } from "./photo-booth-contact";

/*
 * The cards and pictures routes are a small fake that honours the revision as the real module does;
 * the real one runs in books-pictures-batch6-journey.mjs. The drawing is a stand-in: jsdom has no
 * canvas.
 */
const JPEG = "data:image/jpeg;base64,AAAA";
vi.mock("../photos/photos-library", async (original) => ({
  ...(await original<object>()),
  readOriginal: async () => new Blob(["photo"]),
  decodePicture: async () => ({ close: () => {} }),
}));
vi.mock("../photos/photos-edit", async (original) => ({
  ...(await original<object>()),
  renderEdit: () => ({}),
  encodeJpeg: async () => new Blob(["jpeg"]),
}));
vi.mock("../contacts/contacts-picture", async (original) => ({
  ...(await original<object>()),
  pictureFromBlob: async () => JPEG,
}));

afterEach(() => vi.unstubAllGlobals());

function serve(start: readonly object[] | null) {
  const state = {
    cards: start,
    rev: 1,
    pictures: new Map<string, { version: string; image: string }>(),
    refuseNext: false,
  };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      if (url.startsWith("/api/contacts/pictures/")) {
        const id = url.slice("/api/contacts/pictures/".length).split("?")[0] as string;
        if (method === "PUT") {
          state.pictures.set(id, body);
          return reply({ card: id, version: body.version });
        }
        state.pictures.delete(id);
        return reply({ card: id });
      }
      if (method === "PUT") {
        if (body.rev !== state.rev || state.refuseNext) {
          state.refuseNext = false;
          return reply({ cards: state.cards, rev: state.rev }, 409);
        }
        state.rev += 1;
        state.cards = body.cards;
        return reply({ cards: state.cards, rev: state.rev });
      }
      return reply({ cards: state.cards, rev: state.rev });
    }),
  );
  return state;
}

const PHOTO = { id: "p", file: "f", mime: "image/jpeg", edit: null } as unknown as LibraryPhoto;
const ADA = { id: "ada", account: "mac", first: "Ada", last: "Lovelace", note: "kept" };
const BEA = { id: "bea", account: "mac", first: "Bea", last: "Arthur" };

describe("a Photo Booth picture as a contact's picture", () => {
  it("lists the cards as Contacts sorts them, and none before any is saved", async () => {
    serve([ADA, BEA]);
    expect(await contactChoices()).toEqual([
      { id: "bea", name: "Bea Arthur" },
      { id: "ada", name: "Ada Lovelace" },
    ]);
    serve(null);
    expect(await contactChoices()).toEqual([]);
  });

  it("keeps the picture beside the cards and names it by that card alone", async () => {
    const state = serve([ADA, BEA]);
    await serverDocument("/api/contacts/cards").load();
    await setContactPicture(PHOTO, "ada");
    const [ada, bea] = state.cards as { id: string; image?: string; note?: string }[];
    expect(ada?.image).toMatch(/^p-/);
    expect(ada?.note).toBe("kept");
    expect(bea).toEqual(BEA);
    expect(state.pictures.get("ada")).toEqual({ version: ada?.image, image: JPEG });
  });

  it("takes the picture back and says so when the card has gone", async () => {
    const state = serve([BEA]);
    await expect(setContactPicture(PHOTO, "ada")).rejects.toThrow("that card is no longer there");
    expect(state.pictures.size).toBe(0);
  });
});
