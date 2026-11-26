import { ColorSwatchPicker, ThumbnailSwatch } from "macalicious/color-swatch-picker";
import { useState } from "react";

/* Stand-in artwork: Catalina's thumbnails are miniature desktops, which the library does not
   ship. Any image or element works as the picture. */
const art = {
  light: "linear-gradient(160deg, #9fc4f5, #e9c7d8)",
  dark: "linear-gradient(160deg, #1d2b4f, #5b3a5e)",
  auto: "linear-gradient(90deg, #9fc4f5 50%, #1d2b4f 50%)",
};

/** A choice between pictures, as Appearance in System Preferences: Light, Dark or Auto. */
export default function Thumbnails() {
  const [appearance, setAppearance] = useState("light");
  return (
    <ColorSwatchPicker aria-label="Appearance" value={appearance} onValueChange={setAppearance}>
      <ThumbnailSwatch value="light" label="Light">
        <span aria-hidden="true" style={{ background: art.light }} />
      </ThumbnailSwatch>
      <ThumbnailSwatch value="dark" label="Dark">
        <span aria-hidden="true" style={{ background: art.dark }} />
      </ThumbnailSwatch>
      <ThumbnailSwatch value="auto" label="Auto">
        <span aria-hidden="true" style={{ background: art.auto }} />
      </ThumbnailSwatch>
    </ColorSwatchPicker>
  );
}
