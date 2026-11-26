import { Maps } from "../maps";

/**
 * Click the pin to open Apple Park's place card, switch the map type, zoom, open a tab, or
 * search for "theater", "visitor" or "park" and press Return. The map is an abstract
 * placeholder and the places are a handful of the demo's own.
 */
export default function Basic() {
  return <Maps width="100%" height={560} style={{ maxWidth: 1000 }} />;
}
