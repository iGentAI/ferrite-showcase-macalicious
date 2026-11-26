/** Whether this browser can speak. */
export const canSpeak = (): boolean =>
  typeof window !== "undefined" &&
  "speechSynthesis" in window &&
  typeof SpeechSynthesisUtterance !== "undefined";

const PIECE_NAMES: Readonly<Record<string, string>> = {
  K: "King",
  Q: "Queen",
  R: "Rook",
  B: "Bishop",
  N: "Knight",
};

const PROMOTED: Readonly<Record<string, string>> = {
  Q: "queen",
  R: "rook",
  B: "bishop",
  N: "knight",
};

/** A move in algebraic notation as a sentence to say: `Nxe5+` is "Knight takes e5, check". */
export function spokenMove(notation: string): string {
  const ending = notation.endsWith("#") ? ", checkmate" : notation.endsWith("+") ? ", check" : "";
  const move = notation.replace(/[+#]+$/, "");
  if (move === "O-O") return `Castle kingside${ending}`;
  if (move === "O-O-O") return `Castle queenside${ending}`;
  const dropped = /^([KQRBNP])@([a-h][1-8])$/.exec(move);
  if (dropped) {
    return `${PIECE_NAMES[dropped[1] as string] ?? "Pawn"} drops on ${dropped[2]}${ending}`;
  }
  const parts = /^([KQRBN]?)([a-h]?[1-8]?)(x?)([a-h][1-8])(?:=([QRBN]))?$/.exec(move);
  if (!parts) return `${notation}`;
  const [, piece, from, takes, to, promoted] = parts;
  const mover = [PIECE_NAMES[piece as string], from].filter(Boolean).join(" ");
  const promotion = promoted ? `, promotes to ${PROMOTED[promoted]}` : "";
  const where = `${takes ? "takes " : ""}${to}`;
  const sentence = mover ? `${mover} ${where}` : where;
  return `${sentence}${promotion}${ending}`;
}

/** Says `text` over whatever was being said, so a fast game does not fall behind. */
export function speak(text: string): void {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}
