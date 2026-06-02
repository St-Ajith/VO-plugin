# Replace Groups With Frames

## Context

The codebase currently uses Figma Groups (`GroupNode`) and `figma.group` for creating badges and potentially other elements.
The user request is to remove all `GroupNode` usage and replace it with "FrameGroups" (Frames acting as groups).
Groups are less flexible than Frames (e.g., constraints, auto-layout).

## Goals

1.  **Remove `figma.group` usage**: Replace explicit group creation with frame creation.
2.  **Remove `GroupNode` type dependency**: Update all type signatures and casts to use `FrameNode`.
3.  **Update Parser Logic**: Ensure badge detection looks for Frames, not Groups.
4.  **Backward Compatibility**: Maintain `GROUP` check in the parser for legacy support.
5.  **Robust Element Identification**: Store `elementId` in badge metadata to ensure parser can resolve elements even when badges are inside containers.

## Non-Goals

- Changing the visual design of the badge (unless necessitated by Frame behavior).

## Risk

- **Parsing breakage**: If we stop looking for Groups, old annotations might not be detectable unless we keep the check or migrate them.
- **Layout changes**: Frames behave differently than groups regarding bounds and constraints.
- **Container Traversal**: Badges inside containers have different parent hierarchies, requiring updated parsing logic.

## Approach

1.  **Modify `canvas-badge.ts`**:
    - Create a `FrameNode` with `fills = []` and `clipsContent = false`.
    - Store `elementId` in badge metadata for parser resolution.
2.  **Update `canvas-parser.ts`**:
    - Check for `type === 'FRAME'` in addition to `'GROUP'`.
    - Add a new `resolveElementId` strategy: read `elementId` from badge metadata.
    - Update `findElementFromBadge` to handle container frame traversal.
3.  **Update Type Definitions**:
    - `transaction-wrapper.ts`: Update `draftGroup` to `FrameNode`.
    - `types.ts`: Add `elementId?: string` to `BadgeMetadata`.
4.  **Update Tests**: Replace `MockGroupNode` with `MockFrameNode`.

## Status: COMPLETED

All changes have been implemented and verified with 381 passing tests.
