import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import type { CSSProperties, Ref } from "react";
import { withClassName } from "../../lib/cn";
import "./color-palette.tokens.css";
import "./color-palette.css";

/** One named colour of a palette: its name, then its value as lower-case `#rrggbb`. */
export type ColorPaletteColor = readonly [name: string, value: string];

const colors = (list: string): ColorPaletteColor[] =>
  list.split(",").map((item) => [item.slice(6), `#${item.slice(0, 6)}`]);

/** The colours of the "Apple" colour list of the Colors panel's palette picker. */
export const APPLE_COLORS: readonly ColorPaletteColor[] = /* @__PURE__ */ colors(
  "000000Black,0000ffBlue,996633Brown,00ffffCyan,00ff00Green,ff00ffMagenta,ff8000Orange,800080Purple,ff0000Red,ffff00Yellow,ffffffWhite",
);

/** The 48 crayons of the Colors panel's pencil picker, row by row from the top. */
export const CRAYON_COLORS: readonly ColorPaletteColor[] = /* @__PURE__ */ colors(
  "000000Licorice,212121Lead,424242Tungsten,5e5e5eIron,797979Steel,919191Tin,929292Nickel,a9a9a9Aluminum,c0c0c0Magnesium,d6d6d6Silver,ebebebMercury,ffffffSnow," +
    "941100Cayenne,945200Mocha,929000Asparagus,4f8f00Fern,008f00Clover,009051Moss,009193Teal,005493Ocean,011993Midnight,531b93Eggplant,942193Plum,941751Maroon," +
    "ff2600Maraschino,ff9300Tangerine,fffb00Lemon,8efa00Lime,00f900Spring,00fa92Sea Foam,00fdffTurquoise,0096ffAqua,0433ffBlueberry,9437ffGrape,ff40ffMagenta,ff2f92Strawberry," +
    "ff7e79Salmon,ffd479Cantaloupe,fffc79Banana,d4fb79Honeydew,73fa79Flora,73fcd6Spindrift,73fdffIce,76d6ffSky,7a81ffOrchid,d783ffLavender,ff85ffBubblegum,ff8ad8Carnation",
);

export interface ColorPaletteProps extends Omit<BaseRadioGroup.Props<string>, "ref" | "children"> {
  /**
   * The colours to choose from, each a name and a value as lower-case `#rrggbb`. The library
   * exports the two lists AppKit ships: `APPLE_COLORS` and `CRAYON_COLORS`.
   * @default APPLE_COLORS
   */
  colors?: readonly ColorPaletteColor[];
  /**
   * How the colours are drawn. `"list"` is the palette picker's list of swatches with their
   * names; `"pencils"` is the pencil picker's rows of twelve crayons, with the name of the
   * chosen one under them.
   * @default "list"
   */
  variant?: "list" | "pencils";
  /** Ref to the group element. */
  ref?: Ref<HTMLDivElement>;
}

/**
 * A palette of named colours of which one is chosen (the palette and pencil pickers of
 * NSColorPanel): a radio group.
 *
 * Built on Base UI's Radio Group, so it takes `value`, `defaultValue`, `onValueChange`,
 * `disabled`, `readOnly`, `name` and `render`; the value is the chosen colour as `#rrggbb`, and
 * nothing is chosen while the value is not one of the palette's colours. Give the group a name
 * with `aria-label` or `aria-labelledby`.
 */
export function ColorPalette({
  colors: list = APPLE_COLORS,
  variant = "list",
  className,
  ...props
}: ColorPaletteProps) {
  return (
    <BaseRadioGroup<string>
      data-variant={variant}
      className={withClassName("mac-color-palette", className)}
      {...props}
    >
      {list.map(([name, value]) => (
        <BaseRadio.Root
          key={name}
          value={value}
          aria-label={name}
          className="mac-color-palette-color"
          style={{ "--_color": value } as CSSProperties}
        >
          <span className="mac-color-palette-swatch" />
          <span className="mac-color-palette-name">{name}</span>
        </BaseRadio.Root>
      ))}
    </BaseRadioGroup>
  );
}
