import Pictures from "./pictures";

/**
 * Fixture for avatar.browser.test.tsx: the Pictures example, with Next Picture changing to an
 * address on this site that the test answers itself (holding it, or answering 404), and No
 * Picture taking the address away. The documentation's example changes to a second drawn
 * picture instead.
 */
export default function VisualPictures() {
  return <Pictures next="/avatar-next-picture.svg" removable />;
}
