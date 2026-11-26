import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { useState } from "react";

/**
 * The Catalina desktop picture behind the Go menu (sky, then the island) as a grid of the
 * colours of the Desktop screenshots: one row of five colours, left to right, for each band
 * of the crop, in Aqua and in Dark Aqua. A stand-in for the picture, which is Apple's and is
 * not shipped.
 */
const tops = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 394];
const light = [
  "66a3d2 66a2d2 65a1d1 64a0d0 619ecf",
  "86beed 81bcec 84bdec 7dbaeb 7ab7e9",
  "86c0ef 86c0ef 84beee 84beed 80bcec",
  "87c3f1 87c1f1 86c1f0 84bfef 7fbeee",
  "8fc8f3 8fc8f3 8fc7f3 8cc5f1 8ac3f0",
  "9bcff5 9bcef4 9acdf3 98ccf3 96caf2",
  "a6d5f7 a6d4f7 aad4f5 b0d6f5 acd4f3",
  "acdaf8 aed9f7 acd7f6 afd9f5 b0d7f5",
  "b7ddf8 b7ddf8 b6dcf7 949495 707479",
  "a0acb9 b6d3e8 777a81 707270 626565",
  "928f95 928a89 7d7671 6c6964 787468",
  "6085a8 6185a7 7b8697 a19691 b8a18d",
  "658bac 6a8fae 658aa9 6187a8 6f7f91",
  "5a82a4 5a82a4 5881a3 537da0 537da0",
];
const dark = [
  "254671 244470 22426e 21416c 1e3e69",
  "24446e 24446e 23436d 21416b 20406a",
  "25446f 23436d 22426c 23426d 22426c",
  "25436c 25446d 274671 264670 264570",
  "2c4c76 2b4b75 2b4b75 2b4a74 2a4a74",
  "33547e 32537d 2f4f79 304f7a 2f507a",
  "33537d 2f4e78 2c4b74 2b4a74 2a4973",
  "486a91 40608a 496b92 486a91 44668e",
  "57789d 53759a 53759a 254064 1f375a",
  "415e82 547397 244166 1b3759 173250",
  "426187 2d4b71 203c5e 173454 203a58",
  "4f7397 4e7094 415f80 465f7c 3e5470",
  "507397 4c6f93 45688c 4a6d90 425e7c",
  "4b6e92 4c6f92 4b6e91 4d7192 4d7192",
];
// One element for each band: a single background of all of them is more than the test
// environment's CSS parser takes.
const picture = light.map((row, band) => {
  const night = (dark[band] as string).split(" ");
  const stops = row
    .split(" ")
    .map((day, column) => `light-dark(#${day}, #${night[column]}) ${column * 25}%`);
  const top = tops[band] as number;
  const height = (tops[band + 1] as number) - top;
  const background = `linear-gradient(to right, ${stops})`;
  return (
    <div key={top} style={{ position: "absolute", insetInline: 0, top, height, background }} />
  );
});

/** A stand-in for Finder's 16 pt template images of places, which are Apple's. */
const place = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" />
  </svg>
);

const places = [
  ["Recents", "shift+command+f"],
  ["Documents", "shift+command+o"],
  ["Desktop", "shift+command+d"],
  ["Downloads", "option+command+l"],
  ["Home", "shift+command+h"],
  ["Computer", "shift+command+c"],
  ["AirDrop", "shift+command+r"],
  ["Network", "shift+command+k"],
  ["iCloud Drive", "shift+command+i"],
  ["Applications", "shift+command+a"],
  ["Utilities", "shift+command+u"],
] as const;

/**
 * Finder's Go menu as in the Finder-Go-Menu screenshots: crop 472,44 of 422 x 788 px. The
 * menu hangs from the menu bar's lower edge at x 5 and is 201 pt wide and 389 pt high: three
 * 19 pt rows, eleven 21 pt rows with an image, a submenu parent and two more rows. The
 * comparison hovers "Enclosing Folder".
 */
export default function VisualGoMenu() {
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setStage} style={{ position: "relative", width: 211, height: 394 }}>
      {picture}
      <div
        style={{
          position: "absolute",
          inset: "0 0 auto",
          height: 1,
          background: "light-dark(rgb(0 0 0 / 0.16), rgb(0 0 0 / 0.36))",
        }}
      />
      <Menu defaultOpen modal={false}>
        <MenuTrigger
          aria-label="Go"
          style={{
            position: "absolute",
            left: 5,
            top: -22,
            width: 37,
            height: 22,
            padding: 0,
            border: 0,
            background: "none",
          }}
        />
        <MenuPopup attached container={stage} collisionPadding={0} style={{ width: 201 }}>
          <MenuItem keyEquivalent="command+[" disabled>
            Back
          </MenuItem>
          <MenuItem keyEquivalent="command+]" disabled>
            Forward
          </MenuItem>
          <MenuItem keyEquivalent="command+up" data-testid="enclosing">
            Enclosing Folder
          </MenuItem>
          <MenuSeparator />
          {places.map(([title, keyEquivalent]) => (
            <MenuItem key={title} image={place} keyEquivalent={keyEquivalent}>
              {title}
            </MenuItem>
          ))}
          <MenuSeparator />
          <Submenu>
            <SubmenuTrigger>Recent Folders</SubmenuTrigger>
            <SubmenuPopup container={stage}>
              <MenuItem>Clear Menu</MenuItem>
            </SubmenuPopup>
          </Submenu>
          <MenuSeparator />
          <MenuItem keyEquivalent="shift+command+g">Go to Folder…</MenuItem>
          <MenuItem keyEquivalent="command+k">Connect to Server…</MenuItem>
        </MenuPopup>
      </Menu>
    </div>
  );
}
