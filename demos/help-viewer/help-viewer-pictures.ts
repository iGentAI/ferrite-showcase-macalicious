/*
 * Pictures of this desktop's own applications, taken from a served desktop by
 * ./pictures/capture.mjs. They stand where the captured guide has its photograph of a landscape
 * and its illustration of a laptop; none of Apple's pictures is reproduced.
 */

const PICTURES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("./pictures/*.webp", {
      eager: true,
      query: "?url",
      import: "default",
    }),
  ).map(([file, url]) => [file.slice("./pictures/".length, -".webp".length), url]),
);

export const pictureUrl = (name: string): string | undefined => PICTURES[name];

/** The picture of each guide, with what it shows, by the guide's name in its page ids. */
const GUIDE_PICTURES: Readonly<Record<string, string>> = {
  notes: "Notes on this desktop, with a note about a trip open.",
  textedit: "A new document in TextEdit on this desktop.",
  calendar: "A week in Calendar on this desktop.",
  contacts: "A card in Contacts on this desktop.",
  reminders: "A list in Reminders on this desktop.",
  music: "Music on this desktop, with its library empty and its buttons to add songs.",
  terminal: "A shell in Terminal on this desktop.",
  calculator: "Calculator on this desktop.",
  "system-preferences": "The panes of System Preferences on this desktop.",
};

/** Topics of the macOS guide that have a picture, by their ids. */
const TOPIC_PICTURES: Readonly<Record<string, readonly [name: string, alt: string]>> = {
  "organize-your-work-in-folders": ["finder", "A Finder window on this desktop."],
};

/** The picture of a page: a guide's own page, and its first topic. */
export function pagePicture(page: string): { url: string; alt: string } | undefined {
  const guide = /^guide:([^:]+)(?::1)?$/.exec(page)?.[1];
  const alt = guide ? GUIDE_PICTURES[guide] : undefined;
  const [name, words] =
    guide && alt ? [guide, alt] : (TOPIC_PICTURES[page] ?? ([undefined, undefined] as const));
  const url = name ? PICTURES[name] : undefined;
  return url && words ? { url, alt: words } : undefined;
}
