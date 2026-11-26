import { SearchField } from "macalicious/search-field";

export default function Sizes() {
  return (
    <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
      <SearchField size="regular" aria-label="Regular" />
      <SearchField size="small" aria-label="Small" />
      <SearchField size="mini" aria-label="Mini" />
    </div>
  );
}
