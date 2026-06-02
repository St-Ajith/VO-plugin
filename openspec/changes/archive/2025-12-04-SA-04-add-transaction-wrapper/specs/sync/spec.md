## ADDED Requirements

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
