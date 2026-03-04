# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- **Processors use registry execute()**: All processors import `execute` from `@/lib/ai/providers` and call `execute('generateText'|'generateImage'|'generateAudio', {...})` instead of direct API calls
- **JSON parsing from LLM responses**: Use regex to extract JSON from markdown code blocks: `/```json\s*(\[[\s\S]*?\])\s*```/` or fallback to `(\[[\s\S]*?\])`
- **Node.js imports use node: protocol**: Use `node:fs`, `node:path`, `node:fs/promises` per biome rules
- **Consolidated hooks pattern**: All React hooks in single file (src/lib/flows/hooks.ts) with useAudio, useTranscription, useVideo, useProject, useDownload
- **Single StoryFlow component**: All flow stages (input, commentator, comments, descriptions, entities, images, audio, transcription, video) in one file with getStages() helper to filter based on mode and consistency flag

---

## 2026-03-04 - US-008
- Deleted all files from PRD DELETE section (already staged from previous work)
- Deleted additional obsolete files: src/lib/ai/router.ts, src/lib/ai/generate.ts, src/lib/ai/queue.ts, src/app/api/queue/process/route.ts
- Updated .env.example with VOID, NAGA, AIR credentials and DEBUG_LOG (removed obsolete S3 vars)
- Fixed __tests__/storage.test.ts - updated to use Segment[] instead of string[], fixed visualDescriptions to use segments[].imagePath
- Fixed demos/image-void.ts - renamed prompt variable to avoid global conflict, fixed formatting
- Files deleted: pipeline.ts, custom-client.ts, createForm.tsx, flows/, shared/, use-*.ts hooks, generate/route.ts, router.ts, generate.ts, queue.ts, queue/process/route.ts
- Files changed: .env.example, __tests__/storage.test.ts, demos/image-void.ts
- **Learnings:**
  - Files listed in DELETE section were already staged for deletion from previous iteration
  - Additional files (router.ts, generate.ts, queue.ts) needed deletion as they imported from old config pattern
  - Test file used obsolete visualDescriptions field - updated to use segments[].imagePath which is the current base64 extraction path
  - typecheck passes, lint has pre-existing errors in src/ (CRLF, any types, node: protocol) from previous user stories
---

- Created src/components/StoryFlow.tsx - single component replacing all flow components
- Updated src/app/page.tsx - home page with project list, delete, and flow selection
- StoryFlow implements all 9 stages with getStages() filtering based on mode/consistency
- StoryFlow implements exec object mapping each stage to action function
- StoryFlow implements bottom bar with back/execute/next navigation
- Files changed: src/components/StoryFlow.tsx (created), src/app/page.tsx (updated)
- **Learnings:**
  - Build fails due to old files (router.ts, generate.ts, queue/process/route.ts) importing old config exports - these will be deleted in US-008
  - StoryFlow uses conditional stage rendering with stage === 'stagename' pattern
  - maxStep calculation determines how far user can navigate based on data state
---

## 2026-03-04 - US-006
- Updated six API route files to use new processors instead of old pipeline
- Updated src/app/api/generate/audio/route.ts to use generateAudio from processors
- Created src/app/api/generate/commentator/route.ts using generateCommentsWithCommentator
- Created src/app/api/generate/descriptions/route.ts using generateSceneDescriptions
- Created src/app/api/generate/entities/descriptions/route.ts using execute from providers and ENHANCE_ENTITIES_PROMPT
- Created src/app/api/generate/images/route.ts using generateSingleImage and StorageService for base64 saving
- Updated src/app/api/generate/split/route.ts to use splitText from text-segmentation
- Files changed: audio/route.ts, commentator/route.ts, descriptions/route.ts, entities/descriptions/route.ts, images/route.ts, split/route.ts
- **Learnings:**
  - Routes are thin wrappers around processors - just validation and response formatting
  - images route handles base64 to local file conversion via StorageService.saveBase64Image
  - entities/descriptions route parses JSON from LLM response with fallback regex patterns
  - All routes follow consistent error handling pattern with try/catch and NextResponse.json
---

## 2026-03-04 - US-005
- Created src/lib/flows/hooks.ts consolidating 5 hooks into single file
- Implemented useAudio hook with generate (POST /api/generate/audio) and regenerateBatch
- Implemented useTranscription hook with transcribe (POST /api/generate/transcription) and retry
- Implemented useVideo hook with generate (alignVideoProps) and render (POST /api/render with SSE progress streaming)
- Implemented useProject hook with load (GET /api/projects/:id) and save (POST /api/projects)
- Implemented useDownload hook with downloadZip (POST /api/generate/zip)
- Files changed: src/lib/flows/hooks.ts (created)
- **Learnings:**
  - Removed unused cleanTitle import from PRD code
  - use type imports for types-only imports to satisfy biome
  - Non-null assertions in hooks are safe due to preceding filter predicates
---

## 2026-03-04 - US-004
- Created four processor files using registry pattern
- Created src/lib/ai/processors/scene-visualizer.ts with SceneVisualizationRequest interface and generateSceneDescriptions function
- Created src/lib/ai/processors/image-generator.ts with GenerateImageRequest interface, resolveImage helper, and generateSingleImage function
- Replaced src/lib/ai/processors/audio-generator.ts with new registry-based version using execute('generateAudio')
- Created src/lib/ai/processors/commentator.ts with generateCommentsWithCommentator function
- Files changed: src/lib/ai/processors/scene-visualizer.ts, image-generator.ts, audio-generator.ts, commentator.ts
- **Learnings:**
  - Processors abstract the registry execute() calls into domain-specific functions
  - audio-generator processes batches in parallel chunks of 4 with staggered 800ms delays
  - scene-visualizer extracts entity tags from imagePrompts using `<<EntityName>>` pattern for consistency
  - image-generator resolves local filesystem images to base64 data URLs for reference images
---

## 2026-03-04 - US-003
- Created src/lib/ai/providers/ directory with four files
- Created void.ts with generateText (SSE streaming) and generateImage (multimodal content)
- Created naga.ts with generateAudio handler returning ArrayBuffer
- Created air.ts with generateImage handler supporting b64_json and url responses
- Created index.ts that imports all providers (self-registration) and re-exports execute
- Files changed: src/lib/ai/providers/void.ts, naga.ts, air.ts, index.ts
- **Learnings:**
  - Providers self-register via registerProvider() call at module load time
  - index.ts imports all providers for side effects (registration) then re-exports execute
  - void provider handles SSE streaming with TextDecoder for incremental text
  - air provider supports both base64 and URL image responses
---

## 2026-03-04 - US-002
- Replaced src/lib/ai/config.ts with new registry pattern (ActionType, ModelConfig, ACTIONS record, getCredentials)
- Created src/lib/ai/registry.ts with request/response types, Provider interface, registerProvider, and execute function
- **Learnings:**
  - Config now uses declarative ACTIONS record for fallback chains instead of static model/provider arrays
  - Registry pattern uses Map<string, Provider> for provider registration
  - execute function provides automatic fallback with aggregated error reporting
  - Existing files (router.ts, queue.ts, generate.ts) will break until US-003-US-008 complete the refactor
---

## 2026-03-04 - US-001
- Verified existing src/lib/flows/types.ts meets all acceptance criteria
- File already contained required types plus additional ones (LoadingState, TranscriptionWord, TranscriptionData, ProjectData, VoiceConfig)
- **Learnings:**
  - Types module was already implemented from previous work
  - File is more complete than PRD spec - includes extra utility types
---

