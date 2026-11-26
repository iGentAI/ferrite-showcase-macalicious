import { SecureTextField } from "macalicious/secure-text-field";

export default function Basic() {
  return <SecureTextField aria-label="Password" defaultValue="catalina" style={{ width: 220 }} />;
}
