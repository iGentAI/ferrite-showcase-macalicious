import { MenuBar, MenuBarMenu } from "macalicious/menu-bar";
import { MenuBarExtra, MenuBarExtraMenu, MenuBarExtras } from "macalicious/menu-bar-extra";
import { MenuItem } from "macalicious/menu-item";
import { type ReactNode, useState } from "react";

/**
 * The desktop picture just under the trailing end of the menu bar (Desktop screenshots, y 47,
 * every 100 px from x 2500): sky that turns into cloud in Aqua. A stand-in for the picture,
 * which is Apple's and is not shipped.
 */
const sky =
  "linear-gradient(to right, light-dark(#5f93bd, #022244), light-dark(#6592bd, #042143) 50px, light-dark(#6795bf, #032143) 100px, light-dark(#6d9bc0, #032042) 150px, light-dark(#78a0c2, #022042) 200px, light-dark(#90abc7, #041d40) 250px, light-dark(#9cb3c8, #021c3d) 300px, light-dark(#9bb2c7, #021b3c) 350px, light-dark(#9bb5c8, #011a3b) 400px)";

/** A stand-in for a system template image, with the size of its ink box in the screenshots. */
function Glyph({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const cell = (width: number, testid?: string) =>
  ({ "data-testid": testid, style: { width, justifyContent: "center", padding: 0 } }) as object;

/**
 * The menu bar extras of the Desktop screenshots: crop 2500,0 of 860 x 46 px. The cells have
 * the widths measured there (40, 29, 33, 36, 107, 64, 36, 30 and 46 pt from Time Machine to
 * Notification Center); the images are stand-ins of the same size. The comparisons click and
 * point at the cells.
 */
export default function VisualExtras() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const popup = { container: stage, collisionPadding: 0 };
  return (
    <div
      ref={setStage}
      style={{ position: "relative", width: 430, height: 23, overflow: "hidden", background: sky }}
    >
      <MenuBar
        style={{ position: "absolute", insetInlineEnd: 0, width: 640 }}
        extras={
          <MenuBarExtras>
            <MenuBarExtraMenu
              aria-label="Time Machine"
              titleProps={cell(40, "time-machine")}
              popup={popup}
              title={
                <Glyph width={18.5} height={16}>
                  <circle cx="9.25" cy="8" r="7" />
                  <path d="M9.25 4v4l3 2" />
                </Glyph>
              }
            >
              <MenuItem>Back Up Now</MenuItem>
            </MenuBarExtraMenu>
            <MenuBarExtraMenu
              aria-label="Wi-Fi"
              titleProps={cell(29)}
              popup={popup}
              title={
                <Glyph width={20} height={14.5}>
                  <path d="M1 5a13 13 0 0 1 18 0L10 14Z" fill="currentColor" stroke="none" />
                </Glyph>
              }
            >
              <MenuItem>Turn Wi-Fi Off</MenuItem>
            </MenuBarExtraMenu>
            <MenuBarExtraMenu
              aria-label="AirPlay"
              titleProps={cell(33)}
              popup={popup}
              title={
                <Glyph width={18} height={14}>
                  <rect x="0.5" y="0.5" width="17" height="10" rx="1.5" />
                  <path d="M5 14l4-4 4 4Z" fill="currentColor" stroke="none" />
                </Glyph>
              }
            >
              <MenuItem>Open Displays Preferences…</MenuItem>
            </MenuBarExtraMenu>
            <MenuBarExtraMenu
              aria-label="Battery"
              titleProps={cell(36, "battery")}
              popup={popup}
              title={
                <Glyph width={22.5} height={12}>
                  <rect x="0.5" y="0.5" width="19" height="11" rx="2.5" />
                  <rect
                    x="2"
                    y="2"
                    width="16"
                    height="8"
                    rx="1"
                    fill="currentColor"
                    stroke="none"
                  />
                  <rect x="21" y="4" width="1.5" height="4" fill="currentColor" stroke="none" />
                </Glyph>
              }
            >
              <MenuItem>Show Percentage</MenuItem>
            </MenuBarExtraMenu>
            <MenuBarExtraMenu title="Thu 10:07 AM" titleProps={cell(107)} popup={popup}>
              <MenuItem>Open Date &amp; Time Preferences…</MenuItem>
            </MenuBarExtraMenu>
            <MenuBarExtraMenu title="Stephen" titleProps={cell(64, "user")} popup={popup}>
              <MenuItem>Login Window…</MenuItem>
            </MenuBarExtraMenu>
            <MenuBarExtra aria-label="Spotlight" {...cell(36, "spotlight")}>
              <Glyph width={13.5} height={13.5}>
                <circle cx="5.5" cy="5.5" r="4.5" strokeWidth="1.5" />
                <path d="m9 9 4 4" strokeWidth="1.5" />
              </Glyph>
            </MenuBarExtra>
            <MenuBarExtra aria-label="Siri" {...cell(30)}>
              <Glyph width={16} height={16}>
                <circle cx="8" cy="8" r="8" fill="currentColor" stroke="none" />
              </Glyph>
            </MenuBarExtra>
            <MenuBarExtra
              aria-label="Notification Center"
              style={{ width: 46, padding: "0 23px 0 5px" }}
            >
              <Glyph width={18} height={10}>
                <path d="M0 1h18M0 5h18M0 9h18" strokeWidth="2" />
              </Glyph>
            </MenuBarExtra>
          </MenuBarExtras>
        }
      >
        <MenuBarMenu title="Finder" application popup={popup}>
          <MenuItem>About Finder</MenuItem>
        </MenuBarMenu>
      </MenuBar>
    </div>
  );
}
