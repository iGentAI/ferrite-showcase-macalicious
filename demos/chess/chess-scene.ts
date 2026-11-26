import type { ChessPieceKind, ChessSide } from "./chess-game";
import { discMesh, FRAME_THICKNESS, frameMesh, type Mesh, pieceMesh } from "./chess-meshes";

/*
 * The camera and the pieces of the 3D board. The squares stay the page's own elements, tilted by a
 * CSS transform; a canvas over them, which takes no pointer events, draws the pieces with the same
 * numbers. So a square is hit, focused and marked as on the flat board, and each piece stands on it.
 * All lengths are CSS pixels in the board's own plane: x right, y towards the near edge, z up,
 * with the origin at the board's middle.
 */

/** How the board is seen, in degrees: `tilt` back from straight above, `spin` clockwise around. */
export interface ChessCamera {
  readonly tilt: number;
  readonly spin: number;
}

/** About the angle of the board in macOS's Chess, measured from its window capture. */
export const DEFAULT_CAMERA: ChessCamera = { tilt: 28, spin: 0 };

export const MAX_TILT = 70;

/** The camera within its limits. */
export const boundCamera = ({ tilt, spin }: ChessCamera): ChessCamera => ({
  tilt: Math.min(MAX_TILT, Math.max(0, tilt)),
  spin: ((spin % 360) + 360) % 360,
});

export const readCamera = (stored: unknown): ChessCamera | undefined => {
  const { tilt, spin } = (stored ?? {}) as { tilt?: unknown; spin?: unknown };
  return typeof tilt === "number" && typeof spin === "number"
    ? boundCamera({ tilt, spin })
    : undefined;
};

/** The eye's distance, in board widths; a fixed ratio keeps the view's shape at any size. */
const DISTANCE = 3.25;
/** The frame's width, as a share of the board's. */
const FRAME = 0.075;
/** How tall the room over the board has to be, as a share of its width: a king and a bit. */
const HEADROOM = 0.17;

export interface BoardLayout {
  readonly width: number;
  readonly height: number;
  readonly side: number;
  readonly square: number;
  readonly distance: number;
  readonly dx: number;
  readonly dy: number;
  readonly tilt: number;
  readonly spin: number;
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Where a point of the board is seen, from the middle of the view, before it is moved to fit. */
function seen(
  camera: { tilt: number; spin: number },
  distance: number,
  x: number,
  y: number,
  z: number,
): readonly [number, number] {
  const turned = y * Math.cos(camera.spin) + x * Math.sin(camera.spin);
  const across = x * Math.cos(camera.spin) - y * Math.sin(camera.spin);
  const near = turned * Math.sin(camera.tilt) + z * Math.cos(camera.tilt);
  const scale = distance / (distance - near);
  return [across * scale, (turned * Math.cos(camera.tilt) - z * Math.sin(camera.tilt)) * scale];
}

/** The largest board the view holds at this camera, with its room for the pieces, centred. */
export function layOutBoard(width: number, height: number, camera: ChessCamera): BoardLayout {
  const view = { tilt: radians(camera.tilt), spin: radians(camera.spin) };
  let [left, right, top, bottom] = [0, 0, 0, 0];
  for (const x of [-0.5, 0.5]) {
    for (const y of [-0.5, 0.5]) {
      for (const z of [-FRAME_THICKNESS, HEADROOM]) {
        const [sx, sy] = seen(view, DISTANCE, x, y, z);
        left = Math.min(left, sx);
        right = Math.max(right, sx);
        top = Math.min(top, sy);
        bottom = Math.max(bottom, sy);
      }
    }
  }
  const side = Math.min(width / (right - left), height / (bottom - top)) * 0.96;
  return {
    width,
    height,
    side,
    square: (side * (1 - 2 * FRAME)) / 8,
    distance: side * DISTANCE,
    dx: (-(left + right) / 2) * side,
    dy: (-(top + bottom) / 2) * side,
    ...view,
  };
}

/** The transform that lays the board's element where the canvas draws the board. */
export const boardTransform = (layout: BoardLayout): string =>
  `translate(${layout.dx}px, ${layout.dy}px) perspective(${layout.distance}px) ` +
  `rotateX(${layout.tilt}rad) rotateZ(${layout.spin}rad)`;

/** Where a point on the board is seen, from the middle of the view. */
export function onStage(layout: BoardLayout, x: number, y: number, z = 0): [number, number] {
  const [sx, sy] = seen(layout, layout.distance, x, y, z);
  return [sx + layout.dx, sy + layout.dy];
}

/** The point on the board seen at a place in the view, measured from the view's middle. */
export function pointOnBoard(layout: BoardLayout, sx: number, sy: number): [number, number] {
  const { distance, tilt, spin } = layout;
  const across = sx - layout.dx;
  const down = sy - layout.dy;
  const turned = (down * distance) / (Math.cos(tilt) * distance + down * Math.sin(tilt));
  const flat = (across * (distance - turned * Math.sin(tilt))) / distance;
  return [
    flat * Math.cos(spin) + turned * Math.sin(spin),
    turned * Math.cos(spin) - flat * Math.sin(spin),
  ];
}

/** One piece to draw, at a point of the board. */
export interface ScenePiece {
  readonly kind: ChessPieceKind;
  readonly side: ChessSide;
  readonly x: number;
  readonly y: number;
  /** Its height over the board. */
  readonly z: number;
  /** Which way the piece's front looks, in radians around z. */
  readonly heading: number;
}

export interface SceneColours {
  readonly white: string;
  readonly black: string;
  readonly frame: string;
}

const VERTEX = `
attribute vec3 a_position;
attribute vec3 a_normal;
uniform vec3 u_at;
uniform float u_scale;
uniform float u_heading;
uniform float u_flip;
uniform vec2 u_tilt;
uniform vec2 u_spin;
uniform vec2 u_view;
uniform vec2 u_move;
uniform mediump float u_distance;
varying vec3 v_normal;
varying vec3 v_eye;
varying vec2 v_local;
vec3 seen(vec3 p) {
  vec2 s = vec2(p.x * u_spin.y - p.y * u_spin.x, p.x * u_spin.x + p.y * u_spin.y);
  return vec3(s.x, s.y * u_tilt.y - p.z * u_tilt.x, s.y * u_tilt.x + p.z * u_tilt.y);
}
vec3 turned(vec3 p) {
  float c = cos(u_heading);
  float s = sin(u_heading);
  return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
}
void main() {
  vec3 board = turned(a_position) * u_scale + u_at;
  board.z *= u_flip;
  vec3 normal = turned(a_normal);
  normal.z *= u_flip;
  vec3 eye = seen(board);
  float w = 1.0 - eye.z / u_distance;
  v_normal = seen(normal);
  v_eye = eye;
  v_local = a_position.xy;
  gl_Position = vec4(
    (eye.x + u_move.x * w) * 2.0 / u_view.x,
    -(eye.y + u_move.y * w) * 2.0 / u_view.y,
    -eye.z / (2.0 * u_distance),
    w
  );
}`;

const FRAGMENT = `
precision mediump float;
uniform vec3 u_colour;
uniform float u_alpha;
uniform float u_shadow;
uniform float u_walls;
uniform float u_distance;
varying vec3 v_normal;
varying vec3 v_eye;
varying vec2 v_local;
void main() {
  if (u_shadow > 0.5) {
    float a = u_alpha * smoothstep(1.0, 0.35, length(v_local));
    gl_FragColor = vec4(0.0, 0.0, 0.0, a);
    return;
  }
  vec3 n = normalize(v_normal);
  vec3 v = normalize(vec3(0.0, 0.0, u_distance) - v_eye);
  // The frame's walls have no top: from inside they would lie over the board.
  if (u_walls > 0.5 && dot(n, v) < 0.0) discard;
  vec3 key = normalize(vec3(-0.45, -0.55, 0.7));
  vec3 fill = normalize(vec3(0.7, 0.1, 0.5));
  float light = 0.3 + 0.62 * max(dot(n, key), 0.0) + 0.16 * max(dot(n, fill), 0.0);
  float shine = pow(max(dot(n, normalize(key + v)), 0.0), 36.0) * 0.4;
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.14;
  vec3 colour = u_colour * light + vec3(shine + rim);
  gl_FragColor = vec4(colour * u_alpha, u_alpha);
}`;

const KINDS: readonly ChessPieceKind[] = ["pawn", "rook", "knight", "bishop", "queen", "king"];

/** Any CSS colour, as the browser reads it: a stylesheet's build may have shortened a token. */
const rgb = (colour: string): [number, number, number] => {
  const reader = new OffscreenCanvas(1, 1).getContext("2d");
  if (!reader) return [0, 0, 0];
  reader.fillStyle = colour.trim();
  const value = Number.parseInt(String(reader.fillStyle).replace("#", ""), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
};

/** A software renderer stalls the page for a second at a draw, so it counts as no 3D here. */
const CONTEXT: WebGLContextAttributes = {
  alpha: true,
  antialias: true,
  failIfMajorPerformanceCaveat: true,
};

/** Whether this browser can draw the 3D board. */
export function canDrawScene(): boolean {
  if (typeof WebGLRenderingContext === "undefined") return false;
  return document.createElement("canvas").getContext("webgl", CONTEXT) !== null;
}

export interface Scene {
  draw: (
    layout: BoardLayout,
    pieces: readonly ScenePiece[],
    colours: SceneColours,
    pixelRatio: number,
  ) => void;
}

/** The drawing on a canvas, or `null` when its browser or graphics hardware cannot give one. */
export function createScene(canvas: HTMLCanvasElement): Scene | null {
  const gl = canvas.getContext("webgl", CONTEXT);
  const program = gl && linkedProgram(gl);
  return gl && program ? sceneOn(canvas, gl, program) : null;
}

function linkedProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram();
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!program || !vertex || !fragment) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

function sceneOn(
  canvas: HTMLCanvasElement,
  gl: WebGLRenderingContext,
  program: WebGLProgram,
): Scene {
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
  gl.useProgram(program);

  const named = (name: string) => gl.getUniformLocation(program, name);
  const position = gl.getAttribLocation(program, "a_position");
  const normal = gl.getAttribLocation(program, "a_normal");
  gl.enableVertexAttribArray(position);
  gl.enableVertexAttribArray(normal);

  const meshes: readonly (readonly [string, Mesh])[] = [
    ...KINDS.map((kind) => [kind, pieceMesh(kind)] as const),
    ["frame", frameMesh()],
    ["disc", discMesh()],
  ];
  const vertices = new Float32Array(meshes.reduce((sum, [, m]) => sum + m.vertices.length, 0));
  const indices = new Uint16Array(meshes.reduce((sum, [, m]) => sum + m.indices.length, 0));
  const ranges = new Map<string, { first: number; count: number }>();
  let vertexAt = 0;
  let indexAt = 0;
  for (const [name, each] of meshes) {
    vertices.set(each.vertices, vertexAt);
    indices.set(
      each.indices.map((index) => index + vertexAt / 6),
      indexAt,
    );
    ranges.set(name, { first: indexAt, count: each.indices.length });
    vertexAt += each.vertices.length;
    indexAt += each.indices.length;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0);
  gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 24, 12);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.depthFunc(gl.LESS);

  const uniforms = {
    at: named("u_at"),
    scale: named("u_scale"),
    heading: named("u_heading"),
    flip: named("u_flip"),
    tilt: named("u_tilt"),
    spin: named("u_spin"),
    view: named("u_view"),
    move: named("u_move"),
    distance: named("u_distance"),
    colour: named("u_colour"),
    alpha: named("u_alpha"),
    shadow: named("u_shadow"),
    walls: named("u_walls"),
  };
  const mesh = (name: string) => {
    const range = ranges.get(name);
    if (range) gl.drawElements(gl.TRIANGLES, range.count, gl.UNSIGNED_SHORT, range.first * 2);
  };

  return {
    draw(layout, shown, colours, pixelRatio) {
      const width = Math.round(layout.width * pixelRatio);
      const height = Math.round(layout.height * pixelRatio);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform2f(uniforms.tilt, Math.sin(layout.tilt), Math.cos(layout.tilt));
      gl.uniform2f(uniforms.spin, Math.sin(layout.spin), Math.cos(layout.spin));
      gl.uniform2f(uniforms.view, layout.width, layout.height);
      gl.uniform2f(uniforms.move, layout.dx, layout.dy);
      gl.uniform1f(uniforms.distance, layout.distance);
      const white = rgb(colours.white);
      const black = rgb(colours.black);
      const piece = (each: ScenePiece) => {
        gl.uniform3f(uniforms.at, each.x, each.y, each.z);
        gl.uniform1f(uniforms.heading, each.heading);
        gl.uniform3fv(uniforms.colour, each.side === "white" ? white : black);
        mesh(each.kind);
      };
      gl.uniform1f(uniforms.scale, layout.square);

      // First what lies on the board, with no depth: each reflection and shadow is seen through.
      gl.uniform1f(uniforms.shadow, 0);
      gl.uniform1f(uniforms.flip, -1);
      gl.uniform1f(uniforms.alpha, 0.2);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      shown.forEach(piece);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.DEPTH_TEST);
      gl.uniform1f(uniforms.flip, 1);
      gl.uniform1f(uniforms.shadow, 1);
      gl.uniform1f(uniforms.alpha, 0.42);
      gl.uniform1f(uniforms.heading, 0);
      gl.uniform1f(uniforms.scale, layout.square * 0.5);
      for (const each of shown) {
        gl.uniform3f(uniforms.at, each.x, each.y, 0);
        mesh("disc");
      }

      // Then the solid things.
      gl.enable(gl.DEPTH_TEST);
      gl.uniform1f(uniforms.shadow, 0);
      gl.uniform1f(uniforms.alpha, 1);
      gl.uniform1f(uniforms.scale, layout.side);
      gl.uniform3f(uniforms.at, 0, 0, 0);
      gl.uniform3fv(uniforms.colour, rgb(colours.frame));
      gl.uniform1f(uniforms.walls, 1);
      mesh("frame");
      gl.uniform1f(uniforms.walls, 0);
      gl.uniform1f(uniforms.scale, layout.square);
      shown.forEach(piece);
    },
  };
}
