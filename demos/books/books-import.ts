import {
  ensureDrive,
  ensureFolder,
  readFile,
  specialFolder,
  uploadFile,
} from "../desktop/desktop-files";
import { currentDesktopSession } from "../desktop/desktop-server";
import { extensionOf } from "../preview/preview-export";
import {
  type EpubBook,
  type EpubPicture,
  fileBookId,
  MAX_EPUB_BYTES,
  readEpub,
  readEpubPicture,
} from "./books-epub";
import { BOOKS_LIMITS, type OwnedBook } from "./books-server";
import { cut } from "./books-text";

/** What File > Add to Library and a drop take. */
export const BOOK_FILE_TYPES = ".epub,application/epub+zip,.pdf,application/pdf";

/** The kind of book a file is: an EPUB, a PDF, or `null` for what Books does not read. */
export function bookFileKind(file: { name: string; type?: string }): "epub" | "pdf" | null {
  const extension = extensionOf(file.name);
  if (file.type === "application/epub+zip" || extension === "epub") return "epub";
  if (file.type === "application/pdf" || extension === "pdf") return "pdf";
  return null;
}

/** The folder of Documents that books added from the person's computer are kept in. */
const BOOKS_FOLDER = "Books";

const titleOfFile = (name: string) => name.replace(/\.[^.]+$/, "") || name;

/** Why a file is not added: said to the person. */
export class BookFileError extends Error {}

/**
 * Makes a library book of a file, read here in the browser. A file already on the person's drive
 * (`driveId`) stays where it is; another is copied to Documents/Books, so the book can be read from
 * any browser. `known` says the library has that book already, which adds nothing and copies nothing.
 */
export async function bookFromFile(
  file: File,
  options: { driveId?: string; known: (id: string) => boolean; now: number },
): Promise<OwnedBook> {
  const kind = bookFileKind(file);
  if (!kind) throw new BookFileError(`“${file.name}” is not an EPUB or a PDF.`);
  if (kind === "epub" && file.size > MAX_EPUB_BYTES) {
    throw new BookFileError(`“${file.name}” is larger than Books opens (64 MB).`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = await fileBookId(kind, bytes);
  const read = kind === "epub" ? await readEpub(bytes) : null;
  const made = {
    id,
    title: cut(read?.title || titleOfFile(file.name), BOOKS_LIMITS.title) || "Untitled",
    author: cut(read?.author ?? "", BOOKS_LIMITS.title),
    source: kind,
    added: options.now,
  };
  if (options.known(id)) return { ...made, file: options.driveId ?? "" };
  if (options.driveId) return { ...made, file: options.driveId };
  const session = currentDesktopSession();
  const documents = specialFolder(await ensureDrive(), "Documents");
  if (!documents)
    throw new BookFileError("Your drive has no Documents folder to keep the book in.");
  const folder = await ensureFolder(documents.id, BOOKS_FOLDER, session);
  const entry = await uploadFile(file, folder.id, { session });
  return { ...made, file: entry.id };
}

/**
 * An EPUB of the library, read from its file on the drive: its text and pictures, and `pictureFile`
 * to read one of those pictures from the same bytes.
 */
export async function epubOfBook(
  book: OwnedBook,
): Promise<EpubBook & { pictureFile: (picture: EpubPicture) => Promise<Blob> }> {
  if (!book.file) throw new BookFileError("This book names no file on your drive.");
  const blob = await readFile(book.file);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return {
    ...(await readEpub(bytes)),
    pictureFile: (picture) => readEpubPicture(bytes, picture),
  };
}
