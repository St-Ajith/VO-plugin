## RENAMED Requirements
- FROM: `### Requirement: Handle Annotation Table Selection`
- TO: `### Requirement: Handle Canvas Annotation Selection`

## MODIFIED Requirements
### Requirement: Handle Canvas Annotation Selection
The system SHALL navigate to the source frame when any canvas annotation artifact is selected.

- Detects annotation tables, badges, containers, and table descendants (e.g., rows/cells)
- Reads source frame ID from plugin metadata when present; falls back to naming patterns
- Switches context to the source frame and emits `FRAME_AUTO_SWITCHED` with frame annotations
- Expands the linked annotation in the UI when a badge, table, or table descendant is selected
- For multi-select involving annotation tables/descendants, uses only the first selected element’s parent table to drive frame selection and expansion

#### Scenario: Select annotation table navigates to source
- **WHEN** user selects an "Annotation Table {id} - {frameId}" node (or a table with matching metadata)
- **THEN** the plugin context switches to the source frame
- **AND** annotation `{id}` is expanded in the UI
- **AND** a notification shows "Navigated to source frame: {frameName}"

#### Scenario: Select annotation badge navigates and expands
- **WHEN** user selects an "Annotation Badge {id} - {frameId}" node
- **THEN** the plugin context switches to the badge’s source frame
- **AND** annotation `{id}` is expanded in the UI

#### Scenario: Select annotation table descendant navigates and expands
- **WHEN** user selects a node contained within an annotation table (e.g., a row or cell)
- **THEN** the plugin resolves the parent table, switches to its source frame, and expands the linked annotation

#### Scenario: Select annotation container navigates to source frame
- **WHEN** user selects an "Annotation Container - {frameId}" node
- **THEN** the plugin context switches to that frame
- **AND** the UI updates to show that frame’s annotations

#### Scenario: Multi-select honors first annotation table
- **WHEN** multiple annotation tables or their descendants are selected
- **THEN** the plugin uses only the first selected element’s parent table to determine the source frame and annotation expansion
