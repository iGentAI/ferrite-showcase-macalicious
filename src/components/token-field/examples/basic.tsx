import { TokenField } from "macalicious/token-field";

export default function Basic() {
  return <TokenField aria-label="Tags" defaultValue={["Work", "Travel"]} style={{ width: 280 }} />;
}
