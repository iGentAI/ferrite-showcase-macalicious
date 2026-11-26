"use client";

import { useEffect, useRef } from "react";
import { Preview } from "../preview";

/**
 * Visual comparison target for 10-15-Catalina-Dark-Preview-Search.png: the whole window,
 * 1376 x 822 pt, with the same search as the Aqua target. The capture is scrolled to the
 * word found: page 9 ends 325.5 pt under the find bar, and page 10 follows it. A page is
 * 840.7 pt high at this width and comes into view 4 pt under the bar, so the view is
 * scrolled on by 519 pt here, as a person would scroll it. Reference crop (2x pixels) x=112
 * y=76 w=2752 h=1644.
 */
export default function VisualSearchDark() {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const view = frame.current?.querySelector('[role="document"]');
    if (view) view.scrollTop += 519;
  }, []);
  return <Preview ref={frame} width={1376} height={822} defaultQuery="pilot" defaultPage={9} />;
}
