import { type CSSProperties, type ReactNode, useState } from "react";
import type { FinderNode } from "./finder-data";

/** The movie of the Copy and Replace captures, as a document of the demo. */
export const MOVIE: FinderNode = {
  name: "Pippin - Apple's Forgotten Game Console.mov",
  kind: "document",
  size: 6_000_000_000,
};

/** For a callback a capture never calls. */
export const ignore = () => {};

/** Where the window captures have their window: 56 pt in and 38 pt down, in their shadow. */
export const AT_CAPTURE: CSSProperties = { position: "absolute", top: 38, left: 56, margin: 0 };

export interface CaptureStageProps {
  /** The size of the capture, in points. */
  width: number;
  height: number;
  /**
   * The window background of the Dark Aqua capture, which is the dark window colour tinted by
   * the desktop picture that was behind the window: it depends on what is behind, so the stage
   * sets it.
   */
  darkWindow: string;
  /** The window, given the stage's element to be rendered into. */
  children: (stage: HTMLDivElement | null) => ReactNode;
}

/**
 * A whole window capture: the capture's transparent margin (matte white) with an alert or a
 * dialog rendered into it instead of into the page, so that the window and its shadow are part
 * of the picture.
 */
export function CaptureStage({ width, height, darkWindow, children }: CaptureStageProps) {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setStage}
      style={
        {
          position: "relative",
          overflow: "hidden",
          width,
          height,
          background: "#ffffff",
          "--mac-color-window-background": `light-dark(#ececec, ${darkWindow})`,
        } as CSSProperties
      }
    >
      {children(stage)}
    </div>
  );
}
