import { Tv } from "../tv";

/** The TV window as it opens: Watch Now, with its shelves, hero and trailers. */
export default function Basic() {
  return (
    <div style={{ overflow: "auto", maxWidth: "100%" }}>
      <Tv width={1000} height={640} style={{ margin: "8px 24px 40px" }} />
    </div>
  );
}
