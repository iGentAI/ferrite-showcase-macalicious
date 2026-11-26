import { Label } from "macalicious/label";
import { TokenFieldCompletions } from "macalicious/token-field-completions";

const ADDRESSES = [
  "Stephen Hackett <stephen@example.com>",
  "Stephanie Lee <stephanie@example.com>",
  "Myke Hurley <myke@example.com>",
  "Federico Viticci <federico@example.com>",
];

/**
 * `completions` as a function: it decides what completes the typed text, here the addresses
 * with a word that starts with it, and at most three of them. With `completionDelay` the
 * list waits for a pause of half a second in the typing.
 */
export default function Delay() {
  const complete = (text: string, tokens: readonly string[]) => {
    const start = text.toLowerCase();
    return ADDRESSES.filter(
      (address) =>
        !tokens.includes(address) &&
        address
          .toLowerCase()
          .split(/[\s<]+/)
          .some((word) => word.startsWith(start)),
    ).slice(0, 3);
  };
  return (
    <div style={{ display: "grid", gap: 6, minHeight: 130, justifyItems: "start" }}>
      <TokenFieldCompletions
        aria-label="Cc"
        tokensLabel="Copied recipients"
        completions={complete}
        completionDelay={500}
        tokenizingCharacters=";"
        style={{ width: 360 }}
      />
      <Label textStyle="small" color="secondary">
        Type "s" and pause.
      </Label>
    </div>
  );
}
