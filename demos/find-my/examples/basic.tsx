import { FindMy } from "../find-my";

/**
 * Switch between People and Devices, select a row to bring its marker to the middle of the
 * map, change the map type, zoom, show the current location, or share it. The map is an
 * abstract placeholder and the devices are invented.
 */
export default function Basic() {
  return <FindMy width="100%" height={560} style={{ maxWidth: 1135 }} />;
}
