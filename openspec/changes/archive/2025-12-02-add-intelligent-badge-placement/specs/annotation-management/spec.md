# Annotation Management - Delta

## MODIFIED Requirements

### Requirement: Create Annotation
The system SHALL create a new annotation when a user selects a Figma element and triggers the create action.

- Annotation is attached to the selected element via `elementId`
- Annotation stores `targetElementId` for explicit element targeting
- Annotation inherits frame context (`frameId`, `frameName`, `pageId`, `pageName`)
- Annotation receives a unique sequential ID within the frame
- Annotation is initialized with platform-specific default fields (mobile or web)
- Timestamps are set (`createdAt`, `updatedAt`)

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

## ADDED Requirements

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
