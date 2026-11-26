import { PushButton } from "macalicious/push-button";
import { useState } from "react";
import { Mail } from "../mail";

/**
 * Choose a mailbox and a message, search, flag, delete, reply. New Message opens a second
 * window over the viewer. The button under the window stands for the Mail menu's Preferences
 * command; Command-comma or Control-comma in the window opens them too. The space under the
 * button is where the New Message window ends: it opens over the viewer, not inside it.
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
        paddingBlockEnd: 48,
      }}
    >
      <Mail
        material="opaque"
        width="100%"
        height={620}
        style={{ maxWidth: 1061 }}
        composeOffset={{ x: 100, y: 110 }}
        preferencesOpen={preferences}
        onPreferencesOpenChange={setPreferences}
      />
      <PushButton disabled={preferences} onClick={() => setPreferences(true)}>
        Preferences…
      </PushButton>
    </div>
  );
}
