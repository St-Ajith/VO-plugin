# Change: Add Leader Line Connectors

## Why
PRD Epic 2 specifies leader line connectors to visually connect annotation boxes to their target elements, eliminating ambiguity. This feature is inspired by https://www.getseal.co/. Currently not implemented.

## What Changes
- Create lines connecting badges/tables to annotated elements using `figma.createLine()`
- Store line node ID in table metadata for lifecycle management
- Group lines with annotation artifacts
- Update line endpoints when table, badge, or element moves

## Impact
- Affected specs: canvas-rendering
- Affected code: canvas.ts, canvas-badge.ts, types.ts, main.ts (nodechange handler)

> [!NOTE]
> Badges are now `FrameNode` (not `GroupNode`) per `replace-groups-with-frames` change (2025-12-08). Badge metadata includes `elementId` which can be used for line endpoint target resolution.

