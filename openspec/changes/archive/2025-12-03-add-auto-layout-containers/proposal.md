# Change: Add Auto-Layout Containers for Annotation Artifacts

## Why
Currently, annotation tables and badges are positioned using manual calculations:
- Tables use `calculateProjectedHeight` to deterministically stack by annotation ID
- A `findNonOverlappingPosition` nudge algorithm handles collision avoidance
- Badges are positioned individually with manual Y-offset calculations

This approach is complex, error-prone, and requires maintaining height calculation logic that must stay in sync with actual rendered heights. By using Figma's native Auto Layout containers, we can eliminate all manual positioning calculations and let Figma handle stacking, spacing, and collision avoidance automatically.

**Sync Simplification**: Containers also make it much easier to keep annotation tables in sync with frames and UI state:
- All artifacts for a frame are grouped together in one discoverable container
- Container position tracks the frame's right edge (single update point)
- Table discovery becomes O(1) container lookup instead of O(n) page scan
- When a frame moves, only the container position needs updating (children move automatically)

## What Changes
- Create one auto-layout container per annotated frame to hold all annotation artifacts
- Container has two vertical sections: badge column (left) and table column (right)
- Badge column uses vertical auto-layout to stack badges
- Table column uses vertical auto-layout to stack tables
- Remove manual positioning calculations (`calculateProjectedHeight`, `findNonOverlappingPosition` usage for tables)
- Container is positioned at frame's right edge with configurable gap
- Adding/removing annotations simply appends/removes children from auto-layout containers

## Impact
- Affected specs: canvas-rendering, sync
- Affected code: 
  - `src/services/canvas.ts` - Container creation/management, simplified table insertion, badge/table insertion helpers
  - `src/services/canvas-badge.ts` - Badge creation with `skipPositioning` parameter
  - `src/services/sync-coordinator.ts` - Container-based table discovery with fallback to legacy page scan
  - `src/services/message-router.ts` - Integrated container creation into insert flow
  - `src/types.ts` - Added `ContainerMetadata` interface
  - `src/utils/bounds-helpers.ts` - `findNonOverlappingPosition` kept for legacy mode only
- Test files added:
  - `src/__tests__/services/canvas-container.test.ts` - Unit tests for container management (17 tests)
  - `src/__tests__/integration/container-operations.test.ts` - Integration tests for workflows (13 tests)
  - `src/__tests__/services/sync-coordinator-container.test.ts` - Sync tests for container discovery (6 tests)
  - `src/__tests__/mocks/figma.ts` - Enhanced with auto-layout support
- Affected changes:
  - `add-leader-line-connectors` - Leader lines will connect from badges in container to target elements
