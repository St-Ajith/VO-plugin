# Tasks: Add Badge Metadata Storage

## Implementation Tasks

- [x] **1. Add `BadgeMetadata` interface to `types.ts`**
  - Mirror `ContainerMetadata` and `TableMetadata` structure
  - Include: `sourceFrameId`, `annotationId`, `version`, `timestamp`
  - Validation: TypeScript compiles without errors

- [x] **2. Add badge metadata methods to `canvas-badge.ts`**
  - Add `BADGE_METADATA_KEY` constant
  - Implement `storeBadgeMetadata(badge, sourceFrameId, annotationId)`
  - Implement `readBadgeMetadata(badge): BadgeMetadata | null`
  - Validation: Unit tests pass

- [x] **3. Update `createBadge()` to store metadata automatically**
  - Call `storeBadgeMetadata()` before returning the badge
  - Validation: Integration test confirms metadata stored

## Testing Tasks

- [x] **4. Add `canvas-badge.test.ts` unit tests**
  - Test `storeBadgeMetadata` stores correct structure
  - Test `readBadgeMetadata` reads stored data
  - Test `readBadgeMetadata` returns null for missing metadata
  - Test `readBadgeMetadata` handles legacy badges without version
  - Test `createBadge` automatically stores metadata
  - Validation: All 6 tests pass

- [x] **5. Add `figma.group` mock to test infrastructure**
  - Required for badge creation tests
  - Validation: Badge tests can create badges

- [x] **6. Verify no regressions**
  - Run full test suite
  - Validation: All 381 tests pass

## Future Enhancements (Not in Scope)

- [ ] Update badge parsing to prefer metadata over name (optional optimization)
- [ ] Self-healing: populate metadata on legacy badges during sync
