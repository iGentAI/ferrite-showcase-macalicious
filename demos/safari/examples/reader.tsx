import { Safari } from "../safari";

/** The third tab in Reader: the article on a sheet of paper, the Reader button switched on. */
export default function Reader() {
  return <Safari width={960} height={600} defaultActiveTab={2} defaultReader />;
}
