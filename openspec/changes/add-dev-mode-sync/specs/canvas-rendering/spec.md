# Canvas Rendering - Dev Mode Sync Integration

## MODIFIED Requirements

### Requirement: Create Annotation Table
The system SHALL create a visual table on the canvas representing an annotation's data.

- Table is a Figma Frame with auto-layout
- Table includes header row with annotation ID badge
- Table includes data rows for platform-specific fields
- Table is positioned to the right of the target element (60px offset)
- Table metadata (sourceFrameId, annotationId, timestamp) is stored in plugin data
- **After table creation, Dev Mode sync is triggered if enabled**

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

#### Scenario: Table creation triggers native annotation sync
- **WHEN** a table is successfully created
- **AND** Dev Mode sync is enabled
- **THEN** a corresponding native annotation is created on the target node
- **AND** native annotation uses the Accessibility category

### Requirement: Delete Canvas Artifacts
The system SHALL remove tables and badges when annotations are deleted.

- Finds artifacts by name pattern (handles tables without metadata)
- Removes both table and badge for the annotation
- **Removes native annotation from target node if Dev Mode sync is enabled**
- Logs warning but continues if removal fails

#### Scenario: Delete annotation removes canvas artifacts
- **WHEN** an annotation is deleted
- **THEN** its table and badge are removed from the canvas
- **AND** other annotations' artifacts remain unchanged

#### Scenario: Delete annotation removes native annotation
- **WHEN** an annotation is deleted
- **AND** Dev Mode sync is enabled
- **THEN** the native annotation is removed from the target node
- **AND** other native annotations on the element remain
