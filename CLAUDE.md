# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server on :3333
npm run build        # Production build
npm run lint         # Biome check
npm run format       # Biome format --write
npm run test         # Jest
npm run test:watch   # Jest --watch
npm run test:coverage # Jest --coverage
npm run test:api     # Integration tests (integration-tests/)
```

Run a single test: `npx jest path/to/test.test.ts`

## Environment

```
LOUZLABS_BASE_URL=https://api.louzlabs.com.br
LOUZLABS_API_KEY=sk-...
DEBUG_LOG=true       # Writes request/response logs to /logs
```

## Architecture

Next.js 16 App Router + Remotion video engine. Generates narrated videos from text or audio through a multi-stage wizard.

### Flow Modes

Four distinct workflows, each with a different stage sequence:

- **simple** — Text → Split → Descriptions → Images → Audio → Video → Download
- **commentator** — Same as simple but adds Commentator + Comments stages after split
- **video-story** — Text → Audio → Transcription → Split → Descriptions → Images/Clips → Video → Download
- **from-audio** — Upload audio → Transcription → Split → Descriptions → Images → Video → Download

Stage ordering and navigation logic lives in `src/lib/domain/navigation.ts`. The `calculateMaxStep` function determines which stages are reachable based on what data exists.

### AI Provider System

`src/lib/ai/registry.ts` — Provider-agnostic action dispatcher. Providers register handlers via `registerProvider()`.

`src/lib/ai/config.ts` — Maps actions (generateText, generateImage, generateAudio, generateVideo, generateMusic, generateTranscription) to provider + model configs.

`src/lib/ai/providers/louzlabs.ts` — LouzLabs API implementation. Only provider currently. Supports SSE streaming for video and music generation.

`src/lib/ai/http-client.ts` — Shared HTTP client with timeout, debug logging, SSE support. All provider calls go through `apiRequest`, `apiRequestRaw`, `apiRequestSSE`, or `apiRequestMultipart`.

To call an AI action: `execute("generateImage", { prompt, referenceImages })` — it resolves the provider, credentials, and model from config automatically.

### Video Alignment (Remotion)

`src/lib/video/aligner.ts` — Strategy pattern for scene-to-timeline alignment:

- **PrecisionAlignmentStrategy** — Image-based, uses transcription word-level timestamps to match scenes to audio
- **ContinuousAlignmentStrategy** — Video-based, slowed playback (0.92x) generates transition frames between clips
- **HybridAlignmentStrategy** — Mixed video+image, fixed-duration clips, video clips get playbackRate slowdown while images get Ken Burns effects

All produce `RemotionVideoProps` consumed by `src/components/video/RemotionVideo.tsx`.

### Data Flow

`src/lib/flows/hooks/` — React hooks that orchestrate each stage. Each hook (useAudio, useVideoClips, useVideo, useProject, useDownload, useTranscription) manages API calls and state for its stage.

`src/components/story-flow/` — Main wizard UI. `StoryFlowState` (in `types.ts`) is the central state interface. Each stage is a component in `stages/`.

### Storage

File-based project storage in `public/projects/{id}/config.json`. `src/lib/storage.ts` — `StorageService` handles CRUD and incremental patches (`patchSegmentClip`, `patchSegmentImage`, `patchEntityImage`, `patchMusic`) that write individual fields without full rewrites. Images stored as files in `public/projects/{id}/images/`.

### Pipeline Pattern

API routes use function composition with `pipe()` for async/sync workflows. Atomic functions, single data flow, no manual next(). See existing route handlers for examples.

## Key Types

- `Segment` (`src/lib/flows/types.ts`) — Core unit: text + imagePrompt + imagePath + videoClipUrl + time window
- `EntityAsset` — Named character with image, used for visual consistency across segments
- `RemotionVideoProps` (`src/lib/video/types.ts`) — Full video spec: scenes, audio tracks, captions, music
- `ProjectData` (`src/lib/storage.ts`) — Persisted project state
- `Stage` / `FlowMode` (`src/components/story-flow/types.ts`) — Wizard stage and flow type enums

## Testing

Jest + React Testing Library. Remotion libraries are mocked in `__tests__/__mocks__/`. Integration tests in `integration-tests/` hit real API endpoints.

## Code Style

Biome handles lint and format. 2-space indent, organize imports on save. No ESLint or Prettier — Biome only.
