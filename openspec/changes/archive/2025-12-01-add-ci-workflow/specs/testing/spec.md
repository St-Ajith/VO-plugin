## MODIFIED Requirements

### Requirement: Unit Test Infrastructure
The system SHALL provide unit testing infrastructure for pure business logic functions.

- Tests use Vitest framework with TypeScript support
- Tests run without Figma API dependency
- Tests are located in `src/__tests__/` directory
- Coverage reporting is available via `npm run test:coverage`
- **Tests run automatically on pull requests via CI**

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

## ADDED Requirements

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
