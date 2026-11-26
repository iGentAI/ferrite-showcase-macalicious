import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { desktopValuesLoaded, subscribeDesktopValues } from "../desktop/desktop-personal";
import { useServerState } from "../desktop/desktop-server";

/**
 * The versions of the apps got from the store, on the server (`ferrite-apps/desktop/src/apps/
 * app_store`). The current version is the served build's: the desktop is built as one, so a new build
 * is a new version of every app, and the page is already running it. What the person keeps is which
 * version of each app they last took, and an app behind waits on the Updates page.
 */
export const APP_VERSIONS_URL = "/api/app-store/versions";

export interface AppVersions {
  /** The served build's version; empty until the server has said. */
  current: string;
  /** The version last taken of each app got. */
  kept: Readonly<Record<string, string>>;
}

const UNREAD: AppVersions = { current: "", kept: {} };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The versions of a `GET` reply, or `undefined` when it is not one to read. */
export function versionsFromServer(reply: unknown): AppVersions | undefined {
  if (!isRecord(reply) || typeof reply.current !== "string" || reply.current === "") {
    return undefined;
  }
  if (reply.kept === null) return { current: reply.current, kept: {} };
  if (!isRecord(reply.kept) || !Object.values(reply.kept).every((v) => typeof v === "string")) {
    return undefined;
  }
  return { current: reply.current, kept: reply.kept as Record<string, string> };
}

/** The apps of `installed` behind the current version, in that order. */
export const appsBehind = ({ current, kept }: AppVersions, installed: readonly string[]) =>
  current === "" ? [] : installed.filter((id) => kept[id] !== undefined && kept[id] !== current);

/** `versions` with `ids` at the current version: the same object when nothing changes. */
export function withCurrent(versions: AppVersions, ids: readonly string[]): AppVersions {
  const moved = ids.filter((id) => versions.kept[id] !== versions.current);
  if (versions.current === "" || moved.length === 0) return versions;
  const kept = { ...versions.kept };
  for (const id of moved) kept[id] = versions.current;
  return { ...versions, kept };
}

/**
 * `versions` as the library stands: an app seen for the first time was got at the current version,
 * and with Automatic Updates on every app takes a new version by itself.
 */
export function settled(
  versions: AppVersions,
  installed: readonly string[],
  automatic: boolean,
): AppVersions {
  return withCurrent(
    versions,
    automatic ? installed : installed.filter((id) => versions.kept[id] === undefined),
  );
}

/**
 * The versions, kept for the person. `ready` holds them back until the library has been read, so a
 * library not read yet settles nothing. Unreadable, no app is ever behind.
 */
export function useAppVersions(
  enabled: boolean,
  ready: boolean,
  installed: readonly string[],
  automatic: boolean,
) {
  const [versions, setVersions] = useState(UNREAD);
  useServerState({
    url: APP_VERSIONS_URL,
    enabled,
    value: versions,
    onLoad: (stored) => {
      const read = versionsFromServer(stored);
      if (!read) return false;
      setVersions(read);
    },
    toBody: ({ kept }) => ({ kept }),
  });
  // Automatic Updates reads as on until the person's settings have loaded: nothing is taken for it.
  const settingsLoaded = useSyncExternalStore(
    subscribeDesktopValues,
    desktopValuesLoaded,
    () => false,
  );
  useEffect(() => {
    if (ready && versions.current !== "") {
      setVersions((now) => settled(now, installed, automatic && settingsLoaded));
    }
  }, [ready, installed, automatic, settingsLoaded, versions.current]);
  const take = useCallback((ids: readonly string[]) => {
    setVersions((now) => withCurrent(now, ids));
  }, []);
  const behind = useMemo(() => appsBehind(versions, installed), [versions, installed]);
  return { versions, behind, take };
}
