## ADDED Requirements

### Requirement: Idempotency Test Pattern
The system SHALL have automated tests verifying that operations are idempotent.

- Each mutation type (CREATE, UPDATE, DELETE, REORDER) has idempotency test
- Test pattern: Execute operation N times → verify result equals single execution
- Tests use request ID deduplication to verify mechanism
- Tests count node creations/deletions to verify no duplicates

#### Scenario: Test CREATE_ANNOTATION idempotency
- **WHEN** test sends CREATE_ANNOTATION with `requestId: "test-123"` twice
- **THEN** only one annotation is created
- **AND** node creation count is 1, not 2
- **AND** second request is logged as duplicate

#### Scenario: Test DELETE_ANNOTATION idempotency
- **WHEN** test sends DELETE_ANNOTATION for same annotation twice
- **THEN** annotation is deleted once
- **AND** second delete succeeds silently (no error)
- **AND** no orphan cleanup required

### Requirement: Concurrency Stress Tests
The system SHALL have tests simulating rapid concurrent operations.

- Tests trigger 10+ operations within 100ms
- Tests verify final state is consistent
- Tests verify no duplicate IDs
- Tests verify queue serialization via logging

#### Scenario: Rapid create stress test
- **WHEN** 10 CREATE_ANNOTATION messages are sent within 50ms
- **THEN** 10 unique annotations are created
- **AND** IDs are sequential (1, 2, 3, ..., 10)
- **AND** no ID collisions occur

#### Scenario: Interleaved operations stress test
- **WHEN** alternating CREATE and DELETE operations are sent rapidly
- **THEN** final annotation count matches expected (creates - deletes)
- **AND** no orphan tables exist on canvas

### Requirement: Race Condition Prevention Tests
The system SHALL have tests verifying race conditions are prevented.

- Tests verify command queue serialization
- Tests verify stale response handling
- Tests verify internal mutation flag suppression

#### Scenario: Test queue prevents interleaving
- **WHEN** CREATE_ANNOTATION starts (triggers font loading delay)
- **AND** second CREATE_ANNOTATION arrives during delay
- **THEN** second waits in queue
- **AND** first completes fully before second starts
- **AND** no shared state corruption occurs

#### Scenario: Test stale response discard
- **WHEN** rapid updates trigger multiple UPDATE_ANNOTATION
- **AND** responses arrive out of order
- **THEN** stale responses are discarded
- **AND** UI reflects latest state

### Requirement: Transaction Wrapper Tests
The system SHALL have tests verifying atomic transaction behavior.

**Note**: Core transaction wrapper tests (20 tests) were implemented as part of SA-04 in `src/__tests__/utils/transaction-wrapper.test.ts`. These cover:
- `beginTransaction` creates invisible frame with correct metadata
- `commit` moves children to parent, preserves coordinates, removes draft frame
- `abort` deletes draft frame and all children
- `withTransaction` auto-commits on success, auto-aborts on failure
- `cleanupOrphanedDrafts` removes nodes with `isTransactionDraft: "true"`
- `notifyOrphanCleanup` shows appropriate user notification

Additional integration tests may be added to verify transaction behavior in context of full message flow.

#### Scenario: Test failed operation cleanup (covered by SA-04)
- **WHEN** table creation fails after container is created
- **THEN** draft frame is deleted (transaction abort)
- **AND** no orphan nodes remain
- **AND** `findAllWithCriteria({ pluginData: { keys: ['isTransactionDraft'] } })` returns empty

#### Scenario: Test startup cleanup (covered by SA-04)
- **WHEN** mock contains node with `isTransactionDraft: "true"`
- **AND** `cleanupOrphanedDrafts()` is called
- **THEN** orphan node is deleted
- **AND** cleanup is logged

#### Scenario: Test coordinate preservation during unboxing (covered by SA-04)
- **WHEN** transaction commits with children at specific coordinates
- **THEN** children are moved to parent
- **AND** absolute coordinates are preserved (no position jump)

### Requirement: Circuit Breaker Tests
The system SHALL have tests verifying circuit breaker behavior.

- Tests verify trip threshold (3 failures / 5 seconds)
- Tests verify cooldown period (30 seconds)
- Tests verify independent breakers per operation
- Tests verify FIGMA_ERROR emission

#### Scenario: Test breaker trips after threshold
- **WHEN** mock simulates 3 consecutive failures for INSERT_ANNOTATIONS
- **THEN** circuit breaker state is OPEN
- **AND** `FIGMA_ERROR` is emitted with operation and cooldown

#### Scenario: Test breaker isolates operations
- **WHEN** INSERT_ANNOTATIONS breaker is open
- **THEN** UPDATE_ANNOTATIONS still executes
- **AND** each operation has independent failure tracking

### Requirement: Failure Simulation in Mocks
The system SHALL provide mock utilities for simulating failures and timing.

- `mockFigma.simulateFailure(operation, count)` causes next N calls to throw
- `mockFigma.simulateDelay(ms)` adds artificial delay
- `mockFigma.getCallCount(operation)` returns invocation count
- `mockFigma.captureNodeState()` snapshots current node tree

#### Scenario: Mock simulates API failure
- **WHEN** `mockFigma.simulateFailure('createRectangle', 3)` is called
- **THEN** next 3 calls to `figma.createRectangle()` throw Error
- **AND** 4th call succeeds normally

#### Scenario: Mock tracks call counts
- **WHEN** test calls `figma.createRectangle()` 5 times
- **THEN** `mockFigma.getCallCount('createRectangle')` returns 5
- **AND** count resets on `mockFigma.reset()`

### Requirement: State Recovery Edge Case Tests
The system SHALL have tests verifying edge cases in state recovery beyond basic coverage.

- Basic state recovery tests exist in `src/__tests__/integration/state-recovery.test.ts` (from SA-03)
- Additional tests focus on concurrent changes and edge case scenarios
- Tests verify re-sync captures concurrent document modifications

#### Scenario: Test concurrent document changes captured
- **WHEN** re-sync is triggered after failed operation
- **AND** document was modified concurrently (by another plugin/user)
- **THEN** re-sync captures all concurrent changes
- **AND** UI state reflects authoritative source including concurrent modifications

### Requirement: Echo Prevention Tests
The system SHALL have tests verifying that actions are blocked during sync to prevent echo loops.

- All mutation handlers check `isSyncing.value` and return early when true
- INIT messages during sync do not trigger save-data emissions
- Tests verify handler blocking prevents sync → save → sync → save loops

#### Scenario: Test handlers block actions during sync
- **WHEN** `isSyncing.value` is set to `true`
- **AND** `handleCreateAnnotation()` is called
- **THEN** handler returns early without emitting save-data
- **AND** same behavior for `handleUpdateAnnotation`, `handleDeleteAnnotation`, `handleReorderAnnotation`, `handleInsert`

#### Scenario: Test INIT during sync doesn't trigger save-data
- **WHEN** `isSyncing.value` is `true` (re-sync in progress)
- **AND** INIT message arrives with fresh annotation data
- **THEN** annotations are updated directly (no save-data emission)
- **AND** `isSyncing.value` is cleared after INIT processing
- **AND** no echo loop occurs (no save-data → nodechange → sync cycle)

### Requirement: Valibot Validation Tests
The system SHALL have tests verifying Valibot schema validation behavior and error handling.

- Invalid payloads return structured error responses with requestId for correlation
- `setAnnotations` filters invalid entries and continues with valid ones
- Validation errors include field paths and error messages

#### Scenario: Test invalid payload returns error with requestId
- **WHEN** CREATE_ANNOTATION message contains invalid data (missing required field)
- **THEN** Valibot validation fails
- **AND** response includes `success: false` with error details
- **AND** response includes `requestId` matching request for UI correlation
- **AND** error details include field path and validation message

#### Scenario: Test setAnnotations filters invalid entries
- **WHEN** `setAnnotations([validAnnotation, invalidAnnotation, validAnnotation2])` is called
- **THEN** invalid annotation is logged as warning
- **AND** store contains only `[validAnnotation, validAnnotation2]`
- **AND** operation succeeds (no throw)
- **AND** invalid entry count is logged for debugging
