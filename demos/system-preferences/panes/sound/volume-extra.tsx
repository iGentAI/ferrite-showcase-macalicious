"use client";

import { MenuBarExtraMenu } from "macalicious/menu-bar-extra";
import { MenuCheckboxItem, MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Slider } from "macalicious/slider";
import {
  readBoolean,
  readNumber,
  useDesktopSetting,
  useDesktopValue,
} from "../../../desktop/desktop-personal";
import { FULL_OUTPUT_VOLUME, playVolumeFeedback } from "./alert-sounds";

/** Stand-in for the menu bar's speaker: an original drawing, with arcs while there is sound. */
function VolumeGlyph({ silent }: { silent: boolean }) {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true" focusable="false">
      <path d="M0 4.5h3L7.5 1v12L3 9.5H0z" fill="currentColor" />
      {silent ? null : (
        <path
          d="M10 4.5a3.5 3.5 0 0 1 0 5M12.5 2.5a6.5 6.5 0 0 1 0 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/**
 * Sound's "Show volume in menu bar": the same Output volume and Mute as the pane, so what they
 * govern is this desktop's sounds, as the menu says.
 */
export function VolumeMenuExtra({ onPreferences }: { onPreferences: () => void }) {
  const shown = useDesktopValue("sound.showInMenuBar", readBoolean, false);
  const [volume, setVolume] = useDesktopSetting(
    "sound.outputVolume",
    readNumber,
    FULL_OUTPUT_VOLUME,
  );
  const [mute, setMute] = useDesktopSetting("sound.mute", readBoolean, false);
  const feedback = useDesktopValue("sound.volumeFeedback", readBoolean, false);
  if (!shown) return null;
  return (
    <MenuBarExtraMenu
      aria-label={mute ? "Volume, muted" : `Volume, ${volume}%`}
      titleProps={{ style: { width: 32, justifyContent: "center", padding: 0 } }}
      title={<VolumeGlyph silent={mute || volume === 0} />}
    >
      <MenuItem disabled>This desktop's volume</MenuItem>
      {/* The slider keeps its arrow keys: the menu would take them to move between items. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: only passes the keys on to the slider inside */}
      <div style={{ padding: "4px 20px" }} onKeyDown={(event) => event.stopPropagation()}>
        <Slider
          aria-label="This desktop's volume"
          value={volume}
          onValueChange={(next) => setVolume(next as number)}
          onValueCommitted={(next) => {
            if (feedback && !mute) playVolumeFeedback(next as number);
          }}
          style={{ width: 160 }}
        />
      </div>
      <MenuCheckboxItem checked={mute} onCheckedChange={(checked) => setMute(checked)}>
        Mute
      </MenuCheckboxItem>
      <MenuSeparator />
      <MenuItem disabled>A web page cannot change your computer's volume.</MenuItem>
      <MenuSeparator />
      <MenuItem onClick={onPreferences}>Sound Preferences…</MenuItem>
    </MenuBarExtraMenu>
  );
}
