# Resonance Scope

A browser-based instrument for measuring **vocal-tract resonance from acoustics alone** — with no
dependence on language. Sing or speak a steady vowel on one pitch: the tool shows a live spectrogram
(the *mirror*) and, on freeze, estimates the vowel's formants and plots it in vowel space (the
*instrument*). Repeated productions of one vowel form a cluster whose tightness is an objective
**reproducibility** score — the acoustic analogue of a subjective "hit-rate."

Part of the Harmonic Systems family of resonance tools.

## What it does

- **Live spectrogram + freeze-to-measure** — one pipeline, two jobs: paint frames live, then freeze a
  windowed average to extract **F1 / F2** (the vocal-tract filter) and plot the point in vowel space.
- **F0 source read-out** — live pitch via the McLeod Pitch Method, shown warm to distinguish the
  *source* (the voice) from the *filter* (the tract that shapes it).
- **Self-calibration** — capture your own /i a u/ point vowels so every measurement is expressed
  *inside your own vowel space* (normalized %, plus descriptive VSA / centralization read-outs).
- **Camera as a second instrument** *(optional)* — on-device face landmarks measure mouth aperture +
  lip spread, a visual reproducibility score that mirrors the acoustic one.
- **Session progress** — per-vowel cluster spread trended across practice sessions.
- **Local JSON export** of your points, and an in-app **glossary** defining every term.
- **Reading / speaking-pitch view** ([`reading.html`](reading.html)) — a simplified page: read a
  built-in passage aloud and see your live pitch, a scrolling contour, and an end-of-reading summary
  (mean speaking F0, range and variability in semitones, % voiced). It measures your *pitch*, never
  your words.

## Privacy — everything stays on your device

Audio and video never leave your device. `getUserMedia` → Web Audio / on-device MediaPipe → local
computation only. There are **no uploads, no servers, no accounts, no analytics, and no network calls
carrying any audio, video, or derived data.** Face landmarks are computed on-device and discarded
frame-to-frame; only two normalized mouth ratios are kept with each frozen point. You can verify it
yourself: open your browser's Network tab and watch for zero requests after the initial page load.

## Honest about its limits

These are features, not fine print. F1/F2 come from peak-picking a smoothed spectrum — honest
first-pass estimates, not clinical LPC; read *movement* and *clustering*, not absolute Hz. Nasality is
a blind spot for mic-only spectrography. The camera sees only mouth openness and spread, not tongue
position or anything inside the tract. And this is **not a diagnostic device** — it never grades you
against a "correct" target; it measures *your own* consistency. The in-app glossary and "honest
limits" notes keep saying so.

## Running it

It's a single static `index.html` — no build, no bundler, nothing to install.

- **Live:** https://harmonicsystems.github.io/resonance-scope/
- **Locally:** the acoustic tool works by opening `index.html` directly. The **optional camera** loads
  a local ES module, which browsers only allow over `http(s)`/`localhost` (not `file://`), so to use
  the camera locally, serve the folder and open it over localhost:
  ```
  python3 -m http.server
  ```
  then visit `http://localhost:8000`. Mic and camera require a user gesture (the Start / Enable
  buttons) and https or localhost — GitHub Pages' https is fine.

## Tech

Vanilla HTML / CSS / JS — Web Audio + Canvas, no framework, no build step. The one dependency, the
optional camera's face landmarking (MediaPipe FaceLandmarker), is **vendored** — committed under
`vendor/mediapipe/` + `models/face_landmarker.task`, not fetched from a CDN — so the on-device
guarantee holds and there is nothing to install.

## License

MIT — see [LICENSE](LICENSE).
