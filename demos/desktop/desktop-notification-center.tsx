"use client";

import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { useEffect, useState } from "react";
import { currentPosition } from "../maps/maps-location";
import {
  dayName,
  degrees,
  type Forecast,
  findWeatherPlaces,
  locationIfGranted,
  readForecast,
  readTemperatureUnit,
  readWeatherPlaces,
  sourceText,
  TEMPERATURE_UNIT,
  WEATHER_HERE,
  WEATHER_PLACES,
  type WeatherPlace,
} from "../maps/maps-weather";
import { useDesktopSetting, useDesktopValue } from "./desktop-personal";
import "./desktop-notification-center.css";

const NO_PLACES: readonly WeatherPlace[] = [];
const MOST_PLACES = 4;
const REFRESH_MS = 15 * 60_000;
const readBoolean = (stored: unknown) => (typeof stored === "boolean" ? stored : undefined);

type Reading = { forecast: Forecast } | { problem: string };

const keyOf = (place: WeatherPlace) => `${place.lat},${place.lon}`;

/** Each place's reading, read now and again while it is shown. */
function useReadings(places: readonly WeatherPlace[]) {
  const [readings, setReadings] = useState<Readonly<Record<string, Reading>>>({});
  const [asked, setAsked] = useState(0);
  const points = places.map(keyOf).join(";");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `points` is `places` by value
  useEffect(() => {
    let current = true;
    const read = () => {
      for (const place of places) {
        void readForecast(place).then((reading) => {
          if (!current) return;
          setReadings((before) => ({
            ...before,
            [keyOf(place)]:
              "problem" in reading ? { problem: reading.problem } : { forecast: reading.read },
          }));
        });
      }
    };
    read();
    const timer = setInterval(read, REFRESH_MS);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [points, asked]);
  return { readings, again: () => setAsked((count) => count + 1) };
}

/** The Weather widget of Today: each chosen place, and where the person is if they said so. */
export function TodayWeather() {
  const [places, setPlaces] = useDesktopSetting(WEATHER_PLACES, readWeatherPlaces, NO_PLACES);
  const [useHere, setUseHere] = useDesktopSetting(WEATHER_HERE, readBoolean, false);
  const unit = useDesktopValue(TEMPERATURE_UNIT, readTemperatureUnit, "fahrenheit");
  const [here, setHere] = useState<WeatherPlace | null>(null);
  const [locating, setLocating] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<readonly WeatherPlace[] | string | null>(null);

  useEffect(() => {
    if (!useHere) {
      setHere(null);
      return undefined;
    }
    let current = true;
    void locationIfGranted().then((at) => {
      if (current && at) setHere({ name: "My Location", ...at });
    });
    return () => {
      current = false;
    };
  }, [useHere]);

  const shown = here ? [here, ...places] : places;
  const { readings, again } = useReadings(shown);

  const locate = () => {
    setLocating(null);
    void currentPosition().then((answer) => {
      if ("problem" in answer) {
        setLocating(answer.problem);
        return;
      }
      setHere({ name: "My Location", lat: answer.at.lat, lon: answer.at.lon });
      setUseHere(true);
    });
  };
  const find = () => {
    const name = query.trim();
    if (!name) return;
    setFound("Looking…");
    void findWeatherPlaces(name).then((answer) => {
      if ("problem" in answer) setFound(`Places can’t be found right now. ${answer.problem}`);
      else setFound(answer.read.length > 0 ? answer.read : `No place is called “${name}”.`);
    });
  };

  return (
    <>
      {shown.length === 0 ? (
        <p className="mac-desktop-shell-today-empty">Choose a place to see its weather.</p>
      ) : (
        <ul className="mac-desktop-shell-today-weather">
          {shown.map((place) => {
            const reading = readings[keyOf(place)];
            return (
              <li key={keyOf(place)}>
                <span className="mac-desktop-shell-today-weather-place">{place.name}</span>
                {!reading ? (
                  <span className="mac-desktop-shell-today-detail">Loading…</span>
                ) : "problem" in reading ? (
                  <span className="mac-desktop-shell-today-weather-down">
                    <span className="mac-desktop-shell-today-detail">
                      The weather isn’t available. {reading.problem}
                    </span>
                    <PushButton size="small" onClick={again}>
                      Try Again
                    </PushButton>
                  </span>
                ) : (
                  <>
                    <span className="mac-desktop-shell-today-weather-now">
                      {degrees(reading.forecast.temperature_c, unit)}
                    </span>
                    <span className="mac-desktop-shell-today-detail">
                      {reading.forecast.condition}
                      {reading.forecast.days[0]
                        ? `, high ${degrees(reading.forecast.days[0].high_c, unit)}, low ${degrees(reading.forecast.days[0].low_c, unit)}`
                        : ""}
                    </span>
                    <ul className="mac-desktop-shell-today-weather-days">
                      {reading.forecast.days.slice(1, 4).map((day) => (
                        <li key={day.date}>
                          {dayName(day.date)} {degrees(day.high_c, unit)} {degrees(day.low_c, unit)}
                        </li>
                      ))}
                    </ul>
                    <span className="mac-desktop-shell-today-detail">
                      {sourceText(reading.forecast)}
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {choosing ? (
        <div className="mac-desktop-shell-today-cities">
          {places.map((place) => (
            <div key={keyOf(place)} className="mac-desktop-shell-today-city">
              <span>{place.name}</span>
              <PushButton
                size="small"
                aria-label={`Remove ${place.name}`}
                onClick={() => setPlaces(places.filter((each) => keyOf(each) !== keyOf(place)))}
              >
                Remove
              </PushButton>
            </div>
          ))}
          {useHere ? (
            <div className="mac-desktop-shell-today-city">
              <span>My Location</span>
              <PushButton
                size="small"
                aria-label="Stop Using My Location"
                onClick={() => setUseHere(false)}
              >
                Remove
              </PushButton>
            </div>
          ) : (
            <PushButton size="small" onClick={locate}>
              Use My Location
            </PushButton>
          )}
          {locating ? <p className="mac-desktop-shell-today-detail">{locating}</p> : null}
          {places.length < MOST_PLACES ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                find();
              }}
            >
              <TextField
                aria-label="Find a place"
                placeholder="Find a place"
                value={query}
                onValueChange={setQuery}
              />
            </form>
          ) : null}
          {typeof found === "string" ? (
            <p className="mac-desktop-shell-today-detail">{found}</p>
          ) : (
            found
              ?.filter((place) => !places.some((each) => keyOf(each) === keyOf(place)))
              .map((place) => (
                <div key={keyOf(place)} className="mac-desktop-shell-today-city">
                  <span>
                    {place.name}
                    {place.region ? `, ${place.region}` : ""}
                  </span>
                  <PushButton
                    size="small"
                    aria-label={`Add ${place.name}`}
                    onClick={() => {
                      setPlaces([...places, place]);
                      setQuery("");
                      setFound(null);
                    }}
                  >
                    Add
                  </PushButton>
                </div>
              ))
          )}
          <PushButton size="small" onClick={() => setChoosing(false)}>
            Done
          </PushButton>
        </div>
      ) : (
        <div className="mac-desktop-shell-today-cities">
          <PushButton size="small" onClick={() => setChoosing(true)}>
            Choose Places…
          </PushButton>
        </div>
      )}
    </>
  );
}
