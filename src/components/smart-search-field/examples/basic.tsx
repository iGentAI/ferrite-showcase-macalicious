import { SmartSearchField } from "macalicious/smart-search-field";

export default function Basic() {
  return (
    <div style={{ width: 360 }}>
      <SmartSearchField defaultValue="https://www.example.com/" secure />
    </div>
  );
}
