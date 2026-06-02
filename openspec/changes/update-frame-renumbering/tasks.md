# Tasks: Update Frame Renumbering

## 1. Specification

- [x] 1.1 Update `annotation-management` spec delta for Delete Annotation with frame-scoped renumbering
- [x] 1.2 Update `annotation-management` spec delta for Reorder Annotations with frame-scoped renumbering
- [x] 1.3 Add guarded init/resync renumbering scenario to Load Annotations requirement
- [x] 1.4 Add new scenario for "Refresh numbering" user-triggered action
- [x] 1.5 Validate change with `openspec validate update-frame-renumbering --strict`

---

## 2. Implementation – Store Layer

- [ ] 2.1 Create `renumberFrameAnnotations(frameId: string)` utility in `store.ts`

  - Filters to target frame's annotations
  - Sorts by **current array index** (NOT Y-position) to preserve list order
  - Assigns new sequential IDs (1, 2, 3...)
  - Returns `Map<oldId, newId>` for canvas sync
  - **Acceptance Criteria**:
    - Handles gaps: `[1, 2, 5, 6]` → `[1, 2, 3, 4]`
    - Handles shifts: `[2, 3, 4, 5]` → `[1, 2, 3, 4]`
    - Sorting is deterministic (by array index before reassigning)

- [ ] 2.2 Update `AnnotationStore.delete()` in `annotation-store.ts`

  - After successful deletion, call renumber for affected frame
  - Only renumber if deletion actually removed an annotation

- [ ] 2.3 Update `AnnotationStore.reorder()` in `annotation-store.ts`

  - After successful reorder, call renumber for affected frame
  - Ensure canvas badges get updated with new numbers

- [ ] 2.4 Update UI-side `removeAnnotation()` in `store.ts`
  - After removal, trigger renumbering for the frame (immediate)
  - Propagate ID changes to pending state

---

## 3. Implementation – Canvas Layer

- [ ] 3.1 Add `updateBadgeNumbers(frameId, idMap)` to `CanvasService`

  - Batch-update badge text based on old→new ID mapping
  - **Performance**: Only write if value changed:
    ```typescript
    if (badge.characters !== String(newNumber)) {
      badge.characters = String(newNumber);
    }
    ```
  - Debounce/throttle at ~300ms for rapid operations

- [ ] 3.2 Add `updateTableRowNumbers(frameId, idMap)` to `CanvasService` (if tables have row numbers)

  - Update table annotations to reflect new numbering
  - Same performance optimization as badges

- [ ] 3.3 Integrate canvas updates into renumber flow
  - Store renumbers immediately (optimistic)
  - Canvas update is debounced at 300ms
  - Handle missing/removed canvas artifacts gracefully

---

## 4. Implementation – Guard Conditions

- [ ] 4.1 Add `hasInFlightOpsForFrame(frameId)` helper to `request-tracker.ts`

  - Check if any in-flight requests target the given frame
  - Return boolean for guard condition

- [ ] 4.2 Add `hasDirtyFormForFrame(frameId)` detection

  - Track which frame has focused text inputs or unsaved form changes
  - Could use a signal or check active element

- [ ] 4.3 Add `shouldAutoRenumber(frameId)` guard function

  - Combines: no in-flight ops, not syncing, no dirty forms, no optimistic placeholders
  - Returns boolean

- [ ] 4.4 Implement safe renumber check in INIT handler
  - On plugin load, check each frame for numbering gaps
  - If gaps detected and guards pass → auto-renumber
  - If guards fail → add frame to `framesNeedingRenumber`

---

## 5. Implementation – UI "Refresh Numbering" Action

- [ ] 5.1 Add `framesNeedingRenumber` signal to `store.ts`

  - `Set<frameId>` for frames with detected gaps but not auto-renumbered
  - Cleared when user triggers refresh or plugin re-inits

- [ ] 5.2 Add "Refresh Numbering" button to frame header

  - Only visible when current frame is in `framesNeedingRenumber`
  - **UI Copy**: "Numbering sync paused due to active editing. [Refresh Numbers]"
  - Clicking triggers `renumberFrameAnnotations(currentFrameId)` + canvas update

- [ ] 5.3 Add message handler for `REFRESH_NUMBERING` IPC command
  - UI emits, Main thread processes, renumbers, responds with updated annotations

---

## 6. Testing

- [ ] 6.1 Unit tests for `renumberFrameAnnotations()`

  - Test sequential ID assignment after gaps: `[1,2,5,6]` → `[1,2,3,4]`
  - Test shift scenario: `[2,3,4,5]` → `[1,2,3,4]`
  - Test empty frame (no-op)
  - Test cross-frame isolation (other frames unchanged)

- [ ] 6.2 Integration tests for delete → renumber flow

  - Delete middle annotation → verify remaining are 1..N
  - Delete first annotation → verify shift
  - Delete last annotation → verify no change to others

- [ ] 6.3 Integration tests for reorder → renumber flow

  - Reorder up/down → verify new sequential IDs
  - Boundary reorder (move first up) → no-op check

- [ ] 6.4 Integration tests for guard conditions

  - Mock in-flight request → verify no auto-renumber on init
  - Mock dirty form → verify "Refresh" button appears
  - Clear guards → verify auto-renumber proceeds

- [ ] 6.5 Manual test: Delete + Canvas sync
  - Delete annotation, verify badge numbers update on canvas
  - Verify table row numbers (if applicable) update

---

## 7. Documentation

- [ ] 7.1 Update `TESTING.md` with new renumbering test cases
- [ ] 7.2 Update inline code comments explaining renumber logic

---

## Notes

- **Frame-scoped**: All renumbering operations only affect one frame; other frames are unchanged
- **Immediate Store, Debounced Canvas**: Store updates instantly for responsive UI; canvas writes debounced at 300ms
- **Store = truth, Canvas = projection**: No rollback on canvas write failure; mark as "out of sync" if critical
- **"Refresh numbering" is per-frame**: Shows contextually when guards block auto-renumber
