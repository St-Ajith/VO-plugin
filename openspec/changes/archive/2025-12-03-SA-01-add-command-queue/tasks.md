## 1. Foundation

- [x] 1.1 Create `src/utils/command-queue.ts` with `CommandQueue` class skeleton
- [x] 1.2 Define `Command` interface: `{ id, type: 'MUTATE' | 'READ', name, handler, timestamp }`
- [x] 1.3 Define `CommandType` enum for operation classification
- [x] 1.4 Implement `enqueue(command): Promise<T>` - adds to queue, returns result promise
- [x] 1.5 Implement `processNext()` - dequeues and executes sequentially

## 2. Internal Mutation Flag

- [x] 2.1 Add `isInternalMutation` flag to `CommandQueue` (or export as module-level)
- [x] 2.2 Wrap command execution in `try { isInternalMutation = true; ... } finally { isInternalMutation = false; }`
- [x] 2.3 Export `isInternalMutation` getter for `NodeChangeCoordinator`

## 3. Message Router Integration

- [x] 3.1 Classify existing handlers by type (MUTATE vs READ)
  - MUTATE: `CREATE_ANNOTATION`, `UPDATE_ANNOTATION`, `DELETE_ANNOTATION`, `REORDER_ANNOTATION`, `save-data`, `delete-data`, `INSERT_ANNOTATIONS`, `UPDATE_ANNOTATIONS`
  - READ: `GET_SCREENS`, `SELECT_FRAME`, `ZOOM_TO_FRAME`, `SWITCH_PLATFORM`, `SET_SELECTION_SCOPE`, `SYNC_CANVAS`
- [x] 3.2 Modify `MessageRouter` to route MUTATE operations through `CommandQueue.enqueue()`
- [x] 3.3 Ensure READ operations execute immediately (bypass queue)
- [x] 3.4 Preserve error handling and `figma.notify()` behavior

## 4. NodeChange Suppression

- [x] 4.1 Import `isInternalMutation` in `NodeChangeCoordinator`
- [x] 4.2 Add early return in `handleNodeChange()`: `if (isInternalMutation) return;`
- [x] 4.3 Add logging: `Logger.debug("NodeChange", "Skipping internal mutation")`

## 5. Logging & Observability

- [x] 5.1 Log queue depth on enqueue: `Logger.debug("CommandQueue", "Enqueued", { depth, name })`
- [x] 5.2 Log processing start/end with duration: `Logger.debug("CommandQueue", "Completed", { name, durationMs })`
- [x] 5.3 Log queue empty state: `Logger.debug("CommandQueue", "Queue drained")`

## 6. Testing

- [x] 6.1 Unit test: Commands execute in FIFO order
- [x] 6.2 Unit test: `isInternalMutation` is true during execution, false after
- [x] 6.3 Unit test: READ operations bypass queue
- [x] 6.4 Unit test: Queue handles async handler errors gracefully (continues processing)
- [x] 6.5 Integration test: Concurrent CREATE operations don't produce duplicate IDs

## Dependencies

- Task 1.x must complete before 2.x and 3.x
- Task 2.x must complete before 4.x
- Task 3.x can run in parallel with 4.x after 1.x and 2.x
- Task 6.x depends on all prior tasks
