# Proposal: Fix Remaining Strict TypeScript Errors

## Summary

Fix 49 remaining TypeScript errors that were missed during the initial `refactor-strict-typescript-compliance` implementation. These errors fall into two categories:

1. **Production code** (8 errors): Missing guards for array access and optional property handling
2. **Test files** (41 errors): Array access without proper guards in test assertions

All errors are related to the strict compiler options enabled in `tsconfig.json`:
- `noUncheckedIndexedAccess: true` - Array/object indexed access returns `T | undefined`
- `exactOptionalPropertyTypes: true` - Cannot assign `undefined` to optional properties explicitly

## Motivation

The previous change (`refactor-strict-typescript-compliance`) fixed 163 of 212 errors but missed 49 errors. These remaining errors prevent the codebase from compiling successfully with strict TypeScript settings enabled.

## Scope

| Category | Error Count | Files | Strategy |
|----------|-------------|-------|----------|
| Production - Array access | 4 | `canvas-platform-mobile.ts`, `canvas-platform-web.ts` | Destructure with guards |
| Production - Optional property | 1 | `annotation-store.ts` | Guard before property access |
| Production - Type import | 1 | `canvas.ts` | Add missing import |
| Production - Assignment | 1 | `canvas.ts` | Fix optional property assignment |
| Test files - Array access | 41 | 4 test files | Extract element, guard, then access |

### Files Affected

**Production Code (8 errors):**
- `src/services/annotation-store.ts` - Guard `current` before accessing properties
- `src/services/canvas-platform-mobile.ts` - Guard `headerTexts[0]` and `headerTexts[1]`
- `src/services/canvas-platform-web.ts` - Guard `labelWidth` and `valueWidth` from destructuring
- `src/services/canvas.ts` - Add missing `CanvasParserDependencies` import and fix assignment

**Test Code (41 errors):**
- `src/__tests__/integration/canvas-operations.test.ts` - Guard badges array access (6 errors)
- `src/__tests__/integration/container-operations.test.ts` - Guard containers/children access (7 errors)
- `src/__tests__/integration/message-mocks.test.ts` - Guard messages array access (8 errors)
- `src/__tests__/services/canvas-container.test.ts` - Guard children array access (20 errors)

## Design Decisions

### 1. Production Array Access

**Pattern:** Destructure with explicit guards or provide fallback values.

```typescript
// Before (errors)
row.appendChild(await createHeaderText(headerTexts[0], iosWidth));

// After
const iosHeader = headerTexts[0];
if (!iosHeader) {
  throw new Error("Missing iOS header text");
}
row.appendChild(await createHeaderText(iosHeader, iosWidth));
```

### 2. Production Optional Property Access

**Pattern:** Guard before accessing properties on potentially undefined objects.

```typescript
// Before (errors)
...current.mobile?.ios,

// After
if (!current) {
  throw new Error("Current annotation not found");
}
...current.mobile?.ios,
```

### 3. Test Array Access

**Pattern:** Extract element, guard with `toBeDefined()`, then access properties.

```typescript
// Before (errors)
expect(badges[0].y).toBe(128);

// After
const firstBadge = badges[0];
expect(firstBadge).toBeDefined();
expect(firstBadge?.y).toBe(128);
```

### 4. Missing Type Import

**Pattern:** Add explicit import for type used in type annotation.

```typescript
// Before (errors)
const dependencies: CanvasParserDependencies = {

// After
import type { CanvasParserDependencies } from "./canvas-parser";
const dependencies: CanvasParserDependencies = {
```

## Risks

1. **Runtime behavior changes** - Adding guards may expose edge cases that were silently failing
2. **Test verbosity** - Adding explicit assertions increases test LOC (acceptable trade-off)
3. **Error handling** - Need to decide between throwing errors vs. graceful fallbacks in production code

## Implementation Strategy

**Combined Production + Test Fixes:** Fix production code and its corresponding test files together to keep context fresh and ensure consistency.

## Success Criteria

- [ ] `npm run build:debug` exits with 0 errors
- [ ] `npm test` passes all existing tests
- [ ] No new runtime behavior changes (pure type-level fixes where possible)
- [ ] All 49 errors resolved

## References

- Original change: `refactor-strict-typescript-compliance`
- [TypeScript Strict Mode Options](https://www.typescriptlang.org/tsconfig#strict)
- [noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig#noUncheckedIndexedAccess)
- [exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig#exactOptionalPropertyTypes)

