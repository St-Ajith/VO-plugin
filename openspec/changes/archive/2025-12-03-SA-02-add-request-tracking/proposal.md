# Change: Add Request ID Tracking and Deduplication

## Why

Without request IDs, the UI cannot distinguish between responses to current actions versus stale responses from rapidly triggered operations. If a user clicks "Create" twice quickly, the UI may apply the second response to the wrong optimistic state. Additionally, duplicate messages (from retries or UI re-renders) can cause operations to execute multiple times.

## What Changes

- **Request ID generation**: UI generates UUID for each state-mutating operation before emit
- **Request tracking**: `inFlightRequests` Map tracks pending requests with pre-mutation snapshots
- **Response echoing**: Main thread echoes `requestId` in all responses to mutating operations
- **Stale response discard**: UI ignores responses with unknown or expired `requestId`
- **Deduplication**: Main thread maintains time-bounded Set of processed `requestId`s (5-second TTL)

### Shared Utility: `inFlightRequests`

This Map is the contract between SA-02 (tracking) and SA-03 (recovery):

```typescript
interface InFlightRequest {
  requestId: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'REORDER';
  timestamp: number;
  preMutationSnapshot: Annotation[] | null; // Captured before optimistic update
}

const inFlightRequests = new Map<string, InFlightRequest>();
```

## Impact

- **Affected specs**: 
  - `sync` (request ID in IPC protocol)
  - `annotation-management` (CRUD operations include requestId)
- **Affected code**:
  - New file: `src/utils/request-tracker.ts` (shared utility)
  - Modified: `src/types.ts` (add `requestId` to message interfaces)
  - Modified: `src/hooks/useAnnotationOperations.ts` (generate requestId, track in-flight)
  - Modified: `src/services/message-router.ts` (echo requestId, check deduplication)
  - Modified: `src/store.ts` (ignore stale responses)
- **Dependencies**: SA-01 (command queue provides serialization context)
