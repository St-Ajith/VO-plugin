## 1. Investigation
- [ ] 1.1 Document current overlap scenarios with screenshots
- [ ] 1.2 Profile bounding box queries for performance impact

## 2. Implementation
- [ ] 2.1 Create `detectOverlap(rect1, rect2): boolean` in bounds-helpers.ts
- [ ] 2.2 Create `findNonOverlappingPosition(newRect, existingRects, nudgeStep=20)` utility
- [ ] 2.3 Modify createAnnotationTable to accept `allFrameTableBounds` parameter
- [ ] 2.4 Query existing annotation tables on canvas before placement
- [ ] 2.5 Apply nudge algorithm during initial table creation

## 3. Edge Cases
- [ ] 3.1 Handle re-nudge when table height changes (platform switch, field edit)
- [ ] 3.2 Respect user's manual repositioning (don't override if moved)

## 4. Optional Enhancement
- [ ] 4.1 Add "Reflow Annotations" command to reposition all tables optimally
