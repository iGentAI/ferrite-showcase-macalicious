/**
 * Fixture for the find highlight, `--mac-color-find-highlight`: a word a search has found, on a
 * document page. `text-view.visual.json` checks the tint in both appearances.
 *
 * 120 x 36 pt of white paper, as a PDF page is in both appearances. The mark covers x 40 to 80,
 * y 8 to 28. The Dark Aqua tint is measured in Preview (10-15-Catalina-Dark-Preview-Search.png,
 * the match at 2033,584,70,39); no capture shows a match in Aqua.
 */
export default function VisualFindHighlight() {
  return (
    <div
      style={{
        position: "relative",
        width: 120,
        height: 36,
        background: "#ffffff",
      }}
    >
      <mark
        style={{
          position: "absolute",
          left: 40,
          top: 8,
          width: 40,
          height: 20,
          background: "var(--mac-color-find-highlight)",
          color: "#000000",
        }}
      />
    </div>
  );
}
