## 1. Implementation

- [x] 1.1 Update `deduplicateAnnotationsById` to use composite key `${frameId}:${id}` instead of just `id`
- [x] 1.2 Update `createAnnotationContentSignature` to include `frameId` in normalized object
- [x] 1.3 Update `deduplicateCanvasAnnotations` to use composite key for consistency
- [x] 1.4 Add debug logging in `loadAllAnnotations` to log annotation count per page during load
- [x] 1.5 Update `removeDuplicateAnnotations` to log dropped annotations at `warn` level with composite key
- [x] 1.6 Update `add()` in AnnotationStore to check for duplicates within same frame only
- [x] 1.7 Update `useNodeChangeSync` to match annotations by composite key (frameId + id) during sync
- [x] 1.8 Update `node-change-coordinator` version comparison to use composite key
- [x] 1.9 Update `node-change-coordinator` table text parsing to use composite key

## 2. Testing

- [x] 2.1 Add test case: annotations with same numeric ID across different frames are all retained
- [x] 2.2 Add test case: annotations with same content but different frameId are all retained
- [x] 2.3 Add test case: true duplicates (same frameId + id) are still deduplicated correctly

## 3. Validation

- [x] 3.1 Manual test: create 3 annotations on 3 different frames (each with id=1), restart plugin, verify all 3 persist
- [x] 3.2 Verify debug output at localhost:9223 shows annotation loading trace
- [x] 3.3 Run existing test suite to confirm no regressions
