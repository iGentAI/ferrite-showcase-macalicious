import { EditorialCard } from "macalicious/editorial-card";

/**
 * Visual comparison target: the eyebrow and title of the App Store's hero. Reference crop
 * x=660 y=160 w=480 h=180, i.e. 240 x 90 pt, 13 pt in from the hero's left edge and 42 pt
 * below the window's top, where the capture cuts the hero. The fixture's hero is 360 pt tall,
 * 20 pt more than the capture shows, and its top lies 20 pt above the window's: the text is
 * set from the hero's bottom edge, so it stands where the capture has it whatever is cut off
 * above. The photograph behind the text is cloud, which darkens towards
 * the mountains; the fixture's artwork is a gradient through its colour every 7 to 35 pt down
 * the middle of the crop, in each capture (the two captures are scrolled differently).
 */
export default function VisualHeroText() {
  const cloud = [
    "light-dark(#e9e8e5, #f3f3f1) 62px",
    "light-dark(#e6e5e2, #efefed) 97px",
    "light-dark(#d9d9d6, #e6e7e4) 125px",
    "light-dark(#d0d2d0, #e6e6e4) 132px",
    "light-dark(#c4c8c8, #dfe0df) 139px",
    "light-dark(#b8bfc1, #d5d8d8) 146px",
    "light-dark(#bcc5c6, #c9cdcd) 153px",
  ];
  return (
    <div style={{ position: "relative", overflow: "hidden", width: 240, height: 90 }}>
      <EditorialCard
        variant="hero"
        eyebrow="Get Started"
        title="Extensions for Fast Photo Edits"
        artwork={<span style={{ background: `linear-gradient(${cloud.join(", ")})` }} />}
        style={{ position: "absolute", left: -13, top: -62, width: 945, height: 360 }}
      />
    </div>
  );
}
