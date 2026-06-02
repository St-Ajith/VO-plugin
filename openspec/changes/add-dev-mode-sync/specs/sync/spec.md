# Synchronization - Dev Mode Sync Integration

## ADDED Requirements

### Requirement: Dev Mode Annotation Sync Target
The system SHALL synchronize annotation data to Figma native annotations in addition to canvas tables.

- Native annotation sync runs after canvas table operations
- Sync uses the same annotation data as canvas tables
- Native annotations are a parallel output, not a replacement
- Sync respects user preference setting

#### Scenario: Insert triggers both canvas and native sync
- **WHEN** "Insert Annotations" completes canvas table creation
- **AND** Dev Mode sync is enabled
- **THEN** native annotations are created for each annotation
- **AND** both canvas tables and native annotations exist simultaneously

#### Scenario: Sync Canvas refreshes native annotations
- **WHEN** "Sync Canvas" is triggered
- **AND** Dev Mode sync is enabled
- **THEN** canvas tables are synchronized with cache
- **AND** native annotations are refreshed with current data

### Requirement: Native Annotation Cleanup on Delete
The system SHALL remove native annotations when annotations are deleted.

- Cleanup runs alongside canvas artifact removal
- Native annotation identification uses element ID and category
- Cleanup failure does not block canvas cleanup

#### Scenario: Delete cleans up all sync targets
- **WHEN** an annotation is deleted
- **THEN** canvas table and badge are removed
- **AND** native annotation is removed from target node
- **AND** node plugin data is cleared
