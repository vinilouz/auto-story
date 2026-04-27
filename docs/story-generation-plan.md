# Story Generation System — Recreation Plan

Complete architectural blueprint for rebuilding the story generation system in a new Next.js project.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Flow Modes & Stage Sequences](#2-flow-modes--stage-sequences)
3. [Navigation & State Machine](#3-navigation--state-machine)
4. [AI Provider System](#4-ai-provider-system)
5. [Stage Orchestration Hooks](#5-stage-orchestration-hooks)
6. [Data Types](#6-data-types)
7. [Storage System](#7-storage-system)
8. [Video Alignment Strategies](#8-video-alignment-strategies)
9. [Audio Visualization](#9-audio-visualization)
10. [API Routes Reference](#10-api-routes-reference)
11. [Processors Reference](#11-processors-reference)
12. [Prompts Reference](#12-prompts-reference)
13. [Validation & Edge Cases](#13-validation--edge-cases)
14. [Implementation Order](#14-implementation-order)

---

## 1. System Overview

### Purpose
Multi-stage wizard that transforms text (or audio) into narrated videos with AI-generated images, character consistency, background music, and audio visualization effects.

### Tech Stack
- **Framework**: Next.js 16 App Router
- **Video Engine**: Remotion
- **AI Providers**: LouzLabs API (provider-agnostic via registry pattern)
- **Storage**: File-based (`public/projects/{id}/`)
- **Audio Visualization**: Three.js + WebGL via `@react-three/postprocessing`
- **Linting/Formatting**: Biome

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Presentation                                                │
│  - StoryFlow.tsx (wizard orchestrator)                      │
│  - stages/* (stage components)                              │
│  - useStoryFlowState.ts, useStoryFlowActions.ts             │
│  - RemotionVideo.tsx (video renderer)                       │
│  - audio-viz/* (WebGL audio effects)                        │
├─────────────────────────────────────────────────────────────┤
│  Application                                                 │
│  - hooks/* (useAudio, useVideo, useTranscription, etc.)      │
│  - processors/* (audio-generator, scene-visualizer, etc.)  │
│  - aligner.ts (video alignment strategies)                  │
│  - navigation.ts (stage progression logic)                   │
│  - storage.ts (project persistence)                         │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure                                              │
│  - ai/providers/louzlabs.ts (provider implementation)        │
│  - ai/registry.ts (provider registration)                    │
│  - ai/http-client.ts (HTTP utilities)                        │
│  - ai/queue.ts (batch processing with retries)              │
│  - api/generate/* (API route handlers)                       │
├─────────────────────────────────────────────────────────────┤
│  Domain                                                      │
│  - ai/config.ts (action-to-model mappings)                  │
│  - flows/types.ts (core types)                               │
│  - video/types.ts (video-specific types)                     │
│  - audio/analysis.ts (pure audio analysis)                    │
│  - utils/text.ts (text splitting utilities)                  │
│  - utils/speech.ts (FFmpeg audio processing)                 │
└─────────────────────────────────────────────────────────────┘
```

**Rule**: Domain imports NOTHING from Infrastructure. Infrastructure implements interfaces declared by Domain. Dependency direction is strictly inward.

---

## 2. Flow Modes & Stage Sequences

### Four Workflow Modes

| Mode | Trigger | Description |
|------|---------|-------------|
| `simple` | Default | Text → narrated video, no commentator |
| `commentator` | User selects | Adds AI commentator with personality + appearance |
| `video-story` | User selects | Text → audio → transcription → video (text-first) |
| `from-audio` | User selects | Upload audio → transcription → video (audio-first) |

### Stage Sequences

#### `simple`
```
input → split → descriptions → images → audio → transcription → [music] → video → download
```

#### `commentator`
```
input → commentator → comments → descriptions → images → audio → transcription → [music] → video → download
```

#### `video-story`
```
input → audio → transcription → split → descriptions → images → clips → [music] → video → download
```

#### `from-audio`
```
input (file upload) → transcription → split → descriptions → images → [music] → video → download
```

**Conditional stages**:
- `entities` stage: Only when `consistency: true` (visual character consistency)
- `clips` stage: Only in `video-story` mode
- `music` stage: Only when `musicEnabled: true`

---

## 3. Navigation & State Machine

### NavigationState Interface

Tracks what data exists to determine reachable stages:

```typescript
interface NavigationState {
  hasVideoProps: boolean;      // video rendered
  hasClips: boolean;           // video clips generated
  hasImages: boolean;         // images generated
  hasPrompts: boolean;        // image prompts generated
  hasEntities: boolean;        // entity assets exist
  hasComments: boolean;       // commentator comments exist
  hasAudio: boolean;          // audio batches completed
  hasTranscription: boolean;  // transcription completed
  hasCommentator: boolean;    // commentator configured
  hasSegments: boolean;        // text split into segments
  hasMusic: boolean;          // background music generated
  consistency: boolean;       // visual consistency mode
}
```

### calculateMaxStep(stages, mode, state)

Determines furthest accessible stage index based on existing data.

**Logic per mode** (pseudo-code):

```
if mode === "simple" or "commentator":
  if hasVideoProps → return video stage
  if hasClips → return clips stage
  if hasMusic → return music stage (if enabled)
  if hasTranscription → return video stage (audio-viz)
  if hasAudio → return transcription stage
  if hasImages → return audio stage
  if hasPrompts → return images stage
  if hasSegments → return descriptions stage
  if hasCommentator → return comments stage (commentator mode only)
  if hasComments → return descriptions stage
  return current

if mode === "video-story":
  similar but audio/transcription come before split

if mode === "from-audio":
  transcription required before split
```

### determineInitialStage(mode, project)

Resumes from correct stage when loading existing project:

```
if project has segments with videoClipUrl → clips or video
if project has segments with imagePath → audio
if project has segments with imagePrompt → images
if project has segments → descriptions
if project has transcription → split
if project has audio → transcription
if project has commentator → comments
return input
```

---

## 4. AI Provider System

### Provider Registration Pattern

```typescript
// ai/registry.ts
interface Provider {
  name: string;
  generateText?: Handler<TextRequest, TextResponse>;
  generateImage?: Handler<ImageRequest, ImageResponse>;
  generateAudio?: Handler<AudioRequest, AudioResponse>;
  generateVideo?: Handler<VideoRequest, VideoResponse>;
  generateMusic?: Handler<MusicRequest, MusicResponse>;
  generateTranscription?: Handler<TranscriptionRequest, TranscriptionResponse>;
}

const providers = new Map<string, Provider>();

export function registerProvider(p: Provider): void {
  providers.set(p.name, p);
}

export function getProvider(name: string): Provider | undefined {
  return providers.get(name);
}
```

### Action Dispatch

```typescript
// ai/registry.ts - execute()
export async function execute<A extends ActionType>(
  action: A,
  request: ActionMap[A]["req"],
): Promise<ActionMap[A]["res"]> {
  const config = ACTIONS[action];           // lookup config
  const provider = getProvider(config[0].provider);  // get handler
  const credentials = getCredentials(config[0].provider);  // env vars
  return provider.generateX(request, credentials);  // call handler
}
```

### Action-to-Model Config

```typescript
// ai/config.ts
export const ACTIONS: Record<ActionType, ModelConfig[]> = {
  generateText:       [{ provider: "louzlabs", model: "gemini-3.1-flash-lite-preview" }],
  generateImage:     [{ provider: "louzlabs" }],
  generateAudio:     [{ provider: "louzlabs" }],
  generateVideo:     [{ provider: "louzlabs", clipDuration: 8 }],
  generateMusic:     [{ provider: "louzlabs" }],
  generateTranscription: [{ provider: "louzlabs" }],
};
```

### Credentials Resolution

```typescript
// ai/registry.ts - getCredentials()
export function getCredentials(provider: string): { baseUrl: string; apiKey: string } | null {
  const key = provider.toUpperCase();
  return {
    baseUrl: process.env[`${key}_BASE_URL`],
    apiKey: process.env[`${key}_API_KEY`],
  };
}
// e.g., LOUZLABS_BASE_URL, LOUZLABS_API_KEY
```

### HTTP Client Utilities

```typescript
// ai/http-client.ts

// JSON POST with timeout + debug logging
apiRequest<T>(config: RequestConfig): Promise<T>

// Raw ArrayBuffer response (audio)
apiRequestRaw(config: RequestConfig): Promise<ArrayBuffer>

// Server-Sent Events (video, music streaming)
apiRequestSSE(config: RequestConfig, onMessage: (data) => void): Promise<void>

// Multipart file upload (transcription)
apiRequestMultipart(config: RequestConfig): Promise<T>
```

### Batch Processing

```typescript
// ai/queue.ts - executeBatch()
interface BatchOptions {
  maxRetries?: number;        // default: 4
  concurrency?: number;       // default: 3
  dispatchIntervalMs?: number; // default: 60_000 (1 min between batches)
  onProgress?: (completed, total) => void;
  onResult?: (result: BatchResult) => void;
}

async function executeBatch<A extends ActionType>(
  action: A,
  requests: ActionMap[A]["req"][],
  opts: BatchOptions
): Promise<BatchResult[]>
```

**Error classification for retries**:
- `rate-limit`: HTTP 429
- `server`: HTTP 5xx
- `payload`: HTTP 4xx, 413, 422
- `unknown`: Everything else

**Backoff**: Exponential with max 10s delay

### LouzLabs Provider Endpoints

| Action | Endpoint | Method | Timeout | Response |
|--------|----------|--------|---------|----------|
| `generateText` | `/v1/chat/completions` | POST | default | `{ text: string }` |
| `generateImage` | `/v1/images/generations` | POST | default | `{ b64_json?: string; url?: string }` |
| `generateAudio` | `/v1/audio/speech` | POST | default | `ArrayBuffer` |
| `generateVideo` | `/v1/video/generations` | POST | 300s | SSE → URL |
| `generateMusic` | `/v1/music/generations` | POST | 240s | SSE → URL |
| `generateTranscription` | `/v1/audio/transcriptions` | POST | default | `{ words: [...] }` |

---

## 5. Stage Orchestration Hooks

### useAudio

```typescript
const { batches, setBatches, generate, regenerateBatch, isLoading } = useAudio();

// State: AudioBatch[]
interface AudioBatch {
  index: number;
  text: string;
  status: "pending" | "generating" | "completed" | "error";
  url?: string;
  error?: string;
}
```

**generate()**:
1. Splits text into batches (max 10000 chars each)
2. Calls `POST /api/generate/audio` for each batch concurrently
3. Returns `{ batches }`

### useTranscription

```typescript
const { result, setResult, transcribe, retry, isLoading } = useTranscription();

// State: TranscriptionResult
interface TranscriptionResult {
  url: string;                          // audio file URL
  status: "completed" | "error";
  transcriptionUrl?: string;            // JSON with word timestamps
  error?: string;
}
```

**transcribe()**:
1. Concatenates audio files if multiple batches
2. Calls `POST /api/generate/transcription`
3. Caches result to `.elevenlabs.json`

### useVideoClips

```typescript
const { clipStatuses, generateAll, regenerateClip, isLoading } = useVideoClips();
```

**generateAll()**:
1. Calls `POST /api/generate/video-clips-batch` with SSE
2. Streams results: `{ type: "result", index, status, videoUrl?, error? }`
3. Patches segment clip URLs as they complete

**Streaming response format**:
```typescript
{ type: "result", index, status: "success"|"error", videoUrl?, error? }
{ type: "done", total, success, failed }
```

### useVideo

```typescript
const { videoProps, generate, render, isGenerating, isRendering, renderProgress } = useVideo();
```

**generate() workflow**:
1. Validates transcription exists
2. Loads transcription words
3. Gets audio durations via `<audio>` element metadata
4. Optionally validates video clips (hybrid mode)
5. Gets video durations
6. Calls `alignVideoProps()` with alignment mode
7. Sets `RemotionVideoProps` state

**render() workflow**:
1. `POST /api/render` with SSE streaming
2. Parses progress events
3. On complete: triggers download

### useProject

```typescript
const { projectId, setProjectId, load, save, isSaving } = useProject();
```

**Queue-based saving**: Uses `saveQueue` ref to serialize saves, preventing race conditions.

### useDownload

```typescript
const { downloadZip, isDownloading } = useDownload();
```

Calls `POST /api/generate/zip` to bundle project.

---

## 6. Data Types

### Flow Types (`src/lib/flows/types.ts`)

```typescript
interface Segment {
  text: string;
  type?: "scene_text" | "comment";     // commentator flow only
  entities?: string[];                 // linked entity names
  imagePrompt?: string;                 // AI-generated image prompt
  imagePath?: string;                   // path to generated image
  videoClipUrl?: string;                // generated video clip URL
  startMs?: number;                     // audio time window start
  endMs?: number;                       // audio time window end
}

interface EntityAsset {
  name: string;
  description?: string;
  segment?: number[];                   // which segments this entity appears in
  imageUrl?: string;
  status: "pending" | "generating" | "completed" | "error";
}

interface AudioBatch {
  index: number;
  text: string;
  status: "pending" | "generating" | "completed" | "error";
  url?: string;
  error?: string;
}

interface TranscriptionResult {
  url: string;
  status: "completed" | "error";
  transcriptionUrl?: string;
  error?: string;
}

interface TranscriptionWord {
  text: string;
  startMs: number;
  endMs: number;
}

interface CommentatorConfig {
  id: string;
  name: string;
  personality: string;
  appearance: {
    type: "upload" | "generated";
    imageUrl?: string;
    imagePrompt?: string;
  };
  voice?: string;
}
```

### Video Types (`src/lib/video/types.ts`)

```typescript
interface VideoScene {
  id: string;
  imageUrl: string;
  videoClipUrl?: string;
  startFrame: number;
  durationInFrames: number;
  effect: "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "static";
  playbackRate?: number;               // for slowed playback
  transition?: {
    type: "fade" | "slide" | "wipe" | "none";
    durationInFrames: number;
  };
  textFragment?: string;
  debug?: SceneDebugInfo;
}

interface AudioTrackConfig {
  src: string;
  startFrame: number;
  durationInFrames: number;
  volume?: number;
}

interface Caption {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs?: number;
}

interface RemotionVideoProps {
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  scenes: VideoScene[];
  audioTracks: AudioTrackConfig[];
  captions: Caption[];
  captionStyle?: CaptionStyle;
  videoVolume?: number;
  musicSrc?: string;
  musicVolume?: number;
  musicCompressor?: boolean;
  transitionOverride?: string;
  audioViz?: AudioVizConfig;
}
```

### Audio Visualization Types

```typescript
interface FrequencyBands {
  subBass: number;    // 20-60 Hz
  bass: number;        // 60-250 Hz
  lowMid: number;      // 250-500 Hz
  mid: number;         // 500-2000 Hz
  highMid: number;     // 2000-4000 Hz
  presence: number;    // 4000-6000 Hz
  brilliance: number;  // 6000-20000 Hz
}

interface BeatResult {
  isBeat: boolean;
  intensity: number;
}

interface AudioAnalysisData {
  bands: FrequencyBands;
  beat: BeatResult;
  smoothedFrequencies: number[];
}

interface AudioVizConfig {
  enabled: boolean;
  effects: AudioVizEffectType[];
  opacity: number;
  color: string;
  proSpectrum: ProSpectrumConfig;
  audioParticles: AudioParticlesConfig;
  smoothWaveform: SmoothWaveformConfig;
  postProcessing: PostProcessingConfig;
  sceneModulation: SceneModulationConfig;
}
```

### Storage Type (`src/lib/storage.ts`)

```typescript
interface ProjectData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  flowType: "simple" | "with-commentator" | "video-story" | "from-audio";
  scriptText: string;
  segmentSize?: number;
  language?: string;
  style?: string;
  voice?: string;
  consistency?: boolean;
  musicEnabled?: boolean;
  segments?: Segment[];
  entities?: EntityAsset[];
  audioUrls?: string[];
  commentator?: CommentatorConfig;
  audioSystemPrompt?: string;
  audioBatches?: AudioBatch[];
  transcriptionResult?: TranscriptionResult;
  videoModel?: string;
  music?: string;
}
```

---

## 7. Storage System

### Directory Structure

```
public/projects/{id}/
├── config.json           # Main project data
├── images/
│   ├── img-0.png         # Segment images
│   ├── img-1.png
│   └── entity-{name}.png # Entity images
├── audios/
│   ├── audio_0.mp3       # Generated audio batches
│   ├── audio_1.mp3
│   └── full_audio.mp3   # Concatenated (for transcription)
├── clips/
│   ├── clip-0.mp4       # Generated video clips
│   └── clip-1.mp4
└── music/
    ├── background.mp4   # Loudness-normalized music
    └── background-raw.mp4 # Original music
```

### Incremental Patch Methods

These update individual fields without full config rewrite:

```typescript
// Patch segment clip URL immediately after save
patchSegmentClip(projectId, segmentIndex, videoClipUrl): Promise<void>

// Patch segment image immediately after save
patchSegmentImage(projectId, segmentIndex, imagePath): Promise<void>

// Patch entity image immediately after save
patchEntityImage(projectId, entityName, imagePath): Promise<void>

// Patch music URL
patchMusic(projectId, musicUrl): Promise<void>
```

**Why**: Ensures data persists even if SSE connection drops.

### Base64 Extraction

```typescript
// Detects data:image/...;base64,... format
// Converts to PNG/JPG file
// Returns public path like /projects/{dirName}/images/{fileName}
extractBase64(base64Url, imagesDir, dirName, fileName): Promise<string | null>
extractSegmentImage(base64Url, imagesDir, dirName, index): Promise<string | null>
extractEntityImage(base64Url, imagesDir, dirName, entityName): Promise<string | null>
```

### Project Save Flow

```typescript
async saveProject(project: ProjectData): Promise<string> {
  // 1. Extract base64 images to files
  // 2. Convert segment imagePath from base64 to file paths
  // 3. Convert entity imageUrl from base64 to file paths
  // 4. Write config.json atomically
}
```

---

## 8. Video Alignment Strategies

### Strategy Pattern

```typescript
interface AlignmentStrategy {
  align(context: AlignmentContext): RemotionVideoProps;
}

type AlignmentMode = "image" | "video" | "hybrid";
```

### 1. PrecisionAlignmentStrategy (Image-based)

Used when `mode === "image"`. All segments have images, no video clips.

**Pipeline**:

1. **Flatten Transcription** (`flatten-transcription.ts`)
   - Converts word timestamps to global offsets
   - Creates `AudioTrackConfig[]` for each audio batch
   - Returns `{ allWords, audioTracks, totalAudioDurationSeconds }`

2. **Find Anchors** (`find-segment-timings.ts`)
   - Uses Levenshtein distance to match segment text to transcription words
   - `findSegmentStartWithConfidence()`: Anchors on first 1-3 words (60% threshold)
   - `findSegmentEndWithConfidence()`: Anchors on last 1-5 words (60% threshold)
   - Gap-filling: Proportional distribution when matches not found

3. **Generate Scenes** (`generate-scenes.ts`)
   - Converts time-based to frame-based
   - Assigns effects (zoom-in/out, pan-left/right) in rotation
   - Assigns transitions (fade/wipe/slide) in rotation
   - 30-frame transition duration (15 frames in/out)

### 2. ContinuousAlignmentStrategy (Video-based)

Used when `mode === "video"`. All segments have video clips.

**Key formula**:
```typescript
slowedDuration = naturalDuration / 0.92  // ~8.7% longer playback
transitionFrames = slowedFrames - naturalFrames  // fills the gap
```

### 3. HybridAlignmentStrategy (Mixed)

Used when `mode === "hybrid"`. Some segments have clips, some don't.

**Behavior**:
- Segments WITH `videoClipUrl`: Use `playbackRate: 0.92` slowdown
- Segments WITHOUT `videoClipUrl`: Apply Ken Burns effects (zoom-in/out, pan)

### Text Matching

```typescript
interface Word {
  text: string;
  startMs: number;
  endMs: number;
}

interface FlattenedWord extends Word {
  originalIndex: number;
  batchIndex: number;
  globalStart: number;  // seconds from start
  globalEnd: number;
}

// Normalization
normalize(text: string): string  // lowercase, remove punctuation, collapse whitespace

// Matching
isWordMatch(a: string, b: string): boolean
// Exact match OR Levenshtein distance <= 2 for words > 3 chars

// Finding segment boundaries
findSegmentStartWithConfidence(words, segmentText, threshold = 0.6): { start, confidence }
findSegmentEndWithConfidence(words, segmentText, threshold = 0.6): { end, confidence }
```

### Alignment Mode Selection

```typescript
const alignmentMode = (hasAnyClip ? "hybrid" : "image") as AlignmentMode;
// If ANY segment has a video clip → hybrid
// Otherwise → image (precision)
```

---

## 9. Audio Visualization

### Architecture

WebGL effects rendered in Remotion composition via Three.js.

### Analysis Pipeline (`src/lib/audio/analysis.ts`)

Pure domain function, no framework imports.

```typescript
function computeAudioAnalysis(
  rawFrequencies: number[],
  outputBars: number,
  previousSmoothed: number[],
  beatCooldown: number,
  fps: number,
): AudioAnalysisResult
```

**Constants**:
- `FFT_SIZE = 256`
- `OUTPUT_BARS = 64`
- `windowInSeconds = 10`

**Steps**:

1. **Logarithmic Frequency Mapping** (`mapLogFrequencies`)
   - Maps linear FFT bins to logarithmic scale (20Hz-20kHz)
   - Applies A-weighting for perceptual loudness

2. **Attack/Release Smoothing** (`smoothAttackRelease`)
   - Attack: 10ms time constant
   - Release: 80ms time constant
   - Exponential smoothing

3. **7-Band Extraction** (`extractBandsFromLogSpaced`)
   - Sub-bass: 20-60 Hz
   - Bass: 60-250 Hz
   - Low-mid: 250-500 Hz
   - Mid: 500-2000 Hz
   - High-mid: 2000-4000 Hz
   - Presence: 4000-6000 Hz
   - Brilliance: 6000-20000 Hz

4. **Beat Detection** (`detectBeat`)
   - Threshold: 1.4 (bass energy ratio)
   - Cooldown: 100ms
   - Returns `{ isBeat, intensity }`

### Effects Components

#### ProSpectrum.tsx
- 64 instanced mesh bars with BoxGeometry
- Rounded-top SDF-style (achieved via material)
- Beat-reactive pulse animation
- Mirror reflection below bar
- Configurable position: top/bottom/center
- Color gradient from configured color to white

#### AudioParticles.tsx
- 800 GPU-driven particles in 3D simplex noise field
- Custom vertex/fragment shaders
- Bass-triggered burst emissions on beat
- Size modulated by mid-frequency energy
- Additive blending

#### SmoothWaveform.tsx
- Canvas 2D rendering (not Three.js)
- Catmull-Rom spline interpolation through frequency bins
- Gradient stroke with glow effect
- Position: top/center/bottom

#### PostProcessingStack.tsx
Using `@react-three/postprocessing`:
- **Bloom**: Bass-reactive intensity (threshold 0.6)
- **ChromaticAberration**: Beat-triggered (intensity ×3)
- **Vignette**: Bass-reactive darkness

### Configuration Schema

```typescript
interface AudioVizConfig {
  enabled: boolean;
  effects: ("pro-spectrum" | "audio-particles" | "smooth-waveform" | "post-processing" | "scene-modulation")[];
  opacity: number;
  color: string;

  proSpectrum: {
    barCount: number;
    cornerRadius: number;
    gap: number;
    maxHeight: number;
    reflectionOpacity: number;
    glowIntensity: number;
    position: "bottom" | "top" | "center";
  };

  audioParticles: {
    count: number;
    noiseScale: number;
    trailLength: number;
    turbulence: number;
    baseSize: number;
    maxSize: number;
  };

  smoothWaveform: {
    position: "center" | "bottom" | "top";
    splineTension: number;
    glowIntensity: number;
    thicknessScale: number;
    colorMapping: "frequency" | "amplitude" | "fixed";
  };

  postProcessing: {
    bloomIntensity: number;
    bloomThreshold: number;
    chromaticOffset: number;
    vignetteDarkness: number;
  };

  sceneModulation: {
    zoomIntensity: number;
    panIntensity: number;
  };
}
```

---

## 10. API Routes Reference

### Text Processing

| Route | Handler | Purpose |
|-------|---------|---------|
| `POST /api/generate/split` | split/route.ts | Text → sentence-split segments |
| `POST /api/generate/descriptions` | descriptions/route.ts | Generate image prompts |

### Image & Entity

| Route | Handler | Purpose |
|-------|---------|---------|
| `POST /api/generate/images` | images/route.ts | Single/batch image generation |
| `POST /api/generate/entities` | entities/route.ts | Extract named entities |

### Audio & Transcription

| Route | Handler | Purpose |
|-------|---------|---------|
| `POST /api/generate/audio` | audio/route.ts | Text → audio batches |
| `POST /api/generate/transcription` | transcription/route.ts | Audio → word timestamps |
| `POST /api/upload/audio` | upload/audio/route.ts | Upload audio file |

### Video

| Route | Handler | Purpose |
|-------|---------|---------|
| `POST /api/generate/video-clips` | video-clips/route.ts | Single video clip |
| `POST /api/generate/video-clips-batch` | video-clips-batch/route.ts | Batch video clips (SSE) |
| `POST /api/render` | render/route.ts | Render Remotion video (SSE) |

### Music

| Route | Handler | Purpose |
|-------|---------|---------|
| `POST /api/generate/music` | music/route.ts | Generate music (SSE) |
| `POST /api/generate/music-prompt` | music-prompt/route.ts | Generate music prompt |
| `POST /api/generate/music/compress` | music/compress/route.ts | Loudness normalization |

### Commentator

| Route | Handler | Purpose |
|-------|---------|---------|
| `POST /api/generate/commentator` | commentator/route.ts | Generate commentator comments |

### Export

| Route | Handler | Purpose |
|-------|---------|---------|
| `POST /api/generate/zip` | zip/route.ts | Bundle project as ZIP |

### Projects

| Route | Handler | Purpose |
|-------|---------|---------|
| `GET/POST /api/projects` | projects/route.ts | List/create projects |
| `GET /api/projects/[id]` | projects/[id]/route.ts | Load specific project |

---

## 11. Processors Reference

Processors are application-layer orchestrators that coordinate domain logic and infrastructure.

### audio-generator.ts

```typescript
async function generateAudio({
  text,
  voice,
  systemPrompt,
  targetBatchIndices,
  projectId
}): Promise<{ batches: AudioBatch[] }>
```

- Splits text via `splitIntoBatches(text, 10000, systemPrompt)`
- Processes batch indices in parallel
- Saves audio via `saveAudio()` if projectId provided
- Falls back to base64 encoding if no projectId

### scene-visualizer.ts

```typescript
async function generateSceneDescriptions(data: SceneVisualizationRequest): Promise<{ segments: Segment[] }>
```

- Batches up to 50 segments per API call
- Uses `BATCH_DESCRIPTIONS_PROMPT` template
- Retries up to 2 times on partial responses
- Maps results back to segment indices

### entity-extractor.ts

```typescript
async function extractEntities(segments: Segment[]): Promise<ExtractedEntity[]>
```

- Single AI call with `EXTRACT_ENTITIES_PROMPT`
- Parses JSON array response
- Returns entities with `type`, `segment[]`, `description`

### commentator.ts

```typescript
async function generateCommentsWithCommentator(data: {
  commentatorDescription: string;
  segments: string[];
}): Promise<{ segments: Segment[] }>
```

- Uses `COMMENTATOR_PROMPT` template
- Falls back to original segments on parse error
- Marks type as "comment" or "scene_text"

### video-clip-generator.ts

```typescript
async function generateVideoClip(req: VideoClipRequest): Promise<{ videoUrl: string }>
async function generateVideoClipBatch(requests, onResult?): Promise<BatchClipResult[]>
```

- Resolves reference images via `resolveImage()`
- Uses `executeBatch()` for batch processing
- Default concurrency: 2
- Default retries: 3

---

## 12. Prompts Reference

All prompts in `src/lib/ai/prompts/prompts.ts`.

### EXTRACT_ENTITIES_PROMPT
Purpose: Identify recurring characters/objects across segments.
Constraints: Modesty protocol, neutral background.

### BATCH_DESCRIPTIONS_PROMPT
Purpose: Generate image prompts from text segments.
Constraints: Entity tagging format `[entity:name]`, modesty protocol, no audio terms (voice, narration, etc.).

### GENERATE_ENTITY_IMAGE_PROMPT
Purpose: Create character image prompt.
Input: Style + entity description.

### GENERATE_SEGMENT_IMAGE_PROMPT
Purpose: Create scene image prompt.
Input: Style + segment description.

### COMMENTATOR_PROMPT
Purpose: Generate commentator commentary text.
Output: JSON array `{ type: "comment" | "scene_text", content: string }`.

### COMMENTATOR_IMAGE_GENERATION_PROMPT
Purpose: Generate commentator reference image.
Constraints: No voice, speaking, or sound effects.

### MUSIC_PROMPT_GENERATOR
Purpose: Generate music description for music AI.
Constraints: 100-300 chars, instrumental only.

### GENERATE_VIDEO_PROMPT
Purpose: Create video clip prompt.
Constraints: No voice, speaking, sound effects.

---

## 13. Validation & Edge Cases

### Text Splitting

**`splitBySentences`**:
- Protects abbreviations: dr., dra., sr., sra., exmo., exma., v.s.a., n.a.
- Breaks at `.` followed by quote or space
- Respects maxLength but overflows if no sentence break found

**`splitIntoBatches`**:
- Preserves speaker context across batches
- Splits mid-sentence as last resort (finds nearest space)
- Re-adds speaker prefix to continuation lines

**`splitTranscriptionByDuration`**:
- Uses word-level timestamps
- Groups words into fixed-duration windows (8 seconds default)
- Respects batch boundaries from completed audio

### Image Generation
- Skips segments with existing `imagePath` unless regenerating
- Falls back to single image generation if batch fails
- Patches segment image immediately after save (SSE safety)

### Video Clip Validation
- In hybrid mode, validates clips are loadable (8s timeout)
- Strips corrupt/inaccessible clips from alignment
- Requires video clips for continuous alignment mode

### Audio Duration
- 8-second timeout for metadata loading
- Graceful rejection of zero-duration audio

---

## 14. Implementation Order

### Phase 1: Foundation
1. Set up Next.js 16 project with App Router
2. Install dependencies: Remotion, Three.js, @react-three/postprocessing, zod
3. Configure Biome for lint/format
4. Set up environment variables for AI provider

### Phase 2: AI Provider System
1. Create domain types (`src/lib/ai/config.ts`)
2. Create provider registry (`src/lib/ai/registry.ts`)
3. Create HTTP client utilities (`src/lib/ai/http-client.ts`)
4. Create LouzLabs provider implementation
5. Create batch processor with retry logic (`src/lib/ai/queue.ts`)

### Phase 3: Core Types
1. Define flow types (`src/lib/flows/types.ts`)
2. Define video types (`src/lib/video/types.ts`)
3. Define audio visualization types

### Phase 4: Storage System
1. Create project storage service (`src/lib/storage.ts`)
2. Implement incremental patch methods
3. Implement base64 extraction utilities

### Phase 5: Text Processing
1. Implement text splitting utilities (`src/lib/utils/text.ts`)
2. Create split API route
3. Create descriptions API route + processor
4. Create prompts library

### Phase 6: Image Generation
1. Create image API route
2. Create entities API route + extractor processor
3. Implement image persistence

### Phase 7: Audio & Transcription
1. Create audio API route + processor
2. Create transcription API route
3. Implement audio concatenation utility

### Phase 8: Video Pipeline
1. Create video clip API routes
2. Implement alignment strategies (`src/lib/video/aligner.ts`)
3. Create Remotion composition

### Phase 9: Music
1. Create music prompt generator
2. Create music generation API route
3. Implement loudness compression

### Phase 10: Wizard UI
1. Create story flow orchestrator
2. Implement navigation logic
3. Create all stage components
4. Wire up hooks

### Phase 11: Audio Visualization
1. Implement audio analysis pipeline
2. Create WebGL effect components
3. Integrate into Remotion composition

### Phase 12: Export & Polish
1. Create ZIP export
2. Create render pipeline with SSE progress
3. Add error handling and edge cases
