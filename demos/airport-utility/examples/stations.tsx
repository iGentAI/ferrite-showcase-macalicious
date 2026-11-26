import { AirPortUtility } from "../airport-utility";
import type { AirPortBaseStation } from "../airport-utility-data";

const NAMES = [
  "Hall",
  "Kitchen",
  "Upstairs Reading Room and Workshop",
  "Study",
  "Garage",
  "Attic",
  "Porch",
  "Cellar",
];

/* Invented base stations of one network; the last one needs attention. */
const STATIONS: AirPortBaseStation[] = NAMES.map((name, index) => ({
  id: `station-${index + 1}`,
  name,
  model: index % 2 === 0 ? "AirPort Extreme" : "AirPort Express",
  network: "Harbor",
  address: `10.0.1.${index + 2}`,
  serial: `C86EXAMPLE${String(index + 1).padStart(2, "0")}`,
  version: index % 2 === 0 ? "7.9.1" : "7.8.1",
  status: index === NAMES.length - 1 ? "partially-available" : "available",
}));

/**
 * A network of eight base stations, more than the window is wide: the row scrolls sideways
 * under the Internet, whose line stays where it is, and the long name ends with an ellipsis.
 */
export default function Stations() {
  return <AirPortUtility defaultStations={STATIONS} />;
}
