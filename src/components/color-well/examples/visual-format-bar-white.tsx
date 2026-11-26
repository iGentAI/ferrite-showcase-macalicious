import { ColorWell } from "macalicious/color-well";

/**
 * Visual comparison target: the text colour well of TextEdit's format bar in Dark Aqua, where
 * the text colour is white. The crop and the layout are those of `visual-format-bar`.
 */
export default function VisualFormatBarWhite() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 29,
        height: 22,
        padding: "3px 0 0 4px",
        background: "linear-gradient(light-dark(#d9d9d9, #3c4043), light-dark(#cdcdcd, #37393c))",
      }}
    >
      <ColorWell
        variant="toolbar"
        aria-label="Text colour"
        defaultValue="#ffffff"
        style={{ display: "block" }}
      />
    </div>
  );
}
