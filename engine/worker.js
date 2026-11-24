// Voice worker: turns text into audio with the Kokoro-82M model (runs on this device).
import * as ort from "./ort.min.js";
import { toPhonemes, toTokens, VOICE_FLOATS, MAX_TOKENS, SAMPLE_RATE } from "./core.js";

const here = new URL("./", import.meta.url).href;
ort.env.wasm.wasmPaths = { mjs: here + "ort-wasm-simd-threaded.js", wasm: here + "ort-wasm-simd-threaded.wasm" };
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) : 1;
ort.env.wasm.proxy = false;

let session = null, voices = null, busy = false;
const queue = [];
const dropped = new Set();

function trim(a) {
  const th = 0.008; let s = 0, e = a.length - 1;
  while (s < a.length && Math.abs(a[s]) < th) s++;
  while (e > s && Math.abs(a[e]) < th) e--;
  if (s >= e) return new Float32Array(0);
  s = Math.max(0, s - Math.round(0.04 * SAMPLE_RATE));
  e = Math.min(a.length, e + Math.round(0.12 * SAMPLE_RATE));
  return a.slice(s, e);
}

function concat(list, gapSec) {
  const gap = Math.round(gapSec * SAMPLE_RATE);
  const n = list.reduce((t, a) => t + a.length, 0) + gap * Math.max(0, list.length - 1);
  const out = new Float32Array(n); let o = 0;
  list.forEach((a, i) => { out.set(a, o); o += a.length + (i < list.length - 1 ? gap : 0); });
  return out;
}

function halve(text) {
  const mid = Math.floor(text.length / 2);
  let cut = text.lastIndexOf(" ", mid);
  if (cut < text.length * 0.2) cut = text.indexOf(" ", mid);
  if (cut < 0) cut = mid;
  return [text.slice(0, cut).trim(), text.slice(cut).trim()].filter(Boolean);
}

async function synth(text, voice, lang, speed, depth = 0) {
  const ph = await toPhonemes(text, lang);
  const ids = toTokens(ph);
  if (!ids.length) return new Float32Array(0);
  if (ids.length > MAX_TOKENS && depth < 6) {
    const halves = halve(text);
    if (halves.length > 1) {
      const parts = [];
      for (const h of halves) parts.push(await synth(h, voice, lang, speed, depth + 1));
      return concat(parts.filter((p) => p.length), 0.08);
    }
  }
  const use = ids.slice(0, MAX_TOKENS);
  const off = voice * VOICE_FLOATS + Math.min(use.length, 509) * 256;
  const tokens = new BigInt64Array(use.length + 2);
  use.forEach((v, i) => { tokens[i + 1] = BigInt(v); });
  const out = await session.run({
    tokens: new ort.Tensor("int64", tokens, [1, tokens.length]),
    style: new ort.Tensor("float32", voices.slice(off, off + 256), [1, 256]),
    speed: new ort.Tensor("float32", new Float32Array([speed]), [1]),
  });
  return trim(out.audio.data);
}

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift();
    if (dropped.delete(job.id)) continue;
    try {
      const t0 = performance.now();
      const audio = await synth(job.text, job.voice, job.lang, job.speed);
      postMessage({ type: "audio", id: job.id, audio, ms: performance.now() - t0 }, [audio.buffer]);
    } catch (err) {
      postMessage({ type: "audio-error", id: job.id, message: String(err?.message || err) });
    }
  }
  busy = false;
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === "init") {
    try {
      voices = new Float32Array(m.voices);
      if (m.wasmBinary) ort.env.wasm.wasmBinary = m.wasmBinary;
      session = await ort.InferenceSession.create(new Uint8Array(m.model), {
        executionProviders: ["wasm"], graphOptimizationLevel: "all",
      });
      postMessage({ type: "ready", threads: ort.env.wasm.numThreads });
    } catch (err) {
      postMessage({ type: "init-error", message: String(err?.message || err) });
    }
  } else if (m.type === "gen") {
    queue.push(m); pump();
  } else if (m.type === "cancel") {
    const ids = new Set(m.ids);
    for (let i = queue.length - 1; i >= 0; i--) if (ids.has(queue[i].id)) queue.splice(i, 1);
  }
};
