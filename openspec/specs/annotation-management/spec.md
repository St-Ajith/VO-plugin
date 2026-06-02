# Annotation Management

## Purpose

Core CRUD operations for accessibility annotations attached to Figma elements. This capability enables users to create, read, update, delete, and reorder annotations within Figma frames.
## Requirements
### Requirement: Create Annotation
The system SHALL create a new annotation when a user selects a Figma element and triggers the create action.

- Annotation is attached to the selected element via `elementId`
- Annotation stores `targetElementId` for explicit element targeting
- Annotation inherits frame context (`frameId`, `frameName`, `pageId`, `pageName`)
- Annotation receives a unique sequential ID within the frame
- Annotation is initialized with platform-specific default fields (mobile or web)
- Timestamps are set (`createdAt`, `updatedAt`)
- **Operation includes `requestId` for tracking and deduplication**

#### Scenario: Create annotation for selected element
- **WHEN** user selects a Figma element and clicks "Create Annotation"
- **THEN** a new annotation is created with the element's ID stored in both `elementId` and `targetElementId`
- **AND** the annotation appears in the UI list for the current frame
- **AND** the annotation is saved to the element's plugin data

#### Scenario: Create annotation with no selection
- **WHEN** user clicks "Create Annotation" with no element selected
- **THEN** an error notification is shown
- **AND** no annotation is created

#### Scenario: Create annotation generates unique ID
- **WHEN** a frame already has annotations with IDs 1, 2, 3
- **AND** annotation 2 was deleted
- **THEN** the next annotation created receives ID 2 (fills gap)

#### Scenario: Create annotations from multi-selection
- **WHEN** user selects 5 elements and clicks "Create Annotation"
- **THEN** 5 annotations are created, one per selected element
- **AND** each annotation has its `targetElementId` set to the respective element
- **AND** a notification shows "Created 5 annotations"

#### Scenario: Create response includes request ID
- **WHEN** CREATE_ANNOTATION is processed successfully
- **THEN** ANNOTATION_CREATED response includes the original `requestId`
- **AND** UI correlates response to remove from `inFlightRequests`

### Requirement: Update Annotation
The system SHALL update annotation fields when the user modifies them in the UI.

- Field updates are validated before saving
- Updates are persisted to node plugin data (authoritative source)
- `updatedAt` timestamp is refreshed on each update
- Deep merge is performed for nested platform data (mobile.ios, mobile.android, web)
- **Operation includes `requestId` for tracking and deduplication**
- **Annotations MUST be identified by the composite key of `frameId` and `id` to prevent cross-frame collisions**

#### Scenario: Update mobile annotation field
- **WHEN** user edits the "Label" field for iOS
- **THEN** `mobile.ios.label` is updated in the annotation
- **AND** `updatedAt` timestamp is refreshed
- **AND** the change is persisted to node plugin data

#### Scenario: Update web annotation field
- **WHEN** user edits the "aria-label" field for a web annotation
- **THEN** `web.ariaLabel` is updated in the annotation
- **AND** the change is persisted to node plugin data

#### Scenario: Invalid update is rejected
- **WHEN** an update contains invalid data (null required fields)
- **THEN** the update is rejected with an error
- **AND** the original annotation data is preserved

#### Scenario: Update response includes request ID
- **WHEN** UPDATE_ANNOTATION is processed
- **THEN** ANNOTATION_UPDATED response includes the original `requestId`
- **AND** the response includes `frameId` for composite key matching

### Requirement: Delete Annotation
The system SHALL remove an annotation when the user deletes it.

- Annotation is removed from in-memory store
- Plugin data is cleared from the associated node
- Canvas artifacts (table, badge) are removed
- Deletion is idempotent (deleting non-existent annotation succeeds silently)
- **Operation includes `requestId` for tracking and deduplication**
- **Annotations MUST be identified by the composite key of `frameId` and `id`**

#### Scenario: Delete existing annotation
- **WHEN** user clicks delete on an annotation
- **THEN** the annotation is removed from the list
- **AND** the annotation table and badge are removed from canvas
- **AND** the plugin data is cleared from the Figma node

#### Scenario: Delete already-deleted annotation
- **WHEN** delete is triggered for an annotation that no longer exists
- **THEN** the operation succeeds silently (idempotent)
- **AND** no error is thrown

#### Scenario: Delete response includes request ID and frame ID
- **WHEN** DELETE_ANNOTATION is processed
- **THEN** ANNOTATION_DELETED response includes the original `requestId`
- **AND** the response includes the `frameId` of the deleted annotation

### Requirement: Reorder Annotations
The system SHALL allow users to reorder annotations within a frame.

- Annotations can be moved up or down in the list
- Reordering updates the visual order in the UI
- Reordering triggers canvas badge number updates when tables are inserted
- **Operation includes `requestId` for tracking and deduplication**
- **Reordering is scoped to the current frame; annotations MUST be identified by the composite key of `frameId` and `id`**

#### Scenario: Move annotation up
- **WHEN** user clicks "move up" on annotation 3
- **THEN** annotation 3 swaps position with annotation 2 within the same frame
- **AND** the UI list reflects the new order

#### Scenario: Move annotation at top up
- **WHEN** user clicks "move up" on the first annotation
- **THEN** no change occurs (boundary condition)

#### Scenario: Reorder response includes request ID
- **WHEN** REORDER_ANNOTATION is processed
- **THEN** ANNOTATIONS_REORDERED response includes the original `requestId`

### Requirement: Load Annotations
The system SHALL load all annotations from Figma node plugin data on initialization.

- All pages are scanned for nodes with annotation data
- Legacy data formats are migrated if detected
- Duplicate annotations are removed during load
- Invalid annotations are filtered out with warning logs

#### Scenario: Load annotations on plugin start
- **WHEN** the plugin is opened
- **THEN** all annotations from all pages are loaded into memory
- **AND** the UI displays annotations for the currently selected frame

#### Scenario: Load with legacy data
- **WHEN** legacy shared plugin data exists
- **THEN** annotations are migrated to node-based storage
- **AND** legacy data format is updated

### Requirement: Detect Tagged Elements
The system SHALL detect elements with naming convention prefix `vo-label-trait` for bulk annotation.

- Elements with names starting with `vo-label-trait ` are considered tagged
- Tag format: `vo-label-trait {label} {trait}` where label and trait are space-separated
- Detection scans all descendants of the current frame
- Detected elements are offered for annotation creation via UI prompt

#### Scenario: Scan frame for tagged elements
- **WHEN** user selects a frame containing elements named `vo-label-trait Back Button` and `vo-label-trait Submit`
- **THEN** the system detects 2 tagged elements
- **AND** UI prompts "Found 2 tagged elements. Add annotations?"

#### Scenario: Parse tag with label and trait
- **WHEN** an element is named `vo-label-trait Choose a ride Header`
- **THEN** the parsed label is "Choose a ride"
- **AND** the parsed trait is "Header"

#### Scenario: Parse tag with label only
- **WHEN** an element is named `vo-label-trait Back`
- **THEN** the parsed label is "Back"
- **AND** the parsed trait is empty/default

#### Scenario: Create annotations from tagged elements
- **WHEN** user confirms "Add annotations" for 3 tagged elements
- **THEN** 3 annotations are created with pre-filled label and trait fields
- **AND** each annotation's `targetElementId` references the tagged element

### Requirement: Handle Orphaned Annotations
The system SHALL detect and handle annotations whose target element no longer exists.

- Orphan detection occurs during sync and plugin initialization
- Orphaned annotations are retained (not auto-deleted) to preserve data
- UI displays warning indicator for orphaned annotations
- User can re-target orphaned annotations to new elements

#### Scenario: Detect orphaned annotation on load
- **WHEN** plugin loads and annotation has `targetElementId` pointing to deleted element
- **THEN** the annotation is marked as orphaned
- **AND** UI displays ⚠️ warning icon on the annotation

#### Scenario: Re-target orphaned annotation
- **WHEN** user clicks "Re-target" on an orphaned annotation
- **AND** user selects a new element
- **THEN** the annotation's `targetElementId` and `elementId` are updated
- **AND** the annotation is no longer marked as orphaned
- **AND** the badge is created at the new element's position

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

