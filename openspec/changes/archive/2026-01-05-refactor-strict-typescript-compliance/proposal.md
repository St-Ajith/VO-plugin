# Proposal: Refactor Strict TypeScript Compliance

## Summary

Fix 212 TypeScript errors introduced by enabling three stricter compiler options in `tsconfig.json`:

- `noUncheckedIndexedAccess: true` - Array/object indexed access returns `T | undefined`
- `exactOptionalPropertyTypes: true` - Cannot assign `undefined` to optional properties explicitly
- `noImplicitOverride: true` - Requires explicit `override` keyword on method overrides

These options improve type safety by catching potential runtime errors at compile time.

## Motivation

The codebase previously relied on implicit type assumptions that could mask runtime errors:

1. **Array access without bounds checking** - `arr[0]` assumed to always exist
2. **Optional property misuse** - Assigning `undefined` to optional properties instead of omitting them
3. **Implicit method overrides** - No explicit indication when subclass methods override parent methods

Enabling these options forces explicit handling of edge cases, reducing bugs.

## Scope

| Category | Error Count | Strategy |
|----------|-------------|----------|
| `noUncheckedIndexedAccess` | ~150 | Destructuring, guards, non-null assertions in tests |
| `exactOptionalPropertyTypes` | ~15 | Conditional spreading `...(val && { key: val })` |
| `noImplicitOverride` | ~6 | Add `override` keyword to mock classes |
| Computed property names | ~6 | Length checks + string casts |

**Approach:** Fix production code and its corresponding test files together in the same task. This keeps context fresh and ensures tests are updated alongside production changes.

### Files Affected

**Production Code (~60 errors):**
- `src/services/canvas-parser.ts`
- `src/services/canvas-platform-ios.ts`
- `src/services/canvas-platform-mobile.ts`
- `src/services/canvas-platform-web.ts`
- `src/services/canvas.ts`
- `src/services/annotation-store.ts`
- `src/services/frame-manager.ts`
- `src/services/message-router.ts`
- `src/services/migration-service.ts`
- `src/services/node-change-coordinator.ts`
- `src/services/validation.ts`
- `src/hooks/useAnnotationOperations.ts`
- `src/hooks/useNodeChangeSync.ts`
- `src/schema/annotation-fields.ts`
- `src/ui/components/AccordionItem.tsx`
- `src/ui/components/FrameSelector.tsx`
- `src/ui/frame-utils.ts`
- `src/utils/benchmark.ts`
- `src/utils/event-helpers.ts`
- `src/utils/figma-helpers.ts`
- `src/utils/node-helpers.ts`
- `src/utils/transaction-wrapper.ts`

**Test Code (~150 errors):**
- `src/__tests__/integration/benchmark.test.ts`
- `src/__tests__/integration/canvas-operations.test.ts`
- `src/__tests__/integration/container-operations.test.ts`
- `src/__tests__/integration/message-mocks.test.ts`
- `src/__tests__/integration/storage.test.ts`
- `src/__tests__/services/canvas-container.test.ts`
- `src/__tests__/services/sync-coordinator.test.ts`
- `src/__tests__/services/validation.test.ts`
- `src/__tests__/utils/annotation-deduplication.test.ts`
- `src/__tests__/utils/figma-helpers.test.ts`
- `src/__tests__/mocks/figma-api.ts`

## Design Decisions

### 1. Regex Capture Groups

**Pattern:** Use destructuring with fallback array instead of `match[1]` access.

```typescript
// Before (errors)
const match = text.match(/regex/);
if (match) {
  return match[1]; // Error: possibly undefined
}

// After
const [, capturedGroup] = text.match(/regex/) ?? [];
if (capturedGroup) {
  return capturedGroup;
}
```

### 2. Optional Properties

**Pattern:** Prefer conditional spreading over type widening.

```typescript
// Before (errors)
return { isValid, errors: errors || undefined };

// After
return { isValid, ...(errors && { errors }) };
```

### 3. Test Assertions

**Pattern:** Use explicit assertions for clarity, non-null assertions for setup.

```typescript
// Before (errors)
expect(result[0].id).toBe('123');

// After
const item = result[0];
expect(item).toBeDefined();
expect(item?.id).toBe('123');
```

### 4. Computed Property Names

**Pattern:** Validate array length before using indexed values as keys.

```typescript
// Before (errors)
{ [parts[1]]: value }

// After
if (parts.length >= 2) {
  const key = parts[1] as string;
  // ... use key
}
```

## Risks

1. **Test verbosity** - Adding explicit assertions increases test LOC
2. **Performance** - Additional runtime checks (negligible impact)
3. **Merge conflicts** - Widespread changes may conflict with parallel work

## Implementation Strategy

**Combined Production + Test Fixes:** When fixing production code, also fix its corresponding test files in the same task. This approach:
- Keeps context fresh - patterns and fixes are applied consistently
- Reduces cognitive overhead - no need to revisit files later
- Ensures tests are updated alongside production changes
- Maintains test coverage while fixing type errors

## Success Criteria

- [ ] `npm run build:debug` exits with 0 errors
- [ ] `npm test` passes all existing tests
- [ ] No new runtime behavior changes (pure type-level fixes)

## References

- [TypeScript Strict Mode Options](https://www.typescriptlang.org/tsconfig#strict)
- [noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig#noUncheckedIndexedAccess)
- [exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig#exactOptionalPropertyTypes)
- [noImplicitOverride](https://www.typescriptlang.org/tsconfig#noImplicitOverride)
