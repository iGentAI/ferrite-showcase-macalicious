"use client";

import {
  MenuCheckboxItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
} from "macalicious/menu-item";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { type CalculatorLayout, MAX_DECIMALS } from "./calculator-settings";

export interface CalculatorViewItemsProps {
  layout: CalculatorLayout;
  separators: boolean;
  decimals: number;
  rpn: boolean;
  /** Read when a command is chosen, so the rows change only with what they show. */
  commands: () => {
    setLayout: (layout: CalculatorLayout) => void;
    setSeparators: (separators: boolean) => void;
    setDecimals: (decimals: number) => void;
    setRpn: (rpn: boolean) => void;
  };
}

const PLACES = Array.from({ length: MAX_DECIMALS + 1 }, (_, places) => places);

/** Calculator's View menu: its layouts, and how the display writes a number. */
export function CalculatorViewItems({
  layout,
  separators,
  decimals,
  rpn,
  commands,
}: CalculatorViewItemsProps) {
  return (
    <>
      <MenuRadioGroup value={layout}>
        <MenuRadioItem
          value="basic"
          keyEquivalent="command+1"
          onClick={() => commands().setLayout("basic")}
        >
          Basic
        </MenuRadioItem>
        <MenuRadioItem
          value="scientific"
          keyEquivalent="command+2"
          onClick={() => commands().setLayout("scientific")}
        >
          Scientific
        </MenuRadioItem>
        <MenuRadioItem
          value="programmer"
          keyEquivalent="command+3"
          onClick={() => commands().setLayout("programmer")}
        >
          Programmer
        </MenuRadioItem>
      </MenuRadioGroup>
      <MenuSeparator />
      <MenuCheckboxItem
        keyEquivalent="shift+command+t"
        checked={separators}
        onCheckedChange={(next) => commands().setSeparators(next)}
      >
        Show Thousands Separators
      </MenuCheckboxItem>
      <Submenu>
        <SubmenuTrigger>Decimal Places</SubmenuTrigger>
        <SubmenuPopup>
          <MenuRadioGroup value={decimals}>
            {PLACES.map((places) => (
              <MenuRadioItem
                key={places}
                value={places}
                onClick={() => commands().setDecimals(places)}
              >
                {places}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      <MenuCheckboxItem
        keyEquivalent="command+r"
        checked={rpn}
        onCheckedChange={(next) => commands().setRpn(next)}
      >
        RPN Mode
      </MenuCheckboxItem>
    </>
  );
}
