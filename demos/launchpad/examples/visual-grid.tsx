import { ReferenceLaunchpad } from "../launchpad-visual";

/**
 * Visual comparison target: page 1 of Launchpad on the 1680 by 1050 pt screen, as the
 * Launchpad captures show it, in both appearances (the colours are `light-dark()`).
 *
 * Five parts of the screen are compared, each a `data-crop` box, with the capture's backdrop
 * painted behind it as measured at the crop's edges (see `ReferenceLaunchpad`). Crops in 2x
 * pixels of the captures, and what each shows:
 *
 *   search        1400,30,560,90     the search field, 250 x 25 pt at 715,25
 *   pages         1620,1810,120,52   the two page dots, centres 828.75 and 848.75, 918
 *   folder-tile   2720,1128,256,296  the folder "Other" in the 28th place, with its name
 *   label-first   358,372,300,48     the name under the first application, "App Store"
 *   label-last    2698,1700,300,48   the name under the last one, "Image Capture"
 *
 * The backdrops of the first three are the ones the library's own comparisons of these parts
 * measured.
 */
export default function VisualGrid() {
  return (
    <ReferenceLaunchpad
      patches={[
        {
          crop: "search",
          rect: [700, 15, 280, 45],
          background:
            "linear-gradient(to bottom right, light-dark(#2c6ea4, #0d2a55), light-dark(#3971a2, #08274e))",
        },
        {
          crop: "pages",
          rect: [810, 905, 60, 26],
          background:
            "linear-gradient(to bottom right, light-dark(#1c2c3a, #111d2e), light-dark(#0c2436, #0e1b2a))",
        },
        {
          crop: "folder-tile",
          rect: [1360, 564, 128, 148],
          background:
            "linear-gradient(light-dark(#34546c, #1a3354), light-dark(#244663, #142944) 124px, light-dark(#214460, #122843))",
        },
        {
          crop: "label-first",
          rect: [179, 186, 150, 24],
          background: "linear-gradient(light-dark(#4e82a7, #1e3c66), light-dark(#5583a7, #21406a))",
        },
        {
          crop: "label-last",
          rect: [1349, 850, 150, 24],
          background: "linear-gradient(light-dark(#11334e, #0f1f34), light-dark(#10304a, #0e1e33))",
        },
      ]}
    />
  );
}
