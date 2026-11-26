import { PathBar, PathBarItem } from "macalicious/path-bar";

export default function Basic() {
  return (
    <PathBar style={{ width: 420 }}>
      <PathBarItem onActivate={() => {}}>Macintosh HD</PathBarItem>
      <PathBarItem onActivate={() => {}}>Users</PathBarItem>
      <PathBarItem onActivate={() => {}}>chris</PathBarItem>
      <PathBarItem>Documents</PathBarItem>
    </PathBar>
  );
}
