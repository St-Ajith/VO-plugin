# Tasks: Fix Badge Frame Positioning

## 1. Badge Renderer Updates

- [x] 1.1 Add `frameBounds: Rectangle` parameter to `createBadge()` in `src/services/canvas-badge.ts`
- [x] 1.2 Add `isFrameTarget: boolean` parameter to `createBadge()` to indicate if target is the frame itself
- [x] 1.3 Add `annotationIndex: number` parameter for Y stacking when multiple badges target the frame
- [x] 1.4 Calculate X position: `frameBounds.x + frameBounds.width + FRAME_TO_BADGE_GAP`
- [x] 1.5 Calculate Y position: if `isFrameTarget`, use `frameBounds.y + (annotationIndex * (BADGE_HEIGHT + BADGE_GAP))`; else use element vertical centering
- [x] 1.6 Update `updateBadge()` with same positioning logic

## 2. Canvas Service Updates

- [x] 2.1 Update `createAnnotationBadge()` signature to accept frame bounds and annotation context
- [x] 2.2 Update `updateAnnotationBadge()` signature similarly
- [x] 2.3 Compute frame bounds in callers and pass to badge methods

## 3. Message Router Updates

- [x] 3.1 In `handleUpdateAnnotations()`, compute frame bounds once before the loop
- [x] 3.2 Determine `isFrameTarget` by comparing `ann.elementId` or `ann.targetElementId` with `ann.frameId`
- [x] 3.3 Calculate `annotationIndex` for badges that target the frame
- [x] 3.4 Pass all context to `updateAnnotationBadge()`

## 4. Validation & Testing

- [x] 4.1 Update badge positioning tests in `src/__tests__/integration/canvas-operations.test.ts`
- [x] 4.2 Add test case for frame-level annotation badge stacking
- [ ] 4.3 Verify badge does not overlap frame border with edge-positioned elements
- [ ] 4.4 Manual testing: create annotations on elements near frame edge
- [ ] 4.5 Manual testing: create multiple annotations with only the frame selected
