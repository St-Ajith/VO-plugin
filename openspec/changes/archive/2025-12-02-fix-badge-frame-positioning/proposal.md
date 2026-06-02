# Change: Fix Badge Frame Positioning

## Why

Current badge placement has two issues:

1. **Badge collision with frame border**: Badges are placed at the right edge of the *selected element*. When the element is near the right edge of the frame, the badge overlaps the frame border, making it visually confusing and potentially obscuring content.

2. **Badge stacking when frame is selected**: When a user selects only the top-level frame (no sub-element), all annotations for that frame use the frame itself as the target. Since they all share the same bounding box, all badges stack on top of each other at the same position.

## What Changes

### Badge X-Axis Positioning
- Badge X position is calculated relative to the **root frame's right edge** (not the target element)
- Provides consistent column placement for all badges in a frame
- Uses `FRAME_TO_BADGE_GAP` (8px) from frame's right edge

### Badge Y-Axis Positioning (when target = frame)
- When `targetElementId` equals `frameId` (no sub-element targeted), badges are **stacked vertically**
- Y position is calculated by annotation order: `frame.y + (annotationIndex * (BADGE_HEIGHT + BADGE_GAP))`
- Prevents badge overlap for frame-level annotations

### Badge Y-Axis Positioning (when target ≠ frame)
- Current behavior preserved: badge is vertically centered on the target element
- Y position: `target.y + (target.height / 2) - (BADGE_HEIGHT / 2)`

## Impact

- **Affected specs**: `canvas-rendering`
- **Affected code**:
  - `src/services/canvas-badge.ts` - badge positioning logic
  - `src/services/canvas.ts` - pass frame bounds to badge renderer
  - `src/services/message-router.ts` - pass frame context during badge updates

## Related Changes

- **`add-leader-line-connectors`**: Leader lines connect badges to tables; badge positioning affects line anchor points. This change should be merged first.
