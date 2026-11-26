import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import type { SiriAnswer } from "../desktop/desktop-siri";
import { applyScene, type HomeDefinition, type HomeScene } from "./home-data";
import { HOME_HOMES_URL, homesFromServer, homesToServer } from "./home-server";

/** Told to an open Home window, which runs the scene on what it holds. */
const RUN_SCENE_EVENT = "macalicious:home-run-scene";

export interface RunSceneRequest {
  home: string;
  scene: string;
}

/** An open Home window hears a scene Siri was asked to run. Answers the function that stops. */
export function onRunSceneRequest(listener: (request: RunSceneRequest) => void): () => void {
  const hear = (event: Event) => {
    event.preventDefault();
    listener((event as CustomEvent<RunSceneRequest>).detail);
  };
  window.addEventListener(RUN_SCENE_EVENT, hear);
  return () => window.removeEventListener(RUN_SCENE_EVENT, hear);
}

const ASKS_FOR_A_SCENE =
  /^(?:please |hey siri,? |siri,? )*(?:run|set|activate|start|turn on|switch on)\s+(?:the\s+|my\s+)?(.+?)(?:\s+scene)?[.!?]*$/i;

/** The scene's name a request asks for: "set the Evening scene", "run Evening". */
export function sceneNameIn(request: string): string | null {
  return ASKS_FOR_A_SCENE.exec(request.trim())?.[1] ?? null;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The first scene of that name, through the person's homes in order. */
export function findScene(
  homes: readonly HomeDefinition[],
  name: string,
): { home: HomeDefinition; scene: HomeScene } | undefined {
  for (const home of homes) {
    const scene = home.scenes.find((each) => same(each.name, name));
    if (scene) return { home, scene };
  }
  return undefined;
}

const MOST_ATTEMPTS = 4;

async function readHomes(signal: AbortSignal) {
  const reply = await sessionFetch(HOME_HOMES_URL, { credentials: "same-origin", signal });
  if (!reply.ok) throw new Error(`Home answered ${reply.status}`);
  const body = (await reply.json()) as { rev?: number };
  return { homes: homesFromServer(body) ?? [], rev: body.rev ?? 0 };
}

/** Runs the scene on the stored homes, reading again when another save came first. */
async function runOnServer(name: string, sceneId: string): Promise<void> {
  await withDeadline(async (signal) => {
    for (let attempt = 0; attempt < MOST_ATTEMPTS; attempt += 1) {
      const { homes, rev } = await readHomes(signal);
      const next = homes.map((home) => {
        const scene = home.scenes.find((each) => each.id === sceneId);
        return scene ? { ...home, accessories: applyScene(scene, home.accessories) } : home;
      });
      const reply = await sessionFetch(HOME_HOMES_URL, {
        method: "PUT",
        credentials: "same-origin",
        signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...homesToServer(next), rev }),
      });
      if (reply.ok) return;
      if (reply.status !== 409) throw new Error(`Home answered ${reply.status}`);
    }
    throw new Error(`Home kept changing while “${name}” ran.`);
  });
}

/**
 * Siri's answer to a request that names a scene, or `null` when none of the person's homes has one
 * of that name. With `bare`, the whole request may be the name ("Good Night"), as a Mac's Siri
 * takes it; otherwise it must ask for it ("set Good Night").
 */
export async function runSceneAnswer(request: string, bare = false): Promise<SiriAnswer | null> {
  const asked = bare ? request.replace(/[.!?]+$/, "") : sceneNameIn(request);
  if (!asked) return null;
  const { homes } = await withDeadline((signal) => readHomes(signal));
  const found = findScene(homes, asked);
  if (!found) return null;
  const { home, scene } = found;
  const told = new CustomEvent<RunSceneRequest>(RUN_SCENE_EVENT, {
    cancelable: true,
    detail: { home: home.id, scene: scene.id },
  });
  window.dispatchEvent(told);
  if (!told.defaultPrevented) await runOnServer(scene.name, scene.id);
  return {
    text: `Running “${scene.name}” in ${home.name}. Its accessories are simulated, so nothing in the world changed.`,
    card: { title: "Home", app: "home", items: [{ text: scene.name, id: scene.id }] },
    effects: [],
    via: "commands",
    understood: true,
  };
}
