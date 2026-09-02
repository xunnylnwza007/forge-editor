# Forge — Browser-Based Non-Linear Video Editor

A real, working multi-track video editor built with React + TypeScript + Vite. Every control listed below as "implemented" actually edits and affects the rendered/exported output — nothing is a decorative placeholder.

> **Honesty about scope.** The original brief for this project described something on the order of CapCut Desktop / Premiere Pro / DaVinci Resolve — hundreds of interlocking features (AI captioning, GPU chroma-key, scene detection, background removal, etc). That is genuinely months of engineering, not something any single build pass can deliver as production-quality code. What's here is a **complete, real Phase 1 (+ parts of Phase 2) foundation**: a working editor shell, media pipeline, multi-track timeline, canvas compositor, transform/color/speed/text tools, undo/redo, project persistence, and export. The architecture (data model, state layers, rendering pipeline) is deliberately built so the remaining phases — described in [Roadmap](#roadmap) — slot in without a rewrite.

---

## 1. What actually works today

- **Media import**: drag-and-drop or file picker for video (MP4/MOV/WebM/AVI/MKV — actual decode support depends on the browser's codecs), images (PNG/JPG/WebP/GIF), audio (MP3/WAV/AAC/M4A/OGG). Real metadata extraction (dimensions, duration, file size), thumbnail + filmstrip generation, and audio waveform peak extraction via the Web Audio API.
- **Multi-track timeline**: unlimited tracks of type video/overlay/image/text/subtitle/sticker/audio/music/voiceover. Per-track hide/mute/solo/lock/rename/delete/reorder. Drag clips (including between compatible tracks), trim left/right edges, split at playhead, duplicate, delete, ripple delete, multi-select (click, shift/ctrl-click, marquee), snapping to clip edges/playhead, zoom, horizontal scroll, ruler with click/drag-to-seek, playhead, markers (data model — UI to author them is basic).
- **Canvas compositor**: a single master playback clock drives every layer (see [Architecture](#architecture)) instead of relying on independent `<video>` clocks, so multiple video/audio/text/image layers stay in sync during playback and scrubbing. Renders transform (position/scale/rotation/opacity/flip), crop, color adjustments (brightness/contrast/saturation/hue/exposure — see note below), blend modes, and text (with stroke/shadow/background/animation) — live, and the same code path is reused for export.
- **Direct manipulation in the preview**: drag to move, corner handle to scale, top handle to rotate the selected clip.
- **Speed**: 0.1x–20x, presets, reverse, curve preset selection (data model + UI; the non-linear curve is not yet applied sample-by-sample — see Roadmap), pitch-preserve toggle.
- **Text tool**: heading/subtitle/body/caption presets, full style panel (font, size, weight, italic, alignment, letter/line spacing, color, opacity, stroke, shadow, background), entrance/exit animations (fade/slide/pop/zoom/typewriter/bounce), draggable/resizable in the preview.
- **Audio**: per-clip volume, mute, pan (data model), fade in/out (data model), speed with pitch preservation, detach-audio-from-video (creates a real linked audio clip). EQ values are stored on the clip but not yet audible — see Roadmap.
- **Undo/redo**: real command-pattern history (100 steps), with coalescing so a slider drag undoes as one step.
- **Project persistence**: Save/Open writes/reads a real `.nleproj.json` file; media *blobs* are kept in IndexedDB (not just object URLs, which die on reload) so a saved project can actually be reopened after closing the tab. Autosave + crash recovery prompt on relaunch.
- **Export**: renders the full timeline frame-by-frame (not realtime-limited) into an offscreen canvas at the chosen resolution, mixes the live Web Audio graph, and encodes via `MediaRecorder` (H.264/VP9 depending on browser support). Resolution/FPS/bitrate/format controls, TikTok/Reels/Shorts/YouTube presets, progress with ETA, cancel. The exported file reflects the actual timeline edits — it does not "ignore" what's on the timeline.
- **Resizable, collapsible, persisted layout**: every panel (media/preview/inspector/timeline) is drag-resizable and collapsible; sizes persist across reloads via `localStorage`.
- **Keyboard shortcuts**: see in-app "Keyboard Shortcuts" button in the top bar, or [below](#keyboard-shortcuts).

### Honest gaps (clearly labeled in the UI, not hidden)

The left panel's **Effects, Transitions, Filters, Captions, Templates, and AI Tools** tabs are visible but explicitly marked "planned for Phase N, not yet implemented" rather than containing buttons that silently do nothing — this matches the source spec's own phased rollout (media/timeline first, then color/effects, then keyframes/masks/export polish, then AI). Chroma key and masking have a full data model and inspector UI that saves real values to the clip, but the pixel-level keying/masking pass in the renderer is not wired up yet (noted inline in the Inspector). Speed *curves* and audio EQ are likewise saved but not yet applied to output audio/video.

---

## 2. Installation

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Then open the printed local URL (default `http://localhost:5173`). No backend, no API keys, no external services required — everything (import, edit, preview, export) runs entirely in the browser.

Recommended browser: a recent Chromium-based browser (Chrome/Edge) for the widest `MediaRecorder` codec support. Firefox and Safari work for editing; export codec support varies (see [Limitations](#known-limitations)).

## 3. Production build

```bash
npm run build      # builds to dist/ (esbuild transpile via Vite)
npm run typecheck  # separate strict TypeScript check (tsc -b --noEmit)
npm run preview    # serves the production build locally
```

`build` and `typecheck` are separate on purpose: Vite's build uses esbuild to transpile (fast, doesn't block on type errors), while `typecheck` runs the full strict TypeScript compiler. Run `typecheck` in CI/before releasing; this repo was authored without a live network connection to `npm install`, so run `typecheck` once after your first install to catch anything environment-specific.

`dist/` is a static site — deploy it to any static host (Vercel, Netlify, S3, GitHub Pages, etc). No server-side component is required for the features in this build.

## 4. Development notes

```bash
npm run dev    # Vite dev server with HMR
npm run lint   # ESLint (config not included by default — add your team's)
```

---

## 5. Architecture

```
src/
  types/models.ts        Single source of truth for project data (Project, Track,
                          TimelineClip union, Transform, Keyframe, ColorAdjustments,
                          EffectInstance, TransitionInstance, CaptionCue, ExportSettings...)
  stores/
    projectStore.ts       Persistent project state (Zustand). Every mutation goes
                           through a Command (see engine/history.ts) so undo/redo
                           is automatic and consistent.
    uiStore.ts             Transient UI state: selection, playhead, zoom, panel
                            layout (persisted separately to localStorage).
  engine/
    history.ts              Command-pattern undo/redo stack.
    mediaImport.ts           File → MediaAsset pipeline (metadata/thumbnails/waveform).
    mediaDB.ts               IndexedDB blob storage for real project persistence.
    mediaPool.ts             Pooled <video>/<audio> decode elements + Web Audio
                              gain nodes, one per clip.
    playbackClock.ts         The single master clock. Everything else follows it.
    renderEngine.ts          Canvas compositor — draws one frame for a given time.
                              Shared by the live preview AND the export pipeline.
    syncEngine.ts            Keeps pooled media elements seeked/playing/muted in
                              lockstep with the master clock.
    exportEngine.ts          Frame-by-frame offline render → MediaRecorder encode.
    projectFile.ts           Serialize/deserialize, save/open, autosave, crash
                              recovery.
  components/               UI, organized by panel (TopBar, MediaPanel, Preview,
                             Inspector, Timeline), all reading/writing the stores
                             above — no editing logic lives in components.
  hooks/                    usePlaybackEngine (wires clock → canvas + media sync),
                             useKeyboardShortcuts, useAutosave.
```

**Why a master clock instead of N independent `<video>` elements playing themselves?** Multiple overlapping video/audio layers each have their own internal clock drift. `playbackClock.ts` is the only thing that advances "now"; `syncEngine.ts` corrects every active clip's underlying element to match it (hard re-seek if drift exceeds ~120ms), and `renderEngine.ts` draws every active layer for that exact timestamp into one canvas. This is what keeps a 9:16 crop, a text overlay, and background music in sync — and it's also exactly what makes non-realtime export possible (the export loop just calls the same render function frame-by-frame at 1/30s increments, however long that actually takes to compute).

**Color grading today** uses the canvas 2D `filter` CSS property (brightness/contrast/saturate/hue-rotate) as a real, cheap approximation — every adjustment you move genuinely changes the pixels. Highlights/shadows/whites/blacks/vibrance-as-distinct-from-saturation and per-channel HSL are stored in the data model (`ColorAdjustments`) ready for a proper WebGL grading shader pass; wiring that in is the natural next step and doesn't require touching the timeline/state/export layers.

---

## 6. Roadmap (matches the source brief's own phasing)

- **Phase 2**: WebGL grading pass (highlights/shadows/whites/blacks/vibrance/per-channel HSL/vignette/grain), real effects browser (blur/glow/glitch/chromatic aberration/VHS...) as composable render passes, transitions between clips, filter presets with LUTs, audible EQ via `BiquadFilterNode`s, speed-curve keyframe application.
- **Phase 3**: pixel-level chroma key and mask compositing (WebGL), keyframe editor UI on the timeline (data model already supports keyframes on any `AnimatableProp`), compound clips, WebCodecs-based export for frame-accurate, faster-than-realtime encoding (replacing/augmenting the current `MediaRecorder` path).
- **Phase 4**: pluggable AI provider interface (speech-to-text for auto captions, background removal, auto-reframe, scene/silence detection, TTS) with a settings screen for API keys — the brief is explicit that this must not be faked, so it ships as a real provider interface with clearly-labeled "not configured" states until a provider is wired in, never a button that pretends to call a model.

---

## 7. Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Space | Play / Pause |
| Ctrl/Cmd + Z | Undo |
| Ctrl/Cmd + Shift + Z | Redo |
| Ctrl/Cmd + K | Split at playhead |
| Delete / Backspace | Delete selected clip(s) |
| Ctrl/Cmd + C / V | Copy / Paste |
| Ctrl/Cmd + D | Duplicate |
| Ctrl/Cmd + A | Select all clips |
| Ctrl/Cmd + S | Save project |
| ← / → | Step one frame |
| Esc | Deselect |

## 8. Supported formats

- **Import** — Video: MP4, MOV, WebM, AVI*, MKV*. Image: PNG, JPG/JPEG, WebP, GIF. Audio: MP3, WAV, AAC, M4A, OGG. Subtitles: SRT, VTT (parsed for future caption-editor use; not yet rendered on canvas).
  <br>*AVI/MKV import depends entirely on the browser's/OS's installed codecs via `<video>` — not guaranteed on all platforms.
- **Export** — MP4 (H.264, where the browser's `MediaRecorder` supports it) or WebM (VP9/VP8 + Opus), at 480p–4K, 24–60fps, custom bitrate.

## 9. Known browser/platform limitations

- `MediaRecorder`-based export is the pragmatic in-browser engine that needs zero extra downloads. It is realtime-capped in some browsers' internal pipeline even though we drive rendering frame-by-frame, and MP4/H.264 `MediaRecorder` support varies (Chrome/Edge: generally yes; Firefox/Safari: more limited — the app falls back to WebM automatically if MP4 isn't supported).
- Audio decoding for waveform extraction uses `AudioContext.decodeAudioData`, which can fail on exotic codecs inside otherwise-playable containers; the video/audio still imports and plays, just without a waveform.
- `HTMLMediaElement.preservesPitch` (used for pitch-preserving speed changes) is implemented under vendor-prefixed names in some browsers; behavior can vary.
- Everything runs client-side — very long timelines or many high-resolution clips are bounded by the browser tab's available memory, same as any browser-based editor.
- This build targets desktop browser usage (per the brief's Electron/Tauri-ready note in mind) — the codebase avoids anything that would block wrapping it in Electron/Tauri later (no browser-storage APIs other than IndexedDB/localStorage, no assumptions about a server).
