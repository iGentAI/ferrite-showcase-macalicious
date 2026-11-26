import { describe, expect, it } from "vitest";
import {
  dayName,
  degrees,
  forecastFromServer,
  placesFromServer,
  readWeatherPlaces,
  sourceText,
} from "./maps-weather";

const ANSWER = {
  lat: 48.85,
  lon: 2.35,
  timezone: "Europe/Paris",
  observed: "2026-11-06T23:30",
  temperature_c: 6.8,
  code: 45,
  condition: "Fog",
  days: [{ date: "2026-11-06", high_c: 13.4, low_c: 6.6, code: 45, condition: "Fog" }],
  source: "Open-Meteo",
  source_url: "https://open-meteo.com/",
  read_at: 1000,
  cached: false,
};

describe("the weather's answers", () => {
  it("reads a forecast, and nothing else", () => {
    expect(forecastFromServer(ANSWER)).toEqual({
      temperature_c: 6.8,
      condition: "Fog",
      observed: "2026-11-06T23:30",
      source: "Open-Meteo",
      days: [{ date: "2026-11-06", high_c: 13.4, low_c: 6.6, condition: "Fog" }],
    });
    expect(forecastFromServer({ ...ANSWER, temperature_c: "7" })).toBeNull();
    expect(forecastFromServer({ ...ANSWER, days: [{ date: "x" }] })).toBeNull();
    expect(forecastFromServer({ error: "Open-Meteo: no answer" })).toBeNull();
    expect(forecastFromServer(null)).toBeNull();
  });

  it("reads places, and keeps only those that are places", () => {
    expect(
      placesFromServer({
        places: [
          { name: "Paris", region: "Île-de-France", country: "France", lat: 48.8, lon: 2.3 },
        ],
      }),
    ).toEqual([{ name: "Paris", region: "Île-de-France", country: "France", lat: 48.8, lon: 2.3 }]);
    expect(placesFromServer({ places: [{ name: "Paris" }] })).toBeNull();
    expect(readWeatherPlaces([{ name: "Paris", lat: 1, lon: 2 }, { name: "Nowhere" }])).toEqual([
      { name: "Paris", lat: 1, lon: 2 },
    ]);
    expect(readWeatherPlaces("Paris")).toBeUndefined();
  });

  it("says it in the person's unit, with its source and time", () => {
    expect(degrees(6.8, "celsius")).toBe("7°");
    expect(degrees(6.8, "fahrenheit")).toBe("44°");
    expect(degrees(-40, "fahrenheit")).toBe("-40°");
    expect(sourceText(ANSWER)).toBe("Open-Meteo, as of 11:30 PM local time");
    expect(sourceText({ source: "Open-Meteo", observed: "2026-11-06T00:05" })).toBe(
      "Open-Meteo, as of 12:05 AM local time",
    );
    expect(dayName("2026-11-07")).toBe("Sat");
  });
});
