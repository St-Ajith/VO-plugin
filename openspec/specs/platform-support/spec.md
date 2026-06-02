# Platform Support

## Purpose

Multi-platform annotation support for Mobile (iOS/Android) and Web (ARIA). This capability provides platform-specific accessibility fields and table structures for different target environments.

## Requirements

### Requirement: Mobile Platform Fields
The system SHALL provide iOS VoiceOver and Android TalkBack specific fields for mobile annotations.

- **Voiced Preview**: Shared preview text shown for both platforms
- **Label**: Accessibility label read by screen reader
- **Value**: Current value of the element (e.g., slider position)
- **Trait**: Element type/behavior (Button, Link, Header, etc.)
- **Hint**: Additional context about the element's action

#### Scenario: Create mobile annotation
- **WHEN** a new annotation is created with platform "mobile"
- **THEN** the annotation includes `mobile.ios` and `mobile.android` objects
- **AND** each sub-object has: label, value, trait, hint fields
- **AND** voicedPreview is a top-level field shared by both

#### Scenario: Edit iOS field independently
- **WHEN** user edits the iOS Label field
- **THEN** only `mobile.ios.label` is updated
- **AND** `mobile.android.label` remains unchanged

### Requirement: Web Platform Fields
The system SHALL provide ARIA-specific fields for web annotations.

- **aria-label**: Accessible name for the element
- **role**: ARIA role (button, navigation, search, etc.)
- **aria-describedby**: Reference to describing element ID
- **tabindex**: Keyboard navigation order

#### Scenario: Create web annotation
- **WHEN** a new annotation is created with platform "web"
- **THEN** the annotation includes a `web` object
- **AND** the web object has: ariaLabel, role, ariaDescribedBy, tabIndex fields

#### Scenario: Edit web field
- **WHEN** user edits the aria-label field
- **THEN** `web.ariaLabel` is updated
- **AND** the table on canvas reflects the change

### Requirement: Switch Platform
The system SHALL allow switching the platform for existing annotations.

- Platform switch preserves annotation ID and element binding
- Platform-specific data is initialized for the new platform
- Canvas table is recreated with new platform structure
- UI fields update to show new platform's field set

#### Scenario: Switch from mobile to web
- **WHEN** user changes annotation platform from "mobile" to "web"
- **THEN** the `web` object is initialized with default values
- **AND** the UI shows web-specific fields
- **AND** the canvas table is recreated with web columns

#### Scenario: Switch preserves common fields
- **WHEN** platform is switched
- **THEN** common fields (id, frameId, elementId, timestamps) are preserved
- **AND** only platform-specific data changes

### Requirement: Platform-Specific Table Rendering
The system SHALL render different table structures based on platform.

- Mobile tables have 3 columns: Label, iOS (VoiceOver), Android (TalkBack)
- Web tables have 2 columns: Label, Web ARIA
- Column widths are defined in schema: Mobile [128, 184, 184], Web [200, 296]
- Row structure follows field definitions in annotation-fields schema

#### Scenario: Mobile table structure
- **WHEN** a mobile annotation table is rendered
- **THEN** the table has header columns for iOS and Android
- **AND** data rows show both platform values side by side

#### Scenario: Web table structure
- **WHEN** a web annotation table is rendered
- **THEN** the table has a single value column for ARIA properties
- **AND** row labels match ARIA attribute names (aria-label, role, etc.)

### Requirement: Field Schema Consistency
The system SHALL maintain consistent field mappings between UI, storage, and canvas.

- Field paths are defined in `annotation-fields.ts` schema
- Cell locations map bidirectionally to field paths
- Schema validation ensures round-trip consistency
- Changes to schema automatically update all consumers

#### Scenario: Edit field from canvas
- **WHEN** user edits text directly in a canvas table cell
- **THEN** the cell location is mapped to the correct field path
- **AND** the annotation data is updated with the new value
- **AND** the UI reflects the change
