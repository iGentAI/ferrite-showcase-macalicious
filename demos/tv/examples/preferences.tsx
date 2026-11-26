import { PushButton } from "macalicious/push-button";
import { useState } from "react";
import { Tv } from "../tv";
import { defaultSettings } from "../tv-data";
import { TvPreferences } from "../tv-preferences";

/**
 * The two windows sharing their settings, as a desktop hosts them: the Preferences report the
 * settings when OK is chosen, and the Library of the main window follows them. Turn on
 * "Checkboxes in library" or change the List Size, choose OK and look at the Library.
 */
export default function Preferences() {
  const [open, setOpen] = useState(true);
  const [settings, setSettings] = useState(defaultSettings);
  return (
    <div style={{ display: "grid", gap: 16, justifyItems: "start", maxWidth: "100%" }}>
      {open ? (
        <TvPreferences
          settings={settings}
          onSettingsChange={setSettings}
          onClose={() => setOpen(false)}
        />
      ) : (
        <PushButton onClick={() => setOpen(true)}>Preferences…</PushButton>
      )}
      <div style={{ overflow: "auto", maxWidth: "100%" }}>
        <Tv
          width={920}
          height={420}
          state={open ? "main" : "key"}
          defaultSection="library"
          defaultLibrary={["harbour-lights", "paper-rockets", "signal-fires"]}
          settings={settings}
          onOpenPreferences={() => setOpen(true)}
          style={{ margin: "8px 24px 40px" }}
        />
      </div>
    </div>
  );
}
