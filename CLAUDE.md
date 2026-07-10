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
`{v, f1, f2, t, ap?, wd?, f0?, f0c?, fb?}`: `t` = capture time (`Date.now()` ms, turns the point set
into a time series for longitudinal tracking); `ap`/`wd` (mouth-shape), `f0`/`f0c` (pitch +
confidence), and `fb` (`true` when the formant pick fell back to plain-max — a low-confidence quality
flag, surfaced as a **hollow** marker on the vowel-space plots) are all **additive and optional**, so
older persisted points without them stay valid. Every consumer guards on the field's presence
(`typeof p.<field>==='number'`, or `p.fb`) — follow that pattern for any new field. Keep the same key and the same graceful-degradation
behavior (app must fully work with persistence disabled — the `try/catch` is load-bearing). If data
ever outgrows `localStorage`, `IndexedDB` is the upgrade path.

**Calibration is stored separately** under `formant:calib:v1`: `{ i:{f1,f2,ap?,wd?}, a:{…}, u:{…} }`.
Load/save mirror `loadPts`/`savePts`. **Load-bearing invariant: points stay raw Hz; normalize on the
fly.** Never rewrite stored points into normalized coordinates — normalization is computed at render
time from the anchors (`n1/n2/nap/nwd`), so recalibrating re-projects every existing point with zero
data loss and the app still works with calibration absent (falls back to raw-Hz view + generic ghosts).

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

**F0 = the source read-out (the first source parameter shown).** Everything else in the tool is filter (F1/F2, VSA/FCR) or a filter-adjacent visual proxy (mouth). F0 (vocal-fold rate) is the **source**, rendered **warm** (`--source`) next to the cool filter values — that color contrast literally draws the source × filter split. It has its own **time-domain** path (`getFloatTimeDomainData` → `detectF0()`), because the display FFT's ~11.7 Hz bins are far too coarse for pitch. Algorithm: **McLeod Pitch Method (NSDF)** with key-maximum peak-pick + parabolic interpolation (sub-Hz); the NSDF peak height is a bounded **clarity** confidence that gates voiced/unvoiced (hysteresis: enter 0.93, stay 0.80) — silence/breath/creak read a blank "—", never a fabricated number. Search range 65–500 Hz (65 ≈ C2), N = full `fftSize` (4096 ≈ 85 ms), detection throttled to every 3rd frame. F0 is sampled at freeze (`sampleF0()`, confidence-weighted mean of the ring, mirroring `MouthScope.sample()`) and stored additively as `f0`/`f0c` on the point record (older points without them stay valid). **In a cluster, F0 spread is a pitch-*stability* / confound check, NOT a reproducibility score** — it answers "did I hold pitch while varying the vowel?"; high drift (shown in **cents**) cautions that a wide F1/F2 cluster may just be pitch wobble. The note name in the readout (`218 Hz (A3)`) is a display convenience, never stored and never a target. F0 also lays the groundwork for the harmonic-collision flag (roadmap #6).

**Self-calibration = speaker normalization to the user's own /i a u/.** Raw F1/F2 in Hz aren't a meaningful scale — they shift with vocal-tract length (across people) and mic distance/session (within one). The fix: capture the user's own **point vowels /i/, /a/, /u/** (the acoustic corners of the vowel space, the same anchors clinical VSA/centralization use) and express every measurement as a position *inside their own space* via per-axis range normalization (Gerstman-style): `n1=(F1−min(F1i,F1u))/(F1a−min(F1i,F1u))` (0 close…1 open), `n2=(F2−F2u)/(F2i−F2u)` (0 back…1 front); mouth axes get the same treatment (`nap`/`nwd`). Capture is *held-average-until-stable*: sustain each corner, a steadiness meter = inverse `std` of the live estimate auto-locks the anchor. When calibrated, the plots switch to a normalized 0–1 space with the user's own anchors at the corners (the generic ghosts retire), cluster spread reports as **% of the user's own range**, and a descriptive **VSA** (triangle area) + **FCR** (centralization) card appears. A view toggle peeks back at raw Hz. **Anchors are the user's OWN vowels, never a "correct" target, and VSA/FCR are descriptive, never diagnostic** — this is the same self-referential move as the camera, applied to the acoustic axis. This is why the tool normalizes both instruments now: the camera was already person-relative; calibration makes the mic match.

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
- **F0 (source) is a separate time-domain path** — `detectF0()` uses the McLeod Pitch Method (NSDF) on `getFloatTimeDomainData`, NOT the FFT (bins are ~11.7 Hz, useless for pitch). N = full `fftSize` (4096), lag range 65–500 Hz, key-maximum peak-pick + parabolic interpolation (sub-Hz), NSDF clarity as the voiced/unvoiced gate, ~20 Hz detection with median+EMA smoothing. Tuning constants live at the top of the audio block (`F0_MIN/MAX`, `MPM_K`, `CLARITY_ENTER/STAY`, `RMS_MIN`, `F0_RING/EMA`, `PITCH_EVERY`). Do **not** raise `fftSize` for pitch — it's tuned for formants; F0 has its own window.

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
3. ~~**Per-vowel reference calibration** — normalize the vowel space to the user's own /i a u/ (VSA/FCR read-outs).~~ **Done.**
4. ~~**Source read-out** — live F0 (pitch) alongside F1/F2, so the user can confirm phonation held constant while resonance varied.~~ **Done** (F0 only; spectral tilt not yet read).
5. **LPC formant tracking** to replace peak-picking when accuracy matters — the biggest accuracy lever now; normalization fixed the *scale*, LPC would fix the *estimate*.
6. **Harmonic-collision flag** — F0 is now stored per point, so flag when a picked F1/F2 lands on n·F0 (the "harmonic mistaken for a formant" failure). Needs tolerance tuning to avoid false alarms; the plumbing (`f0`/`f0c`, freeze-site comment) is in place.
7. *(camera, later)* live cross-modal confidence check — the visual analogue of #6: flag freezes where the visible mouth openness and the acoustic F1 disagree.
8. Live formant *tracking* + distance-to-your-anchor read-out — turn freeze-and-check into a fluid aim-and-land practice loop (rides on calibration).
9. Spectral tilt / harmonic richness — the other half of the source read-out (#4 did F0 only).

---

## Dev & deploy

- Run: open `index.html` in a real browser (Chrome/Safari). Mic requires a user gesture (Start) and https or localhost — GitHub Pages https is fine.
- **`file://` caveat (changed with the camera feature):** the camera lives in a `<script type="module">` that imports the local `vendor/mediapipe/vision_bundle.mjs`, and browsers only load module imports over `http(s)`/`localhost`, **not `file://`** (Chrome blocks it as CORS). So for local dev with the camera, serve the folder: `python3 -m http.server` then open `localhost:8000`. The **acoustic** tool (classic script) still works fine from `file://`; only the camera needs a served context, and it degrades gracefully (button just won't wire up). GitHub Pages serves everything over https, so production is unaffected.
- Repo layout: `index.html` (the app) + vendored `vendor/mediapipe/` (~19 MB WASM + ES module) + `models/face_landmarker.task` (~3.7 MB). These are committed static assets — no install, no package manager, no build, no CI. A plain HTML/JS linter is enough if a static check is ever wanted.
- Deploy: push to `harmonicsystems/resonance-scope`, serve `/` via Pages.

### Debugging (local-only — never telemetry)

A developer harness lives in a small classic `<script>` in `<head>`, **off by default**. Enable with
`?debug=1` or `localStorage['rs:debug']='1'`. It is strictly local (console + on-screen HUD) — it
must never send anything off-device; that would be telemetry, which the hard constraints forbid.

- **`window.RS`** API: `RS.log(tag, …)` / `RS.warn(tag, …)` (namespaced console lines, `log` is a
  no-op unless debug), `RS.set(section, obj)` feeds the HUD/snapshot (no-op unless debug),
  `RS.snapshot()` returns the current state object (call it in the console).
- **HUD**: a fixed corner overlay (filter teal, monospace) showing live `audio` (sr, binHz, maxBin,
  fps, level, frames), `cam` (face, ap, wd, buf, detectMs), and `store` (points).
- **Egress guard** (debug only): wraps `fetch`/`XHR`/`sendBeacon`/`WebSocket`. **Same-origin passes
  silently** (our vendored assets must keep loading); **cross-origin fetch/XHR is warned + blocked**
  and beacons/sockets are blocked outright. Nothing in the app calls out, so it should stay silent
  forever — a fire means something is exfiltrating. In non-debug mode the guard is not installed, so
  it never changes production behavior.
- The mic **Start** button is a toggle (Start ↔ Stop microphone); `stopMic()` stops tracks, closes
  the AudioContext, clears the rolling window, and disables Freeze. The camera button toggles the
  same way (Enable ↔ Disable). The two instruments are independent — stopping one leaves the other.

---

*Draft — correct anything that misstates a convention. Assumptions I made and you should verify: repo name `resonance-scope`, single-file `index.html` structure for now, and localStorage (not IndexedDB) as the persistence target.*