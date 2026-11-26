import { afterEach, describe, expect, it, vi } from "vitest";
import { takeMapsDirections, takeMapsSearch } from "../maps/maps-open";
import { musicPlayer } from "../music/music-player";
import { takeOpenUrlRequests } from "./desktop-open-url";
import { takeAddressRequests } from "./desktop-reach";
import { answerHere, followUp, weatherPlaceOf } from "./desktop-siri-answers";

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe("what Siri answers on the desktop", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    takeOpenUrlRequests();
  });

  it("leaves everything else to the server", async () => {
    expect(await answerHere("make a note saying search the web for tulips")).toBeNull();
    expect(await answerHere("what time is it")).toBeNull();
    expect(await answerHere("open calculator")).toBeNull();
    expect(await answerHere("open the fish preferences")).toBeNull();
  });

  it("opens a web search in Safari", async () => {
    const reply = await answerHere("Search the web for tulips?");
    expect(reply?.text).toBe("Searching the web for “tulips”.");
    expect(takeOpenUrlRequests()).toEqual([
      { url: expect.stringContaining("search=tulips"), from: "siri" },
    ]);
  });

  it("tells the time in a city the browser knows, and says when it does not", async () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 0, 15, 12, 5) });
    expect((await answerHere("what time is it in tokyo"))?.text).toBe("It’s 9:05 PM in Tokyo.");
    expect((await answerHere("What's the time in New York?"))?.text).toBe(
      "It’s 7:05 AM in New York.",
    );
    expect((await answerHere("what time is it in atlantis"))?.text).toBe(
      "I don’t know the time in Atlantis.",
    );
  });

  it("says the weather from the server, with its source and time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("/api/weather/places")) {
          expect(url).toBe("/api/weather/places?q=Paris");
          return ok({ places: [{ name: "Paris", lat: 48.85, lon: 2.35 }] });
        }
        expect(url).toBe("/api/weather/forecast?lat=48.85&lon=2.35");
        return ok({
          temperature_c: 20,
          condition: "Partly Cloudy",
          observed: "2026-11-06T14:30",
          source: "Open-Meteo",
          days: [
            { date: "2026-11-06", high_c: 25, low_c: 10, condition: "Partly Cloudy" },
            { date: "2026-11-07", high_c: 15, low_c: 5, condition: "Rain" },
          ],
        });
      }),
    );
    const now = await answerHere("What's the weather in Paris?");
    expect(now?.text).toBe("Right now in Paris it’s 68°: partly cloudy.");
    expect(now?.card).toEqual({
      title: "Weather",
      app: "maps",
      lead: "Paris 68°, Partly Cloudy",
      detail: "High 77°, low 50°. Open-Meteo, as of 2:30 PM local time.",
      items: [{ text: "Sat: 59° / 41°, Rain" }],
    });
    expect((await answerHere("will it rain in Paris tomorrow"))?.text).toBe(
      "Tomorrow in Paris: rain, with a high of 59° and a low of 41°.",
    );
  });

  it("says when the weather's source is down, and invents nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ unavailable: "Open-Meteo: the source did not answer in time" }),
      })),
    );
    expect((await answerHere("weather in Paris"))?.text).toBe(
      "The weather isn’t available right now. Open-Meteo: the source did not answer in time",
    );
  });

  it("asks where, when no place is named or chosen", async () => {
    for (const asked of ["weather", "will it rain tomorrow"]) {
      expect((await answerHere(asked))?.text).toBe(
        "I don’t know where you are. Ask about a place by name, or choose one in the Weather widget in Notification Center.",
      );
    }
  });

  it("finds the place a weather request names", () => {
    expect(weatherPlaceOf("What's the weather in Paris")).toBe("Paris");
    expect(weatherPlaceOf("will it rain in New York tomorrow")).toBe("New York");
    expect(weatherPlaceOf("weather Oslo")).toBe("Oslo");
    expect(weatherPlaceOf("what's the weather like today")).toBeUndefined();
    expect(weatherPlaceOf("weather")).toBeUndefined();
  });

  it("shows a place in Maps", async () => {
    const reply = await answerHere("Directions to the Eiffel Tower");
    expect(reply?.text).toBe("Here’s The Eiffel Tower in Maps.");
    expect(takeMapsSearch()).toBe("the Eiffel Tower");
  });

  it("reads a stock's quote and says when it cannot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        ok({
          quotes: url.includes("AAPL") ? [{ symbol: "AAPL", price: 187.2, change: -1.5 }] : [],
        }),
      ),
    );
    const reply = await answerHere("how is aapl stock doing?");
    expect(reply?.text).toBe("AAPL is at 187.20, down 1.50.");
    expect(reply?.card?.app).toBe("stocks");
    expect((await answerHere("stock price of zzz"))?.text).toBe("I couldn’t get a quote for ZZZ.");
  });

  it("starts a message to an address or a person in Contacts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ok({
          cards: [
            {
              id: "c1",
              account: "mac",
              first: "Ada",
              last: "Lovelace",
              emails: [{ label: "work", value: "ada@example.com" }],
            },
            { id: "c2", account: "mac", first: "Bob", last: "Stone" },
          ],
          rev: 1,
        }),
      ),
    );
    expect((await answerHere("email ada"))?.text).toBe("Here’s a new message to Ada Lovelace.");
    expect((await answerHere("send an email to me@example.com about lunch"))?.text).toBe(
      "Here’s a new message to me@example.com, about lunch.",
    );
    expect(takeAddressRequests("mail").map(({ to, subject }) => [to, subject])).toEqual([
      ["ada@example.com", undefined],
      ["me@example.com", "Lunch"],
    ]);
    expect((await answerHere("email bob"))?.text).toBe("I don’t have an email address for Bob.");
  });

  it("plays a song found by name, once the player knows it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ok({ results: [{ kind: "music", app: "music", id: "s1", title: "Blue Train" }] }),
      ),
    );
    const player = musicPlayer();
    const lookup = vi.spyOn(player, "lookup").mockReturnValue({ id: "s1" } as never);
    const playQueue = vi.spyOn(player, "playQueue").mockImplementation(() => {});
    expect((await answerHere("play blue train"))?.text).toBe("Playing “Blue Train”.");
    expect(playQueue).toHaveBeenCalledWith(["s1"]);
    lookup.mockRestore();
    playQueue.mockRestore();
  });

  it("waits for the player, says when a song is not ready, and gives way to a later request", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ok({ results: [{ kind: "music", app: "music", id: "s2", title: "So What" }] }),
      ),
    );
    const player = musicPlayer();
    const lookup = vi.spyOn(player, "lookup").mockReturnValue(undefined);
    const playQueue = vi.spyOn(player, "playQueue").mockImplementation(() => {});
    try {
      const never = answerHere("play so what");
      await vi.advanceTimersByTimeAsync(11_000);
      expect((await never)?.text).toMatch(/isn’t ready to play/);
      expect(playQueue).not.toHaveBeenCalled();

      const waiting = answerHere("play so what");
      await vi.advanceTimersByTimeAsync(300);
      await answerHere("pause the music");
      lookup.mockReturnValue({ id: "s2" } as never);
      await vi.advanceTimersByTimeAsync(300);
      expect((await waiting)?.text).toMatch(/what you asked since/);
      expect(playQueue).not.toHaveBeenCalled();

      // A search still under way gives way as well, before it opens anything.
      let answerSearch: (reply: unknown) => void = () => {};
      vi.stubGlobal(
        "fetch",
        vi.fn(
          () =>
            new Promise((resolve) => {
              answerSearch = resolve;
            }),
        ),
      );
      const searching = answerHere("play so what");
      await vi.advanceTimersByTimeAsync(10);
      await answerHere("pause the music");
      answerSearch(ok({ results: [{ kind: "music", app: "music", id: "s2", title: "So What" }] }));
      expect((await searching)?.text).toMatch(/what you asked since/);
      expect(playQueue).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      lookup.mockRestore();
      playQueue.mockRestore();
    }
  });

  it("asks Maps for a route to the place it finds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ok({
          places: [{ id: "p1", name: "Eiffel Tower", category: "", lat: 48, lon: 2, address: [] }],
        }),
      ),
    );
    expect((await answerHere("Directions to the Eiffel Tower"))?.text).toBe(
      "Here are directions to Eiffel Tower.",
    );
    expect(takeMapsDirections()?.id).toBe("p1");
  });

  it("finds a company's symbol for its quote", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/search")
          ? ok({ results: [{ symbol: "AAPL", name: "Apple Inc." }] })
          : ok({
              quotes: url.includes("AAPL") ? [{ symbol: "AAPL", price: 187.2, change: 1.5 }] : [],
            }),
      ),
    );
    const reply = await answerHere("how is apple stock doing");
    expect(reply?.text).toBe("AAPL is at 187.20, up 1.50.");
    expect(reply?.card?.lead).toBe("187.20");
  });

  it("lists files by kind and by date, newest first", async () => {
    const at = Date.now();
    const entry = (id: string, type: string, modified_ms: number) => ({
      id,
      name: `${id}.bin`,
      kind: "file",
      type,
      modified_ms,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ok({
          entries: [
            entry("old", "application/pdf", at - 40 * 86_400_000),
            entry("new", "application/pdf", at),
            entry("pic", "image/png", at - 1),
            { ...entry("gone", "application/pdf", at), trashed_ms: at },
          ],
        }),
      ),
    );
    const pdfs = await answerHere("show me my pdfs");
    expect(pdfs?.text).toBe("I found 2 PDFs.");
    expect(pdfs?.card?.items.map(({ id }) => id)).toEqual(["new", "old"]);
    const today = await answerHere("find my files from today");
    expect(today?.card?.items.map(({ id }) => id)).toEqual(["new", "pic"]);
    expect((await answerHere("find my movies from yesterday"))?.text).toBe(
      "I couldn’t find any movies from yesterday.",
    );
  });

  it("says a follow-up in full from the request before it", () => {
    expect(followUp("what about London", "What time is it in Paris")).toBe(
      "What time is it in London",
    );
    expect(followUp("and tomorrow", "What's on my calendar today?")).toBe(
      "What's on my calendar tomorrow",
    );
    expect(followUp("how about MSFT", "how is aapl stock doing")).toBe("How is MSFT stock doing");
    expect(followUp("what about Rome", "Open Calculator")).toBe("what about Rome");
    expect(followUp("what about Rome", null)).toBe("what about Rome");
  });

  it("says it cannot change the last thing, rather than doing something else", async () => {
    expect((await answerHere("change it to 5"))?.text).toMatch(/can’t change that/);
  });

  it("takes a whole name, and asks which when two people have it", async () => {
    const person = (id: string, first: string, last: string) => ({
      id,
      account: "mac",
      first,
      last,
      emails: [{ label: "work", value: `${id}@example.com` }],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ok({
          cards: [
            person("joanna", "Joanna", "Reed"),
            person("ann", "Ann", "Hart"),
            person("sam1", "Sam", "Lee"),
            person("sam2", "Sam", "Roy"),
          ],
          rev: 1,
        }),
      ),
    );
    expect((await answerHere("email ann"))?.text).toBe("Here’s a new message to Ann Hart.");
    expect(takeAddressRequests("mail").map((request) => request.to)).toEqual(["ann@example.com"]);
    expect((await answerHere("email sam"))?.text).toBe("Which Sam do you mean: Sam Lee, Sam Roy?");
    expect(takeAddressRequests("mail")).toEqual([]);
    expect((await answerHere("email sam roy"))?.text).toBe("Here’s a new message to Sam Roy.");
    takeAddressRequests("mail");
  });

  it("opens Music when it has nothing to play", async () => {
    expect((await answerHere("pause the music"))?.text).toBe(
      "Music has nothing to play yet, so I opened it for you.",
    );
  });

  it("works Music's player when it holds a song", async () => {
    const player = musicPlayer();
    vi.spyOn(player, "current").mockReturnValue({ title: "Blue Train" } as never);
    const pause = vi.spyOn(player, "pause").mockImplementation(() => {});
    const next = vi.spyOn(player, "next").mockImplementation(() => {});
    expect((await answerHere("pause the music"))?.text).toBe("Paused.");
    expect(pause).toHaveBeenCalledOnce();
    expect((await answerHere("skip this song"))?.text).toBe("Playing “Blue Train”.");
    expect(next).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it("lists the files found, each with its id, and says when there are none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        ok({
          results: url.includes("tulip")
            ? [{ kind: "files", app: "finder", id: "f1", title: "Tulips.txt" }]
            : [],
        }),
      ),
    );
    const reply = await answerHere("find files about tulips");
    expect(reply?.text).toBe("I found 1 file.");
    expect(reply?.card).toEqual({
      title: "Files",
      app: "finder",
      items: [{ text: "Tulips.txt", id: "f1" }],
    });
    expect((await answerHere("find my files called ferns"))?.text).toBe(
      "I couldn’t find any files about “ferns”.",
    );
  });

  it("finds photos among what the search finds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ok({
          results: [
            { kind: "notes", app: "notes", id: "n", title: "Beach note" },
            { kind: "photos", app: "photos", id: "p", title: "Beach" },
          ],
        }),
      ),
    );
    const reply = await answerHere("show me photos of the beach");
    expect(reply?.text).toBe("I found 1 photo.");
    expect(reply?.card?.items).toEqual([{ text: "Beach", id: "p" }]);
  });

  it.each([401, 500])("says it cannot reach them when the search answers %i", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status })),
    );
    expect((await answerHere("find files about tulips"))?.text).toBe(
      "I can’t reach your files right now.",
    );
    expect((await answerHere("show me photos of the beach"))?.text).toBe(
      "I can’t reach your photos right now.",
    );
  });

  it("says there are none when the search finds nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ok({ results: [] })),
    );
    expect((await answerHere("show me photos of the beach"))?.text).toBe(
      "I couldn’t find any photos of “the beach”.",
    );
  });
});
