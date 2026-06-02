# Change: Fix Container Repositioning and Log Clarity

## Why
During manual testing, we discovered two issues:

1. **Container repositioning only works during INSERT**: When users click "Update Annotations" after moving a frame, the container doesn't reposition to follow the frame. This breaks the expected behavior where containers should always track their frame's position.

2. **Log messages are confusing**: Logs don't clearly distinguish between Insert, Update, and Sync operations. Container operations (create/reposition/cleanup) aren't consistently logged with operation context, making debugging difficult.

## What Changes
- Add container repositioning to UPDATE flow (currently only in INSERT)
- Improve log message clarity to distinguish Insert vs Update vs Sync operations
- Add consistent container operation logging in both INSERT and UPDATE flows
- Update notification messages to match operation type

## Impact
- Affected specs: canvas-rendering
- Affected code:
  - `src/services/message-router.ts` - Add container management to `handleUpdateAnnotations()`, improve log messages in both handlers
  - `src/services/canvas.ts` - Container operation logs already clear, verify consistency
- No breaking changes - this is a bug fix and logging improvement

