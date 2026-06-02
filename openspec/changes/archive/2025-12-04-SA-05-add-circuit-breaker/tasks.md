## 1. Foundation

- [x] 1.1 Create `src/utils/circuit-breaker.ts`
- [x] 1.2 Define `CircuitBreakerState` enum: `CLOSED`, `OPEN`, `HALF_OPEN`
- [x] 1.3 Define `CircuitBreaker` class with per-key instances
- [x] 1.4 Define configuration: `{ failureThreshold: 3, failureWindowMs: 5000, cooldownMs: 30000 }`

## 2. Circuit Breaker Logic

- [x] 2.1 Implement `recordFailure(key)` - increments failure count, checks threshold
- [x] 2.2 Implement `recordSuccess(key)` - resets failure count
- [x] 2.3 Implement `isOpen(key)` - returns true if breaker is tripped
- [x] 2.4 Implement `getTimeUntilReset(key)` - returns remaining cooldown ms
- [x] 2.5 Implement auto-reset after cooldown period

## 3. State Management

- [x] 3.1 Store failure timestamps in sliding window (not just count)
- [x] 3.2 Remove failures older than `failureWindowMs` before threshold check
- [x] 3.3 Track `lastTripTime` for cooldown calculation
- [x] 3.4 Implement `HALF_OPEN` state for testing recovery

## 4. Canvas Service Integration

- [x] 4.1 Import circuit breaker in `canvas.ts`
- [x] 4.2 Wrap `createAnnotationTable()` with breaker check (key: `cb_INSERT_ANNOTATIONS`)
- [x] 4.3 Wrap `updateAnnotationTable()` with breaker check (key: `cb_UPDATE_ANNOTATIONS`)
- [x] 4.4 Wrap `createBadge()` with breaker check (key: `cb_INSERT_ANNOTATIONS`)
- [x] 4.5 On operation success, call `recordSuccess(key)`
- [x] 4.6 On operation failure, call `recordFailure(key)`

## 4a. Message Router Integration

- [x] 4a.1 Add circuit breaker check in message handlers (e.g., `save-data`, `delete-data`)
- [x] 4a.2 Check breaker **after** Valibot validation (no point checking breaker for invalid payloads)
- [x] 4a.3 If breaker is open, emit `FIGMA_ERROR` and return early
- [x] 4a.4 If breaker is closed, proceed with operation

## 5. FIGMA_ERROR Emission

- [x] 5.1 Define `FIGMA_ERROR` message type in `types.ts`
- [x] 5.2 Emit `FIGMA_ERROR` when breaker trips: `{ operation, reason, cooldownMs }`
- [x] 5.3 Emit `FIGMA_ERROR_CLEARED` when breaker resets
- [x] 5.4 Include human-readable message: "Canvas operations paused for 30s due to repeated failures"

## 6. UI Integration

- [x] 6.1 Add `circuitBreakerErrors` signal to `store.ts` (note: `isSyncing` signal already exists from SA-03, no conflict)
- [x] 6.2 Handle `FIGMA_ERROR` to add operation to error set
- [x] 6.3 Handle `FIGMA_ERROR_CLEARED` to remove from error set
- [ ] 6.4 Disable "Insert Annotations" button when `cb_INSERT_ANNOTATIONS` is open
- [ ] 6.5 Show warning banner: "Canvas sync temporarily paused. Will retry in {seconds}s"
- [ ] 6.6 Show countdown timer for cooldown

## 7. Testing

- [x] 7.1 Unit test: 3 failures within 5s trips breaker
- [x] 7.2 Unit test: Failures outside window don't trip breaker
- [x] 7.3 Unit test: Success resets failure count
- [x] 7.4 Unit test: Breaker auto-resets after cooldown
- [x] 7.5 Integration test: Tripped breaker prevents operation execution
- [ ] 7.6 Integration test: UI shows warning when breaker is open
- [x] 7.7 Integration test: Different operations have independent breakers

## Dependencies

- Independent of SA-01 through SA-04 (can parallelize)
- Task 1.x must complete before 2.x, 3.x
- Tasks 2.x and 3.x can run in parallel
- Task 4.x depends on 2.x and 3.x
- Task 4a.x depends on 2.x, 3.x, and 4.x (runs in parallel with 4.x)
- Task 5.x depends on 4.x and 4a.x
- Task 6.x depends on 5.x
- Task 7.x depends on all prior tasks
