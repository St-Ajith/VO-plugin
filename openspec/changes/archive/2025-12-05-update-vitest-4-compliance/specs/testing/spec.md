# testing Specification Delta

## MODIFIED Requirements

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
