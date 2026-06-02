## MODIFIED Requirements

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
