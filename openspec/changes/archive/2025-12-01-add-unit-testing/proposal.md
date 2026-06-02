# Change: Add Unit Testing Infrastructure

**Status: Applied** ✅

## Why

The plugin currently has no automated tests. Unit tests for pure logic functions will:
- Catch bugs in validation, change detection, and field mapping
- Enable confident refactoring
- Provide fast feedback without needing Figma API mocks
- Form the foundation for the layered testing strategy

## What Changes

- Add Vitest as test framework (fast, TypeScript-native, modern)
- Create test utilities and fixtures
- Add unit tests for pure functions that don't depend on Figma API:
  - `ValidationService` - annotation validation logic
  - `SyncCoordinator.detectAnnotationChanges()` - change detection
  - Field schema mapping (cell location ↔ field path)
  - Annotation helpers and utilities
- Add `npm test` script

## Implementation Summary

- **110 tests** passing across 4 test files
- Coverage: 90% annotation-fields, 86% validation, 91% deduplication
- Test infrastructure: Vitest + @vitest/coverage-v8
- Global Figma mock in `src/__tests__/setup.ts`

## Impact

- Affected specs: None (testing infrastructure, not behavior change)
- Affected code:
  - `package.json` - new devDependencies and scripts
  - `vitest.config.ts` - new file
  - `src/__tests__/` - new test files
- No changes to production code behavior
