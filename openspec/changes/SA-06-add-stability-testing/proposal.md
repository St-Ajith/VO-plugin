# Change: Add Idempotency and Concurrency Testing

## Why

The stability improvements in SA-01 through SA-05 introduce complex patterns (command queue, request tracking, transaction wrappers, circuit breakers). Without automated tests verifying idempotency and race condition handling, regressions can reintroduce the stability issues these patterns were designed to prevent. Manual testing cannot reliably simulate rapid concurrent operations.

## What Changes

- **Idempotency test pattern**: "Running operation N times produces same result as running once"
- **Concurrency stress tests**: Simulate rapid parallel operations
- **Race condition tests**: Verify queue serialization prevents interleaving
- **Orphan cleanup tests**: Verify transaction wrapper garbage collection
- **Circuit breaker tests**: Verify failure isolation and recovery
- **State recovery edge cases**: Additional tests beyond basic coverage in `src/__tests__/integration/state-recovery.test.ts` (from SA-03)
- **Echo prevention tests**: Verify handlers block actions during sync and INIT doesn't trigger save-data
- **Valibot validation tests**: Verify invalid payloads return structured errors with requestId correlation

## Impact

- **Affected specs**: `testing` (new test patterns for stability verification)
- **Affected code**:
  - New file: `src/__tests__/integration/stability.test.ts`
  - New file: `src/__tests__/integration/idempotency.test.ts`
  - New file: `src/__tests__/integration/circuit-breaker.test.ts`
  - Modified: `src/__tests__/integration/state-recovery.test.ts` (add edge case tests)
  - Modified: `src/__tests__/mocks/figma.ts` (add failure simulation)
  - Modified: `src/__tests__/mocks/messages.ts` (add timing simulation)
- **Dependencies**: Validates SA-01 through SA-05 (runs after all implemented)
- **Note**: Basic state recovery tests already exist in `src/__tests__/integration/state-recovery.test.ts` from SA-03. Section 7 focuses on additional edge cases (echo prevention, validation error handling) beyond the basic coverage.
