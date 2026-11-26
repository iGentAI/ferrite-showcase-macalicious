import { PageControl } from "macalicious/page-control";

/** Uncontrolled: click a dot or an arrow, or focus the dots and use the arrow keys. */
export default function Basic() {
  return <PageControl count={3} defaultPage={1} aria-label="Effects pages" />;
}
