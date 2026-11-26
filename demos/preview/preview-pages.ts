import type { PdfField, PdfFile, PdfLink, PdfPageSize, PdfPart } from "./preview-pdf";

/** The size of a blank page in a PDF with no first page to take it from: US Letter, in points. */
const LETTER: PdfPageSize = { width: 612, height: 792 };

/** Whether opening a PDF failed for want of its password; `code` 2 is one that was wrong. */
export function passwordRefusal(error: unknown): "needed" | "wrong" | null {
  if (!(error instanceof Error) || error.name !== "PasswordException") return null;
  return (error as Error & { code?: number }).code === 2 ? "wrong" : "needed";
}

/**
 * How to write a PDF that shows `shown` (each the file's page, or 0 for a blank page) with `count`
 * pages of `inserted` after the page numbered `after`: runs of the file's rising pages, each with the
 * places it fills in the new file. `inserted.pages` names which of its pages go in, in their order;
 * left out, its first `count`.
 */
export function insertionParts(
  shown: readonly number[],
  after: number,
  inserted: { bytes: Uint8Array; count: number; pages?: readonly number[] },
  blank: Uint8Array,
): PdfPart[] {
  const parts: PdfPart[] = [];
  let at = 0;
  const lay = (source: number) => {
    const last = parts.at(-1);
    if (source === 0) {
      parts.push({ document: blank, pages: [1], at: [at] });
    } else if (last?.document === null && last.pages.at(-1) === source - 1) {
      last.pages.push(source);
      last.at.push(at);
    } else {
      parts.push({ document: null, pages: [source], at: [at] });
    }
    at += 1;
  };
  shown.slice(0, after).forEach(lay);
  const wanted = inserted.pages ?? Array.from({ length: inserted.count }, (_, index) => index + 1);
  const pages = [...wanted].sort((a, b) => a - b);
  parts.push({
    document: inserted.bytes,
    pages,
    at: pages.map((page) => at + wanted.indexOf(page)),
  });
  at += wanted.length;
  shown.slice(after).forEach(lay);
  return parts;
}

/** How to write a PDF of the file's `pages` alone, in the order given; blank pages are left out. */
export function extractionParts(pages: readonly number[]): PdfPart[] {
  const kept = pages.filter((page) => page !== 0);
  const rising = [...kept].sort((a, b) => a - b);
  return [{ document: null, pages: rising, at: rising.map((page) => kept.indexOf(page)) }];
}

/**
 * A PDF as the window shows it after its pages are laid out anew: `order` gives, for each page shown,
 * the file's page it draws, or 0 for a blank page as large as the file's first. The file is not
 * touched, and it stays the owner of what `destroy` lets go.
 */
export function pagedPdf(
  file: PdfFile,
  sizes: readonly PdfPageSize[],
  order: readonly number[],
): { pdf: PdfFile; sizes: PdfPageSize[] } {
  const blank = sizes[0] ?? LETTER;
  const sourceOf = (page: number) => order[page - 1] ?? 0;
  return {
    sizes: order.map((source) => (source === 0 ? blank : (sizes[source - 1] ?? blank))),
    pdf: {
      pageCount: order.length,
      async size(page) {
        const source = sourceOf(page);
        return source === 0 ? blank : file.size(source);
      },
      async render(page, canvas, cssWidth, turns, pixelRatio) {
        const source = sourceOf(page);
        if (source !== 0) return file.render(source, canvas, cssWidth, turns, pixelRatio);
        const across = turns % 2 === 0 ? blank.width : blank.height;
        const down = turns % 2 === 0 ? blank.height : blank.width;
        canvas.width = Math.max(1, Math.floor(cssWidth * pixelRatio));
        canvas.height = Math.max(1, Math.floor((cssWidth * pixelRatio * down) / across));
        const context = canvas.getContext("2d");
        if (context) {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        return true;
      },
      async text(page) {
        const source = sourceOf(page);
        return source === 0 ? "" : file.text(source);
      },
      async textRuns(page, turns) {
        const source = sourceOf(page);
        return source === 0 ? [] : file.textRuns(source, turns);
      },
      async layOutText(page, container, cssWidth, turns) {
        const source = sourceOf(page);
        if (source !== 0) return file.layOutText(source, container, cssWidth, turns);
        container.replaceChildren();
      },
      async outline() {
        return (await file.outline()).flatMap((entry) => {
          const shown = order.indexOf(entry.page);
          return shown < 0 ? [] : [{ ...entry, page: shown + 1 }];
        });
      },
      async links(page) {
        const source = sourceOf(page);
        if (source === 0) return [];
        return (await file.links(source)).flatMap((link): PdfLink[] => {
          if (link.page === undefined) return [link];
          const shown = order.indexOf(link.page);
          return shown < 0 ? [] : [{ ...link, page: shown + 1 }];
        });
      },
      async fields(page): Promise<PdfField[]> {
        const source = sourceOf(page);
        return source === 0 ? [] : file.fields(source);
      },
      setField: (id, value, group) => file.setField(id, value, group),
      filled: () => file.filled(),
      security: () => file.security(),
      combined: (parts) => file.combined(parts),
      destroy() {
        file.destroy();
      },
    },
  };
}
