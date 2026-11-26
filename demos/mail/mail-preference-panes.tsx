"use client";

import { BorderedList, BorderedListRow, BorderedListRows } from "macalicious/bordered-list";
import { Checkbox } from "macalicious/checkbox";
import { Label } from "macalicious/label";
import { PushButton } from "macalicious/push-button";
import { useState } from "react";
import { useDesktopSetting } from "../desktop/desktop-personal";
import { MAIL_DOWNLOAD_ATTACHMENTS, readDownloadAttachments } from "./mail-attachment-views";
import { addressKey } from "./mail-data";
import { NO_OUTSIDE_MAIL } from "./mail-menus";
import type { MailVip } from "./mail-vips";

/** Preferences > Accounts: the one account this desktop gives a person, named as it is. */
export function MailAccountPane({ me }: { me: string }) {
  const name = /^(.*?)\s*<[^<>]*>\s*$/.exec(me)?.[1];
  const [downloads, setDownloads] = useDesktopSetting(
    MAIL_DOWNLOAD_ATTACHMENTS,
    readDownloadAttachments,
    true,
  );
  return (
    <div className="mac-mail-preferences-account">
      <span />
      <Checkbox
        checked={downloads}
        title="Off, a picture or recording is read from the server only when you ask for it."
        onCheckedChange={setDownloads}
      >
        Download attachments automatically
      </Checkbox>
      <Label color="secondary">Description:</Label>
      <Label selectable>This desktop’s mail</Label>
      <Label color="secondary">Full name:</Label>
      <Label selectable>{name || "Not known yet"}</Label>
      <Label color="secondary">Address:</Label>
      <Label selectable>{addressKey(me) || "Not known yet"}</Label>
      <Label color="secondary">Others:</Label>
      <Label color="secondary">{NO_OUTSIDE_MAIL}</Label>
    </div>
  );
}

/**
 * Preferences > Junk Mail: the people Message > Block Contact lists, with Remove, and what becomes
 * of their mail.
 */
export function MailBlockedPane({
  blocked,
  toTrash,
  onChange,
  onToTrashChange,
}: {
  blocked: readonly MailVip[];
  toTrash: boolean;
  onChange: (next: readonly MailVip[]) => void;
  onToTrashChange: (toTrash: boolean) => void;
}) {
  const [chosen, setChosen] = useState<readonly string[]>([]);
  return (
    <div className="mac-mail-preferences-checks">
      <Label>Blocked senders:</Label>
      <BorderedList className="mac-mail-rules-list">
        <BorderedListRows
          aria-label="Blocked senders"
          rowHeight={20}
          value={chosen}
          onValueChange={setChosen}
        >
          {blocked.map(({ address, name }) => (
            <BorderedListRow
              key={address}
              value={address}
              title={name === address ? address : `${name} (${address})`}
              textValue={address}
            />
          ))}
        </BorderedListRows>
      </BorderedList>
      <div className="mac-mail-tool-buttons">
        <PushButton
          disabled={chosen.length === 0}
          onClick={() => {
            onChange(blocked.filter((each) => !chosen.includes(each.address)));
            setChosen([]);
          }}
        >
          Remove
        </PushButton>
      </div>
      <Checkbox checked={toTrash} onCheckedChange={onToTrashChange}>
        Move mail from blocked senders to the Trash
      </Checkbox>
    </div>
  );
}
