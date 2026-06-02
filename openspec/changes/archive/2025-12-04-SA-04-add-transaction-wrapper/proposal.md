# Change: Add Atomic Transaction Wrapper for Node Operations

## Why

Canvas operations (creating tables, badges, containers) involve multiple Figma API calls. If an intermediate step fails (e.g., font loading error after container creation), partially created nodes remain as orphans. Users see incomplete artifacts that require manual cleanup. The transaction wrapper ensures all-or-nothing semantics for multi-step node operations.

## What Changes

- **Draft Frame pattern**: Create nodes with `visible: false` inside a temporary FrameNode during construction
  - Note: Uses FrameNode instead of GroupNode because GroupNode does not support the `visible` property
  - Draft frame positioned at (0, 0) to preserve child coordinates during unboxing
- **Transaction tagging**: Add `isTransactionDraft: "true"` to plugin data for cleanup identification
- **Draft naming**: Use `⚠️ [BUILDING] {name}` prefix during construction
- **Commit phase**: On success, move children to parent (preserving coordinates), delete draft frame
- **Compensate phase**: On failure, delete the entire draft frame
- **Startup garbage collection**: On plugin init, scan for orphaned draft nodes and clean up

## Impact

- **Affected specs**: `sync` (transaction wrapper for canvas operations)
- **Affected code**:
  - New file: `src/utils/transaction-wrapper.ts`
  - Modified: `src/services/canvas.ts` (wrap `createAnnotationTable()` in transaction)
  - Modified: `src/main.ts` (startup cleanup scan)
  - Note: `canvas-badge.ts` and container creation NOT wrapped (simple single-step operations)
- **Dependencies**: SA-01 (command queue provides execution context)
- **Tests**: 20 unit tests in `src/__tests__/utils/transaction-wrapper.test.ts`
