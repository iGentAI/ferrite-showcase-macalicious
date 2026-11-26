"use client";

import { Checkbox } from "macalicious/checkbox";
import { DatePicker } from "macalicious/date-picker";
import { Form, FormRow } from "macalicious/form";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PreferencesToolbar, PreferencesToolbarItem } from "macalicious/preferences-toolbar";
import {
  PreferencesWindow,
  PreferencesWindowPane,
  type PreferencesWindowProps,
} from "macalicious/preferences-window";
import { SystemImage } from "macalicious/system-image";
import { useEffect, useState } from "react";
import { changeDesktopValue, useDesktopValue } from "../desktop/desktop-personal";
import { sessionFetch } from "../desktop/desktop-server";
import { dayOf } from "./reminders-data";
import { dateOf, timeOf } from "./reminders-dates";
import {
  REMINDERS_TODAY_NOTIFICATION,
  readTodayNotification,
  TODAY_NOTIFICATION_OFF,
} from "./reminders-kept";
import "./reminders.tokens.css";
import "./reminders.css";

/** Where a reminder made from a smart list goes, kept with the person's settings. */
export const REMINDERS_DEFAULT_LIST = "reminders.defaultList";

export const readDefaultList = (stored: unknown) =>
  typeof stored === "string" ? stored : undefined;

/** Reminders > Preferences: the default list and the Today notification. */
export function RemindersPreferences({
  className,
  ...props
}: Omit<PreferencesWindowProps, "toolbar" | "children" | "modal">) {
  const chosen = useDesktopValue(REMINDERS_DEFAULT_LIST, readDefaultList, "");
  const today = useDesktopValue(
    REMINDERS_TODAY_NOTIFICATION,
    readTodayNotification,
    TODAY_NOTIFICATION_OFF,
  );
  const [lists, setLists] = useState<readonly { id: string; name: string }[]>([]);
  useEffect(() => {
    let stopped = false;
    void sessionFetch("/api/reminders/data", { credentials: "same-origin" })
      .then((reply) => (reply.ok ? reply.json() : null))
      .then((body) => {
        if (!stopped && Array.isArray(body?.data?.lists)) setLists(body.data.lists);
      })
      .catch(() => {});
    return () => {
      stopped = true;
    };
  }, []);
  return (
    <PreferencesWindow
      width={420}
      className={className ? `mac-reminders-preferences ${className}` : "mac-reminders-preferences"}
      toolbar={
        <PreferencesToolbar aria-label="Reminders preferences">
          <PreferencesToolbarItem value="general" icon={<SystemImage name="action" />}>
            General
          </PreferencesToolbarItem>
        </PreferencesToolbar>
      }
      {...props}
    >
      <PreferencesWindowPane value="general">
        <div className="mac-reminders-preferences-body">
          <Form render={<div />} labelWidth={110}>
            <FormRow label="Default List:" align="center">
              <PopUpButton
                aria-label="Default List"
                value={lists.some((list) => list.id === chosen) ? chosen : (lists[0]?.id ?? "")}
                onValueChange={(next) => {
                  if (next != null) changeDesktopValue(REMINDERS_DEFAULT_LIST, String(next));
                }}
              >
                {lists.map((list) => (
                  <PopUpButtonItem key={list.id} value={list.id}>
                    {list.name}
                  </PopUpButtonItem>
                ))}
              </PopUpButton>
            </FormRow>
            <FormRow label="" kind="group" orientation="horizontal">
              <Checkbox
                checked={today.on}
                onCheckedChange={(on) =>
                  changeDesktopValue(REMINDERS_TODAY_NOTIFICATION, { ...today, on })
                }
              >
                Today Notification:
              </Checkbox>
              <DatePicker
                aria-label="Today Notification Time"
                elements="hourMinute"
                stepper={false}
                disabled={!today.on}
                value={dateOf(dayOf(new Date()), today.time)}
                onValueChange={(date) =>
                  changeDesktopValue(REMINDERS_TODAY_NOTIFICATION, {
                    ...today,
                    time: timeOf(date),
                  })
                }
              />
            </FormRow>
          </Form>
        </div>
      </PreferencesWindowPane>
    </PreferencesWindow>
  );
}
