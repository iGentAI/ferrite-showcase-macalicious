import { Mail } from "../mail";
import type { MailMessage } from "../mail-data";

/* The mailboxes as captured: one message in the Inbox, one draft, and in the Dark Aqua
   capture one message in the Trash. The Inbox message is the demo's own invented one. */
const MESSAGES: readonly MailMessage[] = [
  {
    id: "ferry",
    mailbox: "inbox",
    from: "Harbor Ferry",
    to: ["Robin Vega"],
    subject: "Your crossing to the island is confirmed for Saturday morning",
    date: "9/29/19",
    received: "September 29, 2019 at 6:24 PM",
    time: 2,
    body: "Dear Robin Vega, Your booking for the 8:40 AM crossing on Saturday is confirmed: two foot passengers and one bicycle.",
  },
  {
    id: "draft",
    mailbox: "drafts",
    from: "Robin Vega",
    to: ["Stephen Hackett"],
    subject: "Hello from macOS Catalina!",
    date: "9/29/19",
    received: "September 29, 2019 at 6:30 PM",
    time: 3,
    body: "",
  },
];

const TRASHED: MailMessage = {
  id: "trashed",
  mailbox: "trash",
  from: "Tide Tables",
  to: ["Robin Vega"],
  subject: "Tide tables for October",
  date: "9/20/19",
  received: "September 20, 2019 at 7:00 AM",
  time: 1,
  body: "The lowest tide of the month is on the fourteenth.",
};

/**
 * The scene of 10-15-Catalina-Light-Mail.png and 10-15-Catalina-Dark-Mail.png: the viewer,
 * inactive, behind a key New Message window. The outer box is the region the comparisons
 * crop: from the viewer's top-left corner to the New Message window's bottom-right corner,
 * 1111 x 730 pt in the Aqua capture and 1119 x 727 pt in the Dark Aqua one, where the New
 * Message window sits 8 pt further right and 3 pt higher. The desktop picture in the two
 * corners no window covers is not reproduced; the comparisons mask it.
 */
export function MailScene({ trash = false }: { trash?: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: trash ? 1119 : 1111,
        height: trash ? 727 : 730,
        background: "var(--mac-mail-visual-desktop)",
      }}
    >
      <Mail
        material="opaque"
        messages={trash ? [...MESSAGES, TRASHED] : MESSAGES}
        defaultMessage="ferry"
        composeOffset={trash ? { x: 233, y: 142 } : { x: 225, y: 145 }}
        defaultDraft={{
          to: ["Stephen Hackett"],
          cc: [],
          subject: "Hello from macOS Catalina!",
          body: "",
        }}
        style={{ position: "absolute", left: 0, top: 0 }}
      />
    </div>
  );
}

/** Visual comparison target for the Aqua capture, whose sidebar has no Trash row. */
export default function VisualWindow() {
  return <MailScene />;
}
