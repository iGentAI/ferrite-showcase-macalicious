/**
 * An original stand-in for the application's computer icon in the path at the bottom of the
 * window: an open notebook, drawn in the text colour. It is 13.5 pt wide in a 16 pt box, as
 * the icon of the reference screenshots is.
 */
export function ComputerIcon() {
  return (
    <svg
      className="mac-system-information-computer"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="5" width="9.5" height="6" rx="1" fill="none" stroke="currentColor" />
      <path d="M0.5 13h12.5" fill="none" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}
