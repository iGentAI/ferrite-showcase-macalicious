import { FLAGS, type MailFlag } from "./mail-data";
import type { SmartMailbox } from "./mail-smart";

/** Someone the person marked as a VIP: their mail has a star and a mailbox of its own. */
export interface MailVip {
  /** Their address in lower case, without a name: what a message's sender is compared by. */
  address: string;
  /** The name the sidebar lists them by. */
  name: string;
}

/** Every flagged message, wherever it is, as the sidebar's Flagged row lists them. */
export const FLAGGED_BOX: SmartMailbox = {
  id: "smart-flagged",
  name: "Flagged",
  matchAll: true,
  rules: [{ field: "flagged", test: "yes", value: "" }],
  includeTrash: false,
  includeSent: true,
};

/** The messages flagged in one colour, as a row under Flagged lists them. */
export const flagColorBox = (flag: MailFlag): SmartMailbox => ({
  id: `smart-flagged-${flag}`,
  name: flag.charAt(0).toUpperCase() + flag.slice(1),
  matchAll: true,
  rules: [{ field: "flagged", test: "yes", value: flag }],
  includeTrash: false,
  includeSent: true,
});

export const FLAG_BOXES: readonly SmartMailbox[] = FLAGS.map(flagColorBox);

/** The mailbox of one VIP: their mail, wherever it is. */
export const vipBox = ({ address, name }: MailVip): SmartMailbox => ({
  id: `smart-vip-${address}`,
  name,
  matchAll: true,
  rules: [{ field: "from", test: "equals", value: address }],
  includeTrash: false,
  includeSent: false,
});

/** The list as stored, leaving out whatever Mail did not write. */
export function readMailVips(stored: unknown): readonly MailVip[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored.flatMap((each): MailVip[] => {
    const { address, name } = (each ?? {}) as Partial<Record<keyof MailVip, unknown>>;
    return typeof address === "string" && address !== "" && typeof name === "string"
      ? [{ address, name }]
      : [];
  });
}
