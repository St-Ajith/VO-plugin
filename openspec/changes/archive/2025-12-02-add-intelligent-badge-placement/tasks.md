# Tasks: Add Intelligent Badge Placement

## 1. Schema & Types

- [ ] 1.1 Add `targetElementId: string | null` to `Annotation` interface in `src/types.ts`
- [ ] 1.2 Add `isOrphaned: boolean` computed field or detection logic for UI

## 2. Naming Convention Detection

- [ ] 2.1 Create `findTaggedElements(frame: FrameNode): SceneNode[]` in `src/utils/figma-helpers.ts`
- [ ] 2.2 Implement `parseTaggedName(name: string): { label: string; trait: string } | null` to extract values from `vo-label-trait {label} {trait}` pattern
- [ ] 2.3 Add unit tests for naming convention parsing edge cases

## 3. Badge Positioning

- [ ] 3.1 Update `createBadge()` in `src/services/canvas-badge.ts` to position at right edge + vertical center
- [ ] 3.2 Update `updateBadge()` to maintain new positioning logic
- [ ] 3.3 Add integration test for badge positioning relative to element bounds

## 4. Table Column Layout

- [ ] 4.1 Add `calculateTableColumnX(frame: FrameNode): number` helper in `src/services/canvas.ts`
- [ ] 4.2 Update `createAnnotationTable()` to use frame-relative column positioning
- [ ] 4.3 Update `updateAnnotationTable()` to maintain column layout on table refresh
- [ ] 4.4 Ensure deterministic Y stacking by annotation ID order

## 5. Multi-Select Annotation Creation

- [ ] 5.1 Update `CREATE_ANNOTATION` handler in `src/services/message-router.ts` to support multi-selection
- [ ] 5.2 Create annotations for each selected element with `targetElementId` populated
- [ ] 5.3 Add UI feedback for batch annotation creation (e.g., "Created 5 annotations")

## 6. Tagged Element Detection Flow

- [ ] 6.1 Add `SCAN_TAGGED_ELEMENTS` message handler to scan frame for `vo-label-trait` elements
- [ ] 6.2 Emit `TAGGED_ELEMENTS_FOUND` to UI with list of detected elements
- [ ] 6.3 Add UI prompt: "Found X tagged elements. Add annotations?" with confirm/dismiss
- [ ] 6.4 On confirm, create annotations for all tagged elements

## 7. Orphan Detection & UI

- [ ] 7.1 Add orphan detection in `SyncCoordinator` - check if `targetElementId` node exists
- [ ] 7.2 Add `ORPHAN_DETECTED` event emission to UI
- [ ] 7.3 Add warning icon (⚠️) to orphaned annotations in `AnnotationList.tsx`
- [ ] 7.4 Add tooltip explaining orphan state and re-target action

## 8. Re-targeting Flow

- [ ] 8.1 Add "Re-target" button/action to orphaned annotation UI
- [ ] 8.2 Implement selection mode for re-targeting (user selects new element)
- [ ] 8.3 Update annotation's `targetElementId` and `elementId` on re-target confirmation
- [ ] 8.4 Refresh badge position to new element location

## 9. Validation & Testing

- [ ] 9.1 Run `openspec validate add-intelligent-badge-placement --strict`
- [ ] 9.2 Add manual test cases to `TESTING.md` for new workflows
- [ ] 9.3 Verify badge positioning with elements at various frame positions
- [ ] 9.4 Verify table column layout with 1, 5, and 10+ annotations
