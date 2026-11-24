# Third-party notices

Text to Voice includes or adapts the following open-source work.

| Component | Where | Licence | Source |
| --- | --- | --- | --- |
| Kokoro-82M voice model and voices | `model/` | Apache-2.0 | https://huggingface.co/hexgrad/Kokoro-82M |
| Kokoro ONNX export (`kokoro-v1.0.int8.onnx`, `voices-v1.0.bin`) and vocabulary | `model/`, `engine/core.js` | MIT | https://github.com/thewh1teagle/kokoro-onnx |
| kokoro-js (text normalising, phonemising and sentence-splitting code, adapted) | `engine/core.js`, `engine/text.js` | Apache-2.0 | https://github.com/hexgrad/kokoro/tree/main/kokoro.js |
| ONNX Runtime Web 1.20.1 | `engine/ort.min.js`, `engine/ort-wasm-simd-threaded.*` | MIT | https://github.com/microsoft/onnxruntime |
| phonemizer 1.2.1 (npm) | `engine/phonemizer.js` | Apache-2.0 | https://github.com/xenova/phonemizer |
| eSpeak NG, compiled to WebAssembly inside phonemizer | `engine/phonemizer.js` | GPL-3.0-or-later | https://github.com/espeak-ng/espeak-ng |
| mp4-muxer 5.2.2 | `engine/mp4-muxer.js` | MIT | https://github.com/Vanilagy/mp4-muxer |
| webm-muxer 5.1.4 | `engine/webm-muxer.js` | MIT | https://github.com/Vanilagy/webm-muxer |
| Instrument Serif, Atkinson Hyperlegible Next, Atkinson Hyperlegible Mono (loaded from Google Fonts) | `index.html` | SIL Open Font License 1.1 | https://fonts.google.com |

The full licence texts are at the source links above. eSpeak NG is under the GNU General Public License v3; its complete source code is available at the link above.
