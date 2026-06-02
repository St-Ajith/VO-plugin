# Change: Add Async Command Queue for Main Thread Operations

## Why

The plugin's Main thread handles state-mutating operations (CREATE, UPDATE, DELETE, REORDER) via individual message handlers. Without serialization, concurrent operations can interleave during async gaps (e.g., `figma.loadFontAsync`), causing race conditions, duplicate IDs, or inconsistent state. Read operations (GET_SCREENS, SELECTION_CHANGED) should bypass the queue for responsiveness.

## What Changes

- **New utility**: `CommandQueue` class in `src/utils/command-queue.ts` serializes mutating operations
- **Command discrimination**: Operations tagged as `MUTATE` enter queue; `READ` operations bypass
- **Internal mutation flag**: `isInternalMutation` boolean suppresses self-triggered `documentchange` events during queue processing
- **Integration**: `MessageRouter` delegates mutating handlers through the queue
- **Logging**: Queue depth, processing time, and operation completion logged via `Logger`

### Architecture

```
UI emit('CREATE_ANNOTATION')
       │
       ▼
MessageRouter.handleMessage()
       │
       ├─ MUTATE? ──► CommandQueue.enqueue(command)
       │                    │
       │                    ▼
       │              isInternalMutation = true
       │                    │
       │                    ▼
       │              Execute handler (async)
       │                    │
       │                    ▼
       │              isInternalMutation = false
       │                    │
       │                    ▼
       │              Process next in queue
       │
       └─ READ? ───► Execute immediately (no queue)
```

## Impact

- **Affected specs**: `sync` (new requirement for command serialization)
- **Affected code**:
  - New file: `src/utils/command-queue.ts`
  - Modified: `src/services/message-router.ts` (queue integration)
  - Modified: `src/services/node-change-coordinator.ts` (respect `isInternalMutation`)
- **Dependencies**: None (foundation for SA-02 through SA-04)
