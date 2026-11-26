import { PushButton } from "macalicious/push-button";
import { useState } from "react";
import { Podcasts } from "../podcasts";

/**
 * Choose a place in the sidebar, click an episode to play it, skip, drag the progress line,
 * search, open a show from Browse and subscribe to it. Nothing is heard: the transport is a
 * clock. The button under the window stands for the Podcasts menu's Preferences command;
 * Command-comma or Control-comma in the window opens them too.
 */
export default function Basic() {
  const [preferences, setPreferences] = useState(false);
  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        gap: 16,
        justifyItems: "start",
        width: "100%",
        paddingBlockEnd: 48,
      }}
    >
      <Podcasts
        material="opaque"
        width="100%"
        height={620}
        style={{ maxWidth: 1137 }}
        preferencesOpen={preferences}
        onPreferencesOpenChange={setPreferences}
      />
      <PushButton disabled={preferences} onClick={() => setPreferences(true)}>
        Preferences…
      </PushButton>
    </div>
  );
}
