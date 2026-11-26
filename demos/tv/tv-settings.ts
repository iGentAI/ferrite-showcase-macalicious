import type { TvListSize, TvSettingKey, TvSettings } from "./tv-data";

/**
 * TV's Preferences on the Ferrite desktop. The window carries out List Size, Checkboxes in library
 * and the screen saver while paused, which are kept for the person on the server
 * (`/api/tv/preferences`, `ferrite-apps/desktop/src/apps/tv`). Every other setting is shown dimmed,
 * with the value that describes what TV does here and the reason it cannot be changed; none of them
 * is stored.
 */
export const TV_PREFERENCES_URL = "/api/tv/preferences";

/** The most videos whose checkbox stays cleared (the module's `MAX_UNCHECKED`). */
const MAX_UNCHECKED = 1000;

/** A setting shown dimmed: the value it shows, and why it cannot be changed here. */
export interface UnavailableTvSetting {
  /** Whether the box is shown ticked: what TV does on this desktop. */
  checked: boolean;
  /** Why it cannot be changed here, as one sentence. */
  reason: string;
}

const NO_STORE =
  "TV here plays YouTube videos and your own files: there is no store, and nothing is bought or downloaded.";

/** The settings TV cannot carry out, dimmed with their reasons. */
export const TV_UNAVAILABLE_SETTINGS: Readonly<
  Partial<Record<TvSettingKey, UnavailableTvSetting>>
> & { checkDownloads: UnavailableTvSetting } = {
  checkDownloads: { checked: false, reason: NO_STORE },
  keepOrganized: {
    checked: false,
    reason:
      "There is no media folder: home videos stay where they are on your drive, and links stream from YouTube.",
  },
  restrictMature: {
    checked: false,
    reason:
      "Neither YouTube's embedded player nor your own files give a video's rating, so TV cannot restrict by it.",
  },
  resetWarnings: { checked: false, reason: "TV here shows no dialog warnings to reset." },
};

const LIST_SIZES: readonly TvListSize[] = ["small", "medium", "large"];
const KEPT_FIELDS = new Set(["listSize", "screenSaver", "checkboxes", "unchecked"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOptionalBoolean = (value: unknown) => value === undefined || typeof value === "boolean";

/**
 * The settings of a `GET` reply: `defaults` before the person has saved any, `defaults` with what is
 * stored after; `undefined` when the reply is not one TV can read, so that it is never saved over.
 */
export function tvSettingsFromServer(reply: unknown, defaults: TvSettings): TvSettings | undefined {
  const stored = isRecord(reply) ? reply.preferences : undefined;
  if (stored === null) return defaults;
  if (!isRecord(stored) || Object.keys(stored).some((key) => !KEPT_FIELDS.has(key))) {
    return undefined;
  }
  const { listSize, screenSaver, checkboxes, unchecked } = stored;
  if (!LIST_SIZES.includes(listSize as TvListSize)) return undefined;
  if (!isOptionalBoolean(screenSaver) || !isOptionalBoolean(checkboxes)) return undefined;
  if (
    unchecked !== undefined &&
    !(Array.isArray(unchecked) && unchecked.every((id) => typeof id === "string"))
  ) {
    return undefined;
  }
  return {
    ...defaults,
    listSize: listSize as TvListSize,
    screenSaver: screenSaver === true,
    checkboxes: checkboxes === true,
    unchecked: (unchecked as string[] | undefined) ?? [],
  };
}

/** The `PUT` body: what TV keeps, leaving out what is as it starts. */
export function tvSettingsToServer(settings: TvSettings) {
  return {
    preferences: {
      listSize: settings.listSize,
      ...(settings.screenSaver ? { screenSaver: true } : {}),
      ...(settings.checkboxes ? { checkboxes: true } : {}),
      ...(settings.unchecked?.length ? { unchecked: [...settings.unchecked] } : {}),
    },
  };
}

/** The settings with `id`'s Library checkbox set or cleared. */
export function withChecked(settings: TvSettings, id: string, checked: boolean): TvSettings {
  const others = (settings.unchecked ?? []).filter((each) => each !== id);
  return { ...settings, unchecked: checked ? others : [...others, id].slice(-MAX_UNCHECKED) };
}

/** The video Up Next plays after `current`: the first queued whose checkbox is not cleared. */
export function nextToPlay(
  upNext: readonly string[],
  current: string,
  unchecked: readonly string[] = [],
): string | undefined {
  return upNext.find((id) => id !== current && !unchecked.includes(id));
}
