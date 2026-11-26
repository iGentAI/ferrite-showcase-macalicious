"use client";

import { Checkbox } from "macalicious/checkbox";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import {
  PreferencesWindow,
  PreferencesWindowForm,
  type PreferencesWindowProps,
  PreferencesWindowRow,
} from "macalicious/preferences-window";
import { PushButton } from "macalicious/push-button";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { TextField } from "macalicious/text-field";
import type { CSSProperties } from "react";
import {
  changeDesktopValue,
  readBoolean,
  readNumber,
  useDesktopSetting,
  useDesktopValue,
} from "../desktop/desktop-personal";
import {
  DEFAULT_SUBSTITUTIONS,
  substitutionsKey,
  type TextSubstitutions,
  useTextSubstitutions,
} from "../desktop/text-substitutions";
import { useCheckGrammar } from "../desktop/text-tools";
import { FONTS, SIZES, type TextEditDocument, untitledDocument } from "./textedit-data";
import { isPlainEncoding, PLAIN_ENCODINGS } from "./textedit-encodings";

/*
 * TextEdit > Preferences: the person's desktop values, saved with their account, which the document
 * window reads as well, so it follows each change. What a preference governs is what it does in
 * Catalina: the format and rich text font of the next File > New, the font of plain text documents,
 * how the next opened file is shown and what a plain text file is named when it is saved.
 */

export const TEXTEDIT_SETTINGS = {
  format: "textedit.newFormat",
  richFamily: "textedit.richFontFamily",
  richSize: "textedit.richFontSize",
  plainFamily: "textedit.plainFontFamily",
  plainSize: "textedit.plainFontSize",
  spelling: "textedit.checkSpelling",
  ruler: "textedit.showRuler",
  htmlAsCode: "textedit.htmlAsCode",
  rtfAsCode: "textedit.rtfAsCode",
  addTxt: "textedit.addTxtExtension",
  openEncoding: "textedit.openEncoding",
  saveEncoding: "textedit.saveEncoding",
  dataDetectors: "textedit.dataDetectors",
  correctAutomatically: "textedit.correctAutomatically",
} as const;

const DEFAULTS = {
  format: "rich" as TextEditDocument["format"],
  richFamily: "Helvetica",
  richSize: 12,
  plainFamily: "Menlo",
  plainSize: 11,
  spelling: true,
  correctAutomatically: false,
  ruler: true,
  htmlAsCode: false,
  rtfAsCode: false,
  addTxt: true,
  openEncoding: "automatic" as string,
  saveEncoding: "automatic" as string,
};

export type TextEditPreferenceValues = typeof DEFAULTS;

const readFormat = (stored: unknown) =>
  stored === "rich" || stored === "plain" ? stored : undefined;
const readSize = (stored: unknown) => {
  const size = readNumber(stored);
  return size !== undefined && (SIZES as readonly number[]).includes(size) ? size : undefined;
};

/** Menlo first: Catalina's plain text font, which the format bar's families leave out. */
const PLAIN_FONTS = [
  { value: "Menlo", family: "Menlo, Monaco, Consolas, monospace" },
  ...FONTS.filter((font) => font.value !== "Menlo"),
];
const readRichFamily = (stored: unknown) => FONTS.find((font) => font.value === stored)?.value;
const readEncoding = (stored: unknown) =>
  typeof stored === "string" && (stored === "automatic" || isPlainEncoding(stored))
    ? stored
    : undefined;
const readPlainFamily = (stored: unknown) =>
  PLAIN_FONTS.find((font) => font.value === stored)?.value;

/** Every preference as the window should use it now. */
export function useTextEditPreferences(): TextEditPreferenceValues {
  const keys = TEXTEDIT_SETTINGS;
  return {
    format: useDesktopValue(keys.format, readFormat, DEFAULTS.format),
    richFamily: useDesktopValue(keys.richFamily, readRichFamily, DEFAULTS.richFamily),
    richSize: useDesktopValue(keys.richSize, readSize, DEFAULTS.richSize),
    plainFamily: useDesktopValue(keys.plainFamily, readPlainFamily, DEFAULTS.plainFamily),
    plainSize: useDesktopValue(keys.plainSize, readSize, DEFAULTS.plainSize),
    spelling: useDesktopValue(keys.spelling, readBoolean, DEFAULTS.spelling),
    correctAutomatically: useDesktopValue(
      keys.correctAutomatically,
      readBoolean,
      DEFAULTS.correctAutomatically,
    ),
    ruler: useDesktopValue(keys.ruler, readBoolean, DEFAULTS.ruler),
    htmlAsCode: useDesktopValue(keys.htmlAsCode, readBoolean, DEFAULTS.htmlAsCode),
    rtfAsCode: useDesktopValue(keys.rtfAsCode, readBoolean, DEFAULTS.rtfAsCode),
    addTxt: useDesktopValue(keys.addTxt, readBoolean, DEFAULTS.addTxt),
    openEncoding: useDesktopValue(keys.openEncoding, readEncoding, DEFAULTS.openEncoding),
    saveEncoding: useDesktopValue(keys.saveEncoding, readEncoding, DEFAULTS.saveEncoding),
  };
}

/** Whether Preferences > Add ".txt" extension is on, for the Save sheet. */
export const useAddsTxtExtension = () =>
  useDesktopValue(TEXTEDIT_SETTINGS.addTxt, readBoolean, DEFAULTS.addTxt);

/** The document File > New makes: the format and, in a rich text one, the font of Preferences. */
export function newDocumentFrom(
  { format, richFamily, richSize }: TextEditPreferenceValues,
  target: Document,
): TextEditDocument {
  if (format === "plain") return { ...untitledDocument, format };
  if (richFamily === DEFAULTS.richFamily && richSize === DEFAULTS.richSize) return untitledDocument;
  // The font is the first line's own, as the format bar writes one: typing continues in it, and
  // the draft and the RTF file keep it.
  const line = target.createElement("div");
  const run = line.appendChild(target.createElement("span"));
  run.style.fontFamily = FONTS.find((font) => font.value === richFamily)?.family ?? richFamily;
  run.style.fontSize = `${richSize}px`;
  run.append(target.createElement("br"));
  const content = target.createDocumentFragment();
  content.append(line);
  return { ...untitledDocument, content };
}

/** The font of a plain text document: Menlo 11 on a 14 pt line unless Preferences changes it. */
export function plainTextStyle({
  plainFamily,
  plainSize,
}: TextEditPreferenceValues): CSSProperties {
  const family = PLAIN_FONTS.find((font) => font.value === plainFamily)?.family ?? plainFamily;
  return { font: `${plainSize}px / ${Math.round((plainSize * 14) / 11)}px ${family}` };
}

/** A rich text file's own text as a plain text document: its RTF or HTML code. */
export const codeDocument = (document: TextEditDocument, text: string): TextEditDocument => ({
  name: document.name,
  format: "plain",
  lines: text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n"),
});

/** The document a file just read opens as: its code when Preferences asks for that kind of file. */
export function openedDocument(
  document: TextEditDocument,
  text: string,
  { htmlAsCode, rtfAsCode }: TextEditPreferenceValues,
): TextEditDocument {
  if (document.format !== "rich") return document;
  const isHtml = /\.html?$/i.test(document.name);
  return (isHtml ? htmlAsCode : rtfAsCode) ? codeDocument(document, text) : document;
}

const ONE_SIZE = "The desktop opens every TextEdit window at one size.";

const PANE: CSSProperties = { padding: "var(--mac-space-window-margin)" };
const PAIR: CSSProperties = { display: "flex", gap: "var(--mac-space-control-gap)" };
const STACK: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 6,
};
const WIDE_OPTIONS: CSSProperties = { ...STACK, width: 300 };

function EncodingChoice({
  label,
  setting,
  fallback,
}: {
  label: string;
  setting: string;
  fallback: string;
}) {
  const [value, setValue] = useDesktopSetting(setting, readEncoding, fallback);
  return (
    <PopUpButton
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        if (next) setValue(next);
      }}
    >
      <PopUpButtonItem value="automatic">Automatic</PopUpButtonItem>
      {PLAIN_ENCODINGS.map((entry) => (
        <PopUpButtonItem key={entry.value} value={entry.value}>
          {entry.label}
        </PopUpButtonItem>
      ))}
    </PopUpButton>
  );
}

function Option({
  setting,
  fallback,
  children,
}: {
  setting: string;
  fallback: boolean;
  children: string;
}) {
  const [checked, setChecked] = useDesktopSetting(setting, readBoolean, fallback);
  return (
    <Checkbox checked={checked} onCheckedChange={setChecked}>
      {children}
    </Checkbox>
  );
}

/** A font, as a pop-up for its family and one for its size. */
function FontChoice({
  label,
  fonts,
  family,
  size,
  onFamilyChange,
  onSizeChange,
}: {
  label: string;
  fonts: readonly { value: string }[];
  family: string;
  size: number;
  onFamilyChange: (family: string) => void;
  onSizeChange: (size: number) => void;
}) {
  return (
    <PreferencesWindowRow label={`${label} font:`}>
      <div style={PAIR}>
        <PopUpButton
          aria-label={`${label} font`}
          value={family}
          onValueChange={(next) => next && onFamilyChange(String(next))}
        >
          {fonts.map(({ value }) => (
            <PopUpButtonItem key={value} value={value}>
              {value}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
        <PopUpButton
          aria-label={`${label} font size`}
          value={String(size)}
          onValueChange={(next) => next && onSizeChange(Number(next))}
        >
          {SIZES.map((each) => (
            <PopUpButtonItem key={each} value={String(each)}>
              {each}
            </PopUpButtonItem>
          ))}
        </PopUpButton>
      </div>
    </PreferencesWindowRow>
  );
}

function RestoreDefaults({
  settings,
  substitutions = false,
}: {
  settings: readonly (keyof typeof DEFAULTS)[];
  /** Whether Edit > Substitutions' settings, on this tab, go back too. */
  substitutions?: boolean;
}) {
  return (
    <PreferencesWindowRow>
      <PushButton
        onClick={() => {
          for (const name of settings) changeDesktopValue(TEXTEDIT_SETTINGS[name], DEFAULTS[name]);
          if (substitutions) {
            changeDesktopValue(substitutionsKey("textedit"), DEFAULT_SUBSTITUTIONS);
          }
        }}
      >
        Restore All Defaults
      </PushButton>
    </PreferencesWindowRow>
  );
}

/** The Options that are Edit > Spelling and Grammar's and Edit > Substitutions' settings. */
function SubstitutionOptions() {
  const [settings, setSettings] = useTextSubstitutions("textedit");
  const [checkGrammar, setCheckGrammar] = useCheckGrammar();
  const [detectors, setDetectors] = useDesktopSetting(
    TEXTEDIT_SETTINGS.dataDetectors,
    readBoolean,
    false,
  );
  const [correcting, setCorrecting] = useDesktopSetting(
    TEXTEDIT_SETTINGS.correctAutomatically,
    readBoolean,
    DEFAULTS.correctAutomatically,
  );
  const option = (key: keyof TextSubstitutions, label: string) => (
    <Checkbox
      checked={settings[key]}
      onCheckedChange={(checked) => setSettings({ ...settings, [key]: checked })}
    >
      {label}
    </Checkbox>
  );
  return (
    <>
      <Checkbox
        checked={checkGrammar}
        onCheckedChange={(checked) => setCheckGrammar(checked === true)}
      >
        Check grammar with spelling
      </Checkbox>
      <Checkbox checked={correcting} onCheckedChange={(checked) => setCorrecting(checked === true)}>
        Correct spelling automatically
      </Checkbox>
      {option("copyPaste", "Smart copy/paste")}
      {option("quotes", "Smart quotes")}
      {option("dashes", "Smart dashes")}
      {option("links", "Smart links")}
      <Checkbox checked={detectors} onCheckedChange={(checked) => setDetectors(checked === true)}>
        Data detectors
      </Checkbox>
      {option("replacement", "Text replacement")}
    </>
  );
}

/** TextEdit's Preferences window: its New Document and Open and Save tabs. */
export function TextEditPreferences(props: Omit<PreferencesWindowProps, "toolbar" | "children">) {
  const keys = TEXTEDIT_SETTINGS;
  const [format, setFormat] = useDesktopSetting(keys.format, readFormat, DEFAULTS.format);
  const [richFamily, setRichFamily] = useDesktopSetting(
    keys.richFamily,
    readRichFamily,
    DEFAULTS.richFamily,
  );
  const [richSize, setRichSize] = useDesktopSetting(keys.richSize, readSize, DEFAULTS.richSize);
  const [plainFamily, setPlainFamily] = useDesktopSetting(
    keys.plainFamily,
    readPlainFamily,
    DEFAULTS.plainFamily,
  );
  const [plainSize, setPlainSize] = useDesktopSetting(keys.plainSize, readSize, DEFAULTS.plainSize);
  return (
    <PreferencesWindow title="Preferences" toolbar={null} width={500} {...props}>
      <div style={PANE}>
        <TabView defaultValue="new-document">
          <TabViewList>
            <TabViewTab value="new-document">New Document</TabViewTab>
            <TabViewTab value="open-save">Open and Save</TabViewTab>
          </TabViewList>
          <TabViewPanel value="new-document">
            <PreferencesWindowForm>
              <PreferencesWindowRow label="Format:">
                <div style={STACK}>
                  <RadioGroup
                    aria-label="Format"
                    value={format}
                    onValueChange={(next) => setFormat(next === "plain" ? "plain" : "rich")}
                  >
                    <RadioButton value="rich">Rich text</RadioButton>
                    <RadioButton value="plain">Plain text</RadioButton>
                  </RadioGroup>
                  <Checkbox disabled title="Documents have no page view.">
                    Wrap to page
                  </Checkbox>
                </div>
              </PreferencesWindowRow>
              <PreferencesWindowRow label="Window size:">
                <div style={PAIR}>
                  <TextField
                    aria-label="Width in characters"
                    disabled
                    title={ONE_SIZE}
                    defaultValue="75"
                    style={{ width: 48 }}
                  />
                  <TextField
                    aria-label="Height in lines"
                    disabled
                    title={ONE_SIZE}
                    defaultValue="30"
                    style={{ width: 48 }}
                  />
                </div>
              </PreferencesWindowRow>
              <FontChoice
                label="Plain text"
                fonts={PLAIN_FONTS}
                family={plainFamily}
                size={plainSize}
                onFamilyChange={setPlainFamily}
                onSizeChange={setPlainSize}
              />
              <FontChoice
                label="Rich text"
                fonts={FONTS}
                family={richFamily}
                size={richSize}
                onFamilyChange={setRichFamily}
                onSizeChange={setRichSize}
              />
              <PreferencesWindowRow label="Options:">
                <div style={STACK}>
                  <Option setting={keys.spelling} fallback={DEFAULTS.spelling}>
                    Check spelling as you type
                  </Option>
                  <Option setting={keys.ruler} fallback={DEFAULTS.ruler}>
                    Show ruler
                  </Option>
                  <SubstitutionOptions />
                </div>
              </PreferencesWindowRow>
              <RestoreDefaults
                substitutions
                settings={[
                  "format",
                  "richFamily",
                  "richSize",
                  "plainFamily",
                  "plainSize",
                  "spelling",
                  "correctAutomatically",
                  "ruler",
                ]}
              />
            </PreferencesWindowForm>
          </TabViewPanel>
          <TabViewPanel value="open-save">
            <PreferencesWindowForm>
              <PreferencesWindowRow label="When opening a file:">
                <div style={WIDE_OPTIONS}>
                  <Option setting={keys.htmlAsCode} fallback={DEFAULTS.htmlAsCode}>
                    Display HTML files as HTML code instead of formatted text
                  </Option>
                  <Option setting={keys.rtfAsCode} fallback={DEFAULTS.rtfAsCode}>
                    Display RTF files as RTF code instead of formatted text
                  </Option>
                </div>
              </PreferencesWindowRow>
              <PreferencesWindowRow label="When saving a file:">
                <Option setting={keys.addTxt} fallback={DEFAULTS.addTxt}>
                  Add ".txt" extension to plain text files
                </Option>
              </PreferencesWindowRow>
              <PreferencesWindowRow label="Opening files:">
                <EncodingChoice
                  label="Opening files"
                  setting={keys.openEncoding}
                  fallback={DEFAULTS.openEncoding}
                />
              </PreferencesWindowRow>
              <PreferencesWindowRow label="Saving files:">
                <EncodingChoice
                  label="Saving files"
                  setting={keys.saveEncoding}
                  fallback={DEFAULTS.saveEncoding}
                />
              </PreferencesWindowRow>
              <RestoreDefaults
                settings={["htmlAsCode", "rtfAsCode", "addTxt", "openEncoding", "saveEncoding"]}
              />
            </PreferencesWindowForm>
          </TabViewPanel>
        </TabView>
      </div>
    </PreferencesWindow>
  );
}
