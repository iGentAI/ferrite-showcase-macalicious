import { useMemo } from "react";
import {
  forgetKeptPieces,
  forgetKeptText,
  keepText,
  readKeptText,
  useKeptTextValue,
} from "../desktop/desktop-kept-text";
import { changeDesktopValue, desktopValues, useDesktopValue } from "../desktop/desktop-personal";
import { LANGUAGES, type ScriptLanguage } from "./script-editor-data";
import type { ScriptFile } from "./script-editor-server";

/*
 * What Script Editor keeps of the person's work among their desktop values, which survive a reload
 * and follow them from browser to browser: the unsaved script of each window and the scripts opened
 * last. A draft larger than one value goes in pieces (`desktop-kept-text.ts`). A saved script's
 * Description and bundle fields go in its file (`fileText`), so a copy of the file has them.
 */

const MAX_VALUE_BYTES = 4000;
const MAX_RECENTS = 10;
const RECENTS_KEY = "scriptEditor.recents";

const bytesOf = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** A file of a script's bundle: an item of the drive. */
export interface BundleFile {
  id: string;
  name: string;
}

/** A script's bundle fields. */
export interface BundleInfo {
  name: string;
  identifier: string;
  version: string;
  copyright: string;
  /** Files File > Export copies into the bundle's Resources. */
  resources?: readonly BundleFile[];
  /** Further scripts File > Export copies into the bundle's Resources/Scripts. */
  scripts?: readonly BundleFile[];
}

/** A window's unsaved script. */
export interface ScriptDraft {
  code: string;
  language: ScriptLanguage;
  /** The window's title when it differs from its first one: a script's name. */
  title: string | null;
  /** The drive file the changes belong to. */
  file: ScriptFile | null;
  /** The Description's content, once it has been edited. */
  description?: string;
  /** The bundle fields, once they have been edited. */
  bundle?: BundleInfo;
}

/** The value a window keeps its draft under: `slot` is what follows `:` in its window id. */
export const draftKey = (slot?: string) => `scriptEditor.draft${slot ?? ""}`;

/** Keeps `draft` under `key`. False when it is too long to keep: what was kept before stays. */
export function keepDraft(key: string, draft: ScriptDraft): boolean {
  if (bytesOf(draft) > MAX_VALUE_BYTES) return keepText(key, JSON.stringify(draft));
  changeDesktopValue(key, draft);
  forgetKeptPieces(key);
  return true;
}

export const forgetDraft = (key: string): void => forgetKeptText(key);

const readBundleFiles = (stored: unknown): readonly BundleFile[] | undefined =>
  Array.isArray(stored)
    ? stored.flatMap((entry: Partial<BundleFile> | null) =>
        typeof entry?.id === "string" && typeof entry.name === "string"
          ? [{ id: entry.id, name: entry.name }]
          : [],
      )
    : undefined;

function readBundle(stored: unknown): BundleInfo | undefined {
  const bundle = stored as Partial<BundleInfo> | null | undefined;
  if (
    typeof bundle?.name !== "string" ||
    typeof bundle.identifier !== "string" ||
    typeof bundle.version !== "string" ||
    typeof bundle.copyright !== "string"
  ) {
    return undefined;
  }
  const resources = readBundleFiles(bundle.resources);
  const scripts = readBundleFiles(bundle.scripts);
  return {
    name: bundle.name,
    identifier: bundle.identifier,
    version: bundle.version,
    copyright: bundle.copyright,
    ...(resources ? { resources } : undefined),
    ...(scripts ? { scripts } : undefined),
  };
}

/** What a saved script's Description and bundle fields hold. */
export interface ScriptInfo {
  description?: string;
  bundle?: BundleInfo;
}

function parseScriptInfo(text: string): ScriptInfo | null {
  try {
    const info = JSON.parse(text) as ScriptInfo | null;
    if (typeof info !== "object" || info === null) return null;
    const bundle = readBundle(info.bundle);
    return {
      ...(typeof info.description === "string" ? { description: info.description } : undefined),
      ...(bundle ? { bundle } : undefined),
    };
  } catch {
    return null;
  }
}

const INFO_LINE = /\n\/\* Script Editor: (\{.*\}) \*\/\n$/s;

/**
 * What a script's file holds: its code and, when it has them, a last line with its Description and
 * bundle fields. The line is a comment, so the file still runs as it stands in any JavaScript host.
 * In JSON a `*` stands only inside a string, where `\u002f` reads as the `/` it replaces, so nothing
 * in it can end the comment.
 */
export function fileText(code: string, info: ScriptInfo): string {
  if (info.description === undefined && info.bundle === undefined) return code;
  return `${code}\n/* Script Editor: ${JSON.stringify(info).replace(/\*\//g, "*\\u002f")} */\n`;
}

/** A script file's code, and its Description and bundle fields when the file holds them. */
export function readFileText(text: string): { code: string; info: ScriptInfo | null } {
  const line = INFO_LINE.exec(text);
  const info = line ? parseScriptInfo(line[1] as string) : null;
  return info && line ? { code: text.slice(0, line.index), info } : { code: text, info: null };
}

const infoKey = (id: string) => `scriptEditor.info.${id}`;

/** What a file saved before its file held these keeps among the person's values, until its next save. */
export const readOlderScriptInfo = (id: string): ScriptInfo =>
  parseScriptInfo(readKeptText(infoKey(id)) ?? "{}") ?? {};

export function forgetOlderScriptInfo(id: string): void {
  if (readKeptText(infoKey(id)) !== undefined) forgetKeptText(infoKey(id));
}

function readFile(stored: unknown): ScriptFile | null {
  const file = stored as Partial<ScriptFile> | null;
  if (typeof file?.id !== "string" || typeof file.name !== "string") return null;
  return {
    id: file.id,
    name: file.name,
    parent: typeof file.parent === "string" ? file.parent : undefined,
    version: typeof file.version === "number" ? file.version : undefined,
  };
}

export function readDraft(stored: unknown): ScriptDraft | undefined {
  const draft = stored as Partial<ScriptDraft> | null;
  if (typeof draft?.code !== "string") return undefined;
  const language = LANGUAGES.find((name) => name === draft.language);
  if (!language) return undefined;
  const bundle = readBundle(draft.bundle);
  return {
    code: draft.code,
    language,
    title: typeof draft.title === "string" ? draft.title : null,
    file: readFile(draft.file),
    ...(typeof draft.description === "string" ? { description: draft.description } : undefined),
    ...(bundle ? { bundle } : undefined),
  };
}

/** The draft kept under `key`, whether it holds itself or went in pieces. */
export function useStoredDraft(key: string): ScriptDraft | null {
  const text = useKeptTextValue(key);
  const record = useDesktopValue(key, readDraft, null);
  return useMemo(() => {
    if (text === undefined) return record;
    try {
      return readDraft(JSON.parse(text)) ?? record;
    } catch {
      return record;
    }
  }, [text, record]);
}

/** A script in the Open Recent menu. */
export interface RecentScript {
  id: string;
  name: string;
}

const NO_RECENTS: readonly RecentScript[] = [];

function readRecents(stored: unknown): readonly RecentScript[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored.flatMap((entry: Partial<RecentScript> | null) =>
    typeof entry?.id === "string" && typeof entry.name === "string"
      ? [{ id: entry.id, name: entry.name }]
      : [],
  );
}

const savedRecents = () => readRecents(desktopValues()[RECENTS_KEY]) ?? NO_RECENTS;

/** The scripts opened last, newest first. */
export function useRecentScripts(): readonly RecentScript[] {
  const stored = useDesktopValue<unknown>(RECENTS_KEY, (value) => value, null);
  return useMemo(() => readRecents(stored) ?? NO_RECENTS, [stored]);
}

/** `script` goes first in Open Recent, once. */
export function noteRecentScript(script: RecentScript): void {
  const next = [
    { id: script.id, name: script.name },
    ...savedRecents().filter((each) => each.id !== script.id),
  ].slice(0, MAX_RECENTS);
  while (next.length > 1 && bytesOf(next) > MAX_VALUE_BYTES) next.pop();
  if (bytesOf(next) <= MAX_VALUE_BYTES) changeDesktopValue(RECENTS_KEY, next);
}

/** A script that could not be opened leaves Open Recent. */
export const forgetRecentScript = (id: string): void =>
  changeDesktopValue(
    RECENTS_KEY,
    savedRecents().filter((each) => each.id !== id),
  );

export const clearRecentScripts = (): void => changeDesktopValue(RECENTS_KEY, []);
