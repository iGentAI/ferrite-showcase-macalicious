import { ToolbarSearchField } from "macalicious/toolbar-search-field";
import { useState } from "react";

const fruits = ["Apple", "Apricot", "Banana", "Cherry", "Grape", "Orange", "Peach", "Pear"];

/** Controlled: the list is filtered as you type; Escape or the clear button empties the field. */
export default function Controlled() {
  const [query, setQuery] = useState("");
  const matches = fruits.filter((fruit) => fruit.toLowerCase().includes(query.toLowerCase()));
  return (
    <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
      <ToolbarSearchField
        value={query}
        onValueChange={setQuery}
        placeholder="Search Fruit"
        style={{ width: 200 }}
      />
      <span>{matches.length > 0 ? matches.join(", ") : "No matches"}</span>
    </div>
  );
}
