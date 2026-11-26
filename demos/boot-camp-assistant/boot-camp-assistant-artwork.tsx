/**
 * What stands in the assistant's artwork column. Boot Camp's diamonds are Apple's logo and are
 * neither reproduced nor imitated: the demo shows the usual mark for "a picture goes here", in
 * a grey of the window, where the captures have them.
 */
export function AssistantArtwork() {
  return (
    <svg
      className="mac-boot-camp-assistant-artwork"
      width="60"
      height="48"
      viewBox="0 0 40 32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M4 0h32a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4a4 4 0 0 1 4-4zm0 3a1 1 0 0 0-1 1v24a1 1 0 0 0 1 1h32a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm7.5 4a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM6 26l8-9 5 5 6.5-8L34 26z"
      />
    </svg>
  );
}
