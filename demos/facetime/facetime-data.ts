/** How a call is carried: sound only, or sound and picture. */
export type FaceTimeCallKind = "audio" | "video";

/** Which way a call went: placed here, answered here, or not answered. */
export type FaceTimeCallStatus = "outgoing" | "incoming" | "missed";

/** Which calls the list shows: the two segments over it. */
export type FaceTimeFilter = "all" | "missed";

/** One line of the list of recent calls. */
export interface FaceTimeCall {
  /** Identifies the call in the list. Unique among the calls. */
  id: string;
  /** Who was called or who called: a name, an email address or a number. */
  name: string;
  /** FaceTime Audio or FaceTime Video. */
  kind: FaceTimeCallKind;
  /** Placed, answered or missed. */
  status: FaceTimeCallStatus;
  /** When, as the list words it: "9:41 AM", "Yesterday", "Monday". */
  when: string;
  /**
   * What to dial to call back, when it differs from `name`: an account name on the desktop's
   * Ferrite application, where `name` is the person's full name.
   */
  to?: string;
  /** How many more people the call had besides `name`. */
  also?: number;
}

/** A call that is being placed: who is called, and how. */
export interface FaceTimeOutgoingCall {
  /** The recipient as typed, without the space around it, or as the recent call names it. */
  name: string;
  /** FaceTime Audio or FaceTime Video. */
  kind: FaceTimeCallKind;
  /** What to dial: the recent call's `to`, or the name. */
  to?: string;
}

/**
 * A call the window's owner holds (`FaceTime`'s `call` prop): who it is with, how, and how it
 * stands, in the words the call panel shows ("Calling…", "Connecting…", "0:42").
 */
export interface FaceTimeHeldCall {
  name: string;
  kind: FaceTimeCallKind;
  status: string;
}

/**
 * A call that waits for the person (`FaceTime`'s `incoming` prop): one ringing for them, or one
 * they are in from another window, which the panel offers to take up here.
 */
export interface FaceTimeIncomingCall {
  /** Who calls, or whom the call is with: their full name. */
  name: string;
  kind: FaceTimeCallKind;
  /** The panel's second line; "FaceTime Video · Incoming call" by default. */
  detail?: string;
  /** The titles of the two buttons; "Accept" and "Decline" by default. */
  acceptLabel?: string;
  declineLabel?: string;
}

/**
 * A list of recent calls for the examples and the tests. Every name is invented: the
 * reference captures show an empty list, and nobody's calls are repeated here.
 */
export const RECENT_CALLS: readonly FaceTimeCall[] = [
  { id: "marit", name: "Marit Solheim", kind: "video", status: "outgoing", when: "9:41 AM" },
  { id: "dario", name: "Dario Venturi", kind: "audio", status: "missed", when: "Yesterday" },
  { id: "imogen", name: "Imogen Hartley", kind: "video", status: "incoming", when: "Yesterday" },
  { id: "kofi", name: "Kofi Asante", kind: "video", status: "missed", when: "Monday" },
  { id: "yuna", name: "Yuna Takeda", kind: "audio", status: "outgoing", when: "Sunday" },
];

/** A kind of call as FaceTime names it. */
export const kindName = (kind: FaceTimeCallKind): string =>
  kind === "audio" ? "FaceTime Audio" : "FaceTime Video";

/** "Martin", or "Martin and 2 others": how a call with several people names them. */
export const peopleName = (name: string, more = 0): string =>
  more === 0 ? name : `${name} and ${more} ${more === 1 ? "other" : "others"}`;

/** The calls a filter shows, in the order of the list. */
export const filterCalls = (
  calls: readonly FaceTimeCall[],
  filter: FaceTimeFilter,
): readonly FaceTimeCall[] =>
  filter === "missed" ? calls.filter((call) => call.status === "missed") : calls;

/** A row of the list: calls in a row with one person, of one kind and one way, shown as one. */
export interface FaceTimeCallRow extends FaceTimeCall {
  /** The calls it stands for, newest first: `id` is the first. */
  ids: readonly string[];
}

/** The calls as the list shows them: next to each other with the same person, kind and status, one row. */
export function groupCalls(calls: readonly FaceTimeCall[]): readonly FaceTimeCallRow[] {
  const rows: FaceTimeCallRow[] = [];
  for (const call of calls) {
    const last = rows.at(-1);
    if (
      last &&
      (last.to ?? last.name) === (call.to ?? call.name) &&
      last.kind === call.kind &&
      last.status === call.status &&
      (last.also ?? 0) === (call.also ?? 0)
    ) {
      rows[rows.length - 1] = { ...last, ids: [...last.ids, call.id] };
    } else {
      rows.push({ ...call, ids: [call.id] });
    }
  }
  return rows;
}

/**
 * The second line of a call's row: its kind and when it was, with "Missed" before them for a
 * call that was not answered, so that the colour of the name is not the only sign of it.
 */
export const callDetail = (call: FaceTimeCall): string =>
  `${call.status === "missed" ? "Missed " : ""}${kindName(call.kind)} · ${call.when}`;

/** What the filter now shows, in a sentence for assistive technology. */
export function describeList(filter: FaceTimeFilter, count: number): string {
  if (filter === "missed") {
    if (count === 0) return "No missed calls";
    return count === 1 ? "Showing 1 missed call" : `Showing ${count} missed calls`;
  }
  if (count === 0) return "No recent calls";
  return count === 1 ? "Showing 1 recent call" : `Showing all ${count} recent calls`;
}
