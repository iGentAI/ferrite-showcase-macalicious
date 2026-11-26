import { PushButton } from "macalicious/push-button";
import { useState } from "react";
import { Messages } from "../messages";

/**
 * Choose a conversation, type a message and press Return, search, start a new conversation
 * with the compose button. The button under the window stands for the Messages menu's
 * Preferences command; Command-comma or Control-comma in the window opens them too.
 */
export default function Basic() {
  const [preferences, setPreferences] = useState(false);
  return (
    <div style={{ position: "relative", display: "grid", gap: 16, justifyItems: "start" }}>
      <Messages
        material="opaque"
        width="100%"
        height={520}
        style={{ maxWidth: 730 }}
        preferencesOpen={preferences}
        onPreferencesOpenChange={setPreferences}
      />
      <PushButton disabled={preferences} onClick={() => setPreferences(true)}>
        Preferences…
      </PushButton>
    </div>
  );
}
