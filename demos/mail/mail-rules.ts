import type { MailMessageChange } from "./mail";
import { FLAGS, type MailboxId, type MailFlag, type MailMessage } from "./mail-data";
import {
  inSmartMailbox,
  meetsConditions,
  readSmartRule,
  type SmartMailbox,
  type SmartRule,
} from "./mail-smart";

/** What a rule does to a message that meets its conditions. */
export type MailRuleAction =
  | { kind: "move"; mailbox: MailboxId }
  | { kind: "flag"; flag: MailFlag }
  | { kind: "read" }
  | { kind: "delete" };

/** A rule of Preferences > Rules: run in the order of the list, on new Inbox mail and by Apply Rules. */
export interface MailRule {
  id: string;
  description: string;
  /** The rule's On checkbox: a rule that is off does nothing. */
  enabled: boolean;
  /** Every condition must hold, or any one. */
  matchAll: boolean;
  conditions: readonly SmartRule[];
  actions: readonly MailRuleAction[];
}

export const RULE_ACTIONS: readonly (readonly [MailRuleAction["kind"], string])[] = [
  ["move", "Move Message"],
  ["flag", "Mark as Flagged"],
  ["read", "Mark as Read"],
  ["delete", "Delete Message"],
];

/** A new action of `kind`, naming what it needs at first. */
export function actionFor(kind: MailRuleAction["kind"]): MailRuleAction {
  if (kind === "move") return { kind, mailbox: "archive" };
  if (kind === "flag") return { kind, flag: "red" };
  return { kind };
}

/**
 * What the rules make of `message`, or `null` when they change nothing. A later rule sees what an
 * earlier one did. `mayMove` says whether the message, as it is by then, can go to a mailbox: a move
 * that cannot does not happen, for the later rules either.
 */
export function ruleChange(
  message: MailMessage,
  rules: readonly MailRule[],
  now: number,
  mayMove: (message: MailMessage, mailbox: MailboxId) => boolean,
): MailMessageChange | null {
  let after = message;
  for (const rule of rules) {
    if (!rule.enabled || !meetsConditions(after, rule.conditions, rule.matchAll, now)) continue;
    for (const action of rule.actions) {
      if (action.kind === "read") after = { ...after, unread: false };
      else if (action.kind === "flag") after = { ...after, flag: action.flag };
      else {
        const to = action.kind === "delete" ? "trash" : action.mailbox;
        if (mayMove(after, to)) after = { ...after, mailbox: to };
      }
    }
  }
  const change: MailMessageChange = {};
  if (after.unread !== message.unread) change.unread = after.unread === true;
  if (after.flag !== message.flag) change.flag = after.flag;
  if (after.mailbox !== message.mailbox) change.mailbox = after.mailbox;
  return Object.keys(change).length > 0 ? change : null;
}

/**
 * What a mailbox holds, whatever the list shows of it under a search or the filter: what "apply to
 * this mailbox" means. A draft is not mail, so no rule acts on one.
 */
export function messagesOfMailbox(
  messages: readonly MailMessage[],
  mailbox: MailboxId,
  listed: readonly SmartMailbox[],
  now: number,
): MailMessage[] {
  const smart = listed.find((box) => box.id === mailbox);
  return messages.filter(
    (message) =>
      message.mailbox !== "drafts" &&
      (smart ? inSmartMailbox(message, smart, now) : message.mailbox === mailbox),
  );
}

/** The most bytes the list may take: a person's setting holds at most 4096. */
const MOST_BYTES = 4000;

/** Whether the list can be kept. */
export const rulesFit = (rules: readonly MailRule[]): boolean =>
  new TextEncoder().encode(JSON.stringify(rules)).length <= MOST_BYTES;

const readAction = (stored: unknown): MailRuleAction | undefined => {
  const { kind, mailbox, flag } = (stored ?? {}) as {
    kind?: unknown;
    mailbox?: unknown;
    flag?: unknown;
  };
  if (kind === "read" || kind === "delete") return { kind };
  if (kind === "move" && typeof mailbox === "string" && mailbox !== "drafts") {
    return { kind, mailbox: mailbox as MailboxId };
  }
  if (kind === "flag" && FLAGS.includes(flag as MailFlag)) return { kind, flag: flag as MailFlag };
  return undefined;
};

/** The list as stored, leaving out whatever Mail did not write. */
export function readMailRules(stored: unknown): readonly MailRule[] | undefined {
  if (!Array.isArray(stored)) return undefined;
  return stored.flatMap((each): MailRule[] => {
    const rule = (each ?? {}) as Partial<Record<keyof MailRule, unknown>>;
    if (typeof rule.id !== "string" || typeof rule.description !== "string") return [];
    if (!Array.isArray(rule.conditions) || !Array.isArray(rule.actions)) return [];
    const conditions = rule.conditions.map(readSmartRule);
    const actions = rule.actions.map(readAction);
    if (conditions.length === 0 || conditions.some((condition) => condition === undefined)) {
      return [];
    }
    if (actions.length === 0 || actions.some((action) => action === undefined)) return [];
    return [
      {
        id: rule.id,
        description: rule.description,
        enabled: rule.enabled !== false,
        matchAll: rule.matchAll !== false,
        conditions: conditions as SmartRule[],
        actions: actions as MailRuleAction[],
      },
    ];
  });
}
