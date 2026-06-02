# Design: Intelligent Badge Placement

## Context

The plugin currently places badges and tables relative to individual annotated elements with fixed offsets. This approach fails when:
- Elements are near frame edges (tables clip outside)
- Multiple annotations exist (no unified visual structure)
- Designers want to bulk-tag elements without clicking each one

This design addresses x-axis placement intelligence and element targeting workflows.

## Goals / Non-Goals

### Goals
- Badges visually aligned to right edge of elements, vertically centered
- Tables in a single column to the right of the frame (clear visual hierarchy)
- Support selection-based and naming-convention-based element targeting
- Graceful handling when annotated elements are deleted

### Non-Goals
- Left-side placement fallback (deferred—rarely needed for annotation workflows)
- Automatic layout within frame bounds (tables intentionally outside frame)
- Y-axis collision avoidance (handled by `investigate-collision-avoidance`)

## Decisions

### Decision 1: Badge Position = Right Edge + Vertical Center

**Rationale**: Badges on the right edge create a clear reading path—scan down the right side to see annotation numbers, then look right for details. Vertical centering provides visual balance.

**Implementation**:
```typescript
const badgeX = target.absoluteBoundingBox.x + target.absoluteBoundingBox.width + 8; // 8px gap
const badgeY = target.absoluteBoundingBox.y + (target.absoluteBoundingBox.height / 2) - (badgeHeight / 2);
```

### Decision 2: Table Column = Frame Right Edge + Fixed Offset

**Rationale**: A single column prevents visual chaos from scattered tables. Placing it outside the frame keeps designs clean while making annotations accessible.

**Implementation**:
```typescript
const frameBox = frame.absoluteBoundingBox;
const columnX = frameBox.x + frameBox.width + 60; // 60px gap from frame edge
const tableY = // deterministic based on annotation ID order + stacking
```

### Decision 3: Naming Convention = `vo-label-trait` Prefix

**Rationale**: Explicit, plugin-specific prefix avoids false positives. Format mirrors the core annotation fields (label, trait). Designers can bulk-rename layers in Figma to tag them.

**Pattern**: `vo-label-trait {label text}`

**Examples**:
- `vo-label-trait Back Button`
- `vo-label-trait Choose a ride Header`
- `vo-label-trait UberX $14.95 Button`

**Detection**:
```typescript
function findTaggedElements(frame: FrameNode): SceneNode[] {
  return frame.findAll(node => node.name.startsWith('vo-label-trait '));
}
```

### Decision 4: Dual Targeting Modes (Mixed Support)

**Rationale**: Designers work differently. Some prefer click-to-annotate (Mode A). Others prefer naming layers upfront (Mode B). Both modes can coexist—named elements are "pre-tagged" and can be supplemented by selection.

**Flow**:
1. User selects frame
2. Plugin scans for `vo-label-trait` prefixed elements
3. If found, prompt: "Found X tagged elements. Add annotations?" 
4. User can also multi-select elements and click "Add Annotations" (Mode A)
5. Both methods store `targetElementId` in annotation metadata

### Decision 5: Orphan Annotations with Re-targeting

**Rationale**: When an annotated element is deleted, the annotation data is still valuable. Deleting it silently loses work. Instead, show a warning and let the user attach it to a new element.

**UI**:
- Orphaned annotation shows ⚠️ icon
- Tooltip: "Original element was deleted. Click to re-target."
- Re-target action: Enter selection mode, user clicks new element, annotation updates

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Naming convention too verbose | Keep simple (`vo-label-trait`); consider shorter alias in future |
| Users forget to tag elements | Mode A (selection) remains primary; naming is opt-in power feature |
| Orphan UI clutters annotation list | Collapse orphans by default; show count badge |
| Badge overlap with adjacent elements | Defer to `investigate-collision-avoidance` for nudging |

## Open Questions

1. **Should `vo-label-trait` parsing extract initial annotation values from the name?**
   - e.g., `vo-label-trait Back Button` → label="Back", trait="Button"
   - Decision: Yes, parse as `{label} {trait}` if space-separated; allows pre-filling fields

2. **Should orphan annotations be auto-hidden or always visible?**
   - Decision: Visible with warning icon; designers need to know about data integrity issues
