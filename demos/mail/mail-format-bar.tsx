"use client";

import { ColorWell } from "macalicious/color-well";
import {
  FONT_FAMILIES,
  FONT_SIZES,
  type RichTextAlignment,
  type RichTextFormat,
} from "macalicious/lib/rich-text";
import { PopUpButtonItem } from "macalicious/pop-up-button";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarPopUp } from "macalicious/toolbar-pop-up";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import type { CSSProperties, ReactNode } from "react";
import { MailAlignmentGlyph } from "./mail-artwork";
import type { MailTextCommand } from "./mail-format";

/** The four character styles of the bar, in its order, each with its segment's letter. */
const STYLES: readonly [
  style: "bold" | "italic" | "underline" | "strikethrough",
  label: string,
  letter: ReactNode,
][] = [
  ["bold", "Bold", <b key="b">B</b>],
  ["italic", "Italic", <i key="i">I</i>],
  ["underline", "Underline", <u key="u">U</u>],
  ["strikethrough", "Strikethrough", <s key="s">S</s>],
];

/** The bar's commands on whole lines, each pressed once and each with its segment's mark. */
const LINES: readonly [command: MailTextCommand, label: string, mark: string][] = [
  ["bulleted-list", "Bulleted list", "•"],
  ["numbered-list", "Numbered list", "1."],
  ["outdent", "Decrease indentation", "⇤"],
  ["indent", "Increase indentation", "⇥"],
];

const ALIGNMENTS: readonly [align: RichTextAlignment, label: string][] = [
  ["left", "Align left"],
  ["center", "Center"],
  ["right", "Align right"],
  ["justify", "Justify"],
];

/*
 * The controls of the bar are the library's toolbar controls at the size of a format bar: 16 pt
 * high with the small control font, given through `style` as TextEdit's format bar does; the
 * bezels, colours and states stay the library's. No capture shows Mail's format bar, so the
 * widths are provisional: the family pop-up holds "American Typewriter", the size pop-up three
 * digits.
 */
const SMALL: CSSProperties = {
  height: 16,
  font: "var(--mac-font-control-small)",
  letterSpacing: "var(--mac-tracking-small)",
};
const pop = (width: number): CSSProperties => ({
  ...SMALL,
  width,
  gap: 2,
  padding: "0 4px 0 6px",
});
const SEGMENT: CSSProperties = { width: 19, minWidth: 0, padding: 0 };
/** The toolbar's gap hook, set to the bar's (mail.tokens.css); its padding is in mail.css. */
const BAR = { "--mac-toolbar-gap": "var(--mac-mail-format-bar-gap)" } as CSSProperties;
/** A space that, with the bar's 3 pt gap on each side, makes 7 pt between two groups. */
const GROUP = 1;

export interface MailFormatBarProps {
  /** The format where the insertion point is, or of the selection's first character. */
  format: RichTextFormat;
  /** Called with the parts of the format a control changes. */
  onFormatChange: (change: Partial<RichTextFormat>) => void;
  /** Called with a command on the lines selected: a list, or indentation. */
  onText?: (command: MailTextCommand) => void;
}

/**
 * The format bar of a new message, shown with the toolbar's Show Format Bar button: the font
 * family and size, the text colour, bold, italic, underline and strikethrough, the four
 * alignments, lists and indentation. It is a `Toolbar` of the library's toolbar controls under the
 * header fields, so it is one tab stop with the arrow keys between its controls.
 */
export function MailFormatBar({ format, onFormatChange, onText }: MailFormatBarProps) {
  // A family or size the menus do not list (text pasted from elsewhere) is shown all the same.
  const families = FONT_FAMILIES.map((family) => family.name);
  if (format.family && !families.includes(format.family)) families.unshift(format.family);
  const sizes: number[] = [...FONT_SIZES];
  if (!sizes.includes(format.size)) sizes.push(format.size);
  sizes.sort((a, b) => a - b);
  const styles = STYLES.filter(([style]) => format[style]).map(([style]) => style);

  return (
    <Toolbar aria-label="Format" className="mac-mail-compose-format-bar" style={BAR}>
      <ToolbarPopUp
        aria-label="Font family"
        value={format.family}
        onValueChange={(family) => family && onFormatChange({ family })}
        style={pop(112)}
      >
        {families.map((family) => (
          <PopUpButtonItem key={family} value={family}>
            {family}
          </PopUpButtonItem>
        ))}
      </ToolbarPopUp>
      <ToolbarPopUp
        aria-label="Font size"
        value={String(format.size)}
        onValueChange={(size) => size && onFormatChange({ size: Number(size) })}
        style={pop(44)}
      >
        {sizes.map((size) => (
          <PopUpButtonItem key={size} value={String(size)}>
            {size}
          </PopUpButtonItem>
        ))}
      </ToolbarPopUp>
      <ToolbarSpace width={GROUP} />
      <ColorWell
        variant="toolbar"
        aria-label="Text color"
        value={format.color}
        onValueChange={(color) => onFormatChange({ color })}
      />
      <ToolbarSpace width={GROUP} />
      <ToolbarSegmentedControl
        tracking="select-any"
        aria-label="Text style"
        value={styles}
        onValueChange={(next) =>
          onFormatChange({
            bold: next.includes("bold"),
            italic: next.includes("italic"),
            underline: next.includes("underline"),
            strikethrough: next.includes("strikethrough"),
          })
        }
        style={SMALL}
      >
        {STYLES.map(([style, label, letter]) => (
          <ToolbarSegment key={style} value={style} aria-label={label} style={SEGMENT}>
            <span aria-hidden="true">{letter}</span>
          </ToolbarSegment>
        ))}
      </ToolbarSegmentedControl>
      <ToolbarSpace width={GROUP} />
      <ToolbarSegmentedControl
        aria-label="Alignment"
        value={[format.align]}
        onValueChange={(next) => {
          const align = next[0] as RichTextAlignment | undefined;
          if (align) onFormatChange({ align });
        }}
        style={SMALL}
      >
        {ALIGNMENTS.map(([align, label]) => (
          <ToolbarSegment key={align} value={align} aria-label={label} style={SEGMENT}>
            <MailAlignmentGlyph align={align} />
          </ToolbarSegment>
        ))}
      </ToolbarSegmentedControl>
      <ToolbarSpace width={GROUP} />
      <ToolbarSegmentedControl tracking="momentary" aria-label="Lines" style={SMALL}>
        {LINES.map(([command, label, mark]) => (
          <ToolbarSegment
            key={command}
            aria-label={label}
            style={SEGMENT}
            onClick={() => onText?.(command)}
          >
            <span aria-hidden="true">{mark}</span>
          </ToolbarSegment>
        ))}
      </ToolbarSegmentedControl>
    </Toolbar>
  );
}
