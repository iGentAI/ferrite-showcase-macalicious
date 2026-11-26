import { TokenFieldCompletions } from "macalicious/token-field-completions";

const PEOPLE = ["Stephen Hackett", "Stephanie Lee", "Myke Hurley", "Federico Viticci"];

/** Type "ste": two names are suggested. Return takes the highlighted one. */
export default function Basic() {
  return (
    <div style={{ minHeight: 120 }}>
      <TokenFieldCompletions
        aria-label="To"
        tokensLabel="Recipients"
        completions={PEOPLE}
        defaultValue={["Myke Hurley"]}
        style={{ width: 320 }}
      />
    </div>
  );
}
