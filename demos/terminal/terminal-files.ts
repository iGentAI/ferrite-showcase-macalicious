import {
  type Drive,
  type DriveOp,
  driveAvailable,
  loadDrive,
  readFileEntry,
  runOps,
  uploadFile,
} from "../desktop/desktop-files";
import { changeDesktopValue, desktopValues } from "../desktop/desktop-personal";
import { type FinderNode, HOME, joinPath } from "../finder/finder-data";
import { driveTree } from "../finder/finder-drive";

/**
 * The file system the shell sees: the tree Finder shows (`driveTree`), addressed by path, and
 * changed through the desktop's drive client. A path that Finder shows is the same path here. The
 * home folder itself is not a folder of the drive, only its six folders are.
 */

/** Why a path could not be used, in the words a Mac's commands use. */
export class FileProblem extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileProblem";
  }
}

export const NO_SUCH_FILE = "No such file or directory";
export const IS_A_FOLDER = "Is a directory";
export const NOT_A_FOLDER = "Not a directory";
export const READ_ONLY = "Read-only file system";
export const NO_DRIVE = "This build has no drive";
export const HOME_HOLDS_FOLDERS =
  "the home folder holds only the drive's six folders; use one of them";

const shownMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** A node with where it is. */
export interface FileEntry {
  path: string;
  node: FinderNode;
}

const isFolder = (node: FinderNode) => node.children !== undefined;

/** The path `text` names, from the folder `from`; `~`, `.` and `..` are followed. */
export function resolvePath(text: string, from: string): string {
  let path = text;
  if (path === "~" || path.startsWith("~/")) path = HOME + path.slice(1);
  else if (!path.startsWith("/")) path = joinPath(from, path);
  const names: string[] = [];
  for (const name of path.split("/")) {
    if (name === "" || name === ".") continue;
    if (name === "..") names.pop();
    else names.push(name);
  }
  return `/${names.join("/")}`;
}

export const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
export const folderOf = (path: string) => path.slice(0, path.lastIndexOf("/")) || "/";

/**
 * The home folder is no folder of the drive, so `~/.zshrc`, the one file a shell needs there, is kept
 * with the desktop's settings. It is a file to `cat`, `>` and `source`, and has no id to move by.
 */
export const ZSHRC_PATH = `${HOME}/.zshrc`;
const ZSHRC_SETTING = "terminal.zshrc";
/** The settings route's limit on one value, as JSON (`MAX_VALUE_BYTES`). */
const MOST_ZSHRC_BYTES = 4096;

/** What `~/.zshrc` holds, or null when there is none. */
export function startupScript(): string | null {
  const kept = desktopValues()[ZSHRC_SETTING];
  return typeof kept === "string" ? kept : null;
}

const zshrcNode = (text: string): FinderNode => ({
  name: ".zshrc",
  kind: "document",
  size: text.length,
});

export class TerminalFiles {
  private tree: FinderNode = driveTree(null);
  private stale = true;

  /** Whether this build has the person's drive. */
  get available(): boolean {
    return driveAvailable();
  }

  /** The next look at the files reads the drive again: a command line has started. */
  refresh(): void {
    this.stale = true;
  }

  private async root(): Promise<FinderNode> {
    if (this.available && this.stale) {
      const drive: Drive = await loadDrive();
      this.tree = driveTree(drive);
      this.stale = false;
    }
    return this.tree;
  }

  /** What is at `path`, or undefined. */
  async at(path: string): Promise<FinderNode | undefined> {
    if (path === ZSHRC_PATH) {
      const text = startupScript();
      return text === null ? undefined : zshrcNode(text);
    }
    let node: FinderNode | undefined = await this.root();
    for (const name of path.split("/")) {
      if (name === "") continue;
      node = node?.children?.find((child) => child.name === name);
    }
    return node;
  }

  /** What is in the folder at `path`, by name. */
  async list(path: string): Promise<FileEntry[]> {
    const node = await this.at(path);
    if (!node) throw new FileProblem(NO_SUCH_FILE);
    if (!isFolder(node)) throw new FileProblem(NOT_A_FOLDER);
    const zshrc = path === HOME ? startupScript() : null;
    return [...(node.children ?? []), ...(zshrc === null ? [] : [zshrcNode(zshrc)])]
      .sort((a, b) => a.name.localeCompare(b.name, "en"))
      .map((child) => ({ path: joinPath(path, child.name), node: child }));
  }

  /** The bytes of the file at `path`, as text. */
  async readText(path: string): Promise<string> {
    if (path === ZSHRC_PATH && startupScript() !== null) return startupScript() as string;
    const node = await this.at(path);
    if (!node) throw new FileProblem(NO_SUCH_FILE);
    if (isFolder(node)) throw new FileProblem(IS_A_FOLDER);
    if (!node.id) throw new FileProblem("Only files on the drive can be read here");
    return (await readFileEntry(node.id)).blob.text();
  }

  /** Makes an empty file at `path`, where nothing is. */
  async makeEmptyFile(path: string): Promise<void> {
    if (path === ZSHRC_PATH) {
      changeDesktopValue(ZSHRC_SETTING, "");
      return;
    }
    const folder = await this.folderId(path);
    try {
      await uploadFile(new Blob([], { type: "text/plain" }), folder, {
        name: baseName(path),
        existing: "fail",
      });
    } catch (error) {
      throw new FileProblem(shownMessage(error));
    }
    this.stale = true;
  }

  /**
   * Gives the file at `path` a new modification time, by writing its own bytes back on the version
   * they were read from: the drive sets the time on a write, and has no operation for the time alone.
   * A folder's time is the drive's own to keep, so a folder is left as it is.
   */
  async touch(path: string, signal: AbortSignal): Promise<void> {
    const node = await this.at(path);
    if (!node || isFolder(node)) return;
    if (!node.id) throw new FileProblem(READ_ONLY);
    const folder = await this.folderId(path);
    try {
      const { blob, entry } = await readFileEntry(node.id);
      if (signal.aborted) return;
      await uploadFile(blob, folder, {
        name: baseName(path),
        existing: "overwrite",
        replaces: node.id,
        base: entry.version ?? 0,
      });
    } catch (error) {
      throw new FileProblem(shownMessage(error));
    }
    this.stale = true;
  }

  /** Refuses a place that a redirection cannot write to; a file or nothing in a drive folder is fine. */
  async checkWritable(path: string): Promise<{ folder: string; node: FinderNode | undefined }> {
    if (path === ZSHRC_PATH) return { folder: "", node: undefined };
    const node = await this.at(path);
    if (node?.children) throw new FileProblem(IS_A_FOLDER);
    const folder = await this.folderId(path);
    if (node && !node.id) throw new FileProblem(READ_ONLY);
    return { folder, node };
  }

  /**
   * Writes `text` to the file at `path`, making it where nothing is. With `append`, after what the
   * file holds, its bytes kept as they are; a file saved elsewhere meanwhile refuses it, and so does
   * `signal` when it was aborted during that read. Otherwise it replaces what the file holds.
   */
  async writeText(path: string, text: string, append: boolean, signal: AbortSignal): Promise<void> {
    if (path === ZSHRC_PATH) {
      const whole = `${append ? (startupScript() ?? "") : ""}${text}`;
      if (new TextEncoder().encode(JSON.stringify(whole)).length > MOST_ZSHRC_BYTES) {
        throw new FileProblem(`~/.zshrc is kept in at most ${MOST_ZSHRC_BYTES} bytes here`);
      }
      changeDesktopValue(ZSHRC_SETTING, whole);
      return;
    }
    const { folder, node } = await this.checkWritable(path);
    if (signal.aborted) return;
    try {
      if (!node?.id) {
        await uploadFile(new Blob([text], { type: "text/plain" }), folder, {
          name: baseName(path),
          existing: "fail",
        });
      } else if (append) {
        const { blob, entry } = await readFileEntry(node.id);
        if (signal.aborted) return;
        await uploadFile(new Blob([blob, text], { type: blob.type }), folder, {
          name: baseName(path),
          existing: "overwrite",
          replaces: node.id,
          base: entry.version ?? 0,
        });
      } else {
        await uploadFile(new Blob([text], { type: "text/plain" }), folder, {
          name: baseName(path),
          existing: "overwrite",
          replaces: node.id,
        });
      }
    } catch (error) {
      throw new FileProblem(shownMessage(error));
    }
    this.stale = true;
  }

  /** The drive folder that holds, or will hold, `path`. */
  async folderId(path: string): Promise<string> {
    if (!this.available) throw new FileProblem(NO_DRIVE);
    const parent = folderOf(path);
    const node = await this.at(parent);
    if (!node) throw new FileProblem(NO_SUCH_FILE);
    if (!isFolder(node)) throw new FileProblem(NOT_A_FOLDER);
    if (node.id) return node.id;
    throw new FileProblem(parent === HOME ? HOME_HOLDS_FOLDERS : READ_ONLY);
  }

  /** Applies `ops` in order, all or none. */
  async apply(ops: readonly DriveOp[]): Promise<void> {
    if (ops.length === 0) return;
    try {
      this.tree = driveTree(await runOps(ops));
      this.stale = false;
    } catch (error) {
      throw new FileProblem(shownMessage(error));
    }
  }

  /** The drive entry's id, for changing it: a path outside the drive has none. */
  async idOf(path: string): Promise<string> {
    const node = await this.at(path);
    if (!node) throw new FileProblem(NO_SUCH_FILE);
    if (!this.available) throw new FileProblem(NO_DRIVE);
    if (!node.id) throw new FileProblem(path === HOME ? "Operation not permitted" : READ_ONLY);
    return node.id;
  }
}
