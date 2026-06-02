# Update Frame Renumbering

## Why

- **Sequential Numbering Integrity**: Annotation numbering should stay sequential (1, 2, 3...) within each frame after deletes or reorders. Currently, deleting annotation #2 leaves gaps (1, 3, 4...).
- **Visual Consistency**: UI table numbers, canvas badge numbers, and canvas table row numbers must all reflect the same sequential order for user clarity.
- **Safe Init/Resync**: Prevent auto-renumbering during in-flight operations or when the user has unsaved form edits, avoiding data conflicts. Instead, surface a "Refresh numbering" action.

## What Changes

### 1. Delete/Reorder Renumbering

- After a successful deletion or reorder, renumber all annotations in that frame to 1..N.
- Update UI table (in-memory), canvas badges, and canvas table row numbers.
- Keep renumbering frame-scoped: other frames remain unchanged.

### 2. Guarded Init/Resync Renumbering

- On INIT or re-sync, detect numbering gaps/mismatches for each frame.
- Auto-renumber **only** when safe:
  - No in-flight operations for that frame (`inFlightRequests` check)
  - Not currently syncing (`isSyncing` signal is false)
  - No dirty forms or focused text inputs for that frame
  - No optimistic placeholders pending confirmation
- Otherwise, leave numbering as-is and surface a non-destructive "Refresh numbering" button per frame.

## Impact

### Specs Modified

- `annotation-management` (Delete Annotation, Reorder Annotations, Load Annotations)

### Systems Affected

| Component                   | Change                                                                  |
| --------------------------- | ----------------------------------------------------------------------- |
| `AnnotationStore.delete()`  | Add post-delete renumbering for same-frame annotations                  |
| `AnnotationStore.reorder()` | Add post-reorder renumbering to ensure sequential IDs                   |
| `store.ts` (UI signals)     | Add `renumberFrameAnnotations(frameId)` utility                         |
| `CanvasService`             | New method `updateBadgeNumbers(frameId, idMap)` to batch-update badges  |
| Init/Sync handlers          | Detect gaps, check guards, auto-renumber or surface "Refresh numbering" |
| UI components               | Add "Refresh numbering" button (per-frame, contextual)                  |

---

## Design Decisions (Resolved)

### 1. Renumbering Strategy: Hybrid (Immediate Store + Debounced Canvas)

**Store (UI)**: Update immediately. When a user deletes or reorders, the UI must update instantly for responsive UX.

**Canvas (Figma)**: Debounce at ~300ms. Writing to Figma nodes is expensive:

- Rapid "Move Up" clicks should batch into one canvas write
- Prevents flicker and excessive undo history entries
- Aligns with existing `scheduleSync()` pattern in `annotation-store.ts`

### 2. "Refresh Numbering" Button: Per-Frame (Contextual)

- Users think spatially in Figma — they only care about the frame they're working on
- Renumbering one frame is fast; renumbering all frames is expensive
- Button appears in plugin UI header only when affected frame is selected
- **UI Copy**: "Numbering sync paused due to active editing. [Refresh Numbers]"

### 3. Sync Model: Optimistic Updates (Store = Source of Truth)

- Store updates immediately (optimistic)
- Canvas is a "projection" of Store state
- No rollback on canvas write failure — instead, mark as "out of sync" if critical error
- Aligns with existing `inFlightRequests` + `preMutationSnapshot` pattern

---

## Technical Notes

### Renumbering Logic

1. Filter annotations to target frame
2. Sort by **current array index** (preserves list order — NOT Y-position)
3. Assign new sequential IDs: 1, 2, 3...
4. Return old→new ID mapping for canvas sync
5. Must handle gaps (1,2,5,6 → 1,2,3,4) and shifts (2,3,4,5 → 1,2,3,4)

### Canvas Badge Performance

Only write to badges when value changed:

```typescript
if (badge.characters !== String(newNumber)) {
  badge.characters = String(newNumber);
}
```

This saves Figma render cycles.

> [!NOTE]
> Badges are now `FrameNode` (not `GroupNode`) per `replace-groups-with-frames` change. Badge metadata includes `elementId` for robust element resolution.

### Guard Condition Checks

Use existing infrastructure:

- `inFlightRequests` Map from `request-tracker.ts` for in-flight ops
- `isSyncing` signal from `store.ts` for sync state
- Need new: `dirtyFormFrameIds` signal or focused input detection

### Edge Cases

- Deleting last annotation in frame: empty array, no renumbering needed
- Reorder boundary (move first up): no-op, no renumbering
- Concurrent deletes: idempotent design handles this
- Mid-edit delete of focused annotation: guard blocks auto-renumber → show "Refresh" button
