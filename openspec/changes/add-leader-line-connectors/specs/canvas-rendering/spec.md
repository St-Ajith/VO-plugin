## ADDED Requirements

### Requirement: Create Leader Line Connector
The system SHALL create a visual line connecting the annotation table to its target element.

- Line is created using `figma.createLine()` API
- Line connects from annotation table edge to target element bounding box
- Line is grouped with the annotation table
- Line node ID is stored in table metadata for lifecycle tracking

#### Scenario: Create leader line for annotation
- **WHEN** an annotation table is created on canvas
- **THEN** a leader line is drawn from the table to the target element
- **AND** the line is grouped with the table node

### Requirement: Update Leader Line on Move
The system SHALL update leader line endpoints when the annotation table or target element moves.

- Line endpoints are recalculated on nodechange events
- Position updates are debounced to prevent excessive redraws

#### Scenario: Element moves updates leader line
- **WHEN** an annotated element is moved on the canvas
- **THEN** the leader line endpoint is updated to track the new position
