"use client";

import { ColorWell } from "macalicious/color-well";
import { ComboBoxItem } from "macalicious/combo-box";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "macalicious/menu-item";
import { PopUpButtonItem } from "macalicious/pop-up-button";
import { Toolbar, ToolbarSpace } from "macalicious/toolbar";
import { ToolbarButton } from "macalicious/toolbar-button";
import { ToolbarComboBox } from "macalicious/toolbar-combo-box";
import { ToolbarPopUp, ToolbarPullDown } from "macalicious/toolbar-pop-up";
import { ToolbarSegment, ToolbarSegmentedControl } from "macalicious/toolbar-segmented-control";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { AlignmentGlyph, ColorChip, HighlightGlyph, ListGlyph } from "./textedit-artwork";
import { FONTS, HIGHLIGHTS, LISTS, SIZES, SPACINGS } from "./textedit-data";
import type { ParagraphFormat, TextEditAlignment } from "./textedit-document";

/** What the format bar shows: the format at the insertion point. */
export interface TextEditFormat extends ParagraphFormat {
  /** Whether the text is bold. */
  bold: boolean;
  /** Whether the text is italic. */
  italic: boolean;
  /** Whether the text is underlined. */
  underline: boolean;
  /** Whether the text is struck through: set from the Fonts panel. */
  strikethrough: boolean;
  /** The font family, by the name the family button shows. */
  family: string;
  /** The font size in points. */
  size: number;
  /** The text colour, as `#rrggbb`. */
  color: string;
  /** The value of the highlight colour, or `none`. */
  highlight: string;
}

/** The four typefaces of a family, by which of bold and italic they are. */
const TYPEFACES = [
  { value: "regular", label: "Regular", bold: false, italic: false },
  { value: "bold", label: "Bold", bold: true, italic: false },
  { value: "italic", label: "Oblique", bold: false, italic: true },
  { value: "bold-italic", label: "Bold Oblique", bold: true, italic: true },
] as const;

const ALIGNMENTS: { value: TextEditAlignment; label: string }[] = [
  { value: "left", label: "Align left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Align right" },
  { value: "justify", label: "Justify" },
];

/*
 * The sizes of the bar, measured in the two TextEdit captures (reference/spec/apps/textedit.md):
 * the controls are 16 pt high, 5 pt under the title strip and 5 pt above the bar's end; the
 * first starts 4.5 pt from the window's edge; controls of a group are 3 pt apart and groups
 * 7 pt. The library's toolbar controls are 22 pt high with 13 pt text, so each one is given its
 * measured box and the small control font through `style`; the bezels, colours and states stay
 * the library's. The font size control is the exception: it is the library's toolbar combo box
 * at its `"small"` size, which is the format bar's, and takes no style of its own.
 */
const BAR = {
  "--mac-toolbar-gap": "3px",
  "--mac-toolbar-padding-top": "5px",
  paddingInline: "4.5px",
  paddingBlockEnd: 5,
} as CSSProperties;
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
const STYLES: CSSProperties = { ...SMALL, width: 25, minWidth: 0, gap: 0, padding: "0 3px 0 4px" };
const LIST: CSSProperties = { ...SMALL, width: 35, minWidth: 0, gap: 0, padding: "0 4px 0 5px" };
const HIGHLIGHT: CSSProperties = { ...SMALL, width: 22, minWidth: 0, padding: 0 };
const SEGMENT: CSSProperties = { width: 19, minWidth: 0, padding: 0 };
/** A space that, with the gap on each side of it, makes the 7 pt between two groups. */
const GROUP = 1;

/** A typed font size, in points, or `undefined` when the text is not one. */
const parseSize = (text: string) => {
  const size = Number(text.trim());
  return Number.isFinite(size) && size > 0 && size <= 999 ? size : undefined;
};

export interface TextEditFormatBarProps {
  /** The format at the insertion point. */
  format: TextEditFormat;
  /** Called with the parts of the format a control changes. */
  onFormatChange: (change: Partial<TextEditFormat>) => void;
  /** Called when the styles menu's Default is chosen: the selection loses its formats. */
  onClearFormat: () => void;
  /** Called when the styles menu's Show Styles… is chosen. */
  onShowStyles?: () => void;
  /** Takes the bar out of use, while a sheet or a panel has the keyboard. */
  inert?: boolean;
}

/**
 * The format bar of a rich text document (the text view's inspector bar): paragraph styles,
 * font family, typeface and size, text and highlight colour, bold, italic and underline, the
 * four alignments, line spacing and lists. It is a `Toolbar` of the library's toolbar
 * controls and sits in the window's unified title bar, whose surface it shares.
 */
export function TextEditFormatBar({
  format,
  onFormatChange,
  onClearFormat,
  onShowStyles,
  inert = false,
}: TextEditFormatBarProps) {
  const typeface =
    TYPEFACES.find((face) => face.bold === format.bold && face.italic === format.italic)?.value ??
    "regular";
  const highlight = HIGHLIGHTS.find((entry) => entry.value === format.highlight);
  const styles = [
    format.bold && "bold",
    format.italic && "italic",
    format.underline && "underline",
  ];

  // The size field: what is typed is a draft until Return or leaving the field applies it, as
  // in AppKit; an item chosen from the list applies once the list has closed, when the
  // document is no longer hidden behind it. `committed` keeps one size from being applied
  // twice when Return both chooses an item and ends the entry.
  const [draft, setDraft] = useState<string | null>(null);
  const chosen = useRef<string | null>(null);
  const committed = useRef<number | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new size at the insertion point clears the guard
  useEffect(() => {
    committed.current = undefined;
  }, [format.size]);
  const commitSize = (text: string) => {
    setDraft(null);
    const size = parseSize(text);
    if (size === undefined || size === format.size || size === committed.current) return;
    committed.current = size;
    onFormatChange({ size });
  };

  return (
    <Toolbar aria-label="Format" className="mac-textedit-format-bar" style={BAR} inert={inert}>
      <ToolbarPullDown title="¶" aria-label="Paragraph styles" style={STYLES}>
        <MenuItem onClick={onClearFormat}>Default</MenuItem>
        <MenuSeparator />
        <MenuItem onClick={() => onFormatChange({ bold: true })}>Bold</MenuItem>
        <MenuItem onClick={() => onFormatChange({ italic: true })}>Italic</MenuItem>
        <MenuItem onClick={() => onFormatChange({ underline: true })}>Underlined</MenuItem>
        {onShowStyles ? (
          <>
            <MenuSeparator />
            <MenuItem onClick={onShowStyles}>Show Styles…</MenuItem>
          </>
        ) : null}
      </ToolbarPullDown>
      <ToolbarSpace width={GROUP} />
      <ToolbarPopUp
        aria-label="Font family"
        value={format.family}
        onValueChange={(family) => family && onFormatChange({ family })}
        style={pop(98)}
      >
        {FONTS.map((font) => (
          <PopUpButtonItem key={font.value} value={font.value}>
            {font.value}
          </PopUpButtonItem>
        ))}
      </ToolbarPopUp>
      <ToolbarPopUp
        aria-label="Typeface"
        value={typeface}
        onValueChange={(value) => {
          const face = TYPEFACES.find((entry) => entry.value === value);
          if (face) onFormatChange({ bold: face.bold, italic: face.italic });
        }}
        style={pop(78)}
      >
        {TYPEFACES.map((face) => (
          <PopUpButtonItem key={face.value} value={face.value}>
            {face.label}
          </PopUpButtonItem>
        ))}
      </ToolbarPopUp>
      <ToolbarComboBox
        size="small"
        aria-label="Font size"
        inputMode="decimal"
        value={draft ?? String(format.size)}
        onValueChange={(text, details) => {
          setDraft(text);
          if (details.reason === "item-press") chosen.current = text;
        }}
        onOpenChange={(open) => {
          const text = chosen.current;
          if (open || text === null) return;
          chosen.current = null;
          setTimeout(() => commitSize(text));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && draft !== null && chosen.current === null) {
            // The size gives the keyboard back to the document, which would take this key as well and
            // replace the selected text with a new line.
            event.preventDefault();
            commitSize(draft);
          } else if (event.key === "Escape") setDraft(null);
        }}
        onBlur={() => {
          if (draft !== null && chosen.current === null) commitSize(draft);
        }}
      >
        {SIZES.map((size) => (
          <ComboBoxItem key={size} value={String(size)}>
            {size}
          </ComboBoxItem>
        ))}
      </ToolbarComboBox>
      <ToolbarSpace width={GROUP} />
      <ColorWell
        variant="toolbar"
        aria-label="Text color"
        value={format.color}
        onValueChange={(color) => onFormatChange({ color })}
      />
      <Menu>
        <MenuTrigger
          render={
            <ToolbarButton aria-label="Highlight color" style={HIGHLIGHT}>
              <HighlightGlyph color={highlight?.color} />
            </ToolbarButton>
          }
        />
        <MenuPopup sideOffset={4}>
          <MenuRadioGroup
            value={format.highlight}
            onValueChange={(value) => onFormatChange({ highlight: value as string })}
          >
            <MenuRadioItem value="none" image={<ColorChip />}>
              No Color
            </MenuRadioItem>
            {HIGHLIGHTS.map((entry) => (
              <MenuRadioItem
                key={entry.value}
                value={entry.value}
                image={<ColorChip color={entry.color} />}
              >
                {entry.label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
      <ToolbarSpace width={GROUP} />
      <ToolbarSegmentedControl
        tracking="select-any"
        aria-label="Text style"
        value={styles.filter((style): style is string => style !== false)}
        onValueChange={(next) =>
          onFormatChange({
            bold: next.includes("bold"),
            italic: next.includes("italic"),
            underline: next.includes("underline"),
          })
        }
        style={SMALL}
      >
        <ToolbarSegment value="bold" aria-label="Bold" style={SEGMENT}>
          <b aria-hidden="true">B</b>
        </ToolbarSegment>
        <ToolbarSegment value="italic" aria-label="Italic" style={SEGMENT}>
          <i aria-hidden="true">I</i>
        </ToolbarSegment>
        <ToolbarSegment value="underline" aria-label="Underline" style={SEGMENT}>
          <u aria-hidden="true">U</u>
        </ToolbarSegment>
      </ToolbarSegmentedControl>
      <ToolbarSpace width={GROUP} />
      <ToolbarSegmentedControl
        aria-label="Alignment"
        value={[format.align]}
        onValueChange={(next) => {
          const align = next[0] as TextEditAlignment | undefined;
          if (align) onFormatChange({ align });
        }}
        style={SMALL}
      >
        {ALIGNMENTS.map((alignment) => (
          <ToolbarSegment
            key={alignment.value}
            value={alignment.value}
            aria-label={alignment.label}
            style={SEGMENT}
          >
            <AlignmentGlyph align={alignment.value} />
          </ToolbarSegment>
        ))}
      </ToolbarSegmentedControl>
      <ToolbarSpace width={GROUP} />
      <ToolbarPopUp
        aria-label="Line spacing"
        value={format.spacing}
        onValueChange={(spacing) => spacing && onFormatChange({ spacing })}
        style={{ ...pop(37), gap: 0, padding: "0 3px 0 5px" }}
      >
        {SPACINGS.map((spacing) => (
          <PopUpButtonItem key={spacing} value={spacing}>
            {spacing}
          </PopUpButtonItem>
        ))}
      </ToolbarPopUp>
      <ToolbarPullDown image={<ListGlyph />} aria-label="List bullets and numbering" style={LIST}>
        <MenuRadioGroup
          value={format.list}
          onValueChange={(list) => onFormatChange({ list: list as string })}
        >
          {LISTS.map((list) => (
            <MenuRadioItem key={list.value} value={list.value}>
              {list.label}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </ToolbarPullDown>
    </Toolbar>
  );
}
