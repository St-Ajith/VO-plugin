## 1. Setup Test Infrastructure
- [x] 1.1 Install Vitest and testing utilities (`vitest`, `@vitest/coverage-v8`)
- [x] 1.2 Create `vitest.config.ts` with TypeScript support
- [x] 1.3 Add test scripts to `package.json` (`test`, `test:watch`, `test:coverage`)
- [x] 1.4 Create `src/__tests__/` directory structure

## 2. Test Fixtures and Utilities
- [x] 2.1 Create `src/__tests__/fixtures/annotations.ts` with sample annotation data
- [x] 2.2 Create `src/__tests__/fixtures/frames.ts` with sample frame data
- [x] 2.3 Create `src/__tests__/utils/test-helpers.ts` for common test utilities

## 3. ValidationService Tests
- [x] 3.1 Test `validateCanvasAnnotation()` - valid annotation
- [x] 3.2 Test `validateCanvasAnnotation()` - missing required fields
- [x] 3.3 Test `validateAndCleanCanvasAnnotations()` - filters invalid
- [x] 3.4 Test `validateAndCleanCanvasAnnotations()` - removes duplicates

## 4. SyncCoordinator Tests (Pure Logic Only)
- [x] 4.1 Test `detectAnnotationChanges()` - identifies added annotations
- [x] 4.2 Test `detectAnnotationChanges()` - identifies removed annotations
- [x] 4.3 Test `detectAnnotationChanges()` - identifies modified annotations
- [x] 4.4 Test `detectAnnotationChanges()` - identifies unchanged annotations
- [x] 4.5 Test `hasContentChanged()` - mobile platform comparison
- [x] 4.6 Test `hasContentChanged()` - web platform comparison

## 5. Field Schema Tests
- [x] 5.1 Test mobile field cell-to-path mapping
- [x] 5.2 Test web field cell-to-path mapping
- [x] 5.3 Test path-to-cell reverse mapping
- [x] 5.4 Test schema consistency (round-trip)

## 6. Utility Function Tests
- [x] 6.1 Test annotation helper functions
- [x] 6.2 Test deduplication utilities
- [x] 6.3 Test bounds calculation helpers (skipped - Figma API dependent)

## 7. Validation
- [x] 7.1 Run full test suite with coverage
- [x] 7.2 Verify tests pass in isolation (no Figma dependency)
- [x] 7.3 Document test patterns in TESTING.md
