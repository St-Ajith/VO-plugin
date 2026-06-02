# Change: Add Integration Testing with Figma Mocks

## Why

Unit tests cover pure logic, but many bugs occur at the boundary with the Figma API. Integration tests with mocks will:
- Test service interactions (AnnotationStore, MessageRouter, etc.)
- Verify message handling between plugin and UI contexts
- Catch regressions in Figma API usage patterns
- Enable testing without running Figma Desktop

## What Changes

- Create Figma API mock utilities
- Add integration tests for services that use Figma API
- Test message routing and handler responses
- Test canvas operations with mocked nodes

## Impact

- Affected specs: `testing` (adds integration test requirement)
- Affected code:
  - `src/__tests__/mocks/figma.ts` - Figma API mock
  - `src/__tests__/integration/` - integration test files
- Dependencies on: `add-unit-testing` proposal (shares test infrastructure)
