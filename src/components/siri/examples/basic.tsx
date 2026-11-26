import { Siri, SiriCard } from "macalicious/siri";

/** A request and its answer. The application supplies both, and closes the window. */
export default function Basic() {
  return (
    <Siri
      prompt="What’s on my calendar today?"
      onClose={() => {}}
      onHelp={() => {}}
      onListen={() => {}}
      style={{ height: 360 }}
    >
      <SiriCard title="Calendar">
        <ul style={{ margin: 0, padding: "10px 18px 14px", listStyle: "none", lineHeight: "22px" }}>
          <li>
            <b>10:00 AM</b> Design review
          </li>
          <li>
            <b>1:30 PM</b> Lunch with Ana
          </li>
          <li style={{ color: "var(--mac-siri-card-secondary)" }}>Nothing after 3 PM</li>
        </ul>
      </SiriCard>
    </Siri>
  );
}
