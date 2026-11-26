import { useEffect, useMemo, useState } from "react";
import type { DesktopApp } from "./desktop-apps";
import {
  onSaveFailure,
  servedByDesktopApp,
  serverDocument,
  sessionFetch,
  useServerState,
} from "./desktop-server";

/**
 * Which apps a session has, when the desktop is served by the `macalicious-desktop` Ferrite
 * application (`ferrite-apps/desktop`): the server's catalogue of the desktop's apps
 * (`GET /api/apps`, `src/apps/catalogue.rs`), the apps the session got from the App Store
 * (`/api/app-store/library`) and Launchpad's order and page (`/api/launchpad/layout`). The Dock
 * and Launchpad show the apps that come with the desktop and those got; every other build shows
 * every app, as before.
 */

export const APPS_URL = "/api/apps";
export const APP_STORE_LIBRARY_URL = "/api/app-store/library";
export const LAUNCHPAD_LAYOUT_URL = "/api/launchpad/layout";

/** One app of the server's catalogue. */
export interface CatalogueApp {
  /** The demo folder's name. */
  id: string;
  name: string;
  /** `productivity`, `internet`, `media`, `creativity`, `utilities`, `system` or `games`. */
  category: string;
  /** One line about the app. */
  summary: string;
  /** Whether it comes with the desktop; the App Store sells the others. */
  preinstalled: boolean;
}

const isCatalogueApp = (value: unknown): value is CatalogueApp => {
  const app = value as Record<string, unknown> | null;
  return (
    typeof app === "object" &&
    app !== null &&
    typeof app.id === "string" &&
    typeof app.name === "string" &&
    typeof app.category === "string" &&
    typeof app.summary === "string" &&
    typeof app.preinstalled === "boolean"
  );
};

/** The catalogue of a `GET /api/apps` reply, or `undefined` when it holds none it can read. */
export function catalogueFromServer(reply: unknown): CatalogueApp[] | undefined {
  const catalogue = (reply as { catalogue?: unknown } | null)?.catalogue;
  return Array.isArray(catalogue) && catalogue.every(isCatalogueApp) ? catalogue : undefined;
}

let catalogueRequest: Promise<CatalogueApp[] | undefined> | null = null;

/** The server's catalogue, read once per page; a failed read is tried again by the next caller. */
export function loadCatalogue(): Promise<CatalogueApp[] | undefined> {
  if (!catalogueRequest) {
    const request = sessionFetch(APPS_URL, {
      credentials: "same-origin",
      headers: { accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .then(catalogueFromServer)
      .catch(() => undefined);
    catalogueRequest = request;
    void request.then((catalogue) => {
      if (!catalogue && catalogueRequest === request) catalogueRequest = null;
    });
  }
  return catalogueRequest;
}

/** The catalogue (`undefined` until read, and when it could not be) and whether the read ended. */
export function useCatalogue(enabled: boolean) {
  const [state, setState] = useState<{ catalogue?: CatalogueApp[]; settled: boolean }>({
    settled: false,
  });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void loadCatalogue().then((catalogue) => {
      if (live) setState({ catalogue, settled: true });
    });
    return () => {
      live = false;
    };
  }, [enabled]);
  return state;
}

const isIds = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((id) => typeof id === "string");

/** The apps a library reply lists: `[]` before the session got any, `undefined` if unreadable. */
export function installedFromServer(reply: unknown): string[] | undefined {
  const installed = (reply as { installed?: unknown } | null)?.installed;
  if (installed === null) return [];
  return isIds(installed) ? installed : undefined;
}

/**
 * Why a change of the library failed before anything was sent: the library could not be read.
 * Any other failure is a save the server did not keep, which the page's channel sends again with
 * its next read of the library (until the page is reloaded).
 */
export class LibraryUnreadable extends Error {
  constructor() {
    super("The library could not be read.");
    this.name = "LibraryUnreadable";
  }
}

/** The library's changes made by `addToLibrary` and `removeFromLibrary`, one after another. */
let libraryChanges: Promise<unknown> = Promise.resolve();

/**
 * Changes the person's library on the server, through the same channel every window of the
 * library watches (so the Dock and Launchpad follow), one change at a time: `change` is given the
 * stored ids and answers the next ones, or `undefined` for no change. Resolves only once the
 * server holds the result; rejects when the library cannot be read or the save failed, so the
 * caller can say so and try again.
 */
function changeLibrary(change: (stored: string[]) => string[] | undefined): Promise<void> {
  const run = libraryChanges.then(async () => {
    let failed = false;
    const stop = onSaveFailure((failure) => {
      if (failure.url === APP_STORE_LIBRARY_URL) failed = true;
    });
    try {
      const library = serverDocument(APP_STORE_LIBRARY_URL);
      const stored = installedFromServer(await library.load());
      if (!stored) throw new LibraryUnreadable();
      const next = change(stored);
      if (next) library.save({ installed: next });
      // A body an earlier save failed to store is sent again by the load: wait for it too.
      await library.idle();
    } finally {
      stop();
    }
    if (failed) throw new Error("The library could not be saved.");
  });
  libraryChanges = run.catch(() => undefined);
  return run;
}

/** Adds `id` to the person's library on the server ([`changeLibrary`]). */
export function addToLibrary(id: string): Promise<void> {
  return changeLibrary((stored) => (stored.includes(id) ? undefined : [...stored, id]));
}

/**
 * Takes `id` out of the person's library on the server ([`changeLibrary`]): Launchpad's Delete
 * and the App Store's Uninstall.
 */
export function removeFromLibrary(id: string): Promise<void> {
  return changeLibrary((stored) =>
    stored.includes(id) ? stored.filter((each) => each !== id) : undefined,
  );
}

/**
 * The apps the session got from the App Store, kept on the server. Every window that uses it
 * shares one channel to the document, so a Get in the App Store, or a removal in Launchpad,
 * reaches the Dock and Launchpad at once. Returns the ids and whether the first load is under
 * way; changes go through `addToLibrary` and `removeFromLibrary`.
 */
export function useAppLibrary(enabled: boolean) {
  const [installed, setInstalled] = useState<readonly string[]>([]);
  const loading = useServerState({
    url: APP_STORE_LIBRARY_URL,
    enabled,
    value: installed,
    onLoad: (stored) => {
      const ids = installedFromServer(stored);
      if (!ids) return false;
      setInstalled(ids);
    },
    toBody: (value) => ({ installed: [...value] }),
  });
  return { installed, loading };
}

/** Launchpad's order (ids; the apps it leaves out follow) and the page it was left on. */
export interface LaunchpadLayout {
  order: readonly string[];
  page: number;
}

/** The layout of a `GET` reply: the first page in the Dock's order before the session saved. */
export function layoutFromServer(reply: unknown): LaunchpadLayout | undefined {
  const { order, page } = (reply ?? {}) as { order?: unknown; page?: unknown };
  if (order === null && page === null) return { order: [], page: 0 };
  if (!isIds(order) || typeof page !== "number" || !Number.isInteger(page) || page < 0) {
    return undefined;
  }
  return { order, page };
}

/** The apps the Dock and Launchpad show, and Launchpad's order and page. */
export interface DesktopLibrary {
  /** Whether the server has answered which apps the session has (always, when not served by
   * the Ferrite application). Until then the browser may not yet hold the session's cookie, so
   * the Dock offers nothing to open. */
  ready: boolean;
  /** The apps the session has, in the order given (the Dock's). */
  installed: readonly DesktopApp[];
  /** The same apps in Launchpad's order, without Finder. */
  launchpad: readonly DesktopApp[];
  /** Launchpad's page. */
  page: number;
  setPage: (page: number) => void;
  /** Moves an app of Launchpad to `index` in its order. */
  move: (id: string, index: number) => void;
}

/**
 * The desktop's library for `apps`. Served by the Ferrite application, it shows the apps that
 * come with the desktop and those the session got, nothing until the server has answered, and
 * every app when the catalogue cannot be read; an app the catalogue does not list is always
 * shown. Launchpad's order and page are saved for the session. Elsewhere every app is shown and
 * the order and page live in the page.
 */
export function useDesktopLibrary(apps: readonly DesktopApp[]): DesktopLibrary {
  const enabled = servedByDesktopApp();
  const { catalogue, settled } = useCatalogue(enabled);
  const { installed: got, loading: libraryLoading } = useAppLibrary(enabled);
  const [layout, setLayout] = useState<LaunchpadLayout>({ order: [], page: 0 });
  const layoutLoading = useServerState({
    url: LAUNCHPAD_LAYOUT_URL,
    enabled,
    value: layout,
    onLoad: (stored) => {
      const next = layoutFromServer(stored);
      if (!next) return false;
      setLayout(next);
    },
    toBody: (value) => ({ order: [...value.order], page: value.page }),
  });
  const ready = !enabled || (settled && !libraryLoading && !layoutLoading);

  const installed = useMemo(() => {
    if (!ready) return [];
    if (!catalogue) return apps;
    return apps.filter((app) => {
      const entry = catalogue.find((candidate) => candidate.id === app.id);
      return !entry || entry.preinstalled || got.includes(app.id);
    });
  }, [ready, catalogue, apps, got]);

  const launchpad = useMemo(() => {
    // Finder is always running and is not in Launchpad.
    const listed = installed.filter((app) => app.id !== "finder");
    const rank = new Map(layout.order.map((id, index) => [id, index]));
    const placed = listed.filter((app) => rank.has(app.id));
    placed.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
    return [...placed, ...listed.filter((app) => !rank.has(app.id))];
  }, [installed, layout.order]);

  const setPage = (page: number) =>
    setLayout((current) => (current.page === page ? current : { ...current, page }));
  const move = (id: string, index: number) => {
    const ids = launchpad.map((app) => app.id);
    const from = ids.indexOf(id);
    const to = Math.min(Math.max(index, 0), ids.length - 1);
    if (from < 0 || from === to) return;
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    // The server keeps only ids of its catalogue.
    const known = catalogue ? ids.filter((each) => catalogue.some((app) => app.id === each)) : ids;
    setLayout((current) => ({ ...current, order: known }));
  };

  return { ready, installed, launchpad, page: layout.page, setPage, move };
}
