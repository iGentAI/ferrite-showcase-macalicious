import { provideFontPanelFonts, setFontPanelFonts } from "../desktop/desktop-font-panel-fonts";
import { servedByDesktopApp, sessionFetch } from "../desktop/desktop-server";
import { families, fontFamily } from "./font-book-data";
import { driveAvailable, familyNameOf, keptFonts, readKeptFont } from "./font-book-drive";
import { FONT_BOOK_LIBRARY_URL, libraryFromServer } from "./font-book-server";

/*
 * Font Book's fonts in every Fonts panel of the desktop: the fonts on the person's drive are loaded
 * for the whole page, as an installed font is there for every application, whether or not Font
 * Book is open; the fonts turned off leave the panels, and text set in an added one falls back.
 */

const loaded = new Map<string, { name: string; face: FontFace }>();
/** The fonts turned off as an open Font Book window holds them, ahead of what it has saved. */
let heldDisabled: readonly string[] | null = null;
let queue: Promise<void> = Promise.resolve();

async function savedDisabled(): Promise<readonly string[]> {
  if (heldDisabled) return heldDisabled;
  const response = await sessionFetch(FONT_BOOK_LIBRARY_URL, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!response.ok) return [];
  return libraryFromServer(await response.json())?.disabled ?? [];
}

async function read(): Promise<void> {
  const disabled = await savedDisabled();
  const onDrive = new Map<string, { file: string; name: string }>();
  for (const { id: file, name: fileName } of await keptFonts()) {
    const { id, name } = fontFamily(familyNameOf(fileName), "Regular", "sans");
    if (id !== "" && !onDrive.has(id)) onDrive.set(id, { file, name });
  }
  for (const [id, { face }] of loaded) {
    if (onDrive.has(id) && !disabled.includes(id)) continue;
    document.fonts.delete(face);
    loaded.delete(id);
  }
  for (const [id, { file, name }] of onDrive) {
    if (loaded.has(id) || disabled.includes(id)) continue;
    try {
      const face = await new FontFace(name, await (await readKeptFont(file)).arrayBuffer()).load();
      document.fonts.add(face);
      loaded.set(id, { name, face });
    } catch {
      // A file the browser cannot read as a font is not listed: Font Book says so for it.
    }
  }
  setFontPanelFonts({
    added: [...loaded.values()].map(({ name }) => ({
      name,
      css: `"${name}", sans-serif`,
      typefaces: [{ name: "Regular", bold: false, italic: false }],
      collections: [],
    })),
    hidden: families.filter(({ id }) => disabled.includes(id)).map(({ name }) => name),
  });
}

/** Reads the fonts again, after whatever read is under way. */
export function syncFontPanelFonts(): void {
  if (!driveAvailable() || !servedByDesktopApp() || typeof FontFace !== "function") return;
  queue = queue.then(read).catch(() => {});
}

/** An open Font Book window says what it has turned off, or `null` as it closes. */
export function holdFontsOff(disabled: readonly string[] | null): void {
  heldDisabled = disabled;
  syncFontPanelFonts();
}

/** The descriptor's `onDesktopStart`. */
export function startFontPanelFonts(): () => void {
  const stop = provideFontPanelFonts(syncFontPanelFonts);
  syncFontPanelFonts();
  return stop;
}
