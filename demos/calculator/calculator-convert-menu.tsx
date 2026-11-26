"use client";

import { DefaultButton } from "macalicious/default-button";
import { Form, FormRow } from "macalicious/form";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { Sheet, SheetActions, SheetClose, SheetPopup, SheetTitle } from "macalicious/sheet";
import { Submenu, SubmenuPopup, SubmenuTrigger } from "macalicious/submenu";
import { type ComponentProps, useState } from "react";
import {
  CONVERT_CATEGORIES,
  type ConvertCategoryId,
  categoryOf,
  type RecentConversion,
  recentTitle,
} from "./calculator-convert";
import { currencyNames, type RatesState, ratesSourceText, updateWords } from "./calculator-rates";

/** Currency needs the rates the desktop's server reads, and a page without it has none. */
export const NO_CURRENCY =
  "Exchange rates come from the desktop's server, and this page has none, so currency cannot be converted.";
/** The Programmer layout's numbers are whole, and a conversion's rarely is. */
export const NO_CONVERT_IN_PROGRAMMER =
  "Conversions work on decimal numbers: choose Basic or Scientific in the View menu.";

export interface CalculatorConvertItemsProps {
  recent: readonly RecentConversion[];
  /** Why nothing can be converted now, when that is so. */
  refused?: string;
  /** Whether the display holds a number to convert. */
  hasNumber: boolean;
  /** Whether the desktop's server is there to give exchange rates. */
  ratesServed: boolean;
  commands: () => {
    open: (category: ConvertCategoryId) => void;
    again: (conversion: RecentConversion) => void;
    updateRates: () => void;
  };
}

/** Calculator's Convert menu. */
export function CalculatorConvertItems({
  recent,
  refused,
  hasNumber,
  ratesServed,
  commands,
}: CalculatorConvertItemsProps) {
  const usable = hasNumber && !refused;
  const row = (category: (typeof CONVERT_CATEGORIES)[number]) => {
    const noRates = category.id === "currency" && !ratesServed;
    return (
      <MenuItem
        key={category.id}
        disabled={!usable || noRates}
        title={noRates ? NO_CURRENCY : refused}
        onClick={() => commands().open(category.id)}
      >
        {`${category.title}…`}
      </MenuItem>
    );
  };
  return (
    <>
      <Submenu disabled={recent.length === 0}>
        <SubmenuTrigger>Recent Conversions</SubmenuTrigger>
        <SubmenuPopup>
          {recent.map((conversion) => (
            <MenuItem
              key={recentTitle(conversion)}
              disabled={!usable}
              title={refused}
              onClick={() => commands().again(conversion)}
            >
              {recentTitle(conversion)}
            </MenuItem>
          ))}
        </SubmenuPopup>
      </Submenu>
      <MenuSeparator />
      {CONVERT_CATEGORIES.map(row)}
      <MenuSeparator />
      <MenuItem
        disabled={!ratesServed}
        title={ratesServed ? undefined : NO_CURRENCY}
        onClick={() => commands().updateRates()}
      >
        Update Currency Exchange Rates…
      </MenuItem>
    </>
  );
}

export interface ConvertSheetProps {
  /** The category it opens on; no sheet is shown without one. */
  category: ConvertCategoryId | null;
  /** The units last used in each category, which it starts from. */
  recent: readonly RecentConversion[];
  /** The exchange rates, for Currency. */
  rates?: RatesState;
  anchor: ComponentProps<typeof SheetPopup>["anchor"];
  /** Where the keyboard goes when the sheet closes. */
  finalFocus: ComponentProps<typeof SheetPopup>["finalFocus"];
  onConvert: (conversion: RecentConversion) => void;
  onClose: () => void;
}

function ConvertForm({
  opened,
  recent,
  rates,
  onConvert,
}: {
  opened: ConvertCategoryId;
  recent: readonly RecentConversion[];
  rates: RatesState;
  onConvert: (conversion: RecentConversion) => void;
}) {
  const unitsOf = (id: ConvertCategoryId): readonly string[] =>
    id === "currency" && rates.kind === "read"
      ? currencyNames(rates.rates)
      : categoryOf(id).units.map(([unit]) => unit);
  const startOf = (id: ConvertCategoryId): RecentConversion => {
    const units = unitsOf(id);
    return (
      recent.find((each) => each.category === id) ?? {
        category: id,
        from: units[0] ?? "",
        to: units[1] ?? "",
      }
    );
  };
  const [choice, setChoice] = useState(() => startOf(opened));
  const units = unitsOf(choice.category);
  const isCurrency = choice.category === "currency";
  const unitPicker = (label: string, value: string, change: (unit: string) => void) => (
    <FormRow label={`${label}:`}>
      <PopUpButton
        aria-label={label}
        size="small"
        value={value}
        onValueChange={(next) => change(next as string)}
      >
        {units.map((unit) => (
          <PopUpButtonItem key={unit} value={unit}>
            {unit}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
    </FormRow>
  );
  return (
    <>
      <SheetTitle>Convert</SheetTitle>
      <Form size="small" onSubmit={(event) => event.preventDefault()}>
        <FormRow label="Convert:">
          <PopUpButton
            aria-label="Category"
            size="small"
            value={choice.category}
            onValueChange={(next) => setChoice(startOf(next as ConvertCategoryId))}
          >
            {CONVERT_CATEGORIES.map(({ id, title }) => (
              <PopUpButtonItem key={id} value={id}>
                {title}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </FormRow>
        {unitPicker("From", choice.from, (from) => setChoice({ ...choice, from }))}
        {unitPicker("To", choice.to, (to) => setChoice({ ...choice, to }))}
      </Form>
      {isCurrency ? (
        <p role="status" className="mac-calculator-rates-note">
          {rates.kind === "reading"
            ? "Reading the exchange rates…"
            : rates.kind === "failed"
              ? `The exchange rates can’t be read. ${rates.problem}`
              : ratesSourceText(rates.rates)}
        </p>
      ) : null}
      <SheetActions>
        <SheetClose>Cancel</SheetClose>
        <DefaultButton
          disabled={
            isCurrency &&
            (rates.kind !== "read" || !units.includes(choice.from) || !units.includes(choice.to))
          }
          onClick={() => onConvert(choice)}
        >
          Convert
        </DefaultButton>
      </SheetActions>
    </>
  );
}

/** The sheet a Convert row opens: what to convert the number on the display from and to. */
export function ConvertSheet({
  category,
  recent,
  rates = { kind: "reading" },
  anchor,
  finalFocus,
  onConvert,
  onClose,
}: ConvertSheetProps) {
  // The units start from the rates, so the form begins again once they are read.
  const ratesRead = rates.kind === "read";
  return (
    <Sheet open={category !== null} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={340} finalFocus={finalFocus}>
        {category ? (
          <ConvertForm
            key={`${category}-${ratesRead}`}
            opened={category}
            recent={recent}
            rates={rates}
            onConvert={onConvert}
          />
        ) : null}
      </SheetPopup>
    </Sheet>
  );
}

/** What Update Currency Exchange Rates came to, or nothing while no update was asked for. */
export function RatesUpdateSheet({
  notice,
  anchor,
  finalFocus,
  onClose,
}: {
  notice: RatesState | null;
  anchor: ComponentProps<typeof SheetPopup>["anchor"];
  finalFocus: ComponentProps<typeof SheetPopup>["finalFocus"];
  onClose: () => void;
}) {
  const words = notice ? updateWords(notice) : null;
  return (
    <Sheet open={notice !== null} onOpenChange={(next) => next || onClose()}>
      <SheetPopup anchor={anchor} width={340} finalFocus={finalFocus}>
        {words ? (
          <>
            <SheetTitle>{words.title}</SheetTitle>
            <p role="status" className="mac-calculator-rates-note">
              {words.detail}
            </p>
            <SheetActions>
              <DefaultButton disabled={notice?.kind === "reading"} onClick={onClose}>
                OK
              </DefaultButton>
            </SheetActions>
          </>
        ) : null}
      </SheetPopup>
    </Sheet>
  );
}
