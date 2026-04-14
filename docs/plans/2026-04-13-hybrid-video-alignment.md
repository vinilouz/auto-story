# Hybrid Video Alignment — Mixed Clip/Image Preview

## Problem

In the video-story flow, preview generation is gated on a binary check:
- ALL segments have `videoClipUrl` → `"video"` alignment
- ANY segment missing `videoClipUrl` → `"image"` alignment (ignores available clips)

If some clips are ready and others still processing, `useVideo.ts:93` throws an error
(`"Segment X has no videoClipUrl but alignmentMode is 'video'"`), and the entire
preview fails. User sees nothing until every clip finishes.

## Required Behavior

Allow preview/render with a mix of video clips and static images:
- Segments with `videoClipUrl` → render as video clip
- Segments without → render as static image (imageUrl) with Ken Burns effect
- Fixed 8s duration per segment in video flow (configurable)
- Manual re-trigger only (no auto-refresh)

## Architecture Overview

### Why HybridAlignmentStrategy (not patch existing strategies)

The existing `ContinuousAlignmentStrategy` assumes ALL segments are video clips —
it loads video metadata per segment and throws if any is missing. Patching it with
conditionals creates tangled logic. Instead, a new strategy that natively handles
mixed media types is cleaner and extensible for future media (components, etc.).

### Why fixed duration instead of loaded metadata

The user confirmed: in video flow, every segment is exactly 8s. Loading video metadata
to discover duration is unnecessary overhead. Use a fixed `FIXED_CLIP_DURATION_SECONDS`
constant (default 8). For segments with videoClipUrl, optionally load metadata to
validate the clip is ~8s (log warning, don't block). For segments without videoClipUrl,
use 8s directly — no media element creation needed.

### Why not change Scene.tsx

Scene.tsx already implements the exact fallback needed: checks `scene.videoClipUrl`
first, falls back to static image with Ken Burns. Zero changes required there.

## Tech Stack

- TypeScript, React (existing)
- Remotion (OffthreadVideo, Img, interpolate, TransitionSeries)
- No new dependencies

## Data Models

### New Constant

```typescript
// src/lib/video/constants.ts (or inline in aligner.ts)
const FIXED_CLIP_DURATION_SECONDS = 8; // configurable per-call
```

### Updated Type

```typescript
// src/lib/video/aligner.ts
export type AlignmentMode = "image" | "video" | "hybrid";
```

- `"image"` — existing PrecisionAlignmentStrategy (no changes)
- `"video"` — existing ContinuousAlignmentStrategy (no changes, backward compat)
- `"hybrid"` — new HybridAlignmentStrategy (mixed clips + images)

### Unchanged Types

- `VideoScene` — `videoClipUrl?: string` already optional, Scene.tsx handles fallback
- `RemotionVideoProps` — no changes
- `Segment` — no changes

## Component Design

### Data Flow

```
useStoryFlowActions.generateVideoPreview()
  ↓ (removes binary .every() check, uses "hybrid" mode)
useVideo.generate()
  ↓ (fixed 8s for missing clips, loads video only for segments with videoClipUrl)
alignVideoProps(segments, ..., mode="hybrid", fixedClipDuration=8)
  ↓
HybridAlignmentStrategy.align()
  ↓ (per segment: has videoClipUrl → video scene, else → image scene)
  ↓ (all segments: 8s natural, playbackRate 0.92 for video, Ken Burns for image)
RemotionVideoProps → TransitionSeries → Scene.tsx
  ↓ (per scene: videoClipUrl → OffthreadVideo, else → Img with Ken Burns)
```

### HybridAlignmentStrategy Logic

```
for each segment:
  naturalDuration = fixedClipDuration (8s)
  slowedDuration = naturalDuration / PLAYBACK_RATE (8/0.92 ≈ 8.696s)
  slowedFrames = round(slowedDuration * fps) ≈ 209
  naturalFrames = round(naturalDuration * fps) = 192
  transitionFrames = slowedFrames - naturalFrames ≈ 17

  if segment.videoClipUrl:
    scene.videoClipUrl = segment.videoClipUrl
    scene.playbackRate = 0.92
    scene.effect = "static"
  else:
    scene.videoClipUrl = undefined
    scene.playbackRate = undefined
    scene.effect = random(["zoom-in", "zoom-out", "pan-left", "pan-right"])

  scene.durationInFrames = slowedFrames
  scene.transition = { type: rotate(["fade","wipe","slide"]), durationInFrames: transitionFrames }

totalAudioFrames = sum of audio durations
totalVideoFrames = N * slowedFrames - (N-1) * transitionFrames
assert totalAudioFrames <= totalVideoFrames
totalFrames = totalAudioFrames
```

## Task Breakdown

### T001 — Create HybridAlignmentStrategy and update alignVideoProps dispatch

**What:** Add `HybridAlignmentStrategy` class in `aligner.ts`. Update `AlignmentMode`
type to include `"hybrid"`. Update `alignVideoProps()` to accept `fixedClipDuration`
parameter and dispatch to the new strategy when `mode === "hybrid"`.

**Files:**
- `src/lib/video/aligner.ts` — add HybridAlignmentStrategy class, update AlignmentMode type, update alignVideoProps function signature and dispatch

**Implementation details:**
1. Add `HybridAlignmentStrategy` class implementing `AlignmentStrategy`
2. Accept `fixedClipDuration` (default 8) in context
3. Per segment: determine if video or image, set scene properties accordingly
4. Use same transition logic as ContinuousAlignment (PLAYBACK_RATE = 0.92)
5. Audio tracks and captions: same logic as ContinuousAlignment
6. Validate totalAudioFrames <= totalVideoFrames
7. Update `AlignmentMode = "image" | "video" | "hybrid"`
8. Update `alignVideoProps()` to pass `fixedClipDuration` through and dispatch hybrid

**Dependencies:** None

**Acceptance criteria:**
- [ ] `HybridAlignmentStrategy` class exists and compiles
- [ ] `alignVideoProps()` accepts `mode="hybrid"` and `fixedClipDuration` param
- [ ] For segments with videoClipUrl: scene has videoClipUrl, playbackRate=0.92, effect="static"
- [ ] For segments without videoClipUrl: scene has no videoClipUrl, no playbackRate, effect=random Ken Burns
- [ ] All segments get identical durationInFrames (based on fixedClipDuration / PLAYBACK_RATE * fps)
- [ ] Transitions calculated correctly (slowedFrames - naturalFrames)
- [ ] Total duration validation passes when audio <= video

---

### T002 — Update useVideo.ts generate() for mixed segments

**What:** Remove the hard rejection when a segment lacks `videoClipUrl` in video
alignment mode. Instead, use `FIXED_CLIP_DURATION_SECONDS` (8) for segments without
video clips. Only load video metadata for segments that have `videoClipUrl`. Pass
`fixedClipDuration` through to `alignVideoProps`.

**Files:**
- `src/lib/flows/hooks/useVideo.ts`

**Implementation details:**
1. Lines 88-120 (videoDurations loading): instead of rejecting on missing videoClipUrl,
   resolve with 0 (or skip entirely — hybrid strategy uses fixed duration)
2. Remove the `if (alignmentMode === "video")` rejection block (lines 93-98)
3. For segments with videoClipUrl: load metadata as before (for optional validation)
4. For segments without: resolve immediately with 0 (duration comes from fixedClipDuration)
5. Pass `fixedClipDuration: 8` to `alignVideoProps()` call
6. When mode is "hybrid", videoDurations array is not needed by the strategy — the
   strategy uses fixedClipDuration. Keep backward compat for "video" mode.

**Dependencies:** T001 (needs HybridAlignmentStrategy + updated alignVideoProps signature)

**Acceptance criteria:**
- [ ] `generate()` no longer throws when a segment lacks `videoClipUrl`
- [ ] Segments with `videoClipUrl` still load video metadata (for validation/logging)
- [ ] Segments without `videoClipUrl` skip video metadata loading, use 0 duration
- [ ] `fixedClipDuration` parameter passed to `alignVideoProps()`
- [ ] Existing "image" and "video" modes still work (backward compat)

---

### T003 — Update useStoryFlowActions.ts to use hybrid alignment

**What:** Replace the binary `segments.every((s) => !!s.videoClipUrl)` check with
`"hybrid"` alignment mode for video flow. This allows preview generation regardless
of how many clips are ready.

**Files:**
- `src/components/story-flow/useStoryFlowActions.ts`

**Implementation details:**
1. In `generateVideoPreview()` (line 931-933): replace:
   ```typescript
   const alignmentMode = segments.every((s) => !!s.videoClipUrl)
     ? ("video" as const)
     : ("image" as const);
   ```
   with:
   ```typescript
   const alignmentMode = "hybrid" as const;
   ```
2. This means preview always uses hybrid alignment, which handles any mix of clips/images
3. No changes to `renderVideoAction()` — it already uses `video.videoProps` as-is

**Dependencies:** T002 (needs updated useVideo.generate())

**Acceptance criteria:**
- [ ] Preview generates successfully when SOME segments have videoClipUrl and others don't
- [ ] Preview generates successfully when NO segments have videoClipUrl (all images)
- [ ] Preview generates successfully when ALL segments have videoClipUrl (all video)
- [ ] User can click "Generate Preview" multiple times as more clips become available
- [ ] Audio/transcription completeness still required (no change)
- [ ] `setStage("video")` still called on success
