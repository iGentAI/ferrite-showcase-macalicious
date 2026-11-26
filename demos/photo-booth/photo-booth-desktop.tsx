import {
  Alert,
  AlertButtons,
  AlertClose,
  AlertInformativeText,
  AlertMessage,
  AlertPopup,
} from "macalicious/alert";
import { DefaultButton } from "macalicious/default-button";
import {
  MenuCheckboxItem,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSection,
  MenuSeparator,
} from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { ShareMenu } from "macalicious/share-menu";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useDesktopAppMenu } from "../desktop/desktop-app-menus";
import {
  clearCopiedDriveItems,
  copiedDriveItems,
  copyDriveItems,
  useCopiedDriveItems,
} from "../desktop/desktop-clipboard";
import {
  beginDesktopDrag,
  type DesktopDragItem,
  fileItemsOfDrag,
  filesOfDrag,
  useDesktopDrop,
} from "../desktop/desktop-drag";
import { readBoolean, takePictureTicket, useDesktopSetting } from "../desktop/desktop-personal";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { FileShareItems } from "../desktop/desktop-share-link";
import { useWindowKeys } from "../desktop/desktop-window-keys";
import { showInFinder } from "../finder/finder-open";
import { encodeJpeg, flipEdit, isIdentity, NO_EDIT, renderEdit } from "../photos/photos-edit";
import {
  announceChange,
  announcedBy,
  changePhoto,
  decodePicture,
  importPicture,
  LIBRARY_CHANGED_EVENT,
  LibraryError,
  type LibraryPhoto,
  loadLibrary,
  readOriginal,
  readThumbs,
  setDesktopPicture,
  thumbnailOf,
} from "../photos/photos-library";
import { printPictures } from "../photos/photos-print";
import { plainType, recordingType } from "../quicktime-player/quicktime-player-recording-files";
import { PhotoBooth, type PhotoBoothProps } from "./photo-booth";
import {
  isBackdrop,
  isBackdropPicture,
  keepBackdrop,
  learnEmptyFrame,
  loadBackdrops,
  setBackdropStage,
  USER_BACKDROPS,
} from "./photo-booth-backdrop";
import { bakeEffect, clipCanvas, fourUp } from "./photo-booth-bake";
import {
  type ClipboardSeen,
  canReadClipboardPictures,
  canWriteClipboardPicture,
  NO_CLIPBOARD_READ,
  readClipboardSeen,
  samePicture,
  writeClipboardPicture,
} from "./photo-booth-clipboard";
import { type ContactChoice, contactChoices, setContactPicture } from "./photo-booth-contact";
import {
  EFFECT_PAGES,
  findEffect,
  type PhotoBoothEffect,
  type PhotoBoothPicture,
} from "./photo-booth-data";
import { computesEffect } from "./photo-booth-effects";
import { ComputedEffectCanvas } from "./photo-booth-live";
import { playShutter } from "./photo-booth-shutter";
import { PhotoBoothSlideshow } from "./photo-booth-slideshow";
import { isTracked } from "./photo-booth-tracked";

/** The folder of the drive's Pictures that Photo Booth's originals go in. */
export const PHOTO_BOOTH_FOLDER = "Photo Booth";
/** The JPEG quality a picture is saved at. */
export const JPEG_QUALITY = 0.9;
/** The desktop setting of Edit > Auto Flip New Items. */
export const AUTO_FLIP = "photo-booth.autoFlip";
/** The desktop settings of the Camera menu and of where the window was left. */
export const SCREEN_FLASH = "photo-booth.flash";
export const CAMERA_CHOICE = "photo-booth.camera";
export const MICROPHONE_CHOICE = "photo-booth.microphone";
export const LEFT_EFFECT = "photo-booth.effect";
export const LEFT_VIEW = "photo-booth.view";
export const LEFT_PAGE = "photo-booth.page";

const readText = (stored: unknown) => (typeof stored === "string" ? stored : undefined);
const readView = (stored: unknown) =>
  stored === "effects" || stored === "camera" ? stored : undefined;
const readPage = (stored: unknown) => (typeof stored === "number" ? stored : undefined);
/** The time between Take Four Quick Pictures' pictures, in milliseconds. */
const FOUR_GAP_MS = 800;
/** How long a picture waits for a video just mounted to show its first frame, in milliseconds. */
const FIRST_FRAME_WAIT_MS = 2_000;
/** How often a clip's canvas takes a frame of the camera, in milliseconds. */
const CLIP_FRAME_MS = 33;

/** Every effect id, once, in the order of the pages. */
export const PHOTO_EFFECTS: readonly string[] = [
  ...new Set(EFFECT_PAGES.flat().map((effect) => effect.id)),
];

/** Photo Booth's pictures in a Photos library: taken here, not in Recently Deleted, oldest
 * first. */
export function boothPhotos(photos: readonly LibraryPhoto[]): LibraryPhoto[] {
  return photos
    .filter((photo) => photo.source === "photo-booth" && photo.deleted_ms === null)
    .sort((a, b) => a.taken_ms - b.taken_ms || a.id.localeCompare(b.id));
}

/** One photo of the window: kept in Photos, or on its way there. */
interface Photo {
  id: string;
  effect: string;
  saved: boolean;
  /** The library's edit revision (`edited_ms`, 0 unedited): an edit in Photos makes a new
   * thumbnail, read again. */
  rev: number;
  /** A movie clip rather than a picture. */
  clip: boolean;
  src?: string;
}

/** What Undo takes back and Redo brings back, named in their rows. */
interface UndoStep {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

/** The effects of the pictures Copy and Cut put on the desktop's clipboard, by drive file. */
const copiedEffects = new Map<string, string>();
/**
 * What Copy and Cut last left on the computer's clipboard, once written: a picture, a movie's name,
 * or nothing if the browser refused. A refused copy keeps the picture already there as `stale`, since
 * it says nothing about the copy. `items` is the desktop's clipboard that copy made, and `written`
 * says the write has finished: what was on that clipboard before then says nothing about the copy. A
 * page is not told when another program replaces that clipboard: finding something else there means
 * it did.
 */
type CopiedHere = {
  items: readonly unknown[];
  left: Promise<{ picture: Blob } | { stale: Blob } | { text: string } | null>;
  written: boolean;
};
let copiedHere: CopiedHere | null = null;
function noteCopied(items: CopiedHere["items"], left: CopiedHere["left"]) {
  const here: CopiedHere = { items, left, written: false };
  copiedHere = here;
  void left.then(() => {
    here.written = true;
  });
}

const isMediaItem = (item: DesktopDragItem) =>
  /^(image|video)\//.test(item.type ?? "") ||
  /\.(jpe?g|png|gif|webp|mp4|m4v|mov|webm)$/i.test(item.name);

/** A thumbnail's key: the photo and the revision it shows. */
const thumbOf = (photo: { id: string; rev: number }) => `${photo.id}:${photo.rev}`;

/** "Photo Booth 2019-10-07 at 14.03.22", as Photo Booth names a picture. */
export function pictureName(ms: number): string {
  const date = new Date(ms);
  const two = (n: number) => String(n).padStart(2, "0");
  return `Photo Booth ${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} at ${two(date.getHours())}.${two(date.getMinutes())}.${two(date.getSeconds())}`;
}

const extensionOf = (mime: string) =>
  mime === "video/webm"
    ? "webm"
    : mime === "video/mp4"
      ? "mp4"
      : mime === "video/quicktime"
        ? "mov"
        : "jpg";

/** The page of the Effects browser that holds the backdrops, from 0. */
const BACKDROPS_PAGE = 3;
/** How long the person has to step out before the empty background is taken, in milliseconds. */
const STEP_OUT_MS = 3000;

/** The browser's camera, under an effect, in a preview or the camera view. */
function CameraVideo({
  stream,
  effect,
  shown,
  onFrame,
  onTrackingFailed,
}: {
  stream: MediaStream;
  effect: PhotoBoothEffect;
  /** The camera videos on the page, which a picture is taken from. */
  shown: Set<HTMLVideoElement>;
  /** Called when the video has a frame to take. */
  onFrame: () => void;
  /** Called when an effect that follows a face cannot load its face model. */
  onTrackingFailed: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    shown.add(video);
    const attach = () => {
      video.srcObject = null;
      video.srcObject = stream;
      // A play cut short (the element left the page) is no failure.
      video.play()?.catch(() => {});
    };
    if (video.srcObject !== stream) attach();
    // WebKit can leave a video attached in the same moment as the previews' videos are removed
    // with no frame for good; attaching the stream again starts it.
    const retry = setTimeout(() => {
      if (video.readyState === HTMLMediaElement.HAVE_NOTHING) attach();
    }, 1000);
    return () => {
      clearTimeout(retry);
      shown.delete(video);
    };
  }, [stream, shown]);
  return (
    <>
      <video
        ref={ref}
        muted
        playsInline
        autoPlay
        onLoadedData={onFrame}
        // The camera view is a mirror, as on a Mac: the effect is seen the way round the person is.
        style={{
          filter: effect.filter,
          transform: effect.transform ? `scaleX(-1) ${effect.transform}` : "scaleX(-1)",
        }}
      />
      {computesEffect(effect.id) || isTracked(effect.id) ? (
        <ComputedEffectCanvas
          key={effect.id}
          video={ref}
          effect={effect.id}
          onTrackingFailed={onTrackingFailed}
        />
      ) : null}
    </>
  );
}

type Camera = "starting" | "ready" | "unsupported" | "denied" | "missing" | "busy";

/** What the window says for each state of the camera; nothing once it is ready. */
export const CAMERA_NOTICE: Record<Camera, string | null> = {
  starting: "Waiting for the camera…",
  ready: null,
  unsupported:
    "This page cannot use a camera: the browser offers none here (a camera needs a secure https connection), so Photo Booth cannot take a picture.",
  denied:
    "Photo Booth is not allowed to use the camera. Allow camera access for this site in the browser, then open Photo Booth again.",
  missing: "No camera is connected, so Photo Booth cannot take a picture.",
  busy: "The camera could not be started; another application may be using it. Close it, then open Photo Booth again.",
};

/** What a refusal of `getUserMedia` means for the person, by the error the browser gave. */
export function cameraProblem(error: unknown): Exclude<Camera, "starting" | "ready"> {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  if (["NotAllowedError", "SecurityError", "PermissionDeniedError"].includes(name)) {
    return "denied";
  }
  if (["NotFoundError", "OverconstrainedError", "DevicesNotFoundError"].includes(name)) {
    return "missing";
  }
  return "busy";
}

/** Hands `blob` to the computer as a download named `name`. */
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Long enough for the browser to have taken the file.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Photo Booth on the desktop served by the `macalicious-desktop` Ferrite application: the
 * browser's camera (`getUserMedia`) in the previews and the camera view, and every picture taken
 * saved with its effect into the person's Photos library (`demos/photos/photos-library.ts`), its
 * original in Pictures/Photo Booth on the drive. The strip shows the library's Photo Booth
 * pictures; Delete or Backspace on one, or Delete from its contextual menu, moves it to Photos'
 * Recently Deleted, and Export… hands its original to the computer. A camera the browser cannot
 * give is said so, by why (refused, none connected, busy, none on this page). Elsewhere it is
 * the demo, with no camera.
 */
export function DesktopPhotoBooth(props: PhotoBoothProps) {
  return servedByDesktopApp() ? <ServedPhotoBooth {...props} /> : <PhotoBooth {...props} />;
}

function ServedPhotoBooth({ onPictureTaken, onViewingChange, ref, ...props }: PhotoBoothProps) {
  const [autoFlip, setAutoFlip] = useDesktopSetting(AUTO_FLIP, readBoolean, true);
  const [flashOn, setFlashOn] = useDesktopSetting(SCREEN_FLASH, readBoolean, true);
  const [cameraChoice, setCameraChoice] = useDesktopSetting(CAMERA_CHOICE, readText, "");
  const [microphoneChoice, setMicrophoneChoice] = useDesktopSetting(
    MICROPHONE_CHOICE,
    readText,
    "",
  );
  const [leftEffect, setLeftEffect] = useDesktopSetting(
    LEFT_EFFECT,
    readText,
    props.defaultEffect ?? "normal",
  );
  const [leftView, setLeftView] = useDesktopSetting<"effects" | "camera">(
    LEFT_VIEW,
    readView,
    props.defaultView ?? "effects",
  );
  const [leftPage, setLeftPage] = useDesktopSetting(LEFT_PAGE, readPage, props.defaultPage ?? 1);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  // The camera asked of the browser. The setting keeps a device's name: a browser gives a device a new
  // id whenever its site data is cleared, and an off-the-record window does on every load.
  const [cameraId, setCameraId] = useState("");
  const chosenMicrophone = devices.find(
    (device) => device.kind === "audioinput" && device.label === microphoneChoice,
  )?.deviceId;
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [backToCamera, setBackToCamera] = useState(0);
  const [slideshow, setSlideshow] = useState(false);
  const [clipRunning, setClipRunning] = useState(false);
  const clip = useRef<MediaRecorder | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [history, setHistory] = useState<{
    past: readonly UndoStep[];
    future: readonly UndoStep[];
  }>({ past: [], future: [] });
  const replaying = useRef(false);
  const historyEdits = useRef(0);
  const [replayBusy, setReplayBusy] = useState(false);
  // Delete, Cut and Paste under way: each joins the history only once stored, so nothing overtakes them.
  const editing = useRef(false);
  const shooting = useRef(0);
  const shotsInOrder = useRef<Promise<void>>(Promise.resolve());
  const heldSteps = useRef<UndoStep[]>([]);
  const [shotsBusy, setShotsBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const copied = useCopiedDriveItems();
  // The picture shown large, which Flip Photo and Delete act on, and the window, for the menu bar.
  const [viewed, setViewed] = useState<PhotoBoothPicture | null>(null);
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const frameRef = useCallback(
    (element: HTMLDivElement | null) => {
      setFrame(element);
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    },
    [ref],
  );
  const [camera, setCamera] = useState<Camera>("starting");
  // Whether a video of the camera on the page has a frame to take.
  const [framed, setFramed] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photos, setPhotos] = useState<readonly Photo[]>([]);
  // The library: loading, read, or not readable (the window then takes and deletes nothing,
  // since it cannot know what Photos keeps).
  const [listed, setListed] = useState<"loading" | "ready" | "unreadable">("loading");
  const loading = listed === "loading";
  const [notice, setNotice] = useState<string | null>(null);
  // The camera videos on the page: a picture is taken from one that has a frame (a video that is
  // not on the page gets none in WebKit).
  const videos = useRef(new Set<HTMLVideoElement>()).current;
  // Object URLs this window made, by thumbnail key, revoked when it closes.
  const urls = useRef(new Map<string, string>());
  const requested = useRef(new Set<string>());
  // The thumbnail keys the strip has now, for reads that answer later.
  const current = useRef(new Set<string>());
  const live = useRef(true);
  // The latest read of the library; an older one that answers later is dropped.
  const reads = useRef(0);
  // Reads the library again, dropping any read begun before (set by the effect below).
  const reread = useRef<() => void>(() => {});
  // This window, named in what it announces so it does not read its own changes again.
  const [origin] = useState(() => `photo-booth:${crypto.randomUUID()}`);
  // The library's records of the strip's pictures, for Export… (their originals on the drive).
  const records = useRef(new Map<string, LibraryPhoto>());

  useEffect(() => {
    live.current = true;
    const made = urls.current;
    return () => {
      live.current = false;
      // A clip under way ends with the window and is still saved.
      if (clip.current?.state === "recording") clip.current.stop();
      for (const url of made.values()) URL.revokeObjectURL(url);
      made.clear();
    };
  }, []);

  const listDevices = useCallback(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((listed) => {
        if (live.current) setDevices(listed);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    const media = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    media?.addEventListener?.("devicechange", listDevices);
    return () => media?.removeEventListener?.("devicechange", listDevices);
  }, [listDevices]);

  // The camera, for as long as the window is open.
  useEffect(() => {
    let open = true;
    let got: MediaStream | null = null;
    const media = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    if (!media?.getUserMedia) {
      setCamera("unsupported");
      return;
    }
    // A camera chosen earlier may have gone: the browser's default stands in for it.
    // Until the next camera answers, the one just stopped gives no shutter and no picture.
    setStream(null);
    setFramed(false);
    setCamera("starting");
    const ask = (deviceId: string) =>
      media.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      });
    ask(cameraId)
      .catch((error: unknown) => {
        if (cameraId && cameraProblem(error) === "missing") return ask("");
        throw error;
      })
      .then(
        (given) => {
          if (!open) {
            for (const track of given.getTracks()) track.stop();
            return;
          }
          got = given;
          setStream(given);
          setCamera("ready");
          // A browser names its devices only once one has been allowed.
          listDevices();
        },
        (error) => {
          if (!open) return;
          console.warn(`Photo Booth could not use the camera (${error})`);
          setCamera(cameraProblem(error));
        },
      );
    return () => {
      open = false;
      if (got) for (const track of got.getTracks()) track.stop();
    };
  }, [cameraId, listDevices]);

  useEffect(() => {
    const wanted = devices.find(
      (device) => device.kind === "videoinput" && device.label === cameraChoice,
    );
    if (wanted && wanted.deviceId !== stream?.getVideoTracks()[0]?.getSettings().deviceId) {
      setCameraId(wanted.deviceId);
    }
  }, [cameraChoice, devices, stream]);

  // Photo Booth's pictures in the library: when the window opens, and again whenever the library
  // changes elsewhere (a picture deleted, recovered or edited in Photos). Pictures still being
  // saved stay, and so do the thumbnails already read of a revision that has not changed.
  useEffect(() => {
    const read = (event?: Event) => {
      if (event && announcedBy(event) === origin) return;
      reads.current += 1;
      const turn = reads.current;
      loadLibrary().then(
        (library) => {
          if (!live.current || turn !== reads.current) return;
          const booth = boothPhotos(library.photos);
          records.current = new Map(booth.map((photo) => [photo.id, photo]));
          const kept = new Set(booth.map((photo) => photo.id));
          setPhotos((all) => {
            const before = new Map(all.map((each) => [each.id, each]));
            return [
              ...booth.map((photo) => {
                const rev = photo.edited_ms ?? 0;
                const was = before.get(photo.id);
                return {
                  id: photo.id,
                  effect: photo.effect ?? "normal",
                  saved: true,
                  rev,
                  clip: photo.duration_ms !== null,
                  src: was?.rev === rev ? was.src : undefined,
                };
              }),
              ...all.filter((each) => !each.saved && !kept.has(each.id)),
            ];
          });
          setListed("ready");
        },
        (error) => {
          if (!live.current || turn !== reads.current) return;
          console.error(`Photo Booth could not read the Photos library (${error})`);
          // Only a first read that fails leaves the window unusable; later, the strip stays.
          setListed((was) => (was === "loading" ? "unreadable" : was));
        },
      );
    };
    read();
    reread.current = () => read();
    window.addEventListener(LIBRARY_CHANGED_EVENT, read);
    return () => window.removeEventListener(LIBRARY_CHANGED_EVENT, read);
  }, [origin]);

  // A thumbnail the strip no longer shows (the picture left, or Photos edited it) gives back its
  // object URL, and is read again if it returns.
  useEffect(() => {
    const shown = new Set(photos.map(thumbOf));
    current.current = shown;
    for (const [key, url] of urls.current) {
      if (shown.has(key)) continue;
      URL.revokeObjectURL(url);
      urls.current.delete(key);
    }
    for (const key of requested.current) if (!shown.has(key)) requested.current.delete(key);
  }, [photos]);

  // The thumbnails of the pictures the strip shows, each revision read once.
  useEffect(() => {
    const wanted = photos.filter(
      (photo) => !photo.src && photo.saved && !requested.current.has(thumbOf(photo)),
    );
    if (wanted.length === 0) return;
    const keys = new Map(wanted.map((photo) => [photo.id, thumbOf(photo)]));
    for (const key of keys.values()) requested.current.add(key);
    readThumbs([...keys.keys()]).then(
      (found) => {
        if (!live.current) return;
        const made = new Map<string, string>();
        for (const [id, blob] of found) {
          const key = keys.get(id);
          // A revision the strip no longer shows (edited again meanwhile), or one another read
          // already brought in, is not kept.
          if (!key || !current.current.has(key) || urls.current.has(key)) continue;
          const url = URL.createObjectURL(blob);
          urls.current.set(key, url);
          made.set(key, url);
        }
        setPhotos((all) =>
          all.map((each) => {
            const url = made.get(thumbOf(each));
            return url ? { ...each, src: url } : each;
          }),
        );
      },
      (error) => {
        if (!live.current) return;
        // Read again the next time the strip changes.
        for (const key of keys.values()) requested.current.delete(key);
        console.warn(`Photo Booth could not read its pictures (${error})`);
      },
    );
  }, [photos]);

  // Its object URL is revoked by the effect above.
  const forget = (id: string) => setPhotos((all) => all.filter((each) => each.id !== id));

  /** Whether the picture was kept in Photos; a failure is said in the window. */
  const save = async (id: string, effect: string, blob: Blob, takenMs: number) => {
    try {
      const kept = await importPicture(blob, {
        id,
        name: pictureName(takenMs),
        source: "photo-booth",
        effect,
        folder: PHOTO_BOOTH_FOLDER,
        takenMs,
      });
      records.current.set(id, kept);
      // An open Photos window shows the new shot, also when this window has closed meanwhile.
      if (live.current) {
        setPhotos((all) => all.map((each) => (each.id === id ? { ...each, saved: true } : each)));
        // A read begun before the save answers without the shot: it is dropped for a new one.
        reread.current();
      }
      announceChange(origin);
      return true;
    } catch (error) {
      console.warn(`Photo Booth could not save a picture to Photos (${error})`);
      if (!live.current) return false;
      forget(id);
      setNotice(
        `The picture could not be saved to Photos, so it was not kept: ${error instanceof Error ? error.message : error}.`,
      );
      return false;
    }
  };

  const take = (picture: PhotoBoothPicture) => {
    onPictureTaken?.(picture);
    const started = performance.now();
    // Choosing an effect mounts a new video, which has no frame for a moment.
    const shoot = () => {
      if (!live.current) return;
      const video = shownVideo();
      if (video) {
        playShutter();
        keepCanvas(frameOf(video, findEffect(picture.effect)), findEffect(picture.effect).id);
      } else if (performance.now() - started < FIRST_FRAME_WAIT_MS) {
        requestAnimationFrame(shoot);
      } else {
        setNotice("The camera had no picture to take.");
      }
    };
    shoot();
  };

  /** The video on the page with a frame, or none. */
  const shownVideo = () => [...videos].find((each) => each.videoWidth > 0 && each.videoHeight > 0);
  /** The picture is what the view showed: the frame cut to the view's shape. */
  const aspectOf = (video: HTMLVideoElement) =>
    video.clientWidth > 0 && video.clientHeight > 0
      ? video.clientWidth / video.clientHeight
      : video.videoWidth / video.videoHeight;

  // A backdrop asks the person out of the frame, and learns the empty background from what the
  // camera sees then. Choosing it again, or coming back to it, learns the background again.
  const [steppingOut, setSteppingOut] = useState(false);
  const backdropInView = leftView === "camera" && isBackdrop(leftEffect) && framed;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the video is read when the wait ends
  useEffect(() => {
    if (!backdropInView) {
      setBackdropStage("whole");
      setSteppingOut(false);
      return;
    }
    setBackdropStage("learning");
    setSteppingOut(true);
    const wait = setTimeout(() => {
      const video = shownVideo();
      if (video) {
        learnEmptyFrame(
          bakeEffect(
            video,
            video.videoWidth,
            video.videoHeight,
            findEffect("normal"),
            aspectOf(video),
          ),
        );
      }
      setSteppingOut(false);
    }, STEP_OUT_MS);
    return () => clearTimeout(wait);
  }, [backdropInView, leftEffect]);

  const [filledBackdrops, setFilledBackdrops] = useState<readonly string[]>([]);
  useEffect(() => {
    loadBackdrops()
      .then((filled) => {
        if (live.current) setFilledBackdrops(filled);
      })
      .catch(() => {
        if (live.current) setNotice("Your backdrops on the drive could not be read.");
      });
  }, []);
  const backdropsRef = useDesktopDrop<HTMLDivElement>({
    enabled: leftPage === BACKDROPS_PAGE,
    accepts: isBackdropPicture,
    refusal: () => "A backdrop is a picture.",
    sayRefusal: setNotice,
    onDrop: async (items) => {
      if (filledBackdrops.length + items.length > USER_BACKDROPS.length) {
        setLeftView("camera");
        setNotice(
          `Photo Booth keeps ${USER_BACKDROPS.length} backdrops. Remove one from Documents/Photo Booth Backdrops in Finder first.`,
        );
        return;
      }
      try {
        for (const file of await filesOfDrag(items)) await keepBackdrop(file);
        const filled = await loadBackdrops();
        if (live.current) setFilledBackdrops(filled);
      } catch {
        if (live.current) setNotice(`“${items[0]?.name}” could not be kept as a backdrop.`);
      }
    },
  });
  const frameOf = (video: HTMLVideoElement, effect: PhotoBoothEffect) =>
    bakeEffect(
      video,
      video.videoWidth,
      video.videoHeight,
      effect,
      aspectOf(video),
      document,
      autoFlip,
    );

  /** Puts a finished picture or clip in the strip at once, and saves it: its id once kept. */
  const keep = (blob: Blob, effect: string, isClip: boolean, takenMs: number) => {
    const id = crypto.randomUUID();
    if (!isClip) {
      const src = URL.createObjectURL(blob);
      const fresh = { id, effect, saved: false, rev: 0, clip: false, src };
      urls.current.set(thumbOf(fresh), src);
      requested.current.add(thumbOf(fresh));
      setPhotos((all) => [...all, fresh]);
    } else if (live.current) {
      setPhotos((all) => [...all, { id, effect, saved: false, rev: 0, clip: true }]);
    }
    setNotice(null);
    return save(id, effect, blob, takenMs).then((kept) => (kept ? id : null));
  };

  /** Keeps what the shutter took, and a step that takes it back once it is kept. Until then nothing
   * else may join the history, which keeps the order in which things were done. Its place is taken
   * now: encoding and saving can each finish in any order, and Undo takes back the last one taken. */
  const keepTaken = (
    label: string,
    encoded: Promise<Blob | null>,
    effect: string,
    isClip: boolean,
    takenMs: number,
  ) => {
    shooting.current += 1;
    setShotsBusy(true);
    const saved = encoded.then((blob) => (blob ? keep(blob, effect, isClip, takenMs) : null));
    const turn = shotsInOrder.current
      .then(() => saved)
      .then((id) => {
        shooting.current -= 1;
        if (!live.current) return;
        setShotsBusy(shooting.current > 0);
        if (!id) {
          releaseSteps();
          return;
        }
        const ids = [id];
        remember({ label, undo: () => hidePictures(ids), redo: () => restorePictures(ids) });
        releaseSteps();
      });
    shotsInOrder.current = turn;
    return turn;
  };

  const keepCanvas = (canvas: HTMLCanvasElement, effect: string) => {
    const takenMs = Date.now();
    const encoded = new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    }).then((blob) => {
      if (!live.current) return null;
      if (!blob) setNotice("This browser could not encode the picture.");
      return blob;
    });
    return keepTaken("Take Photo", encoded, effect, false, takenMs);
  };

  const capture: NonNullable<PhotoBoothProps["capture"]> = {
    clipping: clipRunning,
    four: async (effect, flash) => {
      const tiles: HTMLCanvasElement[] = [];
      for (let shot = 0; shot < 4; shot += 1) {
        if (shot > 0) await new Promise((done) => setTimeout(done, FOUR_GAP_MS));
        if (!live.current) return;
        const video = shownVideo();
        if (!video) {
          setNotice("The camera had no picture to take.");
          return;
        }
        flash();
        playShutter();
        tiles.push(frameOf(video, effect));
      }
      await keepCanvas(fourUp(tiles), effect.id);
    },
    startClip: async (effect) => {
      const video = shownVideo();
      if (!video) {
        setNotice("The camera had no picture to record.");
        return;
      }
      if (typeof MediaRecorder === "undefined") {
        setNotice("This browser cannot record a movie clip.");
        return;
      }
      const type = recordingType("movie", (each) => MediaRecorder.isTypeSupported(each));
      // A clip without a microphone is a silent one.
      const voice = await navigator.mediaDevices
        .getUserMedia({
          audio: chosenMicrophone ? { deviceId: { exact: chosenMicrophone } } : true,
        })
        .catch(() =>
          chosenMicrophone ? navigator.mediaDevices.getUserMedia({ audio: true }) : null,
        )
        .catch(() => null);
      if (!live.current) {
        for (const track of voice?.getTracks() ?? []) track.stop();
        return;
      }
      // A browser names its microphones only once one has been allowed, which may be just now.
      if (voice) listDevices();
      let painting: ReturnType<typeof setInterval> | undefined;
      let frames: MediaStream | undefined;
      const end = () => {
        clearInterval(painting);
        for (const track of frames?.getTracks() ?? []) track.stop();
        for (const track of voice?.getTracks() ?? []) track.stop();
      };
      try {
        const painter = clipCanvas(video, effect, aspectOf(video), autoFlip);
        frames = painter.canvas.captureStream();
        painting = setInterval(painter.draw, CLIP_FRAME_MS);
        const recorder = new MediaRecorder(
          new MediaStream([...frames.getVideoTracks(), ...(voice?.getAudioTracks() ?? [])]),
          type ? { mimeType: type } : undefined,
        );
        const chunks: Blob[] = [];
        const takenMs = Date.now();
        let failure: string | null = null;
        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        });
        recorder.addEventListener("error", (event) => {
          const said = (event as Event & { error?: { message?: unknown } }).error?.message;
          failure = typeof said === "string" && said ? said : "the recorder failed";
        });
        // The one end of every clip: Stop, the window going away, or the recorder stopping by itself.
        recorder.addEventListener(
          "stop",
          () => {
            end();
            clip.current = null;
            setClipRunning(false);
            if (chunks.length === 0) {
              setNotice(failure ? `The clip stopped: ${failure}.` : "Nothing was recorded.");
              return;
            }
            const blob = new Blob(chunks, { type: plainType(recorder.mimeType || type || "") });
            void keepTaken("Record Clip", Promise.resolve(blob), effect.id, true, takenMs).then(
              () => {
                if (failure && live.current) {
                  setNotice(`The clip stopped early and what was recorded was kept: ${failure}.`);
                }
              },
            );
          },
          { once: true },
        );
        recorder.start();
        clip.current = recorder;
        setClipRunning(true);
      } catch (error) {
        end();
        setNotice(
          `The clip could not be started: ${error instanceof Error ? error.message : error}.`,
        );
      }
    },
    stopClip: () => {
      if (clip.current?.state === "recording") clip.current.stop();
    },
  };

  const remember = (step: UndoStep) => {
    historyEdits.current += 1;
    setHistory(({ past }) => ({ past: [...past, step], future: [] }));
  };

  /** Takes back or brings back the latest step. One that failed stays to be tried again, unless
   * what it acts on is gone for good, which would otherwise bar the steps before it. */
  const replay = async (way: "undo" | "redo") => {
    const step = (way === "undo" ? history.past : history.future).at(-1);
    if (!step || replaying.current || flipping.current || editing.current || shooting.current > 0) {
      return;
    }
    replaying.current = true;
    setReplayBusy(true);
    setNotice(null);
    const edits = historyEdits.current;
    const place = history.past.length;
    const without = (steps: readonly UndoStep[]) => steps.filter((each) => each !== step);
    try {
      await step[way]();
      // A new edit while this ran has begun another branch: a step taken back is no longer ahead of
      // it, and one brought back comes before it.
      setHistory(({ past, future }) =>
        way === "undo"
          ? {
              past: without(past),
              future: edits === historyEdits.current ? [...future, step] : future,
            }
          : {
              past: [...past.slice(0, place), step, ...past.slice(place)],
              future: without(future),
            },
      );
    } catch (error) {
      console.warn(`Photo Booth could not ${way} ${step.label} (${error})`);
      if (error instanceof LibraryError && error.status === 404) {
        setHistory(({ past, future }) => ({ past: without(past), future: without(future) }));
      }
      if (live.current) {
        setNotice(
          `${step.label} could not be ${way === "undo" ? "undone" : "redone"}: ${error instanceof Error ? error.message : error}.`,
        );
      }
    } finally {
      replaying.current = false;
      if (live.current) setReplayBusy(false);
      releaseSteps();
    }
  };

  /**
   * One change to each of a step's pictures, however many of them it reaches. A picture gone for
   * good leaves the step, so that the others can still be brought back; if none is left, the 404
   * ends the step. Another failure is thrown once the rest have been tried, and what did change is
   * announced and read again either way.
   */
  const changeEach = async (ids: string[], change: (id: string) => Promise<void>) => {
    let failure: unknown;
    let missing: unknown;
    let gone = 0;
    try {
      for (const id of [...ids]) {
        try {
          await change(id);
        } catch (error) {
          if (error instanceof LibraryError && error.status === 404) {
            ids.splice(ids.indexOf(id), 1);
            missing = error;
            gone += 1;
          } else failure ??= error;
        }
      }
    } finally {
      announceChange(origin);
      // A read begun before the change still lists what it was: it is dropped for a new one.
      if (live.current) reread.current();
    }
    if (failure) throw failure;
    if (ids.length === 0) throw missing;
    if (gone > 0 && live.current) {
      setNotice(
        gone === 1 ? "One of those pictures is gone." : `${gone} of those pictures are gone.`,
      );
    }
  };

  /** Undo of a delete, or Redo of a paste: back from Recently Deleted. */
  const restorePictures = (ids: string[]) =>
    changeEach(ids, async (id) => {
      records.current.set(id, await changePhoto(id, { deleted: false }));
    });
  /** Redo of a delete, or Undo of a paste: into Recently Deleted. */
  const hidePictures = (ids: string[]) =>
    changeEach(ids, async (id) => {
      await changePhoto(id, { deleted: true });
      if (live.current) forget(id);
    });

  /** One change at a time, so that history keeps the order in which they were asked for. */
  const changing = () => {
    if (
      !replaying.current &&
      !flipping.current &&
      !editing.current &&
      shooting.current === 0 &&
      !captureBusy
    ) {
      return false;
    }
    setNotice("Wait for the last change to finish first.");
    return true;
  };
  /** Holds Undo, Redo and every other change from the moment `work` begins until it is stored. */
  const whileEditing = async (work: () => Promise<void>) => {
    if (changing()) return;
    editing.current = true;
    setEditBusy(true);
    try {
      await work();
    } finally {
      editing.current = false;
      if (live.current) setEditBusy(false);
      releaseSteps();
    }
  };

  /** Moves pictures to Photos' Recently Deleted, as one step of Undo. */
  const removePictures = (chosen: readonly PhotoBoothPicture[], label = "Delete") =>
    whileEditing(() => removeNow(chosen, label));
  const removeNow = async (chosen: readonly PhotoBoothPicture[], label: string) => {
    const held = photos.filter((each) => chosen.some((picture) => picture.id === each.id));
    const ready = held.filter((each) => each.saved);
    if (ready.length < held.length) {
      setNotice(
        held.length === 1
          ? "That photo is still being saved."
          : "Photos still being saved were left.",
      );
    }
    const gone: string[] = [];
    try {
      for (const photo of ready) {
        await changePhoto(photo.id, { deleted: true });
        gone.push(photo.id);
        if (live.current) forget(photo.id);
      }
    } catch (error) {
      console.warn(`Photo Booth could not delete a picture (${error})`);
      if (live.current) {
        setNotice(
          ready.length === 1
            ? "The photo could not be deleted."
            : "Not every photo could be deleted.",
        );
      }
    }
    if (gone.length === 0) return;
    announceChange(origin);
    if (!live.current) return;
    reread.current();
    remember({
      label,
      undo: () => restorePictures(gone),
      redo: () => hidePictures(gone),
    });
  };

  const changeEffect = (next: string) => {
    const before = leftEffect;
    setLeftEffect(next);
    const step: UndoStep = {
      label: "Effect",
      undo: async () => setLeftEffect(before),
      redo: async () => setLeftEffect(next),
    };
    // Choosing an effect need not wait, but its step follows what was asked for before it.
    if (replaying.current || flipping.current || editing.current || shooting.current > 0) {
      heldSteps.current.push(step);
    } else remember(step);
  };

  /** Once nothing is under way, the steps that had to wait join the history. */
  const releaseSteps = () => {
    if (replaying.current || flipping.current || editing.current || shooting.current > 0) return;
    if (!live.current) return;
    for (const step of heldSteps.current.splice(0)) remember(step);
  };

  const pictures: PhotoBoothPicture[] = photos.map((photo, index) => ({
    number: index + 1,
    effect: photo.effect,
    id: photo.id,
    rev: photo.rev,
    src: photo.src,
    baked: true,
    clip: photo.clip,
  }));
  const selection = pictures.filter((each) => each.id && selected.includes(each.id));
  /** What the Edit and File rows act on: the selection, or the picture shown. */
  const chosenPictures = selection.length > 0 ? selection : viewed ? [viewed] : [];
  /** Export…: the picture's original, as Photos keeps it on the drive, handed to the computer. */
  const exportPicture = (picture: PhotoBoothPicture) => {
    const record = picture.id ? records.current.get(picture.id) : undefined;
    if (!record) {
      setNotice("That photo is still being saved.");
      return;
    }
    readOriginal(record).then(
      (blob) => download(blob, `${record.name}.${extensionOf(record.mime)}`),
      (error) => {
        console.warn(`Photo Booth could not export a picture (${error})`);
        if (live.current) {
          setNotice(
            `The photo could not be exported: ${error instanceof Error ? error.message : error}.`,
          );
        }
      },
    );
  };

  const readRecord = useCallback(async (record: LibraryPhoto) => {
    const original = await readOriginal(record);
    if (!record.edit) return original;
    // Edited in Photos: shown as Photos shows it, as the strip's thumbnail is.
    const decoded = await decodePicture(original);
    try {
      const side = Math.max(decoded.width, decoded.height);
      const edited = await encodeJpeg(
        renderEdit(decoded, record.edit, side),
        Number.MAX_SAFE_INTEGER,
        [0.92],
      );
      if (!edited) throw new Error("this browser could not draw the edited picture");
      return edited;
    } finally {
      decoded.close();
    }
  }, []);
  const readPicture = useCallback(
    async (picture: PhotoBoothPicture) => {
      const record = picture.id ? records.current.get(picture.id) : undefined;
      if (!record) throw new Error("still being saved");
      return readRecord(record);
    },
    [readRecord],
  );

  /** Flip Photo: an edit in the library, so Photos shows it flipped and Revert takes it back. A
   * second flip takes the first back, so it is its own Undo. */
  const flipping = useRef(false);
  const [flipBusy, setFlipBusy] = useState(false);
  const flipOnce = async (id: string) => {
    const record = records.current.get(id);
    if (!record) throw new LibraryError("the photo is no longer in Photo Booth", 404);
    flipping.current = true;
    setFlipBusy(true);
    try {
      const edit = flipEdit(record.edit ?? NO_EDIT);
      let updated: LibraryPhoto;
      if (isIdentity(edit)) updated = await changePhoto(record.id, { edit: null });
      else {
        const decoded = await decodePicture(await readOriginal(record));
        try {
          updated = await changePhoto(record.id, { edit, thumb: await thumbnailOf(decoded, edit) });
        } finally {
          decoded.close();
        }
      }
      // The next flip starts from this one, whether or not the read below has answered.
      records.current.set(record.id, updated);
      announceChange(origin);
      if (live.current) reread.current();
    } finally {
      flipping.current = false;
      if (live.current) setFlipBusy(false);
    }
  };
  const flipPicture = async (picture: PhotoBoothPicture) => {
    const id = picture.id;
    if (!id || !records.current.has(id)) {
      setNotice("That photo is still being saved.");
      return;
    }
    if (changing()) return;
    try {
      await flipOnce(id);
      if (!live.current) return;
      remember({ label: "Flip Photo", undo: () => flipOnce(id), redo: () => flipOnce(id) });
    } catch (error) {
      console.warn(`Photo Booth could not flip a picture (${error})`);
      if (live.current) {
        setNotice(
          `The photo could not be flipped: ${error instanceof Error ? error.message : error}.`,
        );
      }
    } finally {
      releaseSteps();
    }
  };

  /** One Copy at a time: a later write cannot be held back to follow an earlier one, as WebKit refuses a
   * clipboard write begun after an await, and the earlier one would otherwise land over it. */
  const stillCopying = () => {
    if (!copiedHere || copiedHere.written) return false;
    setNotice("Wait for the last copy to finish first.");
    return true;
  };
  /** Copy: every picture on the desktop's clipboard for this and other applications, and the first
   * still on the browser's as well, which holds one picture and no movies. */
  const copyPictures = (chosen: readonly PhotoBoothPicture[]) => {
    if (stillCopying()) return;
    const held = chosen.flatMap((picture) => {
      const record = picture.id ? records.current.get(picture.id) : undefined;
      return record ? [{ picture, record }] : [];
    });
    if (held.length === 0) {
      setNotice("That photo is still being saved.");
      return;
    }
    copiedEffects.clear();
    copyDriveItems(
      held.map(({ picture, record }) => {
        copiedEffects.set(record.file, picture.effect);
        return {
          id: record.file,
          name: `${record.name}.${extensionOf(record.mime)}`,
          kind: "file" as const,
          type: record.mime,
          size: record.bytes,
          // The drive holds the original: an edited picture is pasted as it is shown.
          ...(record.edit ? { bytes: () => readRecord(record) } : {}),
        };
      }),
    );
    const items = copiedDriveItems();
    const still = held.find(({ picture }) => !picture.clip);
    if (!still) {
      // A movie has no form on the browser's clipboard. Its name takes the place of a picture copied
      // earlier, so that a picture found there afterwards can only be one copied since.
      const text = held[0]?.record.name ?? "";
      noteCopied(
        items,
        Promise.resolve(navigator.clipboard?.writeText(text)).then(
          () => (navigator.clipboard ? { text } : null),
          () => null,
        ),
      );
      return;
    }
    if (!canWriteClipboardPicture()) {
      noteCopied(items, Promise.resolve(null));
      return;
    }
    const bytes = readRecord(still.record);
    noteCopied(
      items,
      writeClipboardPicture(bytes)
        .then(() => bytes)
        .then((picture) => ({ picture }))
        .catch(async (error) => {
          console.warn(`The browser's clipboard refused a picture (${error})`);
          if (live.current) {
            setNotice(
              "The picture is copied on this desktop only: the browser did not let it onto its clipboard, so other programs cannot paste it.",
            );
          }
          const stale = canReadClipboardPictures()
            ? (await readClipboardSeen().catch(() => null))?.pictures[0]
            : undefined;
          return stale ? { stale } : null;
        }),
    );
  };

  const cutPictures = (chosen: readonly PhotoBoothPicture[]) => {
    if (changing() || stillCopying()) return;
    copyPictures(chosen);
    setSelected([]);
    void removePictures(chosen, "Cut");
  };

  const keepPasted = async (blobs: readonly { blob: Blob; effect: string }[]) => {
    const at = Date.now();
    const ids: string[] = [];
    for (const [index, { blob, effect }] of blobs.entries()) {
      const id = await keep(blob, effect, blob.type.startsWith("video/"), at + index);
      if (id) ids.push(id);
    }
    if (ids.length === 0 || !live.current) return;
    remember({
      label: "Paste",
      undo: () => hidePictures(ids),
      redo: () => restorePictures(ids),
    });
  };

  /**
   * Whether another program has replaced the computer's clipboard since the desktop's was filled. Any
   * picture there counts unless it is the one Copy left, as a page cannot tell one copied since from
   * one copied before. With no picture there, it counts only against what this window's Copy left: a
   * copy in Finder writes nothing to that clipboard, so what it holds says nothing about Finder's.
   */
  const replacedBy = async ({ pictures, text }: ClipboardSeen) => {
    const here = copiedHere;
    const left = here ? await here.left : null;
    const first = pictures[0];
    if (first && left && "stale" in left) return !(await samePicture(left.stale, first));
    if (first) return !left || !("picture" in left) || !(await samePicture(left.picture, first));
    if (!left || here?.items !== copiedDriveItems()) return false;
    return "picture" in left || "stale" in left || text !== left.text;
  };
  /** What another program left on the clipboard takes the place of the desktop's. */
  const pasteReplacement = async ({ pictures }: ClipboardSeen) => {
    clearCopiedDriveItems();
    if (pictures.length > 0) {
      await keepPasted(pictures.map((blob) => ({ blob, effect: "normal" })));
      return;
    }
    setNotice("The clipboard holds no picture to paste.");
  };
  const pasteDesktopItems = async () => {
    const items = fileItemsOfDrag(copiedDriveItems());
    const media = items.filter(isMediaItem);
    if (media.length > 0) {
      // Copy may fill this map again while the bytes are read.
      const effects = media.map((each) => copiedEffects.get(each.id) ?? "normal");
      const files = await filesOfDrag(media);
      await keepPasted(
        files.map((blob, index) => ({
          blob,
          effect: effects[index] ?? "normal",
        })),
      );
      return true;
    }
    if (items.length > 0) {
      setNotice("Photo Booth pastes pictures and movies: what was copied is neither.");
      return true;
    }
    return false;
  };
  const pasteFailed = (error: unknown) => {
    console.warn(`Photo Booth could not paste (${error})`);
    if (!live.current) return;
    setNotice(
      error instanceof DOMException && error.name === "NotAllowedError"
        ? "The browser did not let Photo Booth read its clipboard."
        : `The clipboard could not be pasted: ${error instanceof Error ? error.message : error}.`,
    );
  };

  /** Paste: what is on the desktop's clipboard, unless another program has replaced the computer's
   * since, or else the picture on the browser's. */
  const pastePictures = () =>
    whileEditing(async () => {
      try {
        if (copiedDriveItems().length > 0) {
          // Read after Copy's write, or this would find what that write is about to replace.
          await copiedHere?.left;
          const seen = canReadClipboardPictures()
            ? await readClipboardSeen().catch(() => null)
            : null;
          if (seen && (await replacedBy(seen))) {
            await pasteReplacement(seen);
            return;
          }
          if (await pasteDesktopItems()) return;
        }
        await pasteReplacement(await readClipboardSeen());
      } catch (error) {
        pasteFailed(error);
      }
    });

  /** Print…: the browser's print dialog over the picture shown, as the window shows it. */
  const printViewed = (picture: PhotoBoothPicture) => {
    readPicture(picture).then(
      (blob) => {
        const url = URL.createObjectURL(blob);
        printPictures([url], "Photo Booth", () => URL.revokeObjectURL(url));
      },
      (error) => {
        console.warn(`Photo Booth could not print a picture (${error})`);
        if (live.current) setNotice("The photo could not be printed.");
      },
    );
  };
  const fileOf = (picture: PhotoBoothPicture | null) =>
    picture?.id ? records.current.get(picture.id)?.file : undefined;
  /** What a Share row hands over: the originals on the drive. */
  const shareItems = (pictures: readonly PhotoBoothPicture[]) =>
    pictures.flatMap((picture) => {
      const record = picture.id ? records.current.get(picture.id) : undefined;
      return record?.file
        ? [{ id: record.file, name: record.name, kind: "file" as const, type: record.mime }]
        : [];
    });
  /** What a drag out of the strip carries: a copy of each picture as it is shown, so that wherever it
   * lands the original stays in the Photos library. */
  const dragItems = (pictures: readonly PhotoBoothPicture[]): DesktopDragItem[] =>
    pictures.flatMap((picture) => {
      const record = picture.id ? records.current.get(picture.id) : undefined;
      return record
        ? [
            {
              id: record.file,
              name: `${record.name}.${extensionOf(record.mime)}`,
              kind: "file" as const,
              type: record.mime,
              size: record.bytes,
              bytes: () => readRecord(record),
            },
          ]
        : [];
    });
  const dragPicture = (event: ReactPointerEvent<HTMLElement>, picture: PhotoBoothPicture) => {
    if (event.button !== 0 || event.ctrlKey) return;
    const dragged = selection.includes(picture) ? selection : [picture];
    beginDesktopDrag(event.nativeEvent, {
      from: "photo-booth",
      icon: event.currentTarget.querySelector("img"),
      items: () => dragItems(dragged),
    });
  };
  const makeDesktopPicture = (picture: PhotoBoothPicture) => {
    const record = picture.id ? records.current.get(picture.id) : undefined;
    if (!record) return;
    setDesktopPicture(record, takePictureTicket()).catch((error: unknown) => {
      console.warn(`Photo Booth could not set the desktop picture (${error})`);
      if (live.current) {
        setNotice(
          `The desktop picture could not be set: ${error instanceof Error ? error.message : error}.`,
        );
      }
    });
  };
  /** The picture the sheet is choosing a card for, and the cards it lists. */
  const [contactFor, setContactFor] = useState<{
    record: LibraryPhoto;
    cards: readonly ContactChoice[];
    card: string | null;
  } | null>(null);
  const chooseContact = (picture: PhotoBoothPicture) => {
    const record = picture.id ? records.current.get(picture.id) : undefined;
    if (!record) return;
    contactChoices().then(
      (cards) => {
        if (live.current) setContactFor({ record, cards, card: cards[0]?.id ?? null });
      },
      (error: unknown) => {
        console.warn(`Photo Booth could not read the cards (${error})`);
        if (live.current) setNotice("Your cards in Contacts could not be read.");
      },
    );
  };
  const makeContactPicture = (record: LibraryPhoto, card: string) => {
    setContactFor(null);
    setContactPicture(record, card).catch((error: unknown) => {
      console.warn(`Photo Booth could not set the contact's picture (${error})`);
      if (live.current) {
        setNotice(
          `The contact’s picture could not be set: ${error instanceof Error ? error.message : error}.`,
        );
      }
    });
  };
  /** The rows of File's Share, the picture's menu and the Share button, for these pictures. */
  const shareRows = (pictures: readonly PhotoBoothPicture[]) => {
    const only = pictures.length === 1 ? pictures[0] : undefined;
    const notKeptYet =
      only?.id && !records.current.has(only.id) ? "This picture is still being kept." : undefined;
    const noDesktop = !only
      ? "Choose one picture to make it the desktop picture."
      : only.clip
        ? "A movie clip can’t be the desktop picture."
        : notKeptYet;
    const noContact = !only
      ? "Choose one picture to make it a contact’s picture."
      : only.clip
        ? "A movie clip can’t be a contact’s picture."
        : notKeptYet;
    return (
      <>
        <FileShareItems items={shareItems(pictures)} from="photo-booth" />
        <MenuSeparator />
        <MenuItem
          disabled={noDesktop !== undefined}
          title={noDesktop}
          data-reason={noDesktop}
          onClick={() => {
            if (only) makeDesktopPicture(only);
          }}
        >
          Set Desktop Picture
        </MenuItem>
        <MenuItem
          disabled={noContact !== undefined}
          title={noContact}
          data-reason={noContact}
          onClick={() => {
            if (only) chooseContact(only);
          }}
        >
          Set Contact Picture…
        </MenuItem>
      </>
    );
  };

  const usable = listed === "ready" && viewed !== null && viewed.id !== undefined;
  const stillShown = usable && viewed?.clip !== true;
  const anyChosen = listed === "ready" && chosenPictures.length > 0;
  const isKey = (props.state ?? "key") === "key";
  const lastDone = history.past.at(-1);
  const lastUndone = history.future.at(-1);
  const canReplay = !replayBusy && !flipBusy && !captureBusy && !editBusy && !shotsBusy;
  const canUndo = lastDone !== undefined && canReplay;
  const canRedo = lastUndone !== undefined && canReplay;
  const canPaste = listed === "ready" && !replayBusy;
  const menuPastes = copied.length > 0 || canReadClipboardPictures();
  const stillKeys = slideshow
    ? []
    : [
        ...(canUndo ? [{ equivalent: "command+z", run: () => void replay("undo") }] : []),
        ...(canRedo ? [{ equivalent: "shift+command+z", run: () => void replay("redo") }] : []),
        ...(anyChosen
          ? [
              { equivalent: "command+x", run: () => cutPictures(chosenPictures) },
              { equivalent: "command+c", run: () => copyPictures(chosenPictures) },
            ]
          : []),
      ];
  useWindowKeys(
    frame,
    isKey,
    stillKeys.map((each) => ({ ...each, notInText: true })),
  );
  const pasteNow = useRef<(files: readonly File[], text: string) => void>(() => {});
  pasteNow.current = (files, text) => {
    if (!canPaste || slideshow) return;
    const seen = { pictures: files.filter((file) => /^(image|video)\//.test(file.type)), text };
    if (copiedDriveItems().length === 0 && seen.pictures.length === 0) return;
    // The event holds what the clipboard had when it fired, which a write still under way will replace.
    const beforeTheWrite = copiedHere !== null && !copiedHere.written;
    void whileEditing(async () => {
      if (copiedDriveItems().length > 0 && (beforeTheWrite || !(await replacedBy(seen)))) {
        await pasteDesktopItems();
      } else {
        await pasteReplacement(seen);
      }
    }).catch(pasteFailed);
  };
  useEffect(() => {
    if (!isKey) return;
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || target.matches("input, textarea, select"))
      ) {
        return;
      }
      if (document.querySelector('[aria-modal="true"], [role="alertdialog"]')) return;
      // Command-V is left to the browser: its paste event brings what the computer's clipboard holds
      // without asking for permission.
      pasteNow.current(
        [...(event.clipboardData?.files ?? [])],
        event.clipboardData?.getData("text/plain") ?? "",
      );
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [isKey]);
  const pictureRows = (picture: PhotoBoothPicture) => (
    <>
      <MenuItem disabled={picture.clip} onClick={() => printViewed(picture)}>
        Print…
      </MenuItem>
      <MenuItem disabled={picture.clip} onClick={() => void flipPicture(picture)}>
        Flip Photo
      </MenuItem>
      <MenuItem
        onClick={() => {
          const file = fileOf(picture);
          if (file) showInFinder({ id: file });
        }}
      >
        Reveal in Finder
      </MenuItem>
      <Submenu>
        <SubmenuTrigger>Share</SubmenuTrigger>
        <SubmenuPopup aria-label="Share">
          {shareRows(chosenPictures.includes(picture) ? chosenPictures : [picture])}
        </SubmenuPopup>
      </Submenu>
    </>
  );
  useDesktopAppMenu(
    "photo-booth",
    "File",
    <>
      <MenuItem
        disabled={!anyChosen}
        onClick={() => {
          for (const picture of chosenPictures) exportPicture(picture);
        }}
      >
        Export…
      </MenuItem>
      <MenuItem
        keyEquivalent="command+p"
        disabled={!stillShown}
        onClick={() => viewed && printViewed(viewed)}
      >
        Print…
      </MenuItem>
      <MenuItem
        disabled={!usable}
        onClick={() => {
          const file = fileOf(viewed);
          if (file) showInFinder({ id: file });
        }}
      >
        Reveal in Finder
      </MenuItem>
      <Submenu>
        <SubmenuTrigger disabled={!anyChosen}>Share</SubmenuTrigger>
        <SubmenuPopup aria-label="Share">{shareRows(chosenPictures)}</SubmenuPopup>
      </Submenu>
      <MenuSeparator />
    </>,
    frame,
  );
  useDesktopAppMenu(
    "photo-booth",
    "Edit",
    <>
      <MenuItem keyEquivalent="command+z" disabled={!canUndo} onClick={() => void replay("undo")}>
        {lastDone ? `Undo ${lastDone.label}` : "Undo"}
      </MenuItem>
      <MenuItem
        keyEquivalent="shift+command+z"
        disabled={!canRedo}
        onClick={() => void replay("redo")}
      >
        {lastUndone ? `Redo ${lastUndone.label}` : "Redo"}
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        keyEquivalent="command+x"
        disabled={!anyChosen}
        onClick={() => cutPictures(chosenPictures)}
      >
        Cut
      </MenuItem>
      <MenuItem
        keyEquivalent="command+c"
        disabled={!anyChosen}
        onClick={() => copyPictures(chosenPictures)}
      >
        Copy
      </MenuItem>
      <MenuItem
        keyEquivalent="command+v"
        disabled={!canPaste || !menuPastes}
        title={menuPastes ? undefined : NO_CLIPBOARD_READ}
        data-reason={menuPastes ? undefined : NO_CLIPBOARD_READ}
        onClick={() => void pastePictures()}
      >
        Paste
      </MenuItem>
      <MenuItem
        disabled={!anyChosen}
        onClick={() => {
          void removePictures(chosenPictures);
          setSelected([]);
        }}
      >
        Delete
      </MenuItem>
      <MenuItem
        keyEquivalent="command+a"
        disabled={listed !== "ready" || photos.length === 0}
        onClick={() => setSelected(photos.filter((each) => each.saved).map((each) => each.id))}
      >
        Select All
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        disabled={!stillShown || flipBusy || replayBusy}
        onClick={() => {
          if (viewed) void flipPicture(viewed);
        }}
      >
        Flip Photo
      </MenuItem>
      <MenuCheckboxItem checked={autoFlip} onCheckedChange={setAutoFlip}>
        Auto Flip New Items
      </MenuCheckboxItem>
      <MenuSeparator />
      <MenuItem
        disabled={listed !== "ready" || photos.length === 0}
        onClick={() => setConfirmAll(true)}
      >
        Delete All
      </MenuItem>
    </>,
    frame,
  );
  useDesktopAppMenu(
    "photo-booth",
    "View",
    <>
      <MenuItem
        disabled={captureBusy}
        onClick={() => setLeftView(leftView === "effects" ? "camera" : "effects")}
      >
        {leftView === "effects" ? "Hide Effects" : "Show Effects"}
      </MenuItem>
      <MenuItem
        disabled={captureBusy || (leftView === "camera" && viewed === null)}
        onClick={() => {
          setBackToCamera((asked) => asked + 1);
          setLeftView("camera");
        }}
      >
        Show Photo Preview
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        disabled={captureBusy || listed !== "ready" || photos.every((each) => !each.saved)}
        onClick={() => setSlideshow(true)}
      >
        Start Slideshow
      </MenuItem>
    </>,
    frame,
  );
  const cameras = devices.filter((device) => device.kind === "videoinput" && device.label);
  const microphones = devices.filter((device) => device.kind === "audioinput" && device.label);
  const inUse = stream?.getVideoTracks()[0]?.label ?? "";
  useDesktopAppMenu(
    "photo-booth",
    "Camera",
    <>
      <MenuSection title="Camera">
        {cameras.length === 0 ? <MenuItem disabled>No Camera Found</MenuItem> : null}
        <MenuRadioGroup value={inUse} onValueChange={(value: string) => setCameraChoice(value)}>
          {cameras.map((device) => (
            <MenuRadioItem key={device.deviceId} value={device.label} disabled={captureBusy}>
              {device.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuSection>
      <MenuSeparator />
      <MenuSection title="Microphone">
        <MenuRadioGroup
          value={microphoneChoice || microphones[0]?.label || ""}
          onValueChange={(value: string) => setMicrophoneChoice(value)}
        >
          {microphones.map((device) => (
            <MenuRadioItem key={device.deviceId} value={device.label} disabled={captureBusy}>
              {device.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuSection>
      <MenuSeparator />
      <MenuCheckboxItem checked={flashOn} onCheckedChange={setFlashOn}>
        Enable Screen Flash
      </MenuCheckboxItem>
    </>,
    frame,
  );
  const shown =
    listed === "unreadable"
      ? "The Photos library could not be read, so Photo Booth takes no picture. Open it again to retry."
      : steppingOut
        ? "Please step out of the frame…"
        : (CAMERA_NOTICE[camera] ?? notice);

  return (
    <>
      <PhotoBooth
        {...props}
        ref={frameRef}
        capture={capture}
        view={leftView}
        onViewChange={setLeftView}
        page={leftPage}
        onPageChange={setLeftPage}
        effectsRef={backdropsRef}
        filledBackdrops={filledBackdrops}
        effect={leftEffect}
        onEffectChange={changeEffect}
        flashEnabled={flashOn}
        selected={selected}
        onSelectedChange={setSelected}
        pictureMenu={pictureRows}
        onPicturePointerDown={listed === "ready" ? dragPicture : undefined}
        shareMenu={
          anyChosen && leftView === "camera" ? (
            <ShareMenu popupProps={{ side: "top" }}>{shareRows(chosenPictures)}</ShareMenu>
          ) : null
        }
        backToCamera={backToCamera}
        onCaptureBusyChange={setCaptureBusy}
        onViewingChange={(picture) => {
          setViewed(picture);
          onViewingChange?.(picture);
        }}
        aria-busy={loading || undefined}
        // Until the list has loaded nothing in the window can be used, so no change is made that
        // the load would replace.
        inert={loading || undefined}
        pictures={pictures}
        source={
          stream
            ? (effect) => (
                <CameraVideo
                  stream={stream}
                  effect={effect}
                  shown={videos}
                  onFrame={() => setFramed(true)}
                  onTrackingFailed={() =>
                    setNotice(
                      "Photo Booth could not load its face model, so this effect shows only the camera.",
                    )
                  }
                />
              )
            : undefined
        }
        takeDisabled={
          camera !== "ready" ||
          !framed ||
          listed !== "ready" ||
          editBusy ||
          replayBusy ||
          flipBusy ||
          steppingOut
        }
        notice={shown}
        onPictureTaken={take}
        onDeletePictures={listed === "ready" ? (chosen) => void removePictures(chosen) : undefined}
        onExportPicture={listed === "ready" ? exportPicture : undefined}
        readPicture={readPicture}
      />
      {slideshow ? (
        <PhotoBoothSlideshow
          pictures={(selection.length > 1 ? selection : pictures).filter((each) => each.id)}
          readPicture={readPicture}
          onClose={() => setSlideshow(false)}
        />
      ) : null}
      <Alert open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertPopup>
          <AlertMessage>Are you sure you want to delete these photos?</AlertMessage>
          <AlertInformativeText>
            They stay in Photos’ Recently Deleted until they are deleted from there.
          </AlertInformativeText>
          <AlertButtons>
            <AlertClose render={<PushButton />}>Cancel</AlertClose>
            <DefaultButton
              onClick={() => {
                setConfirmAll(false);
                void removePictures(pictures, "Delete All");
              }}
            >
              Delete All
            </DefaultButton>
          </AlertButtons>
        </AlertPopup>
      </Alert>
      <Alert
        open={contactFor !== null}
        onOpenChange={(open) => {
          if (!open) setContactFor(null);
        }}
      >
        <AlertPopup>
          <AlertMessage>Set Contact Picture</AlertMessage>
          {contactFor && contactFor.card !== null ? (
            <>
              <AlertInformativeText>
                The middle of this picture becomes the card’s picture in Contacts.
              </AlertInformativeText>
              <PopUpButton<string>
                aria-label="Contact"
                value={contactFor.card}
                onValueChange={(card) => {
                  if (card) setContactFor({ ...contactFor, card });
                }}
              >
                {contactFor.cards.map(({ id, name }) => (
                  <PopUpButtonItem key={id} value={id}>
                    {name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </>
          ) : (
            <AlertInformativeText>Contacts has no cards yet.</AlertInformativeText>
          )}
          <AlertButtons>
            <AlertClose render={<PushButton />}>Cancel</AlertClose>
            <DefaultButton
              disabled={contactFor?.card == null}
              onClick={() => {
                if (contactFor?.card) makeContactPicture(contactFor.record, contactFor.card);
              }}
            >
              Set Picture
            </DefaultButton>
          </AlertButtons>
        </AlertPopup>
      </Alert>
    </>
  );
}
