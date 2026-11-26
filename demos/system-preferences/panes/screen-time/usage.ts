/*
 * What the two captures of the Screen Time pane report: Thursday, October 3 (Aqua) and Friday,
 * October 4 (Dark Aqua). The bars are the measured ones, in points of the window frame; no
 * usage is made up beyond what the captures draw.
 */

/** What a part of a bar stands for: a category of the legend, or all the other use. */
export type Category = "usage" | "productivity" | "other" | "creativity";

/** One bar of a chart: its left edge, its width and its parts from the axis up. */
export interface Bar {
  x: number;
  width: number;
  parts: readonly (readonly [category: Category, height: number])[];
}

export interface App {
  id: string;
  name: string;
  /** Time used; empty for All Apps, which shows none. */
  time: string;
}

export interface Day {
  /** The day as a date, which is also its id: `screen-time.today` and `screen-time.day`. */
  id: string;
  weekday: string;
  date: string;
  total: string;
  /** When the report was last updated, as the footer says it. */
  updated: string;
  /** The labels of the week chart's top line and middle line. */
  scale: readonly [string, string];
  /** Whether the week chart labels its axis with a 0. */
  zero: boolean;
  /** Top edge of the dashed line of the week's average, in points from the frame's top. */
  average: number;
  week: readonly Bar[];
  hours: readonly Bar[];
  legend: readonly (readonly [category: Category, name: string, time: string])[];
  apps: readonly App[];
}

const ALL_APPS: App = { id: "all", name: "All Apps", time: "" };

export const DAYS: readonly Day[] = [
  {
    id: "2019-10-03",
    weekday: "Thursday",
    date: "October 3",
    total: "48m",
    updated: "10:45 AM",
    scale: ["2h", "1h"],
    zero: false,
    average: 199,
    week: [
      { x: 224, width: 33, parts: [["usage", 5.5]] },
      {
        x: 448,
        width: 33,
        parts: [
          ["productivity", 3],
          ["other", 1.5],
          ["usage", 20.5],
        ],
      },
    ],
    hours: [
      {
        x: 363.5,
        width: 8,
        parts: [
          ["other", 1],
          ["usage", 2],
        ],
      },
      {
        x: 379.5,
        width: 8.5,
        parts: [
          ["productivity", 5],
          ["usage", 30],
        ],
      },
    ],
    legend: [
      ["productivity", "Productivity", "9m"],
      ["other", "Other", "3m"],
      ["creativity", "Creativity", "27s"],
    ],
    apps: [
      ALL_APPS,
      { id: "finder", name: "Finder", time: "47m" },
      { id: "safari", name: "Safari", time: "11m" },
      { id: "system-preferences", name: "System Preferences", time: "10m" },
      { id: "system-information", name: "System Information", time: "8m" },
    ],
  },
  {
    id: "2019-10-04",
    weekday: "Friday",
    date: "October 4",
    total: "14m",
    updated: "10:26 AM",
    scale: ["4h", "2h"],
    zero: true,
    average: 195,
    week: [
      { x: 224, width: 33, parts: [["usage", 3]] },
      { x: 448, width: 33, parts: [["usage", 53]] },
      {
        x: 504,
        width: 33,
        parts: [
          ["productivity", 1.5],
          ["usage", 1.5],
        ],
      },
    ],
    hours: [
      {
        x: 379.5,
        width: 8.5,
        parts: [
          ["productivity", 4.5],
          ["usage", 6.5],
        ],
      },
    ],
    legend: [["productivity", "Productivity", "9m"]],
    apps: [
      ALL_APPS,
      { id: "finder", name: "Finder", time: "14m" },
      { id: "system-information", name: "System Information", time: "9m" },
      { id: "system-preferences", name: "System Preferences", time: "6m" },
      { id: "textedit", name: "TextEdit", time: "1m" },
    ],
  },
];
