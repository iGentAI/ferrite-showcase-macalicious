/*
 * Edit > Spelling and Grammar > Check Grammar With Spelling: the mistakes a short list of rules can
 * name with no reader of the sentence. A repeated word, "a" and "an", a sentence that starts in
 * lower case, and a space before punctuation. Each comes with what to change it to.
 */

/** The setting, kept with the person's account for every editor. */
export const CHECK_GRAMMAR_KEY = "text.checkGrammar";

export interface GrammarIssue {
  word: string;
  start: number;
  end: number;
  /** Why it is a mistake, as the panel says it. */
  why: string;
  /** What the panel offers in its place. */
  change: string;
}

/** Words that may be said twice in a row in a sound sentence. */
const MAY_REPEAT = new Set(["had", "that"]);
/** Words that start with a vowel's letter and a consonant's sound. */
const SOUNDS_CONSONANT = /^(uni(?!n|m)|use|usu|uto|eu|one\b|once\b|ubiq|ewe)/i;
/** Words that start with a consonant's letter and a vowel's sound. */
const SOUNDS_VOWEL = /^(hour|honest|honou?r|heir)/i;
/** Abbreviations whose full stop does not end a sentence. */
const ABBREVIATION = /(^|\W)(e\.g|i\.e|etc|vs|cf|al|approx|mr|mrs|ms|dr|st|no|p|pp)\.$/i;

const REPEATED = /(?<![\p{L}\p{N}'’])([\p{L}]+)(\s+)\1(?![\p{L}\p{N}'’])/giu;
const ARTICLE = /(?<![p{L}p{N}'’-])(a|an)(\s+)([A-Za-z][a-z]+)/gi;
const SENTENCE_END = /(?<!\.)[.!?](\s+)(\p{Ll}[\p{L}'’]*)/gu;
const SPACE_BEFORE = /(?<=[\p{L}\p{N}])([ \t]+)([,;:!?]|\.(?![.\d]))/gu;

const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

function firstAfter(
  pattern: RegExp,
  text: string,
  from: number,
  read: (match: RegExpExecArray) => GrammarIssue | undefined,
): GrammarIssue | undefined {
  pattern.lastIndex = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const issue = read(match);
    if (issue && issue.end > from) return issue;
  }
  return undefined;
}

/** The first mistake that ends after `from`, or `undefined`. `ignored` holds passed-over text. */
export function nextGrammarIssue(
  text: string,
  from: number,
  ignored: ReadonlySet<string> = new Set(),
): GrammarIssue | undefined {
  const found = [
    firstAfter(REPEATED, text, from, (match) => {
      const [word, first = ""] = match;
      if (MAY_REPEAT.has(first.toLowerCase())) return undefined;
      const start = match.index;
      return {
        word,
        start,
        end: start + word.length,
        why: `The word “${first}” is repeated.`,
        change: first,
      };
    }),
    firstAfter(ARTICLE, text, from, (match) => {
      const [word, article = "", space = "", next = ""] = match;
      const vowel =
        SOUNDS_VOWEL.test(next) || (/^[aeiou]/i.test(next) && !SOUNDS_CONSONANT.test(next));
      const isAn = article.length === 2;
      if (vowel === isAn) return undefined;
      const shouldBe = vowel ? `${article}n` : article.slice(0, 1);
      const start = match.index;
      return {
        word,
        start,
        end: start + word.length,
        why: vowel
          ? `Use “an” before “${next}”, which starts with a vowel’s sound.`
          : `Use “a” before “${next}”, which starts with a consonant’s sound.`,
        change: `${shouldBe}${space}${next}`,
      };
    }),
    firstAfter(SENTENCE_END, text, from, (match) => {
      const [whole, space = "", first = ""] = match;
      if (ABBREVIATION.test(text.slice(Math.max(0, match.index - 6), match.index + 1))) {
        return undefined;
      }
      const start = match.index + whole.length - first.length;
      // A paragraph that ends in a stop says nothing of how the next one begins: lists, verse.
      if (space.includes("\n")) return undefined;
      return {
        word: first,
        start,
        end: start + first.length,
        why: "A sentence begins with a capital letter.",
        change: capital(first),
      };
    }),
    firstAfter(SPACE_BEFORE, text, from, (match) => {
      const [word, , mark = ""] = match;
      const start = match.index;
      return {
        word,
        start,
        end: start + word.length,
        why: `There is a space before “${mark}”.`,
        change: mark,
      };
    }),
  ].filter((issue): issue is GrammarIssue => issue !== undefined);
  const unseen = found.filter((issue) => !ignored.has(issue.word.toLowerCase()));
  const next = unseen.sort((one, two) => one.start - two.start)[0];
  if (next || found.length === 0) return next;
  // Every first find was passed over: go on from the last of them.
  return nextGrammarIssue(text, Math.max(...found.map((issue) => issue.end)), ignored);
}
