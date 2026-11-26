/*
 * Google's EfficientNet-Lite0 image classifier, in the int8 file MediaPipe publishes (vendor/, Apache
 * 2.0; 5 MB, where the float file passes the site packer's limit), run in floating point on the same
 * small interpreter as the face model: each weight is multiplied out by its scale when the file is
 * read, so the arithmetic is the float network's and not the int8 one's. It answers ImageNet's 1000
 * classes; `photos-scenes.ts` turns them into the words Photos searches.
 */

import { conv2d, depthwise, type Shaped, Tables } from "../photo-booth/photo-booth-face-model";

/** The side of the square picture the model reads, in pixels. */
export const SCENE_MODEL_SIDE = 224;

const OP = {
  ADD: 0,
  AVERAGE_POOL_2D: 1,
  CONV_2D: 3,
  DEPTHWISE_CONV_2D: 4,
  FULLY_CONNECTED: 9,
  RESHAPE: 22,
  SOFTMAX: 25,
  QUANTIZE: 114,
} as const;
const INT32 = 2;
const INT8 = 9;
/** `ActivationFunctionType.RELU6`. */
const RELU6 = 3;
const VALID_PADDING = 1;

function clampSix(data: Float32Array) {
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i] as number;
    data[i] = value < 0 ? 0 : value > 6 ? 6 : value;
  }
}

/** The classifier read from its file: takes a square of RGBA pixels, answers each class's share. */
export function sceneClassifier(modelBytes: Uint8Array) {
  const t = new Tables(modelBytes);
  const model = t.root(0);
  const codes = t
    .tables(t.field(model, 1))
    .map((code) => Math.max(t.byte(code, 0), t.int(code, 3)));
  const buffers = t.tables(t.field(model, 4));
  const graph = t.tables(t.field(model, 2))[0];
  if (graph === undefined) throw new Error("The scene model has no graph.");
  const floats = (at: number) => {
    const { length, first } = t.vector(at);
    return Array.from({ length }, (_, i) => t.view.getFloat32(first + 4 * i, true));
  };
  const zeroPoints = (at: number) => {
    const { length, first } = t.vector(at);
    return Array.from({ length }, (_, i) => Number(t.view.getBigInt64(first + 8 * i, true)));
  };
  const tensors: Shaped[] = t.tables(t.field(graph, 0)).map((tensor) => {
    const shape = t.ints(t.field(tensor, 0));
    const data = new Float32Array(shape.reduce((all, side) => all * side, 1));
    const buffer = buffers[t.int(tensor, 2)] ?? 0;
    const { length, first } = buffer ? t.vector(t.field(buffer, 0)) : { length: 0, first: 0 };
    if (length === 0) return { shape, data };
    const type = t.byte(tensor, 1);
    const quantization = t.field(tensor, 4) ? t.root(t.field(tensor, 4)) : 0;
    const scales = floats(t.field(quantization, 2));
    const zeros = zeroPoints(t.field(quantization, 3));
    const axis = t.int(quantization, 6);
    const after = shape.slice(axis + 1).reduce((all, side) => all * side, 1);
    const channels = shape[axis] ?? 1;
    for (let i = 0; i < data.length; i += 1) {
      const channel = scales.length > 1 ? Math.floor(i / after) % channels : 0;
      const raw =
        type === INT8
          ? t.view.getInt8(first + i)
          : type === INT32
            ? t.view.getInt32(first + 4 * i, true)
            : Number.NaN;
      data[i] = (scales[channel] as number) * (raw - (zeros[channel] ?? 0));
    }
    return { shape, data };
  });
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
    const activate = (activation: number) => {
      if (activation === RELU6) steps.push(() => clampSix(out.data));
      else if (activation !== 0) throw new Error(`The scene model uses activation ${activation}.`);
    };
    if (code === OP.QUANTIZE || code === OP.RESHAPE) {
      out.data = input.data;
    } else if (code === OP.CONV_2D || code === OP.DEPTHWISE_CONV_2D) {
      const run = code === OP.CONV_2D ? conv2d : depthwise;
      const stride = t.int(options, 1, 1);
      if (t.byte(options, 0) === VALID_PADDING || stride !== t.int(options, 2, 1)) {
        throw new Error("The scene model convolves other than with SAME padding and even strides.");
      }
      steps.push(() => run(input, second, third, out, stride));
      activate(t.byte(options, code === OP.CONV_2D ? 3 : 4));
    } else if (code === OP.ADD) {
      steps.push(() => {
        const [a, b, to] = [input.data, second.data, out.data];
        for (let i = 0; i < to.length; i += 1) to[i] = (a[i] as number) + (b[i] as number);
      });
      activate(t.byte(options, 0));
    } else if (code === OP.AVERAGE_POOL_2D) {
      const [, h = 0, w = 0, channels = 0] = input.shape;
      if (t.int(options, 3) !== w || t.int(options, 4) !== h) {
        throw new Error("The scene model pools other than over the whole picture.");
      }
      steps.push(() => {
        const [from, to] = [input.data, out.data];
        to.fill(0);
        for (let i = 0; i < from.length; i += 1) {
          to[i % channels] = (to[i % channels] as number) + (from[i] as number);
        }
        for (let c = 0; c < channels; c += 1) to[c] = (to[c] as number) / (h * w);
      });
      activate(t.byte(options, 5));
    } else if (code === OP.FULLY_CONNECTED) {
      const [outs = 0, ins = 0] = second.shape;
      steps.push(() => {
        const [from, weights, bias, to] = [input.data, second.data, third.data, out.data];
        for (let o = 0; o < outs; o += 1) {
          let sum = bias[o] as number;
          for (let i = 0; i < ins; i += 1) {
            sum += (from[i] as number) * (weights[o * ins + i] as number);
          }
          to[o] = sum;
        }
      });
      activate(t.byte(options, 0));
    } else if (code === OP.SOFTMAX) {
      steps.push(() => {
        const [from, to] = [input.data, out.data];
        let most = Number.NEGATIVE_INFINITY;
        for (let i = 0; i < from.length; i += 1) most = Math.max(most, from[i] as number);
        let total = 0;
        for (let i = 0; i < from.length; i += 1) {
          to[i] = Math.exp((from[i] as number) - most);
          total += to[i] as number;
        }
        for (let i = 0; i < to.length; i += 1) to[i] = (to[i] as number) / total;
      });
    } else {
      throw new Error(`The scene model uses operator ${code}, which is not built here.`);
    }
  }
  const inputAt = t.ints(t.field(graph, 1))[0] as number;
  const outputAt = t.ints(t.field(graph, 2))[0] as number;
  const entry = t.tables(t.field(graph, 0))[inputAt] as number;
  const quantization = t.root(t.field(entry, 4));
  const scale = floats(t.field(quantization, 2))[0] as number;
  const zero = zeroPoints(t.field(quantization, 3))[0] as number;
  const picture = tensors[inputAt] as Shaped;
  return (rgba: ArrayLike<number>): Float32Array => {
    for (let at = 0, i = 0; at < rgba.length; at += 4, i += 3) {
      picture.data[i] = scale * ((rgba[at] as number) - zero);
      picture.data[i + 1] = scale * ((rgba[at + 1] as number) - zero);
      picture.data[i + 2] = scale * ((rgba[at + 2] as number) - zero);
    }
    for (const step of steps) step();
    return (tensors[outputAt] as Shaped).data;
  };
}
