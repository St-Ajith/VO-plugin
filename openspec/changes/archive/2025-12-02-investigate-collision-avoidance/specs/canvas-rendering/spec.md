## MODIFIED Requirements

### Requirement: Create Annotation Table
The system SHALL create a visual table on the canvas representing an annotation's data.

- Table is a Figma Frame with auto-layout
- Table includes header row with annotation ID badge
- Table includes data rows for platform-specific fields
- Table is positioned to the right of the target element (60px offset)
- **Table position is adjusted using nudge algorithm to avoid overlapping other tables**
- Table metadata (sourceFrameId, annotationId, timestamp) is stored in plugin data

#### Scenario: Create mobile annotation table
- **WHEN** "Insert Annotations" is triggered for a mobile annotation
- **THEN** a table is created with columns: Label, iOS (VoiceOver), Android (TalkBack)
- **AND** rows include: Voiced preview, Label, Value, Trait, Hint
- **AND** the table appears to the right of the annotated element

#### Scenario: Create web annotation table
- **WHEN** "Insert Annotations" is triggered for a web annotation
- **THEN** a table is created with columns: Label, Web ARIA
- **AND** rows include: aria-label, role, aria-describedby, tabindex
- **AND** the table appears to the right of the annotated element

#### Scenario: Stack multiple tables for same element
- **WHEN** multiple annotations exist for the same element
- **THEN** tables are stacked vertically with 50px gap
- **AND** stacking order follows annotation ID order

#### Scenario: Nudge table to avoid overlap
- **WHEN** a new annotation table would overlap an existing table
- **THEN** the table is nudged 20px down iteratively until no overlap
- **AND** the final position is used for table placement
