import { SearchField } from "macalicious/search-field";
import { useState } from "react";

const PODCASTS = ["Mac Power Users", "Connected", "Upgrade", "Liftoff", "Under the Radar"];

/** Searching while typing: the list follows the controlled value. */
export default function Filtering() {
  const [query, setQuery] = useState("");
  const matches = PODCASTS.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div style={{ display: "grid", gap: 8, width: 220 }}>
      {/* biome-ignore lint/a11y/useSemanticElements: React warns about <search> in jsdom */}
      <div role="search">
        <SearchField
          aria-label="Search podcasts"
          value={query}
          onValueChange={setQuery}
          style={{ width: "100%" }}
        />
      </div>
      <ul
        aria-label="Podcasts"
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          font: "var(--mac-font-body)",
          color: "var(--mac-color-label)",
        }}
      >
        {matches.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}
