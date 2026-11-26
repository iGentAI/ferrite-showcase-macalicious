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
import { Separator } from "macalicious/separator";
import { TextField } from "macalicious/text-field";

/** Stand-in artwork: Catalina's pane icons are Apple's and are not part of the library. */
function PaneIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="3" y="3" width="26" height="26" rx="6" fill={color} />
      <circle cx="16" cy="16" r="6" fill="#ffffff" fillOpacity="0.85" />
    </svg>
  );
}

export default function Basic() {
  return (
    <PreferencesWindow
      width={420}
      toolbar={
        <PreferencesToolbar aria-label="Preferences">
          <PreferencesToolbarItem value="general" icon={<PaneIcon color="#8e8e93" />}>
            General
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="accounts" icon={<PaneIcon color="#007aff" />}>
            Accounts
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="advanced" icon={<PaneIcon color="#636366" />}>
            Advanced
          </PreferencesToolbarItem>
        </PreferencesToolbar>
      }
    >
      <PreferencesWindowPane value="general">
        <PreferencesWindowForm>
          <PreferencesWindowRow label="Name:" labelFor="preferences-basic-name">
            <TextField id="preferences-basic-name" defaultValue="Catalina" style={{ width: 180 }} />
          </PreferencesWindowRow>
          <PreferencesWindowRow label="Show:">
            <Checkbox defaultChecked>Birthdays calendar</Checkbox>
          </PreferencesWindowRow>
          <PreferencesWindowRow>
            <Checkbox>Holidays calendar</Checkbox>
          </PreferencesWindowRow>
          <Separator style={{ marginBlock: 10 }} />
          <Checkbox defaultChecked>Show week numbers</Checkbox>
        </PreferencesWindowForm>
        <PreferencesWindowFooter>
          <HelpButton />
        </PreferencesWindowFooter>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="accounts">
        <PreferencesWindowForm>
          <PreferencesWindowRow label="Refresh:">
            <Checkbox defaultChecked>Every 15 minutes</Checkbox>
          </PreferencesWindowRow>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="advanced">
        <PreferencesWindowForm>
          <Checkbox>Turn on time zone support</Checkbox>
          <Checkbox>Show events in year view</Checkbox>
          <Checkbox defaultChecked>Ask before deleting events</Checkbox>
          <Checkbox defaultChecked>Ask before sending changes to events</Checkbox>
        </PreferencesWindowForm>
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
