# Canvas Rendering - Spec Delta

## MODIFIED Requirements

### Requirement: Create Annotation Container
The system SHALL create an auto-layout container for each annotated frame to hold all annotation artifacts (badges and tables).

- Container is a Figma Frame with horizontal auto-layout
- Container has two child columns: badge column (left) and table column (right)
- Badge column uses vertical auto-layout with 8px gap between badges
- Table column uses vertical auto-layout with 50px gap between tables
- Container is positioned at frame's right edge + 60px gap
- Container is named `Annotation Container - {frameId}`
- Container metadata (sourceFrameId, version, timestamp) is stored in plugin data

#### Scenario: Create container for first annotation
- **WHEN** "Insert Annotations" is triggered for a frame with no existing container
- **THEN** a new annotation container is created at the frame's right edge
- **AND** the container has an empty badge column and empty table column
- **AND** container metadata is stored in plugin data

#### Scenario: Reuse existing container
- **WHEN** "Insert Annotations" is triggered for a frame with an existing container
- **THEN** the existing container is reused (no new container created)
- **AND** new artifacts are inserted into the existing columns

#### Scenario: Reposition container when frame moves (INSERT)
- **WHEN** "Insert Annotations" is triggered and the frame has moved significantly (>10px)
- **THEN** the container is repositioned to the frame's right edge + 60px

#### Scenario: Reposition container when frame moves (UPDATE)
- **WHEN** "Update Annotations" is triggered and the frame has moved significantly (>10px)
- **THEN** the container is repositioned to the frame's right edge + 60px
- **AND** container repositioning uses the same 10px threshold as INSERT flow

#### Scenario: Container created during UPDATE if missing
- **WHEN** "Update Annotations" is triggered for a frame with no existing container
- **THEN** a new container is created at the frame's right edge
- **AND** existing badges and tables are inserted into the container

### Requirement: Update Annotation Table
The system SHALL update existing tables when annotation data changes.

- In-place text updates when structure matches (fast path)
- Full table recreation when platform or structure changes (fallback)
- Position is preserved (Y coordinate) to respect user adjustments
- X coordinate updates only if target element moved significantly (>10px)
- **Container is checked and repositioned if frame moved significantly (>10px)**

#### Scenario: Update field value in existing table
- **WHEN** user edits a field and the table exists
- **THEN** only the text content is updated (no table recreation)
- **AND** the table position is preserved
- **AND** container is repositioned if frame moved >10px

#### Scenario: Switch platform recreates table
- **WHEN** annotation platform changes from mobile to web
- **THEN** the existing table is removed
- **AND** a new table with web structure is created
- **AND** container is repositioned if frame moved >10px

