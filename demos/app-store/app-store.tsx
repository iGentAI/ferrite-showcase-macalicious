"use client";

import { CardGrid, CardGridAction, CardGridCard } from "macalicious/card-grid";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { EditorialCard } from "macalicious/editorial-card";
import { EmptyState } from "macalicious/empty-state";
import { ImageButton } from "macalicious/image-button";
import { windowDragRegion } from "macalicious/lib/window-drag-region";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PushButton } from "macalicious/push-button";
import { ScrollView } from "macalicious/scroll-view";
import { SearchField } from "macalicious/search-field";
import { Sidebar, SidebarItem } from "macalicious/sidebar";
import { SplitView, SplitViewDivider, SplitViewPane } from "macalicious/split-view";
import { StorePillButton } from "macalicious/store-pill-button";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import {
  type CSSProperties,
  type Dispatch,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { LAUNCHPAD_APP_DRAG } from "../desktop/desktop-launchpad-folders";
import {
  APP_STORE_LIBRARY_URL,
  APPS_URL,
  addToLibrary,
  LibraryUnreadable,
  removeFromLibrary,
  useAppLibrary,
  useCatalogue,
} from "../desktop/desktop-library";
import { changeDesktopValue, useDesktopValue } from "../desktop/desktop-personal";
import {
  reloadServerDocuments,
  servedByDesktopApp,
  serverDocument,
  sessionFetch,
} from "../desktop/desktop-server";
import { copyText, LinkShareItems } from "../desktop/desktop-share-link";
import { DesktopWindowHostContext } from "../desktop/desktop-windows";
import { AppIcon, Avatar, HeroPicture, SectionGlyph, StoryArtwork } from "./app-store-artwork";
import {
  appsOfSection,
  CATALOGUE_CATEGORIES,
  catalogueId,
  storeAppsOf,
  storeId,
  storiesOfApps,
} from "./app-store-catalogue";
import {
  APPS,
  type AppStoreApp,
  type AppStoreCollection,
  type AppStoreOfferAction,
  type AppStoreOffers,
  type AppStorePage,
  type AppStoreSection,
  appMatches,
  appsOf,
  CATEGORIES,
  categoryCount,
  confirmTitle,
  DOWNLOAD_INTERVAL,
  isInstalled,
  isSection,
  PAGES,
  reduceOffers,
  SECTIONS,
  UPDATES,
} from "./app-store-data";
import { type AppStorePlace, forgetAccount, move, startHistory, visit } from "./app-store-history";
import { appStoreLink, onAppPage, takeAppPage } from "./app-store-link";
import { useAppStoreMenus } from "./app-store-menus";
import { APP_STORE_AUTO_UPDATES, readAutoUpdates } from "./app-store-preferences";
import { AppStoreProduct } from "./app-store-product";
import { useAppVersions } from "./app-store-versions";
import "./app-store.tokens.css";
import "./app-store.css";

/*
 * The store's source list departs from the standard one (reference/spec/apps/app-store.md):
 * rows of 42 pt with no space between them, a 26 pt glyph 20 pt from the edge and an 18.5 pt
 * label 12 pt after it. The sidebar's documented variables give the row its height, its
 * spacing, its icon box and the label's distance; the row's own `style` gives the inset.
 */
const SIDEBAR = {
  "--mac-sidebar-row-height": "42px",
  "--mac-sidebar-row-spacing": "0px",
  "--mac-sidebar-icon-size": "26px",
  "--mac-sidebar-label-gap": "12px",
} as CSSProperties;
const ROW: CSSProperties = { paddingInlineStart: 20 };
/* The store's own field (the search field's `store` variant, 26 pt high) at its 180 pt. */
const SEARCH: CSSProperties = { width: 180 };
/* The measured line beside the sidebar, through the split view's documented hook. */
const SPLIT = { "--mac-split-view-divider-color": "var(--mac-app-store-divider)" } as CSSProperties;

/*
 * Section headers as the store sets them (card-grid, Sizes): a 19.5 pt Semibold title and a
 * 15 pt action in a 44 pt header (in San Francisco their ink is 329 and 45 pt wide, as in
 * both captures), the title in the label colour, the line in the grid colour. The list of lockups ends 2 pt before the 945 pt column does, and the header's text
 * is inset from the line's ends, as measured.
 */
const COLLECTION = {
  paddingInlineEnd: 42,
  "--mac-card-grid-row-gap": "0px",
  "--mac-card-grid-header-padding": "11.5px 2px 7.5px 1.5px",
  "--mac-card-grid-title-font":
    "var(--mac-font-weight-semibold) 19.5px / 25px var(--mac-font-family-system)",
  "--mac-card-grid-action-font":
    "var(--mac-font-weight-regular) 15px / 21px var(--mac-font-family-system)",
  "--mac-card-grid-title": "var(--mac-color-label)",
  "--mac-card-grid-action": "var(--mac-app-store-link)",
  "--mac-card-grid-separator": "var(--mac-color-grid)",
} as CSSProperties;
/* The two story cards are 462 pt each with 20 pt between them: 944 of the column's 945 pt. */
const STORIES: CSSProperties = { paddingInlineEnd: 41 };

export interface AppStoreProps extends Omit<WindowProps, "children"> {
  /** The section shown (controlled). */
  section?: AppStoreSection;
  /**
   * The section shown at first (uncontrolled).
   * @default "discover"
   */
  defaultSection?: AppStoreSection;
  /** Called with the section chosen in the sidebar. */
  onSectionChange?: (section: AppStoreSection) => void;
  /**
   * Points the content pane is scrolled by when the window opens. The reference screenshot
   * shows Discover scrolled a little, the space over its hero above the window.
   * @default 0
   */
  defaultScrollTop?: number;
  /**
   * The sidebar's surface: the vibrant material, for a window over a desktop, or the same
   * surface as captured over a neutral window.
   * @default "translucent"
   */
  material?: "translucent" | "opaque";
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /**
   * Called when the primary pointer button goes down on the strip of the sidebar that holds
   * the window controls and the search field, not on a control in it. The store has no title
   * bar: this is its drag region, and a window manager starts moving the window here.
   */
  onDragRegionPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  /** Called when the drag region is double-clicked: a window manager zooms the window. */
  onDragRegionDoubleClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

/** The invented account the demo signs in to: nothing is asked and nothing is sent. */
const ACCOUNT_NAME = "Robin Vega";
const NO_ARCADE = "Arcade is a subscription, and nothing here costs money.";
const NO_HIDDEN = "The account has no hidden purchases: every app got here is listed.";
const NO_GIFT = "Nothing here costs money, so there is nothing to give.";
/** The section the person last chose, in the desktop's settings. */
const APP_STORE_SECTION = "app-store.section";
const readKeptSection = (stored: unknown): AppStoreSection | undefined =>
  typeof stored === "string" && isSection(stored) && stored !== "arcade" ? stored : undefined;
/** How many apps of the category an app's page lists under it. */
const RELATED_APPS = 4;

/** Names as a sentence lists them: "A", "A and B", "A, B and C". */
function listed(names: readonly string[]): string {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** What a page needs to draw its offer buttons and to move them on. */
interface Store {
  offers: AppStoreOffers;
  dispatch: Dispatch<AppStoreOfferAction>;
  /** Whether an app is installed: on the desktop, only once the person's library holds it. */
  installed: (app: AppStoreApp) => boolean;
  /** On the desktop, each finished download's library save: under way, failed or done. */
  saving?: Readonly<Record<string, "saving" | "failed" | "saved">>;
  /** Saves a finished app to the library again, after a save failed. */
  retry?: (app: AppStoreApp) => void;
  /** Opens an installed app, where the store can (on the desktop, served by its Ferrite app). */
  open?: (app: AppStoreApp) => void;
  /** Shows an app's page. Given where the store sells the catalogue's apps, as are the two below. */
  details?: (app: AppStoreApp) => void;
  /** Takes an app out of the person's library. */
  uninstall?: (app: AppStoreApp) => void;
  /** Whether the person's library holds it, as an app that comes with the desktop is not. */
  inLibrary?: (app: AppStoreApp) => boolean;
}

/** An app's offer button: the offer, its confirmation, the download and the installed app. */
function Offer({ app, store }: { app: AppStoreApp; store: Store }) {
  const offer = store.offers[app.id];
  const press = () => store.dispatch({ type: "press", app });
  if (offer?.step === "downloading") {
    return (
      <StorePillButton
        progress={offer.progress}
        aria-label={`Stop downloading ${app.title}`}
        onClick={press}
      >
        Stop
      </StorePillButton>
    );
  }
  if (offer?.step === "confirm") {
    const title = confirmTitle(app);
    return (
      <StorePillButton
        variant="filled"
        aria-label={`${title}, ${app.title}`}
        onClick={press}
        // The confirmation is withdrawn when the keyboard focus moves on.
        onBlur={() => store.dispatch({ type: "revert", app })}
      >
        {title}
      </StorePillButton>
    );
  }
  // On the desktop a finished download is not installed until the library has saved it.
  const saving =
    store.saving && offer?.step === "open" ? (store.saving[app.id] ?? "saving") : undefined;
  if (saving === "saving") {
    return (
      <StorePillButton aria-label={`Installing ${app.title}`} disabled>
        Installing…
      </StorePillButton>
    );
  }
  if (saving === "failed") {
    const retry = store.retry;
    return (
      <StorePillButton
        variant="filled"
        aria-label={`Retry installing ${app.title}`}
        caption="Not Saved"
        onClick={retry ? () => retry(app) : undefined}
      >
        Retry
      </StorePillButton>
    );
  }
  const title = store.installed(app) ? "Open" : app.offer;
  const open = store.open;
  return (
    <StorePillButton
      aria-label={`${title}, ${app.title}`}
      caption={title !== "Open" && app.inAppPurchases ? "In-App Purchases" : undefined}
      onClick={title === "Open" && open ? () => open(app) : press}
    >
      {title}
    </StorePillButton>
  );
}

/** The menu of an app in a list. */
function AppMenuItems({ app, store, link }: { app: AppStoreApp; store: Store; link: string }) {
  const { open, details, uninstall } = store;
  const installed = store.installed(app);
  const downloading = store.offers[app.id]?.step === "downloading";
  return (
    <>
      {installed ? (
        <MenuItem disabled={!open} onClick={() => open?.(app)}>
          Open
        </MenuItem>
      ) : (
        <MenuItem
          disabled={downloading}
          onClick={() => store.dispatch({ type: "start", apps: [app] })}
        >
          {app.offer}
        </MenuItem>
      )}
      <MenuItem onClick={() => details?.(app)}>Show App Page</MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => void copyText(link)}>Copy Link</MenuItem>
      <Submenu>
        <SubmenuTrigger>Share</SubmenuTrigger>
        <SubmenuPopup>
          <LinkShareItems plain url={link} title={app.title} from="app-store" />
        </SubmenuPopup>
      </Submenu>
      {uninstall && store.inLibrary?.(app) ? (
        <>
          <MenuSeparator />
          <MenuItem onClick={() => uninstall(app)}>Uninstall</MenuItem>
        </>
      ) : null}
    </>
  );
}

/** One app of a list. On the desktop it opens its page, has a menu, and drags out as its link. */
function AppLockup({ app, store }: { app: AppStoreApp; store: Store }) {
  const artwork = <AppIcon id={app.id} glyph={app.glyph} colors={app.colors} />;
  const accessory = <Offer app={app} store={store} />;
  const id = catalogueId(app.id);
  const { details } = store;
  if (!details || !id) {
    return (
      <CardGridCard
        variant="lockup"
        title={app.title}
        subtitle={app.subtitle}
        artwork={artwork}
        accessory={accessory}
      />
    );
  }
  const link = appStoreLink(id);
  return (
    <ContextualMenu>
      <ContextualMenuTrigger
        draggable
        onDragStart={(event: DragEvent<HTMLDivElement>) => {
          event.dataTransfer.effectAllowed = "copy";
          event.dataTransfer.setData("text/uri-list", link);
          event.dataTransfer.setData("text/plain", link);
          // An installed app can be kept in the Dock, as one dragged out of Launchpad is.
          if (store.installed(app)) event.dataTransfer.setData(LAUNCHPAD_APP_DRAG, id);
        }}
      >
        <CardGridCard
          variant="lockup"
          title={
            <button
              type="button"
              className="mac-app-store-app-name"
              aria-label={`${app.title}, app page`}
            >
              {app.title}
            </button>
          }
          subtitle={app.subtitle}
          artwork={artwork}
          accessory={accessory}
          onClick={(event: MouseEvent<HTMLElement>) => {
            const target = event.target as Element;
            if (!target.closest(".mac-card-grid-card-accessory")) details(app);
          }}
        />
      </ContextualMenuTrigger>
      <ContextualMenuPopup aria-label={app.title}>
        <AppMenuItems app={app} store={store} link={link} />
      </ContextualMenuPopup>
    </ContextualMenu>
  );
}

/** A list of lockups under a header: one collection of the store. */
function Collection({
  title,
  apps,
  shown,
  action,
  separator = true,
  store,
}: {
  title: string;
  apps: readonly AppStoreApp[];
  shown?: number;
  action?: ReactNode;
  separator?: boolean;
  store: Store;
}) {
  const [expanded, setExpanded] = useState(false);
  const more = shown !== undefined && apps.length > shown;
  const listed = more && !expanded ? apps.slice(0, shown) : apps;
  return (
    <CardGrid
      title={title}
      separator={separator}
      minCardWidth={280}
      style={COLLECTION}
      action={
        action ??
        (more ? (
          <CardGridAction
            render={<button type="button" />}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "See Less" : "See All"}
          </CardGridAction>
        ) : undefined)
      }
    >
      {listed.map((app) => (
        <AppLockup key={app.id} app={app} store={store} />
      ))}
    </CardGrid>
  );
}

/**
 * A section's page: its title or its hero, its two stories and its collections. The hero and
 * the stories are the library's editorial card, with the demo's drawings as their artwork;
 * their titles are the page's level 2 headings.
 */
function StoriesPage({ name, page, store }: { name: string; page: AppStorePage; store: Store }) {
  return (
    <>
      {page.hero ? (
        <>
          <h1 className="mac-app-store-hidden">{name}</h1>
          <div className="mac-app-store-hero">
            <EditorialCard
              variant="hero"
              eyebrow={page.hero.eyebrow}
              title={page.hero.title}
              headingLevel={2}
              artwork={<HeroPicture id={page.hero.id} />}
            >
              {page.hero.body}
            </EditorialCard>
          </div>
        </>
      ) : (
        <h1 className="mac-app-store-title">{name}</h1>
      )}
      <CardGrid aria-label="Stories" minCardWidth={400} style={STORIES}>
        {page.stories.map((story) => (
          <EditorialCard
            key={story.id}
            eyebrow={story.eyebrow}
            title={story.title}
            headingLevel={2}
            artwork={<StoryArtwork id={story.id} artwork={story.artwork} />}
          >
            {story.body}
          </EditorialCard>
        ))}
      </CardGrid>
      {/* The collection's line is 36 pt under the story cards: the grid's 32 pt and these 4. */}
      <div className="mac-app-store-collections">
        {page.collections.map((collection) => (
          <Collection
            key={collection.id}
            title={collection.title}
            apps={appsOf(collection.apps)}
            shown={collection.shown}
            store={store}
          />
        ))}
      </div>
    </>
  );
}

/** The Categories page: every category as a button that lists its apps. */
function CategoriesPage({
  onChoose,
  categories = CATEGORIES.map((category) => ({
    name: category.name,
    glyph: category.glyph,
    colors: [category.color, category.color] as const,
    count: categoryCount(category.name),
  })),
}: {
  onChoose: (category: string) => void;
  categories?: readonly {
    name: string;
    glyph: AppStoreApp["glyph"];
    colors: AppStoreApp["colors"];
    count: number;
  }[];
}) {
  return (
    <>
      <h1 className="mac-app-store-title">Categories</h1>
      <CardGrid aria-label="Categories" minCardWidth={280} style={COLLECTION}>
        {categories.map((category) => {
          const count = category.count;
          return (
            <CardGridCard
              key={category.name}
              variant="lockup"
              render={<button type="button" />}
              onClick={() => onChoose(category.name)}
              title={category.name}
              subtitle={count === 1 ? "1 app" : `${count} apps`}
              artwork={<AppIcon glyph={category.glyph} colors={category.colors} />}
            />
          );
        })}
      </CardGrid>
    </>
  );
}

/**
 * A section's page when the store sells the Macalicious apps: the apps of the section the
 * session can get, then those it has. Updates lists those that wait for the current version, with
 * Update All, and the apps it has.
 */
function CataloguePage({
  name,
  apps,
  store,
  updates = false,
  updatesNote = "Every app is up to date.",
  version,
}: {
  name: string;
  apps: readonly AppStoreApp[];
  store: Store;
  updates?: boolean;
  /** What the Updates page says of the updates. */
  updatesNote?: string;
  /** The version an app that waits would take. */
  version?: string;
}) {
  const behind = apps.filter((app) => app.offer === "Update" && !store.installed(app));
  const waiting = behind.filter((app) => store.offers[app.id] === undefined);
  const offered = apps.filter((app) => !store.installed(app) && app.offer !== "Update");
  const installed = apps.filter(
    (app) => store.installed(app) || (app.offer === "Update" && !updates),
  );
  const stories = updates ? [] : storiesOfApps(apps, store.installed);
  return (
    <>
      <h1 className="mac-app-store-title">{name}</h1>
      {stories.length > 0 ? (
        <CardGrid aria-label="Stories" minCardWidth={400} style={STORIES}>
          {stories.map((story) => {
            const app = apps.find((each) => each.id === story.id);
            return (
              <EditorialCard
                key={story.id}
                render={<button type="button" />}
                eyebrow={story.eyebrow}
                title={story.title}
                artwork={<StoryArtwork artwork={story.artwork} />}
                onClick={() => app && store.details?.(app)}
              >
                {story.body}
              </EditorialCard>
            );
          })}
        </CardGrid>
      ) : null}
      {updates ? (
        <p className="mac-app-store-note">
          {behind.length > 0
            ? `${behind.length} ${behind.length === 1 ? "update waits" : "updates wait"} for you.`
            : updatesNote}
        </p>
      ) : null}
      {updates ? <AutomaticUpdatesNote /> : null}
      {updates && behind.length > 0 ? (
        <Collection
          title="Pending"
          apps={behind.map((app) => ({ ...app, subtitle: `Version ${version}` }))}
          separator={false}
          store={store}
          action={
            <CardGridAction
              render={<button type="button" disabled={waiting.length === 0} />}
              className="mac-app-store-action"
              onClick={() => store.dispatch({ type: "start", apps: waiting })}
            >
              Update All
            </CardGridAction>
          }
        />
      ) : null}
      {!updates && offered.length > 0 ? (
        <Collection title="Get More Apps" apps={offered} separator={false} store={store} />
      ) : null}
      {installed.length > 0 ? (
        <Collection
          title="Installed"
          apps={installed}
          separator={!updates && offered.length > 0}
          store={store}
        />
      ) : null}
    </>
  );
}

/** What an Updates page says of the Automatic Updates preference. */
function AutomaticUpdatesNote() {
  const automatic = useDesktopValue(APP_STORE_AUTO_UPDATES, readAutoUpdates, true);
  return (
    <p className="mac-app-store-note">
      {automatic
        ? "Automatic Updates is on: a new version of an app arrives by itself."
        : "Automatic Updates is off: updates wait here until you choose them."}
    </p>
  );
}

/** The Updates page: what waits for an update, with Update All, and what was updated. */
function UpdatesPage({ store }: { store: Store }) {
  const [pending, recent] = UPDATES as [AppStoreCollection, AppStoreCollection];
  const waiting = appsOf(pending.apps).filter((app) => store.offers[app.id] === undefined);
  return (
    <>
      <h1 className="mac-app-store-title">Updates</h1>
      <AutomaticUpdatesNote />
      <Collection
        title={pending.title}
        apps={appsOf(pending.apps)}
        separator={false}
        store={store}
        action={
          <CardGridAction
            render={<button type="button" disabled={waiting.length === 0} />}
            className="mac-app-store-action"
            onClick={() => store.dispatch({ type: "start", apps: waiting })}
          >
            Update All
          </CardGridAction>
        }
      />
      <Collection title={recent.title} apps={appsOf(recent.apps)} store={store} />
    </>
  );
}

/**
 * The results of a search: the apps whose name, line or category contains the text; for a category
 * chosen on the Categories page, the apps of that category.
 */
function ResultsPage({
  query,
  category,
  store,
  apps = APPS,
}: {
  query: string;
  /** A category chosen on the Categories page: the results are its apps, whatever their lines say. */
  category?: string;
  store: Store;
  apps?: readonly AppStoreApp[];
}) {
  const results =
    category === undefined
      ? apps.filter((app) => appMatches(app, query))
      : apps.filter((app) => app.category === category);
  return (
    <>
      <h1 className="mac-app-store-title">Results for “{query.trim()}”</h1>
      {results.length === 0 ? (
        <EmptyState role="status" className="mac-app-store-empty">
          No Results
        </EmptyState>
      ) : (
        <Collection
          title={results.length === 1 ? "1 App" : `${results.length} Apps`}
          apps={results}
          separator={false}
          store={store}
        />
      )}
    </>
  );
}

/** The account page: the apps got in this window, and the way out of the account. */
function AccountPage({
  store,
  onSignOut,
  purchased = APPS.filter((app) => store.offers[app.id]?.step === "open"),
  onUninstall,
  notice,
}: {
  store: Store;
  onSignOut: () => void;
  purchased?: readonly AppStoreApp[];
  /** Served by the desktop's Ferrite application: removes a got app from the person's library. */
  onUninstall?: (app: AppStoreApp) => void;
  /** What the page says of an Uninstall the server did not keep. */
  notice?: string;
}) {
  return (
    <>
      <h1 className="mac-app-store-title">Account</h1>
      <div className="mac-app-store-account-bar">
        <p className="mac-app-store-note">Signed in as {ACCOUNT_NAME}.</p>
        <PushButton onClick={onSignOut}>Sign Out</PushButton>
        <PushButton disabled title={NO_HIDDEN}>
          Hidden Purchases
        </PushButton>
        <PushButton disabled title={NO_GIFT}>
          Send Gift
        </PushButton>
      </div>
      {notice ? <p className="mac-app-store-note">{notice}</p> : null}
      {purchased.length === 0 ? (
        <p className="mac-app-store-note">Apps you get in this window are listed here.</p>
      ) : (
        <Collection title="Purchased" apps={purchased} store={store} />
      )}
      {onUninstall
        ? purchased.map((app) => (
            <div key={app.id} className="mac-app-store-account-bar">
              <p className="mac-app-store-note">
                {app.title}: in your Dock and Launchpad. Uninstalling keeps its data.
              </p>
              <PushButton aria-label={`Uninstall ${app.title}`} onClick={() => onUninstall(app)}>
                Uninstall
              </PushButton>
            </div>
          ))
        : null}
    </>
  );
}

/**
 * The App Store window of macOS 10.15: a full-height sidebar with the window controls, a
 * search field, the store's eight sections and the account button, and beside it the page of
 * the chosen section, with its hero, its story cards and its lists of apps with their offer
 * buttons. The Discover page repeats the words of the reference screenshot; everything else is
 * invented, and every picture is a stand-in drawing. Nothing is bought, downloaded or sent.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' callbacks go to that
 * part and the drag region's to the top of the sidebar.
 */
export function AppStore({
  section: sectionProp,
  defaultSection = "discover",
  onSectionChange,
  defaultScrollTop = 0,
  material = "translucent",
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 1246,
  height = 857,
  state = "key",
  className,
  ...windowProps
}: AppStoreProps) {
  const [ownSection, setOwnSection] = useState(defaultSection);
  const section = sectionProp ?? ownSection;
  const [query, setQuery] = useState("");
  /** The category chosen on the Categories page: its results are its own apps, not a text search. */
  const [chosenCategory, setChosenCategory] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  // The account page is no section of the sidebar: while it is shown no row is selected.
  const [account, setAccount] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [offers, dispatch] = useReducer(reduceOffers, {});
  const viewport = useRef<HTMLDivElement>(null);
  const searching = query.trim() !== "";
  const searchInput = useRef<HTMLInputElement>(null);
  const [top, setTop] = useState<HTMLDivElement | null>(null);
  const [history, setHistory] = useState(() =>
    startHistory({ section, query: "", category: null, account: false }),
  );
  // Back and Forward put a page where it was left, once it is drawn.
  const restoreScroll = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (restoreScroll.current === null || !viewport.current) return;
    viewport.current.scrollTop = restoreScroll.current;
    restoreScroll.current = null;
  });
  const [reloads, setReloads] = useState(0);
  const [updatesCheck, setUpdatesCheck] = useState<string>();

  // Served by the desktop's Ferrite application, the store sells the Macalicious apps from the
  // server's catalogue: a finished Get is kept in the session's library, which puts the app in
  // Launchpad and the Dock, and Open opens it. Until both have loaded the pages are inert.
  const served = servedByDesktopApp();
  const { catalogue, settled } = useCatalogue(served);
  const library = useAppLibrary(served);
  const host = use(DesktopWindowHostContext);
  const automaticUpdates = useDesktopValue(APP_STORE_AUTO_UPDATES, readAutoUpdates, true);
  const { versions, behind, take } = useAppVersions(
    served,
    served && !library.loading,
    library.installed,
    automaticUpdates,
  );
  const macApps = useMemo(
    () => (catalogue ? storeAppsOf(catalogue, library.installed, behind) : undefined),
    [catalogue, library.installed, behind],
  );
  const busy = served && (!settled || library.loading);
  // Served, but the catalogue could not be read: the store sells nothing rather than its invented
  // apps, whose Gets would look installed and never be kept.
  const unavailable = served && settled && !catalogue;
  // A finished download is installed only once the person's library holds it: until the save
  // succeeds the app shows Installing…, and if it fails, Retry. Only an offer that has just
  // become `open` is saved, so an offer left `open` from earlier never puts back an app that was
  // removed since (in Launchpad, another window or browser).
  const [saves, setSaves] = useState<Readonly<Record<string, "saving" | "failed" | "saved">>>({});
  // Each save is numbered per app, so the outcome of a save made before the app was removed
  // never settles a later installation.
  const saveTokens = useRef<Record<string, number>>({});
  // The library revision each failed save saw as it failed: only a later answer can settle it.
  const failedAt = useRef<Record<string, number>>({});
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const save = useCallback((app: AppStoreApp) => {
    const id = catalogueId(app.id);
    if (!id) return;
    const token = (saveTokens.current[app.id] ?? 0) + 1;
    saveTokens.current[app.id] = token;
    const settle = (outcome: "saved" | "failed") => {
      if (!mountedRef.current || saveTokens.current[app.id] !== token) return;
      if (outcome === "failed") {
        failedAt.current[app.id] = serverDocument(APP_STORE_LIBRARY_URL).revision();
      }
      setSaves((all) => ({ ...all, [app.id]: outcome }));
    };
    setSaves((all) => ({ ...all, [app.id]: "saving" }));
    addToLibrary(id).then(
      () => settle("saved"),
      () => settle("failed"),
    );
  }, []);
  const offersBefore = useRef(offers);
  useEffect(() => {
    if (!macApps) return;
    const was = offersBefore.current;
    offersBefore.current = offers;
    // An app that is no longer `open` (removed, here or elsewhere) forgets its save: a later Get
    // is installed only by its own save, and announced when that one succeeds.
    const left = Object.keys(saves).filter((id) => offers[id]?.step !== "open");
    if (left.length > 0) {
      for (const id of left) saveTokens.current[id] = (saveTokens.current[id] ?? 0) + 1;
      setSaves((all) => {
        const next = { ...all };
        for (const id of left) delete next[id];
        return next;
      });
    }
    for (const app of macApps) {
      if (offers[app.id]?.step === "open" && was[app.id]?.step !== "open") save(app);
    }
  }, [offers, macApps, save, saves]);
  // A download that has finished and is saved has taken the current version: a Get, or an Update.
  useEffect(() => {
    const done = Object.keys(saves).filter(
      (id) => saves[id] === "saved" && offers[id]?.step === "open",
    );
    const ids = done.flatMap((id) => catalogueId(id) ?? []);
    if (ids.length > 0) take(ids);
  }, [saves, offers, take]);
  // A finished download counts once its save is done; an app the library already held, as ever.
  const installedNow = (app: AppStoreApp) =>
    offers[app.id]?.step === "open" ? saves[app.id] === "saved" : isInstalled(app, offers);
  // The library holding a download whose save failed settles it, once the server has answered since
  // that failure (another window or browser saved it, or the held save went through): until then
  // the library shown is only this window's own hope. The button, Purchased and the announcement
  // all follow from this one record.
  // An answer that changes nothing shown renders nothing here, so a failure looks again each second.
  const [recheck, setRecheck] = useState(0);
  const anyFailed = Object.values(saves).includes("failed");
  useEffect(() => {
    if (!anyFailed) return;
    const timer = setInterval(() => setRecheck((now) => now + 1), 1000);
    return () => clearInterval(timer);
  }, [anyFailed]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `recheck` is the once-a-second look.
  useEffect(() => {
    if (!macApps) return;
    const revision = serverDocument(APP_STORE_LIBRARY_URL).revision();
    for (const app of macApps) {
      const id = catalogueId(app.id);
      const since = failedAt.current[app.id];
      if (saves[app.id] !== "failed" || since === undefined) continue;
      if (id && revision > since && library.installed.includes(id)) {
        saveTokens.current[app.id] = (saveTokens.current[app.id] ?? 0) + 1;
        setSaves((all) => ({ ...all, [app.id]: "saved" }));
      }
    }
  }, [library.installed, macApps, saves, recheck]);
  // An app that leaves the library (removed in Launchpad, in another window or browser) is
  // offered again here.
  const had = useRef<readonly string[]>(library.installed);
  useEffect(() => {
    const gone = had.current.filter((id) => !library.installed.includes(id));
    had.current = library.installed;
    for (const id of gone) {
      const app = macApps?.find((candidate) => candidate.id === storeId(id));
      if (app) dispatch({ type: "remove", app });
    }
  }, [library.installed, macApps]);

  // The pane opens scrolled as asked; the offset is read once.
  const scrollTop = useRef(defaultScrollTop);
  useLayoutEffect(() => {
    if (viewport.current && scrollTop.current > 0) viewport.current.scrollTop = scrollTop.current;
  }, []);

  // One timer moves every download, and only while there is one.
  const downloading = Object.entries(offers)
    .filter(([, offer]) => offer.step === "downloading")
    .map(([id]) => id);
  const loading = downloading.length > 0;
  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => dispatch({ type: "tick" }), DOWNLOAD_INTERVAL);
    return () => clearInterval(timer);
  }, [loading]);

  // What assistive technology hears of the downloads, which the ring only draws: the start of
  // each, the apps that have arrived (on the desktop, once the library holds them) and an app
  // whose save failed. One change may move several apps (Update All), and the announcement
  // names them all.
  const [announcement, setAnnouncement] = useState("");
  // Uninstall takes the app out of the library through the library's channel, which takes it
  // out of every window at once (and the effect above offers it again here). A save the server
  // did not keep is sent again with the library's next read; the page says so.
  const [uninstallNotice, setUninstallNotice] = useState<string>();
  const uninstall = (app: AppStoreApp) => {
    const id = catalogueId(app.id);
    if (!id) return;
    setUninstallNotice(undefined);
    removeFromLibrary(id).catch((error: unknown) => {
      if (!mountedRef.current) return;
      const notice =
        error instanceof LibraryUnreadable
          ? `${app.title} could not be uninstalled: your apps could not be read. Try again.`
          : `${app.title} is not uninstalled on the server yet: the change is sent again the next time this page reads your apps.`;
      setUninstallNotice(notice);
      setAnnouncement(notice);
    });
  };
  const before = useRef({ offers, saves });
  useEffect(() => {
    const was = before.current;
    before.current = { offers, saves };
    const started: string[] = [];
    const arrived: string[] = [];
    const failed: string[] = [];
    for (const app of macApps ?? APPS) {
      const step = offers[app.id]?.step;
      if (step === "downloading" && was.offers[app.id]?.step !== "downloading") {
        started.push(app.title);
      }
      // On the desktop an app arrives when the library has saved it; elsewhere when it is open.
      const arrives = macApps
        ? step === "open" && saves[app.id] === "saved" && was.saves[app.id] !== "saved"
        : step === "open" && was.offers[app.id]?.step !== "open";
      if (arrives) arrived.push(app.title);
      if (saves[app.id] === "failed" && was.saves[app.id] !== "failed") failed.push(app.title);
    }
    const sentences: string[] = [];
    if (started.length > 0) sentences.push(`Downloading ${listed(started)}`);
    if (arrived.length > 0) {
      sentences.push(`${listed(arrived)} ${arrived.length === 1 ? "is" : "are"} installed`);
    }
    if (failed.length > 0) {
      sentences.push(`${listed(failed)} could not be saved to your apps. Press Retry to try again`);
    }
    if (sentences.length > 0) setAnnouncement(sentences.join(". "));
  }, [offers, saves, macApps]);

  const show = (place: AppStorePlace) => {
    setQuery(place.query);
    setChosenCategory(place.category);
    setAccount(place.account);
    setProductId(place.app ?? null);
    if (place.section !== section) {
      setOwnSection(place.section);
      onSectionChange?.(place.section);
      if (served) changeDesktopValue(APP_STORE_SECTION, place.section);
    }
  };
  const navigate = (change: Partial<AppStorePlace>) => {
    const next = { section, query, category: chosenCategory, account, app: productId, ...change };
    const moved = visit(history, next, viewport.current?.scrollTop ?? 0);
    setHistory(moved);
    show(next);
    if (moved.at < history.at) restoreScroll.current = moved.entries[moved.at]?.scrollTop ?? 0;
    else if (viewport.current) viewport.current.scrollTop = 0;
  };
  const go = (by: -1 | 1) => {
    const moved = move(history, by, viewport.current?.scrollTop ?? 0);
    const place = moved.entries[moved.at];
    if (moved === history || !place) return;
    setHistory(moved);
    show(place);
    restoreScroll.current = place.scrollTop;
  };
  const choose = (next: string) => {
    if (isSection(next))
      navigate({ section: next, query: "", category: null, account: false, app: null });
  };
  const search = (text: string) => navigate({ query: text, category: null });
  /**
   * A category of the Categories page: its apps and no others, its name in the search field. (A text
   * search for the name would also list any app whose line mentions it.)
   */
  const chooseCategory = (name: string) => navigate({ query: name, category: name, app: null });
  const openAccount = () => {
    setSignedIn(true);
    navigate({ query: "", category: null, account: true, app: null });
  };
  const showProduct = (app: AppStoreApp) =>
    navigate({ query: "", category: null, account: false, app: app.id });

  // The person's last section, once the desktop's settings have said it: unless the person has
  // moved on by then, the store opens there.
  const keptSection = useDesktopValue(APP_STORE_SECTION, readKeptSection, null);
  const startedKept = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the settings' answer moves it.
  useEffect(() => {
    if (!served || sectionProp !== undefined || !keptSection || startedKept.current) return;
    startedKept.current = true;
    if (history.entries.length !== 1 || keptSection === section) return;
    setHistory(startHistory({ section: keptSection, query, category: null, account: false }));
    setOwnSection(keptSection);
  }, [keptSection]);

  // A link to an app's page, once the catalogue can say which app it is.
  const showProductNow = useRef(showProduct);
  showProductNow.current = showProduct;
  useEffect(() => {
    if (!macApps) return;
    const follow = () => {
      const id = takeAppPage();
      if (!id) return;
      const app = macApps.find((candidate) => candidate.id === storeId(id));
      if (app) showProductNow.current(app);
    };
    follow();
    return onAppPage(follow);
  }, [macApps]);
  const signOut = () => {
    setSignedIn(false);
    const forgotten = forgetAccount(history);
    const place = forgotten.entries[forgotten.at];
    setHistory(forgotten);
    if (place) show(place);
    if (place && account && !searching) restoreScroll.current = place.scrollTop;
  };
  /** Draws the page anew from what the server holds now. */
  const reload = () => {
    if (served) reloadServerDocuments("app-store");
    setReloads((count) => count + 1);
  };
  const checkForUpdates = () => {
    choose("updates");
    reload();
    if (!served) return;
    setUpdatesCheck("Checking for updates…");
    const say = (note: string) => {
      if (mountedRef.current) setUpdatesCheck(note);
    };
    sessionFetch(APPS_URL, { credentials: "same-origin" }).then(
      (reply) =>
        say(
          reply.ok
            ? `Every app is up to date. Last checked at ${new Date().toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}.`
            : "The App Store could not check for updates. Try again.",
        ),
      () => say("The App Store could not check for updates. Try again."),
    );
  };
  const focusSearch = () => {
    // A menu keeps the keyboard until it has closed.
    let frames = 0;
    const take = () => {
      if (!document.querySelector('[role="menu"]')) {
        searchInput.current?.focus();
        searchInput.current?.select();
      } else if (++frames < 60) {
        requestAnimationFrame(take);
      }
    };
    take();
  };

  // The store has no title bar: the strip over the sidebar moves the window.
  const dragRegion = windowDragRegion<HTMLDivElement>(
    onDragRegionPointerDown,
    onDragRegionDoubleClick,
  );

  const launch = host?.launch;
  const store: Store = {
    offers,
    dispatch,
    installed: macApps ? installedNow : (app) => isInstalled(app, offers),
    saving: macApps ? saves : undefined,
    retry: macApps ? save : undefined,
    open:
      macApps && launch
        ? (app) => {
            const id = catalogueId(app.id);
            if (id) launch(id);
          }
        : undefined,
    details: macApps ? showProduct : undefined,
    uninstall: macApps ? uninstall : undefined,
    inLibrary: (app) => library.installed.includes(catalogueId(app.id) ?? ""),
  };
  const name = SECTIONS.find((item) => item.id === section)?.name ?? "";
  const product = productId ? macApps?.find((app) => app.id === productId) : undefined;
  const productCatalogueId = product && catalogueId(product.id);
  const onSectionPage = !searching && !account && !product;

  const [editNote, setEditNote] = useState<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a note is about the page it was said on.
  useEffect(() => setEditNote(null), [history.at]);

  useAppStoreMenus({
    within: top,
    isKey: state === "key",
    canGoBack: history.at > 0,
    canGoForward: history.at < history.entries.length - 1,
    onUpdates: section === "updates" && onSectionPage,
    signedIn,
    goBack: () => go(-1),
    goForward: () => go(1),
    reload,
    focusSearch,
    openAccount,
    signOut,
    showUpdates: () => choose("updates"),
    checkForUpdates,
    say: setEditNote,
  });
  return (
    <Window
      aria-label="App Store"
      topHighlight
      width={width}
      height={height}
      state={state}
      className={className ? `mac-app-store ${className}` : "mac-app-store"}
      {...windowProps}
    >
      <SplitView className="mac-app-store-split" style={SPLIT}>
        <SplitViewPane size={220} className="mac-app-store-sidebar-pane">
          <div ref={setTop} className="mac-app-store-top" {...dragRegion}>
            <WindowControls
              className="mac-app-store-controls"
              onClose={onClose}
              onMinimize={onMinimize}
              onZoom={onZoom}
              zoomRole={zoomRole}
              minimizeDisabled={minimizeDisabled}
              zoomDisabled={zoomDisabled}
            />
            <SearchField
              variant="store"
              aria-label="Search"
              className="mac-app-store-search"
              style={SEARCH}
              inputRef={searchInput}
              value={query}
              onValueChange={(next) => search(next)}
            />
          </div>
          <Sidebar
            aria-label="Sections"
            className="mac-app-store-sidebar"
            material={material}
            style={SIDEBAR}
            value={onSectionPage ? section : null}
            onValueChange={choose}
            footer={
              // A borderless button whose image is the avatar with the name beside it: the
              // library's image button in its row layout, which draws the pressed look and
              // the focus ring. The row is 54 pt; the avatar ends 20 pt above the window's edge.
              <ImageButton
                layout="row"
                aria-pressed={signedIn ? account && !searching : undefined}
                style={{ flex: "none", alignItems: "flex-start", marginBottom: 13 }}
                onClick={openAccount}
              >
                <span className="mac-app-store-account">
                  <Avatar />
                  <span className="mac-app-store-account-name">
                    {signedIn ? ACCOUNT_NAME : "Sign In"}
                  </span>
                </span>
              </ImageButton>
            }
          >
            {SECTIONS.map((item) => (
              <SidebarItem
                key={item.id}
                value={item.id}
                label={<span className="mac-app-store-row-name">{item.name}</span>}
                icon={<SectionGlyph section={item.id} />}
                disabled={served && item.id === "arcade"}
                title={served && item.id === "arcade" ? NO_ARCADE : undefined}
                style={ROW}
              />
            ))}
          </Sidebar>
        </SplitViewPane>
        <SplitViewDivider disabled />
        <SplitViewPane className="mac-app-store-pane">
          <ScrollView className="mac-app-store-scroll" viewportProps={{ ref: viewport }}>
            <div
              className="mac-app-store-page"
              key={reloads}
              inert={busy || undefined}
              aria-busy={busy || undefined}
            >
              {editNote ? (
                <p className="mac-app-store-note" role="status">
                  {editNote}
                </p>
              ) : null}
              {unavailable ? (
                <>
                  <h1 className="mac-app-store-title">{name}</h1>
                  <EmptyState role="status" className="mac-app-store-empty">
                    The App Store Is Not Available
                  </EmptyState>
                </>
              ) : searching ? (
                <ResultsPage
                  query={query}
                  category={chosenCategory === query ? chosenCategory : undefined}
                  store={store}
                  apps={macApps}
                />
              ) : product && productCatalogueId ? (
                <AppStoreProduct
                  key={product.id}
                  app={product}
                  id={productCatalogueId}
                  icon={<AppIcon id={product.id} glyph={product.glyph} colors={product.colors} />}
                  offer={<Offer app={product} store={store} />}
                  installed={store.installed(product)}
                  link={appStoreLink(productCatalogueId)}
                  related={
                    <Collection
                      title="You Might Also Like"
                      apps={(macApps ?? [])
                        .filter((app) => app.category === product.category && app.id !== product.id)
                        .slice(0, RELATED_APPS)}
                      store={store}
                    />
                  }
                />
              ) : account ? (
                <AccountPage
                  store={store}
                  purchased={macApps?.filter((app) =>
                    store.offers[app.id]?.step === "open"
                      ? saves[app.id] === "saved"
                      : library.installed.includes(catalogueId(app.id) ?? ""),
                  )}
                  onSignOut={signOut}
                  onUninstall={macApps ? uninstall : undefined}
                  notice={uninstallNotice}
                />
              ) : section === "categories" ? (
                <CategoriesPage
                  onChoose={chooseCategory}
                  categories={
                    macApps
                      ? Object.values(CATALOGUE_CATEGORIES)
                          .map((category) => ({
                            ...category,
                            count: macApps.filter((app) => app.category === category.name).length,
                          }))
                          .filter((category) => category.count > 0)
                      : undefined
                  }
                />
              ) : macApps ? (
                <CataloguePage
                  key={section}
                  name={name}
                  apps={appsOfSection(macApps, section)}
                  store={store}
                  updates={section === "updates"}
                  updatesNote={updatesCheck}
                  version={versions.current}
                />
              ) : section === "updates" ? (
                <UpdatesPage store={store} />
              ) : (
                <StoriesPage key={section} name={name} page={PAGES[section]} store={store} />
              )}
            </div>
          </ScrollView>
        </SplitViewPane>
      </SplitView>
      <div role="status" className="mac-app-store-hidden">
        {announcement}
      </div>
    </Window>
  );
}
