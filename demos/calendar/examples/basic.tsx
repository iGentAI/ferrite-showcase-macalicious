import { PushButton } from "macalicious/push-button";
import { useState } from "react";
import { Calendar } from "../calendar";
import { defaultSettings } from "../calendar-data";
import { CalendarPreferences } from "../calendar-preferences";

/**
 * Switch the view, step through the weeks, return with Today, type in the search field, tick
 * calendars off, add an event, and double-click an event (or press Return on it) for its
 * popover. The button under the window stands for the Calendar menu's Preferences command,
 * Command-comma in the window: what the preferences change, the window follows.
 */
export default function Basic() {
  const [settings, setSettings] = useState(defaultSettings);
  const [preferences, setPreferences] = useState(false);
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <Calendar
        width="100%"
        height={560}
        style={{ maxWidth: 1102 }}
        state={preferences ? "main" : "key"}
        settings={settings}
        defaultSelectedEvent="screenshots"
        onOpenPreferences={() => setPreferences(true)}
      />
      <PushButton onClick={() => setPreferences(!preferences)}>
        {preferences ? "Close Preferences" : "Calendar Preferences…"}
      </PushButton>
      {preferences ? (
        <CalendarPreferences
          settings={settings}
          onSettingsChange={setSettings}
          onClose={() => setPreferences(false)}
        />
      ) : null}
    </div>
  );
}
