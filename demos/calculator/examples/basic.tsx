import { Calculator } from "../calculator";

/** The calculator, working: click the keys, or click the window and type. */
export default function Basic() {
  return (
    <div style={{ display: "grid", placeItems: "center", padding: "31px 48px 67px" }}>
      <Calculator />
    </div>
  );
}
