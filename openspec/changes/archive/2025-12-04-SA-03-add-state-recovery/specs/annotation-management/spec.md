## ADDED Requirements

### Requirement: Runtime Schema Validation
The system SHALL validate incoming IPC payloads using Valibot runtime schemas.

- Validation occurs on Main thread before processing operations
- Invalid payloads are rejected with structured error response
- Unknown keys are stripped from annotation objects
- Validation errors include field path and error message

#### Scenario: Valid annotation passes validation
- **WHEN** a CREATE_ANNOTATION message contains valid annotation data
- **THEN** the data passes Valibot schema validation
- **AND** the operation proceeds normally

#### Scenario: Invalid annotation is rejected
- **WHEN** a CREATE_ANNOTATION message is missing required `frameId`
- **THEN** validation fails with error: `"frameId: Required"`
- **AND** ANNOTATION_CREATED response has `success: false` with error details
- **AND** `requestId` is included for UI correlation

#### Scenario: Unknown keys are stripped
- **WHEN** an annotation payload includes `{ ...validData, unknownField: "foo" }`
- **THEN** `unknownField` is removed before storage
- **AND** only schema-defined fields are persisted

### Requirement: Bulk Validation in setAnnotations
The system SHALL validate all annotations when bulk-setting the annotation array.

- Each annotation is validated individually
- Invalid annotations are filtered out with warning log
- Valid annotations are applied
- Empty array after filtering is allowed (clears all)

#### Scenario: Bulk set with mixed validity
- **WHEN** `setAnnotations([valid1, invalid, valid2])` is called
- **THEN** `invalid` is logged as warning and excluded
- **AND** store contains only `[valid1, valid2]`

#### Scenario: Bulk set with all invalid
- **WHEN** `setAnnotations([invalid1, invalid2])` is called
- **THEN** both are logged as warnings
- **AND** store is set to empty array
- **AND** operation succeeds (no throw)

### Requirement: Pre-Mutation Snapshot Capture
The system SHALL capture a snapshot of current state before optimistic UI updates.

- Snapshot is a deep copy of `annotations.value`
- Snapshot is stored in `inFlightRequests` Map (keyed by `requestId`)
- Snapshot is captured before any local state mutation

#### Scenario: Snapshot captured before create
- **WHEN** user triggers CREATE_ANNOTATION
- **THEN** current `annotations.value` is deep-copied
- **AND** copy is stored in `inFlightRequests[requestId].preMutationSnapshot`
- **AND** then optimistic update adds placeholder annotation

#### Scenario: Snapshot captured before delete
- **WHEN** user triggers DELETE_ANNOTATION for annotation 3
- **THEN** snapshot includes annotation 3
- **AND** optimistic update removes annotation 3 from UI

### Requirement: State Recovery on Failure
The system SHALL recover to authoritative state when Main thread operation fails.

- Failure is detected via `save-data-result.success === false`
- Recovery requests fresh `INIT` payload from Main thread (not local rollback)
- UI state is replaced with authoritative data
- User is notified of failure and recovery

#### Scenario: Failed save triggers re-sync
- **WHEN** `save-data-result` arrives with `success: false`
- **THEN** UI shows notification "Operation failed, syncing..."
- **AND** `REQUEST_RESYNC` message is sent to Main thread
- **AND** Main thread responds with fresh `INIT` payload
- **AND** UI replaces `annotations.value` with authoritative data

#### Scenario: Recovery handles concurrent document changes
- **WHEN** operation fails and another user modified the document
- **THEN** re-sync fetches current authoritative state (including other user's changes)
- **AND** UI reflects the true document state

### Requirement: Syncing UI Indicator
The system SHALL display a loading indicator during state recovery.

- `isSyncing` signal is `true` during recovery
- Form inputs are disabled during sync
- Subtle overlay indicates sync in progress
- Indicator auto-dismisses after re-sync or 5s timeout

#### Scenario: Syncing indicator appears on failure
- **WHEN** state recovery begins
- **THEN** `isSyncing.value` becomes `true`
- **AND** UI shows loading overlay
- **AND** annotation form inputs are disabled

#### Scenario: Syncing indicator dismisses after recovery
- **WHEN** `INIT` payload is received during recovery
- **THEN** state is updated
- **AND** `isSyncing.value` becomes `false`
- **AND** loading overlay is removed
- **AND** form inputs are re-enabled

### Requirement: Echo Prevention During Sync
The system SHALL prevent mutation handlers from emitting save-data messages during re-sync.

- Handlers check `isSyncing.value` at entry point
- If syncing, handler returns early without action
- Prevents infinite loop: Sync → Save → Sync → Save
- INIT handler sets state directly (no handler call)

#### Scenario: Mutation blocked during sync
- **WHEN** `isSyncing.value` is `true`
- **AND** user somehow triggers `handleUpdateAnnotation`
- **THEN** handler logs "Update blocked - sync in progress"
- **AND** no `save-data` message is emitted
- **AND** no local state change occurs

#### Scenario: INIT during sync doesn't echo
- **WHEN** `INIT` payload arrives during recovery
- **THEN** `annotations.value` is set directly (not via handler)
- **AND** no `save-data` message is emitted
- **AND** sync completes without echo loop
