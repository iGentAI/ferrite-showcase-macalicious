"use client";

import { useEffect, useRef } from "react";

/** The drawings View > Visualizer offers. */
export const VISUALIZER_DRAWINGS = [
  { id: "music", title: "Music Visualizer" },
  { id: "classic", title: "Classic Visualizer" },
] as const;

export type VisualizerDrawing = (typeof VISUALIZER_DRAWINGS)[number]["id"];

export const readVisualizerDrawing = (stored: unknown): VisualizerDrawing | undefined =>
  VISUALIZER_DRAWINGS.find(({ id }) => id === stored)?.id;

/**
 * View > Visualizer: an original drawing of the sound playing, read from the Web Audio analyser
 * each frame: a ring of bars around a soft glow, or a row of bars standing on the window's floor.
 * Neither is Apple's. Without motion allowed it draws one still frame a second.
 */
export function MusicVisualizer({
  analyser,
  title,
  drawing,
}: {
  analyser: AnalyserNode;
  title: string;
  drawing: VisualizerDrawing;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return undefined;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let frame = 0;
    let last = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (still && now - last < 1000) return;
      last = now;
      const { clientWidth: width, clientHeight: height } = element;
      if (element.width !== width || element.height !== height) {
        element.width = width;
        element.height = height;
      }
      analyser.getByteFrequencyData(data);
      const level = data.reduce((sum, value) => sum + value, 0) / (data.length * 255);
      context.fillStyle = "#07080d";
      context.fillRect(0, 0, width, height);
      if (drawing === "classic") {
        const columns = 48;
        const across = width / columns;
        for (let column = 0; column < columns; column += 1) {
          const value = (data[Math.floor((column / columns) * data.length * 0.7)] ?? 0) / 255;
          const tall = 4 + value * height * 0.85;
          context.fillStyle = `hsl(${(120 - value * 120 + 360) % 360}, 80%, 50%)`;
          context.fillRect(column * across + 1, height - tall, across - 2, tall);
        }
        return;
      }
      const radius = Math.min(width, height) * (0.18 + level * 0.12);
      const glow = context.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        radius * 2.4,
      );
      const hue = (now / 80) % 360;
      glow.addColorStop(0, `hsla(${hue}, 80%, 60%, ${0.25 + level})`);
      glow.addColorStop(1, "hsla(0, 0%, 0%, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);
      const bars = 96;
      context.lineWidth = 3;
      context.lineCap = "round";
      for (let bar = 0; bar < bars; bar += 1) {
        const value = (data[Math.floor((bar / bars) * data.length * 0.7)] ?? 0) / 255;
        const angle = (bar / bars) * Math.PI * 2 + now / 6000;
        const length = 4 + value * radius * 1.4;
        context.strokeStyle = `hsl(${(hue + bar * 2) % 360}, 85%, ${45 + value * 30}%)`;
        context.beginPath();
        context.moveTo(width / 2 + Math.cos(angle) * radius, height / 2 + Math.sin(angle) * radius);
        context.lineTo(
          width / 2 + Math.cos(angle) * (radius + length),
          height / 2 + Math.sin(angle) * (radius + length),
        );
        context.stroke();
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analyser, drawing]);
  return (
    <div className="mac-music-visualizer">
      <canvas ref={canvas} aria-label={`Visualizer: ${title}`} role="img" />
    </div>
  );
}
