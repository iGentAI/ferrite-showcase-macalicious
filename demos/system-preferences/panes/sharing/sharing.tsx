"use client";

import { BorderedList } from "macalicious/bordered-list";
import { Box } from "macalicious/box";
import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { GradientButton } from "macalicious/gradient-button";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { StatusDot } from "macalicious/status-dot";
import { TableView, type TableViewColumn } from "macalicious/table-view";
import { TextField } from "macalicious/text-field";
import { type CSSProperties, useId } from "react";
import { PaneAt, PaneFooter, PaneForm, PaneRow } from "../../form";
import { usePreference } from "../../pane";
import {
  Dimple,
  EveryonePicture,
  GroupPicture,
  HomeFolderPicture,
  PublicFolderPicture,
  UserPicture,
} from "./artwork";
import "./sharing.css";
import { Uncaptured } from "../uncaptured";

/** The band of the services, across the pane: its top-left corner in the window frame. */
const BAND = { x: 0, y: 134 };

interface Service {
  id: string;
  name: string;
  /** A service that cannot be switched on here: its checkbox is disabled, as captured. */
  unavailable?: boolean;
}

const SERVICES: readonly Service[] = [
  { id: "screen-sharing", name: "Screen Sharing" },
  { id: "file-sharing", name: "File Sharing" },
  { id: "media-sharing", name: "Media Sharing", unavailable: true },
  { id: "printer-sharing", name: "Printer Sharing" },
  { id: "remote-login", name: "Remote Login" },
  { id: "remote-management", name: "Remote Management" },
  { id: "remote-apple-events", name: "Remote Apple Events" },
  { id: "bluetooth-sharing", name: "Bluetooth Sharing" },
  { id: "internet-sharing", name: "Internet Sharing", unavailable: true },
  { id: "content-caching", name: "Content Caching" },
];

const ACCESS = [
  ["read-write", "Read & Write"],
  ["read-only", "Read Only"],
  ["write-only", "Write Only (Drop Box)"],
  ["no-access", "No Access"],
] as const;

/** Who a shared folder is shared with, and what they may do in it. */
export interface SharingUser {
  id: string;
  name: string;
  kind: "user" | "group" | "everyone";
  access: (typeof ACCESS)[number][0];
}

/** A folder under Shared Folders. */
export interface SharedFolder {
  id: string;
  /** The folder's whole name, for assistive technology and type-select. */
  name: string;
  /**
   * The name as the 160 pt list shows it. AppKit truncates in the middle, which CSS cannot
   * do, so a long name is given as captured.
   */
  title: string;
  kind: "home" | "public";
  users: readonly SharingUser[];
}

const GROUPS: readonly SharingUser[] = [
  { id: "staff", name: "Staff", kind: "group", access: "read-only" },
  { id: "everyone", name: "Everyone", kind: "everyone", access: "read-only" },
];

/** The folder of the light capture: the home folder of the current account. */
const HOME: SharedFolder = {
  id: "home",
  name: "alexmorgan",
  title: "alexmorgan",
  kind: "home",
  users: [{ id: "owner", name: "Alex Morgan", kind: "user", access: "read-write" }, ...GROUPS],
};

const SERVICE_COLUMNS: TableViewColumn[] = [
  { id: "on", title: "On", width: 43, align: "center" },
  { id: "service", title: "Service" },
];
const FOLDER_COLUMNS: TableViewColumn[] = [{ id: "name" }];
const USER_COLUMNS: TableViewColumn[] = [{ id: "name", width: 136 }, { id: "access" }];

/** The cells of the gradient button bars are 23 pt wide, narrower than the button's smallest. */
const CELL: CSSProperties = { width: 23, minWidth: 0 };

const PICTURES = {
  home: HomeFolderPicture,
  public: PublicFolderPicture,
  user: UserPicture,
  group: GroupPicture,
  everyone: EveryonePicture,
};

function NameCell({ kind, children }: { kind: keyof typeof PICTURES; children: string }) {
  const Picture = PICTURES[kind];
  return (
    <span className="mac-system-preferences-sharing-cell">
      <Picture />
      {children}
    </span>
  );
}

/** The name other computers reach this one by: letters, digits and hyphens. */
function localHostName(computerName: string) {
  const host = computerName
    .replace(/[’']/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${host || "Mac"}.local`;
}

/**
 * System Preferences > Sharing, with File Sharing on and selected. The table of services
 * selects and its checkboxes toggle; only the settings of File Sharing are captured, so the
 * other services say so. The computer's name can be edited, and the address under it follows.
 * The permissions of the Users table are pop-up buttons that keep their choice. Nothing is
 * shared: the buttons that add and remove folders and users, Edit and Options say that this is
 * not part of the demo, as no capture shows what they open.
 *
 * The settings `sharing.services` (the order of the services), `sharing.folders` and
 * `sharing.folder` hold what differs between the two captures.
 *
 * Distances are those of reference/spec/apps/system-preferences-sharing.md, in points from the
 * top-left corner of the window frame.
 */
export function Sharing() {
  const [computerName, setComputerName] = usePreference(
    "sharing.computerName",
    "Alex’s MacBook Pro",
  );
  const [order] = usePreference<readonly string[]>(
    "sharing.services",
    SERVICES.map((service) => service.id),
  );
  const [on, setOn] = usePreference<readonly string[]>("sharing.on", ["file-sharing"]);
  const [serviceId, setServiceId] = usePreference<string>("sharing.service", "file-sharing");
  const [folders, setFolders] = usePreference<readonly SharedFolder[]>("sharing.folders", [HOME]);
  const [folderId, setFolderId] = usePreference<string>("sharing.folder", HOME.id);
  const [userId, setUserId] = usePreference<string | null>("sharing.user", null);
  const id = useId();

  const services = order.flatMap((value) => SERVICES.find((service) => service.id === value) ?? []);
  const service = services.find((item) => item.id === serviceId) ?? services[0];
  const folder = folders.find((item) => item.id === folderId);
  const users = folder?.users ?? [];

  const setAccess = (user: string, access: SharingUser["access"]) =>
    setFolders(
      folders.map((item) =>
        item === folder
          ? {
              ...item,
              users: item.users.map((other) => (other.id === user ? { ...other, access } : other)),
            }
          : item,
      ),
    );

  return (
    <PaneForm labelWidth={151} gap={7.5}>
      <PaneRow y={63.5} label="Computer Name:" labelId={`${id}-name`} labelOffset={2}>
        <TextField
          aria-labelledby={`${id}-name`}
          value={computerName}
          onValueChange={(value) => setComputerName(value)}
          style={{ width: 459 }}
        />
      </PaneRow>
      <PaneAt x={158.5} y={89}>
        <Label textStyle="small">
          Computers on your local network can access your computer at:
          <br />
          {localHostName(computerName)}
        </Label>
      </PaneAt>
      <PaneAt x={556} y={93}>
        <Uncaptured action="Edit…">
          <PushButton style={{ width: 62, paddingInline: 0 }}>Edit…</PushButton>
        </Uncaptured>
      </PaneAt>

      <PaneAt x={BAND.x} y={BAND.y}>
        <Box edges="horizontal" aria-label="Services" style={{ width: 668, height: 323 }}>
          <PaneForm origin={BAND}>
            <PaneAt x={20} y={155}>
              {/* The frame of a bordered list around the table, without a button bar. */}
              <BorderedList style={{ width: 195, height: 286 }}>
                <TableView
                  aria-label="Services"
                  columns={SERVICE_COLUMNS}
                  rowCount={services.length}
                  rowHeight={20}
                  size="small"
                  getRowId={(row) => services[row]?.id ?? row}
                  getRowLabel={(row) => services[row]?.name ?? ""}
                  renderCell={(row, column) => {
                    const item = services[row];
                    if (!item) return null;
                    if (column.id === "service")
                      return (
                        <span className="mac-system-preferences-sharing-service">{item.name}</span>
                      );
                    return (
                      <Checkbox
                        aria-label={item.name}
                        checked={on.includes(item.id)}
                        disabled={item.unavailable}
                        onCheckedChange={(checked) =>
                          setOn(
                            checked ? [...on, item.id] : on.filter((other) => other !== item.id),
                          )
                        }
                        style={{ position: "relative", top: -1, left: -0.5 }}
                      />
                    );
                  }}
                  value={[serviceId]}
                  onValueChange={(value) => {
                    const [next] = value;
                    if (typeof next === "string") setServiceId(next);
                  }}
                />
              </BorderedList>
            </PaneAt>

            {service && (
              <>
                <PaneAt x={237} y={158}>
                  <StatusDot status={on.includes(service.id) ? "available" : "none"} />
                </PaneAt>
                <PaneAt x={257} y={155}>
                  <Label>
                    {service.name}: {on.includes(service.id) ? "On" : "Off"}
                  </Label>
                </PaneAt>
              </>
            )}

            {service?.id === "file-sharing" ? (
              <>
                <PaneAt x={237.5} y={179}>
                  <Label textStyle="small">
                    Other users can access shared folders on this computer, and administrators
                    <br />
                    all volumes, at smb://192.168.7.167
                  </Label>
                </PaneAt>
                <PaneAt x={562} y={223}>
                  <Uncaptured action="Options…">
                    <PushButton style={{ width: 86, paddingInline: 0 }}>Options…</PushButton>
                  </Uncaptured>
                </PaneAt>

                <PaneAt x={235} y={250.5}>
                  <Label id={`${id}-folders`}>Shared Folders:</Label>
                </PaneAt>
                <PaneAt x={234} y={272}>
                  <BorderedList
                    style={{ width: 162, height: 168 }}
                    footerPlacement="detached"
                    footerLabel="Edit shared folders"
                    footer={
                      <>
                        <Uncaptured action="Add a shared folder">
                          <GradientButton
                            glyph="add"
                            aria-label="Add a shared folder"
                            style={CELL}
                          />
                        </Uncaptured>
                        <Uncaptured action="Remove the selected shared folder">
                          <GradientButton
                            glyph="remove"
                            aria-label="Remove the selected shared folder"
                            disabled={!folder}
                            style={CELL}
                          />
                        </Uncaptured>
                      </>
                    }
                  >
                    <TableView
                      aria-labelledby={`${id}-folders`}
                      header="none"
                      size="small"
                      columns={FOLDER_COLUMNS}
                      rowCount={folders.length}
                      rowHeight={19}
                      getRowId={(row) => folders[row]?.id ?? row}
                      getRowLabel={(row) => folders[row]?.name ?? ""}
                      getRowProps={(row) => ({ "aria-label": folders[row]?.name })}
                      renderCell={(row) => {
                        const item = folders[row];
                        return item ? <NameCell kind={item.kind}>{item.title}</NameCell> : null;
                      }}
                      value={folder ? [folder.id] : []}
                      onValueChange={(value) => {
                        const [next] = value;
                        if (typeof next === "string") {
                          setFolderId(next);
                          setUserId(null);
                        }
                      }}
                    />
                  </BorderedList>
                </PaneAt>

                <PaneAt x={397.5} y={340.5} className="mac-system-preferences-sharing-dimple">
                  <Dimple />
                </PaneAt>

                <PaneAt x={406} y={250.5}>
                  <Label id={`${id}-users`}>Users:</Label>
                </PaneAt>
                <PaneAt x={405} y={272} className="mac-system-preferences-sharing-users">
                  <BorderedList
                    style={{ width: 242, height: 168 }}
                    footerPlacement="detached"
                    footerLabel="Edit users"
                    footer={
                      <>
                        <Uncaptured action="Add a user">
                          <GradientButton glyph="add" aria-label="Add a user" style={CELL} />
                        </Uncaptured>
                        <Uncaptured action="Remove the selected user">
                          <GradientButton
                            glyph="remove"
                            aria-label="Remove the selected user"
                            disabled={userId === null}
                            style={CELL}
                          />
                        </Uncaptured>
                      </>
                    }
                  >
                    <TableView
                      aria-labelledby={`${id}-users`}
                      header="none"
                      size="small"
                      columns={USER_COLUMNS}
                      rowCount={users.length}
                      rowHeight={19}
                      getRowId={(row) => users[row]?.id ?? row}
                      getRowLabel={(row) => users[row]?.name ?? ""}
                      renderCell={(row, column) => {
                        const user = users[row];
                        if (!user) return null;
                        if (column.id === "name")
                          return <NameCell kind={user.kind}>{user.name}</NameCell>;
                        return (
                          <PopUpButton
                            aria-label={`Access for ${user.name}`}
                            bordered={false}
                            value={user.access}
                            onValueChange={(access) => {
                              if (access != null) setAccess(user.id, access);
                            }}
                            style={{ width: 97, marginLeft: 4 }}
                          >
                            {ACCESS.filter(
                              ([value]) => value !== "no-access" || user.kind === "everyone",
                            ).map(([value, title]) => (
                              <PopUpButtonItem key={value} value={value}>
                                {title}
                              </PopUpButtonItem>
                            ))}
                          </PopUpButton>
                        );
                      }}
                      value={userId === null ? [] : [userId]}
                      onValueChange={(value) => {
                        const [next] = value;
                        setUserId(typeof next === "string" ? next : null);
                      }}
                    />
                  </BorderedList>
                  <span className="mac-system-preferences-sharing-users-rule" aria-hidden="true" />
                </PaneAt>
              </>
            ) : (
              service && (
                <PaneAt x={234} y={181} width={414} style={{ height: 259 }}>
                  <div className="mac-system-preferences-sharing-empty">
                    <EmptyState>
                      The settings of {service.name} are not part of this demo.
                    </EmptyState>
                  </div>
                </PaneAt>
              )
            )}
          </PaneForm>
        </Box>
      </PaneAt>

      <PaneFooter x={625} y={483}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </PaneForm>
  );
}
