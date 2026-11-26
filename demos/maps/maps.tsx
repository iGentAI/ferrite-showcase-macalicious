"use client";

import { ImageView } from "macalicious/image-view";
import { Label } from "macalicious/label";
import { MapButton, MapCompass, MapControls, MapZoomControl } from "macalicious/map-controls";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuCheckboxItem } from "macalicious/menu-item";
import {
  Popover,
  PopoverPopup,
  PopoverSeparator,
  PopoverTitle,
  PopoverTrigger,
} from "macalicious/popover";
import { PushButton } from "macalicious/push-button";
import { ScrollView } from "macalicious/scroll-view";
import { ShareMenu, ShareMenuItem } from "macalicious/share-menu";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { WindowTab, WindowTabBar } from "macalicious/window-tab-bar";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
  HeartGlyph,
  LocationGlyph,
  MAP_DESCRIPTION,
  MapDrawing,
  PHOTO_DESCRIPTION,
  PhotoPlaceholder,
  Pin,
  ServiceIcon,
  ShareGlyph,
  WeatherGlyph,
} from "./maps-artwork";
import {
  CAPTURED_CENTER,
  CAPTURED_WEATHER,
  CURRENT_LOCATION,
  defaultPlaces,
  MAX_ZOOM,
  type MapsMapType,
  type MapsPlace,
  type MapsPoint,
  type MapsWeather,
  MIN_ZOOM,
  REGIONS,
  scaleOf,
  searchPlaces,
} from "./maps-data";
import "./maps.tokens.css";
import "./maps.css";

export interface MapsProps extends Omit<WindowProps, "children"> {
  /**
   * The places the search finds.
   * @default defaultPlaces
   */
  places?: readonly MapsPlace[];
  /**
   * The text in the search field when the window opens.
   * @default "Apple Park"
   */
  defaultQuery?: string;
  /**
   * The place whose pin stands on the map when the window opens; `null` for none.
   * @default "apple-park"
   */
  defaultPlaceId?: string | null;
  /**
   * Whether that place's card is open when the window opens. The card is a popover: it takes
   * the keyboard and lies over the page, so a page that shows the window opens it on request.
   * @default false
   */
  defaultCardOpen?: boolean;
  /**
   * The map type selected in the toolbar when the window opens.
   * @default "map"
   */
  defaultMapType?: MapsMapType;
  /**
   * The point of the abstract map at the middle of the first tab's view.
   * @default CAPTURED_CENTER
   */
  defaultCenter?: MapsPoint;
  /**
   * The weather in the map's top trailing corner; `null` shows none.
   * @default CAPTURED_WEATHER
   */
  weather?: MapsWeather | null;
  /** Called with the place whose pin stands on the map when it changes; `null` for none. A
   * place of `places` that is replaced by one with other details counts as a change. */
  onPlaceChange?: (place: MapsPlace | null) => void;
  /** Called when a service of a Share menu is chosen, with its name and the place shown. */
  onShare?: (service: string, place: MapsPlace | null) => void;
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
  /** For the title bar: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: a window manager zooms the window here. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/** What one tab shows: a part of the map, at a zoom level, of a type, with its search. */
interface View {
  id: number;
  title: string;
  center: MapsPoint;
  zoom: number;
  mapType: MapsMapType;
  query: string;
  placeId: string | null;
  /** Whether the route to the place is drawn. */
  route: boolean;
  /** What the map says about the last search, or nothing. */
  note: string | null;
}

const MAP_TYPES: readonly { id: MapsMapType; title: string; width: number }[] = [
  // The widths of the Aqua capture's segments; each but the last includes its 1 pt divider.
  // Dark Aqua's are a point wider (--mac-maps-map-type-extra).
  { id: "map", title: "Map", width: 80 },
  { id: "transit", title: "Transit", width: 78 },
  { id: "satellite", title: "Satellite", width: 79 },
];

const SERVICES = ["Mail", "Messages", "Notes"] as const;

/**
 * Where a found place is put: 1 pt right of the view's middle and 62.5 pt above it, as in
 * the capture, which leaves its 600 pt card room above and below the pin.
 */
const PLACE_OFFSET = { x: -1, y: 62.5 };

/** The scale legend's bar is 60 pt; at zoom level 0 that is 500 ft of the abstract map. */
const SCALE_FEET = 500;

/**
 * The library's hooks, set where a stylesheet of the demo may not: on the elements. The card's
 * contents reach its edges, and its fill is the popover material without its translucency:
 * the captures' card is one flat colour over the map.
 */
const CARD_STYLE = {
  "--mac-popover-padding": "0px",
  "--mac-material-popover": "var(--mac-material-popover-opaque)",
} as CSSProperties;
/** The two buttons of the card's head hold a glyph: it takes the room of the title's padding. */
const GLYPH_BUTTON: CSSProperties = { paddingInline: 0 };
/** The Show pull-down is 107 pt wide and its title starts at its leading edge. */
const SHOW_STYLE: CSSProperties = { width: 107, justifyContent: "flex-start" };
/**
 * A tab that is not the last starts the width of the new-tab cell and its divider, 25 pt,
 * ahead of the last one, whose least width is its 44 pt of padding.
 */
const LEADING_TAB: CSSProperties = { flexBasis: 69 };

/** The scale legend's distance at a scale: 500 ft at 1, to the nearest 25 ft. */
function legend(scale: number): string {
  return `${Math.round(SCALE_FEET / scale / 25) * 25} ft`;
}

function centerOn(place: MapsPlace, zoom: number): MapsPoint {
  const scale = scaleOf(zoom);
  return {
    x: place.coordinate.x + PLACE_OFFSET.x / scale,
    y: place.coordinate.y + PLACE_OFFSET.y / scale,
  };
}

interface PlaceCardProps {
  place: MapsPlace;
  favorite: boolean;
  onFavoriteChange: (favorite: boolean) => void;
  onDirections: () => void;
  onShare: (service: string) => void;
}

/** The contents of a place card: the head with its two buttons, then what is known. */
function PlaceCard({ place, favorite, onFavoriteChange, onDirections, onShare }: PlaceCardProps) {
  return (
    <>
      <div className="mac-maps-card-head">
        <PushButton
          className="mac-maps-card-action"
          data-action="favorite"
          style={GLYPH_BUTTON}
          aria-label="Favorite"
          aria-pressed={favorite}
          onClick={() => onFavoriteChange(!favorite)}
        >
          <HeartGlyph filled={favorite} />
        </PushButton>
        <ShareMenu
          modal={false}
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
          {SERVICES.map((service, index) => (
            <ShareMenuItem
              key={service}
              image={<ServiceIcon tone={index as 0 | 1 | 2} />}
              onClick={() => onShare(service)}
            >
              {service}
            </ShareMenuItem>
          ))}
        </ShareMenu>
      </div>
      <PopoverSeparator aria-hidden="true" />
      <ScrollView className="mac-maps-card-scroll">
        <div className="mac-maps-card-content">
          <PopoverTitle className="mac-maps-card-title">{place.name}</PopoverTitle>
          <Label render={<p />} className="mac-maps-card-subtitle">
            {place.category} · {place.distance}
          </Label>
          <PushButton className="mac-maps-card-button" onClick={onDirections}>
            Directions
          </PushButton>
          {place.wikipedia ? (
            <>
              <div className="mac-maps-card-photos">
                {([0, 1, 2] as const).map((variant) => (
                  <ImageView
                    key={variant}
                    className="mac-maps-card-photo"
                    alt={PHOTO_DESCRIPTION}
                    scaling="axes-independently"
                  >
                    <PhotoPlaceholder variant={variant} className="mac-maps-photo" />
                  </ImageView>
                ))}
              </div>
              <Label
                render={<a href={place.wikipedia} target="_blank" rel="noreferrer" />}
                color="link"
                align="center"
                className="mac-maps-card-link"
                data-link="photos"
              >
                More Photos on <span className="mac-maps-card-wordmark">Wikipedia</span>
              </Label>
            </>
          ) : null}
          {/* A Mac places a call through an iPhone; the demo has none, as the captures. */}
          <PushButton className="mac-maps-card-button" data-button="call" disabled>
            Call
          </PushButton>
          {place.address ? (
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
              </section>
            </>
          ) : null}
          {place.website ? (
            <>
              <PopoverSeparator aria-hidden="true" className="mac-maps-card-line" />
              <section className="mac-maps-card-section">
                <h3 className="mac-maps-card-heading">Website</h3>
                <Label
                  render={<a href={place.website.href} target="_blank" rel="noreferrer" />}
                  color="link"
                  className="mac-maps-card-link"
                >
                  {place.website.title}
                </Label>
              </section>
            </>
          ) : null}
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
        </div>
      </ScrollView>
    </>
  );
}

/**
 * Whether two values of plain data, as a place is, say the same: the same values under the
 * same keys, in whatever order the keys were written.
 */
function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (key) =>
        key in b &&
        sameData((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  );
}

/**
 * The Maps window of macOS 10.15: a toolbar with Directions, the location button, a search
 * field, Share and the map types; a tab bar; and a map with a pin, its place card, the
 * weather, the Show pull-down, the compass and the zoom pair. The map is an abstract
 * placeholder of the demo's own and the places are a handful: nothing is fetched anywhere.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places, sizes and activates it; the window controls' and the title bar's
 * callbacks are handed to those parts.
 */
export function Maps({
  places = defaultPlaces,
  defaultQuery = "Apple Park",
  defaultPlaceId = "apple-park",
  defaultCardOpen = false,
  defaultMapType = "map",
  defaultCenter = CAPTURED_CENTER,
  weather = CAPTURED_WEATHER,
  onPlaceChange,
  onShare,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 1000,
  height = 690,
  ...windowProps
}: MapsProps) {
  const [tabs, setTabs] = useState<{ views: View[]; active: number; next: number }>(() => ({
    views: REGIONS.map((region, index) => ({
      id: index + 1,
      title: region.title,
      center: index === 0 ? defaultCenter : region.center,
      zoom: 0,
      mapType: index === 0 ? defaultMapType : "map",
      query: index === 0 ? defaultQuery : "",
      placeId: index === 0 ? defaultPlaceId : null,
      route: false,
      note: null,
    })),
    active: 1,
    next: REGIONS.length + 1,
  }));
  const [cardOpen, setCardOpen] = useState(defaultCardOpen);
  const [shown, setShown] = useState({ traffic: false, scale: false });
  const [pitched, setPitched] = useState(false);
  const [favorites, setFavorites] = useState<readonly string[]>([]);
  // The pin's ball, which the card points at. It is state and not a ref, so that a card
  // that is open when the window opens is placed once the pin is in the page.
  const [pinHead, setPinHead] = useState<HTMLSpanElement | null>(null);

  const view = tabs.views.find((item) => item.id === tabs.active) ?? (tabs.views[0] as View);
  const place = places.find((item) => item.id === view.placeId) ?? null;
  const scale = scaleOf(view.zoom);

  // The place whose pin stands on the map changes with a search, with the tab in front and
  // with the places that are given: whichever way it changed, the owner is told once. The
  // same place given again as another object is no change, so an owner may build the list
  // anew in every render.
  const reported = useRef(place);
  useEffect(() => {
    const last = reported.current;
    if (last === place) return;
    reported.current = place;
    if (!sameData(last, place)) onPlaceChange?.(place);
  }, [place, onPlaceChange]);

  /** Changes the view of the tab in front. A change takes the map's note away with it. */
  const change = (patch: Partial<View>) =>
    setTabs((current) => ({
      ...current,
      views: current.views.map((item) =>
        item.id === current.active ? { ...item, note: null, ...patch } : item,
      ),
    }));

  const showPlace = (next: MapsPlace | null, patch: Partial<View> = {}) => {
    change({ placeId: next?.id ?? null, route: false, ...patch });
    setCardOpen(next !== null);
  };

  /** Return in the search field: the best match gets the pin, the middle and its card. */
  const search = () => {
    if (view.query.trim() === "") return;
    const found = searchPlaces(places, view.query)[0];
    if (found) showPlace(found, { center: centerOn(found, view.zoom) });
    else showPlace(null, { note: "No Results Found" });
  };

  const selectTab = (id: number) => {
    setCardOpen(false);
    setTabs((current) => ({ ...current, active: id }));
  };
  const closeTab = (id: number) => {
    setCardOpen(false);
    setTabs((current) => {
      if (current.views.length < 2) return current;
      const at = current.views.findIndex((item) => item.id === id);
      const views = current.views.filter((item) => item.id !== id);
      // The tab after a closed front tab comes to the front, or else the one before it.
      const active =
        current.active === id ? (views[Math.min(at, views.length - 1)] as View).id : current.active;
      return { ...current, views, active };
    });
  };
  /** A new tab shows the same part of the map as the one in front, without its search. */
  const newTab = () => {
    setCardOpen(false);
    setTabs((current) => {
      const front = current.views.find((item) => item.id === current.active) as View;
      const added: View = {
        ...front,
        id: current.next,
        query: "",
        placeId: null,
        route: false,
        note: null,
      };
      return { views: [...current.views, added], active: added.id, next: current.next + 1 };
    });
  };

  const mapTitle = MAP_TYPES.find((type) => type.id === view.mapType)?.title ?? "Map";
  const dx = place ? scale * (place.coordinate.x - view.center.x) : 0;
  const dy = place ? scale * (place.coordinate.y - view.center.y) : 0;

  return (
    <Window aria-label="Maps" width={width} height={height} {...windowProps}>
      <TitleBar
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
            className="mac-maps-directions"
            pressed={view.route}
            disabled={place === null}
            focusableWhenDisabled
            onPressedChange={(route) => change({ route })}
          >
            Directions
          </ToolbarButton>
          <ToolbarSpace />
          <ToolbarButton
            className="mac-maps-locate"
            aria-label="Show Your Current Location"
            onClick={() => change({ center: CURRENT_LOCATION, note: "Current Location" })}
          >
            <LocationGlyph />
          </ToolbarButton>
          <ToolbarSearchField
            className="mac-maps-search"
            placeholder="Search for a place or address"
            value={view.query}
            onValueChange={(query) => change({ query })}
            onClear={() => showPlace(null)}
            onKeyDown={(event) => {
              if (event.key === "Enter") search();
            }}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <ShareMenu className="mac-maps-share">
            {SERVICES.map((service, index) => (
              <ShareMenuItem
                key={service}
                image={<ServiceIcon tone={index as 0 | 1 | 2} />}
                onClick={() => onShare?.(service, place)}
              >
                {service}
              </ShareMenuItem>
            ))}
          </ShareMenu>
          <ToolbarSegmentedControl
            aria-label="Map type"
            className="mac-maps-map-type"
            value={[view.mapType]}
            onValueChange={(value) => {
              if (value[0]) change({ mapType: value[0] as MapsMapType });
            }}
          >
            {MAP_TYPES.map((type) => (
              <ToolbarSegment
                key={type.id}
                value={type.id}
                style={{ width: `calc(${type.width}px + var(--mac-maps-map-type-extra))` }}
              >
                {type.title}
              </ToolbarSegment>
            ))}
          </ToolbarSegmentedControl>
        </Toolbar>
      </TitleBar>
      <WindowTabBar
        aria-label="Tabs"
        value={String(view.id)}
        onValueChange={(value) => selectTab(Number(value))}
        onNewTab={newTab}
      >
        {tabs.views.map((item, index) => (
          <WindowTab
            key={item.id}
            value={String(item.id)}
            // Maps divides the whole bar among its tabs and lets the new-tab cell take its
            // 25 pt from the last one: every tab but the last starts 25 pt ahead of it.
            style={index < tabs.views.length - 1 ? LEADING_TAB : undefined}
            onClose={tabs.views.length > 1 ? () => closeTab(item.id) : undefined}
          >
            {item.title}
          </WindowTab>
        ))}
      </WindowTabBar>
      <WindowBody background="content" className="mac-maps-body">
        <div
          className="mac-maps-map"
          data-map-type={view.mapType}
          data-traffic={shown.traffic ? "" : undefined}
          data-pitched={pitched ? "" : undefined}
        >
          <ImageView
            className="mac-maps-picture"
            alt={`${MAP_DESCRIPTION}. ${mapTitle} of ${view.title}, zoom ${Math.round(scale * 100)}%`}
            scaling="axes-independently"
          >
            <MapDrawing
              center={view.center}
              scale={scale}
              location={CURRENT_LOCATION}
              route={view.route && place ? [CURRENT_LOCATION, place.coordinate] : null}
            />
          </ImageView>
          {place ? (
            <Popover open={cardOpen} onOpenChange={setCardOpen}>
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    className="mac-maps-pin"
                    style={{ left: `calc(50% + ${dx}px)`, top: `calc(50% + ${dy}px)` }}
                  />
                }
              >
                <Pin />
                <span ref={setPinHead} className="mac-maps-pin-head" />
                <span className="mac-maps-pin-label">{place.name}</span>
              </PopoverTrigger>
              {/* The arrow's tip stops 4 pt short of the pin's ball. */}
              <PopoverPopup
                side="left"
                sideOffset={17}
                anchor={pinHead}
                className="mac-maps-card"
                style={CARD_STYLE}
              >
                <PlaceCard
                  place={place}
                  favorite={favorites.includes(place.id)}
                  onFavoriteChange={(favorite) =>
                    setFavorites((current) =>
                      favorite ? [...current, place.id] : current.filter((id) => id !== place.id),
                    )
                  }
                  onDirections={() => {
                    change({ route: true });
                    setCardOpen(false);
                  }}
                  onShare={(service) => onShare?.(service, place)}
                />
              </PopoverPopup>
            </Popover>
          ) : null}
          <div className="mac-maps-notes">
            <Label role="status" textStyle="small" className="mac-maps-note">
              {view.note}
            </Label>
            {shown.scale ? (
              <Label textStyle="mini" className="mac-maps-scale">
                {legend(scale)}
              </Label>
            ) : null}
          </div>
          {weather ? (
            // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend's layout; the group is named by its label
            <div role="group" aria-label="Weather" className="mac-maps-weather">
              <WeatherGlyph />
              <span className="mac-maps-temperature">{weather.temperature}°</span>
              <span className="mac-maps-air-quality">AQI {weather.airQuality}</span>
            </div>
          ) : null}
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
                <MenuCheckboxItem
                  checked={shown.traffic}
                  onCheckedChange={(traffic) => setShown((current) => ({ ...current, traffic }))}
                >
                  Traffic
                </MenuCheckboxItem>
                <MenuCheckboxItem checked={pitched} onCheckedChange={setPitched}>
                  3D Map
                </MenuCheckboxItem>
                <MenuCheckboxItem
                  checked={shown.scale}
                  onCheckedChange={(scaleShown) =>
                    setShown((current) => ({ ...current, scale: scaleShown }))
                  }
                >
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
            <MapCompass
              className="mac-maps-compass"
              pitched={pitched}
              onPitchedChange={setPitched}
            />
            <MapZoomControl
              onZoomIn={() => change({ zoom: Math.min(MAX_ZOOM, view.zoom + 1) })}
              onZoomOut={() => change({ zoom: Math.max(MIN_ZOOM, view.zoom - 1) })}
              zoomInDisabled={view.zoom >= MAX_ZOOM}
              zoomOutDisabled={view.zoom <= MIN_ZOOM}
            />
          </MapControls>
        </div>
      </WindowBody>
    </Window>
  );
}
