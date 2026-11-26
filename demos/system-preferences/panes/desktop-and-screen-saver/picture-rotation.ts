import {
  childrenOf,
  type DriveEntry,
  ensureDrive,
  SPECIAL_FOLDER_IDS,
} from "../../../desktop/desktop-files";
import {
  changeDesktopValue,
  currentPictureChoice,
  desktopPictureGeneration,
  desktopValues,
  subscribeDesktopValues,
} from "../../../desktop/desktop-personal";
import {
  addedFolder,
  DESKTOP_COLORS,
  DESKTOP_PICTURES,
  DESKTOP_PICTURES_SOURCE,
  DYNAMIC_DESKTOPS,
  drivePicture,
  PICTURE_KEY,
  PICTURES_FOLDER,
} from "./pictures";
import { onDisplayWake } from "./screen-saver";

/**
 * Desktop & Screen Saver's Change picture: the desktop goes on to the next picture of the source
 * selected in the pane, or a random one, at the interval chosen. It counts from when the picture
 * last changed or the plan last did, which is kept with the settings, so a reload does not start the
 * count again and an interval that passed while the page was closed changes the picture when it
 * opens. When logging in
 * is once per session in a tab, as a reload is no new login; When waking from sleep is this desktop's
 * own display sleep, as a page is not told of the computer's.
 */
export const CHANGE_KEY = "desktop-and-screen-saver.changePicture";
export const INTERVAL_KEY = "desktop-and-screen-saver.interval";
export const RANDOM_KEY = "desktop-and-screen-saver.randomOrder";
export const SOURCE_KEY = "desktop-and-screen-saver.source";
/** When the count last started, in milliseconds: at a change of the picture or of the plan. */
export const CHANGED_AT_KEY = "desktop-and-screen-saver.changedAt";

const LOGIN = "When logging in";
const WAKE = "When waking from sleep";
const EVERY: Readonly<Record<string, number>> = {
  "Every 5 seconds": 5_000,
  "Every minute": 60_000,
  "Every 5 minutes": 300_000,
  "Every 15 minutes": 900_000,
  "Every 30 minutes": 1_800_000,
  "Every hour": 3_600_000,
  "Every day": 86_400_000,
};

const LOGIN_CLAIM = "macalicious.pictureChangedAtLogin";

/** The most pictures of a folder or of the Photos library the gallery shows: the newest. */
const PICTURES_SHOWN = 24;

/** The picture files of a drive folder, newest first. */
export function drivePictures(entries: readonly DriveEntry[]): DriveEntry[] {
  return entries
    .filter((entry) => entry.kind === "file" && entry.type?.startsWith("image/"))
    .sort((a, b) => b.modified_ms - a.modified_ms)
    .slice(0, PICTURES_SHOWN);
}

/** The pictures of the Photos library, newest first: each by its original on the drive. */
export async function libraryPictures(): Promise<{ id: string; name: string }[]> {
  const { loadLibrary } = await import("../../../photos/photos-library");
  const { photos } = await loadLibrary();
  return photos
    .filter(
      (photo) => photo.mime.startsWith("image/") && !photo.hidden && photo.deleted_ms === null,
    )
    .sort((a, b) => b.added_ms - a.added_ms)
    .slice(0, PICTURES_SHOWN)
    .map((photo) => ({ id: photo.file, name: photo.name }));
}

/** The drive folder a selected source lists, or `undefined` for a source that is no folder. */
export function folderOfSource(source: string): string | undefined {
  if (source === `folder:${PICTURES_FOLDER}`) return SPECIAL_FOLDER_IDS.Pictures;
  return source.startsWith("folder:") ? addedFolder(source.slice("folder:".length)) : undefined;
}

async function picturesOf(source: string): Promise<readonly string[]> {
  if (source === DESKTOP_PICTURES_SOURCE) return DESKTOP_PICTURES.map((picture) => picture.id);
  if (source === "colors") return DESKTOP_COLORS.map((picture) => picture.id);
  if (source === "photos") {
    return (await libraryPictures()).map((picture) => drivePicture(picture.id));
  }
  const folder = folderOfSource(source);
  if (folder === undefined) return [];
  return drivePictures(childrenOf(await ensureDrive(), folder)).map((entry) =>
    drivePicture(entry.id),
  );
}

/** The picture after `current` in `list`, or a random other one; `null` when there is no other. */
export function nextPicture(
  list: readonly string[],
  current: unknown,
  random: boolean,
  roll: () => number = Math.random,
): string | null {
  const others = list.filter((picture) => picture !== current);
  if (others.length === 0) return null;
  if (random) return others[Math.floor(roll() * others.length)] ?? null;
  return list[(list.indexOf(current as string) + 1) % list.length] ?? null;
}

const text = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);

const intervalOf = (values: Readonly<Record<string, unknown>>) =>
  text(values[INTERVAL_KEY], "Every 30 minutes");

/** What the settings ask for, as text that changes when the count must start again; "" for nothing. */
function planOf(values: Readonly<Record<string, unknown>>): string {
  const still = !DYNAMIC_DESKTOPS.some(
    (picture) => picture.id === text(values[PICTURE_KEY], "catalina"),
  );
  if (values[CHANGE_KEY] !== true || !still) return "";
  return `${intervalOf(values)}\n${text(values[SOURCE_KEY], DESKTOP_PICTURES_SOURCE)}`;
}

let show: ((picture: string) => void) | null = null;
let planned: string | null = null;
let pictureSeen: unknown;
let countedFrom: number | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let listening = false;
let sessionSeen = 0;

function arm() {
  clearTimeout(timer);
  countedFrom = null;
  const values = desktopValues();
  const every = EVERY[intervalOf(values)];
  const from = values[CHANGED_AT_KEY];
  if (planOf(values) === "" || every === undefined || typeof from !== "number") return;
  countedFrom = from;
  timer = setTimeout(() => void changePicture(), Math.max(0, from + every - Date.now()));
}

async function changePicture() {
  const before = desktopValues();
  const plan = planOf(before);
  if (plan === "") return;
  const session = desktopPictureGeneration();
  const choice = currentPictureChoice();
  const countedAt = before[CHANGED_AT_KEY];
  let list: readonly string[] = [];
  try {
    list = await picturesOf(text(before[SOURCE_KEY], DESKTOP_PICTURES_SOURCE));
  } catch (error) {
    console.warn(`The desktop could not read its next picture (${error})`);
  }
  const now = desktopValues();
  // A new plan, or another session: `follow` or the session's own look has set the count.
  if (planOf(now) !== plan || session !== desktopPictureGeneration()) return;
  // The person chose a picture or started the count again while the source was read: theirs stands,
  // and the count goes on from it, also for a choice of the picture already shown.
  if (
    choice !== currentPictureChoice() ||
    now[PICTURE_KEY] !== before[PICTURE_KEY] ||
    now[CHANGED_AT_KEY] !== countedAt
  ) {
    if (now[CHANGED_AT_KEY] === countedAt) changeDesktopValue(CHANGED_AT_KEY, Date.now());
    arm();
    return;
  }
  const next = nextPicture(list, now[PICTURE_KEY], now[RANDOM_KEY] === true);
  changeDesktopValue(CHANGED_AT_KEY, Date.now());
  if (next !== null) show?.(next);
  arm();
}

function follow() {
  const values = desktopValues();
  const plan = planOf(values);
  const picture = values[PICTURE_KEY];
  const firstLook = planned === null;
  const changed = !firstLook && (plan !== planned || picture !== pictureSeen);
  planned = plan;
  pictureSeen = picture;
  if (plan !== "" && (changed || typeof values[CHANGED_AT_KEY] !== "number")) {
    changeDesktopValue(CHANGED_AT_KEY, Date.now());
  }
  // Writing the count above came back here and armed it already, unless the time is the same.
  if (firstLook || changed || desktopValues()[CHANGED_AT_KEY] !== countedFrom) arm();
}

/** Once per session in a tab; a reload finds it claimed. */
function claimLogin(): boolean {
  try {
    if (sessionStorage.getItem(LOGIN_CLAIM) !== null) return false;
    sessionStorage.setItem(LOGIN_CLAIM, "");
  } catch {
    return false;
  }
  return true;
}

/**
 * Follow the settings from now on, when a session's settings have loaded and its picture is being
 * shown. `change` makes a picture of the pane's, or a `drive:` choice, the desktop picture.
 */
export function followPictureChanges(change: (picture: string) => void): void {
  show = change;
  if (!listening) {
    listening = true;
    subscribeDesktopValues(follow);
    onDisplayWake(() => {
      if (intervalOf(desktopValues()) === WAKE) void changePicture();
    });
  }
  const session = desktopPictureGeneration();
  if (session !== sessionSeen) {
    sessionSeen = session;
    try {
      sessionStorage.removeItem(LOGIN_CLAIM);
    } catch {
      // A tab that cannot keep it treats each load as a login's.
    }
  }
  planned = null;
  follow();
  // Claimed whatever the interval: choosing When logging in later is no login.
  const login = claimLogin();
  const values = desktopValues();
  if (login && planOf(values) !== "" && intervalOf(values) === LOGIN) void changePicture();
}
