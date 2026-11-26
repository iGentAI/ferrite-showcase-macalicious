import type { ScriptLanguage } from "./script-editor-data";
import type { ScriptAction, ScriptDictionary } from "./script-editor-server";

/** Stands in a snippet for the text selected when it is chosen. */
const SELECTION = "§";

/** A group of the script's context menu, as the real app has a folder of snippets. */
export interface SnippetGroup {
  name: string;
  snippets: readonly { name: string; code: string }[];
}

export const SNIPPETS: Readonly<Record<ScriptLanguage, readonly SnippetGroup[]>> = {
  AppleScript: [
    {
      name: "Tell Blocks",
      snippets: [
        { name: "Tell “Notes”", code: `tell application "Notes"\n${SELECTION}\nend tell` },
        { name: "Tell “Reminders”", code: `tell application "Reminders"\n${SELECTION}\nend tell` },
        { name: "Tell “Calendar”", code: `tell application "Calendar"\n${SELECTION}\nend tell` },
      ],
    },
    {
      name: "Conditionals",
      snippets: [
        { name: "If…", code: `if true then\n${SELECTION}\nend if` },
        { name: "If…Else", code: `if true then\n${SELECTION}\nelse\n\nend if` },
      ],
    },
    {
      name: "Repeat Routines",
      snippets: [
        { name: "Repeat Times", code: `repeat 3 times\n${SELECTION}\nend repeat` },
        {
          name: "Repeat With Each Note",
          code: `tell application "Notes"\nset all_notes to every note\nrepeat with each_note in all_notes\nlog each_note\nend repeat\nend tell`,
        },
      ],
    },
    {
      name: "Comments",
      snippets: [{ name: "Comment Block", code: `(* ${SELECTION} *)` }],
    },
  ],
  JavaScript: [
    {
      name: "App Calls",
      snippets: [
        { name: "New Note", code: 'await Notes.make({ title: "Title", text: "Text" });' },
        { name: "New Reminder", code: 'await Reminders.add({ title: "Title" });' },
        { name: "Today’s Events", code: "const events = await Calendar.events();" },
      ],
    },
    {
      name: "Conditionals",
      snippets: [{ name: "If…", code: `if (true) {\n\t${SELECTION}\n}` }],
    },
    {
      name: "Repeat Routines",
      snippets: [{ name: "For Each", code: `for (const item of []) {\n\t${SELECTION}\n}` }],
    },
    {
      name: "Error Handlers",
      snippets: [
        {
          name: "Try Block",
          code: `try {\n\t${SELECTION}\n} catch (error) {\n\tconsole.log(error.message);\n}`,
        },
      ],
    },
  ],
};

/** The snippet's text around what is selected. */
export const fillSnippet = (code: string, selected: string): string =>
  code.split(SELECTION).join(selected);

const WORDS: Readonly<Record<ScriptLanguage, readonly string[]>> = {
  AppleScript: [
    "activate",
    "application",
    "display dialog",
    "else",
    "end if",
    "end repeat",
    "end tell",
    "every",
    "log",
    "make new",
    "repeat with",
    "return",
    "set",
    "tell application",
    "with properties",
  ],
  JavaScript: [
    "await",
    "catch",
    "console.log",
    "const",
    "for",
    "function",
    "return",
    "throw",
    "try",
  ],
};

/** The object a script calls an app's actions on: `Notes` for `notes`, from the names defined. */
export const globalOf = (app: string, globals: readonly string[]): string =>
  globals.find((name) => name.toLowerCase() === app.toLowerCase()) ?? `Desktop.${app}`;

/** How a script calls `action`: `Notes.make`, from the names the server says it defines. */
export function callOf(action: ScriptAction, globals: readonly string[]): string {
  const dot = action.name.indexOf(".");
  return `${globalOf(action.app, globals)}.${dot < 0 ? action.name : action.name.slice(dot + 1)}`;
}

/** The word that ends at the end of `before`: letters, digits and dots. */
export const wordBefore = (before: string): string => /[A-Za-z_][\w.]*$/.exec(before)?.[0] ?? "";

/**
 * What Edit > Complete offers for `word`: the language's words, what the dictionary lists, and the
 * words of the script, in that order and each once. Case is ignored; `word` itself is not offered.
 */
export function completionsOf(
  word: string,
  language: ScriptLanguage,
  script: string,
  dictionary: ScriptDictionary | null,
): readonly string[] {
  if (word === "") return [];
  const lower = word.toLowerCase();
  const calls =
    language === "JavaScript"
      ? (dictionary?.actions ?? []).map((action) => callOf(action, dictionary?.globals ?? []))
      : [];
  const typed = [...new Set(script.match(/[A-Za-z_][\w.]*/g) ?? [])].filter(
    (each) => each !== word,
  );
  return [...new Set([...WORDS[language], ...calls, ...typed])].filter(
    (each) => each.toLowerCase().startsWith(lower) && each.toLowerCase() !== lower,
  );
}
