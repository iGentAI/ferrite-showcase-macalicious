import type { CSSProperties } from "react";
import { CatalinaLaunchpad, type CatalinaLaunchpadProps } from "./launchpad";

/** A rectangle of the 1680 by 1050 pt screen, in points: left, top, width, height. */
type Rect = readonly [x: number, y: number, width: number, height: number];

export interface ReferencePatch {
  /** The comparison crop the patch lies behind: the value of its marker's `data-crop`. */
  crop: string;
  /** The crop, in points of the screen. */
  rect: Rect;
  /**
   * How far the painted backdrop reaches beyond the crop, in points: 0 where nothing blurs
   * it, and three times the blur's radius where the open folder blurs what is behind it.
   */
  margin?: number;
  /** The backdrop as measured in the captures: a CSS background for the patch's box. */
  background: string;
}

export interface ReferenceLaunchpadProps extends CatalinaLaunchpadProps {
  /** The measured backdrops, one behind each crop that is compared. */
  patches: readonly ReferencePatch[];
}

const box = ([x, y, width, height]: Rect, margin = 0): CSSProperties => ({
  position: "absolute",
  left: x - margin,
  top: y - margin,
  width: width + 2 * margin,
  height: height + 2 * margin,
});

/**
 * The demo as the Launchpad captures show it, for the visual comparisons: the 1680 by 1050 pt
 * screen with Launchpad showing.
 *
 * Behind Launchpad in the captures is Apple's desktop picture, blurred and dimmed, which the
 * demo does not have, and everything Launchpad draws is translucent over it. So a comparison
 * needs the captured backdrop behind its crop: the fixture paints, as the stage's `picture`,
 * one patch behind each crop, a gradient measured in the capture at that crop's edges, on a
 * neutral grey, and takes Launchpad's own scrim and blur off, since the patches are the
 * blurred and dimmed picture already. The library checks the scrim on its own, and
 * `visual-checks` checks it in this demo. The patches are not a picture of the desktop:
 * nothing outside the crops is painted.
 *
 * Over each crop lies an empty box, `data-crop`, that a comparison captures.
 */
export function ReferenceLaunchpad({ patches, ...props }: ReferenceLaunchpadProps) {
  return (
    <div
      style={
        {
          position: "relative",
          width: 1680,
          height: 1050,
          // The open folder's own dimming is in the measured backdrop already.
          "--mac-launchpad-folder-scrim": "transparent",
        } as CSSProperties
      }
    >
      <CatalinaLaunchpad
        defaultOpen
        style={{ width: 1680, height: 1050 }}
        overlayProps={{ style: { background: "none", backdropFilter: "none" } }}
        picture={
          <div style={{ position: "relative", background: "#808080" }}>
            {patches.map((patch) => (
              <div
                key={patch.crop}
                style={{ ...box(patch.rect, patch.margin), background: patch.background }}
              />
            ))}
          </div>
        }
        {...props}
      />
      {patches.map((patch) => (
        <div
          key={patch.crop}
          data-crop={patch.crop}
          style={{ ...box(patch.rect), pointerEvents: "none" }}
        />
      ))}
    </div>
  );
}
