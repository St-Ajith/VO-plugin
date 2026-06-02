# Canvas Rendering (Spec Delta)

## MODIFIED Requirements

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

## Rationale

This change ensures consistency across all canvas element types:

| Element | Plugin Data Key | Metadata Fields |
|---------|-----------------|-----------------|
| Container | `voice_over_annotations_containerMetadata` | sourceFrameId, version, timestamp |
| Table | `voice_over_annotations_tableMetadata` | sourceFrameId, annotationId, version, timestamp, position |
| Badge | `voice_over_annotations_badgeMetadata` | sourceFrameId, annotationId, version, timestamp |

Structured metadata is more reliable than name parsing for:
- Batch operations requiring frame filtering
- Future renumbering operations that may change badge names
- Cross-page operations where name uniqueness isn't guaranteed
