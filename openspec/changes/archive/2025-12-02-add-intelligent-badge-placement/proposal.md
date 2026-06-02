# Change: Add Intelligent Badge Placement with Element Targeting

## Why

Current badge and table placement is hardcoded: badges go top-right of elements, tables go 60px right of the target. This creates problems:

1. **No x-axis intelligence**: Tables extend outside frame boundaries when elements are near the right edge
2. **No sub-frame targeting**: Plugin detects only top-level frames; designers cannot indicate which nested elements should be annotated
3. **Badge misalignment**: Badges are not visually centered on the element's edge, reducing scan-ability

Designers have different workflows—some prefer selection-based annotation, others prefer naming-based tagging for bulk operations. The system needs to support both.

## What Changes

### Badge Positioning
- Badge placed at **right edge** of target element, **vertically centered**
- Consistent visual alignment with annotation numbering

### Table Column Layout
- All tables for a frame placed in a **single column** to the right of the frame's bounding box
- Column starts 60px right of frame's right edge
- Tables stacked vertically with deterministic ordering (by annotation ID)
- Defers Y-axis collision nudging to `investigate-collision-avoidance`

### Element Targeting (Dual Mode)
- **Mode A (Selection)**: Multi-select elements → "Add Annotations" creates annotations for all selected items
- **Mode B (Naming Convention)**: Elements with `vo-label-trait` prefix in their layer name are auto-detected and offered for annotation when frame is selected

### Orphan Handling
- When a targeted element is deleted, annotation is kept with a warning indicator
- UI provides re-targeting option to attach annotation to a different element

## Impact

- **Affected specs**: `canvas-rendering`, `annotation-management`
- **New spec**: `element-targeting` (defines naming convention detection and targeting modes)
- **Affected code**:
  - `src/services/canvas-badge.ts` - badge positioning logic
  - `src/services/canvas.ts` - table column layout
  - `src/utils/figma-helpers.ts` - naming convention scanner
  - `src/types.ts` - add `targetElementId` to Annotation type
  - `src/ui/components/AnnotationList.tsx` - orphan warning UI

## Related Changes

- **`investigate-collision-avoidance`**: Handles Y-axis table nudging within the column; complementary to this proposal's X-axis column layout
- **`add-leader-line-connectors`**: Leader lines will connect badges to tables; badge positioning affects line anchor points
