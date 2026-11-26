"use client";

import { InspectorPanel, type InspectorPanelProps } from "macalicious/inspector-panel";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { TextField } from "macalicious/text-field";
import { useState } from "react";
import type { ContactPerson } from "../contacts/contacts-people";

/** Why Window > Availability Panel is dimmed. */
export const NO_AVAILABILITY =
  "Availability needs other people\u2019s free and busy times, which this desktop does not share between accounts.";

export interface AddressPanelProps extends Omit<InspectorPanelProps, "title" | "children"> {
  /** The person's contacts who have an account on this desktop: only they can be invited. */
  people: readonly ContactPerson[];
  /** Who the selected event already invites. */
  invited: readonly string[];
  /** Why nobody can be invited now, when so. */
  refusal?: string;
  onInvite: (person: ContactPerson) => void;
}

/** Window > Address Panel: the person's contacts, each of whom the selected event can invite. */
export function AddressPanel({ people, invited, refusal, onInvite, ...props }: AddressPanelProps) {
  const [typed, setTyped] = useState("");
  const words = typed.trim().toLowerCase();
  const found = people.filter(
    ({ name, to }) => name.toLowerCase().includes(words) || to.toLowerCase().includes(words),
  );
  return (
    <InspectorPanel title="Address Panel" aria-label="Address Panel" width={260} {...props}>
      <div className="mac-calendar-address">
        <TextField aria-label="Search contacts" value={typed} onValueChange={setTyped} />
        {found.map((person) => {
          const asked = invited.includes(person.to);
          return (
            <div key={person.to} className="mac-calendar-address-row">
              <span className="mac-calendar-address-name">{person.name}</span>
              <PushButton
                size="mini"
                aria-label={`Invite ${person.name}`}
                disabled={asked || refusal !== undefined}
                title={refusal}
                onClick={() => onInvite(person)}
              >
                {asked ? "Invited" : "Invite"}
              </PushButton>
            </div>
          );
        })}
        {found.length === 0 ? (
          <Label color="secondary" className="mac-calendar-note">
            No contacts with an account on this desktop
          </Label>
        ) : null}
        {refusal ? (
          <Label color="secondary" className="mac-calendar-note">
            {refusal}
          </Label>
        ) : null}
      </div>
    </InspectorPanel>
  );
}
