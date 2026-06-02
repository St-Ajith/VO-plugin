# Canvas Rendering - Delta

## MODIFIED Requirements

### Requirement: Create Annotation Badge
The system SHALL create a numbered badge on the target element.

- Badge is a rounded rectangle with the annotation ID number
- Badge is positioned at the **right edge** of the target element, **vertically centered**
- Badge uses 8px horizontal gap from element edge
- Badge uses gray background (#6B7379) with white text
- Badge is grouped with a background for layering

#### Scenario: Create badge for annotation
- **WHEN** "Insert Annotations" is triggered
- **THEN** a badge with the annotation number appears at the right edge of the element
- **AND** the badge is vertically centered on the element's height
- **AND** the badge is named "Annotation Badge {id} - {frameId}"

#### Scenario: Badge position for tall element
- **WHEN** an annotation is created for an element 200px tall
- **THEN** the badge is placed at Y = element.y + (200 / 2) - (badgeHeight / 2)
- **AND** the badge is horizontally positioned at element.x + element.width + 8

### Requirement: Create Annotation Table
The system SHALL create a visual table on the canvas representing an annotation's data.

- Table is a Figma Frame with auto-layout
- Table includes header row with annotation ID badge
- Table includes data rows for platform-specific fields
- Table is positioned in a **single column** to the right of the frame (60px offset from frame's right edge)
- Tables are stacked vertically in annotation ID order
- Table metadata (sourceFrameId, annotationId, timestamp) is stored in plugin data

#### Scenario: Create mobile annotation table
- **WHEN** "Insert Annotations" is triggered for a mobile annotation
- **THEN** a table is created with columns: Label, iOS (VoiceOver), Android (TalkBack)
- **AND** rows include: Voiced preview, Label, Value, Trait, Hint
- **AND** the table appears in the annotation column to the right of the frame

#### Scenario: Create web annotation table
- **WHEN** "Insert Annotations" is triggered for a web annotation
- **THEN** a table is created with columns: Label, Web ARIA
- **AND** rows include: aria-label, role, aria-describedby, tabindex
- **AND** the table appears in the annotation column to the right of the frame

#### Scenario: Stack multiple tables for same frame
- **WHEN** multiple annotations exist for the same frame
- **THEN** tables are stacked vertically in the column with 50px gap
- **AND** stacking order follows annotation ID order
- **AND** all tables share the same X coordinate (frame.right + 60px)

#### Scenario: Table column position calculation
- **WHEN** a frame has absoluteBoundingBox with x=100, width=400
- **THEN** the table column X position is 560 (100 + 400 + 60)
