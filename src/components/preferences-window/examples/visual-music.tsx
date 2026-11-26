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
import { Separator } from "macalicious/separator";

const ITEMS: [value: string, label: string, width: number][] = [
  ["general", "General", 49],
  ["playback", "Playback", 54.75],
  ["files", "Files", 41],
  ["restrictions", "Restrictions", 69.75],
  ["advanced", "Advanced", 59.75],
];

/**
 * Visual comparison target: the whole frame of Music's preferences, the modal kind. Reference
 * crop (2x pixels) x=112 y=76 w=1066 h=584, i.e. 533 x 292 pt, over the capture's transparent
 * margin (matte white). Music lays its form out against the left edge rather than centred and
 * with rows of its own heights (24, 24, 20 and 30 pt), so the example sets the label column's
 * width and each row's height; the List Size pop-up button is left out and masked, as are the
 * toolbar icons.
 */
export default function VisualMusic() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 533,
        height: 292,
        background: "#ffffff",
      }}
    >
      <PreferencesWindow
        modal
        width={533}
        height={292}
        style={{ position: "absolute", inset: 0 }}
        toolbar={
          <PreferencesToolbar aria-label="Music preferences" alignment="center">
            {ITEMS.map(([value, label, width], index) => (
              <PreferencesToolbarItem
                key={value}
                value={value}
                style={{
                  width,
                  minWidth: 0,
                  paddingInline: 0,
                  marginInlineStart: index === 0 ? -4.5 : 0,
                }}
              >
                {label}
              </PreferencesToolbarItem>
            ))}
          </PreferencesToolbar>
        }
      >
        <PreferencesWindowPane value="general" style={{ paddingBlock: "17px 0" }}>
          <PreferencesWindowForm
            style={{
              gridTemplateColumns: "152px 1fr",
              justifyContent: "start",
              ["--mac-preferences-window-row-gap" as string]: "0px",
            }}
          >
            <PreferencesWindowRow label="Show:" align="center" style={{ height: 24 }}>
              <Checkbox defaultChecked>iTunes Store</Checkbox>
            </PreferencesWindowRow>
            <PreferencesWindowRow align="center" style={{ height: 24 }}>
              <Checkbox>Star ratings</Checkbox>
            </PreferencesWindowRow>
            <PreferencesWindowRow align="center" style={{ height: 20 }}>
              <Checkbox>Songs list checkboxes</Checkbox>
            </PreferencesWindowRow>
            <PreferencesWindowRow label="List Size:" align="center" style={{ height: 30 }} />
            <Separator style={{ marginBlock: "4px 7px" }} />
            <PreferencesWindowRow label="Notifications:" align="center" style={{ height: 20 }}>
              <Checkbox defaultChecked>When song changes</Checkbox>
            </PreferencesWindowRow>
          </PreferencesWindowForm>
          <Separator style={{ marginInline: -20, marginBlockStart: 7 }} />
          <PreferencesWindowFooter
            leading={<HelpButton />}
            style={{ height: 22, marginBlockStart: 17.5 }}
          >
            <PushButton style={{ width: 70, paddingInline: 0 }}>Cancel</PushButton>
            <PushButton variant="primary" style={{ width: 70, paddingInline: 0 }}>
              OK
            </PushButton>
          </PreferencesWindowFooter>
        </PreferencesWindowPane>
      </PreferencesWindow>
    </div>
  );
}
