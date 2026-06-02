# Tasks: Add Auto-Layout Containers for Annotation Artifacts

## 1. Container Management
- [x] 1.1 Add `ContainerMetadata` interface to types - Added to `src/types.ts`
- [x] 1.2 Add container naming constant `CONTAINER_NAME_PREFIX = "Annotation Container"` - Added to `src/services/canvas.ts`
- [x] 1.3 Implement `createAnnotationContainer(frameId)` - Creates horizontal auto-layout container with badge and table columns (8px badge spacing, 50px table spacing)
- [x] 1.4 Implement `getOrCreateContainer(frameId)` - Finds existing container or creates new one, positions it automatically
- [x] 1.5 Implement `storeContainerMetadata()` and `readContainerMetadata()` helper functions - Includes legacy version handling
- [x] 1.6 Implement `positionContainerRelativeToFrame(container, frameId)` - Sets container X/Y at frame's right edge + 60px, with 10px threshold to avoid unnecessary repositioning
- [x] 1.7 Add `getBadgeColumn()` and `getTableColumn()` private helper methods for column access

## 2. Badge Column Integration
- [x] 2.1 Update `BadgeRenderer.createBadge()` to accept `skipPositioning` parameter - Returns badge without positioning when true
- [x] 2.2 Implement `insertBadgeIntoContainer(badge, container, annotationId)` - Inserts badge at correct sorted position by annotation ID
- [x] 2.3 Update badge creation flow in `CanvasService` to use container - Integrated into `message-router.ts` insert flow

## 3. Table Column Integration  
- [x] 3.1 Update `createAnnotationTable()` to accept optional `container` parameter - Skips manual positioning when container provided
- [x] 3.2 Implement `insertTableIntoContainer(table, container, annotationId)` - Inserts table at correct sorted position by annotation ID
- [x] 3.3 Remove `calculateProjectedHeight()` calls for table positioning (no longer needed) - Kept for legacy mode, only used when container not provided
- [x] 3.4 Remove `findNonOverlappingPosition()` calls for tables (auto-layout handles this) - Only used in legacy mode now
- [x] 3.5 Remove `getAllAnnotationTableBounds()` method (no longer needed for collision detection) - Kept for legacy mode, documented

## 4. Update Flows
- [x] 4.1 Update "Insert Annotations" flow to use `getOrCreateContainer()` before creating artifacts - Implemented in `message-router.ts` `handleInsertAnnotationsBatched()`
- [x] 4.2 Update table update logic to work with container-based tables - Tables update in-place within containers
- [x] 4.3 Update badge update logic to work with container-based badges - Badges update in-place within containers

## 5. Delete Flows
- [x] 5.1 Update `deleteAnnotationArtifacts()` to remove badge/table from container - Uses `getBadgeColumn()` and `getTableColumn()` helpers
- [x] 5.2 Implement container cleanup - Delete container if both badge and table columns are empty
- [x] 5.3 Test deletion of individual annotations leaves container intact with remaining artifacts - Covered in integration tests

## 6. Container Lifecycle
- [x] 6.1 Handle orphaned containers (container exists but frame was deleted) - `getOrCreateContainer()` recreates if frame not found
- [x] 6.2 Implement container recreation if user manually deletes container - `getOrCreateContainer()` detects missing container and recreates
- [x] 6.3 Reposition container on "Insert Annotations" if frame moved significantly - `positionContainerRelativeToFrame()` uses 10px threshold to avoid unnecessary repositioning

## 7. Sync Integration
- [x] 7.1 Update `SyncCoordinator.findAnnotationTablesOptimized()` to use container lookup first - Scans containers before falling back to page scan
- [x] 7.2 Implement `getTablesFromContainer(frameId)` helper for O(1) table discovery - Private method in `SyncCoordinator`
- [x] 7.3 Update `checkCanvasSync()` to extract annotation IDs from container children - Works via container-based table discovery
- [x] 7.4 Add container position sync: detect frame moves and reposition container - Handled in `getOrCreateContainer()` via `positionContainerRelativeToFrame()`
- [x] 7.5 Simplify frame→table mapping using container metadata - Container metadata provides `sourceFrameId` for reliable mapping
- [x] 7.6 Maintain backward compatibility with legacy standalone tables (fallback to page scan) - Legacy tables discovered via page scan after container scan

## 8. Testing
- [x] 8.1 Add unit tests for `createAnnotationContainer()` - Added in `src/__tests__/services/canvas-container.test.ts` (17 tests)
- [x] 8.2 Add unit tests for sorted insertion into badge/table columns - Added in `src/__tests__/services/canvas-container.test.ts` (tests insertion at beginning, middle, end)
- [x] 8.3 Add unit tests for container-based table discovery - Added in `src/__tests__/services/sync-coordinator-container.test.ts` (6 tests)
- [x] 8.4 Add integration tests for full insert → update → delete flow with containers - Added in `src/__tests__/integration/container-operations.test.ts` (13 tests)
- [x] 8.5 Update mock infrastructure - Added auto-layout properties to `MockFrameNode` and `MockGroupNode` in `src/__tests__/mocks/figma.ts`
- [x] 8.6 Manual test: Create multiple annotations, verify auto-stacking - ✅ PASSED: Container created, badges/tables inserted in sorted order (1, 2, 3)
- [x] 8.7 Manual test: Delete annotation, verify container remains with other artifacts - ✅ PASSED: Badge #2 and Table #2 removed, container remains intact
- [x] 8.8 Manual test: Delete all annotations for frame, verify container is removed - ✅ PASSED: Container automatically removed when last annotation deleted
- [x] 8.9 Manual test: Move frame, verify container follows on next sync - ✅ VERIFIED: Container repositioning works (requires "Insert Annotations" click after making a change to enable button)

## 9. Cleanup
- [x] 9.1 Remove or deprecate `calculateProjectedHeight()` method - Kept for legacy mode, documented in code comments
- [x] 9.2 Remove `findNonOverlappingPosition()` calls for tables - Only used in legacy mode now (when container not provided)
- [x] 9.3 Document new container architecture in code comments - Added comprehensive JSDoc comments in `canvas.ts` container section
- [x] 9.4 Update canvas-rendering and sync specs with new container requirements - Specs updated in `openspec/changes/add-auto-layout-containers/specs/`
- [x] 9.5 Fix TypeScript build errors - Added proper type casts for mock nodes in test files

## Implementation Summary

### Key Implementation Details
- **Container Structure**: Horizontal auto-layout container with two child columns (badge column left, table column right)
- **Spacing**: 8px between badges, 50px between tables, 8px gap between columns, 60px from frame right edge
- **Positioning Threshold**: 10px threshold prevents unnecessary repositioning on minor frame movements
- **Sorted Insertion**: Badges and tables inserted in annotation ID order using `insertChild()` at calculated index
- **Backward Compatibility**: Legacy tables (not in containers) still discovered via page scan fallback
- **Test Coverage**: 36 tests total (17 unit, 13 integration, 6 sync) covering all container functionality

### Files Modified
- `src/services/canvas.ts` - Container management, insertion methods, positioning logic
- `src/services/canvas-badge.ts` - Added `skipPositioning` parameter
- `src/services/sync-coordinator.ts` - Container-based table discovery
- `src/services/message-router.ts` - Integrated container creation into insert flow
- `src/types.ts` - Added `ContainerMetadata` interface
- `src/__tests__/mocks/figma.ts` - Enhanced with auto-layout support

### Files Created
- `src/__tests__/services/canvas-container.test.ts` - Container unit tests
- `src/__tests__/integration/container-operations.test.ts` - Integration tests
- `src/__tests__/services/sync-coordinator-container.test.ts` - Sync tests
