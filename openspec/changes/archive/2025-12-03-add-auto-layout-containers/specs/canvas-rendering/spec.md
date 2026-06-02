# Canvas Rendering - Spec Delta

## ADDED Requirements

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

#### Scenario: Reposition container when frame moves
- **WHEN** "Insert Annotations" is triggered and the frame has moved significantly (>10px)
- **THEN** the container is repositioned to the frame's right edge + 60px

### Requirement: Auto-Layout Badge Column
The system SHALL insert annotation badges into the container's badge column using auto-layout.

- Badges are inserted in annotation ID order (lowest at top)
- Badge column automatically stacks badges vertically
- No manual Y-position calculation is required

#### Scenario: Insert badge in sorted order
- **WHEN** a badge is created for annotation ID 3 and badges 1, 5 exist
- **THEN** the badge is inserted between badges 1 and 5
- **AND** the column automatically adjusts spacing

#### Scenario: Badge column grows with content
- **WHEN** multiple badges are added to the column
- **THEN** the column height expands automatically to fit all badges

### Requirement: Auto-Layout Table Column
The system SHALL insert annotation tables into the container's table column using auto-layout.

- Tables are inserted in annotation ID order (lowest at top)
- Table column automatically stacks tables vertically with 50px gap
- No manual Y-position calculation or collision avoidance is required

#### Scenario: Insert table in sorted order
- **WHEN** a table is created for annotation ID 3 and tables 1, 5 exist
- **THEN** the table is inserted between tables 1 and 5
- **AND** the column automatically adjusts spacing

#### Scenario: Table column handles varying heights
- **WHEN** tables with different heights are added (mobile vs web, different field counts)
- **THEN** the column automatically spaces tables with consistent 50px gaps
- **AND** no overlap occurs regardless of table heights

### Requirement: Container Lifecycle Management
The system SHALL manage container lifecycle based on annotation presence.

- Container is created when first annotation is inserted for a frame
- Container is deleted when last annotation for that frame is deleted
- Container is recreated if user manually deletes it and annotations still exist

#### Scenario: Delete container when empty
- **WHEN** the last annotation for a frame is deleted
- **THEN** the annotation container for that frame is removed from canvas

#### Scenario: Recreate deleted container
- **WHEN** "Insert Annotations" is triggered for a frame whose container was manually deleted
- **THEN** a new container is created
- **AND** all existing badges and tables for that frame are recreated inside it

## MODIFIED Requirements

### Requirement: Create Annotation Table
The system SHALL create a visual table on the canvas representing an annotation's data.

- Table is a Figma Frame with auto-layout
- Table includes header row with annotation ID badge
- Table includes data rows for platform-specific fields
- **Table is inserted into the container's table column (not positioned manually)**
- **Table position within column is determined by annotation ID order**
- Table metadata (sourceFrameId, annotationId, timestamp) is stored in plugin data

#### Scenario: Create mobile annotation table
- **WHEN** "Insert Annotations" is triggered for a mobile annotation
- **THEN** a table is created with columns: Label, iOS (VoiceOver), Android (TalkBack)
- **AND** rows include: Voiced preview, Label, Value, Trait, Hint
- **AND** the table is inserted into the container's table column

#### Scenario: Create web annotation table
- **WHEN** "Insert Annotations" is triggered for a web annotation
- **THEN** a table is created with columns: Label, Web ARIA
- **AND** rows include: aria-label, role, aria-describedby, tabindex
- **AND** the table is inserted into the container's table column

#### Scenario: Stack multiple tables for same element
- **WHEN** multiple annotations exist for the same element
- **THEN** tables are stacked vertically via auto-layout with 50px gap
- **AND** stacking order follows annotation ID order

### Requirement: Create Annotation Badge
The system SHALL create a numbered badge on the target element.

- Badge is a rounded rectangle with the annotation ID number
- **Badge is inserted into the container's badge column**
- **Badge position within column is determined by annotation ID order**
- Badge uses gray background (#6B7379) with white text
- Badge is grouped with a background for layering

#### Scenario: Create badge for sub-element annotation
- **WHEN** "Insert Annotations" is triggered for an annotation targeting a sub-element
- **THEN** a badge with the annotation number is inserted into the badge column
- **AND** the badge is named "Annotation Badge {id} - {frameId}"

#### Scenario: Create badge for frame-level annotation
- **WHEN** "Insert Annotations" is triggered for an annotation where target equals frame
- **THEN** a badge with the annotation number is inserted into the badge column
- **AND** multiple frame-level badges are stacked via auto-layout

## REMOVED Requirements

### Requirement: Nudge Table to Avoid Overlap
**Reason**: Auto-layout containers eliminate the need for collision detection and nudging. The table column's auto-layout automatically prevents overlap.

**Migration**: Tables are now inserted into auto-layout columns which handle spacing automatically. The `findNonOverlappingPosition` function is no longer called for table positioning.
