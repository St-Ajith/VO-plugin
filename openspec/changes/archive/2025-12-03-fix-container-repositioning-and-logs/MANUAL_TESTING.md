# Manual Testing Guide: Fix Container Repositioning and Log Clarity

## Prerequisites

1. **Open Figma Dev Console**: 
   - Open the plugin in Figma
   - Open browser DevTools (View → Developer → Show DevTools)
   - Go to Console tab to see logs

2. **Test Setup**:
   - Have a frame with existing annotations
   - Know the frame ID (visible in plugin UI or logs)

## Test 5.1: Container Repositioning in UPDATE Flow

### Steps:
1. **Initial State**: 
   - Select a frame that has annotations
   - Note the current position of the annotation container (should be visible to the right of the frame)
   - Record container position: X = `___`, Y = `___`

2. **Move Frame**:
   - Move the frame significantly (>10px in any direction)
   - Record new frame position: X = `___`, Y = `___`

3. **Trigger UPDATE**:
   - Click "Update Annotations" button in the plugin UI
   - Wait for operation to complete

4. **Verify Container Repositioned**:
   - Check if the container moved to follow the frame
   - Record final container position: X = `___`, Y = `___`
   - Container should be positioned at: `frame.x + frame.width + 10px` (FRAME_TO_TABLE_GAP)

### Expected Behavior:
- ✅ Container should reposition to follow the frame
- ✅ Container X should be `frame.x + frame.width + 10px`
- ✅ Container Y should match `frame.y`

### Debug Output Needed:
Please provide:
1. Console logs from the UPDATE operation (copy all logs with scope "Update annotations")
2. Container positions (before move, after move, after UPDATE)
3. Frame positions (before move, after move)

---

## Test 5.2: UPDATE Flow Log Scope Verification

### Steps:
1. **Clear Console**: Clear the console to start fresh
2. **Trigger UPDATE**: Click "Update Annotations" on a frame with annotations
3. **Capture Logs**: Copy all console output

### Expected Log Sequence:
You should see logs in this order with scope **"Update annotations"**:

1. `Logger.info("Update annotations", "Starting update of X annotations")`
2. `Logger.debug("Update annotations", "Getting or creating container", { frameId })`
3. `Logger.debug("Container lookup", "Found existing container", {...})` OR `Logger.debug("Container creation", "Created annotation container", {...})`
4. `Logger.debug("Container positioning", "Repositioned container", {...})` (if frame moved >10px)
5. `Logger.info("Update annotations", "Completed", {total: X, updated: Y, failed: Z})`

### Debug Output Needed:
Please provide:
1. **All console logs** from the UPDATE operation
2. **Filter by scope**: Show only logs with scope containing "Update annotations" or "Container"
3. **Verify**: Confirm NO logs use old scope "Update annotation" (singular) or "Batch insert"

---

## Test 5.3: INSERT Flow Log Scope Verification

### Steps:
1. **Clear Console**: Clear the console to start fresh
2. **Trigger INSERT**: Click "Insert Annotations" (or create new annotations) on a frame
3. **Capture Logs**: Copy all console output

### Expected Log Sequence:
You should see logs with scope **"Insert annotations"**:

1. `Logger.info("Insert annotations", "Starting insertion of X annotations")`
2. Container operation logs (if container is created/repositioned)
3. Progress logs: `Logger.debug("Insert annotations", "Progress: X/Y: operation")`
4. `Logger.info("Insert annotations", "Completed", {...})`

### Debug Output Needed:
Please provide:
1. **All console logs** from the INSERT operation
2. **Filter by scope**: Show only logs with scope containing "Insert annotations" or "Container"
3. **Verify**: Confirm NO logs use old scope "Batch insert"

---

## Test 5.4: Container Operation Logs in Both Flows

### Part A: Container Operations in UPDATE Flow

#### Steps:
1. **Clear Console**
2. **Move frame** >10px from its current position
3. **Trigger UPDATE**: Click "Update Annotations"
4. **Capture logs**

#### Expected Container Logs:
- `Logger.debug("Update annotations", "Getting or creating container", { frameId })`
- `Logger.debug("Container lookup", "Found existing container", {...})` OR `Logger.debug("Container creation", "Created annotation container", {...})`
- `Logger.debug("Container positioning", "Repositioned container", {frameId, containerX, containerY, xDiff, yDiff})`

### Part B: Container Operations in INSERT Flow

#### Steps:
1. **Clear Console**
2. **Move frame** >10px from its current position (or use a frame without container)
3. **Trigger INSERT**: Click "Insert Annotations"
4. **Capture logs**

#### Expected Container Logs:
- Container creation/repositioning logs (may be called internally)
- `Logger.debug("Container positioning", "Repositioned container", {...})` (if repositioned)

### Debug Output Needed:
Please provide:
1. **Container operation logs from UPDATE flow** (scope should include "Update annotations" context)
2. **Container operation logs from INSERT flow**
3. **Verify**: Both flows should show container operation logs with appropriate context

---

## Summary Checklist

After completing all tests, verify:

- [ ] **5.1**: Container repositions when frame moves and UPDATE is triggered
- [ ] **5.2**: All UPDATE logs use scope "Update annotations" (plural, consistent)
- [ ] **5.3**: All INSERT logs use scope "Insert annotations" (not "Batch insert")
- [ ] **5.4**: Container operation logs appear in both UPDATE and INSERT flows with operation context

## Common Issues to Watch For

1. **Container doesn't reposition**: Check if frame moved >10px (threshold requirement)
2. **Missing logs**: Ensure console is capturing all log levels (info, debug, warn, error)
3. **Wrong scope**: Old scopes like "Batch insert" or "Update annotation" (singular) indicate incomplete changes
4. **No container logs**: Container operations should always log, even if container already exists

## Next Steps

After manual testing:
1. Update `tasks.md` to mark test tasks as complete
2. Document any issues found
3. If all tests pass, mark the change as ready for merge

