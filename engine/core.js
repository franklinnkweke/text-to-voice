// Phonemes and tokens for the Kokoro-82M voice model.
// Normalising and phonemising adapted from kokoro-js (Apache-2.0). Vocabulary from kokoro-onnx (MIT).
import { phonemize as espeak } from "./phonemizer.js";
export * from "./text.js";

const VOCAB = {";":1,":":2,",":3,".":4,"!":5,"?":6,"—":9,"…":10,"\"":11,"(":12,")":13,"“":14,"”":15," ":16,"̃":17,"ʣ":18,"ʥ":19,"ʦ":20,"ʨ":21,"ᵝ":22,"ꭧ":23,"A":24,"I":25,"O":31,"Q":33,"S":35,"T":36,"W":39,"Y":41,"ᵊ":42,"a":43,"b":44,"c":45,"d":46,"e":47,"f":48,"h":50,"i":51,"j":52,"k":53,"l":54,"m":55,"n":56,"o":57,"p":58,"q":59,"r":60,"s":61,"t":62,"u":63,"v":64,"w":65,"x":66,"y":67,"z":68,"ɑ":69,"ɐ":70,"ɒ":71,"æ":72,"β":75,"ɔ":76,"ɕ":77,"ç":78,"ɖ":80,"ð":81,"ʤ":82,"ə":83,"ɚ":85,"ɛ":86,"ɜ":87,"ɟ":90,"ɡ":92,"ɥ":99,"ɨ":101,"ɪ":102,"ʝ":103,"ɯ":110,"ɰ":111,"ŋ":112,"ɳ":113,"ɲ":114,"ɴ":115,"ø":116,"ɸ":118,"θ":119,"œ":120,"ɹ":123,"ɾ":125,"ɻ":126,"ʁ":128,"ɽ":129,"ʂ":130,"ʃ":131,"ʈ":132,"ʧ":133,"ʊ":135,"ʋ":136,"ʌ":138,"ɣ":139,"ɤ":140,"χ":142,"ʎ":143,"ʒ":147,"ʔ":148,"ˈ":156,"ˌ":157,"ː":158,"ʰ":162,"ʲ":164,"↓":169,"→":171,"↗":172,"↘":173,"ᵻ":177};

// ---------- normalising ----------
function splitNum(e) {
  if (e.includes(".")) return e;
  if (e.includes(":")) {
    const [h, m] = e.split(":").map(Number);
    return m === 0 ? `${h} o'clock` : m < 10 ? `${h} oh ${m}` : `${h} ${m}`;
  }
  const year = parseInt(e.slice(0, 4), 10);
  if (year < 1100 || year % 1000 < 10) return e;
  const left = e.slice(0, 2), right = parseInt(e.slice(2, 4), 10), s = e.endsWith("s") ? "s" : "";
  if (year % 1000 >= 100 && year % 1000 <= 999) {
    if (right === 0) return `${left} hundred${s}`;
    if (right < 10) return `${left} oh ${right}${s}`;
  }
  return `${left} ${right}${s}`;
}
function flipMoney(e) {
  const bill = e[0] === "$" ? "dollar" : "pound";
  if (isNaN(Number(e.slice(1)))) return `${e.slice(1)} ${bill}s`;
  if (!e.includes(".")) return `${e.slice(1)} ${bill}${e.slice(1) === "1" ? "" : "s"}`;
  const [b, c] = e.slice(1).split(".");
  const d = parseInt(c.padEnd(2, "0"), 10);
  const coins = e[0] === "$" ? (d === 1 ? "cent" : "cents") : (d === 1 ? "penny" : "pence");
  return `${b} ${bill}${b === "1" ? "" : "s"} and ${d} ${coins}`;
}
function pointNum(e) {
  const [a, b] = e.split(".");
  return `${a} point ${b.split("").join(" ")}`;
}
function normalizeText(t) {
  return t
    .replace(/[‘’]/g, "'").replace(/«/g, "“").replace(/»/g, "”").replace(/[“”]/g, '"')
    .replace(/\(/g, "«").replace(/\)/g, "»")
    .replace(/、/g, ", ").replace(/。/g, ". ").replace(/！/g, "! ").replace(/，/g, ", ")
    .replace(/：/g, ": ").replace(/；/g, "; ").replace(/？/g, "? ")
    .replace(/[^\S \n]/g, " ").replace(/  +/g, " ").replace(/(?<=\n) +(?=\n)/g, "")
    .replace(/\bD[Rr]\.(?= [A-Z])/g, "Doctor")
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, "Mister")
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, "Miss")
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, "Mrs")
    .replace(/\betc\.(?! [A-Z])/gi, "etc")
    .replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, splitNum)
    .replace(/(?<=\d),(?=\d)/g, "")
    .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, flipMoney)
    .replace(/\d*\.\d+/g, pointNum)
    .replace(/(?<=\d)-(?=\d)/g, " to ")
    .replace(/(?<=\d)S/g, " S")
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
    .replace(/(?<=X')S\b/g, "s")
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (m) => m.replace(/\./g, "-"))
    .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, "-")
    .trim();
}

const PUNCT = ';:,.!?¡¿—…"«»“”(){}[]';
const PUNCT_RE = new RegExp(`(\\s*[${PUNCT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]+\\s*)+`, "g");

function splitKeep(text, re) {
  const out = []; let last = 0;
  for (const m of text.matchAll(re)) {
    if (last < m.index) out.push({ match: false, text: text.slice(last, m.index) });
    if (m[0].length > 0) out.push({ match: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ match: false, text: text.slice(last) });
  return out;
}

// lang: "a" = American, "b" = British
export async function toPhonemes(text, lang = "a") {
  text = normalizeText(text);
  const espeakLang = lang === "a" ? "en-us" : "en";
  const parts = splitKeep(text, PUNCT_RE);
  const ph = (await Promise.all(parts.map(async ({ match, text }) =>
    match ? text : (await espeak(text, espeakLang)).join(" ")))).join("");
  let p = ph
    .replace(/kəkˈoːɹoʊ/g, "kˈoʊkəɹoʊ").replace(/kəkˈɔːɹəʊ/g, "kˈəʊkəɹəʊ")
    .replace(/ʲ/g, "j").replace(/r/g, "ɹ").replace(/x/g, "k").replace(/ɬ/g, "l")
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ")
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, "z");
  if (lang === "a") p = p.replace(/(?<=nˈaɪn)ti(?!ː)/g, "di");
  return p.trim();
}

export function toTokens(phonemes) {
  const ids = [];
  for (const ch of phonemes) { const id = VOCAB[ch]; if (id !== undefined) ids.push(id); }
  return ids;
}

