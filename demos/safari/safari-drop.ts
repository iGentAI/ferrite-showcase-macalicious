import type { DragEvent } from "react";

/** What a drop carries: `getData` of a drag's `DataTransfer`, with its types. */
type Dropped = Pick<DataTransfer, "getData" | "types">;

const isWeb = (text: string) => /^https?:\/\/\S+$/i.test(text);

/** The drop's text: the first address of a list of links, else what was dragged as text. */
export function droppedText(data: Dropped): string {
  const address = data
    .getData("text/uri-list")
    .split(/\r?\n/)
    .find((line) => line.trim() && !line.startsWith("#"));
  const text = (address ?? data.getData("text/plain")).trim();
  // A picture dragged out of a page brings its bytes as an address: nowhere to go.
  return /^data:/i.test(text) ? "" : text;
}

/** The type a tile's drag names itself with: the text of a tile also holds its big letter. */
export const LINK_TITLE_TYPE = "application/x-macalicious-link-title";

/** The web link a drop carries, named by the text of the dragged link when it has one. */
export function droppedLink(data: Dropped): { title: string; url: string } | null {
  const url = droppedText(data);
  if (!isWeb(url)) return null;
  const given = data.getData(LINK_TITLE_TYPE);
  if (given) return { title: given, url };
  const html = data.getData("text/html");
  const named = html
    ? new DOMParser().parseFromString(html, "text/html").body.textContent?.trim()
    : "";
  return { title: named || url, url };
}

const carries = (event: DragEvent, types: readonly string[]) =>
  types.some((type) => event.dataTransfer.types.includes(type));

/** `onDragOver` where a link may drop. */
export const acceptLinkDrag = (event: DragEvent) => {
  if (carries(event, ["text/uri-list"])) event.preventDefault();
};

/** `onDragOver` where a link or text may drop. */
export const acceptTextDrag = (event: DragEvent) => {
  if (carries(event, ["text/uri-list", "text/plain"])) event.preventDefault();
};
