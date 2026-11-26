import { PushButton } from "macalicious/push-button";
import { useState } from "react";
import { MusicPreferences } from "../music-preferences";

/** Music's Preferences on their own: five panes, Cancel and OK. Escape cancels. */
export default function Preferences() {
  const [open, setOpen] = useState(true);
  const [settings, setSettings] = useState<Parameters<typeof MusicPreferences>[0]["settings"]>();
  if (!open) return <PushButton onClick={() => setOpen(true)}>Preferences…</PushButton>;
  return (
    <MusicPreferences
      settings={settings}
      onApply={(next) => {
        setSettings(next);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}
