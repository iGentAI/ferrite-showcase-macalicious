import { FaceTime } from "../facetime";
import { RECENT_CALLS } from "../facetime-data";

/**
 * The window with a list of recent calls, every name invented. Missed shows the two calls
 * that were not answered. The button at the end of a row calls back, as does Return on the
 * selected row.
 */
export default function Recents() {
  return (
    <FaceTime defaultCalls={RECENT_CALLS} width="100%" style={{ minWidth: 560, maxWidth: 652 }} />
  );
}
