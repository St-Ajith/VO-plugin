## Why

- Canvas-driven selection should always sync the UI to the source frame and highlight the linked annotation, including containers, badges, and table descendants.
- Current behavior only handles top-level table selection, causing missed frame switches and no accordion expansion when badges/containers are selected.

## What Changes

- Broaden selection handling to annotation containers, badges, and table descendants so the UI switches to the source frame.
- When a canvas annotation badge/table is selected, auto-expand the linked annotation in the UI drawer.
- On multi-select of annotation tables, honor only the first selected element’s parent table for frame selection/expansion.

## Impact

- Affected capability: `frame-detection` (selection-driven frame switching and annotation expansion).
- Code touchpoints: selection handling in plugin context (FrameManager/CanvasService), UI expansion signaling.

> [!NOTE]
> Badges are now `FrameNode` (not `GroupNode`) per `replace-groups-with-frames` change (2025-12-08). Selection detection must check for `type === 'FRAME'` in addition to legacy `'GROUP'` badges.
