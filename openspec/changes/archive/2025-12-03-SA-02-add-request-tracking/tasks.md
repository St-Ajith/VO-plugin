## 1. Foundation

- [x] 1.1 Create `src/utils/request-tracker.ts` with `InFlightRequest` interface
- [x] 1.2 Export `inFlightRequests` Map and `processedRequestIds` Set
- [x] 1.3 Implement `trackRequest(request)` - adds to Map with timestamp
- [x] 1.4 Implement `completeRequest(requestId)` - removes from Map, returns snapshot
- [x] 1.5 Implement `isStaleResponse(requestId)` - checks if requestId is unknown/expired
- [x] 1.6 Implement `cleanupExpiredRequests()` - removes entries older than 30s

## 2. Type Definitions

- [x] 2.1 Add `requestId?: string` to `CreateAnnotationHandler` payload in `types.ts`
- [x] 2.2 Add `requestId?: string` to `UpdateAnnotationHandler` payload
- [x] 2.3 Add `requestId?: string` to `DeleteAnnotationHandler` payload
- [x] 2.4 Add `requestId?: string` to `ReorderAnnotationHandler` payload
- [x] 2.5 Add `requestId?: string` to response handlers: `AnnotationCreatedHandler`, `AnnotationUpdatedHandler`, `AnnotationDeletedHandler`, `AnnotationsReorderedHandler`
- [x] 2.6 Add `requestId?: string` to `save-data-result` message

## 3. UI Request Generation

- [x] 3.1 Import `crypto.randomUUID` (native) or fallback for older browsers
- [x] 3.2 Modify `useAnnotationOperations.handleCreate()` to generate requestId
- [x] 3.3 Modify `useAnnotationOperations.handleUpdate()` to generate requestId
- [x] 3.4 Modify `useAnnotationOperations.handleDelete()` to generate requestId
- [x] 3.5 Modify `useAnnotationOperations.handleReorder()` to generate requestId
- [x] 3.6 Call `trackRequest()` before each emit with pre-mutation snapshot

## 4. Main Thread Echo & Deduplication

- [x] 4.1 Modify `handleCreateAnnotation()` to extract and echo `requestId`
- [x] 4.2 Modify `handleUpdateAnnotation()` to extract and echo `requestId`
- [x] 4.3 Modify `handleDeleteAnnotation()` to extract and echo `requestId`
- [x] 4.4 Modify `handleReorderAnnotation()` to extract and echo `requestId`
- [x] 4.5 Add deduplication check: if `requestId` in `processedRequestIds`, skip and log
- [x] 4.6 Add `requestId` to `processedRequestIds` after processing
- [x] 4.7 Schedule cleanup of `processedRequestIds` entries after 5s TTL
- [x] 4.8 Ensure deduplication check happens BEFORE `wrapHandler()` (prevents queue flooding)
- [x] 4.9 Emit error responses with `requestId` in catch blocks for CREATE/UPDATE/DELETE/REORDER

## 5. UI Response Handling

- [x] 5.1 Modify `store.ts` response handlers to check `isStaleResponse(requestId)`
- [x] 5.2 If stale, log warning and ignore response
- [x] 5.3 If valid, call `completeRequest(requestId)` to clear tracking
- [x] 5.4 Start cleanup interval on plugin init (every 10s)
- [x] 5.5 Add validation in UI handlers to safely handle error responses (invalid annotations)

## 6. Testing

- [x] 6.1 Unit test: `trackRequest` adds entry with timestamp
- [x] 6.2 Unit test: `completeRequest` returns snapshot and removes entry
- [x] 6.3 Unit test: `isStaleResponse` returns true for unknown requestId
- [x] 6.4 Unit test: Deduplication prevents double execution
- [ ] 6.5 Integration test: Rapid double-click creates one annotation (deduped) - **Deferred to SA-06** (stability testing)
- [ ] 6.6 Integration test: Stale response is discarded with warning - **Deferred to SA-06** (stability testing)

**Note**: Integration tests for end-to-end scenarios are covered by SA-06-add-stability-testing, which includes idempotency and concurrency stress tests. Unit tests (6.1-6.4) verify the core request tracking functionality.

## Dependencies

- Depends on SA-01 (command queue) for serialized execution
- Task 1.x must complete before 2.x, 3.x, 4.x
- Tasks 3.x and 4.x can run in parallel after 1.x and 2.x
- Task 5.x depends on 4.x (needs echoed requestId)
- Task 6.x depends on all prior tasks
