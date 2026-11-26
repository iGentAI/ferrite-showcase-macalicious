"use client";

import { Checkbox } from "macalicious/checkbox";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { DatePicker } from "macalicious/date-picker";
import { EmptyState } from "macalicious/empty-state";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem, PopUpButtonSeparator } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { RoundButton } from "macalicious/round-button";
import { ScrollView } from "macalicious/scroll-view";
import { Segment, SegmentedControl } from "macalicious/segmented-control";
import { ShareMenu, ShareMenuItem } from "macalicious/share-menu";
import { SystemImage } from "macalicious/system-image";
import { TextField, type TextFieldProps } from "macalicious/text-field";
import {
  type CSSProperties,
  type DragEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { filesOfDrag, useDesktopDrop } from "../desktop/desktop-drag";
import { useDesktopValue } from "../desktop/desktop-personal";
import { servedByDesktopApp } from "../desktop/desktop-server";
import { AIRDROP_REASON, copyText } from "../desktop/desktop-share-link";
import { alertSoundSettings } from "../system-preferences/setting-effects";
import { ActionGlyph } from "./contacts-artwork";
import {
  ADDRESS_LABELS,
  type AddableField,
  addressFor,
  addressIsEmpty,
  addressLines,
  type Contact,
  type ContactAction,
  type ContactAddress,
  type ContactField,
  type ContactFieldKind,
  type ContactNameOrder,
  type ContactService,
  type ContactTextField,
  desktopAddress,
  displayName,
  displayNameIn,
  FIELD_KINDS,
  FIELD_ORDER,
  fieldsOf,
  formatPhone,
  IM_SERVICES,
  initialsOf,
  labelOf,
  nextAddressLabel,
  nextLabel,
  RINGTONES,
  SERVICES,
  secondaryName,
  socialUrl,
  TEXT_TONES,
} from "./contacts-data";
import { isPictureFile } from "./contacts-picture";
import {
  CONTACTS_ADDRESS_FORMAT,
  CONTACTS_PHONE_FORMAT,
  CONTACTS_PRIVATE_ME,
  readAddressFormat,
  readBooleanSetting,
} from "./contacts-print";
import { playContactTone } from "./contacts-tones";
import { birthdayFromVCard, birthdayToVCard } from "./contacts-vcard";

/** What an action is about: the card, and the value it was asked for. */
export interface ContactActionDetail {
  /** The card. */
  contact: Contact;
  /** The phone number, address or name the action is for; for `"share"`, the service. */
  value?: string;
}

/*
 * Every control of the card is the library's as the library draws it. A control gets a `size`
 * from its own props, a place from contacts.css, and at most a `width` here; nothing sets a
 * control's padding, height, colour, radius or background, and no font but one: the two fields
 * of a name being edited are given the name's 18 pt (NAME below), as text-field.mdx says a
 * field takes the font it is given. No component used here
 * documents a custom property that would (src/components/push-button, pop-up-button,
 * round-button and text-field: their pages list none but the text field's fill). Where
 * Contacts draws a control its own way the demo keeps the library's look, and contacts.mdx
 * lists the difference under Fidelity.
 *
 * The widths of the two bar buttons whose captured bezel the library's button can hold: Edit
 * is 59 pt and the share button 41 pt, and a button's box is its bezel and a hairline on each
 * side. The plus and Done keep the width the library gives them: beside the push button's
 * 14 pt of padding the captured 34 pt would leave 7 pt for the 11 pt plus, and the captured
 * 59 pt less than the title of Done needs.
 */
/** The 8 by 2 pt bar of a remove button, in the button's own content colour. */
const BAR: CSSProperties = { width: 8, height: 2, borderRadius: 0.5, background: "currentColor" };

/** A head with `lines` lines of text more than its measured two: it grows by them (contacts.css). */
const headLines = (lines: number) =>
  lines > 0 ? ({ "--_head-lines": lines } as CSSProperties) : undefined;
/**
 * The labels of a card being edited are in Contacts' blue, arrows too: the pop-up button's
 * hooks for a button without a bezel (pop-up-button.mdx, "Custom property" table), set on the
 * demo's cell around the button.
 */
const LABEL = {
  "--mac-pop-up-button-borderless-color": "var(--mac-contacts-link)",
  "--mac-pop-up-button-borderless-arrow-color": "var(--mac-contacts-link)",
} as CSSProperties;
const EDIT: CSSProperties = { width: 60 };
const SHARE: CSSProperties = { width: 42 };

/*
 * The card's rows are not the library's Form (src/components/form). A form's label is text
 * that names the control beside it; here the label is itself a control (a pop-up button
 * while the card is edited, a menu's trigger on a finished card), and a control cannot sit in
 * the label of another. Its labels are 13 pt in the label colour where Contacts' are 12 pt
 * grey, its separator has 20 pt on each side where the rules between the kinds of field have
 * 2 pt, and it has no place for the remove button before a label or the badge after a value.
 * Fitting it would mean restyling `.mac-form-label` and `.mac-form-separator`, so the two
 * columns are the demo's own grid (contacts.css, .mac-contacts-row).
 */

/** The value the label menu's last item has: it asks for a label of the user's own. */
const CUSTOM = "\u0000custom";

/** Why a button under the name is dimmed when the card has nothing it can use. */
export const NO_ADDRESS: Record<ContactService, string> = {
  message: "This card has no phone number or email address to send a message to.",
  call: "This card has no phone number to call.",
  video: "This card has no phone number or email address for FaceTime.",
  mail: "This card has no email address.",
};

/** Why a button under the name is dimmed when its service is not set up on this desktop. */
export const NOT_SET_UP: Record<ContactService, string> = {
  message: "Messages is not set up on this desktop.",
  call: "Calls are not set up on this desktop.",
  video: "FaceTime is not set up on this desktop.",
  mail: "Mail is not set up on this desktop.",
};

const focus = (input: HTMLInputElement | null) => input?.focus();

/** The options of a pop-up button, with the value it has when that is not one of them. */
const withValue = (options: readonly string[], value: string) =>
  options.includes(value) ? options : [...options, value];

/**
 * A glyph of the demo's own in a button, in the link colour when `tinted`. The colour is set
 * on this element, the demo's, and the drawing takes it as `currentColor`; the button around
 * it keeps its own colours, so an untinted glyph follows them, dimmed in a disabled button.
 */
function Glyph({ action, tinted = false }: { action: ContactAction; tinted?: boolean }) {
  return (
    <span className="mac-contacts-glyph" data-tinted={tinted ? "" : undefined}>
      <ActionGlyph action={action} />
    </span>
  );
}

/**
 * A card's picture: its own picture when it has one (on the desktop served by Ferrite), else
 * its initials on a disc, or the library's `user` image for a silhouette.
 */
export function ContactPicture({
  contact,
  size,
  imageUrl,
}: {
  contact: Contact;
  size: number;
  imageUrl?: string;
}) {
  const initials = contact.picture === "silhouette" ? "" : initialsOf(contact);
  return (
    <span
      className="mac-contacts-picture"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.436) }}
      aria-hidden="true"
    >
      {imageUrl ? (
        <img className="mac-contacts-picture-image" src={imageUrl} alt="" />
      ) : (
        initials || <SystemImage name="user" scale={(size * 0.56) / 13} />
      )}
    </span>
  );
}

/** The desktop user a card is for, as a row of fixed label and text: "account". */
function AccountRow({ user, mode }: { user: string; mode: "view" | "edit" }) {
  return (
    <div className="mac-contacts-group">
      <div className="mac-contacts-row" data-mode={mode}>
        <span className="mac-contacts-label" data-fixed="">
          account
        </span>
        <span className="mac-contacts-value" data-account="">
          {desktopAddress(user)}
        </span>
      </div>
    </div>
  );
}

/**
 * The type of a card's name, which is edited in place at that size: a text field takes the
 * font it is given (text-field.mdx, the `large-text` example), and without a bezel it is as
 * high as its line.
 */
const NAME = { font: "400 18px / 22px var(--mac-font-family-system)" } as CSSProperties;

/**
 * A text field without a bezel that is as wide as its text, or as its placeholder while it
 * is empty: a hidden copy of the text sizes the box and the field fills it.
 */
function AutoField({ value, placeholder, ...props }: TextFieldProps & { value: string }) {
  return (
    <span className="mac-contacts-autosize">
      <span className="mac-contacts-autosize-text" aria-hidden="true">
        {value || placeholder}
      </span>
      <TextField
        bezel="none"
        className="mac-contacts-field"
        value={value}
        placeholder={placeholder}
        {...props}
      />
    </span>
  );
}

/** The choice between the monogram and a silhouette, in the Picture pane. */
function PictureChoice({
  contact,
  onChange,
}: {
  contact: Contact;
  onChange: (contact: Contact) => void;
}) {
  return (
    <RadioGroup
      aria-label="Picture"
      value={contact.picture ?? "monogram"}
      onValueChange={(picture) => onChange({ ...contact, picture: picture as Contact["picture"] })}
    >
      <RadioButton value="monogram">Monogram</RadioButton>
      <RadioButton value="silhouette">Silhouette</RadioButton>
    </RadioGroup>
  );
}

/**
 * A row's label while the card is edited: the pop-up button of its labels, whose last item asks
 * for a label of the user's own, in a text field while that is typed.
 */
function FieldLabel({
  label,
  labels,
  name,
  hook,
  onLabel,
}: {
  label: string;
  labels: readonly string[];
  /** What the row is, for the button's name: "phone". */
  name: string;
  /** The row's `data-contacts-label`. */
  hook: string;
  onLabel: (label: string) => void;
}) {
  const [naming, setNaming] = useState(false);
  // The closing menu hands the keyboard back as the field appears. An empty field has been left only
  // after a press or Tab; any other blur is that hand-back, and the field keeps the keyboard.
  const leaving = useRef(false);
  useEffect(() => {
    if (!naming) return;
    leaving.current = false;
    const press = () => {
      leaving.current = true;
    };
    document.addEventListener("pointerdown", press, true);
    return () => document.removeEventListener("pointerdown", press, true);
  }, [naming]);
  const done = (text: string) => {
    const typed = text.trim();
    if (typed !== "") onLabel(typed);
    setNaming(false);
  };
  return (
    // The label's cell is the demo's: it sets the control against the column's end. The pop-up
    // button keeps its own width and type, in the label's blue.
    <span className="mac-contacts-label-cell" style={LABEL}>
      {naming ? (
        <TextField
          size="small"
          className="mac-contacts-custom"
          aria-label="Custom label"
          placeholder="Label"
          inputRef={focus}
          onBlur={(event) => {
            const input = event.currentTarget;
            if (input.value === "" && !leaving.current) input.focus();
            else done(input.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Tab") leaving.current = true;
            if (event.key === "Enter") done(event.currentTarget.value);
            else if (event.key === "Escape") setNaming(false);
            else return;
            event.preventDefault();
          }}
        />
      ) : (
        <PopUpButton
          size="small"
          bordered={false}
          className="mac-contacts-label-pop"
          aria-label={`${name} label`}
          data-contacts-label={hook}
          value={label}
          onValueChange={(next) => {
            if (next === CUSTOM) setNaming(true);
            else if (next != null) onLabel(next);
          }}
        >
          {withValue(labels, label).map((option) => (
            <PopUpButtonItem key={option} value={option} data-contacts-option={option}>
              {option}
            </PopUpButtonItem>
          ))}
          <PopUpButtonSeparator />
          <PopUpButtonItem value={CUSTOM}>Custom…</PopUpButtonItem>
        </PopUpButton>
      )}
    </span>
  );
}

/** The fields of one kind while the card is edited, and an empty one for the next. */
function EditGroup({
  kind,
  fields,
  focusEmpty = false,
  sharing = false,
  onChange,
}: {
  kind: ContactFieldKind;
  fields: readonly ContactField[];
  /** Whether the empty row takes the keyboard focus: the kind was just added. */
  focusEmpty?: boolean;
  /** Each field has a check for whether a vCard of My Card shares it (the private me card). */
  sharing?: boolean;
  onChange: (fields: readonly ContactField[]) => void;
}) {
  const spec = FIELD_KINDS[kind];
  // An empty field follows the last one that holds something. It becomes a field of the card
  // when something is typed in it or its label is changed; rows are keyed by position, so the
  // field keeps the focus when that happens.
  const last = fields.at(-1);
  const rows =
    last?.value !== "" ? [...fields, { label: nextLabel(kind, fields), value: "" }] : fields;
  const set = (index: number, patch: Partial<ContactField>) => {
    const row = rows[index];
    if (!row) return;
    if (index < fields.length)
      onChange(fields.map((field, at) => (at === index ? { ...field, ...patch } : field)));
    else onChange([...fields, { ...row, ...patch }]);
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and form semantics; these are the rows of one kind of field
    <div role="group" aria-label={spec.name} className="mac-contacts-group">
      {rows.map((field, index) => {
        const label = labelOf(field);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: the position is the row's identity, see above
          <div key={index} className="mac-contacts-row" data-mode="edit">
            {field.value !== "" && index < fields.length ? (
              // The library's destructive round button at its mini size: the red disc, with
              // the white bar its docs page puts in it.
              <RoundButton
                variant="destructive"
                size="mini"
                className="mac-contacts-remove"
                aria-label={`Remove ${label} ${spec.name}`}
                onClick={() => onChange(fields.filter((_, at) => at !== index))}
              >
                <span aria-hidden="true" style={BAR} />
              </RoundButton>
            ) : null}
            <FieldLabel
              label={label}
              labels={spec.labels}
              name={spec.name}
              hook={`${kind}-${index}`}
              onLabel={(next) => set(index, { label: next })}
            />
            <span className="mac-contacts-value">
              {sharing && field.value !== "" ? (
                <Checkbox
                  aria-label={`Share ${label} ${spec.name}`}
                  checked={!field.private}
                  onCheckedChange={(shared) => set(index, { private: shared ? undefined : true })}
                />
              ) : null}
              <AutoField
                aria-label={`${label} ${spec.name}`}
                placeholder={spec.placeholder}
                value={field.value}
                inputRef={focusEmpty && field.value === "" ? focus : undefined}
                onValueChange={(value) => set(index, { value })}
              />
              {kind === "im" ? (
                <PopUpButton
                  bordered={false}
                  aria-label={`${label} service`}
                  value={field.service ?? IM_SERVICES[0]}
                  onValueChange={(service) => {
                    if (service != null) set(index, { service });
                  }}
                >
                  {withValue(IM_SERVICES, field.service ?? IM_SERVICES[0] ?? "").map((service) => (
                    <PopUpButtonItem key={service} value={service}>
                      {service}
                    </PopUpButtonItem>
                  ))}
                </PopUpButton>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** The postal addresses while the card is edited, and an empty one for the next. */
function EditAddresses({
  addresses,
  focusEmpty,
  onChange,
}: {
  addresses: readonly ContactAddress[];
  /** Whether the empty address takes the keyboard focus: it was just added. */
  focusEmpty: boolean;
  onChange: (addresses: readonly ContactAddress[]) => void;
}) {
  const last = addresses.at(-1);
  const rows =
    last === undefined || !addressIsEmpty(last)
      ? [
          ...addresses,
          {
            label: nextAddressLabel(addresses),
            street: "",
            city: "",
            state: "",
            zip: "",
            country: "",
          },
        ]
      : addresses;
  const set = (index: number, patch: Partial<ContactAddress>) => {
    const row = rows[index];
    if (!row) return;
    if (index < addresses.length)
      onChange(addresses.map((each, at) => (at === index ? { ...each, ...patch } : each)));
    else onChange([...addresses, { ...row, ...patch }]);
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and form semantics; these are the rows of one kind of field
    <div role="group" aria-label="address" className="mac-contacts-group">
      {rows.map((address, index) => {
        const label = labelOf(address);
        const part = (name: keyof ContactAddress, placeholder: string, takesFocus = false) => (
          <AutoField
            aria-label={`${label} ${placeholder}`}
            placeholder={placeholder}
            value={address[name]}
            inputRef={takesFocus && focusEmpty && addressIsEmpty(address) ? focus : undefined}
            onValueChange={(value) => set(index, { [name]: value })}
          />
        );
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: the position is the row's identity, as in EditGroup
          <div key={index} className="mac-contacts-row" data-mode="edit" data-tall="">
            {!addressIsEmpty(address) && index < addresses.length ? (
              <RoundButton
                variant="destructive"
                size="mini"
                className="mac-contacts-remove"
                aria-label={`Remove ${label} address`}
                onClick={() => onChange(addresses.filter((_, at) => at !== index))}
              >
                <span aria-hidden="true" style={BAR} />
              </RoundButton>
            ) : null}
            <FieldLabel
              label={label}
              labels={ADDRESS_LABELS}
              name="address"
              hook={`address-${index}`}
              onLabel={(next) => set(index, { label: next })}
            />
            <span className="mac-contacts-value mac-contacts-address">
              {part("street", "Street", true)}
              <span className="mac-contacts-address-line">
                {part("city", "City")}
                {part("state", "State")}
                {part("zip", "ZIP")}
              </span>
              {part("country", "Country")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** A row with a fixed label and a choice: the ringtone, the text tone. */
function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="mac-contacts-group">
      <div className="mac-contacts-row" data-mode="edit">
        <span className="mac-contacts-label" data-fixed="">
          {label}
        </span>
        <span className="mac-contacts-value">
          <PopUpButton
            bordered={false}
            className="mac-contacts-choice"
            aria-label={label}
            value={value}
            onValueChange={(next) => {
              if (next == null) return;
              onChange(next);
              const { volume, muted } = alertSoundSettings();
              if (!muted) playContactTone(next, volume);
            }}
          >
            {withValue(options, value).map((option) => (
              <PopUpButtonItem key={option} value={option}>
                {option}
              </PopUpButtonItem>
            ))}
          </PopUpButton>
        </span>
      </div>
    </div>
  );
}

/** A vCard date, `1990-10-07`, as local midnight; `null` for a date with no year. */
function dateOfBirthday(typed: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdayToVCard(typed) ?? "");
  return parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : null;
}

/**
 * The birthday: typed as a person says it, a date with no year among them, or picked. An empty
 * birthday shows only its placeholder until the field has the focus, as in Catalina's Contacts.
 */
function BirthdayRow({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="mac-contacts-group">
      <div className="mac-contacts-row" data-mode="edit">
        <span className="mac-contacts-label" data-fixed="">
          birthday
        </span>
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and form semantics */}
        <span
          role="group"
          aria-label="birthday"
          className="mac-contacts-value mac-contacts-birthday"
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
          }}
        >
          <AutoField
            aria-label="birthday"
            placeholder="month/day/year"
            value={value}
            onValueChange={onChange}
          />
          {value || focused ? (
            <DatePicker
              aria-label="birthday date"
              size="small"
              elements="yearMonthDay"
              value={dateOfBirthday(value) ?? new Date()}
              onValueChange={(date) =>
                onChange(
                  date.toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  }),
                )
              }
            />
          ) : null}
        </span>
      </div>
    </div>
  );
}

/** The note: lines of text, as the Edit menu's spelling and substitutions read them. */
function NoteRow({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="mac-contacts-group">
      <div className="mac-contacts-row" data-mode="edit">
        <span className="mac-contacts-label" data-fixed="">
          note
        </span>
        <span className="mac-contacts-value">
          <textarea
            className="mac-contacts-note-field"
            aria-label="note"
            placeholder="note"
            rows={Math.max(1, value.split("\n").length)}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        </span>
      </div>
    </div>
  );
}

/** Why Search with Spotlight is dimmed on a served desktop. */
export const NO_SPOTLIGHT_SEARCH =
  "Spotlight can be opened from its menu bar item, and does not yet take a search from an application.";

/** The fields of one kind on a finished card: each label opens a menu of commands. */
function ViewGroup({
  kind,
  contact,
  onAction,
}: {
  kind: ContactFieldKind;
  contact: Contact;
  onAction?: (action: ContactAction, detail: ContactActionDetail) => void;
}) {
  const spec = FIELD_KINDS[kind];
  const fields = fieldsOf(contact, kind);
  const formatsPhones = useDesktopValue(CONTACTS_PHONE_FORMAT, readBooleanSetting, false);
  if (fields.length === 0) return null;
  const { badge } = spec;
  const served = servedByDesktopApp();
  const shownValue = (value: string) => {
    if (kind === "date") return dateText(value);
    return kind === "phone" && formatsPhones ? formatPhone(value) : value;
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and form semantics; these are the rows of one kind of field
    <div role="group" aria-label={spec.name} className="mac-contacts-group">
      {fields.map((field, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fields have no identity but their position
        <div key={index} className="mac-contacts-row" data-mode="view">
          {spec.actions.length === 0 ? (
            <span className="mac-contacts-label" data-fixed="">
              {labelOf(field)}
            </span>
          ) : (
            <Menu>
              {/* The library's MenuTrigger is an unstyled button (src/components/menu/menu.mdx:
                "a menu has no bezel of its own"), so the label's look is the demo's to draw. */}
              <MenuTrigger className="mac-contacts-label" data-contacts-menu={`${kind}-${index}`}>
                {labelOf(field)}
              </MenuTrigger>
              <MenuPopup side="right" align="start" sideOffset={0} alignOffset={-1}>
                {spec.actions.map(({ action, title }) => {
                  const value = kind === "social" ? socialUrl(field) : field.value;
                  const noSearch = served && action === "spotlight";
                  return (
                    <MenuItem
                      key={action}
                      data-contacts-action={action}
                      disabled={value === undefined || noSearch}
                      title={noSearch ? NO_SPOTLIGHT_SEARCH : undefined}
                      onClick={() => onAction?.(action, { contact, value })}
                    >
                      {title}
                    </MenuItem>
                  );
                })}
              </MenuPopup>
            </Menu>
          )}
          <span className="mac-contacts-value">
            {kind === "url" ? (
              <a
                className="mac-contacts-link"
                href={/^https?:\/\//i.test(field.value) ? field.value : `https://${field.value}`}
                onClick={(event) => {
                  event.preventDefault();
                  onAction?.("open", { contact, value: field.value });
                }}
              >
                {field.value}
              </a>
            ) : (
              shownValue(field.value)
            )}
            {field.service ? <span className="mac-contacts-service"> {field.service}</span> : null}
          </span>
          {badge ? (
            <span className="mac-contacts-badges">
              <RoundButton
                aria-label={`${spec.actions[0]?.title ?? badge} ${field.value}`}
                onClick={() => onAction?.(badge, { contact, value: field.value })}
              >
                <Glyph action={badge} tinted />
              </RoundButton>
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** A date as a finished card shows it: "January 2, 2020", or as it was typed. */
const dateText = (typed: string) => {
  const date = birthdayToVCard(typed);
  return date ? birthdayFromVCard(date) : typed;
};

/** The postal addresses of a finished card: the label's menu shows one on a map or copies it. */
function ViewAddresses({
  contact,
  onAction,
}: {
  contact: Contact;
  onAction?: (action: ContactAction, detail: ContactActionDetail) => void;
}) {
  const addresses = (contact.addresses ?? []).filter((address) => !addressIsEmpty(address));
  const format = useDesktopValue(CONTACTS_ADDRESS_FORMAT, readAddressFormat, "us");
  if (addresses.length === 0) return null;
  return (
    // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and form semantics; these are the rows of one kind of field
    <div role="group" aria-label="address" className="mac-contacts-group">
      {addresses.map((address, index) => {
        const lines = addressLines(address, format);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: an address has no identity but its position
          <div key={index} className="mac-contacts-row" data-mode="view" data-tall="">
            <Menu>
              <MenuTrigger className="mac-contacts-label" data-contacts-menu={`address-${index}`}>
                {labelOf(address)}
              </MenuTrigger>
              <MenuPopup side="right" align="start" sideOffset={0} alignOffset={-1}>
                <MenuItem
                  data-contacts-action="map"
                  onClick={() => onAction?.("map", { contact, value: lines.join(", ") })}
                >
                  Show on Map
                </MenuItem>
                <MenuItem
                  data-contacts-action="copy-label"
                  onClick={() =>
                    onAction?.("copy-label", {
                      contact,
                      value: [displayName(contact), ...lines].join("\n"),
                    })
                  }
                >
                  Copy Mailing Label
                </MenuItem>
              </MenuPopup>
            </Menu>
            <span className="mac-contacts-value" data-wrap="">
              {lines.join("\n")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export interface ContactCardProps {
  /** Whose name comes first in the card's title. */
  nameOrder?: ContactNameOrder;
  /** The card, or `null` when the list has none to show. */
  contact: Contact | null;
  /** Whether the card is being edited. */
  editing: boolean;
  /** Whether the first name takes the keyboard focus when the card starts being edited. */
  focusName: boolean;
  /** The field that takes the keyboard focus: the one Card > Add Field just added. */
  focusField?: AddableField | null;
  /** The services set up on the Mac: a button under the name needs its service. */
  services: readonly ContactService[];
  /** Called with the changed card on every edit. */
  onChange: (contact: Contact) => void;
  /** Called when Edit is pressed. */
  onEdit: () => void;
  /** Called when Done is pressed. */
  onDone: () => void;
  /** Called when the plus is pressed. */
  onAdd: () => void;
  /** Called when a button, a badge, a label's menu or the share menu asks for an action. */
  onAction?: (action: ContactAction, detail: ContactActionDetail) => void;
  /**
   * The card's own picture, a `data:` URL, shown in place of its monogram. Only the desktop
   * served by Ferrite keeps pictures; without one the card shows its monogram.
   */
  imageUrl?: string;
  /** Further controls of the Picture pane of a card being edited: the desktop's choosers. */
  pictureCommands?: ReactNode;
  /** Further controls of the bar, after the plus: the desktop's commands. */
  barCommands?: ReactNode;
  /** Called with a picture file dropped on the card's head. A window without it takes no drop. */
  onPictureFile?: (file: File) => void;
  /** Called by a double click on the card's own picture, to frame it anew. */
  onEditPicture?: () => void;
  /**
   * The rows of a value's contextual menu after Copy, for the text clicked: a window without it
   * has Copy alone.
   */
  valueCommands?: (text: string) => ReactNode;
}

/**
 * The card pane: the picture and the name, then the buttons and the fields of a finished
 * card or the editable fields, and the bar with the add, Edit or Done and share buttons.
 */
export function ContactCard({
  nameOrder = "first",
  contact,
  editing,
  focusName,
  focusField = null,
  services,
  onChange,
  onEdit,
  onDone,
  onAdd,
  onAction,
  imageUrl,
  pictureCommands,
  barCommands,
  onPictureFile,
  onEditPicture,
  valueCommands,
}: ContactCardProps) {
  // Which of the two panes of a card being edited is shown.
  const [pane, setPane] = useState("info");
  // The text of the value whose contextual menu is open.
  const [menuValue, setMenuValue] = useState("");
  const privateMe = useDesktopValue(CONTACTS_PRIVATE_ME, readBooleanSetting, false);
  const sharing = privateMe && contact?.me === true;
  const pictureDrop = onPictureFile
    ? {
        onDragOver: (event: DragEvent<HTMLDivElement>) => {
          if (![...event.dataTransfer.types].includes("Files")) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        },
        onDrop: (event: DragEvent<HTMLDivElement>) => {
          const [file] = [...event.dataTransfer.files].filter((each) =>
            isPictureFile(each.type, each.name),
          );
          if (!file) return;
          event.preventDefault();
          onPictureFile(file);
        },
      }
    : undefined;
  // A photo dragged from Photos, Finder or the desktop.
  const pictureTarget = useDesktopDrop<HTMLDivElement>({
    enabled: onPictureFile !== undefined,
    accepts: (item) => item.kind === "file" && isPictureFile(item.type, item.name),
    onDrop: ([item]) => {
      if (item) void filesOfDrag([item]).then(([file]) => file && onPictureFile?.(file));
    },
  });
  const framing = imageUrl && onEditPicture ? { onDoubleClick: onEditPicture } : undefined;
  const editable = contact !== null && editing;
  const under = contact === null ? "" : secondaryName(contact);
  // A field Card > Add Field just added is on the Info pane, shown in the render that focuses it.
  if (focusField && pane !== "info") setPane("info");
  // A line of the head while the card is edited, once the field has been added.
  const headField = (field: ContactTextField, name: string) =>
    contact?.[field] === undefined ? null : (
      <AutoField
        aria-label={name}
        placeholder={name}
        value={contact[field] ?? ""}
        inputRef={focusField === field ? focus : undefined}
        onValueChange={(value) => onChange({ ...contact, [field]: value })}
      />
    );
  const hasPhonetic = contact?.phoneticFirst !== undefined || contact?.phoneticLast !== undefined;
  const editLines =
    (hasPhonetic ? 1 : 0) +
    [contact?.nickname, contact?.jobTitle, contact?.department].filter((text) => text !== undefined)
      .length;
  const phonetic = [contact?.phoneticFirst?.trim(), contact?.phoneticLast?.trim()]
    .filter(Boolean)
    .join(" ");
  const nickname = contact?.nickname?.trim();
  const viewLines = [
    nickname ? `\u201c${nickname}\u201d` : "",
    contact?.jobTitle?.trim() ?? "",
    contact?.department?.trim() ?? "",
  ].filter(Boolean);
  return (
    <>
      {contact === null ? (
        <EmptyState className="mac-contacts-none">No Card Selected</EmptyState>
      ) : (
        <ScrollView className="mac-contacts-scroll">
          {editing ? (
            <>
              <div
                className="mac-contacts-head"
                data-mode="edit"
                ref={pictureTarget}
                style={headLines(editLines)}
                {...pictureDrop}
                {...framing}
              >
                <ContactPicture contact={contact} size={55} imageUrl={imageUrl} />
                <div className="mac-contacts-identity">
                  {hasPhonetic ? (
                    <div className="mac-contacts-phonetic-fields">
                      {headField("phoneticFirst", "Phonetic First")}
                      {headField("phoneticLast", "Phonetic Last")}
                    </div>
                  ) : null}
                  <div className="mac-contacts-name">
                    <AutoField
                      aria-label="First"
                      placeholder="First"
                      style={NAME}
                      inputRef={focusName ? focus : undefined}
                      value={contact.first}
                      onValueChange={(first) => onChange({ ...contact, first })}
                    />
                    <AutoField
                      aria-label="Last"
                      placeholder="Last"
                      style={NAME}
                      value={contact.last}
                      onValueChange={(last) => onChange({ ...contact, last })}
                    />
                  </div>
                  {headField("nickname", "Nickname")}
                  {headField("jobTitle", "Job Title")}
                  {headField("department", "Department")}
                  <AutoField
                    aria-label="Company name"
                    placeholder="Company"
                    value={contact.company ?? ""}
                    onValueChange={(company) => onChange({ ...contact, company })}
                  />
                  <Checkbox
                    size="small"
                    className="mac-contacts-company-box"
                    checked={!!contact.isCompany}
                    onCheckedChange={(isCompany) => onChange({ ...contact, isCompany })}
                  >
                    Company
                  </Checkbox>
                </div>
                <SegmentedControl
                  className="mac-contacts-panes"
                  aria-label="Card"
                  value={[pane]}
                  onValueChange={(next) => {
                    if (next[0]) setPane(next[0]);
                  }}
                >
                  <Segment value="info">Info</Segment>
                  <Segment value="picture">Picture</Segment>
                </SegmentedControl>
              </div>
              {pane === "picture" ? (
                <div className="mac-contacts-picture-pane">
                  <ContactPicture contact={contact} size={110} imageUrl={imageUrl} />
                  {pictureCommands ? (
                    <div className="mac-contacts-picture-choices">
                      <PictureChoice contact={contact} onChange={onChange} />
                      {pictureCommands}
                    </div>
                  ) : (
                    <PictureChoice contact={contact} onChange={onChange} />
                  )}
                </div>
              ) : (
                <div className="mac-contacts-fields">
                  {contact.user ? <AccountRow user={contact.user} mode="edit" /> : null}
                  <EditGroup
                    kind="phone"
                    sharing={sharing}
                    fields={fieldsOf(contact, "phone")}
                    onChange={(phones) => onChange({ ...contact, phones })}
                  />
                  <EditGroup
                    kind="email"
                    sharing={sharing}
                    fields={fieldsOf(contact, "email")}
                    onChange={(emails) => onChange({ ...contact, emails })}
                  />
                  <ChoiceRow
                    label="ringtone"
                    value={contact.ringtone ?? RINGTONES[0] ?? ""}
                    options={RINGTONES}
                    onChange={(ringtone) => onChange({ ...contact, ringtone })}
                  />
                  <ChoiceRow
                    label="text tone"
                    value={contact.textTone ?? TEXT_TONES[0] ?? ""}
                    options={TEXT_TONES}
                    onChange={(textTone) => onChange({ ...contact, textTone })}
                  />
                  <EditGroup
                    kind="url"
                    sharing={sharing}
                    fields={fieldsOf(contact, "url")}
                    onChange={(urls) => onChange({ ...contact, urls })}
                  />
                  <BirthdayRow
                    value={contact.birthday ?? ""}
                    onChange={(birthday) => onChange({ ...contact, birthday })}
                  />
                  {contact.dates !== undefined ? (
                    <EditGroup
                      kind="date"
                      fields={contact.dates}
                      focusEmpty={focusField === "date"}
                      onChange={(dates) => onChange({ ...contact, dates })}
                    />
                  ) : null}
                  {contact.relatedNames !== undefined ? (
                    <EditGroup
                      kind="related"
                      fields={contact.relatedNames}
                      focusEmpty={focusField === "related"}
                      onChange={(relatedNames) => onChange({ ...contact, relatedNames })}
                    />
                  ) : null}
                  {contact.socials !== undefined ? (
                    <EditGroup
                      kind="social"
                      fields={contact.socials}
                      focusEmpty={focusField === "social"}
                      onChange={(socials) => onChange({ ...contact, socials })}
                    />
                  ) : null}
                  <EditGroup
                    kind="im"
                    sharing={sharing}
                    fields={fieldsOf(contact, "im")}
                    onChange={(ims) => onChange({ ...contact, ims })}
                  />
                  {contact.addresses !== undefined ? (
                    <EditAddresses
                      addresses={contact.addresses}
                      focusEmpty={focusField === "address"}
                      onChange={(addresses) => onChange({ ...contact, addresses })}
                    />
                  ) : null}
                  <NoteRow
                    value={contact.note ?? ""}
                    onChange={(note) => onChange({ ...contact, note })}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div
                className="mac-contacts-head"
                data-mode="view"
                ref={pictureTarget}
                style={headLines(viewLines.length + (phonetic ? 1 : 0))}
                {...pictureDrop}
                {...framing}
              >
                <ContactPicture contact={contact} size={55} imageUrl={imageUrl} />
                <div className="mac-contacts-identity">
                  {phonetic ? <div className="mac-contacts-phonetic">{phonetic}</div> : null}
                  <h2 className="mac-contacts-name">{displayNameIn(contact, nameOrder)}</h2>
                  {viewLines.map((line) => (
                    <div key={line} className="mac-contacts-company">
                      {line}
                    </div>
                  ))}
                  {under ? <div className="mac-contacts-company">{under}</div> : null}
                </div>
                {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring a legend and form semantics; these are four buttons */}
                <div role="group" aria-label="Actions" className="mac-contacts-actions">
                  {SERVICES.map((service) => {
                    const address = addressFor(contact, service);
                    const available = address !== undefined && services.includes(service);
                    const reason = available
                      ? undefined
                      : address === undefined
                        ? NO_ADDRESS[service]
                        : NOT_SET_UP[service];
                    return (
                      <div key={service} className="mac-contacts-action">
                        <RoundButton
                          aria-label={service}
                          disabled={!available}
                          focusableWhenDisabled={!available}
                          title={reason}
                          onClick={() => onAction?.(service, { contact, value: address })}
                        >
                          <Glyph action={service} tinted={available} />
                        </RoundButton>
                        <span className="mac-contacts-caption" aria-hidden="true">
                          {service}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <ContextualMenu>
                <ContextualMenuTrigger
                  className="mac-contacts-menu-area"
                  onContextMenu={(event) => {
                    const value = (event.target as Element).closest(
                      ".mac-contacts-value:not([data-no-menu])",
                    );
                    const shown = value?.cloneNode(true) as Element | undefined;
                    shown?.querySelector(".mac-contacts-service")?.remove();
                    const text = shown?.textContent?.trim();
                    if (!text) {
                      event.preventBaseUIHandler();
                      return;
                    }
                    setMenuValue(text);
                  }}
                >
                  <div className="mac-contacts-fields">
                    {contact.user ? <AccountRow user={contact.user} mode="view" /> : null}
                    {addressFor(contact, "video") !== undefined ? (
                      <div className="mac-contacts-group">
                        <div className="mac-contacts-row" data-mode="view">
                          <span />
                          <span className="mac-contacts-value" data-no-menu="">
                            FaceTime
                          </span>
                          <span className="mac-contacts-badges">
                            <RoundButton
                              aria-label="FaceTime video"
                              onClick={() =>
                                onAction?.("video", {
                                  contact,
                                  value: addressFor(contact, "video"),
                                })
                              }
                            >
                              <Glyph action="video" tinted />
                            </RoundButton>
                            <RoundButton
                              aria-label="FaceTime audio"
                              onClick={() =>
                                onAction?.("call", { contact, value: addressFor(contact, "video") })
                              }
                            >
                              <Glyph action="call" tinted />
                            </RoundButton>
                          </span>
                        </div>
                      </div>
                    ) : null}
                    {FIELD_ORDER.map((kind) => (
                      <ViewGroup key={kind} kind={kind} contact={contact} onAction={onAction} />
                    ))}
                    <ViewAddresses contact={contact} onAction={onAction} />
                    {contact.birthday ? (
                      <div className="mac-contacts-group">
                        <div className="mac-contacts-row" data-mode="view">
                          <span className="mac-contacts-label" data-fixed="">
                            birthday
                          </span>
                          <span className="mac-contacts-value">{dateText(contact.birthday)}</span>
                        </div>
                      </div>
                    ) : null}
                    <div className="mac-contacts-group" data-last="">
                      <div className="mac-contacts-row" data-mode="view">
                        <span className="mac-contacts-label" data-fixed="">
                          note
                        </span>
                        <span className="mac-contacts-value" data-wrap="">
                          {contact.note}
                        </span>
                      </div>
                    </div>
                  </div>
                </ContextualMenuTrigger>
                <ContextualMenuPopup aria-label="Field commands">
                  <MenuItem onClick={() => void copyText(menuValue)}>Copy</MenuItem>
                  {valueCommands?.(menuValue)}
                </ContextualMenuPopup>
              </ContextualMenu>
            </>
          )}
        </ScrollView>
      )}
      <div className="mac-contacts-bar" data-mode={editable ? "edit" : "view"}>
        {/* The library's push buttons with its `add` and `share` images, in their own type
            and colours: Done is the emphasised push button, as wide as its title makes it. */}
        <PushButton aria-label="New Contact" onClick={onAdd}>
          <SystemImage name="add" />
        </PushButton>
        {barCommands}
        <span className="mac-contacts-bar-space" />
        <PushButton
          variant={editable ? "emphasized" : undefined}
          style={editable ? undefined : EDIT}
          disabled={contact === null}
          onClick={editable ? onDone : onEdit}
        >
          {editable ? "Done" : "Edit"}
        </PushButton>
        <ShareMenu
          aria-label="Share"
          disabled={contact === null}
          trigger={
            <PushButton style={SHARE}>
              <SystemImage name="share" />
            </PushButton>
          }
        >
          <ShareMenuItem
            image={<ActionGlyph action="mail" />}
            onClick={() => contact && onAction?.("share", { contact, value: "Mail" })}
          >
            Mail
          </ShareMenuItem>
          <ShareMenuItem
            image={<ActionGlyph action="message" />}
            onClick={() => contact && onAction?.("share", { contact, value: "Messages" })}
          >
            Messages
          </ShareMenuItem>
          <ShareMenuItem
            onClick={() => contact && onAction?.("share", { contact, value: "Notes" })}
          >
            Notes
          </ShareMenuItem>
          <ShareMenuItem disabled title={AIRDROP_REASON}>
            AirDrop
          </ShareMenuItem>
        </ShareMenu>
      </div>
    </>
  );
}
