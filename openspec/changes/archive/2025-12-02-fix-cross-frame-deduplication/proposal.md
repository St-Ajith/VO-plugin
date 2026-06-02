# Change: Fix Cross-Frame Annotation Deduplication

## Why

When the plugin restarts, one or more annotations may silently disappear. The root cause is that `deduplicateAnnotationsById` uses only the numeric `annotation.id` as a uniqueness key, but annotation IDs are frame-scoped (1, 2, 3 per frame). When multiple frames have annotations with the same numeric ID, only the first is kept. Additionally, `deduplicateByContent` excludes `frameId` from its content signature, risking false-positive deduplication across frames with identical accessibility data.

Related issues were discovered:
1. The store's duplicate ID check in `add()` used global ID matching, preventing new annotations from being created on different frames when they would share the same numeric ID.
2. The sync handlers (`useNodeChangeSync` and `node-change-coordinator`) matched annotations by ID only, causing cross-frame annotation overwrites during sync operations.

## What Changes

- Update `deduplicateAnnotationsById` to use composite key `${frameId}:${id}` instead of just `id`
- Update `createAnnotationContentSignature` to include `frameId` in the normalized object
- Update `deduplicateCanvasAnnotations` to also use composite key for consistency
- Update `add()` in AnnotationStore to check for duplicates within the same frame only
- **Update `useNodeChangeSync` to match annotations by composite key (frameId + id) during sync**
- **Update `node-change-coordinator` version comparison and table text parsing to use composite key**
- Add debug logging in `loadAllAnnotations` and `removeDuplicateAnnotations` to trace annotation flow during restart
- Log dropped annotations at `warn` level with composite key for easier triage
- Add test coverage for multi-frame scenarios where annotations share the same numeric ID

## Impact

- Affected specs: `data-persistence`
- Affected code:
  - `src/utils/annotation-deduplication.ts` (core fix)
  - `src/services/storage.ts` (debug logging)
  - `src/services/annotation-store.ts` (duplicate check fix)
  - `src/hooks/useNodeChangeSync.ts` (sync matching fix)
  - `src/services/node-change-coordinator.ts` (sync matching fix)
  - `src/__tests__/utils/annotation-deduplication.test.ts` (test coverage)
