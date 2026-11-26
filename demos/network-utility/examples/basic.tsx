import { NetworkUtility } from "../network-utility";

/**
 * Choose an interface in the pop-up button, or pick another tab, enter an address and run the
 * tool. Nothing is sent to a network: what a tool prints is made up from what was entered.
 */
export default function Basic() {
  return <NetworkUtility />;
}
