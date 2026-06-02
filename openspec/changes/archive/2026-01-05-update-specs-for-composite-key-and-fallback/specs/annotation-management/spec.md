## MODIFIED Requirements
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
