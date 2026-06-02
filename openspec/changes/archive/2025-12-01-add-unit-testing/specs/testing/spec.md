## ADDED Requirements

### Requirement: Unit Test Infrastructure
The system SHALL provide unit testing infrastructure for pure business logic functions.

- Tests use Vitest framework with TypeScript support
- Tests run without Figma API dependency
- Tests are located in `src/__tests__/` directory
- Coverage reporting is available via `npm run test:coverage`

#### Scenario: Run unit tests
- **WHEN** developer executes `npm test`
- **THEN** all unit tests execute
- **AND** results are displayed with pass/fail status
- **AND** execution completes in under 10 seconds

#### Scenario: Run tests in watch mode
- **WHEN** developer executes `npm run test:watch`
- **THEN** tests run on file changes
- **AND** only affected tests re-run

### Requirement: Validation Logic Tests
The system SHALL have unit tests for annotation validation logic.

- Tests cover `validateCanvasAnnotation()` function
- Tests verify required field validation
- Tests verify duplicate detection

#### Scenario: Test valid annotation passes validation
- **WHEN** a valid annotation object is validated
- **THEN** validation returns true
- **AND** no errors are logged

#### Scenario: Test invalid annotation fails validation
- **WHEN** an annotation missing required fields is validated
- **THEN** validation returns false
- **AND** appropriate error is logged

### Requirement: Change Detection Tests
The system SHALL have unit tests for annotation change detection logic.

- Tests cover `detectAnnotationChanges()` function
- Tests verify added/removed/modified/unchanged categorization
- Tests verify timestamp-based conflict resolution

#### Scenario: Test detects added annotation
- **WHEN** comparing empty previous state with one annotation in current state
- **THEN** the annotation is categorized as "added"

#### Scenario: Test detects removed annotation
- **WHEN** comparing one annotation in previous state with empty current state
- **THEN** the annotation is categorized as "removed"

#### Scenario: Test detects modified annotation
- **WHEN** comparing annotations with same ID but different content
- **THEN** the annotation is categorized as "modified"

### Requirement: Field Schema Tests
The system SHALL have unit tests for field schema mappings.

- Tests cover cell-to-field-path mapping
- Tests cover field-path-to-cell mapping
- Tests verify round-trip consistency

#### Scenario: Test mobile field mapping
- **WHEN** a cell location (row, column) is mapped for mobile platform
- **THEN** the correct field path is returned (e.g., "mobile.ios.label")

#### Scenario: Test web field mapping
- **WHEN** a cell location (row, column) is mapped for web platform
- **THEN** the correct field path is returned (e.g., "web.ariaLabel")
