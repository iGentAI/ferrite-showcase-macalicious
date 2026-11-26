import { TextView } from "macalicious/text-view";

/**
 * A note on paper, as in the Notes editor: the view's fill is set through
 * `--mac-text-view-background`. The colours are the ones measured in the Notes screenshots,
 * `#f9f9f7` in Aqua and `#232425` in Dark Aqua. Apple's paper texture is a bitmap and is not
 * reproduced; the variable takes any CSS background, so an application can supply its own.
 */
export default function Paper() {
  return (
    <div style={{ width: 320, height: 96 }}>
      <TextView
        aria-label="Note"
        defaultValue={"Groceries\nOat milk, coffee, lemons"}
        style={{ ["--mac-text-view-background" as string]: "light-dark(#f9f9f7, #232425)" }}
      />
    </div>
  );
}
