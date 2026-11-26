import { Label } from "macalicious/label";
import { SecureTextField } from "macalicious/secure-text-field";
import { TextField } from "macalicious/text-field";

/** Name and Password as in an authentication dialog: stacked 8 pt apart, labels right-aligned. */
export default function SignIn() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "max-content 220px",
        columnGap: "var(--mac-space-label-gap)",
        rowGap: 8,
        alignItems: "baseline",
      }}
    >
      {/* biome-ignore lint/a11y/noLabelWithoutControl: the label names the input through htmlFor */}
      <Label render={<label htmlFor="secure-sign-in-name" />} align="end">
        Name:
      </Label>
      <TextField
        id="secure-sign-in-name"
        defaultValue="Stephen"
        autoComplete="username"
        style={{ width: "100%" }}
      />
      {/* biome-ignore lint/a11y/noLabelWithoutControl: the label names the input through htmlFor */}
      <Label render={<label htmlFor="secure-sign-in-password" />} align="end">
        Password:
      </Label>
      <SecureTextField
        id="secure-sign-in-password"
        autoComplete="current-password"
        style={{ width: "100%" }}
      />
    </div>
  );
}
