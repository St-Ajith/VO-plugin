# Design: Auto-Layout Containers for Annotation Artifacts

## Context
The current canvas rendering system positions each annotation table and badge individually using manual coordinate calculations. This requires:
1. `calculateProjectedHeight()` - Predicts table height before rendering
2. `findNonOverlappingPosition()` - Nudges tables to avoid collisions
3. Manual Y-offset stacking based on annotation ID order
4. Separate positioning logic for badges vs tables

Figma's Auto Layout feature can handle all of this automatically, simplifying the codebase significantly.

## Goals
- Eliminate manual positioning calculations for tables and badges
- Use native Figma Auto Layout for automatic stacking and spacing
- Maintain visual hierarchy: badges appear to the left of tables
- Preserve current visual appearance and spacing
- Simplify table/badge insertion to "append to container"
- Simplify sync by grouping all artifacts for a frame in one discoverable container
- Enable O(1) container lookup instead of O(n) page scans for table discovery

## Non-Goals
- Changing the visual appearance of individual tables or badges
- Modifying table content structure or styling
- Cross-frame artifact management (each frame has its own container)

## Decisions

### Decision 1: One Container Per Frame
**What**: Create a single auto-layout container for each annotated frame.
**Why**: 
- Matches current behavior where tables are positioned relative to their source frame
- Allows independent positioning when frames are far apart
- Container lifecycle matches frame annotation lifecycle

**Alternatives considered**:
- Global container for all annotations: Rejected - would complicate positioning for distant frames
- Separate containers for badges and tables: Rejected - harder to maintain alignment

### Decision 2: Horizontal Layout with Badge and Table Columns
**What**: Container uses horizontal auto-layout with two child frames:
```
[Container (horizontal auto-layout)]
  ├── [Badge Column (vertical auto-layout)]
  │     ├── Badge 1
  │     ├── Badge 2
  │     └── Badge N
  └── [Table Column (vertical auto-layout)]
        ├── Table 1
        ├── Table 2
        └── Table N
```

**Why**:
- Badges and tables stack vertically within their columns
- Horizontal layout keeps badges to the left of tables
- Gap between columns is configurable
- Both columns auto-size based on content

**Spacing constants** (preserved from current implementation):
- Frame to container gap: 60px (`FRAME_TO_TABLE_GAP`)
- Container horizontal item spacing: 8px (gap between badge and table columns)
- Vertical gap between badges: 8px (`badgeColumn.itemSpacing`)
- Vertical gap between tables: 50px (`tableColumn.itemSpacing`, matches `GAP_HEIGHT`)

### Decision 3: Container Naming and Metadata
**What**: Container is named `Annotation Container - {frameId}` and stores metadata in plugin data.

**Metadata structure**:
```typescript
interface ContainerMetadata {
  sourceFrameId: string;
  version: number;
  timestamp: number;
}
```

**Why**:
- Naming convention matches existing patterns (tables, badges)
- Metadata enables reliable lookup and lifecycle management
- Version field supports future schema migrations

### Decision 4: Insertion Order = Annotation ID Order
**What**: Children are inserted in annotation ID order (lowest ID at top).

**Why**:
- Matches current deterministic stacking behavior
- Consistent visual order regardless of creation sequence
- When inserting a new annotation, find correct position based on ID

**Implementation**:
```typescript
// Extract annotation IDs from existing children
const extractIdFromName = (name: string): number | null => {
  const match = name.match(/^Annotation (Badge|Table) (\d+) -/);
  return match ? parseInt(match[2], 10) : null;
};

const sortedIds = column.children
  .map((child) => extractIdFromName(child.name))
  .filter((id): id is number => id !== null)
  .sort((a, b) => a - b);

// Find insertion index
const insertIndex = sortedIds.findIndex((id) => id > annotationId);

if (insertIndex === -1) {
  // Append to end
  column.appendChild(child);
} else {
  // Insert at correct position
  column.insertChild(insertIndex, child);
}
```

**Note**: Implementation uses separate `insertBadgeIntoContainer()` and `insertTableIntoContainer()` methods that operate on badge and table columns respectively.

### Decision 5: Badge-Table Alignment
**What**: Badges and tables are aligned by annotation ID (Badge 1 aligns with Table 1).

**Challenge**: Badges and tables have different heights, so direct alignment isn't automatic.

**Solution**: 
- Don't force pixel-perfect alignment between badge and table rows
- Let each column flow naturally with its own spacing
- Leader lines (future) will provide the visual connection

**Why**: 
- Simpler implementation
- Natural auto-layout behavior
- Leader lines will clarify relationships better than alignment

## Risks / Trade-offs

### Risk: Container Deletion Edge Cases
**Risk**: If user manually deletes the container, all artifacts are lost.
**Mitigation**: 
- On next "Insert Annotations", detect missing container and recreate
- Container recreation reinserts all artifacts for that frame

### Risk: Container Position Drift
**Risk**: User might move the container, breaking the frame-relative positioning.
**Mitigation**: 
- On "Insert Annotations", `positionContainerRelativeToFrame()` repositions container to frame's right edge
- Uses 10px threshold to avoid unnecessary repositioning for minor frame movements
- Container position updates automatically when frame moves significantly (>10px)

### Trade-off: Less Granular Control
**Trade-off**: Users can no longer move individual tables independently.
**Acceptance**: 
- Consistent layout is more important than per-table positioning
- Users can still move the entire container
- Individual table styling is preserved

### Benefit: Simplified Sync
**Benefit**: Sync becomes much simpler with containers.
- Table discovery: `findOne(node => node.name === 'Annotation Container - {frameId}')` instead of scanning entire page
- Frame move handling: Update container position once, all children move automatically
- Cache invalidation: Only need to track container IDs, not individual table IDs
- Artifact ownership: Container metadata provides authoritative frame→artifact mapping

## Migration Plan

### Phase 1: Create Containers (This Change)
1. On "Insert Annotations", check if container exists for frame
2. If not, create container at frame's right edge
3. Insert badges and tables into container instead of directly on canvas
4. Update delete logic to remove from container

### Phase 2: Legacy Cleanup (Future)
- Detect legacy standalone tables/badges and offer migration
- Or automatically migrate on next plugin load

## Open Questions

1. **Q**: Should we lock the container to prevent accidental moves?
   **A**: No - let users reposition if needed. Track position in metadata for future "reset" feature.

2. **Q**: Should badge-table rows be grouped (one auto-layout row per annotation)?
   **A**: No - separate columns are simpler and work better with varying heights. Leader lines will connect them visually.
