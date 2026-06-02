## 1. Dependency Setup

- [x] 1.1 Install Valibot: `npm install valibot`
- [x] 1.2 Verify bundle size impact (expect < 2kB for used schemas)

## 2. Schema Definitions

- [x] 2.1 Create `src/schema/annotation-schema.ts`
- [x] 2.2 Define `AnnotationSchema` matching `Annotation` interface
- [x] 2.3 Define `PartialAnnotationSchema` for updates
- [x] 2.4 Define `IpcMessageSchema` for common message payloads
- [x] 2.5 Export `validateAnnotation()` and `validateAnnotations()` helpers

## 3. Validation Integration

- [x] 3.1 Add Valibot validation to `AnnotationStore.setAnnotations()`
- [x] 3.2 Reject and log invalid entries, continue with valid ones
- [x] 3.3 Strip unknown keys from incoming annotations
- [x] 3.4 Add validation to `MessageRouter` for incoming payloads (CREATE, UPDATE)
- [x] 3.5 Return validation errors in response with `requestId`

## 4. Pre-Mutation Snapshot Capture

- [x] 4.1 Modify `useAnnotationOperations.handleCreate()` to capture `annotations.value` before optimistic update
- [x] 4.2 Store snapshot in `inFlightRequests` entry (via SA-02's `trackRequest`)
- [x] 4.3 Repeat for `handleUpdate()`, `handleDelete()`, `handleReorder()`

## 5. Failure Detection & Recovery

- [x] 5.1 Add handler for `save-data-result` with `success === false`
- [x] 5.2 On failure, show notification: "Operation failed, syncing..."
- [x] 5.3 Set `isSyncing.value = true` for UI loading state
- [x] 5.4 Emit `REQUEST_RESYNC` message to Main thread
- [x] 5.5 Main thread responds with fresh `INIT` payload
- [x] 5.6 UI replaces state with authoritative data
- [x] 5.7 Set `isSyncing.value = false` after re-sync complete

## 6. Syncing UI Indicator

- [x] 6.1 Add `isSyncing` signal to `store.ts`
- [x] 6.2 Show subtle loading overlay when `isSyncing === true`
- [x] 6.3 Disable form inputs during sync to prevent conflicting edits
- [x] 6.4 Auto-dismiss after re-sync (max 5s timeout)

## 7. Testing

- [x] 7.1 Unit test: Valibot schema validates correct annotation
- [x] 7.2 Unit test: Valibot schema rejects annotation with missing required fields
- [x] 7.3 Unit test: `setAnnotations` filters invalid entries
- [x] 7.4 Integration test: Failed save triggers re-sync
- [x] 7.5 Integration test: UI state matches authoritative source after re-sync
- [x] 7.6 Integration test: `isSyncing` indicator appears and disappears

## Dependencies

- Depends on SA-02 (uses `inFlightRequests` for snapshot storage)
- Task 1.x must complete before 2.x
- Task 2.x must complete before 3.x
- Tasks 4.x and 6.x can run in parallel after 2.x
- Task 5.x depends on 3.x and 4.x
- Task 7.x depends on all prior tasks
