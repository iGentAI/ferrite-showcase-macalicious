"use client";

import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { ServicesItems } from "../desktop/desktop-services";
import { shareFiles } from "../desktop/desktop-share-link";
import { lookUpWord } from "../dictionary/dictionary-menus";

const NO_IMAGE_ADDRESS =
  "This picture is written into the page, with no address of its own to open.";
const NO_LOOK_UP = "Dictionary looks up a word or a short phrase.";

/** What a right-click in a page's frame found, as the frame reports it. */
export interface SafariPageHit {
  link: string | null;
  linkText: string;
  /** The picture's `data:` address: pictures of a fetched page are written into it. */
  image: string | null;
  text: string;
}

/** What the frame reported, keeping only what has the expected shape: the page's script is not ours to trust. */
export function readPageHit(reply: {
  link?: unknown;
  linkText?: unknown;
  image?: unknown;
  text?: unknown;
}): SafariPageHit {
  const link =
    typeof reply.link === "string" && /^https?:\/\//i.test(reply.link) ? reply.link : null;
  const image =
    typeof reply.image === "string" && /^data:image\/[a-z0-9.+-]+;base64,/i.test(reply.image)
      ? reply.image
      : null;
  return {
    link,
    linkText: typeof reply.linkText === "string" ? reply.linkText.slice(0, 200) : "",
    image,
    text: typeof reply.text === "string" ? reply.text : "",
  };
}

/** A `data:image` address as a file to save. */
export function imageFile(address: string): { blob: Blob; name: string } | null {
  const found = /^data:image\/([a-z0-9.+-]+);base64,(.*)$/is.exec(address);
  if (!found) return null;
  const [, subtype = "png", data = ""] = found;
  try {
    const bytes = Uint8Array.from(atob(data), (character) => character.charCodeAt(0));
    const extension = subtype.toLowerCase().split("+")[0];
    return {
      blob: new Blob([bytes], { type: `image/${subtype.toLowerCase()}` }),
      name: `image.${extension}`,
    };
  } catch {
    return null;
  }
}

/** Hands a `data:image` picture to Photos, which imports its bytes. */
export function addImageToPhotos(address: string): void {
  const file = imageFile(address);
  if (!file) return;
  shareFiles(
    "photos",
    [
      {
        id: `safari-image-${crypto.randomUUID()}`,
        name: file.name,
        kind: "file",
        type: file.blob.type,
        bytes: () => Promise.resolve(file.blob),
      },
    ],
    "safari",
  );
}

/** Puts a `data:image` picture on the clipboard, as PNG: what a browser's clipboard takes. */
export async function copyImage(address: string): Promise<boolean> {
  const file = imageFile(address);
  if (!file || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") return false;
  try {
    let png = file.blob;
    if (png.type !== "image/png") {
      const bitmap = await createImageBitmap(png);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
      png = await canvas.convertToBlob({ type: "image/png" });
    }
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return true;
  } catch {
    return false;
  }
}

export interface SafariPageMenuActions {
  open: (url: string) => void;
  openInNewTab: (url: string) => void;
  openInNewWindow: (url: string) => void;
  downloadLink: (url: string) => void;
  addBookmark: (url: string, title: string) => void;
  addToReadingList: (url: string, title: string) => void;
  copy: (text: string) => void;
  copyImage: (address: string) => void;
  lookUp: (text: string) => void;
  saveImage: (address: string) => void;
  search: (text: string) => void;
  back: { enabled: boolean; run: () => void };
  forward: { enabled: boolean; run: () => void };
  reload: () => void;
  reader: { title: string; enabled: boolean; run: () => void };
  addPage: { enabled: boolean; run: () => void };
}

/** The menu of what a right-click found in the page: its link, picture, selected text, or the page. */
export function SafariPageMenuItems({
  hit,
  actions,
}: {
  hit: SafariPageHit;
  actions: SafariPageMenuActions;
}) {
  const { link, image, text } = hit;
  const shortText = text.length > 24 ? `${text.slice(0, 24)}…` : text;
  return (
    <>
      {link ? (
        <>
          <MenuItem onClick={() => actions.open(link)}>Open Link</MenuItem>
          <MenuItem onClick={() => actions.openInNewTab(link)}>Open Link in New Tab</MenuItem>
          <MenuItem onClick={() => actions.openInNewWindow(link)}>Open Link in New Window</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={() => actions.downloadLink(link)}>Download Linked File</MenuItem>
          <MenuItem onClick={() => actions.addBookmark(link, hit.linkText)}>
            Add Link to Bookmarks
          </MenuItem>
          <MenuItem onClick={() => actions.addToReadingList(link, hit.linkText)}>
            Add Link to Reading List
          </MenuItem>
          <MenuSeparator />
          <MenuItem onClick={() => actions.copy(link)}>Copy Link</MenuItem>
        </>
      ) : null}
      {image ? (
        <>
          {link ? <MenuSeparator /> : null}
          <MenuItem disabled title={NO_IMAGE_ADDRESS}>
            Open Image in New Tab
          </MenuItem>
          <MenuItem onClick={() => actions.saveImage(image)}>Save Image to “Downloads”</MenuItem>
          <MenuItem onClick={() => actions.copyImage(image)}>Copy Image</MenuItem>
          <MenuItem onClick={() => addImageToPhotos(image)}>Add Image to Photos</MenuItem>
        </>
      ) : null}
      {text ? (
        <>
          {link || image ? <MenuSeparator /> : null}
          <MenuItem onClick={() => actions.copy(text)}>Copy</MenuItem>
          <MenuItem
            disabled={!lookUpWord(text)}
            title={lookUpWord(text) ? undefined : NO_LOOK_UP}
            onClick={() => actions.lookUp(text)}
          >
            Look Up “{shortText}”
          </MenuItem>
          <MenuItem onClick={() => actions.search(text)}>Search for “{shortText}”</MenuItem>
          <Submenu>
            <SubmenuTrigger>Services</SubmenuTrigger>
            <SubmenuPopup>
              <ServicesItems from="safari" none={<MenuItem disabled>No Services Apply</MenuItem>} />
            </SubmenuPopup>
          </Submenu>
        </>
      ) : null}
      {!link && !image && !text ? (
        <>
          <MenuItem disabled={!actions.back.enabled} onClick={actions.back.run}>
            Back
          </MenuItem>
          <MenuItem disabled={!actions.forward.enabled} onClick={actions.forward.run}>
            Forward
          </MenuItem>
          <MenuItem onClick={actions.reload}>Reload Page</MenuItem>
          <MenuSeparator />
          <MenuItem disabled={!actions.reader.enabled} onClick={actions.reader.run}>
            {actions.reader.title}
          </MenuItem>
          <MenuItem disabled={!actions.addPage.enabled} onClick={actions.addPage.run}>
            Add Page to Bookmarks
          </MenuItem>
        </>
      ) : null}
    </>
  );
}
