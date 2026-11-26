"use client";

import { useEffect, useState } from "react";
import { useDesktopValue } from "../desktop/desktop-personal";
import { WeatherGlyph } from "./maps-artwork";
import type { LatLon } from "./maps-geo";
import {
  degrees,
  type Forecast,
  readForecast,
  readTemperatureUnit,
  sourceText,
  TEMPERATURE_UNIT,
} from "./maps-weather";

/** Below this zoom the map shows too wide a land for one temperature. */
const LEAST_ZOOM = 7;
/** How long a map rests before it asks. */
const REST_MS = 800;

/** Weather at a tenth of a degree, about 11 km: moving the map within that asks nothing. */
const rounded = (value: number) => Math.round(value * 10) / 10;

/** The temperature at the map's middle, in the map's top corner, with its source in the tooltip. */
export function MapWeather({ center, zoom }: { center: LatLon; zoom: number }) {
  const shown = zoom >= LEAST_ZOOM;
  const lat = rounded(center.lat);
  const lon = rounded(center.lon);
  const [reading, setReading] = useState<{ forecast: Forecast } | { problem: string } | null>(null);
  const unit = useDesktopValue(TEMPERATURE_UNIT, readTemperatureUnit, "fahrenheit");
  useEffect(() => {
    if (!shown) return undefined;
    let current = true;
    const rest = setTimeout(() => {
      void readForecast({ lat, lon }).then((read) => {
        if (current) {
          setReading("problem" in read ? { problem: read.problem } : { forecast: read.read });
        }
      });
    }, REST_MS);
    return () => {
      current = false;
      clearTimeout(rest);
    };
  }, [shown, lat, lon]);
  if (!shown || !reading) return null;
  const said =
    "problem" in reading
      ? `The weather isn’t available. ${reading.problem}`
      : `${degrees(reading.forecast.temperature_c, unit)}, ${reading.forecast.condition}. ${sourceText(reading.forecast)}.`;
  return (
    <div
      role="img"
      aria-label={`Weather: ${said}`}
      title={said}
      className="mac-maps-weather"
      data-served=""
    >
      <WeatherGlyph />
      <span className="mac-maps-temperature">
        {"problem" in reading ? "--" : degrees(reading.forecast.temperature_c, unit)}
      </span>
    </div>
  );
}
