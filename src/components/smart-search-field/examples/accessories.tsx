import { SmartSearchField, SmartSearchFieldButton } from "macalicious/smart-search-field";
import { useState } from "react";

/**
 * The accessories: the Reader button at the leading edge, which stays filled while Reader is
 * on and swaps Reload for the text options, and the audio button of a page that plays sound.
 */
export default function Accessories() {
  const [reader, setReader] = useState(false);
  const [muted, setMuted] = useState(false);

  return (
    <div style={{ width: 420 }}>
      <SmartSearchField
        defaultValue="https://www.example.com/article"
        secure
        leading={
          <SmartSearchFieldButton
            glyph="reader"
            pressed={reader}
            aria-label="Reader View"
            onClick={() => setReader(!reader)}
          />
        }
        trailing={
          <>
            <SmartSearchFieldButton
              glyph="audio"
              aria-label={muted ? "Unmute this tab" : "Mute this tab"}
              onClick={() => setMuted(!muted)}
              style={{ opacity: muted ? 0.4 : undefined }}
            />
            {reader ? (
              <SmartSearchFieldButton glyph="text-size" aria-label="Reader appearance" />
            ) : (
              <SmartSearchFieldButton glyph="reload" aria-label="Reload this page" />
            )}
          </>
        }
      />
    </div>
  );
}
