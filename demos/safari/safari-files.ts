/** Safari's File commands that read and write files: pure, so a test can hold them to their word. */

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Bookmarks as the file browsers trade them. */
export function bookmarksToHtml(
  groups: readonly { title: string; links: readonly { title: string; url: string }[] }[],
): string {
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
  ];
  for (const { title, links } of groups) {
    lines.push(`<DT><H3>${escapeHtml(title)}</H3>`, "<DL><p>");
    for (const link of links) {
      lines.push(`<DT><A HREF="${escapeHtml(link.url)}">${escapeHtml(link.title)}</A>`);
    }
    lines.push("</DL><p>");
  }
  lines.push("</DL><p>", "");
  return lines.join("\n");
}

/** The http(s) links of a bookmarks file, each once. */
export function bookmarksFromHtml(text: string): { title: string; url: string }[] {
  const found = new Map<string, string>();
  const anchors = new DOMParser().parseFromString(text, "text/html").querySelectorAll("a[href]");
  for (const anchor of anchors) {
    const url = anchor.getAttribute("href") ?? "";
    if (/^https?:\/\//i.test(url) && !found.has(url)) {
      found.set(url, anchor.textContent?.trim() || url);
    }
  }
  return [...found].map(([url, title]) => ({ title, url }));
}

/** The address in a saved link: a `.webloc` property list or a `.url` shortcut, if http(s). */
export function addressOfLinkFile(text: string): string | null {
  const found =
    /<key>\s*URL\s*<\/key>\s*<string>\s*([^<]+?)\s*<\/string>/i.exec(text) ??
    /^\s*URL\s*=\s*(\S+)\s*$/im.exec(text);
  const address = found?.[1]?.replace(/&amp;/g, "&");
  return address && /^https?:\/\//i.test(address) ? address : null;
}

/** A file's name for a page: its title, without what a file name cannot hold. */
export function pageFileName(title: string, extension: string): string {
  const name = title
    .replace(/[/\\:*?"<>|\p{Cc}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return `${name || "Untitled"}.${extension}`;
}

/** Whether a file is a saved link: what Finder opens in Safari. */
export const isLinkFile = (file: { name: string }) => /\.(webloc|url)$/i.test(file.name);

/** Whether a file is a web page Safari can show, once the server has made it safe. */
export const isPageFile = (file: { name: string }) => /\.html?$/i.test(file.name);

const FILE_PAGE = "safari:file/";

/** The tab address of an HTML file: on the drive by its id, or one chosen from this computer. */
export const filePageAddress = (id: string, name: string) =>
  `${FILE_PAGE}${encodeURIComponent(id)}/${encodeURIComponent(name)}`;

export const isFilePage = (address: string) => address.startsWith(FILE_PAGE);

/** The id and name in a file's tab address. */
export function filePageOf(address: string): { id: string; name: string } {
  const [id = "", name = ""] = address.slice(FILE_PAGE.length).split("/");
  return { id: decodeURIComponent(id), name: decodeURIComponent(name) };
}

/** What the address field shows for a file's tab. */
export const filePageText = (address: string) => `file:///${encodeURI(filePageOf(address).name)}`;

const LOCAL_ID = "local-";
const localFiles = new Map<string, Blob>();

/** Holds a file from this computer for as long as the page is open: the tab's address names it. */
export function localFilePage(file: File): string {
  const id = `${LOCAL_ID}${localFiles.size + 1}`;
  localFiles.set(id, file);
  return filePageAddress(id, file.name);
}

/** A file held from this computer, by its id: `undefined` for a drive file's, or after a reload. */
export const localFileOf = (id: string) => localFiles.get(id);

/** Whether an id names a file from this computer rather than one on the drive. */
export const isLocalId = (id: string) => id.startsWith(LOCAL_ID);
