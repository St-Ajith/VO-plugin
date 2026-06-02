## Context

The UI and Main thread communicate asynchronously via IPC. When a user triggers rapid actions (e.g., double-click "Create"), multiple messages are sent before responses arrive. Without request tracking, the UI cannot:

1. Match responses to the correct originating action
2. Discard stale responses from superseded operations
3. Prevent duplicate execution of the same logical operation

This design document defines the `inFlightRequests` shared utility that SA-02 creates and SA-03 consumes.

## Goals / Non-Goals

**Goals:**
- Unique identification of every state-mutating operation
- Reliable correlation between requests and responses
- Prevention of duplicate operation execution
- Foundation for optimistic update rollback (SA-03)

**Non-Goals:**
- Retry logic (out of scope; user re-triggers manually)
- Persistent request tracking across plugin restarts
- Request queuing in UI (Main thread queue handles serialization)

## Decisions

### Decision 1: Request ID Format
**Choice**: UUID v4 generated via `crypto.randomUUID()`

**Rationale**: 
- Native browser API, no dependencies
- Guaranteed uniqueness across sessions
- Human-readable for debugging

**Alternatives considered**:
- Incrementing counter: Risk of collision across rapid plugin restarts
- Timestamp-based: Insufficient precision for sub-millisecond operations

### Decision 2: Where to Generate Request ID
**Choice**: UI thread generates before `emit()`

**Rationale**:
- UI owns the "intent" of the operation
- Enables UI to track its own pending operations
- Main thread is passive recipient

### Decision 3: Deduplication TTL
**Choice**: 5 seconds

**Rationale**:
- Long enough to cover slow operations (table creation can take 2-3s)
- Short enough to prevent memory bloat
- Matches existing sync debounce patterns

### Decision 4: `inFlightRequests` Location
**Choice**: Module-level Map in `src/utils/request-tracker.ts`

**Rationale**:
- Shared between hooks (SA-02 writes) and store (SA-03 reads)
- Not a signal (doesn't need reactivity)
- Simple import, no context provider overhead

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Memory leak if requests never complete | 30-second cleanup timer removes expired entries |
| requestId not echoed in error responses | Ensure all response paths include requestId |
| UI generates ID but forgets to track | Wrap emit in helper that auto-tracks |

## Data Structures

```typescript
// src/utils/request-tracker.ts

interface InFlightRequest {
  requestId: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'REORDER';
  timestamp: number;
  preMutationSnapshot: Annotation[] | null;
}

// Pending requests awaiting response
export const inFlightRequests = new Map<string, InFlightRequest>();

// Processed request IDs (for deduplication on Main thread)
export const processedRequestIds = new Set<string>();

// Helper functions
export function trackRequest(request: InFlightRequest): void;
export function completeRequest(requestId: string): InFlightRequest | undefined;
export function isStaleResponse(requestId: string): boolean;
export function cleanupExpiredRequests(): void;
```

## Open Questions

None - all decisions finalized per architectural review.
