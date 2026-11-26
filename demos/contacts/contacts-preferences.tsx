"use client";

import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { Checkbox } from "macalicious/checkbox";
import { Form, FormRow } from "macalicious/form";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PreferencesToolbar, PreferencesToolbarItem } from "macalicious/preferences-toolbar";
import {
  PreferencesWindow,
  PreferencesWindowPane,
  type PreferencesWindowProps,
} from "macalicious/preferences-window";
import { SystemImage } from "macalicious/system-image";
import { useState } from "react";
import { changeDesktopValue, useDesktopValue } from "../desktop/desktop-personal";
import { ADD_FIELDS, ADDRESS_FORMATS, type AddableField, formatPhone } from "./contacts-data";
import {
  CONTACTS_ACCOUNTS_OFF,
  CONTACTS_ADDRESS_FORMAT,
  CONTACTS_DEFAULT_ACCOUNT,
  CONTACTS_NAME_ORDER,
  CONTACTS_PHONE_FORMAT,
  CONTACTS_PRIVATE_ME,
  CONTACTS_SORT,
  CONTACTS_TEMPLATE,
  CONTACTS_VCARD_ENCODING,
  CONTACTS_VCARD_FORMAT,
  CONTACTS_VCARD_NOTES,
  CONTACTS_VCARD_PHOTOS,
  NO_ACCOUNTS_OFF,
  readAccountsOff,
  readAddressFormat,
  readBooleanSetting,
  readContactSort,
  readDefaultAccount,
  readTemplate,
  readVCardEncoding,
  readVCardFormat,
} from "./contacts-print";
import "./contacts.tokens.css";
import "./contacts.css";

const ACCOUNTS = [
  ["icloud", "iCloud"],
  ["mac", "On My Mac"],
] as const;
const NO_OTHER_ACCOUNTS =
  "Both are kept on this desktop's server, not at Apple. A desktop has no other account to add.";
const LAST_ACCOUNT = "One account stays on: a card has to be kept in one.";
const NO_TEMPLATE: readonly AddableField[] = [];
const SAMPLE_NUMBER = "5550100000";

/** Contacts > Preferences: how names and addresses read, what a new card holds, what vCards write. */
export function ContactsPreferences({
  className,
  ...props
}: Omit<PreferencesWindowProps, "toolbar" | "children" | "modal">) {
  const order = useDesktopValue(CONTACTS_NAME_ORDER, readContactSort, "first");
  const sort = useDesktopValue(CONTACTS_SORT, readContactSort, "last");
  const addressFormat = useDesktopValue(CONTACTS_ADDRESS_FORMAT, readAddressFormat, "us");
  const formatsPhones = useDesktopValue(CONTACTS_PHONE_FORMAT, readBooleanSetting, false);
  const vCardNotes = useDesktopValue(CONTACTS_VCARD_NOTES, readBooleanSetting, true);
  const vCardFormat = useDesktopValue(CONTACTS_VCARD_FORMAT, readVCardFormat, "3.0");
  const vCardEncoding = useDesktopValue(CONTACTS_VCARD_ENCODING, readVCardEncoding, "utf-8");
  const vCardPhotos = useDesktopValue(CONTACTS_VCARD_PHOTOS, readBooleanSetting, true);
  const privateMe = useDesktopValue(CONTACTS_PRIVATE_ME, readBooleanSetting, false);
  const template = useDesktopValue(CONTACTS_TEMPLATE, readTemplate, NO_TEMPLATE);
  const defaultAccount = useDesktopValue(CONTACTS_DEFAULT_ACCOUNT, readDefaultAccount, "icloud");
  const accountsOff = useDesktopValue(CONTACTS_ACCOUNTS_OFF, readAccountsOff, NO_ACCOUNTS_OFF);
  const [account, setAccount] = useState<(typeof ACCOUNTS)[number][0]>("icloud");
  const accountOn = !accountsOff.includes(account);
  return (
    <PreferencesWindow
      width={480}
      className={className ? `mac-contacts-preferences ${className}` : "mac-contacts-preferences"}
      toolbar={
        <PreferencesToolbar aria-label="Contacts preferences">
          <PreferencesToolbarItem value="general" icon={<SystemImage name="action" />}>
            General
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="accounts" icon={<SystemImage name="user" />}>
            Accounts
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="template" icon={<SystemImage name="list-view" />}>
            Template
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="phone" icon={<SystemImage name="action" />}>
            Phone
          </PreferencesToolbarItem>
          <PreferencesToolbarItem value="vcard" icon={<SystemImage name="action" />}>
            vCard
          </PreferencesToolbarItem>
        </PreferencesToolbar>
      }
      {...props}
    >
      <PreferencesWindowPane value="general">
        <div className="mac-contacts-preferences-body">
          <Form render={<div />} labelWidth={150}>
            <FormRow label="Show first name:" align="center">
              <PopUpButton
                aria-label="Show first name"
                value={order}
                onValueChange={(next) => {
                  if (next != null) changeDesktopValue(CONTACTS_NAME_ORDER, String(next));
                }}
              >
                <PopUpButtonItem value="first">Before last name</PopUpButtonItem>
                <PopUpButtonItem value="last">Following last name</PopUpButtonItem>
              </PopUpButton>
            </FormRow>
            <FormRow label="Sort By:" align="center">
              <PopUpButton
                aria-label="Sort By"
                value={sort}
                onValueChange={(next) => {
                  if (next != null) changeDesktopValue(CONTACTS_SORT, String(next));
                }}
              >
                <PopUpButtonItem value="first">First Name</PopUpButtonItem>
                <PopUpButtonItem value="last">Last Name</PopUpButtonItem>
              </PopUpButton>
            </FormRow>
            <FormRow label="Default Account:" align="center">
              <PopUpButton
                aria-label="Default Account"
                value={defaultAccount}
                onValueChange={(next) => {
                  if (next != null) changeDesktopValue(CONTACTS_DEFAULT_ACCOUNT, String(next));
                }}
              >
                {ACCOUNTS.map(([id, name]) => (
                  <PopUpButtonItem key={id} value={id}>
                    {name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </FormRow>
            <FormRow label="Address Format:" align="center">
              <PopUpButton
                aria-label="Address Format"
                value={addressFormat}
                onValueChange={(next) => {
                  if (next != null) changeDesktopValue(CONTACTS_ADDRESS_FORMAT, String(next));
                }}
              >
                {ADDRESS_FORMATS.map(([format, name]) => (
                  <PopUpButtonItem key={format} value={format}>
                    {name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </FormRow>
          </Form>
        </div>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="accounts">
        <div className="mac-contacts-preferences-body">
          <BorderedList>
            <BorderedListRows
              aria-label="Accounts"
              rowHeight={20}
              value={[account]}
              onValueChange={(next) => {
                const [chosen] = next;
                if (chosen === "icloud" || chosen === "mac") setAccount(chosen);
              }}
            >
              {ACCOUNTS.map(([id, name]) => (
                <BorderedListRow key={id} value={id} title={name} textValue={name} />
              ))}
            </BorderedListRows>
          </BorderedList>
          <Checkbox
            checked={accountOn}
            disabled={accountOn && accountsOff.length === ACCOUNTS.length - 1}
            title={
              accountOn && accountsOff.length === ACCOUNTS.length - 1 ? LAST_ACCOUNT : undefined
            }
            onCheckedChange={(on) =>
              changeDesktopValue(
                CONTACTS_ACCOUNTS_OFF,
                on ? accountsOff.filter((each) => each !== account) : [...accountsOff, account],
              )
            }
          >
            Enable this account
          </Checkbox>
          <Label color="secondary">{NO_OTHER_ACCOUNTS}</Label>
        </div>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="template">
        <div className="mac-contacts-preferences-body">
          <Label color="secondary">A new card starts with the usual fields, and with these:</Label>
          <div className="mac-contacts-preferences-fields">
            {ADD_FIELDS.map(({ field, title }) => (
              <Checkbox
                key={field}
                checked={template.includes(field)}
                onCheckedChange={(on) =>
                  changeDesktopValue(
                    CONTACTS_TEMPLATE,
                    on ? [...template, field] : template.filter((each) => each !== field),
                  )
                }
              >
                {title}
              </Checkbox>
            ))}
          </div>
        </div>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="phone">
        <div className="mac-contacts-preferences-body mac-contacts-preferences-stack">
          <Checkbox
            checked={formatsPhones}
            onCheckedChange={(on) => changeDesktopValue(CONTACTS_PHONE_FORMAT, on)}
          >
            Automatically format phone numbers
          </Checkbox>
          <Label color="secondary">
            {formatsPhones
              ? `Ten digits read as ${formatPhone(SAMPLE_NUMBER)}.`
              : "Numbers are shown as they were typed."}
          </Label>
        </div>
      </PreferencesWindowPane>
      <PreferencesWindowPane value="vcard">
        <div className="mac-contacts-preferences-body mac-contacts-preferences-stack">
          <div className="mac-contacts-preferences-row">
            <Label>vCard Format:</Label>
            <PopUpButton<string>
              aria-label="vCard Format"
              value={vCardFormat}
              onValueChange={(format) => changeDesktopValue(CONTACTS_VCARD_FORMAT, format)}
            >
              <PopUpButtonItem value="3.0">3.0</PopUpButtonItem>
              <PopUpButtonItem value="2.1">2.1</PopUpButtonItem>
            </PopUpButton>
          </div>
          <div className="mac-contacts-preferences-row">
            <Label>Encoding:</Label>
            <PopUpButton<string>
              aria-label="vCard Encoding"
              value={vCardFormat === "2.1" ? vCardEncoding : "utf-8"}
              disabled={vCardFormat !== "2.1"}
              title={vCardFormat === "2.1" ? undefined : "A vCard 3.0 file is always UTF-8."}
              onValueChange={(encoding) => changeDesktopValue(CONTACTS_VCARD_ENCODING, encoding)}
            >
              <PopUpButtonItem value="utf-8">Unicode (UTF-8)</PopUpButtonItem>
              <PopUpButtonItem value="windows-1252">
                Western (Windows Latin 1), for Outlook
              </PopUpButtonItem>
            </PopUpButton>
          </div>
          <Checkbox
            checked={vCardNotes}
            onCheckedChange={(on) => changeDesktopValue(CONTACTS_VCARD_NOTES, on)}
          >
            Export notes in vCards
          </Checkbox>
          <Checkbox
            checked={vCardPhotos}
            onCheckedChange={(on) => changeDesktopValue(CONTACTS_VCARD_PHOTOS, on)}
          >
            Export photos in vCards
          </Checkbox>
          <Checkbox
            checked={privateMe}
            onCheckedChange={(on) => changeDesktopValue(CONTACTS_PRIVATE_ME, on)}
          >
            Enable private me card
          </Checkbox>
        </div>
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
