# Change: Investigate and Improve Collision Avoidance

## Why
PRD specifies a collision avoidance algorithm to prevent annotation tables from overlapping. Currently, only same-element stacking exists (50px gap). Tables for different elements can overlap—see comment in canvas.ts#L760.

## What Changes
- Add collision detection utility comparing bounding boxes
- Implement nudge algorithm (20px down until no overlap)
- Apply nudge during table creation and updates
- Optional: Add "reflow" command to reposition all annotations

## Impact
- Affected specs: canvas-rendering
- Affected code: canvas.ts, bounds-helpers.ts, frame-manager.ts
