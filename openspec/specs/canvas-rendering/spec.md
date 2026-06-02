# Canvas Rendering

## Purpose

Visual representation of annotations on the Figma canvas (tables, badges, positioning). This capability creates and manages the visual artifacts that display annotation data directly in the Figma design file.
## Requirements
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

### Requirement: Create Annotation Badge

The system SHALL create a numbered badge on the target element.

- Badge is a rounded rectangle with the annotation ID number
- Badge is inserted into the container's badge column
- Badge position within column is determined by annotation ID order
- Badge uses gray background (#6B7379) with white text
- Badge is grouped with a background for layering
- **Badge metadata (sourceFrameId, annotationId, version, timestamp) is stored in plugin data**
- **Badge is named `Annotation Badge {id} - {frameId}` (for human readability and fallback lookup)**

#### Scenario: Badge metadata stored on creation
- **WHEN** a badge is created for an annotation
- **THEN** badge metadata is stored in plugin data with `voice_over_annotations_badgeMetadata` key
- **AND** metadata includes sourceFrameId, annotationId, version (1), and timestamp
- **AND** the badge name includes frameId for fallback identification

#### Scenario: Read badge metadata
- **WHEN** badge metadata is read from an existing badge
- **THEN** sourceFrameId, annotationId, version, and timestamp are returned
- **AND** null is returned if no metadata exists (legacy badge fallback)

#### Scenario: Legacy badge without metadata
- **WHEN** a legacy badge without metadata is encountered
- **THEN** frameId is extracted from the badge name pattern `Annotation Badge {id} - {frameId}`
- **AND** the system continues to function without requiring metadata migration

### Requirement: Delete Canvas Artifacts
The system SHALL remove tables and badges when annotations are deleted.

- Finds artifacts by name pattern (handles tables without metadata)
- Removes both table and badge for the annotation
- Logs warning but continues if removal fails

#### Scenario: Delete annotation removes canvas artifacts
- **WHEN** an annotation is deleted
- **THEN** its table and badge are removed from the canvas
- **AND** other annotations' artifacts remain unchanged

### Requirement: Parse Annotation from Table
The system SHALL extract annotation data from existing canvas tables.

- Reads table metadata from plugin data
- Parses text content from table cells
- Maps cell positions to field paths using schema
- Supports both mobile and web table formats

#### Scenario: Parse mobile table
- **WHEN** a mobile annotation table is parsed
- **THEN** iOS and Android field values are extracted
- **AND** the annotation object is reconstructed with correct field paths

#### Scenario: Parse table with missing metadata
- **WHEN** a legacy table without metadata is parsed
- **THEN** annotation ID and frame ID are extracted from the table name
- **AND** parsing proceeds with available data

### Requirement: Table Header Click-Through
The system SHALL allow clicks on table content while locking the header background.

- Header background rectangle is locked (clicks pass through)
- Header text and badge remain clickable
- Data rows are fully editable

#### Scenario: Edit table cell content
- **WHEN** user clicks on a data cell in the table
- **THEN** the text is editable in Figma's native text editing
- **AND** the header background does not intercept clicks

### Requirement: Replace Groups with Frames

**Description:** Badges MUST be constructed using `FrameNode` with transparent backgrounds (FrameGroups) instead of `GroupNode`.
**Reason:** Groups are deprecated for this usage; Frames offer better control.

#### Scenario: Creating a new badge

- **Given** a user adds an annotation
- **When** the badge is rendered on canvas
- **Then** the resulting node type is `FRAME`
- **And** it contains the badge rectangle and text
- **And** the badge metadata includes `elementId`

#### Scenario: Reading existing badges

- **Given** a canvas with mixed old (Group) and new (Frame) badges
- **When** the plugin parses the canvas
- **Then** it SHOULD detect both types for backward compatibility

### Requirement: Badge Metadata Must Include Element ID

**Description:** Badge plugin data (`voice_over_annotations_badgeMetadata`) MUST include `elementId` field.
**Reason:** This enables robust element resolution when badges are placed inside annotation containers (separate from the source frame), where geometry-based lookup fails.

#### Scenario: Parsing a badge inside a container

- **Given** a badge exists inside an "Annotation Container" frame
- **When** the parser attempts to resolve the associated element
- **Then** it reads `elementId` from the badge's plugin data
- **And** uses that ID to locate the element node

#### Scenario: Self-healing badge metadata

- **Given** an existing badge without `elementId` in its metadata
- **When** `updateBadge` is called
- **Then** it writes the target's `id` into the badge metadata
- **And** future parses can resolve the element without geometry lookup

