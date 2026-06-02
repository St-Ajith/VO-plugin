# Change: Add Canvas Operation Circuit Breaker

## Why

Canvas operations can fail repeatedly due to transient Figma API issues (memory limits, network errors for font loading, permission issues). Without a circuit breaker, the plugin continuously retries, flooding the console with errors and potentially degrading Figma performance. Per-operation circuit breakers allow granular degradation—if table creation fails, badge updates can still work.

## What Changes

- **Per-operation circuit breakers**: Keyed by message type (e.g., `cb_INSERT_ANNOTATIONS`, `cb_UPDATE_ANNOTATIONS`)
- **Failure tracking**: Count consecutive failures per operation
- **Trip threshold**: 3 failures within 5 seconds trips the breaker
- **Cooldown period**: 30 seconds before auto-reset
- **FIGMA_ERROR emission**: Notify UI of circuit breaker state
- **Graceful degradation**: UI disables affected feature during cooldown

## Impact

- **Affected specs**: `sync` (circuit breaker pattern for canvas operations)
- **Affected code**:
  - New file: `src/utils/circuit-breaker.ts`
  - Modified: `src/services/canvas.ts` (wrap operations with circuit breaker)
  - Modified: `src/services/message-router.ts` (check breaker after Valibot validation, before processing)
  - Modified: `src/store.ts` (add `circuitBreakerErrors` signal, handle `FIGMA_ERROR` for UI state)
    - Note: `isSyncing` signal already exists (added in SA-03), no conflict
- **Dependencies**: Independent (can parallelize with SA-01 through SA-04)
