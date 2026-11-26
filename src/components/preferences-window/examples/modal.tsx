import { Checkbox } from "macalicious/checkbox";
import { HelpButton } from "macalicious/help-button";
import { PreferencesToolbar, PreferencesToolbarItem } from "macalicious/preferences-toolbar";
import {
  PreferencesWindow,
  PreferencesWindowFooter,
  PreferencesWindowForm,
  PreferencesWindowPane,
  PreferencesWindowRow,
} from "macalicious/preferences-window";
import { PushButton } from "macalicious/push-button";
import { useState } from "react";

function PaneIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="6" fill={color} />
    </svg>
  );
}

/**
 * The modal kind of Music and TV: no window controls, centred items, and a pane that ends in
 * Cancel and OK. Escape and both buttons close it.
 */
export default function Modal() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return <PushButton onClick={() => setOpen(true)}>Preferences…</PushButton>;
  }
  const footer = (
    <PreferencesWindowFooter leading={<HelpButton />}>
      <PushButton style={{ minWidth: 84 }} onClick={() => setOpen(false)}>
        Cancel
      </PushButton>
      <PushButton variant="primary" style={{ minWidth: 84 }} onClick={() => setOpen(false)}>
        OK
      </PushButton>
    </PreferencesWindowFooter>
  );
  return (
    <PreferencesWindow
      modal
      width={440}
      onClose={() => setOpen(false)}
      toolbar={
        <PreferencesToolbar aria-label="Preferences" alignment="center">
          <PreferencesToolbarItem value="general" icon={<PaneIcon color="#8e8e93" />}>
            General
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="playback" icon={<PaneIcon color="#ff9500" />}>
            Playback
          </PreferencesToolbarItem>
        </PreferencesToolbar>
      }
    >
      <PreferencesWindowPane value="general">
        <PreferencesWindowForm>
          <PreferencesWindowRow label="Show:">
            <Checkbox defaultChecked>Star ratings</Checkbox>
          </PreferencesWindowRow>
          <PreferencesWindowRow>
            <Checkbox>Songs list checkboxes</Checkbox>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
        {footer}
      </PreferencesWindowPane>
      <PreferencesWindowPane value="playback">
        <PreferencesWindowForm>
          <PreferencesWindowRow label="Playback:">
            <Checkbox defaultChecked>Sound Check</Checkbox>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
        {footer}
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
