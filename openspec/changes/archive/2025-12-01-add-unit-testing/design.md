## Context

The VO Annotations plugin has no automated tests. The codebase has grown to include:
- 7 services with complex business logic
- Bidirectional sync between UI, node storage, and canvas
- Validation, change detection, and field mapping logic

Much of this logic is **pure functions** that don't require the Figma API, making them ideal candidates for unit testing.

## Goals

- Test pure business logic without Figma API mocks
- Fast test execution (< 5 seconds for full suite)
- High coverage of validation and sync detection logic
- Foundation for future integration tests

## Non-Goals

- Mocking the full Figma API (deferred to integration testing proposal)
- Testing UI components (deferred to integration testing proposal)
- E2E testing with actual Figma (manual testing remains)

## Decisions

### Test Framework: Vitest

**Rationale:**
- Native TypeScript support (no separate ts-jest config)
- Fast execution with native ESM
- Compatible with existing `@create-figma-plugin` build setup
- Watch mode for development
- Built-in coverage with v8

**Alternatives considered:**
- Jest: Requires additional TypeScript configuration, slower
- Node test runner: Less mature, fewer features

### Test Structure: Colocated in `src/__tests__/`

```
src/
├── __tests__/
│   ├── fixtures/
│   │   ├── annotations.ts    # Sample annotation data
│   │   └── frames.ts         # Sample frame data
│   ├── utils/
│   │   └── test-helpers.ts   # Shared test utilities
│   ├── services/
│   │   ├── validation.test.ts
│   │   └── sync-coordinator.test.ts
│   ├── schema/
│   │   └── annotation-fields.test.ts
│   └── utils/
│       ├── annotation-helpers.test.ts
│       └── annotation-deduplication.test.ts
```

**Rationale:**
- Clear separation from production code
- Easy to exclude from build
- Mirrors src structure for discoverability

### Extracting Testable Logic

Some functions are currently private class methods. To test them:

1. **Preferred**: Extract to standalone utility functions
2. **Alternative**: Test through public interface
3. **Last resort**: Export for testing only (marked with `@internal`)

Example: `SyncCoordinator.hasContentChanged()` is private but contains important logic. Options:
- Extract to `src/utils/annotation-comparison.ts` 
- Test via `detectAnnotationChanges()` public method

**Decision**: Test through public interface where possible; extract only if function is complex enough to warrant direct testing.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Tests may not catch Figma-specific bugs | Covered by manual testing + future integration tests |
| Extracting private methods may increase API surface | Only extract well-defined utilities, mark as `@internal` |
| Test maintenance overhead | Keep tests focused on behavior, not implementation |

## Open Questions

1. Should we set a coverage threshold? (Recommendation: start without, add later)
2. Should tests run on pre-commit? (Recommendation: CI only, to keep commits fast)
