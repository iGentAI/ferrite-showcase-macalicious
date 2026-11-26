/*
 * MediaPipe's BlazeFace short-range model (vendor/, Apache 2.0) on a small interpreter of the nine
 * operators it uses, for `demos/desktop/desktop-faces.ts`, whose worker runs it. Its layout, anchors
 * and suppression follow MediaPipe's face_detection_short_range graph.
 */

/** A point in the picture, as fractions of its width and height. */
export interface FacePoint {
  x: number;
  y: number;
}

/** A face found: its box and points as fractions of the picture's width and height. */
export interface DetectedFace {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The model's confidence, from 0.5 to 1. */
  score: number;
  /** Right and left are the person's own, so the right eye is on the left of an unmirrored picture. */
  landmarks: {
    rightEye: FacePoint;
    leftEye: FacePoint;
    nose: FacePoint;
    mouth: FacePoint;
    rightEar: FacePoint;
    leftEar: FacePoint;
  };
}

/** The side of the square picture the model reads, in pixels. */
export const FACE_MODEL_SIDE = 128;
const MIN_SCORE = 0.5;
const OVERLAP = 0.3;

/* The FlatBuffers layout of a .tflite file, as far as the model needs (tensorflow/lite/schema). */
export class Tables {
  readonly view: DataView;
  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  root(at: number) {
    return at + this.view.getUint32(at, true);
  }
  /** Where a table's field is, or 0 for one left at its default. */
  field(table: number, index: number) {
    const vtable = table - this.view.getInt32(table, true);
    const entry = 4 + 2 * index;
    if (entry >= this.view.getUint16(vtable, true)) return 0;
    const offset = this.view.getUint16(vtable + entry, true);
    return offset ? table + offset : 0;
  }
  /** A vector field: its length and where its first element is. */
  vector(at: number) {
    if (at === 0) return { length: 0, first: 0 };
    const start = at + this.view.getUint32(at, true);
    return { length: this.view.getUint32(start, true), first: start + 4 };
  }
  tables(at: number) {
    const { length, first } = this.vector(at);
    return Array.from({ length }, (_, i) => this.root(first + 4 * i));
  }
  ints(at: number) {
    const { length, first } = this.vector(at);
    return Array.from({ length }, (_, i) => this.view.getInt32(first + 4 * i, true));
  }
  int(table: number, index: number, otherwise = 0) {
    const at = this.field(table, index);
    return at ? this.view.getInt32(at, true) : otherwise;
  }
  byte(table: number, index: number) {
    const at = this.field(table, index);
    return at ? this.view.getInt8(at) : 0;
  }
}

const OP = {
  ADD: 0,
  CONCATENATION: 2,
  CONV_2D: 3,
  DEPTHWISE_CONV_2D: 4,
  DEQUANTIZE: 6,
  MAX_POOL_2D: 17,
  RELU: 19,
  RESHAPE: 22,
  PAD: 34,
} as const;
const FLOAT16 = 1;

function halfToFloat(half: number): number {
  const exponent = (half >> 10) & 31;
  const fraction = half & 1023;
  const magnitude =
    exponent === 0
      ? fraction * 2 ** -24
      : exponent === 31
        ? fraction
          ? Number.NaN
          : Number.POSITIVE_INFINITY
        : (1 + fraction / 1024) * 2 ** (exponent - 15);
  return half & 0x8000 ? -magnitude : magnitude;
}

/** The padding before an axis, and the size after, for a stride and a kernel (TFLite's SAME). */
const samePadding = (size: number, stride: number, kernel: number) => {
  const out = Math.ceil(size / stride);
  return Math.floor(Math.max((out - 1) * stride + kernel - size, 0) / 2);
};

export interface Shaped {
  data: Float32Array;
  shape: readonly number[];
}

export function conv2d(input: Shaped, kernel: Shaped, bias: Shaped, out: Shaped, stride: number) {
  const [, inH = 0, inW = 0, inC = 0] = input.shape;
  const [outC = 0, kH = 0, kW = 0] = kernel.shape;
  const [, outH = 0, outW = 0] = out.shape;
  const padTop = samePadding(inH, stride, kH);
  const padLeft = samePadding(inW, stride, kW);
  const [from, weights, offsets, to] = [input.data, kernel.data, bias.data, out.data];
  const perChannel = kH * kW * inC;
  to.fill(0);
  for (let c = 0; c < outC; c += 1) {
    const base = offsets[c] as number;
    for (let i = c; i < to.length; i += outC) to[i] = base;
  }
  for (let c = 0; c < outC; c += 1) {
    const row = c * perChannel;
    for (let ky = 0; ky < kH; ky += 1) {
      for (let kx = 0; kx < kW; kx += 1) {
        const tap = row + (ky * kW + kx) * inC;
        for (let y = 0; y < outH; y += 1) {
          const iy = y * stride - padTop + ky;
          if (iy < 0 || iy >= inH) continue;
          for (let x = 0; x < outW; x += 1) {
            const ix = x * stride - padLeft + kx;
            if (ix < 0 || ix >= inW) continue;
            const at = (iy * inW + ix) * inC;
            let sum = 0;
            for (let ic = 0; ic < inC; ic += 1) {
              sum += (from[at + ic] as number) * (weights[tap + ic] as number);
            }
            to[(y * outW + x) * outC + c] = (to[(y * outW + x) * outC + c] as number) + sum;
          }
        }
      }
    }
  }
}

export function depthwise(
  input: Shaped,
  kernel: Shaped,
  bias: Shaped,
  out: Shaped,
  stride: number,
) {
  const [, inH = 0, inW = 0, channels = 0] = input.shape;
  const [, kH = 0, kW = 0] = kernel.shape;
  const [, outH = 0, outW = 0] = out.shape;
  const padTop = samePadding(inH, stride, kH);
  const padLeft = samePadding(inW, stride, kW);
  const [from, weights, offsets, to] = [input.data, kernel.data, bias.data, out.data];
  for (let y = 0, o = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      for (let c = 0; c < channels; c += 1, o += 1) {
        let sum = offsets[c] as number;
        for (let ky = 0; ky < kH; ky += 1) {
          const iy = y * stride - padTop + ky;
          if (iy < 0 || iy >= inH) continue;
          for (let kx = 0; kx < kW; kx += 1) {
            const ix = x * stride - padLeft + kx;
            if (ix < 0 || ix >= inW) continue;
            sum +=
              (from[(iy * inW + ix) * channels + c] as number) *
              (weights[(ky * kW + kx) * channels + c] as number);
          }
        }
        to[o] = sum;
      }
    }
  }
}

function maxPool(input: Shaped, out: Shaped, size: number) {
  const [, , inW = 0, channels = 0] = input.shape;
  const [, outH = 0, outW = 0] = out.shape;
  const [from, to] = [input.data, out.data];
  for (let y = 0, o = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      for (let c = 0; c < channels; c += 1, o += 1) {
        let most = Number.NEGATIVE_INFINITY;
        for (let ky = 0; ky < size; ky += 1) {
          for (let kx = 0; kx < size; kx += 1) {
            const value = from[((y * size + ky) * inW + x * size + kx) * channels + c] as number;
            if (value > most) most = value;
          }
        }
        to[o] = most;
      }
    }
  }
}

/** The model read from its file: runs on a square RGBA picture and answers its two outputs. */
function compile(bytes: Uint8Array) {
  const t = new Tables(bytes);
  const model = t.root(0);
  const codes = t
    .tables(t.field(model, 1))
    .map((code) => Math.max(t.byte(code, 0), t.int(code, 3)));
  const buffers = t.tables(t.field(model, 4));
  const graph = t.tables(t.field(model, 2))[0];
  if (graph === undefined) throw new Error("The face model has no graph.");
  const rawTensors = t.tables(t.field(graph, 0)).map((tensor) => {
    const shape = t.ints(t.field(tensor, 0));
    const buffer = buffers[t.int(tensor, 2)] ?? 0;
    const stored = buffer ? t.vector(t.field(buffer, 0)) : { length: 0, first: 0 };
    return { shape, type: t.byte(tensor, 1), stored };
  });
  const tensors: Shaped[] = rawTensors.map(({ shape }) => ({
    shape,
    data: new Float32Array(shape.reduce((all, side) => all * side, 1)),
  }));
  const ints = (index: number) => {
    const { length, first } = rawTensors[index]?.stored ?? { length: 0, first: 0 };
    return Array.from({ length: length / 4 }, (_, i) => t.view.getInt32(first + 4 * i, true));
  };
  const steps: (() => void)[] = [];
  for (const op of t.tables(t.field(graph, 3))) {
    const code = codes[t.int(op, 0)];
    const inputs = t.ints(t.field(op, 1));
    const outputs = t.ints(t.field(op, 2));
    const options = t.field(op, 4) ? t.root(t.field(op, 4)) : 0;
    const out = tensors[outputs[0] as number] as Shaped;
    const input = tensors[inputs[0] as number] as Shaped;
    const second = tensors[inputs[1] as number] as Shaped;
    const third = tensors[inputs[2] as number] as Shaped;
    if (code === OP.DEQUANTIZE) {
      const { type, stored } = rawTensors[inputs[0] as number] as (typeof rawTensors)[number];
      if (type !== FLOAT16) throw new Error(`The face model stores a tensor of type ${type}.`);
      for (let i = 0; i < out.data.length; i += 1) {
        out.data[i] = halfToFloat(t.view.getUint16(stored.first + 2 * i, true));
      }
    } else if (code === OP.CONV_2D) {
      const stride = t.int(options, 1, 1);
      steps.push(() => conv2d(input, second, third, out, stride));
    } else if (code === OP.DEPTHWISE_CONV_2D) {
      const stride = t.int(options, 1, 1);
      steps.push(() => depthwise(input, second, third, out, stride));
    } else if (code === OP.MAX_POOL_2D) {
      const size = t.int(options, 3, 1);
      steps.push(() => maxPool(input, out, size));
    } else if (code === OP.RELU) {
      steps.push(() => {
        const [from, to] = [input.data, out.data];
        for (let i = 0; i < to.length; i += 1) {
          const value = from[i] as number;
          to[i] = value > 0 ? value : 0;
        }
      });
    } else if (code === OP.ADD) {
      steps.push(() => {
        const [a, b, to] = [input.data, second.data, out.data];
        for (let i = 0; i < to.length; i += 1) to[i] = (a[i] as number) + (b[i] as number);
      });
    } else if (code === OP.PAD) {
      const pads = ints(inputs[1] as number);
      if (pads.some((pad, i) => pad !== 0 && !(i === 7 && input.shape.length === 4))) {
        throw new Error("The face model pads other than channels after.");
      }
      const [, h = 0, w = 0, channels = 0] = input.shape;
      const added = pads[7] ?? 0;
      steps.push(() => {
        const [from, to] = [input.data, out.data];
        to.fill(0);
        for (let i = 0; i < h * w; i += 1) {
          const line = from.subarray(i * channels, (i + 1) * channels);
          to.set(line, i * (channels + added));
        }
      });
    } else if (code === OP.RESHAPE) {
      out.data = input.data;
    } else if (code === OP.CONCATENATION) {
      const parts = inputs.map((index) => tensors[index] as Shaped);
      steps.push(() => {
        let at = 0;
        for (const part of parts) {
          out.data.set(part.data, at);
          at += part.data.length;
        }
      });
    } else {
      throw new Error(`The face model uses operator ${code}, which is not built here.`);
    }
  }
  const [regressors, scores] = t.ints(t.field(graph, 2));
  const inputIndex = t.ints(t.field(graph, 1))[0] as number;
  const input = tensors[inputIndex] as Shaped;
  return (rgba: Uint8ClampedArray) => {
    for (let at = 0, i = 0; at < rgba.length; at += 4, i += 3) {
      input.data[i] = (rgba[at] as number) / 127.5 - 1;
      input.data[i + 1] = (rgba[at + 1] as number) / 127.5 - 1;
      input.data[i + 2] = (rgba[at + 2] as number) / 127.5 - 1;
    }
    for (const step of steps) step();
    return {
      boxes: (tensors[regressors as number] as Shaped).data,
      scores: (tensors[scores as number] as Shaped).data,
    };
  };
}

/** Each anchor's centre: two per cell of the 16 by 16 grid, then six per cell of the 8 by 8. */
const ANCHORS = (() => {
  const all: number[] = [];
  for (const [cells, perCell] of [
    [16, 2],
    [8, 6],
  ] as const) {
    for (let y = 0; y < cells; y += 1) {
      for (let x = 0; x < cells; x += 1) {
        for (let n = 0; n < perCell; n += 1) all.push((x + 0.5) / cells, (y + 0.5) / cells);
      }
    }
  }
  return all;
})();

const overlap = (a: DetectedFace, b: DetectedFace) => {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / (a.width * a.height + b.width * b.height - w * h);
};

/** Faces from the model's outputs, in fractions of the square it read: the anchors that fire, with
 * each cluster of overlapping ones averaged by score, as MediaPipe's weighted suppression does. */
function decode(boxes: Float32Array, scores: Float32Array): DetectedFace[] {
  const fired: DetectedFace[] = [];
  for (let i = 0; i < scores.length; i += 1) {
    const score = 1 / (1 + Math.exp(-(scores[i] as number)));
    if (score < MIN_SCORE) continue;
    const [ax, ay] = [ANCHORS[2 * i] as number, ANCHORS[2 * i + 1] as number];
    const raw = (n: number) => (boxes[16 * i + n] as number) / FACE_MODEL_SIDE;
    const point = (n: number) => ({ x: ax + raw(4 + 2 * n), y: ay + raw(5 + 2 * n) });
    const [width, height] = [raw(2), raw(3)];
    fired.push({
      x: ax + raw(0) - width / 2,
      y: ay + raw(1) - height / 2,
      width,
      height,
      score,
      landmarks: {
        rightEye: point(0),
        leftEye: point(1),
        nose: point(2),
        mouth: point(3),
        rightEar: point(4),
        leftEar: point(5),
      },
    });
  }
  fired.sort((a, b) => b.score - a.score);
  const faces: DetectedFace[] = [];
  while (fired.length > 0) {
    const best = fired[0] as DetectedFace;
    const cluster = fired.filter((face) => overlap(best, face) >= OVERLAP);
    const weight = cluster.reduce((all, face) => all + face.score, 0);
    const mean = (read: (face: DetectedFace) => number) =>
      cluster.reduce((all, face) => all + read(face) * face.score, 0) / weight;
    const meanPoint = (name: keyof DetectedFace["landmarks"]) => ({
      x: mean((face) => face.landmarks[name].x),
      y: mean((face) => face.landmarks[name].y),
    });
    faces.push({
      x: mean((face) => face.x),
      y: mean((face) => face.y),
      width: mean((face) => face.width),
      height: mean((face) => face.height),
      score: best.score,
      landmarks: {
        rightEye: meanPoint("rightEye"),
        leftEye: meanPoint("leftEye"),
        nose: meanPoint("nose"),
        mouth: meanPoint("mouth"),
        rightEar: meanPoint("rightEar"),
        leftEar: meanPoint("leftEar"),
      },
    });
    for (const face of cluster) fired.splice(fired.indexOf(face), 1);
  }
  return faces;
}

/** Moves a face from fractions of the model's square to fractions of a picture letterboxed in it:
 * centred, the whole of its longer side. */
function outOfSquare(face: DetectedFace, width: number, height: number): DetectedFace {
  const scaleX = Math.max(width, height) / width;
  const scaleY = Math.max(width, height) / height;
  const toPoint = (p: FacePoint) => ({
    x: (p.x - 0.5) * scaleX + 0.5,
    y: (p.y - 0.5) * scaleY + 0.5,
  });
  const { rightEye, leftEye, nose, mouth, rightEar, leftEar } = face.landmarks;
  return {
    ...toPoint(face),
    width: face.width * scaleX,
    height: face.height * scaleY,
    score: face.score,
    landmarks: {
      rightEye: toPoint(rightEye),
      leftEye: toPoint(leftEye),
      nose: toPoint(nose),
      mouth: toPoint(mouth),
      rightEar: toPoint(rightEar),
      leftEar: toPoint(leftEar),
    },
  };
}

/**
 * The detector from the model file's bytes. It takes the RGBA pixels of a `FACE_MODEL_SIDE` square
 * holding a `width` by `height` picture letterboxed on black, and answers its faces in fractions of
 * that picture, largest confidence first.
 */
export function faceDetector(modelBytes: Uint8Array) {
  const run = compile(modelBytes);
  return (square: Uint8ClampedArray, width: number, height: number): DetectedFace[] => {
    const { boxes, scores } = run(square);
    return decode(boxes, scores).map((face) => outOfSquare(face, width, height));
  };
}
