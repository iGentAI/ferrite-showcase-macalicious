/*
 * The Calendar demo's own glyph and stand-in icons: original drawings. Catalina's own icons are
 * Apple's artwork and are not part of the library. The plus and the chevrons of the window are
 * the library's system images.
 */

/** Beside a subscribed calendar: a dot and three arcs. */
export function SubscriptionGlyph() {
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" role="img" aria-label="Subscribed">
      <circle cx="1.6" cy="9.4" r="1.1" fill="currentColor" />
      <path
        d="M4.2 10.4a4.4 4.4 0 0 0-1.5-5.1M7.4 10.4a7.6 7.6 0 0 0-2.7-7.9M10.7 10.4A10.8 10.8 0 0 0 6.9 0.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A calendar's colour as a square chip, for the menu of calendars. */
export function ColorChip({ color }: { color: string }) {
  return <span className="mac-calendar-chip" style={{ background: color }} />;
}

/** Stand-in for the Calendar application's icon: a page with a red header and a date. */
export function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" fill="#ffffff" stroke="#b4b4b4" />
      <path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1.5H2z" fill="#e5463a" />
      <path d="M6.3 8h3.6l-2.3 5" fill="none" stroke="#3c3c3c" strokeWidth="1.3" />
    </svg>
  );
}

/** Stand-in for the General pane's icon: a switch plate. */
export function GeneralIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="6.5" y="3.5" width="19" height="25" rx="2" fill="#f4f4f4" stroke="#a9a9a9" />
      <rect x="12.5" y="10.5" width="7" height="11" rx="1" fill="#fdfdfd" stroke="#8e8e8e" />
      <rect x="13.5" y="11.5" width="5" height="4.5" fill="#8e8e8e" />
    </svg>
  );
}

/** Stand-in for the Accounts pane's icon: an at sign on a blue disc. */
export function AccountsIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="#1a8cf7" />
      <circle cx="16" cy="16" r="3.6" fill="none" stroke="#ffffff" strokeWidth="2" />
      <path
        d="M19.6 12.2v5.2a2.2 2.2 0 0 0 4.4 0V16a8 8 0 1 0-3.4 6.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Stand-in for the Alerts pane's icon: a megaphone. */
export function AlertsIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 13.5 27 6v19L4 18.5z" fill="#f3c64b" stroke="#b98a1c" strokeLinejoin="round" />
      <path d="M9 20v5.5h4V21" fill="#d9d9d9" stroke="#8e8e8e" strokeLinejoin="round" />
      <rect x="2.5" y="13" width="3" height="6" rx="1" fill="#d9d9d9" stroke="#8e8e8e" />
    </svg>
  );
}

/** Stand-in for the Advanced pane's icon: a gear. */
export function AdvancedIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <circle
        cx="16"
        cy="16"
        r="10.5"
        fill="none"
        stroke="#8e8e8e"
        strokeWidth="5"
        strokeDasharray="4.1 4.15"
      />
      <circle cx="16" cy="16" r="8.5" fill="#c9c9c9" stroke="#8e8e8e" />
      <circle cx="16" cy="16" r="3.5" fill="#f4f4f4" stroke="#8e8e8e" />
    </svg>
  );
}
