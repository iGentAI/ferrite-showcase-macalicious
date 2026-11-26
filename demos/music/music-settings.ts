import type { MusicListSize, MusicSettingKey, MusicSettings } from "./music-data";

/**
 * Music's Preferences on the Ferrite desktop. The server keeps the settings this desktop carries
 * out (`Preferences` in `ferrite-apps/desktop/src/apps/music/mod.rs`): List Size, the notification
 * when the song changes, the MiniPlayer kept on top, star ratings, the Songs list's checkboxes,
 * Crossfade, Sound Enhancer and Sound Check. The others are shown in the window dimmed, with the value that is true here and the reason, and
 * are never sent or kept.
 */
export const MUSIC_PREFERENCES_URL = "/api/music/preferences";

/** A setting the window shows but cannot change: what it shows, and why. */
export interface UnavailableSetting {
  /** Whether the box is shown ticked: what this desktop does. */
  checked: boolean;
  /** Why it cannot be changed here, as one sentence. */
  reason: string;
}

const NO_STORE = "The iTunes Store is not part of this desktop.";

/** Every setting of the window that this desktop cannot carry out. */
export const UNAVAILABLE_SETTINGS: Readonly<Partial<Record<MusicSettingKey, UnavailableSetting>>> =
  {
    showStore: { checked: false, reason: NO_STORE },
    keepOrganized: {
      checked: false,
      reason:
        "Songs added stay in Music on your drive under their own names until File > Library > Organize Library moves them.",
    },
    copyFiles: {
      checked: true,
      reason:
        "Songs added from your computer are copied to Music on your drive; a file already on your drive stays where it is.",
    },
    restrictStore: { checked: false, reason: NO_STORE },
    restrictShared: { checked: false, reason: "There are no shared libraries on this desktop." },
    restrictExplicit: {
      checked: false,
      reason: "Internet Archive items do not say whether they are explicit.",
    },
    addToLibrary: {
      checked: true,
      reason: "A song added to a playlist is always added to the library.",
    },
    updateArtwork: {
      checked: false,
      reason: "Covers come only from the tags of the songs you add.",
    },
  };

const LIST_SIZES: readonly MusicListSize[] = ["small", "medium", "large"];

interface KeptSettings {
  listSize: MusicListSize;
  notifications: boolean;
  miniPlayerOnTop: boolean;
  starRatings?: boolean;
  songCheckboxes?: boolean;
  crossfade?: boolean;
  crossfadeSeconds?: number;
  soundEnhancer?: boolean;
  soundEnhancerLevel?: number;
  soundCheck?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOptionalBoolean = (value: unknown) => value === undefined || typeof value === "boolean";
const isOptionalNumber = (value: unknown) => value === undefined || typeof value === "number";

function isKept(value: unknown): value is KeptSettings {
  return (
    isRecord(value) &&
    LIST_SIZES.includes(value.listSize as MusicListSize) &&
    typeof value.notifications === "boolean" &&
    typeof value.miniPlayerOnTop === "boolean" &&
    isOptionalBoolean(value.starRatings) &&
    isOptionalBoolean(value.songCheckboxes) &&
    isOptionalBoolean(value.crossfade) &&
    isOptionalNumber(value.crossfadeSeconds) &&
    isOptionalBoolean(value.soundEnhancer) &&
    isOptionalNumber(value.soundEnhancerLevel) &&
    isOptionalBoolean(value.soundCheck)
  );
}

/**
 * The settings of a `GET` reply (or a body another window gave) over `defaults`: the defaults
 * before anything was saved, `undefined` for stored data the window cannot read, which is then
 * never saved over. Ratings are shown until the person turns them off: a song's rating was shown
 * before the setting could be changed, whatever the reference screenshot's window ticks. Sound
 * Enhancer stays off until it is turned on, so a song keeps the sound it had until then.
 */
export function settingsFromServer(
  reply: unknown,
  defaults: MusicSettings,
): MusicSettings | undefined {
  const stored = isRecord(reply) ? reply.preferences : undefined;
  if (stored === null) {
    return { ...defaults, starRatings: true, songCheckboxes: false, soundEnhancer: false };
  }
  if (!isKept(stored)) return undefined;
  return {
    ...defaults,
    listSize: stored.listSize,
    notifications: stored.notifications,
    miniPlayerOnTop: stored.miniPlayerOnTop,
    starRatings: stored.starRatings ?? true,
    songCheckboxes: stored.songCheckboxes ?? false,
    crossfade: stored.crossfade ?? false,
    crossfadeSeconds: stored.crossfadeSeconds ?? defaults.crossfadeSeconds,
    soundEnhancer: stored.soundEnhancer ?? false,
    soundEnhancerLevel: stored.soundEnhancerLevel ?? defaults.soundEnhancerLevel,
    soundCheck: stored.soundCheck ?? false,
  };
}

/** The `PUT` body of the settings: only those the server keeps. */
export function settingsToServer(settings: MusicSettings) {
  return {
    preferences: {
      listSize: settings.listSize,
      notifications: settings.notifications,
      miniPlayerOnTop: settings.miniPlayerOnTop,
      starRatings: settings.starRatings,
      songCheckboxes: settings.songCheckboxes,
      crossfade: settings.crossfade,
      crossfadeSeconds: settings.crossfadeSeconds,
      soundEnhancer: settings.soundEnhancer,
      soundEnhancerLevel: settings.soundEnhancerLevel,
      soundCheck: settings.soundCheck,
    },
  };
}
