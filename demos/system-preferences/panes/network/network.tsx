"use client";

import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { Box } from "macalicious/box";
import { Checkbox } from "macalicious/checkbox";
import { EmptyState } from "macalicious/empty-state";
import { GradientButton } from "macalicious/gradient-button";
import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import { MenuItem, MenuSeparator } from "macalicious/menu-item";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { StatusDot } from "macalicious/status-dot";
import { type ComponentType, useId } from "react";
import { PaneChoice } from "../../choice";
import { PaneAt, PaneFooter, PaneForm, PaneRow } from "../../form";
import { usePreference } from "../../pane";
import { PersonalAreaNetworkPicture, WiFiPicture, WiredPicture } from "./artwork";
import "./network.css";
import { Uncaptured } from "../uncaptured";

/** The settings box's top-left corner in the window frame. */
const BOX = { x: 198, y: 99 };

interface Service {
  id: string;
  /** The service's whole name, for assistive technology and type-select. */
  name: string;
  /**
   * The name as the 170 pt list shows it. AppKit truncates in the middle, which CSS cannot do,
   * so the two long names are given as captured.
   */
  title: string;
  connected: boolean;
  picture: ComponentType;
}

const WI_FI: Service = {
  id: "wi-fi",
  name: "Wi-Fi",
  title: "Wi-Fi",
  connected: true,
  picture: WiFiPicture,
};

const SERVICES: readonly Service[] = [
  WI_FI,
  {
    id: "bluetooth-pan",
    name: "Bluetooth PAN",
    title: "Bluetooth PAN",
    connected: false,
    picture: PersonalAreaNetworkPicture,
  },
  {
    id: "usb-lan",
    name: "USB 10/100/1000 LAN",
    title: "USB 10/…00 LAN",
    connected: false,
    picture: WiredPicture,
  },
  {
    id: "thunderbolt-bridge",
    name: "Thunderbolt Bridge",
    title: "Thunde…lt Bridge",
    connected: false,
    picture: WiredPicture,
  },
];

/**
 * System Preferences > Network, with Wi-Fi selected and connected. The list of services selects
 * for real; only the settings of Wi-Fi are captured, so the other services say so. The settings
 * keep their state and change nothing: a page cannot configure a network.
 *
 * Distances are those of reference/spec/apps/system-preferences-network.md, in points from the
 * top-left corner of the window frame.
 */
export function Network() {
  const [serviceId, setServiceId] = usePreference<string>("network.service", WI_FI.id);
  const [autoJoin, setAutoJoin] = usePreference("network.autoJoin", true);
  const [askHotspots, setAskHotspots] = usePreference("network.askToJoinHotspots", true);
  const [askNew, setAskNew] = usePreference("network.askToJoinNewNetworks", false);
  const [inMenuBar, setInMenuBar] = usePreference("network.showStatusInMenuBar", true);
  const id = useId();
  const service = SERVICES.find((item) => item.id === serviceId) ?? WI_FI;

  return (
    <PaneForm>
      <PaneAt x={173.5} y={60.5}>
        <Label id={`${id}-location`}>Location:</Label>
      </PaneAt>
      <PaneAt x={234.5} y={58}>
        <PaneChoice
          setting="network.location"
          options={["Automatic"]}
          initial="Automatic"
          width={261}
          aria-labelledby={`${id}-location`}
        />
      </PaneAt>

      <PaneAt x={20} y={99}>
        <BorderedList
          style={{ width: 170, height: 400 }}
          footerLabel="Edit services"
          footer={
            <>
              <Uncaptured action="Add a service">
                <GradientButton glyph="add" aria-label="Add a service" style={{ width: 26 }} />
              </Uncaptured>
              <Uncaptured action="Remove the selected service">
                <GradientButton
                  glyph="remove"
                  aria-label="Remove the selected service"
                  style={{ width: 26 }}
                />
              </Uncaptured>
              {/* The gear is the library's gradient button with its action glyph, as the
                  trigger of the library's menu: a pull-down button would draw a push button's
                  bezel in the bar. A page cannot edit services: the commands are dimmed under the
                  statement of why. */}
              <Menu>
                <MenuTrigger
                  render={
                    <GradientButton
                      glyph="action"
                      aria-label="Service actions"
                      style={{ width: 30 }}
                    />
                  }
                />
                <MenuPopup size="regular">
                  <MenuItem disabled>A web page cannot edit network services.</MenuItem>
                  <MenuSeparator />
                  <MenuItem disabled>Duplicate Service…</MenuItem>
                  <MenuItem disabled>Rename Service…</MenuItem>
                  <MenuItem disabled>Make Service Inactive</MenuItem>
                  <MenuSeparator />
                  <MenuItem disabled>Set Service Order…</MenuItem>
                  <MenuSeparator />
                  <MenuItem disabled>Import Configurations…</MenuItem>
                  <MenuItem disabled>Export Configurations…</MenuItem>
                  <MenuSeparator />
                  <MenuItem disabled>Manage Virtual Interfaces…</MenuItem>
                </MenuPopup>
              </Menu>
            </>
          }
        >
          <BorderedListRows
            aria-label="Network services"
            rowHeight={42}
            value={[serviceId]}
            onValueChange={(value) => {
              const [next] = value;
              if (next !== undefined) setServiceId(next);
            }}
          >
            {SERVICES.map(({ id: value, name, title, connected, picture: Picture }) => (
              <BorderedListRow
                key={value}
                value={value}
                aria-label={`${name}, ${connected ? "Connected" : "Not Connected"}`}
                textValue={name}
                title={title}
                subtitle={connected ? "Connected" : "Not Connected"}
                leading={<StatusDot status={connected ? "available" : "unavailable"} />}
                trailing={<Picture />}
              />
            ))}
          </BorderedListRows>
        </BorderedList>
      </PaneAt>

      <PaneAt x={BOX.x} y={BOX.y}>
        <Box aria-label={service.name} style={{ width: 450, height: 400 }}>
          {service === WI_FI ? (
            <PaneForm origin={BOX} labelWidth={352} gap={7.5}>
              <PaneRow y={116.5} label="Status:">
                <Label textStyle="emphasized">Connected</Label>
              </PaneRow>
              <PaneAt x={493.5} y={114.5}>
                <Uncaptured action="Turn Wi-Fi Off" reason="A web page cannot switch Wi-Fi.">
                  <PushButton style={{ width: 113, paddingInline: 0 }}>Turn Wi-Fi Off</PushButton>
                </Uncaptured>
              </PaneAt>
              {/* The capture has the network's name erased from this sentence; its words are
                  where the capture has them. */}
              <PaneAt x={359.5} y={138}>
                <Label textStyle="small" className="mac-system-preferences-network-address">
                  Wi-Fi is connected to{" "}
                  <span className="mac-system-preferences-network-address-rest">
                    and has the IP
                  </span>
                  <br />
                  address 192.168.7.167.
                </Label>
              </PaneAt>

              {/* The capture has the network's name erased, so nothing is selected; the one
                  command of the menu is not available on a page. */}
              <PaneRow y={195} label="Network Name:" labelId={`${id}-network-name`} labelOffset={2}>
                <PopUpButton
                  aria-labelledby={`${id}-network-name`}
                  style={{ width: 248, marginLeft: -0.5 }}
                >
                  <PopUpButtonItem value="other" disabled>
                    Join Other Network…
                  </PopUpButtonItem>
                </PopUpButton>
              </PaneRow>

              <PaneAt x={359} y={236}>
                <Checkbox checked={autoJoin} onCheckedChange={setAutoJoin}>
                  Automatically join this network
                </Checkbox>
              </PaneAt>
              <PaneAt x={359} y={266}>
                <Checkbox checked={askHotspots} onCheckedChange={setAskHotspots}>
                  Ask to join Personal Hotspots
                </Checkbox>
              </PaneAt>
              <PaneAt x={359} y={296}>
                <Checkbox
                  checked={askNew}
                  onCheckedChange={setAskNew}
                  aria-describedby={`${id}-new-networks-note`}
                >
                  Ask to join new networks
                </Checkbox>
              </PaneAt>
              <PaneAt x={377} y={318}>
                <Label id={`${id}-new-networks-note`} textStyle="mini">
                  Known networks will be joined automatically. If
                  <br />
                  no known networks are available, you will have
                  <br />
                  to manually select a network.
                </Label>
              </PaneAt>

              <PaneAt x={225} y={470}>
                <Checkbox checked={inMenuBar} onCheckedChange={setInMenuBar}>
                  Show Wi-Fi status in menu bar
                </Checkbox>
              </PaneAt>
              <PaneAt x={512.5} y={470}>
                <Uncaptured action="Advanced…">
                  <PushButton style={{ width: 98, paddingInline: 0 }}>Advanced…</PushButton>
                </Uncaptured>
              </PaneAt>
              <PaneFooter x={618} y={470}>
                <Uncaptured action="Help">
                  <HelpButton />
                </Uncaptured>
              </PaneFooter>
            </PaneForm>
          ) : (
            <div className="mac-system-preferences-network-empty">
              <EmptyState>The settings of {service.name} are not part of this demo.</EmptyState>
            </div>
          )}
        </Box>
      </PaneAt>

      <PaneAt x={505.5} y={522.5}>
        <PushButton disabled style={{ width: 67, paddingInline: 0 }}>
          Revert
        </PushButton>
      </PaneAt>
      <PaneAt x={585.5} y={522.5}>
        <PushButton disabled style={{ width: 62, paddingInline: 0 }}>
          Apply
        </PushButton>
      </PaneAt>
    </PaneForm>
  );
}
