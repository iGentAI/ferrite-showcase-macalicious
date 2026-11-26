import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyHome, type HomeDefinition } from "./home-data";
import { findScene, onRunSceneRequest, runSceneAnswer, sceneNameIn } from "./home-siri";

const home: HomeDefinition = {
  ...emptyHome,
  id: "flat",
  name: "Flat",
  rooms: ["Hall"],
  accessories: [{ id: "lamp", room: "Hall", name: "Lamp", kind: "light", on: false }],
  scenes: [{ id: "evening", name: "Evening", icon: "house", sets: { lamp: true } }],
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("Siri and Home's scenes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the scene's name out of a request that asks for one", () => {
    expect(sceneNameIn("Set the Evening scene.")).toBe("Evening");
    expect(sceneNameIn("hey siri, run Good Night")).toBe("Good Night");
    expect(sceneNameIn("turn on my evening")).toBe("evening");
    expect(sceneNameIn("What is the time?")).toBeNull();
  });

  it("finds a scene by its name in any case, through the homes in order", () => {
    expect(findScene([home], "EVENING")?.home.name).toBe("Flat");
    expect(findScene([home], "Night")).toBeUndefined();
  });

  it("runs the scene on the stored homes, reading again when another save came first", async () => {
    const puts: { rev: number; on: boolean }[] = [];
    const fetched = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method !== "PUT") return json(200, { homes: [home], rev: 4 + puts.length });
      const body = JSON.parse(String(init.body));
      puts.push({ rev: body.rev, on: body.homes[0].accessories[0].on });
      return puts.length === 1 ? json(409, {}) : json(200, { rev: 9 });
    });
    vi.stubGlobal("fetch", fetched);
    const answer = await runSceneAnswer("set the evening scene");
    expect(answer?.text).toBe(
      "Running “Evening” in Flat. Its accessories are simulated, so nothing in the world changed.",
    );
    expect(answer?.card).toEqual({
      title: "Home",
      app: "home",
      items: [{ text: "Evening", id: "evening" }],
    });
    expect(puts).toEqual([
      { rev: 4, on: true },
      { rev: 5, on: true },
    ]);
  });

  it("leaves it to an open window, which holds the homes, and writes nothing itself", async () => {
    const fetched = vi.fn(async () => json(200, { homes: [home], rev: 1 }));
    vi.stubGlobal("fetch", fetched);
    const heard: unknown[] = [];
    const stop = onRunSceneRequest((request) => heard.push(request));
    await runSceneAnswer("run evening");
    stop();
    expect(heard).toEqual([{ home: "flat", scene: "evening" }]);
    expect(fetched).toHaveBeenCalledTimes(1);
  });

  it("answers nothing for a name no home has, and takes a bare name only when told to", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(200, { homes: [home], rev: 1 })),
    );
    expect(await runSceneAnswer("set a timer")).toBeNull();
    expect(await runSceneAnswer("evening")).toBeNull();
    const stop = onRunSceneRequest(() => {});
    expect((await runSceneAnswer("evening.", true))?.understood).toBe(true);
    stop();
  });
});
