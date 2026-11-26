import { PushButton } from "macalicious/push-button";
import { useState } from "react";
import { Music } from "../music";

/**
 * Press play, drag the volume, pick a row in the sidebar, choose an album, type in the search
 * field. The button under the window stands for the Music menu's Preferences command;
 * Command-comma or Control-comma in the window opens them too.
 */
export default function Basic() {
  const [preferences, setPreferences] = useState(false);
  return (
    <div style={{ display: "grid", gap: 16, justifyItems: "start" }}>
      <Music
        material="opaque"
        width="100%"
        height={620}
        style={{ maxWidth: 1220 }}
        preferencesOpen={preferences}
        onPreferencesOpenChange={setPreferences}
      />
      <PushButton disabled={preferences} onClick={() => setPreferences(true)}>
        Preferences…
      </PushButton>
    </div>
  );
}
