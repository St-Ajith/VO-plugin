# Change: Add Optimistic State Recovery

## Why

The UI performs optimistic updates—immediately reflecting changes before Main thread confirmation. If the Main thread operation fails (node save error, validation rejection), the UI state becomes inconsistent with the authoritative source. Simple "undo" is insufficient because other plugins or users may have modified the document concurrently. Full re-sync with the authoritative source is required.

## What Changes

- **Valibot validation**: Runtime schema validation for incoming IPC payloads using Valibot (lightweight, tree-shakeable)
- **Pre-mutation snapshots**: UI captures `annotations.value` before optimistic update, stored in `inFlightRequests` (from SA-02)
- **Failure detection**: On `save-data-result.success === false`, trigger recovery
- **Full re-sync**: On failure, request fresh `INIT` payload from Main thread instead of local rollback
- **User feedback**: Show "Operation failed, syncing..." loading overlay during recovery
- **Syncing indicator**: `isSyncing` signal controls UI loading state
- **Echo prevention**: Mutation handlers check `isSyncing` to prevent Sync → Save → Sync loops

## Impact

- **Affected specs**: `annotation-management` (recovery behavior for CRUD operations)
- **Affected code**:
  - New dependency: `valibot@^1.2.0` in `package.json`
  - New file: `src/schema/annotation-schema.ts` (Valibot schemas and validation helpers)
  - New file: `src/__tests__/schema/annotation-schema.test.ts` (validation tests)
  - New file: `src/__tests__/integration/state-recovery.test.ts` (recovery tests)
  - Modified: `src/store.ts` (`isSyncing` signal, `resetStore` update)
  - Modified: `src/types.ts` (`request-resync` message type, `RequestResyncHandler`)
  - Modified: `src/hooks/usePluginMessages.ts` (`save-data-result` handler, `request-resync` emit)
  - Modified: `src/services/message-router.ts` (Valibot validation, `request-resync` handler)
  - Modified: `src/services/annotation-store.ts` (validate in `setAnnotations`)
  - Modified: `src/ui.tsx` (syncing overlay, echo prevention guards in handlers)
- **Dependencies**: SA-02 (uses `inFlightRequests` for snapshot storage)
