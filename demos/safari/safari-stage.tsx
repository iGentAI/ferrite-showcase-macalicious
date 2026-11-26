import { type ReactNode, useState } from "react";
import { Safari } from "./safari";
import "./safari.tokens.css";

/*
 * The Safari window captures, in points: the image, which includes the window's shadow, and
 * where the frame sits in it. Aqua was captured at 1324 x 940 pt, Dark Aqua at 1254 x 903 pt.
 * The Aqua capture is compared without the outer 20 pt of its side margins, the first 10 pt
 * and the last 47 pt: the comparison harness cannot draw a review sheet of the whole image.
 */
const CAPTURES = {
  light: { width: 1396, height: 995, left: 36, top: 28 },
  dark: { width: 1366, height: 1015, left: 56, top: 38 },
  preferences: { width: 886, height: 620, left: 56, top: 38 },
} as const;

/**
 * The ground of a visual comparison: a box as large as the compared part of a window capture
 * (or its first `height` points), white where the capture is transparent, with the window
 * where the capture has it.
 */
export function SafariStage({
  capture,
  height,
  children,
}: {
  capture: keyof typeof CAPTURES;
  /** Show only this many points from the top of the capture. */
  height?: number;
  children: ReactNode;
}) {
  const size = CAPTURES[capture];
  return (
    <div
      style={{
        position: "relative",
        width: size.width,
        height: height ?? size.height,
        overflow: "hidden",
        background: "var(--mac-safari-capture-matte)",
      }}
    >
      <div style={{ position: "absolute", left: size.left, top: size.top }}>{children}</div>
    </div>
  );
}

/*
 * The Picture in Picture captures are the whole 1680 x 1050 pt screen. Where the Safari window
 * stands on it, and how tall it is: Aqua (158, 52), 864 pt; Dark Aqua (172, 39), 903 pt. The
 * floating video is 528 pt wide, 20 pt from the screen's right edge and 20 pt under the 22 pt
 * menu bar.
 */
const SCREENS = {
  light: { left: 158, top: 52, height: 864 },
  dark: { left: 172, top: 39, height: 903 },
} as const;

const SCREEN = { width: 1680, height: 1050, menuBar: 22 };

/**
 * The inactive window of the Picture in Picture captures, with its video floating in `screen`.
 * The video is the placeholder drawing, not the generated still (`artwork={false}`): its lower
 * band is one flat token colour, which the floating-video checks sample.
 */
function PictureInPictureWindow({
  capture,
  screen,
}: {
  capture: keyof typeof SCREENS;
  screen: Element | null;
}) {
  const at = SCREENS[capture];
  return (
    <Safari
      state="inactive"
      width={1254}
      height={at.height}
      style={{ position: "absolute", left: at.left, top: at.top - SCREEN.menuBar }}
      defaultTabs={["https://harbor.example/", "https://reel.example/"]}
      defaultActiveTab={1}
      defaultPictureInPicture
      pictureInPictureContainer={screen}
      pictureInPictureWidth={528}
      artwork={false}
    />
  );
}

/*
 * The part of the screen the floating-video checks capture: from 1100 pt across and right
 * under the menu bar, 580 x 340 pt. The video's rectangle in the captures, (1132, 42) and
 * 528 x 297 pt on the screen, is (32, 20) to (560, 317) here.
 */
const VIDEO_REGION = { left: 1100, width: 580, height: 340 };

/**
 * The ground of the floating-video checks: the top trailing part of the screen of the Picture
 * in Picture captures, with the inactive Safari window where the capture has it and the video
 * floating in the screen. Nothing of the capture's video can be compared (it is a third-party
 * frame), and nothing of the demo's generated still is shown, so the checks pin the drawing's
 * rectangle to the captured one pixel by pixel.
 */
export function SafariFloatingVideoStage({ capture }: { capture: keyof typeof SCREENS }) {
  const [screen, setScreen] = useState<HTMLDivElement | null>(null);
  return (
    <div
      style={{
        position: "relative",
        width: VIDEO_REGION.width,
        height: VIDEO_REGION.height,
        overflow: "hidden",
        background: "var(--mac-safari-capture-matte)",
      }}
    >
      <div
        ref={setScreen}
        style={{
          position: "absolute",
          left: -VIDEO_REGION.left,
          top: 0,
          width: SCREEN.width,
          height: SCREEN.height - SCREEN.menuBar,
        }}
      >
        <PictureInPictureWindow capture={capture} screen={screen} />
      </div>
    </div>
  );
}

/*
 * The Sharing captures are a region of the screen with the window's top trailing corner and the
 * Share menu, which hangs 67 pt past the window's edge over the desktop. The window is
 * 1254 pt wide in both; here it stands 20 pt from the stage's left edge and 10 pt from its top.
 */
const SHARING = { left: 20, top: 10, width: 1254 };

/**
 * The ground of the Sharing comparisons: a window with one tab on a page that can be shared.
 * The comparison opens the Share menu and points at Messages, and captures three boxes of the
 * stage: the last 160 pt of the toolbar, with the top of the menu under it, and two pieces of
 * the menu's highlighted row, each the row's whole height (98 to 119 pt from the window's
 * corner) where it has neither glyph nor label: 14 pt at its leading end, over the page, and
 * the last 20 pt before the menu's trailing rim, over the desktop past the window's edge (the
 * capture's menu is at (1139, 33) from the window's corner, 182 pt wide). The menu's rectangle
 * is checked by pixels of the whole stage.
 */
export function SafariSharingStage() {
  const box = { position: "absolute", pointerEvents: "none" } as const;
  return (
    <div
      style={{
        position: "relative",
        width: SHARING.left + SHARING.width + 86,
        height: 250,
        overflow: "hidden",
        background: "var(--mac-safari-capture-matte)",
      }}
    >
      <Safari
        width={SHARING.width}
        height={864}
        style={{ position: "absolute", left: SHARING.left, top: SHARING.top }}
        defaultTabs={["https://harbor.example/"]}
      />
      <div
        data-capture="toolbar"
        style={{
          ...box,
          left: SHARING.left + SHARING.width - 160,
          top: SHARING.top,
          width: 160,
          height: 38,
        }}
      />
      <div
        data-capture="highlight-leading"
        style={{ ...box, left: SHARING.left + 1140, top: SHARING.top + 98, width: 14, height: 21 }}
      />
      <div
        data-capture="highlight-trailing"
        style={{ ...box, left: SHARING.left + 1300, top: SHARING.top + 98, width: 20, height: 21 }}
      />
    </div>
  );
}

/**
 * The ground of the Picture in Picture comparison: the top 63 pt of the inactive Safari window
 * (toolbar and tab bar) from its left edge to 60 pt past the left edge of the floating video,
 * which covers the window's trailing end. The screen under the menu bar is the element the
 * video floats in, placed so that the window's corner is the stage's.
 */
export function SafariPictureInPictureStage({ capture }: { capture: keyof typeof SCREENS }) {
  const at = SCREENS[capture];
  const [screen, setScreen] = useState<HTMLDivElement | null>(null);
  return (
    <div
      style={{
        position: "relative",
        width: SCREEN.width - 20 - 528 - at.left + 60,
        height: 63,
        overflow: "hidden",
        background: "var(--mac-safari-capture-matte)",
      }}
    >
      <div
        ref={setScreen}
        style={{
          position: "absolute",
          left: -at.left,
          top: SCREEN.menuBar - at.top,
          width: SCREEN.width,
          height: SCREEN.height - SCREEN.menuBar,
        }}
      >
        <PictureInPictureWindow capture={capture} screen={screen} />
      </div>
    </div>
  );
}
