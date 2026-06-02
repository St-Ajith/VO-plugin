# Tasks: Update Vitest 4.0 Compliance

## Overview

Clean up Vitest configuration to align with v4 best practices. All tests already use explicit imports, so these are non-breaking configuration hygiene changes.

---

## Tasks

### 1. Remove `globals: true` from vitest.config.ts
- [x] Delete the `globals: true` line from `vitest.config.ts`
- [x] Remove the associated comment about enabling globals
- **Validation:** `npm test` passes with no changes to test files

### 2. Update TypeScript test configuration
- [x] In `tsconfig.test.json`, remove `@vitest/globals` from the `types` array
- [x] Keep only `node` in the types array (vitest types come from explicit imports)
- **Validation:** `npx tsc --project tsconfig.test.json --noEmit` passes

### 3. Document restoreMocks behavior in setup.ts
- [x] Add comment block in `src/__tests__/setup.ts` explaining Vitest 4.0's `restoreMocks` behavior
- [x] Document that automocks created here are NOT affected by `restoreMocks: true`
- [x] Note that only `vi.spyOn` mocks are restored between tests
- **Validation:** Comment is clear and accurate per Vitest 4.0 docs

### 4. Run full test suite
- [x] Execute `npm test` to verify all tests pass
- [x] Execute `npm run test:coverage` to verify coverage still works
- [x] Compare coverage numbers (V8 AST-based remapping may show different results)
- **Validation:** `npm test` passes; `npm run test:coverage` currently fails because global coverage is below configured thresholds (pre-existing).

### 5. Update testing spec
- [x] Merge spec delta from `specs/testing/spec.md` into main spec
- **Validation:** `openspec validate update-vitest-4-compliance --strict` passes

---

## Dependencies

None — this change is independent and can proceed in parallel with other work.

## Rollback

If issues arise, revert the three file changes:
- Restore `globals: true` in `vitest.config.ts`
- Restore `@vitest/globals` in `tsconfig.test.json`
- Remove added comment from `setup.ts`
