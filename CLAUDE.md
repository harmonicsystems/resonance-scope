# CLAUDE.md — Resonance Scope

Harmonic Systems · *AI · Accessible Information*
GitHub: `harmonicsystems/resonance-scope`

A browser-based instrument for measuring vocal-tract resonance **from acoustics alone**, with no dependence on language. Sing a steady vowel on one pitch; the tool shows a live spectrogram (feedback) and, on freeze, estimates F1/F2 and plots the point in vowel space (measurement). Repeated productions of one vowel form a cluster whose tightness is a reproducibility score.

---

## What this project is (and is not)

- **Is:** a language-independent, anatomy/physiology-based way to characterize *any* human vocal instrument — including voices that are not producing linguistically organized speech. This descends from prior VoiceVision work (spectrographic voice visualization for non-symbolic communicators). The target is the vocal tract as a physical system; a language is only a set of sample points scattered across that space, never the thing being measured.
- **Is not:** a phoneme/speech-recognition tool, a clinical diagnostic device, or a pronunciation grader. Do not add language models, phoneme classifiers, or "correct pronunciation" scoring. That would re-couple the measurement to linguistics — the exact thing this project decouples.

---

## Hard constraints (do not violate)

- **Static-first, build-time-first.** No servers, no backend, no accounts, no auth, no analytics, no telemetry. The whole app is static files served as-is.
- **No build step, no bundler.** The app is a single hand-written `index.html` (vanilla HTML/CSS/JS, Web Audio + Canvas). Keep it framework-free and prefer adding a plain `.js`/`.css` file over a bundler. **One dependency exception:** the optional camera instrument needs robust lip landmarks, which realistically require MediaPipe FaceLandmarker. It is **vendored, not bundled** — committed static assets under `vendor/mediapipe/` (the `vision_bundle.mjs` ES module + `wasm/`) and `models/face_landmarker.task`, loaded via a local ES-module import and `FilesetResolver.forVisionTasks("./vendor/mediapipe/wasm")`. No CDN, no package manager, no build step. Do not add further dependencies without the same bar (real need, vendored locally, runs on-device).
- **Audio *and video* never leave the device.** `getUserMedia` (mic and, optionally, camera) → Web Audio / on-device MediaPipe → local computation only. No uploads, no network calls with audio, video, or derived data. Face landmarks are computed on-device and discarded frame-to-frame; only the two normalized mouth ratios (`ap`, `wd`) are kept with each frozen point. This on-device guarantee is a structural invariant and a user-facing promise; treat it as load-bearing, not a nicety. Verify with the DevTools Network tab: **zero requests after initial load.**
- **Never use Fraunces** (the typeface). Type stack is Space Grotesk (UI/display) + IBM Plex Mono (data/IPA/readouts).
- **Deploy target is GitHub Pages** under the `harmonicsystems` org.

---

## Persistence (migrated — was the artifact `window.storage` gotcha)

Persistence now uses `localStorage` (JSON-serialized) under key `formant:points:v1`. The original
artifact build called `window.storage.get/set` — a Claude-only API, `undefined` in a normal
browser — so points silently never persisted on the real site; that's fixed. Each point record is
`{v, f1, f2, ap?, wd?}`; the `ap`/`wd` (mouth-shape) fields are **additive and optional**, so older
persisted points without them stay valid. Keep the same key and the same graceful-degradation
behavior (app must fully work with persistence disabled — the `try/catch` is load-bearing). If data
ever outgrows `localStorage`, `IndexedDB` is the upgrade path.

---

## Domain model (so you don't re-derive it)

The measurement target is a small set of anatomical "dials." Each maps to a spectrogram feature:

| Dial (anatomy) | Acoustic read-out |
|---|---|
| Tongue height (open↔close) | **F1** (higher F1 = more open) |
| Tongue frontness (back↔front) | **F2** (higher F2 = fronter) |
| Lip rounding | lowers all formants, F2/F3 most |
| Velum (nasal port) | **anti-formants** — *missing* energy; poorly seen on a spectrogram (see Limits) |
| Constriction degree | noise texture: clean bands → frication hash → silent gap + release |
| Larynx / spectral tilt / ring | energy cluster ~2.8–3.4 kHz ("singer's formant", chiaroscuro brightness) |

**Source vs filter.** The spectrogram shows *output = source × filter*. Source = phonation (F0, spectral tilt, harmonic spacing). Filter = the tract resonances (formants). The project's founding move is to isolate the filter. Formant estimation targets the filter; harmonic spacing/tilt (not yet read) would target the source.

**The mirror/instrument reconciliation.** One pipeline (AnalyserNode → FFT frames) serves both: painting frames live = the *mirror*; freezing a windowed average and extracting F1/F2 = the *instrument*. They are the same act plus a bookmark. Do not split them into separate code paths.

**Cluster spread = reproducibility.** Tight F1/F2 clustering across repeated productions of one vowel is the objective analogue of a subjective "hit-rate." This is the core metric; preserve it.

**The camera = a second, independent instrument (not a grader).** The mouth exposes exactly two of the anatomical dials *visibly*: jaw/mouth **aperture** (≈ tongue height ≈ F1 axis) and lip **spread vs. rounding** (width; rounding lowers F2/F3). Tongue frontness and the velum are hidden inside the tract — a camera cannot see them. So the (optional) camera measures a *subset* of the same dials the spectrogram estimates, giving a **visual reproducibility score** that mirrors the acoustic one: at freeze, a normalized mouth descriptor is stored and its per-vowel cluster spread (`mouth ±V`) is reported alongside the acoustic spread, plus a "Mouth-shape map (open × wide)" that is the visual twin of the F1×F2 plot. Descriptor = two ratios normalized by inter-eye distance (`aperture = ‖lip13−lip14‖ / eye-span`, `width = ‖corner61−corner291‖ / eye-span`) so it is distance/pose-invariant and person-relative — read *clustering*, not absolute values, same as the acoustic side. **This is self-consistency, never a comparison to a "correct" shape** — grading the mouth against a target would re-couple to linguistics (see "is not"). The camera code is fully decoupled: a `<script type="module">` owns the camera and exposes only `window.MouthScope.sample()`, which the acoustic freeze handler reads *if present*, so the mic instrument works unchanged with the camera off.

---

## Design tokens (shared across the Harmonic resonance tools)

Keep these consistent with the sibling tools (`resonance-grid`, `varnamala-grid`) so the family reads as one system.

```
--bg:#13121A  --panel:#1C1B25  --panel-2:#232230
--ink:#ECE7DA  --ink-dim:#9A96A8  --ink-faint:#6B6879
--source:#F4B942   /* WARM = phonation / source / voicing-on */
--filter:#57C8BE   /* COOL = vocal tract / resonance / voiceless */
--nasal:#A98BE0    /* violet = velum open */
--scuro:#251B36  --chiaro:#EDE0BE   /* dark→light = vowel back→front (brightness) */
```

Semantic rules: **warm = source, cool = filter** everywhere. **Brightness (scuro→chiaro) encodes vowel frontness** — don't repurpose it for anything else. Minimal chrome, instrument-panel aesthetic (spectrogram/Praat lineage), not an "app" look.

---

## Signal-processing notes

- `fftSize = 4096`, `smoothingTimeConstant ≈ 0.4`. Display capped to ~4 kHz (formants live below this).
- Freeze averages the last ~14 linear-magnitude frames, applies a small bin moving-average, then peak-picks: F1 in ~250–1000 Hz, F2 in ~max(1000, F1+180)–2900 Hz.
- This is **peak-picking, not LPC.** It is honest first-pass estimation and can mistake a strong harmonic for a formant on high or breathy phonation. If accuracy work is requested, the upgrade path is autocorrelation → Levinson-Durbin (LPC) → root-solving, not more heuristics on the FFT.

---

## Honesty requirement

Stated limitations are **features, not disclaimers to be cleaned up.** The UI must keep telling the user: (1) F1/F2 are estimates, read movement/clustering over absolute Hz; (2) nasality is a blind spot for mic-only spectrography (velum signature is missing energy); (3) the camera reads only two visible dials (aperture, spread) as face-normalized *relative* ratios — tongue frontness, lip protrusion (depth), and everything inside the tract stay invisible to it, exactly as nasality stays invisible to the mic. The mouth score is a *partial, complementary* hit-rate, not a fuller or "more correct" measurement, and it never grades against a target. Do not remove or soften these to make the tool look more capable than it is. Overclaiming measurement validity is a correctness bug here.

---

## Known limitations / non-goals

- **Nasality** is not reliably measurable this way — wants a nasometer (nasalance = nasal energy ÷ total), a separate hardware path. Don't fake it from the spectrogram.
- **Camera sees only aperture + lip spread**, face-normalized and relative — not tongue frontness, not protrusion depth, not anything inside the tract. It's a complementary partial signal, not a full picture.
- **Mic in sandboxed iframes** (e.g. Claude artifact preview) may be blocked; the real home is the file served/opened directly. Keep the graceful "download and open in your own browser" fallback message.
- Not multi-speaker, not real-time formant *tracking* (only freeze-frame), no recording/export of audio or video (by design — see on-device invariant).

---

## Roadmap (rough, not committed)

1. ~~**Persistence migration** `window.storage` → `localStorage`.~~ **Done.**
2. ~~**Camera as second instrument** — visual reproducibility score (aperture + lip spread via vendored MediaPipe).~~ **Done.**
3. **Source read-out:** estimate F0 (autocorrelation) and spectral tilt, display alongside F1/F2, so the user can confirm phonation stays constant while resonance varies — closes the loop on the source/filter brief.
4. **LPC formant tracking** to replace peak-picking when accuracy matters.
5. Per-vowel reference calibration (let the user set their own targets rather than the built-in generic ghosts, since F1/F2 vary by vocal-tract length).
6. *(camera, later)* live cross-modal confidence check — flag freezes where the visible mouth openness and the acoustic F1 disagree (catches the "harmonic mistaken for a formant" failure). The descriptor plumbing is already in place.

---

## Dev & deploy

- Run: open `index.html` in a real browser (Chrome/Safari). Mic requires a user gesture (Start) and https or localhost — GitHub Pages https is fine.
- **`file://` caveat (changed with the camera feature):** the camera lives in a `<script type="module">` that imports the local `vendor/mediapipe/vision_bundle.mjs`, and browsers only load module imports over `http(s)`/`localhost`, **not `file://`** (Chrome blocks it as CORS). So for local dev with the camera, serve the folder: `python3 -m http.server` then open `localhost:8000`. The **acoustic** tool (classic script) still works fine from `file://`; only the camera needs a served context, and it degrades gracefully (button just won't wire up). GitHub Pages serves everything over https, so production is unaffected.
- Repo layout: `index.html` (the app) + vendored `vendor/mediapipe/` (~19 MB WASM + ES module) + `models/face_landmarker.task` (~3.7 MB). These are committed static assets — no install, no package manager, no build, no CI. A plain HTML/JS linter is enough if a static check is ever wanted.
- Deploy: push to `harmonicsystems/resonance-scope`, serve `/` via Pages.

---

*Draft — correct anything that misstates a convention. Assumptions I made and you should verify: repo name `resonance-scope`, single-file `index.html` structure for now, and localStorage (not IndexedDB) as the persistence target.*