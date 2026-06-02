# testing Specification

## Purpose
TBD - created by archiving change add-unit-testing. Update Purpose after archive.
## Requirements
### Requirement: Unit Test Infrastructure
The system SHALL provide unit testing infrastructure for pure business logic functions.

- Tests use Vitest framework with TypeScript support
- Tests run without Figma API dependency
- Tests are located in `src/__tests__/` directory
- Coverage reporting is available via `npm run test:coverage`
- **Tests run automatically on pull requests via CI**
- **Tests use explicit imports from `vitest` (not globals injection)**
- **Test setup documents Vitest 4.0 mock restoration behavior**

#### Scenario: Run unit tests
- **WHEN** developer executes `npm test`
- **THEN** all unit tests execute
- **AND** results are displayed with pass/fail status
- **AND** execution completes in under 10 seconds

#### Scenario: Run tests in watch mode
- **WHEN** developer executes `npm run test:watch`
- **THEN** tests run on file changes
- **AND** only affected tests re-run

#### Scenario: CI runs tests on pull request
- **WHEN** a pull request is opened or updated
- **THEN** GitHub Actions workflow triggers
- **AND** tests run with cached dependencies
- **AND** PR status reflects test results

#### Scenario: Test files use explicit vitest imports
- **WHEN** a test file is created or modified
- **THEN** it imports test utilities from `vitest` directly (e.g., `import { describe, it, expect, vi } from "vitest"`)
- **AND** it does not rely on global injection of test functions

#### Scenario: Test setup documents mock behavior
- **WHEN** developer reads `src/__tests__/setup.ts`
- **THEN** they find documentation explaining Vitest 4.0's `restoreMocks` behavior
- **AND** they understand that automocks are not affected by `restoreMocks: true`

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

### Requirement: CI Pipeline
The system SHALL run automated checks on every pull request.

- CI runs on pull requests to main branch
- CI includes: lint, typecheck, build, and test steps
- CI uses npm caching for fast execution
- CI provides clear pass/fail status on PRs

#### Scenario: PR triggers CI workflow
- **WHEN** a pull request is opened against main
- **THEN** the CI workflow starts automatically
- **AND** all checks run in sequence

#### Scenario: CI uses cached dependencies
- **WHEN** CI runs and package-lock.json hasn't changed
- **THEN** cached node_modules is restored
- **AND** `npm ci` completes in under 30 seconds

#### Scenario: CI failure blocks merge
- **WHEN** any CI step fails
- **THEN** the PR check shows failure status
- **AND** the failure reason is visible in logs

#### Scenario: CI success enables merge
- **WHEN** all CI steps pass
- **THEN** the PR check shows success status
- **AND** the PR is eligible for merge

### Requirement: Figma API Mock Infrastructure
The system SHALL provide mock utilities for testing Figma API interactions.

- Mocks cover: `figma.getNodeByIdAsync()`, `figma.currentPage`, `figma.loadAllPagesAsync()`
 - Mocks cover: `figma.getNodeByIdAsync()`, `figma.currentPage`, `figma.loadAllPagesAsync()`, `figma.loadFontAsync()`
- Mocks cover: `node.setPluginData()`, `node.getPluginData()`
- Mocks track calls for verification
- Mocks reset between tests for isolation

- Test harness SHALL set the Figma mock on the global test context using `globalThis.figma` not `global`.
- Tests SHALL avoid using `global` directly; an ESLint override will enforce this and suggest `globalThis`.

#### Scenario: Mock node plugin data
- **WHEN** test calls `node.setPluginData(key, value)`
- **THEN** the value is stored in the mock
- **AND** `node.getPluginData(key)` returns the stored value

#### Scenario: Mock node lookup
- **WHEN** test registers a mock node with ID "123"
- **AND** test calls `figma.getNodeByIdAsync("123")`
- **THEN** the registered mock node is returned

#### Scenario: Mock font loading
- **WHEN** test calls `figma.loadFontAsync({ family, style })` with a `FontName` payload
- **THEN** the mock records the call
- **AND** test can assert `figma.loadFontAsync` was called with the expected `FontName` argument

#### Scenario: Mock reset between tests
- **WHEN** `mockFigma.reset()` is called
- **THEN** all registered nodes are cleared
- **AND** all tracked calls are cleared

### Requirement: Integration Tests for Services
The system SHALL have integration tests for services that interact with Figma API.

- Tests cover `AnnotationStore` CRUD operations
- Tests cover `MessageRouter` handler flows
- Tests cover `CanvasService` node creation/parsing
- Tests use mocked Figma API

#### Scenario: Test annotation creation saves to node
- **WHEN** `AnnotationStore.createAnnotation()` is called with valid data
- **THEN** `node.setPluginData()` is called on the target element
- **AND** the annotation data is serialized correctly

#### Scenario: Test message routing
- **WHEN** a CREATE_ANNOTATION message is received
- **THEN** `AnnotationStore.createAnnotation()` is called
- **AND** ANNOTATION_CREATED response is emitted

#### Scenario: Test error handling
- **WHEN** an operation fails (e.g., node not found)
- **THEN** error is logged
- **AND** appropriate error response is emitted
- **AND** system state remains consistent

### Requirement: Message Mock Utilities
The system SHALL provide utilities for testing message passing.

- Mock `emit()` to capture outgoing messages
- Mock `on()` to simulate incoming messages
- Helper to simulate full message round-trips

#### Scenario: Capture emitted messages
- **WHEN** service calls `emit('EVENT_NAME', payload)`
- **THEN** the message is captured in mock
- **AND** test can verify message type and payload

#### Scenario: Simulate incoming message
- **WHEN** test triggers a mock incoming message
- **THEN** registered handler is called
- **AND** handler receives correct payload

