/*
 * PDFs in Preview, rendered by Mozilla's pdf.js (`pdfjs-dist`). This module is loaded only when a
 * PDF is opened (the app imports it dynamically), so the library and the windows that never open a
 * PDF carry none of it.
 *
 * pdf.js parses in a worker, started from one of the build's files.
 */

import type { PDFDocumentProxy, PDFPageProxy, RenderTask, TextLayer } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PdfTextRun } from "./preview-export";
import { renderScale, type Turns } from "./preview-markup";

type PdfJs = typeof import("pdfjs-dist");

let library: Promise<PdfJs> | null = null;

function pdfjs(): Promise<PdfJs> {
  library ??= (async () => {
    const lib = await import("pdfjs-dist");
    // pdf.js starts its worker from the build's own file, which the desktop's content route
    // serves as `text/javascript`. Set always: the library's own default names a path the
    // desktop does not serve.
    lib.GlobalWorkerOptions.workerSrc = workerUrl;
    return lib;
  })();
  // A load that failed is tried again by the next PDF.
  library.catch(() => {
    library = null;
  });
  return library;
}

/** A page's size in points, at the page's own rotation. */
export interface PdfPageSize {
  width: number;
  height: number;
}

/** An open PDF. */
export interface PdfFile {
  pageCount: number;
  /** The size of page `page` (from 1). */
  size(page: number): Promise<PdfPageSize>;
  /**
   * Draws page `page` on `canvas`, `cssWidth` points wide on the screen at `pixelRatio` device
   * pixels a point, turned `turns` quarter turns clockwise. A draw already under way on the same
   * canvas is cancelled. Resolves `false` when this draw was cancelled by a later one.
   */
  render(
    page: number,
    canvas: HTMLCanvasElement,
    cssWidth: number,
    turns: Turns,
    pixelRatio: number,
  ): Promise<boolean>;
  /** The page's text, its pieces joined with spaces. */
  text(page: number): Promise<string>;
  /** The page's text piece by piece, placed on the page as it stands turned `turns` quarter turns. */
  textRuns(page: number, turns: Turns): Promise<PdfTextRun[]>;
  /**
   * Lays page `page`'s text over `container`, transparent and selectable, where it stands on a page
   * `cssWidth` wide and turned `turns` quarter turns clockwise. Resolves when it is laid out.
   */
  layOutText(page: number, container: HTMLElement, cssWidth: number, turns: Turns): Promise<void>;
  /** The file's table of contents, flattened, in its order; empty when it has none. */
  outline(): Promise<PdfOutlineEntry[]>;
  /** The links on page `page`, where they stand on it, as the file has them. */
  links(page: number): Promise<PdfLink[]>;
  /** The form fields on page `page`, where they stand on it, with what they hold now. */
  fields(page: number): Promise<PdfField[]>;
  /** Fills the field `id` for the file's next drawing and `filled`; `group`, for a radio button. */
  setField(
    id: string,
    value: string | boolean | readonly string[],
    group?: readonly string[],
  ): void;
  /** The file with what its fields were filled with written into it. */
  filled(): Promise<Uint8Array>;
  /** Whether the file is locked, and what its lock lets a reader do. */
  security(): Promise<PdfSecurity>;
  /** A new PDF of `parts`, with their text and links, each page standing where its part says. */
  combined(parts: readonly PdfPart[]): Promise<Uint8Array>;
  /** Lets the file go. */
  destroy(): void;
}

/** A link on a page: where it stands, as fractions of the page, and a web address or a page. */
export interface PdfLink {
  x: number;
  y: number;
  w: number;
  h: number;
  url?: string;
  page?: number;
}

/** A form field on a page: where it stands, as fractions of the page, and what it holds. */
export interface PdfField {
  id: string;
  /** The form's name for it. */
  name: string;
  kind: "text" | "checkbox" | "radio" | "choice";
  x: number;
  y: number;
  w: number;
  h: number;
  value: string | boolean;
  multiline: boolean;
  readOnly: boolean;
  /** A choice's rows, as the file writes them and as it shows them. */
  options: readonly { value: string; label: string }[];
  /** The other buttons of a radio button's group, whose ids it turns off. */
  group: readonly string[];
}

/** What a PDF's lock says. */
export interface PdfSecurity {
  /** The method it is locked by, as the file names it; absent when it is not locked. */
  method?: string;
  /** What its lock lets a reader do; absent when it restricts nothing. */
  allowed?: { print: boolean; copy: boolean; change: boolean; annotate: boolean };
}

/** Some pages of a PDF going into a new one. */
export interface PdfPart {
  /** The file's bytes; `null` is the PDF that is asked. */
  document: Uint8Array | null;
  /** Its pages, rising, from 1. */
  pages: number[];
  /** For each, its place in the new file, from 0. */
  at: number[];
}

/** One row of a PDF's table of contents. */
export interface PdfOutlineEntry {
  title: string;
  /** The page it goes to, from 1. */
  page: number;
  /** How deep it stands, from 0 at the top. */
  level: number;
}

/** What kind of field an annotation of pdf.js's is; `null` for one a person cannot fill. */
function fieldKind(annotation: {
  fieldType?: string;
  checkBox?: boolean;
  radioButton?: boolean;
}): PdfField["kind"] | null {
  if (annotation.fieldType === "Tx") return "text";
  if (annotation.fieldType === "Ch") return "choice";
  if (annotation.checkBox) return "checkbox";
  if (annotation.radioButton) return "radio";
  return null;
}

/** What a field holds: what it was filled with here, or else what the file says. */
function fieldValue(
  kind: PdfField["kind"],
  annotation: { fieldValue?: unknown; exportValue?: unknown; buttonValue?: unknown },
  stored: unknown,
): string | boolean {
  if (kind === "checkbox") {
    if (typeof stored === "boolean") return stored;
    return annotation.fieldValue !== "Off" && annotation.fieldValue === annotation.exportValue;
  }
  if (kind === "radio") {
    if (typeof stored === "boolean") return stored;
    return annotation.fieldValue !== "Off" && annotation.fieldValue === annotation.buttonValue;
  }
  const value = stored ?? annotation.fieldValue;
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" ? first : "";
}

const cancelled = (error: unknown) =>
  error instanceof Error && error.name === "RenderingCancelledException";

/**
 * Opens `blob` as a PDF, with `password` when it is locked with one. Rejects with the reader's
 * reason when it is not one it can read: a `PasswordException` when a password is needed or wrong.
 */
export async function openPdf(blob: Blob, password?: string): Promise<PdfFile> {
  const lib = await pdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const task = lib.getDocument({
    data,
    useSystemFonts: true,
    ...(password === undefined ? {} : { password }),
  });
  let document: PDFDocumentProxy;
  try {
    document = await task.promise;
  } catch (error) {
    // A file pdf.js cannot read (damaged, or locked with a password) lets its worker go too.
    void task.destroy();
    throw error;
  }
  const pages = new Map<number, Promise<PDFPageProxy>>();
  const pageOf = (number: number) => {
    let page = pages.get(number);
    if (!page) {
      page = document.getPage(number);
      pages.set(number, page);
    }
    return page;
  };
  const texts = new Map<number, Promise<string>>();
  const running = new WeakMap<HTMLCanvasElement, RenderTask>();
  const laying = new WeakMap<HTMLElement, TextLayer>();
  // The latest draw asked of each canvas: an earlier one that resumes later draws nothing.
  const latest = new WeakMap<HTMLCanvasElement, number>();
  let draws = 0;
  const pageOfDestination = async (destination: unknown) => {
    const explicit =
      typeof destination === "string"
        ? await document.getDestination(destination)
        : (destination as unknown[] | null);
    const target = explicit?.[0];
    if (typeof target === "number") return target + 1;
    if (target && typeof target === "object") {
      return (
        (await document.getPageIndex(target as Parameters<typeof document.getPageIndex>[0])) + 1
      );
    }
    return null;
  };
  return {
    pageCount: document.numPages,
    async size(number) {
      const page = await pageOf(number);
      const viewport = page.getViewport({ scale: 1, rotation: page.rotate });
      return { width: viewport.width, height: viewport.height };
    },
    async render(number, canvas, cssWidth, turns, pixelRatio) {
      // This draw owns the canvas from the moment it is asked for, before its page is loaded.
      draws += 1;
      const draw = draws;
      latest.set(canvas, draw);
      running.get(canvas)?.cancel();
      const page = await pageOf(number);
      if (latest.get(canvas) !== draw) return false;
      const rotation = (page.rotate + turns * 90) % 360;
      const unit = page.getViewport({ scale: 1, rotation });
      const scale = renderScale(
        (cssWidth * pixelRatio) / Math.max(unit.width, 1),
        unit.width,
        unit.height,
      );
      const viewport = page.getViewport({ scale, rotation });
      running.get(canvas)?.cancel();
      // Drawn on a canvas of its own, then copied, so the page on the screen never shows half
      // drawn or blank while it is drawn again at another size.
      const scratch = canvas.ownerDocument.createElement("canvas");
      scratch.width = Math.max(1, Math.floor(viewport.width));
      scratch.height = Math.max(1, Math.floor(viewport.height));
      const render = page.render({
        canvas: scratch,
        viewport,
        // Form fields as they are filled, so that printing and exporting draw what was typed.
        annotationMode: lib.AnnotationMode.ENABLE_STORAGE,
      });
      running.set(canvas, render);
      try {
        await render.promise;
      } catch (error) {
        if (cancelled(error)) return false;
        throw error;
      } finally {
        if (running.get(canvas) === render) running.delete(canvas);
      }
      // A later draw asked for meanwhile has the canvas.
      if (latest.get(canvas) !== draw) return false;
      canvas.width = scratch.width;
      canvas.height = scratch.height;
      canvas.getContext("2d")?.drawImage(scratch, 0, 0);
      return true;
    },
    text(number) {
      let text = texts.get(number);
      if (!text) {
        text = pageOf(number)
          .then((page) => page.getTextContent())
          .then((content) =>
            content.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" ")
              .replace(/\s+/g, " ")
              .trim(),
          );
        texts.set(number, text);
      }
      return text;
    },
    async textRuns(number, turns) {
      const page = await pageOf(number);
      const viewport = page.getViewport({
        scale: 1,
        rotation: (page.rotate + turns * 90) % 360,
      });
      const { Util } = lib;
      const runs: PdfTextRun[] = [];
      for (const item of (await page.getTextContent()).items) {
        if (!("str" in item) || item.str.trim() === "") continue;
        const [a, b, c, d, e, f] = Util.transform(viewport.transform, item.transform) as number[];
        // A viewport's y runs down the page and a PDF's up it.
        runs.push({
          text: item.str,
          matrix: [a ?? 0, -(b ?? 0), c ?? 0, -(d ?? 0), e ?? 0, viewport.height - (f ?? 0)],
          width: item.width,
        });
      }
      return runs;
    },
    async layOutText(number, container, cssWidth, turns) {
      const page = await pageOf(number);
      const rotation = (page.rotate + turns * 90) % 360;
      const unit = page.getViewport({ scale: 1, rotation });
      const viewport = page.getViewport({ scale: cssWidth / Math.max(unit.width, 1), rotation });
      // pdf.js sizes the layer and its text from this property of the container.
      container.style.setProperty("--total-scale-factor", String(viewport.scale));
      laying.get(container)?.cancel();
      container.replaceChildren();
      const layer = new lib.TextLayer({
        textContentSource: page.streamTextContent(),
        container,
        viewport,
      });
      laying.set(container, layer);
      try {
        await layer.render();
      } catch (error) {
        // A later layout of the same page cancelled this one.
        if (laying.get(container) === layer) throw error;
      }
    },
    async outline() {
      const found: PdfOutlineEntry[] = [];
      type Items = Awaited<ReturnType<typeof document.getOutline>>;
      const walk = async (items: Items | undefined, level: number) => {
        for (const item of items ?? []) {
          // A row whose destination cannot be read is left out; those under it still count.
          const page = await pageOfDestination(item.dest).catch(() => null);
          if (page !== null && item.title) found.push({ title: item.title, page, level });
          await walk(item.items as Items, level + 1);
        }
      };
      await walk(await document.getOutline(), 0);
      return found;
    },
    async links(number) {
      const page = await pageOf(number);
      const viewport = page.getViewport({ scale: 1, rotation: page.rotate });
      const found: PdfLink[] = [];
      for (const annotation of await page.getAnnotations({ intent: "display" })) {
        if (annotation.subtype !== "Link" || !Array.isArray(annotation.rect)) continue;
        const [left, bottom, right, top] = annotation.rect as number[];
        const [ax, ay] = viewport.convertToViewportPoint(left ?? 0, bottom ?? 0) as number[];
        const [bx, by] = viewport.convertToViewportPoint(right ?? 0, top ?? 0) as number[];
        const place = {
          x: Math.min(ax ?? 0, bx ?? 0) / viewport.width,
          y: Math.min(ay ?? 0, by ?? 0) / viewport.height,
          w: Math.abs((bx ?? 0) - (ax ?? 0)) / viewport.width,
          h: Math.abs((by ?? 0) - (ay ?? 0)) / viewport.height,
        };
        if (typeof annotation.url === "string") {
          found.push({ ...place, url: annotation.url });
        } else if (annotation.dest) {
          const to = await pageOfDestination(annotation.dest).catch(() => null);
          if (to !== null) found.push({ ...place, page: to });
        }
      }
      return found;
    },
    async fields(number) {
      const page = await pageOf(number);
      const viewport = page.getViewport({ scale: 1, rotation: page.rotate });
      const annotations = await page.getAnnotations({ intent: "display" });
      const widgets = annotations.filter((each) => each.subtype === "Widget");
      const groups = new Map<string, string[]>();
      for (const each of widgets) {
        if (!each.radioButton) continue;
        groups.set(each.fieldName, [...(groups.get(each.fieldName) ?? []), String(each.id)]);
      }
      const found: PdfField[] = [];
      for (const each of widgets) {
        const kind = fieldKind(each);
        if (!kind || !Array.isArray(each.rect)) continue;
        const id = String(each.id);
        const [left, bottom, right, top] = each.rect as number[];
        const [ax, ay] = viewport.convertToViewportPoint(left ?? 0, bottom ?? 0) as number[];
        const [bx, by] = viewport.convertToViewportPoint(right ?? 0, top ?? 0) as number[];
        const stored = document.annotationStorage.getRawValue(id) as
          | { value?: unknown }
          | undefined;
        const options = (each.options ?? []) as { exportValue: string; displayValue: string }[];
        found.push({
          id,
          name: String(each.alternativeText || each.fieldName || ""),
          kind,
          x: Math.min(ax ?? 0, bx ?? 0) / viewport.width,
          y: Math.min(ay ?? 0, by ?? 0) / viewport.height,
          w: Math.abs((bx ?? 0) - (ax ?? 0)) / viewport.width,
          h: Math.abs((by ?? 0) - (ay ?? 0)) / viewport.height,
          value: fieldValue(kind, each, stored?.value),
          multiline: each.multiLine === true,
          readOnly: each.readOnly === true,
          options: options.map((row) => ({ value: row.exportValue, label: row.displayValue })),
          group: kind === "radio" ? (groups.get(each.fieldName) ?? []) : [],
        });
      }
      return found;
    },
    setField(id, value, group) {
      const storage = document.annotationStorage;
      for (const other of group ?? []) {
        if (other !== id) storage.setValue(other, { value: false });
      }
      storage.setValue(id, { value });
    },
    filled: () => document.saveDocument(),
    async security() {
      const { info } = await document.getMetadata();
      const method = (info as { EncryptFilterName?: string }).EncryptFilterName;
      const flags = await document.getPermissions();
      const allows = (...wanted: number[]) => wanted.some((each) => flags?.has(each) === true);
      const { PermissionFlag: flag } = lib;
      return {
        ...(method ? { method } : {}),
        ...(flags
          ? {
              allowed: {
                print: allows(flag.PRINT, flag.PRINT_HIGH_QUALITY),
                copy: allows(flag.COPY, flag.COPY_FOR_ACCESSIBILITY),
                change: allows(flag.MODIFY_CONTENTS, flag.ASSEMBLE),
                annotate: allows(flag.MODIFY_ANNOTATIONS, flag.FILL_INTERACTIVE_FORMS),
              },
            }
          : {}),
      };
    },
    combined: (parts) =>
      document.extractPages(
        parts.map((part) => ({
          document: part.document,
          includePages: part.pages.map((page) => page - 1),
          pageIndices: part.at,
        })),
      ),
    destroy() {
      void task.destroy();
    },
  };
}
