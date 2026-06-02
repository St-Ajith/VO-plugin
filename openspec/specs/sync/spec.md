# Synchronization

## Purpose

Bidirectional sync between UI state, node storage, and canvas elements. This capability ensures that edits made in the UI or directly on canvas tables are propagated correctly with conflict resolution.
## Requirements
### Requirement: Bidirectional Canvas Sync
The system SHALL synchronize annotation data between the cache and canvas tables.

- Canvas tables are parsed to extract current annotation data
- Parsed data is compared against in-memory cache
- Timestamp-based conflict resolution (newer wins)
- Content comparison as tie-breaker when timestamps match

#### Scenario: Canvas edit syncs to cache
- **WHEN** user edits text directly in a canvas table
- **AND** sync is triggered
- **THEN** the edited value is detected
- **AND** if canvas timestamp is newer, cache is updated
- **AND** UI reflects the change

#### Scenario: Cache edit syncs to canvas
- **WHEN** user edits a field in the UI
- **THEN** the annotation is saved to node storage
- **AND** "Update Annotations" can refresh the canvas table

#### Scenario: Timestamp conflict resolution
- **WHEN** canvas and cache have different values
- **AND** canvas `updatedAt` is more recent
- **THEN** canvas value wins and cache is updated

### Requirement: Change Detection
The system SHALL detect added, removed, modified, and unchanged annotations.

- Compares previous state (cache) with current state (canvas)
- Categorizes each annotation into: added, removed, modified, unchanged
- Uses deep comparison for modification detection
- Returns structured change result for processing

#### Scenario: Detect new annotation on canvas
- **WHEN** an annotation exists on canvas but not in cache
- **THEN** it is categorized as "added"
- **AND** is added to the cache

#### Scenario: Detect modified annotation
- **WHEN** an annotation exists in both canvas and cache
- **AND** the values differ
- **THEN** it is categorized as "modified"
- **AND** conflict resolution determines the winner

#### Scenario: Detect unchanged annotation
- **WHEN** an annotation exists in both canvas and cache
- **AND** values are identical
- **THEN** it is categorized as "unchanged"
- **AND** no action is taken

### Requirement: Canvas Table Discovery
The system SHALL efficiently discover annotation tables across all pages.

- **Uses container-based lookup when available (O(1) per frame)**
- **Falls back to page scanning for legacy tables without containers**
- Cache TTL: 5 seconds
- Filters tables by name pattern: "Annotation Table*"
- Excludes hidden tables (`visible !== false`)
- Handles page scan failures gracefully (continues with other pages)

#### Scenario: Find tables via container lookup
- **WHEN** canvas sync is triggered for a frame
- **AND** an annotation container exists for that frame
- **THEN** tables are retrieved directly from container's table column
- **AND** no page-wide scan is needed

#### Scenario: Find tables on current page
- **WHEN** canvas sync is triggered
- **AND** no container exists (legacy mode)
- **THEN** all annotation tables on the current page are found via name pattern
- **AND** results are cached for 5 seconds

#### Scenario: Cache hit avoids re-scan
- **WHEN** sync is triggered within 5 seconds of last scan
- **THEN** cached table list is returned
- **AND** no page scan occurs

#### Scenario: Page scan failure is isolated
- **WHEN** scanning one page fails (e.g., permission error)
- **THEN** other pages are still scanned
- **AND** a warning is logged for the failed page

### Requirement: Track Annotations with Tables
The system SHALL track which annotations have canvas tables.

- `checkCanvasSync()` returns array of annotation IDs with tables
- **Container mode: Extracts IDs from container's table column children names**
- **Legacy mode: Scans page for tables matching name pattern**
- Used to determine which annotations need table creation
- Enables "Insert Annotations" to create only missing tables

#### Scenario: Identify annotations via container
- **WHEN** container exists with tables for IDs [1, 3, 5]
- **AND** cache has annotations [1, 2, 3, 4, 5]
- **THEN** annotations 2 and 4 are identified as needing tables
- **AND** container lookup is O(1) per frame

#### Scenario: Identify annotations without tables
- **WHEN** sync returns IDs [1, 3, 5] as having tables
- **AND** cache has annotations [1, 2, 3, 4, 5]
- **THEN** annotations 2 and 4 are identified as needing tables

### Requirement: Container-Aware Sync
The system SHALL use annotation containers for efficient sync operations when available.

- Container lookup by name: `Annotation Container - {frameId}`
- Direct child traversal instead of page-wide scans
- Automatic frame position tracking via container metadata
- Single position update moves all artifacts when frame moves

#### Scenario: Sync container position with frame
- **WHEN** a frame moves
- **AND** sync detects position mismatch (>10px)
- **THEN** the container is repositioned to frame's right edge + 60px
- **AND** all child badges and tables move automatically

#### Scenario: Fast table lookup via container
- **WHEN** sync needs to find tables for a specific frame
- **THEN** container is found by name in O(1)
- **AND** tables are retrieved from table column's children
- **AND** no full page scan is required

#### Scenario: Container metadata provides frame mapping
- **WHEN** sync needs to determine which frame owns a table
- **THEN** container metadata `sourceFrameId` is read
- **AND** all children inherit the same frame ownership

### Requirement: Safe Canvas Operations
The system SHALL handle canvas operation failures gracefully.

- All canvas reads/writes are wrapped in try-catch
- Fallback values are used when operations fail
- Errors are logged but do not crash the sync process
- **Circuit breaker pattern prevents repeated failures from cascading**
- **Per-operation circuit breakers allow granular degradation**

#### Scenario: Parse failure uses fallback
- **WHEN** parsing an annotation table fails
- **THEN** null is returned for that table
- **AND** sync continues with other tables
- **AND** error is logged

#### Scenario: Circuit breaker trips after repeated failures
- **WHEN** 3 consecutive failures occur within 5 seconds for the same operation
- **THEN** the circuit breaker for that operation trips to `OPEN` state
- **AND** subsequent calls to that operation are blocked
- **AND** `FIGMA_ERROR` is emitted to UI with cooldown duration

#### Scenario: Validation happens before circuit breaker check
- **WHEN** a message handler receives a payload
- **THEN** Valibot validation occurs first (invalid payloads are rejected immediately)
- **AND** circuit breaker check occurs only for valid payloads
- **AND** invalid payloads do not count toward circuit breaker failure threshold

#### Scenario: Circuit breaker allows recovery after cooldown
- **WHEN** 30 seconds have passed since circuit breaker tripped
- **THEN** the breaker moves to `HALF_OPEN` state
- **AND** next operation attempt is allowed
- **AND** success resets breaker to `CLOSED`
- **AND** failure re-trips breaker for another 30 seconds

#### Scenario: Independent breakers per operation
- **WHEN** `cb_INSERT_ANNOTATIONS` breaker is open
- **AND** `cb_UPDATE_ANNOTATIONS` breaker is closed
- **THEN** insert operations are blocked
- **AND** update operations are allowed

### Requirement: Real-time Field Updates
The system SHALL support immediate field sync without debounce for specific operations.

- `field-update-realtime` message bypasses normal debounce
- Used for canvas-to-UI synchronization
- Emits confirmation with success/error status

#### Scenario: Real-time field update
- **WHEN** a field is edited on canvas
- **AND** `field-update-realtime` message is sent
- **THEN** the update is processed immediately
- **AND** confirmation is sent back to the source

### Requirement: Clear Table Cache
The system SHALL allow manual cache invalidation.

- `clearCanvasTableCache()` method clears all cached tables
- Used when tables are created/deleted to ensure fresh scans
- Logs cache clear for debugging

#### Scenario: Clear cache after table creation
- **WHEN** new tables are inserted
- **THEN** table cache is cleared
- **AND** next sync performs fresh page scans

### Requirement: Command Queue Serialization
The system SHALL serialize state-mutating operations through an async command queue to prevent race conditions.

- Mutating operations (CREATE, UPDATE, DELETE, REORDER, INSERT, save-data, delete-data) enter the queue
- Read operations (GET_SCREENS, SELECT_FRAME, SYNC_CANVAS) bypass the queue for responsiveness
- Queue processes commands in FIFO order
- Each command completes (success or failure) before the next begins
- Async gaps within handlers (e.g., `loadFontAsync`) do not allow interleaving

#### Scenario: Concurrent create operations are serialized
- **WHEN** two CREATE_ANNOTATION messages arrive within 10ms
- **THEN** the first is fully processed (including node save) before the second begins
- **AND** each receives a unique sequential ID
- **AND** no duplicate IDs are created

#### Scenario: Read operation bypasses queue
- **WHEN** GET_SCREENS is received while a CREATE_ANNOTATION is processing
- **THEN** GET_SCREENS executes immediately
- **AND** the response is sent without waiting for CREATE to complete

#### Scenario: Queue handles handler errors
- **WHEN** a queued command's handler throws an error
- **THEN** the error is caught and logged
- **AND** the queue continues processing remaining commands
- **AND** the failed command's promise is rejected

### Requirement: Internal Mutation Flag
The system SHALL suppress self-triggered `documentchange` events during command queue processing.

- `isInternalMutation` flag is set to `true` before command execution
- `isInternalMutation` flag is set to `false` after command completion (in `finally` block)
- `NodeChangeCoordinator` checks this flag and skips processing when `true`
- Flag is reset even if handler throws an error

#### Scenario: Internal mutation skips nodechange handling
- **WHEN** `INSERT_ANNOTATIONS` creates table nodes
- **AND** Figma emits `documentchange` events for those nodes
- **THEN** `NodeChangeCoordinator` detects `isInternalMutation === true`
- **AND** the events are logged but not processed
- **AND** no redundant sync cycles occur

#### Scenario: Flag resets on error
- **WHEN** a command handler throws an error
- **THEN** `isInternalMutation` is reset to `false` in the `finally` block
- **AND** subsequent external `documentchange` events are processed normally

### Requirement: Request ID Generation
The system SHALL generate a unique request ID for each state-mutating operation initiated from the UI.

- **Request ID is a UUID v4 generated via `crypto.randomUUID()` when available**
- **The system SHALL provide a fallback unique identifier (e.g., timestamp + random) for environments where `crypto.randomUUID()` is unavailable**
- Request ID is generated in the UI thread before `emit()`
- Request ID is included in the message payload
- Request ID is stored in `inFlightRequests` Map with pre-mutation snapshot

#### Scenario: Create annotation generates request ID
- **WHEN** user clicks "Create Annotation"
- **THEN** a unique ID is generated
- **AND** the CREATE_ANNOTATION message includes `requestId` field
- **AND** the request is tracked in `inFlightRequests` with current annotations snapshot

#### Scenario: Request ID is unique per operation
- **WHEN** user rapidly clicks "Create" twice within 100ms
- **THEN** two distinct IDs are generated
- **AND** both are tracked separately in `inFlightRequests`

#### Scenario: Fallback ID used when crypto unavailable
- **WHEN** `crypto.randomUUID` is not a function
- **THEN** a fallback ID starting with `req-` is generated
- **AND** the operation proceeds normally

### Requirement: Response Echo and Correlation
The system SHALL echo the request ID in all responses to state-mutating operations.

- Main thread extracts `requestId` from incoming message
- Main thread includes `requestId` in response message
- UI matches response to originating request via `requestId`

#### Scenario: Create response includes request ID
- **WHEN** CREATE_ANNOTATION with `requestId: "abc-123"` is processed
- **THEN** ANNOTATION_CREATED response includes `requestId: "abc-123"`
- **AND** UI can correlate response to the original action

#### Scenario: Error response includes request ID
- **WHEN** an operation fails
- **THEN** the error response includes the original `requestId`
- **AND** UI can identify which operation failed

### Requirement: Stale Response Discard
The system SHALL discard responses with unknown or expired request IDs.

- UI checks `inFlightRequests` for the response's `requestId`
- If not found (unknown or already completed), response is discarded
- Discarded responses are logged as warnings
- Valid responses remove entry from `inFlightRequests`

#### Scenario: Stale response is discarded
- **WHEN** a response arrives with `requestId: "xyz-789"`
- **AND** `inFlightRequests` does not contain "xyz-789"
- **THEN** the response is logged as stale
- **AND** the response is not applied to UI state

#### Scenario: Valid response clears tracking
- **WHEN** a response arrives with `requestId: "abc-123"`
- **AND** `inFlightRequests` contains "abc-123"
- **THEN** the entry is removed from `inFlightRequests`
- **AND** the pre-mutation snapshot is returned for potential rollback

### Requirement: Request Deduplication
The system SHALL prevent duplicate execution of operations with the same request ID.

- Main thread maintains `processedRequestIds` Set with 5-second TTL
- If incoming `requestId` is in Set, operation is skipped
- Skipped operations are logged as duplicates
- Set entries are cleaned up after TTL expires

#### Scenario: Duplicate message is skipped
- **WHEN** CREATE_ANNOTATION with `requestId: "abc-123"` arrives
- **AND** "abc-123" was already processed within 5 seconds
- **THEN** the operation is skipped
- **AND** a debug log notes "Duplicate request skipped"

#### Scenario: Expired deduplication entry allows re-execution
- **WHEN** 6 seconds have passed since `requestId: "abc-123"` was processed
- **AND** the same `requestId` arrives again
- **THEN** the operation is allowed (entry expired)

### Requirement: Atomic Transaction Wrapper
The system SHALL wrap multi-step node operations in a transaction that ensures all-or-nothing semantics.

- Nodes are created inside an invisible draft frame with `visible: false`
- Draft frame is named with `⚠️ [BUILDING]` prefix
- Draft frame has `isTransactionDraft: "true"` in plugin data
- Draft frame is positioned at (0, 0) to preserve child coordinates during unboxing
- On success, children are "unboxed" (moved to parent), draft frame is deleted
- On failure, entire draft frame is deleted (compensating action)

**Implementation Note:** Uses `FrameNode` instead of `GroupNode` because `GroupNode` does not support the `visible` property in the Figma API.

#### Scenario: Successful table creation commits transaction
- **WHEN** `createAnnotationTable()` completes successfully
- **THEN** children are moved from draft frame to parent
- **AND** child coordinates are preserved (absolute position unchanged)
- **AND** draft frame is removed
- **AND** no transaction metadata remains on canvas

#### Scenario: Failed table creation aborts transaction
- **WHEN** `createAnnotationTable()` fails (e.g., font load error)
- **THEN** the draft frame is deleted
- **AND** all child nodes are removed
- **AND** no orphan nodes remain on canvas
- **AND** error is propagated to caller

#### Scenario: Transaction scope
- **WHEN** transaction wrapper is used
- **THEN** only `createAnnotationTable()` is wrapped (multi-step operation)
- **AND** simple single-step operations (badge creation, container creation) are NOT wrapped
- **AND** transaction overhead is applied only where needed

### Requirement: Transaction Draft Tagging
The system SHALL tag transaction draft nodes for identification and cleanup.

- Plugin data key: `isTransactionDraft`
- Plugin data value: `"true"` (string)
- Additional plugin data: `transactionStartTime` (timestamp as milliseconds string)
- Tags are set on draft frame creation
- Tags are cleared by deleting the draft frame (not by clearing plugin data)

#### Scenario: Draft frame has correct metadata
- **WHEN** a transaction begins
- **THEN** draft frame has `isTransactionDraft: "true"`
- **AND** draft frame has `transactionStartTime: "{Date.now()}"`
- **AND** draft frame has `visible: false`
- **AND** draft frame is positioned at (0, 0)

#### Scenario: Committed transaction has no draft metadata
- **WHEN** a transaction commits successfully
- **THEN** the draft frame is removed (deleted)
- **AND** children are moved to parent with preserved coordinates
- **AND** no nodes with `isTransactionDraft` plugin data remain

### Requirement: Startup Garbage Collection
The system SHALL clean up orphaned draft nodes on plugin initialization.

- On plugin start, scan current page for nodes with `isTransactionDraft: "true"`
- Delete any orphaned draft nodes found
- Log count of cleaned nodes
- Show user notification if orphans were cleaned

#### Scenario: Orphaned draft from crashed session is cleaned
- **WHEN** plugin starts
- **AND** previous session crashed during table creation
- **AND** orphaned draft group exists with `isTransactionDraft: "true"`
- **THEN** the orphaned group is deleted
- **AND** user sees "Cleaned up 1 incomplete operation from last session"

#### Scenario: No orphans on clean startup
- **WHEN** plugin starts
- **AND** no orphaned draft nodes exist
- **THEN** no cleanup occurs
- **AND** no notification is shown

#### Scenario: Multiple orphans are cleaned
- **WHEN** plugin starts
- **AND** 3 orphaned draft groups exist
- **THEN** all 3 are deleted
- **AND** user sees "Cleaned up 3 incomplete operations from last session"

### Requirement: Draft Naming Convention
The system SHALL use a distinct naming prefix for draft nodes to aid debugging.

- Draft frame name format: `⚠️ [BUILDING] {operationName}`
- Prefix is visible if user inspects layers during operation
- Draft frame is removed on commit (not renamed)
- Prefix aids in identifying stuck transactions during debugging

#### Scenario: Draft frame has building prefix
- **WHEN** transaction begins for "Annotation Table 3"
- **THEN** draft frame is named `⚠️ [BUILDING] Annotation Table 3`

#### Scenario: Committed transaction removes draft frame
- **WHEN** transaction commits
- **THEN** draft frame is deleted (not renamed)
- **AND** children are moved to parent preserving their names

### Requirement: Circuit Breaker Per-Operation Keying
The system SHALL maintain independent circuit breakers for each operation type.

- Breaker keys follow pattern: `cb_{MESSAGE_TYPE}`
- Each key tracks its own failure count and state
- Tripping one breaker does not affect others
- All breakers share the same configuration thresholds

#### Scenario: Insert breaker trips independently
- **WHEN** INSERT_ANNOTATIONS fails 3 times
- **THEN** `cb_INSERT_ANNOTATIONS` breaker trips
- **AND** `cb_UPDATE_ANNOTATIONS` remains closed
- **AND** users can still update existing tables

#### Scenario: Multiple breakers can be open
- **WHEN** both INSERT and UPDATE operations fail repeatedly
- **THEN** both `cb_INSERT_ANNOTATIONS` and `cb_UPDATE_ANNOTATIONS` are open
- **AND** UI shows both operations as temporarily unavailable

### Requirement: Circuit Breaker UI Feedback
The system SHALL notify users when circuit breakers affect functionality.

- `FIGMA_ERROR` message includes operation name and cooldown duration
- UI disables affected buttons during cooldown
- Warning banner shows countdown timer
- `FIGMA_ERROR_CLEARED` message re-enables UI

#### Scenario: UI shows warning when breaker trips
- **WHEN** `cb_INSERT_ANNOTATIONS` breaker trips
- **THEN** UI receives `FIGMA_ERROR` with `{ operation: 'INSERT_ANNOTATIONS', cooldownMs: 30000 }`
- **AND** "Insert Annotations" button is disabled
- **AND** warning banner shows "Canvas insert paused. Retry in 30s"

#### Scenario: UI clears warning when breaker resets
- **WHEN** `cb_INSERT_ANNOTATIONS` breaker resets after cooldown
- **THEN** UI receives `FIGMA_ERROR_CLEARED` with `{ operation: 'INSERT_ANNOTATIONS' }`
- **AND** "Insert Annotations" button is re-enabled
- **AND** warning banner is removed

### Requirement: Sliding Window Failure Tracking
The system SHALL track failures within a sliding time window.

- Failures are timestamped when recorded
- Only failures within the last 5 seconds count toward threshold
- Old failures are pruned before threshold check
- This prevents accumulating failures over long sessions

#### Scenario: Old failures don't count
- **WHEN** 2 failures occurred 10 seconds ago
- **AND** 1 failure occurs now
- **THEN** only 1 failure is within the window
- **AND** breaker does not trip (threshold is 3)

#### Scenario: Rapid failures trip breaker
- **WHEN** 3 failures occur within 2 seconds
- **THEN** all 3 are within the window
- **AND** breaker trips immediately

