import { AccountHeader } from "macalicious/account-header";
import { PushButton } from "macalicious/push-button";

/**
 * No account: the silhouette stands in for the picture and the destinations give way to a
 * sign-in button. No screenshot shows this state; the layout is the library's inference.
 */
export default function SignedOut() {
  return (
    <div style={{ width: 480, background: "var(--mac-color-window-background)" }}>
      <AccountHeader
        name="Sign in to your account"
        subtitle="Set up cloud storage, purchases and more."
      >
        <PushButton style={{ margin: "32px 14px 0 0" }}>Sign In…</PushButton>
      </AccountHeader>
    </div>
  );
}
