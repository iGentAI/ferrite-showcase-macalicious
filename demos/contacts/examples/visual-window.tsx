import { Contacts } from "../contacts";
import type { Contact } from "../contacts-data";

/* The cards as captured. In the Aqua capture the first phone field holds the word "Phone",
   selected, and the list has a second Stephen Hackett, the user's own card; the Dark Aqua
   capture has neither. The email address is a stand-in on a reserved domain. */
const APPLE: Contact = {
  id: "apple",
  account: "mac",
  first: "",
  last: "",
  company: "Apple Inc.",
  isCompany: true,
};
const STEPHEN: Contact = {
  id: "stephen-hackett",
  account: "icloud",
  first: "Stephen",
  last: "Hackett",
  emails: [{ label: "work", value: "stephen@example.com" }],
};
const EDITED: readonly Contact[] = [
  APPLE,
  { ...STEPHEN, phones: [{ label: "mobile", value: "Phone" }] },
  { id: "me", account: "icloud", first: "Stephen", last: "Hackett", me: true },
];
const FINISHED: readonly Contact[] = [APPLE, STEPHEN];

/**
 * The scene of 10-15-Catalina-Light-Contacts.png and 10-15-Catalina-Dark-Contacts.png: the
 * 938 x 438 pt window alone, as the comparisons crop it. `edited` is the Aqua capture, whose
 * card is being edited; without it the card is finished and no service is set up, as on the
 * Mac of the Dark Aqua capture, whose four buttons are all dimmed. The comparisons open the
 * captured menus with real clicks. The sidebar is opaque: the desktop picture that tints it
 * in the captures is not reproduced.
 */
export function ContactsScene({ edited = false }: { edited?: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: 938,
        height: 438,
        background: "var(--mac-contacts-visual-desktop)",
      }}
    >
      <Contacts
        material="opaque"
        defaultContacts={edited ? EDITED : FINISHED}
        defaultMode={edited ? "edit" : "view"}
        services={edited ? undefined : []}
        style={{ position: "absolute", left: 0, top: 0 }}
      />
    </div>
  );
}

/** Visual comparison target for the Aqua capture: the card being edited. */
export default function VisualWindow() {
  return <ContactsScene edited />;
}
