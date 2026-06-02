# Manual Testing Guide: Auto-Layout Containers

This guide walks you through manually testing the container functionality in Figma.

## Prerequisites

1. Build the plugin: `npm run build`
2. Open Figma Desktop
3. Load the plugin (Run plugin → Select `vo-annotations`)
   - **Note**: After building, you may need to reload the plugin (right-click plugin window → Reload) to see changes
4. Have a Figma file with at least one Frame ready

## Test Scenarios

### Test 8.5: Create Multiple Annotations, Verify Auto-Stacking

**Goal**: Verify that badges and tables are automatically stacked in sorted order within containers.

**Steps**:
1. Create a Frame in Figma (or use an existing one)
2. Select the Frame
3. In the plugin UI, create multiple annotations:
   - Create annotation #1 (targeting an element in the frame)
   - Create annotation #3 (targeting a different element)
   - Create annotation #2 (targeting another element)
   - Note: Create them in non-sequential order (1, 3, 2) to test sorting
4. Click "Insert Annotations" button

**Expected Results**:
- ✅ A container named "Annotation Container - {frameId}" appears to the right of the frame
- ✅ Container has two columns: Badge Column (left) and Table Column (right)
- ✅ Badges are stacked vertically in the Badge Column in sorted order: Badge 1, Badge 2, Badge 3 (top to bottom)
- ✅ Tables are stacked vertically in the Table Column in sorted order: Table 1, Table 2, Table 3 (top to bottom)
- ✅ Badges and tables maintain consistent 8px and 50px gaps respectively
- ✅ Container is positioned at frame's right edge + 60px gap

**Visual Verification**:
- Select the container and check its structure in the Layers panel
- Verify badge column children are in order: Badge 1, Badge 2, Badge 3
- Verify table column children are in order: Table 1, Table 2, Table 3
- Check that auto-layout is enabled on container (horizontal) and columns (vertical)

---

### Test 8.6: Delete Annotation, Verify Container Remains

**Goal**: Verify that deleting one annotation removes its artifacts but keeps the container intact.

**Steps**:
1. Start with a frame that has 3+ annotations already inserted (from Test 8.5)
2. Verify container exists with badges and tables
3. In the plugin UI, delete annotation #2 (middle one)
4. Observe the canvas

**Expected Results**:
- ✅ Badge #2 is removed from Badge Column
- ✅ Table #2 is removed from Table Column
- ✅ Container still exists
- ✅ Remaining badges (1, 3) are still in sorted order
- ✅ Remaining tables (1, 3) are still in sorted order
- ✅ Container structure is intact (badge column and table column still exist)

**Visual Verification**:
- Select the container and verify it still exists
- Check badge column has only Badge 1 and Badge 3
- Check table column has only Table 1 and Table 3
- Verify gaps are maintained between remaining artifacts

---

### Test 8.7: Delete All Annotations, Verify Container Removed

**Goal**: Verify that deleting the last annotation for a frame removes the container.

**Steps**:
1. Start with a frame that has annotations inserted
2. Delete all annotations for that frame one by one:
   - Delete annotation #1
   - Delete annotation #2
   - Delete annotation #3 (or last remaining)
3. Observe the canvas after each deletion

**Expected Results**:
- ✅ After deleting each annotation, its badge and table are removed
- ✅ Container remains until the last annotation is deleted
- ✅ When the last annotation is deleted, the container is automatically removed
- ✅ No orphaned containers remain on the canvas

**Visual Verification**:
- After deleting the last annotation, search for "Annotation Container" - should find nothing
- Verify no empty containers remain on the page
- Check that frame no longer has any annotation artifacts nearby

---

### Test 8.8: Move Frame, Verify Container Follows

**Goal**: Verify that moving a frame causes the container to reposition on next sync.

**Steps**:
1. Create a frame with annotations and insert them (container should appear)
2. Note the container's current position relative to the frame
3. Move the frame to a different location (drag it significantly, >10px)
4. Make a small change to any annotation (e.g., add/remove a character in a text field) to enable the "Insert Annotations" button
5. Click "Insert Annotations" button
6. Observe container position

**Expected Results**:
- ✅ Container repositions to frame's new right edge + 60px gap
- ✅ Container maintains its relative position (right edge + 60px)
- ✅ Container Y position aligns with frame Y position (top-aligned)
- ✅ All badges and tables move with the container (they're children)
- ✅ If frame moves <10px in either X or Y direction, container will NOT reposition (10px threshold prevents unnecessary updates)
- ✅ If frame moves >10px, container WILL reposition on next "Insert Annotations" action
- ⚠️ **Note**: Container repositioning only happens during "Insert Annotations" flow, not during updates. The button requires a change to be enabled.

**Visual Verification**:
- Select the frame and note its X and Y positions
- Select the container and verify:
  - Container X = frame.x + frame.width + 60
  - Container Y = frame.y (top-aligned)
- Check that all badges and tables are still properly stacked inside
- Try moving the frame <10px - container should NOT move
- Try moving the frame >10px - container SHOULD move on next "Insert Annotations"

---

## Additional Edge Case Tests

### Test: Container Recreation After Manual Deletion

**Steps**:
1. Create annotations and insert them (container appears)
2. Manually delete the container in Figma (select and delete)
3. Click "Insert Annotations" again

**Expected Results**:
- ✅ New container is created automatically
- ✅ All badges and tables are recreated inside the new container
- ✅ Container is positioned correctly relative to frame

### Test: Multiple Frames with Containers

**Steps**:
1. Create Frame A with annotations → Insert
2. Create Frame B with annotations → Insert
3. Verify both frames have their own containers

**Expected Results**:
- ✅ Each frame has its own independent container
- ✅ Containers are positioned relative to their respective frames
- ✅ Containers don't interfere with each other

### Test: Mixed Legacy and Container Tables

**Steps**:
1. Create a frame with annotations
2. Manually create a legacy table (not in container) for comparison
3. Insert annotations (creates container-based tables)

**Expected Results**:
- ✅ Container-based tables appear in container
- ✅ Legacy table remains standalone
- ✅ Sync should discover both types of tables
- ✅ No conflicts between container and legacy tables

---

## Troubleshooting

### Container Not Appearing
- Check Figma plugin console (DevTools) for errors
- Verify frame is selected before inserting
- Check that annotations exist for the frame
- Verify frame ID matches annotation frameId
- Try reloading the plugin after building (`npm run build`)

### Badges/Tables Not Sorting Correctly
- Check annotation IDs are sequential
- Verify container structure (badge column and table column exist)
- Check that insertion logic is using sorted order

### Container Not Repositioning
- Verify frame moved >10px in either X or Y direction (10px threshold check)
- Check that "Insert Annotations" was triggered after moving frame (positioning happens during insert, not automatically)
- Verify frame still exists and is valid
- Note: Container only repositions if the difference is >10px to avoid unnecessary updates

### Container Not Deleting When Empty
- Verify all badges are removed from Badge Column
- Verify all tables are removed from Table Column
- Container is deleted only when BOTH columns are empty
- Check that deletion happened via plugin UI (not manual deletion)
- Look for any remaining artifacts with incorrect names that might prevent cleanup

---

## Success Criteria

All tests pass if:
- ✅ Containers are created automatically when inserting annotations
- ✅ Badges and tables are sorted by annotation ID
- ✅ Containers are positioned correctly relative to frames
- ✅ Containers are cleaned up when empty
- ✅ Containers reposition when frames move significantly
- ✅ Multiple frames can have independent containers
- ✅ Legacy tables still work alongside containers

---

## Reporting Issues

If you find issues during manual testing:
1. Note which test scenario failed
2. Describe the expected vs actual behavior
3. Include screenshots if possible
4. Check Figma plugin console (DevTools) for errors
5. Note the Figma version and plugin version
6. Verify plugin was reloaded after building (`npm run build`)

