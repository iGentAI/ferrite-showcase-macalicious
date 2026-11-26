"use client";

import { desktopValues } from "../desktop/desktop-personal";
import { sessionFetch, withDeadline } from "../desktop/desktop-server";
import type { LatLon } from "./maps-geo";
import { currentPosition } from "./maps-location";

/**
 * The weather as the desktop's server reads it from Open-Meteo (`ferrite-apps/desktop/src/apps/
 * weather`), and the places it is asked for: the ones the person chose, kept with their settings, or
 * where the browser says it is, only once the person has let it. Notification Center, Maps, Siri
 * and Spotlight all read it here. A reading that is not there is a `problem`, never a value.
 */

export const WEATHER_URLS = {
  forecast: "/api/weather/forecast",
  places: "/api/weather/places",
} as const;

/** The places chosen in the Weather widget. */
export const WEATHER_PLACES = "weather.places";
/** Whether the person asked for the weather where they are. */
export const WEATHER_HERE = "weather.useLocation";
/** Language & Region's temperature, which the pane keeps under this key. */
export const TEMPERATURE_UNIT = "language-and-region.temperature";

export type TemperatureUnit = "celsius" | "fahrenheit";

export interface ForecastDay {
  date: string;
  high_c: number;
  low_c: number;
  condition: string;
}

export interface Forecast {
  temperature_c: number;
  condition: string;
  /** The source's local time at the place: `2026-11-06T23:30`. */
  observed: string;
  days: readonly ForecastDay[];
  source: string;
}

export interface WeatherPlace extends LatLon {
  name: string;
  region?: string;
  country?: string;
}

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const OBSERVED = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function dayFromServer(body: unknown): ForecastDay | null {
  const { date, high_c, low_c, condition } = (body ?? {}) as Record<string, unknown>;
  return typeof date === "string" &&
    isNumber(high_c) &&
    isNumber(low_c) &&
    typeof condition === "string"
    ? { date, high_c, low_c, condition }
    : null;
}

/** The server's forecast, or `null` when it does not have that shape. */
export function forecastFromServer(body: unknown): Forecast | null {
  const { temperature_c, condition, observed, days, source } = (body ?? {}) as Record<
    string,
    unknown
  >;
  if (
    !isNumber(temperature_c) ||
    typeof condition !== "string" ||
    typeof observed !== "string" ||
    !OBSERVED.test(observed) ||
    typeof source !== "string" ||
    !Array.isArray(days)
  ) {
    return null;
  }
  const read = days.map(dayFromServer);
  return read.includes(null)
    ? null
    : {
        temperature_c,
        condition,
        observed,
        source,
        days: read as ForecastDay[],
      };
}

function placeFromServer(body: unknown): WeatherPlace | null {
  const { name, region, country, lat, lon } = (body ?? {}) as Record<string, unknown>;
  return typeof name === "string" && isNumber(lat) && isNumber(lon)
    ? {
        name,
        lat,
        lon,
        ...(typeof region === "string" ? { region } : {}),
        ...(typeof country === "string" ? { country } : {}),
      }
    : null;
}

/** The server's places, or `null` when it does not have that shape. */
export function placesFromServer(body: unknown): readonly WeatherPlace[] | null {
  const places = (body as { places?: unknown } | null)?.places;
  if (!Array.isArray(places)) return null;
  const read = places.map(placeFromServer);
  return read.includes(null) ? null : (read as WeatherPlace[]);
}

/** The places kept in the person's settings. */
export const readWeatherPlaces = (stored: unknown): readonly WeatherPlace[] | undefined =>
  Array.isArray(stored) ? stored.map(placeFromServer).filter((place) => place !== null) : undefined;

export const readTemperatureUnit = (stored: unknown): TemperatureUnit | undefined =>
  stored === "celsius" || stored === "fahrenheit" ? stored : undefined;

/** Language & Region's temperature; a person who never chose has the pane's first choice. */
const unitNow = (): TemperatureUnit =>
  readTemperatureUnit(desktopValues()[TEMPERATURE_UNIT]) ?? "fahrenheit";

/** Whole degrees in the person's unit: `7°`. */
export const degrees = (celsius: number, unit: TemperatureUnit = unitNow()) =>
  `${Math.round(unit === "celsius" ? celsius : (celsius * 9) / 5 + 32)}°`;

/** The source and the time of a reading: `Open-Meteo, as of 11:30 PM local time`. */
export function sourceText(forecast: Pick<Forecast, "source" | "observed">): string {
  const hour = Number(forecast.observed.slice(11, 13));
  const minute = forecast.observed.slice(14, 16);
  return `${forecast.source}, as of ${hour % 12 || 12}:${minute} ${hour < 12 ? "AM" : "PM"} local time`;
}

/** `Sat`, for a date of the forecast, whatever the browser's zone. */
export const dayName = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" });

const UNREACHED = "The desktop's server did not answer.";

async function readJson<T>(
  url: string,
  read: (body: unknown) => T | null,
): Promise<{ read: T } | { problem: string }> {
  try {
    return await withDeadline(async (signal) => {
      const response = await sessionFetch(url, { credentials: "same-origin", signal });
      const body = await response.json().catch(() => null);
      const value = response.ok ? read(body) : null;
      if (value !== null) return { read: value };
      const { error, unavailable } = (body ?? {}) as { error?: unknown; unavailable?: unknown };
      const said = error ?? unavailable;
      return { problem: typeof said === "string" ? said : "The weather service gave no answer." };
    });
  } catch {
    return { problem: UNREACHED };
  }
}

/** The forecast at a point, or why there is none. Never throws. */
export const readForecast = (at: LatLon) =>
  readJson(`${WEATHER_URLS.forecast}?lat=${at.lat}&lon=${at.lon}`, forecastFromServer);

/** The places a name finds, or why there are none. Never throws. */
export const findWeatherPlaces = (name: string) =>
  readJson(`${WEATHER_URLS.places}?q=${encodeURIComponent(name)}`, placesFromServer);

/** Where the browser is, only when the person has already let this page know. */
export async function locationIfGranted(): Promise<LatLon | null> {
  if (typeof navigator === "undefined" || !navigator.permissions) return null;
  const status = await navigator.permissions
    .query({ name: "geolocation" as PermissionName })
    .catch(() => null);
  if (status?.state !== "granted") return null;
  const found = await currentPosition();
  return "at" in found ? found.at : null;
}

export type WeatherAnswer =
  | { kind: "read"; place: WeatherPlace; forecast: Forecast }
  | { kind: "problem"; problem: string }
  /** No place was asked for, and none is chosen or may be known. */
  | { kind: "no-place" }
  | { kind: "not-found"; name: string };

/** The weather at the place named, or else the person's first place, or else where they are. */
export async function weatherFor(name: string | undefined): Promise<WeatherAnswer> {
  let place: WeatherPlace | undefined;
  if (name) {
    const found = await findWeatherPlaces(name);
    if ("problem" in found) return { kind: "problem", problem: found.problem };
    place = found.read[0];
    if (!place) return { kind: "not-found", name };
  } else {
    place = readWeatherPlaces(desktopValues()[WEATHER_PLACES])?.[0];
    if (!place) {
      const here = desktopValues()[WEATHER_HERE] === true ? await locationIfGranted() : null;
      if (!here) return { kind: "no-place" };
      place = { name: "My Location", ...here };
    }
  }
  const reading = await readForecast(place);
  return "problem" in reading
    ? { kind: "problem", problem: reading.problem }
    : { kind: "read", place, forecast: reading.read };
}
