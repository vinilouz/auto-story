# Fix LouzLabs API Alignment with Reference Client

## Overview
Align all generation calls with the reference API client. The video endpoint returns SSE (not JSON), music is missing `style` param, and text model is wrong.

## Context
- Reference: `tests/tests.ts` — authoritative API contract
- Provider: `src/lib/ai/providers/louzlabs.ts` — current implementation
- HTTP client: `src/lib/ai/http-client.ts` — fetch helpers
- Registry: `src/lib/ai/registry.ts` — request/response types
- Config: `src/lib/ai/config.ts` — model defaults

## Bugs Found

### 1. CRITICAL: Video uses JSON instead of SSE
- **File**: `louzlabs.ts:132` — `apiRequest<{ url: string }>` does `res.json()`
- **Reference**: video returns SSE stream, uses `readSse(res)` (same as music)
- **Fix**: Switch to `apiRequestSSE` + parse SSE (reuse `parseMusicSSE` pattern)

### 2. Music missing `style` parameter
- **File**: `registry.ts:43` — `MusicRequest` has no `style` field
- **Reference**: `{ prompt, style?, instrumental? }`
- **Fix**: Add `style?: string` to `MusicRequest`, pass through in provider

### 3. Text model mismatch
- **File**: `config.ts:20` — `gemini-3-flash-preview`
- **Reference**: `gemini-3.1-flash-lite-preview`
- **Fix**: Update default model

## Implementation Steps

### Task 1: Fix video generation — switch from JSON to SSE
- [x] Rename `parseMusicSSE` → `parseSSE` for reuse (both video and music use SSE)
- [x] Change `generateVideo` to use `apiRequestSSE` instead of `apiRequest`
- [x] Add 300s timeout to video SSE request
- [x] type check passes

### Task 2: Add `style` to MusicRequest and pass through
- [x] Add `style?: string` to `MusicRequest` interface in `registry.ts`
- [x] Update `generateMusic` in `louzlabs.ts` to include `style` in payload
- [x] Update music API route to accept and pass `style` param
- [x] type check passes

### Task 3: Update default text model
- [x] Change `config.ts:20` model from `gemini-3-flash-preview` to `gemini-3.1-flash-lite-preview`
- [x] type check passes

### Task 4: Verify acceptance criteria
- [x] Verify video uses SSE with 300s timeout
- [x] Verify music accepts `style` parameter
- [x] Verify text model matches reference
- [x] Verify all endpoints match reference: paths, body shapes, response handling
- [x] type check clean (no new errors)
