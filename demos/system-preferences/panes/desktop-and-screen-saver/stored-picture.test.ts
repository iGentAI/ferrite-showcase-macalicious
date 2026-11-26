import { afterEach, describe, expect, it, vi } from "vitest";

const reads = new Map<string, (blob: Blob) => void>();
const uploads: {
  blob: Blob;
  parent: string;
  name?: string;
  done: (entry: { id: string }) => void;
}[] = [];
vi.mock("../../../desktop/desktop-files", () => ({
  readFile: (id: string) => new Promise<Blob>((resolve) => reads.set(id, resolve)),
  SPECIAL_FOLDER_IDS: { Pictures: "pictures" },
  uploadFile: (blob: Blob, parent: string, options: { name?: string } = {}) =>
    new Promise((done) => uploads.push({ blob, parent, name: options.name, done })),
}));

const {
  DESKTOP_PICTURE_EVENT,
  beginDesktopValues,
  connectDesktopValues,
  desktopValues,
  receiveDesktopValues,
  resetDesktopPicture,
} = await import("../../../desktop/desktop-personal");
const {
  chooseBuiltInPicture,
  driveFileOf,
  isLatestPictureChoice,
  keepPhotosPicture,
  PICTURE_KEY,
  showDrivePicture,
  showStoredPicture,
  storedPictureChoice,
  takePictureChoice,
} = await import("./stored-picture");

const picture = () => new Blob(["x"], { type: "image/png" });

/** Every picture named to the desktop while `body` runs. */
async function named(body: () => Promise<void>) {
  const shown: { source?: string; day?: string; restored?: boolean }[] = [];
  const hear = (event: Event) => shown.push((event as CustomEvent).detail);
  window.addEventListener(DESKTOP_PICTURE_EVENT, hear);
  try {
    await body();
  } finally {
    window.removeEventListener(DESKTOP_PICTURE_EVENT, hear);
  }
  return shown;
}

afterEach(() => {
  reads.clear();
  uploads.length = 0;
  vi.unstubAllEnvs();
  // An empty page copy of the settings, with no session connected and none ended.
  connectDesktopValues(() => {})();
  beginDesktopValues();
});

describe("a photo made the desktop picture in Photos", () => {
  const photo = () => new Blob(["jpeg"], { type: "image/jpeg" });

  it("is saved to the person's Pictures and kept as that drive picture", async () => {
    const { takePictureTicket } = await import("../../../desktop/desktop-personal");
    const detail = { day: "blob:photo", source: "photos", ...takePictureTicket() };
    const loaded: string[] = [];
    const kept = keepPhotosPicture(detail, undefined, async (url) => {
      loaded.push(url);
      return photo();
    });
    await vi.waitFor(() => expect(uploads).toHaveLength(1));
    expect(loaded).toEqual(["blob:photo"]);
    expect(uploads[0]).toMatchObject({ parent: "pictures", name: "Desktop Picture.jpg" });
    expect(uploads[0]?.blob.type).toBe("image/jpeg");
    uploads[0]?.done({ id: "f1" });
    expect(await kept).toBe("drive:f1");
    // Shown again after a reload as a drive picture.
    expect(storedPictureChoice({ [PICTURE_KEY]: "drive:f1" })?.picture).toBe("drive:f1");
  });

  it("is not kept when the person makes a newer choice while it is saved", async () => {
    const { takePictureTicket } = await import("../../../desktop/desktop-personal");
    const detail = { day: "blob:photo", source: "photos", ...takePictureTicket() };
    const kept = keepPhotosPicture(detail, undefined, async () => photo());
    await vi.waitFor(() => expect(uploads).toHaveLength(1));
    chooseBuiltInPicture("mountains", "dynamic");
    uploads[0]?.done({ id: "f2" });
    expect(await kept).toBeNull();
  });

  it("is not kept when the person's session ends while it is saved", async () => {
    const { takePictureTicket } = await import("../../../desktop/desktop-personal");
    const detail = { day: "blob:photo", source: "photos", ...takePictureTicket() };
    const kept = keepPhotosPicture(detail, undefined, async () => photo());
    await vi.waitFor(() => expect(uploads).toHaveLength(1));
    resetDesktopPicture();
    uploads[0]?.done({ id: "f3" });
    expect(await kept).toBeNull();
  });

  it("counts a choice stored as `photos` before pictures were saved to the drive as none", () => {
    expect(storedPictureChoice({ [PICTURE_KEY]: "photos" })).toBeUndefined();
  });
});

describe("the wallpaper kept from a drive picture", () => {
  it("leaves the earlier wallpaper when the chosen file cannot be read as a picture", async () => {
    receiveDesktopValues({ [PICTURE_KEY]: "mountains" });
    const shown = await named(async () => {
      const read = showDrivePicture("notes", takePictureChoice());
      reads.get("notes")?.(new Blob(["text"], { type: "text/plain" }));
      await expect(read).rejects.toThrow("not a picture");
    });
    expect(shown).toHaveLength(0);
    expect(desktopValues()[PICTURE_KEY]).toBe("mountains");
  });

  it("leaves the earlier wallpaper when the chosen picture does not decode", async () => {
    receiveDesktopValues({ [PICTURE_KEY]: "mountains" });
    vi.stubGlobal("createImageBitmap", async () => {
      throw new DOMException("The source image could not be decoded.", "InvalidStateError");
    });
    try {
      const shown = await named(async () => {
        const read = showDrivePicture("corrupt", takePictureChoice());
        reads.get("corrupt")?.(picture());
        await expect(read).rejects.toThrow("cannot be shown");
      });
      expect(shown).toHaveLength(0);
      expect(desktopValues()[PICTURE_KEY]).toBe("mountains");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the newer choice when an older read finishes after it", async () => {
    receiveDesktopValues({ [PICTURE_KEY]: "mountains" });
    const older = showDrivePicture("older", takePictureChoice());
    const newer = showDrivePicture("newer", takePictureChoice());
    // Nothing is kept before a picture has been read and shown.
    expect(desktopValues()[PICTURE_KEY]).toBe("mountains");
    reads.get("newer")?.(picture());
    expect(await newer).toBe(true);
    expect(desktopValues()[PICTURE_KEY]).toBe("drive:newer");
    reads.get("older")?.(picture());
    expect(await older).toBe(false);
    expect(desktopValues()[PICTURE_KEY]).toBe("drive:newer");
  });
});

describe("the stored desktop picture", () => {
  it("reads a stored choice, and only one of the three kinds", () => {
    expect(storedPictureChoice({ "desktop-and-screen-saver.picture": "mojave" })).toEqual({
      picture: "mojave",
      mode: "dynamic",
    });
    expect(
      storedPictureChoice({
        "desktop-and-screen-saver.picture": "drive:abc",
        "desktop-and-screen-saver.mode": "dark",
      }),
    ).toEqual({ picture: "drive:abc", mode: "dark" });
    expect(storedPictureChoice({ "desktop-and-screen-saver.picture": "https://x/y.jpg" })).toBe(
      undefined,
    );
    expect(driveFileOf("drive:../x")).toBeUndefined();
  });

  it("drops a file still being read when the person chooses another picture meanwhile", async () => {
    const shown = await named(async () => {
      const first = showDrivePicture("slow", takePictureChoice());
      const second = showDrivePicture("fast", takePictureChoice());
      reads.get("fast")?.(picture());
      expect(await second).toBe(true);
      // The older read ends last: it does not replace the newer choice.
      reads.get("slow")?.(picture());
      expect(await first).toBe(false);
    });
    expect(shown).toHaveLength(1);
  });

  it("lets an upload's picture be chosen though an older read finishes while it goes up", async () => {
    const shown = await named(async () => {
      // The person picks a drive picture, then adds one before the first has been read.
      const older = showDrivePicture("older", takePictureChoice());
      const upload = takePictureChoice();
      // The older read finishes while the upload goes up: it is not shown, and takes no choice.
      reads.get("older")?.(picture());
      expect(await older).toBe(false);
      // The upload ends: its choice is still the newest, so its picture is shown.
      expect(isLatestPictureChoice(upload)).toBe(true);
      const added = showDrivePicture("added", upload);
      reads.get("added")?.(picture());
      expect(await added).toBe(true);
    });
    expect(shown).toHaveLength(1);
  });

  it("drops a file still being read when a picture of the pane is chosen meanwhile", async () => {
    const shown = await named(async () => {
      const read = showDrivePicture("slow", takePictureChoice());
      chooseBuiltInPicture("mountains", "dynamic");
      reads.get("slow")?.(picture());
      expect(await read).toBe(false);
    });
    expect(shown.map((detail) => detail.day?.includes("mountains"))).toEqual([true]);
  });

  it("drops a file still being read when the person's session ends", async () => {
    const shown = await named(async () => {
      const read = showDrivePicture("slow", takePictureChoice());
      resetDesktopPicture();
      reads.get("slow")?.(picture());
      expect(await read).toBe(false);
    });
    expect(shown).toHaveLength(0);
  });

  it("drops the stored file shown at start when the person chooses a picture before it is read", async () => {
    vi.stubEnv("VITE_MACALICIOUS_API", "1");
    const shown = await named(async () => {
      const restore = showStoredPicture({ "desktop-and-screen-saver.picture": "drive:stored" });
      await Promise.resolve();
      // The person picks one of the pane's pictures while the stored file is still being read.
      chooseBuiltInPicture("mountains", "dynamic");
      reads.get("stored")?.(picture());
      await restore;
    });
    expect(shown.map((detail) => detail.day?.includes("mountains"))).toEqual([true]);
  });
});
