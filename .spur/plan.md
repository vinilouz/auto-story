Plan written. 3 tasks, dependency-ordered:

| Task | File(s) | What |
|------|---------|------|
| **T001** | `aligner.ts` | `HybridAlignmentStrategy` class — mixed video/image per segment, fixed 8s duration, extensible for future media types |
| **T002** | `useVideo.ts` | Remove hard reject on missing videoClipUrl, use fixed 8s for missing clips, pass `fixedClipDuration` through |
| **T003** | `useStoryFlowActions.ts` | Replace binary `.every()` check with `"hybrid"` mode — preview works with any clip/image mix |

Key design decisions:
- New strategy (not patching existing) — keeps backward compat, cleaner extensibility
- Fixed 8s duration constant instead of loading metadata for every segment
- Scene.tsx unchanged — already handles the videoClipUrl → imageUrl fallback
