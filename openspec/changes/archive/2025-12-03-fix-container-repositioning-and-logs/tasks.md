# Tasks: Fix Container Repositioning and Log Clarity

## 1. Add Container Management to UPDATE Flow
- [x] 1.1 Add container get/create to `handleUpdateAnnotations()` - Call `getOrCreateContainer()` after frame validation - Added at line 242
- [x] 1.2 Add container repositioning to `handleUpdateAnnotations()` - Call `positionContainerRelativeToFrame()` with same 10px threshold - Added at line 245
- [x] 1.3 Add initial log message - `Logger.info("Update annotations", "Starting update of X annotations")` - Added at lines 227-230
- [x] 1.4 Add container operation logs - Log container get/create and repositioning with "Update annotations" scope - Added at line 241

## 2. Improve INSERT Flow Logs
- [x] 2.1 Update log scope from "Batch insert" to "Insert annotations" - Change all log calls in `handleInsertAnnotationsBatched()` - Updated all occurrences (lines 345, 395, 404, 514, 540)
- [x] 2.2 Update initial log message - `Logger.info("Insert annotations", "Starting insertion of X annotations")` - Updated at lines 345-348
- [x] 2.3 Update progress log - `Logger.debug("Insert annotations", "Progress: X/Y: operation")` - Updated at line 514
- [x] 2.4 Update completion log - `Logger.info("Insert annotations", "Completed", {...})` - Updated at line 540

## 3. Improve UPDATE Flow Logs
- [x] 3.1 Add initial log message - `Logger.info("Update annotations", "Starting update of X annotations")` - Added at lines 227-230
- [x] 3.2 Update error log scope - Change "Update annotation" to "Update annotations" (plural) for consistency - Updated at lines 270, 297, 684
- [x] 3.3 Add completion log - `Logger.info("Update annotations", "Completed", {updated: X, failed: Y})` - Added at lines 301-304
- [x] 3.4 Add container operation logs - Log container get/create and repositioning with operation context - Added at line 241

## 4. Verify Container Operation Logs
- [x] 4.1 Verify container creation logs include operation context - Check logs in both INSERT and UPDATE flows - Verified: INSERT flow calls getOrCreateContainer() which logs "Container creation", UPDATE flow logs "Getting or creating container" with "Update annotations" scope
- [x] 4.2 Verify container repositioning logs include operation context - Check logs show which operation triggered repositioning - Verified: positionContainerRelativeToFrame() logs "Container positioning" with details, called from both INSERT (line 402) and UPDATE (line 245) flows
- [x] 4.3 Verify container cleanup logs are clear - Ensure deletion logs are clear about operation context - Verified: Container cleanup logs use "Canvas cleanup" scope in canvas.ts, called from delete flows

## 5. Testing
- [x] 5.1 Manual test: Move frame, click "Update Annotations", verify container repositions - ✅ Container repositioned correctly (xDiff: 1840, yDiff: 1303)
- [x] 5.2 Manual test: Check logs show "Update annotations" scope during UPDATE - ✅ All logs use "Update annotations" scope correctly
- [x] 5.3 Manual test: Check logs show "Insert annotations" scope during INSERT - ✅ Verified from INSERT logs (line 13, 32-36, 331)
- [x] 5.4 Manual test: Verify container operation logs appear in both flows - ✅ Container operations logged in both INSERT and UPDATE flows

