import { sessionFetch } from "../desktop/desktop-server";

/*
 * Spotlight searches a drive file's words, but the server cannot run pdf.js. So Preview, which has
 * it, gives the words of a PDF it opens to Spotlight's index (`POST /api/spotlight/pdf-text`), once
 * per opening. A PDF opened with a password stays out: its words were locked for a reason.
 */

/** What the index keeps of one file, as it does of a text file (`FILE_TEXT_CHARS`). */
const KEPT_CHARS = 4_000;
/** Pages read at most, for a long PDF with little text. */
const MOST_PAGES = 40;

/** The words of a PDF's first pages, up to what the index keeps; "" when it has none. */
export async function pdfWords(pdf: {
  pageCount: number;
  text: (page: number) => Promise<string>;
}): Promise<string> {
  let words = "";
  for (let page = 1; page <= Math.min(pdf.pageCount, MOST_PAGES); page += 1) {
    if (words.length >= KEPT_CHARS) break;
    const text = await pdf.text(page).catch(() => "");
    if (text) words = words ? `${words} ${text}` : text;
  }
  return words.slice(0, KEPT_CHARS);
}

/** Gives the words of the PDF at drive file `id` to Spotlight. What fails is tried at its next opening. */
export async function keepPdfWords(
  id: string,
  pdf: { pageCount: number; text: (page: number) => Promise<string> },
): Promise<void> {
  const text = await pdfWords(pdf);
  if (!text) return;
  await sessionFetch("/api/spotlight/pdf-text", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file: id, text }),
  }).catch(() => undefined);
}
