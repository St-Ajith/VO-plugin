## 1. Implementation
- [ ] 1.1 Create `src/services/canvas-leader-line.ts` with `LeaderLineRenderer` class
- [ ] 1.2 Extend `TableMetadata` interface in types.ts to include `leaderLineId`
- [ ] 1.3 Implement `createLeaderLine(elementBounds, tableBounds)` using figma.createLine()
- [ ] 1.4 Group line with annotation table in createAnnotationTable()

## 2. Lifecycle Management
- [ ] 2.1 Add line deletion to `cleanupCanvasArtifacts()`
- [ ] 2.2 Implement line position update in nodechange handler when table/element moves

## 3. Visual Options
- [ ] 3.1 Add line styling (color matching theme, weight 1-2px)
- [ ] 3.2 Optional: Add arrowhead pointing to element
