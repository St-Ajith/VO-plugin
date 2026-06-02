# Design: Fix Badge Frame Positioning

## Problem Statement

### Issue 1: Badge Collision with Frame Border

Current badge placement uses the target element's right edge:

```
┌────────────────────────────────┐
│  Frame                         │
│                     ┌───────┐  │
│                     │ Elem  │[1]  ← Badge overlaps frame border
│                     └───────┘  │
└────────────────────────────────┘
```

This creates visual clutter when elements are positioned near the frame's right edge.

### Issue 2: Badge Stacking When Frame is Target

When only the frame is selected (no sub-element), all annotations share the same target:

```
┌────────────────────────────────┐
│  Frame                         │
│                                │[1][2][3] ← All badges at same position
└────────────────────────────────┘
```

## Proposed Solution

### Badge X Position: Frame-Relative

Place all badges at a consistent X position relative to the frame's right edge:

```
┌────────────────────────────────┐   [1]
│  Frame                         │   [2]
│                     ┌───────┐  │   [3]
│                     │ Elem  │  │   
│                     └───────┘  │   
└────────────────────────────────┘
                                  ↑
                        8px from frame edge
```

### Badge Y Position: Context-Dependent

#### When Target is Sub-Element

Center badge on the element's vertical midpoint (current behavior for Y):

```
                                     [1] ← Centered on element height
                     ┌───────┐
                     │ Elem  │
                     └───────┘
```

#### When Target is Frame

Stack badges vertically from the frame's top:

```
┌────────────────────────────────┐   [1] ← frame.y + 0 * 32
│  Frame                         │   [2] ← frame.y + 1 * 32
│                                │   [3] ← frame.y + 2 * 32
└────────────────────────────────┘
```

Where `32 = BADGE_HEIGHT (24) + BADGE_GAP (8)`

## API Changes

### BadgeRenderer

```typescript
// Before
createBadge(num: number, frameId: string, target: SceneNode): GroupNode

// After
createBadge(
  num: number,
  frameId: string,
  target: SceneNode,
  frameBounds: Rectangle,
  options: {
    isFrameTarget: boolean;
    annotationIndex: number;
  }
): GroupNode
```

### Position Calculation

```typescript
// X position (always frame-relative)
const badgeX = frameBounds.x + frameBounds.width + ELEMENT_TO_BADGE_GAP;

// Y position (context-dependent)
const badgeY = options.isFrameTarget
  ? frameBounds.y + (options.annotationIndex * (BADGE_HEIGHT + BADGE_GAP))
  : target.y + (target.height / 2) - (BADGE_HEIGHT / 2);
```

## Trade-offs

### Option A: Frame-Relative X (Chosen)
- **Pros**: Badges never overlap frame; consistent column alignment
- **Cons**: Badge may be far from its element for left-positioned elements

### Option B: Element-Relative X with Clamp
- **Pros**: Badge stays near element
- **Cons**: Complex logic; still possible overlap with wide elements

### Decision: Option A

Frame-relative positioning is simpler and matches the table column layout (already 60px from frame edge). Leader lines will connect badges to elements, maintaining the visual relationship.

## Edge Cases

1. **Element near right edge**: Badge appears outside frame (correct behavior)
2. **Very tall frame with many annotations**: Badges may extend below frame (acceptable, matches table stacking)
3. **Annotation deleted mid-stack**: Remaining badges should re-index on next update
