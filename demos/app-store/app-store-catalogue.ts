import type { CatalogueApp } from "../desktop/desktop-library";
import type {
  AppStoreApp,
  AppStoreArtwork,
  AppStoreColor,
  AppStoreGlyph,
  AppStoreSection,
  AppStoreStory,
} from "./app-store-data";

/**
 * The App Store as the desktop's Ferrite application serves it: it sells the Macalicious apps
 * themselves, from the server's catalogue (`ferrite-apps/desktop/src/apps/catalogue.rs`), in
 * place of the demo's invented ones. An app's icon is the store's abstract placeholder, a glyph
 * on a gradient chosen by its category.
 */

/** How the store names and draws a category of the catalogue. */
export const CATALOGUE_CATEGORIES: Readonly<
  Record<
    string,
    { name: string; glyph: AppStoreGlyph; colors: readonly [AppStoreColor, AppStoreColor] }
  >
> = {
  productivity: { name: "Productivity", glyph: "note", colors: ["yellow", "orange"] },
  internet: { name: "Internet", glyph: "wave", colors: ["teal", "blue"] },
  media: { name: "Entertainment", glyph: "film", colors: ["pink", "purple"] },
  creativity: { name: "Creativity", glyph: "brush", colors: ["orange", "pink"] },
  utilities: { name: "Utilities", glyph: "grid", colors: ["indigo", "blue"] },
  system: { name: "System", glyph: "shield", colors: ["gray", "indigo"] },
  games: { name: "Games", glyph: "dice", colors: ["red", "orange"] },
};

const OTHER = { name: "Other", glyph: "star", colors: ["gray", "gray"] } as const;

/** The categories of the catalogue each section of the sidebar lists; Discover lists them all. */
export const SECTION_CATEGORIES: Readonly<Partial<Record<AppStoreSection, readonly string[]>>> = {
  arcade: ["games"],
  create: ["creativity", "media"],
  work: ["productivity", "internet"],
  play: ["games", "media"],
  develop: ["utilities", "system"],
};

/**
 * The catalogue's apps as the store lists them: `Get` for an app the store sells and the session
 * has not got, `Open` for one it has or that comes with the desktop, `Update` for one behind the
 * current version. The id is prefixed, so that no app of the catalogue takes the generated icon of
 * an invented app.
 */
export function storeAppsOf(
  catalogue: readonly CatalogueApp[],
  installed: readonly string[],
  behind: readonly string[] = [],
): AppStoreApp[] {
  return catalogue.map((app) => {
    const category = CATALOGUE_CATEGORIES[app.category] ?? OTHER;
    return {
      id: storeId(app.id),
      title: app.name,
      subtitle: app.summary,
      category: category.name,
      offer: behind.includes(app.id)
        ? "Update"
        : app.preinstalled || installed.includes(app.id)
          ? "Open"
          : "Get",
      glyph: category.glyph,
      colors: category.colors,
    };
  });
}

const PREFIX = "macalicious-";

/** The store's id for an app of the catalogue. */
export const storeId = (id: string) => `${PREFIX}${id}`;

/** The app of the catalogue a store id names, or `undefined` for an invented app. */
export const catalogueId = (id: string) =>
  id.startsWith(PREFIX) ? id.slice(PREFIX.length) : undefined;

/** The stand-in drawings of the stories, in the order a page uses them. */
const STORY_ARTWORK: readonly AppStoreArtwork[] = ["orbits", "tiles"];

/**
 * The two stories at the top of a section's page, written from the catalogue: its apps the person
 * has not got first, each told in its own summary. A story's `id` is its app's.
 */
export function storiesOfApps(
  apps: readonly AppStoreApp[],
  installed: (app: AppStoreApp) => boolean,
): AppStoreStory[] {
  const offered = apps.filter((app) => !installed(app));
  const others = apps.filter((app) => installed(app));
  return [...offered, ...others].slice(0, STORY_ARTWORK.length).map((app, at) => ({
    id: app.id,
    eyebrow: app.category,
    title: app.title,
    body: app.subtitle,
    artwork: STORY_ARTWORK[at] as AppStoreArtwork,
  }));
}

/** The apps a section lists. */
export function appsOfSection(
  apps: readonly AppStoreApp[],
  section: AppStoreSection,
): AppStoreApp[] {
  const categories = SECTION_CATEGORIES[section];
  if (!categories) return [...apps];
  const names = categories.map((key) => CATALOGUE_CATEGORIES[key]?.name);
  return apps.filter((app) => names.includes(app.category));
}
