import { PushButton } from "macalicious/push-button";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

/*
 * The demo's web: a handful of invented sites under the reserved `.example` domain, a search
 * page over them and an error page for everything else. Nothing is fetched and no real site is
 * reproduced.
 */

/** The address of the start page: an empty address field. */
export const START_PAGE = "";

export interface SafariSite {
  /** Host name, without `www.`. */
  host: string;
  /** The site's wordmark. */
  name: string;
  /** The page's title, shown in its tab. */
  title: string;
  /** Which of the six `--mac-safari-tint-*` colours the site uses. */
  tint: number;
  /** The page's heading, and the title of its Reader article. */
  heading: string;
  paragraphs: readonly string[];
  /** Whether the page has a video where the others have a picture. */
  video?: boolean;
}

export type SafariPage =
  | { kind: "start"; url: string; title: string }
  | { kind: "site"; url: string; title: string; site: SafariSite }
  | { kind: "search"; url: string; title: string; query: string; results: readonly SafariSite[] }
  | { kind: "error"; url: string; title: string; host: string };

const FILLER = [
  "This page is placeholder content written for the demo. It stands where a real page would be, so the browser has something to scroll, to show in Reader and to draw in the Tab Overview.",
  "Every address that ends in .example opens a page like this one. The domain is reserved for documentation, so no address here leads anywhere outside the demo.",
  "Use the Back and Forward buttons to walk through the pages a tab has shown, the Reader button in the address field for a quieter layout, and the Tab Overview button to see every open tab at once.",
];

const SITES: readonly SafariSite[] = [
  {
    host: "lookup.example",
    name: "Lookup",
    title: "Lookup",
    tint: 1,
    heading: "Lookup",
    paragraphs: [
      "Lookup is the demo's search page. Type a few words in the address field and press Return: the pages of the demo whose name matches are listed here.",
      ...FILLER.slice(1),
    ],
  },
  {
    host: "fieldnotes.example",
    name: "Field Notes",
    title: "About – Field Notes",
    tint: 2,
    heading: "About",
    paragraphs: [
      "Field Notes is a small invented journal about old computers, good pencils and the weather. It exists so that this window has a page with a heading, a picture and a few paragraphs.",
      "The picture above is generated artwork made for the demo, like every picture here: none of it is third-party.",
      ...FILLER.slice(2),
    ],
  },
  {
    host: "harbor.example",
    name: "Harbor Radio",
    title: "Harbor Radio",
    tint: 3,
    heading: "About Harbor Radio",
    paragraphs: [
      "Harbor Radio is an invented network of shows about tides, tools and long walks. New episodes never appear, because there are none.",
      "With topics that range from knots to lighthouses, the network brings together voices that do not exist to talk about things that mostly do.",
      ...FILLER.slice(1),
    ],
  },
  {
    host: "reel.example",
    name: "Reel",
    title: "Tide Pools at Dawn – Reel",
    tint: 4,
    heading: "Tide Pools at Dawn",
    video: true,
    paragraphs: [
      "Reel is the demo's video site, and this is its one video: a still picture that stands where a player would be. Nothing plays and there is no sound.",
      "The button under the video moves it to a Picture in Picture window, which floats in a corner while this tab shows a note in its place. Drag the window to another corner, or use its buttons to close it or to return the video to this page.",
      ...FILLER.slice(1),
    ],
  },
];

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The site at a `.example` host: one of the written ones, or a generic page named after it. */
function siteAt(host: string): SafariSite {
  const known = SITES.find((site) => site.host === host);
  if (known) return known;
  const label = host.slice(0, -".example".length).split(".").at(-1) ?? host;
  const name = capitalise(label);
  let sum = 0;
  for (const character of label) sum += character.charCodeAt(0);
  return { host, name, title: name, tint: (sum % 6) + 1, heading: name, paragraphs: FILLER };
}

/** What the address field's text means: an address as typed, or a search for the words. */
export function addressFor(text: string): string {
  const typed = text.trim();
  if (typed === "") return START_PAGE;
  if (/^[a-z][\w+.-]*:\/\//i.test(typed)) return typed;
  if (!/\s/.test(typed) && typed.includes(".")) return `https://${typed}`;
  return `https://lookup.example/search?q=${encodeURIComponent(typed)}`;
}

/** The page at an address. */
export function pageAt(url: string): SafariPage {
  if (url === START_PAGE) return { kind: "start", url, title: "Favorites" };
  let parsed: URL | undefined;
  try {
    parsed = new URL(url);
  } catch {
    parsed = undefined;
  }
  const host = parsed?.hostname.replace(/^www\./, "") ?? url;
  if (!parsed || !host.endsWith(".example")) {
    return { kind: "error", url, title: "Failed to open page", host };
  }
  const query = host === "lookup.example" ? parsed.searchParams.get("q") : null;
  if (query) {
    const words = query.toLowerCase();
    const results = [...SITES, ...FAVORITES.flatMap((favorite) => favorite.site ?? [])].filter(
      (site) => `${site.name} ${site.title} ${site.host}`.toLowerCase().includes(words),
    );
    return { kind: "search", url, title: `${query} – Lookup`, query, results };
  }
  const site = siteAt(host);
  return { kind: "site", url, title: site.title, site };
}

export interface SafariFavorite {
  label: string;
  /** A folder's second line. A favourite with a detail is a folder. */
  detail?: string;
  /** The site a favourite opens; a folder has none. */
  site?: SafariSite;
}

const favorite = (host: string): SafariFavorite => {
  const site = siteAt(host);
  return { label: site.name, site };
};

/** The start page's grid, row by row: six columns, two rows, a folder at the end of each. */
export const FAVORITES: readonly SafariFavorite[] = [
  favorite("orchard.example"),
  favorite("lantern.example"),
  favorite("parcel.example"),
  favorite("bazaar.example"),
  favorite("violet.example"),
  { label: "News", detail: "16 Websites" },
  { label: "Orchard", detail: "4 Websites" },
  favorite("cloudbank.example"),
  favorite("commons.example"),
  favorite("chirp.example"),
  favorite("almanac.example"),
  { label: "Popular", detail: "8 Websites" },
];

export interface SafariBookmark {
  label: string;
  /** A link's address. */
  url?: string;
  /** A folder's content. */
  children?: readonly SafariBookmark[];
  /** Whether a folder starts open. */
  expanded?: boolean;
  /** The Favorites folder, which has a star for an icon. */
  star?: boolean;
  /** The list a link belongs to, when its row's place does not say. */
  list?: "favorites" | "bookmarks" | "reading-list";
  /** The bookmark folder a link is in. */
  folder?: string;
}

const link = (label: string, host: string): SafariBookmark => ({
  label,
  url: `https://${host}/`,
});

const folder = (label: string, ...children: SafariBookmark[]): SafariBookmark => ({
  label,
  children,
});

/** The Bookmarks sidebar: the folder layout of the Favorites capture, with invented names. */
export const BOOKMARKS: readonly SafariBookmark[] = [
  {
    label: "Favorites",
    star: true,
    children: FAVORITES.flatMap((item) => (item.site ? [link(item.label, item.site.host)] : [])),
  },
  {
    label: "News",
    expanded: true,
    children: [
      link("Morning Wire", "morningwire.example"),
      link("The Daily Ledger", "ledger.example"),
      link("Coast Courier", "courier.example"),
      link("WORLD DESK", "worlddesk.example"),
      link("Market Watchtower", "watchtower.example"),
      link("Gadget Bulletin", "bulletin.example"),
      link("Lookup News", "lookup.example"),
      link("The Daily Ledger", "ledger.example"),
      link("Morning Wire", "morningwire.example"),
      link("Capital Post", "capitalpost.example"),
      link("Harbor Radio", "harbor.example"),
      link("World Desk", "worlddesk.example"),
      link("Field Notes", "fieldnotes.example"),
      folder("Region", link("Coast Courier", "courier.example")),
      folder("Business", link("Market Watchtower", "watchtower.example")),
      folder("Technology", link("Gadget Bulletin", "bulletin.example")),
    ],
  },
  folder("Computers", link("Orchard", "orchard.example")),
  folder("Kids", link("Lantern", "lantern.example")),
  folder("Sports", link("Chirp", "chirp.example")),
  folder("Entertainment", link("Violet", "violet.example")),
  folder("Shopping", link("Bazaar", "bazaar.example"), link("Parcel", "parcel.example")),
  folder("Travel", link("Cloudbank", "cloudbank.example")),
  folder("Tools and Reference", link("Almanac", "almanac.example")),
  folder("Other...", link("Commons", "commons.example")),
  folder("Imported Bookmarks", link("Lookup", "lookup.example")),
  folder("Other...", link("Harbor Radio", "harbor.example")),
];

/** The Reading List sidebar. */
export const READING_LIST: readonly SafariBookmark[] = [
  link("About – Field Notes", "fieldnotes.example"),
  link("About Harbor Radio", "harbor.example"),
];

/** The tabs the window opens with: the three of the Safari capture, the middle one in front. */
export const DEFAULT_TABS: readonly string[] = [
  "https://lookup.example/",
  "https://fieldnotes.example/about",
  "https://harbor.example/",
];

interface LinkProps {
  url: string;
  onNavigate: (url: string) => void;
  className?: string;
  children: ReactNode;
}

/** A link of a placeholder page: it loads its address in the tab instead of leaving the demo. */
function PageLink({ url, onNavigate, className, children }: LinkProps) {
  return (
    <a
      href={url}
      className={className}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        onNavigate(url);
      }}
    >
      {children}
    </a>
  );
}

/* Generated artwork, all original: a touch icon for each invented favourite (named after its
   host without ".example") and a photograph for the written sites' pages ("page-<name>"). */
const ART: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>("./art/*.webp", { eager: true, query: "?url", import: "default" }),
  ).map(([file, url]) => [file.slice("./art/".length, -".webp".length), url]),
);

const artName = (host: string) => host.replace(/\.example$/, "");

/** The generated photograph for a site's page, as an inline background, if there is one. */
function pageArt(host: string | undefined): CSSProperties | undefined {
  const url = host ? ART[`page-${artName(host)}`] : undefined;
  return url ? { background: `center / cover no-repeat url("${url}")` } : undefined;
}

/**
 * A favourite's tile: the site's generated touch icon, or its initial in the site's colour
 * when it has none or `artwork` is false. Decorative; the favourite's label names it.
 */
export function SafariFavoriteArtwork({
  site,
  artwork = true,
}: {
  site: SafariSite;
  /** Whether the generated touch icon is used. */
  artwork?: boolean;
}) {
  const url = artwork ? ART[artName(site.host)] : undefined;
  return (
    <span className="mac-safari-artwork" data-tint={site.tint}>
      {url ? (
        <img
          src={url}
          alt=""
          draggable={false}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        site.name.charAt(0)
      )}
    </span>
  );
}

/* The touch icons in the order a folder's tile shows them. */
const FOLDER_ICONS = [
  "orchard",
  "lantern",
  "parcel",
  "bazaar",
  "violet",
  "cloudbank",
  "commons",
  "chirp",
  "almanac",
];

/**
 * A folder's tile: a grid of the small touch icons of the sites in it, as Safari shows them,
 * starting at `offset` so that two folders differ. Empty when there are no icons or `artwork`
 * is false. Decorative.
 */
export function SafariFolderArtwork({
  offset = 0,
  count = 6,
  artwork = true,
}: {
  offset?: number;
  count?: number;
  /** Whether the generated touch icons are used. */
  artwork?: boolean;
}) {
  if (!artwork) return null;
  const urls = Array.from({ length: count }, (_, at) => {
    const name = FOLDER_ICONS[(offset + at) % FOLDER_ICONS.length] ?? "";
    return ART[name];
  }).filter((url): url is string => Boolean(url));
  if (urls.length === 0) return null;
  return (
    <span
      className="mac-safari-folder-artwork"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        alignContent: "start",
        gap: "9%",
        boxSizing: "border-box",
        width: "100%",
        height: "100%",
        padding: "14%",
      }}
    >
      {urls.map((url) => (
        <img
          key={url}
          src={url}
          alt=""
          draggable={false}
          style={{ display: "block", width: "100%", aspectRatio: "1", borderRadius: "18%" }}
        />
      ))}
    </span>
  );
}

/** A picture where a real page would have a photograph: the site's own, or a drawing. */
export function SafariPicture({
  tint,
  reader = false,
  host,
}: {
  tint: number;
  reader?: boolean;
  /** The site's host: its generated photograph is used when there is one. */
  host?: string;
}) {
  return (
    <div
      role="img"
      aria-label="Placeholder picture"
      data-tint={tint}
      data-reader={reader ? "" : undefined}
      className="mac-safari-picture"
      style={pageArt(host)}
    />
  );
}

/**
 * The frame of the demo's video: a drawing, like the pictures. `floating` is the frame in the
 * Picture in Picture window, which it fills.
 */
export function SafariVideoFrame({
  tint,
  floating = false,
  host,
}: {
  tint: number;
  floating?: boolean;
  /** The site's host: its generated still is used when there is one. */
  host?: string;
}) {
  return (
    <div
      role="img"
      aria-label="Placeholder video"
      data-tint={tint}
      data-floating={floating ? "" : undefined}
      className="mac-safari-picture mac-safari-video"
      style={pageArt(host)}
    />
  );
}

/**
 * The page of one of the demo's sites: a header with the wordmark, a heading, a picture or a
 * video, text.
 */
export function SafariSitePage({
  site,
  onNavigate,
  pictureInPicture = false,
  onPictureInPicture,
  artwork = true,
}: {
  site: SafariSite;
  onNavigate: (url: string) => void;
  /** Whether the picture or the video is the site's generated still, or else the drawing. */
  artwork?: boolean;
  /** Whether the page's video is in the Picture in Picture window, and so not on the page. */
  pictureInPicture?: boolean;
  /** Called when the button under the video is clicked. */
  onPictureInPicture?: () => void;
}) {
  return (
    <div className="mac-safari-page" data-tint={site.tint}>
      <div className="mac-safari-page-header">
        <span className="mac-safari-page-wordmark">{site.name}</span>
        <nav aria-label={`${site.name} sections`} className="mac-safari-page-nav">
          {SITES.filter((other) => other !== site).map((other) => (
            <PageLink key={other.host} url={`https://${other.host}/`} onNavigate={onNavigate}>
              {other.name}
            </PageLink>
          ))}
        </nav>
      </div>
      <h1 className="mac-safari-page-heading">{site.heading}</h1>
      {!site.video ? (
        <SafariPicture tint={site.tint} host={artwork ? site.host : undefined} />
      ) : pictureInPicture ? (
        <div className="mac-safari-picture mac-safari-video" data-away="">
          This video is playing in Picture in Picture.
        </div>
      ) : (
        <>
          <SafariVideoFrame tint={site.tint} host={artwork ? site.host : undefined} />
          <p className="mac-safari-video-actions">
            <PushButton onClick={onPictureInPicture}>Enter Picture in Picture</PushButton>
          </p>
        </>
      )}
      {site.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}

/** The search page: the sites whose name matches the words. */
export function SafariSearchPage({
  query,
  results,
  onNavigate,
}: {
  query: string;
  results: readonly SafariSite[];
  onNavigate: (url: string) => void;
}) {
  return (
    <div className="mac-safari-page" data-tint={1}>
      <div className="mac-safari-page-header">
        <span className="mac-safari-page-wordmark">Lookup</span>
      </div>
      <h1 className="mac-safari-page-heading">Results for “{query}”</h1>
      {results.length === 0 ? (
        <p>No page of this demo matches. Try “radio”, “notes” or “orchard”.</p>
      ) : (
        <ul className="mac-safari-page-results">
          {results.map((site) => (
            <li key={site.host}>
              <PageLink url={`https://${site.host}/`} onNavigate={onNavigate}>
                {site.title}
              </PageLink>
              <span className="mac-safari-page-result-host">{site.host}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The miniature of a page in the Tab Overview: a schematic drawing, not a rendering. */
export function SafariMiniature({ page }: { page: SafariPage }) {
  if (page.kind === "start") {
    return (
      <span className="mac-safari-miniature" data-kind="start">
        {FAVORITES.map((_item, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list; two folders share a label.
          <span key={index} className="mac-safari-miniature-tile" />
        ))}
      </span>
    );
  }
  const tint = page.kind === "site" ? page.site.tint : 1;
  return (
    <span className="mac-safari-miniature" data-kind={page.kind} data-tint={tint}>
      <span className="mac-safari-miniature-header" />
      <span className="mac-safari-miniature-heading" />
      {page.kind === "site" ? <span className="mac-safari-miniature-picture" /> : null}
      <span className="mac-safari-miniature-line" />
      <span className="mac-safari-miniature-line" />
      <span className="mac-safari-miniature-line" />
    </span>
  );
}
