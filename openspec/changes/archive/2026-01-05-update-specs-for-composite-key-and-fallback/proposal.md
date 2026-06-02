# Change: Update Specs for Composite Key and ID Fallback

## Why
Recent bug fixes identified that the system was incorrectly using `id` alone for some operations, leading to cross-frame collisions because annotation IDs are only unique within a frame. Additionally, `crypto.randomUUID()` was found to be unavailable in some Figma environments, requiring a fallback mechanism. The specifications need to be updated to reflect these critical architectural requirements to prevent future regressions.

## What Changes
- **Composite Key Requirement**: Explicitly state that annotations must be identified by `(frameId, id)` in all CRUD operations.
- **ID Fallback Mechanism**: Document the fallback for `crypto.randomUUID()` in the request ID generation requirement.
- **Event Schema Update**: Update `ANNOTATION_DELETED` to include `frameId`.

## Impact
- Affected specs: `annotation-management`, `sync`
- Affected code: Already implemented in previous tasks.
