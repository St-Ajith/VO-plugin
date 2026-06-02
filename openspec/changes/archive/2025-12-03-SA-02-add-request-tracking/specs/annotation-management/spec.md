## MODIFIED Requirements

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

### Requirement: Delete Annotation
The system SHALL remove an annotation when the user deletes it.

- Annotation is removed from in-memory store
- Plugin data is cleared from the associated node
- Canvas artifacts (table, badge) are removed
- Deletion is idempotent (deleting non-existent annotation succeeds silently)
- **Operation includes `requestId` for tracking and deduplication**

#### Scenario: Delete existing annotation
- **WHEN** user clicks delete on an annotation
- **THEN** the annotation is removed from the list
- **AND** the annotation table and badge are removed from canvas
- **AND** the plugin data is cleared from the Figma node

#### Scenario: Delete already-deleted annotation
- **WHEN** delete is triggered for an annotation that no longer exists
- **THEN** the operation succeeds silently (idempotent)
- **AND** no error is thrown

#### Scenario: Delete response includes request ID
- **WHEN** DELETE_ANNOTATION is processed
- **THEN** ANNOTATION_DELETED response includes the original `requestId`

### Requirement: Reorder Annotations
The system SHALL allow users to reorder annotations within a frame.

- Annotations can be moved up or down in the list
- Reordering updates the visual order in the UI
- Reordering triggers canvas badge number updates when tables are inserted
- **Operation includes `requestId` for tracking and deduplication**

#### Scenario: Move annotation up
- **WHEN** user clicks "move up" on annotation 3
- **THEN** annotation 3 swaps position with annotation 2
- **AND** the UI list reflects the new order

#### Scenario: Move annotation at top up
- **WHEN** user clicks "move up" on the first annotation
- **THEN** no change occurs (boundary condition)

#### Scenario: Reorder response includes request ID
- **WHEN** REORDER_ANNOTATION is processed
- **THEN** ANNOTATIONS_REORDERED response includes the original `requestId`
