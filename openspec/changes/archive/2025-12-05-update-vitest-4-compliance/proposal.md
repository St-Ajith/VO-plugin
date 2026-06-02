# Change: Update Vitest 4.0 Compliance

**Priority:** High  
**Status:** Proposed

## Why

The project upgraded to Vitest 4.0.15 but retains configuration patterns from earlier versions that are now redundant or inconsistent with v4 best practices:

1. **Redundant `globals: true` setting** — All test files already explicitly import from `vitest` (e.g., `import { describe, it, expect, vi } from "vitest"`), making the globals configuration unnecessary overhead.

2. **Misleading TypeScript types** — `tsconfig.test.json` references `@vitest/globals` types, which is misleading when tests don't rely on globals injection.

3. **Undocumented `restoreMocks` behavior change** — Vitest 4.0 changed `restoreMocks` to only restore `vi.spyOn` mocks, not automocks. The current setup file creates automocks that aren't affected by this setting, but this isn't documented.

## What Changes

1. **Remove `globals: true`** from `vitest.config.ts` — Tests already use explicit imports, so this has no functional impact.

2. **Update TypeScript types** in `tsconfig.test.json` — Replace `@vitest/globals` with standard `vitest/globals` or remove entirely since explicit imports provide types.

3. **Add explanatory comment** in `src/__tests__/setup.ts` — Document Vitest 4.0's `restoreMocks` behavior for future maintainers.

## Impact

- **Test behavior:** No change — tests already import explicitly
- **Type checking:** No change — imports provide types
- **Developer clarity:** Improved — configuration matches actual usage
- **Build time:** Marginally faster — no globals injection overhead

## Related Specs

- `testing` — Unit Test Infrastructure requirement

## References

- [Vitest 4.0 Migration Guide](https://vitest.dev/guide/migration.html)
- Vitest 4.0 changes to `restoreMocks` behavior
- V8 coverage AST-based remapping improvements
