## MODIFIED Requirements

### Requirement: Delete Annotation

The system SHALL remove an annotation when the user deletes it.

- Annotation is removed from in-memory store
- Plugin data is cleared from the associated node
- Canvas artifacts (table, badge) are removed
- Deletion is idempotent (deleting non-existent annotation succeeds silently)
- **Operation includes `requestId` for tracking and deduplication**
- Remaining annotations in the same frame are renumbered sequentially starting at 1
- Store updates immediately (optimistic); canvas badge updates are debounced at 300ms
- UI table numbers, canvas badge numbers, and canvas table numbers stay in lockstep with the renumbered order for that frame (other frames are unaffected)

#### Scenario: Delete existing annotation

- **WHEN** user clicks delete on an annotation
- **THEN** the annotation is removed from the list
- **AND** the annotation table and badge are removed from canvas
- **AND** the plugin data is cleared from the Figma node
- **AND** remaining annotations in that frame are renumbered to 1..N (sorted by array index, preserving list order)
- **AND** UI table numbers update immediately
- **AND** canvas badge numbers and canvas table numbers update within 300ms (debounced)
- **AND** annotations in other frames keep their numbering

#### Scenario: Delete already-deleted annotation

- **WHEN** delete is triggered for an annotation that no longer exists
- **THEN** the operation succeeds silently (idempotent)
- **AND** no error is thrown
- **AND** existing numbering remains unchanged

#### Scenario: Delete response includes request ID

- **WHEN** DELETE_ANNOTATION is processed
- **THEN** ANNOTATION_DELETED response includes the original `requestId`

#### Scenario: Rapid consecutive deletes

- **WHEN** user deletes multiple annotations in quick succession (e.g., 3 deletes within 300ms)
- **THEN** each delete updates the store immediately
- **AND** canvas writes are batched into one update after 300ms of inactivity
- **AND** final numbering is sequential 1..N

### Requirement: Reorder Annotations

The system SHALL allow users to reorder annotations within a frame.

- Annotations can be moved up or down in the list
- Reordering updates the visual order in the UI immediately
- Reordering triggers canvas badge number updates (debounced at 300ms)
- **Operation includes `requestId` for tracking and deduplication**
- Reordering resequences annotations in the same frame to 1..N with consistent numbering across UI table, canvas badge, and canvas table (other frames are unaffected)
- Canvas badge updates only write when value has changed (performance optimization)

#### Scenario: Move annotation up

- **WHEN** user clicks "move up" on annotation 3
- **THEN** annotation 3 swaps position with annotation 2
- **AND** the UI list reflects the new order immediately
- **AND** the frame's annotations are renumbered sequentially starting at 1 (sorted by array index)
- **AND** canvas badge and table numbers update within 300ms (debounced)
- **AND** other frames keep their numbering

#### Scenario: Move annotation at top up

- **WHEN** user clicks "move up" on the first annotation
- **THEN** no change occurs (boundary condition)
- **AND** numbering remains unchanged for that frame and all other frames

#### Scenario: Rapid consecutive reorders

- **WHEN** user clicks "move up" 5 times rapidly on an annotation
- **THEN** each reorder updates the store immediately
- **AND** canvas writes are batched into one update after 300ms of inactivity
- **AND** Figma undo history contains minimal entries (not 5 separate writes)

#### Scenario: Reorder response includes request ID

- **WHEN** REORDER_ANNOTATION is processed
- **THEN** ANNOTATIONS_REORDERED response includes the original `requestId`

### Requirement: Load Annotations

The system SHALL load all annotations from Figma node plugin data on initialization.

- All pages are scanned for nodes with annotation data
- Legacy data formats are migrated if detected
- Duplicate annotations are removed during load
- Invalid annotations are filtered out with warning logs
- If numbering gaps or mismatches are detected for a frame during INIT or re-sync, the system auto-renumbers that frame only when safe (no in-flight ops for that frame, not syncing, no dirty forms or focused text inputs, and no optimistic placeholders); otherwise it surfaces a non-destructive "Refresh numbering" action for that frame
- Store is the source of truth; canvas is a projection of store state

#### Scenario: Load annotations on plugin start

- **WHEN** the plugin is opened
- **THEN** all annotations from all pages are loaded into memory
- **AND** the UI displays annotations for the currently selected frame

#### Scenario: Load with legacy data

- **WHEN** legacy shared plugin data exists
- **THEN** annotations are migrated to node-based storage
- **AND** legacy data format is updated

#### Scenario: Guarded renumber on init/resync

- **WHEN** INIT or re-sync loads annotations and numbering gaps or mismatches are detected for a frame
- **AND** there are no in-flight operations for that frame, the system is not syncing, there are no dirty forms or focused text inputs for that frame, and there are no optimistic placeholders
- **THEN** the frame's annotations are renumbered sequentially starting at 1 (sorted by array index, preserving list order)
- **AND** UI table numbers, canvas badge numbers, and canvas table numbers are updated to match
- **AND** other frames remain unchanged
- **WHEN** any guard condition fails
- **THEN** numbering is left unchanged and a non-destructive "Refresh numbering" action is surfaced for that frame

#### Scenario: User triggers Refresh Numbering

- **WHEN** a frame has numbering gaps and guard conditions prevented auto-renumber
- **THEN** the plugin displays a contextual message: "Numbering sync paused due to active editing. [Refresh Numbers]"
- **AND** the message appears only when that frame is selected (per-frame, not global)
- **WHEN** user clicks "Refresh Numbers"
- **THEN** the frame's annotations are renumbered sequentially starting at 1
- **AND** UI table numbers, canvas badge numbers, and canvas table numbers are updated to match
- **AND** the "Refresh Numbers" prompt is dismissed
- **AND** other frames remain unchanged

## Implementation Notes

### Renumbering Algorithm

1. Filter annotations to target frame
2. Sort by current array index (preserves list order; NOT by Y-position)
3. Assign new sequential IDs: 1, 2, 3...
4. Return old→new ID mapping for canvas sync
5. Handles gaps (1,2,5,6 → 1,2,3,4) and shifts (2,3,4,5 → 1,2,3,4)

### Canvas Performance

Only write to canvas badges when value has changed:

```typescript
if (badge.characters !== String(newNumber)) {
  badge.characters = String(newNumber);
}
```

This avoids unnecessary Figma render cycles.

### Sync Model

- **Store** = Source of Truth (updates immediately, optimistic)
- **Canvas** = Projection (updates debounced at 300ms)
- No rollback on canvas write failure; mark as "out of sync" if critical error occurs
