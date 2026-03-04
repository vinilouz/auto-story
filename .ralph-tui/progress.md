# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- **Config file pattern**: Use `src/config/` for domain-specific configs (video-models.ts, voices.ts) and `src/lib/ai/` for AI-related utilities. Configs export typed interfaces and const arrays/records.
- **Type inference with unions**: When defining const arrays with union-typed properties (e.g., `AssetType`), use `as AssetType` on each value to prevent TypeScript from widening to `string`.

---

## [2026-03-03] - US-006
- Created lib/ai/client.ts with startProcessing function
- Function calls /api/queue/process in a loop until done is true
- Logs processed count and remaining on each iteration
- Waits 2 seconds between cycles when not done
- **Files changed:**
  - `src/lib/ai/client.ts` (new)
- **Learnings:**
  - Biome requires breaking long console.log lines into multi-line format

---

## [2026-03-03] - US-005
- Created POST handler at app/api/queue/process/route.ts
- Set maxDuration to 300 for long-running processing
- Implemented processItem() to resolve model, wait if rate limited, execute generate
- Updates status to "processing" before generation attempt
- On success: marks completed, stores result with content/type/raw
- On failure: increments attempts, marks failed after 3 attempts or back to pending
- Persists queue after each item processing via writeQueue()
- Returns { done, processed, remaining } response
- **Files changed:**
  - `src/app/api/queue/process/route.ts` (new)
- **Learnings:**
  - Process one item per request to avoid timeout issues
  - Use sleep() helper for rate limit waiting
  - Filter for both "pending" and "processing" status to recover stalled items
  - Biome requires imports sorted: config → generate → queue types → queue functions → router

---

## [2026-03-03] - US-004
- Created `EndpointType` union type for adapter routing
- Added `endpoint` field to Model interface in config.ts
- Implemented Adapter type with GenerateInput/GenerateResult interfaces
- Created `chatCompletionsAdapter` for text and multimodal image generation
- Created `imagesGenerationsAdapter` for image/video generation (SSE streaming)
- Created `audioSpeechAdapter` for text-to-speech generation
- Exported `generate()` function that selects adapter by model.endpoint
- Each adapter handles Authorization header via buildHeaders() helper
- Each adapter handles error responses via handleError() helper
- **Files changed:**
  - `src/lib/ai/config.ts` (added EndpointType, endpoint field to Model)
  - `src/lib/ai/generate.ts` (new)
- **Learnings:**
  - SSE streaming requires manual buffer management and chunk parsing
  - Images/generations endpoint serves both image and video generation
  - Audio/speech returns binary data, converted to base64 for transport

---

## [2026-03-03] - US-003
- Created in-memory rate limiter with 60-second sliding window
- Implemented `canRequest(providerId)` to check RPM availability
- Implemented `recordRequest(providerId)` to log request timestamps
- Implemented `resolveModel(assetType)` to return highest priority available model
- Implemented `nextSlotDelay(providerId)` to calculate wait time until next slot
- **Files changed:**
  - `src/lib/ai/router.ts` (new)
- **Learnings:**
  - Use `import type` for type-only imports per Biome rules
  - Map with number arrays works well for sliding window rate limiting
  - Models array is pre-sorted by priority, so first match is highest priority

---

## [2026-03-03] - US-002
- Created JSON file-based queue system with persistence
- Implemented QueueItem interface with id, assetType, prompt, params, status, resolvedModel, result, attempts, error, createdAt
- Implemented readQueue(), writeQueue(), and enqueue() functions
- Auto-creates data directory on module load
- **Files changed:**
  - `src/lib/ai/queue.ts` (new)
- **Learnings:**
  - Biome requires `node:` protocol for Node.js builtins
  - TypeScript with bundler moduleResolution needs namespace imports (`import * as`) for node: protocol modules to avoid default export errors
  - Use `import type` for type-only imports per Biome rules

---

## [2026-03-03] - US-001
- Created central AI config file with AssetType, Model, and Provider types
- Exported providers record (void, air, naga) and models array sorted by priority
- **Files changed:**
  - `src/lib/ai/config.ts` (new)
- **Learnings:**
  - Biome formatter requires double quotes, semicolons, and trailing commas
  - TypeScript widens string literals to `string` in arrays - need explicit type assertions for union types
  - RPM limits from custom-client.ts: void=30, air=3, naga=30

---
