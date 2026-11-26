/**
 * The event a request to open an item of Calendar names. Spotlight and Today ask with the event's id;
 * an alert's notification says `alert:<event>@<start>`, or `@<start>@<until>` when snoozed
 * (ferrite-apps/desktop/src/apps/calendar/alerts.rs). An invitation's says `invite-<token>-<since>`
 * (calendar/invites.rs), and the window knows its event as `invitation-<token>`
 * (calendar-invitations.ts). `cancel-` and `reply-` stay as they are: a cancelled invitation has no
 * event left, and the token of a reply is a digest that names none of the organizer's events.
 */
export function eventOfOpenItem(item: string): string {
  const invite = /^invite-([0-9a-f]{32})-\d+$/.exec(item)?.[1];
  if (invite !== undefined) return `invitation-${invite}`;
  return /^alert:(.+?)@\d+(?:@\d+)?$/.exec(item)?.[1] ?? item;
}
