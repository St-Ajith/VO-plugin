# Focus Order

## Purpose

Annotation ordering and dynamic numbering for accessibility reading order. This capability manages sequential IDs, reordering operations, and ensures badge numbers reflect the intended screen reader navigation sequence.

## Requirements

### Requirement: Sequential Annotation IDs
The system SHALL assign sequential IDs to annotations within each frame.

- IDs are unique within a frame context
- New annotations receive the lowest available ID (fills gaps)
- IDs are displayed as badge numbers on canvas
- IDs determine the default reading/focus order

#### Scenario: First annotation in frame
- **WHEN** the first annotation is created in a frame
- **THEN** it receives ID 1

#### Scenario: Fill ID gap
- **WHEN** annotations 1, 3, 4 exist (2 was deleted)
- **AND** a new annotation is created
- **THEN** the new annotation receives ID 2

#### Scenario: IDs are frame-scoped
- **WHEN** Frame A has annotations 1, 2, 3
- **AND** Frame B has annotations 1, 2
- **THEN** both frames maintain independent ID sequences

### Requirement: Reorder Annotations
The system SHALL allow users to change annotation order via up/down controls.

- Up moves annotation earlier in the list (lower visual position)
- Down moves annotation later in the list (higher visual position)
- Reordering swaps positions with adjacent annotation
- Boundary conditions are handled gracefully (no-op at edges)

#### Scenario: Move annotation up
- **WHEN** annotation at position 2 is moved up
- **THEN** it swaps with the annotation at position 1
- **AND** the list order is updated

#### Scenario: Move annotation down
- **WHEN** annotation at position 2 is moved down
- **THEN** it swaps with the annotation at position 3
- **AND** the list order is updated

#### Scenario: Move first annotation up
- **WHEN** the first annotation is moved up
- **THEN** no change occurs (already at top)

#### Scenario: Move last annotation down
- **WHEN** the last annotation is moved down
- **THEN** no change occurs (already at bottom)

### Requirement: Update Canvas Badge Numbers
The system SHALL update badge numbers on canvas when order changes.

- Badge numbers reflect the current list position (not original ID)
- Badge updates are triggered by "Update Annotations" action
- Table header badges are also updated to match

#### Scenario: Reorder triggers badge update
- **WHEN** annotations are reordered and "Update Annotations" is clicked
- **THEN** all badges are updated to reflect new order
- **AND** table header badges match the new numbers

### Requirement: Order Persistence
The system SHALL persist annotation order across plugin sessions.

- Order is determined by array position in storage
- Reordering updates the array order
- Loading preserves the saved order

#### Scenario: Order persists after plugin close
- **WHEN** annotations are reordered
- **AND** the plugin is closed and reopened
- **THEN** the annotations appear in the saved order

### Requirement: Order Affects Table Stacking
The system SHALL stack annotation tables based on annotation order.

- Tables are stacked vertically in annotation order
- Y offset is calculated from sum of preceding table heights
- Gap between tables is 50px
- Height calculation is deterministic (based on row count)

#### Scenario: Table stacking follows order
- **WHEN** annotations 1, 2, 3 are inserted for the same element
- **THEN** table 1 appears at base Y position
- **AND** table 2 appears below table 1 with gap
- **AND** table 3 appears below table 2 with gap
