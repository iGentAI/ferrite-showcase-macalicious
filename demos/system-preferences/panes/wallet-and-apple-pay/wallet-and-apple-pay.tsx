"use client";

import { HelpButton } from "macalicious/help-button";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { useId } from "react";
import { PaneAt, PaneFooter, PaneForm } from "../../form";
import { Uncaptured } from "../uncaptured";
import { LaptopArtwork, PayMark, PrivacyEmblem } from "./artwork";

/** The mark, the two paragraphs and the emblem are centred on this distance from the left edge. */
const CENTRE = 469;
/** Width of the box the centred lines are laid out in. */
const COLUMN = 350;

/**
 * System Preferences > Wallet & Apple Pay, before a card is added: the introduction, with no
 * setting to keep. Adding a card needs the bank and the Touch ID sensor, and no screenshot shows
 * its sheet or the privacy text, so Add Card and the link say so.
 *
 * Distances are those of reference/spec/apps/system-preferences-wallet-and-apple-pay.md, in
 * points from the top-left corner of the window frame.
 */
export function WalletAndApplePay() {
  const id = useId();

  return (
    <PaneForm>
      {/* The picture is cut by the window's left and bottom edges, as in Catalina. */}
      <PaneAt x={0} y={74}>
        <LaptopArtwork />
      </PaneAt>

      <PaneAt x={425} y={65}>
        <PayMark />
      </PaneAt>
      <PaneAt x={CENTRE - COLUMN / 2} y={111} width={COLUMN} style={{ justifyContent: "center" }}>
        <Label id={`${id}-about`} align="center" style={{ whiteSpace: "pre" }}>
          {
            "Add credit, debit, or store cards and use\nApple Pay with Touch ID to make purchases\neasily and securely, right from your Mac."
          }
        </Label>
      </PaneAt>

      <PaneAt x={456.5} y={174}>
        <PrivacyEmblem />
      </PaneAt>
      <PaneAt x={CENTRE - COLUMN / 2} y={199} width={COLUMN} style={{ justifyContent: "center" }}>
        <Label textStyle="small" color="secondary" align="center" style={{ whiteSpace: "pre" }}>
          {
            "Card-related information, location, device settings, and device\nuse patterns will be sent to Apple and may be shared together\nwith account information with your card issuer or bank to set up\nApple Pay."
          }
        </Label>
      </PaneAt>
      <PaneAt x={CENTRE - COLUMN / 2} y={255} width={COLUMN} style={{ justifyContent: "center" }}>
        <Uncaptured action="See how your data is managed…" nativeButton={false}>
          <Label textStyle="small" color="link" render={<a href="#wallet-and-apple-pay-privacy" />}>
            See how your data is managed…
          </Label>
        </Uncaptured>
      </PaneAt>

      {/* A bezel is drawn half a point inside the control's box: the button's bezel is 94 pt
          wide from 520.5, the help button's a 20 pt disc from 627.5. */}
      <PaneAt x={520} y={293}>
        <Uncaptured action="Add Card…">
          <PushButton aria-describedby={`${id}-about`} style={{ width: 95, paddingInline: 0 }}>
            Add Card…
          </PushButton>
        </Uncaptured>
      </PaneAt>
      <PaneFooter x={627} y={293}>
        <Uncaptured action="Help">
          <HelpButton />
        </Uncaptured>
      </PaneFooter>
    </PaneForm>
  );
}
