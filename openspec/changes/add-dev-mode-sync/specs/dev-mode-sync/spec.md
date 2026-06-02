# Dev Mode Sync

## Purpose

Synchronize plugin accessibility annotations to Figma's native annotation system for visibility in Dev Mode. This enables developers to access accessibility specifications directly from the Dev Mode sidebar without panning to canvas tables.

## ADDED Requirements

### Requirement: Create Accessibility Category
The system SHALL create an "Accessibility" annotation category if one does not already exist.

- Category uses violet color for visual distinction
- Category is created once per document and reused
- Category ID is cached after first lookup
- Existing category with matching label is reused (no duplicates)

#### Scenario: First annotation triggers category creation
- **WHEN** the first annotation is synced to native annotations
- **AND** no "Accessibility" category exists in the document
- **THEN** an "Accessibility" category is created with violet color
- **AND** the category ID is cached for subsequent operations

#### Scenario: Existing category is reused
- **WHEN** an annotation is synced to native annotations
- **AND** an "Accessibility" category already exists
- **THEN** the existing category is used
- **AND** no duplicate category is created

### Requirement: Format Annotation as Markdown
The system SHALL format annotation data into readable Markdown for native annotation labels.

- Markdown includes annotation order number prominently
- Mobile annotations include iOS and Android sections
- Web annotations include ARIA properties section
- Empty or missing fields are omitted from output
- Formatting is consistent and hierarchical

#### Scenario: Format mobile annotation
- **WHEN** a mobile annotation is formatted
- **THEN** the Markdown includes:
  - Header with "Accessibility" and order number
  - "Mobile" section with iOS and Android subsections
  - Label, Value, Trait, and Hint fields for each platform
- **AND** empty fields are omitted

#### Scenario: Format web annotation
- **WHEN** a web annotation is formatted
- **THEN** the Markdown includes:
  - Header with "Accessibility" and order number
  - "Web" section with ARIA properties
  - aria-label, role, aria-describedby, tabindex fields
- **AND** empty fields are omitted

### Requirement: Sync Annotation to Native
The system SHALL create or update native Figma annotations when plugin annotations are saved.

- Native annotation is attached to the same element as the plugin annotation
- Native annotation uses the Accessibility category
- Native annotation content is the formatted Markdown
- Multiple annotations on same element result in multiple native annotations
- Sync occurs on INSERT_ANNOTATIONS and UPDATE_ANNOTATIONS

#### Scenario: Insert creates native annotation
- **WHEN** "Insert Annotations" is triggered
- **AND** Dev Mode sync is enabled
- **THEN** each annotation's native counterpart is created on the target node
- **AND** native annotation uses the Accessibility category
- **AND** native annotation contains formatted Markdown

#### Scenario: Update refreshes native annotation
- **WHEN** "Update Annotations" is triggered (Sync Canvas)
- **AND** Dev Mode sync is enabled
- **THEN** existing native annotations are updated with current data
- **AND** new annotations receive new native annotations

#### Scenario: Node no longer exists
- **WHEN** sync is attempted for an annotation
- **AND** the target node no longer exists
- **THEN** the sync operation is skipped gracefully
- **AND** a warning is logged
- **AND** other annotations continue syncing

### Requirement: Remove Native Annotation on Delete
The system SHALL remove native annotations when plugin annotations are deleted.

- Native annotation is identified by matching element and category
- Removal is idempotent (missing annotation does not cause error)
- Other native annotations on the same element are preserved

#### Scenario: Delete removes native annotation
- **WHEN** an annotation is deleted
- **AND** a native annotation exists for that element with Accessibility category
- **THEN** the native annotation is removed
- **AND** other annotations on the element remain

#### Scenario: Delete with no native annotation
- **WHEN** an annotation is deleted
- **AND** no native annotation exists (never synced)
- **THEN** the deletion completes successfully
- **AND** no error is thrown

### Requirement: User Setting for Dev Mode Sync
The system SHALL allow users to enable or disable Dev Mode sync.

- Setting is named "Dev Mode Sync" or "devModeSyncEnabled"
- Default value is enabled (true)
- Setting persists across plugin sessions
- When disabled, no native annotation operations occur
- Canvas rendering is unaffected by this setting

#### Scenario: Disabled setting skips native sync
- **WHEN** "Insert Annotations" is triggered
- **AND** Dev Mode sync is disabled
- **THEN** canvas tables are created normally
- **AND** no native annotations are created

#### Scenario: Enable setting activates sync
- **WHEN** Dev Mode sync is re-enabled
- **AND** "Insert Annotations" is triggered
- **THEN** native annotations are created for all inserted annotations

### Requirement: Graceful API Degradation
The system SHALL handle unavailable or failing native annotation API gracefully.

- API calls are wrapped in try-catch
- Failures log warnings but do not interrupt plugin flow
- Canvas rendering continues even if native sync fails
- Circuit breaker pattern prevents repeated failures

#### Scenario: API unavailable in older Figma
- **WHEN** native annotation API is not available
- **THEN** a warning is logged once
- **AND** canvas rendering continues normally
- **AND** no repeated error messages

#### Scenario: API call fails
- **WHEN** a native annotation operation throws an error
- **THEN** the error is logged
- **AND** the remaining sync operations continue
- **AND** canvas artifacts are unaffected
