// Text splitting for reading aloud (no voice engine needed).
// Sentence splitting adapted from kokoro-js (Apache-2.0, https://github.com/hexgrad/kokoro).
export const VOICES = [
  { id: "af_heart",    name: "Heart",    accent: "American", gender: "woman" },
  { id: "af_bella",    name: "Bella",    accent: "American", gender: "woman" },
  { id: "am_michael",  name: "Michael",  accent: "American", gender: "man" },
  { id: "am_puck",     name: "Puck",     accent: "American", gender: "man" },
  { id: "bf_emma",     name: "Emma",     accent: "British",  gender: "woman" },
  { id: "bf_isabella", name: "Isabella", accent: "British",  gender: "woman" },
  { id: "bm_george",   name: "George",   accent: "British",  gender: "man" },
  { id: "bm_fable",    name: "Fable",    accent: "British",  gender: "man" },
];
export const VOICE_FLOATS = 510 * 256; // one voice = 510 style rows of 256
export const SAMPLE_RATE = 24000;
export const MAX_TOKENS = 510;

// ---------- sentence splitting ----------
const isEnd = (ch, nl = true) => ".!?…。？！".includes(ch) || (nl && ch === "\n");
const ABBREV = new Set(["mr","mrs","ms","dr","prof","sr","jr","sgt","col","gen","rep","sen","gov","lt","maj","capt","st","mt","etc","co","inc","ltd","dept","vs","p","pg","jan","feb","mar","apr","jun","jul","aug","sep","sept","oct","nov","dec","sun","mon","tu","tue","tues","wed","th","thu","thur","thurs","fri","sat"]);
const isAbbrev = (tok) => ABBREV.has(tok.replace(/['’]s$/i, "").replace(/\.+$/, "").toLowerCase());
const CLOSERS = new Map([[")","("],["]","["],["}","{"],["》","《"],["〉","〈"],["›","‹"],["»","«"],["」","「"],["』","『"],["〕","〔"],["】","【"]]);
const OPENERS = new Set(CLOSERS.values());
function track(ch, stack, i, buf) {
  if (ch === '"' || ch === "'") {
    if (ch === "'" && i > 0 && i < buf.length - 1 && /[A-Za-z]/.test(buf[i - 1]) && /[A-Za-z]/.test(buf[i + 1])) return;
    if (stack.length && stack.at(-1) === ch) stack.pop(); else stack.push(ch);
    return;
  }
  if (OPENERS.has(ch)) { stack.push(ch); return; }
  const open = CLOSERS.get(ch);
  if (open && stack.length && stack.at(-1) === open) stack.pop();
}
export function splitSentences(buf) {
  const out = []; const len = buf.length;
  let start = 0, i = 0; const stack = [];
  const boundary = (idx) => {
    let end = idx;
    while (end + 1 < len && isEnd(buf[end + 1], false)) ++end;
    while (end + 1 < len && "\"')]}」』”’".includes(buf[end + 1])) ++end;
    let next = end + 1;
    while (next < len && /\s/.test(buf[next])) ++next;
    return { end, next };
  };
  while (i < len) {
    const c = buf[i];
    track(c, stack, i, buf);
    if (stack.length === 0 && isEnd(c)) {
      if (/(^|\n)\d+$/.test(buf.slice(start, i))) { ++i; continue; }
      const { end, next } = boundary(i);
      if (i === next - 1 && c !== "\n") { ++i; continue; }
      if (next === len) break;
      let ts = i - 1;
      while (ts >= 0 && /\S/.test(buf[ts])) ts--;
      ts = Math.max(start, ts + 1);
      let te = ts; while (te < len && !/\s/.test(buf[te])) ++te;
      const tok = buf.substring(ts, te);
      if (!tok) { ++i; continue; }
      if ((/https?[,:]\/\//.test(tok) || tok.includes("@")) && !isEnd(tok.at(-1))) { i = ts + tok.length; continue; }
      if (isAbbrev(tok)) { ++i; continue; }
      if (/^([A-Za-z]\.)+$/.test(tok) && next < len && /[A-Z]/.test(buf[next])) { ++i; continue; }
      if (c === "." && next < len && /[a-z]/.test(buf[next])) { ++i; continue; }
      const s = buf.substring(start, end + 1).trim();
      if (s === "..." || s === "…") { ++i; continue; }
      if (s) out.push(s);
      i = start = end + 1;
    } else ++i;
  }
  const rest = buf.substring(start).trim();
  if (rest) out.push(rest);
  return out;
}

// ---------- paragraphs and reading parts ----------
export function splitParagraphs(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim());
  const paras = []; let cur = null;
  for (const line of lines) {
    if (!line) { cur = null; continue; }
    // join hard-wrapped lines (previous line has no ending, this one starts lower-case)
    if (cur !== null && !/[.!?:;"”’)\]…]$/.test(paras[cur]) && /^[a-z(“"'‘]/.test(line)) {
      paras[cur] += " " + line;
    } else { paras.push(line); cur = paras.length - 1; }
  }
  return paras;
}

function breakLong(s, max) {
  if (s.length <= max) return [s];
  const out = []; let rest = s;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    let cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(": "), window.lastIndexOf(" — "));
    if (cut < max * 0.4) cut = window.lastIndexOf(" ");
    if (cut < max * 0.3) cut = max - 1;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

// Natural-voice parts: short pieces (first one tiny so playback starts fast).
// Returns paragraphs: [{ parts: [string, ...] }]
export function planReading(text, { target = 240, hardMax = 360 } = {}) {
  const paras = splitParagraphs(text);
  let first = true;
  return paras.map((p) => {
    const sentences = splitSentences(p).flatMap((s) => breakLong(s, hardMax));
    const parts = []; let buf = "";
    for (const s of sentences) {
      if (first) { parts.push(s); first = false; continue; }
      if (buf && (buf.length + 1 + s.length) > target) { parts.push(buf); buf = s; }
      else buf = buf ? buf + " " + s : s;
    }
    if (buf) parts.push(buf);
    return { parts };
  }).filter((p) => p.parts.length);
}
