import { NowPlayingLcd } from "macalicious/now-playing-lcd";

/** A loaded item: placeholder artwork, title, subtitle and the progress line. */
export default function Basic() {
  return (
    <NowPlayingLcd
      title="Morning Walk"
      subtitle="The Placeholders — First Album"
      elapsed={62}
      duration={215}
      style={{ width: 400 }}
    />
  );
}
