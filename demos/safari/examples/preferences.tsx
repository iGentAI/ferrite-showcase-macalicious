import { SafariPreferences } from "../safari-preferences";

/** Safari's preferences window, told which page the browser shows. */
export default function Preferences() {
  return <SafariPreferences currentPage="https://fieldnotes.example/about" />;
}
