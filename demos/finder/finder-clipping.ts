/**
 * What a drop of words, a card or a link from a page leaves in a folder: a `.vcf` file for a card,
 * which Contacts opens, a saved link for an address, which opens in Safari, and a text file named by
 * its first words for anything else. A Mac makes a text clipping; here it is a plain text file,
 * which TextEdit opens.
 */

const fileName = (name: string, extension: string) => {
  const clean = name
    .replace(/[/\\:*?"<>|\p{Cc}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .trim();
  return `${clean || "Untitled"}.${extension}`;
};

const escaped = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Whether a drag carries words, a card or a link, and no files. */
export const carriesClipping = (types: readonly string[]) =>
  !types.includes("Files") &&
  ["text/plain", "text/uri-list", "text/vcard"].some((type) => types.includes(type));

/** A card's file, named as a Mac names it: for the person, or for how many there are. */
function cardFile(cards: string, words: string) {
  const count = cards.match(/^BEGIN:VCARD\s*$/gim)?.length ?? 1;
  const unfolded = cards.replace(/\r?\n[ \t]/g, "");
  const name = unfolded
    .match(/^FN(?:;[^:\r\n]*)?:(.*)$/im)?.[1]
    ?.replace(/\\([,;\\])/g, "$1")
    .trim();
  const title = count > 1 ? `${count} Cards` : name || words.split("\n")[0] || "Card";
  return new File([cards], fileName(title, "vcf"), { type: "text/vcard" });
}

/** The file for what `read` answers per type of a drop's data, or `null` when it holds nothing. */
export function clippingFile(read: (type: string) => string): File | null {
  const words = read("text/plain").trim();
  const cards = read("text/vcard");
  if (cards.trim()) return cardFile(cards, words);
  const listed = read("text/uri-list")
    .split(/\r?\n/)
    .find((line) => line.trim() && !line.startsWith("#"))
    ?.trim();
  const address = listed ?? words;
  if (/^https?:\/\/\S+$/i.test(address) && URL.canParse(address)) {
    const title = words && words !== address ? words : new URL(address).hostname;
    return new File(
      [
        '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict><key>URL</key>',
        `<string>${escaped(address)}</string></dict></plist>\n`,
      ],
      fileName(title, "webloc"),
      { type: "application/xml" },
    );
  }
  if (!words) return null;
  const title = words.split(/\s+/).slice(0, 6).join(" ");
  return new File([words], fileName(title, "txt"), { type: "text/plain" });
}
