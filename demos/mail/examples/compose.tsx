import { MailCompose } from "../mail-compose";

/** The New Message window on its own: type a name in To, write, choose Send. */
export default function Compose() {
  return (
    <MailCompose
      width="100%"
      height={360}
      style={{ maxWidth: 640 }}
      defaultDraft={{
        to: ["Ines Lindqvist"],
        cc: [],
        subject: "The north trail",
        body: "If the weather holds, the north trail. I have booked the 8:40 crossing.",
      }}
    />
  );
}
