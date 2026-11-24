# Text to Voice

Paste any text, pick a voice, press play. The app reads it out loud, highlights each sentence as it goes, and can save the whole thing as an audio file you can play later on your phone.

Everything runs in your browser. No server, no account, no text is sent anywhere.

## What it does

- **Reads text aloud** with 8 natural voices (American and British, women and men)
- **Highlights the sentence** being read; tap or click any sentence to jump to it
- **Keeps playing in the background** when you switch tabs
- **Remembers where you stopped**, even after you close the page, with a "Start over" option
- **Speed control** from 0.7× to 1.5×
- **Save as audio**: makes one `.mp4` (or `.webm`) file of the whole text
- **Works on phones**: phone layout, big buttons, plays through the iPhone silent switch
- Open a `.txt` file, or paste text; your last text and settings are kept

## Run it

It is a plain static site. Serve the folder with any web server (opening `index.html` straight from disk will not work, because browsers block workers and file loading from `file://`):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

To put it online, upload the folder to any static host (GitHub Pages, Netlify, Vercel, S3).

The first time you press play, the browser downloads the voice pack (about 97 MB). It is stored in the browser's cache after that.

## How it works

| Part | What it does |
| --- | --- |
| `index.html` | The whole interface and player |
| `engine/text.js` | Splits text into paragraphs and sentences |
| `engine/core.js` | Turns text into phonemes and model tokens |
| `engine/worker.js` | Runs the voice model in a background worker (2–3 workers on bigger computers) |
| `engine/ort*` | ONNX Runtime Web, which runs the model with WebAssembly |
| `engine/phonemizer.js` | eSpeak NG compiled to WebAssembly, for pronunciation |
| `engine/mp4-muxer.js`, `engine/webm-muxer.js` | Packs the audio into a file when saving |
| `model/kokoro.part0–4.data.wasm` | The Kokoro-82M voice model (8-bit), split into five 19 MB pieces |
| `model/voices.data.wasm` | The 8 voices used by the app |

**About the model files:** the five `kokoro.part*.data.wasm` files are the raw bytes of `kokoro-v1.0.int8.onnx`, cut into pieces and joined back together in the browser. They carry a `.wasm` name only because the host the app was first published on serves a fixed list of file types. The joined file's SHA-256 is `6e742170d309016e5891a994e1ce1559c702a2ccd0075e67ef7157974f6406cb`.

**Playing:** the text is split into short pieces. Workers turn each piece into audio, and the page queues the pieces with natural pauses between sentences and paragraphs using the Web Audio API.

**Saving:** the audio is joined, converted to 48 kHz, and encoded with WebCodecs (AAC in `.mp4` where the browser supports it, otherwise Opus in `.webm`). Browsers without WebCodecs record it in real time instead.

**Inside Claude:** when the page runs as a Claude artifact it also offers four "Instant" Claude voices and saves files through Claude's download prompt. On its own, those voices are hidden and saving uses a normal download.

## Credits and licences

This app is built on open-source work. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the full list and licences.
