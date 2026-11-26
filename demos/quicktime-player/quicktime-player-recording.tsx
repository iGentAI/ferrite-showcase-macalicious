"use client";

import { HudWindow, HudWindowButton, HudWindowText } from "macalicious/hud-window";
import { LevelIndicator } from "macalicious/level-indicator";
import { Menu, MenuPopup, MenuTrigger } from "macalicious/menu";
import {
  MenuCheckboxItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSection,
  MenuSeparator,
} from "macalicious/menu-item";
import { ProgressBar } from "macalicious/progress-bar";
import { SystemImage } from "macalicious/system-image";
import { TitleBar, type TitleBarProps } from "macalicious/title-bar";
import { Window, type WindowProps } from "macalicious/window";
import { WindowControls, type WindowControlsProps } from "macalicious/window-controls";
import { useEffect, useRef, useState } from "react";
import { levelOf } from "../voice-memos/voice-memos-audio";
import { croppedTrack, QuickTimeScreenArea, type ScreenArea } from "./quicktime-player-area";
import {
  plainType,
  QUALITY_BITS,
  RECORDING_TITLES,
  type RecordingKind,
  type RecordingQuality,
  recordingName,
  recordingProblem,
  recordingType,
  timeText,
} from "./quicktime-player-recording-files";

/** How often the clock and the level meter are read, in milliseconds. */
const TICK_MS = 100;
/** What Show Mouse Clicks can show. */
const CLICKS_NOTE = "A web page sees only clicks made in it, so only those show in the recording.";
/** How long a click's ring stays on the page, in milliseconds. */
const CLICK_RING_MS = 400;

/** While a take runs, a ring around each press on this page, which the recording then shows. */
function useClickRings(on: boolean) {
  useEffect(() => {
    if (!on) return;
    const rings = new Set<HTMLElement>();
    const press = ({ clientX, clientY }: PointerEvent) => {
      const ring = document.createElement("div");
      ring.className = "mac-quicktime-player-click-ring";
      ring.style.left = `${clientX}px`;
      ring.style.top = `${clientY}px`;
      document.body.append(ring);
      rings.add(ring);
      setTimeout(() => {
        ring.remove();
        rings.delete(ring);
      }, CLICK_RING_MS);
    };
    window.addEventListener("pointerdown", press, true);
    return () => {
      window.removeEventListener("pointerdown", press, true);
      for (const ring of rings) ring.remove();
    };
  }, [on]);
}

export interface QuickTimeRecordingProps extends Omit<WindowProps, "children" | "title"> {
  kind: RecordingKind;
  /** What the app is doing with the finished take: saving it, then opening it. */
  busy: { label: string; fraction: number } | null;
  /** Keep a finished take; it may answer after this window has gone. */
  onFinished: (file: File) => Promise<void>;
  /** Whether a take is under way. */
  onTakingChange: (taking: boolean) => void;
  onClose?: WindowControlsProps["onClose"];
  onMinimize?: WindowControlsProps["onMinimize"];
  onZoom?: WindowControlsProps["onZoom"];
  zoomRole?: WindowControlsProps["zoomRole"];
  minimizeDisabled?: boolean;
  zoomDisabled?: boolean;
  onDragRegionPointerDown?: TitleBarProps["onDragRegionPointerDown"];
  onDragRegionDoubleClick?: TitleBarProps["onDragRegionDoubleClick"];
}

const stopTracks = (stream: MediaStream | null) => {
  for (const track of stream?.getTracks() ?? []) track.stop();
};

/**
 * The window of File > New Movie Recording, New Audio Recording and New Screen Recording: the
 * camera's picture, the microphone's level, the red button, and the Options menu (camera,
 * microphone, quality). A take ends with its window too: leaving while recording still hands the
 * take to `onFinished`, because a recording is never thrown away by closing a window.
 */
export function QuickTimeRecording({
  kind,
  busy,
  onFinished,
  onTakingChange,
  onClose,
  onMinimize,
  onZoom,
  zoomRole,
  minimizeDisabled,
  zoomDisabled,
  onDragRegionPointerDown,
  onDragRegionDoubleClick,
  onKeyDown,
  ...windowProps
}: QuickTimeRecordingProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [camera, setCamera] = useState("");
  // A screen is recorded in silence until the person chooses a microphone, as on a Mac.
  const [microphone, setMicrophone] = useState(kind === "screen" ? "none" : "");
  const [quality, setQuality] = useState<RecordingQuality>("high");
  // Options > Timer: the seconds a screen recording waits, and those left while it does.
  const [timer, setTimer] = useState("0");
  const [showClicks, setShowClicks] = useState(false);
  // Options > Record: the whole of what the picker chose, or a part dragged over it.
  const [area, setArea] = useState<"entire" | "selected">("entire");
  const [choosingArea, setChoosingArea] = useState<{
    stream: MediaStream;
    answer: (area: ScreenArea | null) => void;
  } | null>(null);
  const stopCropping = useRef<(() => void) | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const cancelCountdown = useRef<(() => void) | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [taking, setTaking] = useState(false);
  useClickRings(taking && showClicks && kind === "screen");
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [saving, setSaving] = useState(false);
  const [acquiring, setAcquiring] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  // Set when the window goes: an answer the browser gives later starts nothing.
  const left = useRef(false);
  // Set at once by a press: the picker can stay open for as long as the person likes.
  const pending = useRef(false);
  const finished = useRef(onFinished);
  finished.current = onFinished;
  const takingChanged = useRef(onTakingChange);
  takingChanged.current = onTakingChange;
  const canRecord =
    typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  // Declared before the stream's effect: the take is ended before its tracks are.
  useEffect(() => {
    left.current = false;
    return () => {
      left.current = true;
      cancelCountdown.current?.();
      if (recorder.current?.state === "recording") recorder.current.stop();
    };
  }, []);

  useEffect(() => {
    if (kind === "screen" || !canRecord) return;
    let left = false;
    let held: MediaStream | null = null;
    const audio = microphone ? { deviceId: { exact: microphone } } : true;
    const video = kind === "movie" ? (camera ? { deviceId: { exact: camera } } : true) : false;
    const media = navigator.mediaDevices;
    media
      .getUserMedia({ audio, video })
      .catch((error: unknown) => {
        // A camera with no microphone still makes a silent movie.
        if (kind === "movie" && error instanceof DOMException && error.name === "NotFoundError") {
          return media.getUserMedia({ video });
        }
        throw error;
      })
      .then(async (got) => {
        if (left) {
          stopTracks(got);
          return;
        }
        held = got;
        setProblem(null);
        setStream(got);
        // A browser names its devices only once one has been allowed.
        const listed = await media.enumerateDevices();
        if (!left) setDevices(listed);
      })
      .catch((error: unknown) => {
        if (!left) setProblem(recordingProblem(kind, error));
      });
    return () => {
      left = true;
      stopTracks(held);
      setStream(null);
    };
  }, [kind, camera, microphone, canRecord]);

  useEffect(() => {
    if (kind === "screen" && canRecord) {
      navigator.mediaDevices
        .enumerateDevices()
        .then(setDevices)
        .catch(() => {});
    }
  }, [kind, canRecord]);

  useEffect(() => {
    if (preview.current) preview.current.srcObject = stream;
  }, [stream]);

  // The microphone's level, for as long as there is a microphone. A browser with no sound device
  // never starts the context, and the meter then stays empty.
  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setLevel(0);
      return;
    }
    const context = new AudioContext();
    context.resume().catch(() => {});
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const bytes = new Uint8Array(analyser.fftSize);
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(bytes);
      setLevel(levelOf(bytes));
    }, TICK_MS);
    return () => {
      clearInterval(timer);
      source.disconnect();
      context.close().catch(() => {});
    };
  }, [stream]);

  useEffect(() => {
    if (!taking) return;
    const began = performance.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed((performance.now() - began) / 1000), TICK_MS);
    return () => clearInterval(timer);
  }, [taking]);

  const save = async (file: File) => {
    setProblem(null);
    setSaving(true);
    try {
      await finished.current(file);
    } finally {
      setSaving(false);
    }
  };

  const begin = (source: MediaStream) => {
    const type = recordingType(kind, (each) => MediaRecorder.isTypeSupported(each));
    const take = new MediaRecorder(source, {
      ...(type ? { mimeType: type } : {}),
      ...(kind === "audio" ? {} : { videoBitsPerSecond: QUALITY_BITS[quality] }),
    });
    const chunks: Blob[] = [];
    take.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    // The one end of every take: Stop, the window going away, or the input ending by itself.
    take.addEventListener(
      "stop",
      () => {
        recorder.current = null;
        setTaking(false);
        takingChanged.current(false);
        if (kind === "screen") {
          stopTracks(source);
          stopCropping.current?.();
          setStream(null);
        }
        if (chunks.length === 0) {
          setProblem("Nothing was recorded.");
          return;
        }
        const recorded = take.mimeType || type || "";
        void save(
          new File(chunks, recordingName(kind, recorded, new Date()), {
            type: plainType(recorded),
          }),
        );
      },
      { once: true },
    );
    // Without a timeslice: Firefox plays a WebM recorded in slices only to its first slice.
    take.start();
    recorder.current = take;
    setProblem(null);
    setTaking(true);
    takingChanged.current(true);
  };

  /** Counts `seconds` down on the window; whether they ran out, rather than the press being taken back. */
  const waitedOut = (seconds: number) =>
    new Promise<boolean>((answer) => {
      if (seconds <= 0) {
        answer(true);
        return;
      }
      let remaining = seconds;
      setCountdown(remaining);
      const ticking = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) setCountdown(remaining);
        else finish(true);
      }, 1000);
      const finish = (ran: boolean) => {
        clearInterval(ticking);
        cancelCountdown.current = null;
        setCountdown(null);
        answer(ran);
      };
      cancelCountdown.current = () => finish(false);
    });

  const beginScreen = async () => {
    if (pending.current) return;
    pending.current = true;
    setAcquiring(true);
    const media = navigator.mediaDevices;
    const held: MediaStream[] = [];
    const release = () => {
      for (const each of held) stopTracks(each);
    };
    try {
      const display = await media.getDisplayMedia({ video: true });
      held.push(display);
      if (left.current) {
        release();
        return;
      }
      const voice =
        microphone === "none"
          ? null
          : await media.getUserMedia({
              audio: microphone ? { deviceId: { exact: microphone } } : true,
            });
      if (voice) held.push(voice);
      if (left.current) {
        release();
        return;
      }
      let picture = display.getVideoTracks();
      if (area === "selected") {
        const chosen = await new Promise<ScreenArea | null>((answer) => {
          setChoosingArea({ stream: display, answer });
          display.getVideoTracks()[0]?.addEventListener("ended", () => answer(null));
        });
        setChoosingArea(null);
        if (!chosen || left.current) {
          release();
          return;
        }
        const part = await croppedTrack(display, chosen);
        stopCropping.current = () => {
          part.stop();
          part.track.stop();
          stopTracks(display);
          stopCropping.current = null;
        };
        picture = [part.track];
      }
      const source = new MediaStream([...picture, ...(voice?.getAudioTracks() ?? [])]);
      // The browser's own "Stop sharing" ends the picture but not a microphone.
      let ended = false;
      display.getVideoTracks()[0]?.addEventListener("ended", () => {
        ended = true;
        cancelCountdown.current?.();
        if (recorder.current?.state === "recording") recorder.current.stop();
      });
      if (!(await waitedOut(Number(timer))) || ended || left.current) {
        stopCropping.current?.();
        release();
        return;
      }
      begin(source);
      setStream(source);
    } catch (error) {
      release();
      if (!left.current) setProblem(recordingProblem(kind, error));
    } finally {
      pending.current = false;
      if (!left.current) setAcquiring(false);
    }
  };

  const press = () => {
    if (cancelCountdown.current) {
      cancelCountdown.current();
      return;
    }
    if (recorder.current?.state === "recording") {
      recorder.current.stop();
      return;
    }
    try {
      if (kind === "screen") void beginScreen();
      else if (stream) begin(stream);
    } catch (error) {
      setProblem(recordingProblem(kind, error));
    }
  };

  const holding = saving || (acquiring && countdown === null);
  const ready = canRecord && !holding && (kind === "screen" || stream !== null);
  const cameras = devices.filter((device) => device.kind === "videoinput" && device.label);
  const microphones = devices.filter((device) => device.kind === "audioinput" && device.label);
  const activeDevice = (tracks: MediaStreamTrack[] | undefined) =>
    tracks?.[0]?.getSettings().deviceId ?? "";
  const status =
    problem ?? (canRecord ? null : "This browser cannot record. It has no MediaRecorder.");

  return (
    <Window
      aria-label={RECORDING_TITLES[kind]}
      className="mac-quicktime-player-recording"
      data-kind={kind}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.key !== " ") return;
        if (event.target instanceof HTMLButtonElement) return;
        if (!ready) return;
        event.preventDefault();
        press();
      }}
      {...windowProps}
    >
      <TitleBar
        title={RECORDING_TITLES[kind]}
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
      <div className="mac-quicktime-player-recording-picture">
        {kind === "movie" ? (
          <video
            ref={preview}
            className="mac-quicktime-player-recording-preview"
            aria-label="Camera preview"
            autoPlay
            muted
            playsInline
          />
        ) : null}
        {choosingArea ? (
          <QuickTimeScreenArea
            stream={choosingArea.stream}
            onChoose={choosingArea.answer}
            onCancel={() => choosingArea.answer(null)}
          />
        ) : null}
        <HudWindow aria-label="Recording controls" className="mac-quicktime-player-recording-hud">
          {status ? (
            <HudWindowText role="status" className="mac-quicktime-player-recording-status">
              {status}
            </HudWindowText>
          ) : null}
          {busy ? (
            <div className="mac-quicktime-player-recording-status" role="status">
              <HudWindowText>{busy.label}</HudWindowText>
              <ProgressBar value={busy.fraction} max={1} aria-label={busy.label} />
            </div>
          ) : null}
          <div className="mac-quicktime-player-recording-controls">
            <div className="mac-quicktime-player-recording-readout">
              <HudWindowText
                aria-label={countdown === null ? "Time recorded" : "Recording starts in"}
              >
                {countdown === null ? timeText(elapsed) : countdown}
              </HudWindowText>
              <LevelIndicator
                aria-label="Microphone level"
                className="mac-quicktime-player-recording-meter"
                variant="relevancy"
                value={Math.round(level * 100)}
              />
            </div>
            <HudWindowButton
              aria-label={
                taking
                  ? "Stop Recording"
                  : countdown === null
                    ? "Start Recording"
                    : "Cancel Countdown"
              }
              className="mac-quicktime-player-record"
              data-taking={taking || undefined}
              disabled={!taking && !ready && countdown === null}
              onClick={press}
            >
              <span className="mac-quicktime-player-record-mark" />
            </HudWindowButton>
            <div className="mac-quicktime-player-recording-options">
              <Menu>
                <MenuTrigger
                  disabled={taking || holding || countdown !== null}
                  render={
                    <HudWindowButton aria-label="Recording Options">
                      <SystemImage name="chevron-down" />
                    </HudWindowButton>
                  }
                />
                <MenuPopup sideOffset={6}>
                  {kind === "movie" ? (
                    <MenuSection title="Camera">
                      <MenuRadioGroup
                        value={camera || activeDevice(stream?.getVideoTracks())}
                        onValueChange={(value: string) => setCamera(value)}
                      >
                        {cameras.map((device) => (
                          <MenuRadioItem key={device.deviceId} value={device.deviceId}>
                            {device.label}
                          </MenuRadioItem>
                        ))}
                      </MenuRadioGroup>
                    </MenuSection>
                  ) : null}
                  <MenuSection title="Microphone">
                    <MenuRadioGroup
                      value={
                        microphone === ""
                          ? activeDevice(stream?.getAudioTracks()) || "default"
                          : microphone
                      }
                      onValueChange={(value: string) =>
                        setMicrophone(value === "default" ? "" : value)
                      }
                    >
                      {kind === "screen" ? (
                        <>
                          <MenuRadioItem value="none">None</MenuRadioItem>
                          {microphones.length === 0 ? (
                            <MenuRadioItem value="default">Microphone</MenuRadioItem>
                          ) : null}
                        </>
                      ) : null}
                      {microphones.map((device) => (
                        <MenuRadioItem key={device.deviceId} value={device.deviceId}>
                          {device.label}
                        </MenuRadioItem>
                      ))}
                    </MenuRadioGroup>
                  </MenuSection>
                  {kind === "audio" ? null : (
                    <>
                      <MenuSeparator />
                      <MenuSection title="Quality">
                        <MenuRadioGroup
                          value={quality}
                          onValueChange={(value: RecordingQuality) => setQuality(value)}
                        >
                          <MenuRadioItem value="high">High</MenuRadioItem>
                          <MenuRadioItem value="maximum">Maximum</MenuRadioItem>
                        </MenuRadioGroup>
                      </MenuSection>
                    </>
                  )}
                  {kind === "screen" ? (
                    <>
                      <MenuSeparator />
                      <MenuSection title="Record">
                        <MenuRadioGroup
                          value={area}
                          onValueChange={(value: "entire" | "selected") => setArea(value)}
                        >
                          <MenuRadioItem value="entire">What the Browser Shares</MenuRadioItem>
                          <MenuRadioItem value="selected">Selected Portion</MenuRadioItem>
                        </MenuRadioGroup>
                      </MenuSection>
                      <MenuSeparator />
                      <MenuSection title="Timer">
                        <MenuRadioGroup
                          value={timer}
                          onValueChange={(value: string) => setTimer(value)}
                        >
                          <MenuRadioItem value="0">None</MenuRadioItem>
                          <MenuRadioItem value="5">5 Seconds</MenuRadioItem>
                          <MenuRadioItem value="10">10 Seconds</MenuRadioItem>
                        </MenuRadioGroup>
                      </MenuSection>
                      <MenuSeparator />
                      <MenuCheckboxItem
                        checked={showClicks}
                        onCheckedChange={(checked) => setShowClicks(checked === true)}
                        title={CLICKS_NOTE}
                      >
                        Show Mouse Clicks
                      </MenuCheckboxItem>
                    </>
                  ) : null}
                </MenuPopup>
              </Menu>
            </div>
          </div>
        </HudWindow>
      </div>
    </Window>
  );
}
