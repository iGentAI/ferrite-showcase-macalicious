import { vi } from "vitest";

/**
 * A stand-in for the drive's routes (`/api/files`), for tests: it keeps entries and bytes in memory
 * and answers as `ferrite-apps/desktop/src/apps/files` does for what the shell asks of it. It is no
 * proof of the real server.
 */

interface Entry {
  id: string;
  parent?: string;
  name: string;
  kind: "folder" | "file";
  size: number;
  type?: string;
  created_ms: number;
  modified_ms: number;
  trashed_ms?: number;
  version?: number;
}

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

/**
 * Waits for the shell, which answers within a few promise turns: polling at Testing Library's 50 ms
 * would add that much to every line a test types.
 */
export const waitFor = <T>(check: () => T) => vi.waitFor(check, { interval: 1, timeout: 4_000 });

export interface DriveStandIn {
  entries: Map<string, Entry>;
  bytes: Map<string, Uint8Array<ArrayBuffer>>;
  /** The drive folder's id `path` names under the home folder (`Documents/a`). */
  idOf: (path: string) => string | undefined;
  /** The text of the file at `path`. */
  textOf: (path: string) => string | undefined;
  addFile: (parent: string, name: string, text: string) => string;
  addFolder: (parent: string, name: string) => string;
  ops: string[];
}

export function standInDrive(): DriveStandIn {
  const entries = new Map<string, Entry>();
  const bytes = new Map<string, Uint8Array<ArrayBuffer>>();
  const ops: string[] = [];
  let rev = 1;
  let next = 1;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  for (const [name, id] of [
    ["Desktop", "desktop"],
    ["Documents", "documents"],
    ["Downloads", "downloads"],
    ["Movies", "movies"],
    ["Music", "music"],
    ["Pictures", "pictures"],
  ] as const) {
    entries.set(id, { id, name, kind: "folder", size: 0, created_ms: 1, modified_ms: 1 });
  }
  const drive = () => ({
    rev,
    entries: [...entries.values()],
    usage: [...bytes.values()].reduce((sum, each) => sum + each.length, 0),
    quota: 1_000_000_000,
    piece_bytes: 192 * 1024,
    max_file_bytes: 100_000_000,
    max_entries: 10_000,
    session: "stand-in",
  });
  const childNamed = (parent: string, name: string) =>
    [...entries.values()].find(
      (entry) => entry.parent === parent && entry.name === name && entry.trashed_ms === undefined,
    );
  const removeTree = (id: string) => {
    for (const entry of [...entries.values()]) {
      if (entry.parent === id) removeTree(entry.id);
    }
    entries.delete(id);
    bytes.delete(id);
  };
  const addFile = (parent: string, name: string, text: string) => {
    const id = `f${next++}`;
    const data = encoder.encode(text);
    entries.set(id, {
      id,
      parent,
      name,
      kind: "file",
      size: data.length,
      type: "text/plain",
      created_ms: 2,
      modified_ms: 2,
      version: 0,
    });
    bytes.set(id, data);
    rev += 1;
    return id;
  };
  const addFolder = (parent: string, name: string) => {
    const id = `d${next++}`;
    entries.set(id, { id, parent, name, kind: "folder", size: 0, created_ms: 2, modified_ms: 2 });
    rev += 1;
    return id;
  };
  const copyTree = (id: string, parent: string, name: string) => {
    const source = entries.get(id) as Entry;
    if (source.kind === "file") {
      addFile(parent, name, decoder.decode(bytes.get(id)));
      return;
    }
    const folder = addFolder(parent, name);
    for (const entry of [...entries.values()]) {
      if (entry.parent === id) copyTree(entry.id, folder, entry.name);
    }
  };
  const SPECIAL = new Set(["desktop", "documents", "downloads", "movies", "music", "pictures"]);
  const applyOp = (op: Record<string, string>) => {
    ops.push(op.op as string);
    if (op.op === "move" && SPECIAL.has(op.id as string)) {
      throw new Error(`“${entries.get(op.id as string)?.name}” cannot be moved`);
    }
    switch (op.op) {
      case "mkdir":
        if (childNamed(op.parent as string, op.name as string)) throw new Error("File exists");
        addFolder(op.parent as string, op.name as string);
        return;
      case "rename":
        (entries.get(op.id as string) as Entry).name = op.name as string;
        return;
      case "move": {
        const entry = entries.get(op.id as string) as Entry;
        entry.parent = op.parent as string;
        if (op.name) entry.name = op.name;
        return;
      }
      case "copy":
        copyTree(op.id as string, op.parent as string, op.name as string);
        return;
      case "trash":
        (entries.get(op.id as string) as Entry).trashed_ms = Date.now();
        return;
      case "delete":
        removeTree(op.id as string);
        return;
    }
  };
  const uploads = new Map<
    string,
    {
      parent: string;
      name: string;
      replaces?: string;
      parts: Uint8Array<ArrayBuffer>[];
      type: string;
    }
  >();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(input, "http://desktop.test");
      const path = url.pathname.replace("/api/files", "");
      const method = init.method ?? "GET";
      if (method === "GET" && path === "/") return json(drive());
      if (method === "POST" && path === "/ops") {
        const body = JSON.parse(init.body as string) as { ops: Record<string, string>[] };
        try {
          for (const op of body.ops) applyOp(op);
        } catch (error) {
          return json({ error: (error as Error).message }, 409);
        }
        rev += 1;
        return json(drive());
      }
      if (method === "POST" && path === "/uploads") {
        const body = JSON.parse(init.body as string) as {
          parent: string;
          name: string;
          size: number;
          type: string;
          replaces?: string;
        };
        const upload = `u${next++}`;
        uploads.set(upload, {
          parent: body.parent,
          name: body.name,
          replaces: body.replaces,
          parts: [],
          type: body.type,
        });
        return json({
          upload,
          piece_bytes: 192 * 1024,
          pieces: Math.ceil(body.size / (192 * 1024)),
        });
      }
      const piece = /^\/uploads\/([^/]+)\/(\d+)$/.exec(path);
      if (method === "PUT" && piece) {
        uploads.get(piece[1] as string)?.parts.push(new Uint8Array(init.body as ArrayBuffer));
        return json({});
      }
      const complete = /^\/uploads\/([^/]+)\/complete$/.exec(path);
      if (method === "POST" && complete) {
        const upload = uploads.get(complete[1] as string);
        if (!upload) return json({ error: "no upload" }, 404);
        const data = new Uint8Array(await new Blob(upload.parts).arrayBuffer());
        let id = upload.replaces;
        if (id) {
          const entry = entries.get(id) as Entry;
          entry.size = data.length;
          entry.version = (entry.version ?? 0) + 1;
          entry.modified_ms = Date.now();
          bytes.set(id, data);
          rev += 1;
        } else {
          id = addFile(upload.parent, upload.name, decoder.decode(data));
        }
        return json({ ...drive(), created: [id], version: entries.get(id)?.version });
      }
      const content = /^\/content\/([^/]+)$/.exec(path);
      if (method === "GET" && content) {
        const all = bytes.get(content[1] as string) ?? new Uint8Array();
        const first = Number(url.searchParams.get("piece") ?? 0) * 192 * 1024;
        const count = Number(url.searchParams.get("count") ?? 1) * 192 * 1024;
        return new Response(all.slice(first, first + count));
      }
      return json({ error: `no route ${method} ${path}` }, 404);
    }),
  );
  const walk = (path: string) => {
    let id: string | undefined;
    for (const name of path.split("/")) {
      const found: Entry | undefined = [...entries.values()].find(
        (entry) => entry.name === name && entry.parent === id && entry.trashed_ms === undefined,
      );
      if (!found) return undefined;
      id = found.id;
    }
    return id;
  };
  return {
    entries,
    bytes,
    ops,
    addFile,
    addFolder,
    idOf: walk,
    textOf: (path) => {
      const id = walk(path);
      const data = id ? bytes.get(id) : undefined;
      return data ? decoder.decode(data) : undefined;
    },
  };
}
