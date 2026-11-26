"use client";

import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { Box } from "macalicious/box";
import { EmptyState } from "macalicious/empty-state";
import { GradientButton } from "macalicious/gradient-button";
import { HelpButton } from "macalicious/help-button";
import { ImageButton } from "macalicious/image-button";
import { Label } from "macalicious/label";
import type { ComponentType, CSSProperties } from "react";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { usePreference } from "../../pane";
import {
  AolLogo,
  AtArtwork,
  CloudAccountPicture,
  CloudLogo,
  ExchangeLogo,
  GamesAccountPicture,
  GoogleLogo,
  YahooLogo,
} from "./artwork";
import "./internet-accounts.css";
import { Uncaptured } from "../uncaptured";

/** The box of the providers: its top-left corner in the window frame. */
const BOX = { x: 238, y: 98 };

/** The rows of the box start inside its border and are as wide as the box less its border. */
const ROW = { x: 239, width: 408 };

/**
 * The cells of the gradient button bar are at a 25 pt pitch here: 26 pt wide, sharing a
 * border. The glyphs are half a point off the middle of their cells, as captured: the plus
 * to the left and the minus to the right.
 */
const ADD_CELL: CSSProperties = { width: 26, paddingRight: 5 };
const REMOVE_CELL: CSSProperties = { width: 26, paddingLeft: 5 };

const ICLOUD = "icloud";
const GAME_CENTER = "game-center";

/** The accounts of the captures: id and name. What a row shows besides is in the list below. */
const ACCOUNTS = [
  [ICLOUD, "iCloud"],
  [GAME_CENTER, "Game Center"],
] as const;

/** The providers with a logo: name, top edge and height of the row, and the stand-in logo. */
const PROVIDERS: readonly (readonly [string, number, number, ComponentType])[] = [
  ["iCloud", 99, 55, CloudLogo],
  ["Exchange", 156, 54, ExchangeLogo],
  ["Google", 212, 54, GoogleLogo],
  ["Yahoo", 268, 54, YahooLogo],
  ["AOL", 324, 54, AolLogo],
];

/** The top edges of the 2 pt lines between the providers. */
const DIVIDERS = [154, 210, 266, 322, 378];

/**
 * System Preferences > Internet Accounts, with two accounts and neither selected, so that the
 * right side offers the providers of a new account. The list selects for real: no capture
 * shows the settings of an account, so a selected account says so, and the add button brings
 * the providers back, as it does in Catalina; it is disabled while they are shown, as
 * captured. The remove button takes the selected account out
 * of the list without the confirmation Catalina asks for. Nobody signs in: the providers and
 * Add Other Account say that this is not part of the demo, as no capture shows what they open.
 *
 * The setting `internet-accounts.accounts` holds the ids of the listed accounts and
 * `internet-accounts.account` the selected one.
 *
 * Distances are those of reference/spec/apps/system-preferences-internet-accounts.md, in
 * points from the top-left corner of the window frame.
 */
export function InternetAccounts() {
  const [listed, setListed] = usePreference<readonly string[]>(
    "internet-accounts.accounts",
    ACCOUNTS.map(([id]) => id),
  );
  const [accountId, setAccountId] = usePreference<string | null>("internet-accounts.account", null);

  const account = ACCOUNTS.find(([id]) => id === accountId && listed.includes(id));

  return (
    <PaneForm>
      <PaneAt x={22} y={50}>
        <AtArtwork />
      </PaneAt>
      <PaneAt x={68} y={52}>
        <Label>
          Internet Accounts sets up your accounts to use with Mail, Contacts, Calendar, Messages,
          and
          <br />
          other apps.
        </Label>
      </PaneAt>

      <PaneAt x={20} y={98}>
        <BorderedList
          style={{ width: 210, height: 368 }}
          footerLabel="Edit accounts"
          footer={
            <>
              <GradientButton
                glyph="add"
                aria-label="Add an account"
                disabled={!account}
                style={ADD_CELL}
                onClick={() => setAccountId(null)}
              />
              <GradientButton
                glyph="remove"
                aria-label="Remove the selected account"
                disabled={!account}
                style={REMOVE_CELL}
                onClick={() => {
                  setListed(listed.filter((id) => id !== accountId));
                  setAccountId(null);
                }}
              />
            </>
          }
        >
          <BorderedListRows
            aria-label="Accounts"
            rowHeight={42}
            value={account ? [account[0]] : []}
            onValueChange={(value) => {
              const [next] = value;
              if (next !== undefined) setAccountId(next);
            }}
          >
            {listed.includes(ICLOUD) ? (
              <BorderedListRow
                value={ICLOUD}
                aria-label="iCloud, iCloud Drive and 10 more…"
                title="iCloud"
                subtitle="iCloud Drive and 10 more…"
                leading={
                  <CloudAccountPicture
                    style={{ marginLeft: 0.5, marginRight: -1, marginTop: 1.5 }}
                  />
                }
                style={{ paddingBottom: 3 }}
              />
            ) : null}
            {listed.includes(GAME_CENTER) ? (
              // The account has no name of its own in the captures: its row shows only the
              // line under the name, 5 pt below the middle of the row, and its picture above it.
              <BorderedListRow
                value={GAME_CENTER}
                aria-label="Game Center"
                textValue="Game Center"
                subtitle="Game Center"
                leading={
                  <GamesAccountPicture
                    style={{ marginLeft: -1.5, marginRight: -2.5, marginTop: -15.5 }}
                  />
                }
                style={{ paddingTop: 10 }}
              />
            ) : null}
          </BorderedListRows>
        </BorderedList>
      </PaneAt>

      <PaneAt x={BOX.x} y={BOX.y}>
        <Box
          aria-label={account ? account[1] : "Add an account"}
          style={{ width: 410, height: 368 }}
        >
          {account ? (
            <div className="mac-system-preferences-internet-accounts-empty">
              <EmptyState>
                The settings of the {account[1]} account are not part of this demo.
              </EmptyState>
            </div>
          ) : (
            <PaneForm origin={BOX}>
              {PROVIDERS.map(([name, y, height, Logo]) => (
                <PaneAt key={name} x={ROW.x} y={y} width={ROW.width}>
                  <Uncaptured action={name}>
                    <ImageButton layout="row" aria-label={name} style={{ minHeight: height }}>
                      <Logo />
                    </ImageButton>
                  </Uncaptured>
                </PaneAt>
              ))}
              {/* The lines cross the box from edge to edge, over its border. */}
              {DIVIDERS.map((y) => (
                <PaneAt
                  key={y}
                  x={BOX.x}
                  y={y}
                  width={410}
                  className="mac-system-preferences-internet-accounts-divider"
                  aria-hidden="true"
                />
              ))}
              <PaneAt x={ROW.x} y={380.5} width={ROW.width}>
                <Uncaptured action="Add Other Account…">
                  <ImageButton layout="row">
                    <Label textStyle="title-3">Add Other Account…</Label>
                  </ImageButton>
                </Uncaptured>
              </PaneAt>
              <PaneFooter x={612} y={430}>
                <Uncaptured action="Help">
                  <HelpButton />
                </Uncaptured>
              </PaneFooter>
            </PaneForm>
          )}
        </Box>
      </PaneAt>
    </PaneForm>
  );
}
