import { PodcastsPreferences } from "../podcasts-preferences";

/**
 * The Preferences window on its own: General as in the reference screenshots, Playback, whose
 * two pop-up buttons set the seconds of the skip buttons, and Advanced. The margins leave
 * room for the window's shadow.
 */
export default function Preferences() {
  return (
    <div style={{ padding: "20px 40px 60px" }}>
      <PodcastsPreferences />
    </div>
  );
}
