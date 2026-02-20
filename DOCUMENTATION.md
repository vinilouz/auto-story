# Auto Story Documentation

## Project Structure
- `src/app/api`: API routes for content generation (split, descriptions, images, audio, transcription, etc.)
- `src/components/flows`: Different story creation flows (Simple, With Commentator)
- `src/components/flows/shared`: Shared UI components and stages for all flows
- `src/components/shared`: Base UI components (FlowStepper, StageControls)
- `src/lib/flows`: Shared hooks and types for flow logic
- `src/lib/ai/processors`: Core logic for AI-powered generation

## Flow Architecture

### Shared Hooks (`src/lib/flows/`)
- `types.ts` - Shared type definitions
- `use-image-generation.ts` - Image generation logic (generateAll, regenerate, updatePrompt)
- `use-audio-generation.ts` - Audio generation (single/multi-voice support)
- `use-transcription.ts` - Transcription handling
- `use-video-generation.ts` - Video alignment and rendering
- `use-project.ts` - Project persistence (save/load/download)

### Shared Stages (`src/components/flows/shared/stages/`)
- `InputStage.tsx` - Script input, segment size, language
- `ImagesStage.tsx` - Visual description and image grid
- `AudioStage.tsx` - Audio batch status and voice config
- `TranscriptionStage.tsx` - Transcription status and results
- `VideoStage.tsx` - Video preview with caption controls
- `DownloadStage.tsx` - ZIP download

### Creating New Flows
To create a new flow, compose existing hooks and stages:
```typescript
const imageGen = useImageGeneration(descriptions, setDescriptions, { systemPrompt })
const audioGen = useAudioGeneration({ type: 'single', getText, voice })
const transcription = useTranscription(audioGen.batches, language)
const videoGen = useVideoGeneration({ getSegments, audioBatches, transcriptionResults })

return (
  <StoryFlowBase title="My Flow" steps={STEPS} ...>
    {currentStage === 'INPUT' && <InputStage ... />}
    {currentStage === 'IMAGES' && <ImagesStage ... />}
    {/* ... other stages */}
  </StoryFlowBase>
)
```

## Key Types

### Audio Generation
The audio generation API supports both `voices` (for multi-speaker content) and `voice` (for simple narration).
```typescript
export interface AudioGenerationRequest {
  text: string;
  voices?: Array<{ speaker: string; voice: string }>;
  voice?: string;
  model?: string;
  systemPrompt?: string;
  targetBatchIndices?: number[];
}
```
`SimpleStoryFlow` uses the single `voice` parameter, while `WithCommentatorFlow` uses the `voices` array to handle both narrator and commentator.

The generation returns batches:
```typescript
export interface AudioBatch {
  index: number;
  text: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
  url?: string;
  error?: string;
}

export interface AudioGenerationResponse {
  batches: AudioBatch[];
}
```
In `SimpleStoryFlow`, `audioBatches` is used for display and the URLs are extracted for downstream stages (Transcription, Video).
In `ScriptForm`, the response is mapped to the legacy `audioUrls` structure for compatibility.

### Visual Descriptions
```typescript
interface VisualDescription {
  imagePrompt: string;
  imageUrl?: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
}
```
Images are generated using a specific epic cinematic pre-prompt. The `imagePrompt` is cleaned to remove any "Scene X:" prefixes before being wrapped in the style template. In case of failure (e.g., safety filters), the error message now includes the `finish_reason` and the full response message for easier debugging.

The `useImageGeneration` hook leverages functional state updates (`setDescriptions(prev => ...)`) to prevent concurrent image generation results from overwriting each other. Additionally, base64 API responses in logs are automatically truncated to prevent console pollution.

## Flows

### Simple Story Flow (`SimpleStoryFlow.tsx`)
A linear flow with stages:
1. Roteiro (Input)
2. Descrições (Visual Prompts)
3. Imagens (Visual Generation)
4. Áudio (Narration)
5. Transcrição (Subtitles)
6. Vídeo (Preview)
7. Download (Export)

### With Commentator Flow (`WithCommentatorFlow.tsx`)
An advanced flow that adds an AI commentator to the story.

### Video Generation & Alignment
The `alignVideoProps` utility handles the synchronization of segments, audio, and transcriptions:
- Expects transcriptions in `{ text, startMs, endMs }` format (milliseconds)
- Calculates global timestamps for multi-batch audio
- Returns `Caption[]` with integer milliseconds (no precision loss)

In the flows, transcription data is mapped by URL to ensure correct ordering before being passed to the aligner.

### Caption System (Karaoke Style)
Captions flow through three components:

1. **CaptionsLayer** (`src/components/video/CaptionsLayer.tsx`)
   - Chunks words into pages by punctuation (. ! ?) and word limit
   - Uses `createTikTokStyleCaptions` from `@remotion/captions`
   - Converts ms → frames for Sequence positioning

2. **SubtitlePage** (`src/components/video/captions/SubtitlePage.tsx`)
   - Applies spring animation on page enter

3. **Page** (`src/components/video/captions/Page.tsx`)
   - Renders tokens with karaoke highlight
   - Converts frame → ms to determine active token
   - Active token gets `highlightColor`, others get white

**Data format throughout:**
```
ElevenLabs (ms) → aligner (ms) → CaptionsLayer (ms → frames) → Page (frames → ms)
```

**Key interfaces:**
```typescript
interface Caption {
  text: string;
  startMs: number;  // integer milliseconds
  endMs: number;
}

interface CaptionStyle {
  fontSize: number;
  fontFamily: string;
  maxWordsPerLine: number;
  uppercase: boolean;
  highlightColor: string;
  fontWeight?: number;
}
```

### `StoryFlowBase`
A wrapper component that provides a unified tabbed interface for story stages and a persistent bottom action bar. It handles global navigation (Voltar, Avançar) and execution (Executar) buttons, delegating the logic to the specific flow implementation.

### Navigation and Execution
The UI uses a globally positioned action bar at the bottom for executing stage-specific logic (e.g., "Gerar Descrições", "Gerar Áudio") and navigating between tabs. Stage components no longer manage their own `StageControls`.

### Auto-Saving
Flows implementation (like `SimpleStoryFlow`) trigger `project.save()` automatically after completing major generation steps. A toast notification (via `sonner`) is displayed upon successful save.

### `VideoPlayer`
Renders the story with synchronized audio and subtitles using Remotion.



### Render Performance
- Server-side MP4 render (`src/app/api/render/route.ts`) caches the Remotion bundle at module level — first request bundles, subsequent requests reuse.
- Render concurrency is set to `cpus - 1` for parallel frame rendering.
- Transition presentations (`fade`, `wipe`, `slide`) are cached as module-level constants in `RemotionVideo.tsx`.
- `SimpleStoryFlow` uses `useMemo` to stabilize `playerProps` passed to the Remotion Player, preventing re-mounts on unrelated state changes.
- **Optimized video rendering constants** (`src/remotion/constants.ts`):
  - Cache size: 1GB (up from 256MB) - reduces disk I/O for 15-minute videos
  - CRF: 24 (down from 28) - better quality with 20% smaller files
  - X264 preset: 'fast' (up from 'veryfast') - 10-20% better compression efficiency
  - Expected results: 30-50% faster rendering, 20% smaller file size with acceptable quality tradeoff

### Transcription
The system uses **ElevenLabs STT** (`src/lib/ai/transcription/elevenlabs.ts`):
- Calls `POST /v1/speech-to-text?allow_unauthenticated=1` with `scribe_v1` model.
- No API key required.
- Cache: `*.elevenlabs.json`.
- Requires a verified anonymous proxy for bypass.
