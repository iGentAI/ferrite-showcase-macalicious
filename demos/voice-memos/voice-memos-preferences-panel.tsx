"use client";

import { Checkbox } from "macalicious/checkbox";
import { InspectorPanel } from "macalicious/inspector-panel";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import type { AudioQuality, ClearDeleted, VoiceMemosPreferences } from "./voice-memos-preferences";

export interface VoiceMemosPreferencesPanelProps {
  value: VoiceMemosPreferences;
  /** Called with the Preferences chosen. Left out, as in the demo that keeps nothing, they are dimmed. */
  onChange?: (next: VoiceMemosPreferences) => void;
  /** Why recordings are numbered although Location-based Naming is on. */
  namingProblem?: string | null;
  onClose: () => void;
}

/** Voice Memos' Preferences: a panel over the window, as the app renders its own. */
export function VoiceMemosPreferencesPanel({
  value,
  onChange,
  namingProblem,
  onClose,
}: VoiceMemosPreferencesPanelProps) {
  return (
    <InspectorPanel
      title="Voice Memos Preferences"
      className="mac-voice-memos-preferences"
      aria-label="Preferences"
      width={340}
      onClose={onClose}
    >
      <div className="mac-voice-memos-preferences-body">
        <Label>Clear Deleted:</Label>
        <PopUpButton<ClearDeleted>
          aria-label="Clear Deleted"
          disabled={!onChange}
          value={value.clearDeleted}
          onValueChange={(next) => {
            if (next) onChange?.({ ...value, clearDeleted: next });
          }}
        >
          <PopUpButtonItem value="immediately">Immediately</PopUpButtonItem>
          <PopUpButtonItem value="day">After 1 Day</PopUpButtonItem>
          <PopUpButtonItem value="week">After 7 Days</PopUpButtonItem>
          <PopUpButtonItem value="month">After 30 Days</PopUpButtonItem>
          <PopUpButtonItem value="never">Never</PopUpButtonItem>
        </PopUpButton>
        <Label>Audio Quality:</Label>
        <PopUpButton<AudioQuality>
          aria-label="Audio Quality"
          disabled={!onChange}
          value={value.audioQuality}
          onValueChange={(next) => {
            if (next) onChange?.({ ...value, audioQuality: next });
          }}
        >
          <PopUpButtonItem value="compressed">Compressed</PopUpButtonItem>
          <PopUpButtonItem value="lossless">Lossless</PopUpButtonItem>
        </PopUpButton>
        <span />
        <Checkbox
          disabled={!onChange}
          checked={value.locationNaming === true}
          onCheckedChange={(checked) => {
            const { locationNaming: _old, ...rest } = value;
            onChange?.(checked === true ? { ...rest, locationNaming: true } : rest);
          }}
        >
          Location-based Naming
        </Checkbox>
        {value.locationNaming && namingProblem ? (
          <>
            <span />
            <Label color="secondary">{namingProblem}</Label>
          </>
        ) : null}
      </div>
      {onChange ? null : <Label color="secondary">This demo keeps no recordings.</Label>}
    </InspectorPanel>
  );
}
