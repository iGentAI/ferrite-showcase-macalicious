import { afterEach, describe, expect, it, vi } from "vitest";
import { onDesktopEffects } from "../desktop/desktop-effects";
import {
  beginDesktopValues,
  desktopValues,
  forgetDesktopValues,
} from "../desktop/desktop-personal";
import {
  appForFile,
  appsForFile,
  chooseOpenerFor,
  OPEN_WITH_DEFAULTS,
  onOpenFileRequest,
  openFile,
  registerFileOpeners,
  requestOpenFile,
  takeOpenFileRequest,
  takeOpenFileRequests,
} from "./finder-open";

describe("which application opens a file", () => {
  it("leaves calendars and cards to their applications, whatever their names say", () => {
    const cleanup = registerFileOpeners([
      { id: "calendar", opens: (file) => file.type === "text/calendar" },
      { id: "contacts", opens: (file) => file.type === "text/vcard" },
    ]);
    for (const [name, type, app] of [
      ["invite.txt", "text/calendar", "calendar"],
      ["invite.pdf", "text/calendar", "calendar"],
      ["card.txt", "text/vcard", "contacts"],
      ["contact.png", "text/vcard", "contacts"],
    ] as const) {
      expect(appsForFile({ name, type })).toEqual([app]);
    }
    cleanup();
    expect(appsForFile({ name: "note.txt", type: "text/plain" })).toContain("textedit");
    const stopConsole = registerFileOpeners([
      { id: "console", opens: (file) => file.name.endsWith(".log") },
    ]);
    expect(appsForFile({ name: "build.log", type: "text/plain" })).toEqual(["console", "textedit"]);
    stops.push(
      registerFileOpeners([{ id: "script-editor", opens: (file) => /\.js$/.test(file.name) }]),
    );
    expect(appsForFile({ name: "hello.js", type: "text/javascript" })).toEqual([
      "script-editor",
      "textedit",
    ]);
    stopConsole();
  });

  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
    forgetDesktopValues();
    takeOpenFileRequests("music");
  });
  const isSound = (file: { name: string }) => file.name.endsWith(".mp3");

  it("is TextEdit for text and Preview for a picture, with nothing registered", () => {
    expect(appForFile({ name: "Letter.rtf" })).toBe("textedit");
    expect(appForFile({ name: "notes", type: "text/plain" })).toBe("textedit");
    expect(appForFile({ name: "Beach.png" })).toBe("preview");
    expect(appForFile({ name: "Song.mp3" })).toBeUndefined();
  });

  it("goes by a calendar's or a card's name when its type says otherwise", () => {
    stops.push(
      registerFileOpeners([
        {
          id: "calendar",
          opens: (file) => file.type === "text/calendar" || file.name.endsWith(".ics"),
        },
        {
          id: "contacts",
          opens: (file) => file.type === "text/vcard" || /\.(vcf|vcard)$/.test(file.name),
        },
      ]),
    );
    for (const [name, type, app] of [
      ["card.vcf", "text/calendar", "contacts"],
      ["card.vcard", "text/calendar", "contacts"],
      ["invite.ics", "text/vcard", "calendar"],
      ["card.vcf", "text/plain", "contacts"],
      ["invite.ics", "text/plain", "calendar"],
    ] as const) {
      expect(appForFile({ name, type })).toBe(app);
    }
    expect(appsForFile({ name: "invite.ics", type: "text/vcard" })).toEqual([
      "calendar",
      "contacts",
    ]);
    expect(appsForFile({ name: "card.vcf", type: "text/plain" })).toEqual(["contacts"]);
    // A shell's text is Terminal's: the name says run it, so it does not open as a document.
    stops.push(
      registerFileOpeners([{ id: "terminal", opens: (file) => /\.command$/.test(file.name) }]),
    );
    expect(appForFile({ name: "run.command", type: "text/plain" })).toBe("terminal");
    expect(appsForFile({ name: "run.command", type: "text/plain" })).not.toContain("textedit");
  });

  it("follows what a descriptor says it opens, until it is forgotten", () => {
    stops.push(registerFileOpeners([{ id: "music", opens: isSound }, { id: "chess" }]));
    expect(appForFile({ name: "Song.mp3" })).toBe("music");
    stops.pop()?.();
    expect(appForFile({ name: "Song.mp3" })).toBeUndefined();
  });

  it("lists every application that opens it, the built-in one first", () => {
    stops.push(registerFileOpeners([{ id: "photos", opens: (f) => f.name.endsWith(".png") }]));
    expect(appsForFile({ name: "Beach.png" })).toEqual(["preview", "photos"]);
  });

  it("keeps Change All's choice per extension, for an application that opens the file", () => {
    stops.push(registerFileOpeners([{ id: "photos", opens: (f) => f.name.endsWith(".png") }]));
    beginDesktopValues();
    chooseOpenerFor("Beach.png", "photos");
    expect(desktopValues()[OPEN_WITH_DEFAULTS]).toEqual({ png: "photos" });
    expect(appForFile({ name: "Other.png" })).toBe("photos");
    expect(appForFile({ name: "Other.jpg" })).toBe("preview");
    chooseOpenerFor("Letter.txt", "chess");
    expect(appForFile({ name: "Letter.txt" })).toBe("textedit");
  });

  it("opens the application and hands it the file", () => {
    stops.push(registerFileOpeners([{ id: "music", opens: isSound }]));
    const opened = vi.fn();
    stops.push(onDesktopEffects(opened));
    expect(openFile({ id: "f1", name: "Song.mp3" })).toBe(true);
    expect(opened).toHaveBeenCalledWith([{ open: "music" }]);
    expect(takeOpenFileRequests("music")).toEqual([{ app: "music", id: "f1", name: "Song.mp3" }]);
  });

  it("opens nothing for a file no application opens", () => {
    const opened = vi.fn();
    stops.push(onDesktopEffects(opened));
    expect(openFile({ id: "f2", name: "archive.zip" })).toBe(false);
    expect(opened).not.toHaveBeenCalled();
  });
});

describe("a request to open a drive file", () => {
  const stops: (() => void)[] = [];
  afterEach(() => {
    for (const stop of stops.splice(0)) stop();
    takeOpenFileRequest("textedit");
  });

  it("goes to one open window of the application, which takes it", () => {
    const first = vi.fn();
    const second = vi.fn();
    const other = vi.fn();
    stops.push(onOpenFileRequest("textedit", first));
    stops.push(onOpenFileRequest("textedit", second));
    stops.push(onOpenFileRequest("preview", other));
    const request = { app: "textedit", id: "f1", name: "Letter.rtf" };
    requestOpenFile(request);
    expect(first).toHaveBeenCalledWith(request);
    expect(second).not.toHaveBeenCalled();
    expect(other).not.toHaveBeenCalled();
    // Taken: a window that opens now does not open it again.
    expect(takeOpenFileRequest("textedit")).toBeUndefined();
  });

  it("waits for the application's next window when none is open", () => {
    const request = { app: "textedit", id: "f2", name: "Notes.txt" };
    requestOpenFile(request);
    expect(takeOpenFileRequest("textedit")).toEqual(request);
    expect(takeOpenFileRequest("textedit")).toBeUndefined();
  });

  it("keeps every file asked for before the application's window opens, oldest first", () => {
    const first = { app: "textedit", id: "f3", name: "One.rtf" };
    const second = { app: "textedit", id: "f4", name: "Two.rtf" };
    requestOpenFile(first);
    requestOpenFile(second);
    expect(takeOpenFileRequests("textedit")).toEqual([first, second]);
    expect(takeOpenFileRequests("textedit")).toEqual([]);
  });
});
