import { createFileSystem, HOME } from "./finder-data";
import { FinderQuickLook } from "./finder-quick-look";

/**
 * The panel's material frame in each capture, in points, and what stands behind the panel in
 * place of the capture's desktop picture: the colours that, blurred and tinted by the panel's
 * material, give the bar the colours measured along it, from its leading to its trailing end.
 */
const CAPTURES = {
  light: {
    width: 892,
    height: 547,
    backdrop: "linear-gradient(to right, #5f93ba, #6b99b8 30%, #7da0bd 60%, #85a6c0 78%)",
  },
  dark: {
    width: 1103,
    height: 603,
    backdrop:
      "linear-gradient(to right, #263345, #1f2d3d 30%, #1f2b3c 60%, #1b2638 76%, #0d1f39 90%, #0d1e36)",
  },
};

export interface QuickLookCaptureProps {
  /** The appearance of the capture, which decides the panel's size. */
  appearance: keyof typeof CAPTURES;
  /** Whether the panel is in Markup mode. */
  markup?: boolean;
}

const root = createFileSystem();
const ignore = () => {};

/**
 * Quick Look of the ninth picture of Downloads as a reference capture shows it: the panel's
 * material frame over a stand-in for the desktop, with every action enabled.
 */
export function QuickLookCapture({ appearance, markup = false }: QuickLookCaptureProps) {
  const { width, height, backdrop } = CAPTURES[appearance];
  return (
    <div style={{ position: "relative", overflow: "hidden", width, height, background: backdrop }}>
      <FinderQuickLook
        root={root}
        path={`${HOME}/Downloads/10-9.jpg`}
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0 }}
        markup={markup}
        onRotate={ignore}
        onOpen={ignore}
        onShare={ignore}
      />
    </div>
  );
}
