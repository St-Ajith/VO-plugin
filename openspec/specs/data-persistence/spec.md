# Data Persistence

## Purpose

Storage architecture with node plugin data as the authoritative source. This capability ensures annotation data is reliably saved to and loaded from Figma nodes, supporting multi-page documents and legacy data migration.
## Requirements
### Requirement: Node Plugin Data as Source of Truth
The system SHALL store annotation data directly on Figma nodes as the authoritative source.

- Each annotated element stores its annotation in `node.setPluginData()`
- Namespace: `voice_over_annotations`
- Data format: `{ annotation: Annotation, timestamp: number }`
- Node data survives file saves, copies, and version history

#### Scenario: Save annotation to node
- **WHEN** an annotation is created or updated
- **THEN** the data is written to the element's plugin data
- **AND** a timestamp is recorded

#### Scenario: Load annotation from node
- **WHEN** the plugin loads
- **THEN** all nodes with plugin data are scanned
- **AND** annotations are reconstructed from node data

#### Scenario: Node deleted removes annotation
- **WHEN** an annotated Figma element is deleted
- **THEN** the annotation data is lost (no orphaned data)

### Requirement: Multi-Page Data Loading
The system SHALL load annotations from all pages in the document.

- Uses `figma.loadAllPagesAsync()` for dynamic-page access
- Scans each page for nodes with annotation data
- Combines all annotations into a single in-memory store

#### Scenario: Load annotations from multiple pages
- **WHEN** the plugin loads in a document with 5 pages
- **THEN** all pages are scanned
- **AND** annotations from all pages are available

### Requirement: Legacy Data Migration
The system SHALL migrate annotations from legacy storage formats.

- Detects legacy shared plugin data format
- Migrates to node-based storage during load
- Performs incremental version migrations for schema changes

#### Scenario: Migrate from shared plugin data
- **WHEN** legacy shared plugin data exists
- **AND** no node-based data exists
- **THEN** annotations are migrated to node storage
- **AND** the plugin functions normally after migration

### Requirement: Table Metadata Storage
The system SHALL store metadata on canvas annotation tables.

- Metadata stored in table frame's plugin data
- Key: `voice_over_annotations_tableMetadata`
- Includes: `sourceFrameId`, `annotationId`, `version`, `timestamp`, `position`
- Enables table-to-annotation linking and position preservation

#### Scenario: Store table metadata
- **WHEN** an annotation table is created
- **THEN** metadata is written to the table's plugin data
- **AND** the metadata includes source frame ID and annotation ID

#### Scenario: Read table metadata for navigation
- **WHEN** a user selects an annotation table
- **THEN** the plugin reads the metadata
- **AND** navigates to the source frame

### Requirement: Data Validation on Load
The system SHALL validate and clean annotation data during load.

- Filters out annotations with missing required fields (id, frameId, elementId, platform)
- Removes duplicate annotations using composite key (`frameId:id`) for ID-based deduplication
- Removes duplicate annotations using content signature that includes `frameId`
- Logs warnings for invalid or duplicate data with composite key for traceability
- Continues loading valid annotations even if some are invalid

#### Scenario: Filter invalid annotations
- **WHEN** an annotation is missing required fields
- **THEN** it is excluded from the loaded data
- **AND** a warning is logged

#### Scenario: Remove duplicates by composite key
- **WHEN** duplicate annotations exist (same frameId + id combination)
- **THEN** only one copy is kept
- **AND** the duplicate count is logged with composite key

#### Scenario: Preserve annotations with same ID across frames
- **WHEN** multiple frames each have an annotation with id=1
- **THEN** all annotations are retained (different frameId makes them unique)
- **AND** no false-positive deduplication occurs

#### Scenario: Preserve annotations with same content across frames
- **WHEN** two annotations on different frames have identical accessibility data
- **THEN** both annotations are retained (different frameId makes them unique)
- **AND** no false-positive content deduplication occurs

### Requirement: Rollback on Save Failure
The system SHALL rollback in-memory changes if node save fails.

- Node save is attempted before updating in-memory store
- On failure, in-memory state is not modified
- Error is emitted to UI for user notification
- Operation throws to signal failure to caller

#### Scenario: Save failure prevents in-memory update
- **WHEN** node.setPluginData() fails (e.g., node deleted)
- **THEN** the in-memory annotation array is not modified
- **AND** an error message is sent to the UI

