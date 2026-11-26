"use client";

import { BorderlessButton } from "macalicious/borderless-button";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { Label } from "macalicious/label";
import { MapButton, MapCompass, MapControls, MapZoomControl } from "macalicious/map-controls";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Popover, PopoverPopup, PopoverSeparator, PopoverTitle } from "macalicious/popover";
import { PushButton } from "macalicious/push-button";
import { ScrollView } from "macalicious/scroll-view";
import { ShareMenu } from "macalicious/share-menu";
import { Sidebar, SidebarItem, SidebarSection } from "macalicious/sidebar";
import { TextField } from "macalicious/text-field";
import { TitleBar } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import {
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useOpenItemRequests } from "../desktop/desktop-open-item";
import { openUrl } from "../desktop/desktop-open-url";
import {
  changeDesktopValue,
  desktopValuesLoaded,
  readBoolean,
  useDesktopSetting,
  useDesktopValue,
} from "../desktop/desktop-personal";
import { servedByDesktopApp, useServerState } from "../desktop/desktop-server";
import { copyText, LinkShareItems } from "../desktop/desktop-share-link";
import { Maps, type MapsProps } from "./maps";
import { HeartGlyph, LocationGlyph, Pin, ServiceIcon, ShareGlyph } from "./maps-artwork";
import { DirectionsPanel, RouteLine, useDirections } from "./maps-directions";
import {
  clampZoom,
  distanceBetween,
  fitView,
  formatDistance,
  type LatLon,
  MAX_ZOOM,
  type MapView,
  MIN_ZOOM,
  normalHeading,
  panBy,
  scaleLegend,
  turned,
  type Units,
  unitsFor,
  unproject,
} from "./maps-geo";
import { currentPosition, type Located } from "./maps-location";
import { useMapsMenus } from "./maps-menus";
import { onMapsDirections, onMapsSearch, takeMapsDirections, takeMapsSearch } from "./maps-open";
import {
  type DropPlace,
  dropPlaceOn,
  dropRows,
  dropRowsRefusal,
  rowOf,
  withoutRow,
  withoutRows,
} from "./maps-places-rows";
import { drawMap, exportMapPdf, printMap } from "./maps-print";
import {
  frameBesideList,
  MapsSearchList,
  type SearchListRow,
  searchListRowId,
} from "./maps-search-list";
import {
  addRecent,
  coordinateText,
  droppedPin,
  EMPTY_PLACES,
  isFavorite,
  MAX_FAVORITES,
  MAX_GUIDE_NAME,
  MAX_GUIDE_PLACES,
  MAX_GUIDES,
  osmLink,
  PLACES_URL,
  type PlacesDocument,
  placeSuggestions,
  placesDocumentFromServer,
  type RouteStep,
  reversePlace,
  type ServedPlace,
  searchPlaces,
  withFavorite,
  withGuidePlace,
} from "./maps-server";
import { TileMap } from "./maps-tiles";
import { MapWeather } from "./maps-weather-plate";
import "./maps.tokens.css";
import "./maps.css";
import "./maps-desktop.css";

/** Where a window opens when the person has no last view: Apple Park, the place of the demo's captures. */
export const START_VIEW: MapView = { center: { lat: 37.3349, lon: -122.009 }, zoom: 15 };
/** The zoom a found place is shown at, unless the map is already closer. */
const PLACE_ZOOM = 16;
/** The closest a route is framed at. */
const ROUTE_ZOOM = 17;
/** How long the map rests before its view is kept as the person's last: it moves many times a second under a drag. */
const KEEP_VIEW_MS = 400;

/** The desktop's settings Maps keeps for the person. */
const MAPS_VIEW = "maps.view";
const MAPS_HEADING = "maps.heading";
const MAPS_PANEL = "maps.panel";
const MAPS_SCALE = "maps.scale";

type Panel = "places" | "directions";
const readPanel = (stored: unknown): Panel | null | undefined =>
  stored === "places" || stored === "directions" || stored === null ? stored : undefined;

/** A kept heading, in degrees clockwise from north. */
export const readHeading = (stored: unknown): number | undefined =>
  typeof stored === "number" && Number.isFinite(stored) ? normalHeading(stored) : undefined;
/** How near north a turned map settles on it. */
const NORTH_SNAP = 4;
/** How far an arrow key on the compass turns the map. */
const HEADING_KEY_STEP = 15;
/** How far the pointer must go round the compass before a press is a turn and not a click. */
const TURN_START = 3;

/** A kept view: `{ lat, lon, zoom }`, on the globe. */
export function readView(stored: unknown): MapView | undefined {
  if (typeof stored !== "object" || stored === null) return undefined;
  const { lat, lon, zoom } = stored as Record<string, unknown>;
  if (typeof lat !== "number" || typeof lon !== "number" || typeof zoom !== "number")
    return undefined;
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180) || !Number.isFinite(zoom)) return undefined;
  return { center: { lat, lon }, zoom: clampZoom(zoom) };
}

/** The icons of a Share menu's rows. */
const SHARE_ICONS = {
  copy: <ServiceIcon tone={0} />,
  mail: <ServiceIcon tone={2} />,
  messages: <ServiceIcon tone={1} />,
  airdrop: <ServiceIcon tone={0} />,
  notes: <ServiceIcon tone={2} />,
  reminders: <ServiceIcon tone={1} />,
};

/** The card's fill and padding, through the popover's own hooks, as the demo sets them. */
const CARD_STYLE = {
  "--mac-popover-padding": "0px",
  "--mac-material-popover": "var(--mac-material-popover-opaque)",
} as CSSProperties;
const GLYPH_BUTTON: CSSProperties = { paddingInline: 0 };
const SHOW_STYLE: CSSProperties = { width: 107, justifyContent: "flex-start" };

const browserUnits = (): Units =>
  unitsFor(typeof navigator === "undefined" ? undefined : navigator.language);

/** A fresh id for a guide. */
const guideId = () => `guide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Whether a key event comes from a control that edits text, whose keys are its own. */
export const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable === true ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null);

interface CardProps {
  place: ServedPlace;
  distance: string | null;
  favorite: boolean;
  guides: PlacesDocument["guides"];
  /** Whether Favorite and Add to Guide may change the person's places: not before they load. */
  editable: boolean;
  onFavoriteChange: (favorite: boolean) => void;
  onGuideChange: (guideId: string, member: boolean) => void;
  onDirections: () => void;
  onCopied: (copied: boolean) => void;
  /** A row of the card's Share menu was chosen: the place has gone where it was sent. */
  onShared: () => void;
}

/** A served place's card: the demo's layout, with what OpenStreetMap knows of the place. */
function PlaceCard({
  place,
  distance,
  favorite,
  guides,
  editable,
  onFavoriteChange,
  onGuideChange,
  onDirections,
  onCopied,
  onShared,
}: CardProps) {
  const host = (() => {
    try {
      return place.website ? new URL(place.website).host.replace(/^www\./, "") : "";
    } catch {
      return "";
    }
  })();
  const subtitle = [place.category, distance].filter(Boolean).join(" · ");
  return (
    <>
      <div className="mac-maps-card-head">
        <PushButton
          className="mac-maps-card-action"
          data-action="favorite"
          style={GLYPH_BUTTON}
          aria-label="Favorite"
          aria-pressed={favorite}
          disabled={!editable}
          onClick={() => onFavoriteChange(!favorite)}
        >
          <HeartGlyph filled={favorite} />
        </PushButton>
        <ShareMenu
          modal={false}
          popupProps={{
            onClick: (event) => {
              const row = (event.target as Element).closest('[role="menuitem"]');
              if (row && row.getAttribute("aria-disabled") !== "true") onShared();
            },
          }}
          trigger={
            <PushButton
              className="mac-maps-card-action"
              data-action="share"
              style={GLYPH_BUTTON}
              aria-label="Share"
            >
              <ShareGlyph />
            </PushButton>
          }
        >
          <LinkShareItems
            url={osmLink(place)}
            title={place.name}
            from="maps"
            images={SHARE_ICONS}
            onCopied={onCopied}
          />
        </ShareMenu>
      </div>
      <PopoverSeparator aria-hidden="true" />
      <ScrollView className="mac-maps-card-scroll">
        <div className="mac-maps-card-content">
          <PopoverTitle className="mac-maps-card-title">{place.name}</PopoverTitle>
          {subtitle ? (
            <Label render={<p />} className="mac-maps-card-subtitle">
              {subtitle}
            </Label>
          ) : null}
          <PushButton
            className="mac-maps-card-button"
            data-button="directions"
            onClick={onDirections}
          >
            Directions
          </PushButton>
          <Menu>
            <MenuTrigger
              render={
                <PushButton
                  className="mac-maps-card-button"
                  data-button="guide"
                  disabled={!editable}
                >
                  Add to Guide
                </PushButton>
              }
            />
            <MenuPopup>
              {guides.length === 0 ? (
                <MenuItem disabled>No Guides: make one in the sidebar</MenuItem>
              ) : (
                guides.map((guide) => (
                  <MenuCheckboxItem
                    key={guide.id}
                    checked={guide.places.some((other) => other.id === place.id)}
                    onCheckedChange={(member) => onGuideChange(guide.id, member)}
                  >
                    {guide.name}
                  </MenuCheckboxItem>
                ))
              )}
            </MenuPopup>
          </Menu>
          {place.address.length > 0 ? (
            <section className="mac-maps-card-section" data-first="">
              <h3 className="mac-maps-card-heading">Address</h3>
              {place.address.map((line) => (
                <Label key={line} render={<p />} className="mac-maps-card-value" selectable>
                  {line}
                </Label>
              ))}
            </section>
          ) : null}
          {place.phone ? (
            <>
              <PopoverSeparator aria-hidden="true" className="mac-maps-card-line" />
              <section className="mac-maps-card-section">
                <h3 className="mac-maps-card-heading">Phone</h3>
                <Label render={<p />} className="mac-maps-card-value" selectable>
                  {place.phone}
                </Label>
                <Label
                  render={<a href={`tel:${place.phone.replace(/[^\d+]/g, "")}`} />}
                  color="link"
                  className="mac-maps-card-link"
                >
                  Call
                </Label>
              </section>
            </>
          ) : null}
          {place.website ? (
            <>
              <PopoverSeparator aria-hidden="true" className="mac-maps-card-line" />
              <section className="mac-maps-card-section">
                <h3 className="mac-maps-card-heading">Website</h3>
                <Label
                  render={<a href={place.website} target="_blank" rel="noreferrer" />}
                  color="link"
                  className="mac-maps-card-link"
                >
                  {host || place.website}
                </Label>
              </section>
            </>
          ) : null}
          <PopoverSeparator aria-hidden="true" className="mac-maps-card-line" />
          <section className="mac-maps-card-section">
            <h3 className="mac-maps-card-heading">Coordinates</h3>
            <Label render={<p />} className="mac-maps-card-value" selectable>
              {coordinateText(place)}
            </Label>
          </section>
          {place.wikipedia ? (
            <section className="mac-maps-card-section" data-row="">
              <h3 className="mac-maps-card-heading">Wikipedia</h3>
              <Label
                render={<a href={place.wikipedia} target="_blank" rel="noreferrer" />}
                color="link"
                className="mac-maps-card-link"
              >
                Open Wikipedia
              </Label>
            </section>
          ) : null}
          <section className="mac-maps-card-section" data-row="">
            <h3 className="mac-maps-card-heading">OpenStreetMap</h3>
            <Label
              render={<a href={osmLink(place)} target="_blank" rel="noreferrer" />}
              color="link"
              className="mac-maps-card-link"
            >
              Open Map
            </Label>
          </section>
        </div>
      </ScrollView>
    </>
  );
}

/** How far, in map pixels, a press on a dropped pin moves before it is a drag. */
const PIN_DRAG_START = 3;

/** The rows of the Places sidebar a drag can land beside, as it is over one. */
interface RowDrop {
  value: string;
  place: DropPlace;
}

/**
 * Maps as the desktop's Ferrite application serves it: OpenStreetMap's map, which can be dragged
 * and zoomed; search on Return (the module asks Nominatim); a pin and the place card for each
 * place found, and for a pin dropped from the context menu; directions between two places; the
 * person's Favorites, Recents and Guides, kept on the server; the browser's location; Share; and
 * the menu bar's commands for all of them (`maps-menus.tsx`). The person's last view, panel and
 * scale are kept for the next window.
 */
function ServedMaps({
  places: _places,
  defaultQuery: _defaultQuery,
  defaultPlaceId: _defaultPlaceId,
  defaultCardOpen: _defaultCardOpen,
  defaultMapType: _defaultMapType,
  defaultCenter: _defaultCenter,
  weather: _weather,
  onPlaceChange: _onPlaceChange,
  onShare: _onShare,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  onKeyDown,
  width = 1000,
  height = 690,
  ...windowProps
}: MapsProps) {
  // The person's last view and panel are where a window opens, until this window has its own.
  const keptView = useDesktopValue(MAPS_VIEW, readView, START_VIEW);
  const [ownView, setOwnView] = useState<MapView | null>(null);
  const view = ownView ?? keptView;
  const keptHeading = useDesktopValue(MAPS_HEADING, readHeading, 0);
  const [ownHeading, setOwnHeading] = useState<number | null>(null);
  const heading = ownHeading ?? keptHeading;
  // The click a turn of the compass ends in is not a click on its ring.
  const turnEnded = useRef(false);
  const keepHeading = (next: number) => {
    setOwnHeading(next);
    changeDesktopValue(MAPS_HEADING, next);
  };
  /** A press on the compass: going round it turns the map, and the end of the turn is kept. */
  const startTurn = (face: Element, press: { clientX: number; clientY: number }) => {
    const box = face.getBoundingClientRect();
    const angle = (at: { clientX: number; clientY: number }) =>
      (Math.atan2(at.clientX - (box.left + box.width / 2), box.top + box.height / 2 - at.clientY) *
        180) /
      Math.PI;
    const from = angle(press);
    const start = heading;
    let reached = start;
    let moved = false;
    const move = (event: PointerEvent) => {
      const by = angle(event) - from;
      if (!moved && Math.abs(by) < TURN_START) return;
      moved = true;
      reached = normalHeading(start - by, NORTH_SNAP);
      setOwnHeading(reached);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) return;
      keepHeading(reached);
      turnEnded.current = true;
      setTimeout(() => {
        turnEnded.current = false;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const keptNow = useRef(keptView);
  keptNow.current = keptView;
  const setView = (next: MapView | ((current: MapView) => MapView)) =>
    setOwnView((current) => (typeof next === "function" ? next(current ?? keptView) : next));
  const [keptPanel, keepPanel] = useDesktopSetting<Panel | null>(MAPS_PANEL, readPanel, null);
  const [ownPanel, setOwnPanel] = useState<Panel | null | undefined>(undefined);
  const panel = ownPanel === undefined ? keptPanel : ownPanel;
  const setPanel = (next: Panel | null) => {
    if (next !== "directions") directions.forget();
    setOwnPanel(next);
    keepPanel(next);
  };
  const [showScale, setShowScale] = useDesktopSetting(MAPS_SCALE, readBoolean, false);
  // Once the person's settings are read the window has its own view and panel, so that another
  // window moving its map does not move this one.
  useEffect(() => {
    if (!desktopValuesLoaded()) return;
    setOwnView((current) => current ?? keptView);
    setOwnPanel((current) => (current === undefined ? keptPanel : current));
  }, [keptView, keptPanel]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly ServedPlace[]>([]);
  const [selected, setSelected] = useState<ServedPlace | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [location, setLocation] = useState<Located | null>(null);
  const [doc, setDoc] = useState<PlacesDocument>(EMPTY_PLACES);
  const [pinHead, setPinHead] = useState<HTMLSpanElement | null>(null);
  const [droppedPlace, setDroppedPlace] = useState<ServedPlace | null>(null);
  const [titleBar, setTitleBar] = useState<HTMLElement | null>(null);
  // What the results answer, whether the list under the field is open, and the row the arrow keys
  // are on.
  const [searched, setSearched] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [listRow, setListRow] = useState(-1);
  const listId = useId();
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  // The map's size as of the latest render: a search's answer is framed for the map it arrives on.
  const mapSizeNow = useRef(mapSize);
  mapSizeNow.current = mapSize;
  const field = useRef<HTMLInputElement>(null);
  const [row, setRow] = useState<string | null>(null);
  // The rows chosen together by Command-click and Shift-click, and where a drag would land.
  const [marked, setMarked] = useState<readonly string[]>([]);
  const [rowDrop, setRowDrop] = useState<RowDrop | null>(null);
  const draggedRow = useRef<string | null>(null);
  const [guideName, setGuideName] = useState<string | null>(null);
  // The guide the name field renames; `null` while it names a new one.
  const [renaming, setRenaming] = useState<string | null>(null);
  // What the map's context menu acts on: a pin, or else the point under the pointer.
  const [menuAt, setMenuAt] = useState<LatLon | null>(null);
  const [menuPin, setMenuPin] = useState<ServedPlace | null>(null);
  const [chosenStep, setChosenStep] = useState<RouteStep | null>(null);
  // The dropped pin being dragged: how far, in the map's own pixels.
  const [pinDrag, setPinDrag] = useState<{ x: number; y: number } | null>(null);
  const pinGrab = useRef<{ x: number; y: number; scale: number; moved: boolean } | null>(null);
  const pinJustDragged = useRef(false);
  const units = useMemo(browserUnits, []);
  const directions = useDirections(view.center, (route) => {
    setChosenStep(null);
    setCardOpen(false);
    const { width, height } = mapSizeNow.current;
    if (route.path.length > 0) setView(fitView(route.path, width, height, ROUTE_ZOOM));
  });
  const route =
    panel === "directions" && directions.state.kind === "route" ? directions.state.route : null;

  // The view is kept once it rests, and when the window goes.
  const keepNow = useRef<(() => void) | null>(null);
  useEffect(() => {
    // A timer this view replaces has gone, and what it would have kept with it.
    keepNow.current = null;
    const stored = keptNow.current;
    if (
      !ownView ||
      (ownView.zoom === stored.zoom &&
        ownView.center.lat === stored.center.lat &&
        ownView.center.lon === stored.center.lon)
    )
      return;
    const keep = () => {
      keepNow.current = null;
      changeDesktopValue(MAPS_VIEW, { ...ownView.center, zoom: clampZoom(ownView.zoom) });
    };
    keepNow.current = keep;
    const timer = setTimeout(keep, KEEP_VIEW_MS);
    return () => clearTimeout(timer);
  }, [ownView]);
  useEffect(() => () => keepNow.current?.(), []);
  // The newest search or reverse lookup: an older answer, or one asked before the search was
  // cleared, opens no card and adds no recent.
  const searchAsk = useRef(0);
  // The newest dropped pin's lookup: one asked before Remove Pin brings no pin back.
  const dropAsk = useRef(0);
  // Places shown before the person's places were read, oldest first: added to the recents once
  // they are.
  const unrecorded = useRef<ServedPlace[]>([]);

  const placesLoading = useServerState<PlacesDocument>({
    url: PLACES_URL,
    enabled: true,
    value: doc,
    onLoad: (stored) => {
      const read = placesDocumentFromServer(stored);
      if (!read) return false;
      setDoc(read);
      return true;
    },
    toBody: (value) => ({
      favorites: value.favorites,
      recents: value.recents,
      guides: value.guides,
    }),
  });

  // Whether the person's places are still loading, as of the latest render: a search or a pin
  // that answers after they have loaded adds its recent at once, whenever it was asked.
  const loading = useRef(placesLoading);
  loading.current = placesLoading;

  /** Put `place` on the map with its card open, and at the front of the recents. */
  const show = (place: ServedPlace, { remember = true, move = true } = {}) => {
    rowKeepsKeyboard.current = false;
    setSelected(place);
    setCardOpen(true);
    if (move)
      setView((current) => ({
        center: place,
        zoom: Math.max(clampZoom(current.zoom), PLACE_ZOOM),
      }));
    if (!remember) return;
    // Before the person's places are read, a recent waits: the load would replace it.
    if (loading.current) unrecorded.current.push(place);
    else setDoc((current) => ({ ...current, recents: addRecent(current.recents, place) }));
  };

  useEffect(() => {
    if (placesLoading || unrecorded.current.length === 0) return;
    const waiting = unrecorded.current;
    unrecorded.current = [];
    setDoc((current) => ({
      ...current,
      recents: waiting.reduce((recents, place) => addRecent(recents, place), current.recents),
    }));
  }, [placesLoading]);

  /**
   * Show `place`, chosen by the person from the sidebar or a pin: any search or reverse lookup
   * still on its way is forgotten, so its answer cannot replace this choice.
   */
  const choose = (place: ServedPlace, options: { remember?: boolean; move?: boolean } = {}) => {
    searchAsk.current += 1;
    setSearching(false);
    setNote(null);
    show(place, options);
  };
  // A place asked for from Spotlight, once the document that holds it has been read.
  const [askedPlace, setAskedPlace] = useState<string | null>(null);
  useOpenItemRequests("maps", ({ id }) => setAskedPlace(id));
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new request or document opens it.
  useEffect(() => {
    const found = [
      ...doc.favorites,
      ...doc.recents,
      ...doc.guides.flatMap((each) => each.places),
    ].find((each) => each.id === askedPlace);
    if (!found) return;
    setAskedPlace(null);
    choose(found, { remember: false });
  }, [askedPlace, doc]);

  const search = async () => {
    const text = query.trim();
    if (text === "" || searching) return;
    await searchFor(text);
  };
  /** Search for what another app or a drop gave, in place of what the field holds. */
  const searchGiven = (given: string) => {
    // Not cut to the module's limit: a search too long is refused and says so, where a cut address
    // would quietly find somewhere else.
    const text = given.replace(/\s+/g, " ").trim();
    if (text === "") return;
    setQuery(text);
    void searchFor(text);
  };
  const searchFor = async (text: string) => {
    const ask = ++searchAsk.current;
    setSearching(true);
    setCardOpen(false);
    setListOpen(false);
    setListRow(-1);
    setNote(`Searching for “${text}”…`);
    const answer = await searchPlaces(text, view.center);
    if (ask !== searchAsk.current) return;
    setSearching(false);
    if (!answer.ok) {
      setNote(`Search failed: ${answer.message}`);
      return;
    }
    setResults(answer.value);
    setSearched(text);
    const first = answer.value[0];
    if (!first) {
      setSelected(null);
      setNote("No Results Found");
      return;
    }
    if (answer.value.length > 1) {
      setSelected(null);
      setNote(`${answer.value.length} places found`);
      const frame = frameBesideList(mapSizeNow.current.width, mapSizeNow.current.height);
      setView(
        panBy(fitView(answer.value, frame.width, frame.height, PLACE_ZOOM), -frame.offset, 0),
      );
      setListOpen(true);
      return;
    }
    setNote(null);
    show(first);
  };

  const clearSearch = () => {
    searchAsk.current += 1;
    setSearching(false);
    setQuery("");
    setResults([]);
    setSearched(null);
    setListOpen(false);
    setListRow(-1);
    setSelected(null);
    setCardOpen(false);
    setNote(null);
  };

  /** Ask the browser where it is, and move the map there. */
  const locate = async () => {
    setNote("Finding your location…");
    const answer = await currentPosition();
    if ("problem" in answer) {
      setNote(answer.problem);
      return;
    }
    setLocation(answer.at);
    setView((current) => ({ center: answer.at, zoom: Math.max(clampZoom(current.zoom), 15) }));
    setNote("Current Location");
  };

  const copied = (done: boolean) => setNote(done ? "Link Copied" : "The link could not be copied.");

  const copyLink = (place: ServedPlace) => {
    void copyText(osmLink(place)).then(copied);
  };

  /** Open the Directions panel and ask for a route to or from `place`. */
  const directionsWith = (place: ServedPlace, end: "to" | "from") => {
    setPanel("directions");
    directions[end](place);
  };
  const directionsNow = useRef(directionsWith);
  directionsNow.current = directionsWith;
  const searchNow = useRef(searchGiven);
  searchNow.current = searchGiven;
  useEffect(() => {
    const given = takeMapsSearch();
    if (given) searchNow.current(given);
    return onMapsSearch((text) => searchNow.current(text));
  }, []);
  useEffect(() => {
    const asked = takeMapsDirections();
    if (asked) directionsNow.current(asked, "to");
    return onMapsDirections((place) => directionsNow.current(place, "to"));
  }, []);

  /** The map on paper: as the window shows it now, with its pins and route. */
  const onPaper = () => {
    const style = getComputedStyle(document.documentElement);
    return drawMap({
      view: { center: view.center, zoom },
      heading,
      width: mapSize.width,
      height: mapSize.height,
      pins,
      route: route?.path ?? [],
      pinColor: style.getPropertyValue("--mac-color-system-red").trim() || "#ff3b30",
      routeColor: "#3478f6",
    });
  };
  const toPaper = (write: (canvas: HTMLCanvasElement) => void | Promise<void>) => {
    setNote("Preparing the map…");
    onPaper()
      .then(write)
      .then(() => setNote(null))
      .catch((error: unknown) =>
        setNote(`The map could not be prepared: ${error instanceof Error ? error.message : error}`),
      );
  };

  const dropPin = async (point: LatLon) => {
    const ask = ++searchAsk.current;
    const drop = ++dropAsk.current;
    // A search still under way is replaced by the pin: it no longer holds the search field.
    setSearching(false);
    setNote("Looking up the dropped pin…");
    const answer = await reversePlace(point);
    if (ask !== searchAsk.current || drop !== dropAsk.current) return;
    const found = answer.ok ? answer.value[0] : undefined;
    setNote(answer.ok ? null : `The address could not be looked up: ${answer.message}`);
    setResults([]);
    setSearched(null);
    setListOpen(false);
    // The pin stays where it was dropped: the lookup names it, from the nearest thing it knows.
    const pin = droppedPin(point);
    const place = found ? { ...found, id: pin.id, lat: pin.lat, lon: pin.lon } : pin;
    setDroppedPlace(place);
    show(place, { move: false });
  };

  const removePin = () => {
    dropAsk.current += 1;
    if (selected?.id === droppedPlace?.id) {
      setSelected(null);
      setCardOpen(false);
    }
    setDroppedPlace(null);
    setNote(null);
  };

  const zoomBy = (step: number) =>
    setView((current) => ({
      ...current,
      zoom: clampZoom(clampZoom(current.zoom) + step),
    }));

  /** Give the search field the keyboard, once a menu that keeps it until it closes has closed. */
  const find = () => {
    let frames = 0;
    const take = () => {
      const input = field.current;
      if (input && !document.querySelector('[role="menu"][data-open]')) input.select();
      if (document.activeElement !== input && ++frames < 30) requestAnimationFrame(take);
    };
    take();
  };

  const createGuide = () => {
    if (placesLoading) return;
    const name = (guideName ?? "").trim().slice(0, MAX_GUIDE_NAME);
    if (name === "") return;
    if (renaming !== null) {
      setDoc((current) => ({
        ...current,
        guides: current.guides.map((guide) => (guide.id === renaming ? { ...guide, name } : guide)),
      }));
      setRenaming(null);
      setGuideName(null);
      return;
    }
    if (doc.guides.length >= MAX_GUIDES) {
      setNote(`At most ${MAX_GUIDES} guides`);
      return;
    }
    setDoc((current) => ({
      ...current,
      guides: [...current.guides, { id: guideId(), name, places: [] }],
    }));
    setGuideName(null);
  };

  const selectedRow = rowOf(doc, row);
  const markedRows = marked.filter((value) => rowOf(doc, value) !== null);
  const several = markedRows.length > 1;
  const removeRow = () => {
    if (placesLoading) return;
    if (several) {
      setDoc((current) => withoutRows(current, markedRows));
      setMarked([]);
      setRow(null);
      return;
    }
    if (!selectedRow) return;
    setDoc((current) => withoutRow(current, selectedRow));
    setRow(null);
    setMarked([]);
  };
  /** What every row of the sidebar has: it drags, and shows being chosen and being landed on. */
  const rowProps = (value: string) => ({
    draggable: true,
    "data-marked": markedRows.includes(value) ? "" : undefined,
    "data-drop": rowDrop?.value === value ? rowDrop.place : undefined,
  });
  const rowUnder = (target: EventTarget) =>
    (target as Element).closest<HTMLElement>("[role='treeitem'][data-value]");
  // A row pressed shows on the map once the press ends in a click: a press that becomes a drag does
  // not open its place or add it to Recents.
  const pressingRow = useRef(false);
  const pressedRow = useRef<string | null>(null);
  // A row's own card leaves the keyboard with the rows: the arrows go on from there, Delete removes it.
  const rowKeepsKeyboard = useRef(false);
  const showRow = (value: string) => {
    const chosen = rowOf(doc, value);
    if (chosen && chosen.kind !== "guide") {
      choose(chosen.place, { remember: chosen.kind !== "recent" });
      rowKeepsKeyboard.current = true;
    }
  };
  const onRowMouseDown = (event: MouseEvent<HTMLElement>) => {
    const value = rowUnder(event.target)?.getAttribute("data-value");
    if (!value || event.button !== 0) return;
    pressedRow.current = null;
    if (!event.metaKey && !event.ctrlKey && !event.shiftKey) {
      pressingRow.current = true;
      pressedRow.current = value;
      // A press on one of the rows chosen together may be the start of dragging them: a click ends
      // the choice, in `onRowClick`.
      if (!markedRows.includes(value)) setMarked([]);
      return;
    }
    // Cancels the sidebar's own selecting of the row; the keyboard still comes to the list.
    event.preventDefault();
    event.currentTarget.focus();
    const base = markedRows.length > 0 ? markedRows : row ? [row] : [];
    if (event.shiftKey && row) {
      const shown = [...event.currentTarget.querySelectorAll("[role='treeitem'][data-value]")].map(
        (element) => element.getAttribute("data-value") as string,
      );
      const from = shown.indexOf(row);
      const to = shown.indexOf(value);
      setMarked(shown.slice(Math.min(from, to), Math.max(from, to) + 1));
    } else {
      const next = base.includes(value)
        ? base.filter((other) => other !== value)
        : [...base, value];
      // One row left is simply the row selected, which every command then acts on.
      if (next.length < 2) {
        setRow(next[0] ?? null);
        setMarked([]);
      } else setMarked(next);
    }
  };
  const onRowClick = () => {
    pressingRow.current = false;
    if (pressedRow.current) {
      setMarked([]);
      showRow(pressedRow.current);
    }
    pressedRow.current = null;
  };
  /** The rows a drag of `dragged` carries: all those chosen, when it is one of them. */
  const draggedTogether = (dragged: string) =>
    markedRows.includes(dragged) ? markedRows : [dragged];
  const onRowDragStart = (event: DragEvent<HTMLElement>) => {
    pressingRow.current = false;
    pressedRow.current = null;
    const value = rowUnder(event.target)?.getAttribute("data-value");
    const dragged = rowOf(doc, value ?? null);
    if (!value || !dragged) return;
    draggedRow.current = value;
    event.dataTransfer.effectAllowed = "copyMove";
    if (dragged.kind === "guide") {
      const name = doc.guides.find((guide) => guide.id === dragged.guideId)?.name ?? "";
      event.dataTransfer.setData("text/plain", name);
    } else {
      // Dropped outside Maps it is the place's name and link.
      event.dataTransfer.setData("text/uri-list", osmLink(dragged.place));
      event.dataTransfer.setData("text/plain", `${dragged.place.name} ${osmLink(dragged.place)}`);
    }
  };
  const onRowDragOver = (event: DragEvent<HTMLElement>) => {
    const dragged = draggedRow.current;
    const over = rowUnder(event.target);
    const value = over?.getAttribute("data-value");
    if (!dragged || !over || !value) return;
    const box = over.getBoundingClientRect();
    const place = dropPlaceOn(doc, dragged, value, event.clientY < box.top + box.height / 2);
    if (!place) {
      setRowDrop(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setRowDrop((now) => (now?.value === value && now.place === place ? now : { value, place }));
  };
  const onRowDrop = (event: DragEvent<HTMLElement>) => {
    const dragged = draggedRow.current;
    if (!dragged || !rowDrop) return;
    event.preventDefault();
    const refusal = dropRowsRefusal(doc, draggedTogether(dragged), rowDrop.value, rowDrop.place);
    if (refusal) setNote(refusal);
    else {
      setDoc((current) =>
        dropRows(current, draggedTogether(dragged), rowDrop.value, rowDrop.place),
      );
      setMarked([]);
    }
    setRowDrop(null);
  };
  const onRowDragEnd = () => {
    draggedRow.current = null;
    setRowDrop(null);
  };

  const zoom = clampZoom(view.zoom);
  const pins = useMemo(() => {
    const all = [...results];
    for (const place of [selected, droppedPlace]) {
      if (place && !all.some((other) => other.id === place.id)) all.push(place);
    }
    return all;
  }, [results, selected, droppedPlace]);
  const distance =
    selected && location ? formatDistance(distanceBetween(location, selected), units) : null;
  const legend = scaleLegend(view.center.lat, zoom, units);
  const status = note;
  const resultsListed = results.length > 1 && searched === query.trim();
  const listRows: readonly SearchListRow[] = !listOpen
    ? []
    : resultsListed
      ? results.map((place) => ({ place, detail: place.address[0] ?? place.category }))
      : placeSuggestions(doc, query).map(({ place, from }) => ({ place, detail: from }));
  const typedRow = listRows[listRow];

  /** Show a row of the list: a result leaves the list up and its pin beside it, a suggestion ends the typing. */
  const openListRow = (place: ServedPlace) => {
    setListRow(-1);
    if (resultsListed) {
      const { offset } = frameBesideList(mapSize.width, mapSize.height);
      choose(place, { move: false });
      setView((current) =>
        panBy({ center: place, zoom: Math.max(clampZoom(current.zoom), PLACE_ZOOM) }, -offset, 0),
      );
      return;
    }
    setQuery(place.name);
    setResults([]);
    setSearched(null);
    setListOpen(false);
    choose(place);
  };
  const menuKey = useMapsMenus({
    within: titleBar,
    say: setNote,
    hasPlace: selected !== null,
    shareUrl: selected ? osmLink(selected) : "",
    shareTitle: selected?.name ?? "",
    onCopied: copied,
    mapDrawn: mapSize.width > 0 && mapSize.height > 0,
    print: () => toPaper((canvas) => printMap(canvas, "Map")),
    exportPdf: () => toPaper((canvas) => exportMapPdf(canvas, "Map")),
    directionsShown: panel === "directions",
    toggleDirections: () => setPanel(panel === "directions" ? null : "directions"),
    hasDroppedPin: droppedPlace !== null,
    canZoomIn: zoom < MAX_ZOOM,
    canZoomOut: zoom > MIN_ZOOM,
    scaleShown: showScale,
    setScaleShown: setShowScale,
    find,
    dropPin: () => void dropPin(view.center),
    removePin,
    zoomIn: () => zoomBy(1),
    zoomOut: () => zoomBy(-1),
    goToCurrentLocation: () => void locate(),
  });

  return (
    <Window
      aria-label="Maps"
      width={width}
      height={height}
      {...windowProps}
      tabIndex={-1}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented && menuKey(event.nativeEvent)) event.preventDefault();
      }}
    >
      <TitleBar
        ref={setTitleBar}
        variant="title-hidden"
        divider="bar"
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      >
        <Toolbar aria-label="Toolbar" className="mac-maps-toolbar">
          <ToolbarButton
            className="mac-maps-places-button"
            pressed={panel === "places"}
            onPressedChange={(open) => setPanel(open ? "places" : null)}
          >
            Places
          </ToolbarButton>
          <ToolbarButton
            className="mac-maps-directions"
            pressed={panel === "directions"}
            onPressedChange={(open) => setPanel(open ? "directions" : null)}
          >
            Directions
          </ToolbarButton>
          <ToolbarSpace />
          <ToolbarButton
            className="mac-maps-locate"
            aria-label="Show Your Current Location"
            onClick={() => void locate()}
          >
            <LocationGlyph />
          </ToolbarButton>
          <ToolbarSearchField
            className="mac-maps-search"
            placeholder="Search for a place or address"
            inputRef={field}
            value={query}
            onValueChange={(value) => {
              // A search asked for other text no longer answers what is in the field.
              if (searching) {
                searchAsk.current += 1;
                setSearching(false);
                setNote(null);
              }
              setQuery(value);
              setListOpen(true);
              setListRow(-1);
            }}
            onClear={clearSearch}
            onPointerDown={() => setListOpen(true)}
            onBlur={() => {
              if (!resultsListed) setListOpen(false);
            }}
            aria-controls={listRows.length > 0 ? listId : undefined}
            aria-activedescendant={typedRow ? searchListRowId(listId, listRow) : undefined}
            onKeyDown={(event) => {
              if (listRows.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                event.preventDefault();
                const by = event.key === "ArrowDown" ? 1 : -1;
                const rows = listRows.length + 1;
                setListRow((now) => ((now + by + 1 + rows) % rows) - 1);
              } else if (listRows.length > 0 && event.key === "Escape") {
                event.preventDefault();
                setListOpen(false);
              } else if (event.key === "Enter") {
                if (typedRow) openListRow(typedRow.place);
                else void search();
              }
            }}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <ShareMenu className="mac-maps-share" disabled={selected === null}>
            {selected ? (
              <LinkShareItems
                url={osmLink(selected)}
                title={selected.name}
                from="maps"
                images={SHARE_ICONS}
                onCopied={copied}
              />
            ) : null}
          </ShareMenu>
        </Toolbar>
      </TitleBar>
      <WindowBody background="content" className="mac-maps-body">
        {panel === "directions" ? (
          <DirectionsPanel
            directions={directions}
            units={units}
            chosenStep={chosenStep}
            onChooseStep={(step) => {
              setChosenStep(step);
              setView((current) => ({
                center: step,
                zoom: Math.max(clampZoom(current.zoom), PLACE_ZOOM),
              }));
            }}
          />
        ) : null}
        {panel === "places" ? (
          <ContextualMenu>
            <ContextualMenuTrigger
              render={
                <Sidebar
                  aria-label="Places"
                  material="opaque"
                  className="mac-maps-sidebar"
                  inert={placesLoading || undefined}
                  aria-busy={placesLoading || undefined}
                  value={row}
                  onMouseDown={onRowMouseDown}
                  onClick={onRowClick}
                  onDragStart={onRowDragStart}
                  onDragOver={onRowDragOver}
                  onDrop={onRowDrop}
                  onDragEnd={onRowDragEnd}
                  onValueChange={(value) => {
                    setRow(value);
                    if (!pressingRow.current) {
                      // The arrow keys move on from what was chosen.
                      setMarked([]);
                      showRow(value);
                    }
                  }}
                  onKeyDown={(event) => {
                    pressingRow.current = false;
                    // Delete in the new guide's name field edits the name, not the list.
                    if (isEditable(event.target)) return;
                    if (
                      (event.key === "Delete" || event.key === "Backspace") &&
                      (selectedRow || several)
                    ) {
                      event.preventDefault();
                      removeRow();
                    }
                  }}
                  footer={
                    <div className="mac-maps-sidebar-actions">
                      {guideName !== null ? (
                        <TextField
                          className="mac-maps-guide-name"
                          aria-label="New guide name"
                          placeholder="Guide Name"
                          size="small"
                          value={guideName}
                          maxLength={MAX_GUIDE_NAME}
                          onValueChange={(value) => setGuideName(String(value))}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") createGuide();
                            if (event.key === "Escape") {
                              setGuideName(null);
                              setRenaming(null);
                            }
                          }}
                          autoFocus
                        />
                      ) : null}
                      <BorderlessButton
                        onClick={() => (guideName === null ? setGuideName("") : createGuide())}
                      >
                        New Guide
                      </BorderlessButton>
                      <BorderlessButton disabled={!selectedRow && !several} onClick={removeRow}>
                        {several ? `Remove ${markedRows.length}` : "Remove"}
                      </BorderlessButton>
                      <BorderlessButton
                        disabled={doc.recents.length === 0 || placesLoading}
                        onClick={() => setDoc((current) => ({ ...current, recents: [] }))}
                      >
                        Clear Recents
                      </BorderlessButton>
                    </div>
                  }
                >
                  <SidebarSection title="Favorites">
                    {doc.favorites.length === 0 ? (
                      <SidebarItem value="empty:favorites" label="No Favorites" disabled />
                    ) : (
                      doc.favorites.map((place) => (
                        <SidebarItem
                          key={place.id}
                          value={`favorite:${place.id}`}
                          label={place.name}
                          {...rowProps(`favorite:${place.id}`)}
                        />
                      ))
                    )}
                  </SidebarSection>
                  <SidebarSection title="Recents">
                    {doc.recents.length === 0 ? (
                      <SidebarItem value="empty:recents" label="No Recents" disabled />
                    ) : (
                      doc.recents.map((place) => (
                        <SidebarItem
                          key={place.id}
                          value={`recent:${place.id}`}
                          label={place.name}
                          {...rowProps(`recent:${place.id}`)}
                        />
                      ))
                    )}
                  </SidebarSection>
                  <SidebarSection title="Guides">
                    {doc.guides.length === 0 ? (
                      <SidebarItem value="empty:guides" label="No Guides" disabled />
                    ) : (
                      doc.guides.map((guide) => (
                        <SidebarItem
                          key={guide.id}
                          value={`guide:${guide.id}`}
                          label={guide.name}
                          accessory={String(guide.places.length)}
                          defaultExpanded
                          {...rowProps(`guide:${guide.id}`)}
                        >
                          {guide.places.map((place) => (
                            <SidebarItem
                              key={place.id}
                              value={`guide:${guide.id}:${place.id}`}
                              label={place.name}
                              {...rowProps(`guide:${guide.id}:${place.id}`)}
                            />
                          ))}
                        </SidebarItem>
                      ))
                    )}
                  </SidebarSection>
                </Sidebar>
              }
              onContextMenuCapture={(event) => {
                const value = (event.target as Element)
                  .closest<HTMLElement>("[data-value]")
                  ?.getAttribute("data-value");
                // Off a row there is nothing for the menu to act on.
                if (!value) {
                  event.preventDefault();
                  event.stopPropagation();
                } else {
                  // A menu on one of the rows chosen together acts on them all; on another it starts
                  // again from that row.
                  if (!markedRows.includes(value)) setMarked([]);
                  setRow(value);
                }
              }}
            />
            <ContextualMenuPopup aria-label="Place">
              {several ? null : selectedRow && selectedRow.kind !== "guide" ? (
                <>
                  <MenuItem
                    onClick={() =>
                      choose(selectedRow.place, { remember: selectedRow.kind !== "recent" })
                    }
                  >
                    Show on Map
                  </MenuItem>
                  <MenuItem onClick={() => directionsWith(selectedRow.place, "to")}>
                    Directions To Here
                  </MenuItem>
                  <MenuItem onClick={() => copyLink(selectedRow.place)}>Copy Link</MenuItem>
                  <MenuSeparator />
                </>
              ) : null}
              {!several && selectedRow?.kind === "guide" ? (
                <MenuItem
                  onClick={() => {
                    setRenaming(selectedRow.guideId);
                    setGuideName(
                      doc.guides.find((guide) => guide.id === selectedRow.guideId)?.name ?? "",
                    );
                  }}
                >
                  Rename Guide
                </MenuItem>
              ) : null}
              <MenuItem onClick={removeRow}>
                {several ? `Remove ${markedRows.length} Items` : "Remove"}
              </MenuItem>
            </ContextualMenuPopup>
          </ContextualMenu>
        ) : null}
        <div className="mac-maps-map" data-map-type="map">
          <ContextualMenu>
            <ContextualMenuTrigger
              render={<div className="mac-maps-map-menu" />}
              onDragOver={(event) => {
                // A row of the sidebar lands in the sidebar: this is for words from elsewhere.
                if (draggedRow.current || !event.dataTransfer.types.includes("text/plain")) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(event) => {
                if (draggedRow.current) return;
                event.preventDefault();
                // Dragged words may be a whole text: its first line is what is looked for.
                searchGiven(event.dataTransfer.getData("text/plain").split("\n")[0] ?? "");
              }}
              onContextMenuCapture={(event) => {
                const pin = (event.target as Element)
                  .closest<HTMLElement>("[data-place]")
                  ?.getAttribute("data-place");
                setMenuPin(pins.find((place) => place.id === pin) ?? null);
                const rect = event.currentTarget.getBoundingClientRect();
                const scale = rect.width > 0 ? mapSize.width / rect.width : 1;
                setMenuAt(
                  unproject(
                    turned(
                      {
                        x: (event.clientX - rect.left) * scale,
                        y: (event.clientY - rect.top) * scale,
                      },
                      heading,
                      mapSize.width,
                      mapSize.height,
                    ),
                    { center: view.center, zoom },
                    mapSize.width,
                    mapSize.height,
                  ),
                );
              }}
            >
              <TileMap
                view={view}
                heading={heading}
                onViewChange={setView}
                label={`Map, zoom ${zoom}${selected ? `, showing ${selected.name}` : ""}`}
                location={location}
                onPanStart={() => setCardOpen(false)}
                onSizeChange={setMapSize}
                onPointerDown={() => setListOpen(false)}
                attributionClassName={
                  listRows.length > 0 ? "mac-maps-attribution-below-list" : undefined
                }
              >
                {(layer) => (
                  <>
                    {route ? <RouteLine route={route} layer={layer} /> : null}
                    {pins.map((place) => {
                      const at = layer.project(place);
                      const chosen = place.id === selected?.id;
                      const dropped = place.id === droppedPlace?.id;
                      const shift = dropped && pinDrag ? pinDrag : { x: 0, y: 0 };
                      return (
                        <button
                          key={place.id}
                          type="button"
                          className="mac-maps-pin"
                          data-selected={chosen ? "" : undefined}
                          data-place={place.id}
                          aria-label={place.name}
                          // A dropped pin's drag moves it; any other pin drags out as its name and link.
                          draggable={dropped ? undefined : true}
                          onDragStart={
                            dropped
                              ? undefined
                              : (event) => {
                                  const link = osmLink(place);
                                  event.dataTransfer.effectAllowed = "copy";
                                  event.dataTransfer.setData("text/uri-list", link);
                                  event.dataTransfer.setData("text/plain", `${place.name} ${link}`);
                                }
                          }
                          style={{ left: at.x + shift.x, top: at.y + shift.y }}
                          onPointerDown={
                            dropped
                              ? (event) => {
                                  if (event.button !== 0) return;
                                  // The press moves this pin and does not pan the map under it.
                                  event.stopPropagation();
                                  event.currentTarget.setPointerCapture?.(event.pointerId);
                                  const box = event.currentTarget
                                    .closest(".mac-maps-map-menu")
                                    ?.getBoundingClientRect();
                                  pinJustDragged.current = false;
                                  pinGrab.current = {
                                    x: event.clientX,
                                    y: event.clientY,
                                    scale: box && box.width > 0 ? mapSize.width / box.width : 1,
                                    moved: false,
                                  };
                                }
                              : undefined
                          }
                          onPointerMove={
                            dropped
                              ? (event) => {
                                  const grab = pinGrab.current;
                                  if (!grab) return;
                                  const x = (event.clientX - grab.x) * grab.scale;
                                  const y = (event.clientY - grab.y) * grab.scale;
                                  if (!grab.moved && Math.hypot(x, y) < PIN_DRAG_START) return;
                                  grab.moved = true;
                                  setPinDrag({ x, y });
                                }
                              : undefined
                          }
                          onPointerUp={
                            dropped
                              ? () => {
                                  const grab = pinGrab.current;
                                  if (grab?.moved && pinDrag) {
                                    void dropPin(
                                      unproject(
                                        turned(
                                          { x: at.x + pinDrag.x, y: at.y + pinDrag.y },
                                          heading,
                                          mapSize.width,
                                          mapSize.height,
                                        ),
                                        { center: view.center, zoom },
                                        mapSize.width,
                                        mapSize.height,
                                      ),
                                    );
                                  }
                                  pinGrab.current = null;
                                  pinJustDragged.current = grab?.moved === true;
                                  setPinDrag(null);
                                }
                              : undefined
                          }
                          onPointerCancel={
                            dropped
                              ? () => {
                                  pinGrab.current = null;
                                  setPinDrag(null);
                                }
                              : undefined
                          }
                          onLostPointerCapture={
                            dropped
                              ? () => {
                                  // After a pointer up no grab is left; otherwise the gesture was
                                  // taken away, and the pin stays where it stood.
                                  if (!pinGrab.current) return;
                                  pinGrab.current = null;
                                  setPinDrag(null);
                                }
                              : undefined
                          }
                          onClick={() => {
                            // The click that ends a drag has already moved the pin.
                            const ended = pinJustDragged.current;
                            pinJustDragged.current = false;
                            if (!ended) choose(place, { move: false });
                          }}
                        >
                          <Pin />
                          {chosen ? <span ref={setPinHead} className="mac-maps-pin-head" /> : null}
                          {chosen ? (
                            <span className="mac-maps-pin-label" aria-hidden="true">
                              {place.name}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </>
                )}
              </TileMap>
            </ContextualMenuTrigger>
            {/* A press in the menu reaches the map through React: it is no drag. */}
            <ContextualMenuPopup aria-label="Map" data-map-control="">
              {menuPin ? (
                <>
                  <MenuItem onClick={() => choose(menuPin, { move: false })}>Show Info</MenuItem>
                  <MenuItem onClick={() => directionsWith(menuPin, "to")}>
                    Directions To Here
                  </MenuItem>
                  <MenuItem onClick={() => directionsWith(menuPin, "from")}>
                    Directions From Here
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    disabled={placesLoading}
                    onClick={() =>
                      setDoc((current) =>
                        withFavorite(current, menuPin, !isFavorite(current, menuPin)),
                      )
                    }
                  >
                    {isFavorite(doc, menuPin) ? "Remove from Favorites" : "Add to Favorites"}
                  </MenuItem>
                  <MenuItem onClick={() => copyLink(menuPin)}>Copy Link</MenuItem>
                  {menuPin.id === droppedPlace?.id ? (
                    <>
                      <MenuSeparator />
                      <MenuItem onClick={removePin}>Remove Pin</MenuItem>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <MenuItem onClick={() => menuAt && void dropPin(menuAt)}>Drop Pin</MenuItem>
                  <MenuItem onClick={() => menuAt && directionsWith(droppedPin(menuAt), "to")}>
                    Directions To Here
                  </MenuItem>
                  <MenuItem onClick={() => menuAt && directionsWith(droppedPin(menuAt), "from")}>
                    Directions From Here
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    onClick={() => {
                      if (menuAt)
                        openUrl(
                          `https://www.openstreetmap.org/fixthemap?lat=${menuAt.lat.toFixed(5)}&lon=${menuAt.lon.toFixed(5)}&zoom=${zoom}`,
                          "maps",
                        );
                    }}
                  >
                    Report an Issue
                  </MenuItem>
                </>
              )}
            </ContextualMenuPopup>
          </ContextualMenu>
          {listRows.length > 0 ? (
            <MapsSearchList
              id={listId}
              label={resultsListed ? "Search Results" : "Suggestions"}
              rows={listRows}
              chosen={listRow}
              shownId={selected?.id}
              mapWidth={mapSize.width}
              onOpen={openListRow}
            />
          ) : null}
          <MapWeather center={view.center} zoom={view.zoom} />
          {selected ? (
            <Popover open={cardOpen && pinHead !== null} onOpenChange={setCardOpen}>
              <PopoverPopup
                side="left"
                sideOffset={17}
                anchor={pinHead}
                initialFocus={rowKeepsKeyboard.current ? false : undefined}
                className="mac-maps-card"
                style={CARD_STYLE}
              >
                <PlaceCard
                  place={selected}
                  distance={distance}
                  favorite={isFavorite(doc, selected)}
                  guides={doc.guides}
                  editable={!placesLoading}
                  onFavoriteChange={(favorite) => {
                    if (placesLoading) return;
                    if (favorite && doc.favorites.length >= MAX_FAVORITES) {
                      setNote(
                        `Favorites holds at most ${MAX_FAVORITES} places. Remove one to add ${selected.name}.`,
                      );
                      return;
                    }
                    setDoc((current) => withFavorite(current, selected, favorite));
                  }}
                  onGuideChange={(id, member) => {
                    if (placesLoading) return;
                    const guide = doc.guides.find((item) => item.id === id);
                    if (member && guide && guide.places.length >= MAX_GUIDE_PLACES) {
                      setNote(
                        `${guide.name} holds at most ${MAX_GUIDE_PLACES} places. Remove one to add ${selected.name}.`,
                      );
                      return;
                    }
                    setDoc((current) => withGuidePlace(current, id, selected, member));
                  }}
                  onDirections={() => {
                    setCardOpen(false);
                    directionsWith(selected, "to");
                  }}
                  onCopied={copied}
                  onShared={() => setCardOpen(false)}
                />
              </PopoverPopup>
            </Popover>
          ) : null}
          <div className="mac-maps-notes">
            <Label role="status" textStyle="small" className="mac-maps-note">
              {status}
            </Label>
            {showScale ? (
              <Label textStyle="mini" className="mac-maps-scale" style={{ width: legend.pixels }}>
                {legend.label}
              </Label>
            ) : null}
          </div>
          <MapControls placement="none" aria-label="Map options" className="mac-maps-options">
            <Menu>
              <MenuTrigger
                render={
                  <MapButton chevron style={SHOW_STYLE}>
                    Show
                  </MapButton>
                }
              />
              <MenuPopup align="start" sideOffset={3}>
                <MenuCheckboxItem checked={showScale} onCheckedChange={setShowScale}>
                  Scale
                </MenuCheckboxItem>
              </MenuPopup>
            </Menu>
          </MapControls>
          <MapControls
            placement="none"
            orientation="vertical"
            aria-label="Map controls"
            className="mac-maps-controls"
          >
            {/* Dragged round, the compass turns the map; its ring, clicked, faces north. OpenStreetMap's tiles have no 3D. */}
            <MapCompass
              className="mac-maps-compass"
              pitchDisabled
              heading={heading}
              onNorthUp={() => {
                if (!turnEnded.current) keepHeading(0);
              }}
              onPointerDown={(event) => {
                if (event.button === 0) startTurn(event.currentTarget, event);
              }}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                keepHeading(
                  normalHeading(
                    heading + (event.key === "ArrowLeft" ? HEADING_KEY_STEP : -HEADING_KEY_STEP),
                  ),
                );
              }}
            />
            <MapZoomControl
              onZoomIn={() => zoomBy(1)}
              onZoomOut={() => zoomBy(-1)}
              zoomInDisabled={zoom >= MAX_ZOOM}
              zoomOutDisabled={zoom <= MIN_ZOOM}
            />
          </MapControls>
        </div>
      </WindowBody>
    </Window>
  );
}

/**
 * Maps as the desktop shows it. When the `macalicious-desktop` Ferrite application serves the
 * desktop, the window shows OpenStreetMap's real map with search, place cards,
 * Favorites, Recents and Guides kept for the person, and sharing in Messages
 * (`ServedMaps`). Every other build, the documentation included, shows the demo over its
 * abstract drawing, as `Maps` does, and asks no server anything.
 */
export function DesktopMaps(props: MapsProps) {
  return servedByDesktopApp() ? <ServedMaps {...props} /> : <Maps {...props} />;
}
