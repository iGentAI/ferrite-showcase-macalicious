import { ImageButton } from "macalicious/image-button";

const logo: string | null = null;

/**
 * Fixture for a button that has a label and no image: the keyboard focus ring must surround
 * the label, the only thing shown. `image-button.visual.json` reaches each with Tab.
 *
 * 184 x 40 pt: 8 pt of page on every side, two buttons 80 pt wide 8 pt apart, each with 5 pt
 * of clear space around one 14 pt line of label, so a label is y 13 to 27 and spans its
 * button's centre line (x 48 and x 136) whatever the font. The first has no children; the
 * second has children that render nothing, which leaves an empty image box in the markup.
 */
export default function VisualLabelOnly() {
  return (
    <div style={{ display: "flex", gap: 8, padding: 8 }}>
      <ImageButton label="Label" style={{ width: 80 }} />
      <ImageButton label="Label" style={{ width: 80 }}>
        {[logo && <img key="logo" src={logo} alt="" />]}
      </ImageButton>
    </div>
  );
}
