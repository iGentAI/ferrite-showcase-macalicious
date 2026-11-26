"use client";

import {
  BorderedList,
  BorderedListGroupRow,
  BorderedListRow,
  BorderedListRows,
} from "macalicious/bordered-list";
import { Box } from "macalicious/box";
import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { GradientButton } from "macalicious/gradient-button";
import { HelpButton } from "macalicious/help-button";
import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import { LockButton } from "macalicious/lock-button";
import { PushButton } from "macalicious/push-button";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { type CSSProperties, useId } from "react";
import { PaneAt, PaneFooter, PaneForm, PaneRow } from "../../form";
import { usePreference } from "../../pane";
import { GuestPicture, HousePicture, LandscapePicture, SymbolPicture } from "./artwork";
import "./users-and-groups.css";
import { Uncaptured } from "../uncaptured";

/**
 * The tab view's top-left corner in the window frame: the strip is centred on the box's top
 * edge, which is at y 66.
 */
const TABS = { x: 198, y: 56 };

/** The name that stands in for the account of the person who took the screenshots. */
const CURRENT_USER = "Alex Morgan";

/** An account under Other Users. */
export interface OtherUser {
  id: string;
  name: string;
  /** The line under the name: "Standard", or "Off" for the Guest User. */
  status: string;
  picture: "symbol" | "guest";
}

const GUEST: OtherUser = { id: "guest", name: "Guest User", status: "Off", picture: "guest" };

/**
 * System Preferences > Users & Groups: the Password tab of the current account, in a locked
 * pane. The list selects for real; the other accounts cannot be selected while the pane is
 * locked, as captured. The lock button toggles its own state and asks for no password; the
 * unlocked pane is not captured, so what it guards stays as it is. Login Items and Login
 * Options are not captured and say so.
 *
 * The setting `users-and-groups.otherUsers` holds the accounts under Other Users: the Guest
 * User alone, as in the light capture.
 *
 * Distances are those of reference/spec/apps/system-preferences-users-and-groups.md, in points
 * from the top-left corner of the window frame.
 */
export function UsersAndGroups() {
  const [selection, setSelection] = usePreference<string>("users-and-groups.selection", "current");
  const [others] = usePreference<readonly OtherUser[]>("users-and-groups.otherUsers", [GUEST]);
  const [tab, setTab] = usePreference<string>("users-and-groups.tab", "password");
  const [lock, setLock] = usePreference<"locked" | "unlocked">("users-and-groups.lock", "locked");
  const [resetWithAppleId, setResetWithAppleId] = usePreference(
    "users-and-groups.resetPasswordWithAppleId",
    false,
  );
  const [administrator, setAdministrator] = usePreference("users-and-groups.administrator", true);
  const id = useId();

  return (
    <PaneForm>
      <PaneAt x={20} y={66}>
        <BorderedList
          style={{ width: 170, height: 347 }}
          footerLabel="Edit users"
          footer={
            <>
              <GradientButton glyph="add" aria-label="Add a user" disabled />
              <GradientButton glyph="remove" aria-label="Remove the selected user" disabled />
            </>
          }
        >
          <BorderedListRows
            aria-label="Users"
            rowHeight={34}
            value={[selection]}
            onValueChange={(value) => {
              const [next] = value;
              if (next !== undefined) setSelection(next);
            }}
          >
            <BorderedListGroupRow>Current User</BorderedListGroupRow>
            <BorderedListRow
              value="current"
              title={CURRENT_USER}
              subtitle="Admin"
              leading={<LandscapePicture size={24} style={{ marginLeft: 1 }} />}
            />
            <BorderedListGroupRow>Other Users</BorderedListGroupRow>
            {others.map((user) => (
              <BorderedListRow
                key={user.id}
                value={user.id}
                title={user.name}
                subtitle={user.status}
                leading={
                  user.picture === "guest" ? (
                    <GuestPicture size={24} style={{ marginLeft: 3 }} />
                  ) : (
                    <SymbolPicture size={24} dimmed style={{ marginLeft: 3 }} />
                  )
                }
                disabled
              />
            ))}
            {/* The last row stays at the foot of the list: the rows above it take 80 pt and
                34 pt for each of the other users, of the 290 pt above its line. */}
            <BorderedListRow
              value="login-options"
              title="Login Options"
              leading={<HousePicture style={{ marginLeft: 1 }} />}
              className="mac-system-preferences-users-and-groups-login-options"
              style={{ minHeight: 35, marginTop: Math.max(0, 210 - 34 * others.length) }}
            />
          </BorderedListRows>
        </BorderedList>
      </PaneAt>

      {selection === "login-options" ? (
        <PaneAt x={198} y={66}>
          <Box aria-label="Login Options" style={{ width: 448, height: 344 }}>
            <div className="mac-system-preferences-users-and-groups-empty">
              <EmptyState>Login Options are not part of this demo.</EmptyState>
            </div>
          </Box>
        </PaneAt>
      ) : (
        <TabView
          value={tab}
          onValueChange={(value) => setTab(value as string)}
          style={{ position: "absolute", left: TABS.x, top: TABS.y - 38, width: 448, height: 354 }}
        >
          <TabViewList aria-label={CURRENT_USER}>
            <TabViewTab value="password" style={{ width: 83, padding: 0 }}>
              Password
            </TabViewTab>
            <TabViewTab value="login-items" style={{ width: 94, padding: 0 }}>
              Login Items
            </TabViewTab>
          </TabViewList>
          <TabViewPanel value="password">
            <PaneForm origin={TABS} labelWidth={418} gap={8.5}>
              <PaneAt x={229} y={93}>
                <Uncaptured action="Edit picture">
                  <ImageButton
                    aria-label="Edit picture"
                    style={{ "--mac-image-button-padding": "0px" } as CSSProperties}
                  >
                    <LandscapePicture size={62} />
                  </ImageButton>
                </Uncaptured>
              </PaneAt>
              <PaneAt x={303.5} y={103}>
                <Label textStyle="emphasized">{CURRENT_USER}</Label>
              </PaneAt>
              <PaneAt x={476.5} y={99.5}>
                <Uncaptured action="Change Password...">
                  <PushButton style={{ width: 146, paddingInline: 0 }}>
                    Change Password...
                  </PushButton>
                </Uncaptured>
              </PaneAt>

              <PaneRow
                y={317.5}
                label="Contacts Card:"
                labelId={`${id}-contacts-card`}
                labelOffset={2.5}
              >
                <Uncaptured action="Open...">
                  <PushButton
                    aria-describedby={`${id}-contacts-card`}
                    style={{ width: 71, paddingInline: 0 }}
                  >
                    Open...
                  </PushButton>
                </Uncaptured>
              </PaneRow>

              <PaneAt x={230} y={348}>
                <Checkbox checked={resetWithAppleId} onCheckedChange={setResetWithAppleId} disabled>
                  Allow user to reset password using Apple ID
                </Checkbox>
              </PaneAt>
              <PaneAt x={230} y={376}>
                <Checkbox checked={administrator} onCheckedChange={setAdministrator} disabled>
                  Allow user to administer this computer
                </Checkbox>
              </PaneAt>
            </PaneForm>
          </TabViewPanel>
          <TabViewPanel value="login-items">
            <EmptyState>The Login Items tab is not part of this demo.</EmptyState>
          </TabViewPanel>
        </TabView>
      )}

      <PaneFooter x={25.5} y={437.5}>
        <LockButton
          state={lock}
          onClick={() => setLock(lock === "locked" ? "unlocked" : "locked")}
        />
      </PaneFooter>
      <PaneFooter x={625.5} y={446.5}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </PaneForm>
  );
}
