import { Label, type LabelTextStyle } from "macalicious/label";

const styles: { textStyle: LabelTextStyle; note: string }[] = [
  { textStyle: "body", note: "13 / 16 regular" },
  { textStyle: "emphasized", note: "13 / 16 bold" },
  { textStyle: "callout", note: "12 / 15 regular" },
  { textStyle: "small", note: "11 / 14 regular" },
  { textStyle: "small-emphasized", note: "11 / 14 bold" },
  { textStyle: "mini", note: "10 / 13 regular" },
  { textStyle: "large-value", note: "27 / 32 regular" },
  { textStyle: "headline", note: "13 / 16 bold" },
  { textStyle: "subheadline", note: "11 / 14 regular" },
  { textStyle: "title-3", note: "15 / 20, provisional" },
  { textStyle: "title-2", note: "17 / 22, provisional" },
  { textStyle: "title-1", note: "22 / 26, provisional" },
  { textStyle: "large-title", note: "26 / 32, provisional" },
];

/** Every text style, with its size, line height and weight. */
export default function TextStyles() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "max-content max-content",
        gap: "8px 24px",
        alignItems: "baseline",
      }}
    >
      {styles.map(({ textStyle, note }) => (
        <div key={textStyle} style={{ display: "contents" }}>
          <Label textStyle={textStyle}>{textStyle}</Label>
          <Label textStyle="small" color="secondary">
            {note}
          </Label>
        </div>
      ))}
    </div>
  );
}
