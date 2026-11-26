"use client";

import { Box } from "macalicious/box";
import {
  ContextualMenu,
  ContextualMenuPopup,
  ContextualMenuTrigger,
} from "macalicious/contextual-menu";
import { Form, FormRow } from "macalicious/form";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";
import { PushButton } from "macalicious/push-button";
import { RadioButton, RadioGroup } from "macalicious/radio-button";
import { TabView, TabViewList, TabViewPanel, TabViewTab } from "macalicious/tab-view";
import { TextField } from "macalicious/text-field";
import { TextView } from "macalicious/text-view";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, WindowBody, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { type CSSProperties, Fragment, useEffect, useRef, useState } from "react";
import { EditRows } from "../desktop/desktop-edit-rows";
import {
  defaultInterfaces,
  formatCount,
  type NetworkUtilityInterface,
  type NetworkUtilityTab,
  type NetworkUtilityTool,
  runTool,
  TABS,
  TOOLS,
} from "./network-utility-data";
import "./network-utility.tokens.css";
import "./network-utility.css";

/** What a run is handed beside its input. */
export interface NetworkUtilityRunContext {
  /** Aborted when the person presses Stop. */
  signal: AbortSignal;
  /** Replaces the pane's text while the run goes on. */
  progress: (text: string) => void;
}

/** A pop-up button of a tool. */
export interface NetworkUtilityChoice {
  label: string;
  options: readonly { id: string; title: string }[];
}

/** What a tool's pane holds. */
export interface NetworkUtilityToolState {
  input: string;
  output: string;
}

export interface NetworkUtilityProps extends Omit<WindowProps, "children"> {
  /**
   * The network interfaces of the Info pane's pop-up button.
   * @default defaultInterfaces
   */
  interfaces?: readonly NetworkUtilityInterface[];
  /**
   * The `id` of the interface shown at first.
   * @default the first interface
   */
  defaultInterface?: string;
  /** The pane shown (controlled). */
  tab?: NetworkUtilityTab;
  /**
   * The pane shown at first (uncontrolled).
   * @default "info"
   */
  defaultTab?: NetworkUtilityTab;
  /** Called with the pane whose tab is chosen. */
  onTabChange?: (tab: NetworkUtilityTab) => void;
  /**
   * Called when a tool is run, with the tool, what was entered (the chosen option for
   * Netstat) and the text the pane then shows.
   */
  onRun?: (tool: NetworkUtilityTool, input: string, output: string) => void;
  /**
   * What runs a tool: given the tool, what was entered, the chosen option (for Netstat, or the
   * tool's pop-up button in `choices`) and a `context`, it returns the text the pane shows, or a
   * promise of it. While a promise is pending the pane shows that the tool has started and its
   * button says Stop, which aborts `context.signal` and leaves what was printed so far;
   * `context.progress` replaces the pane's text as the run goes on. A rejected promise is shown as
   * the tool's failure.
   * @default runTool (the demo's made-up output; nothing is sent anywhere)
   */
  run?: (
    tool: NetworkUtilityTool,
    input: string,
    option: string,
    context: NetworkUtilityRunContext,
  ) => string | Promise<string>;
  /**
   * The text a tool's pane shows before the tool is first run, by tool.
   * @default nothing
   */
  idleOutputs?: Partial<Record<NetworkUtilityTool, string>>;
  /**
   * Pop-up buttons on a tool's prompt line, by tool, whose choices reach `run` as its option,
   * joined by a space.
   * @default none
   */
  choices?: Partial<Record<NetworkUtilityTool, readonly NetworkUtilityChoice[]>>;
  /**
   * What the Info pane says above its pop-up button.
   * @default "Select a network interface for information."
   */
  infoPrompt?: string;
  /**
   * What each tool's pane held when the window was last used: what was entered and what it
   * printed. It takes effect until the person changes the pane.
   * @default none
   */
  restored?: Partial<Record<NetworkUtilityTool, NetworkUtilityToolState>>;
  /**
   * Something a menu command could not do, shown beside a tool's field in place of its example.
   * @default none
   */
  notice?: string;
  /** Called when what a tool's pane holds has changed and no run is under way. */
  onToolStateChange?: (tool: NetworkUtilityTool, state: NetworkUtilityToolState) => void;
  /** For the window controls: a window manager's close command. */
  onClose?: WindowControlsProps["onClose"];
  /** For the window controls: a window manager's minimize command. */
  onMinimize?: WindowControlsProps["onMinimize"];
  /** For the window controls: a window manager's zoom command. */
  onZoom?: WindowControlsProps["onZoom"];
  /** For the window controls: what the green button does now. */
  zoomRole?: WindowControlsProps["zoomRole"];
  /** For the window controls: disables minimize, as in full screen. */
  minimizeDisabled?: boolean;
  /** For the window controls: disables zoom. */
  zoomDisabled?: boolean;
  /** For the title bar: a window manager starts moving the window here. */
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  /** For the title bar: a window manager zooms the window here. */
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

/*
 * The library's hooks, set for this window. The tab view's panes have no padding of their
 * own; a box's rows start 10.5 pt under its top edge; the rows are 24 pt apart with the value
 * 10 pt after its key; and the output's text view shows the well's own fill.
 */
const TABS_STYLE = { "--mac-tab-view-panel-padding": "0" } as CSSProperties;
const BOX_STYLE = { "--mac-box-padding": "10.5px 8px 0 0" } as CSSProperties;
const VALUES_STYLE = {
  "--mac-form-row-gap": "8px",
  "--mac-form-label-gap": "8.5px",
} as CSSProperties;
const OUTPUT_STYLE = { "--mac-text-view-background": "transparent" } as CSSProperties;

/** The Info pane: the interface chosen in the pop-up button, as two boxes of keys and values. */
function InfoPane({
  interfaces,
  defaultInterface,
  prompt = "Select a network interface for information.",
}: {
  interfaces: readonly NetworkUtilityInterface[];
  defaultInterface?: string;
  prompt?: string;
}) {
  const [chosen, setChosen] = useState(defaultInterface ?? interfaces[0]?.id ?? null);
  const shown = interfaces.find((candidate) => candidate.id === chosen) ?? interfaces[0];
  return (
    <div className="mac-network-utility-pane mac-network-utility-info">
      <Label className="mac-network-utility-prompt">{prompt}</Label>
      <PopUpButton
        aria-label="Network interface"
        className="mac-network-utility-interface"
        value={shown?.id ?? null}
        onValueChange={(value) => setChosen(value)}
      >
        {interfaces.map((candidate) => (
          <PopUpButtonItem key={candidate.id} value={candidate.id}>
            {candidate.title}
          </PopUpButtonItem>
        ))}
      </PopUpButton>
      <Box title="Interface Information" className="mac-network-utility-box" style={BOX_STYLE}>
        {shown ? (
          <Form render={<div />} labelWidth={130.5} style={VALUES_STYLE}>
            <FormRow kind="value" label="Hardware Address:">
              {shown.hardwareAddress}
            </FormRow>
            <FormRow kind="value" label="IP Address:">
              {shown.ipAddress}
            </FormRow>
            <FormRow kind="value" label="Link Speed:">
              {shown.linkSpeed}
            </FormRow>
            <FormRow kind="value" label="Link Status:">
              {shown.linkStatus}
            </FormRow>
            <FormRow kind="value" label="Vendor:">
              {shown.vendor}
            </FormRow>
            <FormRow kind="value" label="Model:">
              {shown.model}
            </FormRow>
          </Form>
        ) : null}
      </Box>
      <Box title="Transfer Statistics" className="mac-network-utility-box" style={BOX_STYLE}>
        {shown ? (
          <Form render={<div />} labelWidth={100} style={VALUES_STYLE}>
            <FormRow kind="value" label="Sent Packets:">
              {formatCount(shown.sentPackets)}
            </FormRow>
            <FormRow kind="value" label="Send Errors:">
              {formatCount(shown.sendErrors)}
            </FormRow>
            <FormRow kind="value" label="Recv Packets:">
              {formatCount(shown.recvPackets)}
            </FormRow>
            <FormRow kind="value" label="Recv Errors:">
              {formatCount(shown.recvErrors)}
            </FormRow>
            <FormRow kind="value" label="Collisions:">
              {formatCount(shown.collisions)}
            </FormRow>
          </Form>
        ) : null}
      </Box>
    </div>
  );
}

/**
 * The pane of a tool: a prompt, the address field or the choices, the button that runs the
 * tool, and what it printed. Return in the field runs the tool too.
 */
function ToolPane({
  tool,
  onRun,
  run = runTool,
  idle = "",
  choices = [],
  restored,
  notice,
  onStateChange,
}: {
  tool: NetworkUtilityTool;
  onRun?: NetworkUtilityProps["onRun"];
  run?: NetworkUtilityProps["run"];
  idle?: string;
  choices?: readonly NetworkUtilityChoice[];
  restored?: NetworkUtilityToolState;
  notice?: string;
  onStateChange?: NetworkUtilityProps["onToolStateChange"];
}) {
  const definition = TOOLS[tool];
  const [input, setInput] = useState("");
  const [option, setOption] = useState(definition.options?.[0]?.id ?? "");
  const [chosen, setChosen] = useState(() => choices.map((each) => each.options[0]?.id ?? ""));
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  // Counts the runs, so that only the newest run's result is shown.
  const runs = useRef(0);
  const controller = useRef<AbortController | null>(null);
  // Whether the person has changed this pane: what was kept no longer replaces it.
  const touched = useRef(false);
  const report = useRef(onStateChange);
  report.current = onStateChange;
  const ready = !running && (definition.field === undefined || input.trim() !== "");
  const title = TABS.find((tab) => tab.id === tool)?.title ?? "";
  useEffect(() => {
    if (!restored || touched.current) return;
    setInput(restored.input);
    if (restored.output) setOutput(restored.output);
  }, [restored]);
  useEffect(() => {
    if (touched.current && !running) report.current?.(tool, { input, output: output ?? "" });
  }, [tool, input, output, running]);
  const finish = (count: number, entered: string, text: string) => {
    if (count !== runs.current) return;
    setRunning(false);
    setOutput(text);
    onRun?.(tool, entered, text);
  };
  const stop = () => {
    runs.current += 1;
    controller.current?.abort();
    setRunning(false);
    setOutput((text) => `${text ?? ""}\n\n${title} was stopped.`);
  };
  return (
    <ContextualMenu>
      <ContextualMenuTrigger className="mac-network-utility-pane-menu">
        <Form
          className="mac-network-utility-pane mac-network-utility-tool"
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            touched.current = true;
            const entered = definition.field === undefined ? option : input.trim();
            runs.current += 1;
            const count = runs.current;
            controller.current = new AbortController();
            const result = run(tool, input, choices.length > 0 ? chosen.join(" ") : option, {
              signal: controller.current.signal,
              progress: (text) => {
                if (count === runs.current) setOutput(text);
              },
            });
            if (typeof result === "string") {
              finish(count, entered, result);
              return;
            }
            setRunning(true);
            setOutput(`${title} has started…`);
            result.then(
              (text) => finish(count, entered, text),
              (error: unknown) =>
                finish(
                  count,
                  entered,
                  `${title} failed: ${error instanceof Error ? error.message : String(error)}`,
                ),
            );
          }}
        >
          {choices.length > 0 ? (
            <div className="mac-network-utility-prompt-row">
              <Label className="mac-network-utility-prompt">{definition.prompt}</Label>
              {choices.map((choice, at) => (
                <Fragment key={choice.label}>
                  <Label color="secondary">{choice.label}</Label>
                  <PopUpButton
                    aria-label={choice.label}
                    value={chosen[at]}
                    onValueChange={(value) => {
                      if (value) {
                        setChosen((all) => all.map((each, place) => (place === at ? value : each)));
                      }
                    }}
                  >
                    {choice.options.map((each) => (
                      <PopUpButtonItem key={each.id} value={each.id}>
                        {each.title}
                      </PopUpButtonItem>
                    ))}
                  </PopUpButton>
                </Fragment>
              ))}
            </div>
          ) : (
            <Label className="mac-network-utility-prompt">{definition.prompt}</Label>
          )}
          <div className="mac-network-utility-entry">
            {definition.options ? (
              <RadioGroup
                aria-label={definition.prompt}
                value={option}
                onValueChange={(value) => setOption(String(value))}
                className="mac-network-utility-options"
              >
                {definition.options.map((each) => (
                  <RadioButton key={each.id} value={each.id}>
                    {each.title}
                  </RadioButton>
                ))}
              </RadioGroup>
            ) : (
              <>
                <TextField
                  aria-label={definition.field}
                  value={input}
                  onChange={(event) => {
                    touched.current = true;
                    setInput(event.currentTarget.value);
                  }}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  style={{ width: 232 }}
                />
                <Label color="secondary">{notice || definition.example}</Label>
              </>
            )}
            {running ? (
              <PushButton
                key="stop"
                type="button"
                className="mac-network-utility-run"
                onClick={stop}
              >
                Stop
              </PushButton>
            ) : (
              <PushButton
                key="run"
                type="submit"
                disabled={!ready}
                className="mac-network-utility-run"
              >
                {definition.action}
              </PushButton>
            )}
          </div>
          <Box variant="content" className="mac-network-utility-output" style={OUTPUT_STYLE}>
            <TextView aria-label={`${title} output`} readOnly monospace value={output ?? idle} />
          </Box>
        </Form>
      </ContextualMenuTrigger>
      <ContextualMenuPopup aria-label={`${title} text commands`}>
        <EditRows nothing="Select some text first." say={setOutput} />
      </ContextualMenuPopup>
    </ContextualMenu>
  );
}

/**
 * The Network Utility window of macOS 10.15: a plain title bar over a tab view of eight panes
 * whose tabs straddle the top edge of a box that runs from one window edge to the other. Info
 * shows a network interface in two titled boxes; the other seven panes run a tool. By default
 * nothing touches the network: the interfaces are data, and what a tool prints is made up from
 * what was entered; a host gives `run` and `interfaces` to show real results instead.
 *
 * The root is the library's `Window`, which takes every prop that is not listed here, so a
 * window manager places and activates it; the window controls' and the title bar's callbacks
 * are handed to those parts. The layout is fixed, as in the application: the window is not
 * meant to be resized.
 */
export function NetworkUtility({
  interfaces = defaultInterfaces,
  defaultInterface,
  tab: tabProp,
  defaultTab = "info",
  onTabChange,
  onRun,
  run,
  idleOutputs,
  choices,
  infoPrompt,
  restored,
  notice,
  onToolStateChange,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  width = 644,
  height = 385,
  ...windowProps
}: NetworkUtilityProps) {
  const [ownTab, setOwnTab] = useState(defaultTab);
  const tab = tabProp ?? ownTab;
  return (
    <Window width={width} height={height} {...windowProps}>
      <TitleBar
        title="Network Utility"
        controls={
          <WindowControls
            onClose={onClose}
            onMinimize={onMinimize}
            onZoom={onZoom}
            zoomRole={zoomRole}
            minimizeDisabled={minimizeDisabled}
            zoomDisabled={zoomDisabled}
          />
        }
        onDragRegionPointerDown={onDragRegionPointerDown}
        onDragRegionDoubleClick={onDragRegionDoubleClick}
      />
      <WindowBody className="mac-network-utility-body">
        <TabView
          className="mac-network-utility-tabs"
          style={TABS_STYLE}
          value={tab}
          onValueChange={(value) => {
            const chosen = TABS.find((candidate) => candidate.id === value);
            if (!chosen) return;
            setOwnTab(chosen.id);
            onTabChange?.(chosen.id);
          }}
        >
          <TabViewList aria-label="Network Utility">
            {TABS.map((item) => (
              <TabViewTab key={item.id} value={item.id} style={{ width: item.width, padding: 0 }}>
                {item.title}
              </TabViewTab>
            ))}
          </TabViewList>
          {/* Every pane stays mounted, so a tool keeps what was entered and what it printed
              while another tab is shown. */}
          <TabViewPanel value="info" keepMounted>
            <InfoPane
              interfaces={interfaces}
              defaultInterface={defaultInterface}
              prompt={infoPrompt}
            />
          </TabViewPanel>
          {TABS.filter((item) => item.id !== "info").map((item) => (
            <TabViewPanel key={item.id} value={item.id} keepMounted>
              <ToolPane
                tool={item.id as NetworkUtilityTool}
                onRun={onRun}
                run={run}
                idle={idleOutputs?.[item.id as NetworkUtilityTool]}
                choices={choices?.[item.id as NetworkUtilityTool]}
                restored={restored?.[item.id as NetworkUtilityTool]}
                notice={notice}
                onStateChange={onToolStateChange}
              />
            </TabViewPanel>
          ))}
        </TabView>
      </WindowBody>
    </Window>
  );
}
