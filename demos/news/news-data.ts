/*
 * What the demo's News shows. Nothing is fetched and nothing here is real: the screenshots show
 * the stories of two days of October 2019 from their publishers, and the demo has invented
 * headlines and invented publishers in their places, of the same lengths, so that the layout
 * is the screenshots' and the content is nobody's.
 */

/** A story as the feed lists it. */
export interface NewsStory {
  /** Identifies the story among all the demo's stories. */
  id: string;
  /** The publisher's name, shown where News shows the publisher's logo. */
  publisher: string;
  headline: string;
  /** How old the story is, as News says it: "1h ago". */
  age: string;
  /** A video story: its picture carries the play mark. */
  video?: boolean;
  /** The story's own picture, a web address: in the desktop app, the one its feed names. */
  image?: string;
}

/** A day of News: the date under the masthead and that day's top stories. */
export interface NewsEdition {
  /** The date under the masthead: "October 3". */
  date: string;
  /**
   * The top stories, in order. Today shows the first two as leads and the next three beside a
   * small picture; the News Top Stories channel lists them all.
   */
  top: readonly NewsStory[];
}

/** The groups of the sidebar, in order. */
export const GROUPS = ["Apple News", "Following", "Suggested by Siri"] as const;
export type NewsGroup = (typeof GROUPS)[number];

/** A row of the sidebar. */
export interface NewsChannel {
  id: string;
  name: string;
  group: NewsGroup;
  /** The colour of the row's placeholder icon; News has a full-colour picture there. */
  tint: string;
}

/** The sidebar of the screenshots: four destinations, two channels followed, ten topics. */
export const CHANNELS: readonly NewsChannel[] = [
  { id: "today", name: "Today", group: "Apple News", tint: "#f0364e" },
  { id: "news-plus", name: "News+", group: "Apple News", tint: "#f0364e" },
  { id: "saved", name: "Saved Stories", group: "Apple News", tint: "#f0364e" },
  { id: "history", name: "History", group: "Apple News", tint: "#f0364e" },
  { id: "top-stories", name: "News Top Stories", group: "Following", tint: "#7d5fb8" },
  { id: "spotlight", name: "Apple News Spotlight", group: "Following", tint: "#5aa9c9" },
  { id: "business", name: "Business", group: "Suggested by Siri", tint: "#35508f" },
  { id: "entertainment", name: "Entertainment", group: "Suggested by Siri", tint: "#b548c6" },
  { id: "fashion", name: "Fashion", group: "Suggested by Siri", tint: "#7fb2d6" },
  { id: "food", name: "Food", group: "Suggested by Siri", tint: "#d98a3d" },
  { id: "health", name: "Health", group: "Suggested by Siri", tint: "#4fa37c" },
  { id: "politics", name: "Politics", group: "Suggested by Siri", tint: "#8a6f66" },
  { id: "science", name: "Science", group: "Suggested by Siri", tint: "#5f7fa6" },
  { id: "sports", name: "Sports", group: "Suggested by Siri", tint: "#5a9a4b" },
  { id: "technology", name: "Technology", group: "Suggested by Siri", tint: "#4b4f7a" },
  { id: "travel", name: "Travel", group: "Suggested by Siri", tint: "#4d8fc4" },
];

/** The edition of the Aqua screenshot, in the demo's own words. */
export const lightEdition: NewsEdition = {
  date: "October 3",
  top: [
    {
      id: "bridge",
      publisher: "Harbour Post",
      headline: "City council approves the plan to rebuild the old harbour bridge",
      age: "1h ago",
    },
    {
      id: "marathon",
      publisher: "Metro Wire",
      headline:
        "Record crowds line the coast as the marathon returns — and the course record falls by four seconds",
      age: "1h ago",
      video: true,
    },
    {
      id: "timetable",
      publisher: "Daily Sample",
      headline: "New rail timetable adds late trains on weekends",
      age: "1h ago",
    },
    {
      id: "museum",
      publisher: "North Ledger",
      headline: "Museum reopens its east wing after two years of repairs",
      age: "1h ago",
    },
    {
      id: "reef",
      publisher: "The Quarter",
      headline: "Researchers map a reef that was thought lost for sixty years",
      age: "1h ago",
    },
    {
      id: "ferry",
      publisher: "Harbour Post",
      headline: "Island ferry switches to electric power this winter",
      age: "2h ago",
    },
  ],
};

/** The edition of the Dark Aqua screenshot, taken a day later. */
export const darkEdition: NewsEdition = {
  date: "October 4",
  top: [
    {
      id: "forecast",
      publisher: "North Ledger",
      headline:
        "Storm season forecast points to a wetter autumn than usual, the weather service says",
      age: "5m ago",
    },
    {
      id: "composer",
      publisher: "Daily Sample",
      headline: "Orchestra names its first resident composer in a decade",
      age: "5m ago",
    },
    {
      id: "library",
      publisher: "Metro Wire",
      headline: "Library extends its opening hours after a public vote",
      age: "5m ago",
    },
    {
      id: "bakers",
      publisher: "The Quarter",
      headline: "Bakers compete for the regional sourdough title this weekend",
      age: "5m ago",
    },
    {
      id: "canal",
      publisher: "Harbour Post",
      headline: "A village plants ten thousand trees along its disused canal",
      age: "5m ago",
    },
    {
      id: "tram",
      publisher: "Metro Wire",
      headline: "Historic tram line returns to service on Sundays",
      age: "20m ago",
    },
  ],
};

/** Two headlines for each channel that has stories of its own. */
const CHANNEL_HEADLINES: Readonly<Record<string, readonly [string, string]>> = {
  spotlight: [
    "The long way round: a year on the coastal path",
    "How a small town kept its cinema open",
  ],
  business: [
    "Family bakery chain opens its hundredth shop",
    "Regional airports report their busiest summer",
  ],
  entertainment: [
    "Festival announces an all-acoustic closing night",
    "A radio drama finds a new audience online",
  ],
  fashion: [
    "Knitwear makers revive a pattern from the 1920s",
    "Design students show a collection made from sailcloth",
  ],
  food: [
    "The case for cooking with late-season tomatoes",
    "Market traders vote on the best pie of the year",
  ],
  health: [
    "Walking groups double their numbers in a year",
    "Clinics trial longer evening opening hours",
  ],
  politics: [
    "Councils agree on a shared timetable for road repairs",
    "Regional assembly opens its archive to the public",
  ],
  science: [
    "Amateur astronomers log a record meteor shower",
    "Survey finds otters back on a city river",
  ],
  sports: [
    "Village cricket club reaches its first national final",
    "Rowers set off on a relay around the coast",
  ],
  technology: [
    "Open mapping project finishes its survey of footpaths",
    "Schools try a week of lessons without screens",
  ],
  travel: [
    "Night trains return on the northern route",
    "Five walks that begin at a railway station",
  ],
};

const PUBLISHERS = ["Daily Sample", "Harbour Post", "Metro Wire", "North Ledger", "The Quarter"];

/** The stories of the channels that have their own, the same in every edition. */
const CHANNEL_STORIES: Readonly<Record<string, readonly NewsStory[]>> = Object.fromEntries(
  Object.entries(CHANNEL_HEADLINES).map(([channel, headlines], at) => [
    channel,
    headlines.map((headline, index) => ({
      id: `${channel}-${index + 1}`,
      publisher: PUBLISHERS[(at + index) % PUBLISHERS.length] ?? "Daily Sample",
      headline,
      age: index === 0 ? "3h ago" : "Yesterday",
    })),
  ]),
);

/** Every story the demo has in an edition: the top stories, then the channels'. */
export function allStories(edition: NewsEdition): readonly NewsStory[] {
  return [...edition.top, ...Object.values(CHANNEL_STORIES).flat()];
}

/**
 * The stories a channel lists. Today and News Top Stories have the edition's; a topic has its
 * own two; News+, Saved Stories and History have none of their own (the window keeps the last
 * two itself).
 */
export function storiesOf(channel: string, edition: NewsEdition): readonly NewsStory[] {
  if (channel === "today" || channel === "top-stories") return edition.top;
  return CHANNEL_STORIES[channel] ?? [];
}

/**
 * What tells a story from every other: all it shows. Two editions may use one id for different
 * stories, so the id alone does not say which of them the window has kept.
 */
export function storyKey(story: NewsStory): string {
  return JSON.stringify([
    story.id,
    story.publisher,
    story.headline,
    story.age,
    story.video === true,
  ]);
}

/** Whether a story's headline or publisher contains the text, whatever its case. */
export function matchesQuery(story: NewsStory, query: string): boolean {
  const text = query.trim().toLowerCase();
  return (
    text === "" ||
    story.headline.toLowerCase().includes(text) ||
    story.publisher.toLowerCase().includes(text)
  );
}

/** The text of a story in the reader: the demo has no articles, and says so. */
export function paragraphs(story: NewsStory): readonly string[] {
  return [
    `This is a sample story. ${story.publisher} is not a real publisher and nothing here was reported: the headline stands where the News app of the reference screenshots shows a story of its day.`,
    "The reader shows what a story is made of in this demo: the publisher, the headline, how old the story is, a picture made for the demo and these paragraphs. The Back button in the toolbar returns to where the story was opened from.",
    "The Share button opens a menu with two commands: one copies the headline, the other saves the story to Saved Stories or removes it from there. Every story that is opened is listed in History until the page is closed.",
  ];
}
