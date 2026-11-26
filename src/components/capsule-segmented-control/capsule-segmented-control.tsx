"use client";

import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  type ReactNode,
  type Ref,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { attachRef } from "../../lib/attach-ref";
import { withClassName } from "../../lib/cn";
import "./capsule-segmented-control.tokens.css";
import "./capsule-segmented-control.css";

/** A segment's value, and whether it can be chosen. */
interface Known {
  value: string;
  disabled: boolean;
}

/**
 * What each mounted segment element holds, filled from the segments' refs, and the request to
 * read the group's segments again once the commit that changed them has finished.
 */
interface Registry {
  known: WeakMap<Element, Known>;
  changed: () => void;
}

/** Replaced by the bundler of the app that uses the library; see `development`. */
declare const process: { env: { NODE_ENV?: string } };

const Segments = createContext<Registry | null>(null);

const GROUP = "mac-capsule-segmented-control";
const SEGMENT = "mac-capsule-segmented-control-segment";

/**
 * The segments written among `children`, directly or inside fragments and arrays, in order:
 * what the group knows before its segments mount, and on the server.
 */
function written(children: ReactNode, out: Known[] = []): Known[] {
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: string; disabled?: boolean; children?: ReactNode }>(child)) {
      return;
    }
    if (child.type === CapsuleSegment) {
      out.push({ value: String(child.props.value), disabled: Boolean(child.props.disabled) });
    } else if (child.type === Fragment) {
      written(child.props.children, out);
    }
  });
  return out;
}

/** The first segment that is not disabled, else the first. */
const firstOf = (list: readonly Known[]) => (list.find((item) => !item.disabled) ?? list[0])?.value;

/** The first entry of `given` that names a segment of `list`, else the first segment. */
const resolve = (given: readonly string[] | undefined, list: readonly Known[]) =>
  given?.find((entry) => list.some((segment) => segment.value === entry)) ?? firstOf(list);

const sameList = (a: readonly Known[], b: readonly Known[]) =>
  a.length === b.length &&
  a.every((item, index) => item.value === b[index]?.value && item.disabled === b[index]?.disabled);

const development = () => {
  // Bundlers replace process.env.NODE_ENV in the app that uses the library; where nothing
  // defines it (a browser loading the module as it is), there is no warning.
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
};

export interface CapsuleSegmentedControlProps<Value extends string = string>
  extends Omit<BaseToggleGroup.Props<Value>, "ref" | "orientation" | "multiple"> {
  /**
   * Ref to the group element.
   * @default undefined
   */
  ref?: Ref<HTMLDivElement>;
}

/**
 * A flat segmented control with capsule ends: a hairline outline, no bezel and no dividers,
 * with the selected segment filled a faint grey. Contacts uses it to switch a card being
 * edited between Info and Picture.
 *
 * Exactly one segment is selected once the control has mounted. Clicking the selected segment
 * does not deselect it. The selection is the first entry of `value` (or `defaultValue`) that
 * names a segment; when none does (no value, an empty array, or only values that name no
 * segment, as when the selected segment was removed) the first segment in document order that
 * is not disabled is selected, without a call to `onValueChange`. In server HTML and the first
 * render the group knows only the segments written among its children (directly or in
 * fragments and arrays); segments that only your own components render need a `value` that
 * names one. Built on Base UI's Toggle Group, so it also accepts `value`, `defaultValue`,
 * `onValueChange`, `disabled`, `loopFocus` and `render`. As in Base UI the value is an array;
 * this control reports it with one entry. Give the group an accessible name with `aria-label`
 * or `aria-labelledby`.
 */
export function CapsuleSegmentedControl<Value extends string = string>({
  value,
  defaultValue,
  onValueChange,
  className,
  ref,
  ...props
}: CapsuleSegmentedControlProps<Value>) {
  const [own, setOwn] = useState(defaultValue);
  // The group's segments in document order, read from the document after every commit of the
  // group and every change below it; null until the group has mounted.
  const [mounted, setMounted] = useState<readonly Known[] | null>(null);
  // Bumped by a segment whose element or props changed, so the group reads them again after
  // that commit has finished.
  const [, setVersion] = useState(0);
  const root = useRef<HTMLDivElement | null>(null);
  const checked = useRef(false);

  const list = mounted ?? written(props.children);
  const given = value ?? own;
  const selected = (resolve(given, list) ?? given?.[0]) as Value | undefined;

  const [registry] = useState<Registry>(() => ({
    known: new WeakMap<Element, Known>(),
    changed: () => setVersion((version) => version + 1),
  }));

  // Runs only when the DOM is complete: after a commit of the group, or after a change below it.
  // Never from a segment's ref, which React detaches and attaches again halfway through a commit.
  const refresh = () => {
    const group = root.current;
    if (!group) return;
    // querySelectorAll lists elements in document order, whatever moved them.
    const now: Known[] = [];
    for (const element of group.querySelectorAll(`.${SEGMENT}`)) {
      const segment = registry.known.get(element);
      if (segment && element.closest(`.${GROUP}`) === group) now.push(segment);
    }
    setMounted((before) => (before && sameList(before, now) ? before : now));
    if (!checked.current) {
      checked.current = true;
      const shown = resolve(given, now) ?? given?.[0];
      if (shown !== selected && development()) {
        console.warn(
          "CapsuleSegmentedControl: the first render (and any server HTML) selected " +
            `${JSON.stringify(selected)}, but the mounted segments select ${JSON.stringify(shown)}. ` +
            "Segments rendered by your own components are only known once mounted: write them " +
            "among the control's children, or pass a value that names one.",
        );
      }
    }
    // An uncontrolled control keeps the selection as its value, with one entry, and forgets it
    // when every segment is removed, so a removed segment that returns is not reselected.
    if (value === undefined) {
      const keep = resolve(own, now);
      if (own?.length !== (keep === undefined ? 0 : 1) || own?.[0] !== keep) {
        setOwn(keep === undefined ? [] : [keep as Value]);
      }
    }
  };
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useLayoutEffect(() => {
    refreshRef.current();
  });

  const setRoot = useCallback(
    (node: HTMLDivElement) => {
      root.current = node;
      const release = attachRef(ref, node);
      // A component of the app's own can move, add or remove segments without rendering the
      // group. Watched on this element, so a root that `render` replaces is watched in turn.
      const observer = new MutationObserver(() => refreshRef.current());
      observer.observe(node, { childList: true, subtree: true });
      return () => {
        observer.disconnect();
        if (root.current === node) root.current = null;
        release();
      };
    },
    [ref],
  );

  return (
    <Segments.Provider value={registry}>
      <BaseToggleGroup<Value>
        ref={setRoot}
        className={withClassName(GROUP, className)}
        {...props}
        multiple={false}
        value={selected === undefined ? [] : [selected]}
        onValueChange={(next, details) => {
          // The selection never becomes empty: veto the change inside Base UI.
          if (next.length === 0) {
            details.cancel();
            return;
          }
          onValueChange?.(next, details);
          // A handler that cancels the change keeps the selection, as in Base UI.
          if (value === undefined && !details.isCanceled) setOwn(next);
        }}
      />
    </Segments.Provider>
  );
}

export interface CapsuleSegmentProps<Value extends string = string>
  extends Omit<BaseToggle.Props<Value>, "ref" | "value"> {
  /** The value the group's `value` holds while this segment is selected; unique in the group. */
  value: Value;
  /**
   * Ref to the rendered button.
   * @default undefined
   */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * One segment of a `CapsuleSegmentedControl`: a text title. It may sit inside fragments or
 * components of its own; the group finds it wherever it is rendered.
 *
 * Built on Base UI's Toggle, so it accepts `disabled`, `onPressedChange`, `render` and every
 * native button attribute.
 */
export function CapsuleSegment<Value extends string = string>({
  className,
  ref,
  ...props
}: CapsuleSegmentProps<Value>) {
  const registry = useContext(Segments);
  const disabled = Boolean(props.disabled);
  // Recorded from the ref, so the group reads what the element mounted now holds, also when
  // `render` replaces it or its value changes. The group reads it after the commit.
  const setElement = useCallback(
    (node: HTMLButtonElement) => {
      const release = attachRef(ref, node);
      registry?.known.set(node, { value: props.value, disabled });
      registry?.changed();
      return () => {
        registry?.known.delete(node);
        registry?.changed();
        release();
      };
    },
    [ref, registry, props.value, disabled],
  );

  return (
    <BaseToggle<Value> ref={setElement} className={withClassName(SEGMENT, className)} {...props} />
  );
}
